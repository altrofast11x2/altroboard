'use client'
import Link from 'next/link'
import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n'

// 무거운 컴포넌트는 lazy load — 초기 페이지 렌더 가속
const StoryStrip      = lazy(() => import('./components/StoryStrip'))
const SuggestedUsers  = lazy(() => import('./components/SuggestedUsers'))
const PostMusic       = lazy(() => import('./components/PostMusic'))
import VerifiedBadge from './components/VerifiedBadge'

// 인스타그램 스타일 단일 컬럼 피드
// - 메인: 스토리바 + 게시글 카드(한 칸당 하나, 사진 큼) 세로 나열
// - 사이드: 추천 사용자 (데스크탑 only)
//
// 좋아요 표시:
// - getPosts() 가 이미 likeCount 를 함께 내려준다.
// - 로그인 유저는 본인이 좋아요 누른 여부도 별도로 한 번 조회.
// - 게시글 더블클릭 시 하트 토글 (Instagram 스타일 펄스 애니메이션).
// - 비로그인 유저는 좋아요 버튼 클릭 시 "로그인 안내" 모달.

export default function Home() {
  const router = useRouter()
  const { t } = useI18n()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [likedState, setLikedState] = useState({}) // postId -> { count, liked }
  const [savedSet, setSavedSet] = useState({})     // postId -> bool (저장됨)
  const [followingSet, setFollowingSet] = useState({}) // authorId -> bool (팔로잉)
  const [user, setUser] = useState(null)
  const [loginPrompt, setLoginPrompt] = useState(false)
  const [pulseId, setPulseId] = useState(null)     // 더블클릭 시 큰 하트 펄스 표시할 postId
  const lastTapRef = useRef({})                    // postId -> last tap time (모바일 더블탭 폴백)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    const u = raw ? JSON.parse(raw) : null
    if (u) setUser(u)
    fetch('/api/posts').then(r => r.json()).then(async (d) => {
      const list = Array.isArray(d) ? d.slice(0, 20) : []
      setPosts(list)
      // 모든 게시글 likeCount 를 likedState 에 미리 채워둔다 (좋아요 0 버그 수정)
      const init = {}
      list.forEach(p => { init[p.id] = { count: p.likeCount ?? p.likes ?? 0, liked: false } })
      setLikedState(init)
      setLoading(false)

      // 로그인된 사용자라면 어떤 글에 좋아요 눌렀는지, 어떤 글을 저장했는지, 누구를 팔로잉하는지 일괄 조회
      if (u) {
        // 좋아요 여부 — 게시글별 (병렬)
        Promise.all(list.map(async (p) => {
          try {
            const r = await fetch(`/api/likes?postId=${encodeURIComponent(p.id)}&userId=${encodeURIComponent(u.id)}`)
            if (!r.ok) return
            const { count, liked } = await r.json()
            setLikedState(s => ({ ...s, [p.id]: { count, liked } }))
          } catch {}
        })).catch(()=>{})

        // 저장 목록 (한 번에)
        fetch(`/api/saved?userId=${encodeURIComponent(u.id)}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            if (!d?.savedIds) return
            const map = {}; d.savedIds.forEach(id => { map[id] = true })
            setSavedSet(map)
          }).catch(()=>{})

        // 팔로잉 목록 (한 번에)
        fetch(`/api/follow?userId=${encodeURIComponent(u.id)}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            const ids = Array.isArray(d?.following) ? d.following : []
            const map = {}; ids.forEach(id => { map[id] = true })
            setFollowingSet(map)
          }).catch(()=>{})
      }
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

  // 좋아요 토글 — 로그인 안 했으면 안내 모달 띄움
  const toggleLike = async (p, opts = {}) => {
    const { onlyAddOnDouble = false } = opts
    if (!user) { setLoginPrompt(true); return }
    const cur = likedState[p.id]
    // 더블클릭의 경우 이미 좋아요 상태면 그대로 두고 펄스만 (Instagram 동작)
    if (onlyAddOnDouble && cur?.liked) {
      setPulseId(p.id)
      setTimeout(() => setPulseId(null), 800)
      return
    }
    try {
      const res = await fetch('/api/likes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: p.id, userId: user.id }),
      })
      if (res.ok) {
        const data = await res.json()
        setLikedState(s => ({ ...s, [p.id]: { count: data.count, liked: data.liked } }))
        if (data.liked) {
          setPulseId(p.id)
          setTimeout(() => setPulseId(null), 800)
        }
      }
    } catch {}
  }

  // 더블클릭 = Instagram 하트 토글 (사진 + 본문 영역 어디든)
  const handleMediaDoubleClick = (p) => toggleLike(p, { onlyAddOnDouble: true })
  // 모바일 더블탭 폴백
  const handleMediaTouchEnd = (p) => {
    const now = Date.now()
    const last = lastTapRef.current[p.id] || 0
    if (now - last < 320) {
      handleMediaDoubleClick(p)
      lastTapRef.current[p.id] = 0
    } else {
      lastTapRef.current[p.id] = now
    }
  }

  // 저장 토글
  const toggleSave = async (postId, e) => {
    e?.stopPropagation?.()
    e?.preventDefault?.()
    if (!user) { setLoginPrompt(true); return }
    const wasSaved = !!savedSet[postId]
    setSavedSet(s => ({ ...s, [postId]: !wasSaved }))   // optimistic
    try {
      const r = await fetch('/api/saved', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, postId }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setSavedSet(s => ({ ...s, [postId]: wasSaved }))
        alert(d?.error || `저장 실패 (${r.status}). Firebase rules 확인 필요.`)
        return
      }
      if (typeof d?.saved === 'boolean') setSavedSet(s => ({ ...s, [postId]: d.saved }))
    } catch (err) {
      setSavedSet(s => ({ ...s, [postId]: wasSaved }))   // rollback
      alert('저장 요청 중 네트워크 오류')
    }
  }

  // 팔로우 토글 (게시글 헤더)
  const toggleFollow = async (authorId, e) => {
    e?.stopPropagation?.()
    if (!user) { setLoginPrompt(true); return }
    if (authorId === user.id) return  // 본인은 팔로우 불가
    const wasF = !!followingSet[authorId]
    setFollowingSet(s => ({ ...s, [authorId]: !wasF }))
    try {
      const r = await fetch('/api/follow', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followerId: user.id, followingId: authorId }),
      })
      const d = await r.json()
      if (typeof d?.isFollowing === 'boolean') setFollowingSet(s => ({ ...s, [authorId]: d.isFollowing }))
    } catch {
      setFollowingSet(s => ({ ...s, [authorId]: wasF }))
    }
  }

  // 카드 더블클릭 = 좋아요. 단일 클릭은 게시글 페이지로 이동 (clickTimer 패턴으로 충돌 방지).
  // 액션바/링크/버튼은 stopPropagation 으로 보호.
  const clickTimerRef = useRef({})
  const handleCardClick = (p, e) => {
    // 인터랙티브 요소(버튼/링크) 클릭은 무시
    if (e.target.closest('button, a')) return
    const t = clickTimerRef.current[p.id]
    if (t) {
      clearTimeout(t)
      clickTimerRef.current[p.id] = null
      handleMediaDoubleClick(p)
      return
    }
    clickTimerRef.current[p.id] = setTimeout(() => {
      clickTimerRef.current[p.id] = null
      router.push(`/board/${p.id}`)
    }, 260)
  }

  return (
    <main>
      <div className="container" style={{maxWidth:'1100px'}}>
        <div className="feed-grid">
          {/* 메인 컬럼 */}
          <div className="feed-main">
            {/* 스토리 스트립 — 로그인 사용자만 노출 (컴포넌트 내부에서도 가드) */}
            {user && (
              <div className="feed-stories">
                <Suspense fallback={<div style={{height:80}}/>}>
                  <StoryStrip />
                </Suspense>
              </div>
            )}

            {/* 피드 헤더 */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',margin:'1.5rem 0 1rem'}}>
              <h2 style={{fontFamily:'var(--serif)',fontSize:'1.05rem',color:'var(--ink)'}}>{t('common.feed')}</h2>
              <Link href="/board" style={{color:'var(--accent)',fontFamily:'var(--mono)',fontSize:'.75rem',textDecoration:'none'}}>
                {t('common.feedAll')} →
              </Link>
            </div>

            {/* 게시글 카드 (단일 컬럼, 큰 사진) */}
            {loading ? (
              <div className="card" style={{textAlign:'center',padding:'3rem',color:'var(--muted)',fontFamily:'var(--mono)'}}>{t('common.loading')}</div>
            ) : posts.length === 0 ? (
              <div className="card" style={{textAlign:'center',padding:'3rem',color:'var(--muted)',fontFamily:'var(--mono)',fontSize:'.85rem'}}>
                {t('common.noPosts')}. <Link href="/board/write" style={{color:'var(--accent)'}}>{t('common.firstPost')}</Link>
              </div>
            ) : (
              <div className="feed-posts">
                {posts.map(p => {
                  const thumbs = Array.isArray(p.imageUrl) ? p.imageUrl : (p.imageUrl ? [p.imageUrl] : [])
                  const myLike = likedState[p.id]
                  const count = myLike?.count ?? p.likeCount ?? p.likes ?? 0
                  const liked = !!myLike?.liked
                  return (
                    <article
                      key={p.id}
                      className="feed-post"
                      onClick={(e) => handleCardClick(p, e)}
                      onTouchEnd={(e) => {
                        if (e.target.closest && e.target.closest('button, a')) return
                        handleMediaTouchEnd(p)
                      }}
                    >
                      {/* 헤더 */}
                      <header className="fp-head">
                        <Link href={`/profile/${p.authorId}`} className="fp-avatar" onClick={(e)=>e.stopPropagation()}>
                          {(p.author || '?')[0].toUpperCase()}
                        </Link>
                        <div style={{flex:1,minWidth:0}}>
                          <div className="fp-author" style={{display:'inline-flex',alignItems:'center',gap:'.25rem'}}>
                            <Link href={`/profile/${p.authorId}`} style={{color:'inherit',textDecoration:'none'}} onClick={(e)=>e.stopPropagation()}>@{p.author}</Link>
                            {p.authorVerified && <VerifiedBadge size={13}/>}
                          </div>
                          <div className="fp-time">{fmtTime(p.createdAt)} · <span className="badge" style={{fontSize:'.6rem',padding:'.05rem .35rem'}}>{p.category}</span></div>
                        </div>
                        {/* 본인 게시글이 아니면 팔로우 버튼 */}
                        {user && p.authorId && p.authorId !== user.id && (
                          <button
                            className={`fp-follow ${followingSet[p.authorId] ? 'on' : ''}`}
                            onClick={(e) => toggleFollow(p.authorId, e)}
                          >
                            {followingSet[p.authorId] ? t('common.following') : t('common.follow')}
                          </button>
                        )}
                      </header>

                      {/* 사진 — 카드 전체가 더블클릭/단일클릭 분기 */}
                      {thumbs.length > 0 && (
                        <div className="fp-media">
                          <img src={thumbs[0]} alt="" draggable={false} />
                          {thumbs.length > 1 && <div className="fp-count">+{thumbs.length - 1}</div>}
                          {pulseId === p.id && (
                            <div className="fp-heart-pulse" aria-hidden>
                              <svg viewBox="0 0 24 24" width="100" height="100" fill="#fff" stroke="rgba(0,0,0,.25)" strokeWidth="1.5">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                              </svg>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 본문 — div 로 변경, 카드 클릭 핸들러에서 board 이동 */}
                      <div className="fp-body">
                        <span className="fp-title">{p.title}</span>
                        {p.content && <div className="fp-content">{p.content.length > 140 ? p.content.slice(0,140)+'…' : p.content}</div>}
                      </div>

                      {/* 액션바 (본문 아래) — 좋아요/댓글/공유 좌측, 저장은 우측 */}
                      <div className="fp-actions">
                        <button className="fp-action" onClick={()=>toggleLike(p)} aria-label="좋아요">
                          <svg viewBox="0 0 24 24" width="26" height="26" fill={liked?'#ff3b5c':'none'} stroke={liked?'#ff3b5c':'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                          </svg>
                        </button>
                        <Link href={`/board/${p.id}`} className="fp-action" aria-label="댓글">
                          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                          </svg>
                        </Link>
                        <button className="fp-action" onClick={async (e)=>{
                          e.stopPropagation()
                          const url = `${window.location.origin}/board/${p.id}`
                          if (navigator.share) { try { await navigator.share({ title: p.title, url }); return } catch {} }
                          try { await navigator.clipboard.writeText(url); alert('링크 복사됨') } catch {}
                        }} aria-label="공유">
                          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"/>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                          </svg>
                        </button>
                        <button className="fp-action fp-save" onClick={(e)=>toggleSave(p.id, e)} aria-label={savedSet[p.id]?'저장 취소':'저장'}>
                          <svg viewBox="0 0 24 24" width="26" height="26"
                            fill={savedSet[p.id] ? 'currentColor' : 'none'}
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                          </svg>
                        </button>
                      </div>

                      {/* 음악 첨부된 경우 자동재생 + mute */}
                      {p.music?.url && (
                        <Suspense fallback={null}>
                          <PostMusic music={p.music} />
                        </Suspense>
                      )}

                      {/* 좋아요 카운트 + 댓글 링크 (액션바 아래) */}
                      <div className="fp-likes">{count.toLocaleString()} {t('common.likes')}</div>
                      <Link href={`/board/${p.id}`} className="fp-view-more">
                        {t('common.viewComments')} · {t('common.views')} {p.views || 0}
                      </Link>
                    </article>
                  )
                })}
              </div>
            )}
          </div>

          {/* 사이드 (데스크탑 + 로그인 사용자만) */}
          {user && (
            <aside className="feed-side">
              {/* 본인 미니 프로필 */}
              <div className="feed-side-me">
                <Link href={`/profile/${user.id}`} className="fsm-avatar">
                  {user.avatar
                    ? <img src={user.avatar} alt={user.name}/>
                    : <span>{(user.name||'?')[0].toUpperCase()}</span>
                  }
                </Link>
                <div style={{flex:1,minWidth:0}}>
                  <Link href={`/profile/${user.id}`} className="fsm-name">{user.name}</Link>
                  <div className="fsm-sub">{user.email}</div>
                </div>
                <Link href="/settings" className="fsm-settings">설정</Link>
              </div>

              {/* 추천 사용자 — 박스 안 아닌 자연스러운 영역 */}
              <Suspense fallback={<div style={{minHeight:120}}/>}>
                <SuggestedUsers initial={5} expandedSize={18} />
              </Suspense>

              <div className="feed-side-foot">
                <Link href="/about">소개</Link>
                <Link href="/board">게시판</Link>
                <Link href="/galleries">갤러리</Link>
                <Link href="/games">게임</Link>
                <Link href="/shop">쇼핑몰</Link>
              </div>
              <div className="feed-side-copy">© Altroboard · altrofast11x2</div>
            </aside>
          )}
        </div>
      </div>

      <footer style={{borderTop:'1px solid var(--border)',padding:'1.5rem',textAlign:'center',fontFamily:'var(--mono)',fontSize:'.72rem',color:'var(--muted)'}}>
        Altroboard © altrofast11x2
      </footer>

      {/* MessageFab 은 layout.js 에서 전역 마운트 — 여기선 추가 안 함 */}

      {/* 로그인 안내 모달 */}
      {loginPrompt && (
        <div className="lp-overlay" onClick={()=>setLoginPrompt(false)}>
          <div className="lp-card" onClick={e=>e.stopPropagation()} role="dialog" aria-label="로그인 안내">
            <button className="lp-close" onClick={()=>setLoginPrompt(false)} aria-label="닫기">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <div className="lp-heart" aria-hidden>
              <svg viewBox="0 0 24 24" width="56" height="56" fill="#ff3b5c" stroke="#ff3b5c" strokeWidth="1.5">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </div>
            <h3 className="lp-title">{t('login.heart')}</h3>
            <p className="lp-sub">{t('login.body')}</p>
            <div className="lp-btns">
              <button className="lp-btn lp-primary" onClick={()=>router.push('/login')}>{t('login.do')}</button>
              <button className="lp-btn" onClick={()=>setLoginPrompt(false)}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .feed-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:2rem;}
        .feed-main{min-width:0;max-width:520px;margin:0 auto;}
        .feed-side{position:sticky;top:1rem;height:fit-content;padding:1rem 0;display:flex;flex-direction:column;gap:1rem;}
        .feed-side-me{display:flex;align-items:center;gap:.75rem;padding:.25rem;}
        .fsm-avatar{width:46px;height:46px;border-radius:50%;background:var(--accent);color:#fff;font-family:var(--serif);font-size:1.1rem;font-weight:700;display:flex;align-items:center;justify-content:center;overflow:hidden;text-decoration:none;flex-shrink:0;}
        .fsm-avatar img{width:100%;height:100%;object-fit:cover;}
        .fsm-name{font-family:var(--mono);font-size:.85rem;font-weight:700;color:var(--ink);text-decoration:none;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .fsm-name:hover{color:var(--accent);}
        .fsm-sub{font-family:var(--mono);font-size:.68rem;color:var(--muted);margin-top:.1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .fsm-settings{font-family:var(--mono);font-size:.72rem;color:var(--accent);font-weight:700;text-decoration:none;padding:.2rem .4rem;}
        .fsm-settings:hover{color:var(--accent2);}
        .feed-side-foot{display:flex;flex-wrap:wrap;gap:.4rem .7rem;padding:.5rem .25rem;font-family:var(--mono);font-size:.68rem;}
        .feed-side-foot a{color:var(--muted);text-decoration:none;}
        .feed-side-foot a:hover{color:var(--accent);}
        .feed-side-copy{font-family:var(--mono);font-size:.62rem;color:var(--muted);padding:.25rem;}
        @media(max-width:900px){.feed-grid{grid-template-columns:1fr;}.feed-side{display:none;}}

        .feed-stories{background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:.75rem 1rem;}

        .feed-posts{display:flex;flex-direction:column;gap:1.25rem;}
        .feed-post{background:var(--surface);border:1px solid var(--border);border-radius:6px;overflow:hidden;cursor:pointer;user-select:none;}

        .fp-head{display:flex;align-items:center;gap:.6rem;padding:.75rem 1rem;border-bottom:1px solid var(--border);}
        .fp-avatar{width:36px;height:36px;border-radius:50%;background:var(--accent);color:#fff;font-family:var(--serif);font-weight:700;display:flex;align-items:center;justify-content:center;text-decoration:none;font-size:.9rem;flex-shrink:0;}
        .fp-author{font-family:var(--mono);font-size:.85rem;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .fp-time{font-family:var(--mono);font-size:.68rem;color:var(--muted);margin-top:.15rem;display:flex;gap:.4rem;align-items:center;}

        .fp-media{display:block;position:relative;aspect-ratio:1/1;background:#000;overflow:hidden;user-select:none;}
        .fp-media img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;}
        .fp-count{position:absolute;top:.6rem;right:.6rem;background:rgba(0,0,0,.7);color:#fff;font-family:var(--mono);font-size:.7rem;padding:.15rem .5rem;border-radius:10px;z-index:2;}
        .fp-heart-pulse{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;animation:fp-pop .8s ease-out forwards;z-index:3;}
        @keyframes fp-pop{
          0%{opacity:0;transform:scale(.3);}
          15%{opacity:1;transform:scale(1.2);}
          30%{transform:scale(1);}
          80%{opacity:1;}
          100%{opacity:0;transform:scale(1);}
        }

        .fp-body{display:block;padding:.75rem 1rem .25rem;font-size:.92rem;line-height:1.55;color:var(--text);text-decoration:none;word-break:break-word;}
        .fp-action{cursor:pointer;}
        .fp-title{font-family:var(--serif);font-weight:700;font-size:1.02rem;color:var(--ink);display:block;margin-bottom:.25rem;}
        .fp-content{color:var(--muted);font-size:.85rem;line-height:1.6;}

        .fp-actions{display:flex;gap:.85rem;padding:.5rem 1rem .35rem;border-top:1px solid var(--border);margin-top:.25rem;}
        .fp-action{background:none;border:none;color:var(--text);cursor:pointer;padding:.2rem;display:flex;align-items:center;}
        .fp-action:hover{color:var(--accent);}
        .fp-action svg{display:block;}
        .fp-save{margin-left:auto;}
        .fp-follow{
          background:none;border:none;color:var(--accent);font-family:var(--mono);
          font-size:.78rem;font-weight:700;cursor:pointer;padding:.2rem .35rem;
          margin-left:auto;flex-shrink:0;
        }
        .fp-follow:hover{color:var(--accent2);}
        .fp-follow.on{color:var(--muted);font-weight:500;}

        .fp-likes{padding:0 1rem .25rem;font-family:var(--mono);font-size:.78rem;font-weight:700;color:var(--text);}
        .fp-view-more{display:block;padding:.1rem 1rem .85rem;font-family:var(--mono);font-size:.72rem;color:var(--muted);text-decoration:none;}
        .fp-view-more:hover{color:var(--accent);}

        /* ── 로그인 안내 모달 ── */
        .lp-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9000;display:flex;align-items:center;justify-content:center;padding:1rem;animation:lp-fade .18s ease;}
        @keyframes lp-fade{from{opacity:0}to{opacity:1}}
        .lp-card{position:relative;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:14px;padding:1.8rem 1.6rem 1.4rem;width:min(360px,92vw);text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.4);animation:lp-pop .25s ease;}
        @keyframes lp-pop{from{transform:scale(.9);opacity:0}to{transform:none;opacity:1}}
        .lp-close{position:absolute;top:.6rem;right:.6rem;background:none;border:none;color:var(--muted);cursor:pointer;padding:.3rem;border-radius:6px;display:flex;}
        .lp-close:hover{color:var(--text);background:var(--surface2);}
        .lp-heart{margin:.3rem auto .65rem;display:flex;justify-content:center;animation:lp-beat 1.2s ease-in-out infinite;}
        @keyframes lp-beat{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
        .lp-title{font-family:var(--serif);font-size:1.15rem;font-weight:700;color:var(--ink);margin-bottom:.45rem;}
        .lp-sub{font-family:var(--font);font-size:.85rem;color:var(--muted);line-height:1.55;margin-bottom:1.1rem;}
        .lp-btns{display:flex;gap:.55rem;justify-content:center;}
        .lp-btn{padding:.55rem 1.1rem;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--mono);font-size:.8rem;cursor:pointer;font-weight:600;}
        .lp-btn:hover{background:var(--surface2);}
        .lp-primary{background:linear-gradient(135deg,#ff3b5c,#c0392b);color:#fff;border:none;}
        .lp-primary:hover{filter:brightness(1.05);}
      `}</style>
    </main>
  )
}
