'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, onValue, update, push, set, remove, get } from 'firebase/database'
import { dealNewHand, applyAction, suitSymbol, rankDisplay, isRed } from '../../../../lib/poker'
import styles from './room.module.css'

function getDb() {
  const config = {
    apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL:       process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }
  const app = getApps().length ? getApps()[0] : initializeApp(config)
  return getDatabase(app)
}

const STAGE_LABEL = { preflop:'Pre-Flop', flop:'Flop', turn:'Turn', river:'River', showdown:'Showdown' }
const safeUid = uid => uid?.replace(/[.#$[\]]/g, '_')

// 플레이어 수에 따른 시트 위치 배치
// 위쪽: top, 아래쪽: bottom, 왼쪽: left, 오른쪽: right
function getLayout(n) {
  if (n <= 2) return ['bottom','top']
  if (n <= 4) return ['bottom','left','top','right']
  if (n <= 6) return ['bottom','left','left','top','right','right']
  return ['bottom','left','left','top','top','right','right','left'] // 최대 8
}

export default function RoomPage() {
  const { id: roomId } = useParams()
  const router = useRouter()
  const [room, setRoom]           = useState(null)
  const [chat, setChat]           = useState([])
  const [chatInput, setChatInput] = useState('')
  const [raiseAmt, setRaiseAmt]   = useState('')
  const [myUid, setMyUid]         = useState(null)
  const [myName, setMyName]       = useState('')
  const [startAnim, setStartAnim] = useState(false)
  const [endAnim, setEndAnim]     = useState(null)
  const chatEndRef = useRef(null)
  const prevStatus = useRef(null)
  const prevDone   = useRef(false)
  const leaving    = useRef(false)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    let uid, name
    if (raw) {
      const u = JSON.parse(raw)
      uid  = u.id
      name = localStorage.getItem(`poker_nick_${u.id}`) || u.name
    } else {
      uid  = localStorage.getItem('poker_anon_uid') || ('anon_' + Math.random().toString(36).slice(2))
      name = localStorage.getItem('poker_anon_nick') || '익명'
      localStorage.setItem('poker_anon_uid', uid)
    }
    setMyUid(uid); setMyName(name)
    const db = getDb()
    set(ref(db, `poker_rooms/${roomId}/players/${safeUid(uid)}`), { uid, name, joinedAt: Date.now() })
  }, [roomId])

  useEffect(() => {
    const db = getDb()
    return onValue(ref(db, `poker_rooms/${roomId}`), snap => {
      if (!snap.exists()) { router.push('/poker'); return }
      const data = { id: roomId, ...snap.val() }
      if (prevStatus.current === 'waiting' && data.status === 'playing') {
        setStartAnim(true)
        setTimeout(() => setStartAnim(false), 2300)
      }
      const gs = data.game
      if (gs?.status === 'done' && gs?.winner && !prevDone.current) {
        prevDone.current = true
        const wp = gs.players?.find(p => gs.winner.includes(p.uid))
        setEndAnim({ winnerName: wp?.name || '???', handName: wp?.handName || '', chips: wp?.chips || 0 })
        // 자동 삭제 없음 — 방장이 다시하기/나가기 선택
      }
      if (gs?.status === 'playing') prevDone.current = false
      prevStatus.current = data.status
      setRoom(data)
    })
  }, [roomId])

  useEffect(() => {
    const db = getDb()
    return onValue(ref(db, `poker_rooms/${roomId}/chat`), snap => {
      if (!snap.exists()) { setChat([]); return }
      setChat(Object.values(snap.val()).sort((a,b)=>a.ts-b.ts).slice(-60))
    })
  }, [roomId])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [chat])

  async function leaveRoom() {
    if (leaving.current) return
    leaving.current = true
    const db = getDb()
    const snap = await get(ref(db, `poker_rooms/${roomId}`))
    if (!snap.exists()) { router.push('/poker'); return }
    const rd = snap.val()
    const players = Object.values(rd.players || {})
    const rest = players.filter(p => p.uid !== myUid)
    if (rest.length === 0) {
      await remove(ref(db, `poker_rooms/${roomId}`))
    } else {
      await remove(ref(db, `poker_rooms/${roomId}/players/${safeUid(myUid)}`))
      if (rd.hostUid === myUid) {
        const newHost = rest[Math.floor(Math.random() * rest.length)]
        await update(ref(db, `poker_rooms/${roomId}`), { hostUid: newHost.uid, hostName: newHost.name })
      }
    }
    router.push('/poker')
  }

  const isHost  = room?.hostUid === myUid
  const players = room ? Object.values(room.players || {}) : []
  const gs      = room?.game || null
  const myGp    = gs?.players?.find(p => p.uid === myUid)
  const curP    = gs ? gs.players[gs.currentPlayerIdx] : null
  const isMyTurn = curP?.uid === myUid && gs?.status === 'playing'

  async function sendChat() {
    if (!chatInput.trim()) return
    await push(ref(getDb(), `poker_rooms/${roomId}/chat`), { uid: myUid, name: myName, msg: chatInput.trim(), ts: Date.now() })
    setChatInput('')
  }

  async function kickPlayer(uid) {
    if (!isHost) return
    await remove(ref(getDb(), `poker_rooms/${roomId}/players/${safeUid(uid)}`))
  }

  async function startGame() {
    if (!isHost || players.length < 2) return
    const seats = players.map(p => ({ uid: p.uid, name: p.name, chips: room.startChips }))
    const newGs = dealNewHand(seats, room.smallBlind, room.bigBlind, 0, 1)
    if (!newGs) return
    await update(ref(getDb(), `poker_rooms/${roomId}`), { status: 'playing', game: newGs })
  }

  async function doAction(action, amount) {
    if (!gs || !isMyTurn) return
    await update(ref(getDb(), `poker_rooms/${roomId}`), { game: applyAction(gs, action, amount) })
  }

  async function nextHand() {
    if (!isHost || !gs) return
    const seats = gs.players.map(p => ({ uid:p.uid, name:p.name, chips:p.chips })).filter(p => p.chips > 0)
    if (seats.length < 2) { await remove(ref(getDb(), `poker_rooms/${roomId}`)); router.push('/poker'); return }
    const newGs = dealNewHand(seats, room.smallBlind, room.bigBlind, (gs.dealerIdx+1) % seats.length, (gs.handNum||1)+1)
    prevDone.current = false
    setEndAnim(null)
    await update(ref(getDb(), `poker_rooms/${roomId}`), { game: newGs })
  }

  async function endGameExit() {
    await remove(ref(getDb(), `poker_rooms/${roomId}`))
    router.push('/poker')
  }

  const callAmt  = myGp ? Math.min((gs?.currentBet||0) - myGp.bet, myGp.chips) : 0
  const minRaise = (gs?.currentBet||0)*2 || (room?.bigBlind||50)
  const canCheck = myGp && myGp.bet===(gs?.currentBet||0) && !myGp.folded && !myGp.allIn
  const canCall  = myGp && callAmt > 0 && !myGp.folded && !myGp.allIn
  const canRaise = myGp && myGp.chips > callAmt && !myGp.folded && !myGp.allIn

  if (!room) return <div className={styles.loading}><div className={styles.loadingDot}/>로딩 중...</div>

  // ── 대기실
  if (room.status === 'waiting') return (
    <div className={styles.waitWrap}>
      <div className={styles.waitLeft}>
        <button className={styles.backBtn} onClick={leaveRoom}>← 로비</button>
        <div className={styles.waitHeader}>
          <div className={styles.waitSuit}>♠</div>
          <h2 className={styles.roomTitle}>{room.name}</h2>
          <p className={styles.roomMeta}>블라인드 {room.smallBlind}/{room.bigBlind} · 시작칩 {room.startChips.toLocaleString()}</p>
        </div>
        <div className={styles.sectionLabel}>참가자 {players.length}/{room.maxPlayers}</div>
        <div className={styles.playerList}>
          {players.map(p => (
            <div key={p.uid} className={styles.playerRow}>
              <div className={styles.avatar}>{(p.name||'?')[0].toUpperCase()}</div>
              <span className={styles.pName}>{p.name}{p.uid===myUid?' (나)':''}</span>
              {p.uid===room.hostUid && <span className={styles.hostBadge}>방장</span>}
              {isHost && p.uid!==myUid && <button className={styles.kickBtn} onClick={()=>kickPlayer(p.uid)}>추방</button>}
            </div>
          ))}
        </div>
        <div className={styles.waitBtns}>
          {isHost
            ? <button className={styles.startBtn} onClick={startGame} disabled={players.length<2}>{players.length<2?'2명 이상 필요':'게임 시작'}</button>
            : <div className={styles.waitMsg}><div className={styles.waitDots}><span/><span/><span/></div>방장이 게임을 시작하길 기다리는 중</div>
          }
          <button className={styles.leaveBtn} onClick={leaveRoom}>나가기</button>
        </div>
      </div>
      <ChatBox chat={chat} chatInput={chatInput} setChatInput={setChatInput} sendChat={sendChat} chatEndRef={chatEndRef} myUid={myUid}/>
    </div>
  )

  // ── 게임 화면
  const gPlayers  = gs?.players || []
  const layout    = getLayout(gPlayers.length)
  const topSeats  = gPlayers.filter((_,i) => layout[i]==='top')
  const botSeats  = gPlayers.filter((_,i) => layout[i]==='bottom')
  const leftSeats = gPlayers.filter((_,i) => layout[i]==='left')
  const rightSeats= gPlayers.filter((_,i) => layout[i]==='right')

  return (
    <div className={styles.gameWrap}>
      {startAnim && (
        <div className={styles.startOverlay}>
          <div className={styles.startCards}>
            {['♠A','♥K','♦Q','♣J','♠10'].map((c,i)=>(
              <div key={i} className={styles.startCard} style={{animationDelay:`${i*0.12}s`}}>
                <span>{c[0]==='♥'||c[0]==='♦'?<span style={{color:'#c0392b'}}>{c}</span>:c}</span>
              </div>
            ))}
          </div>
          <div className={styles.startText}>GAME START</div>
          <div className={styles.startSub}>행운을 빕니다</div>
        </div>
      )}

      {endAnim && (
        <div className={styles.endOverlay}>
          <div className={styles.endContent}>
            <div className={styles.endTrophy}>♛</div>
            <div className={styles.endWinner}>{endAnim.winnerName}</div>
            <div className={styles.endHand}>{endAnim.handName}</div>
            <div className={styles.endChips}>{endAnim.chips.toLocaleString()} 칩 획득</div>
            {isHost && (
              <div className={styles.endBtns}>
                <button className={styles.endReplay} onClick={nextHand}>다시하기</button>
                <button className={styles.endExit} onClick={endGameExit}>나가기</button>
              </div>
            )}
            {!isHost && (
              <div className={styles.endSub}>방장이 다음 핸드를 결정 중...</div>
            )}
            <div className={styles.confetti}>
              {Array.from({length:24},(_,i)=>(
                <div key={i} className={styles.confettiPiece} style={{
                  left:`${Math.random()*100}%`,
                  animationDelay:`${Math.random()*1.2}s`,
                  background:['#c9a84c','#e05252','#52b788','#5b8dee','#e8c96e'][i%5]
                }}/>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className={styles.gameMain}>
        {/* 상단 바 */}
        <div className={styles.gameTopBar}>
          <button className={styles.backBtn2} onClick={leaveRoom}>← 로비</button>
          <div className={styles.gameInfo}>
            <span className={styles.gameName}>{room.name}</span>
            <span className={styles.stagePill}>{STAGE_LABEL[gs?.stage]||''}</span>
            <span className={styles.handNum}>핸드 #{gs?.handNum} · 팟 {(gs?.pot||0).toLocaleString()}</span>
          </div>
          <div style={{width:60}}/>
        </div>

        {/* 테이블 + 플레이어 */}
        <div className={styles.tableArea}>
          {/* 위쪽 플레이어 */}
          <div className={styles.seatsTop}>
            {gPlayers.filter((_,i)=>layout[i]==='top').map((p,_,arr)=>{
              const gi = gPlayers.indexOf(p)
              return <SeatEl key={p.uid} p={p} gi={gi} gs={gs} myUid={myUid} styles={styles}/>
            })}
          </div>

          {/* 중간 행: 왼쪽 시트 + 펠트 + 오른쪽 시트 */}
          <div style={{display:'flex',alignItems:'center',gap:'1rem',width:'100%',justifyContent:'center'}}>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {gPlayers.filter((_,i)=>layout[i]==='left').map(p=>{
                const gi = gPlayers.indexOf(p)
                return <SeatEl key={p.uid} p={p} gi={gi} gs={gs} myUid={myUid} styles={styles}/>
              })}
            </div>

            {/* 펠트 */}
            <div className={styles.felt}>
              <div className={styles.pot}>
                <div className={styles.potLabel}>POT</div>
                <div className={styles.potInfo}>
                  <span className={styles.potVal}>{(gs?.pot||0).toLocaleString()}</span>
                </div>
              </div>
              <div className={styles.community}>
                {Array.from({length:5},(_,i)=><CardEl key={i} card={gs?.community?.[i]}/>)}
              </div>
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {gPlayers.filter((_,i)=>layout[i]==='right').map(p=>{
                const gi = gPlayers.indexOf(p)
                return <SeatEl key={p.uid} p={p} gi={gi} gs={gs} myUid={myUid} styles={styles}/>
              })}
            </div>
          </div>

          {/* 아래쪽 플레이어 */}
          <div className={styles.seatsBottom}>
            {gPlayers.filter((_,i)=>layout[i]==='bottom').map(p=>{
              const gi = gPlayers.indexOf(p)
              return <SeatEl key={p.uid} p={p} gi={gi} gs={gs} myUid={myUid} styles={styles}/>
            })}
          </div>
        </div>

        {/* 액션바 */}
        {gs?.status==='playing' && isMyTurn && !myGp?.folded && !myGp?.allIn && (
          <div className={styles.actionBar}>
            <div className={styles.myCards}>
              {myGp?.holeCards?.map((c,i)=><CardEl key={i} card={c}/>)}
              <span className={styles.myTurnTag}>내 차례</span>
            </div>
            <div className={styles.btns}>
              <button className={`${styles.btn} ${styles.fold}`}  onClick={()=>doAction('fold')}>폴드</button>
              {canCheck && <button className={`${styles.btn} ${styles.check}`} onClick={()=>doAction('check')}>체크</button>}
              {canCall  && <button className={`${styles.btn} ${styles.call}`}  onClick={()=>doAction('call')}>콜 {callAmt.toLocaleString()}</button>}
              {canRaise && (
                <div className={styles.raiseGroup}>
                  <input className={styles.raiseInput} type="number" value={raiseAmt} onChange={e=>setRaiseAmt(e.target.value)} placeholder={minRaise} min={minRaise} max={myGp.chips+myGp.bet}/>
                  <button className={`${styles.btn} ${styles.raise}`} onClick={()=>doAction('raise',parseInt(raiseAmt)||minRaise)}>레이즈</button>
                </div>
              )}
              <button className={`${styles.btn} ${styles.allin}`} onClick={()=>doAction('allin')}>올인</button>
            </div>
          </div>
        )}
        {gs?.status==='playing' && !isMyTurn && myGp && (
          <div className={styles.actionBar}>
            <div className={styles.myCards}>{myGp?.holeCards?.map((c,i)=><CardEl key={i} card={c}/>)}</div>
            <span className={styles.waitTurn}>{curP?.name}의 차례...</span>
          </div>
        )}
        {gs?.status==='done' && !endAnim && isHost && (
          <div className={styles.actionBar}>
            <button className={`${styles.btn} ${styles.call}`} style={{padding:'0.7rem 2.5rem'}} onClick={nextHand}>다음 핸드 시작</button>
          </div>
        )}
        {gs?.status==='done' && !endAnim && !isHost && (
          <div className={styles.actionBar}>
            <span className={styles.waitTurn}>방장이 다음 핸드를 시작하길 기다리는 중...</span>
          </div>
        )}

        {/* 로그 */}
        <div className={styles.logBox}>
          {(gs?.log||[]).map((l,i)=><div key={i} className={styles.logLine} style={{opacity:1-i*0.12}}>{l}</div>)}
        </div>
      </div>

      <ChatBox chat={chat} chatInput={chatInput} setChatInput={setChatInput} sendChat={sendChat} chatEndRef={chatEndRef} myUid={myUid}/>
    </div>
  )
}

function SeatEl({ p, gi, gs, myUid, styles }) {
  const isCur    = gi===gs.currentPlayerIdx && gs.status==='playing'
  const isWin    = gs.winner?.includes(p.uid)
  const showHole = gs.showCards && !p.folded
  const isMe     = p.uid===myUid
  return (
    <div className={`${styles.seat} ${isCur?styles.seatCur:''} ${p.folded?styles.seatFold:''} ${isWin?styles.seatWin:''}`}>
      {isCur && <div className={styles.turnGlow}/>}
      <div className={styles.seatTop}>
        <span className={styles.seatName}>{p.name}{isMe?' (나)':''}</span>
        <div className={styles.badges}>
          {gi===gs.dealerIdx && <span className={styles.badge}>D</span>}
          {gi===gs.sbIdx     && <span className={styles.badge}>SB</span>}
          {gi===gs.bbIdx     && <span className={styles.badge}>BB</span>}
          {p.allIn           && <span className={styles.badgeRed}>ALL IN</span>}
        </div>
      </div>
      <div className={styles.seatChips}>{p.chips.toLocaleString()}</div>
      {p.bet>0 && <div className={styles.seatBet}>BET {p.bet.toLocaleString()}</div>}
      {p.handName && gs.stage==='showdown' && <div className={styles.handName}>{p.handName}</div>}
      <div className={styles.holeCards}>
        {p.holeCards?.map((c,ci)=><CardEl key={ci} card={c} faceDown={!showHole&&!isMe} small/>)}
      </div>
      {p.folded && <div className={styles.foldOverlay}>FOLD</div>}
      {isWin    && <div className={styles.winOverlay}>WIN ♛</div>}
    </div>
  )
}

function CardEl({ card, faceDown, small }) {
  if (!card || faceDown) return <div className={`${styles.card} ${styles.cardBack} ${small?styles.cardSm:''}`}/>
  return (
    <div className={`${styles.card} ${isRed(card.suit)?styles.cardRed:styles.cardBlk} ${small?styles.cardSm:''}`}>
      <span>{rankDisplay(card.rank)}</span>
      <span>{suitSymbol(card.suit)}</span>
    </div>
  )
}

function ChatBox({ chat, chatInput, setChatInput, sendChat, chatEndRef, myUid }) {
  return (
    <div className={styles.chatBox}>
      <div className={styles.chatHead}>채팅</div>
      <div className={styles.chatMsgs}>
        {chat.map((m,i)=>(
          <div key={i} className={`${styles.msg} ${m.uid===myUid?styles.msgMe:''}`}>
            <span className={styles.msgName}>{m.name}</span>
            <span className={styles.msgText}>{m.msg}</span>
          </div>
        ))}
        <div ref={chatEndRef}/>
      </div>
      <div className={styles.chatRow}>
        <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendChat()} placeholder="메시지..." maxLength={100}/>
        <button onClick={sendChat}>전송</button>
      </div>
    </div>
  )
}
