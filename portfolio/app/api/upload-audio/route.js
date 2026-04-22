import { put } from '@vercel/blob'

export const maxDuration = 60

export async function POST(req) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file) return Response.json({ error: '파일이 없습니다' }, { status: 400 })

    const ext = (file.name || '').split('.').pop().toLowerCase()
    if (!['mp3','wav','ogg','m4a','aac'].includes(ext))
      return Response.json({ error: 'mp3/wav/ogg 파일만 가능합니다' }, { status: 400 })
    if (file.size > 15 * 1024 * 1024)
      return Response.json({ error: '15MB 이하 오디오만 가능합니다' }, { status: 400 })

    const filename = `audio/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const blob = await put(filename, file.stream(), {
      access: 'public',
      token: process.env.MYBOARD_READ_WRITE_TOKEN,
      contentType: file.type || `audio/${ext}`,
    })
    return Response.json({ url: blob.url, name: file.name })
  } catch (e) {
    return Response.json({ error: e.message || '업로드 실패' }, { status: 500 })
  }
}
