// 영상 직접 업로드 (multipart) — dev 환경에서 client-side `@vercel/blob` 콜백이
// localhost 를 못 호출하는 문제를 우회한다. 100MB 까지 서버가 받아 Vercel Blob 에 put.
//
// 큰 영상(100MB+)은 클라이언트 측 압축이 선행되어야 한다.

import { put } from '@vercel/blob'
import { getClientIp, rateLimit } from '@/lib/security'

export const maxDuration = 300

const ALLOWED_MIME = [
  'video/mp4', 'video/quicktime', 'video/webm', 'video/avi',
  'video/x-msvideo', 'video/x-matroska',
]
const MAX_BYTES = 100 * 1024 * 1024 // 100MB (서버 라우트 한계 고려)

export async function POST(req) {
  if (!rateLimit(`upload-video:${getClientIp(req)}`, { windowMs: 60_000, max: 6 }))
    return Response.json({ error: '잠시 후 다시 시도하세요' }, { status: 429 })

  try {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string')
      return Response.json({ error: '파일이 없습니다' }, { status: 400 })

    if (file.type && !ALLOWED_MIME.includes(file.type))
      return Response.json({ error: '허용되지 않는 형식입니다 (mp4/mov/webm/avi/mkv)' }, { status: 400 })

    if (file.size > MAX_BYTES)
      return Response.json({
        error: `100MB 이하 영상만 업로드 가능합니다. (현재 ${Math.round(file.size/1024/1024)}MB) — 압축이 자동 적용되어야 합니다.`
      }, { status: 400 })

    const ext = (file.name || 'video.mp4').split('.').pop().toLowerCase()
    const allowedExt = ['mp4','mov','webm','avi','mkv']
    if (!allowedExt.includes(ext))
      return Response.json({ error: '허용되지 않는 확장자' }, { status: 400 })

    const filename = `shorts/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const arrayBuffer = await file.arrayBuffer()
    const blob = await put(filename, Buffer.from(arrayBuffer), {
      access: 'public',
      token: process.env.MYBOARD_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN,
      contentType: file.type || `video/${ext === 'mov' ? 'quicktime' : ext}`,
    })
    return Response.json({ url: blob.url })
  } catch (e) {
    console.error('upload-video-direct error', e)
    return Response.json({ error: e.message || '업로드 실패' }, { status: 500 })
  }
}
