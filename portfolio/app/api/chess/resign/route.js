// 체스 항복 처리 — 일별 5회 초과 시 403 + 부정행위 의심 리포트
//
// GET ?userId=...   → { count, blocked, limit, date } (방 입장 전 확인용)
// POST { userId, userName } → { ok, count, blocked, reported } (실제 항복 시도)
import { verifyActor } from '@/lib/authz'
import { safeJson, cleanId, cleanLine } from '@/lib/security'
import { getTodayResignCount, recordResign, isResignBlocked, RESIGN_LIMIT_PER_DAY, todayKstKey } from '@/lib/chessAbuse'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const userId = cleanId(searchParams.get('userId'))
  if (!userId) return Response.json({ error: 'userId required' }, { status: 400 })
  const status = await isResignBlocked(userId)
  return Response.json({ ...status, limit: RESIGN_LIMIT_PER_DAY, date: todayKstKey() })
}

export async function POST(req) {
  const body = await safeJson(req, { maxBytes: 4 * 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })
  const userId = cleanId(body.userId)
  const userName = cleanLine(body.userName, 24) || userId
  if (!userId) return Response.json({ error: 'userId 누락' }, { status: 400 })

  const actor = await verifyActor(userId)
  if (!actor) return Response.json({ error: '권한 없음' }, { status: 403 })

  // 항복 시도 전에 이미 한도 도달이면 차단 — 카운트 증가 X, 리포트는 한 번만
  const pre = await isResignBlocked(userId)
  if (pre.blocked) {
    return Response.json({
      error: `오늘 항복 횟수가 ${pre.count}회로 한도(${RESIGN_LIMIT_PER_DAY})를 초과했습니다. 자정까지 체스를 이용할 수 없습니다.`,
      count: pre.count, blocked: true, limit: RESIGN_LIMIT_PER_DAY, date: pre.date,
    }, { status: 403 })
  }

  const result = await recordResign(userId, userName)
  return Response.json({ ok: true, ...result, limit: RESIGN_LIMIT_PER_DAY, date: todayKstKey() })
}
