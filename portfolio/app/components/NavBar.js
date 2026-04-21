'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const LABELS = {
  en: { home:'Home', board:'Board', study:'Study', data:'External Data', stories:'Stories', shorts:'Shorts', messages:'Messages', mypage:'My Page', logout:'Logout', login:'Login', admin:'Admin Mode — Can delete all posts and manage study content' },
  ko: { home:'홈', board:'게시판', study:'학습', data:'외부데이터', stories:'스토리', shorts:'쇼츠', messages:'메시지', mypage:'마이페이지', logout:'로그아웃', login:'로그인', admin:'관리자 모드 — 모든 게시글 삭제 및 학습 내용 관리 가능' }
}

export default function NavBar() {
  const [user,   setUser]   = useState(null)
  const [unread, setUnread] = useState(0)
  const [L,      setL]      = useState(LABELS.en)
  const pathname = usePathname()
  const router   = useRouter()
  const pollRef  = useRef(null)

  useEffect(() => {
    const lang = localStorage.getItem('cozyboard_lang') || 'en'
    setL(LABELS[lang] || LABELS.en)
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

  const fetchUnread = async (userId) => {
    try {
      const res   = await fetch(`/api/chat?userId=${userId}`)
      const rooms = await res.json()
      setUnread(rooms.reduce((s, r) => s + (r.unread||0), 0))
    } catch {}
  }

  const logout = () => {
    localStorage.removeItem('user'); setUser(null); setUnread(0); router.push('/')
  }

  return (
    <>
      <nav className="navbar">
        <Link href="/" className="nav-logo">Cozy<span>Board</span></Link>
        <Link href="/" className="nav-link">{L.home}</Link>
        <Link href="/board" className="nav-link">{L.board}</Link>
        <Link href="/study" className="nav-link">{L.study}</Link>
        <Link href="/data" className="nav-link">{L.data}</Link>
        <Link href="/stories" className="nav-link">{L.stories}</Link>
        <Link href="/shorts" className="nav-link">{L.shorts}</Link>
        {user && (
          <Link href="/chat" className="nav-link" style={{ position:'relative' }}>
            {L.messages}
            {unread > 0 && (
              <span style={{ position:'absolute', top:'-6px', right:'-10px', background:'var(--accent2)', color:'#fff', borderRadius:'10px', fontSize:'0.6rem', fontFamily:'var(--mono)', padding:'0.05rem 0.35rem', minWidth:'16px', textAlign:'center', lineHeight:'1.4' }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>
        )}
        {user ? (
          <>
            <Link href="/mypage" className={`nav-user ${user.role==='admin'?'admin':''}`}>
              {user.avatar && <img src={user.avatar} alt="" style={{ width:20, height:20, borderRadius:'50%', objectFit:'cover', marginRight:4, verticalAlign:'middle' }} />}
              {user.role==='admin' ? '👑 ' : ''}{user.name}
            </Link>
            <button className="nav-btn" onClick={logout}>{L.logout}</button>
          </>
        ) : (
          <Link href="/login"><button className="nav-btn accent">{L.login}</button></Link>
        )}
      </nav>
      {user?.role === 'admin' && (
        <div className="admin-banner">
          <div className="admin-dot" />
          {L.admin}
        </div>
      )}
    </>
  )
}
