'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const TABS = ['내 정보', '게시글', '팔로워', '팔로잉', '프로필 음악']

function ProfileMusicTab({ user, profile, setProfile }) {
  const [musicUrl,   setMusicUrl]   = useState(profile?.profileMusic?.url   || '')
  const [musicTitle, setMusicTitle] = useState(profile?.profileMusic?.title || '')
  const [audioFile,  setAudioFile]  = useState(null)
  const [audioName,  setAudioName]  = useState('')
  const [saving,     setSaving]     = useState(false)
  const [saveMsg,    setSaveMsg]    = useState('')
  const [err,        setErr]        = useState('')
  const [playing,    setPlaying]    = useState(false)
  const audioRef = useRef(null)
  const fileRef  = useRef(null)

  const togglePlay = () => {
    const url = audioFile ? URL.createObjectURL(audioFile) : musicUrl
    if (!url) return
    if (!audioRef.current) audioRef.current = new Audio(url)
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play().catch(() => {}); setPlaying(true) }
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true); setErr(''); setSaveMsg('')
    try {
      let finalUrl = musicUrl
      let finalTitle = musicTitle.trim()

      if (audioFile) {
        const fd = new FormData(); fd.append('file', audioFile)
        const res = await fetch('/api/upload-audio', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok || !data.url) { setErr(data.error || '업로드 실패'); setSaving(false); return }
        finalUrl = data.url
        if (!finalTitle) finalTitle = audioName
      }

      const res = await fetch(`/api/user/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, profileMusic: finalUrl ? { url: finalUrl, title: finalTitle } : null }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || '저장 실패'); setSaving(false); return }
      setProfile(prev => ({ ...prev, profileMusic: finalUrl ? { url: finalUrl, title: finalTitle } : null }))
      setMusicUrl(finalUrl); setMusicTitle(finalTitle)
      setAudioFile(null); setAudioName('')
      setSaveMsg('저장됐어요!'); setTimeout(() => setSaveMsg(''), 2500)
    } catch(e) { setErr(e.message) }
    setSaving(false)
  }

  const handleRemove = async () => {
    if (!user || !confirm('프로필 음악을 삭제할까요?')) return
    setSaving(true)
    await fetch(`/api/user/${user.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, profileMusic: null }),
    })
    setMusicUrl(''); setMusicTitle(''); setAudioFile(null); setAudioName('')
    setProfile(prev => ({ ...prev, profileMusic: null }))
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    setPlaying(false); setSaving(false); setSaveMsg('삭제됐어요!'); setTimeout(() => setSaveMsg(''), 2000)
  }

  return (
    <div className="card">
      <h3 style={{ fontFamily:'var(--serif)', marginBottom:'0.25rem', color:'var(--ink)' }}>프로필 음악</h3>
      <p style={{ fontFamily:'var(--mono)', fontSize:'0.75rem', color:'var(--muted)', marginBottom:'1.25rem' }}>
        프로필에 방문하면 자동으로 재생되는 음악을 설정할 수 있어요
      </p>

      {(musicUrl || audioFile) && (
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'0.75rem 1rem', marginBottom:'1rem' }}>
          <button onClick={togglePlay} style={{ background:'var(--accent)', border:'none', color:'#fff', width:36, height:36, borderRadius:'50%', cursor:'pointer', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            {playing ? '⏸' : '▶'}
          </button>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:'var(--mono)', fontSize:'0.78rem', color:'var(--ink)', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {audioFile ? audioName : (musicTitle || '설정된 음악')}
            </div>
            <div style={{ fontFamily:'var(--mono)', fontSize:'0.68rem', color:'var(--muted)' }}>{audioFile ? '새 파일 선택됨' : '현재 프로필 음악'}</div>
          </div>
          {!audioFile && musicUrl && (
            <button onClick={handleRemove} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'0.8rem' }}>삭제</button>
          )}
        </div>
      )}

      <div style={{ marginBottom:'0.75rem' }}>
        <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
          {audioFile ? `✓ ${audioName.slice(0,30)}` : '음악 파일 선택 (mp3/wav · 10MB)'}
        </button>
        {audioFile && (
          <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', marginLeft:'0.5rem', fontSize:'0.8rem' }}
            onClick={() => { setAudioFile(null); setAudioName(''); setPlaying(false); if (audioRef.current) { audioRef.current.pause(); audioRef.current = null } }}>×</button>
        )}
        <input ref={fileRef} type="file" accept="audio/*" style={{ display:'none' }}
          onChange={e => {
            const f = e.target.files?.[0]; if (!f) return
            if (f.size > 10*1024*1024) { alert('10MB 이하만 가능합니다'); return }
            if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; setPlaying(false) }
            setAudioFile(f); setAudioName(f.name)
          }}/>
      </div>

      <div className="form-group" style={{ marginBottom:'0.75rem' }}>
        <label style={{ fontSize:'0.72rem' }}>음악 제목 <span style={{ color:'var(--muted)', fontWeight:300 }}>(선택)</span></label>
        <input value={musicTitle} onChange={e => setMusicTitle(e.target.value)} placeholder="예: Lo-fi - Rainy Day" maxLength={60}/>
      </div>

      {err     && <p style={{ fontFamily:'var(--mono)', fontSize:'0.75rem', color:'var(--accent)', marginBottom:'0.5rem' }}>{err}</p>}
      {saveMsg && <p style={{ fontFamily:'var(--mono)', fontSize:'0.75rem', color:'#27ae60', marginBottom:'0.5rem' }}>{saveMsg}</p>}

      <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || (!audioFile && !musicUrl)}>
        {saving ? '저장 중...' : '저장'}
      </button>
    </div>
  )
}

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
  const [lang, setLang] = useState('ko')
  const fileRef = useRef(null)
  const router  = useRouter()

  useEffect(() => {
    setLang(localStorage.getItem('cozyboard_lang') || 'ko')
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

    // Load follower / following profiles — id 보장 + 중복 제거 (key 누락/충돌 방지)
    const fetchProfile = (id) => fetch(`/api/user/${id}`)
      .then(r => r.json())
      .then(p => (p && (p.id || p.email)) ? { ...p, id: p.id || id } : { id, name: id })
      .catch(() => ({ id, name: id }))
    const dedupe = (arr) => {
      const seen = new Set()
      return arr.filter(p => {
        if (!p?.id || seen.has(p.id)) return false
        seen.add(p.id); return true
      })
    }
    const [followerProfs, followingProfs] = await Promise.all([
      Promise.all((statsData.followers || []).filter(Boolean).map(fetchProfile)).then(dedupe),
      Promise.all((statsData.following || []).filter(Boolean).map(fetchProfile)).then(dedupe),
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
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || '저장 중 오류가 발생했습니다')
      setSaving(false)
      return
    }
    const data = await res.json()
    const updated = { ...user, name: data.name || editName }
    localStorage.setItem('user', JSON.stringify(updated))
    setUser(updated)
    setProfile(prev => ({ ...prev, name: data.name || editName, bio: data.bio ?? editBio }))
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
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || '업로드 중 오류가 발생했습니다')
      setAvatarLoading(false)
      return
    }
    const data = await res.json()
    const avatarUrl = data.avatar
    const updated = { ...user, avatar: avatarUrl }
    localStorage.setItem('user', JSON.stringify(updated))
    setUser(updated)
    setProfile(prev => ({ ...prev, avatar: avatarUrl }))
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

  // 팔로워 끊기 (= 그 사람이 나를 팔로우하는 관계를 끊음)
  const handleRemoveFollower = async (followerId) => {
    if (!user) return
    if (!confirm('이 팔로워를 끊으시겠습니까?')) return
    await fetch('/api/follow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followerId, followingId: user.id, action: 'removeFollower' }),
    })
    setFollowerProfiles(prev => prev.filter(p => p.id !== followerId))
    setStats(prev => ({ ...prev, followerCount: Math.max(0, prev.followerCount - 1) }))
  }

  // 인증 신청 상태
  const [verifyReq, setVerifyReq] = useState(null) // 본인의 가장 최근 신청
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [verifyForm, setVerifyForm] = useState({ reason: '', links: '' })
  const [verifySubmitting, setVerifySubmitting] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState('')

  useEffect(() => {
    if (!user) return
    fetch(`/api/verify-requests?userId=${user.id}`)
      .then(r => r.json())
      .then(d => setVerifyReq(d))
      .catch(() => {})
  }, [user])

  const submitVerify = async () => {
    setVerifyMsg('')
    if (!verifyForm.reason.trim()) { setVerifyMsg('신청 사유를 입력하세요'); return }
    setVerifySubmitting(true)
    const res = await fetch('/api/verify-requests', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, reason: verifyForm.reason, links: verifyForm.links }),
    })
    const data = await res.json()
    setVerifySubmitting(false)
    if (!res.ok) { setVerifyMsg(data.error || '신청 실패'); return }
    setVerifyReq(data)
    setVerifyOpen(false)
    setVerifyForm({ reason: '', links: '' })
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap:'wrap' }}>
                    <h1 style={{ fontFamily: 'var(--serif)', fontSize: '1.4rem', fontWeight: 700, color: 'var(--ink)' }}>
                      {profile?.name || user.name}
                    </h1>
                    {profile?.verified && (
                      <span title="인증된 사용자" style={{display:'inline-flex',alignItems:'center'}}>
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="#2980b9">
                          <path d="M12 1l3.09 2.26L18.5 2.5l.74 3.41L22 8l-2.26 3.09L20.5 14.5l-3.41.74L16 18l-3.09-2.26L9.5 16.5 8.76 13.09 6 11l2.26-3.09L7.5 4.5l3.41-.74z"/>
                        </svg>
                      </span>
                    )}
                    {user.role === 'owner' && <span className="badge" style={{background:'#c9a84c',color:'#3d2e0a',borderColor:'#a08735'}}>Owner</span>}
                    {user.role === 'admin' && <span className="badge" style={{background:'#1a6e3a',color:'#d4ffdf',borderColor:'#1a6e3a'}}>Admin</span>}
                    {user.role === 'tester' && <span className="badge">Tester</span>}
                    {user.role === 'developer' && <span className="badge">Developer</span>}
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
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button className="btn btn-sm" onClick={() => setEditMode(true)}>프로필 편집</button>
                    <Link href="/settings" className="btn btn-sm">설정</Link>
                    {!profile?.verified && (
                      verifyReq?.status === 'pending' ? (
                        <span className="btn btn-sm" style={{cursor:'default',color:'var(--muted)',borderStyle:'dashed'}}>인증 신청 검토 중</span>
                      ) : verifyReq?.status === 'rejected' ? (
                        <button className="btn btn-sm" onClick={()=>setVerifyOpen(true)}>인증 재신청</button>
                      ) : (
                        <button className="btn btn-sm" onClick={()=>setVerifyOpen(true)}>인증 신청</button>
                      )
                    )}
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
            <div className="info-row"><span>권한</span><span>{
              user.role === 'owner' ? '👑 Owner'
              : user.role === 'admin' ? '🛡 Admin'
              : user.role === 'tester' ? '🧪 Tester'
              : user.role === 'developer' ? '⚙ Developer'
              : '일반 회원'
            }</span></div>
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
                      <div style={{ fontFamily: 'var(--serif)', fontWeight: 700, color: 'var(--ink)', display:'flex', alignItems:'center', gap:'.35rem' }}>
                        {fp.name || fp.id}
                        {fp.verified && <span title="인증된 사용자" style={{display:'inline-flex',alignItems:'center'}}>
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="#2980b9"><path d="M12 1l3.09 2.26L18.5 2.5l.74 3.41L22 8l-2.26 3.09L20.5 14.5l-3.41.74L16 18l-3.09-2.26L9.5 16.5 8.76 13.09 6 11l2.26-3.09L7.5 4.5l3.41-.74z"/><path fill="#fff" d="M9.5 12.5l1.5 1.5 3.5-3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
                        </span>}
                      </div>
                      {fp.bio && <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.15rem' }}>{fp.bio}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <Link href={`/profile/${fp.id}`} className="btn btn-sm">프로필</Link>
                      <button className="btn btn-danger btn-sm" onClick={() => handleRemoveFollower(fp.id)}>끊기</button>
                    </div>
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
                      <div style={{ fontFamily: 'var(--serif)', fontWeight: 700, color: 'var(--ink)', display:'flex', alignItems:'center', gap:'.35rem' }}>
                        {fp.name || fp.id}
                        {fp.verified && <span title="인증된 사용자" style={{display:'inline-flex',alignItems:'center'}}>
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="#2980b9"><path d="M12 1l3.09 2.26L18.5 2.5l.74 3.41L22 8l-2.26 3.09L20.5 14.5l-3.41.74L16 18l-3.09-2.26L9.5 16.5 8.76 13.09 6 11l2.26-3.09L7.5 4.5l3.41-.74z"/></svg>
                        </span>}
                      </div>
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

        {/* ── TAB 4: 프로필 음악 ── */}
        {tab === 4 && (
          <ProfileMusicTab user={user} profile={profile} setProfile={setProfile} />
        )}

        {/* 인증 신청 모달 */}
        {verifyOpen && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:8000,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}
            onClick={()=>!verifySubmitting && setVerifyOpen(false)}>
            <div className="card card-accent" style={{maxWidth:480,width:'100%'}} onClick={e=>e.stopPropagation()}>
              <h3 style={{fontFamily:'var(--serif)',fontSize:'1.1rem',marginBottom:'.75rem',color:'var(--ink)',display:'flex',alignItems:'center',gap:'.5rem'}}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="#2980b9"><path d="M12 1l3.09 2.26L18.5 2.5l.74 3.41L22 8l-2.26 3.09L20.5 14.5l-3.41.74L16 18l-3.09-2.26L9.5 16.5 8.76 13.09 6 11l2.26-3.09L7.5 4.5l3.41-.74z"/></svg>
                인증 사용자 신청
              </h3>
              <p style={{fontSize:'.82rem',color:'var(--muted)',marginBottom:'1rem',lineHeight:1.65}}>
                관리자가 검토 후 승인 여부를 결정합니다. 본인의 활동/공적/SNS 등을 알려주세요.
              </p>
              {verifyMsg && <div className="alert alert-error" style={{marginBottom:'.75rem'}}>{verifyMsg}</div>}
              {verifyReq?.status === 'rejected' && verifyReq?.reviewerNote && (
                <div className="alert alert-error" style={{marginBottom:'.75rem'}}>
                  <strong>이전 거절 사유:</strong> {verifyReq.reviewerNote}
                </div>
              )}
              <div className="form-group">
                <label>신청 사유 (필수, 500자 이하)</label>
                <textarea rows={4} maxLength={500} value={verifyForm.reason}
                  onChange={e=>setVerifyForm({...verifyForm, reason: e.target.value})}
                  placeholder="왜 인증이 필요한지, 어떤 활동을 하고 있는지 알려주세요"/>
              </div>
              <div className="form-group">
                <label>참고 링크 (선택, SNS·블로그·포트폴리오)</label>
                <textarea rows={2} maxLength={500} value={verifyForm.links}
                  onChange={e=>setVerifyForm({...verifyForm, links: e.target.value})}
                  placeholder="https://..."/>
              </div>
              <div style={{display:'flex',gap:'.5rem',justifyContent:'flex-end'}}>
                <button className="btn btn-sm" onClick={()=>!verifySubmitting && setVerifyOpen(false)} disabled={verifySubmitting}>취소</button>
                <button className="btn btn-primary btn-sm" onClick={submitVerify} disabled={verifySubmitting || !verifyForm.reason.trim()}>
                  {verifySubmitting?'제출 중...':'신청하기'}
                </button>
              </div>
            </div>
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
