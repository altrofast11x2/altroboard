'use client'
import { useEffect, useState, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function GalleryPostPage({ params }) {
  const router = useRouter()
  const { id, postId } = use(params)
  const [user, setUser] = useState(null)
  const [gallery, setGallery] = useState(null)
  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const commentRef = useRef(null)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (raw) setUser(JSON.parse(raw))
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const [gRes, pRes, cRes] = await Promise.all([
        fetch(`/api/galleries/${id}`),
        fetch(`/api/galleries/${id}/posts/${postId}`),
        fetch(`/api/galleries/${id}/posts/${postId}/comments`),
      ])
      if (!pRes.ok) { router.push(`/galleries/${id}`); return }
      setGallery(await gRes.json())
      setPost(await pRes.json())
      setComments(await cRes.json())
    } catch { router.push(`/galleries/${id}`) }
    setLoading(false)
  }

  const handleDelete = async () => {
    if (!confirm('삭제하시겠습니까?')) return
    const res = await fetch(`/api/galleries/${id}/posts/${postId}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user?.id, role: user?.role }),
    })
    const data = await res.json()
    if (data.error) { alert(data.error); return }
    router.push(`/galleries/${id}`)
  }

  const submitComment = async (e) => {
    e.preventDefault()
    if (!user) { alert('로그인이 필요합니다'); return }
    if (!commentText.trim()) return
    setCommentLoading(true)
    const res = await fetch(`/api/galleries/${id}/posts/${postId}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: commentText, authorId: user.id, authorName: user.name }),
    })
    const nc = await res.json()
    if (!res.ok) { alert(nc.error || '등록 실패'); setCommentLoading(false); return }
    setComments(prev => [...prev, nc])
    setCommentText('')
    setCommentLoading(false)
    setTimeout(() => commentRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const deleteComment = async (commentId) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return
    const qs = new URLSearchParams({ commentId, userId: user?.id || '', role: user?.role || 'user' }).toString()
    const res = await fetch(`/api/galleries/${id}/posts/${postId}/comments?${qs}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.error) { alert(data.error); return }
    setComments(prev => prev.filter(c => c.id !== commentId))
  }

  if (loading || !post) {
    return <main><div className="container" style={{padding:'3rem',textAlign:'center',color:'var(--muted)',fontFamily:'var(--mono)'}}>불러오는 중...</div></main>
  }

  const canDelete = user && (['owner','admin'].includes(user.role) || post.authorId === user.id || gallery?.ownerId === user.id)

  return (
    <main>
      <div className="container" style={{maxWidth:'780px'}}>
        <Link href={`/galleries/${id}`} className="btn btn-sm" style={{marginBottom:'1rem',display:'inline-flex'}}>← {gallery?.name || '갤러리'}로</Link>
        <div className="card card-accent">
          <span className="badge" style={{marginBottom:'.75rem',display:'inline-block'}}>{post.category}</span>
          <h1 style={{fontFamily:'var(--serif)',fontSize:'1.35rem',fontWeight:700,marginBottom:'1rem',lineHeight:1.4,color:'var(--ink)'}}>{post.title}</h1>
          <div className="post-meta-bar" style={{marginBottom:'1.25rem'}}>
            <span><Link href={`/profile/${post.authorId}`} style={{color:'var(--accent)'}}>✍ {post.author}</Link></span>
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
                  onClick={()=>{const lb=document.createElement('div');lb.className='lightbox';lb.onclick=()=>lb.remove();const im=document.createElement('img');im.src=url;lb.appendChild(im);document.body.appendChild(lb)}} />
              ))}
            </div>
          )}

          {canDelete && (
            <div style={{display:'flex',gap:'.5rem',justifyContent:'flex-end',marginTop:'1rem',borderTop:'1px solid var(--border)',paddingTop:'1rem'}}>
              <button className="btn btn-danger btn-sm" onClick={handleDelete}>삭제</button>
            </div>
          )}
        </div>

        <div className="card" style={{marginTop:'1.5rem'}}>
          <div className="section-header" style={{marginBottom:'1rem'}}>
            <h2>댓글 <span style={{fontFamily:'var(--mono)',fontSize:'.85rem',fontWeight:400,color:'var(--muted)'}}>{comments.length}</span></h2>
          </div>
          <div ref={commentRef}>
            {comments.length === 0 ? (
              <p style={{fontFamily:'var(--mono)',fontSize:'.78rem',color:'var(--muted)',padding:'1.5rem 0',textAlign:'center'}}>첫 댓글을 남겨보세요</p>
            ) : comments.map(c => {
              const canDel = user && (['owner','admin'].includes(user.role) || c.authorId === user.id || gallery?.ownerId === user.id)
              return (
                <div key={c.id} style={{padding:'.85rem 0',borderBottom:'1px solid rgba(212,201,168,.4)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'.6rem',marginBottom:'.4rem'}}>
                    <Link href={`/profile/${c.authorId}`} style={{fontFamily:'var(--mono)',fontSize:'.78rem',color:'var(--accent)'}}>{c.authorName}</Link>
                    <span style={{fontFamily:'var(--mono)',fontSize:'.68rem',color:'var(--muted)',flex:1}}>{new Date(c.createdAt).toLocaleString('ko-KR')}</span>
                    {canDel && <button onClick={()=>deleteComment(c.id)} style={{background:'none',border:'none',color:'var(--muted)',fontFamily:'var(--mono)',fontSize:'.68rem',cursor:'pointer'}}>삭제</button>}
                  </div>
                  <p style={{fontSize:'.875rem',lineHeight:1.7,whiteSpace:'pre-wrap',color:'var(--text)'}}>{c.content}</p>
                </div>
              )
            })}
          </div>
          <div style={{borderTop:'1px solid var(--border)',marginTop:'1rem',paddingTop:'1rem'}}>
            {user ? (
              <form onSubmit={submitComment} style={{display:'flex',gap:'.5rem',alignItems:'flex-end'}}>
                <textarea placeholder="댓글을 입력하세요... (Enter로 등록)" value={commentText}
                  onChange={e=>setCommentText(e.target.value)} rows={2}
                  onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); submitComment(e) } }}
                  style={{flex:1,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:2,padding:'.55rem .75rem',fontFamily:'var(--font)',fontSize:'.875rem',resize:'none',outline:'none',lineHeight:1.6}} />
                <button type="submit" className="btn btn-primary btn-sm" disabled={commentLoading || !commentText.trim()}>
                  {commentLoading ? '...' : '등록'}
                </button>
              </form>
            ) : (
              <p style={{fontFamily:'var(--mono)',fontSize:'.78rem',color:'var(--muted)'}}>
                댓글을 작성하려면 <Link href="/login" style={{color:'var(--accent)'}}>로그인</Link>이 필요합니다
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
