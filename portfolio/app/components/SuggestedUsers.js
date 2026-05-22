'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// 메인 페이지 사이드바 — Instagram 추천 화면 톤.
// - 비로그인은 아예 렌더 안 함 (Guest 에겐 추천 안 보임)
// - 초기 N명 노출 후 '더 보기' 펼치면 아래로 추가 (게시판으로 이동하던 동작 제거)
// - 각 행은 큰 아바타 + 이름 + 작은 이유 라벨 + 팔로우 버튼

export default function SuggestedUsers({ initial = 6, expandedSize = 18 }) {
  const [user,      setUser]      = useState(null)
  const [users,     setUsers]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [following, setFollowing] = useState({})
  const [loadingId, setLoadingId] = useState(null)
  const [expanded,  setExpanded]  = useState(false)
  const router = useRouter()

  useEffect(() => {
    const raw = typeof window !== 'undefined' && localStorage.getItem('user')
    if (!raw) { setLoading(false); return }   // 비로그인은 데이터 호출도 안 함
    const u = JSON.parse(raw)
    setUser(u)
    load(u?.id, expandedSize)
  }, [])

  const load = async (userId, limit) => {
    setLoading(true)
    try {
      const url = `/api/suggest-users?limit=${limit}${userId ? `&userId=${userId}` : ''}`
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
  }

  // 비로그인 OR 로딩 중 OR 추천 없음 → 렌더 안 함
  if (!user) return null
  if (loading) return null
  if (users.length === 0) return null

  const visible = expanded ? users : users.slice(0, initial)

  return (
    <div className="suggest-wrap">
      <div className="suggest-header">
        <span className="suggest-h-label">추천</span>
        {users.length > initial && !expanded && (
          <button className="suggest-h-link" onClick={()=>setExpanded(true)}>모두 보기</button>
        )}
        {expanded && users.length > initial && (
          <button className="suggest-h-link" onClick={()=>setExpanded(false)}>접기</button>
        )}
      </div>

      <div className="suggest-list">
        {visible.map(u => {
          const isF = following[u.id]
          const reason = u.score >= 5 ? '나를 팔로우합니다'
            : u.score >= 3 ? '친구가 팔로우합니다'
            : u.postCount > 0 ? `게시글 ${u.postCount}개`
            : '회원님을 위한 추천'
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
                <div className="suggest-reason">{reason}</div>
              </div>
              <button
                className={`suggest-btn ${isF ? 'done' : ''}`}
                onClick={() => handleFollow(u.id)}
                disabled={loadingId === u.id}
              >
                {loadingId === u.id ? '...' : isF ? '팔로잉' : '팔로우'}
              </button>
            </div>
          )
        })}
      </div>

      <style>{`
        .suggest-wrap{font-family:var(--font);}
        .suggest-header{display:flex;justify-content:space-between;align-items:center;padding:.4rem .25rem .8rem;font-family:var(--mono);}
        .suggest-h-label{font-size:.82rem;color:var(--muted);font-weight:600;}
        .suggest-h-link{background:none;border:none;color:var(--ink);font-family:var(--mono);font-size:.72rem;font-weight:700;cursor:pointer;padding:.15rem .35rem;}
        .suggest-h-link:hover{color:var(--accent);}
        .suggest-list{display:flex;flex-direction:column;gap:.5rem;}
        .suggest-row{display:flex;align-items:center;gap:.7rem;padding:.35rem .25rem;}
        .suggest-avatar-link{flex-shrink:0;}
        .suggest-av-img{width:42px;height:42px;border-radius:50%;object-fit:cover;border:1px solid var(--border);}
        .suggest-av-ph{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,var(--accent),#7b1a12);color:#fff;font-family:var(--serif);font-size:1.05rem;font-weight:700;display:flex;align-items:center;justify-content:center;}
        .suggest-info{flex:1;min-width:0;}
        .suggest-name{font-family:var(--mono);font-size:.82rem;font-weight:700;color:var(--ink);text-decoration:none;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .suggest-name:hover{color:var(--accent);}
        .suggest-reason{font-family:var(--mono);font-size:.68rem;color:var(--muted);margin-top:.1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .suggest-btn{flex-shrink:0;background:none;border:none;color:var(--accent);font-family:var(--mono);font-size:.75rem;font-weight:700;cursor:pointer;padding:.2rem .35rem;}
        .suggest-btn:hover{color:var(--accent2);}
        .suggest-btn.done{color:var(--muted);}
        .suggest-btn:disabled{opacity:.6;cursor:not-allowed;}
      `}</style>
    </div>
  )
}
