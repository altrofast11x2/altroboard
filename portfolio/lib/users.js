import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, push, get, set, update, remove, query, orderByChild, equalTo } from 'firebase/database'
import { hashPassword } from '@/lib/security'
import { ROLES, getOwnerEmail } from '@/lib/roles'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL:       process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://placeholder-default-rtdb.firebaseio.com',
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
const db  = getDatabase(app)

// 신규 계정의 비밀번호는 SHA-256(salt=email) 으로 해시 저장한다.
// 기존(평문) 계정은 로그인 시 자동으로 해시화하여 마이그레이션한다.
function isLikelyHashed(s) {
  return typeof s === 'string' && /^[a-f0-9]{64}$/i.test(s)
}

// 일주일 유예 — 삭제 예정 사용자 (deletionScheduledAt 기록만, 실제 삭제는 cron)
const GRACE_MS = 7 * 24 * 60 * 60 * 1000

// ── 인증 ──────────────────────────────────────────────────────
// 반환:
//   { ok:true, user } — 정상 로그인
//   { ok:false, status:'suspended', reason } — 정지된 계정
//   { ok:false, status:'pending_deletion', deletionScheduledAt, uid } — 삭제 유예 중 (재활성화 흐름)
//   null — 인증 실패
export async function findUser(id, password) {
  const lowerId = String(id || '').toLowerCase()
  // Owner 환경변수 직접 매칭 (백업 어드민)
  if (lowerId === (process.env.ADMIN_ID || '').toLowerCase() && password === process.env.ADMIN_PW) {
    return { ok: true, user: { id: 'admin', name: '관리자', email: lowerId, role: 'owner', avatar: null } }
  }
  const snap = await get(query(ref(db, 'users'), orderByChild('email'), equalTo(lowerId)))
  if (!snap.exists()) return null

  const entries = Object.entries(snap.val())
  const hashed = await hashPassword(password, lowerId)

  let match = null
  for (const [uid, u] of entries) {
    if (!u || typeof u.password !== 'string') continue
    if (isLikelyHashed(u.password)) {
      if (u.password === hashed) { match = [uid, u, 'hash']; break }
    } else {
      if (u.password === password) { match = [uid, u, 'plain']; break }
    }
  }
  if (!match) return null
  const [uid, user, kind] = match

  // 평문이었으면 해시로 즉시 업그레이드
  if (kind === 'plain') {
    try { await update(ref(db, `users/${uid}`), { password: hashed }) } catch {}
  }
  // 이전 비밀번호 히스토리 추적 (최근 3개) — 복구 시 사용
  try {
    const prev = Array.isArray(user.passwordHistory) ? user.passwordHistory : []
    if (kind === 'hash' && !prev.includes(hashed)) {
      const next = [hashed, ...prev].slice(0, 3)
      update(ref(db, `users/${uid}`), { passwordHistory: next }).catch(() => {})
    }
  } catch {}

  // 정지 계정
  if (user.suspended) {
    return { ok: false, status: 'suspended', reason: user.suspendReason || '관리자에 의해 정지되었습니다' }
  }

  // 삭제 유예 중 — 클라이언트에서 재활성화 흐름으로 분기
  if (user.deletionScheduledAt) {
    return {
      ok: false, status: 'pending_deletion', uid,
      deletionScheduledAt: user.deletionScheduledAt,
      name: user.name, email: user.email,
    }
  }

  // Owner 자동 승격 — 환경변수로 지정된 owner 이메일이면 role을 'owner'로 보정
  const ownerEmail = getOwnerEmail()
  let role = user.role || 'user'
  if (lowerId === ownerEmail && role !== 'owner') {
    try { await update(ref(db, `users/${uid}`), { role: 'owner' }) } catch {}
    role = 'owner'
  }

  return {
    ok: true,
    user: { id: uid, name: user.name, email: user.email, role, avatar: user.avatar || null },
  }
}

export async function findByEmail(email) {
  const lower = String(email || '').toLowerCase()
  if (lower === (process.env.ADMIN_ID || '').toLowerCase()) return { exists: true }
  const snap = await get(query(ref(db, 'users'), orderByChild('email'), equalTo(lower)))
  return snap.exists() ? snap.val() : null
}

export async function createUser(name, email, password) {
  const newRef = push(ref(db, 'users'))
  const lower = String(email).toLowerCase()
  const hashed = await hashPassword(password, lower)
  const role = lower === getOwnerEmail() ? 'owner' : 'user'
  const user = {
    name, email: lower, password: hashed,
    role,
    createdAt: new Date().toISOString(),
    avatar: null, bio: '',
    passwordHistory: [hashed],
  }
  await set(newRef, user)
  return { id: newRef.key, name, email: lower, role, avatar: null }
}

