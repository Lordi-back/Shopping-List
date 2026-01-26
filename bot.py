import os
import sys
import logging
import requests
from datetime import datetime

# ФИКС ДЛЯ PYTHON 3.13+ (если библиотека требует imghdr)
if sys.version_info >= (3, 13):
    # Эмуляция отсутствующего модуля imghdr
    class FakeImghdr:
        def what(self, *args, **kwargs):
            return None
    sys.modules['imghdr'] = FakeImghdr()
    import warnings
    warnings.filterwarnings("ignore", message="'imghdr' module is deprecated")

# ТЕПЕРЬ ИМПОРТИРУЕМ telegram ПОСЛЕ ФИКСА
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes

# === НАСТРОЙКИ ===
# Лучше использовать переменные окружения для Railway!
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "8231208800:AAEihy4T4-ZcWh9bLxml49bgjRC2i4VT944")
SUPABASE_URL = "https://rkbrxjbtilumisyeenlu.supabase.co"
SUPABASE_KEY = "sb_publishable_Oipp5tzp4yb3z8UwrJjm6w_7HGvQq9Z"

# Проверка токена (важно для Railway)
if not TELEGRAM_TOKEN or TELEGRAM_TOKEN == "ВАШ_ТОКЕН_ЗДЕСЬ":
    print("❌ ОШИБКА: TELEGRAM_BOT_TOKEN не установлен или указан placeholder!")
    print("Добавьте в Railway Variables: TELEGRAM_BOT_TOKEN=ваш_настоящий_токен")
    # В Railway можно выйти с ошибкой, чтобы увидеть проблему в логах
    sys.exit(1)

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# === УЛУЧШЕННОЕ ПОДКЛЮЧЕНИЕ К SUPABASE ===
def supabase_request(endpoint, method="GET", data=None, params=None):
    """Универсальный запрос к Supabase с обработкой ошибок"""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"  # Для POST возвращает созданные данные
    }
    
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, params=params)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data)
        elif method == "PATCH":
            response = requests.patch(url, headers=headers, json=data)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers)
        else:
            return {"error": f"Unknown method: {method}"}
        
        # Логируем для отладки
        if response.status_code >= 400:
            logger.error(f"Supabase Error {response.status_code}: {response.text}")
        
        if 200 <= response.status_code < 300:
            return response.json() if response.content else True
        return None
        
    except Exception as e:
        logger.error(f"Request error to {url}: {e}")
        return None

def get_user_family(context):
    """Безопасное получение ID семьи пользователя"""
    return context.user_data.get('family_id')

# === ОСНОВНЫЕ КОМАНДЫ БОТА (ИСПРАВЛЕННЫЕ) ===
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
        "• 🍳 Найти рецепты из того что есть\n\n"
        "*Для начала:*\n"
        "1. Создайте семью в приложении\n"
        "2. Получите код семьи\n"
        "3. Введите его здесь командой:\n"
        "   `/code ВАШ_КОД`\n\n"
        "*Веб-приложение:*\n"
        "👉 https://shoppinglist-navy.vercel.app",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )

