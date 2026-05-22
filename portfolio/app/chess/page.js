'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, onValue, push, set, update, remove, get } from 'firebase/database'
import { initGameState } from '../../lib/chess'
import styles from './chess.module.css'

function getDb() {
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }
  const app = getApps().length ? getApps()[0] : initializeApp(cfg)
  return getDatabase(app)
}

const TIME_CONTROLS = [
  { id:'unlimited', label:'무제한', sub:'턴제',   seconds:0   },
  { id:'bullet',    label:'1분',    sub:'불릿',   seconds:60  },
  { id:'blitz3',    label:'3분',    sub:'블리츠', seconds:180 },
  { id:'blitz5',    label:'5분',    sub:'블리츠', seconds:300 },
  { id:'rapid10',   label:'10분',   sub:'래피드', seconds:600 },
  { id:'rapid15',   label:'15분',   sub:'래피드', seconds:900 },
]

export default function ChessLobby() {
  const router = useRouter()
  const [myUid, setMyUid]           = useState(null)
  const [myName, setMyName]         = useState('')
  const [myElo, setMyElo]           = useState(1200)
  const [rankings, setRankings]     = useState([])
  const [timeCtrl, setTimeCtrl]     = useState('blitz3')
  const [matching, setMatching]     = useState(false)
  const [matchFound, setMatchFound] = useState(false)
  const [matchInfo, setMatchInfo]   = useState(null)
  const [tab, setTab]               = useState('play')

  const safeUidRef  = useRef(null)
  const unsubRef    = useRef(null)
  const timeoutRef  = useRef(null)
  const matchingRef = useRef(false)
  // 항복 abuse 차단 상태 — 5회 이상 항복한 사용자는 자정까지 매칭 불가
  const [resignBlock, setResignBlock] = useState(null)  // { blocked, count, limit, date }

  useEffect(() => {
    const raw = localStorage.getItem('user')
    let uid, name
    if (raw) { const u=JSON.parse(raw); uid=u.id; name=u.name }
    else {
      uid  = localStorage.getItem('chess_anon_uid') || ('anon_'+Math.random().toString(36).slice(2))
      name = localStorage.getItem('chess_anon_nick') || ('Guest'+Math.floor(Math.random()*9000+1000))
      localStorage.setItem('chess_anon_uid', uid)
      localStorage.setItem('chess_anon_nick', name)
    }
    setMyUid(uid); setMyName(name)
    safeUidRef.current = uid.replace(/[.#$[\]]/g,'_')

    // 기존 잔류 매치/큐 정리
    const db = getDb()
    const safe = uid.replace(/[.#$[\]]/g,'_')
    remove(ref(db, `chess_queue/${safe}`))
    // 오래된 매치 정리 (1시간 이상)
    get(ref(db,'chess_matches')).then(snap => {
      if (!snap.exists()) return
      const now = Date.now()
      Object.entries(snap.val()).forEach(([id, m]) => {
        if (now - (m.createdAt||0) > 3600000) remove(ref(db,`chess_matches/${id}`))
      })
    })

    get(ref(db,`chess_ratings/${safe}`)).then(snap => {
      if (snap.exists()) setMyElo(snap.val().elo||1200)
    })

    // 항복 abuse 상태 조회 — 로그인 사용자만 (anon 은 추적 안 함)
    if (raw) {
      fetch(`/api/chess/resign?userId=${encodeURIComponent(uid)}`).then(r=>r.json()).then(d => {
        if (d && typeof d.count === 'number') setResignBlock(d)
      }).catch(()=>{})
    }
  }, [])

  useEffect(() => {
    // chess_ratings 는 실시간 구독 대신 한 번만 get — Firebase 트래픽 절감
    const db = getDb()
    get(ref(db,'chess_ratings')).then(snap => {
      if (!snap.exists()) { setRankings([]); return }
      setRankings(Object.values(snap.val()).sort((a,b)=>(b.elo||1200)-(a.elo||1200)).slice(0,50))
    }).catch(() => setRankings([]))
  }, [])

  // 내 매치 감시
  useEffect(() => {
    if (!matching || !myUid) return
    const db = getDb()
    const unsub = onValue(ref(db,'chess_matches'), snap => {
      if (!snap.exists() || !matchingRef.current) return
      const entries = Object.entries(snap.val())
      const myMatch = entries.find(([,m]) =>
        (m.white?.uid===myUid || m.black?.uid===myUid) &&
        m.status==='playing' &&
        Date.now() - (m.createdAt||0) < 10000 // 10초 이내 생성된 것만
      )
      if (myMatch) {
        const [matchId, matchData] = myMatch
        const opp = matchData.white?.uid===myUid ? matchData.black : matchData.white
        matchingRef.current = false
        setMatchInfo({ oppName:opp.name, oppElo:opp.elo, roomId:matchId })
        setMatchFound(true)
        setMatching(false)
        clearTimeout(timeoutRef.current)
        remove(ref(db,`chess_queue/${safeUidRef.current}`))
        setTimeout(() => router.push(`/chess/room/${matchId}`), 2000)
      }
    })
    unsubRef.current = unsub
    return () => { unsub(); }
  }, [matching, myUid])

  async function startMatching() {
    if (!myUid || matching) return
    if (resignBlock?.blocked) {
      alert(`오늘(${resignBlock.date}) 항복 ${resignBlock.count}회로 부정행위 의심으로 차단되었습니다. 자정 이후 다시 이용해주세요.`)
      return
    }
    matchingRef.current = true
    setMatching(true)
    const db = getDb()
    const safeUid = safeUidRef.current
    const tc = TIME_CONTROLS.find(t=>t.id===timeCtrl)

    // 이미 존재하는 내 큐 항목 제거
    await remove(ref(db,`chess_queue/${safeUid}`))

    // 대기자 탐색
    const qSnap = await get(ref(db,'chess_queue'))
    if (qSnap.exists()) {
      const queue = qSnap.val()
      const candidates = Object.entries(queue).filter(([uid,q]) =>
        uid !== safeUid &&
        q.timeCtrl === timeCtrl &&
        q.status === 'waiting' &&
        Date.now() - (q.ts||0) < 25000 // 25초 이내 큐만 유효
      )
      if (candidates.length > 0) {
        const [oppSafeUid, oppData] = candidates[Math.floor(Math.random()*candidates.length)]
        // 선점
        await update(ref(db,`chess_queue/${oppSafeUid}`), { status:'matched' })
        const matchRef = push(ref(db,'chess_matches'))
        const gs = initGameState()
        await set(matchRef, {
          white: { uid:oppData.uid, name:oppData.name, elo:oppData.elo||1200 },
          black: { uid:myUid, name:myName, elo:myElo },
          timeCtrl,
          timeSeconds: tc.seconds,
          whiteTime: tc.seconds,
          blackTime: tc.seconds,
          gameState: gs,
          status: 'playing',
          createdAt: Date.now(),
        })
        await remove(ref(db,`chess_queue/${oppSafeUid}`))
        return // onValue 감지
      }
    }

    // 큐 등록
    await set(ref(db,`chess_queue/${safeUid}`), {
      uid:myUid, name:myName, elo:myElo,
      timeCtrl, status:'waiting', ts:Date.now(),
    })

    timeoutRef.current = setTimeout(async () => {
      if (!matchingRef.current) return
      matchingRef.current = false
      unsubRef.current?.()
      await remove(ref(db,`chess_queue/${safeUid}`))
      setMatching(false)
    }, 30000)
  }

  async function cancelMatching() {
    matchingRef.current = false
    unsubRef.current?.()
    clearTimeout(timeoutRef.current)
    await remove(ref(getDb(),`chess_queue/${safeUidRef.current}`))
    setMatching(false)
  }

  function playVsAI() {
    if (resignBlock?.blocked) {
      alert(`오늘(${resignBlock.date}) 항복 ${resignBlock.count}회로 부정행위 의심으로 차단되었습니다. 자정 이후 다시 이용해주세요.`)
      return
    }
    router.push(`/chess/room/ai-${safeUidRef.current}-${Date.now()}`)
  }

  return (
    <div className={styles.wrap}>
      {matchFound && matchInfo && (
        <div className={styles.matchFoundOverlay}>
          <div className={styles.matchFoundCard}>
            <div className={styles.matchFoundVs}>
              <div className={styles.matchFoundPlayer}>
                <div className={styles.matchFoundAvatar}>{myName[0]?.toUpperCase()}</div>
                <div className={styles.matchFoundName}>{myName}</div>
                <div className={styles.matchFoundElo}>{myElo}</div>
              </div>
              <div className={styles.matchFoundMiddle}>
                <div className={styles.vsText}>VS</div>
                <div className={styles.matchFoundTC}>{TIME_CONTROLS.find(t=>t.id===timeCtrl)?.label}</div>
              </div>
              <div className={styles.matchFoundPlayer}>
                <div className={styles.matchFoundAvatar} style={{background:'#b58863'}}>{matchInfo.oppName[0]?.toUpperCase()}</div>
                <div className={styles.matchFoundName}>{matchInfo.oppName}</div>
                <div className={styles.matchFoundElo}>{matchInfo.oppElo}</div>
              </div>
            </div>
            <div className={styles.matchFoundText}>매칭 성공! 게임 시작...</div>
            <div className={styles.matchFoundBar}><div className={styles.matchFoundBarFill}/></div>
          </div>
        </div>
      )}

      <div className={styles.sidebar}>
        <div className={styles.profile}>
          <div className={styles.profileBoard}>
            {Array.from({length:16},(_,i)=>(
              <div key={i} className={`${styles.sq} ${(Math.floor(i/4)+i)%2===0?styles.sqLight:styles.sqDark}`}/>
            ))}
          </div>
          <div className={styles.profileInfo}>
            <div className={styles.profileName}>{myName}</div>
            <div className={styles.profileElo}>{myElo} ELO</div>
          </div>
        </div>

        <div className={styles.tabRow}>
          <button className={`${styles.tabBtn} ${tab==='play'?styles.tabActive:''}`} onClick={()=>setTab('play')}>플레이</button>
          <button className={`${styles.tabBtn} ${tab==='rankings'?styles.tabActive:''}`} onClick={()=>setTab('rankings')}>랭킹</button>
          <button className={`${styles.tabBtn} ${tab==='rules'?styles.tabActive:''}`} onClick={()=>setTab('rules')}>규칙</button>
        </div>

        {tab==='play' && (
          <div className={styles.playPanel}>
            {resignBlock?.blocked && (
              <div style={{background:'rgba(231,76,60,.12)',border:'1px solid #e74c3c',borderRadius:8,padding:'.75rem 1rem',marginBottom:'1rem',color:'#ffb3a8',fontSize:'.82rem',lineHeight:1.55}}>
                <strong style={{color:'#ff7b6e',display:'block',marginBottom:'.25rem'}}>⚠ 부정행위 의심으로 차단됨</strong>
                오늘({resignBlock.date}) 항복 {resignBlock.count}회 — 한도({resignBlock.limit}) 초과.
                <br/>자정 이후 다시 이용해주세요.
              </div>
            )}
            {!resignBlock?.blocked && resignBlock?.count >= 3 && (
              <div style={{background:'rgba(241,196,15,.1)',border:'1px solid #f1c40f',borderRadius:8,padding:'.6rem .9rem',marginBottom:'1rem',color:'#f5d76e',fontSize:'.78rem',lineHeight:1.55}}>
                경고: 오늘 항복 {resignBlock.count}회 — {(resignBlock.limit ?? 5) - resignBlock.count}회 더 항복하면 부정행위 의심으로 오늘 체스 이용이 제한됩니다.
              </div>
            )}
            <div className={styles.sectionLabel}>시간 제어</div>
            <div className={styles.timeGrid}>
              {TIME_CONTROLS.map(t=>(
                <button key={t.id} className={`${styles.timeBtn} ${timeCtrl===t.id?styles.timeBtnActive:''}`}
                  onClick={()=>!matching&&setTimeCtrl(t.id)} disabled={matching}>
                  <span className={styles.timeBtnLabel}>{t.label}</span>
                  <span className={styles.timeBtnSub}>{t.sub}</span>
                </button>
              ))}
            </div>
            {matching ? (
              <div className={styles.matchingBox}>
                <div className={styles.matchingDots}><span/><span/><span/></div>
                <div className={styles.matchingText}>상대를 찾는 중...</div>
                <div className={styles.matchingTC}>{TIME_CONTROLS.find(t=>t.id===timeCtrl)?.label} · {TIME_CONTROLS.find(t=>t.id===timeCtrl)?.sub}</div>
                <button className={styles.cancelBtn} onClick={cancelMatching}>취소</button>
              </div>
            ) : (
              <button className={styles.matchBtn} onClick={startMatching} disabled={resignBlock?.blocked}>
                {resignBlock?.blocked ? '오늘 이용 불가' : '랜덤 매치'}
              </button>
            )}
            <button className={styles.aiBtn} onClick={playVsAI} disabled={matching || resignBlock?.blocked}>AI 와 대국</button>
          </div>
        )}

        {tab==='rankings' && (
          <div className={styles.rankPanel}>
            <div className={styles.sectionLabel}>TOP 50 랭킹</div>
            <div className={styles.rankList}>
              {rankings.length===0 && <div className={styles.rankEmpty}>아직 기록이 없습니다</div>}
              {rankings.map((r,i)=>(
                <div key={r.uid||i} className={`${styles.rankRow} ${r.uid===myUid?styles.rankMe:''}`}>
                  <span className={styles.rankNum}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`}</span>
                  <span className={styles.rankName}>{r.name}</span>
                  <span className={styles.rankElo}>{r.elo}</span>
                  <span className={styles.rankWL}>{r.wins||0}W {r.losses||0}L</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==='rules' && (
          <div className={styles.rulesPanel}>
            <div className={styles.sectionLabel}>기물 이동 규칙</div>
            {[
              ['♔♚','킹','한 칸씩 모든 방향 이동. 체크 위협받으면 무조건 피해야 함.'],
              ['♕♛','퀸','가로·세로·대각선 무제한 이동. 가장 강력한 기물.'],
              ['♖♜','룩','가로·세로 무제한 이동.'],
              ['♗♝','비숍','대각선 무제한 이동. 항상 같은 색 칸만 이동.'],
              ['♘♞','나이트','L자 이동. 유일하게 기물을 넘을 수 있음.'],
              ['♙♟','폰','앞으로 1칸(첫 수 2칸). 대각선으로만 포획. 마지막 줄 도달 시 승급.'],
            ].map(([icon,name,desc])=>(
              <div key={name} className={styles.ruleRow}>
                <span className={styles.ruleIcon}>{icon}</span>
                <div>
                  <div className={styles.ruleName}>{name}</div>
                  <div className={styles.ruleDesc}>{desc}</div>
                </div>
              </div>
            ))}
            <div className={styles.sectionLabel} style={{marginTop:'1rem'}}>특수 규칙</div>
            {[
              ['캐슬링','킹과 룩이 처음 이동 전, 킹을 2칸 이동하고 룩이 반대편으로 이동.'],
              ['앙파상','폰이 2칸 전진 시 옆 폰이 대각선으로 잡을 수 있음.'],
              ['승급','폰이 마지막 줄 도달 시 퀸·룩·비숍·나이트로 교체.'],
              ['체크','킹이 공격받는 상태. 반드시 피해야 함.'],
              ['체크메이트','체크를 피할 수 없는 상태. 게임 종료.'],
              ['스테일메이트','이동 가능한 수가 없지만 체크가 아닌 상태. 무승부.'],
            ].map(([name,desc])=>(
              <div key={name} className={styles.ruleRow}>
                <div>
                  <div className={styles.ruleName}>{name}</div>
                  <div className={styles.ruleDesc}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.mainArea}>
        <div className={styles.demoBoard}>
          {Array.from({length:64},(_,i)=>{
            const r=Math.floor(i/8),c=i%8
            const DEMO=[
              ['♜','♞','♝','♛','♚','♝','♞','♜'],
              ['♟','♟','♟','♟','♟','♟','♟','♟'],
              [null,null,null,null,null,null,null,null],
              [null,null,null,null,null,null,null,null],
              [null,null,null,null,'♙',null,null,null],
              [null,null,null,null,null,null,null,null],
              ['♙','♙','♙','♙',null,'♙','♙','♙'],
              ['♖','♘','♗','♕','♔','♗','♘','♖'],
            ]
            return (
              <div key={i} className={`${styles.demoSq} ${(r+c)%2===0?styles.demoLight:styles.demoDark}`}>
                {DEMO[r][c]&&<span className={styles.demoPiece}>{DEMO[r][c]}</span>}
              </div>
            )
          })}
        </div>
        <div className={styles.mainTitle}>Chess</div>
        <div className={styles.mainSub}>실시간 온라인 체스 · CozyBoard</div>
      </div>
    </div>
  )
}
