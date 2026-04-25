import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, push, get, set, remove } from 'firebase/database'

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

const EXPIRE_MS = 24 * 60 * 60 * 1000 // 24시간

// GET /api/stories → 만료 안된 스토리 목록
export async function GET() {
  const snap = await get(ref(db, 'stories'))
  if (!snap.exists()) return Response.json([])

  const now    = Date.now()
  const all    = []
  const remove_ids = []

  for (const [id, s] of Object.entries(snap.val())) {
    if (now - new Date(s.createdAt).getTime() > EXPIRE_MS) {
      remove_ids.push(id)
      continue
    }
    all.push({ id, ...s })
  }

  // 만료된 스토리 삭제 (비동기 fire-and-forget)
  remove_ids.forEach(id => remove(ref(db, `stories/${id}`)).catch(() => {}))

  all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return Response.json(all)
}

// POST /api/stories → 스토리 생성
export async function POST(request) {
  const { authorId, authorName, authorAvatar, content, bgColor, emoji, font, imageUrl, music } = await request.json()
  if (!authorId || (!content?.trim() && !imageUrl))
    return Response.json({ error: '필수 정보가 없습니다' }, { status: 400 })
  if (content && content.trim().length > 200)
    return Response.json({ error: '200자 이하로 작성해주세요' }, { status: 400 })

  const newRef = push(ref(db, 'stories'))
  const story  = {
    authorId,
    authorName:   authorName   || '익명',
    authorAvatar: authorAvatar || null,
    content:      content.trim(),
    bgColor:      bgColor      || '#1a1208',
    emoji:        emoji        || '',
    font:         font         || 'sans',
    imageUrl:     imageUrl     || null,
    music:        music        || null,
    views:        0,
    viewers:      {},
    createdAt:    new Date().toISOString(),
  }
  await set(newRef, story)
  return Response.json({ id: newRef.key, ...story })
}
