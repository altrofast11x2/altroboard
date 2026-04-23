import { handleUpload } from '@vercel/blob/client'

export const maxDuration = 300

export async function POST(request) {
  try {
    const body = await request.json()
    const res = await handleUpload({
      body,
      request,
      token: process.env.MYBOARD_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname) => ({
        allowedContentTypes: ['video/mp4','video/quicktime','video/webm','video/avi','video/x-msvideo'],
        maximumSizeInBytes: 500 * 1024 * 1024, // 500MB
        addRandomSuffix: false,
        tokenPayload: pathname,
      }),
      onUploadCompleted: async ({ blob }) => {
        console.log('video uploaded:', blob.url)
      },
    })
    return Response.json(res)
  } catch (e) {
    return Response.json({ error: e.message || '업로드 실패' }, { status: 400 })
  }
}
