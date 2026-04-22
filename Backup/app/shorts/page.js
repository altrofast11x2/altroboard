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

export default function ShortsPage() {
  const [user,         setUser]         = useState(null)
  const [shorts,       setShorts]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [current,      setCurrent]      = useState(0)
  const [showUpload,   setShowUpload]   = useState(false)
  const [muted,        setMuted]        = useState(true)

  // upload form
  const [uploadType,   setUploadType]   = useState('video') // 'video' | 'image'
  const [videoFile,    setVideoFile]    = useState(null)
  const [videoPreview, setVideoPreview] = useState(null)
  const [imageFile,    setImageFile]    = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [title,        setTitle]        = useState('')
  const [desc,         setDesc]         = useState('')
  const [uploading,    setUploading]    = useState(false)
  const [uploadProg,   setUploadProg]   = useState('')
  const [uploadErr,    setUploadErr]    = useState('')

  // 음악
  const [scUrl,      setScUrl]      = useState('')
  const [scTrack,    setScTrack]    = useState(null)
  const [scLoading,  setScLoading]  = useState(false)
  const [scErr,      setScErr]      = useState('')

  const containerRef = useRef(null)
  const videoFileRef = useRef(null)
  const imageFileRef = useRef(null)
  const videoRefs    = useRef({})
  const touchStart   = useRef(null)

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (u) setUser(JSON.parse(u))
    loadShorts()
  }, [])

  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([idx, el]) => {
      if (!el) return
      el.muted = muted
      if (parseInt(idx) === current) {
        el.play().catch(() => {})
        if (shorts[parseInt(idx)]) {
          fetch(`/api/shorts/${shorts[parseInt(idx)].id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'view', userId: user?.id || 'anon' }),
          }).catch(() => {})
        }
      } else {
        el.pause()
        el.currentTime = 0
      }
    })
  }, [current, shorts, muted])

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

  const onWheel = (e) => {
    e.preventDefault()
    if (e.deltaY > 30) goTo(current + 1)
    else if (e.deltaY < -30) goTo(current - 1)
  }

  const onTouchStart = (e) => { touchStart.current = e.touches[0].clientY }
  const onTouchEnd   = (e) => {
    if (touchStart.current === null) return
    const dy = touchStart.current - e.changedTouches[0].clientY
    if (dy > 50) goTo(current + 1)
    else if (dy < -50) goTo(current - 1)
    touchStart.current = null
  }

  const handleLike = async (shortId, idx) => {
    if (!user) { alert('로그인이 필요합니다'); return }
    const res  = await fetch(`/api/shorts/${shortId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'like', userId: user.id }),
    })
    const data = await res.json()
    setShorts(prev => prev.map((s, i) =>
      i === idx ? { ...s, likes: data.likes, likedBy: { ...(s.likedBy || {}), [user.id]: data.liked || undefined } } : s
    ))
  }

  const handleDelete = async (shortId) => {
    if (!user || !confirm('쇼츠를 삭제하시겠습니까?')) return
    await fetch(`/api/shorts/${shortId}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, role: user.role }),
    })
    loadShorts(); setCurrent(0)
  }

  const onVideoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) { alert('50MB 이하 영상만 가능합니다'); e.target.value = ''; return }
    setUploadErr(''); setVideoFile(file); setVideoPreview(URL.createObjectURL(file))
  }

  const onImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('5MB 이하 이미지만 가능합니다'); e.target.value = ''; return }
    setUploadErr(''); setImageFile(file); setImagePreview(URL.createObjectURL(file))
  }

  const handleScSearch = async () => {
    if (!scUrl.includes('soundcloud.com')) { setScErr('SoundCloud URL을 입력해주세요'); return }
    setScLoading(true); setScErr(''); setScTrack(null)
    const t = await fetchScTrack(scUrl.trim())
    if (!t) { setScErr('트랙을 찾을 수 없습니다'); setScLoading(false); return }
    setScTrack(t); setScLoading(false)
  }

  const resetForm = () => {
    setVideoFile(null); setVideoPreview(null)
    setImageFile(null); setImagePreview(null)
    setTitle(''); setDesc('')
    setScUrl(''); setScTrack(null); setScErr('')
    setUploadErr(''); setUploadProg('')
    if (videoFileRef.current) videoFileRef.current.value = ''
    if (imageFileRef.current) imageFileRef.current.value = ''
  }

  const handleUpload = async () => {
    if (!user) { alert('로그인이 필요합니다'); return }
    if (uploadType === 'video' && !videoFile) { alert('영상을 선택해주세요'); return }
    if (uploadType === 'image' && !imageFile) { alert('이미지를 선택해주세요'); return }

    setUploading(true); setUploadProg('업로드 중...'); setUploadErr('')

    try {
      let mediaUrl = null
      let mediaType = uploadType

      if (uploadType === 'video') {
        const fd = new FormData()
        fd.append('file', videoFile)
        const upRes  = await fetch('/api/upload-video', { method: 'POST', body: fd })
        const upData = await upRes.json()
        if (!upRes.ok || !upData.url) {
          setUploadErr(upData.error || '영상 업로드 실패'); setUploading(false); setUploadProg(''); return
        }
        mediaUrl = upData.url
      } else {
        // 이미지: base64 변환
        setUploadProg('이미지 처리 중...')
        mediaUrl = await resizeToBase64(imageFile)
      }

      setUploadProg('쇼츠 등록 중...')
      const saveRes = await fetch('/api/shorts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorId: user.id, authorName: user.name, authorAvatar: user.avatar || null,
          videoUrl: mediaType === 'video' ? mediaUrl : null,
          imageUrl: mediaType === 'image' ? mediaUrl : null,
          mediaType,
          music: scTrack || null,
          title, description: desc,
        }),
      })
      const saveData = await saveRes.json()
      if (!saveRes.ok || saveData.error) {
        setUploadErr(saveData.error || '등록 실패'); setUploading(false); setUploadProg(''); return
      }

      resetForm(); setUploading(false); setUploadProg('')
      setShowUpload(false)
      setShorts(prev => [{ ...saveData }, ...prev])
      setCurrent(0)
    } catch (e) {
      setUploadErr(`오류: ${e.message || '알 수 없는 오류'}`)
      setUploading(false); setUploadProg('')
    }
  }

  if (loading) return (
    <main><div className="container" style={{ padding: '3rem', fontFamily: 'var(--mono)', fontSize: '0.82rem', color: 'var(--muted)' }}>불러오는 중...</div></main>
  )

  return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <div className="shorts-topbar">
        <span style={{ fontFamily: 'var(--serif)', fontWeight: 700, fontSize: '1.1rem', color: '#fff' }}>쇼츠</span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button onClick={() => { const n = !muted; setMuted(n); const el = videoRefs.current[current]; if (el) el.muted = n }}
            style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 4, color: '#fff', padding: '0.3rem 0.65rem', cursor: 'pointer', fontSize: '1rem' }}>
            {muted ? '🔇' : '🔊'}
          </button>
          {user && <button className="shorts-upload-btn" onClick={() => setShowUpload(true)}>+ 업로드</button>}
        </div>
        {!user && <Link href="/login" style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>로그인 후 업로드</Link>}
      </div>

      {shorts.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 60px)', color: 'rgba(255,255,255,0.4)', gap: '1rem' }}>
          <p style={{ fontFamily: 'var(--mono)', fontSize: '0.9rem' }}>아직 쇼츠가 없어요</p>
          {user && <button className="shorts-upload-btn" onClick={() => setShowUpload(true)}>첫 쇼츠 올리기</button>}
        </div>
      ) : (
        <>
          <div className="shorts-feed" ref={containerRef} onWheel={onWheel} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            {shorts.map((s, idx) => {
              const liked = user && !!(s.likedBy || {})[user.id]
              const isMine = user && (user.id === s.authorId || user.role === 'admin')
              return (
                <div key={s.id} className="short-item">
                  {/* 영상 or 이미지 */}
                  {s.mediaType === 'image' || s.imageUrl ? (
                    <img src={s.imageUrl} alt={s.title || ''} className="short-video" style={{ objectFit: 'contain' }} />
                  ) : (
                    <video ref={el => { videoRefs.current[idx] = el }}
                      src={s.videoUrl} loop muted={muted} playsInline className="short-video"
                      onClick={() => {
                        const el = videoRefs.current[idx]; if (!el) return
                        if (muted) { setMuted(false); el.muted = false; el.play().catch(() => {}) }
                        else { el.paused ? el.play() : el.pause() }
                      }} />
                  )}

                  {/* 음악 배너 */}
                  {s.music && (
                    <div style={{ position: 'absolute', bottom: '5.5rem', left: '1rem', right: '5.5rem', background: 'rgba(0,0,0,0.6)', borderRadius: 6, padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', backdropFilter: 'blur(4px)' }}>
                      <span style={{ fontSize: '0.85rem' }}>🎵</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '0.68rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {s.music.title} — {s.music.author}
                      </span>
                    </div>
                  )}

                  <div className="short-actions">
                    <Link href={`/profile/${s.authorId}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      {s.authorAvatar
                        ? <img src={s.authorAvatar} alt="" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff' }} />
                        : <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'var(--serif)', fontWeight: 700, border: '2px solid #fff' }}>
                            {(s.authorName || '?')[0].toUpperCase()}
                          </div>
                      }
                    </Link>
                    <button className={`short-action-btn ${liked ? 'liked' : ''}`} onClick={() => handleLike(s.id, idx)}>
                      <span style={{ fontSize: '1.6rem' }}>{liked ? '❤️' : '🤍'}</span>
                      <span>{s.likes || 0}</span>
                    </button>
                    <div className="short-action-btn">
                      <span style={{ fontSize: '1.4rem' }}>👁</span>
                      <span>{s.views || 0}</span>
                    </div>
                    {isMine && (
                      <button className="short-action-btn" onClick={() => handleDelete(s.id)}>
                        <span style={{ fontSize: '1.3rem' }}>🗑</span>
                      </button>
                    )}
                  </div>

                  <div className="short-info">
                    <Link href={`/profile/${s.authorId}`} className="short-author">@{s.authorName}</Link>
                    {s.title && <p className="short-title">{s.title}</p>}
                    {s.description && <p className="short-desc">{s.description}</p>}
                  </div>
                  <div className="short-page-ind">{idx + 1} / {shorts.length}</div>
                </div>
              )
            })}
          </div>
          <div className="short-scroll-btns">
            <button onClick={() => goTo(current - 1)} disabled={current === 0}>↑</button>
            <button onClick={() => goTo(current + 1)} disabled={current >= shorts.length - 1}>↓</button>
          </div>
        </>
      )}

      {/* 업로드 모달 */}
      {showUpload && (
        <div className="sv-overlay" onClick={() => !uploading && (setShowUpload(false), resetForm())}>
          <div className="upload-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: 'var(--serif)', fontSize: '1.1rem', color: 'var(--ink)' }}>쇼츠 업로드</h3>
              <button className="sv-close" style={{ color: 'var(--muted)' }} onClick={() => !uploading && (setShowUpload(false), resetForm())}>✕</button>
            </div>

            {/* 업로드 타입 탭 */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              {[['video', '영상'], ['image', '사진']].map(([t, l]) => (
                <button key={t} onClick={() => setUploadType(t)}
                  style={{ flex: 1, padding: '0.5rem', fontFamily: 'var(--mono)', fontSize: '0.78rem', cursor: 'pointer', borderRadius: 2,
                    background: uploadType === t ? 'var(--accent)' : 'var(--surface2)',
                    color: uploadType === t ? '#fff' : 'var(--muted)',
                    border: uploadType === t ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                  {l}
                </button>
              ))}
            </div>

            {/* 영상 선택 */}
            {uploadType === 'video' && (
              videoPreview
                ? <><video src={videoPreview} controls className="upload-preview" />
                    <button style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', marginTop: '0.4rem' }}
                      onClick={() => { setVideoFile(null); setVideoPreview(null) }}>다시 선택</button></>
                : <div className="upload-dropzone" onClick={() => videoFileRef.current?.click()}>
                    <p style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem', color: 'var(--muted)' }}>클릭하여 영상 선택</p>
                    <p style={{ fontFamily: 'var(--mono)', fontSize: '0.68rem', color: 'var(--border-dark)', marginTop: '0.3rem' }}>mp4 · mov · webm · 최대 50MB</p>
                  </div>
            )}
            <input ref={videoFileRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/*" style={{ display: 'none' }} onChange={onVideoSelect} />

            {/* 이미지 선택 */}
            {uploadType === 'image' && (
              imagePreview
                ? <><img src={imagePreview} alt="" style={{ width: '100%', borderRadius: 8, maxHeight: 260, objectFit: 'contain', background: '#000' }} />
                    <button style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', marginTop: '0.4rem' }}
                      onClick={() => { setImageFile(null); setImagePreview(null) }}>다시 선택</button></>
                : <div className="upload-dropzone" onClick={() => imageFileRef.current?.click()}>
                    <p style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem', color: 'var(--muted)' }}>클릭하여 사진 선택</p>
                    <p style={{ fontFamily: 'var(--mono)', fontSize: '0.68rem', color: 'var(--border-dark)', marginTop: '0.3rem' }}>JPG · PNG · GIF · WEBP · 최대 5MB</p>
                  </div>
            )}
            <input ref={imageFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onImageSelect} />

            <div className="form-group" style={{ marginTop: '0.9rem' }}>
              <label>제목 <span style={{ color: 'var(--muted)', fontWeight: 300 }}>(선택)</span></label>
              <input placeholder="쇼츠 제목" value={title} onChange={e => setTitle(e.target.value)} maxLength={60} />
            </div>
            <div className="form-group">
              <label>설명 <span style={{ color: 'var(--muted)', fontWeight: 300 }}>(선택)</span></label>
              <textarea style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '2px', padding: '.5rem .75rem', color: 'var(--text)', fontFamily: 'var(--font)', fontSize: '.875rem', resize: 'none', outline: 'none' }}
                rows={2} placeholder="간단한 설명" value={desc} onChange={e => setDesc(e.target.value)} maxLength={150} />
            </div>

            {/* SoundCloud 음악 */}
            <div className="form-group">
              <label>🎵 음악 첨부 <span style={{ color: 'var(--muted)', fontWeight: 300 }}>(SoundCloud, 선택)</span></label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input placeholder="SoundCloud URL 붙여넣기" value={scUrl}
                  onChange={e => { setScUrl(e.target.value); setScErr('') }}
                  onKeyDown={e => e.key === 'Enter' && handleScSearch()}
                  style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 2, padding: '0.5rem 0.7rem', color: 'var(--text)', fontFamily: 'var(--font)', fontSize: '0.82rem', outline: 'none' }} />
                <button className="btn btn-sm" onClick={handleScSearch} disabled={scLoading || !scUrl.trim()}>
                  {scLoading ? '...' : '검색'}
                </button>
              </div>
              {scErr && <p style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--accent)', marginTop: '0.25rem' }}>⚠ {scErr}</p>}
              {scTrack && (
                <div style={{ marginTop: '0.5rem', border: '1px solid var(--border)', borderRadius: 4, padding: '0.6rem 0.75rem', background: 'var(--surface2)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {scTrack.thumbnail && <img src={scTrack.thumbnail} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scTrack.title}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '0.68rem', color: 'var(--muted)' }}>{scTrack.author}</div>
                  </div>
                  <button onClick={() => { setScTrack(null); setScUrl('') }}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
                </div>
              )}
            </div>

            {uploadProg && <p style={{ fontFamily: 'var(--mono)', fontSize: '0.78rem', color: 'var(--accent)', marginBottom: '0.5rem' }}>⏳ {uploadProg}</p>}
            {uploadErr && <p style={{ fontFamily: 'var(--mono)', fontSize: '0.78rem', color: '#e74c3c', marginBottom: '0.5rem', padding: '0.5rem', background: 'rgba(231,76,60,0.08)', borderRadius: 4, border: '1px solid rgba(231,76,60,0.2)' }}>⚠ {uploadErr}</p>}

            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.25rem' }}
              onClick={handleUpload} disabled={uploading || (uploadType === 'video' ? !videoFile : !imageFile)}>
              {uploading ? '업로드 중...' : '업로드'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .shorts-topbar{position:fixed;top:60px;left:0;right:0;height:50px;background:rgba(10,10,10,.9);display:flex;align-items:center;justify-content:space-between;padding:0 1.5rem;z-index:200;border-bottom:1px solid rgba(255,255,255,.08);}
        .shorts-upload-btn{background:var(--accent);color:#fff;border:none;padding:.35rem .9rem;border-radius:4px;font-size:.8rem;font-family:var(--mono);cursor:pointer;transition:background .2s;}
        .shorts-upload-btn:hover{background:var(--accent2);}
        .shorts-feed{height:calc(100vh - 110px);overflow:hidden;margin-top:50px;position:relative;}
        .short-item{width:100%;height:calc(100vh - 110px);position:relative;display:flex;align-items:center;justify-content:center;background:#000;}
        .short-video{max-height:100%;max-width:100%;object-fit:contain;cursor:pointer;}
        .short-actions{position:absolute;right:1rem;bottom:6rem;display:flex;flex-direction:column;gap:1.5rem;align-items:center;}
        .short-action-btn{display:flex;flex-direction:column;align-items:center;gap:.2rem;background:none;border:none;color:#fff;cursor:pointer;font-family:var(--mono);font-size:.7rem;}
        .short-action-btn.liked span:first-child{animation:like-pop .3s ease;}
        .short-info{position:absolute;left:1rem;bottom:1.5rem;right:5.5rem;}
        .short-author{color:#fff;font-family:var(--mono);font-size:.82rem;font-weight:500;text-decoration:none;}
        .short-author:hover{text-decoration:underline;}
        .short-title{color:#fff;font-family:var(--serif);font-size:.95rem;font-weight:700;margin-top:.3rem;}
        .short-desc{color:rgba(255,255,255,.7);font-size:.8rem;margin-top:.2rem;line-height:1.5;}
        .short-page-ind{position:absolute;top:.75rem;right:.75rem;font-family:var(--mono);font-size:.65rem;color:rgba(255,255,255,.4);background:rgba(0,0,0,.4);padding:.15rem .45rem;border-radius:10px;}
        .short-scroll-btns{position:fixed;right:1.5rem;bottom:6rem;display:flex;flex-direction:column;gap:.5rem;z-index:300;}
        .short-scroll-btns button{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#fff;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s;}
        .short-scroll-btns button:hover{background:rgba(255,255,255,.25);}
        .short-scroll-btns button:disabled{opacity:.25;cursor:not-allowed;}
        .upload-modal{background:var(--surface);border-radius:12px;width:min(440px,92vw);max-height:88vh;overflow-y:auto;padding:1.5rem;box-shadow:0 20px 60px rgba(0,0,0,.5);}
        .upload-preview{width:100%;border-radius:8px;max-height:260px;object-fit:contain;background:#000;}
        .upload-dropzone{border:2px dashed var(--border);border-radius:8px;padding:2rem;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:border-color .2s;}
        .upload-dropzone:hover{border-color:var(--accent);}
        .sv-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:8000;display:flex;align-items:center;justify-content:center;}
        .sv-close{background:none;border:none;color:rgba(255,255,255,.7);font-size:1.1rem;cursor:pointer;padding:.2rem .4rem;border-radius:4px;}
        .sv-close:hover{color:#fff;}
        @keyframes like-pop{0%{transform:scale(1)}50%{transform:scale(1.5)}100%{transform:scale(1)}}
      `}</style>
    </main>
  )
}
