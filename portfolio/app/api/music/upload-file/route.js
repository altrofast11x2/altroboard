// 음악 파일 업로드 (mp3/wav, Vercel Blob)
import { put } from '@vercel/blob'
import { verifyActor } from '@/lib/authz'
import { cleanId } from '@/lib/security'

export const maxDuration = 60

export async function POST(request) {
  const formData = await request.formData()
  const file = formData.get('file')
  const userId = cleanId(formData.get('userId'))
  if (!userId) return Response.json({ error: 'userId 누락' }, { status: 400 })

  const actor = await verifyActor(userId)
  if (!actor) return Response.json({ error: '권한 없음' }, { status: 403 })
  const allowed = ['owner','admin'].includes(actor.role) || !!actor.musicAllowed
  if (!allowed) return Response.json({ error: '음악 업로드 권한 없음' }, { status: 403 })

  if (!file || typeof file === 'string')
    return Response.json({ error: '파일이 없습니다' }, { status: 400 })
  const ext = (file.name || '').split('.').pop().toLowerCase()
  if (!['mp3','wav','m4a','ogg'].includes(ext))
    return Response.json({ error: '지원되는 오디오 파일: mp3 / wav / m4a / ogg' }, { status: 400 })
  if (file.size > 15 * 1024 * 1024)
    return Response.json({ error: '15MB 이하만 업로드 가능합니다' }, { status: 400 })

  const filename = `music-files/${userId}_${Date.now()}.${ext}`
  const blob = await put(filename, file, { access: 'public', token: process.env.MYBOARD_READ_WRITE_TOKEN })
  return Response.json({ url: blob.url })
}
