import { put } from '@vercel/blob'

export async function POST(req) {
  const formData = await req.formData()
  const file     = formData.get('file')
  if (!file) return Response.json({ error: '파일이 없습니다' }, { status: 400 })

  const ext     = (file.name || '').split('.').pop().toLowerCase()
  const allowed = ['mp4', 'mov', 'webm', 'avi']
  if (!allowed.includes(ext))
    return Response.json({ error: 'mp4, mov, webm 파일만 업로드 가능합니다' }, { status: 400 })

  if (file.size > 50 * 1024 * 1024)
    return Response.json({ error: '50MB 이하 영상만 업로드 가능합니다' }, { status: 400 })

  const filename = `shorts/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const blob     = await put(filename, file, { access: 'public' })
  return Response.json({ url: blob.url })
}
