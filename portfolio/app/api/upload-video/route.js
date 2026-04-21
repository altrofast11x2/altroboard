import { put } from '@vercel/blob'

// 대용량 영상 업로드 타임아웃 방지
export const maxDuration = 60

export async function POST(req) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')

    if (!file) return Response.json({ error: '파일이 없습니다' }, { status: 400 })

    const ext = (file.name || '').split('.').pop().toLowerCase()
    if (!['mp4', 'mov', 'webm', 'avi'].includes(ext))
      return Response.json({ error: 'mp4, mov, webm 파일만 가능합니다' }, { status: 400 })

    if (file.size > 50 * 1024 * 1024)
      return Response.json({ error: '50MB 이하만 가능합니다' }, { status: 400 })

    const filename = `shorts/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

    // BLOB_READ_WRITE_TOKEN 은 Vercel 대시보드 → Storage → Blob → 토큰 복사
    const blob = await put(filename, file.stream(), {
      access: 'public',
      token: process.env.MYBOARD_READ_WRITE_TOKEN,
      contentType: file.type || `video/${ext}`,
    })

    return Response.json({ url: blob.url })
  } catch (e) {
    console.error('upload-video error:', e)
    return Response.json({ error: e.message || '업로드 실패' }, { status: 500 })
  }
}
