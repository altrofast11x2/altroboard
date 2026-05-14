// 본인 계정 삭제 예약 — 비밀번호 확인 후 1주일 유예
import { scheduleDeletion } from '@/lib/users'
import { safeJson, cleanId } from '@/lib/security'
import { verifyActor } from '@/lib/authz'

export async function POST(req) {
  const body = await safeJson(req, { maxBytes: 4 * 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })

  const uid = cleanId(body.uid)
  const password = typeof body.password === 'string' ? body.password : ''
  if (!uid || !password) return Response.json({ error: '필수 정보 누락' }, { status: 400 })

  const actor = await verifyActor(uid)
  if (!actor) return Response.json({ error: '권한 없음' }, { status: 403 })

  const r = await scheduleDeletion(uid, password)
  if (r.error) return Response.json(r, { status: 400 })
  return Response.json(r)
}
