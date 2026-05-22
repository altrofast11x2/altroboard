'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

// ── 인라인 SVG 아이콘 ─────────────────────────────────────────
const I = {
  Menu: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  Home: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 9.5L12 2l9 7.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></svg>,
  About: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  Board: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="4" x2="9" y2="20"/></svg>,
  Gallery: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>,
  Study: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  Data: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>,
  Shorts: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="2" y="2" width="20" height="20" rx="3"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor"/></svg>,
  Games: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="6" y1="11" x2="10" y2="11"/><line x1="8" y1="9" x2="8" y2="13"/><line x1="15" y1="12" x2="15.01" y2="12"/><line x1="18" y1="10" x2="18.01" y2="10"/><path d="M17.32 5H6.68A4 4 0 0 0 3 8.86v6.28A4 4 0 0 0 6.68 19h10.64A4 4 0 0 0 21 15.14V8.86A4 4 0 0 0 17.32 5z"/></svg>,
  Message: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
  Admin: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Settings: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Profile: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Logout: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Login: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>,
  Crown: (p) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M2 8l4 4 6-8 6 8 4-4-2 12H4z"/></svg>,
  Shield: (p) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 2L4 5v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V5z"/></svg>,
  Chevron: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="9 18 15 12 9 6"/></svg>,
  Apps: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  Shop: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  X: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Search: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Activity: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  Bookmark: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>,
  Moon: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  Flag: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  Swap: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
  More: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
}

// "altroboard 다른 앱" 그룹 — Instagram 의 "Meta의 다른 앱" 패턴
const OTHER_APPS = [
  { label: '게임',     href: '/games', icon: <I.Games width={20} height={20}/> },
  { label: '외부데이터', href: '/data',  icon: <I.Data  width={20} height={20}/> },
  { label: '쇼핑몰',   href: '/shop',  icon: <I.Shop  width={20} height={20}/> },
]

const L = {
  ko: { home:'홈', about:'소개', board:'게시판', galleries:'갤러리', study:'학습', data:'외부데이터', shorts:'쇼츠', games:'게임', msg:'메시지', mypage:'마이페이지', settings:'설정', adminPanel:'관리자', logout:'로그아웃', login:'로그인', admin:'관리자 모드 — 게시글 삭제 · 사용자 정지 · 신고 처리 가능', menu:'메뉴' },
  en: { home:'Home', about:'About', board:'Board', galleries:'Galleries', study:'Study', data:'Data', shorts:'Shorts', games:'Games', msg:'Messages', mypage:'My Page', settings:'Settings', adminPanel:'Admin', logout:'Logout', login:'Login', admin:'Admin Mode — Manage posts, suspend users, handle reports', menu:'Menu' },
  ja: { home:'ホーム', about:'紹介', board:'掲示板', galleries:'ギャラリー', study:'学習', data:'外部データ', shorts:'ショート', games:'ゲーム', msg:'メッセージ', mypage:'マイページ', settings:'設定', adminPanel:'管理者', logout:'ログアウト', login:'ログイン', admin:'管理者モード — 投稿削除・ユーザー停止・通報処理可能', menu:'メニュー' },
}

const GAME_ITEMS = [
  { label: 'agar.io',        href: '/agar'      },
  { label: 'slither.io',     href: '/slither'   },
  { label: 'diep.io',        href: '/diep'      },
  { label: "Texas Hold'em",  href: '/poker'     },
  { label: 'Chess',          href: '/chess'     },
]

