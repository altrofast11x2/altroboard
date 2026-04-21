import { put } from '@vercel/blob'

export async function POST(req) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file) return Response.json({ error: 'No file' }, { status: 400 })

    const ext = (file.name || '').split('.').pop().toLowerCase()
    if (!['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext))
      return Response.json({ error: 'Only mp3/wav/ogg files allowed' }, { status: 400 })
    if (file.size > 10 * 1024 * 1024)
      return Response.json({ error: 'Max 10MB audio file' }, { status: 400 })

    const filename = `audio/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const blob = await put(filename, file.stream(), {
      access: 'public',
      token: process.env.MYBOARD_READ_WRITE_TOKEN,
      contentType: file.type || `audio/${ext}`,
    })
    return Response.json({ url: blob.url })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
