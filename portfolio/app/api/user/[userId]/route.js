import { getUserById, updateUser } from '@/lib/users'
import { put } from '@vercel/blob'

export async function GET(request, { params }) {
  const { userId } = await params
  const user = await getUserById(userId)
  if (!user) return Response.json({ error: '사용자를 찾을 수 없습니다' }, { status: 404 })
  // Never expose password
  const { password: _, ...safe } = user
  return Response.json(safe)
}

export async function PATCH(request, { params }) {
  const { userId } = await params

  const contentType = request.headers.get('content-type') || ''

  // ── Avatar upload (multipart) ──────────────────────────────
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const file     = formData.get('file')
    const reqUserId = formData.get('userId')

    if (reqUserId !== userId)
      return Response.json({ error: '권한이 없습니다' }, { status: 403 })
    if (!file)
      return Response.json({ error: '파일이 없습니다' }, { status: 400 })

    const ext = file.name.split('.').pop().toLowerCase()
    if (!['jpg','jpeg','png','gif','webp'].includes(ext))
      return Response.json({ error: '이미지 파일만 업로드 가능합니다' }, { status: 400 })
    if (file.size > 3 * 1024 * 1024)
      return Response.json({ error: '3MB 이하 이미지만 업로드 가능합니다' }, { status: 400 })

    const blob = await put(`avatars/${userId}.${ext}`, file, { access: 'public', allowOverwrite: true })
    const updated = await updateUser(userId, { avatar: blob.url })
    return Response.json({ avatar: blob.url, user: updated })
  }

  // ── Text fields (JSON) ────────────────────────────────────
  const { userId: reqUserId, name, bio } = await request.json()
  if (reqUserId !== userId)
    return Response.json({ error: '권한이 없습니다' }, { status: 403 })

  const updates = {}
  if (name !== undefined) updates.name = name.trim().slice(0, 30)
  if (bio  !== undefined) updates.bio  = bio.trim().slice(0, 150)

  const updated = await updateUser(userId, updates)
  return Response.json(updated)
}
