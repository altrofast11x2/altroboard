// 갤러리(클럽/모임) 데이터 모듈
// 디시인사이드의 "갤러리" 또는 당근모임의 "모임" 컨셉.
// - 사용자가 갤러리를 직접 생성한다
// - 생성된 갤러리 내부에 게시글(질문/자유/등)이 쌓인다
// - 회원이 갤러리에 "가입"하면 멤버로 등록된다 (별도 차단 정책은 두지 않음)
//
// 데이터 경로:
//   galleries/{galleryId} = { name, slug, description, ownerId, ownerName, icon, color, memberCount, postCount, createdAt }
//   galleries/{galleryId}/members/{userId} = { joinedAt }
//   galleries/{galleryId}/posts/{postId} = { title, content, authorId, authorName, category, imageUrl, views, likes, createdAt }
//   galleries/{galleryId}/posts/{postId}/comments/{commentId} = { content, authorId, authorName, createdAt }

import { initializeApp, getApps } from 'firebase/app'
import {
  getDatabase, ref, push, get, set, update, remove, runTransaction,
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
const db  = getDatabase(app)

// ── slug 정규화 (URL-safe) ──────────────────────────────────────
export function makeSlug(name) {
  const s = String(name || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  return s || `g${Date.now().toString(36)}`
}

// ── 갤러리 ─────────────────────────────────────────────────────
export async function listGalleries() {
  const snap = await get(ref(db, 'galleries'))
  if (!snap.exists()) return []
  return Object.entries(snap.val()).map(([id, g]) => ({
    id,
    name: g.name,
    slug: g.slug,
    description: g.description || '',
    ownerId: g.ownerId,
    ownerName: g.ownerName,
    iconUrl: g.iconUrl || null,
    color: g.color || '#c0392b',
    memberCount: g.memberCount || 0,
    postCount: g.postCount || 0,
    createdAt: g.createdAt,
  })).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

export async function getGallery(id) {
  const snap = await get(ref(db, `galleries/${id}`))
  if (!snap.exists()) return null
  const g = snap.val()
  return {
    id,
    name: g.name, slug: g.slug, description: g.description || '',
    ownerId: g.ownerId, ownerName: g.ownerName,
    iconUrl: g.iconUrl || null, color: g.color || '#c0392b',
    memberCount: g.memberCount || 0, postCount: g.postCount || 0,
    createdAt: g.createdAt,
  }
}

export async function createGallery({ name, description, iconUrl, color, ownerId, ownerName }) {
  const newRef = push(ref(db, 'galleries'))
  const slug = makeSlug(name)
  const data = {
    name, slug, description: description || '',
    ownerId, ownerName,
    iconUrl: iconUrl || null, color: color || '#c0392b',
    memberCount: 1, postCount: 0,
    createdAt: new Date().toISOString(),
  }
  await set(newRef, data)
  // owner 는 자동 가입
  await set(ref(db, `galleries/${newRef.key}/members/${ownerId}`), { joinedAt: data.createdAt })
  return { id: newRef.key, ...data }
}

export async function deleteGallery(id) {
  await remove(ref(db, `galleries/${id}`))
}

// ── 멤버십 ─────────────────────────────────────────────────────
export async function joinGallery(galleryId, userId) {
  const memberRef = ref(db, `galleries/${galleryId}/members/${userId}`)
  const existing = await get(memberRef)
  if (existing.exists()) return false
  await set(memberRef, { joinedAt: new Date().toISOString() })
  await runTransaction(ref(db, `galleries/${galleryId}/memberCount`), (n) => (n || 0) + 1)
  return true
}

export async function leaveGallery(galleryId, userId) {
  const memberRef = ref(db, `galleries/${galleryId}/members/${userId}`)
  const existing = await get(memberRef)
  if (!existing.exists()) return false
  await remove(memberRef)
  await runTransaction(ref(db, `galleries/${galleryId}/memberCount`), (n) => Math.max(0, (n || 1) - 1))
  return true
}

export async function isMember(galleryId, userId) {
  if (!userId) return false
  const snap = await get(ref(db, `galleries/${galleryId}/members/${userId}`))
  return snap.exists()
}

// ── 갤러리 내 게시글 ───────────────────────────────────────────
export async function listGalleryPosts(galleryId) {
  const snap = await get(ref(db, `galleries/${galleryId}/posts`))
  if (!snap.exists()) return []
  return Object.entries(snap.val()).map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.createdAt || '').localeCompare(a.createdAt || ''))
}

export async function getGalleryPost(galleryId, postId) {
  const snap = await get(ref(db, `galleries/${galleryId}/posts/${postId}`))
  if (!snap.exists()) return null
  return { id: postId, ...snap.val() }
}

export async function createGalleryPost(galleryId, data) {
  const newRef = push(ref(db, `galleries/${galleryId}/posts`))
  const post = {
    title: data.title, content: data.content,
    author: data.author, authorId: data.authorId,
    category: data.category || '자유',
    imageUrl: data.imageUrl ?? null,
    views: 0, likes: 0,
    createdAt: new Date().toISOString(),
  }
  await set(newRef, post)
  await runTransaction(ref(db, `galleries/${galleryId}/postCount`), (n) => (n || 0) + 1)
  return { id: newRef.key, ...post }
}

export async function updateGalleryPost(galleryId, postId, data) {
  const postRef = ref(db, `galleries/${galleryId}/posts/${postId}`)
  const snap = await get(postRef)
  if (!snap.exists()) return null
  const updateData = { updatedAt: new Date().toISOString() }
  if (data.title    !== undefined) updateData.title    = data.title
  if (data.content  !== undefined) updateData.content  = data.content
  if (data.category !== undefined) updateData.category = data.category
  if ('imageUrl' in data) updateData.imageUrl = data.imageUrl
  await update(postRef, updateData)
  return { id: postId, ...snap.val(), ...updateData }
}

export async function deleteGalleryPost(galleryId, postId) {
  await remove(ref(db, `galleries/${galleryId}/posts/${postId}`))
  await runTransaction(ref(db, `galleries/${galleryId}/postCount`), (n) => Math.max(0, (n || 1) - 1))
}

export async function incrementGalleryPostViews(galleryId, postId) {
  await runTransaction(ref(db, `galleries/${galleryId}/posts/${postId}/views`), (n) => (n || 0) + 1)
}

// ── 갤러리 게시글 댓글 ─────────────────────────────────────────
export async function listGalleryPostComments(galleryId, postId) {
  const snap = await get(ref(db, `galleries/${galleryId}/posts/${postId}/comments`))
  if (!snap.exists()) return []
  return Object.entries(snap.val()).map(([id, c]) => ({ id, ...c }))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
}

export async function createGalleryPostComment(galleryId, postId, data) {
  const newRef = push(ref(db, `galleries/${galleryId}/posts/${postId}/comments`))
  const c = {
    content: data.content,
    authorId: data.authorId,
    authorName: data.authorName,
    createdAt: new Date().toISOString(),
  }
  await set(newRef, c)
  return { id: newRef.key, ...c }
}

export async function deleteGalleryPostComment(galleryId, postId, commentId) {
  await remove(ref(db, `galleries/${galleryId}/posts/${postId}/comments/${commentId}`))
}

export async function getGalleryPostComment(galleryId, postId, commentId) {
  const snap = await get(ref(db, `galleries/${galleryId}/posts/${postId}/comments/${commentId}`))
  if (!snap.exists()) return null
  return { id: commentId, ...snap.val() }
}
