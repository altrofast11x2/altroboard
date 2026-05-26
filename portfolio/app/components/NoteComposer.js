'use client'
import { useState, useEffect, useRef } from 'react'

// 메모(Note) 작성 모달 — Instagram 노트 패턴.
// - 60자 텍스트
// - 음악 첨부 (musicAllowed=true 또는 owner/admin 만 사용 가능)
// - 24시간 자동 삭제 (서버 측 처리)

async function fetchScTrack(url) {
  try {
    const res = await fetch(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`)
    if (!res.ok) return null
    const d = await res.json()
    return { title: d.title || '', author: d.author_name || '', thumbnail: d.thumbnail_url || '', url }
  } catch { return null }
}

export default function NoteComposer({ user, onClose, onPosted }) {
  const [text, setText] = useState('')
  const [musicAllowed, setMusicAllowed] = useState(false)
  const [scUrl, setScUrl] = useState('')
  const [scTrack, setScTrack] = useState(null)
  const [scLoading, setScLoading] = useState(false)
  const [scErr, setScErr] = useState('')
  const [posting, setPosting] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // 음악 권한 fetch
  useEffect(() => {
    if (!user) return
    if (['owner','admin'].includes(user.role)) { setMusicAllowed(true); return }
    fetch(`/api/user/${user.id}`).then(r => r.json()).then(d => {
      if (d?.musicAllowed) setMusicAllowed(true)
    }).catch(() => {})
  }, [user])

  const handleScSearch = async () => {
    if (!scUrl.includes('soundcloud.com')) { setScErr('SoundCloud URL을 입력해주세요'); return }
    setScLoading(true); setScErr(''); setScTrack(null)
    const t = await fetchScTrack(scUrl.trim())
    if (!t) { setScErr('트랙을 찾을 수 없습니다'); setScLoading(false); return }
    setScTrack(t); setScLoading(false)
  }

  const post = async () => {
    if (!user) return
    if (!text.trim() && !scTrack) { alert('메모 또는 음악을 입력해주세요'); return }
    setPosting(true)
    try {
      const r = await fetch('/api/notes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          text:   text.trim(),
          music:  scTrack || null,
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { alert(d?.error || '메모 저장 실패'); setPosting(false); return }
      onPosted?.()
    } catch {
      alert('메모 저장 중 오류')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="nc-overlay" onClick={() => !posting && onClose?.()}>
      <div className="nc-modal" onClick={e => e.stopPropagation()}>
        <div className="nc-head">
          <h3>새 메모</h3>
          <button className="nc-x" onClick={onClose} aria-label="닫기">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* 미리보기 */}
        <div className="nc-preview">
          <div className="nc-bubble">
            {text ? <span className="nc-bubble-text">{text}</span> : <span className="nc-bubble-ph">메모를 입력하세요…</span>}
          </div>
          <div className="nc-av">
            {user?.avatar
              ? <img src={user.avatar} alt={user.name}/>
              : <span>{(user?.name || '?')[0]?.toUpperCase()}</span>
            }
          </div>
        </div>

        <div className="nc-body">
          <input
            ref={inputRef}
            className="nc-input"
            placeholder="무엇을 공유하고 싶나요?"
            value={text}
            onChange={e => setText(e.target.value)}
            maxLength={60}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), post())}
          />
          <div className="nc-counter">{text.length}/60</div>

          {/* 음악 첨부 (권한자만) */}
          {musicAllowed ? (
            <div className="nc-music">
              <label className="nc-label">노래 추가</label>
              <div style={{ display:'flex', gap:'.4rem', marginTop:'.3rem' }}>
                <input
                  placeholder="SoundCloud URL"
                  value={scUrl}
                  onChange={e => { setScUrl(e.target.value); setScErr('') }}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleScSearch())}
                  style={{ flex:1, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, padding:'.4rem .6rem', fontSize:'.78rem', fontFamily:'var(--font)', color:'var(--text)', outline:'none' }}
                />
                <button type="button" className="btn btn-sm" onClick={handleScSearch} disabled={scLoading || !scUrl.trim()}>
                  {scLoading ? '...' : '검색'}
                </button>
              </div>
              {scErr && <p className="nc-err">{scErr}</p>}
              {scTrack && (
                <div className="nc-track">
                  {scTrack.thumbnail && <img src={scTrack.thumbnail} alt=""/>}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div className="nc-track-title">{scTrack.title}</div>
                    <div className="nc-track-author">{scTrack.author}</div>
                  </div>
                  <button type="button" onClick={() => { setScTrack(null); setScUrl('') }} className="nc-track-x">×</button>
                </div>
              )}
            </div>
          ) : (
            <div className="nc-music-locked">
              🎵 노래 첨부는 관리자가 허가한 사용자만 사용할 수 있어요.<br/>
              운영자에게 메시지로 신청해주세요.
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ width:'100%', justifyContent:'center', marginTop:'.5rem' }}
            onClick={post}
            disabled={posting || (!text.trim() && !scTrack)}
          >
            {posting ? '공유 중...' : '공유'}
          </button>

          <p className="nc-foot">메모는 24시간 동안 표시되며, 맞팔로우 중인 사람만 볼 수 있어요.</p>
        </div>

        <style jsx>{`
          .nc-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:8800;display:flex;align-items:center;justify-content:center;padding:1rem;animation:nc-in .15s ease;}
          @keyframes nc-in{from{opacity:0}to{opacity:1}}
          .nc-modal{background:var(--surface);border-radius:14px;width:min(380px,94vw);box-shadow:0 24px 60px rgba(0,0,0,.45);animation:nc-pop .2s ease;}
          @keyframes nc-pop{from{transform:scale(.92);opacity:0}to{transform:none;opacity:1}}
          .nc-head{display:flex;justify-content:space-between;align-items:center;padding:.85rem 1.1rem;border-bottom:1px solid var(--border);}
          .nc-head h3{font-family:var(--serif);font-size:1.02rem;color:var(--ink);margin:0;}
          .nc-x{background:none;border:none;color:var(--muted);cursor:pointer;padding:.25rem;display:flex;}
          .nc-x:hover{color:var(--text);}

          .nc-preview{padding:1.5rem 1.5rem 1rem;display:flex;flex-direction:column;align-items:center;gap:0;background:var(--surface2);position:relative;}
          .nc-bubble{background:var(--accent);color:#fff;border-radius:16px 16px 16px 4px;padding:.55rem .9rem;font-family:var(--mono);font-size:.85rem;max-width:80%;text-align:center;min-height:32px;display:flex;align-items:center;justify-content:center;margin-bottom:-12px;box-shadow:0 3px 8px rgba(192,57,43,.3);}
          .nc-bubble-text{display:block;word-break:break-word;}
          .nc-bubble-ph{opacity:.6;}
          .nc-av{width:64px;height:64px;border-radius:50%;background:var(--accent);color:#fff;font-family:var(--serif);font-weight:700;font-size:1.4rem;display:flex;align-items:center;justify-content:center;overflow:hidden;border:3px solid var(--surface2);}
          .nc-av img{width:100%;height:100%;object-fit:cover;}

          .nc-body{padding:1rem 1.2rem 1.2rem;display:flex;flex-direction:column;gap:.5rem;}
          .nc-input{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:.55rem .75rem;color:var(--text);font-family:var(--font);font-size:.92rem;outline:none;}
          .nc-input:focus{border-color:var(--accent);}
          .nc-counter{display:flex;justify-content:flex-end;font-family:var(--mono);font-size:.62rem;color:var(--muted);}

          .nc-music{background:var(--surface2);border-radius:8px;padding:.6rem .75rem;margin-top:.25rem;}
          .nc-label{font-family:var(--mono);font-size:.7rem;color:var(--muted);font-weight:600;}
          .nc-err{font-family:var(--mono);font-size:.7rem;color:var(--accent);margin-top:.35rem;}
          .nc-track{display:flex;align-items:center;gap:.5rem;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.4rem .55rem;margin-top:.4rem;}
          .nc-track img{width:32px;height:32px;border-radius:4px;object-fit:cover;flex-shrink:0;}
          .nc-track-title{font-family:var(--serif);font-size:.75rem;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
          .nc-track-author{font-family:var(--mono);font-size:.65rem;color:var(--muted);}
          .nc-track-x{background:none;border:none;color:var(--muted);cursor:pointer;font-size:1rem;padding:0 .25rem;}

          .nc-music-locked{font-family:var(--mono);font-size:.72rem;color:var(--muted);line-height:1.6;background:var(--surface2);border:1px dashed var(--border);border-radius:8px;padding:.55rem .75rem;}
          .nc-foot{font-family:var(--mono);font-size:.62rem;color:var(--muted);text-align:center;margin-top:.4rem;line-height:1.5;}
        `}</style>
      </div>
    </div>
  )
}
