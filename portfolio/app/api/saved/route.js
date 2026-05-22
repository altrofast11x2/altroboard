// 게시글 저장 (북마크) API
//   GET ?userId=...         → { savedIds: [postId,...] }
//   GET ?userId=...&postId=... → { saved: boolean }
//   POST { userId, postId } → toggle ({ saved })
//
// 데이터 구조: saved_posts/{userId}/{postId} = createdAt (ms)
//
import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, get, set, remove } from 'firebase/database'
import { safeJson, cleanId } from '@/lib/security'
import { verifyActor } from '@/lib/authz'

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

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const userId = cleanId(searchParams.get('userId'))
  const postId = cleanId(searchParams.get('postId'))
  if (!userId) return Response.json({ error: 'userId required' }, { status: 400 })

  if (postId) {
    const snap = await get(ref(db, `saved_posts/${userId}/${postId}`))
    return Response.json({ saved: snap.exists() })
  }

  const snap = await get(ref(db, `saved_posts/${userId}`))
  if (!snap.exists()) return Response.json({ savedIds: [] })
  const data = snap.val() || {}
  const savedIds = Object.entries(data)
    .map(([id, ts]) => ({ id, ts: Number(ts) || 0 }))
    .sort((a, b) => b.ts - a.ts)
    .map(x => x.id)
  return Response.json({ savedIds })
}

export async function POST(req) {
  const body = await safeJson(req, { maxBytes: 2 * 1024 })
  if (!body) return Response.json({ error: '잘못된 요청' }, { status: 400 })
  const userId = cleanId(body.userId)
  const postId = cleanId(body.postId)
  if (!userId || !postId) return Response.json({ error: '필수 정보 누락' }, { status: 400 })
  const actor = await verifyActor(userId)
  if (!actor) return Response.json({ error: '권한 없음' }, { status: 403 })

  const node = ref(db, `saved_posts/${userId}/${postId}`)
  const snap = await get(node)
  if (snap.exists()) {
    await remove(node)
    return Response.json({ saved: false })
  } else {
    await set(node, Date.now())
    return Response.json({ saved: true })
  }
}
