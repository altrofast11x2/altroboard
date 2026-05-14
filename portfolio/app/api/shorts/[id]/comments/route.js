import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, get, push, set, remove } from 'firebase/database'
import { safeJson, cleanId, cleanLine, cleanText, cleanUrl } from '@/lib/security'
import { verifyActor } from '@/lib/authz'
import { roleAtLeast } from '@/lib/roles'

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

export async function GET(request, { params }) {
  const { id } = await params
  const snap = await get(ref(db, `shorts_comments/${id}`))
  if (!snap.exists()) return Response.json([])
  const list = Object.entries(snap.val())
    .map(([cid, c]) => ({ id: cid, ...c }))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
  return Response.json(list)
}

export async function POST(request, { params }) {
  const { id } = await params
  const body = await safeJson(request, { maxBytes: 32 * 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })
  const userId = cleanId(body.userId)
  const userName = cleanLine(body.userName, 24) || '익명'
  const userAvatar = body.userAvatar ? cleanUrl(body.userAvatar, { allowData: true }) : null
  const text = cleanText(body.text, 300)
  if (!userId || !text) return Response.json({ error: '내용을 입력하세요' }, { status: 400 })
  const newRef = push(ref(db, `shorts_comments/${id}`))
  const comment = { userId, userName, userAvatar, text, createdAt: new Date().toISOString() }
  await set(newRef, comment)
  return Response.json({ id: newRef.key, ...comment })
}

export async function DELETE(request, { params }) {
  const { id } = await params
  const url = new URL(request.url)
  const commentId = cleanId(url.searchParams.get('commentId'))
  const userId    = cleanId(url.searchParams.get('userId'))
  if (!commentId) return Response.json({ error: 'commentId required' }, { status: 400 })
  const snap = await get(ref(db, `shorts_comments/${id}/${commentId}`))
  if (!snap.exists()) return Response.json({ error: 'not found' }, { status: 404 })
  const c = snap.val()
  const actor = userId ? await verifyActor(userId) : null
  const isStaff = !!actor && roleAtLeast(actor.role, 'admin')
  if (!isStaff && c.userId !== userId) return Response.json({ error: '권한 없음' }, { status: 403 })
  await remove(ref(db, `shorts_comments/${id}/${commentId}`))
  return Response.json({ ok: true })
}
