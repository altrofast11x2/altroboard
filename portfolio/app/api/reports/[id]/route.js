// 신고 처리 (관리자 전용)
// POST /api/reports/[id] body { actorId, status, note }
import { resolveReport } from '@/lib/reports'
import { requireRole } from '@/lib/authz'
import { safeJson, cleanId, cleanEnum, cleanLine } from '@/lib/security'

export async function POST(req, { params }) {
  const { id: raw } = await params
  const reportId = cleanId(raw)
  if (!reportId) return Response.json({ error: '잘못된 ID' }, { status: 400 })

  const body = await safeJson(req, { maxBytes: 4 * 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })

  const actorId = cleanId(body.actorId)
  const actor = await requireRole(actorId, 'admin')
  if (!actor) return Response.json({ error: '권한 없음' }, { status: 403 })

  const status = cleanEnum(body.status, ['resolved', 'rejected'])
  if (!status) return Response.json({ error: '잘못된 상태' }, { status: 400 })

  const note = cleanLine(body.note, 200)
  const r = await resolveReport(reportId, { resolvedBy: actor.id, status, note })
  if (r.error) return Response.json(r, { status: 400 })
  return Response.json(r)
}
