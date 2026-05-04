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
    lowerMsg.includes('что сделать из') ||
    lowerMsg.includes('что можно из') ||
    lowerMsg.includes('дай идею') ||
    lowerMsg.includes('что приготовить')
  ) {
    return handleRecipeRequest(userMessage)
  }

  // 2. Показать список
  if (lowerMsg.includes('покажи') || lowerMsg.includes('что в списке') || lowerMsg.includes('что надо купить')) {
    return handleShowList(currentList)
  }

  // 3. Добавить
  if (['добавь', 'купи', 'надо взять', 'нужно взять', 'возьми', 'закажи', 'в список'].some(p => lowerMsg.includes(p))) {
    return handleAddItems(userMessage)
  }

  // 4. Куплено
  if (['купил', 'куплен', 'готово', 'взял', 'готов', 'сделано'].some(p => lowerMsg.includes(p))) {
    return handleMarkPurchased(userMessage, currentList)
  }

  // 5. Удалить
  if (['удали', 'убери', 'вычеркни', 'сотри'].some(p => lowerMsg.includes(p))) {
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
🍳 «рецепт» — рецепты из продуктов в холодильнике`,
    }
  }

  // 7. Быстрые рецепты
  if (lowerMsg.includes('быстрые рецепты') || lowerMsg.includes('быстрый рецепт')) {
    return handleQuickRecipes()
  }

  // 8. Приветствие
  if (lowerMsg.includes('привет') || lowerMsg.includes('здравствуй')) {
    const activeCount = currentList.filter(i => !i.purchased).length
    return {
      message: `Привет! 👋 У тебя ${activeCount} товаров в списке. Напиши «рецепт», чтобы узнать, что можно приготовить!`,
    }
  }

  return {
    message: `Не понял. Попробуй:
• «добавь молоко» — добавить в список
• «покажи список» — что купить
• «рецепт» — идеи для готовки
• «помощь» — все команды`,
  }
}

/**
 * Ищет рецепты НА ОСНОВЕ ПРОДУКТОВ В ХОЛОДИЛЬНИКЕ
 */
async function handleRecipeRequest(userMessage: string): Promise<AIResponse> {
  // 1. Получаем продукты из холодильника
  const { data: fridgeItems } = await supabase
    .from('fridge_items')
    .select('quantity, products(name, category)')

  if (!fridgeItems || fridgeItems.length === 0) {
    return {
      message: `🍳 Холодильник пуст! Сначала добавь продукты через кнопку «+ Добавить» на главной.

А пока — вот популярные рецепты:\n${formatFallbackRecipes(getFallbackRecipes([]))}`,
    }
  }

  // 2. Собираем ингредиенты из холодильника
  const fridgeIngredients = fridgeItems
    .map((item: any) => item.products?.name?.toLowerCase())
    .filter(Boolean) as string[]

  // 3. Ищем в базе recipes
  const { data: dbRecipes } = await supabase
    .from('recipes')
    .select('*')
    .limit(10)

  // 4. Подбираем рецепты, которые максимально используют ингредиенты из холодильника
  const scoredRecipes = (dbRecipes || []).map(recipe => {
    const recipeIngs = (recipe.ingredients || []).map((i: string) => i.toLowerCase())
        const matches = recipeIngs.filter((ing: string) => fridgeIngredients.some((fi: string) => fi.includes(ing) || ing.includes(fi)))
    const missing = recipeIngs.filter((ing: string) => !fridgeIngredients.some((fi: string) => fi.includes(ing) || ing.includes(fi)))
    return { recipe, matches: matches.length, missing }
  })

  // Сортируем: сначала те, где больше совпадений
  scoredRecipes.sort((a, b) => b.matches - a.matches)
  const topRecipes = scoredRecipes.slice(0, 4)

  if (topRecipes.length > 0 && topRecipes[0].matches > 0) {
    const message = formatFridgeRecipes(topRecipes, fridgeIngredients)
    return { message }
  }

  // 5. Fallback
  const fallback = getFallbackRecipes(fridgeIngredients)
  return {
    message: `🍳 В холодильнике: ${fridgeIngredients.join(', ')}\n\nВ базе рецептов нет точных совпадений. Вот популярные рецепты:\n${formatFallbackRecipes(fallback)}`,
  }
}

function formatFridgeRecipes(scored: any[], fridgeIngredients: string[]): string {
  let message = `🍳 **Рецепты на основе холодильника**\n`
  message += `🥗 Доступно: ${fridgeIngredients.join(', ')}\n\n`

  scored.forEach(({ recipe, matches, missing }, i) => {
    const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0)
    message += `**${i + 1}. ${recipe.title}**\n`
    message += `📝 ${recipe.description || ''}\n`
    message += `🕐 ${totalTime} мин | ✅ ${matches} инг. совпадает`
    if (missing.length > 0) {
      message += ` | ❌ не хватает: ${missing.slice(0, 3).join(', ')}`
    }
    message += `\n`
    if (recipe.source_url) {
      message += `🔗 [Рецепт](${recipe.source_url})\n`
    }
    message += `\n`
  })

  return message
}

function formatFallbackRecipes(recipes: any[]): string {
  let message = ''
  recipes.forEach((recipe, i) => {
    const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0)
    message += `**${i + 1}. ${recipe.title}**\n`
    message += `🕐 ${totalTime} мин | 🥗 ${(recipe.ingredients || []).slice(0, 3).join(', ')}\n`
    if (recipe.source_url) {
      message += `🔗 [Рецепт](${recipe.source_url})\n`
    }
    message += `\n`
  })
  return message
}

async function handleQuickRecipes(): Promise<AIResponse> {
  const { data: recipes } = await supabase
    .from('recipes')
    .select('*')
    .lte('prep_time', 30)
    .order('prep_time', { ascending: true })
    .limit(4)

  if (recipes && recipes.length > 0) {
    return { message: `⚡ Быстрые рецепты:\n${formatFallbackRecipes(recipes)}` }
  }

  return { message: `⚡ Быстрые рецепты:\n${formatFallbackRecipes(getFallbackRecipes([]))}` }
}

function handleShowList(currentList: { name: string; purchased: boolean; quantity: number }[]): AIResponse {
  const active = currentList.filter(i => !i.purchased)
  if (active.length === 0) return { message: '📋 Список пуст.' }
  return { message: `🛒 Список:\n${active.map(i => `• ${i.name} — ${i.quantity} шт.`).join('\n')}` }
}

function handleAddItems(message: string): AIResponse {
  const items = extractItems(message)
  if (items.length === 0) return { message: 'Что добавить?' }
  return { message: `✅ Добавляю: ${items.map(i => i.name).join(', ')}`, actions: [{ type: 'add_items', items }] }
}

function handleMarkPurchased(message: string, currentList: { name: string; purchased: boolean }[]): AIResponse {
  const keywords = extractFoodKeywords(message)
  const active = currentList.filter(i => !i.purchased)
  const matched = active.filter(item => keywords.some(k => item.name.toLowerCase().includes(k)))
  if (matched.length === 0) return { message: 'Не нашёл. Что отметить?' }
  return { message: `✅ Куплено: ${matched.map(i => i.name).join(', ')}`, actions: [{ type: 'mark_purchased', itemNames: matched.map(i => i.name) }] }
}

function handleRemoveItems(message: string, currentList: { name: string }[]): AIResponse {
  const keywords = extractFoodKeywords(message)
  const matched = currentList.filter(item => keywords.some(k => item.name.toLowerCase().includes(k)))
  if (matched.length === 0) return { message: 'Что удалить?' }
  return { message: `🗑️ Удаляю: ${matched.map(i => i.name).join(', ')}`, actions: [{ type: 'remove_items', itemNames: matched.map(i => i.name) }] }
}

function extractItems(text: string): { name: string; category: 'products' | 'household'; quantity: number }[] {
  const cleaned = text.replace(/добавь|купи|надо взять|нужно взять|возьми|закажи|в список/g, '').replace(/пожалуйста|плиз|спасибо/g, '').trim()
  const parts = cleaned.split(/[.,]| и /).filter(Boolean)
  const householdWords = ['порошок', 'мыло', 'губка', 'салфетка', 'пакет', 'освежитель', 'щётка', 'шампунь', 'гель', 'средство']
  return parts.map(part => {
    const trimmed = part.trim()
    const isHousehold = householdWords.some(w => trimmed.toLowerCase().includes(w))
    let quantity = 1
    const qtyMatch = trimmed.match(/(\d+)\s*(шт|кг|л|г|мл|уп)/)
    if (qtyMatch) quantity = parseInt(qtyMatch[1])
    return { name: trimmed, category: isHousehold ? 'household' : 'products', quantity }
  })
}

function extractFoodKeywords(text: string): string[] {
  return text.replace(/рецепт|приготовить|сделать|из|что|можно|дай|идею|найди|быстрые/g, '')
    .replace(/[.,!?]/g, '').trim().split(/\s+/).filter(w => w.length > 2).map(w => w.toLowerCase())
}

function getFallbackRecipes(userIngredients: string[]): any[] {
  const all = [
    { title: 'Омлет с овощами', description: 'Быстрый завтрак', ingredients: ['яйца', 'молоко', 'помидор', 'лук', 'соль'], prep_time: 10, cook_time: 15, source_url: 'https://www.russianfood.com/recipes/recipe.php?rid=154322' },
    { title: 'Куриный суп', description: 'Домашний суп', ingredients: ['курица', 'картофель', 'морковь', 'лук', 'лапша'], prep_time: 20, cook_time: 40, source_url: 'https://www.russianfood.com/recipes/recipe.php?rid=139755' },
    { title: 'Паста с томатным соусом', description: 'Итальянская классика', ingredients: ['паста', 'помидор', 'чеснок', 'базилик', 'сыр'], prep_time: 15, cook_time: 20, source_url: 'https://www.russianfood.com/recipes/recipe.php?rid=152467' },
    { title: 'Салат из свежих овощей', description: 'Витаминный салат', ingredients: ['огурец', 'помидор', 'лук', 'масло', 'соль'], prep_time: 15, cook_time: 0, source_url: 'https://www.russianfood.com/recipes/recipe.php?rid=148921' },
  ]

  if (userIngredients.length === 0) return all.slice(0, 4)

  const ingredientSet = new Set(userIngredients)
  return all
    .map(recipe => ({
      recipe,
      matches: recipe.ingredients.filter((i: string) => ingredientSet.has(i.toLowerCase())).length,
    }))
    .filter(r => r.matches >= 1)
    .sort((a, b) => b.matches - a.matches)
    .slice(0, 4)
    .map(r => r.recipe)
}
