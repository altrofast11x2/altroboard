'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

// 스토리 뷰어 모달 — Instagram 패턴.
// 음악 첨부 시 자동 재생 + mute 토글.
//
// props:
//   - group: { authorId, authorName, authorAvatar, stories: [...] }
//   - groups?: 모든 그룹 (옆 미리보기용)
//   - startIdx: 시작 인덱스
//   - user: 현재 사용자
//   - onClose: () => void
//   - onDelete?: (storyId) => void
//   - onEdit?: (story) => void
//   - onNavGroup?: (newGroup) => void (옆 카드 클릭 시)

const fontClass = { sans: 'var(--font)', serif: 'var(--serif)', mono: 'var(--mono)' }

export default function StoryViewer({ group, groups = [], startIdx = 0, user, onClose, onDelete, onEdit, onNavGroup }) {
  const [idx, setIdx] = useState(startIdx)
  const [progKey, setProgKey] = useState(0)
  const [muted, setMuted] = useState(true)   // 기본 mute (브라우저 자동재생 정책)
  const timerRef = useRef(null)
  const audioRef = useRef(null)

  const story = group?.stories?.[idx]

  // 뷰 카운트
  useEffect(() => {
    if (!story || !user) return
    fetch(`/api/stories/${story.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    }).catch(() => {})
  }, [story?.id, user?.id])

  // 음악 재생 — 스토리 변경마다 재시작
  useEffect(() => {
    if (!story) return
    // 이전 오디오 정리
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (story.music?.url) {
      const a = new Audio(story.music.url)
      a.muted = muted
      a.loop = true
      a.play().catch(() => {})
      audioRef.current = a
    }
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    }
  }, [story?.id])

  // mute 토글 시 현재 오디오에 반영
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted
  }, [muted])

  // 자동 진행 (5초)
  useEffect(() => {
    if (!story) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (idx + 1 < group.stories.length) {
        setIdx(idx + 1)
        setProgKey(k => k + 1)
      } else {
        onClose?.()
      }
    }, 5000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [idx, story?.id])

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

  // 인접 그룹 (이전/다음 사용자) — Instagram 옆 미리보기용
  const curGroupIdx = groups.findIndex(g => g.authorId === group.authorId)
  const prevGroup = curGroupIdx > 0 ? groups[curGroupIdx - 1] : null
  const nextGroup = curGroupIdx >= 0 && curGroupIdx < groups.length - 1 ? groups[curGroupIdx + 1] : null

  return (
    <div className="sv-overlay" onClick={onClose}>
      {/* 좌측 닫기 X — Instagram 처럼 화면 우상단 */}
      <button className="sv-overlay-close" onClick={onClose} aria-label="닫기">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      {/* 이전 그룹 카드 (왼쪽) */}
      {prevGroup && (
        <div className="sv-side sv-side-left" onClick={(e) => { e.stopPropagation(); onNavGroup?.(prevGroup) }}>
          <div className="sv-side-card" style={{ background: prevGroup.bg || prevGroup.stories?.[0]?.bgColor || '#1a1208' }}>
            <div className="sv-side-overlay">
              {prevGroup.authorAvatar
                ? <img src={prevGroup.authorAvatar} alt="" className="sv-side-av"/>
                : <div className="sv-side-av sv-side-av-ph">{(prevGroup.authorName || '?')[0].toUpperCase()}</div>
              }
              <div className="sv-side-name">{prevGroup.authorName}</div>
            </div>
          </div>
        </div>
      )}

      <div className="sv-card" style={{ background: story.bgColor || '#1a1208' }} onClick={e => e.stopPropagation()}>
        {/* progress bars */}
        <div className="sv-progress">
          {group.stories.map((_, i) => (
            <div key={i} className="sv-prog-bg">
              <div className={`sv-prog-fill ${i === idx ? 'active' : i < idx ? 'done' : ''}`}
                key={i === idx ? progKey : i} />
            </div>
          ))}
        </div>

        {/* header */}
        <div className="sv-header">
          <div style={{ display:'flex', alignItems:'center', gap:'.6rem' }}>
            <div className="sv-avatar">
              {story.authorAvatar
                ? <img src={story.authorAvatar} alt=""/>
                : <span>{(story.authorName || '?')[0].toUpperCase()}</span>
              }
            </div>
            <div>
              <Link href={`/profile/${story.authorId}`} style={{ color:'#fff', fontFamily:'var(--mono)', fontSize:'.8rem', fontWeight:600, textDecoration:'none' }}>
                {story.authorName}
              </Link>
              <div style={{ color:'rgba(255,255,255,.55)', fontFamily:'var(--mono)', fontSize:'.62rem' }}>
                {new Date(story.createdAt).toLocaleString('ko-KR')}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:'.4rem', alignItems:'center' }}>
            {/* 음악 있으면 mute 토글 */}
            {story.music?.url && (
              <button className="sv-icon-btn" onClick={() => setMuted(m => !m)} aria-label={muted ? '음소거 해제' : '음소거'} title={muted ? '음소거 해제' : '음소거'}>
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
              <button className="sv-icon-btn" onClick={() => onEdit(story)} aria-label="편집">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            )}
            {user && (user.id === story.authorId || ['owner','admin'].includes(user.role)) && onDelete && (
              <button className="sv-icon-btn" onClick={() => onDelete(story.id)} aria-label="삭제">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
              </button>
            )}
            <button className="sv-close" onClick={onClose} aria-label="닫기">✕</button>
          </div>
        </div>

        {/* content */}
        <div className="sv-body">
          {story.imageUrl && (
            story.content ? (
              <img src={story.imageUrl} alt="" style={{ maxWidth:'100%', maxHeight:'50%', borderRadius:8, objectFit:'contain', marginBottom:'.75rem' }} />
            ) : (
              <img src={story.imageUrl} alt=""
                style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', zIndex:0, borderRadius:16 }} />
            )
          )}
          {story.imageUrl && story.caption && (
            <div className="sv-caption" style={{ fontFamily: fontClass[story.font] || 'var(--font)' }}>{story.caption}</div>
          )}
          {story.content && (
            <p className="sv-text" style={{ fontFamily: fontClass[story.font] || 'var(--font)' }}>{story.content}</p>
          )}
          {story.music && (
            <div className="sv-music-pill">
              {story.music.thumbnail && <img src={story.music.thumbnail} alt=""/>}
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
              </svg>
              <span className="sv-music-marquee">{story.music.title}{story.music.author ? ` · ${story.music.author}` : ''}</span>
            </div>
          )}
        </div>

        {/* tap zones */}
        <div className="sv-tap-left"  onClick={prev}/>
        <div className="sv-tap-right" onClick={next}/>
      </div>

      {/* 다음 그룹 카드 (오른쪽) */}
      {nextGroup && (
        <div className="sv-side sv-side-right" onClick={(e) => { e.stopPropagation(); onNavGroup?.(nextGroup) }}>
          <div className="sv-side-card" style={{ background: nextGroup.bg || nextGroup.stories?.[0]?.bgColor || '#1a1208' }}>
            <div className="sv-side-overlay">
              {nextGroup.authorAvatar
                ? <img src={nextGroup.authorAvatar} alt="" className="sv-side-av"/>
                : <div className="sv-side-av sv-side-av-ph">{(nextGroup.authorName || '?')[0].toUpperCase()}</div>
              }
              <div className="sv-side-name">{nextGroup.authorName}</div>
            </div>
          </div>
        </div>
      )}

      <div style={{display:'none'}}>{/* end placeholder for original closing */}

        <style jsx>{`
          .sv-overlay{position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:8000;display:flex;align-items:center;justify-content:center;padding:1rem;}
          .sv-card{position:relative;width:min(380px,92vw);height:min(640px,85vh);border-radius:16px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.6);}
          .sv-progress{display:flex;gap:3px;padding:.75rem .75rem 0;position:relative;z-index:2;}
          .sv-prog-bg{flex:1;height:2.5px;background:rgba(255,255,255,.25);border-radius:2px;overflow:hidden;}
          .sv-prog-fill{height:100%;background:#fff;border-radius:2px;width:0;}
          .sv-prog-fill.done{width:100%;}
          .sv-prog-fill.active{animation:sv-prog 5s linear forwards;}
          @keyframes sv-prog{from{width:0}to{width:100%}}
          .sv-header{display:flex;justify-content:space-between;align-items:center;padding:.6rem .9rem;position:relative;z-index:2;}
          .sv-avatar{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;overflow:hidden;color:#fff;font-family:var(--serif);font-weight:700;font-size:.9rem;flex-shrink:0;}
          .sv-avatar img{width:100%;height:100%;object-fit:cover;}
          .sv-icon-btn{background:rgba(255,255,255,.1);border:none;color:rgba(255,255,255,.85);width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;}
          .sv-icon-btn:hover{background:rgba(255,255,255,.2);color:#fff;}
          .sv-close{background:none;border:none;color:rgba(255,255,255,.7);font-size:1.1rem;cursor:pointer;padding:.2rem .5rem;border-radius:4px;}
          .sv-close:hover{color:#fff;background:rgba(255,255,255,.1);}
          .sv-body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem 1.5rem;position:relative;z-index:1;}
          .sv-text{color:#fff;font-size:1.25rem;line-height:1.75;text-align:center;word-break:break-word;white-space:pre-wrap;text-shadow:0 1px 4px rgba(0,0,0,.5);position:relative;z-index:1;}
          .sv-caption{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);max-width:85%;color:#fff;font-size:1.1rem;font-weight:600;text-align:center;padding:.5rem .9rem;background:rgba(0,0,0,.5);backdrop-filter:blur(6px);border-radius:8px;word-break:break-word;text-shadow:0 1px 3px rgba(0,0,0,.6);z-index:2;}
          /* 음악 pill — 사용자 요청대로 더 투명하게 (0.55 → 0.28) */
          .sv-music-pill{position:absolute;left:50%;bottom:1.2rem;transform:translateX(-50%);display:flex;align-items:center;gap:.4rem;background:rgba(0,0,0,.28);backdrop-filter:blur(8px);border-radius:999px;padding:.3rem .7rem;color:rgba(255,255,255,.92);font-family:var(--mono);font-size:.68rem;max-width:80%;z-index:3;}
          .sv-music-pill img{width:20px;height:20px;border-radius:50%;object-fit:cover;flex-shrink:0;opacity:.85;}

          /* 옆 사용자 미리보기 카드 (Instagram 스타일) */
          .sv-side{position:relative;cursor:pointer;flex-shrink:0;}
          .sv-side-card{width:min(180px,18vw);height:min(280px,55vh);border-radius:12px;overflow:hidden;opacity:.55;transition:opacity .15s, transform .15s;position:relative;box-shadow:0 8px 24px rgba(0,0,0,.4);}
          .sv-side:hover .sv-side-card{opacity:.85;transform:scale(1.02);}
          .sv-side-left{margin-right:.6rem;}
          .sv-side-right{margin-left:.6rem;}
          .sv-side-overlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 50%,rgba(0,0,0,.55) 100%);display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding:.85rem;gap:.4rem;}
          .sv-side-av{width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid #fff;}
          .sv-side-av-ph{background:var(--accent);color:#fff;font-family:var(--serif);font-weight:700;font-size:1rem;display:flex;align-items:center;justify-content:center;}
          .sv-side-name{color:#fff;font-family:var(--mono);font-size:.72rem;font-weight:600;text-shadow:0 1px 3px rgba(0,0,0,.6);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;}

          /* Instagram 같이 우상단 닫기 */
          .sv-overlay-close{position:fixed;top:1.2rem;right:1.2rem;background:none;border:none;color:#fff;cursor:pointer;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;opacity:.85;transition:opacity .15s;z-index:8100;}
          .sv-overlay-close:hover{opacity:1;background:rgba(255,255,255,.08);}

          @media(max-width:760px){
            .sv-side{display:none;}
          }
          .sv-music-marquee{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
          .sv-tap-left{position:absolute;left:0;top:0;width:35%;height:100%;z-index:3;cursor:pointer;}
          .sv-tap-right{position:absolute;right:0;top:0;width:35%;height:100%;z-index:3;cursor:pointer;}
        `}</style>
      </div>
    </div>
  )
}
