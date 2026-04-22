import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, push, get, set } from 'firebase/database'

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

// GET /api/shorts → 쇼츠 목록 (최신순)
export async function GET() {
  const snap = await get(ref(db, 'shorts'))
  if (!snap.exists()) return Response.json([])
  const list = Object.entries(snap.val())
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return Response.json(list)
}

// POST /api/shorts → 쇼츠 업로드
export async function POST(request) {
  const { authorId, authorName, authorAvatar, videoUrl, imageUrl, mediaType, music, title, description } = await request.json()
  if (!authorId || (!videoUrl && !imageUrl))
    return Response.json({ error: '필수 정보가 없습니다' }, { status: 400 })

  const newRef = push(ref(db, 'shorts'))
  const short  = {
    authorId,
    authorName:   authorName   || '익명',
    authorAvatar: authorAvatar || null,
    videoUrl:    videoUrl    || null,
    imageUrl:    imageUrl    || null,
    mediaType:   mediaType   || 'video',
    music:       music       || null,
    title:       (title       || '').trim().slice(0, 60),
    description: (description || '').trim().slice(0, 150),
    likes:       0,
    likedBy:     {},
    views:       0,
    createdAt:   new Date().toISOString(),
  }
  await set(newRef, short)
  return Response.json({ id: newRef.key, ...short })
}
