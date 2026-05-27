'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

// 스토리 뷰어 모달 — Instagram 정확히 복제.
// 풀스크린 검은 배경 + 가운데 큰 카드 + 좌우 옆 사용자 미리보기.

const fontClass = { sans: 'var(--font)', serif: 'var(--serif)', mono: 'var(--mono)' }

export default function StoryViewer({ group, groups = [], startIdx = 0, user, onClose, onDelete, onEdit, onNavGroup }) {
  const [idx, setIdx] = useState(startIdx)
  const [progKey, setProgKey] = useState(0)
  const [muted, setMuted] = useState(true)
  const timerRef = useRef(null)
  const audioRef = useRef(null)

  const story = group?.stories?.[idx]

  // 조회 카운트
  useEffect(() => {
    if (!story || !user) return
    fetch(`/api/stories/${story.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    }).catch(() => {})
  }, [story?.id, user?.id])

  // 음악 — 스토리 변경마다 재시작
  useEffect(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (story?.music?.url) {
      const a = new Audio(story.music.url)
      a.muted = muted
      a.loop = true
      a.play().catch(() => {})
      audioRef.current = a
    }
    return () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null } }
  }, [story?.id])

  // mute 토글 즉시 반영
  useEffect(() => { if (audioRef.current) audioRef.current.muted = muted }, [muted])

  // 5초 자동 진행
  useEffect(() => {
    if (!story) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (idx + 1 < group.stories.length) { setIdx(idx + 1); setProgKey(k => k + 1) }
      else onClose?.()
    }, 5000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [idx, story?.id])

  // ESC 닫기 + 좌우 키
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx, group?.authorId])

  const prev = (e) => {
    e?.stopPropagation?.()
    if (idx > 0) { setIdx(idx - 1); setProgKey(k => k + 1) }
  }
  const next = (e) => {
    e?.stopPropagation?.()
    if (idx + 1 < group.stories.length) { setIdx(idx + 1); setProgKey(k => k + 1) }
    else onClose?.()
  }

  if (!group || !story) return null

  // 인접 그룹
  const curGroupIdx = groups.findIndex(g => g.authorId === group.authorId)
  const prevGroup = curGroupIdx > 0 ? groups[curGroupIdx - 1] : null
  const nextGroup = curGroupIdx >= 0 && curGroupIdx < groups.length - 1 ? groups[curGroupIdx + 1] : null

  const fmtTime = (iso) => {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return '방금'
    if (m < 60) return `${m}분`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}시간`
    const d = Math.floor(h / 24)
    return `${d}일`
  }

  return (
    <div className="svm-root" onClick={onClose}>
      {/* 닫기 (우상단) */}
      <button className="svm-close" onClick={onClose} aria-label="닫기">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      {/* 중앙 라인 — flex 로 [prev | main | next] */}
      <div className="svm-track" onClick={e => e.stopPropagation()}>

        {/* 이전 그룹 미리보기 */}
        <button
          type="button"
          className={`svm-side ${prevGroup ? '' : 'svm-side-empty'}`}
          onClick={() => prevGroup && onNavGroup?.(prevGroup)}
          aria-label="이전 사용자"
        >
          {prevGroup && (
            <div className="svm-side-card" style={{ background: prevGroup.bg || '#1a1208' }}>
              {prevGroup.stories?.[0]?.imageUrl && (
                <img src={prevGroup.stories[0].imageUrl} alt="" className="svm-side-bg"/>
              )}
              <div className="svm-side-fade"/>
              <div className="svm-side-foot">
                <div className="svm-side-av">
                  {prevGroup.authorAvatar
                    ? <img src={prevGroup.authorAvatar} alt=""/>
                    : <span>{(prevGroup.authorName || '?')[0].toUpperCase()}</span>}
                </div>
                <span className="svm-side-name">{prevGroup.authorName}</span>
              </div>
            </div>
          )}
        </button>

        {/* 메인 스토리 카드 */}
        <div className="svm-card" style={{ background: story.bgColor || '#1a1208' }}>
          {/* 배경 이미지 (있을 때 풀필) */}
          {story.imageUrl && (
            <img src={story.imageUrl} alt="" className="svm-bg"/>
          )}

          {/* 진행 바 */}
          <div className="svm-prog">
            {group.stories.map((_, i) => (
              <div key={i} className="svm-prog-bg">
                <div className={`svm-prog-fill ${i === idx ? 'active' : i < idx ? 'done' : ''}`}
                  key={i === idx ? progKey : i}/>
              </div>
            ))}
          </div>

          {/* 헤더 */}
          <div className="svm-head">
            <div className="svm-head-left">
              <div className="svm-av">
                {story.authorAvatar
                  ? <img src={story.authorAvatar} alt=""/>
                  : <span>{(story.authorName || '?')[0].toUpperCase()}</span>}
              </div>
              <Link href={`/profile/${story.authorId}`} className="svm-name">{story.authorName}</Link>
              <span className="svm-time">{fmtTime(story.createdAt)}</span>
            </div>
            <div className="svm-head-right">
              {story.music?.url && (
                <button className="svm-btn" onClick={() => setMuted(m => !m)} aria-label={muted ? '음소거 해제' : '음소거'}>
                  {muted ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                    </svg>
                  )}
                </button>
              )}
              {user?.id === story.authorId && onEdit && (
                <button className="svm-btn" onClick={() => onEdit(story)} aria-label="편집">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              )}
              {user && (user.id === story.authorId || ['owner','admin'].includes(user.role)) && onDelete && (
                <button className="svm-btn" onClick={() => onDelete(story.id)} aria-label="삭제">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                </button>
              )}
            </div>
          </div>

          {/* 본문 (텍스트/자막) */}
          <div className="svm-content">
            {story.caption && (
              <div className="svm-caption" style={{ fontFamily: fontClass[story.font] || 'var(--font)' }}>{story.caption}</div>
            )}
            {story.content && !story.imageUrl && (
              <p className="svm-text" style={{ fontFamily: fontClass[story.font] || 'var(--font)' }}>{story.content}</p>
            )}
            {story.content && story.imageUrl && (
              <p className="svm-text-overlay" style={{ fontFamily: fontClass[story.font] || 'var(--font)' }}>{story.content}</p>
            )}
          </div>

          {/* 하단 음악 pill */}
          {story.music && (
            <div className="svm-music">
              {story.music.thumbnail && <img src={story.music.thumbnail} alt=""/>}
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,opacity:.85}}>
                <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
              </svg>
              <span className="svm-music-text">{story.music.title}{story.music.author ? ` · ${story.music.author}` : ''}</span>
            </div>
          )}

          {/* 탭 영역 (좌/우) */}
          <div className="svm-tap-l" onClick={prev}/>
          <div className="svm-tap-r" onClick={next}/>
        </div>

        {/* 다음 그룹 미리보기 */}
        <button
          type="button"
          className={`svm-side ${nextGroup ? '' : 'svm-side-empty'}`}
          onClick={() => nextGroup && onNavGroup?.(nextGroup)}
          aria-label="다음 사용자"
        >
          {nextGroup && (
            <div className="svm-side-card" style={{ background: nextGroup.bg || '#1a1208' }}>
              {nextGroup.stories?.[0]?.imageUrl && (
                <img src={nextGroup.stories[0].imageUrl} alt="" className="svm-side-bg"/>
              )}
              <div className="svm-side-fade"/>
              <div className="svm-side-foot">
                <div className="svm-side-av">
                  {nextGroup.authorAvatar
                    ? <img src={nextGroup.authorAvatar} alt=""/>
                    : <span>{(nextGroup.authorName || '?')[0].toUpperCase()}</span>}
                </div>
                <span className="svm-side-name">{nextGroup.authorName}</span>
              </div>
            </div>
          )}
        </button>
      </div>

      <style jsx>{`
        .svm-root{
          position:fixed; inset:0; z-index:9000;
          background:#000;
          display:flex; align-items:center; justify-content:center;
        }
        .svm-close{
          position:fixed; top:1rem; right:1.2rem;
          background:none; border:none; color:#fff; cursor:pointer;
          width:36px; height:36px; border-radius:50%;
          display:flex; align-items:center; justify-content:center;
          opacity:.85; z-index:9100;
        }
        .svm-close:hover{ opacity:1; background:rgba(255,255,255,.08); }

        .svm-track{
          display:flex; align-items:center; justify-content:center;
          gap:1rem;
          height:100%;
          padding:1rem;
        }

        /* 메인 스토리 카드 */
        .svm-card{
          position:relative;
          width:min(380px, 92vw);
          height:min(680px, 88vh);
          aspect-ratio: 9/16;
          border-radius:14px;
          overflow:hidden;
          box-shadow:0 20px 60px rgba(0,0,0,.6);
          flex-shrink:0;
        }
        .svm-bg{
          position:absolute; inset:0; width:100%; height:100%;
          object-fit:cover; z-index:0;
        }

        /* 진행 바 */
        .svm-prog{
          position:relative; z-index:3;
          display:flex; gap:3px;
          padding:.7rem .7rem 0;
        }
        .svm-prog-bg{
          flex:1; height:2.5px;
          background:rgba(255,255,255,.3);
          border-radius:2px; overflow:hidden;
        }
        .svm-prog-fill{
          height:100%; background:#fff; border-radius:2px; width:0;
        }
        .svm-prog-fill.done{ width:100%; }
        .svm-prog-fill.active{ animation:svm-prog 5s linear forwards; }
        @keyframes svm-prog{ from{width:0} to{width:100%} }

        /* 헤더 */
        .svm-head{
          position:relative; z-index:3;
          display:flex; justify-content:space-between; align-items:center;
          padding:.55rem .85rem;
        }
        .svm-head-left{
          display:flex; align-items:center; gap:.5rem;
          flex:1; min-width:0;
          text-shadow:0 1px 3px rgba(0,0,0,.5);
        }
        .svm-head-right{
          display:flex; align-items:center; gap:.25rem;
          flex-shrink:0;
        }
        .svm-av{
          width:30px; height:30px; border-radius:50%;
          background:rgba(255,255,255,.2); color:#fff;
          font-family:var(--serif); font-weight:700; font-size:.8rem;
          display:flex; align-items:center; justify-content:center;
          overflow:hidden; flex-shrink:0;
        }
        .svm-av img{ width:100%; height:100%; object-fit:cover; }
        .svm-name{
          color:#fff; font-family:var(--mono);
          font-size:.8rem; font-weight:600;
          text-decoration:none;
          overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }
        .svm-time{
          color:rgba(255,255,255,.7);
          font-family:var(--mono); font-size:.7rem;
          flex-shrink:0;
        }
        .svm-btn{
          background:rgba(255,255,255,.08); border:none;
          color:#fff; opacity:.85;
          width:28px; height:28px; border-radius:50%;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer;
        }
        .svm-btn:hover{ opacity:1; background:rgba(255,255,255,.18); }

        /* 본문 */
        .svm-content{
          position:absolute; inset:0;
          display:flex; flex-direction:column; justify-content:center; align-items:center;
          padding:3.5rem 1.5rem;
          z-index:2;
          pointer-events:none;
        }
        .svm-caption{
          color:#fff; font-size:1.05rem; font-weight:600;
          background:rgba(0,0,0,.5); backdrop-filter:blur(6px);
          padding:.45rem .85rem; border-radius:8px;
          text-align:center; max-width:85%; word-break:break-word;
          text-shadow:0 1px 3px rgba(0,0,0,.6);
        }
        .svm-text{
          color:#fff; font-size:1.25rem; line-height:1.75;
          text-align:center; white-space:pre-wrap; word-break:break-word;
          text-shadow:0 1px 4px rgba(0,0,0,.5);
        }
        .svm-text-overlay{
          color:#fff; font-size:1.15rem; line-height:1.65;
          text-align:center; white-space:pre-wrap; word-break:break-word;
          background:rgba(0,0,0,.5); backdrop-filter:blur(6px);
          padding:.5rem 1rem; border-radius:10px;
          max-width:85%; text-shadow:0 1px 3px rgba(0,0,0,.6);
        }

        /* 음악 pill (하단) — 사용자 요청대로 더 투명 */
        .svm-music{
          position:absolute; left:50%; bottom:1.1rem;
          transform:translateX(-50%);
          display:flex; align-items:center; gap:.4rem;
          background:rgba(0,0,0,.28);
          backdrop-filter:blur(8px);
          border-radius:999px; padding:.3rem .7rem;
          color:rgba(255,255,255,.92);
          font-family:var(--mono); font-size:.68rem;
          max-width:80%; z-index:3;
        }
        .svm-music img{
          width:20px; height:20px; border-radius:50%;
          object-fit:cover; flex-shrink:0; opacity:.85;
        }
        .svm-music-text{
          overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }

        /* 탭 영역 */
        .svm-tap-l{ position:absolute; left:0; top:0; width:35%; height:100%; z-index:4; cursor:pointer; }
        .svm-tap-r{ position:absolute; right:0; top:0; width:35%; height:100%; z-index:4; cursor:pointer; }

        /* 옆 사용자 미리보기 카드 */
        .svm-side{
          background:none; border:none; padding:0;
          cursor:pointer; flex-shrink:0;
        }
        .svm-side-empty{ visibility:hidden; }
        .svm-side-card{
          position:relative;
          width:min(140px, 14vw); height:min(250px, 50vh);
          aspect-ratio:9/16;
          border-radius:10px;
          overflow:hidden;
          opacity:.55;
          transition:opacity .15s, transform .15s;
        }
        .svm-side:hover .svm-side-card{ opacity:.85; transform:scale(1.02); }
        .svm-side-bg{
          position:absolute; inset:0; width:100%; height:100%;
          object-fit:cover;
        }
        .svm-side-fade{
          position:absolute; inset:0;
          background:linear-gradient(180deg, rgba(0,0,0,.2) 0%, rgba(0,0,0,0) 50%, rgba(0,0,0,.6) 100%);
        }
        .svm-side-foot{
          position:absolute; left:0; right:0; bottom:.55rem;
          display:flex; flex-direction:column; align-items:center; gap:.3rem;
        }
        .svm-side-av{
          width:32px; height:32px; border-radius:50%;
          background:rgba(255,255,255,.25); color:#fff;
          font-family:var(--serif); font-weight:700; font-size:.85rem;
          display:flex; align-items:center; justify-content:center;
          overflow:hidden; border:2px solid #fff;
        }
        .svm-side-av img{ width:100%; height:100%; object-fit:cover; }
        .svm-side-name{
          color:#fff; font-family:var(--mono); font-size:.65rem; font-weight:600;
          text-shadow:0 1px 3px rgba(0,0,0,.7);
          overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
          max-width:130px;
        }

        @media (max-width:760px){
          .svm-side{ display:none; }
        }
      `}</style>
    </div>
  )
}
