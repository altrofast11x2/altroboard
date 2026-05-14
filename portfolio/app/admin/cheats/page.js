'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// 부정행위 의심 (chess_resign_abuse 등) 검토 페이지
// 자동으로 chess 항복 5회/일 초과 시 cheat_reports 노드에 기록됨.

export default function AdminCheatsPage() {
  const router = useRouter()
  const [user, setUser]     = useState(null)
  const [reports, setReports] = useState([])
  const [filter,  setFilter]  = useState('open')  // open | resolved | all
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (!raw) { router.push('/login'); return }
    const u = JSON.parse(raw)
    if (!['owner','admin'].includes(u.role)) { router.push('/'); return }
    setUser(u)
  }, [])

  useEffect(() => {
    if (!user) return
    load()
  }, [user])

  const load = async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/cheats?actorId=${encodeURIComponent(user.id)}`)
    if (res.ok) setReports(await res.json())
    else setReports([])
    setLoading(false)
  }

  const setResolved = async (id, resolved) => {
    const res = await fetch('/api/admin/cheats', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorId: user.id, id, resolved }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error || '실패'); return }
    load()
  }

  const typeLabel = (t) => ({
    chess_resign_abuse: '체스 항복 남용',
  }[t] || t)

  const filtered = reports.filter(r => {
    if (filter === 'open') return !r.resolved
    if (filter === 'resolved') return r.resolved
    return true
  })

  return (
    <main>
      <div className="container">
        <Link href="/admin" className="btn btn-sm" style={{marginBottom:'1rem',display:'inline-flex'}}>← 관리자</Link>
        <div className="section-header">
          <h2>부정행위 의심</h2>
          <p>자동 감지된 의심 사례를 검토합니다 (체스 항복 남용 등)</p>
        </div>

        <div className="board-filters">
          {[['open','대기'],['resolved','처리됨'],['all','전체']].map(([k,l]) => (
            <button key={k} className={`btn btn-sm ${filter===k?'btn-primary':''}`} onClick={()=>setFilter(k)}>{l}</button>
          ))}
        </div>

        <div className="board-wrap">
          {loading ? (
            <div style={{padding:'3rem',textAlign:'center',color:'var(--muted)'}}>불러오는 중...</div>
          ) : filtered.length === 0 ? (
            <div style={{padding:'3rem',textAlign:'center',color:'var(--muted)',fontFamily:'var(--mono)',fontSize:'.82rem'}}>
              {filter === 'open' ? '대기 중인 부정행위 의심 사례가 없습니다.' : '기록이 없습니다.'}
            </div>
          ) : (
            <div>
              {filtered.map(r => (
                <div key={r.id} style={{padding:'1rem 1.25rem',borderBottom:'1px solid var(--border)',display:'grid',gridTemplateColumns:'1fr auto',gap:'.6rem',alignItems:'flex-start'}}>
                  <div style={{minWidth:0}}>
                    <div style={{display:'flex',gap:'.5rem',alignItems:'center',marginBottom:'.4rem',flexWrap:'wrap'}}>
                      <span className="badge badge-red">{typeLabel(r.type)}</span>
                      {r.resolved
                        ? <span className="badge" style={{background:'rgba(46,204,113,.15)',color:'#2ecc71',border:'1px solid #2ecc71'}}>처리됨</span>
                        : <span className="badge" style={{background:'rgba(241,196,15,.15)',color:'#f1c40f',border:'1px solid #f1c40f'}}>대기</span>
                      }
                      <span style={{fontFamily:'var(--mono)',fontSize:'.7rem',color:'var(--muted)'}}>
                        {new Date(r.createdAt).toLocaleString('ko-KR')}
                      </span>
                    </div>
                    <div style={{fontFamily:'var(--serif)',fontWeight:600,fontSize:'.95rem',color:'var(--ink)',marginBottom:'.25rem'}}>
                      <Link href={`/profile/${r.userId}`} style={{color:'inherit',textDecoration:'none'}}>@{r.userName}</Link>
                      <span style={{color:'var(--muted)',fontFamily:'var(--mono)',fontSize:'.72rem',marginLeft:'.5rem'}}>({r.userId})</span>
                    </div>
                    <div style={{fontSize:'.82rem',color:'var(--text)',lineHeight:1.65}}>{r.reason}</div>
                    <div style={{fontFamily:'var(--mono)',fontSize:'.72rem',color:'var(--muted)',marginTop:'.3rem'}}>
                      날짜: {r.date} · 횟수: {r.count} / 한도: {r.limit}
                      {r.resolvedAt && ` · 처리: ${new Date(r.resolvedAt).toLocaleString('ko-KR')}`}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:'.4rem',flexDirection:'column'}}>
                    {r.resolved ? (
                      <button className="btn btn-sm" onClick={()=>setResolved(r.id, false)}>되돌리기</button>
                    ) : (
                      <button className="btn btn-primary btn-sm" onClick={()=>setResolved(r.id, true)}>처리 완료</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
