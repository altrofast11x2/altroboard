'use client'
import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function MessageNotification() {
  const [notifs, setNotifs]   = useState([])   // [{id, fromName, preview, roomId, ts}]
  const [unread, setUnread]   = useState(0)
  const prevUnreadRef         = useRef(0)
  const prevRoomsRef          = useRef({})      // roomId → lastAt
  const pollRef               = useRef(null)
  const pathname              = usePathname()
  const router                = useRouter()

  const dismiss = (id) => setNotifs(p => p.filter(n => n.id !== id))

  const checkMessages = async () => {
    const raw = localStorage.getItem('user')
    if (!raw) return
    const u = JSON.parse(raw)

    try {
      const res   = await fetch(`/api/chat?userId=${u.id}`)
      const rooms = await res.json()
      const total = rooms.reduce((s, r) => s + (r.unread || 0), 0)
      setUnread(total)

      // detect newly received messages (room lastAt changed)
      rooms.forEach(r => {
        const prev = prevRoomsRef.current[r.roomId]
        // new message from someone else + unread > 0 + not currently in that chat
        if (
          prev &&
          r.lastAt > prev &&
          r.unread > 0 &&
          !pathname.includes('/chat')
        ) {
          const id = `${r.roomId}_${r.lastAt}`
          setNotifs(p => {
            if (p.find(n => n.id === id)) return p
            const notif = {
              id,
              fromName: r.otherName,
              preview:  r.lastMessage || '새 메시지',
              roomId:   r.roomId,
              otherUid: r.otherUid,
              ts:       Date.now(),
            }
            // auto-dismiss after 5s
            setTimeout(() => dismiss(id), 5000)
            return [...p.slice(-2), notif]   // max 3 notifs
          })
        }
        prevRoomsRef.current[r.roomId] = r.lastAt
      })

      // first-load: set prev without triggering notifs
      if (Object.keys(prevRoomsRef.current).length === 0) {
        rooms.forEach(r => { prevRoomsRef.current[r.roomId] = r.lastAt })
      }
    } catch {}
  }

  useEffect(() => {
    checkMessages()
    pollRef.current = setInterval(checkMessages, 5000)
    return () => clearInterval(pollRef.current)
  }, [pathname])

  if (notifs.length === 0) return null

  return (
    <div className="notif-stack">
      {notifs.map(n => (
        <div key={n.id} className="notif-card" onClick={() => {
          dismiss(n.id)
          router.push(`/chat?with=${n.otherUid}&name=${encodeURIComponent(n.fromName)}`)
        }}>
          <div className="notif-icon">💬</div>
          <div className="notif-body">
            <div className="notif-name">{n.fromName}</div>
            <div className="notif-preview">{n.preview}</div>
          </div>
          <button
            className="notif-close"
            onClick={e => { e.stopPropagation(); dismiss(n.id) }}
          >×</button>
        </div>
      ))}

      <style>{`
        .notif-stack {
          position: fixed;
          top: 72px;
          left: 1rem;
          z-index: 9000;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .notif-card {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          background: var(--ink);
          color: var(--bg);
          border: 1px solid rgba(245,240,232,.15);
          border-left: 3px solid var(--accent2);
          border-radius: 4px;
          padding: 0.65rem 0.9rem;
          cursor: pointer;
          min-width: 240px;
          max-width: 300px;
          box-shadow: 0 4px 20px rgba(0,0,0,.35);
          animation: notif-slide .3s cubic-bezier(.16,1,.3,1);
          transition: opacity .2s, transform .2s;
        }
        .notif-card:hover { opacity: .92; transform: translateX(3px); }
        @keyframes notif-slide {
          from { opacity:0; transform:translateX(-24px); }
          to   { opacity:1; transform:translateX(0); }
        }
        .notif-icon { font-size: 1.2rem; flex-shrink:0; }
        .notif-body { flex:1; min-width:0; }
        .notif-name {
          font-family: var(--mono); font-size:.78rem; font-weight:500;
          color:#fff; margin-bottom:.15rem;
        }
        .notif-preview {
          font-size:.75rem; color:rgba(245,240,232,.6);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .notif-close {
          background:none; border:none; color:rgba(245,240,232,.4);
          font-size:1rem; cursor:pointer; padding:0; line-height:1;
          flex-shrink:0;
        }
        .notif-close:hover { color:#fff; }
      `}</style>
    </div>
  )
}