export async function getUserById(uid) {
  if (uid === 'admin') return { id: 'admin', name: '관리자', email: process.env.ADMIN_ID, role: 'owner', avatar: null, bio: '' }
  const snap = await get(ref(db, `users/${uid}`))
  if (!snap.exists()) return null
  const u = snap.val()
  return {
    id: uid,
    name: u.name, email: u.email,
    role: u.role || 'user',
    avatar: u.avatar || null,
    bio: u.bio || '',
    createdAt: u.createdAt || '',
    suspended: !!u.suspended,
    suspendReason: u.suspendReason || '',
    deletionScheduledAt: u.deletionScheduledAt || null,
    language: u.language || 'ko',
    theme: u.theme || 'light',
    verified: !!u.verified,            // 인증 배지 (별)
    profileMusic: u.profileMusic || null,
  }
}

export async function updateUser(uid, data) {
  const allowed = {}
  if (data.name         !== undefined) allowed.name         = data.name
  if (data.bio          !== undefined) allowed.bio          = data.bio
  if (data.avatar       !== undefined) allowed.avatar       = data.avatar
  if (data.profileMusic !== undefined) allowed.profileMusic = data.profileMusic
  if (data.language     !== undefined) allowed.language     = data.language
  if (data.theme        !== undefined) allowed.theme        = data.theme
  await update(ref(db, `users/${uid}`), allowed)
  return getUserById(uid)
}

// ── 비밀번호 변경 ───────────────────────────────────────────
export async function changePassword(uid, currentPw, newPw) {
  const snap = await get(ref(db, `users/${uid}`))
  if (!snap.exists()) return { error: '없는 계정' }
  const u = snap.val()
  const lower = (u.email || '').toLowerCase()
  const hashedCur = await hashPassword(currentPw, lower)
  const stored = String(u.password || '')
  const matches = isLikelyHashed(stored) ? stored === hashedCur : stored === currentPw
  if (!matches) return { error: '현재 비밀번호가 일치하지 않습니다' }

  const hashedNew = await hashPassword(newPw, lower)
  const history = Array.isArray(u.passwordHistory) ? u.passwordHistory : []
  const nextHist = [hashedNew, ...history.filter(h => h !== hashedNew)].slice(0, 5)
  await update(ref(db, `users/${uid}`), { password: hashedNew, passwordHistory: nextHist })
  return { ok: true }
}

// ── 비밀번호 복구 ───────────────────────────────────────────
// 1) 이전 비밀번호로 복구 (passwordHistory 에 있던 것)
export async function recoverByOldPassword(email, oldPw, newPw) {
  const lower = String(email || '').toLowerCase()
  const snap = await get(query(ref(db, 'users'), orderByChild('email'), equalTo(lower)))
  if (!snap.exists()) return { error: '존재하지 않는 이메일' }
  const [uid, u] = Object.entries(snap.val())[0]
  const hashedOld = await hashPassword(oldPw, lower)
  const history = Array.isArray(u.passwordHistory) ? u.passwordHistory : []
  const stored  = String(u.password || '')
  const match =
    history.includes(hashedOld) ||
    (isLikelyHashed(stored) ? stored === hashedOld : stored === oldPw)
  if (!match) return { error: '예전 비밀번호와 일치하지 않습니다' }
  const hashedNew = await hashPassword(newPw, lower)
  const nextHist = [hashedNew, ...history.filter(h => h !== hashedNew)].slice(0, 5)
  await update(ref(db, `users/${uid}`), { password: hashedNew, passwordHistory: nextHist })
  return { ok: true }
}

// 2) 이메일로 일회용 토큰 발급 — 실제 이메일 발송 없이 클라이언트에 표시(개발 단계). 운영시 이메일 전송 필요.
export async function requestEmailReset(email) {
  const lower = String(email || '').toLowerCase()
  const snap = await get(query(ref(db, 'users'), orderByChild('email'), equalTo(lower)))
  if (!snap.exists()) return { error: '존재하지 않는 이메일' }
  const [uid] = Object.entries(snap.val())[0]
  const token = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  const expiresAt = Date.now() + 30 * 60 * 1000 // 30분
  await update(ref(db, `users/${uid}`), { resetToken: token, resetExpiresAt: expiresAt })
  return { ok: true, token, uid, expiresAt }
}

