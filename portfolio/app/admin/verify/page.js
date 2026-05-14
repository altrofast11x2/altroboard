'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function AdminVerifyPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('pending')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (!raw) { router.push('/login'); return }
    const u = JSON.parse(raw)
    if (!['owner', 'admin'].includes(u.role)) { router.push('/'); return }
    setUser(u)
  }, [])

  useEffect(() => {
    if (!user) return
    load()
  }, [user, status])

  const load = async () => {
    setLoading(true)
    const res = await fetch(`/api/verify-requests?list=1&actorId=${encodeURIComponent(user.id)}&status=${status}`)
    if (res.ok) setItems(await res.json())
    else setItems([])
    setLoading(false)
  }

  const review = async (req, action) => {
    const note = action === 'approve'
      ? prompt('승인 메모 (선택):', '')
      : prompt('거절 사유 (선택):', '신청 사유 부족')
    if (note === null) return
    const res = await fetch('/api/verify-requests', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorId: user.id, requestId: req.id, action, note }),
    })
    if (!res.ok) { const d = await res.json(); alert(d.error || '실패'); return }
    load()
  }

  return (
    <main>
      <div className="container">
        <Link href="/admin" className="btn btn-sm" style={{marginBottom:'1rem',display:'inline-flex'}}>← 관리자</Link>
        <div className="section-header">
          <h2>인증 사용자 신청함</h2>
          <p>verified 배지 신청 검토</p>
        </div>
        <div className="board-filters">
          {[['pending','대기'],['approved','승인'],['rejected','거절'],['all','전체']].map(([k,l]) => (
            <button key={k} className={`btn btn-sm ${status===k?'btn-primary':''}`} onClick={()=>setStatus(k)}>{l}</button>
          ))}
        </div>
        <div className="board-wrap">
          {loading ? (
            <div style={{padding:'3rem',textAlign:'center',color:'var(--muted)'}}>불러오는 중...</div>
          ) : items.length === 0 ? (
            <div style={{padding:'3rem',textAlign:'center',color:'var(--muted)',fontFamily:'var(--mono)',fontSize:'.82rem'}}>해당하는 신청이 없습니다.</div>
          ) : (
            <div>
              {items.map(r => (
                <div key={r.id} style={{padding:'1rem 1.25rem',borderBottom:'1px solid var(--border)',display:'grid',gridTemplateColumns:'1fr auto',gap:'.5rem'}}>
                  <div>
                    <div style={{display:'flex',gap:'.5rem',alignItems:'center',marginBottom:'.35rem',flexWrap:'wrap'}}>
                      <Link href={`/profile/${r.userId}`} style={{color:'var(--accent)',fontFamily:'var(--mono)',fontWeight:700}}>{r.userName}</Link>
                      <span style={{fontFamily:'var(--mono)',fontSize:'.7rem',color:'var(--muted)'}}>{r.userEmail}</span>
                      <span style={{fontFamily:'var(--mono)',fontSize:'.7rem',color:'var(--muted)'}}>· {new Date(r.createdAt).toLocaleString('ko-KR')}</span>
                    </div>
                    <div style={{fontSize:'.88rem',whiteSpace:'pre-wrap',marginBottom:'.4rem',lineHeight:1.6}}>{r.reason}</div>
                    {r.links && <div style={{fontFamily:'var(--mono)',fontSize:'.72rem',color:'var(--muted)',marginBottom:'.4rem',whiteSpace:'pre-wrap'}}>{r.links}</div>}
                    {r.status !== 'pending' && (
                      <div style={{marginTop:'.4rem',fontFamily:'var(--mono)',fontSize:'.72rem',color: r.status === 'approved' ? 'var(--admin)' : 'var(--accent)'}}>
                        [{r.status === 'approved' ? '승인됨' : '거절됨'}] {r.reviewerNote || ''} ({r.reviewedAt ? new Date(r.reviewedAt).toLocaleString('ko-KR') : ''})
                      </div>
                    )}
                  </div>
                  {r.status === 'pending' && (
                    <div style={{display:'flex',gap:'.4rem',alignSelf:'center'}}>
                      <button className="btn btn-primary btn-sm" onClick={()=>review(r, 'approve')}>승인</button>
                      <button className="btn btn-sm" onClick={()=>review(r, 'reject')}>거절</button>
                    </div>
                  )}
                  {r.status === 'approved' && (
                    <div style={{alignSelf:'center'}}>
                      <button className="btn btn-danger btn-sm" onClick={async ()=>{
                        if (!confirm(`${r.userName} 의 인증을 회수합니까?`)) return
                        const res = await fetch('/api/verify-requests', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ actorId: user.id, action: 'revoke', userId: r.userId }),
                        })
                        if (res.ok) load()
                      }}>인증 회수</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
