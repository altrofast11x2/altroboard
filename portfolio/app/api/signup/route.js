import { findByEmail, createUser } from '@/lib/users'

export async function POST(req) {
  const { name, email, password } = await req.json()
  if (!name || !email || !password) return Response.json({ error: '모든 항목을 입력하세요' }, { status: 400 })
  if (password.length < 6) return Response.json({ error: '비밀번호는 6자 이상이어야 합니다' }, { status: 400 })
  if (findByEmail(email)) return Response.json({ error: '이미 사용 중인 이메일입니다' }, { status: 409 })
  const user = createUser(name, email, password)
  return Response.json({ user }, { status: 201 })
}
