'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// 음악 검토 페이지 — admin 이상.
// 대기 / 승인됨 / 거절됨 필터.

export default function AdminMusicPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [list, setList] = useState([])
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const audioRef = useRef(null)
  const [playingId, setPlayingId] = useState(null)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (!raw) { router.push('/login'); return }
    const u = JSON.parse(raw)
    if (!['owner','admin'].includes(u.role)) { router.push('/'); return }
    setUser(u)
  }, [router])

  const load = async () => {
    if (!user) return
    setLoading(true)
    const r = await fetch(`/api/music?status=${filter}&actorId=${encodeURIComponent(user.id)}`)
    if (r.ok) setList(await r.json())
    else setList([])
    setLoading(false)
  }

  useEffect(() => { load() }, [user, filter])

  const togglePlay = (m) => {
    if (!audioRef.current) audioRef.current = new Audio()
    const a = audioRef.current
    if (playingId === m.id) { a.pause(); setPlayingId(null); return }
    a.src = m.fileUrl
    a.play().catch(() => {})
    setPlayingId(m.id)
    a.onended = () => setPlayingId(cur => cur === m.id ? null : cur)
  }
  useEffect(() => () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null } }, [])

  const review = async (m, status) => {
    const note = status === 'approved'
      ? prompt('승인 메모 (선택):', '')
      : prompt('거절 사유 (선택):', '저작권 또는 부적절 콘텐츠')
    if (note === null) return
    const r = await fetch(`/api/music/${m.id}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ actorId: user.id, status, reviewerNote: note }),
    })
    if (!r.ok) { const d = await r.json().catch(()=>({})); alert(d.error || '실패'); return }
    load()
  }
  const del = async (m) => {
    if (!confirm(`'${m.title}' 음원을 삭제할까요? 되돌릴 수 없습니다.`)) return
    const r = await fetch(`/api/music/${m.id}`, {
      method:'DELETE', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ actorId: user.id }),
    })
    if (!r.ok) { const d = await r.json().catch(()=>({})); alert(d.error || '실패'); return }
    load()
  }

  if (!user) return null

  return (
    <main>
      <div className="container" style={{ maxWidth: 900 }}>
        <Link href="/admin" className="btn btn-sm" style={{ marginBottom:'1rem', display:'inline-flex' }}>← 관리자</Link>
        <div className="section-header">
          <h2>음악 검토</h2>
          <p>업로드된 음원을 검토하고 승인/거절합니다.</p>
        </div>

        <div className="board-filters">
          {[['pending','대기'],['approved','승인됨'],['rejected','거절됨']].map(([k,l]) => (
            <button key={k} className={`btn btn-sm ${filter===k?'btn-primary':''}`} onClick={()=>setFilter(k)}>{l}</button>
          ))}
        </div>

        {loading ? (
          <div className="card" style={{ padding:'3rem', textAlign:'center', color:'var(--muted)', fontFamily:'var(--mono)' }}>불러오는 중...</div>
        ) : list.length === 0 ? (
          <div className="card" style={{ padding:'3rem', textAlign:'center', color:'var(--muted)', fontFamily:'var(--mono)', fontSize:'.85rem' }}>
            {filter === 'pending' ? '검토할 음원이 없습니다.' : '기록이 없습니다.'}
          </div>
        ) : (
          <div className="board-wrap">
            {list.map(m => (
              <div key={m.id} style={{ padding:'1rem 1.25rem', borderBottom:'1px solid var(--border)', display:'flex', gap:'1rem', alignItems:'flex-start', flexWrap:'wrap' }}>
                <div style={{ width:64, height:64, borderRadius:6, background:'var(--surface2)', flexShrink:0, overflow:'hidden', position:'relative' }}>
                  {m.coverUrl
                    ? <img src={m.coverUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                    : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)', fontFamily:'var(--mono)', fontSize:'.7rem' }}>커버 없음</div>
                  }
                </div>
                <div style={{ flex:1, minWidth:200 }}>
                  <div style={{ fontFamily:'var(--serif)', fontWeight:700, fontSize:'1rem', color:'var(--ink)' }}>{m.title}</div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:'.78rem', color:'var(--text)' }}>{m.artist || '아티스트 미상'}</div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:'.7rem', color:'var(--muted)', marginTop:'.25rem' }}>
                    <Link href={`/profile/${m.uploaderId}`} style={{ color:'var(--accent)' }}>@{m.uploaderName}</Link>
                    {' · '}
                    {new Date(m.createdAt).toLocaleString('ko-KR')}
                  </div>
                  {m.reviewerNote && (
                    <div style={{ fontFamily:'var(--mono)', fontSize:'.7rem', color:'var(--muted)', marginTop:'.4rem', whiteSpace:'pre-wrap' }}>
                      메모: {m.reviewerNote}
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
                  <button className="btn btn-sm" onClick={() => togglePlay(m)}>
                    {playingId === m.id ? '⏸ 정지' : '▶ 듣기'}
                  </button>
                  {m.status === 'pending' && (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => review(m, 'approved')}>승인</button>
                      <button className="btn btn-danger btn-sm" onClick={() => review(m, 'rejected')}>거절</button>
                    </>
                  )}
                  {m.status === 'rejected' && (
                    <button className="btn btn-sm" onClick={() => review(m, 'approved')}>승인으로 변경</button>
                  )}
                  {m.status === 'approved' && (
                    <button className="btn btn-sm" onClick={() => review(m, 'rejected')}>거절로 변경</button>
                  )}
                  <button className="btn btn-danger btn-sm" onClick={() => del(m)}>삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
