import { findUser } from '@/lib/users'

export async function POST(req) {
  const { id, password } = await req.json()
  if (!id || !password) return Response.json({ error: '아이디와 비밀번호를 입력하세요' }, { status: 400 })
  const user = findUser(id, password)
  if (!user) return Response.json({ error: '아이디 또는 비밀번호가 틀렸습니다' }, { status: 401 })
  return Response.json({ user })
}
