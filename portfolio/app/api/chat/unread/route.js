// GET /api/chat/unread?userId=... → { unread: number }
// 사용자가 속한 방들에서 'messages_seen/{userId}/{roomId}' 이후로 도착한 메시지 수 합계.
import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, get } from 'firebase/database'
import { cleanId } from '@/lib/security'

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

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userId = cleanId(searchParams.get('userId'))
  if (!userId) return Response.json({ unread: 0 })

  const [roomsSnap, seenSnap, msgSnap] = await Promise.all([
    get(ref(db, 'chatRooms')),
    get(ref(db, `messages_seen/${userId}`)),
    get(ref(db, 'chatMessages')),
  ])
  if (!roomsSnap.exists()) return Response.json({ unread: 0 })

  const rooms = roomsSnap.val() || {}
  const seen  = seenSnap.exists() ? seenSnap.val() : {}
  const msgs  = msgSnap.exists() ? msgSnap.val() : {}

  let total = 0
  for (const [roomId, room] of Object.entries(rooms)) {
    // 멤버 여부
    const isMember = room.members ? !!room.members[userId] : roomId.split('__').includes(userId)
    if (!isMember) continue
    const last = Number(seen[roomId] || 0)
    const roomMsgs = msgs[roomId] || {}
    for (const m of Object.values(roomMsgs)) {
      if (m && m.fromId !== userId) {
        const t = typeof m.createdAt === 'number'
          ? m.createdAt
          : new Date(m.createdAt || 0).getTime()
        if (t > last) total++
      }
    }
  }
  return Response.json({ unread: total })
}
