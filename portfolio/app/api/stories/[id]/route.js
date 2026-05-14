import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, get, remove, update } from 'firebase/database'
import { verifyActor } from '@/lib/authz'
import { roleAtLeast } from '@/lib/roles'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL:       process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
const db  = getDatabase(app)

// POST /api/stories/[id] → 조회 기록
export async function POST(request, { params }) {
  const { id } = await params
  const { userId } = await request.json()
  if (!userId) return Response.json({ ok: true })

  const storyRef = ref(db, `stories/${id}`)
  const snap     = await get(storyRef)
  if (!snap.exists()) return Response.json({ error: 'not found' }, { status: 404 })

  const story   = snap.val()
  const viewers = story.viewers || {}
  if (!viewers[userId]) {
    await update(storyRef, {
      views:              (story.views || 0) + 1,
      [`viewers/${userId}`]: true,
    })
  }
  return Response.json({ ok: true })
}

// PATCH /api/stories/[id] → 본인 스토리 편집 (텍스트, 자막, 배경, 폰트만)
// 이미지/음악은 수정 안 함 (재업로드 부담 + 단순화)
export async function PATCH(request, { params }) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const { userId, content, caption, bgColor, font } = body

  const snap = await get(ref(db, `stories/${id}`))
  if (!snap.exists()) return Response.json({ error: '스토리를 찾을 수 없습니다' }, { status: 404 })
  const story = snap.val()

  const actor = userId ? await verifyActor(userId) : null
  if (!actor || story.authorId !== userId)
    return Response.json({ error: '편집 권한이 없습니다' }, { status: 403 })

  const patch = {}
  if (typeof content === 'string') {
    const t = content.trim()
    if (t.length > 200) return Response.json({ error: '200자 이하로 작성해주세요' }, { status: 400 })
    patch.content = t
  }
  if (typeof caption === 'string') {
    const c = caption.trim()
    if (c.length > 80) return Response.json({ error: '자막은 80자 이하' }, { status: 400 })
    patch.caption = c
  }
  if (typeof bgColor === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(bgColor)) patch.bgColor = bgColor
  if (typeof font === 'string' && ['sans','serif','mono'].includes(font)) patch.font = font
  if (Object.keys(patch).length === 0) return Response.json({ ok: true })

  patch.updatedAt = new Date().toISOString()
  await update(ref(db, `stories/${id}`), patch)
  return Response.json({ ok: true, ...patch })
}

// DELETE /api/stories/[id] → 삭제 (본인 or 관리자)
export async function DELETE(request, { params }) {
  const { id } = await params
  const { userId, role } = await request.json()

  const snap = await get(ref(db, `stories/${id}`))
  if (!snap.exists()) return Response.json({ error: '스토리를 찾을 수 없습니다' }, { status: 404 })

  const story = snap.val()
  const actor = userId ? await verifyActor(userId) : null
  const isStaff = !!actor && roleAtLeast(actor.role, 'admin')
  if (!isStaff && story.authorId !== userId)
    return Response.json({ error: '삭제 권한이 없습니다' }, { status: 403 })

  await remove(ref(db, `stories/${id}`))
  return Response.json({ ok: true })
}
