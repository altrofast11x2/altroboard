'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, onValue, update, get, remove } from 'firebase/database'
import { initGameState, getLegalMoves, applyMove, getBestMove, calcElo, isInCheck, normalizeGs } from '../../../../lib/chess'
import styles from './chessroom.module.css'

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

const UNICODE = {
  wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙',
  bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟',
}
const FILES = ['a','b','c','d','e','f','g','h']
const PROMO = ['Q','R','B','N']

export default function ChessRoom() {
  const { id: roomId } = useParams()
  const router = useRouter()
  const isAI = roomId?.startsWith('ai-')

  const [myUid, setMyUid]       = useState(null)
  const [myName, setMyName]     = useState('')
  const [myColor, setMyColor]   = useState('w')
  const [match, setMatch]       = useState(null)
  const [gs, setGs]             = useState(null)
  const [selected, setSelected] = useState(null)
  const [legalMvs, setLegalMvs] = useState([])
  const [promoting, setPromoting] = useState(null)
  const [flipped, setFlipped]   = useState(false)
  const [wTime, setWTime]       = useState(0)
  const [bTime, setBTime]       = useState(0)
  const [aiThinking, setAiThinking] = useState(false)
  const [result, setResult]     = useState(null)
  const [moveHistory, setMoveHistory] = useState([])

  const timerRef  = useRef(null)
  const gsRef     = useRef(null)
  const wTimeRef  = useRef(0)
  const bTimeRef  = useRef(0)

  gsRef.current = gs

  // ── 유저 로드
  useEffect(() => {
    const raw = localStorage.getItem('user')
    let uid, name
    if (raw) { const u=JSON.parse(raw); uid=u.id; name=u.name }
    else {
      uid  = localStorage.getItem('chess_anon_uid') || 'anon'
      name = localStorage.getItem('chess_anon_nick') || 'Guest'
    }
    setMyUid(uid); setMyName(name)
    if (isAI) {
      const g = initGameState()
      setGs(g); setMyColor('w')
      setMatch({ white:{uid,name,elo:1200}, black:{uid:'AI',name:'AI ♟',elo:1200}, timeCtrl:'unlimited', timeSeconds:0 })
    }
  }, [isAI])

  // ── Firebase 구독 (멀티)
  const resultShownRef = useRef(false)

  useEffect(() => {
    if (isAI || !roomId) return
    const db = getDb()
    return onValue(ref(db,`chess_matches/${roomId}`), snap => {
      if (!snap.exists()) { router.push('/chess'); return }
      const d = snap.val()
      setMatch(d)
      const normalized = normalizeGs(d.gameState)
      setGs(normalized)
      setWTime(d.whiteTime || 0)
      setBTime(d.blackTime || 0)
      wTimeRef.current = d.whiteTime || 0
      bTimeRef.current = d.blackTime || 0

      // 상대 항복 감지
      if (!resultShownRef.current && d.gameState?.status === 'resigned') {
        resultShownRef.current = true
        const resignedColor = d.gameState?.resignedColor
        const winner = resignedColor === 'w' ? 'b' : 'w'
        const loserName = resignedColor === 'w' ? d.white?.name : d.black?.name
        const winnerName = winner === 'w' ? d.white?.name : d.black?.name
        setResult({ text: `${loserName} 항복`, winner, reason: 'resign', winnerName })
      }
      // 체크메이트/스테일메이트 감지
      if (!resultShownRef.current && ['checkmate','stalemate','draw','timeout'].includes(d.gameState?.status)) {
        resultShownRef.current = true
        endGameFromData(d.gameState, d)
      }
    })
  }, [roomId, isAI])

  // ── 내 색 결정
  useEffect(() => {
    if (!match || !myUid || isAI) return
    const iAmWhite = match.white?.uid === myUid
    setMyColor(iAmWhite ? 'w' : 'b')
    setFlipped(!iAmWhite)
  }, [match?.white?.uid, myUid, isAI])

  // ── 타이머
  useEffect(() => {
    if (!gs || !match) return
    if (match.timeSeconds === 0) return
    const playing = gs.status === 'playing' || gs.status === 'check'
    if (!playing) { clearInterval(timerRef.current); return }
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      if (gs.turn === 'w') {
        wTimeRef.current = Math.max(0, wTimeRef.current - 1)
        setWTime(wTimeRef.current)
        if (wTimeRef.current <= 0) { clearInterval(timerRef.current); endByTimeout('w') }
      } else {
        bTimeRef.current = Math.max(0, bTimeRef.current - 1)
        setBTime(bTimeRef.current)
        if (bTimeRef.current <= 0) { clearInterval(timerRef.current); endByTimeout('b') }
      }
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [gs?.turn, gs?.status, match?.timeSeconds])

  async function endByTimeout(loser) {
    const winner = loser==='w'?'b':'w'
    const winName = winner==='w' ? match?.white?.name : match?.black?.name
    setResult({ text:`시간 초과! ${winName} 승리`, winner, reason:'timeout' })
    if (!isAI) {
      await update(ref(getDb(),`chess_matches/${roomId}`), { 'gameState/status':'timeout' })
      await saveRatings(winner)
    }
  }

  // ── AI
  useEffect(() => {
    if (!isAI || !gs) return
    if (gs.status!=='playing' && gs.status!=='check') return
    if (gs.turn==='w') return
    setAiThinking(true)
    const t = setTimeout(() => {
      const move = getBestMove(gs, 3)
      if (move) {
        const [fr,fc,tr,tc] = move
        const next = applyMove(gs, fr, fc, tr, tc, 'Q')
        setGs(next)
        addHistory(gs, fr, fc, tr, tc)
        if (next.status==='checkmate'||next.status==='stalemate'||next.status==='draw') endGame(next)
      }
      setAiThinking(false)
    }, 400)
    return () => clearTimeout(t)
  }, [gs?.turn, isAI])

  function addHistory(prevGs, fr, fc, tr, tc) {
    const p = prevGs.board[fr][fc]
    if (!p) return
    const cap = prevGs.board[tr][tc]
    const fileLetter = FILES[fc]
    const toFile = FILES[tc]
    const toRank = 8 - tr
    setMoveHistory(h => [...h, `${p.type==='P'?'':p.type}${fileLetter}${8-fr}→${toFile}${toRank}${cap?'×':''}`].slice(-20))
  }

  function endGameFromData(gsData, matchData) {
    let text='', winner=null, reason=''
    if (gsData.status==='checkmate') {
      winner = gsData.winner
      const winName = winner==='w' ? matchData?.white?.name : matchData?.black?.name
      text = `체크메이트`; reason = 'checkmate'
      setResult({ text, winner, reason, winnerName: winName })
    } else if (gsData.status==='stalemate') {
      text='스테일메이트'; reason='stalemate'
      setResult({ text, winner:null, reason })
    } else if (gsData.status==='draw') {
      text='50수 규칙 무승부'; reason='draw'
      setResult({ text, winner:null, reason })
    } else if (gsData.status==='timeout') {
      // handled by timer
    }
    if (!isAI && winner!==null) saveRatings(winner)
  }

  function endGame(newGs) {
    if (resultShownRef.current) return
    resultShownRef.current = true
    let text='', winner=null, reason=''
    if (newGs.status==='checkmate') {
      winner = newGs.winner
      const winName = winner==='w' ? match?.white?.name : match?.black?.name
      text = '체크메이트'; reason = 'checkmate'
      setResult({ text, winner, reason, winnerName: winName })
    } else if (newGs.status==='stalemate') {
      text='스테일메이트'; reason='stalemate'
      setResult({ text, winner:null, reason })
    } else if (newGs.status==='draw') {
      text='무승부'; reason='draw'
      setResult({ text, winner:null, reason })
    }
    if (!isAI && winner!==null) saveRatings(winner)
  }

  async function saveRatings(winner) {
    if (!match) return
    const db = getDb()
    const wUid = match.white?.uid?.replace(/[.#$[\]]/g,'_')
    const bUid = match.black?.uid?.replace(/[.#$[\]]/g,'_')
    const wElo = match.white?.elo||1200, bElo = match.black?.elo||1200
    const wRes = winner==='w'?1:winner===null?0.5:0
    const nwElo = calcElo(wElo,bElo,wRes), nbElo = calcElo(bElo,wElo,1-wRes)
    const u = {}
    u[`chess_ratings/${wUid}`] = { uid:match.white.uid, name:match.white.name, elo:nwElo, wins:(match.white.wins||0)+(winner==='w'?1:0), losses:(match.white.losses||0)+(winner==='b'?1:0) }
    u[`chess_ratings/${bUid}`] = { uid:match.black.uid, name:match.black.name, elo:nbElo, wins:(match.black.wins||0)+(winner==='b'?1:0), losses:(match.black.losses||0)+(winner==='w'?1:0) }
    await update(ref(db), u)
  }

  // ── 클릭
  function handleClick(row, col) {
    if (!gs) return
    const over = gs.status==='checkmate'||gs.status==='stalemate'||gs.status==='draw'||gs.status==='timeout'
    if (over || aiThinking || promoting) return
    if (!isAI && gs.turn!==myColor) return
    if (isAI && gs.turn!=='w') return

    const piece = gs.board[row][col]
    if (selected) {
      const [sr,sc] = selected
      const legal = legalMvs.some(([r,c])=>r===row&&c===col)
      if (legal) {
        const sp = gs.board[sr][sc]
        if (sp?.type==='P' && (row===0||row===7)) { setPromoting({fr:sr,fc:sc,tr:row,tc:col}); return }
        commitMove(sr,sc,row,col,null)
        setSelected(null); setLegalMvs([])
        return
      }
      if (piece?.color===gs.turn) { setSelected([row,col]); setLegalMvs(getLegalMoves(gs,row,col)); return }
      setSelected(null); setLegalMvs([])
      return
    }
    if (piece?.color===gs.turn) { setSelected([row,col]); setLegalMvs(getLegalMoves(gs,row,col)) }
  }

  function doPromotion(type) {
    if (!promoting) return
    commitMove(promoting.fr,promoting.fc,promoting.tr,promoting.tc,type)
    setPromoting(null); setSelected(null); setLegalMvs([])
  }

  async function commitMove(fr,fc,tr,tc,promote) {
    const next = applyMove(gs,fr,fc,tr,tc,promote)
    addHistory(gs,fr,fc,tr,tc)
    if (isAI) {
      setGs(next)
      if (next.status==='checkmate'||next.status==='stalemate'||next.status==='draw') endGame(next)
    } else {
      const db = getDb()
      const updates = { gameState: next }
      if (match.timeSeconds > 0) {
        if (gs.turn==='w') updates.whiteTime = wTimeRef.current
        else updates.blackTime = bTimeRef.current
      }
      await update(ref(db,`chess_matches/${roomId}`), updates)
      if (next.status==='checkmate'||next.status==='stalemate'||next.status==='draw') endGame(next)
    }
  }

  function fmtTime(s) {
    if (!s || s<=0) return '0:00'
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`
  }

  if (!gs || !match) return <div className={styles.loading}>로딩 중...</div>

  const board = flipped ? gs.board.slice().reverse().map(r=>r.slice().reverse()) : gs.board
  const isMyTurn = gs.turn===myColor
  const inCheck  = isInCheck(gs.board,gs.turn)
  const gameOver = ['checkmate','stalemate','draw','timeout'].includes(gs.status)

  const oppData = myColor==='w' ? match.black : match.white
  const meData  = myColor==='w' ? match.white : match.black
  const myT  = myColor==='w' ? wTime : bTime
  const oppT = myColor==='w' ? bTime : wTime
  const hasTimer = match.timeSeconds > 0

  return (
    <div className={styles.wrap}>
      {/* 결과 오버레이 */}
      {result && (
        <div className={styles.resultOverlay}>
          {/* 컨페티 — 승리 시만 */}
          {result.winner === myColor && (
            <div className={styles.confettiWrap}>
              {Array.from({length:30},(_,i)=>(
                <div key={i} className={styles.confettiPiece} style={{
                  left:`${Math.random()*100}%`,
                  animationDelay:`${Math.random()*1.5}s`,
                  animationDuration:`${1.5+Math.random()}s`,
                  background:['#f0d9b5','#769656','#c9a84c','#5b8dee','#e8c96e'][i%5],
                  width: `${6+Math.random()*6}px`,
                  height: `${6+Math.random()*6}px`,
                }}/>
              ))}
            </div>
          )}

          <div className={`${styles.resultCard} ${
            result.winner===myColor ? styles.resultWin :
            result.winner===null   ? styles.resultDraw : styles.resultLose
          }`}>
            {/* 트로피/아이콘 애니 */}
            <div className={styles.resultIconWrap}>
              {result.winner===myColor ? (
                <div className={styles.trophyAnim}>♛</div>
              ) : result.winner===null ? (
                <div className={styles.drawAnim}>⚖</div>
              ) : (
                <div className={styles.loseAnim}>♟</div>
              )}
            </div>

            {/* 결과 타이틀 */}
            <div className={styles.resultTitle}>
              {result.winner===myColor ? '승리!' : result.winner===null ? '무승부' : '패배'}
            </div>

            {/* 원인 */}
            <div className={styles.resultReason}>
              {result.reason==='checkmate' && '체크메이트'}
              {result.reason==='resign'    && `${result.winner===myColor ? '상대가' : '내가'} 항복했습니다`}
              {result.reason==='stalemate' && '스테일메이트'}
              {result.reason==='draw'      && '50수 규칙'}
              {result.reason==='timeout'   && '시간 초과'}
            </div>

            {/* 승자 이름 */}
            {result.winner !== null && result.winnerName && (
              <div className={styles.resultWinnerName}>
                {result.winnerName}
              </div>
            )}

            {/* ELO 변화 표시 (대략적) */}
            {!isAI && result.winner !== null && (
              <div className={styles.resultElo}>
                {result.winner===myColor ? '+' : '-'}{Math.abs(Math.round(32 * (result.winner===myColor ? 0.7 : 0.3)))} ELO
              </div>
            )}

            <div className={styles.resultBtns}>
              <button className={styles.rBtn} onClick={()=>router.push('/chess')}>로비로</button>
              {isAI && (
                <button className={styles.rBtnAlt} onClick={()=>{
                  resultShownRef.current=false
                  setGs(initGameState())
                  setResult(null)
                  setMoveHistory([])
                }}>다시 하기</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 프로모션 */}
      {promoting && (
        <div className={styles.promoOverlay}>
          <div className={styles.promoCard}>
            <div className={styles.promoTitle}>승급할 기물 선택</div>
            <div className={styles.promoPieces}>
              {PROMO.map(t=>(
                <button key={t} className={styles.promoPiece} onClick={()=>doPromotion(t)}>
                  {UNICODE[`${myColor}${t}`]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className={styles.gameLayout}>
        {/* 상대 정보 + 타이머 */}
        <div className={`${styles.playerBar} ${!isMyTurn&&!gameOver?styles.playerBarActive:styles.playerBarIdle}`}>
          <div className={styles.playerInfo}>
            <div className={`${styles.playerAvatar} ${!isMyTurn?styles.avatarActive:''}`}>
              {oppData?.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className={styles.playerName}>
                {oppData?.name}
                {aiThinking && <span className={styles.thinkingTag}> 생각 중...</span>}
                {!isMyTurn && !gameOver && <span className={styles.turnDot}/>}
              </div>
              <div className={styles.playerElo}>{oppData?.elo} ELO</div>
            </div>
          </div>
          <CapturedPieces pieces={myColor==='w'?gs.capturedW:gs.capturedB} color={myColor==='w'?'b':'w'}/>
          {hasTimer && (
            <div className={`${styles.timerBox} ${!isMyTurn&&!gameOver?styles.timerActive:styles.timerIdle}`}>
              {fmtTime(oppT)}
            </div>
          )}
        </div>

        <div className={styles.boardRow}>
          {/* 체스판 */}
          <div className={styles.boardWrap}>
            <div className={styles.fileRow}>
              <div style={{width:18}}/>
              {(flipped?[...FILES].reverse():FILES).map(f=><span key={f} className={styles.fileLabel}>{f}</span>)}
            </div>
            <div className={styles.boardAndRank}>
              <div className={styles.rankCol}>
                {(flipped?[1,2,3,4,5,6,7,8]:[8,7,6,5,4,3,2,1]).map(n=>(
                  <span key={n} className={styles.rankLabel}>{n}</span>
                ))}
              </div>
              <div className={styles.board}>
                {board.map((rowArr,ri)=>rowArr.map((piece,ci)=>{
                  const realR=flipped?7-ri:ri, realC=flipped?7-ci:ci
                  const isLight=(ri+ci)%2===0
                  const isSel=selected?.[0]===realR&&selected?.[1]===realC
                  const isLegal=legalMvs.some(([r,c])=>r===realR&&c===realC)
                  const isLastF=gs.lastMove?.fromR===realR&&gs.lastMove?.fromC===realC
                  const isLastT=gs.lastMove?.toR===realR&&gs.lastMove?.toC===realC
                  const isKingCheck=inCheck&&piece?.type==='K'&&piece?.color===gs.turn
                  const canInteract=piece?.color===gs.turn&&(isAI?gs.turn==='w':gs.turn===myColor)
                  return (
                    <div key={`${ri}-${ci}`}
                      className={`${styles.sq}
                        ${isLight?styles.sqLight:styles.sqDark}
                        ${isSel?styles.sqSel:''}
                        ${(isLastF||isLastT)&&!isSel?styles.sqLast:''}
                        ${isKingCheck?styles.sqCheck:''}
                        ${canInteract?styles.sqHover:''}
                      `}
                      onClick={()=>handleClick(realR,realC)}
                    >
                      {isLegal&&(
                        piece
                          ? <div className={styles.capRing}/>
                          : <div className={styles.moveDot}/>
                      )}
                      {piece&&(
                        <span className={`${styles.piece} ${piece.color==='w'?styles.wPiece:styles.bPiece}`}>
                          {UNICODE[`${piece.color}${piece.type}`]}
                        </span>
                      )}
                    </div>
                  )
                }))}
              </div>
            </div>
          </div>

          {/* 우측 패널 */}
          <div className={styles.sidePanel}>
            {/* 상태 표시 */}
            <div className={`${styles.statusBar} ${isMyTurn&&!gameOver?styles.statusMyTurn:styles.statusOppTurn}`}>
              {gameOver
                ? <span>{gs.status==='checkmate'?'체크메이트':gs.status==='stalemate'?'스테일메이트':'게임 종료'}</span>
                : inCheck
                  ? <span className={styles.checkAlert}>⚠ 체크!</span>
                  : isMyTurn
                    ? <span>▶ 내 차례</span>
                    : <span>상대 차례...</span>
              }
            </div>

            {/* 이동 기록 */}
            <div className={styles.historyBox}>
              <div className={styles.historyTitle}>이동 기록</div>
              <div className={styles.historyList}>
                {moveHistory.length===0 && <span className={styles.historyEmpty}>아직 이동 없음</span>}
                {moveHistory.map((m,i)=>(
                  <div key={i} className={`${styles.historyItem} ${i%2===0?styles.historyW:styles.historyB}`}>
                    <span className={styles.historyNum}>{Math.floor(i/2)+1}{i%2===0?'.':''}</span>
                    <span>{m}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 컨트롤 */}
            <div className={styles.controls}>
              <button className={styles.ctrlBtn} onClick={()=>setFlipped(f=>!f)} title="반전">⇅ 반전</button>
              {!gameOver && (
                <button className={styles.resignBtn} onClick={async()=>{
                  if (!confirm('정말 항복하시겠습니까?')) return
                  const winner = myColor==='w'?'b':'w'
                  const winName = winner==='w'?match?.white?.name:match?.black?.name
                  resultShownRef.current = true
                  setResult({ text:`항복`, winner, reason:'resign', winnerName: winName })
                  if (!isAI) {
                    await update(ref(getDb(),`chess_matches/${roomId}`), {
                      'gameState/status':'resigned',
                      'gameState/resignedColor': myColor,
                    })
                    await saveRatings(winner)
                  }
                }}>⚑ 항복</button>
              )}
              <button className={styles.ctrlBtn} onClick={()=>router.push('/chess')}>✕ 나가기</button>
            </div>
          </div>
        </div>

        {/* 내 정보 + 타이머 */}
        <div className={`${styles.playerBar} ${isMyTurn&&!gameOver?styles.playerBarActive:styles.playerBarIdle}`}>
          <div className={styles.playerInfo}>
            <div className={`${styles.playerAvatar} ${styles.avatarMe} ${isMyTurn?styles.avatarActive:''}`}>
              {meData?.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className={styles.playerName}>
                {meData?.name} (나)
                {isMyTurn && !gameOver && <span className={styles.myTurnTag}> 내 차례</span>}
              </div>
              <div className={styles.playerElo}>{meData?.elo} ELO</div>
            </div>
          </div>
          <CapturedPieces pieces={myColor==='b'?gs.capturedW:gs.capturedB} color={myColor==='b'?'b':'w'}/>
          {hasTimer && (
            <div className={`${styles.timerBox} ${isMyTurn&&!gameOver?styles.timerActive:styles.timerIdle}`}>
              {fmtTime(myT)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CapturedPieces({ pieces, color }) {
  if (!pieces?.length) return <div className={styles.captured}/>
  const counts = {}
  pieces.forEach(p => { counts[p.type]=(counts[p.type]||0)+1 })
  return (
    <div className={styles.captured}>
      {Object.entries(counts).map(([t,n])=>(
        <span key={t} className={styles.capPiece}>
          {({wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙',bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟'})[`${color}${t}`]}
          {n>1&&<sup style={{fontSize:'0.6rem'}}>{n}</sup>}
        </span>
      ))}
    </div>
  )
}
