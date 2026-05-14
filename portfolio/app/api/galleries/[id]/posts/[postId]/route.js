import {
  getGalleryPost, deleteGalleryPost, updateGalleryPost,
  incrementGalleryPostViews, getGallery,
} from '@/lib/galleries'
import { safeJson, cleanId, cleanLine, cleanText, cleanEnum, cleanUrl } from '@/lib/security'
import { verifyActor } from '@/lib/authz'
import { roleAtLeast } from '@/lib/roles'

const CATEGORIES = ['자유', '질문', '공지', '인증', '잡담']

export async function GET(_req, { params }) {
  const { id, postId } = await params
  const gid = cleanId(id), pid = cleanId(postId)
  if (!gid || !pid) return Response.json({ error: '잘못된 ID' }, { status: 400 })
  const post = await getGalleryPost(gid, pid)
  if (!post) return Response.json({ error: '없는 글' }, { status: 404 })
  await incrementGalleryPostViews(gid, pid)
  return Response.json(post)
}

export async function PUT(req, { params }) {
  const { id, postId } = await params
  const gid = cleanId(id), pid = cleanId(postId)
  if (!gid || !pid) return Response.json({ error: '잘못된 ID' }, { status: 400 })

  const body = await safeJson(req, { maxBytes: 8 * 1024 * 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })

  const userId = cleanId(body.userId)
  const actor = userId ? await verifyActor(userId) : null
  const isStaff = !!actor && roleAtLeast(actor.role, 'admin')

  const g = await getGallery(gid)
  const post = await getGalleryPost(gid, pid)
  if (!g || !post) return Response.json({ error: '없는 글' }, { status: 404 })
  if (!isStaff && post.authorId !== userId && g.ownerId !== userId)
    return Response.json({ error: '수정 권한이 없습니다' }, { status: 403 })

  const data = {}
  if (body.title    !== undefined) data.title    = cleanLine(body.title, 80)
  if (body.content  !== undefined) data.content  = cleanText(body.content, 2000)
  if (body.category !== undefined) data.category = cleanEnum(body.category, CATEGORIES, post.category || '자유')
  if ('imageUrl' in body) {
    let img = null
    if (Array.isArray(body.imageUrl)) {
      img = body.imageUrl.map(u => cleanUrl(u, { allowData: true })).filter(Boolean).slice(0, 4)
      if (img.length === 0) img = null
      else if (img.length === 1) img = img[0]
    } else if (body.imageUrl) {
      img = cleanUrl(body.imageUrl, { allowData: true })
    }
    data.imageUrl = img
  }
  const updated = await updateGalleryPost(gid, pid, data)
  return Response.json(updated)
}

export async function DELETE(req, { params }) {
  const { id, postId } = await params
  const gid = cleanId(id), pid = cleanId(postId)
  if (!gid || !pid) return Response.json({ error: '잘못된 ID' }, { status: 400 })

  const body = await safeJson(req).catch(() => ({})) || {}
  const userId = cleanId(body.userId)
  const actor = userId ? await verifyActor(userId) : null
  const isStaff = !!actor && roleAtLeast(actor.role, 'admin')

  const g = await getGallery(gid)
  const post = await getGalleryPost(gid, pid)
  if (!g || !post) return Response.json({ error: '없는 글' }, { status: 404 })
  if (!isStaff && post.authorId !== userId && g.ownerId !== userId)
    return Response.json({ error: '삭제 권한이 없습니다' }, { status: 403 })

  await deleteGalleryPost(gid, pid)
  return Response.json({ ok: true })
}
