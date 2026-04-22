import { getPosts, createPost } from '@/lib/posts'

export async function GET() {
  const posts = await getPosts()
  return Response.json(posts)
}

export async function POST(req) {
  const body = await req.json()
  const { title, content, author, authorId, category, imageUrl } = body
  if (!title || !content) return Response.json({ error: '제목과 내용을 입력하세요' }, { status: 400 })
  const post = await createPost({
    title,
    content,
    author: author || '익명',
    authorId: authorId || null,
    category: category || '일반',
    imageUrl: imageUrl || null,
  })
  return Response.json(post, { status: 201 })
}
