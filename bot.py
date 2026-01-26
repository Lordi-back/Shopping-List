import imghdr_fix 
import os
import logging
import requests
if sys.version_info >= (3, 13):
    # Эмуляция отсутствующего модуля imghdr
    class FakeImghdr:
        def what(self, *args, **kwargs):
            return None
    
    sys.modules['imghdr'] = FakeImghdr()
    import warnings
    warnings.filterwarnings("ignore", message="'imghdr' module is deprecated")

# === ИМПОРТ ПОСЛЕ ФИКСА ===
from telegram import Update, ReplyKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

# === НАСТРОЙКИ ===
TELEGRAM_TOKEN = "8231208800:AAEihy4T4-ZcWh9bLxml49bgjRC2i4VT944"  # Вставьте токен от @BotFather
SUPABASE_URL = "https://rkbrxjbtilumisyeenlu.supabase.co"
SUPABASE_KEY = "sb_publishable_Oipp5tzp4yb3z8UwrJjm6w_7HGvQq9Z"

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# === ПОДКЛЮЧЕНИЕ К SUPABASE ===
def supabase_request(endpoint, method="GET", data=None):
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    
    if method == "GET":
        response = requests.get(url, headers=headers)
    elif method == "POST":
        response = requests.post(url, headers=headers, json=data)
    elif method == "DELETE":
        response = requests.delete(url, headers=headers)
    
    return response.json() if response.status_code < 300 else None

# === КОМАНДЫ БОТА ===
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /start с запросом кода семьи"""
    keyboard = [
        [InlineKeyboardButton("🔗 Присоединиться к семье", callback_data='join_family')],
        [InlineKeyboardButton("👨‍👩‍👧‍👦 Создать семью", callback_data='create_family')],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "👋 *Добро пожаловать в Family Chef!*\n\n"
        "Я помогу:\n"
        "• 📝 Вести список покупок\n"
        "• 🍳 Найти рецепты из того что есть\n"
        "• 💰 Управлять семейным бюджетом\n\n"
        "*Для начала:*\n"
        "1. Создайте семью в приложении\n"
        "2. Получите код семьи\n"
        "3. Введите его здесь командой:\n"
        "   `/code ВАШ_КОД`",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )

async def code_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /code для привязки к семье"""
    if not context.args:
        await update.message.reply_text(
            "Введите код семьи:\n"
            "Пример: `/code FAMILY123`",
            parse_mode='Markdown'
        )
        return
    
    family_code = context.args[0].upper()
    user_id = update.effective_user.id
    
    # Проверяем код в базе
    families = supabase_request(f"families?invite_code=eq.{family_code}")
    
    if families and len(families) > 0:
        # Сохраняем привязку пользователя к семье
        # В реальном проекте нужно сохранить в базу
        context.user_data['family_code'] = family_code
        context.user_data['family_id'] = families[0]['id']
        
        await update.message.reply_text(
            f"✅ Вы присоединились к семье!\n"
            f"Код: *{family_code}*\n\n"
            "Теперь доступны команды:\n"
            "• `/list` - что в холодильнике\n"
            "• `/add молоко` - добавить продукт\n"
            "• `/recipes` - рецепты из имеющегося",
            parse_mode='Markdown'
        )
    else:
        await update.message.reply_text(
            "❌ Неверный код семьи.\n"
            "Проверьте код или создайте новую семью в приложении."
        )

async def list_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /list - показать что в холодильнике"""
    if 'family_id' not in context.user_data:
        await update.message.reply_text(
            "Сначала присоединитесь к семье командой `/code ВАШ_КОД`",
            parse_mode='Markdown'
        )
        return
    
    family_id = context.user_data['family_id']
    
    # Получаем продукты из холодильника семьи
    fridge_items = supabase_request(
        f"fridge_items?family_id=eq.{family_id}"
        "&select=*,products(name,quantity)"
    )
    
    if not fridge_items or len(fridge_items) == 0:
        await update.message.reply_text("📭 Холодильник пуст!")
        return
    
    message = "📦 *В холодильнике:*\n\n"
    for item in fridge_items[:10]:  # Ограничим 10 продуктами
        product_name = item.get('products', {}).get('name', 'Неизвестно')
        quantity = item.get('quantity', 1)
        message += f"• {product_name} - {quantity} шт\n"
    
    await update.message.reply_text(message, parse_mode='Markdown')

async def add_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /add - добавить продукт"""
    if not context.args:
        await update.message.reply_text(
            "Использование: `/add молоко 2`\n"
            "Или: `/add хлеб` (по умолчанию 1 шт)",
            parse_mode='Markdown'
        )
        return
    
    # Парсим аргументы
    args = " ".join(context.args).split()
    product_name = args[0]
    quantity = int(args[1]) if len(args) > 1 else 1
    
    # Добавляем в базу
    # 1. Создаем/находим продукт
    product_data = {"name": product_name, "category": "other", "unit": "шт"}
    product_response = supabase_request("products", "POST", product_data)
    
    if product_response:
        product_id = product_response[0]['id']
        
        # 2. Добавляем в холодильник
        fridge_data = {
            "product_id": product_id,
            "quantity": quantity,
            "family_id": context.user_data.get('family_id')
        }
        supabase_request("fridge_items", "POST", fridge_data)
        
        await update.message.reply_text(
            f"✅ Добавлено: *{product_name}* ({quantity} шт)",
            parse_mode='Markdown'
        )
    else:
        await update.message.reply_text("❌ Ошибка при добавлении")

async def recipes_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /recipes - рецепты из имеющегося"""
    await update.message.reply_text(
        "🍳 *Система рецептов*\n\n"
        "Эта функция в разработке. Скоро здесь появятся:\n"
        "• Рецепты из ваших продуктов\n"
        "• Сортировка по времени приготовления\n"
        "• Рейтинг и отзывы\n\n"
        "А пока можете добавить продукты командой `/add`",
        parse_mode='Markdown'
    )

# === КНОПКИ ===
async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    if query.data == 'join_family':
        await query.edit_message_text(
            "Введите код семьи командой:\n"
            "`/code ВАШ_КОД`\n\n"
            "Код можно получить в веб-приложении.",
            parse_mode='Markdown'
        )
    elif query.data == 'create_family':
        await query.edit_message_text(
            "Создайте семью в веб-приложении:\n"
            "👉 https://shoppinglist-navy.vercel.app\n\n"
            "После создания получите код семьи "
            "и введите его здесь командой `/code`",
            parse_mode='Markdown'
        )

# === ЗАПУСК БОТА ===
def main():
    print("🚀 Запуск Telegram бота...")
    
    application = Application.builder().token(TELEGRAM_TOKEN).build()
    
    # Регистрируем команды
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("code", code_command))
    application.add_handler(CommandHandler("list", list_command))
    application.add_handler(CommandHandler("add", add_command))
    application.add_handler(CommandHandler("recipes", recipes_command))
    application.add_handler(CallbackQueryHandler(button_handler))
    
    # Запускаем
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()
