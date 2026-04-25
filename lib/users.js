import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, push, get, set, update, query, orderByChild, equalTo } from 'firebase/database'
import bcrypt from 'bcryptjs'

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

export async function findUser(id, password) {
  // 관리자는 env에서만
  if (id === process.env.ADMIN_ID && password === process.env.ADMIN_PW) {
    return { id: 'admin', name: '관리자', email: process.env.ADMIN_ID, role: 'admin', avatar: null }
  }
  const snap = await get(query(ref(db, 'users'), orderByChild('email'), equalTo(id)))
  if (!snap.exists()) return null

  const entries = Object.entries(snap.val())
  for (const [uid, user] of entries) {
    // bcrypt 해시 비교 (새 형식)
    if (user.password?.startsWith('$2')) {
      const match = await bcrypt.compare(password, user.password)
      if (match) return { id: uid, name: user.name, email: user.email, role: 'user', avatar: user.avatar || null }
    } else {
      // 기존 평문 비밀번호 — 비교 후 자동으로 해시로 업그레이드
      if (user.password === password) {
        const hashed = await bcrypt.hash(password, 10)
        await update(ref(db, `users/${uid}`), { password: hashed })
        return { id: uid, name: user.name, email: user.email, role: 'user', avatar: user.avatar || null }
      }
    }
  }
  return null
}

export async function findByEmail(email) {
  if (email === process.env.ADMIN_ID) return { exists: true }
  const snap = await get(query(ref(db, 'users'), orderByChild('email'), equalTo(email)))
  return snap.exists() ? snap.val() : null
}

export async function createUser(name, email, password) {
  // 비밀번호 bcrypt 해싱
  const hashed  = await bcrypt.hash(password, 10)
  const newRef  = push(ref(db, 'users'))
  const user    = {
    name, email,
    password: hashed,  // 절대 평문 저장 안 함
    role: 'user',      // role은 항상 'user' 고정 (외부에서 admin 불가)
    createdAt: new Date().toISOString(),
    avatar: null, bio: '',
  }
  await set(newRef, user)
  return { id: newRef.key, name, email, role: 'user', avatar: null }
}

export async function getUserById(uid) {
  if (uid === 'admin') return { id: 'admin', name: '관리자', email: process.env.ADMIN_ID, role: 'admin', avatar: null, bio: '' }
  const snap = await get(ref(db, `users/${uid}`))
  if (!snap.exists()) return null
  const u = snap.val()
  // password 절대 반환 안 함
  return { id: uid, name: u.name, email: u.email, role: u.role || 'user', avatar: u.avatar || null, bio: u.bio || '', createdAt: u.createdAt || '' }
}

export async function updateUser(uid, data) {
  const allowed = {}
  if (data.name   !== undefined) allowed.name   = data.name
  if (data.bio    !== undefined) allowed.bio    = data.bio
  if (data.avatar !== undefined) allowed.avatar = data.avatar
  // role, password 업데이트 불가
  await update(ref(db, `users/${uid}`), allowed)
  return getUserById(uid)
}
