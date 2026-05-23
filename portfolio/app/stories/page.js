'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { compressImageToTarget } from '@/lib/imageCompress'

const resizeToBase64 = (file) => compressImageToTarget(file, 500)

// 음악 첨부 기능 제거됨 (SoundCloud 검색 + music 필드).

const BG_COLORS = [
  { label: '잉크',    value: '#1a1208' },
  { label: '딥레드',  value: '#7b1a12' },
  { label: '네이비',  value: '#0d1b2a' },
  { label: '포레스트',value: '#0d2416' },
  { label: '퍼플',   value: '#1e0d2e' },
  { label: '로즈',   value: '#2e0d1a' },
  { label: '모카',   value: '#2a1c0e' },
  { label: '슬레이트',value: '#141e2a' },
]
const FONTS = [
  { label: '기본', value: 'sans' },
  { label: '세리프', value: 'serif' },
  { label: '모노', value: 'mono' },
]

// SSR 안전한 URL 쿼리 초기 검사 — mount 즉시 결정해야 ?create=1 이 모달을 열도록 보장한다.
function initialCreateFlag() {
  if (typeof window === 'undefined') return false
  try { return new URLSearchParams(window.location.search).get('create') === '1' } catch { return false }
}
function initialViewId() {
  if (typeof window === 'undefined') return null
  try { return new URLSearchParams(window.location.search).get('view') } catch { return null }
}

