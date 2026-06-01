import MainContent from './main-content'

interface Props {
  searchParams: Promise<{ token?: string }>
}

export default async function Home({ searchParams }: Props) {
  const params = await searchParams
  const requiredToken = process.env.DEMO_ACCESS_TOKEN

  if (requiredToken && params.token !== requiredToken) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-600" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">Доступ запрещён</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Для доступа к демо-версии необходим действующий токен. Передайте его в параметре URL:
          </p>
          <code className="mt-3 inline-block bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono">
            /?token=ваш_токен
          </code>
        </div>
      </div>
    )
  }

  return <MainContent />
}
