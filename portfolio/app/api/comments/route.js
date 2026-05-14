import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, push, get, set } from 'firebase/database'
import {
  safeJson, cleanId, cleanLine, cleanText,
  getClientIp, rateLimit,
} from '@/lib/security'

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
const db = getDatabase(app)

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const postId = cleanId(searchParams.get('postId'))
  if (!postId) return Response.json({ error: 'postId required' }, { status: 400 })

  const snap = await get(ref(db, `comments/${postId}`))
  if (!snap.exists()) return Response.json([])

  const comments = Object.entries(snap.val())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
  return Response.json(comments)
}

export async function POST(request) {
  if (!rateLimit(`comment:${getClientIp(request)}`, { windowMs: 30_000, max: 10 }))
    return Response.json({ error: '잠시 후 다시 시도하세요' }, { status: 429 })

  const body = await safeJson(request, { maxBytes: 32 * 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })

  const postId = cleanId(body.postId)
  const content = cleanText(body.content, 600)
  const authorId = cleanId(body.authorId)
  const authorName = cleanLine(body.authorName, 24) || '익명'
  if (!postId || !content || !authorId)
    return Response.json({ error: '필수 정보가 없습니다' }, { status: 400 })

  const newRef = push(ref(db, `comments/${postId}`))
  const comment = { content, authorId, authorName, createdAt: new Date().toISOString() }
  await set(newRef, comment)
  return Response.json({ id: newRef.key, ...comment })
}
