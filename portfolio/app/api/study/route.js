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
const db = getDatabase(app)

export async function GET() {
  const snap = await get(ref(db, 'study'))
  if (!snap.exists()) return Response.json([])
  const posts = Object.entries(snap.val())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return Response.json(posts)
}

export async function POST(req) {
  const body = await req.json()
  const { title, content, tags, period, role, imageUrl } = body
  if (role !== 'admin') return Response.json({ error: '관리자만 작성 가능합니다' }, { status: 403 })
  if (!title || !content) return Response.json({ error: '제목과 내용을 입력하세요' }, { status: 400 })
  const newRef = push(ref(db, 'study'))
  const post = {
    title, content,
    tags: tags || [],
    period: period || '',
    imageUrl: imageUrl || null,
    createdAt: new Date().toISOString()
  }
  await set(newRef, post)
  return Response.json({ id: newRef.key, ...post }, { status: 201 })
}
