'use client'
import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { compressImageToTarget } from '@/lib/imageCompress'

const CATEGORIES = ['자유','질문','공지','인증','잡담']

export default function GalleryWritePage({ params }) {
  const router = useRouter()
  const { id } = use(params)
  const [form, setForm] = useState({ title: '', content: '', category: '자유' })
  const [images, setImages] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [gallery, setGallery] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!localStorage.getItem('user')) { router.push('/login'); return }
    fetch(`/api/galleries/${id}`).then(r=>r.json()).then(setGallery)
  }, [])

  const addFiles = (files) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/') && f.size <= 2*1024*1024)
    if (images.length + arr.length > 4) { setError('이미지는 최대 4장까지 가능합니다'); return }
    const newImgs = arr.map(f => ({ file: f, preview: URL.createObjectURL(f) }))
    setImages(prev => [...prev, ...newImgs])
    setError('')
  }
  const removeImg = (i) => setImages(prev => prev.filter((_, idx) => idx !== i))

  const submit = async () => {
    if (!form.title.trim() || !form.content.trim()) { setError('제목과 내용을 입력하세요'); return }
    setLoading(true)
    let imageUrls = []
    if (images.length > 0) {
      setUploading(true)
      for (const img of images) {
        imageUrls.push(await compressImageToTarget(img.file, 500))
      }
      setUploading(false)
    }
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const res = await fetch(`/api/galleries/${id}/posts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        author: user.name || '익명',
        authorId: user.id || user.email || null,
        imageUrl: imageUrls.length === 1 ? imageUrls[0] : imageUrls.length > 1 ? imageUrls : null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || '등록 실패'); setLoading(false); return }
    router.push(`/galleries/${id}/posts/${data.id}`)
  }

  return (
    <main>
      <div className="container" style={{maxWidth:'780px'}}>
        <Link href={`/galleries/${id}`} className="btn btn-sm" style={{marginBottom:'1rem',display:'inline-flex'}}>← {gallery?.name || '갤러리'}로</Link>
        <div className="card card-accent">
          <div className="section-header" style={{marginBottom:'1rem'}}>
            <h2>{gallery?.name || '갤러리'} · 새 글</h2>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.7rem',marginBottom:'0.8rem'}}>
            <div className="form-group" style={{margin:0}}>
              <label>분류</label>
              <select value={form.category} onChange={e=>setForm({...form, category: e.target.value})}>
                {CATEGORIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group" style={{margin:0}}>
              <label>제목</label>
              <input placeholder="제목" value={form.title} onChange={e=>setForm({...form, title: e.target.value})} maxLength={80} />
            </div>
          </div>
          <div className="form-group">
            <label>내용</label>
            <textarea rows={8} placeholder="내용 (최대 2000자)" value={form.content}
              onChange={e=>setForm({...form, content: e.target.value})} maxLength={2000}
              onKeyDown={e=>{ if(e.ctrlKey && e.key==='Enter') submit() }} />
          </div>
          <div className="form-group">
            <label>🖼️ 이미지 (최대 4장, 장당 2MB)</label>
            <div className={`drop-zone ${dragOver?'drag-over':''}`}
              onDragOver={e=>{e.preventDefault();setDragOver(true)}}
              onDragLeave={()=>setDragOver(false)}
              onDrop={e=>{e.preventDefault();setDragOver(false);addFiles(e.dataTransfer.files)}}>
              <input ref={fileRef} type="file" accept="image/*" multiple onChange={e=>addFiles(e.target.files)} />
              <div style={{fontSize:'1.4rem',marginBottom:'0.3rem'}}>📂</div>
              <div className="drop-zone-text"><strong>클릭</strong>하거나 이미지를 <strong>드래그</strong></div>
            </div>
            {images.length > 0 && (
              <div className="img-strip">
                {images.map((img, i) => (
                  <div className="img-thumb" key={i}>
                    <img src={img.preview} alt="" />
                    <button className="img-thumb-del" onClick={()=>removeImg(i)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{display:'flex',gap:'.5rem',justifyContent:'flex-end'}}>
            <Link href={`/galleries/${id}`} className="btn btn-sm">취소</Link>
            <button className="btn btn-primary btn-sm" onClick={submit} disabled={loading}>
              {uploading ? '이미지 처리 중...' : loading ? '등록 중...' : '✏️ 등록'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
