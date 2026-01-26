import os
import sys
import logging
import requests
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes

# === НАСТРОЙКИ ===
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "8231208800:AAEihy4T4-ZcWh9bLxml49bgjRC2i4VT944")
SUPABASE_URL = "https://rkbrxjbtilumisyeenlu.supabase.co"
SUPABASE_KEY = "sb_publishable_Oipp5tzp4yb3z8UwrJjm6w_7HGvQq9Z"

print(f"🚀 Запуск бота...")
print(f"✅ Токен: {TELEGRAM_TOKEN[:10]}...")
print(f"✅ Python: {sys.version}")

# Логирование
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# === ФУНКЦИИ ДЛЯ SUPABASE ===
def supabase_request(endpoint, method="GET", data=None):
    """Простой запрос к Supabase"""
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
        elif method == "PATCH":
            response = requests.patch(url, headers=headers, json=data)
        
        if response.status_code < 300:
            return response.json() if response.content else True
        else:
            print(f"❌ Supabase error {response.status_code}: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Request error: {e}")
        return None

# === КОМАНДЫ БОТА ===
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /start"""
    keyboard = [
        [InlineKeyboardButton("🔗 Присоединиться к семье", callback_data='join')],
        [InlineKeyboardButton("👨‍👩‍👧‍👦 Создать семью", callback_data='create')],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "👋 *Привет! Я бот для семейного списка покупок.*\n\n"
        "*Быстрый старт:*\n"
        "1. Присоединитесь к тестовой семье:\n"
        "   `/code TEST789`\n\n"
        "2. Посмотрите холодильник:\n"
        "   `/list`\n\n"
        "3. Добавьте продукты:\n"
        "   `/add молоко`\n\n"
        "*Тестовые коды:*\n"
        "• TEST789\n"
        "• IVANOV123\n"
        "• PETROV456",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )

async def code_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /code - привязка к веб-аккаунту"""
    if not context.args:
        await update.message.reply_text(
            "Введите ваш постоянный код из веб-приложения:\n"
            "`/code ABCDEF12`\n\n"
            "*Как получить код:*\n"
            "1. Откройте веб-приложение\n"
            "2. Нажмите 'Получить код для Telegram'\n"
            "3. Скопируйте 8-значный код\n"
            "4. Отправьте его сюда",
            parse_mode='Markdown'
        )
        return
    
    code = context.args[0].upper().strip()
    chat_id = update.effective_chat.id
    username = update.effective_user.username or update.effective_user.first_name
    
    print(f"🔄 Привязка по постоянному коду: {code}")
    
    # Отправляем запрос к вашему API
    api_url = "https://shoppinglist-navy.vercel.app/api/user/link"
    payload = {
        "code": code,
        "telegramChatId": chat_id,
        "telegramUsername": username
    }
    
    try:
        response = requests.post(api_url, json=payload)
        
        if response.status_code == 200:
            data = response.json()
            
            # Сохраняем в user_data
            context.user_data['user_id'] = data.get('userId')
            context.user_data['permanent_code'] = code
            context.user_data['synced'] = True
            
            await update.message.reply_text(
                f"✅ *Привязка успешна!*\n\n"
                f"Ваш постоянный код: `{code}`\n"
                f"Telegram: @{username}\n\n"
                "*Теперь доступно:*\n"
                "• Уведомления о новых продуктах\n"
                "• Управление списками из Telegram\n"
                "• Синхронизация с веб-приложением\n\n"
                "*Команды:*\n"
                "`/list` - холодильник\n"
                "`/shopping` - покупки\n"
                "`/add молоко` - добавить\n"
                "`/help` - справка",
                parse_mode='Markdown'
            )
            
            # Сохраняем в базу families для совместимости
            supabase_request("families", "POST", {
                "invite_code": code,
                "name": f"Telegram: @{username}",
                "created_at": datetime.now().isoformat()
            })
            
        else:
            error_msg = response.json().get('error', 'Неизвестная ошибка')
            await update.message.reply_text(
                f"❌ *Ошибка:* {error_msg}\n\n"
                f"Проверьте:\n"
                f"1. Правильность кода `{code}`\n"
                f"2. Что код скопирован полностью\n"
                f"3. Что веб-приложение открыто",
                parse_mode='Markdown'
            )
    except Exception as e:
        await update.message.reply_text(
            f"❌ Ошибка соединения: {str(e)[:100]}",
            parse_mode='Markdown'
        )

async def list_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /list - показать холодильник"""
    if 'family_id' not in context.user_data:
        await update.message.reply_text(
            "Сначала присоединитесь к семье:\n"
            "`/code TEST789`",
            parse_mode='Markdown'
        )
        return
    
    family_id = context.user_data['family_id']
    
    # Получаем продукты
    fridge_items = supabase_request(
        f"fridge_items?family_id=eq.{family_id}"
        "&select=quantity,products(name,unit)"
        "&limit=10"
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
    
    message = "📦 *В холодильнике:*\n\n"
    for item in fridge_items:
        name = item.get('products', {}).get('name', 'Неизвестно')
        quantity = item.get('quantity', 1)
        unit = item.get('products', {}).get('unit', 'шт')
        message += f"• {name} - {quantity} {unit}\n"
    
    message += f"\nВсего: {len(fridge_items)} позиций"
    
    await update.message.reply_text(message, parse_mode='Markdown')

async def add_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /add - добавить продукт"""
    if 'family_id' not in context.user_data:
        await update.message.reply_text(
            "Сначала присоединитесь к семье:\n"
            "`/code TEST789`",
            parse_mode='Markdown'
        )
        return
    
    if not context.args:
        await update.message.reply_text(
            "Использование:\n"
            "`/add молоко` - добавить 1 шт\n"
            "`/add молоко 2` - добавить 2 шт",
            parse_mode='Markdown'
        )
        return
    
    # Простая логика добавления
    product_name = " ".join(context.args)
    family_id = context.user_data['family_id']
    
    print(f"🔄 Добавление продукта: {product_name} для семьи {family_id}")
    
    # 1. Ищем или создаём продукт
    products = supabase_request(f"products?name=ilike.{product_name}")
    
    if products and len(products) > 0:
        product_id = products[0]['id']
    else:
        # Создаём новый продукт
        new_product = {
            "name": product_name,
            "category": "Другое",
            "unit": "шт"
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
        "quantity": 1,
        "added_by": str(update.effective_user.id)
    }
    
    result = supabase_request("fridge_items", "POST", fridge_item)
    
    if result:
        await update.message.reply_text(
            f"✅ Добавлено: *{product_name}*\n\n"
            f"Посмотреть холодильник: `/list`",
            parse_mode='Markdown'
        )
    else:
        await update.message.reply_text("❌ Ошибка при добавлении")

