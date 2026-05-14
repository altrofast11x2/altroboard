// Verified user (인증 사용자) 신청
// 데이터:
//   verifyRequests/{requestId} = {
//     userId, userName, userEmail,
//     reason,          // 신청 이유 (왜 인증이 필요한가)
//     links,           // SNS/포트폴리오 링크 (선택)
//     status: 'pending'|'approved'|'rejected',
//     createdAt, reviewedAt, reviewedBy, reviewerNote
//   }
//
// 승인 시 users/{userId}/verified = true 로 설정.

import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, push, get, set, update, remove } from 'firebase/database'

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

export async function createVerifyRequest({ userId, userName, userEmail, reason, links }) {
  // 이미 pending 또는 approved 가 있는지 확인
  const allSnap = await get(ref(db, 'verifyRequests'))
  if (allSnap.exists()) {
    for (const r of Object.values(allSnap.val())) {
      if (r.userId === userId && (r.status === 'pending' || r.status === 'approved')) {
        return { error: r.status === 'approved' ? '이미 인증된 계정입니다' : '대기 중인 신청이 있습니다' }
      }
    }
  }
  const newRef = push(ref(db, 'verifyRequests'))
  const data = {
    userId, userName, userEmail,
    reason, links: links || '',
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  await set(newRef, data)
  return { id: newRef.key, ...data }
}

export async function listVerifyRequests({ status = null } = {}) {
  const snap = await get(ref(db, 'verifyRequests'))
  if (!snap.exists()) return []
  let list = Object.entries(snap.val()).map(([id, r]) => ({ id, ...r }))
  if (status) list = list.filter(r => r.status === status)
  return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

export async function getMyVerifyRequest(userId) {
  const snap = await get(ref(db, 'verifyRequests'))
  if (!snap.exists()) return null
  const arr = Object.entries(snap.val())
    .map(([id, r]) => ({ id, ...r }))
    .filter(r => r.userId === userId)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  return arr[0] || null
}

export async function reviewVerifyRequest(requestId, { status, reviewerId, note }) {
  if (!['approved', 'rejected'].includes(status)) return { error: '잘못된 상태' }
  const reqRef = ref(db, `verifyRequests/${requestId}`)
  const snap = await get(reqRef)
  if (!snap.exists()) return { error: '없는 신청' }
  const data = snap.val()
  await update(reqRef, {
    status,
    reviewedAt: new Date().toISOString(),
    reviewedBy: reviewerId,
    reviewerNote: note || '',
  })
  // 승인 → user.verified = true
  if (status === 'approved') {
    await update(ref(db, `users/${data.userId}`), { verified: true })
  }
  return { ok: true }
}

// Verified 취소 (관리자가 다시 회수)
export async function revokeVerified(userId) {
  await update(ref(db, `users/${userId}`), { verified: false })
  return { ok: true }
}
