import { put } from '@vercel/blob'

export async function POST(req) {
  const formData = await req.formData()
  const file = formData.get('file')
  if (!file) return Response.json({ error: '파일이 없습니다' }, { status: 400 })

  const ext = file.name.split('.').pop().toLowerCase()
  const allowed = ['jpg','jpeg','png','gif','webp']
  if (!allowed.includes(ext)) return Response.json({ error: '이미지 파일만 업로드 가능합니다' }, { status: 400 })

  if (file.size > 5 * 1024 * 1024) return Response.json({ error: '5MB 이하만 업로드 가능합니다' }, { status: 400 })

  const filename = `board/${Date.now()}.${ext}`
  const blob = await put(filename, file, { access: 'public' })
  return Response.json({ url: blob.url })
}
