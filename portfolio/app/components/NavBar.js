'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

export default function NavBar() {
  const [user,     setUser]     = useState(null)
  const [unread,   setUnread]   = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const router   = useRouter()
  const pollRef  = useRef(null)
  const menuRef  = useRef(null)

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (u) {
      const parsed = JSON.parse(u)
      setUser(parsed)
      fetchUnread(parsed.id)
      pollRef.current = setInterval(() => fetchUnread(parsed.id), 10000)
    } else {
      setUser(null); setUnread(0)
      if (pollRef.current) clearInterval(pollRef.current)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [pathname])

  useEffect(() => { setMenuOpen(false) }, [pathname])

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchUnread = async (userId) => {
    try {
      const res = await fetch(`/api/chat?userId=${userId}`)
      const rooms = await res.json()
      if (Array.isArray(rooms)) setUnread(rooms.reduce((s, r) => s + (r.unread || 0), 0))
    } catch {}
  }

  const logout = () => {
    localStorage.removeItem('user')
    setUser(null); setUnread(0)
    router.push('/')
  }

  return (
    <>
      <nav className="navbar" ref={menuRef}>
        <Link href="/" className="nav-logo">Cozy<span>Board</span></Link>

        {/* 데스크탑 링크 - 원본 그대로 */}
        <div className="nav-desktop">
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
                  : null}
                {user.role === 'admin' ? '👑 ' : ''}{user.name}
              </Link>
              <button className="nav-btn" onClick={logout}>로그아웃</button>
            </>
          ) : (
            <Link href="/login"><button className="nav-btn accent">로그인</button></Link>
          )}
        </div>

        {/* 모바일 우측 */}
        <div className="nav-mobile">
          {user && unread > 0 && (
            <Link href="/chat" style={{ position: 'relative', marginRight: '0.5rem' }}>
              <span style={{ color: 'rgba(245,240,232,0.7)', fontSize: '0.75rem', fontFamily: 'var(--mono)' }}>메시지</span>
              <span style={{
                position: 'absolute', top: '-5px', right: '-10px',
                background: '#e53935', color: '#fff', borderRadius: '10px',
                fontSize: '0.55rem', fontFamily: 'var(--mono)', fontWeight: 700,
                padding: '0.05rem 0.3rem', minWidth: '15px', textAlign: 'center',
              }}>{unread > 9 ? '9+' : unread}</span>
            </Link>
          )}
          <button
            onClick={() => setMenuOpen(v => !v)}
            style={{
              background: 'none', border: '1px solid rgba(245,240,232,0.25)',
              color: 'rgba(245,240,232,0.8)', width: 36, height: 36,
              borderRadius: 2, cursor: 'pointer', fontSize: '0.9rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* 모바일 드롭다운 */}
        {menuOpen && (
          <div style={{
            position: 'absolute', top: '60px', left: 0, right: 0,
            background: 'var(--ink)', zIndex: 99,
            borderBottom: '1px solid rgba(245,240,232,0.1)',
            padding: '0.5rem 0',
          }}>
            {[
              { href: '/', label: '홈' },
              { href: '/board', label: '게시판' },
              { href: '/study', label: '학습' },
              { href: '/data', label: '외부데이터' },
              { href: '/stories', label: '스토리' },
              { href: '/shorts', label: '쇼츠' },
              ...(user ? [{ href: '/chat', label: '메시지' }, { href: '/mypage', label: user.name }] : []),
            ].map(l => (
              <Link key={l.href} href={l.href} className="nav-link"
                style={{ display: 'block', padding: '0.7rem 1.5rem', borderBottom: '1px solid rgba(245,240,232,0.06)', fontSize: '0.85rem' }}>
                {l.label}
              </Link>
            ))}
            <div style={{ padding: '0.75rem 1.5rem' }}>
              {user
                ? <button className="nav-btn" onClick={() => { logout(); setMenuOpen(false) }} style={{ width: '100%' }}>로그아웃</button>
                : <Link href="/login"><button className="nav-btn accent" style={{ width: '100%' }}>로그인</button></Link>
              }
            </div>
          </div>
        )}
      </nav>

      {user?.role === 'admin' && (
        <div className="admin-banner">
          <div className="admin-dot" />
          관리자 모드 — 모든 게시글 삭제 및 학습 내용 관리 가능
        </div>
      )}

      <style>{`
        .nav-desktop { display: flex; align-items: center; gap: 1.5rem; }
        .nav-mobile  { display: none; align-items: center; margin-left: auto; }
        @media (max-width: 768px) {
          .nav-desktop { display: none; }
          .nav-mobile  { display: flex; }
          .navbar { position: relative; }
        }
      `}</style>
    </>
  )
}
