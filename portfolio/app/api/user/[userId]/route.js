import { getUserById, updateUser } from '@/lib/users'
import { put } from '@vercel/blob'
import { cleanId, cleanLine, cleanText, cleanEnum, cleanUrl, safeJson } from '@/lib/security'
import { verifyActor } from '@/lib/authz'

export async function GET(request, { params }) {
  const { userId: raw } = await params
  const userId = cleanId(raw)
  if (!userId) return Response.json({ error: '잘못된 ID' }, { status: 400 })
  const user = await getUserById(userId)
  if (!user) return Response.json({ error: '사용자를 찾을 수 없습니다' }, { status: 404 })
  const { password: _, ...safe } = user
  return Response.json(safe)
}

export async function PATCH(request, { params }) {
  const { userId: raw } = await params
  const userId = cleanId(raw)
  if (!userId) return Response.json({ error: '잘못된 ID' }, { status: 400 })
  const contentType = request.headers.get('content-type') || ''

  // ── 아바타 업로드 ──
  if (contentType.includes('multipart/form-data')) {
    const formData  = await request.formData()
    const file      = formData.get('file')
    const reqUserId = cleanId(formData.get('userId'))

    if (reqUserId !== userId)
      return Response.json({ error: '권한이 없습니다' }, { status: 403 })
    const actor = await verifyActor(reqUserId)
    if (!actor) return Response.json({ error: '권한이 없습니다' }, { status: 403 })
    if (!file || typeof file === 'string')
      return Response.json({ error: '파일이 없습니다' }, { status: 400 })

    const ext = (file.name || '').split('.').pop().toLowerCase()
    if (!['jpg','jpeg','png','gif','webp'].includes(ext))
      return Response.json({ error: '이미지 파일만 가능합니다' }, { status: 400 })
    if (file.size > 3 * 1024 * 1024)
      return Response.json({ error: '3MB 이하만 업로드 가능합니다' }, { status: 400 })

    const filename = `avatars/${userId}_${Date.now()}.${ext}`
    const blob = await put(filename, file, { access: 'public', token: process.env.MYBOARD_READ_WRITE_TOKEN })
    await updateUser(userId, { avatar: blob.url })
    return Response.json({ avatar: blob.url })
  }

  // ── 텍스트 필드 수정 ──
  const body = await safeJson(request, { maxBytes: 64 * 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })

  const reqUserId = cleanId(body.userId)
  if (reqUserId !== userId)
    return Response.json({ error: '권한이 없습니다' }, { status: 403 })
  const actor = await verifyActor(reqUserId)
  if (!actor) return Response.json({ error: '권한이 없습니다' }, { status: 403 })

  const updates = {}
  if (body.name !== undefined)        updates.name = cleanLine(body.name, 24)
  if (body.bio !== undefined)         updates.bio  = cleanText(body.bio, 200)
  if (body.profileMusic !== undefined) {
    // { url, title, source? }
    if (body.profileMusic === null) updates.profileMusic = null
    else if (typeof body.profileMusic === 'object') {
      const url = cleanUrl(body.profileMusic.url)
      const title = cleanLine(body.profileMusic.title, 80)
      const source = cleanLine(body.profileMusic.source, 20)
      if (url) updates.profileMusic = { url, title: title || '', source: source || '' }
    }
  }
  if (body.language !== undefined) updates.language = cleanEnum(body.language, ['ko', 'en', 'ja'], 'en')
  if (body.theme    !== undefined) updates.theme    = cleanEnum(body.theme, ['light', 'dark', 'auto'], 'light')

  await updateUser(userId, updates)
  const fresh = await getUserById(userId)
  const { password: _, ...safe } = (fresh || {})
  return Response.json(safe)
}
