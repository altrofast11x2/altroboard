'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

export default function ShortsPage() {
  const [user,       setUser]       = useState(null)
  const [shorts,     setShorts]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [current,   setCurrent]     = useState(0)
  const [showUpload, setShowUpload] = useState(false)

  // upload form
  const [videoFile,  setVideoFile]  = useState(null)
  const [videoPreview, setVideoPreview] = useState(null)
  const [title,      setTitle]      = useState('')
  const [desc,       setDesc]       = useState('')
  const [muted,      setMuted]      = useState(true)   // 자동재생 위해 초기 muted
  const [uploading,  setUploading]  = useState(false)
  const [uploadProg, setUploadProg] = useState('')
  const [uploadErr,  setUploadErr]  = useState('')

  const containerRef = useRef(null)
  const fileRef      = useRef(null)
  const videoRefs    = useRef({})
  const touchStart   = useRef(null)

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (u) setUser(JSON.parse(u))
    loadShorts()
  }, [])

  // pause/play on scroll
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([idx, el]) => {
      if (!el) return
      if (parseInt(idx) === current) {
        el.play().catch(() => {})
        // count view
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
  }, [current, shorts])

  const loadShorts = async () => {
    setLoading(true)
    const res  = await fetch('/api/shorts')
    const data = await res.json()
    setShorts(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  // ── swipe / wheel navigation ───────────────────────────────
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

  // ── like ──────────────────────────────────────────────────
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

  // ── delete ────────────────────────────────────────────────
  const handleDelete = async (shortId) => {
    if (!user || !confirm('쇼츠를 삭제하시겠습니까?')) return
    await fetch(`/api/shorts/${shortId}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, role: user.role }),
    })
    loadShorts()
    setCurrent(0)
  }

  // ── video select ──────────────────────────────────────────
  const onVideoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) {
      alert('50MB 이하 영상만 선택 가능합니다')
      e.target.value = ''
      return
    }
    setUploadErr('')
    setVideoFile(file)
    setVideoPreview(URL.createObjectURL(file))
  }

  // ── upload ────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!user) { alert('로그인이 필요합니다'); return }
    if (!videoFile) { alert('영상을 선택해주세요'); return }
    setUploading(true)
    setUploadProg('영상 업로드 중...')
    setUploadErr('')

    try {
      // Step 1: Vercel Blob에 영상 업로드
      const fd = new FormData()
      fd.append('file', videoFile)
      const upRes  = await fetch('/api/upload-video', { method: 'POST', body: fd })
      const upData = await upRes.json()
      if (!upRes.ok || !upData.url) {
        setUploadErr(upData.error || '영상 업로드 실패. 다시 시도해주세요.')
        setUploading(false); setUploadProg(''); return
      }

      // Step 2: Firebase에 쇼츠 메타 저장
      setUploadProg('쇼츠 등록 중...')
      const saveRes  = await fetch('/api/shorts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorId:    user.id,
          authorName:  user.name,
          authorAvatar: user.avatar || null,
          videoUrl:    upData.url,
          title,
          description: desc,
        }),
      })
      const saveData = await saveRes.json()
      if (!saveRes.ok || saveData.error) {
        setUploadErr(saveData.error || '쇼츠 등록 실패. 다시 시도해주세요.')
        setUploading(false); setUploadProg(''); return
      }

      // Step 3: 성공
      setVideoFile(null); setVideoPreview(null); setTitle(''); setDesc('')
      setUploading(false); setUploadProg(''); setUploadErr('')
      setShowUpload(false)
      setShorts(prev => [{ ...saveData }, ...prev])
      setCurrent(0)

    } catch (e) {
      console.error('upload error', e)
      setUploadErr(`오류: ${e.message || '알 수 없는 오류'}`)
      setUploading(false); setUploadProg('')
    }
  }

  if (loading) return (
    <main><div className="container" style={{ padding: '3rem', fontFamily: 'var(--mono)', fontSize: '0.82rem', color: 'var(--muted)' }}>불러오는 중...</div></main>
  )

  return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      {/* ── header ── */}
      <div className="shorts-topbar">
        <span style={{ fontFamily: 'var(--serif)', fontWeight: 700, fontSize: '1.1rem', color: '#fff' }}>🎬 쇼츠</span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => {
              const newMuted = !muted
              setMuted(newMuted)
              const el = videoRefs.current[current]
              if (el) el.muted = newMuted
            }}
            style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 4, color: '#fff', padding: '0.3rem 0.65rem', cursor: 'pointer', fontSize: '1rem' }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          {user && (
            <button className="shorts-upload-btn" onClick={() => setShowUpload(true)}>+ 업로드</button>
          )}
        </div>
        {!user && (
          <Link href="/login" style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
            로그인 후 업로드
          </Link>
        )}
      </div>

      {shorts.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 60px)', color: 'rgba(255,255,255,0.4)', gap: '1rem' }}>
          <div style={{ fontSize: '3rem' }}>🎬</div>
          <p style={{ fontFamily: 'var(--mono)', fontSize: '0.9rem' }}>아직 쇼츠가 없어요</p>
          {user && <button className="shorts-upload-btn" onClick={() => setShowUpload(true)}>첫 쇼츠 올리기</button>}
        </div>
      ) : (
        <>
          {/* ── feed ── */}
          <div className="shorts-feed"
            ref={containerRef}
            onWheel={onWheel}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {shorts.map((s, idx) => {
              const liked = user && !!(s.likedBy || {})[user.id]
              const isMine = user && (user.id === s.authorId || user.role === 'admin')
              return (
                <div key={s.id} className="short-item">
                  {/* video */}
                  <video
                    ref={el => { videoRefs.current[idx] = el }}
                    src={s.videoUrl}
                    loop muted={muted} playsInline
                    className="short-video"
                    onClick={() => {
                      const el = videoRefs.current[idx]
                      if (!el) return
                      if (muted) {
                        // 첫 클릭 시 소리 켜기
                        setMuted(false)
                        el.muted = false
                        el.play().catch(() => {})
                      } else {
                        el.paused ? el.play() : el.pause()
                      }
                    }}
                  />

                  {/* right sidebar actions */}
                  <div className="short-actions">
                    <Link href={`/profile/${s.authorId}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
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

                  {/* bottom info */}
                  <div className="short-info">
                    <Link href={`/profile/${s.authorId}`} className="short-author">
                      @{s.authorName}
                    </Link>
                    {s.title && <p className="short-title">{s.title}</p>}
                    {s.description && <p className="short-desc">{s.description}</p>}
                    <p style={{ fontFamily: 'var(--mono)', fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.3rem' }}>
                      {new Date(s.createdAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>

                  {/* page indicator */}
                  <div className="short-page-ind">{idx + 1} / {shorts.length}</div>
                </div>
              )
            })}
          </div>

          {/* ── scroll indicators ── */}
          <div className="short-scroll-btns">
            <button onClick={() => goTo(current - 1)} disabled={current === 0}>↑</button>
            <button onClick={() => goTo(current + 1)} disabled={current >= shorts.length - 1}>↓</button>
          </div>
        </>
      )}

      {/* ══ UPLOAD MODAL ══ */}
      {showUpload && (
        <div className="sv-overlay" onClick={() => !uploading && setShowUpload(false)}>
          <div className="upload-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontFamily: 'var(--serif)', fontSize: '1.1rem', color: 'var(--ink)' }}>🎬 쇼츠 업로드</h3>
              <button className="sv-close" style={{ color: 'var(--muted)' }} onClick={() => !uploading && setShowUpload(false)}>✕</button>
            </div>

            {/* video preview */}
            {videoPreview ? (
              <video src={videoPreview} controls className="upload-preview" />
            ) : (
              <div className="upload-dropzone" onClick={() => fileRef.current?.click()}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎬</div>
                <p style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem', color: 'var(--muted)' }}>클릭하여 영상 선택</p>
                <p style={{ fontFamily: 'var(--mono)', fontSize: '0.68rem', color: 'var(--border-dark)', marginTop: '0.3rem' }}>mp4 · mov · webm · 최대 50MB</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept="video/mp4,video/mov,video/webm,video/avi" style={{ display: 'none' }} onChange={onVideoSelect} />

            {videoPreview && (
              <button style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', marginTop: '0.4rem' }}
                onClick={() => { setVideoFile(null); setVideoPreview(null) }}>
                다시 선택
              </button>
            )}

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>제목 <span style={{ color: 'var(--muted)', fontWeight: 300 }}>(선택)</span></label>
              <input placeholder="쇼츠 제목을 입력하세요" value={title} onChange={e => setTitle(e.target.value)} maxLength={60} />
            </div>
            <div className="form-group">
              <label>설명 <span style={{ color: 'var(--muted)', fontWeight: 300 }}>(선택)</span></label>
              <textarea style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '2px', padding: '.5rem .75rem', color: 'var(--text)', fontFamily: 'var(--font)', fontSize: '.875rem', resize: 'none', outline: 'none' }}
                rows={2} placeholder="간단한 설명" value={desc} onChange={e => setDesc(e.target.value)} maxLength={150} />
            </div>

            {uploadProg && (
              <p style={{ fontFamily: 'var(--mono)', fontSize: '0.78rem', color: 'var(--accent)', marginBottom: '0.5rem' }}>
                ⏳ {uploadProg}
              </p>
            )}
            {uploadErr && (
              <p style={{ fontFamily: 'var(--mono)', fontSize: '0.78rem', color: '#e74c3c', marginBottom: '0.5rem', padding: '0.5rem', background: 'rgba(231,76,60,0.08)', borderRadius: 4, border: '1px solid rgba(231,76,60,0.2)' }}>
                ⚠ {uploadErr}
              </p>
            )}

            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.25rem' }}
              onClick={handleUpload} disabled={uploading || !videoFile}>
              {uploading ? '업로드 중...' : '🎬 업로드'}
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
        /* Upload modal */
        .upload-modal{background:var(--surface);border-radius:12px;width:min(440px,92vw);max-height:88vh;overflow-y:auto;padding:1.5rem;box-shadow:0 20px 60px rgba(0,0,0,.5);}
        .upload-preview{width:100%;border-radius:8px;max-height:260px;object-fit:contain;background:#000;}
        .upload-dropzone{border:2px dashed var(--border);border-radius:8px;padding:2.5rem;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:border-color .2s;}
        .upload-dropzone:hover{border-color:var(--accent);}
        /* Shared overlay */
        .sv-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:8000;display:flex;align-items:center;justify-content:center;}
        .sv-close{background:none;border:none;color:rgba(255,255,255,.7);font-size:1.1rem;cursor:pointer;padding:.2rem .4rem;border-radius:4px;}
        .sv-close:hover{color:#fff;}
        @keyframes like-pop{0%{transform:scale(1)}50%{transform:scale(1.5)}100%{transform:scale(1)}}
      `}</style>
    </main>
  )
}
