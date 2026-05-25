'use client'
import { useState, useEffect, useRef } from 'react'
import { compressImageToTarget } from '@/lib/imageCompress'

// 스토리 작성/편집 모달 — 메인 페이지와 /stories 페이지 양쪽에서 재사용.
// props:
//   - user: 로그인 사용자
//   - editing: null | { id, content, caption, bgColor, font, music? } (편집 모드)
//   - onClose: () => void
//   - onPosted: () => void (성공 시 호출 — 부모가 리프레시)

const resizeToBase64 = (file) => compressImageToTarget(file, 500)

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
  { label: '기본',   value: 'sans' },
  { label: '세리프', value: 'serif' },
  { label: '모노',   value: 'mono' },
]
const fontClass = { sans: 'var(--font)', serif: 'var(--serif)', mono: 'var(--mono)' }

async function fetchScTrack(url) {
  try {
    const res = await fetch(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`)
    if (!res.ok) return null
    const d = await res.json()
    return { title: d.title || '', author: d.author_name || '', thumbnail: d.thumbnail_url || '', html: d.html || '', url }
  } catch { return null }
}

export default function StoryComposer({ user, editing = null, onClose, onPosted }) {
  const isEdit = !!editing
  const [content,  setContent]  = useState(editing?.content || '')
  const [caption,  setCaption]  = useState(editing?.caption || '')
  const [bgColor,  setBgColor]  = useState(editing?.bgColor || BG_COLORS[0].value)
  const [font,     setFont]     = useState(editing?.font || 'sans')
  const [storyImage, setStoryImage] = useState(null)
  const [storyImagePreview, setStoryImagePreview] = useState(null)
  const [posting,  setPosting]  = useState(false)

  // 음악 권한
  const [musicAllowed, setMusicAllowed] = useState(false)
  const [scUrl,    setScUrl]    = useState('')
  const [scTrack,  setScTrack]  = useState(null)
  const [scLoading,setScLoading]= useState(false)
  const [scErr,    setScErr]    = useState('')

  const imgFileRef = useRef(null)

  // 음악 권한 fetch (편집 모드는 굳이 안 함 — 기존 음악 유지)
  useEffect(() => {
    if (!user || isEdit) return
    if (['owner','admin'].includes(user.role)) { setMusicAllowed(true); return }
    fetch(`/api/user/${user.id}`).then(r => r.json()).then(d => {
      if (d?.musicAllowed) setMusicAllowed(true)
    }).catch(() => {})
  }, [user, isEdit])

  const handleScSearch = async () => {
    if (!scUrl.includes('soundcloud.com')) { setScErr('SoundCloud URL을 입력해주세요'); return }
    setScLoading(true); setScErr(''); setScTrack(null)
    const t = await fetchScTrack(scUrl.trim())
    if (!t) { setScErr('트랙을 찾을 수 없습니다'); setScLoading(false); return }
    setScTrack(t); setScLoading(false)
  }

  const post = async () => {
    if (!user) return
    if (!content.trim() && !storyImage) { alert('내용 또는 사진을 입력해주세요'); return }
    setPosting(true)
    try {
      let imageUrl = null
      if (storyImage) imageUrl = await resizeToBase64(storyImage)
      const res = await fetch('/api/stories', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorId: user.id, authorName: user.name, authorAvatar: user.avatar || null,
          content, caption, bgColor, font, imageUrl, music: scTrack || null,
        }),
      })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      onPosted?.()
      onClose?.()
    } catch (e) {
      alert('스토리 업로드 실패')
    } finally {
      setPosting(false)
    }
  }

  const saveEdit = async () => {
    if (!user || !editing) return
    setPosting(true)
    try {
      const res = await fetch(`/api/stories/${editing.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, content, caption, bgColor, font }),
      })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      onPosted?.()
      onClose?.()
    } catch {
      alert('편집 저장 실패')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="sc-overlay" onClick={() => !posting && onClose?.()}>
      <div className="sc-modal" onClick={e => e.stopPropagation()}>
        <div className="sc-head">
          <h3>{isEdit ? '스토리 편집' : '새 스토리'}</h3>
          <button className="sc-close" onClick={onClose} aria-label="닫기">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* 미리보기 */}
        <div className="sc-preview" style={{ background: bgColor, position:'relative', overflow:'hidden' }}>
          {storyImagePreview && (
            <img src={storyImagePreview} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:.85 }} />
          )}
          {storyImagePreview && caption && (
            <div className="sc-cap-preview" style={{ fontFamily: fontClass[font] }}>{caption}</div>
          )}
          <p style={{
            position:'relative', zIndex:1,
            fontFamily: fontClass[font], color: '#fff', fontSize: '1.1rem',
            lineHeight: 1.7, whiteSpace: 'pre-wrap', textAlign: 'center',
            wordBreak: 'break-word', opacity: content ? 1 : 0.35,
            textShadow: storyImagePreview ? '0 1px 3px rgba(0,0,0,.6)' : 'none',
            margin: 0,
          }}>
            {content || (storyImagePreview ? '' : '내용을 입력하세요...')}
          </p>
        </div>

        <div className="sc-body">
          {/* 본문 */}
          <textarea
            className="sc-textarea"
            placeholder="스토리 내용을 입력하세요 (최대 200자)"
            value={content}
            onChange={e => setContent(e.target.value)}
            maxLength={200}
            rows={3}
          />
          <div className="sc-counter">{content.length}/200</div>

          {/* 배경 */}
          <div className="sc-row">
            <span className="sc-label">배경</span>
            <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap' }}>
              {BG_COLORS.map(c => (
                <button key={c.value} type="button" onClick={() => setBgColor(c.value)}
                  style={{ width:28, height:28, borderRadius:'50%', background:c.value, border: bgColor===c.value ? '2px solid var(--accent)' : '2px solid transparent', cursor:'pointer' }} />
              ))}
            </div>
          </div>

          {/* 자막 */}
          <div className="sc-row" style={{ alignItems:'flex-start' }}>
            <span className="sc-label">자막</span>
            <div style={{ flex:1 }}>
              <input
                placeholder="이미지 위에 표시할 짧은 자막 (선택)"
                value={caption}
                onChange={e => setCaption(e.target.value)}
                maxLength={80}
                style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:2, padding:'.45rem .65rem', color:'var(--text)', fontFamily:'var(--font)', fontSize:'.82rem', outline:'none' }}
              />
              <div className="sc-counter">{caption.length}/80</div>
            </div>
          </div>

          {/* 폰트 */}
          <div className="sc-row">
            <span className="sc-label">폰트</span>
            <div style={{ display:'flex', gap:'.5rem' }}>
              {FONTS.map(f => (
                <button key={f.value} type="button" onClick={() => setFont(f.value)}
                  style={{ fontFamily: fontClass[f.value], padding:'.25rem .65rem', border: font===f.value ? '1px solid var(--accent)' : '1px solid var(--border)', borderRadius:2, background: font===f.value ? 'rgba(192,57,43,0.08)' : 'none', cursor:'pointer', fontSize:'.82rem', color:'var(--text)' }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* 사진 첨부 — 편집 모드에선 숨김 */}
          {!isEdit && (
            <div className="sc-row" style={{ alignItems:'center' }}>
              <span className="sc-label">사진</span>
              <div style={{ flex:1 }}>
                {storyImagePreview ? (
                  <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
                    <img src={storyImagePreview} alt="" style={{ height:50, borderRadius:4, objectFit:'cover' }} />
                    <button type="button" onClick={() => { setStoryImage(null); setStoryImagePreview(null) }}
                      style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontFamily:'var(--mono)', fontSize:'.72rem' }}>제거</button>
                  </div>
                ) : (
                  <button type="button" className="btn btn-sm" onClick={() => imgFileRef.current?.click()}>사진 선택</button>
                )}
                <input ref={imgFileRef} type="file" accept="image/*" style={{ display:'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    if (f.size > 5*1024*1024) { alert('5MB 이하만 가능합니다'); return }
                    setStoryImage(f); setStoryImagePreview(URL.createObjectURL(f))
                  }} />
              </div>
            </div>
          )}

          {/* 음악 — 권한 있는 사용자만, 편집모드 제외 */}
          {!isEdit && musicAllowed && (
            <div className="sc-row" style={{ alignItems:'flex-start' }}>
              <span className="sc-label">음악</span>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'.35rem' }}>
                <div style={{ display:'flex', gap:'.4rem' }}>
                  <input placeholder="SoundCloud URL" value={scUrl}
                    onChange={e => { setScUrl(e.target.value); setScErr('') }}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleScSearch())}
                    style={{ flex:1, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:2, padding:'.35rem .6rem', fontSize:'.78rem', fontFamily:'var(--font)', color:'var(--text)', outline:'none' }} />
                  <button type="button" className="btn btn-sm" onClick={handleScSearch} disabled={scLoading || !scUrl.trim()}>
                    {scLoading ? '...' : '검색'}
                  </button>
                </div>
                {scErr && <p style={{ fontFamily:'var(--mono)', fontSize:'.68rem', color:'var(--accent)' }}>{scErr}</p>}
                {scTrack && (
                  <div style={{ display:'flex', alignItems:'center', gap:'.5rem', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:4, padding:'.4rem .6rem' }}>
                    {scTrack.thumbnail && <img src={scTrack.thumbnail} alt="" style={{ width:32, height:32, objectFit:'cover', borderRadius:3, flexShrink:0 }} />}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:'var(--serif)', fontSize:'.75rem', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{scTrack.title}</div>
                      <div style={{ fontFamily:'var(--mono)', fontSize:'.65rem', color:'var(--muted)' }}>{scTrack.author}</div>
                    </div>
                    <button type="button" onClick={() => { setScTrack(null); setScUrl('') }}
                      style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'.85rem' }}>×</button>
                  </div>
                )}
              </div>
            </div>
          )}
          {!isEdit && !musicAllowed && (
            <div style={{ background:'var(--surface2)', border:'1px dashed var(--border)', borderRadius:6, padding:'.55rem .75rem', fontFamily:'var(--mono)', fontSize:'.7rem', color:'var(--muted)', lineHeight:1.6 }}>
              음악 첨부는 관리자가 승인한 사용자만 사용할 수 있어요. 운영자에게 메시지로 신청해주세요.
            </div>
          )}

          {/* 액션 */}
          <button
            className="btn btn-primary"
            style={{ width:'100%', justifyContent:'center', marginTop:'.5rem' }}
            onClick={isEdit ? saveEdit : post}
            disabled={posting || (!isEdit && !content.trim() && !storyImage)}
          >
            {posting ? (isEdit ? '저장 중...' : '올리는 중...') : (isEdit ? '편집 저장' : '스토리 올리기')}
          </button>
        </div>

        <style jsx>{`
          .sc-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:8500;display:flex;align-items:center;justify-content:center;padding:1rem;}
          .sc-modal{background:var(--surface);border-radius:12px;width:min(440px,94vw);max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.4);animation:sc-pop .2s ease;}
          @keyframes sc-pop{from{transform:scale(.94);opacity:0}to{transform:none;opacity:1}}
          .sc-head{display:flex;justify-content:space-between;align-items:center;padding:1rem 1.25rem;border-bottom:1px solid var(--border);}
          .sc-head h3{font-family:var(--serif);font-size:1.05rem;color:var(--ink);margin:0;}
          .sc-close{background:none;border:none;color:var(--muted);cursor:pointer;padding:.25rem;border-radius:6px;display:flex;}
          .sc-close:hover{color:var(--text);background:var(--surface2);}
          .sc-preview{min-height:170px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.5rem 1.2rem;}
          .sc-cap-preview{position:relative;z-index:1;font-size:1rem;font-weight:600;color:#fff;text-align:center;background:rgba(0,0,0,.45);backdrop-filter:blur(4px);padding:.4rem .75rem;border-radius:8px;margin-bottom:.5rem;max-width:85%;word-break:break-word;text-shadow:0 1px 3px rgba(0,0,0,.6);}
          .sc-body{padding:1rem 1.25rem;display:flex;flex-direction:column;gap:.85rem;}
          .sc-textarea{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:2px;padding:.55rem .75rem;color:var(--text);font-family:var(--font);font-size:.88rem;resize:none;outline:none;line-height:1.6;}
          .sc-textarea:focus{border-color:var(--accent);}
          .sc-counter{display:flex;justify-content:flex-end;font-family:var(--mono);font-size:.62rem;color:var(--muted);margin-top:2px;}
          .sc-row{display:flex;align-items:flex-start;gap:1rem;}
          .sc-label{font-family:var(--mono);font-size:.72rem;color:var(--muted);min-width:32px;padding-top:6px;}
        `}</style>
      </div>
    </div>
  )
}
