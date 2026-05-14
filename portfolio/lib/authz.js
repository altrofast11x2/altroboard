// 서버측 권한 확인 — 요청 본문/쿼리에 들어온 (actorId, actorRole) 만 신뢰하는 단순 방식.
// 정식 인증 시스템이 없어 클라이언트 신뢰가 필요한 단계지만, 서버에서 Firebase 의 user.role 을
// 재확인해 클라이언트 위조를 방어한다.
import { getUserById } from '@/lib/users'
import { roleAtLeast } from '@/lib/roles'

// 클라이언트 주장 정보 검증 — DB 의 실제 등급/정지여부 재확인
export async function verifyActor(actorId) {
  if (!actorId) return null
  if (actorId === 'admin') {
    return { id: 'admin', role: 'owner', email: process.env.ADMIN_ID, suspended: false }
  }
  const u = await getUserById(actorId)
  if (!u) return null
  if (u.suspended) return null
  return u
}

// 최소 등급 충족 검증 — 통과하면 actor 객체 반환, 실패 시 null
export async function requireRole(actorId, minRole) {
  const actor = await verifyActor(actorId)
  if (!actor) return null
  if (!roleAtLeast(actor.role, minRole)) return null
  return actor
}
