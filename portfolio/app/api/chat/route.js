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
// userId 하나로 members 키 전체를 순회해서 포함 여부 체크
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) return Response.json({ error: 'userId required' }, { status: 400 })

  const snap = await get(ref(db, 'chatRooms'))
  if (!snap.exists()) return Response.json([])

  const rooms = []
  for (const [roomId, room] of Object.entries(snap.val())) {
    // members가 없으면 스킵
    if (!room.members) continue

    // members 키 목록에 userId가 포함되는지 확인
    const memberIds = Object.keys(room.members)
    if (!memberIds.includes(userId)) continue

    // 상대방 uid
    const otherUid = memberIds.find(id => id !== userId) || ''

    rooms.push({
      roomId,
      otherUid,
      otherName: room.memberNames?.[otherUid] || otherUid,
      lastMessage: room.lastMessage || '',
      lastAt: room.lastAt || '',
      unread: room.unread?.[userId] ?? 0,
    })
  }

  rooms.sort((a, b) => {
    if (!a.lastAt && !b.lastAt) return 0
    if (!a.lastAt) return 1
    if (!b.lastAt) return -1
    return b.lastAt.localeCompare(a.lastAt)
  })

  return Response.json(rooms)
}

// POST: { fromId, fromName, toId, toName, message, imageUrl? } → send message
export async function POST(request) {
  const { fromId, fromName, toId, toName, message, imageUrl } = await request.json()
  if (!fromId || !toId || (!message?.trim() && !imageUrl))
    return Response.json({ error: '필수 정보가 없습니다' }, { status: 400 })

  const roomId = getRoomId(fromId, toId)
  const now = new Date().toISOString()
  const roomRef = ref(db, `chatRooms/${roomId}`)

  // 방이 없으면 생성
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

  // 메시지 저장
  const msgRef = push(ref(db, `chatMessages/${roomId}`))
  const msg = {
    fromId,
    fromName: fromName || fromId,
    message: message?.trim() || '',
    ...(imageUrl ? { imageUrl } : {}),
    createdAt: now,
  }
  await set(msgRef, msg)

  // unread 카운트 증가
  const unreadSnap = await get(ref(db, `chatRooms/${roomId}/unread/${toId}`))
  const unreadCount = (unreadSnap.exists() ? unreadSnap.val() : 0) + 1
  const lastMsg = imageUrl
    ? (message?.trim() ? message.trim().slice(0, 60) : '📷 사진')
    : message.trim().slice(0, 60)

  await update(roomRef, {
    lastMessage: lastMsg,
    lastAt: now,
    [`unread/${toId}`]: unreadCount,
  })

  return Response.json({ id: msgRef.key, ...msg })
}
