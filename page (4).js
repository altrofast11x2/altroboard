'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const TABS = ['내 정보', '게시글', '팔로워', '팔로잉']

export default function MyPage() {
  const [user,      setUser]      = useState(null)
  const [profile,   setProfile]   = useState(null)
  const [posts,     setPosts]     = useState([])
  const [followers, setFollowers] = useState([])
  const [following, setFollowing] = useState([])
  const [stats,     setStats]     = useState({ followerCount: 0, followingCount: 0 })
  const [tab,       setTab]       = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [editName,  setEditName]  = useState('')
  const [editBio,   setEditBio]   = useState('')
  const [editMode,  setEditMode]  = useState(false)
  const [followerProfiles, setFollowerProfiles] = useState([])
  const [followingProfiles, setFollowingProfiles] = useState([])
  const [saveMsg,   setSaveMsg]   = useState('')
  const fileRef = useRef(null)
  const router  = useRouter()

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (!raw) { router.push('/login'); return }
    const u = JSON.parse(raw)
    setUser(u)
    loadAll(u)
  }, [])

  const loadAll = async (u) => {
    setLoading(true)
    const [profileRes, postsRes, statsRes] = await Promise.all([
      fetch(`/api/user/${u.id}`),
      fetch('/api/posts'),
      fetch(`/api/follow?userId=${u.id}`),
    ])

    const profileData = await profileRes.json()
    const allPosts    = await postsRes.json()
    const statsData   = await statsRes.json()

    setProfile(profileData)
    setEditName(profileData.name || '')
    setEditBio(profileData.bio   || '')

    const myPosts = allPosts.filter(p => p.authorId === u.id)
    setPosts(myPosts)

    setStats(statsData)
    setFollowers(statsData.followers || [])
    setFollowing(statsData.following || [])

    // Load follower / following profiles
    const [followerProfs, followingProfs] = await Promise.all([
      Promise.all((statsData.followers || []).map(id => fetch(`/api/user/${id}`).then(r => r.json()).catch(() => ({ id, name: id })))),
      Promise.all((statsData.following || []).map(id => fetch(`/api/user/${id}`).then(r => r.json()).catch(() => ({ id, name: id })))),
    ])
    setFollowerProfiles(followerProfs)
    setFollowingProfiles(followingProfs)
    setLoading(false)
  }

  const saveProfile = async () => {
    if (!user) return
    setSaving(true)
    const res  = await fetch(`/api/user/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, name: editName, bio: editBio }),
    })
    const data = await res.json()
    if (data.error) { alert(data.error); setSaving(false); return }

    // Update localStorage
    const updated = { ...user, name: data.name, bio: data.bio }
    localStorage.setItem('user', JSON.stringify(updated))
    setUser(updated)
    setProfile(data)
    setEditMode(false)
    setSaving(false)
    setSaveMsg('저장됐어요!')
    setTimeout(() => setSaveMsg(''), 2500)
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setAvatarLoading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('userId', user.id)
    const res  = await fetch(`/api/user/${user.id}`, { method: 'PATCH', body: fd })
    const data = await res.json()
    if (data.error) { alert(data.error); setAvatarLoading(false); return }
    const updated = { ...user, avatar: data.avatar }
    localStorage.setItem('user', JSON.stringify(updated))
    setUser(updated)
    setProfile(prev => ({ ...prev, avatar: data.avatar }))
    setAvatarLoading(false)
    e.target.value = ''
  }

  const handleUnfollow = async (targetId) => {
    if (!user) return
    await fetch('/api/follow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followerId: user.id, followingId: targetId }),
    })
    setFollowingProfiles(prev => prev.filter(p => p.id !== targetId))
    setStats(prev => ({ ...prev, followingCount: prev.followingCount - 1 }))
  }

  if (loading || !user) return (
    <main><div className="container" style={{ padding: '3rem', fontFamily: 'var(--mono)', fontSize: '0.82rem', color: 'var(--muted)' }}>불러오는 중...</div></main>
  )

  const initial = (profile?.name || user.name || '?')[0].toUpperCase()

  return (
    <main>
      <div className="container" style={{ maxWidth: '780px' }}>

        {/* ── PROFILE HEADER ── */}
        <div className="card card-accent" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem', flexWrap: 'wrap' }}>

            {/* Avatar */}
            <div className="mp-avatar-wrap" onClick={() => fileRef.current?.click()} title="클릭해서 사진 변경">
              {(profile?.avatar || user.avatar)
                ? <img src={profile?.avatar || user.avatar} alt="프로필" className="mp-avatar-img" />
                : <div className="mp-avatar-placeholder">{initial}</div>
              }
              <div className="mp-avatar-overlay">
                {avatarLoading ? '⏳' : '📷'}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: '180px' }}>
              {editMode ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.72rem' }}>닉네임 (최대 30자)</label>
                    <input value={editName} onChange={e => setEditName(e.target.value)} maxLength={30} style={{ fontSize: '0.9rem', padding: '0.35rem 0.6rem' }} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.72rem' }}>한 줄 소개 (최대 150자)</label>
                    <textarea value={editBio} onChange={e => setEditBio(e.target.value)} maxLength={150} rows={2}
                      style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '2px', padding: '0.35rem 0.6rem', color: 'var(--text)', fontSize: '0.82rem', resize: 'none', outline: 'none', fontFamily: 'var(--font)' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-primary btn-sm" onClick={saveProfile} disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
                    <button className="btn btn-sm" onClick={() => { setEditMode(false); setEditName(profile?.name || ''); setEditBio(profile?.bio || '') }}>취소</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.3rem' }}>
                    <h1 style={{ fontFamily: 'var(--serif)', fontSize: '1.4rem', fontWeight: 700, color: 'var(--ink)' }}>
                      {profile?.name || user.name}
                    </h1>
                    {user.role === 'admin' && <span className="badge">👑 관리자</span>}
                  </div>
                  <p style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
                    {profile?.email || user.email}
                  </p>
                  {profile?.bio
                    ? <p style={{ fontSize: '0.875rem', color: 'var(--text)', marginBottom: '0.75rem', lineHeight: 1.6 }}>{profile.bio}</p>
                    : <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '0.75rem', fontStyle: 'italic' }}>한 줄 소개를 작성해보세요</p>
                  }
                  {profile?.createdAt && (
                    <p style={{ fontFamily: 'var(--mono)', fontSize: '0.68rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
                      가입일: {new Date(profile.createdAt).toLocaleDateString('ko-KR')}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button className="btn btn-sm" onClick={() => setEditMode(true)}>✏️ 프로필 편집</button>
                    {saveMsg && <span style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: '#27ae60' }}>{saveMsg}</span>}
                  </div>
                </>
              )}
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '1.25rem', alignSelf: 'center' }}>
              {[['게시글', posts.length], ['팔로워', stats.followerCount], ['팔로잉', stats.followingCount]].map(([label, val]) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--ink)' }}>{val}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '0.68rem', color: 'var(--muted)' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="tab-row" style={{ marginBottom: '1rem' }}>
          {TABS.map((t, i) => (
            <button key={t} className={`tab-btn ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>
              {t}
              {i === 2 && stats.followerCount > 0 && <span className="tab-count">{stats.followerCount}</span>}
              {i === 3 && stats.followingCount > 0 && <span className="tab-count">{stats.followingCount}</span>}
            </button>
          ))}
        </div>

        {/* ── TAB 0: 내 정보 ── */}
        {tab === 0 && (
          <div className="card">
            <h3 style={{ fontFamily: 'var(--serif)', marginBottom: '1rem', color: 'var(--ink)' }}>계정 정보</h3>
            <div className="info-row"><span>닉네임</span><span>{profile?.name || user.name}</span></div>
            <div className="info-row"><span>이메일</span><span>{profile?.email || user.email}</span></div>
            <div className="info-row"><span>권한</span><span>{user.role === 'admin' ? '👑 관리자' : '일반 회원'}</span></div>
            <div className="info-row"><span>가입일</span><span>{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('ko-KR') : '–'}</span></div>
            <div className="info-row"><span>소개</span><span style={{ flex: 1, textAlign: 'right' }}>{profile?.bio || '–'}</span></div>
            <div className="info-row"><span>작성 게시글</span><span>{posts.length}개</span></div>
            <div className="info-row"><span>팔로워</span><span>{stats.followerCount}명</span></div>
            <div className="info-row" style={{ border: 'none' }}><span>팔로잉</span><span>{stats.followingCount}명</span></div>
          </div>
        )}

        {/* ── TAB 1: 게시글 ── */}
        {tab === 1 && (
          posts.length === 0
            ? <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: '0.82rem' }}>
                아직 작성한 게시글이 없습니다
                <div style={{ marginTop: '1rem' }}><Link href="/board/write" className="btn btn-primary btn-sm">첫 글 쓰기</Link></div>
              </div>
            : <div className="board-wrap">
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

        {/* ── TAB 2: 팔로워 ── */}
        {tab === 2 && (
          followerProfiles.length === 0
            ? <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: '0.82rem' }}>
                아직 팔로워가 없습니다
              </div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {followerProfiles.map(fp => (
                  <div key={fp.id} className="card user-card">
                    {fp.avatar
                      ? <img src={fp.avatar} alt={fp.name} className="uc-avatar-img" />
                      : <div className="uc-avatar">{(fp.name || '?')[0].toUpperCase()}</div>
                    }
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--serif)', fontWeight: 700, color: 'var(--ink)' }}>{fp.name || fp.id}</div>
                      {fp.bio && <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.15rem' }}>{fp.bio}</div>}
                    </div>
                    <Link href={`/profile/${fp.id}`} className="btn btn-sm">프로필</Link>
                  </div>
                ))}
              </div>
        )}

        {/* ── TAB 3: 팔로잉 ── */}
        {tab === 3 && (
          followingProfiles.length === 0
            ? <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: '0.82rem' }}>
                팔로잉하는 사람이 없습니다
              </div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {followingProfiles.map(fp => (
                  <div key={fp.id} className="card user-card">
                    {fp.avatar
                      ? <img src={fp.avatar} alt={fp.name} className="uc-avatar-img" />
                      : <div className="uc-avatar">{(fp.name || '?')[0].toUpperCase()}</div>
                    }
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--serif)', fontWeight: 700, color: 'var(--ink)' }}>{fp.name || fp.id}</div>
                      {fp.bio && <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.15rem' }}>{fp.bio}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Link href={`/profile/${fp.id}`} className="btn btn-sm">프로필</Link>
                      <button className="btn btn-danger btn-sm" onClick={() => handleUnfollow(fp.id)}>언팔로우</button>
                    </div>
                  </div>
                ))}
              </div>
        )}

      </div>

      <style>{`
        /* Avatar */
        .mp-avatar-wrap {
          position: relative; width: 88px; height: 88px;
          cursor: pointer; flex-shrink: 0; border-radius: 50%;
        }
        .mp-avatar-img {
          width: 88px; height: 88px; border-radius: 50%;
          object-fit: cover; border: 2px solid var(--accent);
          box-shadow: 0 2px 12px rgba(192,57,43,.22);
        }
        .mp-avatar-placeholder {
          width: 88px; height: 88px; border-radius: 50%;
          background: var(--accent); color: #fff;
          font-family: var(--serif); font-size: 2.2rem; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 12px rgba(192,57,43,.22);
        }
        .mp-avatar-overlay {
          position: absolute; inset: 0; border-radius: 50%;
          background: rgba(0,0,0,.42); color: #fff; font-size: 1.3rem;
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity .2s;
        }
        .mp-avatar-wrap:hover .mp-avatar-overlay { opacity: 1; }

        /* Tab count bubble */
        .tab-count {
          display: inline-block; margin-left: 4px;
          background: var(--accent); color: #fff;
          border-radius: 10px; font-size: .62rem; padding: .05rem .38rem;
          font-family: var(--mono); line-height: 1.5;
        }

        /* Info rows */
        .info-row {
          display: flex; justify-content: space-between; align-items: flex-start;
          padding: .6rem 0; border-bottom: 1px solid rgba(212,201,168,.4);
          font-size: .875rem;
          gap: 1rem;
        }
        .info-row > span:first-child {
          font-family: var(--mono); font-size: .75rem; color: var(--muted); flex-shrink: 0;
        }
        .info-row > span:last-child { color: var(--text); text-align: right; }

        /* User cards (followers/following) */
        .user-card {
          display: flex; align-items: center; gap: 1rem;
          padding: .85rem 1rem !important;
        }
        .uc-avatar {
          width: 44px; height: 44px; border-radius: 50%;
          background: var(--accent); color: #fff;
          font-family: var(--serif); font-size: 1.1rem; font-weight: 700;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .uc-avatar-img {
          width: 44px; height: 44px; border-radius: 50%;
          object-fit: cover; flex-shrink: 0;
          border: 1.5px solid var(--border);
        }
      `}</style>
    </main>
  )
}
