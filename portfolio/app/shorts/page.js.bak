'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { upload } from '@vercel/blob/client'

const POPULAR_TRACKS = [
  { name: 'Lofi Study',   emoji: '📚', url: 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3' },
  { name: 'Chill Beats',  emoji: '🌊', url: 'https://assets.mixkit.co/music/preview/mixkit-hip-hop-02-738.mp3' },
  { name: 'Upbeat Pop',   emoji: '⚡', url: 'https://assets.mixkit.co/music/preview/mixkit-driving-ambition-32.mp3' },
  { name: 'Cinematic',    emoji: '🎬', url: 'https://assets.mixkit.co/music/preview/mixkit-life-is-a-dream-837.mp3' },
  { name: 'Acoustic',     emoji: '🎸', url: 'https://assets.mixkit.co/music/preview/mixkit-guitar-reflections-599.mp3' },
  { name: 'Electronic',   emoji: '💿', url: 'https://assets.mixkit.co/music/preview/mixkit-beautiful-dream-493.mp3' },
]

export default function ShortsPage() {
  const [user,          setUser]          = useState(null)
  const [shorts,        setShorts]        = useState([])
  const [loading,       setLoading]       = useState(true)
  const [current,       setCurrent]       = useState(0)
  const [muted,         setMuted]         = useState(false)
  const [showUpload,    setShowUpload]    = useState(false)
  const [heartPos,      setHeartPos]      = useState(null)

  // 댓글 패널 (PC)
  const [showComments,  setShowComments]  = useState(false)
  const [comments,      setComments]      = useState([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentText,   setCommentText]   = useState('')
  const [commentShortId, setCommentShortId] = useState(null)
  const commentInputRef = useRef(null)

  // upload state
  const [videoFile,     setVideoFile]     = useState(null)
  const [videoPreview,  setVideoPreview]  = useState(null)
  const [title,         setTitle]         = useState('')
  const [desc,          setDesc]          = useState('')
  const [uploading,     setUploading]     = useState(false)
  const [uploadProg,    setUploadProg]    = useState(0)
  const [uploadMsg,     setUploadMsg]     = useState('')
  const [uploadErr,     setUploadErr]     = useState('')
  const [musicMode,     setMusicMode]     = useState('none')
  const [audioFile,     setAudioFile]     = useState(null)
  const [audioName,     setAudioName]     = useState('')
  const [selectedTrack, setSelectedTrack] = useState(null)
  const [previewTrack,  setPreviewTrack]  = useState(null)

  const containerRef = useRef(null)
  const videoFileRef = useRef(null)
  const audioFileRef = useRef(null)
  const videoRefs    = useRef({})
  const audioElRef   = useRef(null)
  const touchStart   = useRef(null)
  const lastTap      = useRef({})
  const previewAudio = useRef(null)
  const commentsEndRef = useRef(null)

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
        el.volume = shorts[i]?.audioUrl ? 0.3 : 1
        el.play().catch(() => {})
        if (shorts[i]) fetch(`/api/shorts/${shorts[i].id}`, {
          method:'PATCH', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ action:'view', userId: user?.id || 'anon' }),
        }).catch(() => {})
      } else { el.pause(); el.currentTime = 0 }
    })
    if (audioElRef.current) { audioElRef.current.pause(); audioElRef.current.src = '' }
    const s = shorts[current]
    if (s?.audioUrl && !muted) {
      const a = new Audio(s.audioUrl); a.loop = true; a.volume = 0.7
      a.play().catch(() => {}); audioElRef.current = a
    }
    return () => { if (audioElRef.current) audioElRef.current.pause() }
  }, [current, shorts])

  useEffect(() => {
    Object.values(videoRefs.current).forEach(el => { if (el) el.volume = muted ? 0 : (shorts[current]?.audioUrl ? 0.3 : 1) })
    if (audioElRef.current) audioElRef.current.volume = muted ? 0 : 0.7
  }, [muted])

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
    // 댓글 패널 열려 있으면 새 쇼츠 댓글 로드
    if (showComments && shorts[idx]) openComments(shorts[idx].id)
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
      const rect = e.currentTarget.getBoundingClientRect()
      const x = (e.changedTouches?.[0]?.clientX || e.clientX) - rect.left
      const y = (e.changedTouches?.[0]?.clientY || e.clientY) - rect.top
      setHeartPos({ idx, x, y }); setTimeout(() => setHeartPos(null), 900)
      handleLike(shortId, idx)
    }
    lastTap.current[idx] = now
  }

  const handleLike = async (shortId, idx) => {
    if (!user) return
    const res = await fetch(`/api/shorts/${shortId}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'like', userId:user.id }),
    })
    const data = await res.json()
    setShorts(prev => prev.map((s,i) => i===idx ? {...s, likes:data.likes, likedBy:{...(s.likedBy||{}), [user.id]:data.liked||undefined}} : s))
  }

  const handleDelete = async (shortId) => {
    if (!user || !confirm('쇼츠를 삭제할까요?')) return
    await fetch(`/api/shorts/${shortId}`, { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:user.id,role:user.role}) })
    loadShorts(); setCurrent(0); setShowComments(false)
  }

  // ── 댓글 ──
  const openComments = async (shortId) => {
    setCommentShortId(shortId)
    setShowComments(true)
    setCommentsLoading(true)
    const res = await fetch(`/api/shorts/${shortId}/comments`)
    const data = await res.json()
    setComments(Array.isArray(data) ? data : [])
    setCommentsLoading(false)
    setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior:'smooth' }), 100)
  }

  const closeComments = () => { setShowComments(false); setCommentText('') }

  const submitComment = async () => {
    if (!user || !commentText.trim() || !commentShortId) return
    const res = await fetch(`/api/shorts/${commentShortId}/comments`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ userId:user.id, userName:user.name, userAvatar:user.avatar||null, text:commentText }),
    })
    const data = await res.json()
    if (data.id) {
      setComments(prev => [...prev, data])
      setCommentText('')
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior:'smooth' }), 100)
    }
  }

  const deleteComment = async (commentId) => {
    if (!user || !commentShortId) return
    await fetch(`/api/shorts/${commentShortId}/comments?commentId=${commentId}&userId=${user.id}&role=${user.role}`, { method:'DELETE' })
    setComments(prev => prev.filter(c => c.id !== commentId))
  }

  // ── 음악 미리듣기 ──
  const previewMusic = (track) => {
    if (previewAudio.current) { previewAudio.current.pause(); previewAudio.current = null }
    if (previewTrack?.name === track.name) { setPreviewTrack(null); return }
    const a = new Audio(track.url); a.volume = 0.5; a.play().catch(() => {})
    previewAudio.current = a; setPreviewTrack(track)
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
      const ext  = videoFile.name.split('.').pop().toLowerCase()
      const path = `shorts/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const blob = await upload(path, videoFile, {
        access:'public', handleUploadUrl:'/api/upload-video',
        onUploadProgress: ({ percentage }) => { setUploadProg(Math.round(percentage)); setUploadMsg(`영상 업로드 중... ${Math.round(percentage)}%`) },
      })
      if (!blob?.url) { setUploadErr('영상 업로드 실패'); setUploading(false); return }

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

      setUploadMsg('등록 중...')
      const saveRes = await fetch('/api/shorts', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ authorId:user.id, authorName:user.name, authorAvatar:user.avatar||null, videoUrl:blob.url, audioUrl, audioTitle, title, description:desc }),
      })
      const saveData = await saveRes.json()
      if (!saveRes.ok || saveData.error) { setUploadErr(saveData.error||'등록 실패'); setUploading(false); return }
      resetForm(); setUploading(false); setShowUpload(false)
      setShorts(prev => [saveData, ...prev]); setCurrent(0)
    } catch(e) { setUploadErr(`오류: ${e.message||'알 수 없는 오류'}`); setUploading(false) }
  }

  const currentShort = shorts[current]
  const commentCount = comments.length

  if (loading) return (
    <main className="shorts-bg">
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'calc(100vh - 60px)',color:'rgba(255,255,255,0.35)',fontFamily:'monospace'}}>
        로딩 중...
      </div>
    </main>
  )

  return (
    <main className="shorts-bg">
      {/* ── PC 레이아웃: 영상 + 댓글 사이드 ── */}
      <div className="shorts-layout">

        {/* 왼쪽: 피드 영역 */}
        <div className={`shorts-video-col ${showComments ? 'has-panel' : ''}`}>
          {/* topbar */}
          <div className="shorts-topbar">
            <span className="shorts-topbar-title">🎬 쇼츠</span>
            <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
              <button onClick={()=>setMuted(m=>!m)} className="shorts-icon-btn" title={muted?'소리 켜기':'음소거'}>
                {muted ? '🔇' : '🔊'}
              </button>
              {user
                ? <button className="shorts-upload-btn" onClick={()=>setShowUpload(true)}>+ 업로드</button>
                : <Link href="/login" className="shorts-login-link">로그인 후 업로드</Link>
              }
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
                {shorts.map((s, idx) => {
                  const liked = user && !!(s.likedBy||{})[user.id]
                  const isMine = user && (user.id===s.authorId||user.role==='admin')
                  const showHeart = heartPos?.idx === idx
                  return (
                    <div key={s.id} className={`short-item ${idx === current ? 'active' : ''}`}
                      onClick={e=>handleTap(idx,s.id,e)}
                      onTouchEnd={e=>handleTap(idx,s.id,e)}>
                      <video ref={el=>{videoRefs.current[idx]=el}} src={s.videoUrl} loop playsInline className="short-video"/>
                      {showHeart && <div className="heart-burst" style={{left:heartPos.x-40,top:heartPos.y-40}}>❤️</div>}
                      {s.audioTitle && (
                        <div className="music-ticker">
                          <span className="ticker-text">🎵 {s.audioTitle} &nbsp;&nbsp; 🎵 {s.audioTitle} &nbsp;&nbsp;</span>
                        </div>
                      )}

                      {/* 우측 액션 버튼들 */}
                      <div className="short-actions" onClick={e=>e.stopPropagation()}>
                        <Link href={`/profile/${s.authorId}`} className="short-av-wrap">
                          {s.authorAvatar
                            ? <img src={s.authorAvatar} alt="" className="short-av-img"/>
                            : <div className="short-av-ph">{(s.authorName||'?')[0].toUpperCase()}</div>
                          }
                        </Link>
                        <button className="short-act-btn" onClick={()=>handleLike(s.id,idx)}>
                          <span className={`act-icon like-heart ${liked?'liked':''}`}>{liked?'❤️':'🤍'}</span>
                          <span className="act-count">{s.likes||0}</span>
                        </button>
                        <button className="short-act-btn" onClick={e=>{e.stopPropagation();openComments(s.id)}}>
                          <span className="act-icon">💬</span>
                          <span className="act-count">{s.commentCount||0}</span>
                        </button>
                        <div className="short-act-btn">
                          <span className="act-icon">👁</span>
                          <span className="act-count">{s.views||0}</span>
                        </div>
                        {isMine && (
                          <button className="short-act-btn" onClick={()=>handleDelete(s.id)}>
                            <span className="act-icon">🗑</span>
                          </button>
                        )}
                      </div>

                      {/* 하단 정보 */}
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

              {/* 위아래 내비 */}
              <div className="short-nav">
                <button onClick={()=>goTo(current-1)} disabled={current===0} className="short-nav-btn">↑</button>
                <button onClick={()=>goTo(current+1)} disabled={current>=shorts.length-1} className="short-nav-btn">↓</button>
              </div>
            </>
          )}
        </div>

        {/* 오른쪽: 댓글 패널 (PC에서만 보임) */}
        {showComments && currentShort && (
          <div className="comments-panel">
            <div className="comments-panel-header">
              <div>
                <span className="comments-panel-title">댓글</span>
                <span className="comments-count-badge">{comments.length}</span>
              </div>
              <button className="comments-close-btn" onClick={closeComments}>✕</button>
            </div>

            <div className="comments-list">
              {commentsLoading ? (
                <div className="comments-empty">불러오는 중...</div>
              ) : comments.length === 0 ? (
                <div className="comments-empty">첫 댓글을 남겨보세요 💬</div>
              ) : (
                comments.map(c => (
                  <div key={c.id} className="comment-item">
                    <Link href={`/profile/${c.userId}`}>
                      {c.userAvatar
                        ? <img src={c.userAvatar} alt="" className="comment-av"/>
                        : <div className="comment-av-ph">{(c.userName||'?')[0].toUpperCase()}</div>
                      }
                    </Link>
                    <div className="comment-body">
                      <div className="comment-meta">
                        <span className="comment-name">{c.userName}</span>
                        <span className="comment-time">{new Date(c.createdAt).toLocaleDateString('ko-KR')}</span>
                        {user && (user.id===c.userId||user.role==='admin') && (
                          <button className="comment-del" onClick={()=>deleteComment(c.id)}>🗑</button>
                        )}
                      </div>
                      <p className="comment-text">{c.text}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={commentsEndRef}/>
            </div>

            {user ? (
              <div className="comment-input-wrap">
                <img src={user.avatar||''} alt="" className="comment-av" style={{flexShrink:0}}
                  onError={e=>{e.target.style.display='none'}}/>
                {!user.avatar && <div className="comment-av-ph" style={{flexShrink:0}}>{(user.name||'?')[0].toUpperCase()}</div>}
                <div style={{flex:1,display:'flex',gap:'0.5rem'}}>
                  <input
                    ref={commentInputRef}
                    className="comment-input"
                    value={commentText}
                    onChange={e=>setCommentText(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&submitComment()}
                    placeholder="댓글 추가..."
                    maxLength={300}
                  />
                  <button className="comment-send-btn" onClick={submitComment} disabled={!commentText.trim()}>
                    전송
                  </button>
                </div>
              </div>
            ) : (
              <div className="comment-input-wrap" style={{justifyContent:'center'}}>
                <Link href="/login" className="btn btn-primary btn-sm">로그인 후 댓글 작성</Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 모바일 댓글 바텀시트 */}
      {showComments && currentShort && (
        <div className="mobile-comments-overlay" onClick={closeComments}>
          <div className="mobile-comments-sheet" onClick={e=>e.stopPropagation()}>
            <div className="mobile-sheet-handle"/>
            <div className="comments-panel-header" style={{padding:'0.75rem 1rem'}}>
              <div>
                <span className="comments-panel-title">댓글</span>
                <span className="comments-count-badge">{comments.length}</span>
              </div>
              <button className="comments-close-btn" onClick={closeComments}>✕</button>
            </div>
            <div className="comments-list" style={{maxHeight:'40vh'}}>
              {commentsLoading ? (
                <div className="comments-empty">불러오는 중...</div>
              ) : comments.length === 0 ? (
                <div className="comments-empty">첫 댓글을 남겨보세요 💬</div>
              ) : (
                comments.map(c => (
                  <div key={c.id} className="comment-item">
                    <Link href={`/profile/${c.userId}`}>
                      {c.userAvatar
                        ? <img src={c.userAvatar} alt="" className="comment-av"/>
                        : <div className="comment-av-ph">{(c.userName||'?')[0].toUpperCase()}</div>
                      }
                    </Link>
                    <div className="comment-body">
                      <div className="comment-meta">
                        <span className="comment-name">{c.userName}</span>
                        <span className="comment-time">{new Date(c.createdAt).toLocaleDateString('ko-KR')}</span>
                        {user && (user.id===c.userId||user.role==='admin') && (
                          <button className="comment-del" onClick={()=>deleteComment(c.id)}>🗑</button>
                        )}
                      </div>
                      <p className="comment-text">{c.text}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={commentsEndRef}/>
            </div>
            {user ? (
              <div className="comment-input-wrap" style={{borderTop:'1px solid rgba(255,255,255,0.1)',background:'#111'}}>
                <input
                  className="comment-input"
                  value={commentText}
                  onChange={e=>setCommentText(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&submitComment()}
                  placeholder="댓글 추가..."
                  maxLength={300}
                />
                <button className="comment-send-btn" onClick={submitComment} disabled={!commentText.trim()}>전송</button>
              </div>
            ) : (
              <div className="comment-input-wrap" style={{justifyContent:'center',borderTop:'1px solid rgba(255,255,255,0.1)'}}>
                <Link href="/login" className="btn btn-primary btn-sm">로그인 후 댓글 작성</Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 업로드 모달 ── */}
      {showUpload && (
        <div className="modal-overlay" onClick={()=>!uploading&&(setShowUpload(false),resetForm())}>
          <div className="upload-modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h3>🎬 쇼츠 업로드</h3>
              <button className="modal-close" onClick={()=>!uploading&&(setShowUpload(false),resetForm())}>✕</button>
            </div>
            {videoPreview
              ? <><video src={videoPreview} controls className="upload-preview"/>
                  <button className="reselect-btn" onClick={()=>{setVideoFile(null);setVideoPreview(null)}}>다시 선택</button></>
              : <div className="upload-drop" onClick={()=>videoFileRef.current?.click()}>
                  <div style={{fontSize:'2.2rem',marginBottom:'0.5rem'}}>🎬</div>
                  <p style={{fontFamily:'var(--mono)',fontSize:'0.82rem',color:'var(--muted)'}}>클릭하여 영상 선택</p>
                  <p style={{fontFamily:'var(--mono)',fontSize:'0.68rem',color:'var(--border-dark)',marginTop:'0.25rem'}}>mp4 · mov · webm · 크기 제한 없음</p>
                </div>
            }
            <input ref={videoFileRef} type="file" accept="video/*" style={{display:'none'}}
              onChange={e=>{const f=e.target.files?.[0];if(f){setUploadErr('');setVideoFile(f);setVideoPreview(URL.createObjectURL(f))}}}/>
            <div className="form-group" style={{marginTop:'0.9rem'}}>
              <label>제목 <span style={{color:'var(--muted)',fontWeight:300}}>(선택)</span></label>
              <input placeholder="쇼츠 제목" value={title} onChange={e=>setTitle(e.target.value)} maxLength={60}/>
            </div>
            <div className="form-group">
              <label>설명 <span style={{color:'var(--muted)',fontWeight:300}}>(선택)</span></label>
              <textarea className="upload-textarea" rows={2} placeholder="간단한 설명" value={desc} onChange={e=>setDesc(e.target.value)} maxLength={150}/>
            </div>
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
                        <span className="track-name">{track.name}</span>
                        {selectedTrack?.name===track.name && <span className="track-check">✓</span>}
                      </button>
                      <button className={`track-preview ${previewTrack?.name===track.name?'playing':''}`} onClick={()=>previewMusic(track)}>
                        {previewTrack?.name===track.name ? '⏸' : '▶'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
        .shorts-bg { background:#0a0a0a; min-height:100vh; }

        /* ── 전체 레이아웃 ── */
        .shorts-layout {
          display:flex;
          height:calc(100vh - 60px);
          margin-top:60px;
          overflow:hidden;
        }

        /* ── 영상 컬럼 ── */
        .shorts-video-col {
          flex:1;
          display:flex;
          flex-direction:column;
          position:relative;
          transition:flex 0.3s;
        }

        /* ── 탑바 ── */
        .shorts-topbar {
          position:absolute; top:0; left:0; right:0; height:50px;
          background:rgba(10,10,10,.92);
          display:flex; align-items:center; justify-content:space-between;
          padding:0 1.5rem; z-index:200;
          border-bottom:1px solid rgba(255,255,255,.07);
        }
        .shorts-topbar-title { font-family:var(--serif); font-weight:700; font-size:1.1rem; color:#fff; }
        .shorts-upload-btn {
          background:var(--accent); color:#fff; border:none;
          padding:.4rem 1.1rem; border-radius:4px;
          font-size:.85rem; font-family:var(--mono); cursor:pointer;
          font-weight:600;
        }
        .shorts-icon-btn {
          background:rgba(255,255,255,.1); border:none; border-radius:4px;
          color:#fff; padding:.4rem .75rem; cursor:pointer; font-size:1.1rem;
        }
        .shorts-login-link { font-family:var(--mono); font-size:.78rem; color:rgba(255,255,255,.5); text-decoration:none; }

        /* ── 피드 ── */
        .shorts-feed {
          flex:1; margin-top:50px; overflow:hidden; position:relative;
          display:flex; align-items:center; justify-content:center;
        }
        .short-item {
          position:absolute; inset:0;
          display:flex; align-items:center; justify-content:center;
          background:#000; overflow:hidden;
          opacity:0; pointer-events:none;
          transition:opacity 0.25s;
        }
        .short-item.active { opacity:1; pointer-events:all; }

        /* PC: 가운데 폰 비율 박스 */
        @media(min-width:768px){
          .short-item {
            position:relative; inset:auto;
            width:min(380px, calc((100vh - 170px) * 9/16));
            height:calc(100vh - 170px);
            border-radius:16px;
            box-shadow:0 0 80px rgba(0,0,0,.8);
            opacity:1; pointer-events:all;
          }
          .shorts-feed {
            height:calc(100vh - 110px);
          }
        }
        .short-video { width:100%; height:100%; object-fit:cover; display:block; }

        /* ── 우측 액션 버튼 ── */
        .short-actions {
          position:absolute; right:1rem; bottom:5.5rem;
          display:flex; flex-direction:column; gap:1.25rem; align-items:center; z-index:5;
        }
        .short-av-wrap { display:block; }
        .short-av-img {
          width:48px; height:48px; border-radius:50%;
          object-fit:cover; border:2.5px solid #fff; display:block;
        }
        .short-av-ph {
          width:48px; height:48px; border-radius:50%;
          background:var(--accent); display:flex; align-items:center; justify-content:center;
          color:#fff; font-family:var(--serif); font-weight:700; font-size:1.2rem;
          border:2.5px solid #fff;
        }
        .short-act-btn {
          display:flex; flex-direction:column; align-items:center; gap:.25rem;
          background:rgba(0,0,0,.35); backdrop-filter:blur(4px);
          border:none; border-radius:50px; padding:.6rem .55rem;
          color:#fff; cursor:pointer;
          min-width:52px;
        }
        .short-act-btn:hover { background:rgba(255,255,255,.15); }
        .act-icon { font-size:1.8rem; display:inline-block; line-height:1; }
        .act-count {
          font-family:var(--mono); font-size:.72rem; color:#fff;
          text-shadow:0 1px 4px rgba(0,0,0,.9);
        }
        .like-heart.liked { animation:like-pop .3s ease; }

        /* ── 하단 정보 ── */
        .short-info {
          position:absolute; left:1rem; bottom:1.5rem; right:5rem; z-index:5;
        }
        .short-author {
          color:#fff; font-family:var(--mono); font-size:.85rem; font-weight:700;
          text-decoration:none; text-shadow:0 1px 6px rgba(0,0,0,.9); display:block;
        }
        .short-title {
          color:#fff; font-family:var(--serif); font-size:1rem; font-weight:700;
          margin-top:.3rem; text-shadow:0 1px 6px rgba(0,0,0,.9);
        }
        .short-desc {
          color:rgba(255,255,255,.78); font-size:.8rem; margin-top:.15rem;
          line-height:1.5; text-shadow:0 1px 4px rgba(0,0,0,.8);
        }
        .short-idx {
          position:absolute; top:.7rem; right:.7rem; font-family:var(--mono);
          font-size:.62rem; color:rgba(255,255,255,.4);
          background:rgba(0,0,0,.5); padding:.12rem .4rem; border-radius:10px; z-index:5;
        }

        /* ── 음악 ticker ── */
        .music-ticker {
          position:absolute; bottom:0; left:0; right:0;
          background:linear-gradient(transparent,rgba(0,0,0,.6));
          padding:.5rem 1rem .4rem; overflow:hidden; z-index:5;
        }
        .ticker-text {
          display:inline-block; font-family:var(--mono); font-size:.68rem; color:#fff;
          white-space:nowrap; animation:ticker 10s linear infinite;
        }
        @keyframes ticker{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}

        /* ── 하트 ── */
        .heart-burst {
          position:absolute; font-size:5rem; pointer-events:none;
          animation:heart-burst .9s ease forwards; z-index:20;
        }
        @keyframes heart-burst{0%{opacity:0;transform:scale(.3)}30%{opacity:1;transform:scale(1.4)}70%{opacity:1;transform:scale(1.1)}100%{opacity:0;transform:scale(1.3)}}
        @keyframes like-pop{0%{transform:scale(1)}50%{transform:scale(1.5)}100%{transform:scale(1)}}

        /* ── 위아래 내비 ── */
        .short-nav {
          position:absolute; right:1.5rem; bottom:2rem;
          display:flex; flex-direction:column; gap:.5rem; z-index:300;
        }
        @media(min-width:768px){ .short-nav { right:2rem; bottom:2.5rem; } }
        .short-nav-btn {
          width:44px; height:44px; border-radius:50%;
          background:rgba(255,255,255,.13); border:1px solid rgba(255,255,255,.22);
          color:#fff; font-size:1.1rem; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
        }
        .short-nav-btn:disabled { opacity:.2; cursor:not-allowed; }

        /* ── PC 댓글 패널 ── */
        .comments-panel {
          width:400px; flex-shrink:0;
          background:#111; border-left:1px solid rgba(255,255,255,.08);
          display:flex; flex-direction:column;
          height:100%;
        }
        @media(max-width:767px){ .comments-panel { display:none; } }

        .comments-panel-header {
          display:flex; align-items:center; justify-content:space-between;
          padding:1rem 1.25rem; border-bottom:1px solid rgba(255,255,255,.08);
          flex-shrink:0;
        }
        .comments-panel-title {
          font-family:var(--serif); font-size:1rem; font-weight:700; color:#fff;
        }
        .comments-count-badge {
          font-family:var(--mono); font-size:.75rem; color:rgba(255,255,255,.5);
          margin-left:.5rem;
        }
        .comments-close-btn {
          background:rgba(255,255,255,.08); border:none; color:rgba(255,255,255,.6);
          width:30px; height:30px; border-radius:50%; cursor:pointer; font-size:.9rem;
          display:flex; align-items:center; justify-content:center;
        }
        .comments-close-btn:hover { background:rgba(255,255,255,.15); color:#fff; }

        .comments-list {
          flex:1; overflow-y:auto; padding:.75rem 1rem;
          display:flex; flex-direction:column; gap:.75rem;
        }
        .comments-empty {
          color:rgba(255,255,255,.3); font-family:var(--mono); font-size:.8rem;
          text-align:center; padding:2rem 0;
        }
        .comment-item { display:flex; gap:.65rem; align-items:flex-start; }
        .comment-av {
          width:32px; height:32px; border-radius:50%;
          object-fit:cover; flex-shrink:0;
        }
        .comment-av-ph {
          width:32px; height:32px; border-radius:50%;
          background:var(--accent); display:flex; align-items:center; justify-content:center;
          color:#fff; font-size:.85rem; font-weight:700; flex-shrink:0;
        }
        .comment-body { flex:1; min-width:0; }
        .comment-meta {
          display:flex; align-items:center; gap:.5rem; margin-bottom:.2rem;
        }
        .comment-name { font-family:var(--mono); font-size:.78rem; font-weight:700; color:#fff; }
        .comment-time { font-family:var(--mono); font-size:.68rem; color:rgba(255,255,255,.3); }
        .comment-del {
          background:none; border:none; color:rgba(255,255,255,.3);
          cursor:pointer; font-size:.78rem; margin-left:auto; padding:0;
        }
        .comment-del:hover { color:#e74c3c; }
        .comment-text { font-size:.82rem; color:rgba(255,255,255,.85); line-height:1.5; word-break:break-word; }

        .comment-input-wrap {
          display:flex; align-items:center; gap:.6rem;
          padding:.75rem 1rem; border-top:1px solid rgba(255,255,255,.08);
          flex-shrink:0; background:#111;
        }
        .comment-input {
          flex:1; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.1);
          border-radius:20px; padding:.5rem 1rem;
          color:#fff; font-family:var(--mono); font-size:.82rem; outline:none;
        }
        .comment-input:focus { border-color:var(--accent); }
        .comment-input::placeholder { color:rgba(255,255,255,.3); }
        .comment-send-btn {
          background:var(--accent); color:#fff; border:none;
          padding:.5rem .9rem; border-radius:20px;
          font-family:var(--mono); font-size:.78rem; font-weight:700; cursor:pointer;
          flex-shrink:0;
        }
        .comment-send-btn:disabled { opacity:.4; cursor:not-allowed; }

        /* ── 모바일 댓글 바텀시트 ── */
        .mobile-comments-overlay {
          display:none;
          position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:5000;
          align-items:flex-end;
        }
        @media(max-width:767px){ .mobile-comments-overlay { display:flex; } }
        .mobile-comments-sheet {
          width:100%; background:#111; border-radius:20px 20px 0 0;
          padding-bottom:env(safe-area-inset-bottom);
        }
        .mobile-sheet-handle {
          width:40px; height:4px; background:rgba(255,255,255,.2);
          border-radius:2px; margin:10px auto 0;
        }

        /* ── 업로드 모달 ── */
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.8); z-index:8000; display:flex; align-items:center; justify-content:center; padding:1rem; }
        .upload-modal { background:var(--surface); border-radius:12px; width:min(480px,100%); max-height:90vh; overflow-y:auto; padding:1.5rem; box-shadow:0 20px 60px rgba(0,0,0,.6); }
        .modal-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; }
        .modal-header h3 { font-family:var(--serif); font-size:1.1rem; color:var(--ink); }
        .modal-close { background:none; border:none; font-size:1.1rem; cursor:pointer; color:var(--muted); padding:.2rem .4rem; }
        .upload-preview { width:100%; border-radius:8px; max-height:220px; object-fit:contain; background:#000; display:block; }
        .upload-drop { border:2px dashed var(--border); border-radius:8px; padding:2rem; display:flex; flex-direction:column; align-items:center; cursor:pointer; transition:border-color .2s; }
        .upload-drop:hover { border-color:var(--accent); }
        .reselect-btn { background:none; border:none; color:var(--accent); font-family:var(--mono); font-size:.72rem; cursor:pointer; margin-top:.4rem; }
        .upload-textarea { width:100%; background:var(--bg); border:1px solid var(--border); border-radius:2px; padding:.5rem .75rem; color:var(--text); font-family:var(--font); font-size:.875rem; resize:none; outline:none; }
        .upload-textarea:focus { border-color:var(--accent); }
        .upload-err { font-family:var(--mono); font-size:.78rem; color:#e74c3c; padding:.5rem; background:rgba(231,76,60,.08); border-radius:4px; border:1px solid rgba(231,76,60,.2); margin-bottom:.75rem; }
        .music-panel { border:1px solid var(--border); border-radius:6px; padding:.85rem; margin-bottom:.85rem; }
        .music-panel-title { font-family:var(--mono); font-size:.73rem; color:var(--muted); margin-bottom:.6rem; }
        .music-tabs { display:flex; gap:.4rem; flex-wrap:wrap; }
        .music-tab { padding:.28rem .65rem; font-family:var(--mono); font-size:.72rem; cursor:pointer; border-radius:3px; border:1px solid var(--border); background:var(--surface2); color:var(--muted); transition:all .15s; }
        .music-tab.active { background:var(--accent); color:#fff; border-color:var(--accent); }
        .track-list { display:flex; flex-direction:column; gap:.35rem; margin-top:.6rem; }
        .track-item { display:flex; align-items:center; gap:.35rem; }
        .track-select { flex:1; display:flex; align-items:center; gap:.6rem; padding:.45rem .65rem; border-radius:4px; cursor:pointer; text-align:left; border:1px solid var(--border); background:var(--bg); transition:all .15s; }
        .track-item.selected .track-select { background:rgba(192,57,43,.08); border-color:var(--accent); }
        .track-select:hover { border-color:var(--accent); }
        .track-emoji { font-size:1.2rem; flex-shrink:0; }
        .track-name { font-family:var(--mono); font-size:.78rem; color:var(--text); flex:1; }
        .track-check { color:var(--accent); font-size:.85rem; flex-shrink:0; }
        .track-preview { background:var(--surface2); border:1px solid var(--border); border-radius:3px; padding:.3rem .5rem; cursor:pointer; font-size:.8rem; color:var(--muted); transition:all .15s; flex-shrink:0; }
        .track-preview:hover,.track-preview.playing { background:var(--accent); color:#fff; border-color:var(--accent); }
      `}</style>
    </main>
  )
}
