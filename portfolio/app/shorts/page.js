'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

// ── i18n ──────────────────────────────────────────────────────────────────────
const T = {
  en: {
    title:'🎬 Shorts', upload:'+ Upload', loginUpload:'Login to upload',
    noShorts:'No shorts yet', firstShort:'Upload first short',
    selectVideo:'Click to select video', formats:'mp4 · mov · webm',
    reselect:'Reselect', titleLbl:'Title', titleOpt:'(optional)',
    descLbl:'Description', descOpt:'(optional)',
    titlePh:'Short title', descPh:'Short description',
    uploadBtn:'🎬 Upload', uploadingBtn:'Uploading...',
    musicLbl:'🎵 Background Music', musicNone:'No music',
    musicUpload:'Upload audio file (mp3/wav · max 10MB)',
    musicSelected:'✓ Music selected', doubleTap:'Double tap to like',
    deleteConfirm:'Delete this short?', uploading1:'Uploading video...',
    uploading2:'Uploading audio...', uploading3:'Saving short...',
    mute:'Mute', unmute:'Unmute',
  },
  ko: {
    title:'🎬 쇼츠', upload:'+ 업로드', loginUpload:'로그인 후 업로드',
    noShorts:'아직 쇼츠가 없어요', firstShort:'첫 쇼츠 올리기',
    selectVideo:'클릭하여 영상 선택', formats:'mp4 · mov · webm · 최대 50MB',
    reselect:'다시 선택', titleLbl:'제목', titleOpt:'(선택)',
    descLbl:'설명', descOpt:'(선택)',
    titlePh:'쇼츠 제목', descPh:'간단한 설명',
    uploadBtn:'🎬 업로드', uploadingBtn:'업로드 중...',
    musicLbl:'🎵 배경음악', musicNone:'음악 없음',
    musicUpload:'오디오 파일 업로드 (mp3/wav · 최대 10MB)',
    musicSelected:'✓ 음악 선택됨', doubleTap:'더블탭으로 좋아요',
    deleteConfirm:'쇼츠를 삭제하시겠습니까?', uploading1:'영상 업로드 중...',
    uploading2:'오디오 업로드 중...', uploading3:'쇼츠 등록 중...',
    mute:'음소거', unmute:'소리 켜기',
  }
}

