import { Redis } from '@upstash/redis'

const redis = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
const KEY = 'study_posts'

export async function GET() {
  const posts = await redis.get(KEY) || []
  return Response.json([...posts].sort((a,b) => b.createdAt.localeCompare(a.createdAt)))
}

export async function POST(req) {
  const body = await req.json()
  const { title, content, tags, period, role } = body
  if (role !== 'admin') return Response.json({ error: '관리자만 작성 가능합니다' }, { status: 403 })
  if (!title || !content) return Response.json({ error: '제목과 내용을 입력하세요' }, { status: 400 })
  const posts = await redis.get(KEY) || []
  const post = { id: Date.now().toString(), title, content, tags: tags || [], period: period || '', createdAt: new Date().toISOString() }
  posts.unshift(post)
  await redis.set(KEY, posts)
  return Response.json(post, { status: 201 })
}
