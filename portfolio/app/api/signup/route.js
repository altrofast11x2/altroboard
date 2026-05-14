import { findByEmail, createUser } from '@/lib/users'
import {
  safeJson, cleanEmail, cleanDisplayName, validatePassword,
  getClientIp, rateLimit,
} from '@/lib/security'

export async function POST(req) {
  if (!rateLimit(`signup:${getClientIp(req)}`, { windowMs: 60_000, max: 5 }))
    return Response.json({ error: '잠시 후 다시 시도하세요' }, { status: 429 })

  const body = await safeJson(req, { maxBytes: 4 * 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })

  const name = cleanDisplayName(body.name)
  const email = cleanEmail(body.email)
  const password = typeof body.password === 'string' ? body.password : ''
  if (!name || !email || !password) return Response.json({ error: '모든 항목을 입력하세요' }, { status: 400 })

  const pwErr = validatePassword(password)
  if (pwErr) return Response.json({ error: pwErr }, { status: 400 })

  const existing = await findByEmail(email)
  if (existing) return Response.json({ error: '이미 사용 중인 이메일입니다' }, { status: 409 })

  const user = await createUser(name, email, password)
  return Response.json({ user }, { status: 201 })
}
