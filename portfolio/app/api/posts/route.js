import { getPosts, createPost } from '@/lib/posts'
import {
  safeJson, cleanLine, cleanText, cleanEnum, cleanId, cleanUrl,
  getClientIp, rateLimit,
} from '@/lib/security'

const CATEGORIES = ['일반','개발','질문','공지','모집','커뮤니티','자유']

export async function GET() {
  const posts = await getPosts()
  return Response.json(posts)
}

export async function POST(req) {
  if (!rateLimit(`posts:${getClientIp(req)}`, { windowMs: 60_000, max: 10 }))
    return Response.json({ error: '잠시 후 다시 시도하세요' }, { status: 429 })

  const body = await safeJson(req, { maxBytes: 8 * 1024 * 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })

  const title = cleanLine(body.title, 80)
  const content = cleanText(body.content, 2000)
  const author = cleanLine(body.author, 24) || '익명'
  const authorId = cleanId(body.authorId)
  const category = cleanEnum(body.category, CATEGORIES, '일반')

  // imageUrl: 단일 문자열 또는 문자열 배열, base64 data URL 허용
  let imageUrl = null
  if (Array.isArray(body.imageUrl)) {
    imageUrl = body.imageUrl
      .map(u => cleanUrl(u, { allowData: true }))
      .filter(Boolean)
      .slice(0, 4)
    if (imageUrl.length === 0) imageUrl = null
    else if (imageUrl.length === 1) imageUrl = imageUrl[0]
  } else if (body.imageUrl) {
    imageUrl = cleanUrl(body.imageUrl, { allowData: true })
  }

  if (!title || !content) return Response.json({ error: '제목과 내용을 입력하세요' }, { status: 400 })

  // 음악 첨부 (라이브러리에서 선택된 곡 — 이미 승인된 곡이므로 권한 검증 불필요)
  let music = null
  if (body.music && typeof body.music === 'object') {
    const mUrl = cleanUrl(body.music.url)
    if (mUrl) {
      music = {
        url: mUrl,
        title:  String(body.music.title || '').slice(0, 80),
        author: String(body.music.author || '').slice(0, 60),
        thumbnail: String(body.music.thumbnail || '').slice(0, 500),
      }
    }
  }

  const post = await createPost({ title, content, author, authorId, category, imageUrl, music })
  return Response.json(post, { status: 201 })
}
