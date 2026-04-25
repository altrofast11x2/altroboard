import { findUser } from '@/lib/users'
import { rateLimit, getIP } from '@/lib/security'

export async function POST(req) {
  // Rate limiting: IP당 1분에 10회 (로그인 브루트포스 방지)
  const ip = getIP(req)
  if (!rateLimit(`login:${ip}`, 10, 60 * 1000)) {
    return Response.json({ error: '로그인 시도가 너무 많습니다. 1분 후 다시 시도해주세요.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: '잘못된 요청입니다' }, { status: 400 })

  const { id, password } = body
  if (!id || !password) return Response.json({ error: '이메일과 비밀번호를 입력하세요' }, { status: 400 })

  const user = await findUser(id.trim(), password)
  if (!user) return Response.json({ error: '이메일 또는 비밀번호가 틀렸습니다' }, { status: 401 })

  return Response.json({ user })
}
