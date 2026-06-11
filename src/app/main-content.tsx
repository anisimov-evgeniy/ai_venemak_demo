'use client'

import { useState, useRef, useEffect } from 'react'
import type { AnalyzeResponse, AnalyzeError } from '@/types'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_SIZE = 10 * 1024 * 1024

const LS_QUESTION = 'venemak_question'
const LS_ANSWER = 'venemak_answer'

export default function MainContent() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [isChecked, setIsChecked] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [answer, setAnswer] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const savedQuestion = localStorage.getItem(LS_QUESTION)
    const savedAnswer = localStorage.getItem(LS_ANSWER)
    if (savedQuestion) setQuestion(savedQuestion)
    if (savedAnswer) setAnswer(savedAnswer)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    if (!ALLOWED_TYPES.has(selected.type)) {
      setError('Недопустимый формат. Разрешены: JPG, PNG, WEBP.')
      return
    }
    if (selected.size > MAX_SIZE) {
      setError('Размер файла превышает 10 МБ.')
      return
    }

    if (preview) URL.revokeObjectURL(preview)
    setError(null)
    setAnswer(null)
    localStorage.removeItem(LS_ANSWER)
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
  }

  const handleAnalyze = async () => {
    if (!question.trim() || isLoading || (file && !isChecked)) return

    setIsLoading(true)
    setError(null)
    setAnswer(null)

    const formData = new FormData()
    if (file) formData.append('image', file)
    formData.append('question', question.trim())

    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: formData })
      const data = (await res.json()) as AnalyzeResponse | AnalyzeError

      if (!res.ok) {
        setError((data as AnalyzeError).error ?? 'Произошла ошибка при анализе.')
      } else {
        const text = (data as AnalyzeResponse).answer
        setAnswer(text)
        localStorage.setItem(LS_ANSWER, text)
      }
    } catch {
      setError('Не удалось отправить запрос. Проверьте подключение к сети.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!answer) return
    await navigator.clipboard.writeText(answer)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClear = () => {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null)
    setPreview(null)
    setQuestion('')
    setIsChecked(false)
    setAnswer(null)
    setError(null)
    localStorage.removeItem(LS_QUESTION)
    localStorage.removeItem(LS_ANSWER)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const canSubmit = question.trim().length > 0 && !isLoading && (!file || isChecked)

  const hint =
    !question.trim()
      ? 'Введите вопрос'
      : file && !isChecked
        ? 'Подтвердите обезличивание изображения'
        : null

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-blue-700 flex items-center justify-center shadow-sm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 3v18M3 12h18" stroke="white" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight tracking-tight">ВЕНЕМАК</h1>
              <p className="text-sm text-slate-500 leading-tight">
                AI-ассистент для предварительного анализа медицинских изображений
              </p>
            </div>
            <div className="ml-auto hidden sm:block">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                Демо-версия
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Warning banner */}
        <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <svg
            className="flex-shrink-0 w-5 h-5 text-amber-600 mt-0.5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-900">Демо-версия. Важное уведомление</p>
            <p className="text-sm text-amber-800 mt-0.5">
              Не загружайте персональные данные пациентов. Используйте только обезличенные изображения.
              Результат не является медицинским заключением.
            </p>
          </div>
        </div>

        {/* Upload card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              Медицинское изображение <span className="text-slate-400 normal-case font-normal tracking-normal">· необязательно</span>
            </h2>
          </div>
          <div className="p-6 space-y-5">
            {/* Anonymization checkbox */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex-shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => setIsChecked(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    isChecked
                      ? 'bg-blue-700 border-blue-700'
                      : 'bg-white border-slate-300 group-hover:border-blue-400'
                  }`}
                >
                  {isChecked && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path
                        d="M1 4L3.5 6.5L9 1"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm text-slate-700 leading-snug">
                Я подтверждаю, что изображение обезличено и не содержит персональных данных пациента
              </span>
            </label>

            {/* File upload zone */}
            <div>
              <input
                type="file"
                id="file-upload"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".jpg,.jpeg,.png,.webp"
                className="sr-only"
                disabled={!isChecked}
              />
              <label
                htmlFor="file-upload"
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-8 px-4 transition-all ${
                  !isChecked
                    ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                    : file
                      ? 'border-teal-300 bg-teal-50 cursor-pointer hover:bg-teal-100'
                      : 'border-blue-300 bg-blue-50 cursor-pointer hover:bg-blue-100 hover:border-blue-400'
                }`}
              >
                {file ? (
                  <div className="flex items-center gap-2 text-teal-700">
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm font-medium truncate max-w-xs">{file.name}</span>
                    <span className="text-xs text-teal-600 flex-shrink-0">
                      ({(file.size / 1024 / 1024).toFixed(2)} МБ)
                    </span>
                  </div>
                ) : (
                  <>
                    <svg
                      className="w-10 h-10 text-blue-400 mb-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                      />
                    </svg>
                    <p className="text-sm font-medium text-blue-700">Нажмите для выбора изображения</p>
                    <p className="text-xs text-slate-500 mt-1">JPG, PNG, WEBP · до 10 МБ</p>
                  </>
                )}
              </label>
            </div>

            {/* Preview */}
            {preview && (
              <div className="rounded-xl overflow-hidden border border-slate-200">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Предпросмотр</span>
                  <span className="text-xs text-slate-400">Только для проверки — не сохраняется</span>
                </div>
                <div className="bg-slate-900 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt="Предпросмотр загруженного изображения"
                    className="max-h-80 w-full object-contain"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Question card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              Клинический вопрос
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <textarea
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value)
                localStorage.setItem(LS_QUESTION, e.target.value)
              }}
              placeholder="Задайте клинический вопрос или опишите, что вас интересует. Изображение можно приложить по желанию: видимые изменения, подозрительные области, характеристики структуры и другие клинически значимые наблюдения..."
              rows={4}
              disabled={isLoading}
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-slate-50 disabled:cursor-not-allowed transition-colors"
            />

            {error && (
              <div className="flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <svg
                  className="flex-shrink-0 w-4 h-4 text-red-500 mt-0.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              {hint && !isLoading ? (
                <p className="text-xs text-slate-400">· {hint}</p>
              ) : (
                <span />
              )}
              <button
                onClick={handleAnalyze}
                disabled={!canSubmit}
                className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all flex-shrink-0 ${
                  canSubmit
                    ? 'bg-blue-700 text-white hover:bg-blue-800 shadow-sm hover:shadow active:scale-95'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Анализируется...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Проанализировать
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Result card */}
        {answer && (
          <div className="bg-white rounded-xl border border-teal-200 shadow-sm">
            <div className="px-6 py-4 border-b border-teal-100 bg-teal-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-teal-500" />
                  <h2 className="text-xs font-semibold text-teal-700 uppercase tracking-widest">
                    Анализ ВЕНЕМАК
                  </h2>
                </div>
                <span className="text-xs text-teal-600 bg-teal-100 border border-teal-200 px-2.5 py-0.5 rounded-full">
                  Предварительный анализ
                </span>
              </div>
            </div>
            <div className="p-6">
              <pre className="whitespace-pre-wrap text-sm text-slate-800 font-sans leading-relaxed">
                {answer}
              </pre>
              <div className="mt-6 pt-4 border-t border-slate-100 flex gap-3 justify-end">
                <button
                  onClick={handleCopy}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                    copied
                      ? 'bg-teal-50 border-teal-300 text-teal-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Скопировано
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                        <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                      </svg>
                      Скопировать ответ
                    </>
                  )}
                </button>
                <button
                  onClick={handleClear}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all"
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Очистить
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="text-center pb-8">
          <p className="text-xs text-slate-400">
            ВЕНЕМАК · Демонстрационная версия · Только для профессионального медицинского использования
          </p>
        </div>
      </main>
    </div>
  )
}
