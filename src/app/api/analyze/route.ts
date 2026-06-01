import { GoogleGenerativeAI } from '@google/generative-ai'
import { VENEMAK_SYSTEM_PROMPT } from '@/lib/venemakPrompt'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_SIZE = 10 * 1024 * 1024
const DAILY_LIMIT = 100

// In-memory rate limiter — resets each calendar day (server process lifetime)
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

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json(
      { error: 'Сервис не настроен: отсутствует GEMINI_API_KEY. Обратитесь к администратору.' },
      { status: 500 }
    )
  }

  if (!checkRateLimit()) {
    return Response.json(
      { error: 'Достигнут суточный лимит запросов demo-версии (100/день). Попробуйте завтра.' },
      { status: 429 }
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Не удалось прочитать данные запроса.' }, { status: 400 })
  }

  const imageField = formData.get('image')
  const questionField = formData.get('question')

  if (!(imageField instanceof File)) {
    return Response.json({ error: 'Изображение не передано.' }, { status: 400 })
  }

  if (typeof questionField !== 'string' || !questionField.trim()) {
    return Response.json({ error: 'Вопрос не передан.' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.has(imageField.type)) {
    return Response.json(
      { error: 'Недопустимый формат файла. Разрешены: JPG, PNG, WEBP.' },
      { status: 400 }
    )
  }

  if (imageField.size > MAX_SIZE) {
    return Response.json(
      { error: 'Размер файла превышает 10 МБ.' },
      { status: 400 }
    )
  }

  const arrayBuffer = await imageField.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    systemInstruction: VENEMAK_SYSTEM_PROMPT,
  })

  try {
    const result = await model.generateContent([
      questionField.trim(),
      { inlineData: { data: base64, mimeType: imageField.type } },
    ])

    const answer = result.response.text()
    if (!answer) {
      return Response.json({ error: 'Пустой ответ от AI. Попробуйте ещё раз.' }, { status: 500 })
    }

    return Response.json({ answer })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return Response.json({ error: `Ошибка при обращении к AI: ${message}` }, { status: 500 })
  }
}
