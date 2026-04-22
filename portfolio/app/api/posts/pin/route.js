import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, get, update } from 'firebase/database'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
const db  = getDatabase(app)

// POST { postId, userId, role } → toggle pin (admin only)
export async function POST(request) {
  const { postId, userId, role } = await request.json()
  if (role !== 'admin') return Response.json({ error: '관리자만 고정할 수 있습니다' }, { status: 403 })

  const postRef = ref(db, `posts/${postId}`)
  const snap = await get(postRef)
  if (!snap.exists()) return Response.json({ error: 'not found' }, { status: 404 })

  const pinned = !snap.val().pinned
  await update(postRef, { pinned })
  return Response.json({ pinned })
}
