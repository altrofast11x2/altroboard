'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

export default function NavBar() {
  const [user, setUser] = useState(null)
  const [unread, setUnread] = useState(0)
  const pathname = usePathname()
  const router = useRouter()
  const pollRef = useRef(null)

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (u) {
      const parsed = JSON.parse(u)
      setUser(parsed)
      fetchUnread(parsed.id)
      pollRef.current = setInterval(() => fetchUnread(parsed.id), 10000)
    } else {
      setUser(null)
      setUnread(0)
      if (pollRef.current) clearInterval(pollRef.current)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [pathname])

  const fetchUnread = async (userId) => {
    try {
      const res = await fetch(`/api/chat?userId=${userId}`)
      const rooms = await res.json()
      if (Array.isArray(rooms)) {
        const total = rooms.reduce((sum, r) => sum + (r.unread || 0), 0)
        setUnread(total)
      }
    } catch {}
  }

  const logout = () => {
    localStorage.removeItem('user')
    setUser(null)
    setUnread(0)
    router.push('/')
  }

  return (
    <>
      <nav className="navbar">
        <Link href="/" className="nav-logo">Cozy<span>Board</span></Link>
        <Link href="/" className="nav-link">홈</Link>
        <Link href="/board" className="nav-link">게시판</Link>
        <Link href="/study" className="nav-link">학습</Link>
        <Link href="/data" className="nav-link">외부데이터</Link>
        <Link href="/stories" className="nav-link">스토리</Link>
        <Link href="/shorts" className="nav-link">쇼츠</Link>
        {user && (
          <Link href="/chat" className="nav-link" style={{ position: 'relative' }}>
            메시지
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: '-7px', right: '-14px',
                background: '#e53935', color: '#fff',
                borderRadius: '10px', fontSize: '0.58rem', fontFamily: 'var(--mono)',
                fontWeight: 700, padding: '0.08rem 0.38rem',
                minWidth: '17px', textAlign: 'center', lineHeight: '1.5',
                boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
              }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>
        )}
        {user ? (
          <>
            <Link href="/mypage" className={`nav-user ${user.role === 'admin' ? 'admin' : ''}`}>
              {user.avatar
                ? <img src={user.avatar} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', marginRight: 4, verticalAlign: 'middle' }} />
                : null
              }
              {user.role === 'admin' ? '👑 ' : ''}{user.name}
            </Link>
            <button className="nav-btn" onClick={logout}>로그아웃</button>
          </>
        ) : (
          <Link href="/login"><button className="nav-btn accent">로그인</button></Link>
        )}
      </nav>
      {user?.role === 'admin' && (
        <div className="admin-banner">
          <div className="admin-dot" />
          관리자 모드 — 모든 게시글 삭제 및 학습 내용 관리 가능
        </div>
      )}
    </>
  )
}
