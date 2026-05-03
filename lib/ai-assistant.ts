import OpenAI from 'openai'

// DeepSeek API совместим с OpenAI SDK — просто меняем baseURL и ключ
const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
})

const MODEL = 'deepseek-chat'

const SYSTEM_PROMPT = `Ты — умный помощник «Семейного холодильника». Твои возможности:

1. Добавлять товары в список покупок
   - «добавь молоко»
   - «купи хлеб и яйца»
   - «надо взять сыр»

2. Показывать текущий список
   - «что в списке?»
   - «покажи покупки»
   - «что надо купить?»

3. Отмечать купленное
   - «молоко купил»
   - «хлеб готово»
   - «яйца взял»

4. Удалять из списка
   - «удали молоко»
   - «убери хлеб из списка»

5. Предлагать рецепты
   - «что приготовить из курицы и сыра?»
   - «рецепт с яйцами и молоком»
   - «дай идею ужина»

6. Отвечать на вопросы о продуктах
   - «сколько хранится молоко?»
   - «какая сезонность у помидоров?»

Отвечай кратко, дружелюбно, на русском языке.
Если пользователь просит добавить товар — сначала скажи что делаешь, потом выполни.
Для рецептов — предлагай конкретный рецепт с ингредиентами и шагами приготовления.`

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
  const listContext = currentList.length > 0
    ? `\n\nТекущий список покупок:\n${currentList.map(i => `- ${i.name} (${i.category === 'household' ? 'быт' : 'продукты'}, ${i.quantity} шт., ${i.purchased ? 'куплен' : 'не куплен'})`).join('\n')}`
    : '\n\nСписок покупок пуст.'

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT + listContext },
    ...history,
    { role: 'user', content: userMessage },
  ]

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: messages as any,
    temperature: 0.7,
    max_tokens: 1000,
  })

  const aiMessage = completion.choices[0]?.message?.content || 'Извини, не понял. Повтори?'

  // Парсим действия из ответа AI
  const actions = parseActions(userMessage, aiMessage)

  return {
    message: aiMessage,
    actions: actions.length > 0 ? actions : undefined,
  }
}

/**
 * Простой парсер: по ключевым словам определяем, что хотел пользователь
 */
function parseActions(userMessage: string, aiMessage: string): AIAction[] {
  const actions: AIAction[] = []
  const lowerMsg = userMessage.toLowerCase()

  // Добавление товаров
  const addPatterns = ['добавь', 'купи', 'надо взять', 'нужно взять', 'приобрети', 'возьми', 'взять', 'закажи']
  if (addPatterns.some(p => lowerMsg.includes(p))) {
    const items = extractItems(userMessage)
    if (items.length > 0) {
      actions.push({ type: 'add_items', items })
    }
  }

  // Отметить купленным
  const boughtPatterns = ['купил', 'куплен', 'готово', 'взял', 'приобрёл', 'готов']
  if (boughtPatterns.some(p => lowerMsg.includes(p))) {
    const items = extractItems(userMessage)
    if (items.length > 0) {
      actions.push({ type: 'mark_purchased', itemNames: items.map(i => i.name) })
    }
  }

  // Удаление
  const removePatterns = ['удали', 'убери', 'вычеркни', 'сотри']
  if (removePatterns.some(p => lowerMsg.includes(p))) {
    const items = extractItems(userMessage)
    if (items.length > 0) {
      actions.push({ type: 'remove_items', itemNames: items.map(i => i.name) })
    }
  }

  return actions
}

/**
 * Извлекает названия товаров из сообщения
 */
function extractItems(text: string): { name: string; category: 'products' | 'household'; quantity: number }[] {
  const items: { name: string; category: 'products' | 'household'; quantity: number }[] = []

  // Убираем ключевые слова
  const cleaned = text
    .replace(/добавь|купи|надо взять|нужно взять|приобрети|возьми|удали|убери|вычеркни|сотри|купил|куплен|готово|взял|приобрёл|закажи/g, '')
    .replace(/пожалуйста|плиз|спасибо/g, '')
    .trim()

  // Разделяем по запятым и "и"
  const parts = cleaned.split(/[.,]| и /).filter(Boolean)

  const householdWords = ['порошок', 'мыло', 'губка', 'салфетка', 'пакет', 'освежитель', 'щётка', 'шампунь', 'гель', 'средство', 'тряпка', 'перчатки', 'чистящее', 'освежитель воздуха']

  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.length < 2) continue

    const isHousehold = householdWords.some(w => trimmed.toLowerCase().includes(w))

    items.push({
      name: trimmed,
      category: isHousehold ? 'household' : 'products',
      quantity: 1,
    })
  }

  return items
}

/**
 * Генерация рецепта на основе продуктов
 */
export async function suggestRecipe(
  ingredients: string[],
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<{ message: string }> {
  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: `Ты — кулинарный ассистент. Предложи рецепт блюда, которое можно приготовить из этих ингредиентов: ${ingredients.join(', ')}. 
        Формат ответа:
        **Название блюда**
        🕐 Время приготовления: X минут
        📝 Ингредиенты:
        - ингредиент 1
        - ингредиент 2
        👨‍🍳 Приготовление:
        1. шаг 1
        2. шаг 2
        
        Если ингредиентов не хватает — предложи похожий рецепт и укажи, чего не хватает.`,
      },
      ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ],
    temperature: 0.8,
    max_tokens: 800,
  })

  return {
    message: completion.choices[0]?.message?.content || 'Не могу придумать рецепт.',
  }
}
