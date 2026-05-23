import { put } from '@vercel/blob'
import { getClientIp, rateLimit } from '@/lib/security'

export const maxDuration = 60

const ALLOWED_EXT = ['mp3','wav','ogg','m4a','aac']
const ALLOWED_MIME = ['audio/mpeg','audio/mp3','audio/wav','audio/wave','audio/x-wav','audio/ogg','audio/mp4','audio/aac','audio/x-m4a']
const MAX_BYTES = 10 * 1024 * 1024

// 매직 바이트 검사 (오디오 파일 위장 방지)
function looksLikeAudio(bytes) {
  // MP3 (ID3 또는 frame sync)
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true  // 'ID3'
  if (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) return true              // MP3 frame sync
  // WAV
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) return true
  // OGG
  if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return true
  // M4A/MP4 (ftyp box)
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return true
  return false
}

export async function POST(req) {
  if (!rateLimit(`upload-audio:${getClientIp(req)}`, { windowMs: 60_000, max: 8 }))
    return Response.json({ error: '잠시 후 다시 시도하세요' }, { status: 429 })

  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') return Response.json({ error: '파일이 없습니다' }, { status: 400 })

    const ext = (file.name || '').split('.').pop().toLowerCase()
    if (!ALLOWED_EXT.includes(ext))
      return Response.json({ error: 'mp3/wav/ogg 파일만 가능합니다' }, { status: 400 })
    if (file.type && !ALLOWED_MIME.includes(file.type))
      return Response.json({ error: '허용되지 않는 형식입니다' }, { status: 400 })
    if (file.size > MAX_BYTES)
      return Response.json({ error: '10MB 이하 오디오만 가능합니다' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    if (!looksLikeAudio(bytes))
      return Response.json({ error: '파일 내용이 오디오가 아닙니다' }, { status: 400 })

    const filename = `audio/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const blob = await put(filename, Buffer.from(arrayBuffer), {
      access: 'public',
      token: process.env.MYBOARD_READ_WRITE_TOKEN,
      contentType: file.type || `audio/${ext}`,
    })
    return Response.json({ url: blob.url, name: file.name })
  } catch (e) {
    return Response.json({ error: e.message || '업로드 실패' }, { status: 500 })
  }
}
