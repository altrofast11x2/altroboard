import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, get, set, remove } from 'firebase/database'

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

// GET: ?userId=xxx  → { followers, following, followerCount, followingCount }
// GET: ?followerId=xxx&followingId=xxx → { isFollowing }
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const followerId = searchParams.get('followerId')
  const followingId = searchParams.get('followingId')

  if (followerId && followingId) {
    const snap = await get(ref(db, `follows/${followerId}/${followingId}`))
    return Response.json({ isFollowing: snap.exists() })
  }

  if (userId) {
    const [followingSnap, followersSnap] = await Promise.all([
      get(ref(db, `follows/${userId}`)),
      get(ref(db, 'follows')),
    ])
    const following = followingSnap.exists() ? Object.keys(followingSnap.val()) : []
    let followers = []
    if (followersSnap.exists()) {
      followers = Object.entries(followersSnap.val())
        .filter(([, targets]) => targets[userId])
        .map(([uid]) => uid)
    }
    return Response.json({
      followers,
      following,
      followerCount: followers.length,
      followingCount: following.length,
    })
  }

  return Response.json({ error: 'userId required' }, { status: 400 })
}

// POST: { followerId, followingId } → toggle follow
export async function POST(request) {
  const { followerId, followingId } = await request.json()
  if (!followerId || !followingId)
    return Response.json({ error: '필수 정보가 없습니다' }, { status: 400 })
  if (followerId === followingId)
    return Response.json({ error: '자기 자신은 팔로우할 수 없습니다' }, { status: 400 })

  const followRef = ref(db, `follows/${followerId}/${followingId}`)
  const snap = await get(followRef)

  if (snap.exists()) {
    await remove(followRef)
    return Response.json({ isFollowing: false })
  } else {
    await set(followRef, true)
    return Response.json({ isFollowing: true })
  }
}
