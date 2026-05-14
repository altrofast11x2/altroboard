// 삭제 예정 계정 재활성화 — 로그인 흐름에서 호출
import { cancelDeletion } from '@/lib/users'
import { safeJson, cleanId } from '@/lib/security'

export async function POST(req) {
  const body = await safeJson(req, { maxBytes: 2 * 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })

  const uid = cleanId(body.uid)
  if (!uid) return Response.json({ error: '필수 정보 누락' }, { status: 400 })

  const r = await cancelDeletion(uid)
  return Response.json(r)
}
