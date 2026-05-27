'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

// 음악 라이브러리 — 승인된 음악 목록.
// - 카드 형태로 표시 (커버 + 제목 + 아티스트)
// - 클릭 시 미리듣기 (재생/일시정지)
// - 검색 (제목/아티스트 부분 일치)

export default function MusicLibraryPage() {
  const [user, setUser] = useState(null)
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [playingId, setPlayingId] = useState(null)
  const audioRef = useRef(null)

  useEffect(() => {
    const raw = typeof window !== 'undefined' && localStorage.getItem('user')
    if (raw) setUser(JSON.parse(raw))
    fetch('/api/music?status=approved')
      .then(r => r.json())
      .then(d => setList(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const togglePlay = (m) => {
    if (!audioRef.current) audioRef.current = new Audio()
    const a = audioRef.current
    if (playingId === m.id) {
      a.pause()
      setPlayingId(null)
    } else {
      a.src = m.fileUrl
      a.play().catch(() => {})
      setPlayingId(m.id)
      a.onended = () => setPlayingId(cur => cur === m.id ? null : cur)
    }
  }

  useEffect(() => () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null } }, [])

  const allowed = user && (['owner','admin'].includes(user.role) || !!user.musicAllowed)
  const filtered = list.filter(m => {
    const s = q.trim().toLowerCase()
    if (!s) return true
    return (m.title || '').toLowerCase().includes(s) || (m.artist || '').toLowerCase().includes(s)
  })

  return (
    <main>
      <div className="container" style={{ maxWidth: 1000 }}>
        <div className="section-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:'.5rem', flexWrap:'wrap' }}>
          <div>
            <h2>음악 라이브러리</h2>
            <p>승인된 음악 · 프로필 / 메모에 첨부 가능</p>
          </div>
          {allowed && <Link href="/music/upload" className="btn btn-primary btn-sm">+ 음악 업로드</Link>}
        </div>

        <div className="board-filters">
          <input
            placeholder="제목 / 아티스트 검색"
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{ maxWidth: 320 }}
          />
        </div>

        {loading ? (
          <div className="card" style={{ textAlign:'center', padding:'3rem', color:'var(--muted)', fontFamily:'var(--mono)' }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ textAlign:'center', padding:'3rem', color:'var(--muted)', fontFamily:'var(--mono)', fontSize:'.85rem', lineHeight:1.7 }}>
            {list.length === 0
              ? '아직 승인된 음악이 없습니다.'
              : '검색 결과가 없어요.'}
            {allowed && list.length === 0 && (
              <div style={{ marginTop:'1rem' }}>
                <Link href="/music/upload" className="btn btn-primary btn-sm">첫 음악 업로드</Link>
              </div>
            )}
          </div>
        ) : (
          <div className="music-grid">
            {filtered.map(m => (
              <div key={m.id} className="music-card">
                <div className="music-cover">
                  {m.coverUrl
                    ? <img src={m.coverUrl} alt={m.title}/>
                    : <div className="music-cover-ph">
                        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                        </svg>
                      </div>
                  }
                  <button className="music-play" onClick={() => togglePlay(m)} aria-label={playingId === m.id ? '일시정지' : '재생'}>
                    {playingId === m.id ? (
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    )}
                  </button>
                </div>
                <div className="music-meta">
                  <div className="music-title" title={m.title}>{m.title}</div>
                  <div className="music-artist" title={m.artist}>{m.artist || '아티스트 미상'}</div>
                  <div className="music-uploader">@{m.uploaderName}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .music-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1rem;}
        .music-card{background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden;transition:transform .15s,box-shadow .15s;}
        .music-card:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.15);}
        .music-cover{position:relative;aspect-ratio:1/1;background:linear-gradient(135deg,var(--ink),var(--surface2));display:flex;align-items:center;justify-content:center;color:rgba(245,240,232,.5);}
        .music-cover img{width:100%;height:100%;object-fit:cover;display:block;}
        .music-cover-ph{display:flex;align-items:center;justify-content:center;}
        .music-play{position:absolute;right:.5rem;bottom:.5rem;width:42px;height:42px;border-radius:50%;background:var(--accent);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.3);transition:transform .15s;}
        .music-play:hover{transform:scale(1.08);}
        .music-meta{padding:.65rem .75rem;}
        .music-title{font-family:var(--serif);font-weight:700;font-size:.92rem;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .music-artist{font-family:var(--mono);font-size:.72rem;color:var(--muted);margin-top:.15rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .music-uploader{font-family:var(--mono);font-size:.65rem;color:var(--accent);margin-top:.3rem;}
      `}</style>
    </main>
  )
}
