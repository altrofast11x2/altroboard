'use client'
import { useEffect } from 'react'

// 일반 유저용 개발자 도구 접근 차단.
// developer/tester/admin/owner 역할은 예외 (디버깅 가능).
//
// 한계: 100% 차단은 불가능 (브라우저 메뉴로 가능). 일반 사용자 기준 진입 장벽 + 호기심 차단.
// 차단 항목:
//   - F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Cmd+Opt+I/J/C
//   - Ctrl+U (소스 보기), Ctrl+S (저장)
//   - 우클릭 (contextmenu)
//   - dragstart (드래그로 이미지 저장 차단)
//
// 사용자가 developer 모드 활성화 시(localStorage 'altroboard_dev=1') 도 예외.

const EXEMPT_ROLES = new Set(['developer', 'tester', 'admin', 'owner'])

export default function DevToolsGuard() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    // 역할 확인
    let role = 'user'
    try {
      const raw = localStorage.getItem('user')
      if (raw) role = (JSON.parse(raw).role || 'user').toLowerCase()
    } catch {}
    if (EXEMPT_ROLES.has(role)) return
    if (localStorage.getItem('altroboard_dev') === '1') return  // 개발 토글

    const blockKey = (e) => {
      const k = e.key || ''
      // F12
      if (k === 'F12') { e.preventDefault(); e.stopPropagation(); return false }
      // Ctrl/Cmd + Shift + I/J/C (DevTools open)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && /^(i|j|c|I|J|C)$/.test(k)) {
        e.preventDefault(); e.stopPropagation(); return false
      }
      // Ctrl/Cmd + U (View source)
      if ((e.ctrlKey || e.metaKey) && (k === 'u' || k === 'U')) {
        e.preventDefault(); e.stopPropagation(); return false
      }
      // Ctrl/Cmd + S (Save)
      if ((e.ctrlKey || e.metaKey) && (k === 's' || k === 'S')) {
        e.preventDefault(); e.stopPropagation(); return false
      }
    }
    const blockCtx  = (e) => { e.preventDefault(); return false }
    const blockDrag = (e) => { e.preventDefault(); return false }

    window.addEventListener('keydown', blockKey, true)
    window.addEventListener('contextmenu', blockCtx, true)
    window.addEventListener('dragstart', blockDrag, true)

    return () => {
      window.removeEventListener('keydown', blockKey, true)
      window.removeEventListener('contextmenu', blockCtx, true)
      window.removeEventListener('dragstart', blockDrag, true)
    }
  }, [])

  return null
}
