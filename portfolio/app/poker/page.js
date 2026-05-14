'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, onValue, push, set } from 'firebase/database'
import styles from './poker.module.css'

const ADJECTIVES = ['빠른','용감한','차분한','날카로운','신중한','강한','현명한','영리한','조용한','대담한']
const NOUNS      = ['사자','독수리','호랑이','늑대','여우','곰','팬더','매','용','상어']
function randomNick() {
  return ADJECTIVES[Math.floor(Math.random()*ADJECTIVES.length)] + ' ' + NOUNS[Math.floor(Math.random()*NOUNS.length)]
}

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

export default function PokerLobby() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [pokerNick, setPokerNick] = useState('')
  const [nicknameSet, setNicknameSet] = useState(false)
  const [rooms, setRooms] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [smallBlind, setSmallBlind] = useState(25)
  const [startChips, setStartChips] = useState(1000)
  const [isPrivate, setIsPrivate] = useState(false)
  const [password, setPassword] = useState('')
  const [pwInputs, setPwInputs] = useState({})
  const [creating, setCreating] = useState(false)
  const [entering, setEntering] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    let uid, name
    if (raw) {
      const u = JSON.parse(raw)
      uid = u.id; name = u.name
      const savedNick = localStorage.getItem(`poker_nick_${u.id}`)
      if (savedNick) { setPokerNick(savedNick); setNicknameSet(true) }
      else { setPokerNick(name || randomNick()) }
      setUser({ id: uid, name: savedNick || name })
    } else {
      const anonUid = localStorage.getItem('poker_anon_uid') || ('anon_' + Math.random().toString(36).slice(2))
      const anonNick = localStorage.getItem('poker_anon_nick') || randomNick()
      localStorage.setItem('poker_anon_uid', anonUid)
      localStorage.setItem('poker_anon_nick', anonNick)
      setPokerNick(anonNick)
      setUser({ id: anonUid, name: anonNick })
    }
  }, [])

  useEffect(() => {
    try {
      const db = getDb()
      return onValue(ref(db, 'poker_rooms'), snap => {
        if (!snap.exists()) { setRooms([]); return }
        setRooms(Object.entries(snap.val())
          .map(([id, r]) => ({ id, ...r }))
          .filter(r => r.status !== 'closed')
          .sort((a, b) => b.createdAt - a.createdAt))
      })
    } catch(e) { console.error(e) }
  }, [])

  function confirmNick() {
    if (!pokerNick.trim()) return
    const nick = pokerNick.trim()
    if (user?.id && !user.id.startsWith('anon_')) {
      localStorage.setItem(`poker_nick_${user.id}`, nick)
    } else {
      localStorage.setItem('poker_anon_nick', nick)
    }
    setUser(u => ({ ...u, name: nick }))
    setNicknameSet(true)
  }

  async function createRoom() {
    if (!roomName.trim() || creating || !user) return
    setCreating(true)
    try {
      const db = getDb()
      const roomRef = push(ref(db, 'poker_rooms'))
      await set(roomRef, {
        name: roomName.trim(),
        hostUid: user.id,
        hostName: user.name || pokerNick,
        maxPlayers,
        smallBlind,
        bigBlind: smallBlind * 2,
        startChips,
        isPrivate,
        password: isPrivate ? password : '',
        status: 'waiting',
        createdAt: Date.now(),
        players: {},
        game: null,
      })
      setShowCreate(false)
      setRoomName('')
      enterRoom(roomRef.key)
    } catch(e) {
      console.error('방 생성 실패:', e)
      alert('방 생성에 실패했습니다: ' + e.message)
      setCreating(false)
    }
  }

  function enterRoom(roomId) {
    setEntering(true)
    setTimeout(() => router.push(`/poker/room/${roomId}`), 1200)
  }

  async function joinRoom(room) {
    if (room.isPrivate && (pwInputs[room.id] || '') !== room.password) {
      alert('비밀번호가 틀렸습니다'); return
    }
    enterRoom(room.id)
  }

  const pCount = r => Object.keys(r.players || {}).length

  // ── Nick setup screen
  if (!nicknameSet) return (
    <div className={styles.nickWrap}>
      <div className={styles.nickCard}>
        <div className={styles.nickSuit}>♠ ♥ ♦ ♣</div>
        <div className={styles.nickTitle}>POKER CLUB</div>
        <p className={styles.nickSub}>CozyBoard 포커 테이블</p>
        <input
          className={styles.nickInput}
          value={pokerNick}
          onChange={e => setPokerNick(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && confirmNick()}
          maxLength={16}
          placeholder="닉네임"
          autoFocus
        />
        <button className={styles.nickBtn} onClick={confirmNick}>입장하기</button>
        <p className={styles.nickNote}>닉네임은 포커 테이블에서만 사용됩니다</p>
      </div>
    </div>
  )

  // ── Lobby
  return (
    <>
      {entering && (
        <div className={styles.enterOverlay}>
          <div className={styles.enterAnim}>
            <div className={styles.enterCards}>
              <div className={styles.enterCard} style={{transform:'rotate(-15deg) translateX(-40px)'}}>♠A</div>
              <div className={styles.enterCard} style={{transform:'rotate(0deg)'}}>♥K</div>
              <div className={styles.enterCard} style={{transform:'rotate(15deg) translateX(40px)'}}>♦Q</div>
            </div>
            <div className={styles.enterText}>포커 테이블 입장 중...</div>
          </div>
        </div>
      )}
      <div className={styles.lobbyWrap}>
        <div className={styles.lobbyHero}>
          <div className={styles.heroLeft}>
            <div className={styles.heroTitle}>♠ Texas Hold'em</div>
            <div className={styles.heroSub}>{user?.name || pokerNick}으로 입장 · 실시간 멀티플레이어</div>
          </div>
          <div className={styles.heroRight}>
            <button className={styles.changeNickBtn} onClick={() => setNicknameSet(false)}>닉네임 변경</button>
            <button className={styles.createBtn} onClick={() => setShowCreate(true)}>+ 방 만들기</button>
          </div>
        </div>

        <div className={styles.roomGrid}>
          {rooms.length === 0 && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>♠</div>
              <p>열린 방이 없습니다</p>
              <p>첫 번째로 방을 만들어보세요</p>
            </div>
          )}
          {rooms.map(room => (
            <div key={room.id} className={`${styles.roomCard} ${room.status==='playing'?styles.roomPlaying:''}`}>
              <div className={styles.roomCardTop}>
                <span className={styles.roomCardName}>
                  {room.isPrivate && <span className={styles.lockTag}>🔒</span>}
                  {room.name}
                </span>
                <span className={`${styles.roomBadge} ${room.status==='playing'?styles.badgePlaying:styles.badgeWait}`}>
                  {room.status === 'playing' ? '게임중' : '대기중'}
                </span>
              </div>
              <div className={styles.roomCardMeta}>
                <span>방장 {room.hostName}</span>
                <span>블라인드 {room.smallBlind}/{room.bigBlind}</span>
                <span>칩 {room.startChips.toLocaleString()}</span>
              </div>
              <div className={styles.roomCardBottom}>
                <div className={styles.seatIcons}>
                  {Array.from({length: room.maxPlayers}, (_,i) => (
                    <span key={i} className={`${styles.seatDot} ${i < pCount(room) ? styles.seatFilled : ''}`} />
                  ))}
                  <span className={styles.seatCount}>{pCount(room)}/{room.maxPlayers}</span>
                </div>
                {room.isPrivate && (
                  <input className={styles.pwInput} type="password" placeholder="비밀번호"
                    value={pwInputs[room.id]||''}
                    onChange={e => setPwInputs(p => ({...p,[room.id]:e.target.value}))}
                  />
                )}
                <button
                  className={styles.joinBtn}
                  disabled={room.status==='playing' || pCount(room)>=room.maxPlayers}
                  onClick={() => joinRoom(room)}
                >
                  {room.status==='playing' ? '진행중' : pCount(room)>=room.maxPlayers ? '만석' : '입장'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 게임 규칙 */}
        <div className={styles.rulesBox}>
          <div className={styles.rulesTitle}>♠ Texas Hold'em 규칙</div>
          <div className={styles.rulesList}>
            <div className={styles.ruleItem}><span className={styles.ruleNum}>1</span><span>각 플레이어에게 홀 카드 2장이 지급됩니다.</span></div>
            <div className={styles.ruleItem}><span className={styles.ruleNum}>2</span><span>스몰/빅 블라인드로 강제 베팅 후 게임이 시작됩니다.</span></div>
            <div className={styles.ruleItem}><span className={styles.ruleNum}>3</span><span>플롭(3장) → 턴(1장) → 리버(1장) 순으로 커뮤니티 카드가 공개됩니다.</span></div>
            <div className={styles.ruleItem}><span className={styles.ruleNum}>4</span><span>각 스트리트마다 체크 · 콜 · 레이즈 · 폴드 · 올인 중 선택합니다.</span></div>
            <div className={styles.ruleItem}><span className={styles.ruleNum}>5</span><span>최종적으로 홀 카드 + 커뮤니티 카드 5장 조합이 가장 강한 플레이어가 팟을 가져갑니다.</span></div>
          </div>
          <div className={styles.handsGrid}>
            {[['로얄 플러시','A K Q J 10 같은 무늬'],['스트레이트 플러시','같은 무늬 연속 5장'],['포 오브 어 카인드','같은 숫자 4장'],['풀 하우스','3장+2장'],['플러시','같은 무늬 5장'],['스트레이트','연속 5장'],['트리플','같은 숫자 3장'],['투 페어','페어 2쌍'],['원 페어','같은 숫자 2장'],['하이 카드','없음']].map(([name,desc])=>(
              <div key={name} className={styles.handItem}>
                <span className={styles.handName}>{name}</span>
                <span className={styles.handDesc}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showCreate && (
        <div className={styles.overlay} onClick={() => { setShowCreate(false); setCreating(false) }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>방 만들기</div>
            <label className={styles.label}>방 이름</label>
            <input className={styles.input} value={roomName} onChange={e => setRoomName(e.target.value)}
              onKeyDown={e => e.key==='Enter' && createRoom()}
              placeholder="방 이름을 입력하세요" maxLength={30} autoFocus />
            <div className={styles.formRow}>
              <div className={styles.formCol}>
                <label className={styles.label}>최대 인원</label>
                <div className={styles.chipRow}>
                  {[2,3,4,5,6].map(n=><button key={n} className={`${styles.chip} ${maxPlayers===n?styles.chipOn:''}`} onClick={()=>setMaxPlayers(n)}>{n}명</button>)}
                </div>
              </div>
              <div className={styles.formCol}>
                <label className={styles.label}>스몰 블라인드</label>
                <div className={styles.chipRow}>
                  {[10,25,50,100].map(n=><button key={n} className={`${styles.chip} ${smallBlind===n?styles.chipOn:''}`} onClick={()=>setSmallBlind(n)}>{n}</button>)}
                </div>
              </div>
            </div>
            <label className={styles.label}>시작 칩</label>
            <div className={styles.chipRow}>
              {[500,1000,2000,5000].map(n=><button key={n} className={`${styles.chip} ${startChips===n?styles.chipOn:''}`} onClick={()=>setStartChips(n)}>{n.toLocaleString()}</button>)}
            </div>
            <label className={styles.label} style={{display:'flex',alignItems:'center',gap:8,marginTop:'0.5rem',cursor:'pointer'}}>
              <input type="checkbox" checked={isPrivate} onChange={e=>setIsPrivate(e.target.checked)} />
              비밀방
            </label>
            {isPrivate && <input className={styles.input} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="비밀번호" />}
            <div className={styles.modalBtns}>
              <button className={styles.cancelBtn} onClick={()=>{setShowCreate(false);setCreating(false)}}>취소</button>
              <button className={styles.confirmBtn} onClick={createRoom} disabled={!roomName.trim()||creating}>
                {creating ? '생성 중...' : '방 만들기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