async def code_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /code для привязки к семье - ИСПРАВЛЕННАЯ"""
    if not context.args:
        await update.message.reply_text(
            "Введите код семьи:\n"
            "Пример: `/code FAMILY123`\n\n"
            "Коды тестовых семей: `TEST789`, `IVANOV123`, `PETROV456`",
            parse_mode='Markdown'
        )
        return
    
    family_code = context.args[0].upper().strip()
    user = update.effective_user
    
    logger.info(f"User {user.id} trying to join with code: {family_code}")
    
    # Ищем семью в базе по коду
    families = supabase_request(f"families?invite_code=eq.{family_code}")
    
    if not families or len(families) == 0:
        await update.message.reply_text(
            "❌ Неверный код семьи.\n"
            "Проверьте код или создайте новую семью в приложении.\n\n"
            "*Тестовые коды:* `TEST789`, `IVANOV123`",
            parse_mode='Markdown'
        )
        return
    
    family = families[0]
    family_id = family['id']
    family_name = family.get('name', 'Семья')
    
    # Сохраняем в контексте пользователя
    context.user_data['family_code'] = family_code
    context.user_data['family_id'] = family_id
    context.user_data['family_name'] = family_name
    
    # Пытаемся сохранить/обновить пользователя в таблице users
    user_data = {
        "telegram_id": str(user.id),
        "family_id": family_id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name
    }
    
    # Проверяем, есть ли уже такой пользователь
    existing = supabase_request(f"users?telegram_id=eq.{user.id}&family_id=eq.{family_id}")
    
    if not existing or len(existing) == 0:
        # Создаём нового пользователя
        supabase_request("users", "POST", user_data)
    else:
        # Обновляем существующего
        supabase_request(f"users?telegram_id=eq.{user.id}&family_id=eq.{family_id}", "PATCH", user_data)
    
    await update.message.reply_text(
        f"✅ Вы присоединились к семье *{family_name}*!\n"
        f"Код: `{family_code}`\n\n"
        "*Теперь доступны команды:*\n"
        "• `/list` - что в холодильнике\n"
        "• `/add молоко` - добавить продукт\n"
        "• `/shopping` - список покупок\n"
        "• `/recipes` - найти рецепты\n"
        "• `/family` - информация о семье",
        parse_mode='Markdown'
    )

async def list_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /list - показать что в холодильнике - ИСПРАВЛЕННАЯ"""
    family_id = get_user_family(context)
    
    if not family_id:
        await update.message.reply_text(
            "Сначала присоединитесь к семье командой `/code ВАШ_КОД`\n"
            "Пример: `/code TEST789`",
            parse_mode='Markdown'
        )
        return
    
    logger.info(f"User {update.effective_user.id} viewing fridge for family {family_id}")
    
    # Получаем продукты из холодильника семьи с JOIN к таблице products
    fridge_items = supabase_request(
        f"fridge_items?family_id=eq.{family_id}"
        "&select=id,quantity,created_at,products(id,name,category,unit)"
        "&order=created_at.desc"
    )
    
    if not fridge_items or len(fridge_items) == 0:
        await update.message.reply_text(
            "📭 Холодильник пуст!\n\n"
            "Добавьте продукты командой:\n"
            "`/add молоко 1`\n"
            "`/add хлеб 2`",
            parse_mode='Markdown'
        )
        return
    
    message = "📦 *В холодильнике:*\n\n"
    
    # Группируем по категориям для удобства
    categories = {}
    for item in fridge_items[:15]:  # Ограничим 15 продуктами
        product = item.get('products', {})
        category = product.get('category', 'Другое')
        name = product.get('name', 'Неизвестно')
        quantity = item.get('quantity', 1)
        unit = product.get('unit', 'шт')
        
        if category not in categories:
            categories[category] = []
        
        categories[category].append(f"• {name} - {quantity} {unit}")
    
    for category, items in categories.items():
        message += f"*{category}:*\n"
        message += "\n".join(items) + "\n\n"
    
    message += f"Всего: {len(fridge_items)} позиций\n"
    message += "`/add продукт [кол-во]` - добавить еще"
    
    await update.message.reply_text(message, parse_mode='Markdown')

