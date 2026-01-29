import os
import sys
import logging
import requests
import random
import json
from datetime import datetime
from typing import List, Dict, Any
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

# Глобальные состояния для ИИ-диалога
AI_STATES = {}

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

# === ФУНКЦИИ ДЛЯ РЕЦЕПТОВ ===
def get_ai_recipes(ingredients: List[str], max_time: int = None) -> List[Dict]:
    """Получаем рецепты из базы данных с учётом ингредиентов"""
    try:
        # Формируем запрос
        query = "recipes?"
        
        if max_time:
            query += f"prep_time+cook_time=lte.{max_time}&"
        
        query += "limit=4&order=random"
        
        recipes_data = supabase_request(query)
        
        if not recipes_data:
            return []
        
        # Оцениваем рецепты по совпадению ингредиентов
        scored_recipes = []
        ingredients_set = set(ing.lower() for ing in ingredients)
        
        for recipe in recipes_data:
            score = 0
            recipe_ingredients = recipe.get('ingredients', [])
            
            if isinstance(recipe_ingredients, list):
                # Считаем совпадения
                recipe_ings_set = set(ing.lower() for ing in recipe_ingredients)
                common = ingredients_set & recipe_ings_set
                score = len(common)
                
                # Бонус за меньшее количество недостающих ингредиентов
                missing = recipe_ings_set - ingredients_set
                if len(missing) <= 2:
                    score += 2
            
            if score > 0 or (max_time and max_time <= 30):
                scored_recipes.append((score, recipe))
        
        # Сортируем по релевантности
        scored_recipes.sort(key=lambda x: x[0], reverse=True)
        
        return [recipe for _, recipe in scored_recipes[:4]]
        
    except Exception as e:
        print(f"Ошибка при поиске рецептов: {e}")
        return []

def get_fallback_recipes(ingredients: List[str]) -> List[Dict]:
    """Резервные рецепты, если база пуста"""
    common_recipes = [
        {
            "title": "Омлет с овощами",
            "description": "Быстрый и полезный завтрак",
            "ingredients": ["яйца", "молоко", "помидор", "лук", "соль"],
            "prep_time": 10,
            "cook_time": 15,
            "difficulty": "легко",
            "source_url": "https://www.russianfood.com/recipes/recipe.php?rid=154322"
        },
        {
            "title": "Куриный суп",
            "description": "Ароматный домашний суп",
            "ingredients": ["курица", "картофель", "морковь", "лук", "лапша"],
            "prep_time": 20,
            "cook_time": 40,
            "difficulty": "средне",
            "source_url": "https://www.russianfood.com/recipes/recipe.php?rid=139755"
        },
        {
            "title": "Паста с томатным соусом",
            "description": "Итальянская классика",
            "ingredients": ["паста", "помидор", "чеснок", "базилик", "сыр"],
            "prep_time": 15,
            "cook_time": 20,
            "difficulty": "легко",
            "source_url": "https://www.russianfood.com/recipes/recipe.php?rid=152467"
        },
        {
            "title": "Салат из свежих овощей",
            "description": "Лёгкий витаминный салат",
            "ingredients": ["огурец", "помидор", "лук", "масло", "соль"],
            "prep_time": 15,
            "cook_time": 0,
            "difficulty": "легко",
            "source_url": "https://www.russianfood.com/recipes/recipe.php?rid=148921"
        }
    ]
    
    # Фильтруем по имеющимся ингредиентам
    available_recipes = []
    ingredients_set = set(ing.lower() for ing in ingredients)
    
    for recipe in common_recipes:
        recipe_ings = set(ing.lower() for ing in recipe["ingredients"])
        if len(recipe_ings & ingredients_set) >= 2:
            available_recipes.append(recipe)
    
    return available_recipes[:4]

