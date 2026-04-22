'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function SuggestedUsers({ maxItems = 6 }) {
  const [user,      setUser]      = useState(null)
  const [users,     setUsers]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [following, setFollowing] = useState({})
  const [loadingId, setLoadingId] = useState(null)
  const router = useRouter()

  useEffect(() => {
    const raw = localStorage.getItem('user')
    const u = raw ? JSON.parse(raw) : null
    setUser(u)
    load(u?.id)
  }, [])

  const load = async (userId) => {
    setLoading(true)
    try {
      const url = `/api/suggest-users?limit=${maxItems}${userId ? `&userId=${userId}` : ''}`
      const res  = await fetch(url)
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch {}
    setLoading(false)
  }

  const handleFollow = async (targetId) => {
    if (!user) { router.push('/login'); return }
    setLoadingId(targetId)
    const res  = await fetch('/api/follow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followerId: user.id, followingId: targetId }),
    })
    const data = await res.json()
    setFollowing(prev => ({ ...prev, [targetId]: data.isFollowing }))
    setLoadingId(null)
    if (data.isFollowing) {
      setTimeout(() => setUsers(prev => prev.filter(u => u.id !== targetId)), 1000)
    }
  }

  if (loading || users.length === 0) return null

  return (
    <div className="suggest-wrap">
      <div className="suggest-header">
        <span>✨ 팔로워 추천</span>
        <Link href="/board" style={{ fontFamily:'var(--mono)', fontSize:'0.7rem', color:'var(--accent)' }}>
          더 탐색하기 →
        </Link>
      </div>

      {users.map(u => {
        const isF = following[u.id]
        return (
          <div key={u.id} className="suggest-row">
            <Link href={`/profile/${u.id}`} className="suggest-avatar-link">
              {u.avatar
                ? <img src={u.avatar} alt={u.name} className="suggest-av-img" />
                : <div className="suggest-av-ph">{(u.name||'?')[0].toUpperCase()}</div>
              }
            </Link>
            <div className="suggest-info">
              <Link href={`/profile/${u.id}`} className="suggest-name">{u.name}</Link>
              <div className="suggest-meta">
                {u.score >= 5 && <span className="suggest-badge red">나를 팔로우 중</span>}
                {u.score >= 3 && u.score < 5 && <span className="suggest-badge green">친구의 친구</span>}
                {u.postCount > 0 && <span className="suggest-badge gray">{u.postCount}개 게시글</span>}
              </div>
            </div>
            <button
              className={`suggest-btn ${isF ? 'done' : ''}`}
              onClick={() => handleFollow(u.id)}
              disabled={loadingId === u.id}
            >
              {loadingId === u.id ? '...' : isF ? '✓' : '팔로우'}
            </button>
          </div>
        )
      })}

      <style>{`
        .suggest-wrap{border:1px solid var(--border);border-radius:4px;background:var(--surface);overflow:hidden;margin-bottom:1.5rem;}
        .suggest-header{display:flex;justify-content:space-between;align-items:center;padding:.7rem 1rem;border-bottom:1px solid var(--border);background:var(--surface2);font-family:var(--mono);font-size:.73rem;color:var(--muted);}
        .suggest-row{display:flex;align-items:center;gap:.75rem;padding:.65rem 1rem;border-bottom:1px solid rgba(212,201,168,.3);transition:background .15s;}
        .suggest-row:last-child{border-bottom:none;}
        .suggest-row:hover{background:var(--surface2);}
        .suggest-avatar-link{flex-shrink:0;}
        .suggest-av-img{width:36px;height:36px;border-radius:50%;object-fit:cover;border:1.5px solid var(--border);}
        .suggest-av-ph{width:36px;height:36px;border-radius:50%;background:var(--accent);color:#fff;font-family:var(--serif);font-size:.95rem;font-weight:700;display:flex;align-items:center;justify-content:center;}
        .suggest-info{flex:1;min-width:0;}
        .suggest-name{font-family:var(--mono);font-size:.78rem;font-weight:500;color:var(--ink);text-decoration:none;display:block;}
        .suggest-name:hover{color:var(--accent);}
        .suggest-meta{display:flex;gap:.35rem;flex-wrap:wrap;margin-top:.15rem;}
        .suggest-badge{font-family:var(--mono);font-size:.6rem;padding:.05rem .38rem;border-radius:10px;}
        .suggest-badge.red{background:rgba(192,57,43,.1);color:var(--accent);border:1px solid rgba(192,57,43,.2);}
        .suggest-badge.green{background:rgba(39,174,96,.1);color:#27ae60;border:1px solid rgba(39,174,96,.2);}
        .suggest-badge.gray{background:var(--surface2);color:var(--muted);border:1px solid var(--border);}
        .suggest-btn{flex-shrink:0;background:var(--accent);color:#fff;border:none;border-radius:3px;padding:.28rem .7rem;font-family:var(--mono);font-size:.7rem;cursor:pointer;transition:all .2s;white-space:nowrap;}
        .suggest-btn:hover{background:var(--accent2);}
        .suggest-btn.done{background:var(--surface2);color:var(--muted);border:1px solid var(--border);}
        .suggest-btn:disabled{opacity:.6;cursor:not-allowed;}
      `}</style>
    </div>
  )
}
