// 신고 시스템
// 데이터 경로: reports/{reportId} = {
//   type: 'post'|'gallery_post'|'short'|'comment'|'user'|'story',
//   targetId, targetUrl,
//   reporterId, reporterName,
//   targetAuthorId, targetAuthorName,
//   reason, description,
//   status: 'pending'|'resolved'|'rejected',
//   createdAt, resolvedAt, resolvedBy, resolvedNote
// }

import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, push, get, set, update } from 'firebase/database'

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

export const REPORT_REASONS = [
  '스팸/광고',
  '욕설/혐오',
  '음란물/성인',
  '폭력/위협',
  '저작권 침해',
  '개인정보 노출',
  '도배',
  '기타',
]

export async function createReport(data) {
  const newRef = push(ref(db, 'reports'))
  const r = {
    type:             data.type,
    targetId:         data.targetId,
    targetUrl:        data.targetUrl || null,
    reporterId:       data.reporterId,
    reporterName:     data.reporterName,
    targetAuthorId:   data.targetAuthorId || null,
    targetAuthorName: data.targetAuthorName || null,
    reason:           data.reason,
    description:      data.description || '',
    status:           'pending',
    createdAt:        new Date().toISOString(),
  }
  await set(newRef, r)
  return { id: newRef.key, ...r }
}

export async function listReports({ status = null } = {}) {
  const snap = await get(ref(db, 'reports'))
  if (!snap.exists()) return []
  let list = Object.entries(snap.val()).map(([id, r]) => ({ id, ...r }))
  if (status) list = list.filter(r => r.status === status)
  return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

export async function resolveReport(reportId, { resolvedBy, status, note = '' }) {
  if (!['resolved', 'rejected'].includes(status)) return { error: '잘못된 상태' }
  await update(ref(db, `reports/${reportId}`), {
    status,
    resolvedAt: new Date().toISOString(),
    resolvedBy,
    resolvedNote: note,
  })
  return { ok: true }
}
