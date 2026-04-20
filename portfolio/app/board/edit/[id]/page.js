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

export default function EditPage({ params }) {
  const [form, setForm] = useState({ title:'', content:'', category:'일반' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [postId, setPostId] = useState(null)
  const [user, setUser] = useState(null)
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [existingImage, setExistingImage] = useState(null)
  const fileRef = useRef()
  const router = useRouter()

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (!u) { router.push('/login'); return }
    const parsedUser = JSON.parse(u)
    setUser(parsedUser)

    const load = async () => {
      const { id } = await params
      setPostId(id)
      const res = await fetch(`/api/posts/${id}`)
      const d = await res.json()
      if (d.error) { router.push('/board'); return }

      // 본인 글 또는 관리자만 접근
      const userId = parsedUser.id || parsedUser.email
      if (parsedUser.role !== 'admin' && d.authorId !== userId) {
        alert('수정 권한이 없습니다')
        router.push('/board')
        return
      }

      setForm({ title: d.title, content: d.content, category: d.category })
      if (d.imageUrl) setExistingImage(d.imageUrl)
      setFetching(false)
    }
    load()
  }, [])

  const handleImage = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('5MB 이하 이미지만 가능합니다'); return }
    setImage(file)
    setImagePreview(URL.createObjectURL(file))
    setExistingImage(null)
    setError('')
  }

  const removeImage = () => {
    setImage(null); setImagePreview(null); setExistingImage(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const submit = async () => {
    if (!form.title.trim() || !form.content.trim()) { setError('제목과 내용을 입력하세요'); return }
    setLoading(true)
    let imageUrl = existingImage
    if (image) imageUrl = await resizeToBase64(image)

    const res = await fetch(`/api/posts/${postId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        imageUrl,
        userId: user?.id || user?.email,
        role: user?.role || 'user'
      })
    })
    const data = await res.json()
    if (data.error) { setError(data.error); setLoading(false) }
    else router.push(`/board/${postId}`)
  }

  if (fetching) return <main className="page"><div className="container" style={{color:'var(--muted)'}}>불러오는 중...</div></main>

  return (
    <main className="page">
      <div className="container" style={{maxWidth:'780px'}}>
        <Link href="/board" className="btn btn-sm" style={{marginBottom:'1.5rem',display:'inline-flex'}}>← 목록</Link>
        <h2 style={{fontSize:'1.25rem',fontWeight:600,marginBottom:'1.5rem'}}>글 수정</h2>
        <div className="card">
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label>분류</label>
            <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
              {['일반','개발','질문','공지'].map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>제목</label>
            <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} />
          </div>
          <div className="form-group">
            <label>내용</label>
            <textarea rows={10} value={form.content} onChange={e=>setForm({...form,content:e.target.value})} />
          </div>
          <div className="form-group">
            <label>이미지 첨부 (선택, 5MB 이하)</label>
            <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} style={{display:'none'}} />
              <button type="button" className="btn btn-sm" onClick={()=>fileRef.current?.click()}>📎 이미지 변경</button>
              {(imagePreview || existingImage) && (
                <button type="button" className="btn btn-danger btn-sm" onClick={removeImage}>✕ 제거</button>
              )}
            </div>
            {(imagePreview || existingImage) && (
              <div style={{marginTop:'0.75rem'}}>
                <img src={imagePreview || (Array.isArray(existingImage) ? existingImage[0] : existingImage)} alt="미리보기"
                  style={{maxWidth:'100%',maxHeight:'300px',borderRadius:'6px',border:'1px solid var(--border)',objectFit:'contain'}} />
              </div>
            )}
          </div>
          <div style={{display:'flex',gap:'0.5rem',justifyContent:'flex-end'}}>
            <Link href="/board" className="btn btn-sm">취소</Link>
            <button className="btn btn-primary btn-sm" onClick={submit} disabled={loading}>
              {loading ? '수정 중...' : '수정 완료'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