export default function NavBar() {
  const [user,     setUser]     = useState(null)
  const [unread,   setUnread]   = useState(0)
  const [t,        setT]        = useState(L.ko)
  // 'collapsed' (좁음) | 'expanded' (라벨까지) — 클릭 토글
  const [mode,     setMode]     = useState('collapsed')
  // 호버 상태 — collapsed 일 때 호버하면 일시적으로 펼침
  const [hover,    setHover]    = useState(false)
  // 모바일 드로어 (640px 이하) 열림 여부
  const [mobileOpen, setMobileOpen] = useState(false)
  // 다른 앱 (게임/외부데이터/쇼핑몰) 펼침 여부
  const [appsOpen, setAppsOpen] = useState(false)
  // 더 보기 (검색/설정/저장됨/...) 펼침 여부
  const [moreOpen, setMoreOpen] = useState(false)
  const pathname = usePathname()
  const router   = useRouter()
  const pollRef  = useRef(null)

  // 함수 정의는 useEffect 전에 — 클로저 TDZ 방지
  const fetchUnread = async (uid) => {
    try {
      const res = await fetch(`/api/chat?userId=${uid}`)
      if (!res.ok) return
      const rooms = await res.json()
      if (Array.isArray(rooms)) setUnread(rooms.reduce((s,r)=>s+(r.unread||0),0))
    } catch {}
  }

  const logout = () => {
    localStorage.removeItem('user'); setUser(null); setUnread(0); router.push('/')
  }

  const toggleMode = () => {
    const next = mode === 'collapsed' ? 'expanded' : 'collapsed'
    setMode(next)
    localStorage.setItem('altroboard_nav_mode', next)
  }

  useEffect(() => {
    const lang = localStorage.getItem('cozyboard_lang') || 'ko'
    setT(L[lang] || L.ko)
    const saved = localStorage.getItem('altroboard_nav_mode')
    if (saved === 'expanded' || saved === 'collapsed') setMode(saved)
    const raw = localStorage.getItem('user')
    if (raw) {
      const u = JSON.parse(raw)
      setUser(u)
      if (pollRef.current) clearInterval(pollRef.current)
      fetchUnread(u.id)
      // 5분 폴링 — Firebase 트래픽 절감 (이전 60초)
      pollRef.current = setInterval(() => fetchUnread(u.id), 300000)
    } else {
      setUser(null); setUnread(0)
      if (pollRef.current) clearInterval(pollRef.current)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [pathname])

  useEffect(() => { setHover(false); setMobileOpen(false); setAppsOpen(false); setMoreOpen(false) }, [pathname])

  // 다크/라이트 모드 토글 (auto → light → dark → light ...)
  const toggleTheme = () => {
    const cur = (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) || 'light'
    const next = cur === 'dark' ? 'light' : 'dark'
    if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem('altroboard_theme', next) } catch {}
  }

  // 모바일 열렸을 때 body scroll lock
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  // 게임 페이지에서는 사이드바 대신 좌상단 미니 "홈으로" 버튼만 표시
  const isGamePage = pathname?.startsWith('/agar') || pathname?.startsWith('/slither') ||
                     pathname?.startsWith('/diep') || pathname?.startsWith('/poker/room') ||
                     pathname?.startsWith('/chess/room')

  if (isGamePage) {
    return (
      <Link href="/" className="game-home-btn" aria-label="홈으로">
        <I.Home width={18} height={18}/>
        <style>{`
          .game-home-btn{position:fixed;top:12px;left:12px;width:38px;height:38px;border-radius:50%;background:rgba(0,0,0,.7);color:#fff;display:flex;align-items:center;justify-content:center;z-index:1000;text-decoration:none;backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.1);transition:all .15s;}
          .game-home-btn:hover{background:rgba(0,0,0,.9);transform:scale(1.05);}
        `}</style>
      </Link>
    )
  }

  // 메인 NAV — 핵심만. 게임/외부데이터/쇼핑몰은 '다른 앱' 으로 이동.
  const NAV = [
    { href: '/',          label: t.home,      icon: <I.Home width={22} height={22}/> },
    { href: '/board',     label: t.board,     icon: <I.Board width={22} height={22}/> },
    { href: '/galleries', label: t.galleries, icon: <I.Gallery width={22} height={22}/> },
    { href: '/shorts',    label: t.shorts,    icon: <I.Shorts width={22} height={22}/> },
    { href: '/stories',   label: '스토리',    icon: <I.About width={22} height={22}/> },
    { href: '/study',     label: t.study,     icon: <I.Study width={22} height={22}/> },
  ]

  // 실제 표시 모드 — 호버 시 일시 펼침
  const visualMode = (mode === 'expanded' || hover) ? 'expanded' : 'collapsed'

  return (
    <>
      {/* 모바일 전용 상단 바 — 햄버거 + 로고 (640px 이하에서만 표시) */}
      <header className="mob-top" aria-label="모바일 상단바">
        <button className="mob-burger" onClick={()=>setMobileOpen(true)} aria-label={t.menu}>
          <I.Menu width={22} height={22}/>
        </button>
        <Link href="/" className="mob-logo">altro<span style={{color:'var(--accent2)'}}>board</span></Link>
        {user && (
          <Link href="/chat" className="mob-msg" aria-label={t.msg}>
            <I.Message width={20} height={20}/>
            {unread > 0 && <span className="mob-msg-dot">{unread>9?'9+':unread}</span>}
          </Link>
        )}
      </header>

      {/* 모바일 드로어 오버레이 */}
      {mobileOpen && <div className="mob-overlay" onClick={()=>setMobileOpen(false)} aria-hidden/>}

      <aside
        className={`sidebar ${visualMode} ${isGamePage?'game-mode':''} ${mobileOpen?'mob-open':''}`}
        aria-label="네비게이션"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* 상단 — 로고 + 햄버거 토글 + 모바일 닫기 */}
        <div className="sb-top">
          <button className="sb-toggle desktop-only" onClick={toggleMode} aria-label={t.menu}>
            <I.Menu width={22} height={22}/>
          </button>
          <button className="sb-toggle mobile-only" onClick={()=>setMobileOpen(false)} aria-label="닫기">
            <I.X width={22} height={22}/>
          </button>
          <Link href="/" className="sb-logo">
            <span className="sb-logo-full">altro<span style={{color:'var(--accent2)'}}>board</span></span>
            <span className="sb-logo-mini">A</span>
          </Link>
        </div>

        {/* 메인 메뉴 */}
        <nav className="sb-nav">
          {NAV.map(item => (
            <Link key={item.href} href={item.href} className={`sb-row ${pathname===item.href?'active':''}`}>
              <span className="sb-icon">{item.icon}</span>
              <span className="sb-label">{item.label}</span>
            </Link>
          ))}

          {user && (
            <Link href="/chat" className={`sb-row ${pathname?.startsWith('/chat')?'active':''}`}>
              <span className="sb-icon"><I.Message width={22} height={22}/></span>
              <span className="sb-label">{t.msg}</span>
              {unread > 0 && <span className="sb-badge">{unread>9?'9+':unread}</span>}
            </Link>
          )}

          {['owner','admin'].includes(user?.role) && (
            <Link href="/admin" className={`sb-row sb-admin ${pathname?.startsWith('/admin')?'active':''}`}>
              <span className="sb-icon"><I.Admin width={22} height={22}/></span>
              <span className="sb-label">{t.adminPanel}</span>
            </Link>
          )}
        </nav>

        {/* 더 보기 (Instagram 패턴) — 검색/내 활동/저장됨/모드 전환/문제 신고 등 */}
        <div className="sb-more">
          <button className="sb-row sb-btn" onClick={()=>setMoreOpen(o=>!o)} aria-expanded={moreOpen}>
            <span className="sb-icon"><I.More width={22} height={22}/></span>
            <span className="sb-label">더 보기</span>
            <span className="sb-caret" style={{transform: moreOpen ? 'rotate(90deg)' : 'none'}}>
              <I.Chevron width={14} height={14}/>
            </span>
          </button>
          {moreOpen && (
            <div className="sb-sublist">
              <Link href="/board?q=" className="sb-row sb-sub">
                <span className="sb-icon"><I.Search width={20} height={20}/></span>
                <span className="sb-label">검색</span>
              </Link>
              {user && (
                <Link href="/settings" className={`sb-row sb-sub ${pathname==='/settings'?'active':''}`}>
                  <span className="sb-icon"><I.Settings width={20} height={20}/></span>
                  <span className="sb-label">설정</span>
                </Link>
              )}
              {user && (
                <Link href="/mypage" className={`sb-row sb-sub ${pathname==='/mypage'?'active':''}`}>
                  <span className="sb-icon"><I.Activity width={20} height={20}/></span>
                  <span className="sb-label">내 활동</span>
                </Link>
              )}
              {user && (
                <Link href="/saved" className={`sb-row sb-sub ${pathname==='/saved'?'active':''}`}>
                  <span className="sb-icon"><I.Bookmark width={20} height={20}/></span>
                  <span className="sb-label">저장됨</span>
                </Link>
              )}
              <button className="sb-row sb-sub sb-btn" onClick={toggleTheme}>
                <span className="sb-icon"><I.Moon width={20} height={20}/></span>
                <span className="sb-label">모드 전환</span>
              </button>
              {user && (
                <Link href="/admin/reports" className="sb-row sb-sub">
                  <span className="sb-icon"><I.Flag width={20} height={20}/></span>
                  <span className="sb-label">문제 신고</span>
                </Link>
              )}
              {user && (
                <Link href="/login" className="sb-row sb-sub">
                  <span className="sb-icon"><I.Swap width={20} height={20}/></span>
                  <span className="sb-label">계정 전환</span>
                </Link>
              )}
              {user && (
                <button className="sb-row sb-sub sb-btn" onClick={logout}>
                  <span className="sb-icon"><I.Logout width={20} height={20}/></span>
                  <span className="sb-label">로그아웃</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* 다른 앱 (Meta의 다른 앱 패턴) — 게임/외부데이터/쇼핑몰 */}
        <div className="sb-other-apps">
          <button className="sb-row sb-btn" onClick={()=>setAppsOpen(o=>!o)} aria-expanded={appsOpen}>
            <span className="sb-icon"><I.Apps width={22} height={22}/></span>
            <span className="sb-label">altroboard 다른 앱</span>
            <span className="sb-caret" style={{transform: appsOpen ? 'rotate(90deg)' : 'none'}}>
              <I.Chevron width={14} height={14}/>
            </span>
          </button>
          {appsOpen && (
            <div className="sb-sublist">
              {OTHER_APPS.map(a => (
                <Link key={a.href} href={a.href} className={`sb-row sb-sub ${pathname===a.href?'active':''}`}>
                  <span className="sb-icon">{a.icon}</span>
                  <span className="sb-label">{a.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 하단 — 프로필/설정/로그아웃 */}
        <div className="sb-bottom">
          {user ? (
            <>
              <Link href="/mypage" className={`sb-row ${pathname==='/mypage'?'active':''}`}>
                <span className="sb-icon">
                  {user.avatar
                    ? <img src={user.avatar} alt="" className="sb-avatar-img"/>
                    : <span className="sb-avatar-text">{(user.name||'?')[0].toUpperCase()}</span>}
                  {user.role==='owner' && <span className="sb-role owner"><I.Crown width={9} height={9}/></span>}
                  {user.role==='admin' && <span className="sb-role admin"><I.Shield width={9} height={9}/></span>}
                </span>
                <span className="sb-label">{user.name}</span>
              </Link>
              <Link href="/settings" className={`sb-row ${pathname==='/settings'?'active':''}`}>
                <span className="sb-icon"><I.Settings width={22} height={22}/></span>
                <span className="sb-label">{t.settings}</span>
              </Link>
              <button className="sb-row sb-btn" onClick={logout}>
                <span className="sb-icon"><I.Logout width={22} height={22}/></span>
                <span className="sb-label">{t.logout}</span>
              </button>
            </>
          ) : (
            <Link href="/login" className="sb-row sb-login">
              <span className="sb-icon"><I.Login width={22} height={22}/></span>
              <span className="sb-label">{t.login}</span>
            </Link>
          )}
        </div>
      </aside>

      {/* spacer — 본문이 사이드바 옆 자리 잡도록. collapsed 너비 고정 (호버 시 안 밀림) */}
      <div className={`sb-spacer ${isGamePage?'game':''}`} aria-hidden="true"/>

      {['owner','admin'].includes(user?.role) && (
        <div className="admin-banner sb-banner">
          <div className="admin-dot"/>
          {t.admin}
        </div>
      )}

      <style>{`
        .sidebar{position:fixed;top:0;left:0;bottom:0;background:var(--ink);color:var(--bg);z-index:1000;display:flex;flex-direction:column;border-right:1px solid rgba(0,0,0,.3);transition:width .22s ease;box-shadow:2px 0 12px rgba(0,0,0,.15);}
        .sidebar.collapsed{width:72px;}
        .sidebar.expanded{width:240px;}
        /* 게임 모드: 본문은 사이드바 영향 거의 없게 — 매우 좁은 사이드바 (호버 시 펼침) */
        .sidebar.game-mode{width:48px;background:rgba(10,7,3,.85);backdrop-filter:blur(8px);}
        .sidebar.game-mode.expanded{width:200px;background:rgba(10,7,3,.95);}

        /* spacer: 호버해도 안 변함 — collapsed 너비 고정. 사이드바가 호버 시 본문 위로 떠서 펼침 */
        .sb-spacer{flex-shrink:0;width:72px;transition:width .22s ease;}
        .sb-spacer.game{width:48px;}

        .sb-banner{position:fixed;top:0;left:72px;right:0;z-index:900;}
        body:has(.sidebar.game-mode) .sb-banner{left:48px;}
        @media(max-width:640px){
          .sb-banner{left:64px;}
        }
        body:has(.sb-banner) .app-content{padding-top:34px;}

        .sb-top{display:flex;align-items:center;gap:.5rem;padding:.85rem .75rem;border-bottom:1px solid rgba(255,255,255,.06);}
        .sb-toggle{background:none;border:none;color:var(--bg);width:40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;}
        .sb-toggle:hover{background:rgba(255,255,255,.08);}
        .sb-logo{font-family:var(--serif);font-weight:700;font-size:1.15rem;color:var(--bg);text-decoration:none;letter-spacing:.02em;overflow:hidden;white-space:nowrap;}
        .sb-logo-full{display:inline;}
        .sb-logo-mini{display:none;color:var(--accent2);font-size:1.25rem;}
        .sidebar.collapsed .sb-logo-full{display:none;}
        .sidebar.collapsed .sb-logo-mini{display:inline;}

        .sb-nav{flex:1;overflow-y:auto;padding:.5rem 0;display:flex;flex-direction:column;gap:.1rem;scrollbar-width:thin;}
        .sb-bottom{border-top:1px solid rgba(255,255,255,.06);padding:.5rem 0;display:flex;flex-direction:column;gap:.1rem;}

        .sb-row{display:flex;align-items:center;gap:.85rem;padding:.65rem .85rem;margin:0 .35rem;color:rgba(245,240,232,.7);text-decoration:none;font-family:var(--font);font-size:.92rem;border-radius:8px;cursor:pointer;background:none;border:none;width:calc(100% - .7rem);text-align:left;position:relative;transition:background .15s, color .15s;}
        .sb-row:hover{background:rgba(255,255,255,.06);color:#fff;}
        .sb-row.active{background:rgba(255,255,255,.08);color:#fff;font-weight:600;}
        .sb-row.sb-admin{color:#7dffaa;}
        .sb-row.sb-login{color:var(--accent2);}
        .sb-icon{display:inline-flex;align-items:center;justify-content:center;width:24px;flex-shrink:0;color:inherit;position:relative;}
        .sb-label{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .sidebar.collapsed .sb-label, .sidebar.collapsed .sb-caret{display:none;}
        .sidebar.collapsed .sb-row{justify-content:center;padding:.65rem .25rem;}
        .sidebar.collapsed .sb-row .sb-icon{width:auto;}
        .sb-caret{margin-left:auto;transition:transform .2s;color:rgba(245,240,232,.5);}
        .sb-btn.expanded .sb-caret{transform:rotate(90deg);}
        .sb-badge{margin-left:auto;background:var(--accent2);color:#fff;border-radius:10px;font-size:.6rem;font-family:var(--mono);font-weight:700;padding:.1rem .4rem;}
        .sidebar.collapsed .sb-badge{position:absolute;top:.2rem;right:.4rem;margin:0;font-size:.55rem;padding:.05rem .25rem;}


        .sb-avatar-img{width:24px;height:24px;border-radius:50%;object-fit:cover;}
        .sb-avatar-text{width:24px;height:24px;border-radius:50%;background:var(--accent);color:#fff;font-family:var(--serif);font-weight:700;font-size:.78rem;display:flex;align-items:center;justify-content:center;}
        .sb-role{position:absolute;bottom:-3px;right:-3px;width:13px;height:13px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid var(--ink);}
        .sb-role.owner{background:#c9a84c;color:#1a1208;}
        .sb-role.admin{background:#1a6e3a;color:#fff;}

        /* 다른 앱 / 더 보기 펼침 영역 */
        .sb-more,.sb-other-apps{border-top:1px solid rgba(255,255,255,.06);padding:.3rem 0;}
        .sidebar.collapsed .sb-other-apps .sb-caret,
        .sidebar.collapsed .sb-more .sb-caret{display:none;}
        .sb-sublist{padding-left:0;}
        .sidebar.expanded .sb-sublist .sb-sub{padding-left:2.5rem;}
        .sb-sub{font-size:.85rem;}

        /* 모바일 전용 상단 바 — 기본 숨김, 640px 이하에서 표시 */
        .mob-top{display:none;}
        .mob-overlay{display:none;}
        .mobile-only{display:none;}

        @media(max-width:640px){
          /* 모바일 상단 고정 바 */
          .mob-top{display:flex;align-items:center;gap:.5rem;position:fixed;top:0;left:0;right:0;height:50px;padding:0 .75rem;background:var(--ink);color:var(--bg);z-index:990;border-bottom:1px solid rgba(0,0,0,.3);box-shadow:0 2px 8px rgba(0,0,0,.2);}
          .mob-burger{background:none;border:none;color:var(--bg);width:38px;height:38px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;}
          .mob-burger:hover{background:rgba(255,255,255,.08);}
          .mob-logo{font-family:var(--serif);font-weight:700;font-size:1.05rem;color:var(--bg);text-decoration:none;flex:1;}
          .mob-msg{position:relative;color:var(--bg);width:38px;height:38px;border-radius:8px;display:flex;align-items:center;justify-content:center;text-decoration:none;}
          .mob-msg:hover{background:rgba(255,255,255,.08);}
          .mob-msg-dot{position:absolute;top:4px;right:4px;background:var(--accent2);color:#fff;border-radius:10px;font-size:.55rem;font-family:var(--mono);font-weight:700;padding:.05rem .3rem;}

          /* 모바일에서 사이드바 = 드로어 (기본 화면 밖) */
          .sidebar{transform:translateX(-100%);transition:transform .25s ease;width:260px !important;}
          .sidebar.mob-open{transform:translateX(0);box-shadow:8px 0 32px rgba(0,0,0,.6);}
          /* expanded/collapsed 가 아니라 mob-open 기준으로 표시 */
          .sidebar.collapsed .sb-label,
          .sidebar.collapsed .sb-caret{display:flex;}
          .sidebar.collapsed .sb-row{justify-content:flex-start;padding:.65rem .85rem;}

          /* spacer 도 0 — 모바일에선 콘텐츠가 전체 폭 사용 */
          .sb-spacer{width:0 !important;height:50px;}
          /* admin 배너 위치 보정 */
          .sb-banner{top:50px;left:0;}

          /* 사이드바 안의 토글 버튼: 데스크탑용 숨김, 모바일 닫기 버튼 표시 */
          .desktop-only{display:none;}
          .mobile-only{display:flex;}

          /* 모바일 드로어 오버레이 */
          .mob-overlay{display:block;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:999;animation:mo-in .2s ease;}
          @keyframes mo-in{from{opacity:0}to{opacity:1}}
        }

        /* 데스크탑 — 모바일 전용 클래스 숨김 */
        @media(min-width:641px){
          .desktop-only{display:flex;}
        }

        /* 다크 모드 — 사이드바 별도 톤 */
        html[data-theme="dark"] .sidebar{background:#0a0703;color:#e8dcc4;border-right-color:#3a2e1d;}
        html[data-theme="dark"] .sb-row{color:rgba(232,220,196,.7);}
        html[data-theme="dark"] .sb-row:hover{background:rgba(255,255,255,.05);color:#fff;}
        html[data-theme="dark"] .sb-toggle{color:#e8dcc4;}
        html[data-theme="dark"] .sb-logo{color:#e8dcc4;}
      `}</style>
    </>
  )
}
