// Verified user 신청 라우트
// GET  ?userId=xxx           → 본인의 가장 최근 신청 (없으면 null)
// GET  ?actorId=xxx&list=1   → 관리자 목록 (?status=pending|approved|rejected|all)
// POST body { userId, reason, links }                       → 신청 생성
// POST body { actorId, requestId, action:'approve'|'reject', note }  → 관리자 검토
// POST body { actorId, action:'revoke', userId }            → 인증 회수

import { createVerifyRequest, listVerifyRequests, getMyVerifyRequest, reviewVerifyRequest, revokeVerified } from '@/lib/verifyRequests'
import { safeJson, cleanId, cleanText, cleanLine, cleanEnum, getClientIp, rateLimit } from '@/lib/security'
import { verifyActor, requireRole } from '@/lib/authz'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const list = searchParams.get('list')
  if (list) {
    const actorId = cleanId(searchParams.get('actorId'))
    const actor = await requireRole(actorId, 'admin')
    if (!actor) return Response.json({ error: '권한 없음' }, { status: 403 })
    const status = cleanEnum(searchParams.get('status'), ['pending','approved','rejected','all'], 'pending')
    const items = await listVerifyRequests({ status: status === 'all' ? null : status })
    return Response.json(items)
  }
  const userId = cleanId(searchParams.get('userId'))
  if (!userId) return Response.json({ error: 'userId 필요' }, { status: 400 })
  const r = await getMyVerifyRequest(userId)
  return Response.json(r)
}

export async function POST(req) {
  if (!rateLimit(`verify:${getClientIp(req)}`, { windowMs: 60_000, max: 5 }))
    return Response.json({ error: '잠시 후 다시 시도하세요' }, { status: 429 })

  const body = await safeJson(req, { maxBytes: 16 * 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })

  // 관리자 액션
  if (body.action === 'approve' || body.action === 'reject') {
    const actorId = cleanId(body.actorId)
    const actor = await requireRole(actorId, 'admin')
    if (!actor) return Response.json({ error: '권한 없음' }, { status: 403 })
    const requestId = cleanId(body.requestId)
    if (!requestId) return Response.json({ error: '신청 ID 누락' }, { status: 400 })
    const status = body.action === 'approve' ? 'approved' : 'rejected'
    const note = cleanLine(body.note, 200)
    const r = await reviewVerifyRequest(requestId, { status, reviewerId: actorId, note })
    if (r.error) return Response.json(r, { status: 400 })
    return Response.json(r)
  }

  if (body.action === 'revoke') {
    const actorId = cleanId(body.actorId)
    const actor = await requireRole(actorId, 'admin')
    if (!actor) return Response.json({ error: '권한 없음' }, { status: 403 })
    const userId = cleanId(body.userId)
    if (!userId) return Response.json({ error: '사용자 ID 누락' }, { status: 400 })
    const r = await revokeVerified(userId)
    return Response.json(r)
  }

  // 본인 신청
  const userId = cleanId(body.userId)
  if (!userId) return Response.json({ error: 'userId 필요' }, { status: 400 })
  const actor = await verifyActor(userId)
  if (!actor) return Response.json({ error: '권한 없음' }, { status: 403 })

  const reason = cleanText(body.reason, 500)
  const links = cleanText(body.links, 500)
  if (!reason) return Response.json({ error: '신청 사유를 입력하세요' }, { status: 400 })

  const r = await createVerifyRequest({
    userId, userName: actor.name, userEmail: actor.email,
    reason, links,
  })
  if (r.error) return Response.json(r, { status: 400 })
  return Response.json(r, { status: 201 })
}