async def send_recipes(query, recipes: List[Dict], time_text: str = ""):
    """Отправляем рецепты пользователю"""
    message = f"🍽 <b>Нашёл {len(recipes)} рецептов</b>"
    if time_text:
        message += f" ({time_text})"
    message += ":\n\n"
    
    for i, recipe in enumerate(recipes, 1):
        title = recipe.get('title', 'Рецепт')
        description = recipe.get('description', '')
        prep_time = recipe.get('prep_time', 0)
        cook_time = recipe.get('cook_time', 0)
        difficulty = recipe.get('difficulty', 'средне')
        source_url = recipe.get('source_url', '')
        
        total_time = prep_time + cook_time
        difficulty_icon = "🟢" if difficulty == "легко" else "🟡" if difficulty == "средне" else "🔴"
        
        ingredients = recipe.get('ingredients', [])
        if isinstance(ingredients, list):
            main_ingredients = ", ".join(ingredients[:3])
            if len(ingredients) > 3:
                main_ingredients += f" (+{len(ingredients)-3})"
        else:
            main_ingredients = "разные продукты"
        
        message += (
            f"<b>{i}. {title}</b>\n"
            f"   📝 {description}\n"
            f"   {difficulty_icon} {difficulty.capitalize()} | 🕐 {total_time} мин\n"
            f"   🥗 {main_ingredients}\n"
        )
        
        if source_url:
            domain = source_url.split('/')[2].replace('www.', '') if '//' in source_url else source_url[:30]
            message += f"   🔗 <a href='{source_url}'>Рецепт на {domain}</a>\n"
        
        message += "\n"
    
    message += (
        "<i>Нажмите на ссылку для полного рецепта 👆</i>\n\n"
        "🔄 <b>Новый поиск:</b> /recipes\n"
        "⚡ <b>Быстрые рецепты:</b> /quick"
    )
    
    keyboard = [
        [InlineKeyboardButton("🔄 Новый поиск", callback_data='ai_new')],
        [InlineKeyboardButton("⚡ Быстрые рецепты", callback_data='quick_recipes')],
        [InlineKeyboardButton("➕ Добавить продукты", callback_data='add_products')],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text(
        message,
        parse_mode='HTML',
        reply_markup=reply_markup,
        disable_web_page_preview=True
    )

# === КОМАНДЫ БОТА ===
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /start"""
    keyboard = [
        [InlineKeyboardButton("🔗 Присоединиться к семье", callback_data='join')],
        [InlineKeyboardButton("🍳 Искать рецепты", callback_data='recipes')],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "👋 <b>Привет! Я бот для семейного списка покупок.</b>\n\n"
        "<b>Быстрый старт:</b>\n"
        "1. Присоединитесь к тестовой семье:\n"
        "   <code>/code TEST789</code>\n\n"
        "2. Посмотрите холодильник:\n"
        "   <code>/list</code>\n\n"
        "3. Ищите рецепты по продуктам:\n"
        "   <code>/recipes</code>\n\n"
        "<b>Тестовые коды:</b>\n"
        "• TEST789\n"
        "• IVANOV123\n"
        "• PETROV456",
        parse_mode='HTML',
        reply_markup=reply_markup
    )

async def code_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /code - привязка к веб-аккаунту"""
    if not context.args:
        await update.message.reply_text(
            "Введите ваш постоянный код из веб-приложения:\n"
            "<code>/code ABCDEF12</code>\n\n"
            "Как получить код:\n"
            "1. Откройте веб-приложение\n"
            "2. Нажмите 'Получить код для Telegram'\n"
            "3. Скопируйте 8-значный код\n"
            "4. Отправьте его сюда",
            parse_mode='HTML'
        )
        return
    
    code = context.args[0].upper().strip()
    chat_id = update.effective_chat.id
    username = update.effective_user.username or update.effective_user.first_name
    
    print(f"🔄 Привязка по постоянному коду: {code}")
    
    api_url = "https://shoppinglist-navy.vercel.app/api/user/link"
    
    await update.message.reply_text(f"🔄 Привязка аккаунта по коду: {code}...")
    
    payload = {
        "code": code,
        "telegramChatId": chat_id,
        "telegramUsername": username
    }
    
    try:
        response = requests.post(api_url, json=payload, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            context.user_data['user_id'] = data.get('userId')
            context.user_data['permanent_code'] = code
            context.user_data['synced'] = True
            
            success_message = (
                "✅ <b>Привязка успешна!</b>\n\n"
                f"Ваш постоянный код: <code>{code}</code>\n"
                f"Telegram: @{username}\n\n"
                "<b>Теперь доступно:</b>\n"
                "• Уведомления о новых продуктах\n"
                "• Управление списками из Telegram\n"
                "• Синхронизация с веб-приложением\n\n"
                "<b>Команды:</b>\n"
                "<code>/list</code> - холодильник\n"
                "<code>/shopping</code> - покупки\n"
                "<code>/recipes</code> - ИИ-рецепты\n"
                "<code>/add продукт</code> - добавить\n"
                "<code>/help</code> - справка"
            )
            
            await update.message.reply_text(success_message, parse_mode='HTML')
            
            # Сохраняем в базу families для совместимости
            family_data = {
                "invite_code": code,
                "name": f"Telegram: @{username}",
                "created_at": datetime.now().isoformat()
            }
            
            supabase_request("families", "POST", family_data)
            
        else:
            error_msg = response.json().get('error', 'Неизвестная ошибка')
            await update.message.reply_text(
                f"❌ Ошибка: {error_msg}\n\n"
                f"Проверьте:\n"
                f"1. Правильность кода {code}\n"
                f"2. Что код скопирован полностью\n"
                f"3. Что веб-приложение открыто",
                parse_mode='HTML'
            )
            
    except requests.exceptions.Timeout:
        await update.message.reply_text("❌ Таймаут соединения с сервером")
    except requests.exceptions.ConnectionError:
        await update.message.reply_text("❌ Не могу подключиться к серверу")
    except Exception as e:
        await update.message.reply_text(f"❌ Ошибка: {str(e)[:100]}")

async def list_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /list - показать холодильник"""
    if 'family_id' not in context.user_data:
        await update.message.reply_text(
            "Сначала присоединитесь к семье:\n"
            "<code>/code TEST789</code>",
            parse_mode='HTML'
        )
        return
    
    family_id = context.user_data['family_id']
    
    fridge_items = supabase_request(
        f"fridge_items?family_id=eq.{family_id}"
        "&select=quantity,products(name,unit)"
        "&limit=10"
    )
    
    if not fridge_items or len(fridge_items) == 0:
        await update.message.reply_text(
            "📭 <b>Холодильник пуст!</b>\n\n"
            "Добавьте продукты:\n"
            "<code>/add молоко</code>\n"
            "<code>/add хлеб 2</code>\n"
            "<code>/add яйца 10</code>\n\n"
            "А потом ищите рецепты:\n"
            "<code>/recipes</code>",
            parse_mode='HTML'
        )
        return
    
    message = "📦 <b>В холодильнике:</b>\n\n"
    for item in fridge_items:
        name = item.get('products', {}).get('name', 'Неизвестно')
        quantity = item.get('quantity', 1)
        unit = item.get('products', {}).get('unit', 'шт')
        message += f"• {name} - {quantity} {unit}\n"
    
    message += f"\nВсего: {len(fridge_items)} позиций\n\n"
    message += "🍳 <b>Искать рецепты:</b> <code>/recipes</code>"
    
    await update.message.reply_text(message, parse_mode='HTML')

async def add_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /add - добавить продукт"""
    if 'family_id' not in context.user_data:
        await update.message.reply_text(
            "Сначала присоединитесь к семье:\n"
            "<code>/code TEST789</code>",
            parse_mode='HTML'
        )
        return
    
    if not context.args:
        await update.message.reply_text(
            "Использование:\n"
            "<code>/add молоко</code> - добавить 1 шт\n"
            "<code>/add молоко 2</code> - добавить 2 шт",
            parse_mode='HTML'
        )
        return
    
    product_name = " ".join(context.args)
    family_id = context.user_data['family_id']
    
    print(f"🔄 Добавление продукта: {product_name} для семьи {family_id}")
    
    products = supabase_request(f"products?name=ilike.{product_name}")
    
    if products and len(products) > 0:
        product_id = products[0]['id']
    else:
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
    
    fridge_item = {
        "product_id": product_id,
        "family_id": family_id,
        "quantity": 1,
        "added_by": str(update.effective_user.id)
    }
    
    result = supabase_request("fridge_items", "POST", fridge_item)
    
    if result:
        await update.message.reply_text(
            f"✅ Добавлено: <b>{product_name}</b>\n\n"
            f"Посмотреть холодильник: <code>/list</code>\n"
            f"Искать рецепты: <code>/recipes</code>",
            parse_mode='HTML'
        )
    else:
        await update.message.reply_text("❌ Ошибка при добавлении")

async def shopping_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /shopping - список покупок"""
    if 'family_id' not in context.user_data:
        await update.message.reply_text(
            "Сначала присоединитесь к семье:\n"
            "<code>/code TEST789</code>",
            parse_mode='HTML'
        )
        return
    
    family_id = context.user_data['family_id']
    
    shopping_items = supabase_request(
        f"shopping_list?family_id=eq.{family_id}"
        "&purchased=eq.false"
        "&select=quantity,priority,products(name,unit)"
        "&limit=10"
    )
    
    if not shopping_items or len(shopping_items) == 0:
        await update.message.reply_text(
            "✅ <b>Список покупок пуст!</b>\n\n"
            "Добавить можно из холодильника в веб-приложении:\n"
            "👉 https://shoppinglist-navy.vercel.app\n\n"
            "Или посмотреть рецепты:\n"
            "<code>/recipes</code>",
            parse_mode='HTML'
        )
        return
    
    message = "🛒 <b>Список покупок:</b>\n\n"
    
    for i, item in enumerate(shopping_items, 1):
        name = item.get('products', {}).get('name', 'Неизвестно')
        quantity = item.get('quantity', 1)
        unit = item.get('products', {}).get('unit', 'шт')
        priority = item.get('priority', 2)
        
        priority_icon = "🔴" if priority == 1 else "🟡" if priority == 2 else "🔵"
        
        message += f"{i}. {priority_icon} {name} - {quantity} {unit}\n"
    
    message += f"\nВсего: {len(shopping_items)} позиций"
    
    await update.message.reply_text(message, parse_mode='HTML')

async def recipes_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /recipes - ИИ-помощник по рецептам"""
    chat_id = update.effective_chat.id
    
    if 'family_id' not in context.user_data:
        await update.message.reply_text(
            "🍳 <b>ИИ-помощник по рецептам</b>\n\n"
            "Сначала присоединитесь к семье:\n"
            "<code>/code ВАШ_КОД</code>\n\n"
            "<i>После привязки я смогу посмотреть, что у вас в холодильнике!</i>",
            parse_mode='HTML'
        )
        return
    
    AI_STATES[chat_id] = {
        'step': 'ingredients',
        'time_available': None,
        'ingredients': []
    }
    
    family_id = context.user_data['family_id']
    fridge_items = supabase_request(
        f"fridge_items?family_id=eq.{family_id}"
        "&select=quantity,products(name,unit)"
        "&limit=20"
    )
    
    if not fridge_items or len(fridge_items) == 0:
        await update.message.reply_text(
            "🍳 <b>ИИ-помощник по рецептам</b>\n\n"
            "📭 <b>Холодильник пуст!</b>\n\n"
            "Сначала добавьте продукты:\n"
            "<code>/add молоко</code>\n"
            "<code>/add яйца 10</code>\n"
            "<code>/add курица</code>\n\n"
            "Или посмотрите быстрые рецепты:\n"
            "<code>/quick</code>",
            parse_mode='HTML'
        )
        AI_STATES.pop(chat_id, None)
        return
    
    ingredients_list = []
    for item in fridge_items:
        name = item.get('products', {}).get('name', '').lower()
        if name and name not in ingredients_list:
            ingredients_list.append(name)
    
    AI_STATES[chat_id]['ingredients'] = ingredients_list
    
    ingredients_text = "\n".join([f"• {ing}" for ing in ingredients_list[:10]])
    if len(ingredients_list) > 10:
        ingredients_text += f"\n• и ещё {len(ingredients_list) - 10} продуктов"
    
    keyboard = [
        [InlineKeyboardButton("⚡ Быстро (< 30 мин)", callback_data='time_30')],
        [InlineKeyboardButton("🕐 Средне (30-60 мин)", callback_data='time_60')],
        [InlineKeyboardButton("🍳 Долго (> 60 мин)", callback_data='time_90')],
        [InlineKeyboardButton("🎲 Любое время", callback_data='time_any')],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        f"🍳 <b>ИИ-помощник по рецептам</b>\n\n"
        f"<b>В вашем холодильнике найдено:</b>\n{ingredients_text}\n\n"
        f"<b>Сколько времени у вас есть на готовку?</b>",
        parse_mode='HTML',
        reply_markup=reply_markup
    )

async def quick_recipes_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /quick - быстрые рецепты (менее 30 минут)"""
    if 'family_id' not in context.user_data:
        await update.message.reply_text(
            "Сначала присоединитесь к семье:\n"
            "<code>/code ВАШ_КОД</code>",
            parse_mode='HTML'
        )
        return
    
    quick_recipes = supabase_request(
        "recipes?prep_time+cook_time=lte.30&limit=3&order=prep_time.asc"
    )
    
    if not quick_recipes or len(quick_recipes) == 0:
        quick_recipes = [
            {
                "title": "Яичница с тостами",
                "prep_time": 5,
                "cook_time": 10,
                "ingredients": ["яйца", "хлеб", "масло"],
                "source_url": "https://www.russianfood.com/recipes/recipe.php?rid=123456"
            },
            {
                "title": "Сэндвич с сыром",
                "prep_time": 10,
                "cook_time": 5,
                "ingredients": ["хлеб", "сыр", "помидор"],
                "source_url": "https://www.russianfood.com/recipes/recipe.php?rid=123457"
            },
            {
                "title": "Салат из консервов",
                "prep_time": 15,
                "cook_time": 0,
                "ingredients": ["кукуруза", "фасоль", "лук"],
                "source_url": "https://www.russianfood.com/recipes/recipe.php?rid=123458"
            }
        ]
    
    message = "⚡ <b>Быстрые рецепты (до 30 минут):</b>\n\n"
    
    for i, recipe in enumerate(quick_recipes, 1):
        title = recipe.get('title', 'Рецепт')
        prep_time = recipe.get('prep_time', 0)
        cook_time = recipe.get('cook_time', 0)
        ingredients = recipe.get('ingredients', [])
        
        if isinstance(ingredients, list):
            ingredients_text = ", ".join(ingredients[:3])
        else:
            ingredients_text = "разные продукты"
        
        message += (
            f"<b>{i}. {title}</b>\n"
            f"   🕐 {prep_time + cook_time} мин\n"
            f"   🥗 {ingredients_text}\n"
        )
        
        if recipe.get('source_url'):
            message += f"   🔗 <a href='{recipe['source_url']}'>Рецепт</a>\n"
        
        message += "\n"
    
    message += "🍳 <b>Для персонализированных рецептов:</b> <code>/recipes</code>"
    
    await update.message.reply_text(
        message,
        parse_mode='HTML',
        disable_web_page_preview=True
    )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /help - помощь"""
    help_text = (
        "📚 <b>Помощь по командам</b>\n\n"
        
        "<b>Основные:</b>\n"
        "<code>/start</code> - начать\n"
        "<code>/code КОД</code> - привязать Telegram\n"
        "<code>/help</code> - эта справка\n\n"
        
        "<b>Холодильник:</b>\n"
        "<code>/list</code> - что есть в холодильнике\n"
        "<code>/add продукт</code> - добавить продукт\n\n"
        
        "<b>Рецепты (ИИ-помощник):</b>\n"
        "<code>/recipes</code> - персонализированные рецепты\n"
        "<code>/quick</code> - быстрые рецепты (< 30 мин)\n\n"
        
        "<b>Покупки:</b>\n"
        "<code>/shopping</code> - список покупок\n\n"
        
        "<b>ИИ-помощник (/recipes):</b>\n"
        "1. Смотрит что в вашем холодильнике\n"
        "2. Спрашивает время на готовку\n"
        "3. Предлагает 3-4 подходящих рецепта\n"
        "4. Даёт ссылки на полные рецепты\n\n"
        
        "<b>Веб-приложение:</b>\n"
        "👉 https://shoppinglist-navy.vercel.app"
    )
    
    await update.message.reply_text(help_text, parse_mode='HTML')

# === ОБРАБОТЧИКИ КНОПОК ===
async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик кнопок старого меню"""
    query = update.callback_query
    await query.answer()
    
    if query.data == 'join':
        await query.edit_message_text(
            "Введите код семьи:\n"
            "<code>/code TEST789</code>\n\n"
            "Или другие тестовые коды:\n"
            "• IVANOV123\n"
            "• PETROV456",
            parse_mode='HTML'
        )
    elif query.data == 'create':
        await query.edit_message_text(
            "Создать семью можно в веб-приложении:\n"
            "👉 https://shoppinglist-navy.vercel.app\n\n"
            "После создания получите код и используйте:\n"
            "<code>/code ВАШ_КОД</code>",
            parse_mode='HTML'
        )
    elif query.data == 'recipes':
        # Вызываем команду рецептов
        fake_update = Update(
            update.update_id,
            message=query.message
        )
        await recipes_command(fake_update, context)

async def ai_callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик кнопок ИИ-помощника"""
    query = update.callback_query
    await query.answer()
    chat_id = update.effective_chat.id
    
    if chat_id not in AI_STATES:
        await query.edit_message_text(
            "🍳 Сессия завершена. Начните заново: /recipes",
            parse_mode='HTML'
        )
        return
    
    state = AI_STATES[chat_id]
    
    if query.data.startswith('time_'):
        if query.data == 'time_30':
            time_minutes = 30
            time_text = "менее 30 минут ⚡"
        elif query.data == 'time_60':
            time_minutes = 60
            time_text = "30-60 минут 🕐"
        elif query.data == 'time_any':
            time_minutes = None
            time_text = "любое время 🎲"
        else:
            time_minutes = 90
            time_text = "более 60 минут 🍳"
        
        state['time_available'] = time_minutes
        state['step'] = 'suggesting'
        
        search_text = f"🔍 Ищу рецепты"
        if time_minutes:
            search_text += f" до {time_minutes} минут"
        
        await query.edit_message_text(
            f"🍳 <b>ИИ-помощник по рецептам</b>\n\n"
            f"⏱ <b>Время:</b> {time_text}\n"
            f"{search_text}...",
            parse_mode='HTML'
        )
        
        recipes = get_ai_recipes(state['ingredients'], time_minutes)
        
        if not recipes:
            recipes = get_fallback_recipes(state['ingredients'])
        
        if recipes:
            await send_recipes(query, recipes, time_text)
            AI_STATES.pop(chat_id, None)
        else:
            await query.edit_message_text(
                "😔 <b>Не нашёл подходящих рецептов</b>\n\n"
                "Попробуйте:\n"
                "• Добавить больше продуктов: <code>/add продукт</code>\n"
                "• Увеличить время готовки\n"
                "• Посмотреть быстрые рецепты: <code>/quick</code>\n"
                "• Попробовать снова: <code>/recipes</code>",
                parse_mode='HTML'
            )
            AI_STATES.pop(chat_id, None)

async def ai_new_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Новый поиск рецептов"""
    query = update.callback_query
    await query.answer()
    
    await query.edit_message_text(
        "🔄 Начинаю новый поиск рецептов...",
        parse_mode='HTML'
    )
    
    fake_update = Update(
        update.update_id,
        message=query.message
    )
    await recipes_command(fake_update, context)

async def quick_recipes_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Быстрые рецепты из callback"""
    query = update.callback_query
    await query.answer()
    
    fake_update = Update(
        update.update_id,
        message=query.message
    )
    await quick_recipes_command(fake_update, context)

async def add_products_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Добавить продукты из callback"""
    query = update.callback_query
    await query.answer()
    
    await query.edit_message_text(
        "🥦 <b>Добавить продукты в холодильник:</b>\n\n"
        "Используйте команду:\n"
        "<code>/add продукт</code>\n\n"
        "<b>Примеры:</b>\n"
        "<code>/add молоко</code>\n"
        "<code>/add яйца 10</code>\n"
        "<code>/add курица</code>\n"
        "<code>/add картофель 5</code>\n\n"
        "После добавления попробуйте снова: <code>/recipes</code>",
        parse_mode='HTML'
    )

# === ЗАПУСК БОТА ===
def main():
    print("=" * 50)
    print("🤖 Family Chef Bot запускается...")
    print("=" * 50)
    
    try:
        application = Application.builder().token(TELEGRAM_TOKEN).build()
        
        # Регистрируем команды
        application.add_handler(CommandHandler("start", start))
        application.add_handler(CommandHandler("code", code_command))
        application.add_handler(CommandHandler("list", list_command))
        application.add_handler(CommandHandler("add", add_command))
        application.add_handler(CommandHandler("shopping", shopping_command))
        application.add_handler(CommandHandler("recipes", recipes_command))  # ИИ-помощник
        application.add_handler(CommandHandler("quick", quick_recipes_command))
        application.add_handler(CommandHandler("help", help_command))
        
        # Обработчики кнопок
        application.add_handler(CallbackQueryHandler(button_handler))
        application.add_handler(CallbackQueryHandler(ai_callback_handler, pattern='^time_'))
        application.add_handler(CallbackQueryHandler(ai_new_callback, pattern='^ai_new$'))
        application.add_handler(CallbackQueryHandler(quick_recipes_callback, pattern='^quick_recipes$'))
        application.add_handler(CallbackQueryHandler(add_products_callback, pattern='^add_products$'))
        
        print("✅ Бот готов к работе!")
        print("📱 Доступные команды:")
        print("   /start - начать")
        print("   /code КОД - присоединиться")
        print("   /list - холодильник")
        print("   /add - добавить продукт")
        print("   /shopping - покупки")
        print("   /recipes - ИИ-помощник по рецептам")
        print("   /quick - быстрые рецепты")
        print("   /help - справка")
        print("=" * 50)
        print("🤖 Ожидаю сообщений...")
        print("=" * 50)
        
        application.run_polling(allowed_updates=Update.ALL_TYPES)
        
    except Exception as e:
        print(f"❌ Ошибка запуска: {e}")
        print("Проверьте:")
        print("1. Правильный токен в Railway Variables")
        print("2. requirements.txt содержит python-telegram-bot==20.7")
        print("3. Python версия 3.11+")

if __name__ == '__main__':
    main()