export default function ShortsPage() {
  const [t,          setT]          = useState(T.en)
  const [user,       setUser]       = useState(null)
  const [shorts,     setShorts]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [current,    setCurrent]    = useState(0)
  const [muted,      setMuted]      = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [heartAnim,  setHeartAnim]  = useState({})   // { idx: true }

  // upload state
  const [videoFile,    setVideoFile]    = useState(null)
  const [videoPreview, setVideoPreview] = useState(null)
  const [audioFile,    setAudioFile]    = useState(null)
  const [audioName,    setAudioName]    = useState('')
  const [title,        setTitle]        = useState('')
  const [desc,         setDesc]         = useState('')
  const [uploading,    setUploading]    = useState(false)
  const [uploadProg,   setUploadProg]   = useState('')
  const [uploadErr,    setUploadErr]    = useState('')

  const containerRef  = useRef(null)
  const videoFileRef  = useRef(null)
  const audioFileRef  = useRef(null)
  const videoRefs     = useRef({})
  const audioRefs     = useRef({})   // per-short audio elements
  const touchStart    = useRef(null)
  const touchTime     = useRef(null)
  const lastTap       = useRef({})   // { idx: timestamp }

  useEffect(() => {
    const lang = localStorage.getItem('cozyboard_lang') || 'en'
    setT(T[lang] || T.en)
    const u = localStorage.getItem('user')
    if (u) setUser(JSON.parse(u))
    loadShorts()
  }, [])

  // ── play/pause on current change ──────────────────────────
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([idx, el]) => {
      if (!el) return
      const i = parseInt(idx)
      if (i === current) {
        el.muted = muted
        el.play().catch(() => {})
        // sync audio to video events
        const audio = audioRefs.current[i]
        if (audio) {
          audio.currentTime = 0
          if (!muted) audio.play().catch(() => {})
          // keep audio in sync with video
          el.onplay  = () => { if (!muted) audio.play().catch(()=>{}) }
          el.onpause = () => { audio.pause() }
          el.onseeked = () => { audio.currentTime = el.currentTime }
        }
        // view count
        if (shorts[i]) {
          fetch(`/api/shorts/${shorts[i].id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'view', userId: user?.id || 'anon' }),
          }).catch(() => {})
        }
      } else {
        el.onplay = null; el.onpause = null; el.onseeked = null
        el.pause(); el.currentTime = 0
        const audio = audioRefs.current[i]
        if (audio) { audio.pause(); audio.currentTime = 0 }
      }
    })
  }, [current, shorts])

  const loadShorts = async () => {
    setLoading(true)
    const res  = await fetch('/api/shorts')
    const data = await res.json()
    setShorts(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  // ── navigation ────────────────────────────────────────────
  const goTo = (idx) => {
    if (idx < 0 || idx >= shorts.length) return
    setCurrent(idx)
    containerRef.current?.children[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const onWheel = (e) => {
    e.preventDefault()
    if (e.deltaY > 30) goTo(current + 1)
    else if (e.deltaY < -30) goTo(current - 1)
  }

  const onTouchStart = (e) => {
    touchStart.current = e.touches[0].clientY
    touchTime.current  = Date.now()
  }
  const onTouchEnd = (e) => {
    if (touchStart.current === null) return
    const dy = touchStart.current - e.changedTouches[0].clientY
    if (Math.abs(dy) > 50) {
      if (dy > 0) goTo(current + 1)
      else goTo(current - 1)
    }
    touchStart.current = null
  }

  // ── toggle mute ───────────────────────────────────────────
  const toggleMute = () => {
    const nm = !muted
    setMuted(nm)
    const el = videoRefs.current[current]
    if (el) el.muted = nm
    const audio = audioRefs.current[current]
    if (audio) {
      if (nm) {
        audio.pause()
      } else {
        audio.currentTime = el?.currentTime || 0
        audio.play().catch(() => {})
      }
    }
  }

  // ── double-tap like ───────────────────────────────────────
  const handleVideoTap = (idx, shortId) => {
    const now = Date.now()
    const last = lastTap.current[idx] || 0
    if (now - last < 350) {
      // double tap!
      triggerHeart(idx)
      handleLike(shortId, idx)
    } else {
      // single tap — toggle mute off / play/pause
      const el = videoRefs.current[idx]
      if (!el) return
      if (muted) {
        // first tap: unmute
        setMuted(false)
        el.muted = false
        el.play().catch(() => {})
        const audio = audioRefs.current[idx]
        if (audio) { audio.currentTime = el.currentTime; audio.play().catch(() => {}) }
      } else {
        // subsequent taps: play/pause
        const audio = audioRefs.current[idx]
        if (el.paused) {
          el.play().catch(() => {})
          if (audio) audio.play().catch(() => {})
        } else {
          el.pause()
          if (audio) audio.pause()
        }
      }
    }
    lastTap.current[idx] = now
  }

  const triggerHeart = (idx) => {
    setHeartAnim(prev => ({ ...prev, [idx]: true }))
    setTimeout(() => setHeartAnim(prev => ({ ...prev, [idx]: false })), 900)
  }

  // ── like ──────────────────────────────────────────────────
  const handleLike = async (shortId, idx) => {
    if (!user) return
    const res  = await fetch(`/api/shorts/${shortId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'like', userId: user.id }),
    })
    const data = await res.json()
    setShorts(prev => prev.map((s, i) =>
      i === idx ? { ...s, likes: data.likes, likedBy: { ...(s.likedBy||{}), [user.id]: data.liked||undefined } } : s
    ))
  }

  // ── delete ────────────────────────────────────────────────
  const handleDelete = async (shortId) => {
    if (!user || !confirm(t.deleteConfirm)) return
    await fetch(`/api/shorts/${shortId}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, role: user.role }),
    })
    loadShorts(); setCurrent(0)
  }

  // ── video select ──────────────────────────────────────────
  const onVideoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadErr(''); setVideoFile(file)
    setVideoPreview(URL.createObjectURL(file))
  }

  // ── audio select ──────────────────────────────────────────
  const onAudioSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { alert('Max 10MB audio'); e.target.value=''; return }
    setAudioFile(file); setAudioName(file.name)
  }

  // ── upload ────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!user || !videoFile) return
    setUploading(true); setUploadProg(t.uploading1); setUploadErr('')

    try {
      // 1. video
      const vfd = new FormData(); vfd.append('file', videoFile)
      const vRes = await fetch('/api/upload-video', { method: 'POST', body: vfd })
      const vData = await vRes.json()
      if (!vRes.ok || !vData.url) { setUploadErr(vData.error||'Video upload failed'); setUploading(false); setUploadProg(''); return }

      // 2. audio (optional)
      let audioUrl = null
      if (audioFile) {
        setUploadProg(t.uploading2)
        const afd = new FormData(); afd.append('file', audioFile)
        const aRes = await fetch('/api/upload-audio', { method: 'POST', body: afd })
        const aData = await aRes.json()
        if (aRes.ok && aData.url) audioUrl = aData.url
      }

      // 3. save to Firebase
      setUploadProg(t.uploading3)
      const saveRes = await fetch('/api/shorts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorId: user.id, authorName: user.name, authorAvatar: user.avatar||null,
          videoUrl: vData.url, audioUrl, title, description: desc,
        }),
      })
      const saveData = await saveRes.json()
      if (!saveRes.ok || saveData.error) { setUploadErr(saveData.error||'Save failed'); setUploading(false); setUploadProg(''); return }

      setVideoFile(null); setVideoPreview(null); setAudioFile(null); setAudioName(''); setTitle(''); setDesc('')
      setUploading(false); setUploadProg(''); setUploadErr(''); setShowUpload(false)
      setShorts(prev => [{ ...saveData }, ...prev]); setCurrent(0)

    } catch(e) {
      setUploadErr(`Error: ${e.message||'Unknown error'}`)
      setUploading(false); setUploadProg('')
    }
  }

  if (loading) return (
    <main style={{background:'#0a0a0a',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <span style={{color:'rgba(255,255,255,0.4)',fontFamily:'monospace'}}>Loading...</span>
    </main>
  )

  return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      {/* ── topbar ── */}
      <div className="shorts-topbar">
        <span style={{ fontFamily:'var(--serif)', fontWeight:700, fontSize:'1.1rem', color:'#fff' }}>{t.title}</span>
        <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
          <button onClick={toggleMute}
            style={{ background:'rgba(255,255,255,0.12)', border:'none', borderRadius:4, color:'#fff', padding:'0.3rem 0.65rem', cursor:'pointer', fontSize:'1rem' }}>
            {muted ? '🔇' : '🔊'}
          </button>
          {user && <button className="shorts-upload-btn" onClick={() => setShowUpload(true)}>{t.upload}</button>}
          {!user && <Link href="/login" style={{ fontFamily:'var(--mono)', fontSize:'0.75rem', color:'rgba(255,255,255,0.5)' }}>{t.loginUpload}</Link>}
        </div>
      </div>

      {shorts.length === 0 ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'calc(100vh - 60px)', color:'rgba(255,255,255,0.4)', gap:'1rem' }}>
          <div style={{ fontSize:'3rem' }}>🎬</div>
          <p style={{ fontFamily:'var(--mono)', fontSize:'0.9rem' }}>{t.noShorts}</p>
          {user && <button className="shorts-upload-btn" onClick={() => setShowUpload(true)}>{t.firstShort}</button>}
        </div>
      ) : (
        <>
          <div className="shorts-feed" ref={containerRef} onWheel={onWheel} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            {shorts.map((s, idx) => {
              const liked = user && !!(s.likedBy||{})[user.id]
              const isMine = user && (user.id === s.authorId || user.role === 'admin')
              return (
                <div key={s.id} className="short-item">
                  <video
                    ref={el => { videoRefs.current[idx] = el }}
                    src={s.videoUrl} loop muted={muted} playsInline
                    className="short-video"
                    onClick={() => handleVideoTap(idx, s.id)}
                  />

                  {/* hidden audio element for background music */}
                  {s.audioUrl && (
                    <audio
                      ref={el => { audioRefs.current[idx] = el }}
                      src={s.audioUrl} loop
                      style={{ display:'none' }}
                    />
                  )}

                  {/* double-tap heart burst */}
                  {heartAnim[idx] && (
                    <div className="heart-burst">❤️</div>
                  )}

                  {/* right actions */}
                  <div className="short-actions">
                    <Link href={`/profile/${s.authorId}`} style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                      {s.authorAvatar
                        ? <img src={s.authorAvatar} alt="" style={{ width:42, height:42, borderRadius:'50%', objectFit:'cover', border:'2px solid #fff' }} />
                        : <div style={{ width:42, height:42, borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontFamily:'var(--serif)', fontWeight:700, border:'2px solid #fff' }}>
                            {(s.authorName||'?')[0].toUpperCase()}
                          </div>
                      }
                    </Link>

                    <button className={`short-action-btn ${liked?'liked':''}`} onClick={() => handleLike(s.id, idx)}>
                      <span style={{ fontSize:'1.6rem', display:'inline-block', transition:'transform .2s' }} className={liked?'heart-liked':''}>
                        {liked ? '❤️' : '🤍'}
                      </span>
                      <span>{s.likes||0}</span>
                    </button>

                    <div className="short-action-btn">
                      <span style={{ fontSize:'1.4rem' }}>👁</span>
                      <span>{s.views||0}</span>
                    </div>

                    {s.audioUrl && (
                      <div className="short-action-btn" title="Has background music">
                        <span style={{ fontSize:'1.2rem' }}>🎵</span>
                      </div>
                    )}

                    {isMine && (
                      <button className="short-action-btn" onClick={() => handleDelete(s.id)}>
                        <span style={{ fontSize:'1.3rem' }}>🗑</span>
                      </button>
                    )}
                  </div>

                  {/* bottom info */}
                  <div className="short-info">
                    <Link href={`/profile/${s.authorId}`} className="short-author">@{s.authorName}</Link>
                    {s.title && <p className="short-title">{s.title}</p>}
                    {s.description && <p className="short-desc">{s.description}</p>}
                    <p style={{ fontFamily:'var(--mono)', fontSize:'0.62rem', color:'rgba(255,255,255,0.35)', marginTop:'0.3rem' }}>
                      {new Date(s.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="short-page-ind">{idx+1} / {shorts.length}</div>
                </div>
              )
            })}
          </div>

          <div className="short-scroll-btns">
            <button onClick={() => goTo(current-1)} disabled={current===0}>↑</button>
            <button onClick={() => goTo(current+1)} disabled={current>=shorts.length-1}>↓</button>
          </div>
        </>
      )}

      {/* ══ UPLOAD MODAL ══ */}
      {showUpload && (
        <div className="sv-overlay" onClick={() => !uploading && setShowUpload(false)}>
          <div className="upload-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
              <h3 style={{ fontFamily:'var(--serif)', fontSize:'1.1rem', color:'var(--ink)' }}>🎬 Upload Short</h3>
              <button className="sv-close" style={{ color:'var(--muted)' }} onClick={() => !uploading && setShowUpload(false)}>✕</button>
            </div>

            {/* Video */}
            {videoPreview
              ? <video src={videoPreview} controls className="upload-preview" />
              : <div className="upload-dropzone" onClick={() => videoFileRef.current?.click()}>
                  <div style={{ fontSize:'2.5rem', marginBottom:'0.5rem' }}>🎬</div>
                  <p style={{ fontFamily:'var(--mono)', fontSize:'0.8rem', color:'var(--muted)' }}>{t.selectVideo}</p>
                  <p style={{ fontFamily:'var(--mono)', fontSize:'0.68rem', color:'var(--border-dark)', marginTop:'0.3rem' }}>{t.formats}</p>
                </div>
            }
            <input ref={videoFileRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/avi" style={{ display:'none' }} onChange={onVideoSelect} />
            {videoPreview && (
              <button style={{ fontFamily:'var(--mono)', fontSize:'0.72rem', color:'var(--accent)', background:'none', border:'none', cursor:'pointer', marginTop:'0.4rem' }}
                onClick={() => { setVideoFile(null); setVideoPreview(null) }}>{t.reselect}</button>
            )}

            {/* Music */}
            <div style={{ marginTop:'1rem', border:'1px solid var(--border)', borderRadius:6, padding:'0.85rem' }}>
              <div style={{ fontFamily:'var(--mono)', fontSize:'0.75rem', color:'var(--muted)', marginBottom:'0.6rem' }}>{t.musicLbl}</div>
              <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
                <button className="btn btn-sm" onClick={() => audioFileRef.current?.click()}>
                  {audioName ? `🎵 ${audioName.slice(0,25)}${audioName.length>25?'...':''}` : t.musicUpload}
                </button>
                {audioName && (
                  <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:'0.8rem' }}
                    onClick={() => { setAudioFile(null); setAudioName('') }}>✕</button>
                )}
              </div>
              <p style={{ fontFamily:'var(--mono)', fontSize:'0.65rem', color:'var(--border-dark)', marginTop:'0.4rem' }}>mp3 · wav · ogg · max 10MB</p>
              <input ref={audioFileRef} type="file" accept="audio/mp3,audio/mpeg,audio/wav,audio/ogg,audio/m4a" style={{ display:'none' }} onChange={onAudioSelect} />
            </div>

            <div className="form-group" style={{ marginTop:'1rem' }}>
              <label>{t.titleLbl} <span style={{ color:'var(--muted)', fontWeight:300 }}>{t.titleOpt}</span></label>
              <input placeholder={t.titlePh} value={title} onChange={e => setTitle(e.target.value)} maxLength={60} />
            </div>
            <div className="form-group">
              <label>{t.descLbl} <span style={{ color:'var(--muted)', fontWeight:300 }}>{t.descOpt}</span></label>
              <textarea style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'2px', padding:'.5rem .75rem', color:'var(--text)', fontFamily:'var(--font)', fontSize:'.875rem', resize:'none', outline:'none' }}
                rows={2} placeholder={t.descPh} value={desc} onChange={e => setDesc(e.target.value)} maxLength={150} />
            </div>

            {uploadProg && <p style={{ fontFamily:'var(--mono)', fontSize:'0.78rem', color:'var(--accent)', marginBottom:'0.5rem' }}>⏳ {uploadProg}</p>}
            {uploadErr  && <p style={{ fontFamily:'var(--mono)', fontSize:'0.78rem', color:'#e74c3c', marginBottom:'0.5rem', padding:'0.5rem', background:'rgba(231,76,60,0.08)', borderRadius:4, border:'1px solid rgba(231,76,60,0.2)' }}>⚠ {uploadErr}</p>}

            <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', marginTop:'0.5rem' }}
              onClick={handleUpload} disabled={uploading||!videoFile}>
              {uploading ? t.uploadingBtn : t.uploadBtn}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .shorts-topbar{position:fixed;top:60px;left:0;right:0;height:50px;background:rgba(10,10,10,.92);display:flex;align-items:center;justify-content:space-between;padding:0 1.5rem;z-index:200;border-bottom:1px solid rgba(255,255,255,.08);}
        .shorts-upload-btn{background:var(--accent);color:#fff;border:none;padding:.35rem .9rem;border-radius:4px;font-size:.8rem;font-family:var(--mono);cursor:pointer;}
        .shorts-upload-btn:hover{background:var(--accent2);}
        .shorts-feed{height:calc(100vh - 110px);overflow:hidden;margin-top:50px;}
        .short-item{width:100%;height:calc(100vh - 110px);position:relative;display:flex;align-items:center;justify-content:center;background:#000;}
        .short-video{width:100%;height:100%;object-fit:cover;cursor:pointer;}
        .short-actions{position:absolute;right:1rem;bottom:6rem;display:flex;flex-direction:column;gap:1.5rem;align-items:center;}
        .short-action-btn{display:flex;flex-direction:column;align-items:center;gap:.2rem;background:none;border:none;color:#fff;cursor:pointer;font-family:var(--mono);font-size:.7rem;text-shadow:0 1px 3px rgba(0,0,0,.8);}
        .short-action-btn.liked .heart-liked{animation:like-pop .3s ease;}
        .short-info{position:absolute;left:1rem;bottom:1.5rem;right:5.5rem;}
        .short-author{color:#fff;font-family:var(--mono);font-size:.82rem;font-weight:500;text-decoration:none;text-shadow:0 1px 3px rgba(0,0,0,.8);}
        .short-title{color:#fff;font-family:var(--serif);font-size:.95rem;font-weight:700;margin-top:.3rem;text-shadow:0 1px 3px rgba(0,0,0,.8);}
        .short-desc{color:rgba(255,255,255,.75);font-size:.8rem;margin-top:.2rem;line-height:1.5;text-shadow:0 1px 2px rgba(0,0,0,.6);}
        .short-page-ind{position:absolute;top:.75rem;right:.75rem;font-family:var(--mono);font-size:.65rem;color:rgba(255,255,255,.4);background:rgba(0,0,0,.4);padding:.15rem .45rem;border-radius:10px;}
        .short-scroll-btns{position:fixed;right:1.5rem;bottom:6rem;display:flex;flex-direction:column;gap:.5rem;z-index:300;}
        .short-scroll-btns button{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#fff;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;}
        .short-scroll-btns button:disabled{opacity:.25;cursor:not-allowed;}
        /* Double-tap heart burst */
        .heart-burst{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:5rem;pointer-events:none;animation:heart-burst .9s ease forwards;z-index:10;}
        @keyframes heart-burst{0%{opacity:0;transform:translate(-50%,-50%) scale(0.3)}30%{opacity:1;transform:translate(-50%,-50%) scale(1.4)}70%{opacity:1;transform:translate(-50%,-50%) scale(1.1)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.3)}}
        @keyframes like-pop{0%{transform:scale(1)}50%{transform:scale(1.5)}100%{transform:scale(1)}}
        /* Modal */
        .upload-modal{background:var(--surface);border-radius:12px;width:min(440px,92vw);max-height:88vh;overflow-y:auto;padding:1.5rem;box-shadow:0 20px 60px rgba(0,0,0,.5);}
        .upload-preview{width:100%;border-radius:8px;max-height:240px;object-fit:contain;background:#000;}
        .upload-dropzone{border:2px dashed var(--border);border-radius:8px;padding:2.5rem;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:border-color .2s;}
        .upload-dropzone:hover{border-color:var(--accent);}
        .sv-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:8000;display:flex;align-items:center;justify-content:center;}
        .sv-close{background:none;border:none;color:rgba(255,255,255,.7);font-size:1.1rem;cursor:pointer;padding:.2rem .4rem;border-radius:4px;}
      `}</style>
    </main>
  )
}
