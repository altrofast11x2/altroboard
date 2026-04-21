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

// uid로 실제 이름 조회 (memberNames 없을 때 fallback)
async function resolveUserName(uid) {
  if (!uid || uid === 'admin') return uid === 'admin' ? '관리자' : uid
  try {
    const snap = await get(ref(db, `users/${uid}`))
    if (snap.exists()) return snap.val().name || uid
  } catch {}
  return uid
}

// GET ?userId=xxx → 대화 목록
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) return Response.json({ error: 'userId required' }, { status: 400 })

  const snap = await get(ref(db, 'chatRooms'))
  if (!snap.exists()) return Response.json([])

  const rooms = []
  for (const [roomId, room] of Object.entries(snap.val())) {
    let isMember = false
    let otherUid = ''

    if (room.members) {
      isMember = !!room.members[userId]
      otherUid = Object.keys(room.members).find(id => id !== userId) || ''
    } else {
      // 구버전 roomId = "uid1__uid2" fallback
      const parts = roomId.split('__')
      isMember = parts.includes(userId)
      otherUid = parts.find(id => id !== userId) || ''
    }

    if (!isMember) continue

    // memberNames에 이름이 있으면 사용, 없으면 DB에서 직접 조회
    let otherName = room.memberNames?.[otherUid]
    if (!otherName || otherName === otherUid) {
      otherName = await resolveUserName(otherUid)
      // 조회된 이름을 Firebase에 캐시해 다음엔 빠르게
      if (otherName && otherName !== otherUid) {
        update(ref(db, `chatRooms/${roomId}/memberNames`), { [otherUid]: otherName }).catch(() => {})
      }
    }

    rooms.push({
      roomId,
      otherUid,
      otherName,
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

  // toName이 없거나 uid 그대로면 DB에서 조회
  const resolvedToName = (!toName || toName === toId)
    ? await resolveUserName(toId)
    : toName

  const resolvedFromName = fromName || await resolveUserName(fromId)

  const roomId  = [fromId, toId].sort().join('__')
  const now     = new Date().toISOString()
  const roomRef = ref(db, `chatRooms/${roomId}`)

  const roomSnap = await get(roomRef)
  if (!roomSnap.exists()) {
    await set(roomRef, {
      members:     { [fromId]: true, [toId]: true },
      memberNames: { [fromId]: resolvedFromName, [toId]: resolvedToName },
      createdAt:   now,
      lastMessage: '',
      lastAt:      now,
      unread:      { [fromId]: 0, [toId]: 0 },
    })
  } else {
    // 기존 방이어도 memberNames 항상 최신으로 갱신
    await update(roomRef, {
      [`memberNames/${fromId}`]: resolvedFromName,
      [`memberNames/${toId}`]:   resolvedToName,
    })
  }

  const msgRef = push(ref(db, `chatMessages/${roomId}`))
  const msg = {
    fromId,
    fromName: resolvedFromName,
    message:  text,
    createdAt: now,
  }
  if (imageUrl) msg.imageUrl = imageUrl
  await set(msgRef, msg)

  const unreadSnap  = await get(ref(db, `chatRooms/${roomId}/unread/${toId}`))
  const unreadCount = (unreadSnap.exists() ? unreadSnap.val() : 0) + 1
  const preview     = imageUrl ? (text ? text.slice(0, 60) : '📷 사진') : text.slice(0, 60)

  await update(roomRef, {
    lastMessage:        preview,
    lastAt:             now,
    [`unread/${toId}`]: unreadCount,
  })

  return Response.json({ id: msgRef.key, ...msg })
}
