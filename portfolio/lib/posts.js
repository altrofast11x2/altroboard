import { initializeApp, getApps } from 'firebase/app'
import {
  getDatabase, ref, push, get, set, update, remove, runTransaction
} from 'firebase/database'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL:       process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://placeholder-default-rtdb.firebaseio.com',
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
const db = getDatabase(app)

// likes 노드를 한 번에 읽어 게시글마다 likeCount 를 붙인다.
// 클라이언트가 게시글별로 fetch 호출 안 해도 되게.
export async function getPosts() {
  const [postsSnap, likesSnap] = await Promise.all([
    get(ref(db, 'posts')),
    get(ref(db, 'likes')),
  ])
  if (!postsSnap.exists()) return []
  const likesAll = likesSnap.exists() ? likesSnap.val() : {}
  return Object.entries(postsSnap.val())
    .map(([id, data]) => {
      const likeMap = likesAll[id]
      const likeCount = likeMap && typeof likeMap === 'object' ? Object.keys(likeMap).length : 0
      return { id, ...data, likeCount }
    })
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

export async function getPost(id) {
  const [snap, likesSnap] = await Promise.all([
    get(ref(db, `posts/${id}`)),
    get(ref(db, `likes/${id}`)),
  ])
  if (!snap.exists()) return null
  const likeCount = likesSnap.exists() ? Object.keys(likesSnap.val() || {}).length : 0
  return { id, ...snap.val(), likeCount }
}

export async function createPost(data) {
  const newRef = push(ref(db, 'posts'))
  const post = { ...data, views: 0, createdAt: new Date().toISOString() }
  await set(newRef, post)
  return { id: newRef.key, ...post }
}

export async function updatePost(id, data) {
  const postRef = ref(db, `posts/${id}`)
  const snap = await get(postRef)
  if (!snap.exists()) return null
  const updateData = {}
  if (data.title)    updateData.title    = data.title
  if (data.content)  updateData.content  = data.content
  if (data.category) updateData.category = data.category
  if ('imageUrl' in data) updateData.imageUrl = data.imageUrl
  updateData.updatedAt = new Date().toISOString()
  await update(postRef, updateData)
  return { id, ...snap.val(), ...updateData }
}

export async function deletePost(id) {
  await remove(ref(db, `posts/${id}`))
}

export async function incrementViews(id) {
  await runTransaction(ref(db, `posts/${id}/views`), (cur) => (cur || 0) + 1)
}
