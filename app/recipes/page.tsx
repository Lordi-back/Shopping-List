'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Recipe = {
  id: string
  title: string
  description?: string
  ingredients: string[]
  instructions?: string[]
  prep_time?: number
  cook_time?: number
  difficulty?: string
  category?: string
  source_url?: string
}

const FALLBACK_RECIPES: Recipe[] = [
  {
    id: 'fallback-1',
    title: 'Омлет с овощами',
    description: 'Быстрый и полезный завтрак',
    ingredients: ['яйца', 'молоко', 'помидор', 'лук', 'соль'],
    prep_time: 10,
    cook_time: 15,
    difficulty: 'легко',
    source_url: 'https://www.russianfood.com/recipes/recipe.php?rid=154322',
  },
  {
    id: 'fallback-2',
    title: 'Куриный суп',
    description: 'Ароматный домашний суп',
    ingredients: ['курица', 'картофель', 'морковь', 'лук', 'лапша'],
    prep_time: 20,
    cook_time: 40,
    difficulty: 'средне',
    source_url: 'https://www.russianfood.com/recipes/recipe.php?rid=139755',
  },
  {
    id: 'fallback-3',
    title: 'Паста с томатным соусом',
    description: 'Итальянская классика',
    ingredients: ['паста', 'помидор', 'чеснок', 'базилик', 'сыр'],
    prep_time: 15,
    cook_time: 20,
    difficulty: 'легко',
    source_url: 'https://www.russianfood.com/recipes/recipe.php?rid=152467',
  },
  {
    id: 'fallback-4',
    title: 'Салат из свежих овощей',
    description: 'Лёгкий витаминный салат',
    ingredients: ['огурец', 'помидор', 'лук', 'масло', 'соль'],
    prep_time: 15,
    cook_time: 0,
    difficulty: 'легко',
    source_url: 'https://www.russianfood.com/recipes/recipe.php?rid=148921',
  },
]

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)

  useEffect(() => {
    loadRecipes()
  }, [])

  const loadRecipes = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    if (data && data.length > 0) {
      setRecipes(data as Recipe[])
    } else {
      setRecipes(FALLBACK_RECIPES)
    }
    setLoading(false)
  }

  const handleSearch = async () => {
    if (!search.trim()) {
      loadRecipes()
      return
    }

    setLoading(true)
    const keywords = search.trim().split(/\s+/)
    const conditions = keywords.map(k => `title.ilike.%${k}%`).join(',')

    const { data } = await supabase
      .from('recipes')
      .select('*')
      .or(conditions)
      .limit(20)

    if (data && data.length > 0) {
      setRecipes(data as Recipe[])
    } else {
      // Поиск по fallback
      const filtered = FALLBACK_RECIPES.filter(r =>
        keywords.some(k => r.title.toLowerCase().includes(k.toLowerCase()))
      )
      setRecipes(filtered)
    }
    setLoading(false)
  }

  const difficultyIcon = (d?: string) => {
    if (d === 'легко') return '🟢'
    if (d === 'средне') return '🟡'
    return '🔴'
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-24">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">🍳 Рецепты</h1>

      {/* Поиск */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Поиск рецепта..."
          className="input flex-1"
        />
        <button onClick={handleSearch} className="btn btn-primary px-4">
          🔍
        </button>
      </div>

      {/* Список */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-48 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-32" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {recipes.map(recipe => (
            <div
              key={recipe.id}
              className="card cursor-pointer hover:shadow-card-hover transition-all"
              onClick={() => setSelectedRecipe(recipe)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm mb-1">{recipe.title}</h3>
                  {recipe.description && (
                    <p className="text-xs text-gray-500 mb-2">{recipe.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{difficultyIcon(recipe.difficulty)} {recipe.difficulty || 'средне'}</span>
                    <span>🕐 {(recipe.prep_time || 0) + (recipe.cook_time || 0)} мин</span>
                    <span>🥗 {recipe.ingredients?.length || 0} инг.</span>
                  </div>
                </div>
                <span className="text-2xl flex-shrink-0">📖</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {recipes.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-gray-500">Ничего не найдено</p>
        </div>
      )}

      {/* Модальное окно рецепта */}
      {selectedRecipe && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setSelectedRecipe(null)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[80vh] overflow-y-auto p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-bold">{selectedRecipe.title}</h3>
              <button
                onClick={() => setSelectedRecipe(null)}
                className="btn btn-ghost p-2"
              >
                ✕
              </button>
            </div>

            {selectedRecipe.description && (
              <p className="text-sm text-gray-500 mb-4">{selectedRecipe.description}</p>
            )}

            <div className="flex gap-4 text-sm text-gray-600 mb-4">
              <span>{difficultyIcon(selectedRecipe.difficulty)} {selectedRecipe.difficulty || 'средне'}</span>
              <span>🕐 Подготовка: {selectedRecipe.prep_time || '?'} мин</span>
              <span>🍳 Готовка: {selectedRecipe.cook_time || '?'} мин</span>
            </div>

            {/* Ингредиенты */}
            <h4 className="font-semibold text-sm mb-2">📝 Ингредиенты:</h4>
            <ul className="space-y-1 mb-4">
              {selectedRecipe.ingredients?.map((ing, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-fridge-500 rounded-full flex-shrink-0" />
                  {ing}
                </li>
              ))}
            </ul>

            {/* Инструкции */}
            {selectedRecipe.instructions && selectedRecipe.instructions.length > 0 && (
              <>
                <h4 className="font-semibold text-sm mb-2">👨‍🍳 Приготовление:</h4>
                <ol className="space-y-2 mb-4">
                  {selectedRecipe.instructions.map((step, i) => (
                    <li key={i} className="text-sm text-gray-600 flex gap-2">
                      <span className="font-bold text-fridge-500 flex-shrink-0">{i + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </>
            )}

            {selectedRecipe.source_url && (
              <a
                href={selectedRecipe.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline w-full text-sm"
              >
                🔗 Полный рецепт на сайте
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
