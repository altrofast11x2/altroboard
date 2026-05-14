'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function AdminHome() {
  const router = useRouter()
  const [user, setUser] = useState(null)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (!raw) { router.push('/login'); return }
    const u = JSON.parse(raw)
    if (!['owner', 'admin'].includes(u.role)) { router.push('/'); return }
    setUser(u)
  }, [])

  if (!user) return <main><div className="container" style={{padding:'3rem',textAlign:'center',color:'var(--muted)'}}>확인 중...</div></main>

  return (
    <main>
      <div className="container">
        <div className="section-header">
          <h2>관리자 콘솔</h2>
          <p>등급: {user.role}</p>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:'1rem'}}>
          <Link href="/admin/users" className="card card-accent" style={{textDecoration:'none',color:'inherit',cursor:'pointer'}}>
            <strong style={{fontFamily:'var(--serif)',fontSize:'1.05rem',color:'var(--ink)'}}>사용자 관리</strong>
            <p style={{fontSize:'.78rem',color:'var(--muted)',marginTop:'.4rem',lineHeight:1.6}}>정지/해제, 등급 변경, 계정 삭제</p>
          </Link>
          <Link href="/admin/reports" className="card card-accent" style={{textDecoration:'none',color:'inherit',cursor:'pointer'}}>
            <strong style={{fontFamily:'var(--serif)',fontSize:'1.05rem',color:'var(--ink)'}}>신고함</strong>
            <p style={{fontSize:'.78rem',color:'var(--muted)',marginTop:'.4rem',lineHeight:1.6}}>접수된 신고 검토 · 처리</p>
          </Link>
          <Link href="/admin/verify" className="card card-accent" style={{textDecoration:'none',color:'inherit',cursor:'pointer'}}>
            <strong style={{fontFamily:'var(--serif)',fontSize:'1.05rem',color:'var(--ink)'}}>인증 신청</strong>
            <p style={{fontSize:'.78rem',color:'var(--muted)',marginTop:'.4rem',lineHeight:1.6}}>verified 배지 신청 검토 · 승인/거절</p>
          </Link>
          <Link href="/admin/cheats" className="card card-accent" style={{textDecoration:'none',color:'inherit',cursor:'pointer'}}>
            <strong style={{fontFamily:'var(--serif)',fontSize:'1.05rem',color:'var(--ink)'}}>부정행위 의심</strong>
            <p style={{fontSize:'.78rem',color:'var(--muted)',marginTop:'.4rem',lineHeight:1.6}}>체스 항복 남용 등 자동 감지된 의심 사례 검토</p>
          </Link>
        </div>
      </div>
    </main>
  )
}
