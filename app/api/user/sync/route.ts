import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Генерируем постоянный 8-значный код
    const generateCode = () => {
      return Math.random().toString(36).substring(2, 10).toUpperCase();
    };

    // Проверяем, есть ли уже код у пользователя
    const { data: existingCode } = await supabase
      .from('user_sync_codes')
      .select('*')
      .eq('user_id', userId)
      .single();

    let syncCode: string;

    if (existingCode) {
      // Используем существующий код
      syncCode = existingCode.sync_code;
      
      // Обновляем время последнего использования
      await supabase
        .from('user_sync_codes')
        .update({ last_used: new Date().toISOString() })
        .eq('id', existingCode.id);
    } else {
      // Создаем новый уникальный код
      syncCode = generateCode();
      
      // Проверяем уникальность
      let isUnique = false;
      let attempts = 0;
      
      while (!isUnique && attempts < 10) {
        const { data: checkCode } = await supabase
          .from('user_sync_codes')
          .select('id')
          .eq('sync_code', syncCode)
          .single();
        
        if (!checkCode) {
          isUnique = true;
        } else {
          syncCode = generateCode();
          attempts++;
        }
      }

      // Сохраняем в базу
      const { data, error } = await supabase
        .from('user_sync_codes')
        .insert([
          {
            user_id: userId,
            sync_code: syncCode,
            created_at: new Date().toISOString(),
            last_used: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) throw error;
    }

    // Получаем информацию о привязке Telegram
    const { data: syncInfo } = await supabase
      .from('user_sync_codes')
      .select('telegram_username, telegram_chat_id, created_at')
      .eq('user_id', userId)
      .single();

    return NextResponse.json({ 
      success: true, 
      code: syncCode,
      isLinked: !!syncInfo?.telegram_chat_id,
      telegramUsername: syncInfo?.telegram_username || null,
      linkedAt: syncInfo?.created_at || null
    });
    
  } catch (error) {
    console.error('Error generating sync code:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Проверка статуса
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const userId = searchParams.get('userId');

  if (code) {
    // Проверка кода
    const { data, error } = await supabase
      .from('user_sync_codes')
      .select('*')
      .eq('sync_code', code)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Code not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      valid: true,
      userId: data.user_id,
      telegramChatId: data.telegram_chat_id,
      telegramUsername: data.telegram_username
    });
  }

  if (userId) {
    // Получение информации пользователя
    const { data, error } = await supabase
      .from('user_sync_codes')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      return NextResponse.json({ exists: false });
    }

    return NextResponse.json({
      exists: true,
      code: data.sync_code,
      isLinked: !!data.telegram_chat_id,
      telegramUsername: data.telegram_username,
      created: data.created_at
    });
  }

  return NextResponse.json(
    { error: 'Code or userId required' },
    { status: 400 }
  );
}
