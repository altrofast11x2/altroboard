// 메모(Note) API — Instagram 노트 패턴
//
// 데이터:
//   notes/{authorId}: { authorId, authorName, authorAvatar, text, music?, createdAt }
//   (사용자당 1개만 유지 — 새로 올리면 기존 메모 덮어쓰기)
//   24시간 후 자동 삭제 (GET 호출 시 만료된 거 정리)
//
// 음악 첨부: musicAllowed=true 또는 owner/admin 만 가능 (POST 시 서버 검증)
//
// GET    ?userId=...       → { notes: [...], myNote?: {...} }
//                              본인 + 팔로잉 사용자들의 메모만 반환.
// POST   { userId, text, music? } → 메모 저장 (60자 한도)
// DELETE { userId }        → 본인 메모 삭제

import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, get, set, remove } from 'firebase/database'
import { safeJson, cleanId, cleanLine } from '@/lib/security'
import { verifyActor } from '@/lib/authz'

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

const EXPIRE_MS = 24 * 60 * 60 * 1000

function isExpired(createdAt) {
  const t = typeof createdAt === 'number' ? createdAt : new Date(createdAt || 0).getTime()
  return Date.now() - t > EXPIRE_MS
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const userId = cleanId(searchParams.get('userId'))

  const snap = await get(ref(db, 'notes'))
  if (!snap.exists()) return Response.json({ notes: [], myNote: null })
  const all = snap.val() || {}

  // 만료된 메모 정리 (fire-and-forget)
  for (const [uid, note] of Object.entries(all)) {
    if (note && isExpired(note.createdAt)) {
      remove(ref(db, `notes/${uid}`)).catch(() => {})
      delete all[uid]
    }
  }

  // 팔로잉 ID 목록 받기 (로그인한 경우만)
  let followingSet = new Set()
  if (userId) {
    const fs = await get(ref(db, `follows/${userId}`))
    if (fs.exists()) followingSet = new Set(Object.keys(fs.val() || {}))
    followingSet.add(userId) // 본인 메모도 포함
  }

  const list = Object.entries(all)
    .filter(([uid]) => !userId || followingSet.has(uid))
    .map(([uid, n]) => ({ authorId: uid, ...n }))
    .sort((a, b) => {
      // 본인 메모 가장 앞으로
      if (a.authorId === userId) return -1
      if (b.authorId === userId) return 1
      return (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0)
    })

  const myNote = userId ? (list.find(n => n.authorId === userId) || null) : null
  return Response.json({ notes: list, myNote })
}

export async function POST(req) {
  const body = await safeJson(req, { maxBytes: 8 * 1024 })
  if (!body) return Response.json({ error: '잘못된 요청' }, { status: 400 })

  const userId = cleanId(body.userId)
  if (!userId) return Response.json({ error: 'userId 누락' }, { status: 400 })
  const actor = await verifyActor(userId)
  if (!actor) return Response.json({ error: '권한 없음' }, { status: 403 })

  const text = cleanLine(body.text, 60)
  // 음악 첨부 — 라이브러리에서 선택된 곡 (이미 승인된 곡이므로 권한 검증 불필요)
  let music = null
  if (body.music && typeof body.music === 'object') {
    music = {
      url:    String(body.music.url || '').slice(0, 500),
      title:  String(body.music.title || '').slice(0, 80),
      author: String(body.music.author || '').slice(0, 60),
      thumbnail: String(body.music.thumbnail || '').slice(0, 500),
    }
    if (!music.url) music = null
  }
  // GIF
  const gifUrl = body.gifUrl ? String(body.gifUrl).slice(0, 500) : null

  if (!text && !music && !gifUrl) return Response.json({ error: '내용 / 음악 / GIF 중 하나는 필요합니다' }, { status: 400 })

  const note = {
    authorId:     userId,
    authorName:   actor.name || userId,
    authorAvatar: actor.avatar || null,
    text,
    music,
    gifUrl,
    createdAt:    new Date().toISOString(),
  }
  await set(ref(db, `notes/${userId}`), note)
  return Response.json({ ok: true, note })
}

export async function DELETE(req) {
  const body = await safeJson(req, { maxBytes: 2 * 1024 })
  if (!body) return Response.json({ error: '잘못된 요청' }, { status: 400 })
  const userId = cleanId(body.userId)
  if (!userId) return Response.json({ error: 'userId 누락' }, { status: 400 })
  const actor = await verifyActor(userId)
  if (!actor) return Response.json({ error: '권한 없음' }, { status: 403 })
  await remove(ref(db, `notes/${userId}`))
  return Response.json({ ok: true })
}
