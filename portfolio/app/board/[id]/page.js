'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function PostPage({ params }) {
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [postId, setPostId] = useState(null)
  const router = useRouter()

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (u) setUser(JSON.parse(u))
    const load = async () => {
      const { id } = await params
      setPostId(id)
      const res = await fetch(`/api/posts/${id}`)
      const d = await res.json()
      if (d.error) router.push('/board')
      else { setPost(d); setLoading(false) }
    }
    load()
  }, [])

  const handleDelete = async () => {
    if (!confirm('삭제하시겠습니까?')) return
    const res = await fetch(`/api/posts/${postId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user?.id || user?.email, role: user?.role || 'user' })
    })
    const data = await res.json()
    if (data.error) { alert(data.error); return }
    router.push('/board')
  }

  const canDelete = user && (user.role === 'admin' || (post && (post.authorId === user.id || post.authorId === user.email)))
  const canEdit = canDelete

  if (loading) return <main><div className="container" style={{padding:'3rem',fontFamily:'var(--mono)',fontSize:'0.82rem',color:'var(--muted)'}}>불러오는 중...</div></main>

  return (
    <main>
      <div className="container" style={{maxWidth:'780px'}}>
        <Link href="/board" className="btn btn-sm" style={{marginBottom:'1.5rem',display:'inline-flex'}}>← 목록으로</Link>
        <div className="card card-accent">
          <span className="badge" style={{marginBottom:'0.75rem',display:'inline-block'}}>{post.category}</span>
          <h1 style={{fontFamily:'var(--serif)',fontSize:'1.4rem',fontWeight:700,marginBottom:'1rem',lineHeight:1.4,color:'var(--ink)'}}>{post.title}</h1>
          <div className="post-meta-bar" style={{marginBottom:'1.25rem'}}>
            <span>✍ {post.author}</span>
            <span>👁 {post.views ?? 0}</span>
            <span>{new Date(post.createdAt).toLocaleString('ko-KR')}</span>
            {post.updatedAt && <span>(수정됨)</span>}
          </div>
          <div className="divider" />

          <div className="post-body" style={{marginBottom:'1.25rem'}}>{post.content}</div>

          {post.imageUrl && (
            <div className="img-gallery">
              {(Array.isArray(post.imageUrl) ? post.imageUrl : [post.imageUrl]).map((url, i) => (
                <img key={i} src={url} alt={`이미지 ${i+1}`}
                  onClick={()=>{ const lb=document.createElement('div'); lb.className='lightbox'; lb.onclick=()=>lb.remove(); const im=document.createElement('img'); im.src=url; lb.appendChild(im); document.body.appendChild(lb); }} />
              ))}
            </div>
          )}

          {(canEdit || canDelete) && (
            <div style={{display:'flex',gap:'0.5rem',justifyContent:'flex-end',marginTop:'1.5rem',borderTop:'1px solid var(--border)',paddingTop:'1rem'}}>
              {canEdit && <button className="btn btn-sm" onClick={()=>router.push(`/board/edit/${postId}`)}>수정</button>}
              {canDelete && <button className="btn btn-danger btn-sm" onClick={handleDelete}>{user?.role==='admin'?'👑 관리자 삭제':'삭제'}</button>}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
