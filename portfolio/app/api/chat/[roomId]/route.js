import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, get, update } from 'firebase/database'

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

// GET: messages in a room, optionally mark read for ?userId=xxx
export async function GET(request, { params }) {
  const { roomId } = await params
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  const snap = await get(ref(db, `chatMessages/${roomId}`))
  const messages = snap.exists()
    ? Object.entries(snap.val())
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : []

  // Mark as read
  if (userId) {
    await update(ref(db, `chatRooms/${roomId}`), { [`unread/${userId}`]: 0 })
  }

  return Response.json(messages)
}
