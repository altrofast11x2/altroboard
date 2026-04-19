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
      // Poll for unread every 10s
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
      const total = rooms.reduce((sum, r) => sum + (r.unread || 0), 0)
      setUnread(total)
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
        {user && (
          <Link href="/chat" className="nav-link" style={{position:'relative'}}>
            메시지
            {unread > 0 && (
              <span style={{
                position:'absolute',top:'-6px',left:'-6px',
                background:'var(--accent2,#e05)',color:'#fff',
                borderRadius:'10px',fontSize:'0.6rem',fontFamily:'var(--mono)',
                padding:'0.05rem 0.35rem',minWidth:'16px',textAlign:'center',
                lineHeight:'1.4', fontWeight: 700,
              }}>{unread > 9 ? '9+' : unread}</span>
            )}
          </Link>
        )}
        {user ? (
          <>
            <Link href={`/profile/${user.id}`} className={`nav-user ${user.role==='admin'?'admin':''}`} style={{cursor:'pointer'}}>
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
