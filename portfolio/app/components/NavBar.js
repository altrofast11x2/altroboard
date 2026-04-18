'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

export default function NavBar() {
  const [user, setUser] = useState(null)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (u) setUser(JSON.parse(u))
  }, [pathname])

  const logout = () => {
    localStorage.removeItem('user')
    setUser(null)
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
        {user ? (
          <>
            <span className={`nav-user ${user.role === 'admin' ? 'admin' : ''}`}>
              {user.role === 'admin' ? '👑 ' : ''}{user.name}
            </span>
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
