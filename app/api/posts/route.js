import { getPosts, createPost } from '@/lib/posts'
import { hasXSS, stripTags, sanitize, rateLimit, getIP } from '@/lib/security'

export async function GET() {
  const posts = await getPosts()
  return Response.json(posts)
}

export async function POST(req) {
  // Rate limiting: IP당 1분에 5개
  const ip = getIP(req)
  if (!rateLimit(`post:${ip}`, 5, 60 * 1000)) {
    return Response.json({ error: '게시글 작성이 너무 빠릅니다. 잠시 후 다시 시도해주세요.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: '잘못된 요청입니다' }, { status: 400 })

  const { title, content, author, authorId, category, imageUrl } = body

  if (!title?.trim() || !content?.trim())
    return Response.json({ error: '제목과 내용을 입력하세요' }, { status: 400 })
  if (!authorId)
    return Response.json({ error: '로그인이 필요합니다' }, { status: 401 })

  // XSS 감지 및 차단
  if (hasXSS(title) || hasXSS(content) || hasXSS(author))
    return Response.json({ error: '허용되지 않는 내용이 포함되어 있습니다' }, { status: 400 })

  // 허용 카테고리만
  const allowed = ['일반','개발','질문','공지','모집','커뮤니티','갤러리','자유']
  const safeCategory = allowed.includes(category) ? category : '일반'

  const post = await createPost({
    title:    stripTags(title).slice(0, 100),
    content:  stripTags(content).slice(0, 5000),
    author:   sanitize(author || '익명').slice(0, 30),
    authorId: authorId,
    category: safeCategory,
    imageUrl: imageUrl || null,
  })
  return Response.json(post, { status: 201 })
}
