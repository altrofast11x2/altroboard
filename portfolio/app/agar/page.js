'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, onValue, set, remove, onDisconnect, update, runTransaction, get } from 'firebase/database'

/**
 * agar.io — Firebase Realtime DB 기반 멀티플레이
 *
 * 데이터:
 *   agar/players/{playerId}: { name, color, x, y, mass, lastUpdate, alive }
 *   agar/foods/{foodId}:     { x, y, color }
 *   agar/host:               { playerId, since }  // 음식 채우기/AI 담당 (가장 오래 접속한 사람)
 *
 * 동작:
 *   - 본인 위치는 로컬에서 60fps 시뮬레이션
 *   - 200ms마다 본인 위치를 Firebase 에 write (throttle)
 *   - 다른 플레이어는 onValue 로 받아서 60fps 보간 렌더
 *   - 음식 흡수: transaction 으로 food 삭제 + mass 증가
 *   - 호스트: 음식 부족하면 채워줌
 *   - 이탈 시 onDisconnect 로 자동 정리
 */

const WORLD = 6000
const FOOD_TARGET = 600
const PLAYER_START_MASS = 20
const FOOD_MASS = 1
const MAX_SPEED = 1.0 // 원본 agar.io 비슷하게 (질량 클수록 자연스레 느려짐)
const SYNC_INTERVAL_MS = 200

const COLORS = ['#e74c3c','#e67e22','#f1c40f','#27ae60','#16a085','#2980b9','#8e44ad','#34495e','#d35400','#1abc9c','#9b59b6']
const randColor = () => COLORS[Math.floor(Math.random()*COLORS.length)]
const radiusFromMass = (m) => Math.sqrt(Math.max(1, m)) * 4
const dist2 = (a,b) => { const dx=a.x-b.x, dy=a.y-b.y; return dx*dx+dy*dy }

function getDb() {
  const cfg = {
    apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL:       process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }
  const app = getApps().length ? getApps()[0] : initializeApp(cfg)
  return getDatabase(app)
}

