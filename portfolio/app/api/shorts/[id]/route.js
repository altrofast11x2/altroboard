import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, get, update, remove } from 'firebase/database'

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

// PATCH /api/shorts/[id] → 좋아요 토글 or 조회수 증가
export async function PATCH(request, { params }) {
  const { id } = await params
  const { action, userId } = await request.json()

  const shortRef = ref(db, `shorts/${id}`)
  const snap     = await get(shortRef)
  if (!snap.exists()) return Response.json({ error: 'not found' }, { status: 404 })

  const short = snap.val()

  if (action === 'like') {
    const liked = !!(short.likedBy || {})[userId]
    const delta = liked ? -1 : 1
    await update(shortRef, {
      likes: Math.max(0, (short.likes || 0) + delta),
      [`likedBy/${userId}`]: liked ? null : true,
    })
    return Response.json({ likes: Math.max(0, (short.likes || 0) + delta), liked: !liked })
  }

  if (action === 'view') {
    await update(shortRef, { views: (short.views || 0) + 1 })
    return Response.json({ views: (short.views || 0) + 1 })
  }

  return Response.json({ error: 'unknown action' }, { status: 400 })
}

// DELETE /api/shorts/[id]
export async function DELETE(request, { params }) {
  const { id } = await params
  const { userId, role } = await request.json()

  const snap = await get(ref(db, `shorts/${id}`))
  if (!snap.exists()) return Response.json({ error: '쇼츠를 찾을 수 없습니다' }, { status: 404 })

  const short = snap.val()
  if (role !== 'admin' && short.authorId !== userId)
    return Response.json({ error: '삭제 권한이 없습니다' }, { status: 403 })

  await remove(ref(db, `shorts/${id}`))
  return Response.json({ ok: true })
}
