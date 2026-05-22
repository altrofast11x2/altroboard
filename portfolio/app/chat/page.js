'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ChatComposer from '../components/ChatComposer'

function ChatInner() {
  const [user,         setUser]         = useState(null)
  const [rooms,        setRooms]        = useState([])
  const [loadingRooms, setLoadingRooms] = useState(true)
  const [activeRoom,   setActiveRoom]   = useState(null)
  const [messages,     setMessages]     = useState([])
  const [otherName,    setOtherName]    = useState('')
  const [otherUid,     setOtherUid]     = useState('')
  const [sending,      setSending]      = useState(false)
  // 다른 사용자가 이 방을 마지막으로 본 시각 — 읽음 표시
  const [otherSeen,    setOtherSeen]    = useState(0)

  // 그룹 생성 모달
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [groupName,    setGroupName]    = useState('')
  const [groupQuery,   setGroupQuery]   = useState('')
  const [groupUsers,   setGroupUsers]   = useState([])  // 검색 결과
  const [groupSelected, setGroupSelected] = useState([]) // {id, name, avatar}
  const [groupCreating, setGroupCreating] = useState(false)
  const [groupErr,     setGroupErr]     = useState('')

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
    setOtherSeen(0)

    const fetchMsgs = async () => {
      try {
        const res  = await fetch(`/api/chat/${roomId}?userId=${uidRef.current}`)
        const data = await res.json()
        if (Array.isArray(data)) setMessages(data)
      } catch (e) { console.error('fetchMsgs error', e) }
    }

    // 내가 이 방을 봤다는 표시 (messages_seen) — 읽음 카운터 0
    if (uidRef.current && roomId) {
      fetch('/api/chat/seen', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uidRef.current, roomId }),
      }).catch(()=>{})
    }
    // 상대방의 마지막 본 시각 조회
    if (rOtherUid) {
      fetch(`/api/chat/seen?userId=${encodeURIComponent(rOtherUid)}&roomId=${encodeURIComponent(roomId)}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.lastSeenAt) setOtherSeen(Number(d.lastSeenAt) || 0) })
        .catch(()=>{})
    }

    await fetchMsgs()
    scrollBottom()

    // mark unread 0 locally
    setRooms(prev => prev.map(r => r.roomId === roomId ? { ...r, unread: 0 } : r))

    // 폴링 — 응답성 우선: 5초마다 메시지+seen, rooms 는 15초마다 (3번에 1번).
    let tick = 0
    pollRef.current = setInterval(async () => {
      if (activeRef.current !== roomId) return
      tick++
      // 메시지 + 상대방 seen 은 매번 — 읽음 표시 빨리 갱신되도록
      await fetchMsgs()
      if (rOtherUid) {
        try {
          const sr = await fetch(`/api/chat/seen?userId=${encodeURIComponent(rOtherUid)}&roomId=${encodeURIComponent(roomId)}`)
          if (sr.ok) {
            const sd = await sr.json()
            if (sd?.lastSeenAt) setOtherSeen(Number(sd.lastSeenAt) || 0)
          }
        } catch {}
      }
      // rooms 갱신은 3번에 1번 (15초마다) — 좌측 목록은 자주 안 변함
      if (tick % 3 === 0) {
        try {
          const res = await fetch(`/api/chat?userId=${uidRef.current}`)
          const data = await res.json()
          if (Array.isArray(data)) setRooms(data)
        } catch {}
      }
    }, 5000)
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

  // 현재 활성 방이 그룹인지
  const activeRoomObj = rooms.find(r => r.roomId === activeRoom)
  const isGroupActive = !!activeRoomObj?.isGroup

  // ── unified send (ChatComposer) ─────────────────────────────
  //   payload: { message, imageUrl, gifUrl }
  const sendComposer = async ({ message, imageUrl, gifUrl }) => {
    if (!activeRef.current || !user) return
    if (!message && !imageUrl && !gifUrl) return
    setSending(true)
    try {
      const base = isGroupActive
        ? { fromId: user.id, fromName: user.name, roomId: activeRef.current }
        : { fromId: user.id, fromName: user.name, toId: otherUid, toName: otherName }
      const body = { ...base }
      if (message)  body.message  = message
      if (imageUrl) body.imageUrl = imageUrl
      if (gifUrl)   body.gifUrl   = gifUrl
      await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const res  = await fetch(`/api/chat/${activeRef.current}?userId=${user.id}`)
      const data = await res.json()
      if (Array.isArray(data)) setMessages(data)
    } catch (e) { console.error(e) }
    setSending(false)
  }

  if (!user) return null

  const fmt     = iso => new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  const fmtDate = iso => new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })

  return (
    <main>
      <div className="container" style={{ maxWidth: '960px', padding: '1.5rem' }}>
        <div className="section-header" style={{ marginBottom: '1rem', display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:'.5rem' }}>
          <div>
            <h2>메시지</h2>
            <p>1:1 · 그룹 채팅</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={()=>setShowCreateGroup(true)}>+ 그룹채팅 만들기</button>
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
                  게시글 작성자 프로필에서<br />메시지를 시작하거나<br />그룹채팅을 만들어 보세요
                </p>
              </div>
            ) : (
              rooms.map(r => {
                const displayName = r.isGroup ? r.groupName : (r.otherName || r.otherUid)
                const firstChar = (displayName || '?')[0].toUpperCase()
                return (
                  <button
                    key={r.roomId}
                    className={`chat-room-btn ${activeRoom === r.roomId ? 'active' : ''}`}
                    onClick={() => openRoom(r.roomId, r.isGroup ? '' : r.otherUid, displayName)}
                  >
                    <div className={`c-avatar sm ${r.isGroup?'group':''}`}>{firstChar}</div>
                    <div className="chat-room-txt">
                      <div className="chat-room-name">
                        {r.isGroup && <span style={{fontSize:'.65rem',color:'var(--muted)',marginRight:4}}>[그룹·{r.memberCount}]</span>}
                        {displayName}
                      </div>
                      <div className="chat-room-last">{r.lastMessage || '대화를 시작해보세요'}</div>
                    </div>
                    {r.unread > 0 && <span className="unread-badge">{r.unread > 9 ? '9+' : r.unread}</span>}
                  </button>
                )
              })
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
                  <div className={`c-avatar sm ${isGroupActive?'group':''}`}>{(otherName || '?')[0].toUpperCase()}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{ fontFamily: 'var(--serif)', fontWeight: 700 }}>
                      {isGroupActive && <span style={{fontSize:'.65rem',color:'var(--muted)',marginRight:6}}>그룹 · {activeRoomObj?.memberCount}명</span>}
                      {otherName}
                    </div>
                    {isGroupActive && (
                      <div style={{fontFamily:'var(--mono)',fontSize:'.62rem',color:'var(--muted)',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {Object.values(activeRoomObj?.memberNames || {}).join(', ')}
                      </div>
                    )}
                  </div>
                  {isGroupActive ? (
                    <button className="btn btn-sm" style={{marginLeft:'auto'}} onClick={async ()=>{
                      if (!confirm('이 그룹채팅에서 나가시겠습니까?')) return
                      const res = await fetch('/api/chat/groups', {
                        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ actorId: user.id, roomId: activeRoom, action: 'leave' }),
                      })
                      if (res.ok) {
                        setActiveRoom(null); activeRef.current = null
                        loadRooms(user.id)
                      }
                    }}>나가기</button>
                  ) : (
                    <Link href={`/profile/${otherUid}`} className="btn btn-sm" style={{ marginLeft: 'auto' }}>프로필</Link>
                  )}
                </div>

                <div className="chat-messages">
                  {messages.length === 0 ? (
                    <div className="chat-dim" style={{ height: '100%' }}>첫 메시지를 보내보세요!</div>
                  ) : (
                    messages.map((m, i) => {
                      const isMine   = m.fromId === user.id
                      const showDate = i === 0 || fmtDate(messages[i - 1].createdAt) !== fmtDate(m.createdAt)
                      // 읽음 표시 — mine 메시지에 대해, 상대방의 마지막 본 시각이 이 메시지보다 늦으면 "읽음"
                      const msgTs = typeof m.createdAt === 'number' ? m.createdAt : new Date(m.createdAt || 0).getTime()
                      const isRead = isMine && !isGroupActive && otherSeen > 0 && otherSeen >= msgTs
                      const mediaUrl = m.imageUrl || m.gifUrl
                      return (
                        <div key={m.id || i}>
                          {showDate && <div className="date-divider">{fmtDate(m.createdAt)}</div>}
                          <div className={`msg-row ${isMine ? 'mine' : 'theirs'}`}>
                            {!isMine && <div className="c-avatar xs">{(m.fromName || '?')[0].toUpperCase()}</div>}
                            <div className="bubble-wrap">
                              {!isMine && isGroupActive && <div className="msg-name">{m.fromName}</div>}
                              <div className={`bubble ${isMine ? 'bubble-mine' : ''} ${mediaUrl ? 'has-media' : ''}`}>
                                {mediaUrl && (
                                  <img src={mediaUrl} alt={m.gifUrl ? 'GIF' : '사진'} className="chat-img"
                                    onClick={() => {
                                      const lb = document.createElement('div')
                                      lb.className = 'lightbox'; lb.onclick = () => lb.remove()
                                      const im = document.createElement('img'); im.src = mediaUrl
                                      lb.appendChild(im); document.body.appendChild(lb)
                                    }} />
                                )}
                                {m.message && <span>{m.message}</span>}
                              </div>
                              <div className={`msg-time ${isMine ? 'right' : ''}`}>
                                {fmt(m.createdAt)}
                                {isMine && !isGroupActive && (
                                  <span className={`msg-read ${isRead ? 'on' : ''}`} title={isRead ? '읽음' : '전송됨'}>
                                    {/* 카톡/인스타 스타일 — 안읽음: 회색 ✓, 읽음: 파란 ✓✓ */}
                                    {isRead ? (
                                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-label="읽음">
                                        <polyline points="2 12 6 16 14 8"/>
                                        <polyline points="10 12 14 16 22 8"/>
                                      </svg>
                                    ) : (
                                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-label="전송됨">
                                        <polyline points="5 12 10 17 19 7"/>
                                      </svg>
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                <ChatComposer onSend={sendComposer} disabled={sending} />
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
        .msg-time{font-family:var(--mono);font-size:.62rem;color:var(--muted);margin-top:.2rem;display:inline-flex;align-items:center;gap:.3rem;}
        .msg-time.right{text-align:right;justify-content:flex-end;display:flex;}
        .msg-read{display:inline-flex;align-items:center;color:var(--muted);}
        .msg-read.on{color:#3498db;}
        .msg-read svg{display:block;}
        .bubble.has-media{padding:.35rem;}
        .bubble.has-media span{display:block;padding:.15rem .35rem;}
        .chat-input-row{display:flex;gap:.5rem;padding:.8rem 1.2rem;border-top:1px solid var(--border);flex-shrink:0;background:var(--surface2);align-items:center;}
        .chat-input{flex:1;background:var(--bg);border:1px solid var(--border);border-radius:2px;padding:.5rem .8rem;color:var(--text);font-family:var(--font);font-size:.875rem;outline:none;}
        .chat-input:focus{border-color:var(--accent);}
        .img-btn{background:none;border:1px solid var(--border);border-radius:2px;padding:.35rem .55rem;cursor:pointer;font-size:1rem;line-height:1;transition:border-color .2s;flex-shrink:0;}
        .img-btn:hover{border-color:var(--accent);}
        .img-btn:disabled{opacity:.5;cursor:not-allowed;}
        .c-avatar{border-radius:50%;background:var(--accent);color:#fff;font-family:var(--serif);font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .c-avatar.sm{width:34px;height:34px;font-size:.9rem;}
        .c-avatar.xs{width:26px;height:26px;font-size:.65rem;}
        .c-avatar.group{background:#2980b9;}
        @media(max-width:640px){.chat-layout{grid-template-columns:1fr;}.chat-sidebar{max-height:180px;border-right:none;border-bottom:1px solid var(--border);}}
        /* 그룹 생성 모달 */
        .gc-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:8000;display:flex;align-items:center;justify-content:center;padding:1rem;}
        .gc-modal{background:var(--surface);border-radius:8px;width:min(480px,100%);max-height:90vh;overflow-y:auto;padding:1.5rem;box-shadow:0 20px 60px rgba(0,0,0,.4);}
        .gc-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;}
        .gc-head h3{font-family:var(--serif);font-size:1.1rem;color:var(--ink);}
        .gc-x{background:none;border:none;font-size:1.1rem;cursor:pointer;color:var(--muted);padding:.2rem .4rem;}
        .gc-search-results{max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;background:var(--bg);}
        .gc-user-row{display:flex;align-items:center;gap:.6rem;padding:.5rem .75rem;cursor:pointer;border-bottom:1px solid var(--border);}
        .gc-user-row:hover{background:var(--surface2);}
        .gc-user-row:last-child{border-bottom:none;}
        .gc-user-avatar{width:32px;height:32px;border-radius:50%;background:var(--accent);color:#fff;font-family:var(--serif);font-weight:700;display:flex;align-items:center;justify-content:center;font-size:.85rem;}
        .gc-selected{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.6rem;}
        .gc-chip{display:inline-flex;align-items:center;gap:.35rem;background:var(--accent);color:#fff;padding:.2rem .55rem;border-radius:20px;font-family:var(--mono);font-size:.72rem;}
        .gc-chip button{background:none;border:none;color:#fff;cursor:pointer;font-size:.85rem;line-height:1;padding:0;}
      `}</style>

      {/* 그룹 채팅 생성 모달 */}
      {showCreateGroup && user && (
        <div className="gc-overlay" onClick={()=>!groupCreating && setShowCreateGroup(false)}>
          <div className="gc-modal" onClick={e=>e.stopPropagation()}>
            <div className="gc-head">
              <h3>새 그룹채팅</h3>
              <button className="gc-x" onClick={()=>!groupCreating && setShowCreateGroup(false)}>✕</button>
            </div>
            {groupErr && <div className="alert alert-error">{groupErr}</div>}
            <div className="form-group">
              <label>그룹 이름 (40자 이하)</label>
              <input maxLength={40} value={groupName} onChange={e=>setGroupName(e.target.value)} placeholder="예: 코딩 스터디"/>
            </div>
            <div className="form-group">
              <label>멤버 검색</label>
              <input value={groupQuery}
                onChange={async e=>{
                  const q = e.target.value
                  setGroupQuery(q)
                  if (q.trim().length < 1) { setGroupUsers([]); return }
                  try {
                    const res = await fetch(`/api/suggest-users?q=${encodeURIComponent(q.trim())}`)
                    const data = await res.json()
                    setGroupUsers(Array.isArray(data) ? data.filter(u => u.id !== user.id) : [])
                  } catch {}
                }}
                placeholder="이름으로 검색..."/>
            </div>
            {groupUsers.length > 0 && (
              <div className="gc-search-results">
                {groupUsers.map(u => {
                  const already = groupSelected.find(s => s.id === u.id)
                  return (
                    <div key={u.id} className="gc-user-row" onClick={()=>{
                      if (already) setGroupSelected(prev => prev.filter(s => s.id !== u.id))
                      else setGroupSelected(prev => [...prev, { id: u.id, name: u.name, avatar: u.avatar }])
                    }}>
                      {u.avatar
                        ? <img src={u.avatar} alt="" style={{width:32,height:32,borderRadius:'50%',objectFit:'cover'}}/>
                        : <div className="gc-user-avatar">{(u.name||'?')[0].toUpperCase()}</div>}
                      <span style={{flex:1,fontSize:'.85rem'}}>{u.name}</span>
                      <span style={{fontFamily:'var(--mono)',fontSize:'.72rem',color: already ? 'var(--accent)' : 'var(--muted)'}}>
                        {already ? '✓ 선택됨' : '추가'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
            {groupSelected.length > 0 && (
              <div className="gc-selected">
                {groupSelected.map(s => (
                  <span key={s.id} className="gc-chip">
                    {s.name}
                    <button onClick={()=>setGroupSelected(prev => prev.filter(x => x.id !== s.id))}>×</button>
                  </span>
                ))}
              </div>
            )}
            <div style={{display:'flex',gap:'.5rem',justifyContent:'flex-end',marginTop:'1rem'}}>
              <button className="btn btn-sm" onClick={()=>!groupCreating && setShowCreateGroup(false)} disabled={groupCreating}>취소</button>
              <button className="btn btn-primary btn-sm"
                onClick={async ()=>{
                  setGroupErr('')
                  if (!groupName.trim()) { setGroupErr('이름을 입력하세요'); return }
                  if (groupSelected.length === 0) { setGroupErr('멤버를 한 명 이상 선택하세요'); return }
                  setGroupCreating(true)
                  try {
                    const res = await fetch('/api/chat/groups', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        actorId: user.id, name: groupName.trim(),
                        memberIds: groupSelected.map(s => s.id),
                      }),
                    })
                    const data = await res.json()
                    if (!res.ok) { setGroupErr(data.error || '실패'); setGroupCreating(false); return }
                    setShowCreateGroup(false)
                    setGroupName(''); setGroupQuery(''); setGroupUsers([]); setGroupSelected([])
                    const list = await loadRooms(user.id)
                    if (list.find(r => r.roomId === data.roomId)) {
                      openRoom(data.roomId, '', data.name)
                    }
                  } catch (e) { setGroupErr('네트워크 오류') }
                  setGroupCreating(false)
                }}
                disabled={groupCreating || !groupName.trim() || groupSelected.length === 0}>
                {groupCreating ? '만드는 중...' : '그룹채팅 만들기'}
              </button>
            </div>
          </div>
        </div>
      )}
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