export default function StoriesPage() {
  const [user,        setUser]        = useState(null)
  const [stories,     setStories]     = useState([])
  const [loading,     setLoading]     = useState(true)
  // ?create=1 으로 들어오면 mount 시점에 즉시 모달 오픈 결정 (이전엔 user race 로 안 열리던 문제)
  const [showCreate,  setShowCreate]  = useState(initialCreateFlag)
  const [pendingViewId, setPendingViewId] = useState(initialViewId)
  const [viewing,     setViewing]     = useState(null)  // { story, idx }
  const [viewIdx,     setViewIdx]     = useState(0)
  const [progKey,     setProgKey]     = useState(0)

  // create form (caption = 이미지 위 오버레이 자막, content = 본문)
  const [content,  setContent]  = useState('')
  const [caption,  setCaption]  = useState('')
  const [bgColor,  setBgColor]  = useState(BG_COLORS[0].value)
  const [font,     setFont]     = useState('sans')
  const [posting,  setPosting]  = useState(false)
  // 편집 모드 — story 객체가 들어있으면 편집 모드
  const [editing,  setEditing]  = useState(null)
  // 사진 첨부
  const [storyImage, setStoryImage] = useState(null)
  const [storyImagePreview, setStoryImagePreview] = useState(null)
  const timerRef    = useRef(null)
  const imgFileRef  = useRef(null)

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (u) setUser(JSON.parse(u))
    loadStories()
    // mount 시 URL 정리 — showCreate / pendingViewId 는 이미 useState 초기값으로 읽었음
    if (typeof window !== 'undefined' && window.location.search) {
      try { window.history.replaceState({}, '', '/stories') } catch {}
    }
  }, [])

  const loadStories = async () => {
    setLoading(true)
    const res  = await fetch('/api/stories')
    const data = await res.json()
    setStories(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  // ?view=<authorId> 로 들어왔으면 stories 가 로드된 후 자동 뷰어 오픈
  useEffect(() => {
    if (loading || !pendingViewId || viewing) return
    const group = grouped.find(g => g.authorId === pendingViewId)
    if (group) {
      openViewer(group, 0)
      setPendingViewId(null)
    } else if (stories.length > 0) {
      // 해당 사용자 스토리 없음 — 그냥 무시
      setPendingViewId(null)
    }
  }, [loading, stories, pendingViewId])

  // 비로그인 사용자가 ?create=1 로 들어오면 로그인 페이지로
  useEffect(() => {
    if (showCreate && !user && typeof window !== 'undefined') {
      const stored = localStorage.getItem('user')
      if (!stored) {
        setShowCreate(false)
        window.location.href = '/login'
      }
    }
  }, [showCreate, user])

  // ── group stories by author ────────────────────────────────
  const grouped = []
  const seen    = {}
  stories.forEach(s => {
    if (!seen[s.authorId]) {
      seen[s.authorId] = true
      grouped.push({ authorId: s.authorId, authorName: s.authorName, authorAvatar: s.authorAvatar, stories: [] })
    }
    grouped.find(g => g.authorId === s.authorId).stories.push(s)
  })

  // ── open story viewer ──────────────────────────────────────
  const openViewer = (group, idx = 0) => {
    setViewing(group)
    setViewIdx(idx)
    setProgKey(k => k + 1)
    startAutoAdvance(group, idx)
    // mark viewed
    if (user) {
      fetch(`/api/stories/${group.stories[idx].id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      }).catch(() => {})
    }
  }

  const startAutoAdvance = (group, idx) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (idx + 1 < group.stories.length) {
        setViewIdx(idx + 1)
        setProgKey(k => k + 1)
        startAutoAdvance(group, idx + 1)
      } else {
        setViewing(null)
      }
    }, 5000)
  }

  const closeViewer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setViewing(null)
  }

  const prevStory = () => {
    if (!viewing) return
    const ni = viewIdx - 1
    if (ni >= 0) { setViewIdx(ni); setProgKey(k => k + 1); startAutoAdvance(viewing, ni) }
  }

  const nextStory = () => {
    if (!viewing) return
    const ni = viewIdx + 1
    if (ni < viewing.stories.length) { setViewIdx(ni); setProgKey(k => k + 1); startAutoAdvance(viewing, ni) }
    else closeViewer()
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  // ── delete story ──────────────────────────────────────────
  const deleteStory = async (storyId) => {
    if (!user || !confirm('스토리를 삭제하시겠습니까?')) return
    await fetch(`/api/stories/${storyId}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, role: user.role }),
    })
    closeViewer()
    loadStories()
  }

  // ── post story ────────────────────────────────────────────
  const postStory = async () => {
    if (!user) return
    if (!content.trim() && !storyImage) { alert('내용 또는 사진을 입력해주세요'); return }
    setPosting(true)
    let imageUrl = null
    if (storyImage) imageUrl = await resizeToBase64(storyImage)
    const res = await fetch('/api/stories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authorId: user.id, authorName: user.name, authorAvatar: user.avatar || null,
        content, caption, bgColor, font, imageUrl,
      }),
    })
    const data = await res.json()
    if (data.error) { alert(data.error); setPosting(false); return }
    setContent(''); setCaption(''); setBgColor(BG_COLORS[0].value); setFont('sans')
    setStoryImage(null); setStoryImagePreview(null)
    setShowCreate(false); setPosting(false)
    loadStories()
  }

  // 편집 모드 열기
  const openEdit = (story) => {
    setEditing(story)
    setContent(story.content || '')
    setCaption(story.caption || '')
    setBgColor(story.bgColor || BG_COLORS[0].value)
    setFont(story.font || 'sans')
    closeViewer()
  }

  const saveEdit = async () => {
    if (!user || !editing) return
    setPosting(true)
    const res = await fetch(`/api/stories/${editing.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, content, caption, bgColor, font }),
    })
    const data = await res.json()
    if (data.error) { alert(data.error); setPosting(false); return }
    setEditing(null); setContent(''); setCaption(''); setPosting(false)
    loadStories()
  }

  const cancelEdit = () => {
    setEditing(null); setContent(''); setCaption('')
    setBgColor(BG_COLORS[0].value); setFont('sans')
  }

  const fontClass = { sans: 'var(--font)', serif: 'var(--serif)', mono: 'var(--mono)' }
  const currentStory = viewing ? viewing.stories[viewIdx] : null

  return (
    <main>
      <div className="container">
        <div className="section-header">
          <h2>스토리</h2>
          <p>24시간 동안 공개되는 메모 스토리</p>
        </div>

        {/* ── story bar ── */}
        <div className="story-bar">
          {/* 내 스토리 추가 버튼 */}
          {user && (
            <div className="story-bubble-wrap" onClick={() => setShowCreate(true)}>
              <div className="story-bubble add-bubble">
                <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>+</span>
              </div>
              <span className="story-name">내 스토리</span>
            </div>
          )}

          {loading ? (
            <div style={{ fontFamily: 'var(--mono)', fontSize: '0.78rem', color: 'var(--muted)', padding: '1rem' }}>불러오는 중...</div>
          ) : grouped.length === 0 ? (
            <div style={{ fontFamily: 'var(--mono)', fontSize: '0.78rem', color: 'var(--muted)', padding: '1rem' }}>
              아직 스토리가 없어요. 첫 스토리를 올려보세요!
            </div>
          ) : (
            grouped.map(g => {
              const hasMyStory = user && g.stories.some(s => s.authorId === user.id)
              return (
                <div key={g.authorId} className="story-bubble-wrap" onClick={() => openViewer(g)}>
                  <div className={`story-bubble ${hasMyStory ? 'mine' : ''}`}
                    style={{ background: g.stories[0].bgColor }}>
                    {g.authorAvatar
                      ? <img src={g.authorAvatar} alt={g.authorName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : <span style={{ color: '#fff', fontFamily: 'var(--serif)', fontSize: '1.3rem', fontWeight: 700 }}>
                          {(g.authorName || '?')[0].toUpperCase()}
                        </span>
                    }
                  </div>
                  <span className="story-name">{g.authorName}</span>
                </div>
              )
            })
          )}
        </div>

        {/* ── all stories grid ── */}
        <div className="section-header" style={{ marginTop: '2rem' }}>
          <h2>전체 스토리</h2>
          <p>{stories.length}개 · 24시간 후 자동 삭제</p>
        </div>

        {stories.length === 0 && !loading ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: '0.82rem' }}>
            아직 스토리가 없어요
          </div>
        ) : (
          <div className="stories-grid">
            {stories.map((s, i) => {
              const elapsed = Date.now() - new Date(s.createdAt).getTime()
              const remain  = Math.max(0, 24 * 3600 - elapsed / 1000)
              const h = Math.floor(remain / 3600), m = Math.floor((remain % 3600) / 60)
              const authorGroup = grouped.find(g => g.authorId === s.authorId)
              const storyIdx    = authorGroup ? authorGroup.stories.findIndex(x => x.id === s.id) : 0
              return (
                <div key={s.id} className="story-card" style={{ background: s.bgColor }}
                  onClick={() => authorGroup && openViewer(authorGroup, storyIdx)}>
                  {s.imageUrl && (
                    <img src={s.imageUrl} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:.55 }} />
                  )}
                  <p className="story-card-text" style={{ fontFamily: fontClass[s.font] || 'var(--font)', position:'relative', zIndex:1 }}>
                    {s.caption || s.content}
                  </p>
                  <div className="story-card-meta" style={{ position:'relative', zIndex:1 }}>
                    <Link href={`/profile/${s.authorId}`} onClick={e => e.stopPropagation()}
                      style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.7rem', fontFamily: 'var(--mono)', textShadow:'0 1px 2px rgba(0,0,0,.5)' }}>
                      {s.authorName}
                    </Link>
                    <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.65rem', fontFamily: 'var(--mono)', textShadow:'0 1px 2px rgba(0,0,0,.5)' }}>
                      {h}h {m}m 남음
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ══ STORY VIEWER MODAL ══ */}
      {viewing && currentStory && (
        <div className="sv-overlay" onClick={closeViewer}>
          <div className="sv-card" style={{ background: currentStory.bgColor }} onClick={e => e.stopPropagation()}>
            {/* progress bars */}
            <div className="sv-progress">
              {viewing.stories.map((_, i) => (
                <div key={i} className="sv-prog-bg">
                  <div className={`sv-prog-fill ${i === viewIdx ? 'active' : i < viewIdx ? 'done' : ''}`}
                    key={i === viewIdx ? progKey : i} />
                </div>
              ))}
            </div>

            {/* header */}
            <div className="sv-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div className="sv-avatar">
                  {currentStory.authorAvatar
                    ? <img src={currentStory.authorAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    : <span>{(currentStory.authorName || '?')[0].toUpperCase()}</span>
                  }
                </div>
                <div>
                  <div style={{ color: '#fff', fontFamily: 'var(--mono)', fontSize: '0.8rem', fontWeight: 500 }}>
                    {currentStory.authorName}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--mono)', fontSize: '0.62rem' }}>
                    {new Date(currentStory.createdAt).toLocaleString('ko-KR')}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span className="sv-views" title={`${currentStory.views || 0}회 조회`}>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                  {currentStory.views || 0}
                </span>
                {user && user.id === currentStory.authorId && (
                  <button className="sv-icon-btn" onClick={() => openEdit(currentStory)} title="편집" aria-label="편집">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                )}
                {user && (user.id === currentStory.authorId || ['owner','admin'].includes(user.role)) && (
                  <button className="sv-icon-btn" onClick={() => deleteStory(currentStory.id)} title="삭제" aria-label="삭제">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                )}
                <button className="sv-close" onClick={closeViewer}>✕</button>
              </div>
            </div>

            {/* content */}
            <div className="sv-body" style={{ position:'relative', zIndex:1 }}>
              {currentStory.imageUrl && (
                currentStory.content ? (
                  <img src={currentStory.imageUrl} alt="" style={{ maxWidth:'100%', maxHeight:'50%', borderRadius:8, objectFit:'contain', marginBottom:'0.75rem' }} />
                ) : (
                  // 사진만 있을 때 전체화면 꽉 채움
                  <img src={currentStory.imageUrl} alt=""
                    style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', zIndex:0, borderRadius:16 }} />
                )
              )}
              {/* 이미지 위 자막 — caption 이 있을 때만 표시 */}
              {currentStory.imageUrl && currentStory.caption && (
                <div className="sv-caption" style={{ fontFamily: fontClass[currentStory.font] || 'var(--font)' }}>
                  {currentStory.caption}
                </div>
              )}
              {currentStory.content ? (
                <p className="sv-text" style={{ fontFamily: fontClass[currentStory.font] || 'var(--font)' }}>
                  {currentStory.content}
                </p>
              ) : null}
            </div>

            {/* tap zones */}
            <div className="sv-tap-left"  onClick={prevStory} />
            <div className="sv-tap-right" onClick={nextStory} />

            {/* nav dots */}
            <div className="sv-dots">
              {viewing.stories.length > 1 && viewing.stories.map((_, i) => (
                <span key={i} className={`sv-dot ${i === viewIdx ? 'active' : ''}`} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ CREATE / EDIT STORY MODAL ══ */}
      {(showCreate || editing) && (
        <div className="sv-overlay" onClick={() => editing ? cancelEdit() : setShowCreate(false)}>
          <div className="create-modal" onClick={e => e.stopPropagation()}>
            <div className="create-header">
              <h3>{editing ? '스토리 편집' : '새 스토리'}</h3>
              <button className="sv-close" onClick={() => editing ? cancelEdit() : setShowCreate(false)}>✕</button>
            </div>

            {/* preview */}
            <div className="create-preview" style={{ background: bgColor, position:'relative', overflow:'hidden' }}>
              {storyImagePreview && (
                <img src={storyImagePreview} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:.85 }} />
              )}
              {storyImagePreview && caption && (
                <div style={{
                  position:'relative', zIndex:1, fontFamily: fontClass[font], color:'#fff',
                  fontSize:'1.05rem', fontWeight:600, textAlign:'center',
                  background:'rgba(0,0,0,.45)', backdropFilter:'blur(4px)',
                  padding:'.45rem .85rem', borderRadius:8, marginBottom:'.75rem',
                  maxWidth:'85%', wordBreak:'break-word', textShadow:'0 1px 3px rgba(0,0,0,.6)',
                }}>
                  {caption}
                </div>
              )}
              <p style={{
                position:'relative', zIndex:1,
                fontFamily: fontClass[font], color: '#fff', fontSize: '1.1rem',
                lineHeight: 1.7, whiteSpace: 'pre-wrap', textAlign: 'center',
                wordBreak: 'break-word', opacity: content ? 1 : 0.35,
                textShadow: storyImagePreview ? '0 1px 3px rgba(0,0,0,.6)' : 'none',
              }}>
                {content || (storyImagePreview ? '' : '내용을 입력하세요...')}
              </p>
            </div>

            {/* controls */}
            <div className="create-controls">
              <textarea
                className="create-textarea"
                placeholder="스토리 내용을 입력하세요 (최대 200자)"
                value={content}
                onChange={e => setContent(e.target.value)}
                maxLength={200}
                rows={3}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', fontFamily: 'var(--mono)', fontSize: '0.65rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                {content.length}/200
              </div>

              <div className="create-row">
                <span className="create-label">배경</span>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {BG_COLORS.map(c => (
                    <button key={c.value} onClick={() => setBgColor(c.value)}
                      style={{ width: 28, height: 28, borderRadius: '50%', background: c.value, border: bgColor === c.value ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>

              {/* 자막 — 이미지에 얹는 짧은 텍스트 (80자) */}
              <div className="create-row" style={{ alignItems: 'flex-start' }}>
                <span className="create-label">자막</span>
                <div style={{ flex: 1 }}>
                  <input
                    placeholder="이미지 위에 표시할 짧은 자막 (선택)"
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    maxLength={80}
                    style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:2, padding:'.45rem .65rem', color:'var(--text)', fontFamily:'var(--font)', fontSize:'.82rem', outline:'none' }}
                  />
                  <div style={{ display:'flex', justifyContent:'flex-end', fontFamily:'var(--mono)', fontSize:'.62rem', color:'var(--muted)', marginTop:2 }}>
                    {caption.length}/80
                  </div>
                </div>
              </div>

              <div className="create-row">
                <span className="create-label">폰트</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {FONTS.map(f => (
                    <button key={f.value} onClick={() => setFont(f.value)}
                      style={{ fontFamily: fontClass[f.value], padding: '0.25rem 0.65rem', border: font === f.value ? '1px solid var(--accent)' : '1px solid var(--border)', borderRadius: 2, background: font === f.value ? 'rgba(192,57,43,0.08)' : 'none', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text)' }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 사진 첨부 — 편집 모드에서는 숨김 (재업로드 부담 회피) */}
              {!editing && (
              <div className="create-row" style={{ alignItems: 'center' }}>
                <span className="create-label">사진</span>
                <div style={{ flex: 1 }}>
                  {storyImagePreview
                    ? <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <img src={storyImagePreview} alt="" style={{ height: 50, borderRadius: 4, objectFit: 'cover' }} />
                        <button onClick={() => { setStoryImage(null); setStoryImagePreview(null) }}
                          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: '0.72rem' }}>제거</button>
                      </div>
                    : <button className="btn btn-sm" onClick={() => imgFileRef.current?.click()}>사진 선택</button>
                  }
                  <input ref={imgFileRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      if (f.size > 5*1024*1024) { alert('5MB 이하만 가능합니다'); return }
                      setStoryImage(f); setStoryImagePreview(URL.createObjectURL(f))
                    }} />
                </div>
              </div>
              )}

              {/* 음악 첨부 — 편집 모드에서는 숨김 */}
              {editing ? (
                <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', marginTop:'0.5rem' }}
                  onClick={saveEdit} disabled={posting}>
                  {posting ? '저장 중...' : '편집 저장'}
                </button>
              ) : (
                <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', marginTop:'0.5rem' }}
                  onClick={postStory} disabled={posting || (!content.trim() && !storyImage)}>
                  {posting ? '올리는 중...' : '스토리 올리기'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* ── Story bar ── */
        .story-bar{display:flex;gap:1.25rem;overflow-x:auto;padding:1rem 0;margin-bottom:0.5rem;scrollbar-width:none;}
        .story-bar::-webkit-scrollbar{display:none;}
        .story-bubble-wrap{display:flex;flex-direction:column;align-items:center;gap:0.35rem;cursor:pointer;flex-shrink:0;}
        .story-bubble{width:62px;height:62px;border-radius:50%;border:3px solid var(--border-dark);display:flex;align-items:center;justify-content:center;overflow:hidden;transition:transform .2s;position:relative;}
        .story-bubble:hover{transform:scale(1.08);}
        .story-bubble.mine{border-color:var(--accent);}
        .add-bubble{background:var(--ink);border:2px dashed var(--border-dark);color:rgba(245,240,232,0.6);}
        .story-name{font-family:var(--mono);font-size:0.62rem;color:var(--muted);max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}

        /* ── Stories grid ── */
        .stories-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:1rem;margin-bottom:2rem;}
        .story-card{border-radius:12px;padding:1.25rem;cursor:pointer;min-height:200px;display:flex;flex-direction:column;justify-content:space-between;transition:transform .2s,box-shadow .2s;position:relative;overflow:hidden;}
        .story-card:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,.25);}
        .story-card-text{color:#fff;font-size:0.85rem;line-height:1.65;flex:1;overflow:hidden;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;word-break:break-word;text-shadow:0 1px 3px rgba(0,0,0,.5);}
        .story-card-meta{display:flex;justify-content:space-between;align-items:center;margin-top:0.75rem;gap:0.5rem;}

        /* ── Viewer ── */
        .sv-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:8000;display:flex;align-items:center;justify-content:center;}
        .sv-card{position:relative;width:min(380px,92vw);height:min(640px,85vh);border-radius:16px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.6);}
        .sv-progress{display:flex;gap:3px;padding:0.75rem 0.75rem 0;position:relative;z-index:2;}
        .sv-prog-bg{flex:1;height:2.5px;background:rgba(255,255,255,.25);border-radius:2px;overflow:hidden;}
        .sv-prog-fill{height:100%;background:#fff;border-radius:2px;width:0;}
        .sv-prog-fill.done{width:100%;}
        .sv-prog-fill.active{animation:sv-prog 5s linear forwards;}
        @keyframes sv-prog{from{width:0}to{width:100%}}
        .sv-header{display:flex;justify-content:space-between;align-items:center;padding:0.6rem 0.9rem;position:relative;z-index:2;}
        .sv-avatar{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;overflow:hidden;color:#fff;font-family:var(--serif);font-weight:700;font-size:.9rem;flex-shrink:0;}
        .sv-close{background:none;border:none;color:rgba(255,255,255,.7);font-size:1.1rem;cursor:pointer;padding:0.2rem 0.4rem;border-radius:4px;}
        .sv-close:hover{color:#fff;background:rgba(255,255,255,.1);}
        .sv-views{display:inline-flex;align-items:center;gap:.25rem;color:rgba(255,255,255,.6);font-family:var(--mono);font-size:.65rem;}
        .sv-icon-btn{background:rgba(255,255,255,.08);border:none;color:rgba(255,255,255,.75);cursor:pointer;padding:.3rem;border-radius:5px;display:flex;align-items:center;justify-content:center;}
        .sv-icon-btn:hover{background:rgba(255,255,255,.18);color:#fff;}
        .sv-body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem 1.5rem;position:relative;z-index:2;}
        .sv-text{color:#fff;font-size:1.25rem;line-height:1.75;text-align:center;word-break:break-word;white-space:pre-wrap;text-shadow:0 1px 4px rgba(0,0,0,.5);}
        .sv-caption{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);max-width:85%;color:#fff;font-size:1.1rem;font-weight:600;text-align:center;padding:.5rem .9rem;background:rgba(0,0,0,.5);backdrop-filter:blur(6px);border-radius:8px;word-break:break-word;text-shadow:0 1px 3px rgba(0,0,0,.6);z-index:2;}
        .sv-tap-left{position:absolute;left:0;top:0;width:35%;height:100%;z-index:3;cursor:pointer;}
        .sv-tap-right{position:absolute;right:0;top:0;width:35%;height:100%;z-index:3;cursor:pointer;}
        .sv-dots{position:absolute;bottom:1.2rem;left:50%;transform:translateX(-50%);display:flex;gap:5px;z-index:4;}
        .sv-dot{width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,.35);}
        .sv-dot.active{background:#fff;width:14px;border-radius:3px;}

        /* ── Create modal ── */
        .create-modal{background:var(--surface);border-radius:12px;width:min(420px,92vw);max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.4);}
        .create-header{display:flex;justify-content:space-between;align-items:center;padding:1.2rem 1.5rem;border-bottom:1px solid var(--border);}
        .create-header h3{font-family:var(--serif);font-size:1.1rem;color:var(--ink);}
        .create-preview{min-height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem 1.5rem;}
        .create-controls{padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:1rem;}
        .create-textarea{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:2px;padding:.6rem .75rem;color:var(--text);font-family:var(--font);font-size:.875rem;resize:none;outline:none;line-height:1.6;}
        .create-textarea:focus{border-color:var(--accent);}
        .create-row{display:flex;align-items:flex-start;gap:1rem;}
        .create-label{font-family:var(--mono);font-size:.72rem;color:var(--muted);min-width:32px;padding-top:4px;}
      `}</style>
    </main>
  )
}
