export async function GET() {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: 'GEMINI_API_KEY не задан' }, { status: 500 })
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
  )
  const data = await res.json()

  return Response.json(data, { status: res.status })
}
