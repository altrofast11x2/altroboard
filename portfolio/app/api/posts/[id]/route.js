import { getPost, deletePost, updatePost, incrementViews } from '@/lib/posts'

export async function GET(req, { params }) {
  const { id } = await params
  const post = await getPost(id)
  if (!post) return Response.json({ error: '없는 글' }, { status: 404 })
  await incrementViews(id)
  return Response.json(post)
}

export async function PUT(req, { params }) {
  const { id } = await params
  const body = await req.json()
  const { userId, role, ...updateData } = body
  const post = await getPost(id)
  if (!post) return Response.json({ error: '없는 글' }, { status: 404 })
  if (role !== 'admin' && post.authorId !== userId)
    return Response.json({ error: '수정 권한이 없습니다' }, { status: 403 })
  const updated = await updatePost(id, updateData)
  return Response.json(updated)
}

export async function DELETE(req, { params }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { userId, role } = body
  const post = await getPost(id)
  if (!post) return Response.json({ error: '없는 글' }, { status: 404 })
  if (role !== 'admin' && post.authorId !== userId)
    return Response.json({ error: '삭제 권한이 없습니다' }, { status: 403 })
  await deletePost(id)
  return Response.json({ ok: true })
}
