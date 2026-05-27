'use client'
import { useState, useEffect, useRef, lazy, Suspense } from 'react'

const MusicPicker = lazy(() => import('./MusicPicker'))

// 메모(Note) 작성 모달 — Instagram 노트 패턴.
// - 60자 텍스트
// - 음악 첨부 (음악 라이브러리에서 선택)
// - GIF 첨부 (GIPHY)
// - 24시간 자동 삭제 (서버 측 처리)

export default function NoteComposer({ user, onClose, onPosted }) {
  const [text, setText] = useState('')
  const [tab, setTab] = useState(null)        // null | 'music' | 'gif'
  const [music, setMusic] = useState(null)    // { id, fileUrl, title, artist, coverUrl }
  const [gif, setGif] = useState(null)        // { url, title }
  const [posting, setPosting] = useState(false)
  const inputRef = useRef(null)

  // GIF
  const giphyKey = process.env.NEXT_PUBLIC_GIPHY_KEY
  const [gifQuery, setGifQuery] = useState('')
  const [gifs, setGifs] = useState([])
  const [gifLoading, setGifLoading] = useState(false)
  const [gifErr, setGifErr] = useState('')

  useEffect(() => { inputRef.current?.focus() }, [])

  // GIF trending 초기 로드
  useEffect(() => {
    if (tab !== 'gif' || gifs.length > 0 || !giphyKey) return
    let cancelled = false
    setGifLoading(true)
    fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(giphyKey)}&limit=18&rating=g`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setGifs(d?.data || []) })
      .catch(() => { if (!cancelled) setGifErr('GIF 로드 실패') })
      .finally(() => { if (!cancelled) setGifLoading(false) })
    return () => { cancelled = true }
  }, [tab])

  const searchGif = async (q) => {
    if (!giphyKey) { setGifErr('GIPHY 키 미설정'); return }
    if (!q.trim()) return
    setGifLoading(true); setGifErr('')
    try {
      const r = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(giphyKey)}&q=${encodeURIComponent(q)}&limit=18&rating=g`)
      const d = await r.json()
      setGifs(d?.data || [])
    } catch { setGifErr('GIF 검색 실패') }
    setGifLoading(false)
  }

  const pickGif = (g) => {
    const url = g?.images?.fixed_height?.url || g?.images?.original?.url
    if (!url) return
    setGif({ url, title: g.title || '' })
    setTab(null)
  }

  const post = async () => {
    if (!user) return
    if (!text.trim() && !music && !gif) { alert('메모 / 음악 / GIF 중 하나는 입력해주세요'); return }
    setPosting(true)
    try {
      const r = await fetch('/api/notes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          text:   text.trim(),
          music:  music ? { url: music.fileUrl, title: music.title, author: music.artist || '', thumbnail: music.coverUrl || '' } : null,
          gifUrl: gif?.url || null,
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
            {text
              ? <span className="nc-bubble-text">{text}</span>
              : (gif
                  ? <img src={gif.url} alt="" style={{maxHeight:80,borderRadius:8}}/>
                  : (music
                      ? <span className="nc-bubble-text">♪ {music.title}</span>
                      : <span className="nc-bubble-ph">무엇이든 공유해보세요…</span>
                    )
                )
            }
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

          {/* 첨부 아이콘 row */}
          <div className="nc-icons">
            <button type="button" className={`nc-icon ${tab==='music'?'on':''}`} onClick={()=>setTab(tab==='music'?null:'music')} aria-label="음악">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            </button>
            <button type="button" className={`nc-icon ${tab==='gif'?'on':''}`} onClick={()=>setTab(tab==='gif'?null:'gif')} aria-label="GIF">
              <span style={{fontFamily:'var(--mono)',fontSize:'.7rem',fontWeight:700,letterSpacing:'.04em'}}>GIF</span>
            </button>
            {music && (
              <div className="nc-chip">
                <span style={{fontSize:'.7rem'}}>♪ {music.title}</span>
                <button type="button" onClick={()=>setMusic(null)} className="nc-chip-x">×</button>
              </div>
            )}
            {gif && (
              <div className="nc-chip">
                <span style={{fontSize:'.7rem'}}>GIF 선택됨</span>
                <button type="button" onClick={()=>setGif(null)} className="nc-chip-x">×</button>
              </div>
            )}
          </div>

          {/* 음악 패널 */}
          {tab === 'music' && (
            <div className="nc-panel">
              <Suspense fallback={<div style={{fontFamily:'var(--mono)',fontSize:'.72rem',color:'var(--muted)',padding:'.5rem'}}>로딩 중...</div>}>
                <MusicPicker
                  selected={music}
                  onSelect={(m) => { setMusic(m); if (m) setTab(null) }}
                  compact
                />
              </Suspense>
            </div>
          )}

          {/* GIF 패널 */}
          {tab === 'gif' && (
            <div className="nc-panel">
              <input
                className="nc-gif-search"
                placeholder={giphyKey ? 'GIPHY 에서 검색...' : 'GIPHY API 키가 설정되지 않았습니다'}
                value={gifQuery}
                onChange={e => setGifQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchGif(gifQuery))}
                disabled={!giphyKey}
              />
              {!giphyKey && <p className="nc-err">관리자가 GIPHY API 키를 설정하면 GIF 검색이 가능해집니다.</p>}
              {gifErr && <p className="nc-err">{gifErr}</p>}
              {gifLoading && <p className="nc-err" style={{color:'var(--muted)'}}>불러오는 중...</p>}
              {!gifLoading && gifs.length > 0 && (
                <div className="nc-gif-grid">
                  {gifs.map(g => {
                    const src = g?.images?.fixed_height_small?.url || g?.images?.fixed_height?.url
                    return (
                      <button key={g.id} type="button" className="nc-gif-btn" onClick={() => pickGif(g)}>
                        <img src={src} alt={g.title || 'gif'} loading="lazy"/>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ width:'100%', justifyContent:'center', marginTop:'.5rem' }}
            onClick={post}
            disabled={posting || (!text.trim() && !music && !gif)}
          >
            {posting ? '공유 중...' : '공유'}
          </button>

          <p className="nc-foot">메모는 24시간 동안 표시되며, 맞팔로우 중인 사람만 볼 수 있어요.</p>
        </div>

        <style jsx>{`
          .nc-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:8800;display:flex;align-items:center;justify-content:center;padding:1rem;animation:nc-in .15s ease;}
          @keyframes nc-in{from{opacity:0}to{opacity:1}}
          .nc-modal{background:var(--surface);border-radius:14px;width:min(420px,94vw);max-height:90vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,.45);animation:nc-pop .2s ease;}
          @keyframes nc-pop{from{transform:scale(.92);opacity:0}to{transform:none;opacity:1}}
          .nc-head{display:flex;justify-content:space-between;align-items:center;padding:.85rem 1.1rem;border-bottom:1px solid var(--border);}
          .nc-head h3{font-family:var(--serif);font-size:1.02rem;color:var(--ink);margin:0;}
          .nc-x{background:none;border:none;color:var(--muted);cursor:pointer;padding:.25rem;display:flex;}
          .nc-x:hover{color:var(--text);}

          .nc-preview{padding:1.5rem 1.5rem 1rem;display:flex;flex-direction:column;align-items:center;gap:0;background:var(--surface2);position:relative;}
          .nc-bubble{background:var(--accent);color:#fff;border-radius:16px 16px 16px 4px;padding:.55rem .9rem;font-family:var(--mono);font-size:.85rem;max-width:80%;text-align:center;min-height:32px;display:flex;align-items:center;justify-content:center;margin-bottom:-12px;box-shadow:0 3px 8px rgba(192,57,43,.3);}
          .nc-bubble-text{display:block;word-break:break-word;}
          .nc-bubble-ph{opacity:.7;}
          .nc-av{width:64px;height:64px;border-radius:50%;background:var(--accent);color:#fff;font-family:var(--serif);font-weight:700;font-size:1.4rem;display:flex;align-items:center;justify-content:center;overflow:hidden;border:3px solid var(--surface2);}
          .nc-av img{width:100%;height:100%;object-fit:cover;}

          .nc-body{padding:1rem 1.2rem 1.2rem;display:flex;flex-direction:column;gap:.5rem;}
          .nc-input{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:.55rem .75rem;color:var(--text);font-family:var(--font);font-size:.92rem;outline:none;}
          .nc-input:focus{border-color:var(--accent);}
          .nc-counter{display:flex;justify-content:flex-end;font-family:var(--mono);font-size:.62rem;color:var(--muted);}

          .nc-icons{display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;}
          .nc-icon{background:var(--surface2);border:1px solid var(--border);color:var(--text);width:36px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;}
          .nc-icon.on{background:rgba(192,57,43,.12);border-color:var(--accent);color:var(--accent);}
          .nc-chip{display:inline-flex;align-items:center;gap:.25rem;background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:.15rem .5rem;font-family:var(--mono);font-size:.7rem;color:var(--text);}
          .nc-chip-x{background:none;border:none;color:var(--muted);cursor:pointer;font-size:.95rem;padding:0 .1rem;}

          .nc-panel{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:.6rem;max-height:340px;overflow:hidden;}
          .nc-gif-search{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.4rem .65rem;font-family:var(--font);font-size:.82rem;outline:none;color:var(--text);margin-bottom:.45rem;}
          .nc-gif-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.35rem;max-height:240px;overflow-y:auto;}
          .nc-gif-btn{background:none;border:1px solid var(--border);padding:0;cursor:pointer;border-radius:6px;overflow:hidden;aspect-ratio:1.4/1;}
          .nc-gif-btn:hover{border-color:var(--accent);}
          .nc-gif-btn img{width:100%;height:100%;object-fit:cover;display:block;}
          .nc-err{font-family:var(--mono);font-size:.7rem;color:var(--accent);margin:.35rem 0;}

          .nc-foot{font-family:var(--mono);font-size:.62rem;color:var(--muted);text-align:center;margin-top:.4rem;line-height:1.5;}

          @media(max-width:640px){
            .nc-gif-grid{grid-template-columns:repeat(2,1fr);}
          }
        `}</style>
      </div>
    </div>
  )
}
