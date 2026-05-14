import { changePassword } from '@/lib/users'
import { safeJson, cleanId, validatePassword, getClientIp, rateLimit } from '@/lib/security'
import { verifyActor } from '@/lib/authz'

export async function POST(req) {
  if (!rateLimit(`change-pw:${getClientIp(req)}`, { windowMs: 60_000, max: 5 }))
    return Response.json({ error: '잠시 후 다시 시도하세요' }, { status: 429 })

  const body = await safeJson(req, { maxBytes: 4 * 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })

  const uid = cleanId(body.uid)
  const current = typeof body.currentPassword === 'string' ? body.currentPassword : ''
  const next = typeof body.newPassword === 'string' ? body.newPassword : ''
  if (!uid || !current || !next) return Response.json({ error: '필수 정보 누락' }, { status: 400 })

  const actor = await verifyActor(uid)
  if (!actor) return Response.json({ error: '권한 없음' }, { status: 403 })

  const pwErr = validatePassword(next)
  if (pwErr) return Response.json({ error: pwErr }, { status: 400 })

  const r = await changePassword(uid, current, next)
  if (r.error) return Response.json(r, { status: 400 })
  return Response.json(r)
}
