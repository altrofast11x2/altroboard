import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, push, get, set } from 'firebase/database'
import { hasXSS, stripTags, sanitize, rateLimit, getIP } from '@/lib/security'

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

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const postId = searchParams.get('postId')
  if (!postId) return Response.json({ error: 'postId required' }, { status: 400 })
  const snap = await get(ref(db, `comments/${postId}`))
  if (!snap.exists()) return Response.json([])
  const comments = Object.entries(snap.val())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return Response.json(comments)
}

export async function POST(request) {
  // Rate limiting: IP당 1분에 10개
  const ip = getIP(request)
  if (!rateLimit(`comment:${ip}`, 10, 60 * 1000)) {
    return Response.json({ error: '댓글 작성이 너무 빠릅니다.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: '잘못된 요청' }, { status: 400 })

  const { postId, content, authorId, authorName } = body
  if (!postId || !content?.trim() || !authorId)
    return Response.json({ error: '필수 정보가 없습니다' }, { status: 400 })

  if (hasXSS(content))
    return Response.json({ error: '허용되지 않는 내용이 포함되어 있습니다' }, { status: 400 })

  const newRef  = push(ref(db, `comments/${postId}`))
  const comment = {
    content:    stripTags(content).slice(0, 500),
    authorId,
    authorName: sanitize(authorName || '익명').slice(0, 30),
    createdAt:  new Date().toISOString(),
  }
  await set(newRef, comment)
  return Response.json({ id: newRef.key, ...comment })
}
