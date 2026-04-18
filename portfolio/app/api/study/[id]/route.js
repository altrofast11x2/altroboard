import { Redis } from '@upstash/redis'

const redis = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
const KEY = 'study_posts'

export async function DELETE(req, { params }) {
  const body = await req.json().catch(()=>({}))
  if (body.role !== 'admin') return Response.json({ error: '관리자만 삭제 가능합니다' }, { status: 403 })
  const { id } = await params
  const posts = await redis.get(KEY) || []
  await redis.set(KEY, posts.filter(p => p.id !== id))
  return Response.json({ ok: true })
}
