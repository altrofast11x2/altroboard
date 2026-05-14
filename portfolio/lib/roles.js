// 사용자 등급(롤) 정의
// 단계: owner > admin > tester > developer > user (일반)
// owner: 최상위, 다른 owner 임명 및 admin 임명 가능. altrofast11x2 계정.
// admin: 모든 게시글/유저 관리, 정지/해제, 신고 처리, 갤러리 강제 삭제.
// tester: 비공개 베타 기능 접근 (예: 디버그 화면). 글은 일반 유저와 동일.
// developer: 일부 개발자 도구/통계 접근. 글은 일반 유저와 동일.
// user: 기본값.

export const ROLES = {
  OWNER:     'owner',
  ADMIN:     'admin',
  TESTER:    'tester',
  DEVELOPER: 'developer',
  USER:      'user',
}

export const ROLE_ORDER = ['user', 'developer', 'tester', 'admin', 'owner']

// 환경변수로 지정된 owner 이메일 (없으면 altrofast11x2@email.com 폴백)
export function getOwnerEmail() {
  return (process.env.OWNER_EMAIL || process.env.ADMIN_ID || 'altrofast11x2@email.com').toLowerCase()
}

// 표시용 라벨 + 색상
export const ROLE_META = {
  owner:     { label: 'Owner',     color: '#c9a84c', textColor: '#3d2e0a', icon: '👑' },
  admin:     { label: 'Admin',     color: '#1a6e3a', textColor: '#d4ffdf', icon: '🛡' },
  tester:    { label: 'Tester',    color: '#2980b9', textColor: '#cfe9ff', icon: '🧪' },
  developer: { label: 'Developer', color: '#8e44ad', textColor: '#e9d5ff', icon: '⚙' },
  user:      { label: 'User',      color: 'transparent', textColor: 'var(--muted)', icon: '' },
}

// 등급 비교 — a >= b ?
export function roleAtLeast(a, b) {
  const ia = ROLE_ORDER.indexOf(a || 'user')
  const ib = ROLE_ORDER.indexOf(b || 'user')
  return ia >= 0 && ib >= 0 && ia >= ib
}

export function isStaff(role) {
  return roleAtLeast(role, 'admin')
}

// 관리자 권한 확인 (Owner 또는 Admin)
export function canManageUsers(role) { return roleAtLeast(role, 'admin') }

// Owner 만 가능한 동작 (다른 사람의 등급 변경 등)
export function canAssignRoles(role) { return role === 'owner' }
