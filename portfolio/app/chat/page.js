'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ChatInner() {
  const [user,         setUser]         = useState(null)
  const [rooms,        setRooms]        = useState([])
  const [loadingRooms, setLoadingRooms] = useState(true)
  const [activeRoom,   setActiveRoom]   = useState(null)
  const [messages,     setMessages]     = useState([])
  const [otherName,    setOtherName]    = useState('')
  const [otherUid,     setOtherUid]     = useState('')
  const [msgText,      setMsgText]      = useState('')
  const [sending,      setSending]      = useState(false)
  const [imgLoading,   setImgLoading]   = useState(false)

  // refs — safe to use inside setInterval / async callbacks
  const uidRef        = useRef('')
  const activeRef     = useRef('')
  const pollRef       = useRef(null)
  const bottomRef     = useRef(null)
  const fileRef       = useRef(null)

  const router       = useRouter()
  const searchParams = useSearchParams()

  const scrollBottom = () =>
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)

  // ── fetch room list ────────────────────────────────────────
  const loadRooms = async (uid) => {
    try {
      const res  = await fetch(`/api/chat?userId=${uid}`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setRooms(data)
        return data
      }
    } catch (e) { console.error('loadRooms error', e) }
    return []
  }

  // ── open a conversation ────────────────────────────────────
  const openRoom = async (roomId, rOtherUid, rOtherName) => {
    if (pollRef.current) clearInterval(pollRef.current)
    activeRef.current = roomId
    setActiveRoom(roomId)
    setOtherUid(rOtherUid)
    setOtherName(rOtherName)
    setMessages([])

    const fetchMsgs = async () => {
      try {
        const res  = await fetch(`/api/chat/${roomId}?userId=${uidRef.current}`)
        const data = await res.json()
        if (Array.isArray(data)) setMessages(data)
      } catch (e) { console.error('fetchMsgs error', e) }
    }

    await fetchMsgs()
    scrollBottom()

    // mark unread 0 locally
    setRooms(prev => prev.map(r => r.roomId === roomId ? { ...r, unread: 0 } : r))

    // poll every 3s
    pollRef.current = setInterval(async () => {
      if (activeRef.current !== roomId) return
      await fetchMsgs()
      // also refresh room list
      const res = await fetch(`/api/chat?userId=${uidRef.current}`)
      const data = await res.json()
      if (Array.isArray(data)) setRooms(data)
    }, 3000)
  }

  // ── init ──────────────────────────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (!raw) { router.push('/login'); return }
    const u    = JSON.parse(raw)
    uidRef.current = u.id
    setUser(u)

    const withId   = searchParams.get('with')
    const withName = decodeURIComponent(searchParams.get('name') || withId || '')

    loadRooms(u.id).then(data => {
      setLoadingRooms(false)

      if (withId) {
        const roomId = [u.id, withId].sort().join('__')
        if (!data.find(r => r.roomId === roomId)) {
          setRooms(prev => [
            { roomId, otherUid: withId, otherName: withName, lastMessage: '', lastAt: '', unread: 0 },
            ...prev,
          ])
        }
        openRoom(roomId, withId, withName)
      } else if (data.length > 0) {
        // 가장 최근 대화 자동 오픈
        openRoom(data[0].roomId, data[0].otherUid, data[0].otherName)
      }
    })

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  useEffect(() => { scrollBottom() }, [messages])

  // ── send text ─────────────────────────────────────────────
  const sendMessage = async (e) => {
    e.preventDefault()
    const text = msgText.trim()
    if (!text || !activeRef.current || !user) return
    setSending(true)
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromId: user.id, fromName: user.name,
          toId: otherUid, toName: otherName,
          message: text,
        }),
      })
      setMsgText('')
      const res  = await fetch(`/api/chat/${activeRef.current}?userId=${user.id}`)
      const data = await res.json()
      if (Array.isArray(data)) setMessages(data)
    } catch (e) { console.error(e) }
    setSending(false)
  }

  // ── send image ────────────────────────────────────────────
  const handleImg = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !activeRef.current || !user) return
    setImgLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const upRes  = await fetch('/api/upload', { method: 'POST', body: fd })
      const upData = await upRes.json()
      if (!upData.url) { alert('이미지 업로드 실패'); setImgLoading(false); return }

      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromId: user.id, fromName: user.name,
          toId: otherUid, toName: otherName,
          imageUrl: upData.url,
        }),
      })
      const res  = await fetch(`/api/chat/${activeRef.current}?userId=${user.id}`)
      const data = await res.json()
      if (Array.isArray(data)) setMessages(data)
    } catch (e) { console.error(e); alert('전송 중 오류가 발생했습니다') }
    setImgLoading(false)
    e.target.value = ''
  }

  if (!user) return null

  const fmt     = iso => new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  const fmtDate = iso => new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })

  return (
    <main>
      <div className="container" style={{ maxWidth: '960px', padding: '1.5rem' }}>
        <div className="section-header" style={{ marginBottom: '1rem' }}>
          <h2>메시지</h2>
          <p>사용자와 1:1 대화</p>
        </div>

        <div className="chat-layout">
          {/* ── sidebar ── */}
          <div className="chat-sidebar">
            <div className="chat-sidebar-header">대화 목록</div>
            {loadingRooms ? (
              <div className="chat-dim">불러오는 중...</div>
            ) : rooms.length === 0 ? (
              <div className="chat-dim">
                <p>대화가 없어요</p>
                <p style={{ fontSize: '0.7rem', marginTop: '0.35rem' }}>
                  게시글 작성자 프로필에서<br />메시지를 시작하세요
                </p>
              </div>
            ) : (
              rooms.map(r => (
                <button
                  key={r.roomId}
                  className={`chat-room-btn ${activeRoom === r.roomId ? 'active' : ''}`}
                  onClick={() => openRoom(r.roomId, r.otherUid, r.otherName)}
                >
                  <div className="c-avatar sm">{(r.otherName || '?')[0].toUpperCase()}</div>
                  <div className="chat-room-txt">
                    <div className="chat-room-name">{r.otherName || r.otherUid}</div>
                    <div className="chat-room-last">{r.lastMessage || '대화를 시작해보세요'}</div>
                  </div>
                  {r.unread > 0 && <span className="unread-badge">{r.unread > 9 ? '9+' : r.unread}</span>}
                </button>
              ))
            )}
          </div>

          {/* ── main ── */}
          <div className="chat-main">
            {!activeRoom ? (
              <div className="chat-placeholder">
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💬</div>
                <p style={{ fontFamily: 'var(--serif)', fontSize: '1rem', color: 'var(--muted)' }}>대화를 선택하세요</p>
                <p style={{ fontFamily: 'var(--mono)', fontSize: '0.7rem', color: 'var(--border-dark)', marginTop: '0.4rem' }}>
                  왼쪽 목록에서 대화를 클릭하거나<br />프로필에서 새 대화를 시작하세요
                </p>
              </div>
            ) : (
              <>
                <div className="chat-header">
                  <div className="c-avatar sm">{(otherName || '?')[0].toUpperCase()}</div>
                  <span style={{ fontFamily: 'var(--serif)', fontWeight: 700 }}>{otherName}</span>
                  <Link href={`/profile/${otherUid}`} className="btn btn-sm" style={{ marginLeft: 'auto' }}>프로필</Link>
                </div>

                <div className="chat-messages">
                  {messages.length === 0 ? (
                    <div className="chat-dim" style={{ height: '100%' }}>첫 메시지를 보내보세요!</div>
                  ) : (
                    messages.map((m, i) => {
                      const isMine   = m.fromId === user.id
                      const showDate = i === 0 || fmtDate(messages[i - 1].createdAt) !== fmtDate(m.createdAt)
                      return (
                        <div key={m.id || i}>
                          {showDate && <div className="date-divider">{fmtDate(m.createdAt)}</div>}
                          <div className={`msg-row ${isMine ? 'mine' : 'theirs'}`}>
                            {!isMine && <div className="c-avatar xs">{(m.fromName || '?')[0].toUpperCase()}</div>}
                            <div className="bubble-wrap">
                              {!isMine && <div className="msg-name">{m.fromName}</div>}
                              <div className={`bubble ${isMine ? 'bubble-mine' : ''}`}>
                                {m.imageUrl && (
                                  <img src={m.imageUrl} alt="사진" className="chat-img"
                                    onClick={() => {
                                      const lb = document.createElement('div')
                                      lb.className = 'lightbox'; lb.onclick = () => lb.remove()
                                      const im = document.createElement('img'); im.src = m.imageUrl
                                      lb.appendChild(im); document.body.appendChild(lb)
                                    }} />
                                )}
                                {m.message && <span>{m.message}</span>}
                              </div>
                              <div className={`msg-time ${isMine ? 'right' : ''}`}>{fmt(m.createdAt)}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                <form className="chat-input-row" onSubmit={sendMessage}>
                  <button type="button" className="img-btn" onClick={() => fileRef.current?.click()} disabled={imgLoading} title="사진 전송">
                    {imgLoading ? '⏳' : '📷'}
                  </button>
                  <input type="file" accept="image/*" ref={fileRef} style={{ display: 'none' }} onChange={handleImg} />
                  <input
                    className="chat-input"
                    placeholder="메시지를 입력하세요..."
                    value={msgText}
                    onChange={e => setMsgText(e.target.value)}
                    disabled={sending || imgLoading}
                    autoComplete="off"
                  />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={sending || imgLoading || !msgText.trim()}>
                    {sending ? '...' : '전송'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .chat-layout{display:grid;grid-template-columns:250px 1fr;border:1px solid var(--border);border-radius:2px;overflow:hidden;height:calc(100vh - 190px);min-height:500px;background:var(--surface);}
        .chat-sidebar{border-right:1px solid var(--border);overflow-y:auto;background:var(--surface2);display:flex;flex-direction:column;}
        .chat-sidebar-header{padding:0.75rem 1rem;font-family:var(--mono);font-size:0.72rem;color:var(--muted);border-bottom:1px solid var(--border);text-transform:uppercase;letter-spacing:.06em;flex-shrink:0;}
        .chat-room-btn{width:100%;display:flex;align-items:center;gap:0.65rem;padding:0.8rem 1rem;background:none;border:none;border-bottom:1px solid rgba(212,201,168,.3);cursor:pointer;text-align:left;transition:background .15s;position:relative;}
        .chat-room-btn:hover{background:rgba(212,201,168,.3);}
        .chat-room-btn.active{background:var(--surface);border-left:3px solid var(--accent);}
        .chat-room-txt{flex:1;min-width:0;}
        .chat-room-name{font-family:var(--mono);font-size:0.8rem;font-weight:500;color:var(--text);}
        .chat-room-last{font-size:0.7rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:.15rem;}
        .unread-badge{background:var(--accent);color:#fff;border-radius:10px;font-family:var(--mono);font-size:.62rem;padding:.05rem .4rem;min-width:16px;text-align:center;line-height:1.5;flex-shrink:0;}
        .chat-dim{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:2rem;text-align:center;font-family:var(--mono);font-size:.78rem;color:var(--muted);}
        .chat-main{display:flex;flex-direction:column;overflow:hidden;}
        .chat-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:2rem;text-align:center;}
        .chat-header{display:flex;align-items:center;gap:.7rem;padding:.8rem 1.2rem;border-bottom:1px solid var(--border);background:var(--surface2);flex-shrink:0;}
        .chat-messages{flex:1;overflow-y:auto;padding:1rem 1.25rem;display:flex;flex-direction:column;gap:.15rem;}
        .date-divider{text-align:center;font-family:var(--mono);font-size:.65rem;color:var(--muted);margin:.75rem 0;position:relative;}
        .date-divider::before,.date-divider::after{content:'';position:absolute;top:50%;width:32%;height:1px;background:var(--border);}
        .date-divider::before{left:0;}.date-divider::after{right:0;}
        .msg-row{display:flex;gap:.5rem;align-items:flex-end;margin:.2rem 0;}
        .msg-row.mine{flex-direction:row-reverse;}
        .bubble-wrap{display:flex;flex-direction:column;max-width:68%;}
        .mine .bubble-wrap{align-items:flex-end;}
        .msg-name{font-family:var(--mono);font-size:.65rem;color:var(--muted);margin-bottom:.2rem;}
        .bubble{background:var(--surface2);border:1px solid var(--border);border-radius:12px 12px 12px 2px;padding:.5rem .8rem;font-size:.875rem;line-height:1.6;color:var(--text);word-break:break-word;white-space:pre-wrap;}
        .bubble-mine{background:var(--accent);border-color:var(--accent);color:#fff;border-radius:12px 12px 2px 12px;}
        .chat-img{max-width:200px;max-height:200px;border-radius:8px;display:block;cursor:zoom-in;margin-bottom:.3rem;}
        .bubble-mine .chat-img{border:2px solid rgba(255,255,255,.3);}
        .msg-time{font-family:var(--mono);font-size:.62rem;color:var(--muted);margin-top:.2rem;}
        .msg-time.right{text-align:right;}
        .chat-input-row{display:flex;gap:.5rem;padding:.8rem 1.2rem;border-top:1px solid var(--border);flex-shrink:0;background:var(--surface2);align-items:center;}
        .chat-input{flex:1;background:var(--bg);border:1px solid var(--border);border-radius:2px;padding:.5rem .8rem;color:var(--text);font-family:var(--font);font-size:.875rem;outline:none;}
        .chat-input:focus{border-color:var(--accent);}
        .img-btn{background:none;border:1px solid var(--border);border-radius:2px;padding:.35rem .55rem;cursor:pointer;font-size:1rem;line-height:1;transition:border-color .2s;flex-shrink:0;}
        .img-btn:hover{border-color:var(--accent);}
        .img-btn:disabled{opacity:.5;cursor:not-allowed;}
        .c-avatar{border-radius:50%;background:var(--accent);color:#fff;font-family:var(--serif);font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .c-avatar.sm{width:34px;height:34px;font-size:.9rem;}
        .c-avatar.xs{width:26px;height:26px;font-size:.65rem;}
        @media(max-width:640px){.chat-layout{grid-template-columns:1fr;}.chat-sidebar{max-height:180px;border-right:none;border-bottom:1px solid var(--border);}}
      `}</style>
    </main>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={<main><div className="container" style={{padding:'3rem',fontFamily:'var(--mono)',fontSize:'0.82rem',color:'var(--muted)'}}>불러오는 중...</div></main>}>
      <ChatInner />
    </Suspense>
  )
}
