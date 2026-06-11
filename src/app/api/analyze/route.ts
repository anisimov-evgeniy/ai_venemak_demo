import OpenAI from 'openai'
import type { ChatCompletionContentPart } from 'openai/resources/chat/completions'
import { VENEMAK_SYSTEM_PROMPT } from '@/lib/venemakPrompt'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_SIZE = 10 * 1024 * 1024
const DAILY_LIMIT = 100
const MODEL = 'gpt-4o'

let requestCount = 0
let currentDay = new Date().toDateString()

function checkRateLimit(): boolean {
  const today = new Date().toDateString()

  if (today !== currentDay) {
    requestCount = 0
    currentDay = today
  }

  if (requestCount >= DAILY_LIMIT) return false

  requestCount++
  return true
}

function normalizeAnswer(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .trim()
}

function buildMedicalPrompt(question: string, hasImage: boolean): string {
  if (hasImage) {
    return `
[Клинический анализ медицинского изображения]

Пользователь загрузил медицинское изображение (это может быть снимок внутренних органов, тканей или иной медицинский визуальный материал) и просит помочь с его визуальным анализом.

Структура ответа:
1. Краткое визуальное описание снимка.
2. Видимые патологические признаки (или их отсутствие).
3. Возможные дифференциальные варианты.
4. Что врачу стоит уточнить/проверить дополнительно.
5. Осторожное предварительное резюме.

Соблюдай все правила и ограничения из системной инструкции ВЕНЕМАК.

Вопрос пользователя:
${question.trim()}
    `.trim()
  }

  return `
[Клиническая консультация по текстовому вопросу]

Пользователь задал клинический вопрос без изображения. Дай обоснованный профессиональный ответ, соблюдая все правила и ограничения из системной инструкции ВЕНЕМАК. Если для качественного ответа не хватает данных — уточни, какие сведения нужны.

Вопрос пользователя:
${question.trim()}
  `.trim()
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      {
        error:
          'Сервис не настроен: отсутствует OPENAI_API_KEY. Обратитесь к администратору.',
      },
      { status: 500 }
    )
  }

  if (!checkRateLimit()) {
    return Response.json(
      {
        error:
          'Достигнут суточный лимит запросов demo-версии (100/день). Попробуйте завтра.',
      },
      { status: 429 }
    )
  }

  let formData: FormData

  try {
    formData = await request.formData()
  } catch {
    return Response.json(
      { error: 'Не удалось прочитать данные запроса.' },
      { status: 400 }
    )
  }

  const imageField = formData.get('image')
  const questionField = formData.get('question')

  if (typeof questionField !== 'string' || !questionField.trim()) {
    return Response.json({ error: 'Вопрос не передан.' }, { status: 400 })
  }

  const hasImage = imageField instanceof File && imageField.size > 0

  let imageDataUrl: string | null = null

  if (hasImage) {
    const image = imageField as File

    if (!ALLOWED_TYPES.has(image.type)) {
      return Response.json(
        { error: 'Недопустимый формат файла. Разрешены: JPG, PNG, WEBP.' },
        { status: 400 }
      )
    }

    if (image.size > MAX_SIZE) {
      return Response.json(
        { error: 'Размер файла превышает 10 МБ.' },
        { status: 400 }
      )
    }

    const arrayBuffer = await image.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    imageDataUrl = `data:${image.type};base64,${base64}`
  }

  const promptText = buildMedicalPrompt(questionField, hasImage)

  const userContent: string | ChatCompletionContentPart[] = hasImage
    ? [
        { type: 'text', text: promptText },
        {
          type: 'image_url',
          image_url: { url: imageDataUrl as string, detail: 'high' },
        },
      ]
    : promptText

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    // Кастомный эндпоинт OpenAI-совместимого провайдера (например, neuroapi.host).
    // Если не задан — используется стандартный api.openai.com.
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  })

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 1500,
      messages: [
        { role: 'system', content: VENEMAK_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    })

    const choice = completion.choices?.[0]
    const refusal = choice?.message?.refusal

    if (refusal) {
      return Response.json(
        {
          error: 'Модель отказалась обрабатывать запрос.',
          reason: refusal,
        },
        { status: 422 }
      )
    }

    const rawAnswer = choice?.message?.content ?? ''
    const answer = normalizeAnswer(rawAnswer)

    if (!answer) {
      return Response.json(
        {
          error: 'Пустой ответ от AI. Попробуйте переформулировать запрос.',
          finishReason: choice?.finish_reason,
        },
        { status: 500 }
      )
    }

    return Response.json({ answer })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'

    console.error('OpenAI API error:', err)

    return Response.json(
      { error: `Ошибка при обращении к AI: ${message}` },
      { status: 500 }
    )
  }
}
