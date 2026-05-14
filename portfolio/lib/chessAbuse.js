// 체스 항복 abuse 추적 — 항복은 정상 행위지만 단시간 다수 항복은 랭킹 부정행위(deflation/sandbagging) 가능성.
// 정책: 사용자별로 하루 5회 항복하면 그날은 체스 플레이 정지 + 관리자에게 부정행위 의심 리포트.
//
// 데이터 구조:
//   chess_resigns/{userId}/{YYYY-MM-DD}: count           — 일별 카운트
//   cheat_reports/{autoId}: { type, userId, userName, date, count, reason, createdAt, resolved }

import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, get, runTransaction, push, set, update } from 'firebase/database'

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

export const RESIGN_LIMIT_PER_DAY = 5

// UTC 가 아니라 한국 사용자 기준 → KST 로 일자 키 생성
export function todayKstKey() {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10) // YYYY-MM-DD
}

// 오늘 항복 횟수 조회
export async function getTodayResignCount(userId) {
  const day = todayKstKey()
  const snap = await get(ref(db, `chess_resigns/${userId}/${day}`))
  return snap.exists() ? Number(snap.val()) || 0 : 0
}

// 차단 여부
export async function isResignBlocked(userId) {
  const count = await getTodayResignCount(userId)
  return { blocked: count >= RESIGN_LIMIT_PER_DAY, count, limit: RESIGN_LIMIT_PER_DAY, date: todayKstKey() }
}

// 항복 1회 기록 + 임계치 도달 시 부정행위 의심 리포트 생성
// 반환: { count, blocked, reported }
export async function recordResign(userId, userName) {
  const day = todayKstKey()
  const countRef = ref(db, `chess_resigns/${userId}/${day}`)
  const res = await runTransaction(countRef, (cur) => (cur || 0) + 1)
  const count = res.snapshot.val()

  let reported = false
  if (count >= RESIGN_LIMIT_PER_DAY) {
    // 같은 사용자/날짜에 이미 리포트가 있으면 중복 안 만듦
    const dedupKey = `${userId}_${day}`
    const existed = await get(ref(db, `cheat_reports_index/${dedupKey}`))
    if (!existed.exists()) {
      const newRef = push(ref(db, 'cheat_reports'))
      await set(newRef, {
        type:       'chess_resign_abuse',
        userId,
        userName:   userName || userId,
        date:       day,
        count,
        limit:      RESIGN_LIMIT_PER_DAY,
        reason:     `하루(${day}) 항복 ${count}회 — 한도(${RESIGN_LIMIT_PER_DAY}) 초과로 부정행위 의심`,
        resolved:   false,
        createdAt:  new Date().toISOString(),
      })
      await set(ref(db, `cheat_reports_index/${dedupKey}`), newRef.key)
      reported = true
    }
  }
  return { count, blocked: count >= RESIGN_LIMIT_PER_DAY, reported }
}

// 관리자 페이지용 — 전체 부정행위 의심 목록 (최신순)
export async function getCheatReports() {
  const snap = await get(ref(db, 'cheat_reports'))
  if (!snap.exists()) return []
  return Object.entries(snap.val())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

// 관리자: 리포트 해결 처리 (resolved=true) 또는 삭제
export async function resolveCheatReport(reportId, resolved) {
  await update(ref(db, `cheat_reports/${reportId}`), { resolved: !!resolved, resolvedAt: new Date().toISOString() })
}
