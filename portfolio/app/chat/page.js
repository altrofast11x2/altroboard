'use client'
import { useState, useEffect, useRef } from 'react'
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
  const pollingRef = useRef(null)
  const messagesEndRef = useRef(null)
  const fileRef = useRef(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  // 이미지 → base64 변환
  const resizeToBase64 = (file) => new Promise((resolve) => {
    if (file.type === 'image/gif') {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target.result)
      reader.readAsDataURL(file)
      return
    }
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 800
      let w = img.width, h = img.height
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX }
        else { w = Math.round(w * MAX / h); h = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    img.src = url
  })

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) { alert('5MB 이하 이미지만 첨부 가능합니다'); return }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (!u) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    setUser(parsed)

    const withId = searchParams.get('with')
    const withName = searchParams.get('name')

    loadRooms(parsed, withId, withName)
  }, [])

  // 메시지 영역 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadRooms = async (parsedUser, openWithId, openWithName) => {
    setLoading(true)

    // user.id와 user.email 둘 다로 조회 후 중복 제거 (과거 데이터 호환)
    const ids = [...new Set([parsedUser.id, parsedUser.email].filter(Boolean))]
    const allRooms = []
    const seen = new Set()
    for (const uid of ids) {
      try {
        const res = await fetch(`/api/chat?userId=${encodeURIComponent(uid)}`)
        const data = await res.json()
        if (Array.isArray(data)) {
          for (const r of data) {
            if (!seen.has(r.roomId)) {
              seen.add(r.roomId)
              allRooms.push(r)
            }
          }
        }
      } catch {}
    }
    // 최신순 정렬
    allRooms.sort((a, b) => {
      if (!a.lastAt && !b.lastAt) return 0
      if (!a.lastAt) return 1
      if (!b.lastAt) return -1
      return b.lastAt.localeCompare(a.lastAt)
    })

    setRooms(allRooms)
    setLoading(false)

    if (openWithId) {
      // 가능한 모든 roomId 조합 시도 (id/email 혼용 대응)
      let existing = null
      for (const myId of ids) {
        const [a, b] = [myId, openWithId].sort()
        const rid = `${a}__${b}`
        existing = allRooms.find(r => r.roomId === rid)
        if (existing) break
      }
      const myId = parsedUser.id
      const [a, b] = [myId, openWithId].sort()
      const roomId = `${a}__${b}`
      openRoom(
        existing ? existing.roomId : roomId,
        existing ? existing.otherName : (openWithName || openWithId),
        myId,
        existing ? null : { roomId, otherUid: openWithId, otherName: openWithName || openWithId, lastMessage: '', unread: 0 }
      )
    }
  }

  const openRoom = async (roomId, name, userId, newRoomObj) => {
    // 폴링 초기화
    if (pollingRef.current) clearInterval(pollingRef.current)

    setActiveRoom(roomId)
    setOtherName(name)
    setMessages([])

    if (newRoomObj) {
      setRooms(prev => [newRoomObj, ...prev.filter(r => r.roomId !== roomId)])
    }

    // ★ 버그 수정: userId를 항상 직접 파라미터로 전달 (user state 의존 X)
    const uid = userId
    const res = await fetch(`/api/chat/${roomId}?userId=${uid}`)
    setMessages(await res.json())

    setRooms(prev => prev.map(r => r.roomId === roomId ? { ...r, unread: 0 } : r))

    // 3초 폴링
    pollingRef.current = setInterval(async () => {
      const pr = await fetch(`/api/chat/${roomId}?userId=${uid}`)
      setMessages(await pr.json())
      // 폴링 중 unread 갱신
      setRooms(prev => prev.map(r => r.roomId === roomId ? { ...r, unread: 0 } : r))
    }, 3000)
  }

  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current) }, [])

  const sendMessage = async (e) => {
    e?.preventDefault()
    if ((!msgText.trim() && !imageFile) || !activeRoom || !user) return
    setSending(true)

    const otherUid = activeRoom.split('__').find(id => id !== user.id)
    const room = rooms.find(r => r.roomId === activeRoom)

    let imageUrl = null
    if (imageFile) {
      imageUrl = await resizeToBase64(imageFile)
      removeImage()
    }

    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromId: user.id,
        fromName: user.name,
        toId: otherUid,
        toName: room?.otherName || otherUid,
        message: msgText,
        imageUrl,
      }),
    })
    const sentText = msgText
    setMsgText('')
    setSending(false)

    const res = await fetch(`/api/chat/${activeRoom}?userId=${user.id}`)
    const newMsgs = await res.json()
    setMessages(newMsgs)

    setRooms(prev => prev.map(r => r.roomId === activeRoom
      ? { ...r, lastMessage: imageUrl ? (sentText.trim() || '📷 사진') : sentText.slice(0, 60), lastAt: new Date().toISOString() }
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
          {/* Sidebar */}
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
                  onClick={() => openRoom(room.roomId, room.otherName, user.id, null)}
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
                  왼쪽 목록에서 대화를 선택하거나<br />프로필 페이지에서 새 대화를 시작하세요
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

                <div className="chat-messages">
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
                                {m.imageUrl && (
                                  <img
                                    src={m.imageUrl}
                                    alt="첨부 이미지"
                                    style={{
                                      maxWidth: '100%', maxHeight: '280px',
                                      borderRadius: '8px', display: 'block',
                                      marginBottom: m.message ? '0.5rem' : 0
                                    }}
                                  />
                                )}
                                {m.message && m.message}
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
                  <div ref={messagesEndRef} />
                </div>

                {/* 이미지 미리보기 */}
                {imagePreview && (
                  <div style={{
                    padding: '0.5rem 1.25rem',
                    background: 'var(--surface2)',
                    borderTop: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: '0.75rem'
                  }}>
                    <img src={imagePreview} alt="" style={{ height: '60px', borderRadius: '6px', border: '1px solid var(--border)' }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'var(--mono)', flex: 1 }}>사진 첨부됨</span>
                    <button onClick={removeImage} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--muted)', fontSize: '1rem', padding: '0.2rem'
                    }}>✕</button>
                  </div>
                )}

                <form className="chat-input-row" onSubmit={sendMessage}>
                  {/* 이미지 첨부 버튼 */}
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    style={{
                      background: 'none', border: '1px solid var(--border)',
                      borderRadius: '2px', cursor: 'pointer', padding: '0.5rem 0.6rem',
                      color: 'var(--muted)', fontSize: '1.1rem', lineHeight: 1,
                      flexShrink: 0
                    }}
                    title="사진 첨부"
                  >📷</button>
                  <input
                    className="chat-input"
                    placeholder="메시지를 입력하세요..."
                    value={msgText}
                    onChange={e => setMsgText(e.target.value)}
                    disabled={sending}
                    autoComplete="off"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={sending || (!msgText.trim() && !imageFile)}>
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
        .chat-area { display: flex; flex-direction: column; overflow: hidden; }
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
          color: var(--muted); margin: 0.75rem 0; position: relative;
        }
        .chat-date-divider::before, .chat-date-divider::after {
          content: ''; position: absolute; top: 50%; width: 30%;
          height: 1px; background: var(--border);
        }
        .chat-date-divider::before { left: 0; }
        .chat-date-divider::after { right: 0; }
        .chat-msg-row {
          display: flex; gap: 0.5rem; align-items: flex-end; margin: 0.2rem 0;
        }
        .chat-msg-row.mine { flex-direction: row-reverse; }
        .chat-msg-avatar {
          width: 26px; height: 26px; border-radius: 50%;
          background: var(--border-dark); color: var(--bg);
          font-family: var(--serif); font-size: 0.65rem; font-weight: 700;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
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
          font-family: var(--mono); font-size: 0.62rem; color: var(--muted); margin-top: 0.2rem;
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
          .chat-sidebar { max-height: 200px; }
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
