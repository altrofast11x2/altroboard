import { handleUpload } from '@vercel/blob/client'

// Vercel Blob 클라이언트 업로드 토큰 발급 엔드포인트
export async function POST(request) {
  const body = await request.json()

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const ext = pathname.split('.').pop().toLowerCase()
        const allowed = ['mp4', 'mov', 'webm', 'avi']
        if (!allowed.includes(ext)) {
          throw new Error('mp4, mov, webm 파일만 업로드 가능합니다')
        }
        return {
          allowedContentTypes: ['video/mp4', 'video/quicktime', 'video/webm', 'video/avi'],
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB
          tokenPayload: JSON.stringify({ uploadedAt: new Date().toISOString() }),
        }
      },
      onUploadCompleted: async ({ blob }) => {
        console.log('Video upload completed:', blob.url)
      },
    })
    return Response.json(jsonResponse)
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 })
  }
}
