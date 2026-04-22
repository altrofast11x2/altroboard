import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, get, set, remove } from 'firebase/database'

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

// GET: ?postId=xxx  → { count, liked (if userId given) }
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const postId = searchParams.get('postId')
  const userId = searchParams.get('userId')
  if (!postId) return Response.json({ error: 'postId required' }, { status: 400 })

  const snap = await get(ref(db, `likes/${postId}`))
  const data = snap.exists() ? snap.val() : {}
  const count = Object.keys(data).length
  const liked = userId ? !!data[userId] : false
  return Response.json({ count, liked })
}

// POST: { postId, userId } → toggle
export async function POST(request) {
  const { postId, userId } = await request.json()
  if (!postId || !userId)
    return Response.json({ error: '필수 정보가 없습니다' }, { status: 400 })

  const likeRef = ref(db, `likes/${postId}/${userId}`)
  const snap = await get(likeRef)

  if (snap.exists()) {
    await remove(likeRef)
    const allSnap = await get(ref(db, `likes/${postId}`))
    const count = allSnap.exists() ? Object.keys(allSnap.val()).length : 0
    return Response.json({ liked: false, count })
  } else {
    await set(likeRef, true)
    const allSnap = await get(ref(db, `likes/${postId}`))
    const count = allSnap.exists() ? Object.keys(allSnap.val()).length : 0
    return Response.json({ liked: true, count })
  }
}
