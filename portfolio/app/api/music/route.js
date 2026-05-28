// 음악 업로드 / 목록 API
//
// GET ?status=approved|pending|rejected|all&uploaderId=...
//   → 음악 목록. 기본은 approved 만 반환 (라이브러리용).
//   pending/rejected 조회는 admin/owner 권한 필요.
//   uploaderId === actorId 인 경우 본인 업로드는 status 무관 조회 가능.
//
// POST { uploaderId, title, artist, coverUrl, fileUrl }
//   → 새 음악 업로드. owner/admin 은 자동 승인(approved), 그 외 권한자는 pending.

import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, push, set, get } from 'firebase/database'
import { listMusic } from '@/lib/music'
import { verifyActor, requireRole } from '@/lib/authz'
import { safeJson, cleanId, cleanLine, cleanUrl } from '@/lib/security'

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

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'approved'
  const uploaderId = cleanId(searchParams.get('uploaderId'))
  const actorId = cleanId(searchParams.get('actorId'))

  // pending / rejected / all 은 admin 이상 또는 본인 업로드만
  if (status !== 'approved') {
    if (uploaderId && actorId === uploaderId) {
      // 본인 업로드 조회 — OK
    } else {
      const actor = await requireRole(actorId, 'admin')
      if (!actor) return Response.json({ error: '권한 없음' }, { status: 403 })
    }
  }

  // status=all 인 경우 status 필터 없이 전체 (admin 또는 본인 업로드)
  const filterStatus = status === 'all' ? null : status
  const list = await listMusic({ status: filterStatus, uploaderId })
  return Response.json(list)
}

export async function POST(req) {
  try {
    const body = await safeJson(req, { maxBytes: 16 * 1024 })
    if (!body) return Response.json({ error: '잘못된 요청 본문' }, { status: 400 })

    const uploaderId = cleanId(body.uploaderId)
    if (!uploaderId) return Response.json({ error: 'uploaderId 누락' }, { status: 400 })
    const actor = await verifyActor(uploaderId)
    if (!actor) return Response.json({ error: '계정 인증 실패' }, { status: 403 })

    // musicAllowed 또는 owner/admin 만 업로드 가능
    const isStaff = ['owner','admin'].includes(actor.role)
    const allowed = isStaff || !!actor.musicAllowed
    if (!allowed) return Response.json({ error: '음악 업로드 권한이 없습니다. 관리자에게 문의해주세요.' }, { status: 403 })

    const title  = cleanLine(body.title, 100)
    const artist = cleanLine(body.artist, 80)
    const coverUrl = cleanUrl(body.coverUrl)
    const fileUrl  = cleanUrl(body.fileUrl)
    if (!title)   return Response.json({ error: '곡 제목을 입력하세요' }, { status: 400 })
    if (!fileUrl) return Response.json({ error: '음악 파일을 업로드하세요' }, { status: 400 })

    // owner/admin 은 자동 승인 (본인이 관리자라 검토 불필요)
    const status = isStaff ? 'approved' : 'pending'

    // Firebase 직접 호출 — 명시적 에러 캡처
    const newRef = push(ref(db, 'music_uploads'))
    const now = new Date().toISOString()
    const data = {
      uploaderId,
      uploaderName: actor.name || uploaderId,
      uploaderAvatar: actor.avatar || null,
      title, artist,
      coverUrl: coverUrl || null,
      fileUrl,
      status,
      autoApproved: isStaff,
      reviewerId: isStaff ? uploaderId : null,
      reviewedAt: isStaff ? now : null,
      createdAt: now,
    }
    await set(newRef, data)
    return Response.json({ id: newRef.key, ...data }, { status: 201 })
  } catch (e) {
    // 명확한 에러 메시지 (네트워크 오류 대신 실제 원인)
    const msg = e?.message || 'Firebase 저장 실패'
    return Response.json({ error: `음악 저장 실패: ${msg}` }, { status: 500 })
  }
}