export async function resetPasswordWithToken(uid, token, newPw) {
  const snap = await get(ref(db, `users/${uid}`))
  if (!snap.exists()) return { error: '없는 계정' }
  const u = snap.val()
  if (!u.resetToken || u.resetToken !== token) return { error: '잘못된 토큰' }
  if (!u.resetExpiresAt || u.resetExpiresAt < Date.now()) return { error: '토큰이 만료되었습니다' }
  const lower = (u.email || '').toLowerCase()
  const hashed = await hashPassword(newPw, lower)
  const history = Array.isArray(u.passwordHistory) ? u.passwordHistory : []
  const nextHist = [hashed, ...history.filter(h => h !== hashed)].slice(0, 5)
  await update(ref(db, `users/${uid}`), {
    password: hashed, passwordHistory: nextHist,
    resetToken: null, resetExpiresAt: null,
  })
  return { ok: true }
}

// ── 정지/해제 ──────────────────────────────────────────────
export async function suspendUser(uid, { reason = '' } = {}) {
  await update(ref(db, `users/${uid}`), { suspended: true, suspendReason: reason, suspendedAt: new Date().toISOString() })
  return { ok: true }
}

export async function unsuspendUser(uid) {
  await update(ref(db, `users/${uid}`), { suspended: false, suspendReason: null, suspendedAt: null })
  return { ok: true }
}

// ── 등급 변경 (Owner 전용) ───────────────────────────────
export async function setUserRole(uid, role) {
  const valid = ['owner', 'admin', 'tester', 'developer', 'user']
  if (!valid.includes(role)) return { error: '잘못된 등급' }
  await update(ref(db, `users/${uid}`), { role })
  return { ok: true }
}

// ── 계정 삭제 유예 ─────────────────────────────────────────
export async function scheduleDeletion(uid, password) {
  const snap = await get(ref(db, `users/${uid}`))
  if (!snap.exists()) return { error: '없는 계정' }
  const u = snap.val()
  const lower = (u.email || '').toLowerCase()
  const hashed = await hashPassword(password, lower)
  const stored = String(u.password || '')
  const ok = isLikelyHashed(stored) ? stored === hashed : stored === password
  if (!ok) return { error: '비밀번호가 일치하지 않습니다' }
  const scheduledAt = Date.now() + GRACE_MS
  await update(ref(db, `users/${uid}`), { deletionScheduledAt: scheduledAt })
  return { ok: true, deletionScheduledAt: scheduledAt }
}

export async function cancelDeletion(uid) {
  await update(ref(db, `users/${uid}`), { deletionScheduledAt: null, deletionRequestedBy: null })
  return { ok: true }
}

// 관리자에 의한 삭제 예약 (7일 유예) — 비밀번호 확인 없음
export async function scheduleDeletionByAdmin(uid, { actorId } = {}) {
  const snap = await get(ref(db, `users/${uid}`))
  if (!snap.exists()) return { error: '없는 계정' }
  const scheduledAt = Date.now() + GRACE_MS
  await update(ref(db, `users/${uid}`), {
    deletionScheduledAt: scheduledAt,
    deletionRequestedBy: actorId || 'admin',
  })
  return { ok: true, deletionScheduledAt: scheduledAt }
}

// 사용자가 만든 모든 데이터 + 본인 계정을 완전 삭제 (cascading)
//   - users/{uid}
//   - posts/* (authorId 일치)
//   - shorts/* (authorId 일치)
//   - stories/* (authorId 일치)
//   - comments/{postId}/* (authorId 일치)
//   - shorts_comments/{shortId}/* (userId 일치)
//   - galleries/* (ownerId 일치 → 전체 삭제) + 멤버 기록
//   - galleries/*/posts/* (authorId 일치)
//   - follows/{uid} 및 다른 사용자들의 followers/{uid}
//   - reports — 작성자/대상자 정리 (선택)
async function deleteByPredicate(path, predicate) {
  const snap = await get(ref(db, path))
  if (!snap.exists()) return 0
  const val = snap.val()
  let count = 0
  const updates = {}
  for (const [k, v] of Object.entries(val)) {
    if (predicate(v, k)) { updates[`${path}/${k}`] = null; count++ }
  }
  if (count > 0) await update(ref(db), updates)
  return count
}

