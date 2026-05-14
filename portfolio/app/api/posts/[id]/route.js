import { getPost, deletePost, updatePost, incrementViews } from '@/lib/posts'
import { safeJson, cleanId, cleanLine, cleanText, cleanEnum, cleanUrl } from '@/lib/security'
import { verifyActor } from '@/lib/authz'
import { roleAtLeast } from '@/lib/roles'

const CATEGORIES = ['일반','개발','질문','공지','모집','커뮤니티','자유']

export async function GET(_req, { params }) {
  const { id: raw } = await params
  const id = cleanId(raw)
  if (!id) return Response.json({ error: '잘못된 ID' }, { status: 400 })
  const post = await getPost(id)
  if (!post) return Response.json({ error: '없는 글' }, { status: 404 })
  await incrementViews(id)
  return Response.json(post)
}

export async function PUT(req, { params }) {
  const { id: raw } = await params
  const id = cleanId(raw)
  if (!id) return Response.json({ error: '잘못된 ID' }, { status: 400 })

  const body = await safeJson(req, { maxBytes: 8 * 1024 * 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })

  const userId = cleanId(body.userId)
  // 서버에서 actor 실제 등급 확인 — 클라이언트가 보낸 role 은 무시
  const actor = userId ? await verifyActor(userId) : null
  const isStaff = !!actor && roleAtLeast(actor.role, 'admin')

  const post = await getPost(id)
  if (!post) return Response.json({ error: '없는 글' }, { status: 404 })
  if (!isStaff && post.authorId !== userId)
    return Response.json({ error: '수정 권한이 없습니다' }, { status: 403 })

  const updateData = {}
  if (body.title    !== undefined) updateData.title    = cleanLine(body.title, 80)
  if (body.content  !== undefined) updateData.content  = cleanText(body.content, 2000)
  if (body.category !== undefined) updateData.category = cleanEnum(body.category, CATEGORIES, post.category || '일반')
  if ('imageUrl' in body) {
    let img = null
    if (Array.isArray(body.imageUrl)) {
      img = body.imageUrl.map(u => cleanUrl(u, { allowData: true })).filter(Boolean).slice(0, 4)
      if (img.length === 0) img = null
      else if (img.length === 1) img = img[0]
    } else if (body.imageUrl) {
      img = cleanUrl(body.imageUrl, { allowData: true })
    }
    updateData.imageUrl = img
  }

  const updated = await updatePost(id, updateData)
  return Response.json(updated)
}

export async function DELETE(req, { params }) {
  const { id: raw } = await params
  const id = cleanId(raw)
  if (!id) return Response.json({ error: '잘못된 ID' }, { status: 400 })

  const body = await safeJson(req).catch(() => ({})) || {}
  const userId = cleanId(body.userId)
  const actor = userId ? await verifyActor(userId) : null
  const isStaff = !!actor && roleAtLeast(actor.role, 'admin')

  const post = await getPost(id)
  if (!post) return Response.json({ error: '없는 글' }, { status: 404 })
  if (!isStaff && post.authorId !== userId)
    return Response.json({ error: '삭제 권한이 없습니다' }, { status: 403 })
  await deletePost(id)
  return Response.json({ ok: true })
}
