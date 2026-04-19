'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function ChatPageInner() {
  const [user, setUser] = useState(null)
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeRoom, setActiveRoom] = useState(null)
  const [messages, setMessages] = useState([])
  const [msgText, setMsgText] = useState('')
  const [sending, setSending] = useState(false)
  const [otherName, setOtherName] = useState('')
  const [polling, setPolling] = useState(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (!u) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    setUser(parsed)

    // Check if opened from profile page with ?with=userId&name=xxx
    const withId = searchParams.get('with')
    const withName = searchParams.get('name')

    loadRooms(parsed.id, withId, withName)
  }, [])

  const loadRooms = async (userId, openWithId, openWithName) => {
    setLoading(true)
    const res = await fetch(`/api/chat?userId=${userId}`)
    const data = await res.json()
    setRooms(data)
    setLoading(false)

    if (openWithId) {
      // Open or create room with this user
      const [a, b] = [userId, openWithId].sort()
      const roomId = `${a}__${b}`
      const existing = data.find(r => r.roomId === roomId)
      openRoom(roomId, openWithName || openWithId, userId, existing ? null : { roomId, otherUid: openWithId, otherName: openWithName || openWithId, lastMessage: '', unread: 0 })
    }
  }

  const openRoom = async (roomId, name, userId, newRoomObj) => {
    setActiveRoom(roomId)
    setOtherName(name)
    setMessages([])

    // Add new room to list if not exists
    if (newRoomObj) {
      setRooms(prev => [newRoomObj, ...prev.filter(r => r.roomId !== roomId)])
    }

    // Load messages
    const res = await fetch(`/api/chat/${roomId}?userId=${userId || user?.id}`)
    setMessages(await res.json())

    // Mark unread as 0 in list
    setRooms(prev => prev.map(r => r.roomId === roomId ? { ...r, unread: 0 } : r))

    // Start polling for new messages
    if (polling) clearInterval(polling)
    const iv = setInterval(async () => {
      const pr = await fetch(`/api/chat/${roomId}?userId=${userId || user?.id}`)
      setMessages(await pr.json())
    }, 3000)
    setPolling(iv)
  }

  useEffect(() => () => { if (polling) clearInterval(polling) }, [polling])

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!msgText.trim() || !activeRoom || !user) return
    setSending(true)
    const otherUid = activeRoom.split('__').find(id => id !== user.id)
    const room = rooms.find(r => r.roomId === activeRoom)

    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromId: user.id,
        fromName: user.name,
        toId: otherUid,
        toName: room?.otherName || otherUid,
        message: msgText,
      }),
    })
    setMsgText('')
    setSending(false)

    // Refresh messages
    const res = await fetch(`/api/chat/${activeRoom}?userId=${user.id}`)
    const newMsgs = await res.json()
    setMessages(newMsgs)

    // Update room preview
    setRooms(prev => prev.map(r => r.roomId === activeRoom
      ? { ...r, lastMessage: msgText.slice(0, 60), lastAt: new Date().toISOString() }
      : r
    ))
  }

  if (!user) return null

  return (
    <main>
      <div className="container" style={{ maxWidth: '900px', padding: '1.5rem' }}>
        <div className="section-header" style={{ marginBottom: '1rem' }}>
          <h2>메시지</h2>
          <p>사용자와 1:1 대화</p>
        </div>

        <div className="chat-layout">
          {/* Sidebar: room list */}
          <div className="chat-sidebar">
            {loading ? (
              <div className="chat-empty">불러오는 중...</div>
            ) : rooms.length === 0 ? (
              <div className="chat-empty">
                <p>대화가 없습니다</p>
                <p style={{ fontSize: '0.72rem', marginTop: '0.4rem', color: 'var(--muted)' }}>
                  게시글 작성자 프로필에서<br />메시지를 시작하세요
                </p>
              </div>
            ) : (
              rooms.map(room => (
                <button
                  key={room.roomId}
                  className={`chat-room-item ${activeRoom === room.roomId ? 'active' : ''}`}
                  onClick={() => openRoom(room.roomId, room.otherName, user.id)}
                >
                  <div className="chat-room-avatar">{(room.otherName || '?')[0].toUpperCase()}</div>
                  <div className="chat-room-info">
                    <div className="chat-room-name">{room.otherName}</div>
                    <div className="chat-room-last">{room.lastMessage || '대화를 시작해보세요'}</div>
                  </div>
                  {room.unread > 0 && <span className="chat-unread">{room.unread}</span>}
                </button>
              ))
            )}
          </div>

          {/* Chat area */}
          <div className="chat-area">
            {!activeRoom ? (
              <div className="chat-placeholder">
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>💬</div>
                <p style={{ fontFamily: 'var(--serif)', fontSize: '1rem', color: 'var(--muted)' }}>대화를 선택하세요</p>
                <p style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--border-dark)', marginTop: '0.3rem' }}>
                  프로필 페이지에서 메시지 버튼을 눌러 새 대화를 시작할 수 있습니다
                </p>
              </div>
            ) : (
              <>
                <div className="chat-header">
                  <div className="chat-room-avatar" style={{ width: '32px', height: '32px', fontSize: '0.85rem' }}>
                    {(otherName || '?')[0].toUpperCase()}
                  </div>
                  <span style={{ fontFamily: 'var(--serif)', fontWeight: 700 }}>{otherName}</span>
                  <Link href={`/profile/${activeRoom.split('__').find(id => id !== user.id)}`}
                    className="btn btn-sm" style={{ marginLeft: 'auto' }}>프로필 보기</Link>
                </div>

                <div className="chat-messages" id="chat-messages">
                  {messages.length === 0 ? (
                    <div className="chat-empty" style={{ height: '100%' }}>
                      <p style={{ fontFamily: 'var(--mono)', fontSize: '0.78rem' }}>첫 메시지를 보내보세요!</p>
                    </div>
                  ) : (
                    messages.map((m, i) => {
                      const isMine = m.fromId === user.id
                      const showDate = i === 0 || new Date(messages[i-1].createdAt).toDateString() !== new Date(m.createdAt).toDateString()
                      return (
                        <div key={m.id}>
                          {showDate && (
                            <div className="chat-date-divider">
                              {new Date(m.createdAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                            </div>
                          )}
                          <div className={`chat-msg-row ${isMine ? 'mine' : 'theirs'}`}>
                            {!isMine && <div className="chat-msg-avatar">{(m.fromName || '?')[0].toUpperCase()}</div>}
                            <div className="chat-bubble-wrap">
                              {!isMine && <div className="chat-msg-name">{m.fromName}</div>}
                              <div className={`chat-bubble ${isMine ? 'chat-bubble-mine' : ''}`}>
                                {m.message}
                              </div>
                              <div className={`chat-msg-time ${isMine ? 'right' : ''}`}>
                                {new Date(m.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                <form className="chat-input-row" onSubmit={sendMessage}>
                  <input
                    className="chat-input"
                    placeholder="메시지를 입력하세요..."
                    value={msgText}
                    onChange={e => setMsgText(e.target.value)}
                    disabled={sending}
                    autoComplete="off"
                  />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={sending || !msgText.trim()}>
                    {sending ? '...' : '전송'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .chat-layout {
          display: grid;
          grid-template-columns: 240px 1fr;
          border: 1px solid var(--border);
          border-radius: 2px;
          overflow: hidden;
          height: calc(100vh - 180px);
          min-height: 480px;
          background: var(--surface);
        }
        .chat-sidebar {
          border-right: 1px solid var(--border);
          overflow-y: auto;
          background: var(--surface2);
        }
        .chat-room-item {
          width: 100%;
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.85rem 1rem;
          background: none; border: none; border-bottom: 1px solid rgba(212,201,168,0.35);
          cursor: pointer; text-align: left;
          transition: background 0.15s;
          position: relative;
        }
        .chat-room-item:hover { background: rgba(212,201,168,0.3); }
        .chat-room-item.active { background: var(--surface); border-left: 3px solid var(--accent); }
        .chat-room-avatar {
          width: 38px; height: 38px; border-radius: 50%;
          background: var(--accent); color: #fff;
          font-family: var(--serif); font-size: 1rem; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .chat-room-info { flex: 1; min-width: 0; }
        .chat-room-name { font-family: var(--mono); font-size: 0.82rem; font-weight: 500; color: var(--text); }
        .chat-room-last { font-size: 0.72rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 0.15rem; }
        .chat-unread {
          background: var(--accent); color: #fff;
          border-radius: 10px; font-family: var(--mono); font-size: 0.65rem;
          padding: 0.1rem 0.45rem; min-width: 18px; text-align: center;
        }
        .chat-empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          height: 100%; padding: 2rem; text-align: center;
          font-family: var(--mono); font-size: 0.8rem; color: var(--muted);
        }
        .chat-area {
          display: flex; flex-direction: column;
          overflow: hidden;
        }
        .chat-placeholder {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          height: 100%; padding: 2rem; text-align: center;
        }
        .chat-header {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.85rem 1.25rem;
          border-bottom: 1px solid var(--border);
          background: var(--surface2);
          flex-shrink: 0;
        }
        .chat-messages {
          flex: 1; overflow-y: auto;
          padding: 1rem 1.25rem;
          display: flex; flex-direction: column; gap: 0.25rem;
        }
        .chat-date-divider {
          text-align: center; font-family: var(--mono); font-size: 0.65rem;
          color: var(--muted); margin: 0.75rem 0;
          position: relative;
        }
        .chat-date-divider::before, .chat-date-divider::after {
          content: ''; position: absolute; top: 50%; width: 30%;
          height: 1px; background: var(--border);
        }
        .chat-date-divider::before { left: 0; }
        .chat-date-divider::after { right: 0; }
        .chat-msg-row {
          display: flex; gap: 0.5rem; align-items: flex-end;
          margin: 0.2rem 0;
        }
        .chat-msg-row.mine { flex-direction: row-reverse; }
        .chat-msg-avatar {
          width: 26px; height: 26px; border-radius: 50%;
          background: var(--border-dark); color: var(--bg);
          font-family: var(--serif); font-size: 0.65rem; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .chat-bubble-wrap { display: flex; flex-direction: column; max-width: 68%; }
        .mine .chat-bubble-wrap { align-items: flex-end; }
        .chat-msg-name { font-family: var(--mono); font-size: 0.65rem; color: var(--muted); margin-bottom: 0.2rem; }
        .chat-bubble {
          background: var(--surface2); border: 1px solid var(--border);
          border-radius: 12px 12px 12px 2px;
          padding: 0.55rem 0.85rem;
          font-size: 0.875rem; line-height: 1.6;
          color: var(--text); word-break: break-word; white-space: pre-wrap;
        }
        .chat-bubble-mine {
          background: var(--accent); border-color: var(--accent);
          color: #fff; border-radius: 12px 12px 2px 12px;
        }
        .chat-msg-time {
          font-family: var(--mono); font-size: 0.62rem; color: var(--muted);
          margin-top: 0.2rem;
        }
        .chat-msg-time.right { text-align: right; }
        .chat-input-row {
          display: flex; gap: 0.5rem; padding: 0.85rem 1.25rem;
          border-top: 1px solid var(--border);
          flex-shrink: 0; background: var(--surface2);
        }
        .chat-input {
          flex: 1; background: var(--bg);
          border: 1px solid var(--border); border-radius: 2px;
          padding: 0.55rem 0.85rem; color: var(--text);
          font-family: var(--font); font-size: 0.875rem; outline: none;
        }
        .chat-input:focus { border-color: var(--accent); }
        @media (max-width: 640px) {
          .chat-layout { grid-template-columns: 1fr; }
          .chat-sidebar { display: ${`var(--show-sidebar, block)`}; max-height: 200px; }
        }
      `}</style>
    </main>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={<main><div className="container" style={{padding:'3rem',fontFamily:'var(--mono)',fontSize:'0.82rem',color:'var(--muted)'}}>불러오는 중...</div></main>}>
      <ChatPageInner />
    </Suspense>
  )
}
