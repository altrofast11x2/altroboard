import {
  listGalleryPostComments, createGalleryPostComment,
  deleteGalleryPostComment, getGalleryPostComment, getGallery,
} from '@/lib/galleries'
import { safeJson, cleanId, cleanLine, cleanText, getClientIp, rateLimit } from '@/lib/security'
import { verifyActor } from '@/lib/authz'
import { roleAtLeast } from '@/lib/roles'

export async function GET(_req, { params }) {
  const { id, postId } = await params
  const gid = cleanId(id), pid = cleanId(postId)
  if (!gid || !pid) return Response.json({ error: '잘못된 ID' }, { status: 400 })
  return Response.json(await listGalleryPostComments(gid, pid))
}

export async function POST(req, { params }) {
  if (!rateLimit(`gallery-comment:${getClientIp(req)}`, { windowMs: 30_000, max: 10 }))
    return Response.json({ error: '잠시 후 다시 시도하세요' }, { status: 429 })

  const { id, postId } = await params
  const gid = cleanId(id), pid = cleanId(postId)
  if (!gid || !pid) return Response.json({ error: '잘못된 ID' }, { status: 400 })

  const body = await safeJson(req, { maxBytes: 32 * 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })

  const content    = cleanText(body.content, 600)
  const authorId   = cleanId(body.authorId)
  const authorName = cleanLine(body.authorName, 24) || '익명'
  if (!content || !authorId) return Response.json({ error: '필수 정보가 없습니다' }, { status: 400 })

  const c = await createGalleryPostComment(gid, pid, { content, authorId, authorName })
  return Response.json(c, { status: 201 })
}

export async function DELETE(req, { params }) {
  const { id, postId } = await params
  const gid = cleanId(id), pid = cleanId(postId)
  if (!gid || !pid) return Response.json({ error: '잘못된 ID' }, { status: 400 })

  const url = new URL(req.url)
  const commentId = cleanId(url.searchParams.get('commentId'))
  const userId    = cleanId(url.searchParams.get('userId'))
  if (!commentId) return Response.json({ error: '잘못된 댓글 ID' }, { status: 400 })

  const actor = userId ? await verifyActor(userId) : null
  const isStaff = !!actor && roleAtLeast(actor.role, 'admin')

  const c = await getGalleryPostComment(gid, pid, commentId)
  if (!c) return Response.json({ error: '없는 댓글' }, { status: 404 })
  const g = await getGallery(gid)
  if (!isStaff && c.authorId !== userId && g?.ownerId !== userId)
    return Response.json({ error: '삭제 권한이 없습니다' }, { status: 403 })

  await deleteGalleryPostComment(gid, pid, commentId)
  return Response.json({ ok: true })
}
