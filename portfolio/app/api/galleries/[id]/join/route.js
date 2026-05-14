import { joinGallery, leaveGallery, getGallery } from '@/lib/galleries'
import { safeJson, cleanId, getClientIp, rateLimit } from '@/lib/security'

export async function POST(req, { params }) {
  if (!rateLimit(`gallery-join:${getClientIp(req)}`, { windowMs: 30_000, max: 20 }))
    return Response.json({ error: '잠시 후 다시 시도하세요' }, { status: 429 })

  const { id: raw } = await params
  const galleryId = cleanId(raw)
  if (!galleryId) return Response.json({ error: '잘못된 ID' }, { status: 400 })

  const body = await safeJson(req, { maxBytes: 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })

  const userId = cleanId(body.userId)
  if (!userId) return Response.json({ error: '로그인이 필요합니다' }, { status: 401 })

  const g = await getGallery(galleryId)
  if (!g) return Response.json({ error: '없는 갤러리' }, { status: 404 })

  const action = body.action === 'leave' ? 'leave' : 'join'
  let ok
  if (action === 'leave') ok = await leaveGallery(galleryId, userId)
  else ok = await joinGallery(galleryId, userId)

  return Response.json({ ok, joined: action === 'join' && ok })
}
