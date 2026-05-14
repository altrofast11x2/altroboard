'use client'
import Link from 'next/link'
import { useState, useEffect, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'

// 무거운 컴포넌트는 lazy load — 초기 페이지 렌더 가속
const StoryStrip      = lazy(() => import('./components/StoryStrip'))
const SuggestedUsers  = lazy(() => import('./components/SuggestedUsers'))
const Chatbot         = lazy(() => import('./components/Chatbot'))

// 인스타그램 스타일 단일 컬럼 피드
// - 메인: 스토리바 + 게시글 카드(한 칸당 하나, 사진 큼) 세로 나열
// - 사이드: 추천 사용자 (데스크탑 only)

export default function Home() {
  const router = useRouter()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [likedState, setLikedState] = useState({}) // postId -> { count, liked }
  const [user, setUser] = useState(null)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (raw) setUser(JSON.parse(raw))
    fetch('/api/posts').then(r => r.json()).then(d => {
      setPosts(Array.isArray(d) ? d.slice(0, 20) : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const fmtTime = (d) => {
    const diff = Date.now() - new Date(d).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return '방금'
    if (m < 60) return `${m}분 전`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}시간 전`
    const dy = Math.floor(h / 24)
    if (dy < 7) return `${dy}일 전`
    return new Date(d).toLocaleDateString('ko-KR')
  }

  const toggleLike = async (p) => {
    if (!user) { router.push('/login'); return }
    const res = await fetch('/api/likes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: p.id, userId: user.id }),
    })
    if (res.ok) {
      const data = await res.json()
      setLikedState(s => ({ ...s, [p.id]: { count: data.count, liked: data.liked } }))
    }
  }

  return (
    <main>
      <div className="container" style={{maxWidth:'1100px'}}>
        <div className="feed-grid">
          {/* 메인 컬럼 */}
          <div className="feed-main">
            {/* 스토리 스트립 */}
            <div className="feed-stories">
              <Suspense fallback={<div style={{height:80}}/>}>
                <StoryStrip />
              </Suspense>
            </div>

            {/* 피드 헤더 */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',margin:'1.5rem 0 1rem'}}>
              <h2 style={{fontFamily:'var(--serif)',fontSize:'1.05rem',color:'var(--ink)'}}>피드</h2>
              <Link href="/board" style={{color:'var(--accent)',fontFamily:'var(--mono)',fontSize:'.75rem',textDecoration:'none'}}>
                전체 게시판 →
              </Link>
            </div>

            {/* 게시글 카드 (단일 컬럼, 큰 사진) */}
            {loading ? (
              <div className="card" style={{textAlign:'center',padding:'3rem',color:'var(--muted)',fontFamily:'var(--mono)'}}>불러오는 중...</div>
            ) : posts.length === 0 ? (
              <div className="card" style={{textAlign:'center',padding:'3rem',color:'var(--muted)',fontFamily:'var(--mono)',fontSize:'.85rem'}}>
                아직 게시글이 없습니다. <Link href="/board/write" style={{color:'var(--accent)'}}>첫 글을 작성해보세요</Link>
              </div>
            ) : (
              <div className="feed-posts">
                {posts.map(p => {
                  const thumbs = Array.isArray(p.imageUrl) ? p.imageUrl : (p.imageUrl ? [p.imageUrl] : [])
                  const myLike = likedState[p.id]
                  return (
                    <article key={p.id} className="feed-post">
                      {/* 헤더 */}
                      <header className="fp-head">
                        <Link href={`/profile/${p.authorId}`} className="fp-avatar">
                          {(p.author || '?')[0].toUpperCase()}
                        </Link>
                        <div style={{flex:1,minWidth:0}}>
                          <div className="fp-author"><Link href={`/profile/${p.authorId}`} style={{color:'inherit',textDecoration:'none'}}>@{p.author}</Link></div>
                          <div className="fp-time">{fmtTime(p.createdAt)} · <span className="badge" style={{fontSize:'.6rem',padding:'.05rem .35rem'}}>{p.category}</span></div>
                        </div>
                      </header>

                      {/* 사진 (있을 때만 큼지막하게) */}
                      {thumbs.length > 0 && (
                        <Link href={`/board/${p.id}`} className="fp-media">
                          <img src={thumbs[0]} alt="" />
                          {thumbs.length > 1 && <div className="fp-count">+{thumbs.length - 1}</div>}
                        </Link>
                      )}

                      {/* 본문 (사진 아래 / 액션바 위) */}
                      <Link href={`/board/${p.id}`} className="fp-body">
                        <span className="fp-title">{p.title}</span>
                        {p.content && <div className="fp-content">{p.content.length > 140 ? p.content.slice(0,140)+'…' : p.content}</div>}
                      </Link>

                      {/* 액션바 (본문 아래) */}
                      <div className="fp-actions">
                        <button className="fp-action" onClick={()=>toggleLike(p)} aria-label="좋아요">
                          <svg viewBox="0 0 24 24" width="26" height="26" fill={myLike?.liked?'#ff3b5c':'none'} stroke={myLike?.liked?'#ff3b5c':'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                          </svg>
                        </button>
                        <Link href={`/board/${p.id}`} className="fp-action" aria-label="댓글">
                          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                          </svg>
                        </Link>
                        <button className="fp-action" onClick={async ()=>{
                          const url = `${window.location.origin}/board/${p.id}`
                          if (navigator.share) { try { await navigator.share({ title: p.title, url }); return } catch {} }
                          try { await navigator.clipboard.writeText(url); alert('링크 복사됨') } catch {}
                        }} aria-label="공유">
                          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"/>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                          </svg>
                        </button>
                      </div>

                      {/* 좋아요 카운트 + 댓글 링크 (액션바 아래) */}
                      <div className="fp-likes">좋아요 {(myLike?.count ?? p.likes ?? 0).toLocaleString()}개</div>
                      <Link href={`/board/${p.id}`} className="fp-view-more">
                        댓글 보기 · 조회 {p.views || 0}
                      </Link>
                    </article>
                  )
                })}
              </div>
            )}
          </div>

          {/* 사이드 (데스크탑 only) */}
          <aside className="feed-side">
            <div className="card" style={{padding:'1rem'}}>
              <Suspense fallback={<div style={{minHeight:120}}/>}>
                <SuggestedUsers maxItems={5} />
              </Suspense>
            </div>
          </aside>
        </div>
      </div>

      <footer style={{borderTop:'1px solid var(--border)',padding:'1.5rem',textAlign:'center',fontFamily:'var(--mono)',fontSize:'.72rem',color:'var(--muted)'}}>
        altroboard © altrofast11x2
      </footer>

      <Suspense fallback={null}><Chatbot /></Suspense>

      <style>{`
        .feed-grid{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:1.5rem;}
        .feed-main{min-width:0;max-width:520px;margin:0 auto;}
        @media(max-width:900px){.feed-grid{grid-template-columns:1fr;}.feed-side{display:none;}}

        .feed-stories{background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:.75rem 1rem;}

        .feed-posts{display:flex;flex-direction:column;gap:1.25rem;}
        .feed-post{background:var(--surface);border:1px solid var(--border);border-radius:6px;overflow:hidden;}

        .fp-head{display:flex;align-items:center;gap:.6rem;padding:.75rem 1rem;border-bottom:1px solid var(--border);}
        .fp-avatar{width:36px;height:36px;border-radius:50%;background:var(--accent);color:#fff;font-family:var(--serif);font-weight:700;display:flex;align-items:center;justify-content:center;text-decoration:none;font-size:.9rem;flex-shrink:0;}
        .fp-author{font-family:var(--mono);font-size:.85rem;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .fp-time{font-family:var(--mono);font-size:.68rem;color:var(--muted);margin-top:.15rem;display:flex;gap:.4rem;align-items:center;}

        .fp-media{display:block;position:relative;aspect-ratio:1/1;background:#000;overflow:hidden;}
        .fp-media img{width:100%;height:100%;object-fit:cover;display:block;}
        .fp-count{position:absolute;top:.6rem;right:.6rem;background:rgba(0,0,0,.7);color:#fff;font-family:var(--mono);font-size:.7rem;padding:.15rem .5rem;border-radius:10px;}

        .fp-body{display:block;padding:.75rem 1rem .25rem;font-size:.92rem;line-height:1.55;color:var(--text);text-decoration:none;word-break:break-word;}
        .fp-title{font-family:var(--serif);font-weight:700;font-size:1.02rem;color:var(--ink);display:block;margin-bottom:.25rem;}
        .fp-content{color:var(--muted);font-size:.85rem;line-height:1.6;}

        .fp-actions{display:flex;gap:.85rem;padding:.5rem 1rem .35rem;border-top:1px solid var(--border);margin-top:.25rem;}
        .fp-action{background:none;border:none;color:var(--text);cursor:pointer;padding:.2rem;display:flex;align-items:center;}
        .fp-action:hover{color:var(--accent);}
        .fp-action svg{display:block;}

        .fp-likes{padding:0 1rem .25rem;font-family:var(--mono);font-size:.78rem;font-weight:700;color:var(--text);}
        .fp-view-more{display:block;padding:.1rem 1rem .85rem;font-family:var(--mono);font-size:.72rem;color:var(--muted);text-decoration:none;}
        .fp-view-more:hover{color:var(--accent);}
      `}</style>
    </main>
  )
}
