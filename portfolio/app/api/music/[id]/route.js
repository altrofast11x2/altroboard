// 단일 음악 — 검토 / 삭제
//
// PATCH { actorId, status: 'approved'|'rejected', reviewerNote? } → 관리자 검토 (admin 이상)
// DELETE { actorId } → 본인 또는 admin 이상

import { getMusic, reviewMusic, deleteMusic } from '@/lib/music'
import { verifyActor, requireRole } from '@/lib/authz'
import { safeJson, cleanId, cleanText } from '@/lib/security'

export async function PATCH(req, { params }) {
  const { id } = await params
  const body = await safeJson(req, { maxBytes: 4 * 1024 })
  if (!body) return Response.json({ error: '잘못된 요청' }, { status: 400 })
  const actorId = cleanId(body.actorId)
  const actor = await requireRole(actorId, 'admin')
  if (!actor) return Response.json({ error: '권한 없음' }, { status: 403 })

  const status = body.status
  if (!['approved','rejected'].includes(status))
    return Response.json({ error: '잘못된 상태' }, { status: 400 })

  const r = await reviewMusic(id, { status, reviewerId: actorId, reviewerNote: cleanText(body.reviewerNote, 300) })
  if (r.error) return Response.json(r, { status: 400 })
  return Response.json({ ok: true })
}

export async function DELETE(req, { params }) {
  const { id } = await params
  const body = await safeJson(req, { maxBytes: 2 * 1024 })
  if (!body) return Response.json({ error: '잘못된 요청' }, { status: 400 })
  const actorId = cleanId(body.actorId)
  const actor = await verifyActor(actorId)
  if (!actor) return Response.json({ error: '권한 없음' }, { status: 403 })

  const music = await getMusic(id)
  if (!music) return Response.json({ error: '없는 음악' }, { status: 404 })

  const isStaff = ['owner','admin'].includes(actor.role)
  if (!isStaff && music.uploaderId !== actorId)
    return Response.json({ error: '삭제 권한이 없습니다' }, { status: 403 })

  await deleteMusic(id)
  return Response.json({ ok: true })
}
