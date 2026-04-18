import { initializeApp, getApps } from 'firebase/app'
import {
  getDatabase, ref, push, get, set, update, remove, runTransaction
} from 'firebase/database'

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

export async function getPosts() {
  const snap = await get(ref(db, 'posts'))
  if (!snap.exists()) return []
  return Object.entries(snap.val())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getPost(id) {
  const snap = await get(ref(db, `posts/${id}`))
  if (!snap.exists()) return null
  return { id, ...snap.val() }
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
