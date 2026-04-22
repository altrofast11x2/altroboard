'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { upload } from '@vercel/blob/client'

// Free audio from mixkit (CORS-friendly, no token needed)
const POPULAR_TRACKS = [
  { name: 'Lofi Study', emoji: '📚', url: 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3' },
  { name: 'Chill Beats', emoji: '🌊', url: 'https://assets.mixkit.co/music/preview/mixkit-hip-hop-02-738.mp3' },
  { name: 'Upbeat Pop', emoji: '⚡', url: 'https://assets.mixkit.co/music/preview/mixkit-driving-ambition-32.mp3' },
  { name: 'Cinematic', emoji: '🎬', url: 'https://assets.mixkit.co/music/preview/mixkit-life-is-a-dream-837.mp3' },
  { name: 'Acoustic', emoji: '🎸', url: 'https://assets.mixkit.co/music/preview/mixkit-guitar-reflections-599.mp3' },
  { name: 'Electronic', emoji: '💿', url: 'https://assets.mixkit.co/music/preview/mixkit-beautiful-dream-493.mp3' },
]

export default function ShortsPage() {
  const [user,         setUser]         = useState(null)
  const [shorts,       setShorts]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [current,      setCurrent]      = useState(0)
  const [muted,        setMuted]        = useState(false)  // start unmuted
  const [showUpload,   setShowUpload]   = useState(false)
  const [heartPos,     setHeartPos]     = useState(null)

  // upload
  const [videoFile,    setVideoFile]    = useState(null)
  const [videoPreview, setVideoPreview] = useState(null)
  const [title,        setTitle]        = useState('')
  const [desc,         setDesc]         = useState('')
  const [uploading,    setUploading]    = useState(false)
  const [uploadProg,   setUploadProg]   = useState(0)  // 0-100
  const [uploadMsg,    setUploadMsg]    = useState('')
  const [uploadErr,    setUploadErr]    = useState('')

  // music
  const [musicMode,     setMusicMode]     = useState('none')
  const [audioFile,     setAudioFile]     = useState(null)
  const [audioName,     setAudioName]     = useState('')
  const [selectedTrack, setSelectedTrack] = useState(null)
  const [previewTrack,  setPreviewTrack]  = useState(null) // currently previewing

  const containerRef = useRef(null)
  const videoFileRef = useRef(null)
  const audioFileRef = useRef(null)
  const videoRefs    = useRef({})
  const audioElRef   = useRef(null)   // single audio element for BGM
  const touchStart   = useRef(null)
  const lastTap      = useRef({})
  const previewAudio = useRef(null)

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (u) setUser(JSON.parse(u))
    loadShorts()
  }, [])

  // play/pause + BGM sync when current changes
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([idx, el]) => {
      if (!el) return
      const i = parseInt(idx)
      if (i === current) {
        el.muted = false   // always unmute the video (use separate audio for BGM)
        el.volume = shorts[i]?.audioUrl ? 0.3 : 1  // lower video if BGM
        el.play().catch(() => {})
        // count view
        if (shorts[i]) {
          fetch(`/api/shorts/${shorts[i].id}`, {
            method: 'PATCH', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ action: 'view', userId: user?.id || 'anon' }),
          }).catch(() => {})
        }
      } else {
        el.pause(); el.currentTime = 0
      }
    })

    // BGM
    const s = shorts[current]
    if (audioElRef.current) {
      audioElRef.current.pause()
      audioElRef.current.src = ''
    }
    if (s?.audioUrl && !muted) {
      const a = new Audio(s.audioUrl)
      a.loop = true; a.volume = 0.7
      a.play().catch(() => {})
      audioElRef.current = a
    }
    return () => { if (audioElRef.current) audioElRef.current.pause() }
  }, [current, shorts])

  // mute toggle
  useEffect(() => {
    Object.values(videoRefs.current).forEach(el => { if (el) el.volume = muted ? 0 : (shorts[current]?.audioUrl ? 0.3 : 1) })
    if (audioElRef.current) audioElRef.current.volume = muted ? 0 : 0.7
  }, [muted])

  const loadShorts = async () => {
    setLoading(true)
    const res  = await fetch('/api/shorts')
    const data = await res.json()
    setShorts(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  const goTo = (idx) => {
    if (idx < 0 || idx >= shorts.length) return
    setCurrent(idx)
    containerRef.current?.children[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const onWheel = (e) => { e.preventDefault(); if (e.deltaY > 40) goTo(current+1); else if (e.deltaY < -40) goTo(current-1) }
  const onTouchStart = (e) => { touchStart.current = e.touches[0].clientY }
  const onTouchEnd = (e) => {
    if (touchStart.current === null) return
    const dy = touchStart.current - e.changedTouches[0].clientY
    if (dy > 60) goTo(current+1); else if (dy < -60) goTo(current-1)
    touchStart.current = null
  }

  const handleTap = (idx, shortId, e) => {
    const now = Date.now()
    if (now - (lastTap.current[idx]||0) < 300) {
      // double tap → heart + like
      const rect = e.currentTarget.getBoundingClientRect()
      const x = (e.changedTouches?.[0]?.clientX || e.clientX) - rect.left
      const y = (e.changedTouches?.[0]?.clientY || e.clientY) - rect.top
      setHeartPos({ idx, x, y })
      setTimeout(() => setHeartPos(null), 900)
      handleLike(shortId, idx)
    }
    lastTap.current[idx] = now
  }

  const handleLike = async (shortId, idx) => {
    if (!user) return
    const res  = await fetch(`/api/shorts/${shortId}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'like', userId:user.id }),
    })
    const data = await res.json()
    setShorts(prev => prev.map((s,i) => i===idx ? {...s, likes:data.likes, likedBy:{...(s.likedBy||{}), [user.id]:data.liked||undefined}} : s))
  }

  const handleDelete = async (shortId) => {
    if (!user || !confirm('쇼츠를 삭제할까요?')) return
    await fetch(`/api/shorts/${shortId}`, { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:user.id,role:user.role}) })
    loadShorts(); setCurrent(0)
  }

  const previewMusic = (track) => {
    if (previewAudio.current) { previewAudio.current.pause(); previewAudio.current = null }
    if (previewTrack?.name === track.name) { setPreviewTrack(null); return }
    const a = new Audio(track.url); a.volume = 0.5; a.play().catch(() => {})
    previewAudio.current = a
    setPreviewTrack(track)
    setTimeout(() => { if (previewAudio.current) { previewAudio.current.pause(); previewAudio.current = null; setPreviewTrack(null) } }, 10000)
  }

  const resetForm = () => {
    setVideoFile(null); setVideoPreview(null); setTitle(''); setDesc('')
    setUploadErr(''); setUploadProg(0); setUploadMsg('')
    setMusicMode('none'); setAudioFile(null); setAudioName(''); setSelectedTrack(null)
    if (previewAudio.current) { previewAudio.current.pause(); previewAudio.current = null }
    setPreviewTrack(null)
    if (videoFileRef.current) videoFileRef.current.value = ''
    if (audioFileRef.current) audioFileRef.current.value = ''
  }

  const handleUpload = async () => {
    if (!user || !videoFile) return
    setUploading(true); setUploadProg(0); setUploadMsg('영상 업로드 중...'); setUploadErr('')

    try {
      // Step 1: Client-side Vercel Blob upload (bypasses 4.5MB server limit)
      const ext  = videoFile.name.split('.').pop().toLowerCase()
      const path = `shorts/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const blob = await upload(path, videoFile, {
        access: 'public',
        handleUploadUrl: '/api/upload-video',
        onUploadProgress: ({ percentage }) => {
          setUploadProg(Math.round(percentage))
          setUploadMsg(`영상 업로드 중... ${Math.round(percentage)}%`)
        },
      })
      if (!blob?.url) { setUploadErr('영상 업로드 실패'); setUploading(false); return }

      // Step 2: audio upload (if file selected)
      let audioUrl = null, audioTitle = null
      if (musicMode==='file' && audioFile) {
        setUploadMsg('오디오 업로드 중...')
        const afd = new FormData(); afd.append('file', audioFile)
        const ar = await fetch('/api/upload-audio', { method:'POST', body:afd })
        const ad = await ar.json()
        if (ar.ok && ad.url) { audioUrl = ad.url; audioTitle = audioName }
      } else if (musicMode==='popular' && selectedTrack) {
        audioUrl = selectedTrack.url; audioTitle = selectedTrack.name
      }

      // Step 3: save to Firebase
      setUploadMsg('등록 중...')
      const saveRes = await fetch('/api/shorts', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          authorId:user.id, authorName:user.name, authorAvatar:user.avatar||null,
          videoUrl:blob.url, audioUrl, audioTitle, title, description:desc,
        }),
      })
      const saveData = await saveRes.json()
      if (!saveRes.ok || saveData.error) { setUploadErr(saveData.error||'등록 실패'); setUploading(false); return }

      resetForm(); setUploading(false); setShowUpload(false)
      setShorts(prev => [{...saveData},...prev]); setCurrent(0)
    } catch(e) {
      setUploadErr(`오류: ${e.message||'알 수 없는 오류'}`); setUploading(false)
    }
  }

  if (loading) return (
    <main className="shorts-bg">
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'calc(100vh - 60px)',color:'rgba(255,255,255,0.35)',fontFamily:'monospace',fontSize:'0.9rem'}}>
        로딩 중...
      </div>
    </main>
  )

  return (
    <main className="shorts-bg">
      {/* topbar */}
      <div className="shorts-topbar">
        <span style={{fontFamily:'var(--serif)',fontWeight:700,fontSize:'1.1rem',color:'#fff'}}>🎬 쇼츠</span>
        <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
          <button onClick={()=>setMuted(m=>!m)} className="shorts-icon-btn" title={muted?'소리 켜기':'음소거'}>
            {muted ? '🔇' : '🔊'}
          </button>
          {user && <button className="shorts-upload-btn" onClick={()=>setShowUpload(true)}>+ 업로드</button>}
          {!user && <Link href="/login" className="shorts-login-link">로그인 후 업로드</Link>}
        </div>
      </div>

      {shorts.length === 0 ? (
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'calc(100vh - 110px)',marginTop:50,color:'rgba(255,255,255,0.4)',gap:'1rem'}}>
          <div style={{fontSize:'3rem'}}>🎬</div>
          <p style={{fontFamily:'var(--mono)',fontSize:'0.9rem'}}>아직 쇼츠가 없어요</p>
          {user && <button className="shorts-upload-btn" onClick={()=>setShowUpload(true)}>첫 쇼츠 올리기</button>}
        </div>
      ) : (
        <>
          <div className="shorts-feed" ref={containerRef} onWheel={onWheel} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            {shorts.map((s,idx) => {
              const liked = user && !!(s.likedBy||{})[user.id]
              const isMine = user && (user.id===s.authorId||user.role==='admin')
              const showHeart = heartPos?.idx === idx
              return (
                <div key={s.id} className="short-item"
                  onClick={e=>handleTap(idx,s.id,e)}
                  onTouchEnd={e=>handleTap(idx,s.id,e)}>

                  <video
                    ref={el=>{videoRefs.current[idx]=el}}
                    src={s.videoUrl} loop playsInline
                    className="short-video"
                  />

                  {/* double-tap heart */}
                  {showHeart && <div className="heart-burst" style={{left:heartPos.x-40,top:heartPos.y-40}}>❤️</div>}

                  {/* music ticker */}
                  {s.audioTitle && (
                    <div className="music-ticker">
                      <span className="ticker-text">🎵 {s.audioTitle} &nbsp;&nbsp; 🎵 {s.audioTitle} &nbsp;&nbsp;</span>
                    </div>
                  )}

                  {/* right actions */}
                  <div className="short-actions" onClick={e=>e.stopPropagation()}>
                    <Link href={`/profile/${s.authorId}`}>
                      {s.authorAvatar
                        ? <img src={s.authorAvatar} alt="" className="short-av-img"/>
                        : <div className="short-av-ph">{(s.authorName||'?')[0].toUpperCase()}</div>
                      }
                    </Link>
                    <button className="short-act" onClick={()=>handleLike(s.id,idx)}>
                      <span className={`like-heart ${liked?'liked':''}`}>{liked?'❤️':'🤍'}</span>
                      <span>{s.likes||0}</span>
                    </button>
                    <div className="short-act">
                      <span>👁</span><span>{s.views||0}</span>
                    </div>
                    {isMine && <button className="short-act" onClick={()=>handleDelete(s.id)}>🗑</button>}
                  </div>

                  {/* bottom info */}
                  <div className="short-info" onClick={e=>e.stopPropagation()}>
                    <Link href={`/profile/${s.authorId}`} className="short-author">@{s.authorName}</Link>
                    {s.title && <p className="short-title">{s.title}</p>}
                    {s.description && <p className="short-desc">{s.description}</p>}
                  </div>
                  <div className="short-idx">{idx+1} / {shorts.length}</div>
                </div>
              )
            })}
          </div>

          {/* scroll buttons */}
          <div className="short-nav">
            <button onClick={()=>goTo(current-1)} disabled={current===0}>↑</button>
            <button onClick={()=>goTo(current+1)} disabled={current>=shorts.length-1}>↓</button>
          </div>
        </>
      )}

      {/* ══ UPLOAD MODAL ══ */}
      {showUpload && (
        <div className="modal-overlay" onClick={()=>!uploading&&(setShowUpload(false),resetForm())}>
          <div className="upload-modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h3>🎬 쇼츠 업로드</h3>
              <button className="modal-close" onClick={()=>!uploading&&(setShowUpload(false),resetForm())}>✕</button>
            </div>

            {/* video select */}
            {videoPreview
              ? <>
                  <video src={videoPreview} controls className="upload-preview"/>
                  <button className="reselect-btn" onClick={()=>{setVideoFile(null);setVideoPreview(null)}}>다시 선택</button>
                </>
              : <div className="upload-drop" onClick={()=>videoFileRef.current?.click()}>
                  <div style={{fontSize:'2.2rem',marginBottom:'0.5rem'}}>🎬</div>
                  <p style={{fontFamily:'var(--mono)',fontSize:'0.82rem',color:'var(--muted)'}}>클릭하여 영상 선택</p>
                  <p style={{fontFamily:'var(--mono)',fontSize:'0.68rem',color:'var(--border-dark)',marginTop:'0.25rem'}}>mp4 · mov · webm · 크기 제한 없음</p>
                </div>
            }
            <input ref={videoFileRef} type="file" accept="video/*" style={{display:'none'}}
              onChange={e=>{const f=e.target.files?.[0];if(f){setUploadErr('');setVideoFile(f);setVideoPreview(URL.createObjectURL(f))}}}/>

            {/* title + desc */}
            <div className="form-group" style={{marginTop:'0.9rem'}}>
              <label>제목 <span style={{color:'var(--muted)',fontWeight:300}}>(선택)</span></label>
              <input placeholder="쇼츠 제목" value={title} onChange={e=>setTitle(e.target.value)} maxLength={60}/>
            </div>
            <div className="form-group">
              <label>설명 <span style={{color:'var(--muted)',fontWeight:300}}>(선택)</span></label>
              <textarea className="upload-textarea" rows={2} placeholder="간단한 설명" value={desc} onChange={e=>setDesc(e.target.value)} maxLength={150}/>
            </div>

            {/* music */}
            <div className="music-panel">
              <div className="music-panel-title">🎵 배경음악</div>
              <div className="music-tabs">
                {[['none','없음'],['file','파일 업로드'],['popular','추천 음악']].map(([m,l])=>(
                  <button key={m} onClick={()=>setMusicMode(m)} className={`music-tab ${musicMode===m?'active':''}`}>{l}</button>
                ))}
              </div>

              {musicMode==='file' && (
                <div style={{marginTop:'0.6rem'}}>
                  <button className="btn btn-sm" onClick={()=>audioFileRef.current?.click()}>
                    {audioName ? `✓ ${audioName.slice(0,22)}${audioName.length>22?'...':''}` : '파일 선택 (mp3/wav · 10MB)'}
                  </button>
                  {audioName && <button style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',marginLeft:'0.4rem'}} onClick={()=>{setAudioFile(null);setAudioName('')}}>✕</button>}
                  <input ref={audioFileRef} type="file" accept="audio/*" style={{display:'none'}}
                    onChange={e=>{const f=e.target.files?.[0];if(f)if(f.size>10*1024*1024){alert('10MB 이하만 가능합니다')}else{setAudioFile(f);setAudioName(f.name)}}}/>
                </div>
              )}

              {musicMode==='popular' && (
                <div className="track-list">
                  {POPULAR_TRACKS.map((track,i)=>(
                    <div key={i} className={`track-item ${selectedTrack?.name===track.name?'selected':''}`}>
                      <button className="track-select" onClick={()=>setSelectedTrack(selectedTrack?.name===track.name?null:track)}>
                        <span className="track-emoji">{track.emoji}</span>
                        <div className="track-info">
                          <span className="track-name">{track.name}</span>
                        </div>
                        {selectedTrack?.name===track.name && <span className="track-check">✓</span>}
                      </button>
                      <button className={`track-preview ${previewTrack?.name===track.name?'playing':''}`}
                        onClick={()=>previewMusic(track)} title="미리 듣기">
                        {previewTrack?.name===track.name ? '⏸' : '▶'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* progress */}
            {uploading && (
              <div style={{marginBottom:'0.75rem'}}>
                <div style={{background:'var(--surface2)',borderRadius:4,height:6,overflow:'hidden',marginBottom:'0.4rem'}}>
                  <div style={{background:'var(--accent)',height:'100%',width:`${uploadProg}%`,transition:'width 0.3s'}}/>
                </div>
                <p style={{fontFamily:'var(--mono)',fontSize:'0.75rem',color:'var(--accent)'}}>{uploadMsg}</p>
              </div>
            )}
            {uploadErr && <div className="upload-err">⚠ {uploadErr}</div>}

            <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}}
              onClick={handleUpload} disabled={uploading||!videoFile}>
              {uploading ? '업로드 중...' : '🎬 업로드'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .shorts-bg{background:#0a0a0a;min-height:100vh;}
        .shorts-topbar{position:fixed;top:60px;left:0;right:0;height:50px;background:rgba(10,10,10,.95);display:flex;align-items:center;justify-content:space-between;padding:0 1.5rem;z-index:200;border-bottom:1px solid rgba(255,255,255,.07);}
        .shorts-upload-btn{background:var(--accent);color:#fff;border:none;padding:.35rem .9rem;border-radius:4px;font-size:.8rem;font-family:var(--mono);cursor:pointer;}
        .shorts-icon-btn{background:rgba(255,255,255,.1);border:none;border-radius:4px;color:#fff;padding:.3rem .65rem;cursor:pointer;font-size:1rem;}
        .shorts-login-link{font-family:var(--mono);font-size:.75rem;color:rgba(255,255,255,.5);text-decoration:none;}

        /* Feed */
        .shorts-feed{height:calc(100vh - 110px);margin-top:50px;overflow:hidden;position:relative;}
        .short-item{
          width:100%;height:calc(100vh - 110px);
          position:relative;display:flex;align-items:center;justify-content:center;
          background:#000;overflow:hidden;
        }
        /* PC: constrain width to phone-like aspect ratio */
        @media(min-width:768px){
          .shorts-feed{display:flex;align-items:center;justify-content:center;}
          .short-item{
            width:min(400px, calc((100vh - 110px) * 9/16));
            border-radius:12px;
            box-shadow:0 0 80px rgba(0,0,0,.8);
          }
        }
        .short-video{width:100%;height:100%;object-fit:cover;display:block;}

        /* Actions */
        .short-actions{position:absolute;right:1rem;bottom:5rem;display:flex;flex-direction:column;gap:1.5rem;align-items:center;z-index:5;}
        .short-av-img{width:42px;height:42px;border-radius:50%;object-fit:cover;border:2px solid #fff;display:block;}
        .short-av-ph{width:42px;height:42px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;font-family:var(--serif);font-weight:700;font-size:1.1rem;border:2px solid #fff;}
        .short-act{display:flex;flex-direction:column;align-items:center;gap:.2rem;background:none;border:none;color:#fff;cursor:pointer;font-family:var(--mono);font-size:.7rem;text-shadow:0 1px 4px rgba(0,0,0,.9);}
        .like-heart{font-size:1.6rem;display:inline-block;}
        .like-heart.liked{animation:like-pop .3s ease;}

        /* Info */
        .short-info{position:absolute;left:1rem;bottom:1.25rem;right:4.5rem;z-index:5;}
        .short-author{color:#fff;font-family:var(--mono);font-size:.82rem;font-weight:600;text-decoration:none;text-shadow:0 1px 4px rgba(0,0,0,.9);display:block;}
        .short-title{color:#fff;font-family:var(--serif);font-size:.95rem;font-weight:700;margin-top:.25rem;text-shadow:0 1px 4px rgba(0,0,0,.9);}
        .short-desc{color:rgba(255,255,255,.75);font-size:.78rem;margin-top:.15rem;line-height:1.5;}
        .short-idx{position:absolute;top:.7rem;right:.7rem;font-family:var(--mono);font-size:.62rem;color:rgba(255,255,255,.4);background:rgba(0,0,0,.5);padding:.12rem .4rem;border-radius:10px;z-index:5;}

        /* Music ticker */
        .music-ticker{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.6));padding:.5rem 1rem .4rem;overflow:hidden;z-index:5;}
        .ticker-text{display:inline-block;font-family:var(--mono);font-size:.68rem;color:#fff;white-space:nowrap;animation:ticker 10s linear infinite;}
        @keyframes ticker{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}

        /* Heart burst */
        .heart-burst{position:absolute;font-size:5rem;pointer-events:none;animation:heart-burst .9s ease forwards;z-index:20;}
        @keyframes heart-burst{0%{opacity:0;transform:scale(.3)}30%{opacity:1;transform:scale(1.4)}70%{opacity:1;transform:scale(1.1)}100%{opacity:0;transform:scale(1.3)}}
        @keyframes like-pop{0%{transform:scale(1)}50%{transform:scale(1.5)}100%{transform:scale(1)}}

        /* Nav */
        .short-nav{position:fixed;right:1.5rem;bottom:5rem;display:flex;flex-direction:column;gap:.5rem;z-index:300;}
        .short-nav button{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#fff;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;}
        .short-nav button:disabled{opacity:.2;cursor:not-allowed;}

        /* Upload modal */
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:8000;display:flex;align-items:center;justify-content:center;padding:1rem;}
        .upload-modal{background:var(--surface);border-radius:12px;width:min(480px,100%);max-height:90vh;overflow-y:auto;padding:1.5rem;box-shadow:0 20px 60px rgba(0,0,0,.6);}
        .modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;}
        .modal-header h3{font-family:var(--serif);font-size:1.1rem;color:var(--ink);}
        .modal-close{background:none;border:none;font-size:1.1rem;cursor:pointer;color:var(--muted);padding:.2rem .4rem;}
        .upload-preview{width:100%;border-radius:8px;max-height:220px;object-fit:contain;background:#000;display:block;}
        .upload-drop{border:2px dashed var(--border);border-radius:8px;padding:2rem;display:flex;flex-direction:column;align-items:center;cursor:pointer;transition:border-color .2s;}
        .upload-drop:hover{border-color:var(--accent);}
        .reselect-btn{background:none;border:none;color:var(--accent);font-family:var(--mono);font-size:.72rem;cursor:pointer;margin-top:.4rem;}
        .upload-textarea{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:2px;padding:.5rem .75rem;color:var(--text);font-family:var(--font);font-size:.875rem;resize:none;outline:none;}
        .upload-textarea:focus{border-color:var(--accent);}
        .upload-err{font-family:var(--mono);font-size:.78rem;color:#e74c3c;padding:.5rem;background:rgba(231,76,60,.08);border-radius:4px;border:1px solid rgba(231,76,60,.2);margin-bottom:.75rem;}

        /* Music panel */
        .music-panel{border:1px solid var(--border);border-radius:6px;padding:.85rem;margin-bottom:.85rem;}
        .music-panel-title{font-family:var(--mono);font-size:.73rem;color:var(--muted);margin-bottom:.6rem;}
        .music-tabs{display:flex;gap:.4rem;flex-wrap:wrap;}
        .music-tab{padding:.28rem .65rem;font-family:var(--mono);font-size:.72rem;cursor:pointer;border-radius:3px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);transition:all .15s;}
        .music-tab.active{background:var(--accent);color:#fff;border-color:var(--accent);}

        /* Track list */
        .track-list{display:flex;flex-direction:column;gap:.35rem;margin-top:.6rem;}
        .track-item{display:flex;align-items:center;gap:.35rem;}
        .track-select{flex:1;display:flex;align-items:center;gap:.6rem;padding:.45rem .65rem;border-radius:4px;cursor:pointer;text-align:left;border:1px solid var(--border);background:var(--bg);transition:all .15s;}
        .track-item.selected .track-select{background:rgba(192,57,43,.08);border-color:var(--accent);}
        .track-select:hover{border-color:var(--accent);}
        .track-emoji{font-size:1.2rem;flex-shrink:0;}
        .track-info{flex:1;}
        .track-name{font-family:var(--mono);font-size:.78rem;color:var(--text);}
        .track-check{color:var(--accent);font-size:.85rem;flex-shrink:0;}
        .track-preview{background:var(--surface2);border:1px solid var(--border);border-radius:3px;padding:.3rem .5rem;cursor:pointer;font-size:.8rem;color:var(--muted);transition:all .15s;flex-shrink:0;}
        .track-preview:hover,.track-preview.playing{background:var(--accent);color:#fff;border-color:var(--accent);}
      `}</style>
    </main>
  )
}
