// 음악 업로드 / 목록 API
//
// GET ?status=approved|pending|rejected&uploaderId=...
//   → 음악 목록. 기본은 approved 만 반환 (라이브러리용).
//   pending/rejected 조회는 admin/owner 권한 필요.
//
// POST { uploaderId, title, artist, coverUrl, fileUrl }
//   → 새 음악 업로드 (status='pending'). musicAllowed=true 또는 owner/admin 만 가능.

import { listMusic, createMusic } from '@/lib/music'
import { verifyActor, requireRole } from '@/lib/authz'
import { safeJson, cleanId, cleanLine, cleanUrl } from '@/lib/security'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'approved'
  const uploaderId = cleanId(searchParams.get('uploaderId'))
  const actorId = cleanId(searchParams.get('actorId'))

  // pending / rejected 는 admin 이상 또는 본인 업로드만
  if (status !== 'approved') {
    if (uploaderId && actorId === uploaderId) {
      // 본인 업로드 조회 — OK
    } else {
      const actor = await requireRole(actorId, 'admin')
      if (!actor) return Response.json({ error: '권한 없음' }, { status: 403 })
    }
  }

  const list = await listMusic({ status, uploaderId })
  return Response.json(list)
}

export async function POST(req) {
  const body = await safeJson(req, { maxBytes: 16 * 1024 })
  if (!body) return Response.json({ error: '잘못된 요청' }, { status: 400 })

  const uploaderId = cleanId(body.uploaderId)
  if (!uploaderId) return Response.json({ error: 'uploaderId 누락' }, { status: 400 })
  const actor = await verifyActor(uploaderId)
  if (!actor) return Response.json({ error: '권한 없음' }, { status: 403 })

  // musicAllowed 또는 owner/admin 만 업로드 가능
  const allowed = ['owner','admin'].includes(actor.role) || !!actor.musicAllowed
  if (!allowed) return Response.json({ error: '음악 업로드 권한이 없습니다. 관리자에게 문의해주세요.' }, { status: 403 })

  const title  = cleanLine(body.title, 100)
  const artist = cleanLine(body.artist, 80)
  const coverUrl = cleanUrl(body.coverUrl)
  const fileUrl  = cleanUrl(body.fileUrl)
  if (!title)   return Response.json({ error: '곡 제목을 입력하세요' }, { status: 400 })
  if (!fileUrl) return Response.json({ error: '음악 파일을 업로드하세요' }, { status: 400 })

  const data = await createMusic({
    uploaderId,
    uploaderName: actor.name || uploaderId,
    uploaderAvatar: actor.avatar || null,
    title, artist, coverUrl, fileUrl,
  })
  return Response.json(data, { status: 201 })
}
