import os
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes
import requests
import json

# === НАСТРОЙКИ ===
TELEGRAM_TOKEN = "8231208800:AAEihy4T4-ZcWh9bLxml49bgjRC2i4VT944"  # Вставьте токен от @BotFather
SUPABASE_URL = "https://rkbrxjbtilumisyeenlu.supabase.co"
SUPABASE_KEY = "sb_publishable_Oipp5tzp4yb3z8UwrJjm6w_7HGvQq9Z"

# === КОМАНДЫ БОТА ===
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [InlineKeyboardButton("📦 Холодильник", callback_data='fridge')],
        [InlineKeyboardButton("🛒 Список покупок", callback_data='shopping')],
        [InlineKeyboardButton("➕ Добавить продукт", callback_data='add')],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(
        "Привет! Я бот для семейного списка покупок.\n"
        "Выберите действие:",
        reply_markup=reply_markup
    )

async def add_product(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text("Использование: /add молоко")
        return
    
    product_name = " ".join(context.args)
    
    # Добавляем в Supabase
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    
    # 1. Добавляем продукт
    product_data = {"name": product_name}
    response = requests.post(f"{SUPABASE_URL}/rest/v1/products",
                           headers=headers, json=product_data)
    
    if response.status_code == 201:
        product_id = response.json()[0]["id"]
        
        # 2. Добавляем в список покупок
        shopping_data = {
            "product_id": product_id,
            "quantity": 1,
            "priority": 1,
            "purchased": False
        }
        requests.post(f"{SUPABASE_URL}/rest/v1/shopping_list",
                     headers=headers, json=shopping_data)
        
        await update.message.reply_text(f"✅ Добавлено: {product_name}")
    else:
        await update.message.reply_text("❌ Ошибка при добавлении")

# === ЗАПУСК БОТА ===
def main():
    application = Application.builder().token(TELEGRAM_TOKEN).build()
    
    # Регистрация команд
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("add", add_product))
    
    # Запуск
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()
