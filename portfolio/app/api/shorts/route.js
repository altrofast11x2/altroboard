import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, push, get, set } from 'firebase/database'
import {
  safeJson, cleanId, cleanLine, cleanText, cleanEnum, cleanUrl,
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
const db  = getDatabase(app)

export async function GET() {
  const snap = await get(ref(db, 'shorts'))
  if (!snap.exists()) return Response.json([])
  const list = Object.entries(snap.val())
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  return Response.json(list)
}

export async function POST(request) {
  if (!rateLimit(`shorts:${getClientIp(request)}`, { windowMs: 60_000, max: 6 }))
    return Response.json({ error: '잠시 후 다시 시도하세요' }, { status: 429 })

  const body = await safeJson(request, { maxBytes: 16 * 1024 * 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })

  const authorId    = cleanId(body.authorId)
  const authorName  = cleanLine(body.authorName, 24) || '익명'
  const authorAvatar = cleanUrl(body.authorAvatar, { allowData: true })
  const videoUrl    = cleanUrl(body.videoUrl)
  const imageUrl    = cleanUrl(body.imageUrl, { allowData: true })
  const mediaType   = cleanEnum(body.mediaType, ['video', 'image'], 'video')
  const audioUrl    = cleanUrl(body.audioUrl)
  const audioTitle  = cleanLine(body.audioTitle, 60)
  const title       = cleanLine(body.title, 60)
  const description = cleanText(body.description, 150)

  if (!authorId || (!videoUrl && !imageUrl))
    return Response.json({ error: '필수 정보가 없습니다' }, { status: 400 })

  const newRef = push(ref(db, 'shorts'))
  const short  = {
    authorId, authorName, authorAvatar,
    videoUrl, imageUrl, mediaType,
    audioUrl, audioTitle: audioTitle || null,
    title, description,
    likes: 0, likedBy: {}, views: 0,
    createdAt: new Date().toISOString(),
  }
  await set(newRef, short)
  return Response.json({ id: newRef.key, ...short })
}
