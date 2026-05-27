// 음악 업로드 시스템.
//
// 데이터:
//   music_uploads/{id}: {
//     uploaderId, uploaderName, uploaderAvatar?,
//     title, artist, coverUrl, fileUrl,
//     status: 'pending' | 'approved' | 'rejected',
//     reviewerId?, reviewerNote?, reviewedAt?,
//     createdAt
//   }
//
// 흐름:
//   1. musicAllowed=true 또는 owner/admin 인 사용자가 업로드 → status='pending'
//   2. owner/admin 이 검토 → status='approved' 또는 'rejected'
//   3. approved 만 라이브러리(/music) 와 프로필 음악 / 메모 음악 선택 UI 에 노출

import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, push, get, set, update, remove } from 'firebase/database'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL:       process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
const db  = getDatabase(app)

export async function createMusic({ uploaderId, uploaderName, uploaderAvatar, title, artist, coverUrl, fileUrl }) {
  const newRef = push(ref(db, 'music_uploads'))
  const data = {
    uploaderId, uploaderName: uploaderName || '익명', uploaderAvatar: uploaderAvatar || null,
    title:  title  || '제목 없음',
    artist: artist || '',
    coverUrl: coverUrl || null,
    fileUrl,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  await set(newRef, data)
  return { id: newRef.key, ...data }
}

export async function listMusic({ status = null, uploaderId = null } = {}) {
  const snap = await get(ref(db, 'music_uploads'))
  if (!snap.exists()) return []
  let list = Object.entries(snap.val()).map(([id, m]) => ({ id, ...m }))
  if (status) list = list.filter(m => m.status === status)
  if (uploaderId) list = list.filter(m => m.uploaderId === uploaderId)
  return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

export async function getMusic(id) {
  const snap = await get(ref(db, `music_uploads/${id}`))
  if (!snap.exists()) return null
  return { id, ...snap.val() }
}

export async function reviewMusic(id, { status, reviewerId, reviewerNote }) {
  if (!['approved', 'rejected'].includes(status)) return { error: '잘못된 상태' }
  await update(ref(db, `music_uploads/${id}`), {
    status,
    reviewerId: reviewerId || null,
    reviewerNote: reviewerNote || '',
    reviewedAt: new Date().toISOString(),
  })
  return { ok: true }
}

export async function deleteMusic(id) {
  await remove(ref(db, `music_uploads/${id}`))
  return { ok: true }
}
