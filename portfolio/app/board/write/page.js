'use client'
import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { compressImageToTarget } from '@/lib/imageCompress'

const MusicPicker = lazy(() => import('../../components/MusicPicker'))

export default function WritePage() {
  const [form, setForm] = useState({ title:'', content:'', category:'일반' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [music, setMusic] = useState(null)        // 라이브러리 선택 곡
  const [pickerOpen, setPickerOpen] = useState(false)
  const fileRef = useRef()
  const router = useRouter()

  useEffect(() => { if (!localStorage.getItem('user')) router.push('/login') }, [])

  const addFiles = (files) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/') && f.size <= 2*1024*1024)
    if (images.length + arr.length > 4) { setError('이미지는 최대 4장까지 가능합니다'); return }
    const newImgs = arr.map(f => ({ file: f, preview: URL.createObjectURL(f) }))
    setImages(prev => [...prev, ...newImgs])
    setError('')
  }

  const removeImg = (i) => setImages(prev => prev.filter((_,idx) => idx !== i))

  const submit = async () => {
    if (!form.title.trim() || !form.content.trim()) { setError('제목과 내용을 입력하세요'); return }
    setLoading(true)

    let imageUrls = []
    if (images.length > 0) {
      setUploading(true)
      for (const img of images) {
        const base64 = await compressImageToTarget(img.file, 500) // 500KB 이하로 압축
        imageUrls.push(base64)
      }
      setUploading(false)
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const musicPayload = music ? { url: music.fileUrl, title: music.title, author: music.artist || '', thumbnail: music.coverUrl || '' } : null
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        author: user.name || '익명',
        authorId: user.id || user.email || null,
        imageUrl: imageUrls.length === 1 ? imageUrls[0] : imageUrls.length > 1 ? imageUrls : null,
        music: musicPayload,
      })
    })
    const data = await res.json()
    if (data.error) { setError(data.error); setLoading(false) }
    else router.push(`/board/${data.id}`)
  }

  return (
    <main>
      <div className="container" style={{maxWidth:'780px'}}>
        <Link href="/board" className="btn btn-sm" style={{marginBottom:'1.5rem',display:'inline-flex'}}>← 목록</Link>
        <div className="card card-accent">
          <div className="section-header"><h2>새 글 쓰기</h2></div>
          {error && <div className="alert alert-error">{error}</div>}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.7rem',marginBottom:'0.8rem'}}>
            <div className="form-group" style={{margin:0}}>
              <label>분류</label>
              <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
                {['일반','개발','질문','공지','모집','커뮤니티','자유'].map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group" style={{margin:0}}>
              <label>제목</label>
              <input placeholder="제목" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} maxLength={80} />
            </div>
          </div>
          <div className="form-group">
            <label>내용</label>
            <textarea rows={8} placeholder="내용을 입력하세요" value={form.content} onChange={e=>setForm({...form,content:e.target.value})} maxLength={2000}
              onKeyDown={e=>{ if(e.ctrlKey && e.key==='Enter') submit() }} />
          </div>
          <div className="form-group">
            <label>🖼️ 이미지 / GIF 첨부 (최대 4장, 장당 2MB 이하)</label>
            <div className={`drop-zone ${dragOver?'drag-over':''}`}
              onDragOver={e=>{e.preventDefault();setDragOver(true)}}
              onDragLeave={()=>setDragOver(false)}
              onDrop={e=>{e.preventDefault();setDragOver(false);addFiles(e.dataTransfer.files)}}>
              <input ref={fileRef} type="file" accept="image/*" multiple onChange={e=>addFiles(e.target.files)} />
              <div style={{fontSize:'1.6rem',marginBottom:'0.3rem'}}>📂</div>
              <div className="drop-zone-text"><strong>클릭</strong>하거나 이미지/GIF를 <strong>드래그</strong>해서 놓으세요</div>
              <div style={{fontSize:'0.72rem',color:'var(--border-dark)',marginTop:'0.2rem',fontFamily:'var(--mono)'}}>JPG · PNG · GIF · WEBP · 장당 2MB 이하</div>
            </div>
            {images.length > 0 && (
              <div className="img-strip">
                {images.map((img,i) => (
                  <div className="img-thumb" key={i}>
                    <img src={img.preview} alt="" />
                    <button className="img-thumb-del" onClick={()=>removeImg(i)}>✕</button>
                  </div>
                ))}
              </div>
            )}
            {images.length > 0 && <div style={{fontFamily:'var(--mono)',fontSize:'0.72rem',color:'var(--muted)',marginTop:'0.4rem'}}>{images.length}/4장 선택됨</div>}
          </div>

          {/* 음악 첨부 — 라이브러리 선택 */}
          <div className="form-group">
            <label>음악 첨부 (선택)</label>
            {music ? (
              <div style={{ display:'flex', alignItems:'center', gap:'.5rem', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:6, padding:'.45rem .6rem' }}>
                {music.coverUrl && <img src={music.coverUrl} alt="" style={{ width:36, height:36, objectFit:'cover', borderRadius:4, flexShrink:0 }}/>}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:'var(--serif)', fontSize:'.85rem', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{music.title}</div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:'.65rem', color:'var(--muted)' }}>{music.artist || '아티스트 미상'}</div>
                </div>
                <button type="button" className="btn btn-sm" onClick={() => setMusic(null)}>제거</button>
              </div>
            ) : (
              <button type="button" className="btn btn-sm" onClick={() => setPickerOpen(o => !o)}>
                {pickerOpen ? '닫기' : '🎵 라이브러리에서 선택'}
              </button>
            )}
            {pickerOpen && !music && (
              <div style={{ marginTop:'.5rem', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'.5rem' }}>
                <Suspense fallback={<div style={{padding:'.5rem',fontFamily:'var(--mono)',fontSize:'.72rem',color:'var(--muted)'}}>로딩 중...</div>}>
                  <MusicPicker
                    selected={music}
                    onSelect={(m) => { setMusic(m); if (m) setPickerOpen(false) }}
                    compact
                  />
                </Suspense>
              </div>
            )}
          </div>

          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'0.5rem'}}>
            <span style={{fontFamily:'var(--mono)',fontSize:'0.72rem',color:'var(--muted)'}}>Ctrl+Enter로 등록</span>
            <div style={{display:'flex',gap:'0.5rem'}}>
              <Link href="/board" className="btn btn-sm">취소</Link>
              <button className="btn btn-primary btn-sm" onClick={submit} disabled={loading}>
                {uploading?'이미지 처리 중...':loading?'등록 중...':'✏️ 게시글 올리기'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
