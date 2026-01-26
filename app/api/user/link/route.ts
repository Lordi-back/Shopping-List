import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { code, telegramChatId, telegramUsername } = await request.json();

    if (!code || !telegramChatId) {
      return NextResponse.json(
        { error: 'Code and Telegram Chat ID are required' },
        { status: 400 }
      );
    }

    // Ищем код
    const { data: codeData, error: codeError } = await supabase
      .from('user_sync_codes')
      .select('*')
      .eq('sync_code', code)
      .single();

    if (codeError || !codeData) {
      return NextResponse.json(
        { error: 'Неверный код синхронизации' },
        { status: 404 }
      );
    }

    // Проверяем, не привязан ли уже этот Telegram
    const { data: existingLink } = await supabase
      .from('user_sync_codes')
      .select('*')
      .eq('telegram_chat_id', telegramChatId)
      .single();

    if (existingLink) {
      return NextResponse.json(
        { error: 'Этот Telegram уже привязан к другому аккаунту' },
        { status: 400 }
      );
    }

    // Обновляем запись с Telegram данными
    const { error: updateError } = await supabase
      .from('user_sync_codes')
      .update({
        telegram_chat_id: telegramChatId,
        telegram_username: telegramUsername || null,
        last_used: new Date().toISOString()
      })
      .eq('id', codeData.id);

    if (updateError) throw updateError;

    return NextResponse.json({ 
      success: true, 
      message: 'Telegram успешно привязан',
      userId: codeData.user_id,
      permanentCode: codeData.sync_code,
      linkedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error linking Telegram:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
