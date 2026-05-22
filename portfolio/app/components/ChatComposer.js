'use client'
import { useState, useRef, useEffect } from 'react'

// 채팅 입력 영역 — 텍스트, 이미지(미리보기), 이모지, GIPHY GIF.
// props:
//   - onSend({ message, imageUrl, gifUrl })
//   - disabled (전체 비활성)
//
// GIPHY 키: NEXT_PUBLIC_GIPHY_KEY (없으면 GIF 패널은 안내 표시)
//
// 이모지: 기본 32종 — 인스타와 비슷한 간단 셋트. 입력 끝에 삽입.

const EMOJIS = [
  '😀','😂','🥰','😍','😘','😎','🤔','😏',
  '😢','😭','😡','🤯','😴','🤤','🥵','🥶',
  '👍','👎','👏','🙏','💪','✌️','🤝','🫶',
  '❤️','💔','💯','🔥','✨','🎉','💀','👀',
]

export default function ChatComposer({ onSend, disabled }) {
  const [msg, setMsg]               = useState('')
  const [imgFile, setImgFile]       = useState(null)
  const [imgPreview, setImgPreview] = useState(null)
  const [uploading, setUploading]   = useState(false)

  const [tab, setTab] = useState(null)   // null | 'emoji' | 'gif'
  const fileRef = useRef(null)
  const inputRef = useRef(null)

  // GIF
  const [gifQuery, setGifQuery] = useState('')
  const [gifs, setGifs]         = useState([])
  const [gifLoading, setGifLoading] = useState(false)
  const [gifErr, setGifErr] = useState('')
  const giphyKey = process.env.NEXT_PUBLIC_GIPHY_KEY

  const searchGif = async (q) => {
    if (!giphyKey) { setGifErr('GIPHY 키 미설정'); return }
    if (!q.trim()) { setGifs([]); return }
    setGifLoading(true); setGifErr('')
    try {
      const url = `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(giphyKey)}&q=${encodeURIComponent(q)}&limit=18&rating=g`
      const r = await fetch(url)
      const d = await r.json()
      setGifs(d?.data || [])
    } catch { setGifErr('GIF 검색 실패') }
    setGifLoading(false)
  }

  // 인기 GIF 미리 로드
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

  const pickEmoji = (e) => {
    setMsg(prev => (prev || '') + e)
    inputRef.current?.focus()
  }

  const pickFile = () => fileRef.current?.click()
  const onFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 8 * 1024 * 1024) { alert('8MB 이하만 가능합니다'); return }
    setImgFile(f)
    setImgPreview(URL.createObjectURL(f))
    setTab(null)
  }
  const clearImg = () => {
    setImgFile(null)
    if (imgPreview) URL.revokeObjectURL(imgPreview)
    setImgPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSend = async (e) => {
    e?.preventDefault?.()
    if (disabled || uploading) return
    let imageUrl = null
    if (imgFile) {
      setUploading(true)
      try {
        const fd = new FormData()
        fd.append('file', imgFile)
        const r = await fetch('/api/upload', { method: 'POST', body: fd })
        const d = await r.json()
        if (!d?.url) { alert('이미지 업로드 실패'); setUploading(false); return }
        imageUrl = d.url
      } catch { alert('업로드 실패'); setUploading(false); return }
      setUploading(false)
    }
    const text = msg.trim()
    if (!text && !imageUrl) return
    await onSend({ message: text || null, imageUrl, gifUrl: null })
    setMsg(''); clearImg(); setTab(null)
  }

  const sendGif = async (gif) => {
    const url = gif?.images?.fixed_height?.url || gif?.images?.original?.url
    if (!url) return
    await onSend({ message: null, imageUrl: null, gifUrl: url })
    setTab(null)
  }

  return (
    <div className="cc-wrap">
      {/* 이미지 미리보기 (전송 전) */}
      {imgPreview && (
        <div className="cc-preview">
          <img src={imgPreview} alt="선택된 이미지" />
          <div className="cc-preview-meta">
            <div className="cc-preview-name">{imgFile?.name}</div>
            <div className="cc-preview-size">{Math.round((imgFile?.size||0)/1024)} KB</div>
          </div>
          <button type="button" className="cc-preview-x" onClick={clearImg} aria-label="제거">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* 이모지 / GIF 패널 */}
      {tab === 'emoji' && (
        <div className="cc-panel">
          <div className="cc-panel-head">이모지</div>
          <div className="cc-emoji-grid">
            {EMOJIS.map(e => (
              <button key={e} type="button" className="cc-emoji-btn" onClick={()=>pickEmoji(e)}>{e}</button>
            ))}
          </div>
        </div>
      )}
      {tab === 'gif' && (
        <div className="cc-panel">
          <div className="cc-panel-head">GIF</div>
          <input
            className="cc-gif-search"
            placeholder={giphyKey ? 'GIPHY 에서 검색...' : 'GIPHY API 키가 설정되지 않았습니다'}
            value={gifQuery}
            onChange={e => setGifQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchGif(gifQuery))}
            disabled={!giphyKey}
          />
          {!giphyKey && <div className="cc-gif-empty">관리자가 GIPHY API 키를 설정하면 GIF 검색이 가능해집니다.</div>}
          {gifErr && <div className="cc-gif-empty">{gifErr}</div>}
          {gifLoading && <div className="cc-gif-empty">불러오는 중...</div>}
          {!gifLoading && gifs.length > 0 && (
            <div className="cc-gif-grid">
              {gifs.map(g => {
                const src = g?.images?.fixed_height_small?.url || g?.images?.fixed_height?.url
                return (
                  <button key={g.id} type="button" className="cc-gif-btn" onClick={()=>sendGif(g)}>
                    <img src={src} alt={g.title || 'gif'} loading="lazy"/>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      <form className="cc-row" onSubmit={handleSend}>
        <button type="button" className="cc-icon" onClick={pickFile} disabled={uploading} aria-label="사진">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
          </svg>
        </button>
        <input type="file" accept="image/*" ref={fileRef} style={{display:'none'}} onChange={onFile}/>

        <button type="button" className={`cc-icon ${tab==='emoji'?'on':''}`} onClick={()=>setTab(tab==='emoji'?null:'emoji')} aria-label="이모지">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>
        </button>
        <button type="button" className={`cc-icon ${tab==='gif'?'on':''}`} onClick={()=>setTab(tab==='gif'?null:'gif')} aria-label="GIF">
          <span style={{fontFamily:'var(--mono)',fontSize:'.65rem',fontWeight:700,letterSpacing:'.04em'}}>GIF</span>
        </button>

        <input
          ref={inputRef}
          className="cc-input"
          placeholder="메시지를 입력하세요..."
          value={msg}
          onChange={e => setMsg(e.target.value)}
          disabled={disabled || uploading}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={disabled || uploading || (!msg.trim() && !imgFile)}>
          {uploading ? '...' : '전송'}
        </button>
      </form>

      <style>{`
        .cc-wrap{border-top:1px solid var(--border);background:var(--surface);}
        .cc-preview{display:flex;align-items:center;gap:.7rem;padding:.5rem .9rem;border-bottom:1px solid var(--border);background:var(--surface2);position:relative;}
        .cc-preview img{width:44px;height:44px;object-fit:cover;border-radius:6px;border:1px solid var(--border);flex-shrink:0;}
        .cc-preview-meta{flex:1;min-width:0;}
        .cc-preview-name{font-family:var(--mono);font-size:.78rem;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .cc-preview-size{font-family:var(--mono);font-size:.65rem;color:var(--muted);margin-top:2px;}
        .cc-preview-x{background:rgba(0,0,0,.05);border:none;color:var(--muted);width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;}
        .cc-preview-x:hover{background:rgba(0,0,0,.1);color:var(--text);}

        .cc-panel{padding:.55rem .9rem;border-bottom:1px solid var(--border);background:var(--surface2);max-height:240px;overflow-y:auto;}
        .cc-panel-head{font-family:var(--mono);font-size:.66rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.45rem;}
        .cc-emoji-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:.2rem;}
        .cc-emoji-btn{background:none;border:none;font-size:1.4rem;padding:.25rem;cursor:pointer;border-radius:6px;line-height:1;}
        .cc-emoji-btn:hover{background:rgba(0,0,0,.06);}
        .cc-gif-search{width:100%;border:1px solid var(--border);border-radius:6px;padding:.4rem .65rem;font-family:var(--font);font-size:.82rem;outline:none;background:var(--bg);color:var(--text);margin-bottom:.45rem;}
        .cc-gif-search:focus{border-color:var(--accent);}
        .cc-gif-empty{font-family:var(--mono);font-size:.72rem;color:var(--muted);padding:.5rem .25rem;}
        .cc-gif-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.35rem;}
        .cc-gif-btn{background:none;border:1px solid var(--border);padding:0;cursor:pointer;border-radius:6px;overflow:hidden;aspect-ratio:1.4/1;}
        .cc-gif-btn:hover{border-color:var(--accent);}
        .cc-gif-btn img{width:100%;height:100%;object-fit:cover;display:block;}

        .cc-row{display:flex;gap:.4rem;align-items:center;padding:.55rem .85rem;}
        .cc-icon{background:none;border:none;color:var(--muted);width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;}
        .cc-icon:hover{background:rgba(0,0,0,.06);color:var(--text);}
        .cc-icon.on{background:rgba(192,57,43,.12);color:var(--accent);}
        .cc-icon:disabled{opacity:.4;cursor:not-allowed;}
        .cc-input{flex:1;border:1px solid var(--border);border-radius:18px;padding:.5rem .9rem;font-family:var(--font);font-size:.88rem;outline:none;background:var(--bg);color:var(--text);min-width:0;}
        .cc-input:focus{border-color:var(--accent);}

        @media (max-width: 640px){
          .cc-emoji-grid{grid-template-columns:repeat(6,1fr);}
          .cc-gif-grid{grid-template-columns:repeat(2,1fr);}
        }
      `}</style>
    </div>
  )
}
