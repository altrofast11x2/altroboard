import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, push, get, set } from 'firebase/database'
import { safeJson, cleanId, cleanLine, cleanText, cleanUrl } from '@/lib/security'
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
const db = getDatabase(app)

export async function GET() {
  const snap = await get(ref(db, 'study'))
  if (!snap.exists()) return Response.json([])
  const posts = Object.entries(snap.val())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  return Response.json(posts)
}

export async function POST(req) {
  const body = await safeJson(req, { maxBytes: 8 * 1024 * 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })

  const userId = cleanId(body.userId)
  const actor = userId ? await verifyActor(userId) : null
  if (!actor || !roleAtLeast(actor.role, 'admin'))
    return Response.json({ error: '관리자만 작성 가능합니다' }, { status: 403 })

  const title = cleanLine(body.title, 80)
  const content = cleanText(body.content, 5000)
  const period = cleanLine(body.period, 40)
  const tags = Array.isArray(body.tags) ? body.tags.map(t => cleanLine(t, 24)).filter(Boolean).slice(0, 8) : []
  const imageUrl = body.imageUrl ? cleanUrl(body.imageUrl, { allowData: true }) : null

  if (!title || !content) return Response.json({ error: '제목과 내용을 입력하세요' }, { status: 400 })
  const newRef = push(ref(db, 'study'))
  const post = { title, content, tags, period, imageUrl, createdAt: new Date().toISOString() }
  await set(newRef, post)
  return Response.json({ id: newRef.key, ...post }, { status: 201 })
}
