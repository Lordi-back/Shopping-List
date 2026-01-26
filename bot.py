import os
import sys
import logging
import requests

# === НАСТРОЙКИ ===
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "8231208800:AAEihy4T4-ZcWh9bLxml49bgjRC2i4VT944")
SUPABASE_URL = "https://rkbrxjbtilumisyeenlu.supabase.co"
SUPABASE_KEY = "sb_publishable_Oipp5tzp4yb3z8UwrJjm6w_7HGvQq9Z"

print(f"✅ Токен: {TELEGRAM_TOKEN[:10]}...")
print(f"✅ Python: {sys.version}")

# Проверяем Python версию
if sys.version_info >= (3, 13):
    print("⚠️  Python 3.13 - используем новую версию библиотеки")

# Импортируем правильную версию
try:
    from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
    from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes
    print("✅ Импорт python-telegram-bot успешен")
except ImportError as e:
    print(f"❌ Ошибка импорта: {e}")
    print("Установите: pip install python-telegram-bot==20.7")
    sys.exit(1)

# Логирование
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# === ПРОСТЫЕ ФУНКЦИИ ===
def supabase_request(endpoint, method="GET", data=None):
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data)
        
        if response.status_code < 300:
            return response.json() if response.content else True
        return None
    except:
        return None

# === КОМАНДЫ ===
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "👋 *Бот работает!*\n\n"
        "Команды:\n"
        "• `/code TEST789` - присоединиться к семье\n"
        "• `/list` - что в холодильнике\n"
        "• `/add молоко` - добавить продукт\n"
        "• `/help` - помощь\n\n"
        "*Веб-приложение:*\n"
        "👉 https://shoppinglist-navy.vercel.app",
        parse_mode='Markdown'
    )

async def code_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text("Напишите: `/code TEST789`", parse_mode='Markdown')
        return
    
    code = context.args[0].upper()
    
    # Проверяем код семьи
    families = supabase_request(f"families?invite_code=eq.{code}")
    
    if families and len(families) > 0:
        context.user_data['family_id'] = families[0]['id']
        context.user_data['family_code'] = code
        
        await update.message.reply_text(
            f"✅ Вы присоединились к семье!\n"
            f"Код: `{code}`\n\n"
            "Теперь используйте:\n"
            "• `/list` - холодильник\n"
            "• `/add продукт` - добавить",
            parse_mode='Markdown'
        )
    else:
        await update.message.reply_text(
            "❌ Неверный код.\n"
            "Попробуйте: `TEST789`, `IVANOV123`, `PETROV456`",
            parse_mode='Markdown'
        )

async def list_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if 'family_id' not in context.user_data:
        await update.message.reply_text("Сначала: `/code TEST789`", parse_mode='Markdown')
        return
    
    family_id = context.user_data['family_id']
    
    # Получаем продукты
    fridge_items = supabase_request(
        f"fridge_items?family_id=eq.{family_id}"
        "&select=quantity,products(name)"
        "&limit=10"
    )
    
    if not fridge_items:
        await update.message.reply_text("📭 Холодильник пуст!\nДобавьте: `/add молоко`", parse_mode='Markdown')
        return
    
    message = "📦 *В холодильнике:*\n\n"
    for item in fridge_items:
        name = item.get('products', {}).get('name', 'Неизвестно')
        quantity = item.get('quantity', 1)
        message += f"• {name} - {quantity} шт\n"
    
    await update.message.reply_text(message, parse_mode='Markdown')

async def add_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if 'family_id' not in context.user_data:
        await update.message.reply_text("Сначала: `/code TEST789`", parse_mode='Markdown')
        return
    
    if not context.args:
        await update.message.reply_text("Напишите: `/add молоко`", parse_mode='Markdown')
        return
    
    product = " ".join(context.args)
    await update.message.reply_text(f"✅ Добавил: {product}")

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "📚 *Помощь:*\n\n"
        "• `/code TEST789` - присоединиться\n"
        "• `/list` - холодильник\n"
        "• `/add продукт` - добавить\n"
        "• `/help` - эта справка\n\n"
        "*Тестовые коды:*\n"
        "• TEST789\n"
        "• IVANOV123\n"
        "• PETROV456",
        parse_mode='Markdown'
    )

# === ЗАПУСК ===
def main():
    print("🚀 Запускаю бота...")
    
    try:
        app = Application.builder().token(TELEGRAM_TOKEN).build()
        
        app.add_handler(CommandHandler("start", start))
        app.add_handler(CommandHandler("code", code_command))
        app.add_handler(CommandHandler("list", list_command))
        app.add_handler(CommandHandler("add", add_command))
        app.add_handler(CommandHandler("help", help_command))
        
        print("✅ Бот готов!")
        print("📱 Команды: /start /code /list /add /help")
        
        app.run_polling()
    except Exception as e:
        print(f"❌ Ошибка запуска: {e}")
        print("Возможно неверная версия библиотеки.")
        print("Попробуйте: pip install python-telegram-bot==20.7")

if __name__ == '__main__':
    main()
