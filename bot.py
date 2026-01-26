import os
import sys
import logging
import requests
import asyncio
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes

# === НАСТРОЙКИ ===
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "8231208800:AAEihy4T4-ZcWh9bLxml49bgjRC2i4VT944")
SUPABASE_URL = "https://rkbrxjbtilumisyeenlu.supabase.co"
SUPABASE_KEY = "sb_publishable_Oipp5tzp4yb3z8UwrJjm6w_7HGvQq9Z"

print(f"✅ Токен: {TELEGRAM_TOKEN[:10]}...")
print(f"✅ Python: {sys.version}")

# Проверка токена
if not TELEGRAM_TOKEN or "ВАШ_ТОКЕН" in TELEGRAM_TOKEN:
    print("❌ ОШИБКА: TELEGRAM_BOT_TOKEN не установлен!")
    sys.exit(1)

# Логирование
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# === ПРОСТЫЕ ФУНКЦИИ ДЛЯ SUPABASE ===
def supabase_request(endpoint, method="GET", data=None):
    """Простой запрос к Supabase"""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data)
        elif method == "PATCH":
            response = requests.patch(url, headers=headers, json=data)
        
        if response.status_code < 300:
            return response.json() if response.content else True
        return None
    except Exception as e:
        print(f"❌ Ошибка Supabase: {e}")
        return None

# === КОМАНДЫ ===
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /start"""
    keyboard = [
        [InlineKeyboardButton("🔗 Присоединиться", callback_data='join')],
        [InlineKeyboardButton("👨‍👩‍👧‍👦 Создать семью", callback_data='create')],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "👋 *Привет! Я бот для семейного списка покупок.*\n\n"
        "*Для начала:*\n"
        "1. Используйте тестовый код: `/code TEST789`\n"
        "2. Посмотрите холодильник: `/list`\n"
        "3. Добавьте продукты: `/add молоко`\n\n"
        "*Тестовые коды:*\n"
        "• TEST789\n"
        "• IVANOV123\n"
        "• PETROV456",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )

async def code_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Присоединение к семье"""
    if not context.args:
        await update.message.reply_text(
            "Введите код семьи:\n"
            "`/code TEST789`\n\n"
            "Или другие тестовые коды:\n"
            "`/code IVANOV123`\n"
            "`/code PETROV456`",
            parse_mode='Markdown'
        )
        return
    
    code = context.args[0].upper()
    print(f"🔄 Пользователь {update.effective_user.id} пытается присоединиться с кодом: {code}")
    
    # Ищем семью в базе
    families = supabase_request(f"families?invite_code=eq.{code}")
    
    if not families or len(families) == 0:
        await update.message.reply_text(
            f"❌ Код `{code}` не найден.\n\n"
            "Попробуйте тестовые коды:\n"
            "• TEST789\n"
            "• IVANOV123\n"
            "• PETROV456",
            parse_mode='Markdown'
        )
        return
    
    family = families[0]
    context.user_data['family_id'] = family['id']
    context.user_data['family_code'] = code
    context.user_data['family_name'] = family.get('name', 'Семья')
    
    # Сохраняем пользователя
    user_data = {
        "telegram_id": str(update.effective_user.id),
        "family_id": family['id'],
        "username": update.effective_user.username,
        "first_name": update.effective_user.first_name,
        "last_name": update.effective_user.last_name
    }
    
    # Проверяем есть ли пользователь
    existing = supabase_request(f"users?telegram_id=eq.{update.effective_user.id}&family_id=eq.{family['id']}")
    if not existing or len(existing) == 0:
        supabase_request("users", "POST", user_data)
    else:
        supabase_request(f"users?telegram_id=eq.{update.effective_user.id}&family_id=eq.{family['id']}", "PATCH", user_data)
    
    await update.message.reply_text(
        f"✅ Вы присоединились к семье *{family.get('name', 'Семья')}*!\n\n"
        f"Код: `{code}`\n\n"
        "*Теперь доступно:*\n"
        "• `/list` - холодильник\n"
        "• `/add молоко` - добавить\n"
        "• `/shopping` - покупки\n"
        "• `/recipes` - рецепты\n"
        "• `/family` - информация",
        parse_mode='Markdown'
    )