async def shopping_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /shopping - список покупок"""
    if 'family_id' not in context.user_data:
        await update.message.reply_text(
            "Сначала присоединитесь к семье:\n"
            "`/code TEST789`",
            parse_mode='Markdown'
        )
        return
    
    family_id = context.user_data['family_id']
    
    # Получаем список покупок
    shopping_items = supabase_request(
        f"shopping_list?family_id=eq.{family_id}"
        "&purchased=eq.false"
        "&select=quantity,priority,products(name,unit)"
        "&limit=10"
    )
    
    if not shopping_items or len(shopping_items) == 0:
        await update.message.reply_text(
            "✅ *Список покупок пуст!*\n\n"
            "Добавить можно из холодильника в веб-приложении:\n"
            "👉 https://shoppinglist-navy.vercel.app",
            parse_mode='Markdown'
        )
        return
    
    message = "🛒 *Список покупок:*\n\n"
    
    for i, item in enumerate(shopping_items, 1):
        name = item.get('products', {}).get('name', 'Неизвестно')
        quantity = item.get('quantity', 1)
        unit = item.get('products', {}).get('unit', 'шт')
        priority = item.get('priority', 2)
        
        priority_icon = "🔴" if priority == 1 else "🟡" if priority == 2 else "🔵"
        
        message += f"{i}. {priority_icon} {name} - {quantity} {unit}\n"
    
    message += f"\nВсего: {len(shopping_items)} позиций"
    
    await update.message.reply_text(message, parse_mode='Markdown')

async def recipes_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /recipes - рецепты"""
    if 'family_id' not in context.user_data:
        await update.message.reply_text(
            "Сначала присоединитесь к семье:\n"
            "`/code TEST789`",
            parse_mode='Markdown'
        )
        return
    
    # Получаем рецепты из базы
    recipes = supabase_request("recipes?limit=3")
    
    if not recipes or len(recipes) == 0:
        await update.message.reply_text(
            "🍳 *Рецепты скоро появятся!*\n\n"
            "Сначала добавьте продукты в холодильник:\n"
            "`/add молоко`\n"
            "`/add яйца 10`\n"
            "`/add хлеб 2`",
            parse_mode='Markdown'
        )
        return
    
    message = "🍳 *Доступные рецепты:*\n\n"
    
    for recipe in recipes:
        title = recipe.get('title', 'Рецепт')
        prep_time = recipe.get('prep_time', 0)
        cook_time = recipe.get('cook_time', 0)
        difficulty = recipe.get('difficulty', 'средне')
        
        message += f"*{title}*\n"
        message += f"⏱ {prep_time + cook_time} мин | 🏷 {difficulty}\n\n"
    
    message += "Больше рецептов скоро!"
    
    await update.message.reply_text(message, parse_mode='Markdown')

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /help - помощь"""
    message = (
        "📚 *Помощь по командам:*\n\n"
        
        "*Основные:*\n"
        "• `/start` - начать\n"
        "• `/code КОД` - присоединиться к семье\n"
        "• `/help` - эта справка\n\n"
        
        "*Холодильник:*\n"
        "• `/list` - что есть в холодильнике\n"
        "• `/add продукт` - добавить продукт\n\n"
        
        "*Покупки и рецепты:*\n"
        "• `/shopping` - список покупок\n"
        "• `/recipes` - рецепты\n\n"
        
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

# === ЗАПУСК БОТА ===
def main():
    print("=" * 50)
    print("🤖 Family Chef Bot запускается...")
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
        application.add_handler(CommandHandler("help", help_command))
        
        # Обработчик кнопок
        application.add_handler(CallbackQueryHandler(button_handler))
        
        print("✅ Бот готов к работе!")
        print("📱 Доступные команды:")
        print("   /start - начать")
        print("   /code КОД - присоединиться")
        print("   /list - холодильник")
        print("   /add - добавить продукт")
        print("   /shopping - покупки")
        print("   /recipes - рецепты")
        print("   /help - справка")
        print("=" * 50)
        print("🤖 Ожидаю сообщений...")
        print("=" * 50)
        
        # Запускаем бота
        application.run_polling(allowed_updates=Update.ALL_TYPES)
        
    except Exception as e:
        print(f"❌ Ошибка запуска: {e}")
        print("Проверьте:")
        print("1. Правильный токен в Railway Variables")
        print("2. requirements.txt содержит python-telegram-bot==20.7")
        print("3. Python версия 3.11+")

if __name__ == '__main__':
    main()
