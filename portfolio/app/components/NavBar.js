'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

export default function NavBar() {
  const [user,       setUser]       = useState(null)
  const [unread,     setUnread]     = useState(0)
  const [menuOpen,   setMenuOpen]   = useState(false)
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

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // 페이지 이동 시 메뉴 닫기
  useEffect(() => { setMenuOpen(false) }, [pathname])

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

  const links = [
    { href: '/',        label: '홈' },
    { href: '/board',   label: '게시판' },
    { href: '/study',   label: '학습' },
    { href: '/data',    label: '외부데이터' },
    { href: '/stories', label: '스토리' },
    { href: '/shorts',  label: '쇼츠' },
  ]

  return (
    <>
      <nav className="navbar" ref={menuRef}>
        <Link href="/" className="nav-logo">Cozy<span>Board</span></Link>

        {/* 데스크탑 링크 */}
        <div className="nav-links-desktop" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1 }}>
          {links.map(l => (
            <Link key={l.href} href={l.href} className="nav-link">{l.label}</Link>
          ))}
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
                }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
          )}
        </div>

        {/* 데스크탑 유저 영역 */}
        <div className="nav-links-desktop" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
        </div>

        {/* 모바일 우측: 유저+햄버거 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }} className="mobile-only">
          {user && (
            <Link href="/chat" style={{ position: 'relative' }}>
              <span style={{ color: 'rgba(245,240,232,0.7)', fontSize: '1.1rem' }}>💬</span>
              {unread > 0 && (
                <span style={{
                  position: 'absolute', top: '-4px', right: '-6px',
                  background: '#e53935', color: '#fff', borderRadius: '10px',
                  fontSize: '0.55rem', fontFamily: 'var(--mono)', fontWeight: 700,
                  padding: '0.05rem 0.3rem', minWidth: '15px', textAlign: 'center', lineHeight: '1.5',
                }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
          )}
          <button className="hamburger-btn" onClick={() => setMenuOpen(v => !v)} aria-label="메뉴">
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* 모바일 드롭다운 메뉴 */}
        {menuOpen && (
          <div className="nav-mobile-menu">
            {links.map(l => (
              <Link key={l.href} href={l.href} className="nav-link" onClick={() => setMenuOpen(false)}>{l.label}</Link>
            ))}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '0.5rem', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {user ? (
                <>
                  <Link href="/mypage" className={`nav-user ${user.role === 'admin' ? 'admin' : ''}`} style={{ fontSize: '0.85rem', padding: '0.4rem 0' }}>
                    {user.avatar ? <img src={user.avatar} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', marginRight: 6, verticalAlign: 'middle' }} /> : null}
                    {user.role === 'admin' ? '👑 ' : ''}{user.name}
                  </Link>
                  <button className="nav-btn" onClick={() => { logout(); setMenuOpen(false) }} style={{ width: '100%', textAlign: 'center' }}>로그아웃</button>
                </>
              ) : (
                <Link href="/login" onClick={() => setMenuOpen(false)}>
                  <button className="nav-btn accent" style={{ width: '100%' }}>로그인</button>
                </Link>
              )}
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
        .hamburger-btn { display: none; }
        .mobile-only { display: none; }
        .nav-mobile-menu { display: none; }
        @media (max-width: 768px) {
          .nav-links-desktop { display: none !important; }
          .hamburger-btn { display: flex !important; }
          .mobile-only { display: flex !important; }
        }
      `}</style>
    </>
  )
}
