import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, get, remove, update } from 'firebase/database'

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

// POST /api/stories/[id] → 조회 기록
export async function POST(request, { params }) {
  const { id } = await params
  const { userId } = await request.json()
  if (!userId) return Response.json({ ok: true })

  const storyRef = ref(db, `stories/${id}`)
  const snap     = await get(storyRef)
  if (!snap.exists()) return Response.json({ error: 'not found' }, { status: 404 })

  const story   = snap.val()
  const viewers = story.viewers || {}
  if (!viewers[userId]) {
    await update(storyRef, {
      views:              (story.views || 0) + 1,
      [`viewers/${userId}`]: true,
    })
  }
  return Response.json({ ok: true })
}

// DELETE /api/stories/[id] → 삭제 (본인 or 관리자)
export async function DELETE(request, { params }) {
  const { id } = await params
  const { userId, role } = await request.json()

  const snap = await get(ref(db, `stories/${id}`))
  if (!snap.exists()) return Response.json({ error: '스토리를 찾을 수 없습니다' }, { status: 404 })

  const story = snap.val()
  if (role !== 'admin' && story.authorId !== userId)
    return Response.json({ error: '삭제 권한이 없습니다' }, { status: 403 })

  await remove(ref(db, `stories/${id}`))
  return Response.json({ ok: true })
}
