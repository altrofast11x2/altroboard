'use client'
import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const CATEGORIES = ['전체','자유','질문','공지','인증','잡담']

export default function GalleryDetailPage({ params }) {
  const router = useRouter()
  const { id } = use(params)
  const [user, setUser] = useState(null)
  const [gallery, setGallery] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [category, setCategory] = useState('전체')
  const [page, setPage] = useState(1)
  const PER = 15

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (raw) setUser(JSON.parse(raw))
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const raw = localStorage.getItem('user')
      const userId = raw ? JSON.parse(raw).id : null
      const [gRes, pRes] = await Promise.all([
        fetch(`/api/galleries/${id}${userId ? `?userId=${userId}` : ''}`),
        fetch(`/api/galleries/${id}/posts`),
      ])
      if (!gRes.ok) { router.push('/galleries'); return }
      setGallery(await gRes.json())
      setPosts(await pRes.json())
    } catch { router.push('/galleries') }
    setLoading(false)
  }

  const toggleJoin = async () => {
    if (!user) { router.push('/login'); return }
    setJoining(true)
    const action = gallery?.isMember ? 'leave' : 'join'
    const res = await fetch(`/api/galleries/${id}/join`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, action }),
    })
    if (res.ok) {
      setGallery(g => ({
        ...g,
        isMember: action === 'join',
        memberCount: action === 'join' ? (g.memberCount || 0) + 1 : Math.max(0, (g.memberCount || 1) - 1),
      }))
    }
    setJoining(false)
  }

  const deleteGallery = async () => {
    if (!user || !confirm('정말 갤러리를 삭제하시겠습니까? 모든 글이 함께 삭제됩니다.')) return
    const res = await fetch(`/api/galleries/${id}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, role: user.role }),
    })
    if (res.ok) router.push('/galleries')
    else alert('삭제 실패')
  }

  const filtered = category === '전체' ? posts : posts.filter(p => p.category === category)
  const totalPages = Math.ceil(filtered.length / PER) || 1
  const paged = filtered.slice((page-1)*PER, page*PER)
  const fmt = d => new Date(d).toLocaleDateString('ko-KR')

  if (loading || !gallery) {
    return (
      <main><div className="container" style={{padding:'3rem',textAlign:'center',color:'var(--muted)',fontFamily:'var(--mono)'}}>불러오는 중...</div></main>
    )
  }

  const canWrite = user && (gallery.isMember || gallery.ownerId === user.id)
  const isOwner = user && gallery.ownerId === user.id
  const isAdmin = ['owner','admin'].includes(user?.role)

  return (
    <main>
      <div className="container">
        <Link href="/galleries" className="btn btn-sm" style={{marginBottom:'1rem',display:'inline-flex'}}>← 갤러리 목록</Link>

        {/* HEADER */}
        <div className="card" style={{borderTop:`4px solid ${gallery.color}`,marginBottom:'1.25rem'}}>
          <div style={{display:'flex',gap:'1rem',alignItems:'flex-start',flexWrap:'wrap'}}>
            {gallery.iconUrl
              ? <img src={gallery.iconUrl} alt="" className="g-icon-big" style={{objectFit:'cover'}}/>
              : <div className="g-icon-big" style={{background: gallery.color}}>{(gallery.name||'?')[0].toUpperCase()}</div>
            }
            <div style={{flex:1,minWidth:0}}>
              <h1 style={{fontFamily:'var(--serif)',fontSize:'1.4rem',fontWeight:700,color:'var(--ink)',marginBottom:'.4rem'}}>{gallery.name}</h1>
              <p style={{fontSize:'.85rem',color:'var(--muted)',lineHeight:1.7,marginBottom:'.5rem'}}>{gallery.description || '소개가 없습니다'}</p>
              <div style={{display:'flex',gap:'1rem',fontFamily:'var(--mono)',fontSize:'.72rem',color:'var(--muted)'}}>
                <span>👥 멤버 {gallery.memberCount}</span>
                <span>📝 글 {gallery.postCount}</span>
                <span>주인장 <Link href={`/profile/${gallery.ownerId}`} style={{color:'var(--accent)'}}>{gallery.ownerName}</Link></span>
              </div>
            </div>
            <div style={{display:'flex',gap:'.4rem'}}>
              {user && !isOwner && (
                <button className={`btn btn-sm ${gallery.isMember?'':'btn-primary'}`}
                  onClick={toggleJoin} disabled={joining}>
                  {joining ? '...' : gallery.isMember ? '✓ 가입됨' : '+ 가입하기'}
                </button>
              )}
              {(isOwner || isAdmin) && <button className="btn btn-danger btn-sm" onClick={deleteGallery}>갤러리 삭제</button>}
            </div>
          </div>
        </div>

        {/* POST LIST HEADER */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:'1rem',flexWrap:'wrap',gap:'0.5rem'}}>
          <div className="section-header" style={{marginBottom:0}}>
            <h2>게시글</h2>
            <p>{filtered.length}개</p>
          </div>
          {canWrite && (
            <Link href={`/galleries/${id}/write`} className="btn btn-primary btn-sm">✏️ 글쓰기</Link>
          )}
          {user && !canWrite && (
            <span style={{fontFamily:'var(--mono)',fontSize:'.72rem',color:'var(--muted)'}}>가입 후 글쓰기 가능</span>
          )}
        </div>

        <div className="board-filters">
          {CATEGORIES.map(c => (
            <button key={c} className={`btn btn-sm ${category===c?'btn-primary':''}`}
              onClick={()=>{setCategory(c);setPage(1)}}>{c}</button>
          ))}
        </div>

        <div className="board-wrap">
          {paged.length === 0 ? (
            <div style={{padding:'3rem',textAlign:'center',fontFamily:'var(--mono)',fontSize:'.82rem',color:'var(--muted)'}}>
              {posts.length === 0 ? '아직 게시글이 없습니다.' : '이 분류에는 글이 없습니다.'}
            </div>
          ) : (
            <table className="board-table">
              <thead>
                <tr>
                  <th style={{width:'60px'}}>분류</th>
                  <th>제목</th>
                  <th style={{width:'60px'}}>사진</th>
                  <th style={{width:'80px'}}>작성자</th>
                  <th style={{width:'44px'}}>조회</th>
                  <th style={{width:'90px'}}>날짜</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(p => (
                  <tr key={p.id} onClick={()=>router.push(`/galleries/${id}/posts/${p.id}`)}>
                    <td><span className="badge">{p.category}</span></td>
                    <td style={{fontWeight:400}}>{p.title}</td>
                    <td>{p.imageUrl ? <img src={Array.isArray(p.imageUrl)?p.imageUrl[0]:p.imageUrl} className="post-thumb" alt="" /> : <span style={{color:'var(--border-dark)',fontSize:'.75rem'}}>-</span>}</td>
                    <td className="meta">{p.author}</td>
                    <td className="meta">{p.views ?? 0}</td>
                    <td className="meta">{fmt(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            {Array.from({length:totalPages},(_,i)=>i+1).map(n=>(
              <button key={n} className={`page-btn ${page===n?'active':''}`} onClick={()=>setPage(n)}>{n}</button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .g-icon-big{width:64px;height:64px;border-radius:12px;color:#fff;font-size:2rem;font-family:var(--serif);font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;}
      `}</style>
    </main>
  )
}
