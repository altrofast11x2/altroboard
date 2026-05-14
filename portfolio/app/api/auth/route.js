import { findUser } from '@/lib/users'
import { safeJson, cleanEmail, getClientIp, rateLimit } from '@/lib/security'

export async function POST(req) {
  if (!rateLimit(`auth:${getClientIp(req)}`, { windowMs: 60_000, max: 8 }))
    return Response.json({ error: '잠시 후 다시 시도하세요' }, { status: 429 })

  const body = await safeJson(req, { maxBytes: 4 * 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })

  const id = cleanEmail(body.id) || (typeof body.id === 'string' ? body.id.trim().toLowerCase().slice(0, 64) : null)
  const password = typeof body.password === 'string' ? body.password : null
  if (!id || !password) return Response.json({ error: '아이디와 비밀번호를 입력하세요' }, { status: 400 })
  if (password.length > 128) return Response.json({ error: '비밀번호가 너무 깁니다' }, { status: 400 })

  const result = await findUser(id, password)
  if (!result) return Response.json({ error: '아이디 또는 비밀번호가 틀렸습니다' }, { status: 401 })

  if (result.ok === false) {
    if (result.status === 'suspended') {
      return Response.json({
        error: '이용이 정지된 계정입니다. 관리자에게 문의해주세요.',
        suspended: true,
        reason: result.reason || '',
      }, { status: 403 })
    }
    if (result.status === 'pending_deletion') {
      // 클라이언트에서 재활성화 확인 후 /api/account/reactivate 호출
      return Response.json({
        pendingDeletion: true,
        deletionScheduledAt: result.deletionScheduledAt,
        uid: result.uid,
        name: result.name,
        email: result.email,
      }, { status: 202 })
    }
    return Response.json({ error: '로그인에 실패했습니다' }, { status: 401 })
  }

  return Response.json({ user: result.user })
}
