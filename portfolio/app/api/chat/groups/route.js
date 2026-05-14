// 그룹 채팅방 생성 + 멤버 관리
// POST   /api/chat/groups       body { actorId, name, memberIds:[uid,...] }  → 생성
// PATCH  /api/chat/groups       body { actorId, roomId, action: 'addMember'|'removeMember'|'leave'|'rename', memberId?, name? }

import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, get, set, update, remove, push } from 'firebase/database'
import { safeJson, cleanId, cleanLine, cleanEnum, getClientIp, rateLimit } from '@/lib/security'
import { verifyActor } from '@/lib/authz'

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

async function getName(uid) {
  if (!uid) return ''
  if (uid === 'admin') return '관리자'
  try {
    const s = await get(ref(db, `users/${uid}`))
    if (s.exists()) return s.val().name || uid
  } catch {}
  return uid
}

export async function POST(req) {
  if (!rateLimit(`group:${getClientIp(req)}`, { windowMs: 60_000, max: 5 }))
    return Response.json({ error: '잠시 후 다시 시도하세요' }, { status: 429 })

  const body = await safeJson(req, { maxBytes: 16 * 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })

  const actorId = cleanId(body.actorId)
  const name = cleanLine(body.name, 40)
  const memberIds = Array.isArray(body.memberIds) ? body.memberIds.map(cleanId).filter(Boolean).slice(0, 30) : []
  if (!actorId || !name) return Response.json({ error: '이름과 작성자가 필요합니다' }, { status: 400 })
  if (memberIds.length === 0) return Response.json({ error: '멤버를 한 명 이상 선택하세요' }, { status: 400 })

  const actor = await verifyActor(actorId)
  if (!actor) return Response.json({ error: '권한 없음' }, { status: 403 })

  // 본인 포함
  const allMembers = Array.from(new Set([actorId, ...memberIds]))
  if (allMembers.length < 2) return Response.json({ error: '최소 2명 필요' }, { status: 400 })

  const members = {}
  const memberNames = {}
  for (const uid of allMembers) {
    members[uid] = true
    memberNames[uid] = await getName(uid)
  }
  const unread = {}
  for (const uid of allMembers) unread[uid] = 0

  const newRef = push(ref(db, 'chatRooms'))
  const now = new Date().toISOString()
  const room = {
    isGroup: true,
    name,
    ownerId: actorId,
    members,
    memberNames,
    createdAt: now,
    lastMessage: '',
    lastAt: now,
    unread,
  }
  await set(newRef, room)
  return Response.json({ roomId: newRef.key, ...room }, { status: 201 })
}

export async function PATCH(req) {
  const body = await safeJson(req, { maxBytes: 8 * 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })

  const actorId = cleanId(body.actorId)
  const roomId = cleanId(body.roomId)
  const action = cleanEnum(body.action, ['addMember', 'removeMember', 'leave', 'rename'])
  if (!actorId || !roomId || !action) return Response.json({ error: '필수 정보 누락' }, { status: 400 })

  const actor = await verifyActor(actorId)
  if (!actor) return Response.json({ error: '권한 없음' }, { status: 403 })

  const roomSnap = await get(ref(db, `chatRooms/${roomId}`))
  if (!roomSnap.exists()) return Response.json({ error: '없는 채팅방' }, { status: 404 })
  const room = roomSnap.val()
  if (!room.isGroup) return Response.json({ error: '1:1 채팅에서 사용할 수 없는 동작' }, { status: 400 })
  if (!room.members?.[actorId]) return Response.json({ error: '멤버가 아닙니다' }, { status: 403 })

  if (action === 'addMember') {
    const memberId = cleanId(body.memberId)
    if (!memberId) return Response.json({ error: '멤버 ID 누락' }, { status: 400 })
    const memberName = await getName(memberId)
    await update(ref(db, `chatRooms/${roomId}`), {
      [`members/${memberId}`]: true,
      [`memberNames/${memberId}`]: memberName,
      [`unread/${memberId}`]: 0,
    })
    return Response.json({ ok: true })
  }
  if (action === 'removeMember') {
    const memberId = cleanId(body.memberId)
    if (!memberId) return Response.json({ error: '멤버 ID 누락' }, { status: 400 })
    if (room.ownerId !== actorId) return Response.json({ error: '방장만 가능' }, { status: 403 })
    await update(ref(db, `chatRooms/${roomId}`), {
      [`members/${memberId}`]: null,
      [`memberNames/${memberId}`]: null,
      [`unread/${memberId}`]: null,
    })
    return Response.json({ ok: true })
  }
  if (action === 'leave') {
    const remaining = Object.keys(room.members || {}).filter(id => id !== actorId)
    if (remaining.length === 0) {
      // 마지막 멤버면 방 삭제
      await remove(ref(db, `chatRooms/${roomId}`))
      await remove(ref(db, `chatMessages/${roomId}`))
    } else {
      const updates = {
        [`members/${actorId}`]: null,
        [`memberNames/${actorId}`]: null,
        [`unread/${actorId}`]: null,
      }
      // 방장이 나가면 다음 사람에게 권한 이양
      if (room.ownerId === actorId) updates.ownerId = remaining[0]
      await update(ref(db, `chatRooms/${roomId}`), updates)
    }
    return Response.json({ ok: true })
  }
  if (action === 'rename') {
    const newName = cleanLine(body.name, 40)
    if (!newName) return Response.json({ error: '이름이 비었습니다' }, { status: 400 })
    if (room.ownerId !== actorId) return Response.json({ error: '방장만 가능' }, { status: 403 })
    await update(ref(db, `chatRooms/${roomId}`), { name: newName })
    return Response.json({ ok: true })
  }
  return Response.json({ error: '알 수 없는 액션' }, { status: 400 })
}
