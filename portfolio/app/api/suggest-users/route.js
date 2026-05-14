import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, get } from 'firebase/database'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
const db  = getDatabase(app)

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const limit  = parseInt(searchParams.get('limit') || '6')

  const [postsSnap, followsSnap, usersSnap] = await Promise.all([
    get(ref(db, 'posts')),
    get(ref(db, 'follows')),
    get(ref(db, 'users')),
  ])

  const alreadyFollowing = new Set()
  if (userId && followsSnap.exists()) {
    const myFollows = followsSnap.val()[userId] || {}
    Object.keys(myFollows).forEach(id => alreadyFollowing.add(id))
  }

  const scores = {}

  // 친구의 친구 +3
  if (userId && followsSnap.exists()) {
    const allFollows = followsSnap.val()
    alreadyFollowing.forEach(fid => {
      Object.keys(allFollows[fid] || {}).forEach(id => {
        if (id !== userId && !alreadyFollowing.has(id))
          scores[id] = (scores[id] || 0) + 3
      })
    })
  }

  // 나를 팔로우 중인데 맞팔 안 한 사람 +5
  if (userId && followsSnap.exists()) {
    Object.entries(followsSnap.val()).forEach(([fid, targets]) => {
      if (fid !== userId && targets[userId] && !alreadyFollowing.has(fid))
        scores[fid] = (scores[fid] || 0) + 5
    })
  }

  // 게시글 활동 +1
  if (postsSnap.exists()) {
    Object.values(postsSnap.val()).forEach(p => {
      if (p.authorId && p.authorId !== userId && !alreadyFollowing.has(p.authorId))
        scores[p.authorId] = (scores[p.authorId] || 0) + 1
    })
  }

  const users = usersSnap.exists() ? usersSnap.val() : {}
  const result = Object.entries(scores)
    .filter(([id]) => id !== userId)
    .sort(([,a],[,b]) => b - a)
    .slice(0, limit)
    .map(([id, score]) => {
      const u = users[id] || {}
      return { id, name: u.name || id, avatar: u.avatar || null, bio: u.bio || '', score }
    })

  return Response.json(result)
}
