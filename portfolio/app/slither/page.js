'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, onValue, set, remove, onDisconnect, update, runTransaction, get } from 'firebase/database'

/**
 * slither.io — Firebase Realtime DB 멀티플레이
 *
 * 데이터:
 *   slither/players/{playerId}: { name, color, headX, headY, angle, length, lastUpdate, alive }
 *   slither/foods/{foodId}:     { x, y, color, r }
 *   slither/host:               { playerId, since }
 *
 * - 머리 좌표 + 각도 + 길이만 sync (segs 전체 X — 트래픽 절약)
 * - 다른 플레이어의 segs 는 client 가 머리 위치 큐로 추정
 * - 100ms throttle. 호스트가 음식 spawn + stale 정리
 */

const WORLD = 4500
const FOOD_TARGET = 500
const START_LEN = 30
const BASE_SPEED = 1.6
const BOOST_SPEED = 2.8
const BOOST_DRAIN_FRAMES = 8 // 매 N frame 마다 1 길이 감소
const FOOD_R = 4
const SEG_R = 8
const SYNC_MS = 100

const COLORS = ['#e74c3c','#e67e22','#f1c40f','#27ae60','#16a085','#2980b9','#8e44ad','#1abc9c','#d35400']
const randColor = () => COLORS[Math.floor(Math.random()*COLORS.length)]

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

