import { put } from '@vercel/blob'

export const maxDuration = 300  // 5분 타임아웃

export async function POST(req) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')

    if (!file) return Response.json({ error: 'No file' }, { status: 400 })

    const ext = (file.name || '').split('.').pop().toLowerCase()
    if (!['mp4', 'mov', 'webm', 'avi'].includes(ext))
      return Response.json({ error: 'mp4, mov, webm files only' }, { status: 400 })

    // 크기 제한 없음
    const filename = `shorts/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const blob = await put(filename, file.stream(), {
      access: 'public',
      token: process.env.MYBOARD_READ_WRITE_TOKEN,
      contentType: file.type || `video/${ext}`,
    })

    return Response.json({ url: blob.url })
  } catch (e) {
    console.error('upload-video error:', e)
    return Response.json({ error: e.message || 'Upload failed' }, { status: 500 })
  }
}
