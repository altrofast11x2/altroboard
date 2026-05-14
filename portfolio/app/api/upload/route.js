import { getClientIp, rateLimit } from '@/lib/security'

const ALLOWED_EXT  = ['jpg','jpeg','png','gif','webp']
const ALLOWED_MIME = ['image/jpeg','image/png','image/gif','image/webp']
const MAX_BYTES    = 5 * 1024 * 1024

// 매직 바이트로 실제 파일 형식 검사 (확장자 위조 방지)
function detectMime(bytes) {
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png'
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif'
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp'
  return null
}

export async function POST(req) {
  if (!rateLimit(`upload:${getClientIp(req)}`, { windowMs: 60_000, max: 20 }))
    return Response.json({ error: '잠시 후 다시 시도하세요' }, { status: 429 })

  const formData = await req.formData()
  const file = formData.get('file')
  if (!file || typeof file === 'string') return Response.json({ error: '파일이 없습니다' }, { status: 400 })

  const ext = (file.name || '').split('.').pop().toLowerCase()
  if (!ALLOWED_EXT.includes(ext))
    return Response.json({ error: '이미지 파일만 업로드 가능합니다' }, { status: 400 })
  if (!ALLOWED_MIME.includes(file.type))
    return Response.json({ error: '허용되지 않는 형식입니다' }, { status: 400 })
  if (file.size > MAX_BYTES)
    return Response.json({ error: '5MB 이하만 업로드 가능합니다' }, { status: 400 })

  const arrayBuffer = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  const detected = detectMime(bytes)
  if (!detected || !ALLOWED_MIME.includes(detected))
    return Response.json({ error: '파일 내용이 이미지가 아닙니다' }, { status: 400 })

  const base64 = Buffer.from(arrayBuffer).toString('base64')
  return Response.json({ url: `data:${detected};base64,${base64}` })
}
