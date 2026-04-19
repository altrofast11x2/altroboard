import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, push, get, set, update } from 'firebase/database'

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

export function getRoomId(uid1, uid2) {
  return [uid1, uid2].sort().join('__')
}

// GET: ?userId=xxx → list of conversations with last message
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) return Response.json({ error: 'userId required' }, { status: 400 })

  const snap = await get(ref(db, 'chatRooms'))
  if (!snap.exists()) return Response.json([])

  const rooms = []
  for (const [roomId, room] of Object.entries(snap.val())) {
    if (!room.members || !room.members[userId]) continue
    const otherUid = Object.keys(room.members).find(id => id !== userId)
    rooms.push({
      roomId,
      otherUid,
      otherName: room.memberNames?.[otherUid] || otherUid,
      lastMessage: room.lastMessage || '',
      lastAt: room.lastAt || '',
      unread: room.unread?.[userId] || 0,
    })
  }
  rooms.sort((a, b) => b.lastAt.localeCompare(a.lastAt))
  return Response.json(rooms)
}

// POST: { fromId, fromName, toId, toName, message } → send message
export async function POST(request) {
  const { fromId, fromName, toId, toName, message } = await request.json()
  if (!fromId || !toId || !message?.trim())
    return Response.json({ error: '필수 정보가 없습니다' }, { status: 400 })

  const roomId = getRoomId(fromId, toId)
  const now = new Date().toISOString()
  const roomRef = ref(db, `chatRooms/${roomId}`)

  // Ensure room metadata exists
  const roomSnap = await get(roomRef)
  if (!roomSnap.exists()) {
    await set(roomRef, {
      members: { [fromId]: true, [toId]: true },
      memberNames: { [fromId]: fromName || fromId, [toId]: toName || toId },
      createdAt: now,
      lastMessage: '',
      lastAt: '',
      unread: { [fromId]: 0, [toId]: 0 },
    })
  }

  // Push message
  const msgRef = push(ref(db, `chatMessages/${roomId}`))
  const msg = {
    fromId,
    fromName: fromName || fromId,
    message: message.trim(),
    createdAt: now,
  }
  await set(msgRef, msg)

  // Update room metadata
  const unreadSnap = await get(ref(db, `chatRooms/${roomId}/unread/${toId}`))
  const unreadCount = (unreadSnap.exists() ? unreadSnap.val() : 0) + 1
  await update(roomRef, {
    lastMessage: message.trim().slice(0, 60),
    lastAt: now,
    [`unread/${toId}`]: unreadCount,
  })

  return Response.json({ id: msgRef.key, ...msg })
}
