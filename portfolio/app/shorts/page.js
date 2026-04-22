'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

function resizeToBase64(file) {
  return new Promise((resolve) => {
    if (file.type === 'image/gif') {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target.result)
      reader.readAsDataURL(file); return
    }
    const img = new Image(), url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 1080; let w = img.width, h = img.height
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX }
        else { w = Math.round(w * MAX / h); h = MAX }
      }
      const c = document.createElement('canvas'); c.width = w; c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.85))
    }; img.src = url
  })
}

const POPULAR_TRACKS = [
  { name: 'Lofi Hip Hop', genre: '🎵 Lo-fi', url: 'https://cdn.pixabay.com/audio/2024/02/15/audio_62e4a7a4c9.mp3' },
  { name: 'Chill Vibes', genre: '🌊 Chill', url: 'https://cdn.pixabay.com/audio/2023/10/30/audio_7be2dc4d21.mp3' },
  { name: 'Upbeat Pop', genre: '⚡ Pop', url: 'https://cdn.pixabay.com/audio/2023/07/26/audio_8e8d9a5b1a.mp3' },
  { name: 'Cinematic', genre: '🎬 Cinematic', url: 'https://cdn.pixabay.com/audio/2022/10/25/audio_946b0939f2.mp3' },
  { name: 'Acoustic Guitar', genre: '🎸 Acoustic', url: 'https://cdn.pixabay.com/audio/2024/01/14/audio_c257d5d36a.mp3' },
  { name: 'Electronic', genre: '💿 Electronic', url: 'https://cdn.pixabay.com/audio/2023/05/15/audio_4a8e2e3a1b.mp3' },
]

