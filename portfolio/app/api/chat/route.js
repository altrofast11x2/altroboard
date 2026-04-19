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
const db  = getDatabase(app)

// GET ?userId=xxx → 대화 목록
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) return Response.json({ error: 'userId required' }, { status: 400 })

  const snap = await get(ref(db, 'chatRooms'))
  if (!snap.exists()) return Response.json([])

  const rooms = []
  for (const [roomId, room] of Object.entries(snap.val())) {
    // members 필드가 있으면 그걸로, 없으면 roomId 파싱으로 fallback
    let isMember = false
    let otherUid = ''

    if (room.members) {
      isMember = !!room.members[userId]
      otherUid = Object.keys(room.members).find(id => id !== userId) || ''
    } else {
      // roomId = "uid1__uid2" 형태
      const parts = roomId.split('__')
      isMember = parts.includes(userId)
      otherUid = parts.find(id => id !== userId) || ''
    }

    if (!isMember) continue

    rooms.push({
      roomId,
      otherUid,
      otherName: room.memberNames?.[otherUid] || otherUid,
      lastMessage: room.lastMessage || '',
      lastAt: room.lastAt || room.createdAt || '',
      unread: room.unread?.[userId] || 0,
    })
  }

  rooms.sort((a, b) => b.lastAt.localeCompare(a.lastAt))
  return Response.json(rooms)
}

// POST { fromId, fromName, toId, toName, message?, imageUrl? } → 메시지 전송
export async function POST(request) {
  const { fromId, fromName, toId, toName, message, imageUrl } = await request.json()
  const text = (message || '').trim()

  if (!fromId || !toId || (!text && !imageUrl))
    return Response.json({ error: '필수 정보가 없습니다' }, { status: 400 })

  const roomId = [fromId, toId].sort().join('__')
  const now    = new Date().toISOString()
  const roomRef = ref(db, `chatRooms/${roomId}`)

  const roomSnap = await get(roomRef)
  if (!roomSnap.exists()) {
    await set(roomRef, {
      members:     { [fromId]: true, [toId]: true },
      memberNames: { [fromId]: fromName || fromId, [toId]: toName || toId },
      createdAt:   now,
      lastMessage: '',
      lastAt:      now,
      unread:      { [fromId]: 0, [toId]: 0 },
    })
  }

  const msgRef = push(ref(db, `chatMessages/${roomId}`))
  const msg = { fromId, fromName: fromName || fromId, message: text, createdAt: now }
  if (imageUrl) msg.imageUrl = imageUrl
  await set(msgRef, msg)

  const unreadSnap = await get(ref(db, `chatRooms/${roomId}/unread/${toId}`))
  const unreadCount = (unreadSnap.exists() ? unreadSnap.val() : 0) + 1

  const preview = imageUrl ? '📷 사진' : text.slice(0, 60)
  await update(roomRef, {
    members:     { [fromId]: true, [toId]: true },
    memberNames: { [fromId]: fromName || fromId, [toId]: toName || toId },
    lastMessage: preview,
    lastAt:      now,
    [`unread/${toId}`]: unreadCount,
  })

  return Response.json({ id: msgRef.key, ...msg })
}