async def list_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Что в холодильнике"""
    family_id = context.user_data.get('family_id')
    
    if not family_id:
        await update.message.reply_text(
            "Сначала присоединитесь:\n"
            "`/code TEST789`",
            parse_mode='Markdown'
        )
        return
    
    print(f"🔄 Пользователь {update.effective_user.id} запрашивает холодильник семьи {family_id}")
    
    # Получаем продукты
    fridge_items = supabase_request(
        f"fridge_items?family_id=eq.{family_id}"
        "&select=id,quantity,products(name,unit,category)"
        "&order=created_at.desc"
        "&limit=15"
    )
    
    if not fridge_items or len(fridge_items) == 0:
        await update.message.reply_text(
            "📭 *Холодильник пуст!*\n\n"
            "Добавьте продукты:\n"
            "`/add молоко`\n"
            "`/add хлеб 2`\n"
            "`/add яйца 10`",
            parse_mode='Markdown'
        )
        return
    
    # Группируем по категориям
    categories = {}
    for item in fridge_items:
        product = item.get('products', {})
        category = product.get('category', 'Другое')
        name = product.get('name', 'Неизвестно')
        quantity = item.get('quantity', 1)
        unit = product.get('unit', 'шт')
        
        if category not in categories:
            categories[category] = []
        
        categories[category].append(f"• {name} - {quantity} {unit}")
    
    message = "📦 *В холодильнике:*\n\n"
    for category, items in categories.items():
        message += f"*{category}:*\n"
        message += "\n".join(items) + "\n\n"
    
    message += f"Всего: {len(fridge_items)} позиций\n"
    message += "Добавить: `/add продукт [количество]`"
    
    await update.message.reply_text(message, parse_mode='Markdown')

async def add_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Добавить продукт"""
    family_id = context.user_data.get('family_id')
    
    if not family_id:
        await update.message.reply_text(
            "Сначала присоединитесь:\n"
            "`/code TEST789`",
            parse_mode='Markdown'
        )
        return
    
    if not context.args:
        await update.message.reply_text(
            "Использование:\n"
            "`/add молоко` - 1 шт\n"
            "`/add молоко 2` - 2 шт\n"
            "`/add молоко л` - 1 литр",
            parse_mode='Markdown'
        )
        return
    
    # Парсим аргументы
    args = " ".join(context.args).split()
    product_name = args[0]
    quantity = 1
    unit = "шт"
    
    if len(args) > 1:
        try:
            quantity = int(args[1])
            if len(args) > 2:
                unit = args[2]
        except ValueError:
            unit = args[1]
    
    print(f"🔄 Добавляем: {product_name}, {quantity}, {unit}")
    
    # 1. Ищем или создаём продукт
    products = supabase_request(f"products?name=ilike.{product_name}")
    
    if products and len(products) > 0:
        product_id = products[0]['id']
    else:
        # Создаём новый
        new_product = {
            "name": product_name,
            "category": "Другое",
            "unit": unit
        }
        result = supabase_request("products", "POST", new_product)
        if result and len(result) > 0:
            product_id = result[0]['id']
        else:
            await update.message.reply_text("❌ Ошибка при создании продукта")
            return
    
    # 2. Добавляем в холодильник
    fridge_item = {
        "product_id": product_id,
        "family_id": family_id,
        "quantity": quantity,
        "added_by": str(update.effective_user.id)
    }
    
    result = supabase_request("fridge_items", "POST", fridge_item)
    
    if result:
        await update.message.reply_text(
            f"✅ Добавлено:\n"
            f"*{product_name}* - {quantity} {unit}\n\n"
            f"Посмотреть: `/list`",
            parse_mode='Markdown'
        )
    else:
        await update.message.reply_text("❌ Ошибка при добавлении")

