'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function ProfilePage({ params }) {
  const [profileUser, setProfileUser] = useState(null)
  const [targetId, setTargetId] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [stats, setStats] = useState({ followerCount: 0, followingCount: 0 })
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (u) setCurrentUser(JSON.parse(u))

    const load = async () => {
      const { userId } = await params
      setTargetId(userId)

      // Load all posts and filter by author
      const postsRes = await fetch('/api/posts')
      const allPosts = await postsRes.json()
      const userPosts = allPosts.filter(p => p.authorId === userId)
      setPosts(userPosts)

      if (userPosts.length > 0) {
        setProfileUser({ id: userId, name: userPosts[0].author })
      } else {
        setProfileUser({ id: userId, name: userId })
      }

      // Load follow stats
      const statsRes = await fetch(`/api/follow?userId=${userId}`)
      setStats(await statsRes.json())

      // Check if current user follows this profile
      if (u) {
        const me = JSON.parse(u)
        if (me.id !== userId) {
          const followRes = await fetch(`/api/follow?followerId=${me.id}&followingId=${userId}`)
          const followData = await followRes.json()
          setIsFollowing(followData.isFollowing)
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleFollow = async () => {
    if (!currentUser) { router.push('/login'); return }
    setFollowLoading(true)
    const res = await fetch('/api/follow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followerId: currentUser.id, followingId: targetId }),
    })
    const data = await res.json()
    setIsFollowing(data.isFollowing)
    setStats(prev => ({
      ...prev,
      followerCount: prev.followerCount + (data.isFollowing ? 1 : -1),
    }))
    setFollowLoading(false)
  }

  const handleChat = () => {
    if (!currentUser) { router.push('/login'); return }
    router.push(`/chat?with=${targetId}&name=${encodeURIComponent(profileUser?.name || targetId)}`)
  }

  const isSelf = currentUser?.id === targetId

  if (loading) return (
    <main>
      <div className="container" style={{ padding: '3rem', fontFamily: 'var(--mono)', fontSize: '0.82rem', color: 'var(--muted)' }}>
        불러오는 중...
      </div>
    </main>
  )

  return (
    <main>
      <div className="container" style={{ maxWidth: '720px' }}>

        {/* Profile card */}
        <div className="card card-accent" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            {/* Avatar */}
            <div className="profile-avatar">
              {(profileUser?.name || '?')[0].toUpperCase()}
            </div>

            <div style={{ flex: 1, minWidth: '160px' }}>
              <h1 style={{ fontFamily: 'var(--serif)', fontSize: '1.4rem', fontWeight: 700, color: 'var(--ink)', marginBottom: '0.25rem' }}>
                {profileUser?.name || targetId}
              </h1>
              <p style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--muted)' }}>
                게시글 {posts.length}개 작성
              </p>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.85rem' }}>
                {[
                  ['팔로워', stats.followerCount],
                  ['팔로잉', stats.followingCount],
                  ['게시글', posts.length],
                ].map(([label, val]) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--ink)' }}>{val}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '0.68rem', color: 'var(--muted)' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            {!isSelf && currentUser && (
              <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                <button
                  className={`btn btn-sm ${isFollowing ? '' : 'btn-primary'}`}
                  onClick={handleFollow}
                  disabled={followLoading}
                  style={{ minWidth: '90px' }}
                >
                  {followLoading ? '...' : isFollowing ? '✓ 팔로잉' : '+ 팔로우'}
                </button>
                <button className="btn btn-sm" onClick={handleChat} style={{ minWidth: '90px' }}>
                  💬 메시지
                </button>
              </div>
            )}
            {!isSelf && !currentUser && (
              <Link href="/login" className="btn btn-primary btn-sm">로그인</Link>
            )}
            {isSelf && (
              <span className="badge badge-green" style={{ alignSelf: 'flex-start' }}>내 프로필</span>
            )}
          </div>
        </div>

        {/* Posts */}
        <div className="section-header">
          <h2>작성한 게시글</h2>
          <p>{posts.length}개의 글</p>
        </div>

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

      <style>{`
        .profile-avatar {
          width: 72px; height: 72px;
          border-radius: 50%;
          background: var(--accent);
          color: #fff;
          font-family: var(--serif);
          font-size: 1.8rem;
          font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 2px 12px rgba(192,57,43,0.25);
        }
      `}</style>
    </main>
  )
}
