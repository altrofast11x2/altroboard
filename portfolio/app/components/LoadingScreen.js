'use client'
import { useState, useEffect } from 'react'

const LETTERS = ['C','o','z','y','B','o','a','r','d']

export default function LoadingScreen() {
  const [visible, setVisible] = useState(false)
  const [phase, setPhase] = useState(0)
  const [letterIdx, setLetterIdx] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const visited = sessionStorage.getItem('altroboard_loaded')
    if (visited) return
    sessionStorage.setItem('altroboard_loaded', '1')

    setVisible(true)
    // phase 1: ink spread
    setTimeout(() => setPhase(1), 80)
    // phase 2: type letters one by one
    setTimeout(() => setPhase(2), 700)
    // letter typing
    LETTERS.forEach((_, i) => {
      setTimeout(() => setLetterIdx(i + 1), 700 + i * 110)
    })
    // phase 3: subtitle + progress
    setTimeout(() => setPhase(3), 700 + LETTERS.length * 110 + 100)
    // phase 4: fade out
    setTimeout(() => setPhase(4), 2600)
    // remove
    setTimeout(() => setVisible(false), 3200)
  }, [])

  if (!visible) return null

  return (
    <div className={`ls-root ${phase >= 4 ? 'ls-exit' : ''}`}>
      {/* Ink spread background circles */}
      <div className={`ls-ink ${phase >= 1 ? 'ls-ink-go' : ''}`} />
      <div className={`ls-ink ls-ink2 ${phase >= 1 ? 'ls-ink-go' : ''}`} />

      {/* Floating ink particles */}
      {[...Array(12)].map((_, i) => (
        <div key={i} className="ls-particle" style={{
          left: `${8 + i * 7.5}%`,
          animationDelay: `${0.1 + i * 0.15}s`,
          animationDuration: `${2.5 + (i % 3) * 0.8}s`,
          width: `${2 + (i % 4)}px`,
          height: `${2 + (i % 4)}px`,
          opacity: phase >= 1 ? 1 : 0,
        }} />
      ))}

      {/* Center content */}
      <div className="ls-center">
        {/* Red accent bar */}
        <div className={`ls-bar ${phase >= 1 ? 'ls-bar-go' : ''}`} />

        {/* Logo typewriter */}
        <h1 className="ls-logo">
          {LETTERS.map((l, i) => (
            <span
              key={i}
              className={`ls-letter ${i < letterIdx ? 'ls-letter-show' : ''} ${i === 4 ? 'ls-letter-break' : ''}`}
            >
              {l}
            </span>
          ))}
          <span className={`ls-cursor ${phase >= 3 ? 'ls-cursor-hide' : ''}`}>|</span>
        </h1>

        {/* Subtitle */}
        <p className={`ls-sub ${phase >= 3 ? 'ls-sub-show' : ''}`}>
          김현준의 개인 공간에 오신 것을 환영합니다
        </p>

        {/* Loading dots */}
        <div className={`ls-dots ${phase >= 3 ? 'ls-dots-show' : ''}`}>
          <span />
          <span />
          <span />
        </div>
      </div>

      {/* Bottom mono text */}
      <div className={`ls-footer ${phase >= 3 ? 'ls-footer-show' : ''}`}>
        CozyBoard — Full Stack Developer in Progress
      </div>

      <style>{`
        .ls-root {
          position: fixed; inset: 0; z-index: 9999;
          background: #1a1208;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .ls-exit {
          opacity: 0;
          transform: translateY(-8px);
          pointer-events: none;
        }

        /* ink circles */
        .ls-ink {
          position: absolute;
          width: 10px; height: 10px;
          background: radial-gradient(circle, #2a1c0e 0%, #1a1208 60%);
          border-radius: 50%;
          left: 50%; top: 50%;
          transform: translate(-50%, -50%) scale(0);
          transition: transform 1.4s cubic-bezier(0.16, 1, 0.3, 1);
          pointer-events: none;
        }
        .ls-ink-go { transform: translate(-50%, -50%) scale(320) !important; }
        .ls-ink2 {
          background: radial-gradient(circle, rgba(192,57,43,0.04) 0%, transparent 70%);
          transition-delay: 0.2s;
        }
        .ls-ink2.ls-ink-go { transform: translate(-50%, -50%) scale(280) !important; }

        /* particles */
        .ls-particle {
          position: absolute;
          bottom: -10px;
          background: rgba(192,57,43,0.35);
          border-radius: 50%;
          animation: ls-float linear infinite;
          transition: opacity 0.5s;
        }
        @keyframes ls-float {
          0%   { bottom: -10px; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 0.6; }
          100% { bottom: 110%; opacity: 0; transform: translateX(20px); }
        }

        /* center */
        .ls-center {
          display: flex; flex-direction: column; align-items: center;
          gap: 1.2rem; text-align: center;
          position: relative; z-index: 1;
        }

        /* bar */
        .ls-bar {
          width: 0; height: 2px;
          background: linear-gradient(90deg, transparent, #c0392b, #e74c3c, transparent);
          transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
          margin-bottom: 0.5rem;
        }
        .ls-bar-go { width: 180px; }

        /* logo */
        .ls-logo {
          font-family: 'Noto Serif KR', serif;
          font-size: clamp(2.4rem, 7vw, 4rem);
          font-weight: 700;
          color: #f5f0e8;
          letter-spacing: 0.02em;
          display: flex; align-items: baseline; gap: 0;
          line-height: 1;
        }
        .ls-letter {
          display: inline-block;
          opacity: 0;
          transform: translateY(12px);
          transition: opacity 0.25s ease, transform 0.25s ease;
        }
        .ls-letter-show {
          opacity: 1;
          transform: translateY(0);
        }
        .ls-letter-break { color: #e74c3c; }
        .ls-cursor {
          color: #e74c3c;
          animation: ls-blink 0.7s step-end infinite;
          margin-left: 2px;
          transition: opacity 0.3s;
        }
        .ls-cursor-hide { opacity: 0; }
        @keyframes ls-blink { 0%,100%{opacity:1} 50%{opacity:0} }

        /* subtitle */
        .ls-sub {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.75rem;
          color: rgba(245,240,232,0.45);
          letter-spacing: 0.08em;
          opacity: 0;
          transform: translateY(6px);
          transition: opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s;
        }
        .ls-sub-show { opacity: 1; transform: translateY(0); }

        /* dots */
        .ls-dots {
          display: flex; gap: 6px; align-items: center;
          opacity: 0; transition: opacity 0.4s ease 0.3s;
        }
        .ls-dots-show { opacity: 1; }
        .ls-dots span {
          width: 5px; height: 5px;
          background: #c0392b;
          border-radius: 50%;
          animation: ls-dot-bounce 1.2s ease-in-out infinite;
        }
        .ls-dots span:nth-child(2) { animation-delay: 0.2s; }
        .ls-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes ls-dot-bounce {
          0%,80%,100% { transform: scale(0.8); opacity: 0.5; }
          40%          { transform: scale(1.2); opacity: 1; }
        }

        /* footer */
        .ls-footer {
          position: absolute; bottom: 1.75rem; left: 50%; transform: translateX(-50%);
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.65rem;
          color: rgba(245,240,232,0.2);
          letter-spacing: 0.12em;
          white-space: nowrap;
          opacity: 0; transition: opacity 0.5s ease 0.5s;
          z-index: 1;
        }
        .ls-footer-show { opacity: 1; }
      `}</style>
    </div>
  )
}
