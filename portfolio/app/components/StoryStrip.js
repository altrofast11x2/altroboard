'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function StoryStrip() {
  const [stories,  setStories]  = useState([])
  const [user,     setUser]     = useState(null)
  const router = useRouter()

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (u) setUser(JSON.parse(u))
    fetch('/api/stories').then(r => r.json()).then(d => setStories(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  // group by author, dedupe
  const seen = {}
  const groups = []
  stories.forEach(s => {
    if (!seen[s.authorId]) {
      seen[s.authorId] = true
      groups.push({ authorId: s.authorId, authorName: s.authorName, authorAvatar: s.authorAvatar, bg: s.bgColor })
    }
  })

  if (groups.length === 0 && !user) return null

  return (
    <div className="strip-wrap">
      <div className="strip-header">
        <span>✨ 스토리</span>
        <Link href="/stories" style={{ fontFamily: 'var(--mono)', fontSize: '0.7rem', color: 'var(--accent)' }}>전체 보기 →</Link>
      </div>
      <div className="strip-row">
        {user && (
          <Link href="/stories" className="strip-item">
            <div className="strip-bubble add">
              <span style={{ fontSize: '1.3rem', color: 'rgba(245,240,232,0.6)' }}>+</span>
            </div>
            <span className="strip-name">추가</span>
          </Link>
        )}
        {groups.slice(0, 10).map(g => (
          <Link href="/stories" key={g.authorId} className="strip-item">
            <div className="strip-bubble" style={{ background: g.bg || '#1a1208' }}>
              {g.authorAvatar
                ? <img src={g.authorAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : <span style={{ color: '#fff', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: '1rem' }}>
                    {(g.authorName || '?')[0].toUpperCase()}
                  </span>
              }
            </div>
            <span className="strip-name">{g.authorName}</span>
          </Link>
        ))}
        {groups.length === 0 && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--muted)', padding: '0 0.5rem' }}>
            스토리가 없어요
          </span>
        )}
      </div>

      <style>{`
        .strip-wrap{border:1px solid var(--border);border-radius:2px;padding:.85rem 1rem;margin-bottom:1.5rem;background:var(--surface);}
        .strip-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;font-family:var(--mono);font-size:.75rem;color:var(--muted);}
        .strip-row{display:flex;gap:1rem;overflow-x:auto;padding-bottom:.25rem;scrollbar-width:none;}
        .strip-row::-webkit-scrollbar{display:none;}
        .strip-item{display:flex;flex-direction:column;align-items:center;gap:.3rem;flex-shrink:0;cursor:pointer;text-decoration:none;}
        .strip-bubble{width:50px;height:50px;border-radius:50%;border:2.5px solid var(--accent);display:flex;align-items:center;justify-content:center;overflow:hidden;transition:transform .2s;}
        .strip-bubble:hover{transform:scale(1.1);}
        .strip-bubble.add{background:var(--ink);border-style:dashed;border-color:var(--border-dark);}
        .strip-name{font-family:var(--mono);font-size:.6rem;color:var(--muted);max-width:52px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      `}</style>
    </div>
  )
}
