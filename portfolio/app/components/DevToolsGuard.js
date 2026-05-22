'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// 개발자 도구 / 우클릭 접근 차단.
//
// 정책:
//   1) 일반 사용자(user) — 모든 페이지에서 F12 / Ctrl+Shift+I/J/C / Ctrl+U / Ctrl+S /
//      우클릭 / 드래그 차단.
//   2) developer / tester / admin / owner — 평소엔 예외 (디버깅 가능).
//      단, **게임 페이지** (/agar /slither /diep /chess/room /poker/room) 에서는
//      모든 사용자(owner 포함) 의 우클릭/드래그 차단 — 게임 중 메뉴 뜨는 거 방지.
//   3) localStorage.altroboard_dev='1' 설정 = 자기 자신 디버그용 우회 (게임 페이지 제외).
//
// 한계: 100% 차단은 불가능 (브라우저 메뉴 → 도구 → 개발자 도구). 진입 장벽 + 호기심 차단용.

const EXEMPT_ROLES = new Set(['developer', 'tester', 'admin', 'owner'])

const GAME_PREFIX = ['/agar', '/slither', '/diep']
const GAME_ROOM_PREFIX = ['/chess/room', '/poker/room']

function isGamePage(pathname) {
  if (!pathname) return false
  if (GAME_PREFIX.includes(pathname)) return true
  return GAME_ROOM_PREFIX.some(p => pathname.startsWith(p))
}

export default function DevToolsGuard() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === 'undefined') return
    let role = 'user'
    try {
      const raw = localStorage.getItem('user')
      if (raw) role = (JSON.parse(raw).role || 'user').toLowerCase()
    } catch {}
    const devToggle = localStorage.getItem('altroboard_dev') === '1'
    const onGame    = isGamePage(pathname)
    const isExempt  = EXEMPT_ROLES.has(role) || devToggle

    // 게임 페이지: 우클릭/드래그는 모두에게 차단 (DevTools 키는 예외 사용자만 허용)
    // 비게임 페이지: 예외 사용자면 모두 허용
    const blockCtxAndDrag = onGame || !isExempt
    const blockKeys       = !isExempt

    if (!blockCtxAndDrag && !blockKeys) return  // 완전 예외

    const blockKey = (e) => {
      if (!blockKeys) return
      const k = e.key || ''
      if (k === 'F12') { e.preventDefault(); e.stopPropagation(); return false }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && /^(i|j|c|I|J|C)$/.test(k)) {
        e.preventDefault(); e.stopPropagation(); return false
      }
      if ((e.ctrlKey || e.metaKey) && (k === 'u' || k === 'U')) {
        e.preventDefault(); e.stopPropagation(); return false
      }
      if ((e.ctrlKey || e.metaKey) && (k === 's' || k === 'S')) {
        e.preventDefault(); e.stopPropagation(); return false
      }
    }
    const blockCtx  = (e) => { if (blockCtxAndDrag) { e.preventDefault(); return false } }
    const blockDrag = (e) => { if (blockCtxAndDrag) { e.preventDefault(); return false } }

    if (blockKeys)       window.addEventListener('keydown',     blockKey,  true)
    if (blockCtxAndDrag) window.addEventListener('contextmenu', blockCtx,  true)
    if (blockCtxAndDrag) window.addEventListener('dragstart',   blockDrag, true)

    return () => {
      window.removeEventListener('keydown',     blockKey,  true)
      window.removeEventListener('contextmenu', blockCtx,  true)
      window.removeEventListener('dragstart',   blockDrag, true)
    }
  }, [pathname])

  return null
}
