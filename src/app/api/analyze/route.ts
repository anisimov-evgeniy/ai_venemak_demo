import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai'
import { VENEMAK_SYSTEM_PROMPT } from '@/lib/venemakPrompt'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_SIZE = 10 * 1024 * 1024
const DAILY_LIMIT = 100

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

// Эти настройки влияют только на настраиваемые safety-категории Gemini.
// Некоторые внутренние фильтры Google отключить нельзя.
const SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
]

function normalizeAnswer(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .trim()
}

function buildMedicalPrompt(question: string): string {
  return `
[Клинический анализ медицинского изображения]

Контекст:
Пользователь загрузил медицинское изображение и просит помочь с его визуальным анализом.

Правила ответа:
- Не ставь окончательный диагноз.
- Не утверждай, что это точное медицинское заключение.
- Не назначай лечение.
- Не давай инструкций по самостоятельному лечению.
- Описывай только визуально наблюдаемые признаки на изображении.
- Используй осторожные формулировки: "может соответствовать", "визуально похоже", "требует подтверждения врачом".
- В конце укажи, что финальное заключение должен делать врач с учетом анамнеза, жалоб, протокола эндоскопии, биопсии и лабораторных данных.

Структура ответа:
1. Краткое визуальное описание снимка.
2. Видимые патологические признаки.
3. Возможные дифференциальные варианты.
4. Что врачу стоит уточнить/проверить дополнительно.
5. Осторожное предварительное резюме.

Вопрос пользователя:
${question.trim()}
  `.trim()
}

function getSafeResponseText(response: Awaited<ReturnType<any>>): string {
  try {
    return response.text()
  } catch {
    const parts = response.candidates?.[0]?.content?.parts ?? []

    return parts
      .map((part: { text?: string }) => part.text ?? '')
      .join('\n')
      .trim()
  }
}

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json(
      {
        error:
          'Сервис не настроен: отсутствует GEMINI_API_KEY. Обратитесь к администратору.',
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

  if (!(imageField instanceof File)) {
    return Response.json(
      { error: 'Изображение не передано.' },
      { status: 400 }
    )
  }

  if (typeof questionField !== 'string' || !questionField.trim()) {
    return Response.json(
      { error: 'Вопрос не передан.' },
      { status: 400 }
    )
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
    model: 'gemini-2.5-flash',
    systemInstruction: VENEMAK_SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 4096,
    },
  })

  try {
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: buildMedicalPrompt(questionField),
            },
            {
              inlineData: {
                data: base64,
                mimeType: imageField.type,
              },
            },
          ],
        },
      ],
      safetySettings: SAFETY_SETTINGS,
    })

    const { response } = result
    const candidate = response.candidates?.[0]
    const finishReason = candidate?.finishReason

    const debugInfo = {
      promptBlockReason: response.promptFeedback?.blockReason,
      promptSafetyRatings: response.promptFeedback?.safetyRatings,
      finishReason,
      finishMessage: candidate?.finishMessage,
      candidateSafetyRatings: candidate?.safetyRatings,
      usageMetadata: response.usageMetadata,
    }

    console.dir(
      {
        geminiDebug: debugInfo,
      },
      { depth: null }
    )

    if (response.promptFeedback?.blockReason) {
      return Response.json(
        {
          error: 'Запрос заблокирован на уровне входных данных.',
          reason: response.promptFeedback.blockReason,
          safetyRatings: response.promptFeedback.safetyRatings,
        },
        { status: 422 }
      )
    }

    if (finishReason === 'SAFETY') {
      return Response.json(
        {
          error: 'Ответ модели заблокирован safety-фильтром.',
          reason: finishReason,
          finishMessage: candidate?.finishMessage,
          safetyRatings: candidate?.safetyRatings,
        },
        { status: 422 }
      )
    }

    if (finishReason === 'RECITATION') {
      return Response.json(
        {
          error: 'Ответ модели заблокирован из-за риска дословного воспроизведения контента.',
          reason: finishReason,
          finishMessage: candidate?.finishMessage,
        },
        { status: 422 }
      )
    }

    if (finishReason === 'OTHER') {
      return Response.json(
        {
          error:
            'Модель не смогла обработать запрос. Это не обязательно safety-блокировка. Посмотри geminiDebug в логах сервера.',
          reason: finishReason,
          finishMessage: candidate?.finishMessage,
          safetyRatings: candidate?.safetyRatings,
        },
        { status: 422 }
      )
    }

    const rawAnswer = getSafeResponseText(response)
    const answer = normalizeAnswer(rawAnswer)

    if (!answer) {
      return Response.json(
        {
          error: 'Пустой ответ от AI. Посмотри geminiDebug в логах сервера.',
          debug: debugInfo,
        },
        { status: 500 }
      )
    }

    return Response.json({ answer })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'

    console.error('Gemini API error:', err)

    return Response.json(
      {
        error: `Ошибка при обращении к AI: ${message}`,
      },
      { status: 500 }
    )
  }
}
