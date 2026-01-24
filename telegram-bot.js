// telegram-bot.js
const { Telegraf } = require('telegraf')
const { createClient } = require('@supabase/supabase-js')

// Конфигурация
const BOT_TOKEN = 'ВАШ_TELEGRAM_BOT_TOKEN'
const SUPABASE_URL = 'https://ваш-проект.supabase.co'
const SUPABASE_KEY = 'ваш-supabase-key'

// Инициализация
const bot = new Telegraf(BOT_TOKEN)
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Команда /start
bot.start((ctx) => {
  ctx.reply(
    '🛒 *Семейный список покупок*\n\n' +
    'Доступные команды:\n' +
    '/list - показать список\n' +
    '/add [продукт] - добавить продукт\n' +
    '/done [номер] - отметить купленным\n' +
    '/clear - очистить купленное\n' +
    '/family [код] - присоединиться к семье',
    { parse_mode: 'Markdown' }
  )
})

// Показать список
bot.command('list', async (ctx) => {
  const { data } = await supabase
    .from('shopping_items')
    .select('*')
    .eq('purchased', false)
    .order('created_at', { ascending: false })
  
  if (!data || data.length === 0) {
    return ctx.reply('📭 Список покупок пуст!')
  }
  
  const list = data.map((item, index) => 
    `${index + 1}. ${item.name} ${item.quantity > 1 ? `(${item.quantity} шт)` : ''}`
  ).join('\n')
  
  ctx.reply(`🛒 *Список покупок:*\n\n${list}`, { parse_mode: 'Markdown' })
})

// Добавить продукт
bot.command('add', async (ctx) => {
  const text = ctx.message.text
  const productName = text.replace('/add', '').trim()
  
  if (!productName) {
    return ctx.reply('Использование: /add молоко')
  }
  
  await supabase
    .from('shopping_items')
    .insert([{ 
      name: productName,
      quantity: 1
    }])
  
  ctx.reply(`✅ Добавлено: ${productName}`)
})

// Отметить купленным
bot.command('done', async (ctx) => {
  const text = ctx.message.text
  const number = parseInt(text.replace('/done', '').trim())
  
  if (isNaN(number)) {
    return ctx.reply('Использование: /done 1')
  }
  
  const { data } = await supabase
    .from('shopping_items')
    .select('*')
    .eq('purchased', false)
    .order('created_at', { ascending: false })
  
  if (data && data[number - 1]) {
    await supabase
      .from('shopping_items')
      .update({ purchased: true })
      .eq('id', data[number - 1].id)
    
    ctx.reply(`✅ Отмечено: ${data[number - 1].name}`)
  } else {
    ctx.reply('❌ Неверный номер')
  }
})

// Очистить купленное
bot.command('clear', async (ctx) => {
  await supabase
    .from('shopping_items')
    .delete()
    .eq('purchased', true)
  
  ctx.reply('🧹 Купленные товары удалены')
})

// Присоединиться к семье
bot.command('family', async (ctx) => {
  const code = ctx.message.text.replace('/family', '').trim().toUpperCase()
  
  if (!code) {
    return ctx.reply('Использование: /family ABC123')
  }
  
  const { data } = await supabase
    .from('families')
    .select('id')
    .eq('invite_code', code)
    .single()
  
  if (data) {
    ctx.reply(`✅ Вы присоединились к семье!\n\nТеперь все изменения будут синхронизироваться.`)
  } else {
    ctx.reply('❌ Неверный код семьи')
  }
})

// Запуск бота
bot.launch()
  .then(() => console.log('🤖 Telegram бот запущен!'))
  .catch(err => console.error('Ошибка бота:', err))

// Graceful остановка
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
