// 신고 생성/조회
// POST /api/reports — 사용자가 신고 생성
// GET  /api/reports?actorId=...&status=pending — 관리자 목록 조회

import { createReport, listReports, REPORT_REASONS } from '@/lib/reports'
import { requireRole, verifyActor } from '@/lib/authz'
import {
  safeJson, cleanId, cleanLine, cleanText, cleanEnum, cleanUrl,
  getClientIp, rateLimit,
} from '@/lib/security'

const TYPES = ['post', 'gallery_post', 'short', 'comment', 'user', 'story']

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const actorId = cleanId(searchParams.get('actorId'))
  const actor = await requireRole(actorId, 'admin')
  if (!actor) return Response.json({ error: '권한 없음' }, { status: 403 })

  const status = cleanEnum(searchParams.get('status'), ['pending', 'resolved', 'rejected', 'all'], 'pending')
  const items = await listReports({ status: status === 'all' ? null : status })
  return Response.json(items)
}

export async function POST(req) {
  if (!rateLimit(`report:${getClientIp(req)}`, { windowMs: 60_000, max: 10 }))
    return Response.json({ error: '잠시 후 다시 시도하세요' }, { status: 429 })

  const body = await safeJson(req, { maxBytes: 16 * 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })

  const reporterId = cleanId(body.reporterId)
  const actor = await verifyActor(reporterId)
  if (!actor) return Response.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const type = cleanEnum(body.type, TYPES)
  const targetId = cleanId(body.targetId)
  const reason = cleanLine(body.reason, 60)
  const description = cleanText(body.description, 500)
  const targetUrl = body.targetUrl ? cleanUrl(body.targetUrl) : null
  const targetAuthorId = body.targetAuthorId ? cleanId(body.targetAuthorId) : null
  const targetAuthorName = cleanLine(body.targetAuthorName, 32)
  const reporterName = cleanLine(body.reporterName, 32) || '익명'

  if (!type || !targetId || !reason)
    return Response.json({ error: '필수 정보 누락' }, { status: 400 })
  if (!REPORT_REASONS.includes(reason))
    return Response.json({ error: '유효하지 않은 사유' }, { status: 400 })

  const r = await createReport({
    type, targetId, targetUrl,
    reporterId: actor.id, reporterName,
    targetAuthorId, targetAuthorName,
    reason, description,
  })
  return Response.json(r, { status: 201 })
}
