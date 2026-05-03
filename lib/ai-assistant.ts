import { supabase } from './supabase'

export type AIResponse = {
  message: string
  actions?: AIAction[]
}

export type AIAction =
  | { type: 'add_items'; items: { name: string; category: 'products' | 'household'; quantity: number }[] }
  | { type: 'mark_purchased'; itemNames: string[] }
  | { type: 'remove_items'; itemNames: string[] }
  | { type: 'show_list' }

/**
 * Главный обработчик — бесплатный, без API
 */
export async function chatWithAI(
  userMessage: string,
  currentList: { name: string; category: string; quantity: number; purchased: boolean }[],
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<AIResponse> {
  const lowerMsg = userMessage.toLowerCase().trim()

  // 1. Рецепты
  if (
    lowerMsg.includes('рецепт') ||
    lowerMsg.includes('приготовить') ||
    lowerMsg.includes('готовить') ||
    lowerMsg.includes('что сделать из') ||
    lowerMsg.includes('что можно из') ||
    lowerMsg.includes('дай идею') ||
    lowerMsg.includes('что приготовить')
  ) {
    return handleRecipeRequest(userMessage, currentList)
  }

  // 2. Показать список
  if (
    lowerMsg.includes('покажи') ||
    lowerMsg.includes('что в списке') ||
    lowerMsg.includes('что надо купить') ||
    lowerMsg.includes('список')
  ) {
    return handleShowList(currentList)
  }

  // 3. Добавить
  const addPatterns = ['добавь', 'купи', 'надо взять', 'нужно взять', 'возьми', 'закажи', 'в список']
  if (addPatterns.some(p => lowerMsg.includes(p))) {
    return handleAddItems(userMessage)
  }

  // 4. Куплено
  const boughtPatterns = ['купил', 'куплен', 'готово', 'взял', 'готов', 'сделано']
  if (boughtPatterns.some(p => lowerMsg.includes(p))) {
    return handleMarkPurchased(userMessage, currentList)
  }

  // 5. Удалить
  const removePatterns = ['удали', 'убери', 'вычеркни', 'сотри']
  if (removePatterns.some(p => lowerMsg.includes(p))) {
    return handleRemoveItems(userMessage, currentList)
  }

  // 6. Помощь
  if (lowerMsg.includes('помощ') || lowerMsg.includes('что ты умеешь') || lowerMsg === '?') {
    return {
      message: `🤖 Я умею:
🛒 «добавь молоко и хлеб» — добавить товары
✅ «молоко купил» — отметить купленным
🗑️ «удали хлеб» — удалить из списка
📋 «покажи список» — показать покупки
🍳 «рецепт с яйцами» — найти рецепт
⚡ «быстрые рецепты» — рецепты до 30 мин`,
    }
  }

  // 7. Быстрые рецепты
  if (lowerMsg.includes('быстрые рецепты') || lowerMsg.includes('быстрый рецепт') || lowerMsg === 'quick') {
    return handleQuickRecipes()
  }

  // 8. Приветствие
  if (lowerMsg.includes('привет') || lowerMsg.includes('здравствуй') || lowerMsg.includes('добрый')) {
    const activeCount = currentList.filter(i => !i.purchased).length
    return {
      message: `Привет! 👋 У тебя ${activeCount} товаров в списке. Чем помочь? Напиши «помощь», чтобы узнать команды.`,
    }
  }

  // 9. Неизвестная команда
  return {
    message: `Не понял. Попробуй:
• «добавь молоко» — добавить
• «покажи список» — что купить
• «рецепт с курицей» — идея ужина
• «помощь» — все команды`,
  }
}

/**
 * Поиск рецептов: сначала Supabase, потом fallback
 */
async function handleRecipeRequest(
  message: string,
  currentList: { name: string; category: string; quantity: number; purchased: boolean }[]
): Promise<AIResponse> {
  // Собираем доступные ингредиенты из списка
  const availableIngredients = currentList
    .filter(i => !i.purchased)
    .map(i => i.name.toLowerCase())

  // Извлекаем ключевые слова из запроса
  const keywords = extractFoodKeywords(message)

  // 1. Ищем в Supabase recipes
  const recipes = await searchRecipesInDB(keywords.length > 0 ? keywords : availableIngredients)

  if (recipes.length > 0) {
    return formatRecipesResponse(recipes, '🍳 Нашёл рецепты:')
  }

  // 2. Fallback-рецепты из bot.py
  const fallbackRecipes = getFallbackRecipes(availableIngredients.length > 0 ? availableIngredients : keywords)
  
  if (fallbackRecipes.length > 0) {
    return formatRecipesResponse(fallbackRecipes, '🍳 Популярные рецепты:')
  }

  // 3. Совсем ничего не нашли
  return {
    message: `😔 Не нашёл рецептов. Попробуй:
• Добавь продукты в список через «добавь [название]»
• Напиши «быстрые рецепты»
• Поищи в интернете: yandex.ru/search?text=${encodeURIComponent(message)}`,
  }
}

/**
 * Быстрые рецепты (до 30 минут)
 */
async function handleQuickRecipes(): Promise<AIResponse> {
  const { data: recipes } = await supabase
    .from('recipes')
    .select('*')
    .lte('prep_time', 30)
    .order('prep_time', { ascending: true })
    .limit(4)

  if (recipes && recipes.length > 0) {
    return formatRecipesResponse(recipes, '⚡ Быстрые рецепты (до 30 мин):')
  }

  // Fallback
  const quickFallback = [
    {
      title: 'Яичница с тостами',
      description: 'Быстрый и сытный завтрак',
      ingredients: ['яйца', 'хлеб', 'масло'],
      prep_time: 5,
      cook_time: 10,
      difficulty: 'легко',
      source_url: 'https://www.russianfood.com/recipes/recipe.php?rid=123456',
    },
    {
      title: 'Сэндвич с сыром',
      description: 'Перекус за 15 минут',
      ingredients: ['хлеб', 'сыр', 'помидор'],
      prep_time: 10,
      cook_time: 5,
      difficulty: 'легко',
      source_url: 'https://www.russianfood.com/recipes/recipe.php?rid=123457',
    },
    {
      title: 'Салат из консервов',
      description: 'Без готовки',
      ingredients: ['кукуруза', 'фасоль', 'лук'],
      prep_time: 15,
      cook_time: 0,
      difficulty: 'легко',
      source_url: 'https://www.russianfood.com/recipes/recipe.php?rid=123458',
    },
  ]

  return formatRecipesResponse(quickFallback, '⚡ Быстрые рецепты:')
}

/**
 * Ищет рецепты в Supabase по ключевым словам
 */
async function searchRecipesInDB(keywords: string[]): Promise<any[]> {
  if (keywords.length === 0) return []

  // Строим OR-запрос: title содержит keyword1 или keyword2...
  const conditions = keywords.map(k => `title.ilike.%${k}%`)
  const query = conditions.join(',')

  const { data } = await supabase
    .from('recipes')
    .select('*')
    .or(query)
    .limit(4)

  return data || []
}

/**
 * Fallback-рецепты (как в bot.py)
 */
function getFallbackRecipes(userIngredients: string[]): any[] {
  const commonRecipes = [
    {
      title: 'Омлет с овощами',
      description: 'Быстрый и полезный завтрак',
      ingredients: ['яйца', 'молоко', 'помидор', 'лук', 'соль'],
      prep_time: 10,
      cook_time: 15,
      difficulty: 'легко',
      source_url: 'https://www.russianfood.com/recipes/recipe.php?rid=154322',
    },
    {
      title: 'Куриный суп',
      description: 'Ароматный домашний суп',
      ingredients: ['курица', 'картофель', 'морковь', 'лук', 'лапша'],
      prep_time: 20,
      cook_time: 40,
      difficulty: 'средне',
      source_url: 'https://www.russianfood.com/recipes/recipe.php?rid=139755',
    },
    {
      title: 'Паста с томатным соусом',
      description: 'Итальянская классика',
      ingredients: ['паста', 'помидор', 'чеснок', 'базилик', 'сыр'],
      prep_time: 15,
      cook_time: 20,
      difficulty: 'легко',
      source_url: 'https://www.russianfood.com/recipes/recipe.php?rid=152467',
    },
    {
      title: 'Салат из свежих овощей',
      description: 'Лёгкий витаминный салат',
      ingredients: ['огурец', 'помидор', 'лук', 'масло', 'соль'],
      prep_time: 15,
      cook_time: 0,
      difficulty: 'легко',
      source_url: 'https://www.russianfood.com/recipes/recipe.php?rid=148921',
    },
  ]

  // Фильтруем по совпадению с ингредиентами пользователя
  if (userIngredients.length > 0) {
    const ingredientSet = new Set(userIngredients)
    const scored = commonRecipes
      .map(recipe => {
        const recipeIngs = (recipe.ingredients as string[]).map(i => i.toLowerCase())
        const matches = recipeIngs.filter(i => ingredientSet.has(i)).length
        return { recipe, matches }
      })
      .filter(r => r.matches >= 1)
      .sort((a, b) => b.matches - a.matches)

    if (scored.length > 0) {
      return scored.slice(0, 4).map(s => s.recipe)
    }
  }

  // Если нет совпадений — возвращаем все 4 случайных
  return commonRecipes.sort(() => Math.random() - 0.5).slice(0, 4)
}

/**
 * Форматирует рецепты в красивое сообщение
 */
function formatRecipesResponse(recipes: any[], title: string): AIResponse {
  let message = `${title}\n\n`

  recipes.forEach((recipe, i) => {
    const name = recipe.title || 'Рецепт'
    const desc = recipe.description || ''
    const prepTime = recipe.prep_time || 0
    const cookTime = recipe.cook_time || 0
    const totalTime = prepTime + cookTime
    const difficulty = recipe.difficulty || 'средне'
    const diffIcon = difficulty === 'легко' ? '🟢' : difficulty === 'средне' ? '🟡' : '🔴'
    const url = recipe.source_url || ''

    const ingredients = recipe.ingredients || []
    const ingText = Array.isArray(ingredients)
      ? ingredients.slice(0, 4).join(', ') + (ingredients.length > 4 ? ` (+${ingredients.length - 4})` : '')
      : 'разные продукты'

    message += `**${i + 1}. ${name}**\n`
    message += `📝 ${desc}\n`
    message += `${diffIcon} ${difficulty} | 🕐 ${totalTime} мин\n`
    message += `🥗 ${ingText}\n`
    if (url) {
      const domain = url.replace(/https?:\/\//, '').replace(/www\./, '').split('/')[0]
      message += `🔗 [Рецепт на ${domain}](${url})\n`
    }
    message += '\n'
  })

  message += '_Нажми на ссылку для полного рецепта 👆_'

  return { message }
}

/**
 * Показать список покупок
 */
function handleShowList(
  currentList: { name: string; category: string; quantity: number; purchased: boolean }[]
): AIResponse {
  const active = currentList.filter(i => !i.purchased)
  const bought = currentList.filter(i => i.purchased)

  if (active.length === 0 && bought.length === 0) {
    return { message: '📋 Список покупок пуст. Напиши «добавь [название]», чтобы начать.' }
  }

  let message = ''
  if (active.length > 0) {
    message += `🛒 **Купить (${active.length}):**\n`
    active.forEach(i => { message += `• ${i.name} — ${i.quantity} шт.\n` })
  }
  if (bought.length > 0) {
    message += `\n✅ **Куплено (${bought.length}):**\n`
    bought.slice(-5).forEach(i => { message += `• ${i.name}\n` })
  }
  return { message }
}

/**
 * Добавить товары
 */
function handleAddItems(message: string): AIResponse {
  const items = extractItems(message)
  if (items.length === 0) {
    return { message: 'Что добавить? Напиши: «добавь молоко и хлеб»' }
  }
  return {
    message: `✅ Добавляю: ${items.map(i => i.name).join(', ')}`,
    actions: [{ type: 'add_items', items }],
  }
}

/**
 * Отметить купленным
 */
function handleMarkPurchased(
  message: string,
  currentList: { name: string; category: string; quantity: number; purchased: boolean }[]
): AIResponse {
  const keywords = extractFoodKeywords(message)
  const activeItems = currentList.filter(i => !i.purchased)
  const matched = activeItems.filter(item => keywords.some(k => item.name.toLowerCase().includes(k)))

  if (matched.length === 0) {
    const suggestions = activeItems.slice(0, 5).map(i => i.name).join(', ')
    return { message: `Не нашёл такой товар. Активные: ${suggestions || 'список пуст'}. Что отметить?` }
  }

  return {
    message: `✅ Отмечаю купленным: ${matched.map(i => i.name).join(', ')}`,
    actions: [{ type: 'mark_purchased', itemNames: matched.map(i => i.name) }],
  }
}

/**
 * Удалить товары
 */
function handleRemoveItems(
  message: string,
  currentList: { name: string; category: string; quantity: number; purchased: boolean }[]
): AIResponse {
  const keywords = extractFoodKeywords(message)
  const matched = currentList.filter(item => keywords.some(k => item.name.toLowerCase().includes(k)))

  if (matched.length === 0) {
    return { message: 'Что удалить? Уточни название.' }
  }

  return {
    message: `🗑️ Удаляю: ${matched.map(i => i.name).join(', ')}`,
    actions: [{ type: 'remove_items', itemNames: matched.map(i => i.name) }],
  }
}

/**
 * Извлекает товары из текста
 */
function extractItems(text: string): { name: string; category: 'products' | 'household'; quantity: number }[] {
  const items: { name: string; category: 'products' | 'household'; quantity: number }[] = []
  const cleaned = text
    .replace(/добавь|купи|надо взять|нужно взять|возьми|закажи|в список/g, '')
    .replace(/пожалуйста|плиз|спасибо/g, '')
    .trim()

  const parts = cleaned.split(/[.,]| и /).filter(Boolean)
  const householdWords = ['порошок', 'мыло', 'губка', 'салфетка', 'пакет', 'освежитель', 'щётка', 'шампунь', 'гель', 'средство', 'тряпка', 'перчатки', 'чистящее', 'туалетная бумага', 'стиральный', 'кондиционер']

  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.length < 2) continue
    const isHousehold = householdWords.some(w => trimmed.toLowerCase().includes(w))
    let quantity = 1
    const qtyMatch = trimmed.match(/(\d+)\s*(шт|кг|л|г|мл|уп)/)
    if (qtyMatch) quantity = parseInt(qtyMatch[1])
    items.push({ name: trimmed, category: isHousehold ? 'household' : 'products', quantity })
  }
  return items
}

/**
 * Извлекает ключевые слова продуктов
 */
function extractFoodKeywords(text: string): string[] {
  return text
    .replace(/рецепт|приготовить|готовить|сделать|из|что|можно|дай|идею|найди|поищи|быстрые|быстрый/g, '')
    .replace(/[.,!?]/g, '')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 2)
    .map(w => w.toLowerCase())
}

/**
 * Публичная функция поиска рецептов
 */
export async function searchRecipes(query: string) {
  const keywords = extractFoodKeywords(query)
  if (keywords.length === 0) return []
  return searchRecipesInDB(keywords)
}