export async function purgeUser(uid) {
  if (!uid) return { error: '잘못된 uid' }
  // 1) 본인 글
  await deleteByPredicate('posts',   (p) => p.authorId === uid)
  await deleteByPredicate('shorts',  (s) => s.authorId === uid)
  await deleteByPredicate('stories', (s) => s.authorId === uid)

  // 2) 본인이 쓴 댓글 — comments/{postId}/{cid} 전부 순회
  const commentsRoot = await get(ref(db, 'comments'))
  if (commentsRoot.exists()) {
    const updates = {}
    for (const [pid, byPost] of Object.entries(commentsRoot.val())) {
      if (!byPost || typeof byPost !== 'object') continue
      for (const [cid, c] of Object.entries(byPost)) {
        if (c && c.authorId === uid) updates[`comments/${pid}/${cid}`] = null
      }
    }
    if (Object.keys(updates).length) await update(ref(db), updates)
  }

  // 3) 쇼츠 댓글
  const shortsCommentsRoot = await get(ref(db, 'shorts_comments'))
  if (shortsCommentsRoot.exists()) {
    const updates = {}
    for (const [sid, byShort] of Object.entries(shortsCommentsRoot.val())) {
      if (!byShort || typeof byShort !== 'object') continue
      for (const [cid, c] of Object.entries(byShort)) {
        if (c && c.userId === uid) updates[`shorts_comments/${sid}/${cid}`] = null
      }
    }
    if (Object.keys(updates).length) await update(ref(db), updates)
  }

  // 4) 본인이 owner 인 갤러리 — 통째 삭제
  const galRoot = await get(ref(db, 'galleries'))
  if (galRoot.exists()) {
    const updates = {}
    for (const [gid, g] of Object.entries(galRoot.val())) {
      if (g && g.ownerId === uid) {
        updates[`galleries/${gid}`] = null
      } else if (g && typeof g === 'object') {
        // 5) 다른 갤러리에 남긴 글/댓글/멤버십 제거
        if (g.posts) {
          for (const [pid, p] of Object.entries(g.posts)) {
            if (p && p.authorId === uid) updates[`galleries/${gid}/posts/${pid}`] = null
            if (p && p.comments) {
              for (const [cid, c] of Object.entries(p.comments)) {
                if (c && c.authorId === uid) updates[`galleries/${gid}/posts/${pid}/comments/${cid}`] = null
              }
            }
          }
        }
        if (g.members && g.members[uid]) updates[`galleries/${gid}/members/${uid}`] = null
      }
    }
    if (Object.keys(updates).length) await update(ref(db), updates)
  }

  // 6) 팔로우 관계 정리
  // follows/{uid} = 내가 팔로우 한 사람들 → 삭제 + 그 사람들의 followers/{uid} 도 삭제
  const followRoot = await get(ref(db, 'follows'))
  if (followRoot.exists()) {
    const updates = {}
    updates[`follows/${uid}`] = null
    for (const [other, otherFollows] of Object.entries(followRoot.val())) {
      if (other === uid) continue
      if (otherFollows && typeof otherFollows === 'object' && otherFollows[uid]) {
        updates[`follows/${other}/${uid}`] = null
      }
    }
    if (Object.keys(updates).length) await update(ref(db), updates)
  }

  // 7) 채팅방에서 본인 메시지/룸 — 룸 자체는 두고 메시지만 정리 (옵션)
  // 일단 본인이 만든 1:1 룸은 채팅 상대도 영향 받으니 그대로 둠

  // 8) 본인 신고 기록
  await deleteByPredicate('reports', (r) => r.reporterId === uid || r.targetAuthorId === uid)

  // 9) 본인 좋아요 기록
  // posts 의 likedBy[uid] 도 정리 — 비싸지만 무결성 위해
  const postsAll = await get(ref(db, 'posts'))
  if (postsAll.exists()) {
    const updates = {}
    for (const [pid, p] of Object.entries(postsAll.val())) {
      if (p && p.likedBy && p.likedBy[uid]) {
        updates[`posts/${pid}/likedBy/${uid}`] = null
      }
    }
    if (Object.keys(updates).length) await update(ref(db), updates)
  }

  // 10) 마지막으로 사용자 계정
  await remove(ref(db, `users/${uid}`))

  return { ok: true }
}

// ── 관리자: 사용자 목록 ────────────────────────────────────
export async function listAllUsers() {
  const snap = await get(ref(db, 'users'))
  if (!snap.exists()) return []
  return Object.entries(snap.val()).map(([uid, u]) => ({
    id: uid,
    name: u.name, email: u.email,
    role: u.role || 'user',
    avatar: u.avatar || null,
    suspended: !!u.suspended,
    suspendReason: u.suspendReason || '',
    deletionScheduledAt: u.deletionScheduledAt || null,
    createdAt: u.createdAt || '',
  })).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}
