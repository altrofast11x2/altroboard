'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

// 메인 페이지 우하단 메시지 플로팅 버튼 (Instagram 스타일).
// - 로그인 사용자에게만 노출 (메인페이지에서 user 가드)
// - 안 읽은 메시지가 있으면 빨간 점 + 카운트 뱃지
// - 클릭 시 /chat 으로 이동

export default function MessageFab() {
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    const raw = typeof window !== 'undefined' && localStorage.getItem('user')
    if (!raw) return
    let cancelled = false
    const tick = async () => {
      try {
        const u = JSON.parse(raw)
        const r = await fetch(`/api/chat/unread?userId=${encodeURIComponent(u.id)}`)
        if (!r.ok) return
        const d = await r.json()
        if (!cancelled) setUnread(Number(d.unread) || 0)
      } catch {}
    }
    tick()
    const t = setInterval(tick, 30000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  return (
    <Link href="/chat" className="msg-fab" aria-label={`메시지 ${unread ? `(읽지 않음 ${unread}개)` : ''}`}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>
      <span className="msg-fab-label">메시지</span>
      {unread > 0 && <span className="msg-fab-dot">{unread > 99 ? '99+' : unread}</span>}
      <style jsx>{`
        .msg-fab{
          position:fixed; right:1.2rem; bottom:1.2rem; z-index:5500;
          display:flex; align-items:center; gap:.55rem;
          padding:.7rem 1.1rem; border-radius:999px;
          background:var(--accent); color:#fff; text-decoration:none;
          box-shadow:0 6px 20px rgba(192,57,43,.35);
          font-family:var(--mono); font-size:.85rem; font-weight:600;
          transition:transform .15s, box-shadow .15s;
        }
        .msg-fab:hover{ transform:translateY(-2px); box-shadow:0 10px 26px rgba(192,57,43,.45); }
        .msg-fab-label{ line-height:1; }
        .msg-fab-dot{
          position:absolute; top:-6px; right:-4px;
          background:#fff; color:var(--accent); border:2px solid var(--accent);
          border-radius:999px; padding:.05rem .4rem;
          font-size:.65rem; font-weight:700; min-width:20px; text-align:center;
        }
        @media (max-width: 600px) {
          .msg-fab{ padding:.65rem .85rem; font-size:.78rem; right:.85rem; bottom:.85rem; }
          .msg-fab-label{ display:none; }
        }
      `}</style>
    </Link>
  )
}
