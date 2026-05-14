'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function AdminReportsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [reports, setReports] = useState([])
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
    const res = await fetch(`/api/reports?actorId=${encodeURIComponent(user.id)}&status=${status}`)
    if (res.ok) setReports(await res.json())
    else setReports([])
    setLoading(false)
  }

  const resolve = async (r, action) => {
    const note = action === 'resolved'
      ? prompt('처리 메모 (선택):', '게시글 삭제 처리')
      : prompt('반려 사유 (선택):', '신고 사유 부적합')
    if (note === null) return
    const res = await fetch(`/api/reports/${r.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorId: user.id, status: action, note }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error || '실패'); return }
    load()
  }

  const typeLabel = (t) => ({
    post: '게시판 글', gallery_post: '갤러리 글', short: '쇼츠', comment: '댓글', user: '사용자', story: '스토리'
  }[t] || t)

  return (
    <main>
      <div className="container">
        <Link href="/admin" className="btn btn-sm" style={{marginBottom:'1rem',display:'inline-flex'}}>← 관리자</Link>
        <div className="section-header">
          <h2>신고함</h2>
          <p>접수된 신고를 처리합니다</p>
        </div>
        <div className="board-filters">
          {[['pending','대기'],['resolved','처리됨'],['rejected','반려'],['all','전체']].map(([k,l]) => (
            <button key={k} className={`btn btn-sm ${status===k?'btn-primary':''}`} onClick={()=>setStatus(k)}>{l}</button>
          ))}
        </div>

        <div className="board-wrap">
          {loading ? (
            <div style={{padding:'3rem',textAlign:'center',color:'var(--muted)'}}>불러오는 중...</div>
          ) : reports.length === 0 ? (
            <div style={{padding:'3rem',textAlign:'center',color:'var(--muted)',fontFamily:'var(--mono)',fontSize:'.82rem'}}>신고가 없습니다.</div>
          ) : (
            <div>
              {reports.map(r => (
                <div key={r.id} style={{padding:'1rem 1.25rem',borderBottom:'1px solid var(--border)',display:'grid',gridTemplateColumns:'1fr auto',gap:'.5rem'}}>
                  <div>
                    <div style={{display:'flex',gap:'.5rem',alignItems:'center',marginBottom:'.35rem',flexWrap:'wrap'}}>
                      <span className="badge">{typeLabel(r.type)}</span>
                      <span className="badge badge-red">{r.reason}</span>
                      <span style={{fontFamily:'var(--mono)',fontSize:'.7rem',color:'var(--muted)'}}>
                        {new Date(r.createdAt).toLocaleString('ko-KR')}
                      </span>
                    </div>
                    <div style={{fontSize:'.85rem',marginBottom:'.3rem'}}>
                      {r.description || <span style={{color:'var(--muted)'}}>설명 없음</span>}
                    </div>
                    <div style={{fontFamily:'var(--mono)',fontSize:'.72rem',color:'var(--muted)'}}>
                      신고자: <Link href={`/profile/${r.reporterId}`} style={{color:'var(--accent)'}}>{r.reporterName}</Link>
                      {r.targetAuthorId && (
                        <> · 대상 작성자: <Link href={`/profile/${r.targetAuthorId}`} style={{color:'var(--accent)'}}>{r.targetAuthorName}</Link></>
                      )}
                      {r.targetUrl && <> · <a href={r.targetUrl} target="_blank" rel="noopener noreferrer" style={{color:'var(--accent)'}}>대상 보기 ↗</a></>}
                    </div>
                    {r.status !== 'pending' && (
                      <div style={{marginTop:'.4rem',fontFamily:'var(--mono)',fontSize:'.72rem',color:r.status==='resolved'?'var(--admin)':'var(--accent)'}}>
                        [{r.status === 'resolved' ? '처리됨' : '반려'}] {r.resolvedNote || ''} ({r.resolvedAt ? new Date(r.resolvedAt).toLocaleString('ko-KR') : ''})
                      </div>
                    )}
                  </div>
                  {r.status === 'pending' && (
                    <div style={{display:'flex',gap:'.4rem',alignSelf:'center'}}>
                      <button className="btn btn-primary btn-sm" onClick={()=>resolve(r, 'resolved')}>처리</button>
                      <button className="btn btn-sm" onClick={()=>resolve(r, 'rejected')}>반려</button>
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