async def add_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /add - добавить продукт в холодильник - ИСПРАВЛЕННАЯ"""
    family_id = get_user_family(context)
    
    if not family_id:
        await update.message.reply_text(
            "Сначала присоединитесь к семье командой `/code ВАШ_КОД`",
            parse_mode='Markdown'
        )
        return
    
    if not context.args:
        await update.message.reply_text(
            "Использование:\n"
            "`/add молоко` - добавить 1 шт\n"
            "`/add молоко 2` - добавить 2 шт\n"
            "`/add молоко л` - добавить 1 литр\n"
            "`/add молоко 2 л` - добавить 2 литра",
            parse_mode='Markdown'
        )
        return
    
    # Парсим аргументы
    args = " ".join(context.args).split()
    product_name = args[0]
    quantity = 1
    unit = "шт"
    
    if len(args) > 1:
        # Пробуем понять, что такое второй аргумент
        try:
            # Если это число
            quantity = int(args[1])
            if len(args) > 2:
                unit = args[2]  # Третий аргумент - единица измерения
        except ValueError:
            # Если не число, то это единица измерения
            unit = args[1]
    
    logger.info(f"Adding product: {product_name}, quantity: {quantity}, unit: {unit}")
    
    # 1. Ищем продукт в базе (регистронезависимо)
    products = supabase_request(f"products?name=ilike.{product_name}")
    
    if products and len(products) > 0:
        product_id = products[0]['id']
        existing_product = products[0]
    else:
        # 2. Создаём новый продукт
        new_product = {
            "name": product_name,
            "category": "Другое",
            "unit": unit
        }
        
        result = supabase_request("products", "POST", new_product)
        
        if not result or len(result) == 0:
            await update.message.reply_text(
                "❌ Ошибка при создании продукта в базе данных.\n"
                "Проверьте подключение к Supabase."
            )
            return
        
        product_id = result[0]['id']
        existing_product = result[0]
    
    # 3. Добавляем в холодильник
    fridge_item = {
        "product_id": product_id,
        "family_id": family_id,
        "quantity": quantity,
        "added_by": str(update.effective_user.id)
    }
    
    result = supabase_request("fridge_items", "POST", fridge_item)
    
    if result:
        await update.message.reply_text(
            f"✅ Добавлено в холодильник:\n"
            f"*{product_name}* - {quantity} {existing_product.get('unit', unit)}\n\n"
            f"Категория: {existing_product.get('category', 'Другое')}\n"
            f"Посмотреть: `/list`",
            parse_mode='Markdown'
        )
    else:
        await update.message.reply_text(
            "❌ Ошибка при добавлении в холодильник.\n"
            "Возможно, проблема с подключением к базе данных."
        )

async def shopping_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /shopping - список покупок"""
    family_id = get_user_family(context)
    
    if not family_id:
        await update.message.reply_text(
            "Сначала присоединитесь к семье командой `/code ВАШ_КОД`",
            parse_mode='Markdown'
        )
        return
    
    # Получаем список покупок (только некупленное)
    shopping_items = supabase_request(
        f"shopping_list?family_id=eq.{family_id}"
        "&purchased=eq.false"
        "&select=id,quantity,priority,created_at,products(name,unit)"
        "&order=priority.asc,created_at.desc"
    )
    
    if not shopping_items or len(shopping_items) == 0:
        await update.message.reply_text(
            "✅ Список покупок пуст!\n\n"
            "Добавить из холодильника:\n"
            "1. Посмотрите что есть: `/list`\n"
            "2. Добавьте в покупки через веб-приложение\n\n"
            "*Веб-приложение:*\n"
            "👉 https://shoppinglist-navy.vercel.app",
            parse_mode='Markdown'
        )
        return
    
    message = "🛒 *Список покупок:*\n\n"
    
    for i, item in enumerate(shopping_items[:20], 1):
        product = item.get('products', {})
        name = product.get('name', 'Неизвестно')
        quantity = item.get('quantity', 1)
        unit = product.get('unit', 'шт')
        priority = item.get('priority', 2)
        
        # Иконки приоритета
        priority_icon = "🔴" if priority == 1 else "🟡" if priority == 2 else "🔵"
        priority_text = "Срочно" if priority == 1 else "Обычно" if priority == 2 else "Когда будет"
        
        message += f"{i}. {priority_icon} *{name}* - {quantity} {unit}\n"
        message += f"   ({priority_text})\n\n"
    
    message += f"Всего: {len(shopping_items)} позиций\n"
    message += "Отметить купленным можно в веб-приложении."
    
    await update.message.reply_text(message, parse_mode='Markdown')

