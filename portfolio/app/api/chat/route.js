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

    // 그룹 채팅
    if (room.isGroup) {
      rooms.push({
        roomId,
        isGroup: true,
        groupName: room.name || '그룹채팅',
        memberCount: Object.keys(room.members || {}).length,
        memberNames: room.memberNames || {},
        ownerId: room.ownerId || '',
        lastMessage: room.lastMessage || '',
        lastAt: room.lastAt || room.createdAt || '',
        unread: room.unread?.[userId] || 0,
      })
      continue
    }

    // 1:1
    let otherName = room.memberNames?.[otherUid]
    if (!otherName || otherName === otherUid) {
      otherName = await resolveUserName(otherUid)
      if (otherName && otherName !== otherUid) {
        update(ref(db, `chatRooms/${roomId}/memberNames`), { [otherUid]: otherName }).catch(() => {})
      }
    }

    rooms.push({
      roomId,
      isGroup: false,
      otherUid,
      otherName,
      lastMessage: room.lastMessage || '',
      lastAt: room.lastAt || room.createdAt || '',
      unread: room.unread?.[userId] || 0,
    })
  }

  rooms.sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''))
  return Response.json(rooms)
}

// POST { fromId, fromName, toId?, roomId?, message?, imageUrl? }
// - 1:1: toId 지정 (roomId 자동 계산)
// - 그룹: roomId 지정 (그룹은 toId 없음)
export async function POST(request) {
  const body = await request.json()
  const { fromId, fromName, toId, toName, roomId: bodyRoomId, message, imageUrl } = body
  const text = (message || '').trim()

  if (!fromId || (!text && !imageUrl))
    return Response.json({ error: '필수 정보가 없습니다' }, { status: 400 })
  if (!toId && !bodyRoomId)
    return Response.json({ error: 'toId 또는 roomId 필요' }, { status: 400 })

  const resolvedFromName = fromName || await resolveUserName(fromId)
  const now = new Date().toISOString()
  let roomId, roomRef, room

  if (bodyRoomId) {
    // 그룹 메시지 또는 기존 1:1 룸으로 직접 보내기
    roomId = bodyRoomId
    roomRef = ref(db, `chatRooms/${roomId}`)
    const rs = await get(roomRef)
    if (!rs.exists()) return Response.json({ error: '없는 채팅방' }, { status: 404 })
    room = rs.val()
    if (!room.members?.[fromId]) return Response.json({ error: '멤버가 아닙니다' }, { status: 403 })
  } else {
    // 1:1 — 기존 흐름
    const resolvedToName = (!toName || toName === toId) ? await resolveUserName(toId) : toName
    roomId = [fromId, toId].sort().join('__')
    roomRef = ref(db, `chatRooms/${roomId}`)
    const rs = await get(roomRef)
    if (!rs.exists()) {
      await set(roomRef, {
        members: { [fromId]: true, [toId]: true },
        memberNames: { [fromId]: resolvedFromName, [toId]: resolvedToName },
        createdAt: now, lastMessage: '', lastAt: now,
        unread: { [fromId]: 0, [toId]: 0 },
      })
      room = (await get(roomRef)).val()
    } else {
      await update(roomRef, {
        [`memberNames/${fromId}`]: resolvedFromName,
        [`memberNames/${toId}`]:   resolvedToName,
      })
      room = rs.val()
    }
  }

  const msgRef = push(ref(db, `chatMessages/${roomId}`))
  const msg = { fromId, fromName: resolvedFromName, message: text, createdAt: now }
  if (imageUrl) msg.imageUrl = imageUrl
  await set(msgRef, msg)

  // 보낸이 외 모든 멤버 unread +1
  const preview = imageUrl ? (text ? text.slice(0, 60) : '사진') : text.slice(0, 60)
  const updates = { lastMessage: preview, lastAt: now }
  for (const uid of Object.keys(room.members || {})) {
    if (uid === fromId) continue
    const cur = room.unread?.[uid] || 0
    updates[`unread/${uid}`] = cur + 1
  }
  await update(roomRef, updates)

  return Response.json({ id: msgRef.key, ...msg })
}
