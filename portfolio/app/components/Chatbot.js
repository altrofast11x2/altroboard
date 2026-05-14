'use client'
import { useState, useRef, useEffect } from 'react'

const GREETING = '안녕하세요! altroboard 챗봇이에요.\n사이트 기능, 게임, 사용법 등 무엇이든 물어보세요.'

// ── 인라인 SVG (이모지 일체 사용 안 함) ─────────────────────────
const ChatIcon = ({ size = 22 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
)
const CloseIcon = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const ResetIcon = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/>
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
  </svg>
)
const SendIcon = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
    <path d="M2 21l21-9L2 3v7l15 2-15 2z"/>
  </svg>
)
// 챗봇 아바타용 미니멀 로봇 SVG
const BotAvatar = ({ size = 22 }) => (
  <svg viewBox="0 0 32 32" width={size} height={size} fill="none">
    <rect x="6" y="10" width="20" height="16" rx="4" fill="currentColor"/>
    <circle cx="12" cy="17" r="2" fill="#fff"/>
    <circle cx="20" cy="17" r="2" fill="#fff"/>
    <rect x="13" y="22" width="6" height="1.5" rx=".75" fill="#fff"/>
    <line x1="16" y1="6" x2="16" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="16" cy="5" r="1.5" fill="currentColor"/>
  </svg>
)

export default function Chatbot() {
  const [open, setOpen]       = useState(false)
  const [messages, setMessages] = useState([{ role: 'assistant', content: GREETING }])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const listRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, loading])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next); setInput(''); setLoading(true)
    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })) }),
      })
      const data = await res.json()
      setMessages(m => [...m, { role: 'assistant', content: data.reply || '...' }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: '연결에 실패했어요. 잠시 후 다시 시도해 주세요.' }])
    }
    setLoading(false)
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const reset = () => {
    setMessages([{ role: 'assistant', content: GREETING }])
    setInput('')
  }

  return (
    <>
      {/* 플로팅 버튼 */}
      <button className={`cb-fab ${open ? 'open' : ''}`} onClick={()=>setOpen(o=>!o)} aria-label={open?'챗봇 닫기':'챗봇 열기'}>
        {open ? <CloseIcon size={20}/> : <ChatIcon size={22}/>}
      </button>

      {open && (
        <div className="cb-panel" role="dialog" aria-label="altroboard 챗봇">
          <div className="cb-head">
            <div style={{display:'flex',alignItems:'center',gap:'.55rem'}}>
              <div className="cb-avatar"><BotAvatar size={20}/></div>
              <div>
                <div className="cb-title">altroBot</div>
                <div className="cb-sub">실시간 답변 · Claude</div>
              </div>
            </div>
            <div style={{display:'flex',gap:'.3rem'}}>
              <button className="cb-icon" onClick={reset} aria-label="대화 초기화" title="대화 초기화"><ResetIcon/></button>
              <button className="cb-icon" onClick={()=>setOpen(false)} aria-label="닫기"><CloseIcon/></button>
            </div>
          </div>

          <div className="cb-list" ref={listRef}>
            {messages.map((m, i) => (
              <div key={i} className={`cb-msg cb-${m.role}`}>
                {m.role === 'assistant' && <div className="cb-msg-avatar"><BotAvatar size={16}/></div>}
                <div className="cb-bubble">{m.content}</div>
              </div>
            ))}
            {loading && (
              <div className="cb-msg cb-assistant">
                <div className="cb-msg-avatar"><BotAvatar size={16}/></div>
                <div className="cb-bubble cb-typing"><span/><span/><span/></div>
              </div>
            )}
          </div>

          <div className="cb-input">
            <textarea
              ref={inputRef}
              rows={1}
              placeholder="무엇이든 물어보세요... (Enter 전송)"
              value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={onKey}
              maxLength={1200}
            />
            <button className="cb-send" onClick={send} disabled={loading || !input.trim()} aria-label="전송">
              <SendIcon size={16}/>
            </button>
          </div>
        </div>
      )}

      <style>{`
        .cb-fab{position:fixed;right:1.2rem;bottom:1.2rem;width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,var(--accent),#7b1a12);color:#fff;border:none;cursor:pointer;box-shadow:0 6px 20px rgba(192,57,43,.4);z-index:6000;display:flex;align-items:center;justify-content:center;transition:all .2s;}
        .cb-fab:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(192,57,43,.5);}
        .cb-fab.open{background:var(--ink);box-shadow:0 4px 12px rgba(0,0,0,.3);}
        .cb-panel{position:fixed;right:1.2rem;bottom:5.5rem;width:min(380px,calc(100vw - 2rem));height:min(580px,calc(100vh - 8rem));background:var(--surface);border:1px solid var(--border);border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.25);display:flex;flex-direction:column;overflow:hidden;z-index:6000;animation:cb-in .25s ease;}
        @keyframes cb-in{from{transform:translateY(20px);opacity:0;}to{transform:none;opacity:1;}}
        .cb-head{display:flex;align-items:center;justify-content:space-between;padding:.85rem 1rem;background:var(--ink);color:#fff;}
        .cb-avatar{width:34px;height:34px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;}
        .cb-title{font-family:var(--serif);font-weight:700;font-size:.95rem;letter-spacing:.02em;}
        .cb-sub{font-family:var(--mono);font-size:.62rem;color:rgba(245,240,232,.6);}
        .cb-icon{background:rgba(255,255,255,.08);border:none;color:rgba(255,255,255,.75);width:28px;height:28px;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
        .cb-icon:hover{background:rgba(255,255,255,.18);color:#fff;}
        .cb-list{flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.55rem;background:var(--bg);}
        .cb-msg{display:flex;gap:.4rem;align-items:flex-end;}
        .cb-user{justify-content:flex-end;}
        .cb-msg-avatar{width:24px;height:24px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .cb-bubble{max-width:78%;padding:.55rem .85rem;border-radius:14px;font-size:.85rem;line-height:1.55;white-space:pre-wrap;word-break:break-word;background:var(--surface);border:1px solid var(--border);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.05);}
        .cb-user .cb-bubble{background:var(--accent);color:#fff;border-color:var(--accent);}
        .cb-typing{display:inline-flex;gap:3px;padding:.65rem .85rem;align-items:center;}
        .cb-typing span{width:6px;height:6px;border-radius:50%;background:var(--muted);animation:cb-bounce 1s infinite;}
        .cb-typing span:nth-child(2){animation-delay:.15s;}
        .cb-typing span:nth-child(3){animation-delay:.3s;}
        @keyframes cb-bounce{0%,80%,100%{transform:translateY(0);opacity:.3;}40%{transform:translateY(-5px);opacity:1;}}
        .cb-input{padding:.65rem .75rem;border-top:1px solid var(--border);display:flex;gap:.4rem;align-items:flex-end;background:var(--surface);}
        .cb-input textarea{flex:1;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:.55rem .75rem;font-family:var(--font);font-size:.85rem;color:var(--text);outline:none;resize:none;min-height:36px;max-height:120px;line-height:1.4;}
        .cb-input textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(192,57,43,.1);}
        .cb-send{background:var(--accent);color:#fff;border:none;width:36px;height:36px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
        .cb-send:hover:not(:disabled){background:var(--accent2);}
        .cb-send:disabled{opacity:.4;cursor:not-allowed;}
      `}</style>
    </>
  )
}
