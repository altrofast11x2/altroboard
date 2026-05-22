'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// 저장한 게시글 그리드 (Instagram 의 'saved' 페이지와 유사)
// - 비로그인은 로그인 페이지로 리디렉트
// - savedIds 받아온 뒤 posts API 와 매칭

export default function SavedPage() {
  const router = useRouter()
  const [user,    setUser]    = useState(null)
  const [items,   setItems]   = useState([])     // [{id, title, imageUrl, author, createdAt}, ...]
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const raw = typeof window !== 'undefined' && localStorage.getItem('user')
    if (!raw) { router.push('/login'); return }
    const u = JSON.parse(raw)
    setUser(u)
    ;(async () => {
      try {
        const [sr, pr] = await Promise.all([
          fetch(`/api/saved?userId=${encodeURIComponent(u.id)}`).then(r => r.json()).catch(()=>({savedIds:[]})),
          fetch('/api/posts').then(r => r.json()).catch(()=>[]),
        ])
        const savedSet = new Set(sr?.savedIds || [])
        const all = Array.isArray(pr) ? pr : []
        const order = (sr?.savedIds || [])
        const map = new Map(all.map(p => [p.id, p]))
        const filtered = order.map(id => map.get(id)).filter(Boolean)
        setItems(filtered)
      } catch {}
      setLoading(false)
    })()
  }, [router])

  const unsave = async (postId) => {
    if (!user) return
    await fetch('/api/saved', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, postId }),
    })
    setItems(prev => prev.filter(p => p.id !== postId))
  }

  if (!user) return null

  return (
    <main>
      <div className="container" style={{ maxWidth: 960 }}>
        <div className="section-header">
          <h2>저장됨</h2>
          <p>저장한 게시글 — 본인만 볼 수 있습니다</p>
        </div>

        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: '.85rem', lineHeight: 1.7 }}>
            아직 저장한 게시글이 없습니다.
            <br/>피드에서 북마크 아이콘을 눌러 저장해보세요.
          </div>
        ) : (
          <div className="saved-grid">
            {items.map(p => {
              const thumb = Array.isArray(p.imageUrl) ? p.imageUrl[0] : p.imageUrl
              return (
                <div key={p.id} className="saved-card">
                  <Link href={`/board/${p.id}`} className="saved-thumb">
                    {thumb ? <img src={thumb} alt="" /> : <div className="saved-noimg">{p.title?.[0] || '?'}</div>}
                  </Link>
                  <div className="saved-meta">
                    <Link href={`/board/${p.id}`} className="saved-title">{p.title}</Link>
                    <div className="saved-sub">@{p.author} · {p.category}</div>
                  </div>
                  <button className="saved-unsave" onClick={()=>unsave(p.id)} title="저장 취소">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        .saved-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem;}
        .saved-card{background:var(--surface);border:1px solid var(--border);border-radius:6px;overflow:hidden;position:relative;}
        .saved-thumb{display:block;aspect-ratio:1/1;background:var(--surface2);overflow:hidden;}
        .saved-thumb img{width:100%;height:100%;object-fit:cover;display:block;}
        .saved-noimg{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:2.5rem;color:var(--muted);background:var(--surface2);}
        .saved-meta{padding:.55rem .75rem;}
        .saved-title{font-family:var(--serif);font-weight:700;font-size:.95rem;color:var(--ink);text-decoration:none;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .saved-title:hover{color:var(--accent);}
        .saved-sub{font-family:var(--mono);font-size:.7rem;color:var(--muted);margin-top:.15rem;}
        .saved-unsave{position:absolute;top:.45rem;right:.45rem;background:rgba(0,0,0,.55);color:#fff;border:none;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;}
        .saved-unsave:hover{background:rgba(0,0,0,.75);}
      `}</style>
    </main>
  )
}
