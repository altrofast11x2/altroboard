'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// 음악 업로드 페이지 — musicAllowed=true 또는 owner/admin 만 접근.
//   1) 노래 사진 (커버) 선택 — 미리보기
//   2) 노래 파일 (mp3/wav/m4a/ogg, 15MB)
//   3) 제목 / 아티스트 입력
//   4) 업로드 → 관리자 검토 대기

export default function MusicUploadPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [allowed, setAllowed] = useState(false)
  const [checking, setChecking] = useState(true)

  const [title,  setTitle]  = useState('')
  const [artist, setArtist] = useState('')
  const [cover,  setCover]  = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [file,   setFile]   = useState(null)

  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState(null)   // { type: 'ok'|'error', text }
  const coverRef = useRef(null)
  const fileRef  = useRef(null)
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const raw = typeof window !== 'undefined' && localStorage.getItem('user')
    if (!raw) { router.push('/login'); return }
    const u = JSON.parse(raw)
    setUser(u)
    if (['owner','admin'].includes(u.role)) {
      setAllowed(true); setChecking(false); return
    }
    fetch(`/api/user/${u.id}`).then(r => r.json()).then(d => {
      setAllowed(!!d?.musicAllowed)
    }).catch(() => {}).finally(() => setChecking(false))
  }, [router])

  const onCover = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 3 * 1024 * 1024) { setMsg({ type:'error', text:'커버는 3MB 이하' }); return }
    setCover(f)
    setCoverPreview(URL.createObjectURL(f))
  }
  const onFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 15 * 1024 * 1024) { setMsg({ type:'error', text:'음악 파일은 15MB 이하' }); return }
    const ext = (f.name || '').split('.').pop().toLowerCase()
    if (!['mp3','wav','m4a','ogg'].includes(ext)) { setMsg({ type:'error', text:'mp3 / wav / m4a / ogg 만 지원' }); return }
    setFile(f)
    setMsg(null)
  }
  const togglePreview = () => {
    if (!file) return
    if (!audioRef.current) audioRef.current = new Audio()
    const a = audioRef.current
    if (playing) { a.pause(); setPlaying(false); return }
    a.src = URL.createObjectURL(file)
    a.play().catch(() => {})
    setPlaying(true)
    a.onended = () => setPlaying(false)
  }
  useEffect(() => () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null } }, [])

  const submit = async () => {
    if (!user || !file || !title.trim()) {
      setMsg({ type:'error', text:'제목과 음악 파일은 필수입니다.' }); return
    }
    setSubmitting(true); setMsg(null)
    try {
      // 1) 커버 업로드 (선택)
      let coverUrl = null
      if (cover) {
        const fd = new FormData(); fd.append('file', cover); fd.append('userId', user.id)
        const r = await fetch('/api/music/upload-cover', { method:'POST', body: fd })
        const d = await r.json()
        if (!r.ok) { setMsg({ type:'error', text:d.error || '커버 업로드 실패' }); setSubmitting(false); return }
        coverUrl = d.url
      }
      // 2) 파일 업로드
      const fd2 = new FormData(); fd2.append('file', file); fd2.append('userId', user.id)
      const r2 = await fetch('/api/music/upload-file', { method:'POST', body: fd2 })
      const d2 = await r2.json()
      if (!r2.ok) { setMsg({ type:'error', text:d2.error || '음악 파일 업로드 실패' }); setSubmitting(false); return }

      // 3) 메타데이터 저장 → status: pending
      const r3 = await fetch('/api/music', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          uploaderId: user.id,
          title: title.trim(),
          artist: artist.trim(),
          coverUrl,
          fileUrl: d2.url,
        }),
      })
      const d3 = await r3.json()
      if (!r3.ok) { setMsg({ type:'error', text:d3.error || '저장 실패' }); setSubmitting(false); return }

      setMsg({ type:'ok', text:'업로드 완료! 관리자 검토 후 라이브러리에 등록됩니다.' })
      setTitle(''); setArtist('')
      setCover(null); setCoverPreview(null)
      setFile(null)
      if (coverRef.current) coverRef.current.value = ''
      if (fileRef.current)  fileRef.current.value  = ''
    } catch (e) {
      setMsg({ type:'error', text:'네트워크 오류' })
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) {
    return <main><div className="container" style={{padding:'3rem', textAlign:'center', color:'var(--muted)'}}>확인 중...</div></main>
  }

  if (!allowed) {
    return (
      <main>
        <div className="container" style={{ maxWidth: 560, padding: '3rem 1.5rem', textAlign: 'center' }}>
          <Link href="/music" className="btn btn-sm" style={{ marginBottom:'1.5rem', display:'inline-flex' }}>← 음악 라이브러리</Link>
          <div className="card card-accent" style={{ padding: '2.5rem 2rem' }}>
            <h1 style={{ fontFamily:'var(--serif)', fontSize:'1.4rem', marginBottom:'.5rem', color:'var(--ink)' }}>업로드 권한 필요</h1>
            <p style={{ color:'var(--muted)', fontFamily:'var(--font)', fontSize:'.92rem', lineHeight:1.75, marginBottom:'1.25rem' }}>
              음악 업로드는 관리자가 허가한 사용자만 사용할 수 있어요.<br/>
              운영자에게 메시지로 신청해주세요.
            </p>
            <Link href="/chat" className="btn btn-primary">운영자에게 메시지</Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main>
      <div className="container" style={{ maxWidth: 640 }}>
        <Link href="/music" className="btn btn-sm" style={{ marginBottom:'1.5rem', display:'inline-flex' }}>← 음악 라이브러리</Link>
        <div className="section-header">
          <h2>음악 업로드</h2>
          <p>업로드 후 관리자 검토를 거쳐 라이브러리에 등록됩니다.</p>
        </div>

        <div className="card">
          {/* 커버 */}
          <div className="form-group">
            <label>노래 사진 (선택)</label>
            <div style={{ display:'flex', gap:'.85rem', alignItems:'center' }}>
              <div onClick={() => coverRef.current?.click()} style={{ width:90, height:90, borderRadius:6, background:'var(--surface2)', border:'1px dashed var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', overflow:'hidden' }}>
                {coverPreview
                  ? <img src={coverPreview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                  : <span style={{ fontSize:'.7rem', color:'var(--muted)', fontFamily:'var(--mono)' }}>3MB 이하</span>
                }
              </div>
              <div style={{ flex:1 }}>
                <button type="button" className="btn btn-sm" onClick={() => coverRef.current?.click()}>{cover ? '변경' : '커버 선택'}</button>
                {cover && (
                  <button type="button" className="btn btn-sm" style={{ marginLeft:'.5rem' }}
                    onClick={() => { setCover(null); setCoverPreview(null); if (coverRef.current) coverRef.current.value = '' }}>제거</button>
                )}
                <p style={{ fontFamily:'var(--mono)', fontSize:'.65rem', color:'var(--muted)', marginTop:'.4rem' }}>jpg / png / webp · 정사각형 권장</p>
              </div>
            </div>
            <input ref={coverRef} type="file" accept="image/*" style={{ display:'none' }} onChange={onCover}/>
          </div>

          {/* 음악 파일 */}
          <div className="form-group">
            <label>노래 파일</label>
            <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap', alignItems:'center' }}>
              <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}>
                {file ? `✓ ${file.name.slice(0,40)}` : 'mp3 / wav / m4a / ogg (15MB)'}
              </button>
              {file && <button type="button" className="btn btn-sm" onClick={togglePreview}>{playing ? '⏸ 정지' : '▶ 미리듣기'}</button>}
              {file && <button type="button" className="btn btn-sm" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; if (audioRef.current) { audioRef.current.pause(); setPlaying(false) } }}>제거</button>}
            </div>
            <input ref={fileRef} type="file" accept="audio/*" style={{ display:'none' }} onChange={onFile}/>
          </div>

          {/* 제목 / 아티스트 */}
          <div className="form-group">
            <label>제목</label>
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="곡 제목"/>
          </div>
          <div className="form-group">
            <label>아티스트 (선택)</label>
            <input value={artist} onChange={e => setArtist(e.target.value)} maxLength={80} placeholder="아티스트 또는 본인 이름"/>
          </div>

          {msg && (
            <div className={`alert alert-${msg.type === 'error' ? 'error' : 'success'}`}>{msg.text}</div>
          )}

          <button className="btn btn-primary" onClick={submit} disabled={submitting || !file || !title.trim()}>
            {submitting ? '업로드 중...' : '업로드 (관리자 검토 대기)'}
          </button>

          <p style={{ fontFamily:'var(--mono)', fontSize:'.7rem', color:'var(--muted)', marginTop:'1rem', lineHeight:1.7 }}>
            업로드한 음원은 운영자가 저작권 / 부적절 콘텐츠 여부를 확인 후 승인 또는 거절합니다.<br/>
            본인이 권리를 가진 곡, 또는 라이선스가 허용된 곡만 업로드해주세요.
          </p>
        </div>
      </div>
    </main>
  )
}
