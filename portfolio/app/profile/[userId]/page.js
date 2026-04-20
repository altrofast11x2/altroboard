'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function ProfilePage({ params }) {
  const [profileUser, setProfileUser] = useState(null)
  const [targetId,    setTargetId]    = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [stats,       setStats]       = useState({ followerCount: 0, followingCount: 0 })
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [posts,       setPosts]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const router = useRouter()

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (u) setCurrentUser(JSON.parse(u))

    const load = async () => {
      const { userId } = await params
      setTargetId(userId)

      // Load real user profile from DB
      const [profileRes, postsRes, statsRes] = await Promise.all([
        fetch(`/api/user/${userId}`),
        fetch('/api/posts'),
        fetch(`/api/follow?userId=${userId}`),
      ])

      const profileData = await profileRes.json()
      const allPosts    = await postsRes.json()
      const statsData   = await statsRes.json()

      if (!profileData.error) setProfileUser(profileData)
      else {
        // fallback: guess from posts
        const userPosts = allPosts.filter(p => p.authorId === userId)
        setProfileUser({ id: userId, name: userPosts[0]?.author || userId, avatar: null, bio: '' })
      }

      const myPosts = allPosts.filter(p => p.authorId === userId)
      setPosts(myPosts)
      setStats(statsData)

      if (u) {
        const me = JSON.parse(u)
        if (me.id !== userId) {
          const fRes  = await fetch(`/api/follow?followerId=${me.id}&followingId=${userId}`)
          const fData = await fRes.json()
          setIsFollowing(fData.isFollowing)
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleFollow = async () => {
    if (!currentUser) { router.push('/login'); return }
    setFollowLoading(true)
    const res  = await fetch('/api/follow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followerId: currentUser.id, followingId: targetId }),
    })
    const data = await res.json()
    setIsFollowing(data.isFollowing)
    setStats(prev => ({ ...prev, followerCount: prev.followerCount + (data.isFollowing ? 1 : -1) }))
    setFollowLoading(false)
  }

  const handleChat = () => {
    if (!currentUser) { router.push('/login'); return }
    router.push(`/chat?with=${targetId}&name=${encodeURIComponent(profileUser?.name || targetId)}`)
  }

  const isSelf = currentUser?.id === targetId

  if (loading) return (
    <main><div className="container" style={{ padding: '3rem', fontFamily: 'var(--mono)', fontSize: '0.82rem', color: 'var(--muted)' }}>불러오는 중...</div></main>
  )

  const initial = (profileUser?.name || '?')[0].toUpperCase()

  return (
    <main>
      <div className="container" style={{ maxWidth: '720px' }}>

        {/* Profile card */}
        <div className="card card-accent" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>

            {/* Avatar */}
            {profileUser?.avatar
              ? <img src={profileUser.avatar} alt={profileUser.name} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent)', boxShadow: '0 2px 12px rgba(192,57,43,.2)', flexShrink: 0 }} />
              : <div className="profile-avatar">{initial}</div>
            }

            <div style={{ flex: 1, minWidth: '160px' }}>
              <h1 style={{ fontFamily: 'var(--serif)', fontSize: '1.4rem', fontWeight: 700, color: 'var(--ink)', marginBottom: '0.2rem' }}>
                {profileUser?.name || targetId}
              </h1>
              {profileUser?.bio && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text)', marginBottom: '0.5rem', lineHeight: 1.6 }}>{profileUser.bio}</p>
              )}
              <p style={{ fontFamily: 'var(--mono)', fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
                게시글 {posts.length}개 작성
              </p>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.85rem' }}>
                {[['팔로워', stats.followerCount], ['팔로잉', stats.followingCount], ['게시글', posts.length]].map(([label, val]) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: '1.15rem', fontWeight: 700, color: 'var(--ink)' }}>{val}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '0.68rem', color: 'var(--muted)' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            {isSelf ? (
              <Link href="/mypage" className="btn btn-sm" style={{ alignSelf: 'flex-start' }}>✏️ 마이페이지</Link>
            ) : currentUser ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                <button className={`btn btn-sm ${isFollowing ? '' : 'btn-primary'}`} onClick={handleFollow} disabled={followLoading} style={{ minWidth: '90px' }}>
                  {followLoading ? '...' : isFollowing ? '✓ 팔로잉' : '+ 팔로우'}
                </button>
                <button className="btn btn-sm" onClick={handleChat} style={{ minWidth: '90px' }}>💬 메시지</button>
              </div>
            ) : (
              <Link href="/login" className="btn btn-primary btn-sm">로그인</Link>
            )}
          </div>
        </div>

        {/* Posts */}
        <div className="section-header"><h2>작성한 게시글</h2><p>{posts.length}개의 글</p></div>

        {posts.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: '0.82rem' }}>
            아직 작성한 게시글이 없습니다
          </div>
        ) : (
          <div className="board-wrap">
            <table className="board-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>분류</th>
                  <th>제목</th>
                  <th style={{ width: '44px' }}>조회</th>
                  <th style={{ width: '90px' }}>날짜</th>
                </tr>
              </thead>
              <tbody>
                {posts.map(p => (
                  <tr key={p.id} onClick={() => router.push(`/board/${p.id}`)} style={{ cursor: 'pointer' }}>
                    <td><span className="badge">{p.category}</span></td>
                    <td style={{ fontWeight: 400 }}>{p.title}</td>
                    <td className="meta">{p.views ?? 0}</td>
                    <td className="meta">{new Date(p.createdAt).toLocaleDateString('ko-KR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
