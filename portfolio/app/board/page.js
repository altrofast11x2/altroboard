'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function BoardPage() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('전체')
  const [user, setUser] = useState(null)
  const [page, setPage] = useState(1)
  const PER = 10
  const router = useRouter()

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (u) setUser(JSON.parse(u))
    fetch('/api/posts').then(r=>r.json()).then(d=>{setPosts(d);setLoading(false)})
  }, [])

  const filtered = [...posts]
    .filter(p => {
    const matchCat = category === '전체' || p.category === category
    const matchSearch = p.title?.includes(search) || p.content?.includes(search)
    return matchCat && matchSearch
  }).sort((a,b) => (b.pinned?1:0)-(a.pinned?1:0))

  const totalPages = Math.ceil(filtered.length / PER)
  const paged = filtered.slice((page-1)*PER, page*PER)
  const fmt = d => new Date(d).toLocaleDateString('ko-KR')

  return (
    <main>
      <div className="container">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:'1.5rem',flexWrap:'wrap',gap:'0.75rem'}}>
          <div className="section-header" style={{marginBottom:0}}>
            <h2>게시판</h2>
            <p>전체 {filtered.length}개의 글</p>
          </div>
          {user && <Link href="/board/write" className="btn btn-primary btn-sm">✏️ 글쓰기</Link>}
        </div>

        <div className="board-filters">
          <input placeholder="검색..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} />
          {['전체','일반','개발','질문','공지','모집','커뮤니티','갤러리','자유'].map(c=>(
            <button key={c} className={`btn btn-sm ${category===c?'btn-primary':''}`} onClick={()=>{setCategory(c);setPage(1)}}>{c}</button>
          ))}
        </div>

        <div className="board-wrap">
          {loading ? (
            <div style={{padding:'3rem',textAlign:'center',fontFamily:'var(--mono)',fontSize:'0.82rem',color:'var(--muted)'}}>불러오는 중...</div>
          ) : paged.length === 0 ? (
            <div style={{padding:'4rem',textAlign:'center',fontFamily:'var(--mono)',fontSize:'0.82rem',color:'var(--muted)'}}>
              {posts.length === 0 ? '아직 올라온 게시글이 없습니다' : '검색 결과가 없습니다'}
            </div>
          ) : (
            <table className="board-table">
              <thead>
                <tr>
                  <th style={{width:'60px'}}>분류</th>
                  <th>제목</th>
                  <th style={{width:'60px'}}>사진</th>
                  <th style={{width:'70px'}}>작성자</th>
                  <th style={{width:'44px'}}>조회</th>
                  <th style={{width:'90px'}}>날짜</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(p => (
                  <tr key={p.id} onClick={()=>router.push(`/board/${p.id}`)}>
                    <td><span className="badge">{p.category}</span></td>
                    <td style={{fontWeight:400}}>{p.title}</td>
                    <td>
                      {p.imageUrl
                        ? <img src={p.imageUrl} className="post-thumb" alt="" />
                        : <span style={{color:'var(--border-dark)',fontSize:'0.75rem',fontFamily:'var(--mono)'}}>-</span>
                      }
                    </td>
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

        {!user && (
          <p style={{marginTop:'1rem',fontSize:'0.8rem',color:'var(--muted)',fontFamily:'var(--mono)'}}>
            글을 작성하려면 <Link href="/login" style={{color:'var(--accent)'}}>로그인</Link>이 필요합니다
          </p>
        )}
      </div>
    </main>
  )
}
