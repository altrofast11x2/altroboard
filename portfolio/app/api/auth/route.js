import { findUser } from '@/lib/users'

export async function POST(req) {
  const { email, password } = await req.json()
  if (!email || !password) return Response.json({ error: '이메일과 비밀번호를 입력하세요' }, { status: 400 })
  const user = await findUser(email, password)
  if (!user) return Response.json({ error: '이메일 또는 비밀번호가 틀렸습니다' }, { status: 401 })
  return Response.json({ user })
}
