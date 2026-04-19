import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, push, get, set, query, orderByChild, equalTo } from 'firebase/database'

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

export async function findUser(id, password) {
  // 관리자 체크
  if (id === process.env.ADMIN_ID && password === process.env.ADMIN_PW) {
    return { id: 'admin', name: '관리자', email: process.env.ADMIN_ID, role: 'admin' }
  }
  // 일반 유저 체크
  const snap = await get(query(ref(db, 'users'), orderByChild('email'), equalTo(id)))
  if (!snap.exists()) return null
  const entries = Object.entries(snap.val())
  const [uid, user] = entries.find(([, u]) => u.password === password) || []
  if (!uid) return null
  return { id: uid, name: user.name, email: user.email, role: 'user' }
}

export async function findByEmail(email) {
  if (email === process.env.ADMIN_ID) return { exists: true }
  const snap = await get(query(ref(db, 'users'), orderByChild('email'), equalTo(email)))
  return snap.exists() ? snap.val() : null
}

export async function createUser(name, email, password) {
  const newRef = push(ref(db, 'users'))
  const user = { name, email, password, role: 'user', createdAt: new Date().toISOString() }
  await set(newRef, user)
  return { id: newRef.key, name, email, role: 'user' }
}