export default function ShortsPage() {
  const [user,         setUser]         = useState(null)
  const [shorts,       setShorts]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [current,      setCurrent]      = useState(0)
  const [muted,        setMuted]        = useState(true)
  const [showUpload,   setShowUpload]   = useState(false)
  const [heartPos,     setHeartPos]     = useState(null)  // {idx, x, y}

  // upload
  const [uploadType,   setUploadType]   = useState('video')
  const [videoFile,    setVideoFile]    = useState(null)
  const [videoPreview, setVideoPreview] = useState(null)
  const [imageFile,    setImageFile]    = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [title,        setTitle]        = useState('')
  const [desc,         setDesc]         = useState('')
  const [uploading,    setUploading]    = useState(false)
  const [uploadProg,   setUploadProg]   = useState('')
  const [uploadErr,    setUploadErr]    = useState('')

  // music
  const [musicMode,    setMusicMode]    = useState('none') // 'none' | 'file' | 'popular'
  const [audioFile,    setAudioFile]    = useState(null)
  const [audioName,    setAudioName]    = useState('')
  const [audioUploading, setAudioUploading] = useState(false)
  const [selectedTrack, setSelectedTrack] = useState(null) // { name, url }

  const containerRef  = useRef(null)
  const videoFileRef  = useRef(null)
  const imageFileRef  = useRef(null)
  const audioFileRef  = useRef(null)
  const videoRefs     = useRef({})
  const audioRefs     = useRef({})
  const touchStart    = useRef(null)
  const lastTap       = useRef({})

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (u) setUser(JSON.parse(u))
    loadShorts()
  }, [])

  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([idx, el]) => {
      if (!el) return
      const i = parseInt(idx)
      if (i === current) {
        el.muted = muted
        el.play().catch(() => {})
        // audio sync
        const audio = audioRefs.current[i]
        if (audio) {
          if (!muted) { audio.currentTime = 0; audio.play().catch(() => {}) }
          el.onplay  = () => { if (!muted) audio.play().catch(() => {}) }
          el.onpause = () => audio.pause()
        }
        if (shorts[i]) {
          fetch(`/api/shorts/${shorts[i].id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'view', userId: user?.id || 'anon' }),
          }).catch(() => {})
        }
      } else {
        el.onplay = null; el.onpause = null
        el.pause(); el.currentTime = 0
        const audio = audioRefs.current[i]
        if (audio) { audio.pause(); audio.currentTime = 0 }
      }
    })
  }, [current, shorts, muted])

  const loadShorts = async () => {
    setLoading(true)
    const res = await fetch('/api/shorts')
    const data = await res.json()
    setShorts(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  const goTo = (idx) => {
    if (idx < 0 || idx >= shorts.length) return
    setCurrent(idx)
    containerRef.current?.children[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const onWheel = (e) => { e.preventDefault(); if (e.deltaY > 30) goTo(current+1); else if (e.deltaY < -30) goTo(current-1) }
  const onTouchStart = (e) => { touchStart.current = e.touches[0].clientY }
  const onTouchEnd = (e) => {
    if (touchStart.current === null) return
    const dy = touchStart.current - e.changedTouches[0].clientY
    if (dy > 50) goTo(current+1); else if (dy < -50) goTo(current-1)
    touchStart.current = null
  }

  const handleDoubleTap = (idx, shortId, e) => {
    const now = Date.now()
    if (now - (lastTap.current[idx]||0) < 320) {
      // double tap!
      const rect = e.currentTarget.getBoundingClientRect()
      const x = ((e.changedTouches?.[0]?.clientX || e.clientX) - rect.left)
      const y = ((e.changedTouches?.[0]?.clientY || e.clientY) - rect.top)
      setHeartPos({ idx, x, y })
      setTimeout(() => setHeartPos(null), 900)
      handleLike(shortId, idx)
    } else {
      // single tap
      const el = videoRefs.current[idx]
      if (!el) return
      if (muted) {
        setMuted(false); el.muted = false; el.play().catch(() => {})
        const audio = audioRefs.current[idx]
        if (audio) { audio.currentTime = 0; audio.play().catch(() => {}) }
      } else {
        el.paused ? el.play() : el.pause()
      }
    }
    lastTap.current[idx] = now
  }

  const toggleMute = () => {
    const nm = !muted; setMuted(nm)
    const el = videoRefs.current[current]; if (el) el.muted = nm
    const audio = audioRefs.current[current]
    if (audio) { if (nm) audio.pause(); else { audio.currentTime = videoRefs.current[current]?.currentTime || 0; audio.play().catch(() => {}) } }
  }

  const handleLike = async (shortId, idx) => {
    if (!user) { alert('로그인이 필요합니다'); return }
    const res = await fetch(`/api/shorts/${shortId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'like', userId: user.id }),
    })
    const data = await res.json()
    setShorts(prev => prev.map((s,i) => i===idx ? {...s, likes: data.likes, likedBy: {...(s.likedBy||{}), [user.id]: data.liked||undefined}} : s))
  }

  const handleDelete = async (shortId) => {
    if (!user || !confirm('쇼츠를 삭제하시겠습니까?')) return
    await fetch(`/api/shorts/${shortId}`, { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({userId:user.id,role:user.role}) })
    loadShorts(); setCurrent(0)
  }

  const resetForm = () => {
    setVideoFile(null); setVideoPreview(null); setImageFile(null); setImagePreview(null)
    setTitle(''); setDesc(''); setUploadErr(''); setUploadProg('')
    setMusicMode('none'); setAudioFile(null); setAudioName(''); setSelectedTrack(null)
    if (videoFileRef.current) videoFileRef.current.value = ''
    if (imageFileRef.current) imageFileRef.current.value = ''
    if (audioFileRef.current) audioFileRef.current.value = ''
  }

  const onAudioSelect = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 15 * 1024 * 1024) { alert('15MB 이하만 가능합니다'); return }
    setAudioFile(file); setAudioName(file.name)
    setSelectedTrack(null)
  }

  const handleUpload = async () => {
    if (!user) { alert('로그인이 필요합니다'); return }
    if (uploadType==='video' && !videoFile) { alert('영상을 선택해주세요'); return }
    if (uploadType==='image' && !imageFile) { alert('이미지를 선택해주세요'); return }

    setUploading(true); setUploadProg('미디어 업로드 중...'); setUploadErr('')

    try {
      let mediaUrl = null, mediaType = uploadType
      if (uploadType === 'video') {
        const fd = new FormData(); fd.append('file', videoFile)
        const r = await fetch('/api/upload-video', { method: 'POST', body: fd })
        const d = await r.json()
        if (!r.ok || !d.url) { setUploadErr(d.error||'영상 업로드 실패'); setUploading(false); setUploadProg(''); return }
        mediaUrl = d.url
      } else {
        setUploadProg('이미지 처리 중...')
        mediaUrl = await resizeToBase64(imageFile)
      }

      // audio upload
      let audioUrl = null, audioTitle = null
      if (musicMode === 'file' && audioFile) {
        setUploadProg('오디오 업로드 중...')
        const afd = new FormData(); afd.append('file', audioFile)
        const ar = await fetch('/api/upload-audio', { method: 'POST', body: afd })
        const ad = await ar.json()
        if (ar.ok && ad.url) { audioUrl = ad.url; audioTitle = audioName }
      } else if (musicMode === 'popular' && selectedTrack) {
        audioUrl = selectedTrack.url; audioTitle = selectedTrack.name
      }

      setUploadProg('쇼츠 등록 중...')
      const saveRes = await fetch('/api/shorts', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          authorId: user.id, authorName: user.name, authorAvatar: user.avatar||null,
          videoUrl: mediaType==='video' ? mediaUrl : null,
          imageUrl: mediaType==='image' ? mediaUrl : null,
          mediaType, audioUrl, audioTitle, title, description: desc,
        }),
      })
      const saveData = await saveRes.json()
      if (!saveRes.ok || saveData.error) { setUploadErr(saveData.error||'등록 실패'); setUploading(false); setUploadProg(''); return }

      resetForm(); setUploading(false); setUploadProg(''); setShowUpload(false)
      setShorts(prev => [{...saveData}, ...prev]); setCurrent(0)
    } catch(e) {
      setUploadErr(`오류: ${e.message||'알 수 없는 오류'}`); setUploading(false); setUploadProg('')
    }
  }

  if (loading) return <main style={{background:'#0a0a0a',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{color:'rgba(255,255,255,0.4)',fontFamily:'monospace'}}>불러오는 중...</span></main>

  return (
    <main style={{background:'#0a0a0a',minHeight:'100vh'}}>
      <div className="shorts-topbar">
        <span style={{fontFamily:'var(--serif)',fontWeight:700,fontSize:'1.1rem',color:'#fff'}}>🎬 쇼츠</span>
        <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
          <button onClick={toggleMute} style={{background:'rgba(255,255,255,0.12)',border:'none',borderRadius:4,color:'#fff',padding:'0.3rem 0.65rem',cursor:'pointer',fontSize:'1rem'}}>
            {muted ? '🔇' : '🔊'}
          </button>
          {user && <button className="shorts-upload-btn" onClick={()=>setShowUpload(true)}>+ 업로드</button>}
          {!user && <Link href="/login" style={{fontFamily:'var(--mono)',fontSize:'0.75rem',color:'rgba(255,255,255,0.5)'}}>로그인 후 업로드</Link>}
        </div>
      </div>

      {shorts.length === 0 ? (
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'calc(100vh - 60px)',color:'rgba(255,255,255,0.4)',gap:'1rem'}}>
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
              const showHeart = heartPos && heartPos.idx === idx
              return (
                <div key={s.id} className="short-item"
                  onClick={e => handleDoubleTap(idx, s.id, e)}
                  onTouchEnd={e => handleDoubleTap(idx, s.id, e)}>

                  {s.mediaType==='image'||s.imageUrl
                    ? <img src={s.imageUrl} alt={s.title||''} style={{width:'100%',height:'100%',objectFit:'cover',cursor:'pointer'}} />
                    : <video ref={el=>{videoRefs.current[idx]=el}} src={s.videoUrl} loop muted={muted} playsInline className="short-video" />
                  }

                  {/* audio element */}
                  {s.audioUrl && <audio ref={el=>{audioRefs.current[idx]=el}} src={s.audioUrl} loop style={{display:'none'}} />}

                  {/* double-tap heart */}
                  {showHeart && (
                    <div style={{position:'absolute',left:heartPos.x-40,top:heartPos.y-40,fontSize:'5rem',pointerEvents:'none',animation:'heart-burst .9s ease forwards',zIndex:20}}>❤️</div>
                  )}

                  {/* music ticker */}
                  {(s.audioUrl||s.audioTitle) && (
                    <div className="music-ticker">
                      <span style={{animation:'ticker-scroll 8s linear infinite',whiteSpace:'nowrap'}}>
                        🎵 {s.audioTitle || '음악 재생 중'} &nbsp;&nbsp;&nbsp; 🎵 {s.audioTitle || '음악 재생 중'} &nbsp;&nbsp;&nbsp;
                      </span>
                    </div>
                  )}

                  <div className="short-actions" onClick={e=>e.stopPropagation()}>
                    <Link href={`/profile/${s.authorId}`}>
                      {s.authorAvatar
                        ? <img src={s.authorAvatar} alt="" style={{width:42,height:42,borderRadius:'50%',objectFit:'cover',border:'2px solid #fff',display:'block'}} />
                        : <div style={{width:42,height:42,borderRadius:'50%',background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontFamily:'var(--serif)',fontWeight:700,border:'2px solid #fff'}}>{(s.authorName||'?')[0].toUpperCase()}</div>
                      }
                    </Link>
                    <button className={`short-action-btn ${liked?'liked':''}`} onClick={()=>handleLike(s.id,idx)}>
                      <span style={{fontSize:'1.6rem',display:'inline-block',transition:'transform .2s'}}>{liked?'❤️':'🤍'}</span>
                      <span>{s.likes||0}</span>
                    </button>
                    <div className="short-action-btn">
                      <span style={{fontSize:'1.4rem'}}>👁</span>
                      <span>{s.views||0}</span>
                    </div>
                    {isMine && <button className="short-action-btn" onClick={()=>handleDelete(s.id)}><span style={{fontSize:'1.3rem'}}>🗑</span></button>}
                  </div>

                  <div className="short-info" onClick={e=>e.stopPropagation()}>
                    <Link href={`/profile/${s.authorId}`} className="short-author">@{s.authorName}</Link>
                    {s.title && <p className="short-title">{s.title}</p>}
                    {s.description && <p className="short-desc">{s.description}</p>}
                  </div>
                  <div className="short-page-ind">{idx+1} / {shorts.length}</div>
                </div>
              )
            })}
          </div>
          <div className="short-scroll-btns">
            <button onClick={()=>goTo(current-1)} disabled={current===0}>↑</button>
            <button onClick={()=>goTo(current+1)} disabled={current>=shorts.length-1}>↓</button>
          </div>
        </>
      )}

      {/* 업로드 모달 */}
      {showUpload && (
        <div className="sv-overlay" onClick={()=>!uploading&&(setShowUpload(false),resetForm())}>
          <div className="upload-modal" onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
              <h3 style={{fontFamily:'var(--serif)',fontSize:'1.1rem',color:'var(--ink)'}}>🎬 쇼츠 업로드</h3>
              <button style={{background:'none',border:'none',fontSize:'1.1rem',cursor:'pointer',color:'var(--muted)'}} onClick={()=>!uploading&&(setShowUpload(false),resetForm())}>✕</button>
            </div>

            {/* 타입 탭 */}
            <div style={{display:'flex',gap:'0.5rem',marginBottom:'1rem'}}>
              {[['video','🎬 영상'],['image','🖼 사진']].map(([t,l])=>(
                <button key={t} onClick={()=>setUploadType(t)}
                  style={{flex:1,padding:'0.5rem',fontFamily:'var(--mono)',fontSize:'0.78rem',cursor:'pointer',borderRadius:2,
                    background:uploadType===t?'var(--accent)':'var(--surface2)',
                    color:uploadType===t?'#fff':'var(--muted)',
                    border:uploadType===t?'1px solid var(--accent)':'1px solid var(--border)'}}>
                  {l}
                </button>
              ))}
            </div>

            {/* 영상 선택 */}
            {uploadType==='video' && (
              videoPreview
                ? <><video src={videoPreview} controls className="upload-preview"/>
                    <button style={{fontFamily:'var(--mono)',fontSize:'0.72rem',color:'var(--accent)',background:'none',border:'none',cursor:'pointer',marginTop:'0.4rem'}} onClick={()=>{setVideoFile(null);setVideoPreview(null)}}>다시 선택</button></>
                : <div className="upload-dropzone" onClick={()=>videoFileRef.current?.click()}>
                    <div style={{fontSize:'2rem',marginBottom:'0.4rem'}}>🎬</div>
                    <p style={{fontFamily:'var(--mono)',fontSize:'0.8rem',color:'var(--muted)'}}>클릭하여 영상 선택</p>
                    <p style={{fontFamily:'var(--mono)',fontSize:'0.68rem',color:'var(--border-dark)',marginTop:'0.3rem'}}>mp4 · mov · webm · 크기 제한 없음</p>
                  </div>
            )}
            <input ref={videoFileRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f){setUploadErr('');setVideoFile(f);setVideoPreview(URL.createObjectURL(f))}}} />

            {/* 이미지 선택 */}
            {uploadType==='image' && (
              imagePreview
                ? <><img src={imagePreview} alt="" style={{width:'100%',borderRadius:8,maxHeight:260,objectFit:'contain',background:'#000'}}/>
                    <button style={{fontFamily:'var(--mono)',fontSize:'0.72rem',color:'var(--accent)',background:'none',border:'none',cursor:'pointer',marginTop:'0.4rem'}} onClick={()=>{setImageFile(null);setImagePreview(null)}}>다시 선택</button></>
                : <div className="upload-dropzone" onClick={()=>imageFileRef.current?.click()}>
                    <div style={{fontSize:'2rem',marginBottom:'0.4rem'}}>🖼</div>
                    <p style={{fontFamily:'var(--mono)',fontSize:'0.8rem',color:'var(--muted)'}}>클릭하여 사진 선택</p>
                    <p style={{fontFamily:'var(--mono)',fontSize:'0.68rem',color:'var(--border-dark)',marginTop:'0.3rem'}}>JPG · PNG · GIF · WEBP</p>
                  </div>
            )}
            <input ref={imageFileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f){setUploadErr('');setImageFile(f);setImagePreview(URL.createObjectURL(f))}}} />

            <div className="form-group" style={{marginTop:'0.9rem'}}>
              <label>제목 <span style={{color:'var(--muted)',fontWeight:300}}>(선택)</span></label>
              <input placeholder="쇼츠 제목" value={title} onChange={e=>setTitle(e.target.value)} maxLength={60} />
            </div>
            <div className="form-group">
              <label>설명 <span style={{color:'var(--muted)',fontWeight:300}}>(선택)</span></label>
              <textarea style={{width:'100%',background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'2px',padding:'.5rem .75rem',color:'var(--text)',fontFamily:'var(--font)',fontSize:'.875rem',resize:'none',outline:'none'}}
                rows={2} placeholder="간단한 설명" value={desc} onChange={e=>setDesc(e.target.value)} maxLength={150}/>
            </div>

            {/* 음악 섹션 */}
            <div style={{border:'1px solid var(--border)',borderRadius:6,padding:'0.9rem',marginBottom:'0.75rem'}}>
              <div style={{fontFamily:'var(--mono)',fontSize:'0.75rem',color:'var(--muted)',marginBottom:'0.65rem'}}>🎵 배경음악</div>
              <div style={{display:'flex',gap:'0.4rem',marginBottom:'0.75rem',flexWrap:'wrap'}}>
                {[['none','없음'],['file','파일 업로드'],['popular','추천 음악']].map(([m,l])=>(
                  <button key={m} onClick={()=>setMusicMode(m)}
                    style={{padding:'0.3rem 0.65rem',fontFamily:'var(--mono)',fontSize:'0.72rem',cursor:'pointer',borderRadius:3,
                      background:musicMode===m?'var(--accent)':'var(--surface2)',
                      color:musicMode===m?'#fff':'var(--muted)',
                      border:musicMode===m?'1px solid var(--accent)':'1px solid var(--border)'}}>
                    {l}
                  </button>
                ))}
              </div>

              {musicMode==='file' && (
                <div>
                  <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
                    <button className="btn btn-sm" onClick={()=>audioFileRef.current?.click()} disabled={audioUploading}>
                      {audioName ? `✓ ${audioName.slice(0,20)}${audioName.length>20?'...':''}` : '파일 선택'}
                    </button>
                    {audioName && <button style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:'0.8rem'}} onClick={()=>{setAudioFile(null);setAudioName('')}}>✕</button>}
                  </div>
                  <p style={{fontFamily:'var(--mono)',fontSize:'0.65rem',color:'var(--border-dark)',marginTop:'0.35rem'}}>mp3 · wav · ogg · 최대 15MB</p>
                  <input ref={audioFileRef} type="file" accept="audio/*" style={{display:'none'}} onChange={onAudioSelect}/>
                </div>
              )}

              {musicMode==='popular' && (
                <div style={{display:'flex',flexDirection:'column',gap:'0.4rem'}}>
                  {POPULAR_TRACKS.map((track,i)=>(
                    <button key={i} onClick={()=>setSelectedTrack(selectedTrack?.name===track.name?null:track)}
                      style={{display:'flex',alignItems:'center',gap:'0.6rem',padding:'0.5rem 0.7rem',borderRadius:4,cursor:'pointer',
                        background:selectedTrack?.name===track.name?'rgba(192,57,43,0.1)':'var(--bg)',
                        border:selectedTrack?.name===track.name?'1px solid var(--accent)':'1px solid var(--border)',
                        textAlign:'left'}}>
                      <span style={{fontSize:'1.1rem'}}>{track.genre.split(' ')[0]}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontFamily:'var(--mono)',fontSize:'0.78rem',color:'var(--text)',fontWeight:selectedTrack?.name===track.name?600:400}}>{track.name}</div>
                        <div style={{fontFamily:'var(--mono)',fontSize:'0.65rem',color:'var(--muted)'}}>{track.genre}</div>
                      </div>
                      {selectedTrack?.name===track.name && <span style={{color:'var(--accent)',fontSize:'0.8rem'}}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {uploadProg && <p style={{fontFamily:'var(--mono)',fontSize:'0.78rem',color:'var(--accent)',marginBottom:'0.5rem'}}>⏳ {uploadProg}</p>}
            {uploadErr  && <p style={{fontFamily:'var(--mono)',fontSize:'0.78rem',color:'#e74c3c',marginBottom:'0.5rem',padding:'0.5rem',background:'rgba(231,76,60,0.08)',borderRadius:4,border:'1px solid rgba(231,76,60,0.2)'}}>⚠ {uploadErr}</p>}

            <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',marginTop:'0.25rem'}}
              onClick={handleUpload} disabled={uploading||(uploadType==='video'?!videoFile:!imageFile)}>
              {uploading ? '업로드 중...' : '🎬 업로드'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .shorts-topbar{position:fixed;top:60px;left:0;right:0;height:50px;background:rgba(10,10,10,.92);display:flex;align-items:center;justify-content:space-between;padding:0 1.5rem;z-index:200;border-bottom:1px solid rgba(255,255,255,.08);}
        .shorts-upload-btn{background:var(--accent);color:#fff;border:none;padding:.35rem .9rem;border-radius:4px;font-size:.8rem;font-family:var(--mono);cursor:pointer;}
        .shorts-feed{height:calc(100vh - 110px);overflow:hidden;margin-top:50px;}
        .short-item{width:100%;height:calc(100vh - 110px);position:relative;display:flex;align-items:center;justify-content:center;background:#000;overflow:hidden;}
        .short-video{width:100%;height:100%;object-fit:cover;cursor:pointer;}
        .short-actions{position:absolute;right:1rem;bottom:6rem;display:flex;flex-direction:column;gap:1.5rem;align-items:center;z-index:5;}
        .short-action-btn{display:flex;flex-direction:column;align-items:center;gap:.2rem;background:none;border:none;color:#fff;cursor:pointer;font-family:var(--mono);font-size:.7rem;text-shadow:0 1px 3px rgba(0,0,0,.8);}
        .short-info{position:absolute;left:1rem;bottom:1.5rem;right:5.5rem;z-index:5;}
        .short-author{color:#fff;font-family:var(--mono);font-size:.82rem;font-weight:500;text-decoration:none;text-shadow:0 1px 3px rgba(0,0,0,.8);}
        .short-title{color:#fff;font-family:var(--serif);font-size:.95rem;font-weight:700;margin-top:.3rem;text-shadow:0 1px 3px rgba(0,0,0,.8);}
        .short-desc{color:rgba(255,255,255,.75);font-size:.8rem;margin-top:.2rem;line-height:1.5;}
        .short-page-ind{position:absolute;top:.75rem;right:.75rem;font-family:var(--mono);font-size:.65rem;color:rgba(255,255,255,.4);background:rgba(0,0,0,.4);padding:.15rem .45rem;border-radius:10px;z-index:5;}
        .music-ticker{position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.55);padding:.35rem 1rem;overflow:hidden;font-family:var(--mono);font-size:.68rem;color:#fff;backdrop-filter:blur(4px);z-index:5;}
        @keyframes ticker-scroll{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}
        .short-scroll-btns{position:fixed;right:1.5rem;bottom:6rem;display:flex;flex-direction:column;gap:.5rem;z-index:300;}
        .short-scroll-btns button{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#fff;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;}
        .short-scroll-btns button:disabled{opacity:.25;cursor:not-allowed;}
        @keyframes heart-burst{0%{opacity:0;transform:scale(0.3)}30%{opacity:1;transform:scale(1.4)}70%{opacity:1;transform:scale(1.1)}100%{opacity:0;transform:scale(1.3)}}
        @keyframes like-pop{0%{transform:scale(1)}50%{transform:scale(1.5)}100%{transform:scale(1)}}
        .upload-modal{background:var(--surface);border-radius:12px;width:min(460px,92vw);max-height:88vh;overflow-y:auto;padding:1.5rem;box-shadow:0 20px 60px rgba(0,0,0,.5);}
        .upload-preview{width:100%;border-radius:8px;max-height:220px;object-fit:contain;background:#000;}
        .upload-dropzone{border:2px dashed var(--border);border-radius:8px;padding:2rem;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:border-color .2s;}
        .upload-dropzone:hover{border-color:var(--accent);}
        .sv-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:8000;display:flex;align-items:center;justify-content:center;}
      `}</style>
    </main>
  )
}