export default function SlitherPage() {
  const canvasRef = useRef(null)
  const stateRef  = useRef(null)
  const rafRef    = useRef(0)
  const myIdRef   = useRef(null)
  const dbRef     = useRef(null)
  const cleanupRef = useRef([])
  const lastSyncRef = useRef(0)
  const frameRef = useRef(0)
  const [running, setRunning] = useState(false)
  const [phase, setPhase]     = useState('intro')
  const [score, setScore]     = useState(START_LEN)
  const [rank, setRank]       = useState(0)
  const [aliveCount, setAliveCount] = useState(0)
  const [name, setName]       = useState('')
  const [leaderboard, setLeaderboard] = useState([])
  const [isHost, setIsHost]   = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('slither_name')
    if (saved) setName(saved)
    else setName(`Player${Math.floor(Math.random()*1000)}`)
  }, [])

  const start = async () => {
    localStorage.setItem('slither_name', name || 'Player')
    let db
    try { db = getDb() } catch { alert('Firebase 연결 실패'); return }
    dbRef.current = db

    const myId = 's_' + Math.random().toString(36).slice(2, 10)
    myIdRef.current = myId
    const color = randColor()
    const headX = 500 + Math.random()*(WORLD-1000)
    const headY = 500 + Math.random()*(WORLD-1000)
    const angle = Math.random() * Math.PI * 2

    const me = {
      name: (name || 'Player').slice(0, 16), color,
      headX, headY, angle, length: START_LEN,
      lastUpdate: Date.now(), alive: true,
    }
    await set(ref(db, `slither/players/${myId}`), me)
    onDisconnect(ref(db, `slither/players/${myId}`)).remove().catch(()=>{})

    const hostSnap = await get(ref(db, 'slither/host'))
    if (!hostSnap.exists()) {
      await set(ref(db, 'slither/host'), { playerId: myId, since: Date.now() })
      onDisconnect(ref(db, 'slither/host')).remove().catch(()=>{})
    }

    // 로컬 segs 큐 (본인 + 다른 플레이어용)
    const segs = []
    for (let i = 0; i < START_LEN; i++) {
      segs.push({ x: headX - Math.cos(angle)*i*6, y: headY - Math.sin(angle)*i*6 })
    }

    stateRef.current = {
      players: { [myId]: { ...me } },
      myHead: { x: headX, y: headY },
      myAngle: angle,
      myLength: START_LEN,
      mySegs: segs,                       // 본인 segs 로컬
      remoteSegs: {},                     // 다른 플레이어 segs 큐 { playerId: [{x,y},...] }
      foods: {},
      mouse: { x: 0, y: 0 },
      boost: false,
      camera: { x: headX, y: headY },
    }
    setPhase('playing'); setRunning(true)
    setScore(START_LEN); setRank(1)

    const unsubP = onValue(ref(db, 'slither/players'), (snap) => {
      const data = snap.val() || {}
      stateRef.current.players = data
      const arr = Object.entries(data).map(([id,p]) => ({ id, ...p })).filter(p => p.alive !== false)
      setAliveCount(arr.length)
      arr.sort((a,b) => (b.length||0) - (a.length||0))
      setLeaderboard(arr.slice(0,8))
      setRank(arr.findIndex(p => p.id === myId) + 1 || 0)
      if (!data[myId] || data[myId].alive === false) endGame()
    })
    cleanupRef.current.push(() => unsubP())

    const unsubF = onValue(ref(db, 'slither/foods'), (snap) => {
      stateRef.current.foods = snap.val() || {}
    })
    cleanupRef.current.push(() => unsubF())

    const unsubH = onValue(ref(db, 'slither/host'), (snap) => {
      const v = snap.val()
      setIsHost(v?.playerId === myId)
      if (!v) {
        const players = stateRef.current?.players || {}
        const ids = Object.keys(players).sort()
        if (ids[0] === myId) {
          set(ref(db, 'slither/host'), { playerId: myId, since: Date.now() }).catch(()=>{})
          onDisconnect(ref(db, 'slither/host')).remove().catch(()=>{})
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
    if (myId && db) remove(ref(db, `slither/players/${myId}`)).catch(()=>{})
  }
  useEffect(() => () => cleanup(), [])

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

    const onDown = (e) => { if (e.code === 'Space' || e.button === 0) stateRef.current.boost = true }
    const onUp   = (e) => { if (e.code === 'Space' || e.button === 0) stateRef.current.boost = false }
    window.addEventListener('keydown', onDown); window.addEventListener('keyup', onUp)
    canvas.addEventListener('mousedown', onDown); canvas.addEventListener('mouseup', onUp)
    canvas.addEventListener('touchstart', () => { stateRef.current.boost = true })
    canvas.addEventListener('touchend',   () => { stateRef.current.boost = false })

    const radiusOf = (length) => SEG_R + Math.min(20, length/40)

    const loop = () => {
      frameRef.current++
      const s = stateRef.current
      if (!s) return
      const myId = myIdRef.current
      const db = dbRef.current
      const me = s.players[myId]
      if (!me || me.alive === false) return

      // 본인 이동
      const targetAngle = Math.atan2(s.mouse.y, s.mouse.x)
      let da = targetAngle - s.myAngle
      while (da > Math.PI) da -= Math.PI*2
      while (da < -Math.PI) da += Math.PI*2
      s.myAngle += da * 0.2
      const speed = s.boost && s.myLength > START_LEN ? BOOST_SPEED : BASE_SPEED
      const newHead = {
        x: s.myHead.x + Math.cos(s.myAngle) * speed,
        y: s.myHead.y + Math.sin(s.myAngle) * speed,
      }

      // 경계 충돌
      if (newHead.x < 0 || newHead.x > WORLD || newHead.y < 0 || newHead.y > WORLD) {
        // 죽음 처리 + 음식 흘리기
        update(ref(db, `slither/players/${myId}`), { alive: false }).catch(()=>{})
        const updates = {}
        for (const seg of s.mySegs) {
          if (Math.random() < 0.4) {
            const fid = `f_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
            updates[`slither/foods/${fid}`] = { x: seg.x, y: seg.y, color: me.color, r: FOOD_R+1 }
          }
        }
        update(ref(db), updates).catch(()=>{})
        return
      }

      s.myHead = newHead
      s.mySegs.unshift({ ...newHead })
      // 부스트 중 길이 감소
      if (s.boost && s.myLength > START_LEN && frameRef.current % BOOST_DRAIN_FRAMES === 0) {
        s.myLength--
        const fid = `f_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
        const tail = s.mySegs[s.mySegs.length-1]
        if (tail) {
          update(ref(db), { [`slither/foods/${fid}`]: { x: tail.x, y: tail.y, color: me.color, r: FOOD_R } }).catch(()=>{})
        }
      }
      while (s.mySegs.length > s.myLength) s.mySegs.pop()

      // 음식 먹기
      const r = radiusOf(s.myLength) + 4
      const r2 = r*r
      for (const [fid, f] of Object.entries(s.foods)) {
        const dx = f.x - s.myHead.x, dy = f.y - s.myHead.y
        if (dx*dx + dy*dy < r2) {
          runTransaction(ref(db, `slither/foods/${fid}`), (cur) => cur === null ? cur : null)
            .then((res) => {
              if (res.committed && res.snapshot.val() === null) {
                s.myLength++
                delete s.foods[fid]
              }
            }).catch(()=>{})
        }
      }

      // 머리 vs 다른 뱀 몸 충돌 (죽음)
      for (const [pid, p] of Object.entries(s.players)) {
        if (pid === myId || !p || p.alive === false) continue
        const remoteSegs = s.remoteSegs[pid] || []
        const remR = radiusOf(p.length || START_LEN)
        const collDist2 = (r + remR) ** 2
        for (let i = 0; i < remoteSegs.length; i += 2) {
          const seg = remoteSegs[i]
          if (!seg) continue
          const dx = seg.x - s.myHead.x, dy = seg.y - s.myHead.y
          if (dx*dx + dy*dy < collDist2) {
            update(ref(db, `slither/players/${myId}`), { alive: false }).catch(()=>{})
            const updates = {}
            for (const sgg of s.mySegs) {
              if (Math.random() < 0.5) {
                const fid = `f_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
                updates[`slither/foods/${fid}`] = { x: sgg.x, y: sgg.y, color: me.color, r: FOOD_R+1 }
              }
            }
            update(ref(db), updates).catch(()=>{})
            return
          }
        }
      }

      // 200ms throttle 로 본인 상태 sync
      const now = Date.now()
      if (now - lastSyncRef.current >= SYNC_MS) {
        lastSyncRef.current = now
        update(ref(db, `slither/players/${myId}`), {
          headX: s.myHead.x, headY: s.myHead.y,
          angle: s.myAngle, length: s.myLength,
          lastUpdate: now,
        }).catch(()=>{})
      }

      // 다른 플레이어 segs 큐 업데이트 (보간)
      for (const [pid, p] of Object.entries(s.players)) {
        if (pid === myId || !p || p.alive === false) continue
        if (!s.remoteSegs[pid]) s.remoteSegs[pid] = []
        const arr = s.remoteSegs[pid]
        // 머리 위치 — 보간으로 부드럽게
        const lastHead = arr[0] || { x: p.headX, y: p.headY }
        const ix = lastHead.x + (p.headX - lastHead.x) * 0.25
        const iy = lastHead.y + (p.headY - lastHead.y) * 0.25
        arr.unshift({ x: ix, y: iy })
        while (arr.length > (p.length || START_LEN)) arr.pop()
      }
      // 죽거나 사라진 플레이어 정리
      for (const pid of Object.keys(s.remoteSegs)) {
        if (!s.players[pid] || s.players[pid].alive === false) delete s.remoteSegs[pid]
      }

      // 호스트: 음식 채우기 + stale 정리
      if (isHost && Math.random() < 0.04) {
        const count = Object.keys(s.foods).length
        if (count < FOOD_TARGET) {
          const need = Math.min(15, FOOD_TARGET - count)
          const updates = {}
          for (let i = 0; i < need; i++) {
            const fid = `f_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
            updates[`slither/foods/${fid}`] = {
              x: Math.random()*WORLD, y: Math.random()*WORLD,
              color: randColor(), r: FOOD_R + Math.random()*2,
            }
          }
          update(ref(db), updates).catch(()=>{})
        }
        const cutoff = Date.now() - 30000
        for (const [pid, p] of Object.entries(s.players)) {
          if (p?.lastUpdate && p.lastUpdate < cutoff) {
            remove(ref(db, `slither/players/${pid}`)).catch(()=>{})
          }
        }
      }

      // 카메라
      s.camera.x += (s.myHead.x - s.camera.x) * 0.15
      s.camera.y += (s.myHead.y - s.camera.y) * 0.15

      // 렌더
      ctx.fillStyle = '#070a14'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.translate(canvas.width/2, canvas.height/2)
      ctx.translate(-s.camera.x, -s.camera.y)

      // 그리드
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 1
      const grid = 80
      const sx = Math.floor((s.camera.x - canvas.width/2)/grid)*grid
      const ex = s.camera.x + canvas.width/2
      const sy = Math.floor((s.camera.y - canvas.height/2)/grid)*grid
      const ey = s.camera.y + canvas.height/2
      for (let x = sx; x < ex; x += grid) { ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x, ey); ctx.stroke() }
      for (let y = sy; y < ey; y += grid) { ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(ex, y); ctx.stroke() }

      // 경계
      ctx.strokeStyle = 'rgba(255,80,80,0.5)'
      ctx.lineWidth = 3
      ctx.strokeRect(0, 0, WORLD, WORLD)

      // 음식
      for (const f of Object.values(s.foods)) {
        ctx.fillStyle = f.color
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI*2); ctx.fill()
      }

      // 다른 플레이어 뱀
      for (const [pid, p] of Object.entries(s.players)) {
        if (pid === myId || !p || p.alive === false) continue
        const segs = s.remoteSegs[pid] || []
        const rr = radiusOf(p.length || START_LEN)
        for (let i = segs.length - 1; i >= 0; i--) {
          const seg = segs[i]
          ctx.fillStyle = p.color
          ctx.beginPath(); ctx.arc(seg.x, seg.y, rr, 0, Math.PI*2); ctx.fill()
        }
        // 머리 눈
        const head = segs[0] || { x: p.headX, y: p.headY }
        ctx.fillStyle = '#fff'
        const eA = p.angle
        ctx.beginPath(); ctx.arc(head.x + Math.cos(eA+Math.PI/3)*rr*0.6, head.y + Math.sin(eA+Math.PI/3)*rr*0.6, rr*0.3, 0, Math.PI*2); ctx.fill()
        ctx.beginPath(); ctx.arc(head.x + Math.cos(eA-Math.PI/3)*rr*0.6, head.y + Math.sin(eA-Math.PI/3)*rr*0.6, rr*0.3, 0, Math.PI*2); ctx.fill()
        // 이름
        ctx.fillStyle = 'rgba(255,255,255,.85)'
        ctx.font = '13px var(--mono, monospace)'
        ctx.textAlign = 'center'
        ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 3
        ctx.fillText(p.name || '?', head.x, head.y - rr - 8)
        ctx.shadowBlur = 0
      }

      // 본인 뱀
      const myR = radiusOf(s.myLength)
      for (let i = s.mySegs.length - 1; i >= 0; i--) {
        const seg = s.mySegs[i]
        ctx.fillStyle = me.color
        ctx.globalAlpha = s.boost ? 0.85 : 1
        ctx.beginPath(); ctx.arc(seg.x, seg.y, myR, 0, Math.PI*2); ctx.fill()
      }
      ctx.globalAlpha = 1
      // 본인 눈
      ctx.fillStyle = '#fff'
      const eA = s.myAngle
      ctx.beginPath(); ctx.arc(s.myHead.x + Math.cos(eA+Math.PI/3)*myR*0.6, s.myHead.y + Math.sin(eA+Math.PI/3)*myR*0.6, myR*0.3, 0, Math.PI*2); ctx.fill()
      ctx.beginPath(); ctx.arc(s.myHead.x + Math.cos(eA-Math.PI/3)*myR*0.6, s.myHead.y + Math.sin(eA-Math.PI/3)*myR*0.6, myR*0.3, 0, Math.PI*2); ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,.95)'
      ctx.font = '14px var(--mono, monospace)'
      ctx.textAlign = 'center'
      ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 3
      ctx.fillText(me.name || '나', s.myHead.x, s.myHead.y - myR - 8)
      ctx.shadowBlur = 0

      ctx.restore()
      setScore(s.myLength)

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('touchmove', onTouch)
    }
  }, [running, isHost])

  return (
    <main>
      <div className="sl-wrap">
        <div className="sl-top">
          <Link href="/games" className="btn btn-sm">← 게임 목록</Link>
          {phase === 'playing' && (
            <>
              <div className="sl-hud-stat"><span>길이</span><strong>{score}</strong></div>
              <div className="sl-hud-stat"><span>순위</span><strong>{rank}/{aliveCount}</strong></div>
              {isHost && <div className="sl-hud-stat" style={{background:'rgba(201,168,76,.25)'}}><span>HOST</span></div>}
            </>
          )}
        </div>

        {phase === 'intro' && (
          <div className="sl-intro">
            <div className="sl-title">slither.io</div>
            <div className="sl-sub">실시간 멀티플레이 · Firebase 기반</div>
            <input className="sl-input" placeholder="이름" value={name} onChange={e=>setName(e.target.value)} maxLength={16}/>
            <button className="sl-start" onClick={start}>플레이</button>
            <ul className="sl-rules">
              <li>마우스/터치로 방향 조작</li>
              <li>마우스 클릭/스페이스 → 부스트 (길이 소모)</li>
              <li>머리가 다른 뱀의 몸에 부딪히면 죽음</li>
              <li>죽은 뱀은 음식으로 변환됨</li>
            </ul>
          </div>
        )}

        {phase === 'playing' && (
          <>
            <canvas ref={canvasRef} className="sl-canvas"/>
            <div className="sl-leaderboard">
              <div className="sl-lb-title">접속자 {aliveCount}명</div>
              {leaderboard.map((p, i) => (
                <div key={p.id} className="sl-lb-row" style={{color: p.id === myIdRef.current ? '#c9a84c' : '#fff'}}>
                  <span className="sl-lb-rank">{i+1}</span>
                  <span className="sl-lb-name">{p.name}</span>
                  <span className="sl-lb-mass">{p.length}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {phase === 'over' && (
          <div className="sl-intro">
            <div className="sl-title" style={{color:'#e74c3c'}}>죽었다...</div>
            <div className="sl-sub">최종 길이: {score}</div>
            <button className="sl-start" onClick={start}>다시 시작</button>
          </div>
        )}
      </div>

      <style>{`
        .sl-wrap{min-height:100vh;background:#070a14;color:#fff;position:relative;overflow:hidden;}
        .sl-top{position:fixed;top:10px;left:60px;display:flex;gap:.6rem;align-items:center;z-index:50;flex-wrap:wrap;}
        .sl-hud-stat{background:rgba(0,0,0,.65);padding:.35rem .75rem;border-radius:6px;font-family:var(--mono);font-size:.75rem;display:flex;align-items:center;gap:.4rem;}
        .sl-hud-stat span{opacity:.6;}
        .sl-hud-stat strong{color:#c9a84c;font-weight:700;}
        .sl-canvas{display:block;width:100%;height:100vh;cursor:crosshair;}
        .sl-intro{max-width:480px;margin:5vh auto;text-align:center;padding:2rem;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.1);border-radius:12px;}
        .sl-title{font-family:var(--serif);font-size:3rem;font-weight:700;color:#c9a84c;letter-spacing:.05em;margin-bottom:.4rem;}
        .sl-sub{font-family:var(--mono);font-size:.9rem;color:rgba(255,255,255,.7);margin-bottom:1.5rem;}
        .sl-input{width:100%;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.2);color:#fff;padding:.65rem .85rem;border-radius:8px;font-family:var(--serif);font-size:1rem;outline:none;margin-bottom:.75rem;text-align:center;}
        .sl-start{display:block;width:100%;padding:.75rem;background:linear-gradient(135deg,#c9a84c,#8b6f1f);color:#1a1208;border:none;border-radius:30px;font-family:var(--serif);font-weight:700;font-size:1rem;cursor:pointer;}
        .sl-rules{list-style:none;padding:0;text-align:left;margin-top:1rem;}
        .sl-rules li{font-size:.82rem;line-height:1.85;color:rgba(255,255,255,.7);}
        .sl-rules li::before{content:'·';color:#c9a84c;margin-right:.5rem;}
        .sl-leaderboard{position:fixed;top:10px;right:10px;background:rgba(0,0,0,.65);padding:.75rem 1rem;border-radius:8px;font-family:var(--mono);font-size:.78rem;min-width:200px;z-index:50;max-height:60vh;overflow-y:auto;}
        .sl-lb-title{font-family:var(--serif);font-weight:700;margin-bottom:.4rem;color:#c9a84c;font-size:.85rem;}
        .sl-lb-row{display:flex;justify-content:space-between;gap:.6rem;padding:.18rem 0;}
        .sl-lb-rank{width:18px;color:rgba(255,255,255,.45);}
        .sl-lb-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .sl-lb-mass{color:rgba(255,255,255,.8);}
      `}</style>
    </main>
  )
}