async def shopping_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Список покупок"""
    family_id = context.user_data.get('family_id')
    
    if not family_id:
        await update.message.reply_text(
            "Сначала присоединитесь:\n"
            "`/code TEST789`",
            parse_mode='Markdown'
        )
        return
    
    # Получаем список покупок
    shopping_items = supabase_request(
        f"shopping_list?family_id=eq.{family_id}"
        "&purchased=eq.false"
        "&select=id,quantity,priority,products(name,unit)"
        "&order=priority.asc,created_at.desc"
        "&limit=20"
    )
    
    if not shopping_items or len(shopping_items) == 0:
        await update.message.reply_text(
            "✅ *Список покупок пуст!*\n\n"
            "Добавить из холодильника можно в веб-приложении:\n"
            "👉 https://shoppinglist-navy.vercel.app",
            parse_mode='Markdown'
        )
        return
    
    message = "🛒 *Список покупок:*\n\n"
    
    for i, item in enumerate(shopping_items, 1):
        product = item.get('products', {})
        name = product.get('name', 'Неизвестно')
        quantity = item.get('quantity', 1)
        unit = product.get('unit', 'шт')
        priority = item.get('priority', 2)
        
        priority_icon = "🔴" if priority == 1 else "🟡" if priority == 2 else "🔵"
        priority_text = "Срочно" if priority == 1 else "Обычно" if priority == 2 else "Когда будет"
        
        message += f"{i}. {priority_icon} *{name}* - {quantity} {unit}\n"
        message += f"   ({priority_text})\n\n"
    
    message += f"Всего: {len(shopping_items)} позиций\n"
    message += "Отметить купленным можно в веб-приложении."
    
    await update.message.reply_text(message, parse_mode='Markdown')

async def recipes_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Рецепты"""
    family_id = context.user_data.get('family_id')
    
    if not family_id:
        await update.message.reply_text(
            "Сначала присоединитесь:\n"
            "`/code TEST789`",
            parse_mode='Markdown'
        )
        return
    
    # Получаем продукты
    fridge_items = supabase_request(
        f"fridge_items?family_id=eq.{family_id}"
        "&select=products(name)"
        "&limit=10"
    )
    
    if not fridge_items or len(fridge_items) < 2:
        await update.message.reply_text(
            "🍳 *Нужно минимум 2 продукта в холодильнике.*\n\n"
            "Добавьте:\n"
            "`/add молоко`\n"
            "`/add яйца 10`\n"
            "`/add хлеб 2`",
            parse_mode='Markdown'
        )
        return
    
    # Получаем рецепты
    all_recipes = supabase_request("recipes?limit=5")
    
    if not all_recipes:
        await update.message.reply_text(
            "🍳 *Рецепты скоро появятся!*\n\n"
            "А пока посмотрите холодильник: `/list`",
            parse_mode='Markdown'
        )
        return
    
    # Формируем ответ
    message = "🍳 *Доступные рецепты:*\n\n"
    
    for recipe in all_recipes[:3]:
        message += f"*{recipe.get('title', 'Рецепт')}*\n"
        message += f"⏱ {recipe.get('prep_time', 0) + recipe.get('cook_time', 0)} мин | "
        message += f"🏷 {recipe.get('difficulty', 'средне')}\n"
        message += f"_{recipe.get('description', '')}_\n\n"
    
    message += "Больше рецептов скоро!"
    
    await update.message.reply_text(message, parse_mode='Markdown')

