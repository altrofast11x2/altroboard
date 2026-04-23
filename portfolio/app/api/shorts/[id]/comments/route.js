import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, get, push, set, remove } from 'firebase/database'

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

// GET /api/shorts/[id]/comments
export async function GET(request, { params }) {
  const { id } = await params
  const snap = await get(ref(db, `shorts_comments/${id}`))
  if (!snap.exists()) return Response.json([])
  const list = Object.entries(snap.val())
    .map(([cid, c]) => ({ id: cid, ...c }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return Response.json(list)
}

// POST /api/shorts/[id]/comments
export async function POST(request, { params }) {
  const { id } = await params
  const { userId, userName, userAvatar, text } = await request.json()
  if (!userId || !text?.trim()) return Response.json({ error: '내용을 입력하세요' }, { status: 400 })
  const newRef = push(ref(db, `shorts_comments/${id}`))
  const comment = { userId, userName: userName || '익명', userAvatar: userAvatar || null, text: text.trim().slice(0, 300), createdAt: new Date().toISOString() }
  await set(newRef, comment)
  return Response.json({ id: newRef.key, ...comment })
}

// DELETE /api/shorts/[id]/comments?commentId=xxx&userId=yyy&role=zzz
export async function DELETE(request, { params }) {
  const { id } = await params
  const url = new URL(request.url)
  const commentId = url.searchParams.get('commentId')
  const userId    = url.searchParams.get('userId')
  const role      = url.searchParams.get('role')
  if (!commentId) return Response.json({ error: 'commentId required' }, { status: 400 })
  const snap = await get(ref(db, `shorts_comments/${id}/${commentId}`))
  if (!snap.exists()) return Response.json({ error: 'not found' }, { status: 404 })
  const c = snap.val()
  if (role !== 'admin' && c.userId !== userId) return Response.json({ error: '권한 없음' }, { status: 403 })
  await remove(ref(db, `shorts_comments/${id}/${commentId}`))
  return Response.json({ ok: true })
}
