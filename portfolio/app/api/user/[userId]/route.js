import { getUserById, updateUser } from '@/lib/users'

export async function GET(request, { params }) {
  const { userId } = await params
  const user = await getUserById(userId)
  if (!user) return Response.json({ error: '사용자를 찾을 수 없습니다' }, { status: 404 })
  const { password: _, ...safe } = user
  return Response.json(safe)
}

export async function PATCH(request, { params }) {
  const { userId } = await params
  const contentType = request.headers.get('content-type') || ''

  // ── 아바타 업로드 (multipart) ──
  if (contentType.includes('multipart/form-data')) {
    const formData  = await request.formData()
    const file      = formData.get('file')
    const reqUserId = formData.get('userId')

    if (String(reqUserId) !== String(userId))
      return Response.json({ error: '권한이 없습니다' }, { status: 403 })
    if (!file)
      return Response.json({ error: '파일이 없습니다' }, { status: 400 })

    const ext = (file.name || '').split('.').pop().toLowerCase()
    if (!['jpg','jpeg','png','gif','webp'].includes(ext))
      return Response.json({ error: '이미지 파일만 가능합니다' }, { status: 400 })
    if (file.size > 3 * 1024 * 1024)
      return Response.json({ error: '3MB 이하만 업로드 가능합니다' }, { status: 400 })

    // base64로 변환 후 Firebase에 저장 (Vercel Blob 불필요)
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`
    const dataUrl = `data:${mimeType};base64,${base64}`

    await updateUser(userId, { avatar: dataUrl })
    return Response.json({ avatar: dataUrl })
  }

  // ── 텍스트 필드 수정 (JSON) ──
  const body = await request.json()
  const { userId: reqUserId, name, bio } = body

  if (String(reqUserId) !== String(userId))
    return Response.json({ error: '권한이 없습니다' }, { status: 403 })

  const updates = {}
  if (name !== undefined) updates.name = String(name).trim().slice(0, 30)
  if (bio  !== undefined) updates.bio  = String(bio).trim().slice(0, 150)

  if (Object.keys(updates).length === 0)
    return Response.json({ error: '변경할 내용이 없습니다' }, { status: 400 })

  await updateUser(userId, updates)
  const fresh = await getUserById(userId)
  if (!fresh) return Response.json({ error: '저장 후 조회 실패' }, { status: 500 })
  const { password: _, ...safe } = fresh
  return Response.json(safe)
}