export default function AgarPage() {
  const canvasRef = useRef(null)
  const stateRef  = useRef(null)
  const rafRef    = useRef(0)
  const myIdRef   = useRef(null)
  const dbRef     = useRef(null)
  const cleanupRef = useRef([])
  const lastSyncRef = useRef(0)
  const [running, setRunning] = useState(false)
  const [phase, setPhase]     = useState('intro') // intro | playing | over
  const [score, setScore]     = useState(0)
  const [rank, setRank]       = useState(0)
  const [aliveCount, setAliveCount] = useState(0)
  const [name, setName]       = useState('')
  const [leaderboard, setLeaderboard] = useState([])
  const [isHost, setIsHost]   = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('agar_name')
    if (saved) setName(saved)
    else setName(`Player${Math.floor(Math.random()*1000)}`)
  }, [])

  const start = async () => {
    localStorage.setItem('agar_name', name || 'Player')
    let db
    try { db = getDb() } catch (e) {
      alert('Firebase 연결 실패 — 환경변수 확인 필요'); return
    }
    dbRef.current = db

    const myId = 'p_' + Math.random().toString(36).slice(2, 10)
    myIdRef.current = myId
    const color = randColor()

    // 본인 player 생성
    const me = {
      name: (name || 'Player').slice(0, 16),
      color,
      x: 500 + Math.random()*(WORLD-1000),
      y: 500 + Math.random()*(WORLD-1000),
      mass: PLAYER_START_MASS,
      lastUpdate: Date.now(),
      alive: true,
    }
    await set(ref(db, `agar/players/${myId}`), me)
    // 이탈 시 자동 정리
    onDisconnect(ref(db, `agar/players/${myId}`)).remove().catch(()=>{})

    // 호스트 결정 — 본인이 첫 입장이면 호스트로 등록
    const hostSnap = await get(ref(db, 'agar/host'))
    if (!hostSnap.exists()) {
      await set(ref(db, 'agar/host'), { playerId: myId, since: Date.now() })
      onDisconnect(ref(db, 'agar/host')).remove().catch(()=>{})
    }

    stateRef.current = {
      players: { [myId]: { ...me } },     // 서버에서 받은 원본
      smooth:  { [myId]: { ...me } },     // 보간된 표시 위치
      foods: {},
      mouse: { x: 0, y: 0 },
      camera: { x: me.x, y: me.y, zoom: 0.5 },
      myMass: PLAYER_START_MASS,
      myX: me.x, myY: me.y,
    }
    setPhase('playing'); setRunning(true)

    // 구독 — 플레이어
    const unsubP = onValue(ref(db, 'agar/players'), (snap) => {
      const data = snap.val() || {}
      stateRef.current.players = data
      const arr = Object.entries(data).map(([id,p]) => ({ id, ...p })).filter(p => p.alive !== false)
      setAliveCount(arr.length)
      arr.sort((a,b) => b.mass - a.mass)
      setLeaderboard(arr.slice(0, 8))
      setRank(arr.findIndex(p => p.id === myId) + 1)
      // 본인 객체가 서버에서 삭제됐다면 → 게임 오버
      if (!data[myId]) {
        endGame()
      } else if (data[myId].alive === false) {
        endGame()
      } else {
        setScore(Math.round(data[myId].mass))
      }
    })
    cleanupRef.current.push(() => unsubP())

    // 구독 — 음식
    const unsubF = onValue(ref(db, 'agar/foods'), (snap) => {
      stateRef.current.foods = snap.val() || {}
    })
    cleanupRef.current.push(() => unsubF())

    // 구독 — 호스트
    const unsubH = onValue(ref(db, 'agar/host'), (snap) => {
      const v = snap.val()
      setIsHost(v?.playerId === myId)
      // 호스트가 사라졌으면 본인이 첫 번째인지 확인
      if (!v) {
        // 호스트 클레임 시도 (가장 작은 id가 호스트)
        const players = stateRef.current?.players || {}
        const ids = Object.keys(players).sort()
        if (ids[0] === myId) {
          set(ref(db, 'agar/host'), { playerId: myId, since: Date.now() }).catch(()=>{})
          onDisconnect(ref(db, 'agar/host')).remove().catch(()=>{})
        }
      }
    })
    cleanupRef.current.push(() => unsubH())
  }

  const endGame = () => {
    setPhase('over'); setRunning(false)
    cancelAnimationFrame(rafRef.current)
    cleanup()
  }

  const cleanup = () => {
    cleanupRef.current.forEach(fn => { try { fn() } catch {} })
    cleanupRef.current = []
    const myId = myIdRef.current
    const db = dbRef.current
    if (myId && db) {
      remove(ref(db, `agar/players/${myId}`)).catch(()=>{})
    }
  }

  useEffect(() => () => cleanup(), [])

  // 게임 루프
  useEffect(() => {
    if (!running) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const resize = () => {
      canvas.width = (canvas.parentElement ? canvas.parentElement.clientWidth : window.innerWidth)
      canvas.height = window.innerHeight - 100
    }
    resize(); window.addEventListener('resize', resize)

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect()
      stateRef.current.mouse.x = e.clientX - r.left - canvas.width/2
      stateRef.current.mouse.y = e.clientY - r.top - canvas.height/2
    }
    canvas.addEventListener('mousemove', onMove)
    const onTouch = (e) => {
      const t = e.touches[0]; if (!t) return
      const r = canvas.getBoundingClientRect()
      stateRef.current.mouse.x = t.clientX - r.left - canvas.width/2
      stateRef.current.mouse.y = t.clientY - r.top - canvas.height/2
    }
    canvas.addEventListener('touchmove', onTouch, { passive: true })
    canvas.addEventListener('touchstart', onTouch, { passive: true })

    const loop = async () => {
      const s = stateRef.current
      if (!s || !running) return
      const myId = myIdRef.current
      const db = dbRef.current

      // 본인 이동 (로컬 시뮬레이션)
      const me = s.players[myId]
      if (me && me.alive !== false) {
        const mag = Math.hypot(s.mouse.x, s.mouse.y) || 1
        const speed = MAX_SPEED * Math.max(0.45, 28 / Math.sqrt(s.myMass + 30))
        const vx = s.mouse.x / mag * speed
        const vy = s.mouse.y / mag * speed
        s.myX = Math.max(20, Math.min(WORLD-20, s.myX + vx))
        s.myY = Math.max(20, Math.min(WORLD-20, s.myY + vy))

        // 음식 흡수 (가까운 것만 검사)
        const r = radiusFromMass(s.myMass)
        const r2 = r*r
        for (const [fid, f] of Object.entries(s.foods)) {
          const dx = f.x - s.myX, dy = f.y - s.myY
          if (dx*dx + dy*dy < r2) {
            // 트랜잭션: 음식이 아직 있으면 삭제 + 본인 mass 증가
            runTransaction(ref(db, `agar/foods/${fid}`), (cur) => {
              if (cur === null) return  // 다른 사람이 먹음
              return null
            }).then((res) => {
              if (res.committed && res.snapshot.val() === null) {
                s.myMass += FOOD_MASS
                delete s.foods[fid]
              }
            }).catch(()=>{})
          }
        }

        // 다른 플레이어 흡수 (15% 이상 작은 셀)
        for (const [pid, p] of Object.entries(s.players)) {
          if (pid === myId || !p || p.alive === false) continue
          if (s.myMass > p.mass * 1.15) {
            const dx = p.x - s.myX, dy = p.y - s.myY
            if (dx*dx + dy*dy < (r*0.7)**2) {
              // 트랜잭션: 상대방을 죽임
              runTransaction(ref(db, `agar/players/${pid}`), (cur) => {
                if (!cur || cur.alive === false) return cur
                if (cur.mass < s.myMass / 1.15) {
                  return { ...cur, alive: false }
                }
                return cur
              }).then((res) => {
                if (res.committed && res.snapshot.val()?.alive === false) {
                  s.myMass += p.mass
                  // 상대방 5초 후 자동 제거
                  setTimeout(() => remove(ref(db, `agar/players/${pid}`)).catch(()=>{}), 5000)
                }
              }).catch(()=>{})
            }
          }
        }

        // Throttle: 200ms마다 본인 위치 sync
        const now = Date.now()
        if (now - lastSyncRef.current >= SYNC_INTERVAL_MS) {
          lastSyncRef.current = now
          update(ref(db, `agar/players/${myId}`), {
            x: s.myX, y: s.myY, mass: s.myMass, lastUpdate: now,
          }).catch(()=>{})
        }
      }

      // 호스트: 음식 부족하면 채워줌 (1초에 한 번씩 검사)
      if (isHost && Math.random() < 0.05) {
        const foodCount = Object.keys(s.foods).length
        if (foodCount < FOOD_TARGET) {
          const need = Math.min(20, FOOD_TARGET - foodCount)
          const updates = {}
          for (let i = 0; i < need; i++) {
            const fid = `f_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
            updates[`agar/foods/${fid}`] = {
              x: Math.random() * WORLD,
              y: Math.random() * WORLD,
              color: randColor(),
            }
          }
          update(ref(db), updates).catch(()=>{})
        }
        // 호스트: stale 플레이어 (30초 업데이트 없음) 정리
        const cutoff = Date.now() - 30000
        for (const [pid, p] of Object.entries(s.players)) {
          if (p?.lastUpdate && p.lastUpdate < cutoff) {
            remove(ref(db, `agar/players/${pid}`)).catch(()=>{})
          }
        }
      }

      // 카메라 + zoom — clamp 추가해서 확대 폭주 방지 + 멀리서 시작
      const targetZoom = Math.min(0.6, Math.max(0.25, 30 / Math.sqrt(s.myMass + 100)))
      s.camera.zoom += (targetZoom - s.camera.zoom) * 0.04
      s.camera.x += (s.myX - s.camera.x) * 0.18
      s.camera.y += (s.myY - s.camera.y) * 0.18

      // 보간 — 다른 플레이어들 위치 부드럽게
      for (const [pid, p] of Object.entries(s.players)) {
        if (pid === myId) continue
        if (!s.smooth[pid]) s.smooth[pid] = { ...p }
        else {
          s.smooth[pid].x += (p.x - s.smooth[pid].x) * 0.18
          s.smooth[pid].y += (p.y - s.smooth[pid].y) * 0.18
          s.smooth[pid].mass = p.mass
          s.smooth[pid].name = p.name
          s.smooth[pid].color = p.color
          s.smooth[pid].alive = p.alive
        }
      }
      // 사라진 보간 상태 정리
      for (const sid of Object.keys(s.smooth)) {
        if (sid !== myId && !s.players[sid]) delete s.smooth[sid]
      }

      // 렌더
      ctx.fillStyle = '#0e1424'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.translate(canvas.width/2, canvas.height/2)
      ctx.scale(s.camera.zoom, s.camera.zoom)
      ctx.translate(-s.camera.x, -s.camera.y)

      // 그리드
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 1 / s.camera.zoom
      const grid = 100
      const sx = Math.floor((s.camera.x - canvas.width/2/s.camera.zoom)/grid)*grid
      const ex = s.camera.x + canvas.width/2/s.camera.zoom
      const sy = Math.floor((s.camera.y - canvas.height/2/s.camera.zoom)/grid)*grid
      const ey = s.camera.y + canvas.height/2/s.camera.zoom
      for (let x = sx; x < ex; x += grid) { ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x, ey); ctx.stroke() }
      for (let y = sy; y < ey; y += grid) { ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(ex, y); ctx.stroke() }

      // 경계
      ctx.strokeStyle = 'rgba(255,80,80,0.5)'
      ctx.lineWidth = 4 / s.camera.zoom
      ctx.strokeRect(0, 0, WORLD, WORLD)

      // 음식
      for (const f of Object.values(s.foods)) {
        ctx.fillStyle = f.color
        ctx.beginPath(); ctx.arc(f.x, f.y, 6, 0, Math.PI*2); ctx.fill()
      }

      // 플레이어 (작은 → 큰 순서로 렌더해서 큰 게 위에)
      const renderList = []
      for (const [pid, p] of Object.entries(s.players)) {
        if (!p || p.alive === false) continue
        const pos = (pid === myId)
          ? { x: s.myX, y: s.myY, mass: s.myMass, name: p.name, color: p.color }
          : { x: s.smooth[pid]?.x ?? p.x, y: s.smooth[pid]?.y ?? p.y, mass: p.mass, name: p.name, color: p.color }
        renderList.push({ id: pid, ...pos })
      }
      renderList.sort((a,b) => a.mass - b.mass)
      for (const p of renderList) {
        const r = radiusFromMass(p.mass)
        ctx.fillStyle = p.color
        ctx.strokeStyle = p.id === myId ? '#fff' : 'rgba(0,0,0,0.3)'
        ctx.lineWidth = (p.id === myId ? 4 : 3) / s.camera.zoom
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#fff'
        ctx.font = `${Math.max(12, r/2.5)}px var(--serif, serif)`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4 / s.camera.zoom
        ctx.fillText(p.name || '?', p.x, p.y - 6)
        ctx.font = `${Math.max(10, r/3.5)}px var(--mono, monospace)`
        ctx.fillText(Math.round(p.mass), p.x, p.y + r/3)
        ctx.shadowBlur = 0
      }

      ctx.restore()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('touchmove', onTouch)
      canvas.removeEventListener('touchstart', onTouch)
    }
  }, [running, isHost])

  return (
    <main>
      <div className="ag-wrap">
        <div className="ag-top">
          <Link href="/games" className="btn btn-sm">← 게임 목록</Link>
          {phase === 'playing' && (
            <>
              <div className="ag-hud-stat"><span>질량</span><strong>{score}</strong></div>
              <div className="ag-hud-stat"><span>순위</span><strong>{rank}/{aliveCount}</strong></div>
              {isHost && <div className="ag-hud-stat" style={{background:'rgba(201,168,76,.25)'}}><span>HOST</span></div>}
            </>
          )}
        </div>

        {phase === 'intro' && (
          <div className="ag-intro">
            <div className="ag-title">agar.io</div>
            <div className="ag-sub">실시간 멀티플레이 · Firebase 기반</div>
            <input className="ag-input" placeholder="이름" value={name} onChange={e=>setName(e.target.value)} maxLength={16}/>
            <button className="ag-start" onClick={start}>플레이</button>
            <ul className="ag-rules">
              <li>마우스/터치로 이동</li>
              <li>15% 이상 작은 셀은 흡수 가능</li>
              <li>접속한 모든 플레이어가 같은 맵에서 만남</li>
              <li>30초 이상 응답 없으면 자동 퇴장</li>
            </ul>
          </div>
        )}

        {phase === 'playing' && (
          <>
            <canvas ref={canvasRef} className="ag-canvas"/>
            <div className="ag-leaderboard">
              <div className="ag-lb-title">접속자 {aliveCount}명</div>
              {leaderboard.map((p, i) => (
                <div key={p.id} className="ag-lb-row" style={{color: p.id === myIdRef.current ? '#c9a84c' : '#fff'}}>
                  <span className="ag-lb-rank">{i+1}</span>
                  <span className="ag-lb-name">{p.name}</span>
                  <span className="ag-lb-mass">{Math.round(p.mass)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {phase === 'over' && (
          <div className="ag-intro">
            <div className="ag-title" style={{color:'#e74c3c'}}>흡수됨</div>
            <div className="ag-sub">최종 질량: {score}</div>
            <button className="ag-start" onClick={start}>다시 시작</button>
          </div>
        )}
      </div>

      <style>{`
        .ag-wrap{min-height:100vh;background:#0e1424;color:#fff;position:relative;overflow:hidden;}
        .ag-top{position:fixed;top:12px;left:60px;display:flex;gap:.6rem;align-items:center;z-index:50;flex-wrap:wrap;}
        .ag-hud-stat{background:rgba(0,0,0,.55);padding:.35rem .75rem;border-radius:6px;font-family:var(--mono);font-size:.75rem;display:flex;align-items:center;gap:.4rem;}
        .ag-hud-stat span{opacity:.6;}
        .ag-hud-stat strong{color:#c9a84c;font-weight:700;}
        .ag-canvas{display:block;width:100%;height:100vh;cursor:none;}

        .ag-intro{max-width:480px;margin:5vh auto;text-align:center;padding:2rem;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.1);border-radius:12px;}
        .ag-title{font-family:var(--serif);font-size:3rem;font-weight:700;color:#c9a84c;letter-spacing:.05em;margin-bottom:.4rem;}
        .ag-sub{font-family:var(--mono);font-size:.9rem;color:rgba(255,255,255,.7);margin-bottom:1.5rem;}
        .ag-input{width:100%;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.2);color:#fff;padding:.65rem .85rem;border-radius:8px;font-family:var(--serif);font-size:1rem;outline:none;margin-bottom:.75rem;text-align:center;}
        .ag-start{display:block;width:100%;padding:.75rem;background:linear-gradient(135deg,#c9a84c,#8b6f1f);color:#1a1208;border:none;border-radius:30px;font-family:var(--serif);font-weight:700;font-size:1rem;cursor:pointer;}
        .ag-rules{list-style:none;padding:0;text-align:left;margin-top:1rem;}
        .ag-rules li{font-size:.82rem;line-height:1.85;color:rgba(255,255,255,.7);}
        .ag-rules li::before{content:'·';color:#c9a84c;margin-right:.5rem;}

        .ag-leaderboard{position:fixed;top:70px;right:1rem;background:rgba(0,0,0,.65);padding:.75rem 1rem;border-radius:8px;font-family:var(--mono);font-size:.78rem;min-width:200px;z-index:50;max-height:60vh;overflow-y:auto;}
        .ag-lb-title{font-family:var(--serif);font-weight:700;margin-bottom:.4rem;color:#c9a84c;font-size:.85rem;}
        .ag-lb-row{display:flex;justify-content:space-between;gap:.6rem;padding:.18rem 0;}
        .ag-lb-rank{width:18px;color:rgba(255,255,255,.45);}
        .ag-lb-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .ag-lb-mass{color:rgba(255,255,255,.8);}
        @media(max-width:640px){.ag-leaderboard{font-size:.7rem;min-width:140px;}.ag-title{font-size:2.2rem;}}
      `}</style>
    </main>
  )
}
