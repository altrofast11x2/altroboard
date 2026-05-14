import { listGalleryPosts, createGalleryPost, isMember, getGallery } from '@/lib/galleries'
import {
  safeJson, cleanId, cleanLine, cleanText, cleanEnum, cleanUrl,
  getClientIp, rateLimit,
} from '@/lib/security'

const CATEGORIES = ['자유', '질문', '공지', '인증', '잡담']

export async function GET(_req, { params }) {
  const { id: raw } = await params
  const galleryId = cleanId(raw)
  if (!galleryId) return Response.json({ error: '잘못된 ID' }, { status: 400 })
  const posts = await listGalleryPosts(galleryId)
  return Response.json(posts)
}

export async function POST(req, { params }) {
  if (!rateLimit(`gallery-post:${getClientIp(req)}`, { windowMs: 60_000, max: 10 }))
    return Response.json({ error: '잠시 후 다시 시도하세요' }, { status: 429 })

  const { id: raw } = await params
  const galleryId = cleanId(raw)
  if (!galleryId) return Response.json({ error: '잘못된 ID' }, { status: 400 })

  const body = await safeJson(req, { maxBytes: 8 * 1024 * 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })

  const title    = cleanLine(body.title, 80)
  const content  = cleanText(body.content, 2000)
  const authorId = cleanId(body.authorId)
  const author   = cleanLine(body.author, 24) || '익명'
  const category = cleanEnum(body.category, CATEGORIES, '자유')

  let imageUrl = null
  if (Array.isArray(body.imageUrl)) {
    imageUrl = body.imageUrl.map(u => cleanUrl(u, { allowData: true })).filter(Boolean).slice(0, 4)
    if (imageUrl.length === 0) imageUrl = null
    else if (imageUrl.length === 1) imageUrl = imageUrl[0]
  } else if (body.imageUrl) {
    imageUrl = cleanUrl(body.imageUrl, { allowData: true })
  }

  if (!title || !content || !authorId)
    return Response.json({ error: '제목·내용·작성자가 필요합니다' }, { status: 400 })

  const g = await getGallery(galleryId)
  if (!g) return Response.json({ error: '없는 갤러리' }, { status: 404 })

  // 멤버만 글쓰기 허용 (방장 포함)
  const member = await isMember(galleryId, authorId)
  if (!member && g.ownerId !== authorId)
    return Response.json({ error: '먼저 가입하세요' }, { status: 403 })

  const post = await createGalleryPost(galleryId, {
    title, content, author, authorId, category, imageUrl,
  })
  return Response.json(post, { status: 201 })
}
