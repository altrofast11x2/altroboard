'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

function resizeToBase64(file) {
  return new Promise((resolve) => {
    if (file.type === 'image/gif') {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target.result)
      reader.readAsDataURL(file)
      return
    }
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 900
      let w = img.width, h = img.height
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX }
        else { w = Math.round(w * MAX / h); h = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.src = url
  })
}

async function fetchScTrack(url) {
  try {
    const res = await fetch(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`)
    if (!res.ok) return null
    const d = await res.json()
    return { title: d.title || '', author: d.author_name || '', thumbnail: d.thumbnail_url || '', html: d.html || '', url }
  } catch { return null }
}

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
const EMOJIS = ['✨','🔥','💫','🌙','🌿','🎵','📖','💭','🫀','⚡','🌊','🍂']

export default function StoriesPage() {
  const [user,        setUser]        = useState(null)
  const [stories,     setStories]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showCreate,  setShowCreate]  = useState(false)
  const [viewing,     setViewing]     = useState(null)  // { story, idx }
  const [viewIdx,     setViewIdx]     = useState(0)
  const [progKey,     setProgKey]     = useState(0)

  // create form
  const [content,  setContent]  = useState('')
  const [bgColor,  setBgColor]  = useState(BG_COLORS[0].value)
  const [emoji,    setEmoji]    = useState('')
  const [font,     setFont]     = useState('sans')
  const [posting,  setPosting]  = useState(false)
  // 사진 첨부
  const [storyImage, setStoryImage] = useState(null)
  const [storyImagePreview, setStoryImagePreview] = useState(null)
  // 음악 첨부
  const [scUrl,    setScUrl]    = useState('')
  const [scTrack,  setScTrack]  = useState(null)
  const [scLoading,setScLoading]= useState(false)
  const [scErr,    setScErr]    = useState('')

  const timerRef    = useRef(null)
  const imgFileRef  = useRef(null)

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (u) setUser(JSON.parse(u))
    loadStories()
  }, [])

  const loadStories = async () => {
    setLoading(true)
    const res  = await fetch('/api/stories')
    const data = await res.json()
    setStories(Array.isArray(data) ? data : [])
    setLoading(false)
  }

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
  const handleScSearch = async () => {
    if (!scUrl.includes('soundcloud.com')) { setScErr('SoundCloud URL을 입력해주세요'); return }
    setScLoading(true); setScErr(''); setScTrack(null)
    const t = await fetchScTrack(scUrl.trim())
    if (!t) { setScErr('트랙을 찾을 수 없습니다'); setScLoading(false); return }
    setScTrack(t); setScLoading(false)
  }

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
        content, bgColor, emoji, font, imageUrl, music: scTrack || null,
      }),
    })
    const data = await res.json()
    if (data.error) { alert(data.error); setPosting(false); return }
    setContent(''); setBgColor(BG_COLORS[0].value); setEmoji(''); setFont('sans')
    setStoryImage(null); setStoryImagePreview(null)
    setScUrl(''); setScTrack(null); setScErr('')
    setShowCreate(false); setPosting(false)
    loadStories()
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
                  {s.emoji && <div className="story-card-emoji">{s.emoji}</div>}
                  <p className="story-card-text" style={{ fontFamily: fontClass[s.font] || 'var(--font)' }}>
                    {s.content}
                  </p>
                  <div className="story-card-meta">
                    <Link href={`/profile/${s.authorId}`} onClick={e => e.stopPropagation()}
                      style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem', fontFamily: 'var(--mono)' }}>
                      {s.authorName}
                    </Link>
                    <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.65rem', fontFamily: 'var(--mono)' }}>
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
                <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--mono)', fontSize: '0.65rem' }}>
                  👁 {currentStory.views || 0}
                </span>
                {user && (user.id === currentStory.authorId || user.role === 'admin') && (
                  <button className="sv-del-btn" onClick={() => deleteStory(currentStory.id)}>🗑</button>
                )}
                <button className="sv-close" onClick={closeViewer}>✕</button>
              </div>
            </div>

            {/* content */}
            <div className="sv-body" style={{ position:'relative', zIndex:1 }}>
              {currentStory.emoji && <div className="sv-emoji">{currentStory.emoji}</div>}
              {currentStory.imageUrl && (
                {currentStory.content ? (
                  <img src={currentStory.imageUrl} alt="" style={{ maxWidth:'100%', maxHeight:'50%', borderRadius:8, objectFit:'contain', marginBottom:'0.75rem' }} />
                ) : (
                  // 사진만 있을 때 전체화면 꽉 채움
                  <img src={currentStory.imageUrl} alt=""
                    style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', zIndex:0, borderRadius:16 }} />
                )}
              )}
              {currentStory.content ? (
                <p className="sv-text" style={{ fontFamily: fontClass[currentStory.font] || 'var(--font)' }}>
                  {currentStory.content}
                </p>
              ) : null}
              {currentStory.music && (
                <div style={{ marginTop: '0.75rem', background: 'rgba(0,0,0,0.4)', borderRadius: 6, padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', backdropFilter: 'blur(4px)', maxWidth: '100%' }}>
                  <span style={{ fontSize: '0.9rem' }}>🎵</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '0.7rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentStory.music.title}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '0.62rem', color: 'rgba(255,255,255,0.55)' }}>{currentStory.music.author}</div>
                  </div>
                </div>
              )}
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

      {/* ══ CREATE STORY MODAL ══ */}
      {showCreate && (
        <div className="sv-overlay" onClick={() => setShowCreate(false)}>
          <div className="create-modal" onClick={e => e.stopPropagation()}>
            <div className="create-header">
              <h3>새 스토리</h3>
              <button className="sv-close" onClick={() => setShowCreate(false)}>✕</button>
            </div>

            {/* preview */}
            <div className="create-preview" style={{ background: bgColor }}>
              {emoji && <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{emoji}</div>}
              <p style={{
                fontFamily: fontClass[font], color: '#fff', fontSize: '1.1rem',
                lineHeight: 1.7, whiteSpace: 'pre-wrap', textAlign: 'center',
                wordBreak: 'break-word', opacity: content ? 1 : 0.35,
              }}>
                {content || '내용을 입력하세요...'}
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

              <div className="create-row">
                <span className="create-label">이모지</span>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <button onClick={() => setEmoji('')} style={{ fontSize: '0.7rem', fontFamily: 'var(--mono)', padding: '0.2rem 0.5rem', border: !emoji ? '1px solid var(--accent)' : '1px solid var(--border)', borderRadius: 2, background: 'none', cursor: 'pointer' }}>없음</button>
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => setEmoji(e)}
                      style={{ fontSize: '1.2rem', background: emoji === e ? 'rgba(192,57,43,0.12)' : 'none', border: emoji === e ? '1px solid var(--accent)' : '1px solid transparent', borderRadius: 4, padding: '0.1rem 0.3rem', cursor: 'pointer' }}>
                      {e}
                    </button>
                  ))}
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

              {/* 사진 첨부 */}
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

              {/* 음악 첨부 */}
              <div className="create-row" style={{ alignItems: 'flex-start' }}>
                <span className="create-label">음악</span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <input placeholder="SoundCloud URL" value={scUrl}
                      onChange={e => { setScUrl(e.target.value); setScErr('') }}
                      onKeyDown={e => e.key === 'Enter' && handleScSearch()}
                      style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 2, padding: '0.35rem 0.6rem', fontSize: '0.78rem', fontFamily: 'var(--font)', color: 'var(--text)', outline: 'none' }} />
                    <button className="btn btn-sm" onClick={handleScSearch} disabled={scLoading || !scUrl.trim()}>
                      {scLoading ? '...' : '검색'}
                    </button>
                  </div>
                  {scErr && <p style={{ fontFamily: 'var(--mono)', fontSize: '0.68rem', color: 'var(--accent)' }}>⚠ {scErr}</p>}
                  {scTrack && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 4, padding: '0.4rem 0.6rem' }}>
                      {scTrack.thumbnail && <img src={scTrack.thumbnail} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--serif)', fontSize: '0.75rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scTrack.title}</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: '0.65rem', color: 'var(--muted)' }}>{scTrack.author}</div>
                      </div>
                      <button onClick={() => { setScTrack(null); setScUrl('') }}
                        style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
                    </div>
                  )}
                </div>
              </div>

              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
                onClick={postStory} disabled={posting || (!content.trim() && !storyImage)}>
                {posting ? '올리는 중...' : '스토리 올리기'}
              </button>
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
        .story-card-emoji{font-size:2rem;margin-bottom:0.5rem;}
        .story-card-text{color:#fff;font-size:0.85rem;line-height:1.65;flex:1;overflow:hidden;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;word-break:break-word;}
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
        .sv-del-btn{background:none;border:none;color:rgba(255,255,255,.5);font-size:0.9rem;cursor:pointer;padding:0.2rem;}
        .sv-del-btn:hover{color:#fff;}
        .sv-body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem 1.5rem;position:relative;z-index:2;}
        .sv-emoji{font-size:3.5rem;margin-bottom:1rem;}
        .sv-text{color:#fff;font-size:1.25rem;line-height:1.75;text-align:center;word-break:break-word;white-space:pre-wrap;}
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
