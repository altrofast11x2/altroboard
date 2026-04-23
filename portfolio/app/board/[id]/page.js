'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function PostPage({ params }) {
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [postId, setPostId] = useState(null)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)
  const [likes, setLikes] = useState({ count: 0, liked: false })
  const [likeAnim, setLikeAnim] = useState(false)
  const router = useRouter()
  const commentRef = useRef(null)

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (u) setUser(JSON.parse(u))
    const load = async () => {
      const { id } = await params
      setPostId(id)
      const res = await fetch(`/api/posts/${id}`)
      const d = await res.json()
      if (d.error) { router.push('/board'); return }
      setPost(d)
      setLoading(false)
      const cr = await fetch(`/api/comments?postId=${id}`)
      setComments(await cr.json())
      const userId = u ? JSON.parse(u).id : null
      const lr = await fetch(`/api/likes?postId=${id}${userId ? `&userId=${userId}` : ''}`)
      setLikes(await lr.json())
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

  const handlePin = async () => {
    if (!user || user.role !== 'admin') return
    const res = await fetch('/api/posts/pin', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ postId, userId: user.id, role: user.role }),
    })
    const data = await res.json()
    if (!data.error) setPost(prev => ({...prev, pinned: data.pinned}))
  }

  const handleLike = async () => {
    if (!user) { alert('로그인이 필요합니다'); return }
    setLikeAnim(true)
    setTimeout(() => setLikeAnim(false), 400)
    const res = await fetch('/api/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, userId: user.id }),
    })
    setLikes(await res.json())
  }

  const handleComment = async (e) => {
    e.preventDefault()
    if (!user) { alert('로그인이 필요합니다'); return }
    if (!commentText.trim()) return
    setCommentLoading(true)
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, content: commentText, authorId: user.id, authorName: user.name }),
    })
    const newComment = await res.json()
    setComments(prev => [...prev, newComment])
    setCommentText('')
    setCommentLoading(false)
    setTimeout(() => commentRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const handleDeleteComment = async (commentId) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return
    const res = await fetch(`/api/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, userId: user?.id, role: user?.role }),
    })
    const data = await res.json()
    if (data.error) { alert(data.error); return }
    setComments(prev => prev.filter(c => c.id !== commentId))
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

          <div style={{display:'flex',alignItems:'center',gap:'0.75rem',marginTop:'1.5rem',borderTop:'1px solid var(--border)',paddingTop:'1rem'}}>
            <button onClick={handleLike} className={`like-btn ${likes.liked?'liked':''} ${likeAnim?'like-pop':''}`}>
              <span className="like-heart">{likes.liked ? '❤️' : '🤍'}</span>
              <span>{likes.count}</span>
            </button>
            <span style={{fontFamily:'var(--mono)',fontSize:'0.72rem',color:'var(--muted)'}}>댓글 {comments.length}개</span>
          </div>

          {(canEdit||canDelete) && (
            <div style={{display:'flex',gap:'0.5rem',justifyContent:'flex-end',marginTop:'1rem',borderTop:'1px solid var(--border)',paddingTop:'1rem'}}>
              {canEdit && <button className="btn btn-sm" onClick={()=>router.push(`/board/edit/${postId}`)}>수정</button>}
              {user?.role === 'admin' && (
                <button className="btn btn-sm" onClick={handlePin}
                  style={{background: post.pinned ? 'rgba(192,57,43,0.1)' : undefined, borderColor: post.pinned ? 'var(--accent)' : undefined}}>
                  {post.pinned ? '📌 고정 해제' : '📌 상단 고정'}
                </button>
              )}
              {canDelete && <button className="btn btn-danger btn-sm" onClick={handleDelete}>{user?.role==='admin'?'👑 관리자 삭제':'삭제'}</button>}
            </div>
          )}
        </div>

        {/* COMMENTS */}
        <div className="card" style={{marginTop:'1.5rem'}}>
          <div className="section-header" style={{marginBottom:'1rem'}}>
            <h2>댓글 <span style={{fontFamily:'var(--mono)',fontSize:'0.85rem',fontWeight:400,color:'var(--muted)'}}>{comments.length}</span></h2>
          </div>
          <div ref={commentRef}>
            {comments.length === 0
              ? <p style={{fontFamily:'var(--mono)',fontSize:'0.78rem',color:'var(--muted)',padding:'1.5rem 0',textAlign:'center'}}>첫 댓글을 남겨보세요</p>
              : comments.map(c => (
                <div key={c.id} className="comment-item">
                  <div className="comment-header">
                    <Link href={`/profile/${c.authorId}`} className="comment-author">{c.authorName}</Link>
                    <span className="comment-date">{new Date(c.createdAt).toLocaleString('ko-KR')}</span>
                    {(user?.role==='admin'||user?.id===c.authorId) && (
                      <button className="comment-del" onClick={()=>handleDeleteComment(c.id)}>삭제</button>
                    )}
                  </div>
                  <p className="comment-body">{c.content}</p>
                </div>
              ))
            }
          </div>
          <div style={{borderTop:'1px solid var(--border)',marginTop:'1rem',paddingTop:'1rem'}}>
            {user ? (
              <form onSubmit={handleComment} style={{display:'flex',gap:'0.5rem',alignItems:'flex-end'}}>
                <textarea className="comment-input" placeholder="댓글을 입력하세요... (Enter로 등록, Shift+Enter 줄바꿈)"
                  value={commentText} onChange={e=>setCommentText(e.target.value)} rows={2}
                  onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleComment(e)}}} style={{flex:1}} />
                <button type="submit" className="btn btn-primary btn-sm" disabled={commentLoading||!commentText.trim()}>
                  {commentLoading?'...':'등록'}
                </button>
              </form>
            ) : (
              <p style={{fontFamily:'var(--mono)',fontSize:'0.78rem',color:'var(--muted)'}}>
                댓글을 작성하려면 <Link href="/login" style={{color:'var(--accent)'}}>로그인</Link>이 필요합니다
              </p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .like-btn{display:inline-flex;align-items:center;gap:0.4rem;background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:0.35rem 0.9rem;font-family:var(--mono);font-size:0.82rem;color:var(--muted);cursor:pointer;transition:all 0.2s;}
        .like-btn:hover{border-color:#e74c3c;color:var(--accent);}
        .like-btn.liked{background:rgba(231,76,60,0.08);border-color:rgba(231,76,60,0.4);color:var(--accent);}
        .like-heart{font-size:1rem;transition:transform 0.2s;display:inline-block;}
        .like-pop .like-heart{animation:like-pop 0.35s ease;}
        @keyframes like-pop{0%{transform:scale(1)}50%{transform:scale(1.5)}100%{transform:scale(1)}}
        .comment-item{padding:0.85rem 0;border-bottom:1px solid rgba(212,201,168,0.4);}
        .comment-item:last-child{border-bottom:none;}
        .comment-header{display:flex;align-items:center;gap:0.6rem;margin-bottom:0.4rem;}
        .comment-author{font-family:var(--mono);font-size:0.78rem;font-weight:500;color:var(--accent);text-decoration:none;}
        .comment-author:hover{text-decoration:underline;}
        .comment-date{font-family:var(--mono);font-size:0.68rem;color:var(--muted);flex:1;}
        .comment-del{background:none;border:none;color:var(--muted);font-family:var(--mono);font-size:0.68rem;cursor:pointer;padding:0.1rem 0.4rem;border-radius:2px;}
        .comment-del:hover{color:var(--accent);background:rgba(192,57,43,0.08);}
        .comment-body{font-size:0.875rem;line-height:1.7;color:var(--text);white-space:pre-wrap;}
        .comment-input{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:2px;padding:0.55rem 0.75rem;color:var(--text);font-family:var(--font);font-size:0.875rem;outline:none;resize:none;line-height:1.6;transition:border-color 0.2s;}
        .comment-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(192,57,43,0.08);}
      `}</style>
    </main>
  )
}
