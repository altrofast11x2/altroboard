import { listGalleries, createGallery } from '@/lib/galleries'
import {
  safeJson, cleanId, cleanLine, cleanText, cleanUrl,
  getClientIp, rateLimit,
} from '@/lib/security'

export async function GET() {
  const list = await listGalleries()
  return Response.json(list)
}

export async function POST(req) {
  if (!rateLimit(`galleries:${getClientIp(req)}`, { windowMs: 60_000, max: 4 }))
    return Response.json({ error: '잠시 후 다시 시도하세요' }, { status: 429 })

  // 아이콘 이미지(data URL)가 들어올 수 있어 512KB 까지 허용
  const body = await safeJson(req, { maxBytes: 1024 * 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })

  const name        = cleanLine(body.name, 30)
  const description = cleanText(body.description, 300)
  const ownerId     = cleanId(body.ownerId)
  const ownerName   = cleanLine(body.ownerName, 24) || '익명'
  const iconUrl     = body.iconUrl ? cleanUrl(body.iconUrl, { allowData: true }) : null
  const color       = /^#[0-9a-fA-F]{6}$/.test(body.color) ? body.color : '#c0392b'

  if (!name || !ownerId) return Response.json({ error: '이름과 작성자가 필요합니다' }, { status: 400 })

  const gallery = await createGallery({ name, description, iconUrl, color, ownerId, ownerName })
  return Response.json(gallery, { status: 201 })
}
