// POST /api/chat/seen { userId, roomId } → 해당 방을 지금 시각으로 읽음 처리
// GET  /api/chat/seen?userId=...&roomId=... → { lastSeenAt }
import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, set, get } from 'firebase/database'
import { safeJson, cleanId } from '@/lib/security'

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

export async function POST(req) {
  const body = await safeJson(req, { maxBytes: 4 * 1024 })
  if (!body) return Response.json({ error: '잘못된 요청' }, { status: 400 })
  const userId = cleanId(body.userId)
  const roomId = cleanId(body.roomId)
  if (!userId || !roomId) return Response.json({ error: '필수 정보 누락' }, { status: 400 })
  await set(ref(db, `messages_seen/${userId}/${roomId}`), Date.now())
  return Response.json({ ok: true })
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const userId = cleanId(searchParams.get('userId'))
  const roomId = cleanId(searchParams.get('roomId'))
  if (!userId || !roomId) return Response.json({ lastSeenAt: 0 })
  const snap = await get(ref(db, `messages_seen/${userId}/${roomId}`))
  return Response.json({ lastSeenAt: snap.exists() ? Number(snap.val()) || 0 : 0 })
}
