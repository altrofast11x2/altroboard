// 관리자: 부정행위 의심 리포트 목록 + 처리
//
// GET ?actorId=...           → 목록 (admin 이상)
// PATCH { actorId, id, resolved } → 해결/미해결 토글
import { requireRole } from '@/lib/authz'
import { safeJson, cleanId } from '@/lib/security'
import { getCheatReports, resolveCheatReport } from '@/lib/chessAbuse'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const actorId = cleanId(searchParams.get('actorId'))
  const actor = await requireRole(actorId, 'admin')
  if (!actor) return Response.json({ error: '권한 없음' }, { status: 403 })
  const list = await getCheatReports()
  return Response.json(list)
}

export async function PATCH(req) {
  const body = await safeJson(req, { maxBytes: 4 * 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })
  const actorId = cleanId(body.actorId)
  const id = cleanId(body.id)
  const actor = await requireRole(actorId, 'admin')
  if (!actor) return Response.json({ error: '권한 없음' }, { status: 403 })
  if (!id) return Response.json({ error: 'id 누락' }, { status: 400 })
  await resolveCheatReport(id, !!body.resolved)
  return Response.json({ ok: true })
}
