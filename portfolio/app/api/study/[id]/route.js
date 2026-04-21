import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, remove } from 'firebase/database'

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

export async function DELETE(req, { params }) {
  const body = await req.json().catch(() => ({}))
  if (body.role !== 'admin') return Response.json({ error: '관리자만 삭제 가능합니다' }, { status: 403 })
  const { id } = await params
  await remove(ref(db, `study/${id}`))
  return Response.json({ ok: true })
}
