import os
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes
import requests
import json

# Настройки
TELEGRAM_TOKEN = "ВАШ_TELEGRAM_BOT_TOKEN"
SUPABASE_URL = "ВАШ_SUPABASE_URL"
SUPABASE_KEY = "ВАШ_SUPABASE_KEY"

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# Функции работы с Supabase
async def get_fridge_items():
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    response = requests.get(f"{SUPABASE_URL}/rest/v1/fridge_items?select=*,products(*)",
                          headers=headers)
    return response.json() if response.status_code == 200 else []

async def get_shopping_list():
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    response = requests.get(f"{SUPABASE_URL}/rest/v1/shopping_list?select=*,products(*)&purchased=eq.false",
                          headers=headers)
    return response.json() if response.status_code == 200 else []

async def add_to_shopping(product_name):
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    
    # Сначала ищем или создаем продукт
    product_data = {"name": product_name, "category": "other", "unit": "шт"}
    product_response = requests.post(f"{SUPABASE_URL}/rest/v1/products",
                                    headers=headers,
                                    json=product_data)
    
    if product_response.status_code == 201:
        product_id = product_response.json()[0]["id"]
        
        # Добавляем в список покупок
        shopping_data = {"product_id": product_id, "quantity": 1, "priority": 1}
        shopping_response = requests.post(f"{SUPABASE_URL}/rest/v1/shopping_list",
                                         headers=headers,
                                         json=shopping_data)
        return shopping_response.status_code == 201
    return False

# Команды бота
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [InlineKeyboardButton("📦 Что в холодильнике?", callback_data='fridge')],
        [InlineKeyboardButton("🛒 Список покупок", callback_data='shopping')],
        [InlineKeyboardButton("➕ Добавить продукт", callback_data='add')],
        [InlineKeyboardButton("📊 Статистика", callback_data='stats')],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "Привет! Я бот для управления семейным холодильником.\n"
        "Выберите действие:",
        reply_markup=reply_markup
    )

async def fridge_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    items = await get_fridge_items()
    
    if not items:
        await update.message.reply_text("Холодильник пуст! 🏠")
        return
    
    message = "📦 *В холодильнике:*\n\n"
    for item in items[:10]:  # Ограничиваем 10 элементами
        product = item.get('products', {})
        message += f"• {product.get('name', 'Неизвестно')} - {item.get('quantity', 1)} {product.get('unit', 'шт')}\n"
    
    if len(items) > 10:
        message += f"\n... и ещё {len(items) - 10} продуктов"
    
    await update.message.reply_text(message, parse_mode='Markdown')

async def shopping_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    items = await get_shopping_list()
    
    if not items:
        await update.message.reply_text("Список покупок пуст! 🎉")
        return
    
    message = "🛒 *Список покупок:*\n\n"
    for i, item in enumerate(items[:15], 1):
        product = item.get('products', {})
        priority = "🔴" if item.get('priority') == 1 else "🟡" if item.get('priority') == 2 else "🔵"
        message += f"{i}. {priority} {product.get('name', 'Неизвестно')} - {item.get('quantity', 1)} {product.get('unit', 'шт')}\n"
    
    await update.message.reply_text(message, parse_mode='Markdown')

async def add_product(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text("Использование: /add <название продукта>")
        return
    
    product_name = " ".join(context.args)
    success = await add_to_shopping(product_name)
    
    if success:
        await update.message.reply_text(f"✅ Добавлено в список покупок: {product_name}")
    else:
        await update.message.reply_text("❌ Ошибка при добавлении продукта")

async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    if query.data == 'fridge':
        items = await get_fridge_items()
        message = "📦 *В холодильнике:*\n\n" + "\n".join(
            f"• {item.get('products', {}).get('name')} - {item.get('quantity')} шт"
            for item in items[:5]
        )
        await query.edit_message_text(
            text=message if items else "Холодильник пуст!",
            parse_mode='Markdown'
        )
    
    elif query.data == 'shopping':
        items = await get_shopping_list()
        message = "🛒 *Список покупок:*\n\n" + "\n".join(
            f"• {item.get('products', {}).get('name')} - {item.get('quantity')} шт"
            for item in items[:5]
        )
        await query.edit_message_text(
            text=message if items else "Список покупок пуст!",
            parse_mode='Markdown'
        )
    
    elif query.data == 'add':
        await query.edit_message_text(
            text="Чтобы добавить продукт, отправьте команду:\n"
                 "/add <название продукта>\n\n"
                 "Например: /add молоко"
        )

async def notify_low_stock(context: ContextTypes.DEFAULT_TYPE):
    """Функция для уведомлений о заканчивающихся продуктах"""
    items = await get_fridge_items()
    low_stock = []
    
    for item in items:
        if item.get('quantity', 0) < 2:  # Меньше 2 единиц
            product = item.get('products', {})
            low_stock.append(f"{product.get('name')} ({item.get('quantity')} {product.get('unit', 'шт')})")
    
    if low_stock:
        message = "⚠️ *Заканчиваются продукты:*\n\n" + "\n".join(low_stock)
        await context.bot.send_message(
            chat_id=context.job.chat_id,
            text=message,
            parse_mode='Markdown'
        )

def main():
    # Создаем приложение
    application = Application.builder().token(TELEGRAM_TOKEN).build()
    
    # Добавляем обработчики команд
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("fridge", fridge_command))
    application.add_handler(CommandHandler("shopping", shopping_command))
    application.add_handler(CommandHandler("add", add_product))
    application.add_handler(CallbackQueryHandler(button_handler))
    
    # Запускаем бота
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()
