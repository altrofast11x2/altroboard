import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, get, remove } from 'firebase/database'
import { safeJson, cleanId } from '@/lib/security'
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
const db = getDatabase(app)

export async function DELETE(request, { params }) {
  const { id: rawId } = await params
  const commentId = cleanId(rawId)
  const body = await safeJson(request) || {}
  const postId = cleanId(body.postId)
  const userId = cleanId(body.userId)

  if (!commentId || !postId || !userId)
    return Response.json({ error: '권한 정보가 없습니다' }, { status: 400 })

  const commentRef = ref(db, `comments/${postId}/${commentId}`)
  const snap = await get(commentRef)
  if (!snap.exists()) return Response.json({ error: '댓글을 찾을 수 없습니다' }, { status: 404 })

  const comment = snap.val()
  const actor = await verifyActor(userId)
  const isStaff = !!actor && roleAtLeast(actor.role, 'admin')
  if (!isStaff && comment.authorId !== userId)
    return Response.json({ error: '삭제 권한이 없습니다' }, { status: 403 })

  await remove(commentRef)
  return Response.json({ success: true })
}
