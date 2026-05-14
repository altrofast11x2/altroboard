// 관리자: 사용자 목록 조회 + 정지/해제 + 등급 변경
// GET     /api/admin/users?actorId=...                     → 목록
// POST    /api/admin/users        body { actorId, action: 'suspend'|'unsuspend'|'setRole'|'purge', uid, ...args }
//
// 권한 규칙:
//   - admin: 일반 user 만 정지/해제 가능. owner/admin/tester/developer 못 건드림.
//   - owner: 본인 외 누구든 모든 작업 가능. 단, 다른 owner 도 owner 만 건드림 (admin은 owner 못 건드림).

import { listAllUsers, suspendUser, unsuspendUser, setUserRole, purgeUser, getUserById, scheduleDeletionByAdmin, cancelDeletion } from '@/lib/users'
import { requireRole } from '@/lib/authz'
import { safeJson, cleanId, cleanEnum, cleanLine } from '@/lib/security'
import { roleAtLeast } from '@/lib/roles'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const actorId = cleanId(searchParams.get('actorId'))
  const actor = await requireRole(actorId, 'admin')
  if (!actor) return Response.json({ error: '권한 없음' }, { status: 403 })

  const users = await listAllUsers()
  return Response.json(users)
}

export async function POST(req) {
  const body = await safeJson(req, { maxBytes: 8 * 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })

  const actorId = cleanId(body.actorId)
  const targetUid = cleanId(body.uid)
  const action = cleanEnum(body.action, ['suspend', 'unsuspend', 'setRole', 'purge', 'purgeNow', 'cancelDelete'])
  if (!actorId || !targetUid || !action) return Response.json({ error: '필수 정보 누락' }, { status: 400 })
  if (targetUid === actorId) return Response.json({ error: '본인 계정엔 적용할 수 없습니다' }, { status: 400 })

  // setRole / purgeNow 는 owner 만. 그 외는 최소 admin.
  // purge (예약) 는 admin도 가능. cancelDelete 도 admin 가능.
  const ownerOnly = (action === 'setRole' || action === 'purgeNow')
  const minRole = ownerOnly ? 'owner' : 'admin'
  const actor = await requireRole(actorId, minRole)
  if (!actor) return Response.json({ error: '권한 없음' }, { status: 403 })

  // 대상 사용자 조회 — owner 보호 규칙 적용
  const target = await getUserById(targetUid)
  if (!target) return Response.json({ error: '대상 사용자를 찾을 수 없습니다' }, { status: 404 })

  // Owner 보호: actor 가 owner 가 아니면 owner 대상으로 어떤 작업도 불가
  if (target.role === 'owner' && actor.role !== 'owner')
    return Response.json({ error: 'Owner 계정은 다른 관리자가 변경할 수 없습니다' }, { status: 403 })

  // admin 끼리 — 같은 등급은 못 건드림 (owner 만 다른 admin 건드릴 수 있음)
  if (actor.role === 'admin' && roleAtLeast(target.role, 'admin'))
    return Response.json({ error: '같거나 높은 등급의 사용자는 변경할 수 없습니다' }, { status: 403 })

  if (action === 'suspend') {
    const reason = cleanLine(body.reason, 200)
    const r = await suspendUser(targetUid, { reason })
    return Response.json(r)
  }
  if (action === 'unsuspend') {
    const r = await unsuspendUser(targetUid)
    return Response.json(r)
  }
  if (action === 'setRole') {
    const role = cleanEnum(body.role, ['owner', 'admin', 'tester', 'developer', 'user'])
    if (!role) return Response.json({ error: '잘못된 등급' }, { status: 400 })
    const r = await setUserRole(targetUid, role)
    return Response.json(r)
  }
  if (action === 'purge') {
    // 7일 유예 예약 (관리자에 의한 삭제) — 본인 삭제와 동일 흐름
    const r = await scheduleDeletionByAdmin(targetUid, { actorId })
    return Response.json(r)
  }
  if (action === 'purgeNow') {
    // Owner 전용: 유예 무시하고 즉시 완전 삭제 (cascading)
    const r = await purgeUser(targetUid)
    return Response.json(r)
  }
  if (action === 'cancelDelete') {
    const r = await cancelDeletion(targetUid)
    return Response.json(r)
  }
  return Response.json({ error: '알 수 없는 액션' }, { status: 400 })
}
