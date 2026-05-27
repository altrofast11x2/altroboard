'use client'
import { useEffect, useRef, useState } from 'react'

// 게시글에 첨부된 음악 표시 — 자동재생 + mute 토글.
// 메인 피드(보일 때만 재생) / 게시글 상세 양쪽에서 사용.
//
// props:
//   - music: { url, title, author, thumbnail }
//   - autoPlay: 카드가 뷰포트 내에 들어왔을 때만 자동 재생 (기본 true)

export default function PostMusic({ music, autoPlay = true }) {
  const [muted, setMuted] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [inView, setInView] = useState(false)
  const audioRef = useRef(null)
  const rootRef = useRef(null)

  // viewport 내 노출 시 자동재생, 빠지면 정지
  useEffect(() => {
    if (!autoPlay) return
    if (!rootRef.current) return
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio > 0.5),
      { threshold: [0, 0.5, 1] }
    )
    obs.observe(rootRef.current)
    return () => obs.disconnect()
  }, [autoPlay])

  useEffect(() => {
    if (!music?.url) return
    if (!audioRef.current) {
      const a = new Audio(music.url)
      a.loop = true
      audioRef.current = a
    }
    const a = audioRef.current
    a.muted = muted
    if (inView && autoPlay) {
      a.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    } else {
      a.pause()
      setPlaying(false)
    }
    return () => {
      if (audioRef.current) { audioRef.current.pause() }
    }
  }, [inView, music?.url, autoPlay])

  // 언마운트 시 정리
  useEffect(() => () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
  }, [])

  // mute 변경 즉시 반영
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted
  }, [muted])

  if (!music?.url) return null

  return (
    <div ref={rootRef} className="pm-pill">
      {music.thumbnail
        ? <img src={music.thumbnail} alt="" className="pm-thumb"/>
        : <div className="pm-thumb pm-thumb-ph">♪</div>
      }
      <div className="pm-text">
        <div className="pm-title">{music.title}</div>
        {music.author && <div className="pm-author">{music.author}</div>}
      </div>
      <button
        type="button"
        className="pm-mute"
        onClick={(e) => { e.stopPropagation(); setMuted(m => !m) }}
        aria-label={muted ? '소리 켜기' : '소리 끄기'}
        title={muted ? '소리 켜기' : '소리 끄기'}
      >
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

      <style jsx>{`
        .pm-pill{display:flex;align-items:center;gap:.55rem;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:.45rem .7rem;margin:.4rem 1rem;}
        .pm-thumb{width:32px;height:32px;border-radius:6px;object-fit:cover;flex-shrink:0;}
        .pm-thumb-ph{background:linear-gradient(135deg,var(--ink),var(--surface2));display:flex;align-items:center;justify-content:center;color:rgba(245,240,232,.6);font-size:1rem;}
        .pm-text{flex:1;min-width:0;}
        .pm-title{font-family:var(--serif);font-weight:600;font-size:.82rem;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .pm-author{font-family:var(--mono);font-size:.66rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .pm-mute{background:var(--accent);color:#fff;border:none;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;}
        .pm-mute:hover{filter:brightness(1.1);}
      `}</style>
    </div>
  )
}