async def family_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Информация о семье"""
    family_id = context.user_data.get('family_id')
    
    if not family_id:
        await update.message.reply_text(
            "Сначала присоединитесь:\n"
            "`/code TEST789`",
            parse_mode='Markdown'
        )
        return
    
    # Получаем информацию
    families = supabase_request(f"families?id=eq.{family_id}")
    
    if not families or len(families) == 0:
        await update.message.reply_text("❌ Семья не найдена")
        return
    
    family = families[0]
    
    # Статистика
    users = supabase_request(f"users?family_id=eq.{family_id}&select=count")
    fridge = supabase_request(f"fridge_items?family_id=eq.{family_id}&select=count")
    shopping = supabase_request(f"shopping_list?family_id=eq.{family_id}&purchased=eq.false&select=count")
    
    members = users[0]['count'] if users and len(users) > 0 else 0
    fridge_count = fridge[0]['count'] if fridge and len(fridge) > 0 else 0
    shopping_count = shopping[0]['count'] if shopping and len(shopping) > 0 else 0
    
    message = f"👨‍👩‍👧‍👦 *Семья: {family.get('name', 'Без названия')}*\n\n"
    message += f"🔑 Код: `{family.get('invite_code', 'Нет')}`\n"
    message += f"👥 Участников: {members}\n"
    message += f"📦 В холодильнике: {fridge_count} позиций\n"
    message += f"🛒 В покупках: {shopping_count} позиций\n\n"
    message += "*Команды:*\n"
    message += "• `/list` - холодильник\n"
    message += "• `/add` - добавить продукт\n"
    message += "• `/shopping` - покупки\n"
    message += "• `/recipes` - рецепты"
    
    await update.message.reply_text(message, parse_mode='Markdown')

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Помощь"""
    message = (
        "📚 *Помощь по командам:*\n\n"
        
        "*Основные:*\n"
        "• `/start` - начать\n"
        "• `/code КОД` - присоединиться\n"
        "• `/help` - эта справка\n\n"
        
        "*Холодильник:*\n"
        "• `/list` - что есть\n"
        "• `/add продукт` - добавить\n\n"
        
        "*Покупки и рецепты:*\n"
        "• `/shopping` - список покупок\n"
        "• `/recipes` - рецепты\n"
        "• `/family` - информация о семье\n\n"
        
        "*Тестовые коды:*\n"
        "• TEST789\n"
        "• IVANOV123\n"
        "• PETROV456\n\n"
        
        "*Веб-приложение:*\n"
        "👉 https://shoppinglist-navy.vercel.app"
    )
    
    await update.message.reply_text(message, parse_mode='Markdown')

async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик кнопок"""
    query = update.callback_query
    await query.answer()
    
    if query.data == 'join':
        await query.edit_message_text(
            "Введите код семьи:\n"
            "`/code TEST789`\n\n"
            "Или другие тестовые коды:\n"
            "• IVANOV123\n"
            "• PETROV456",
            parse_mode='Markdown'
        )
    elif query.data == 'create':
        await query.edit_message_text(
            "Создать семью можно в веб-приложении:\n"
            "👉 https://shoppinglist-navy.vercel.app\n\n"
            "После создания получите код и используйте:\n"
            "`/code ВАШ_КОД`",
            parse_mode='Markdown'
        )

# === ЗАПУСК ===
def main():
    """Основная функция"""
    print("=" * 50)
    print("🚀 ЗАПУСК FAMILY CHEF BOT")
    print("=" * 50)
    
    try:
        # Создаём приложение
        application = Application.builder().token(TELEGRAM_TOKEN).build()
        
        # Регистрируем команды
        application.add_handler(CommandHandler("start", start))
        application.add_handler(CommandHandler("code", code_command))
        application.add_handler(CommandHandler("list", list_command))
        application.add_handler(CommandHandler("add", add_command))
        application.add_handler(CommandHandler("shopping", shopping_command))
        application.add_handler(CommandHandler("recipes", recipes_command))
        application.add_handler(CommandHandler("family", family_command))
        application.add_handler(CommandHandler("help", help_command))
        
        # Обработчик кнопок
        application.add_handler(CallbackQueryHandler(button_handler))
        
        print("✅ Бот готов к работе!")
        print("📱 Команды:")
        print("   /start - начать")
        print("   /code КОД - присоединиться")
        print("   /list - холодильник")
        print("   /add - добавить продукт")
        print("   /shopping - покупки")
        print("   /recipes - рецепты")
        print("   /family - информация")
        print("   /help - справка")
        print("=" * 50)
        print("🤖 Ожидаю сообщений...")
        print("=" * 50)
        
        # Запускаем
        application.run_polling(allowed_updates=Update.ALL_TYPES)
        
    except Exception as e:
        print(f"❌ Критическая ошибка: {e}")
        print("Попробуйте:")
        print("1. pip install python-telegram-bot==20.7")
        print("2. Или используйте Dockerfile с Python 3.11")

if __name__ == '__main__':
    main()
