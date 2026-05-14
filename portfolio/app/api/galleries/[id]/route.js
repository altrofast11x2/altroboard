import { getGallery, deleteGallery, isMember } from '@/lib/galleries'
import { cleanId, safeJson } from '@/lib/security'
import { verifyActor } from '@/lib/authz'
import { roleAtLeast } from '@/lib/roles'

export async function GET(_req, { params }) {
  const { id: raw } = await params
  const id = cleanId(raw)
  if (!id) return Response.json({ error: '잘못된 ID' }, { status: 400 })
  const g = await getGallery(id)
  if (!g) return Response.json({ error: '없는 갤러리' }, { status: 404 })
  const { searchParams } = new URL(_req.url)
  const checkUserId = cleanId(searchParams.get('userId'))
  if (checkUserId) {
    const member = await isMember(id, checkUserId)
    return Response.json({ ...g, isMember: member })
  }
  return Response.json(g)
}

export async function DELETE(req, { params }) {
  const { id: raw } = await params
  const id = cleanId(raw)
  if (!id) return Response.json({ error: '잘못된 ID' }, { status: 400 })

  const body = await safeJson(req).catch(() => ({})) || {}
  const userId = cleanId(body.userId)
  const actor = userId ? await verifyActor(userId) : null
  const isStaff = !!actor && roleAtLeast(actor.role, 'admin')

  const g = await getGallery(id)
  if (!g) return Response.json({ error: '없는 갤러리' }, { status: 404 })
  if (!isStaff && g.ownerId !== userId)
    return Response.json({ error: '삭제 권한이 없습니다' }, { status: 403 })

  await deleteGallery(id)
  return Response.json({ ok: true })
}
