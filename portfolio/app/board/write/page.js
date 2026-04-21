'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
      const MAX = 800
      let w = img.width, h = img.height
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX }
        else { w = Math.round(w * MAX / h); h = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    img.src = url
  })
}

// SoundCloud oEmbed API - 트랙 정보 가져오기 (CORS 우회, 키 불필요)
async function fetchSoundCloudTrack(url) {
  try {
    const res = await fetch(
      `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`
    )
    if (!res.ok) throw new Error('not found')
    const data = await res.json()
    return {
      title:     data.title || '',
      author:    data.author_name || '',
      thumbnail: data.thumbnail_url || '',
      html:      data.html || '',   // embed iframe HTML
      url,
    }
  } catch {
    return null
  }
}

export default function WritePage() {
  const [form,      setForm]      = useState({ title: '', content: '', category: '일반' })
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [images,    setImages]    = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragOver,  setDragOver]  = useState(false)

  // SoundCloud
  const [scUrl,       setScUrl]       = useState('')
  const [scTrack,     setScTrack]     = useState(null)
  const [scLoading,   setScLoading]   = useState(false)
  const [scError,     setScError]     = useState('')

  const fileRef = useRef()
  const router  = useRouter()

  useEffect(() => { if (!localStorage.getItem('user')) router.push('/login') }, [])

  const addFiles = (files) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/') && f.size <= 2 * 1024 * 1024)
    if (images.length + arr.length > 4) { setError('이미지는 최대 4장까지 가능합니다'); return }
    setImages(prev => [...prev, ...arr.map(f => ({ file: f, preview: URL.createObjectURL(f) }))])
    setError('')
  }

  const removeImg = (i) => setImages(prev => prev.filter((_, idx) => idx !== i))

  const handleScSearch = async () => {
    if (!scUrl.trim()) return
    if (!scUrl.includes('soundcloud.com')) { setScError('SoundCloud URL을 입력해주세요'); return }
    setScLoading(true); setScError(''); setScTrack(null)
    const track = await fetchSoundCloudTrack(scUrl.trim())
    if (!track) { setScError('트랙을 찾을 수 없습니다. URL을 확인해주세요'); setScLoading(false); return }
    setScTrack(track)
    setScLoading(false)
  }

  const submit = async () => {
    if (!form.title.trim() || !form.content.trim()) { setError('제목과 내용을 입력하세요'); return }
    setLoading(true)

    let imageUrls = []
    if (images.length > 0) {
      setUploading(true)
      for (const img of images) imageUrls.push(await resizeToBase64(img.file))
      setUploading(false)
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        author:   user.name || '익명',
        authorId: user.id || user.email || null,
        imageUrl: imageUrls.length === 1 ? imageUrls[0] : imageUrls.length > 1 ? imageUrls : null,
        music:    scTrack || null,   // SoundCloud 트랙 정보
      }),
    })
    const data = await res.json()
    if (data.error) { setError(data.error); setLoading(false) }
    else router.push(`/board/${data.id}`)
  }

  return (
    <main>
      <div className="container" style={{ maxWidth: '780px' }}>
        <Link href="/board" className="btn btn-sm" style={{ marginBottom: '1.5rem', display: 'inline-flex' }}>← 목록</Link>
        <div className="card card-accent">
          <div className="section-header"><h2>새 글 쓰기</h2></div>
          {error && <div className="alert alert-error">{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem', marginBottom: '0.8rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>분류</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {['일반', '개발', '질문', '공지'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>제목</label>
              <input placeholder="제목" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} maxLength={80} />
            </div>
          </div>

          <div className="form-group">
            <label>내용</label>
            <textarea rows={8} placeholder="내용을 입력하세요" value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })} maxLength={2000}
              onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') submit() }} />
          </div>

          {/* 이미지 첨부 */}
          <div className="form-group">
            <label>🖼️ 이미지 / GIF 첨부 (최대 4장, 장당 2MB 이하)</label>
            <div className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}>
              <input ref={fileRef} type="file" accept="image/*" multiple onChange={e => addFiles(e.target.files)} />
              <div style={{ fontSize: '1.6rem', marginBottom: '0.3rem' }}>📂</div>
              <div className="drop-zone-text"><strong>클릭</strong>하거나 이미지/GIF를 <strong>드래그</strong>해서 놓으세요</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--border-dark)', marginTop: '0.2rem', fontFamily: 'var(--mono)' }}>JPG · PNG · GIF · WEBP · 장당 2MB 이하</div>
            </div>
            {images.length > 0 && (
              <div className="img-strip">
                {images.map((img, i) => (
                  <div className="img-thumb" key={i}>
                    <img src={img.preview} alt="" />
                    <button className="img-thumb-del" onClick={() => removeImg(i)}>✕</button>
                  </div>
                ))}
              </div>
            )}
            {images.length > 0 && <div style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.4rem' }}>{images.length}/4장 선택됨</div>}
          </div>

          {/* 🎵 SoundCloud 음악 첨부 */}
          <div className="form-group">
            <label>🎵 음악 첨부 (SoundCloud)</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                placeholder="SoundCloud 트랙 URL 붙여넣기 (예: https://soundcloud.com/...)"
                value={scUrl}
                onChange={e => { setScUrl(e.target.value); setScError('') }}
                onKeyDown={e => e.key === 'Enter' && handleScSearch()}
                style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '2px', padding: '0.55rem 0.75rem', color: 'var(--text)', fontFamily: 'var(--font)', fontSize: '0.85rem', outline: 'none' }}
              />
              <button className="btn btn-sm" onClick={handleScSearch} disabled={scLoading || !scUrl.trim()}>
                {scLoading ? '...' : '검색'}
              </button>
            </div>
            {scError && <p style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--accent)', marginTop: '0.3rem' }}>⚠ {scError}</p>}
            <p style={{ fontFamily: 'var(--mono)', fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.3rem' }}>
              SoundCloud에서 공유 링크를 복사해 붙여넣으세요
            </p>

            {/* 트랙 미리보기 */}
            {scTrack && (
              <div style={{ marginTop: '0.75rem', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden', background: 'var(--surface2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem' }}>
                  {scTrack.thumbnail && (
                    <img src={scTrack.thumbnail} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: '0.88rem', fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scTrack.title}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.15rem' }}>{scTrack.author}</div>
                  </div>
                  <button onClick={() => { setScTrack(null); setScUrl('') }}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1rem', flexShrink: 0 }}>✕</button>
                </div>
                {/* 실제 플레이어 임베드 */}
                <div dangerouslySetInnerHTML={{ __html: scTrack.html }} style={{ lineHeight: 0 }} />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--muted)' }}>Ctrl+Enter로 등록</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Link href="/board" className="btn btn-sm">취소</Link>
              <button className="btn btn-primary btn-sm" onClick={submit} disabled={loading}>
                {uploading ? '이미지 처리 중...' : loading ? '등록 중...' : '✏️ 게시글 올리기'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