async def recipes_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /recipes - найти рецепты по продуктам"""
    family_id = get_user_family(context)
    
    if not family_id:
        await update.message.reply_text(
            "Сначала присоединитесь к семье командой `/code ВАШ_КОД`",
            parse_mode='Markdown'
        )
        return
    
    # Получаем продукты из холодильника
    fridge_items = supabase_request(
        f"fridge_items?family_id=eq.{family_id}"
        "&select=products(name)"
        "&limit=10"
    )
    
    if not fridge_items or len(fridge_items) < 2:
        await update.message.reply_text(
            "🍳 *Для подбора рецептов нужно минимум 2 продукта в холодильнике.*\n\n"
            "Добавьте продукты командой:\n"
            "`/add молоко`\n"
            "`/add яйца 10`\n"
            "`/add хлеб 2`\n\n"
            "Затем попробуйте снова: `/recipes`",
            parse_mode='Markdown'
        )
        return
    
    # Получаем названия продуктов
    products = []
    for item in fridge_items:
        if 'products' in item and item['products']:
            products.append(item['products']['name'].lower())
    
    # Получаем рецепты из базы
    all_recipes = supabase_request("recipes?limit=10")
    
    if not all_recipes:
        await update.message.reply_text(
            "🍳 *База рецептов пока пуста.*\n\n"
            "Скоро мы добавим рецепты!\n"
            "А пока можете посмотреть что есть в холодильнике: `/list`",
            parse_mode='Markdown'
        )
        return
    
    # Ищем рецепты, для которых есть ингредиенты
    matching_recipes = []
    
    for recipe in all_recipes:
        ingredients = recipe.get('ingredients', {})
        recipe_ingredients = [ing.lower() for ing in ingredients.keys()]
        
        # Считаем совпадения
        common = len(set(products) & set(recipe_ingredients))
        if common >= 1:  # Хотя бы 1 совпадающий ингредиент
            matching_recipes.append({
                'recipe': recipe,
                'score': common,
                'total_ingredients': len(recipe_ingredients)
            })
    
    # Сортируем по проценту совпадений
    matching_recipes.sort(key=lambda x: x['score'] / x['total_ingredients'], reverse=True)
    
    if not matching_recipes:
        await update.message.reply_text(
            "😔 *Не нашлось рецептов для ваших продуктов.*\n\n"
            f"Ваши продукты: {', '.join(products[:5])}\n\n"
            "Добавьте больше продуктов в холодильник!",
            parse_mode='Markdown'
        )
        return
    
    message = f"🍳 *Нашёл рецепты для ваших продуктов:*\n\n"
    message += f"Ваши продукты: {', '.join(products[:5])}\n\n"
    message += "*Подходящие рецепты:*\n\n"
    
    for match in matching_recipes[:3]:  # Показываем топ-3
        recipe = match['recipe']
        score = match['score']
        total = match['total_ingredients']
        
        message += f"*{recipe['title']}*\n"
        message += f"⏱ {recipe.get('prep_time', 0) + recipe.get('cook_time', 0)} мин | "
        message += f"📊 {score}/{total} ингредиентов | "
        message += f"🏷 {recipe.get('difficulty', 'средне')}\n"
        message += f"_{recipe.get('description', '')}_\n\n"
    
    message += "Больше рецептов скоро!\n"
    message += "Добавить продукты: `/add продукт`"
    
    await update.message.reply_text(message, parse_mode='Markdown')

async def family_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /family - информация о семье"""
    family_id = get_user_family(context)
    
    if not family_id:
        await update.message.reply_text(
            "Сначала присоединитесь к семье командой `/code ВАШ_КОД`",
            parse_mode='Markdown'
        )
        return
    
    # Получаем информацию о семье
    families = supabase_request(f"families?id=eq.{family_id}")
    
    if not families or len(families) == 0:
        await update.message.reply_text("❌ Информация о семье не найдена.")
        return
    
    family = families[0]
    
    # Получаем количество участников
    users = supabase_request(f"users?family_id=eq.{family_id}&select=count")
    members_count = users[0]['count'] if users and len(users) > 0 else 0
    
    # Получаем статистику по холодильнику
    fridge_stats = supabase_request(f"fridge_items?family_id=eq.{family_id}&select=count")
    fridge_count = fridge_stats[0]['count'] if fridge_stats and len(fridge_stats) > 0 else 0
    
    # Получаем статистику по покупкам
    shopping_stats = supabase_request(
        f"shopping_list?family_id=eq.{family_id}"
        "&purchased=eq.false&select=count"
    )
    shopping_count = shopping_stats[0]['count'] if shopping_stats and len(shopping_stats) > 0 else 0
    
    message = f"👨‍👩‍👧‍👦 *Семья: {family.get('name', 'Без названия')}*\n\n"
    message += f"🔑 Код семьи: `{family.get('invite_code', 'Нет кода')}`\n"
    message += f"👥 Участников: {members_count}\n"
    message += f"📦 В холодильнике: {fridge_count} позиций\n"
    message += f"🛒 В списке покупок: {shopping_count} позиций\n\n"
    
    # Настройки семьи
    settings = family.get('settings', {})
    if settings:
        message += "*Настройки:*\n"
        if 'currency' in settings:
            message += f"• Валюта: {settings['currency']}\n"
        if 'theme' in settings:
            message += f"• Тема: {settings['theme']}\n"
    
    message += "\n*Команды:*\n"
    message += "• `/list` - холодильник\n"
    message += "• `/shopping` - список покупок\n"
    message += "• `/recipes` - рецепты\n"
    message += "• `/add продукт` - добавить продукт\n\n"
    message += "*Веб-приложение:*\n"
    message += "👉 https://shoppinglist-navy.vercel.app"
    
    await update.message.reply_text(message, parse_mode='Markdown')

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /help - помощь"""
    message = (
        "📚 *Помощь по командам:*\n\n"
        
        "*Основные:*\n"
        "• `/start` - начать работу с ботом\n"
        "• `/code КОД` - присоединиться к семье\n"
        "• `/family` - информация о вашей семье\n"
        "• `/help` - эта справка\n\n"
        
        "*Холодильник:*\n"
        "• `/list` - что есть в холодильнике\n"
        "• `/add молоко` - добавить продукт (1 шт)\n"
        "• `/add молоко 2` - добавить 2 шт\n"
        "• `/add молоко л` - добавить 1 литр\n\n"
        
        "*Покупки и рецепты:*\n"
        "• `/shopping` - список покупок\n"
        "• `/recipes` - рецепты из ваших продуктов\n\n"
        
        "*Тестовые данные:*\n"
        "• Код семьи: `TEST789`\n"
        "• Код семьи: `IVANOV123`\n"
        "• Код семьи: `PETROV456`\n\n"
        
        "*Веб-приложение:*\n"
        "👉 https://shoppinglist-navy.vercel.app\n\n"
        
        "*Для разработки:*\n"
        "Бот работает с полной базой данных Supabase,\n"
        "включая таблицы: families, users, products,\n"
        "fridge_items, shopping_list, recipes."
    )
    
    await update.message.reply_text(message, parse_mode='Markdown')

# === ОБРАБОТЧИКИ КНОПОК ===
async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    if query.data == 'join_family':
        await query.edit_message_text(
            "Введите код семьи командой:\n"
            "`/code ВАШ_КОД`\n\n"
            "*Тестовые коды:*\n"
            "• `TEST789` - тестовая семья\n"
            "• `IVANOV123` - семья Ивановых\n"
            "• `PETROV456` - семья Петровых\n\n"
            "Код можно получить в веб-приложении.",
            parse_mode='Markdown'
        )
    
    elif query.data == 'create_family':
        await query.edit_message_text(
            "Создать семью можно в веб-приложении:\n"
            "👉 https://shoppinglist-navy.vercel.app\n\n"
            "После создания:\n"
            "1. Получите код семьи\n"
            "2. Введите его здесь: `/code ВАШ_КОД`\n"
            "3. Пригласите семью по этому коду\n\n"
            "*Или используйте тестовые коды выше.*",
            parse_mode='Markdown'
        )

# === ЗАПУСК БОТА ===
def main():
    """Основная функция запуска бота"""
    print("=" * 50)
    print("🚀 ЗАПУСК FAMILY CHEF BOT")
    print("=" * 50)
    print(f"✅ Токен: {TELEGRAM_TOKEN[:10]}...")
    print(f"✅ Supabase URL: {SUPABASE_URL}")
    print(f"✅ Python: {sys.version}")
    print("=" * 50)
    
    # Проверяем подключение к Supabase
    print("🔍 Проверяем подключение к Supabase...")
    test_connection = supabase_request("families?limit=1")
    
    if test_connection is None:
        print("❌ Нет подключения к Supabase!")
        print("Проверьте URL и ключ в настройках.")
        return
    
    print(f"✅ Подключено! Найдено семей: {len(test_connection) if test_connection else 0}")
    print("=" * 50)
    
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
    
    # Обработчики кнопок
    application.add_handler(CallbackQueryHandler(button_handler))
    
    print("✅ Бот готов к работе!")
    print("📱 Доступные команды:")
    print("   /start - начать работу")
    print("   /code КОД - присоединиться к семье")
    print("   /list - холодильник")
    print("   /add - добавить продукт")
    print("   /shopping - список покупок")
    print("   /recipes - рецепты")
    print("   /family - информация о семье")
    print("   /help - справка")
    print("=" * 50)
    print("🤖 Ожидаю сообщений в Telegram...")
    print("=" * 50)
    
    # Запускаем бота
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()
