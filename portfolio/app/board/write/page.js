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

export default function WritePage() {
  const [form, setForm] = useState({ title:'', content:'', category:'일반' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
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
        const base64 = await resizeToBase64(img.file)
        imageUrls.push(base64)
      }
      setUploading(false)
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        author: user.name || '익명',
        authorId: user.id || user.email || null,
        imageUrl: imageUrls.length === 1 ? imageUrls[0] : imageUrls.length > 1 ? imageUrls : null
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
                {['일반','개발','질문','공지'].map(c=><option key={c}>{c}</option>)}
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
