'use client'
import { useState, useEffect, useRef } from 'react'
import { marked } from 'marked'

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

export default function StudyPage() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title:'', content:'', period:'', tags:'' })
  const [images, setImages] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (u) setUser(JSON.parse(u))
    fetch('/api/study').then(r=>r.json()).then(d=>{setPosts(d);setLoading(false)})
  }, [])

  const addFiles = (files) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/') && f.size <= 2*1024*1024)
    if (images.length + arr.length > 4) { setError('이미지는 최대 4장까지 가능합니다'); return }
    setImages(prev => [...prev, ...arr.map(f => ({ file: f, preview: URL.createObjectURL(f) }))])
    setError('')
  }

  const submit = async () => {
    if (!form.title.trim() || !form.content.trim()) { setError('제목과 내용을 입력하세요'); return }
    setSaving(true)
    const imageUrls = []
    for (const img of images) {
      imageUrls.push(await resizeToBase64(img.file))
    }
    const res = await fetch('/api/study', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        ...form,
        tags: form.tags.split(',').map(t=>t.trim()).filter(Boolean),
        role: user?.role,
        imageUrl: imageUrls.length === 1 ? imageUrls[0] : imageUrls.length > 1 ? imageUrls : null
      })
    })
    const data = await res.json()
    if (data.error) { setError(data.error); setSaving(false) }
    else {
      setPosts(prev=>[data,...prev])
      setShowForm(false)
      setForm({title:'',content:'',period:'',tags:''})
      setImages([])
      setSaving(false)
    }
  }

  const del = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/study/${id}`, { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({role:user?.role}) })
    setPosts(prev=>prev.filter(p=>p.id!==id))
  }

  return (
    <main>
      <div className="container">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:'1.5rem',flexWrap:'wrap',gap:'0.75rem'}}>
          <div className="section-header" style={{marginBottom:0}}>
            <h2>학습 기록</h2>
            <p>배운 것들을 기록합니다 {user?.role!=='admin'&&'— 관리자만 작성 가능'}</p>
          </div>
          {user?.role==='admin' && (
            <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(!showForm)}>
              {showForm?'✕ 닫기':'+ 학습 기록 추가'}
            </button>
          )}
        </div>

        {showForm && user?.role==='admin' && (
          <div className="card card-accent" style={{marginBottom:'2rem'}}>
            <div className="section-header"><h2>새 학습 기록</h2></div>
            {error && <div className="alert alert-error">{error}</div>}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.7rem'}}>
              <div className="form-group" style={{margin:0}}>
                <label>제목</label>
                <input placeholder="예: Next.js App Router 학습" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label>기간</label>
                <input placeholder="예: 2025.04 ~ 현재" value={form.period} onChange={e=>setForm({...form,period:e.target.value})} />
              </div>
            </div>
            <div className="form-group">
              <label>내용 (마크다운 지원)</label>
              <textarea rows={8} placeholder="## 제목&#10;- 항목1&#10;- 항목2&#10;**굵게** _기울임_" value={form.content} onChange={e=>setForm({...form,content:e.target.value})} />
            </div>
            <div className="form-group">
              <label>🖼️ 이미지 첨부 (최대 4장, 장당 2MB)</label>
              <div className={`drop-zone ${dragOver?'drag-over':''}`}
                onDragOver={e=>{e.preventDefault();setDragOver(true)}}
                onDragLeave={()=>setDragOver(false)}
                onDrop={e=>{e.preventDefault();setDragOver(false);addFiles(e.dataTransfer.files)}}
                onClick={()=>fileRef.current?.click()}>
                <input ref={fileRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={e=>addFiles(e.target.files)} />
                <div style={{fontSize:'1.4rem',marginBottom:'0.3rem'}}>📂</div>
                <div className="drop-zone-text"><strong>클릭</strong>하거나 드래그해서 놓으세요</div>
                <div style={{fontSize:'0.72rem',color:'var(--border-dark)',marginTop:'0.2rem',fontFamily:'var(--mono)'}}>JPG · PNG · GIF · WEBP · 장당 2MB 이하</div>
              </div>
              {images.length > 0 && (
                <div className="img-strip">
                  {images.map((img,i) => (
                    <div className="img-thumb" key={i}>
                      <img src={img.preview} alt="" />
                      <button className="img-thumb-del" onClick={()=>setImages(prev=>prev.filter((_,idx)=>idx!==i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="form-group">
              <label>태그 (쉼표로 구분)</label>
              <input placeholder="Next.js, React, TypeScript" value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})} />
            </div>
            <div style={{display:'flex',gap:'0.5rem',justifyContent:'flex-end'}}>
              <button className="btn btn-sm" onClick={()=>setShowForm(false)}>취소</button>
              <button className="btn btn-primary btn-sm" onClick={submit} disabled={saving}>{saving?'저장 중...':'저장'}</button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{fontFamily:'var(--mono)',fontSize:'0.82rem',color:'var(--muted)'}}>불러오는 중...</div>
        ) : posts.length === 0 ? (
          <div style={{fontFamily:'var(--mono)',fontSize:'0.82rem',color:'var(--muted)',padding:'3rem 0'}}>
            아직 학습 기록이 없습니다{user?.role==='admin'&&' — 위 버튼으로 추가하세요'}
          </div>
        ) : (
          <div className="timeline">
            {posts.map(p => (
              <div className="timeline-item" key={p.id}>
                <span className="timeline-period">{p.period || new Date(p.createdAt).toLocaleDateString('ko-KR')}</span>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <h4>{p.title}</h4>
                  {user?.role==='admin' && (
                    <button className="btn btn-danger btn-sm" style={{padding:'0.2rem 0.6rem',fontSize:'0.7rem'}} onClick={()=>del(p.id)}>삭제</button>
                  )}
                </div>
                <div
                  className="markdown-body"
                  style={{marginTop:'0.4rem',marginBottom:'0.6rem'}}
                  dangerouslySetInnerHTML={{__html: marked(p.content || '')}}
                />
                {p.imageUrl && (
                  <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap',marginBottom:'0.6rem'}}>
                    {(Array.isArray(p.imageUrl) ? p.imageUrl : [p.imageUrl]).map((url,i) => (
                      <img key={i} src={url} alt="" style={{maxWidth:'100%',maxHeight:'300px',borderRadius:'6px',border:'1px solid var(--border)',objectFit:'contain'}} />
                    ))}
                  </div>
                )}
                {p.tags?.length>0 && (
                  <div style={{display:'flex',gap:'0.35rem',flexWrap:'wrap'}}>
                    {p.tags.map(t=><span className="badge badge-red" key={t}>{t}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
