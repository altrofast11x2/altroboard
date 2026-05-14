'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, onValue, set, remove, onDisconnect, update, runTransaction, get, push } from 'firebase/database'

/**
 * diep.io — Firebase Realtime DB 멀티플레이 (봇 없음)
 *
 * 데이터:
 *   diep/tanks/{tankId}:    { name, color, x, y, angle, hp, maxHp, level, xp, lastUpdate, alive }
 *   diep/shapes/{shapeId}:  { x, y, sides, color, hp, maxHp, size, xp }
 *   diep/bullets/{bulletId}: { x, y, vx, vy, ownerId, ownerColor, damage, createdAt }
 *   diep/host:              { tankId, since }
 */

const WORLD = 5000
const SHAPE_TARGET = 60
const SYNC_MS = 100
const BULLET_TTL_MS = 4000

const SHAPE_TYPES = [
  { sides: 3, color: '#e74c3c', xp: 10,  hp: 30,  size: 18 },
  { sides: 4, color: '#f1c40f', xp: 25,  hp: 50,  size: 22 },
  { sides: 5, color: '#9b59b6', xp: 100, hp: 130, size: 28 },
]
const TANK_COLORS = ['#3498db','#e67e22','#27ae60','#8e44ad','#1abc9c','#c0392b','#16a085','#d35400']
const xpForLevel = (l) => Math.floor(50 * Math.pow(1.5, l - 1))
const randColor = () => TANK_COLORS[Math.floor(Math.random()*TANK_COLORS.length)]
const randPos = () => ({ x: 200 + Math.random()*(WORLD-400), y: 200 + Math.random()*(WORLD-400) })

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

export default function DiepPage() {
  const canvasRef = useRef(null)
  const stateRef  = useRef(null)
  const rafRef    = useRef(0)
  const myIdRef   = useRef(null)
  const dbRef     = useRef(null)
  const cleanupRef = useRef([])
  const lastSyncRef = useRef(0)
  const lastFireRef = useRef(0)
  const [running, setRunning] = useState(false)
  const [phase, setPhase]     = useState('intro')
  const [hud, setHud]         = useState({ level: 1, xp: 0, xpNeed: 50, hp: 100, maxHp: 100, score: 0 })
  const [name, setName]       = useState('')
  const [aliveCount, setAliveCount] = useState(0)
  const [leaderboard, setLeaderboard] = useState([])
  const [isHost, setIsHost]   = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('diep_name')
    if (saved) setName(saved)
    else setName(`Player${Math.floor(Math.random()*1000)}`)
  }, [])

  const start = async () => {
    localStorage.setItem('diep_name', name || 'Player')
    let db
    try { db = getDb() } catch { alert('Firebase 연결 실패'); return }
    dbRef.current = db

    const myId = 'd_' + Math.random().toString(36).slice(2, 10)
    myIdRef.current = myId
    const color = randColor()
    const p = randPos()
    const me = {
      name: (name || 'Player').slice(0, 16), color,
      x: p.x, y: p.y, angle: 0,
      hp: 100, maxHp: 100,
      level: 1, xp: 0,
      lastUpdate: Date.now(), alive: true,
    }
    await set(ref(db, `diep/tanks/${myId}`), me)
    onDisconnect(ref(db, `diep/tanks/${myId}`)).remove().catch(()=>{})

    const hostSnap = await get(ref(db, 'diep/host'))
    if (!hostSnap.exists()) {
      await set(ref(db, 'diep/host'), { tankId: myId, since: Date.now() })
      onDisconnect(ref(db, 'diep/host')).remove().catch(()=>{})
    }

    stateRef.current = {
      tanks: { [myId]: me }, shapes: {}, bullets: {},
      keys: {}, mouse: { x: 0, y: 0, down: false },
      camera: { x: me.x, y: me.y },
      myX: me.x, myY: me.y, myVx: 0, myVy: 0, myAngle: 0,
      mySpeed: 2.4, myFireRate: 400, myBulletSpeed: 7, myDamage: 8,
      myHp: 100, myMaxHp: 100, myLevel: 1, myXp: 0, score: 0,
    }
    setPhase('playing'); setRunning(true)

    const unsubT = onValue(ref(db, 'diep/tanks'), (snap) => {
      const data = snap.val() || {}
      stateRef.current.tanks = data
      const arr = Object.entries(data).map(([id,t]) => ({ id, ...t })).filter(t => t.alive !== false)
      setAliveCount(arr.length)
      arr.sort((a,b) => (b.level||1)*1000 + (b.xp||0) - ((a.level||1)*1000 + (a.xp||0)))
      setLeaderboard(arr.slice(0, 8))
      if (!data[myId] || data[myId].alive === false) endGame()
    })
    cleanupRef.current.push(() => unsubT())

    const unsubS = onValue(ref(db, 'diep/shapes'), (snap) => { stateRef.current.shapes = snap.val() || {} })
    cleanupRef.current.push(() => unsubS())

    const unsubB = onValue(ref(db, 'diep/bullets'), (snap) => { stateRef.current.bullets = snap.val() || {} })
    cleanupRef.current.push(() => unsubB())

    const unsubH = onValue(ref(db, 'diep/host'), (snap) => {
      const v = snap.val()
      setIsHost(v?.tankId === myId)
      if (!v) {
        const tanks = stateRef.current?.tanks || {}
        const ids = Object.keys(tanks).sort()
        if (ids[0] === myId) {
          set(ref(db, 'diep/host'), { tankId: myId, since: Date.now() }).catch(()=>{})
          onDisconnect(ref(db, 'diep/host')).remove().catch(()=>{})
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
    if (myId && db) remove(ref(db, `diep/tanks/${myId}`)).catch(()=>{})
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

    const onKD = (e) => { stateRef.current.keys[e.key.toLowerCase()] = true }
    const onKU = (e) => { stateRef.current.keys[e.key.toLowerCase()] = false }
    window.addEventListener('keydown', onKD); window.addEventListener('keyup', onKU)

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect()
      stateRef.current.mouse.x = e.clientX - r.left - canvas.width/2
      stateRef.current.mouse.y = e.clientY - r.top - canvas.height/2
    }
    canvas.addEventListener('mousemove', onMove)
    const onDown = () => { stateRef.current.mouse.down = true }
    const onUp   = () => { stateRef.current.mouse.down = false }
    canvas.addEventListener('mousedown', onDown); canvas.addEventListener('mouseup', onUp)

    const fireBullet = () => {
      const s = stateRef.current
      const now = Date.now()
      if (now - lastFireRef.current < s.myFireRate) return
      lastFireRef.current = now
      const db = dbRef.current
      const myId = myIdRef.current
      const me = s.tanks[myId]
      if (!me) return
      const bid = push(ref(db, 'diep/bullets')).key
      const bullet = {
        x: s.myX + Math.cos(s.myAngle)*30,
        y: s.myY + Math.sin(s.myAngle)*30,
        vx: Math.cos(s.myAngle) * s.myBulletSpeed,
        vy: Math.sin(s.myAngle) * s.myBulletSpeed,
        ownerId: myId, ownerColor: me.color,
        damage: s.myDamage, createdAt: now,
      }
      update(ref(db), { [`diep/bullets/${bid}`]: bullet }).catch(()=>{})
    }

    const handleLevelUp = (xpGained) => {
      const s = stateRef.current
      s.myXp += xpGained
      s.score += xpGained
      while (s.myXp >= xpForLevel(s.myLevel)) {
        s.myXp -= xpForLevel(s.myLevel)
        s.myLevel++
        s.myMaxHp += 12
        s.myHp = Math.min(s.myMaxHp, s.myHp + 30)
        s.myDamage += 1.5
        s.myFireRate = Math.max(180, s.myFireRate - 12)
        s.myBulletSpeed += 0.2
        s.mySpeed += 0.05
      }
    }

    const loop = () => {
      const s = stateRef.current
      if (!s) return
      const myId = myIdRef.current
      const db = dbRef.current
      const me = s.tanks[myId]
      if (!me || me.alive === false) return

      let dx = 0, dy = 0
      if (s.keys['w'] || s.keys['arrowup']) dy -= 1
      if (s.keys['s'] || s.keys['arrowdown']) dy += 1
      if (s.keys['a'] || s.keys['arrowleft']) dx -= 1
      if (s.keys['d'] || s.keys['arrowright']) dx += 1
      const mag = Math.hypot(dx, dy)
      if (mag > 0) { dx /= mag; dy /= mag }
      s.myVx = s.myVx*0.85 + dx * s.mySpeed * 0.15
      s.myVy = s.myVy*0.85 + dy * s.mySpeed * 0.15
      s.myX = Math.max(20, Math.min(WORLD-20, s.myX + s.myVx))
      s.myY = Math.max(20, Math.min(WORLD-20, s.myY + s.myVy))
      s.myAngle = Math.atan2(s.mouse.y, s.mouse.x)
      if (s.mouse.down || s.keys[' ']) fireBullet()

      // 본인 총알 vs 도형/탱크
      for (const [bid, b] of Object.entries(s.bullets)) {
        if (b.ownerId !== myId) continue
        const bx = b._x ?? b.x, by = b._y ?? b.y
        for (const [shid, sh] of Object.entries(s.shapes)) {
          const dx = sh.x - bx, dy = sh.y - by
          if (dx*dx + dy*dy < (sh.size+8)**2) {
            runTransaction(ref(db, `diep/shapes/${shid}`), (cur) => {
              if (!cur) return cur
              const newHp = cur.hp - b.damage
              if (newHp <= 0) return null
              return { ...cur, hp: newHp }
            }).then((res) => {
              if (res.committed && res.snapshot.val() === null) handleLevelUp(sh.xp)
            }).catch(()=>{})
            remove(ref(db, `diep/bullets/${bid}`)).catch(()=>{})
            break
          }
        }
        for (const [tid, t] of Object.entries(s.tanks)) {
          if (tid === myId || !t || t.alive === false) continue
          const dx = t.x - bx, dy = t.y - by
          if (dx*dx + dy*dy < 24*24) {
            runTransaction(ref(db, `diep/tanks/${tid}`), (cur) => {
              if (!cur || cur.alive === false) return cur
              const newHp = (cur.hp || 100) - b.damage
              if (newHp <= 0) return { ...cur, hp: 0, alive: false }
              return { ...cur, hp: newHp }
            }).then((res) => {
              if (res.committed && res.snapshot.val()?.alive === false) {
                handleLevelUp(50 + (t.level||1)*20)
                setTimeout(() => remove(ref(db, `diep/tanks/${tid}`)).catch(()=>{}), 4000)
              }
            }).catch(()=>{})
            remove(ref(db, `diep/bullets/${bid}`)).catch(()=>{})
            break
          }
        }
      }

      // 다른 총알 vs 본인 (로컬 hp만 깎고 sync)
      for (const [bid, b] of Object.entries(s.bullets)) {
        if (b.ownerId === myId) continue
        const bx = b._x ?? b.x, by = b._y ?? b.y
        const dx = s.myX - bx, dy = s.myY - by
        if (dx*dx + dy*dy < 24*24) {
          s.myHp -= b.damage
          remove(ref(db, `diep/bullets/${bid}`)).catch(()=>{})
          if (s.myHp <= 0) {
            update(ref(db, `diep/tanks/${myId}`), { hp: 0, alive: false }).catch(()=>{})
            return
          }
        }
      }

      // sync
      const now = Date.now()
      if (now - lastSyncRef.current >= SYNC_MS) {
        lastSyncRef.current = now
        update(ref(db, `diep/tanks/${myId}`), {
          x: s.myX, y: s.myY, angle: s.myAngle,
          hp: s.myHp, maxHp: s.myMaxHp,
          level: s.myLevel, xp: s.myXp,
          lastUpdate: now,
        }).catch(()=>{})
      }

      // 호스트: 도형/총알/탱크 정리
      if (isHost && Math.random() < 0.05) {
        const cur = Object.keys(s.shapes).length
        if (cur < SHAPE_TARGET) {
          const need = Math.min(10, SHAPE_TARGET - cur)
          const updates = {}
          for (let i = 0; i < need; i++) {
            const t = SHAPE_TYPES[Math.floor(Math.random()*SHAPE_TYPES.length)]
            const p = randPos()
            const shid = `sh_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
            updates[`diep/shapes/${shid}`] = { ...p, ...t, hp: t.hp, maxHp: t.hp }
          }
          update(ref(db), updates).catch(()=>{})
        }
        const bcutoff = Date.now() - BULLET_TTL_MS
        for (const [bid, b] of Object.entries(s.bullets)) {
          if (b.createdAt < bcutoff) remove(ref(db, `diep/bullets/${bid}`)).catch(()=>{})
        }
        const tcutoff = Date.now() - 30000
        for (const [tid, t] of Object.entries(s.tanks)) {
          if (t?.lastUpdate && t.lastUpdate < tcutoff) {
            remove(ref(db, `diep/tanks/${tid}`)).catch(()=>{})
          }
        }
      }

      s.camera.x += (s.myX - s.camera.x) * 0.12
      s.camera.y += (s.myY - s.camera.y) * 0.12

      // 총알 위치 보간
      for (const b of Object.values(s.bullets)) {
        const elapsed = (Date.now() - b.createdAt) / 16.67
        b._x = b.x + b.vx * elapsed
        b._y = b.y + b.vy * elapsed
      }

      ctx.fillStyle = '#1a2032'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.translate(canvas.width/2, canvas.height/2)
      ctx.translate(-s.camera.x, -s.camera.y)

      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      const grid = 80
      const sx = Math.floor((s.camera.x - canvas.width/2)/grid)*grid
      const ex = s.camera.x + canvas.width/2
      const sy = Math.floor((s.camera.y - canvas.height/2)/grid)*grid
      const ey = s.camera.y + canvas.height/2
      for (let x = sx; x < ex; x += grid) { ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x, ey); ctx.stroke() }
      for (let y = sy; y < ey; y += grid) { ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(ex, y); ctx.stroke() }

      ctx.strokeStyle = 'rgba(255,80,80,0.5)'; ctx.lineWidth = 3
      ctx.strokeRect(0, 0, WORLD, WORLD)

      for (const sh of Object.values(s.shapes)) {
        ctx.save()
        ctx.translate(sh.x, sh.y)
        ctx.fillStyle = sh.color
        ctx.strokeStyle = 'rgba(0,0,0,.3)'
        ctx.lineWidth = 3
        ctx.beginPath()
        for (let i = 0; i < sh.sides; i++) {
          const a = (Math.PI*2/sh.sides)*i - Math.PI/2
          const x = Math.cos(a)*sh.size, y = Math.sin(a)*sh.size
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        ctx.closePath(); ctx.fill(); ctx.stroke()
        ctx.restore()
        if (sh.hp < sh.maxHp) {
          ctx.fillStyle = 'rgba(0,0,0,.5)'
          ctx.fillRect(sh.x - 20, sh.y + sh.size + 6, 40, 4)
          ctx.fillStyle = '#2ecc71'
          ctx.fillRect(sh.x - 20, sh.y + sh.size + 6, 40*(sh.hp/sh.maxHp), 4)
        }
      }

      for (const b of Object.values(s.bullets)) {
        ctx.fillStyle = b.ownerColor
        ctx.strokeStyle = 'rgba(0,0,0,.4)'
        ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(b._x ?? b.x, b._y ?? b.y, 6, 0, Math.PI*2); ctx.fill(); ctx.stroke()
      }

      for (const [tid, t] of Object.entries(s.tanks)) {
        if (!t || t.alive === false) continue
        const tx = tid === myId ? s.myX : t.x
        const ty = tid === myId ? s.myY : t.y
        const tang = tid === myId ? s.myAngle : t.angle
        const tlv = tid === myId ? s.myLevel : (t.level || 1)
        const thp = tid === myId ? s.myHp : t.hp
        const tmax = tid === myId ? s.myMaxHp : t.maxHp
        ctx.save()
        ctx.translate(tx, ty)
        ctx.rotate(tang)
        ctx.fillStyle = '#666'
        ctx.strokeStyle = 'rgba(0,0,0,.5)'
        ctx.lineWidth = 2
        ctx.fillRect(0, -8, 36, 16)
        ctx.strokeRect(0, -8, 36, 16)
        ctx.restore()
        ctx.fillStyle = t.color
        ctx.strokeStyle = tid === myId ? '#fff' : 'rgba(0,0,0,.4)'
        ctx.lineWidth = tid === myId ? 4 : 3
        ctx.beginPath(); ctx.arc(tx, ty, 22, 0, Math.PI*2); ctx.fill(); ctx.stroke()
        if (thp < tmax) {
          ctx.fillStyle = 'rgba(0,0,0,.5)'
          ctx.fillRect(tx - 24, ty + 30, 48, 5)
          ctx.fillStyle = '#2ecc71'
          ctx.fillRect(tx - 24, ty + 30, 48*(thp/tmax), 5)
        }
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 13px var(--serif, serif)'
        ctx.textAlign = 'center'
        ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 3
        ctx.fillText(`${t.name} · Lv${tlv}`, tx, ty - 30)
        ctx.shadowBlur = 0
      }

      ctx.restore()

      setHud({ level: s.myLevel, xp: s.myXp, xpNeed: xpForLevel(s.myLevel), hp: Math.round(s.myHp), maxHp: s.myMaxHp, score: s.score })
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', onKD)
      window.removeEventListener('keyup', onKU)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mousedown', onDown)
      canvas.removeEventListener('mouseup', onUp)
    }
  }, [running, isHost])

  return (
    <main>
      <div className="dp-wrap">
        <div className="dp-top">
          <Link href="/games" className="btn btn-sm">← 게임 목록</Link>
          {phase === 'playing' && (
            <>
              <div className="dp-hud-stat"><span>Lv</span><strong>{hud.level}</strong></div>
              <div className="dp-hud-stat"><span>HP</span><strong>{hud.hp}/{hud.maxHp}</strong></div>
              <div className="dp-hud-stat"><span>Score</span><strong>{hud.score}</strong></div>
              {isHost && <div className="dp-hud-stat" style={{background:'rgba(52,152,219,.25)'}}><span>HOST</span></div>}
              <div className="dp-xp-bar"><div className="dp-xp-fill" style={{width:`${(hud.xp/hud.xpNeed)*100}%`}}/></div>
            </>
          )}
        </div>

        {phase === 'intro' && (
          <div className="dp-intro">
            <div className="dp-title">diep.io</div>
            <div className="dp-sub">실시간 멀티플레이 · 도형 부수고 탱크 전투</div>
            <input className="dp-input" placeholder="이름" value={name} onChange={e=>setName(e.target.value)} maxLength={16}/>
            <button className="dp-start" onClick={start}>플레이</button>
            <ul className="dp-rules">
              <li>WASD/방향키로 이동</li>
              <li>마우스 방향으로 포탑 회전</li>
              <li>클릭 또는 스페이스로 발사</li>
              <li>도형 파괴 → XP, 레벨업 시 자동 강화</li>
              <li>다른 플레이어 처치 시 큰 보상</li>
            </ul>
          </div>
        )}

        {phase === 'playing' && (
          <>
            <canvas ref={canvasRef} className="dp-canvas"/>
            <div className="dp-leaderboard">
              <div className="dp-lb-title">접속자 {aliveCount}명</div>
              {leaderboard.map((p, i) => (
                <div key={p.id} className="dp-lb-row" style={{color: p.id === myIdRef.current ? '#3498db' : '#fff'}}>
                  <span className="dp-lb-rank">{i+1}</span>
                  <span className="dp-lb-name">{p.name}</span>
                  <span className="dp-lb-mass">Lv{p.level||1}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {phase === 'over' && (
          <div className="dp-intro">
            <div className="dp-title" style={{color:'#e74c3c'}}>파괴됨</div>
            <div className="dp-sub">최종 점수: {hud.score} (Lv {hud.level})</div>
            <button className="dp-start" onClick={start}>다시 시작</button>
          </div>
        )}
      </div>

      <style>{`
        .dp-wrap{min-height:100vh;background:#1a2032;color:#fff;position:relative;overflow:hidden;}
        .dp-top{position:fixed;top:10px;left:60px;display:flex;gap:.6rem;align-items:center;z-index:50;flex-wrap:wrap;}
        .dp-hud-stat{background:rgba(0,0,0,.65);padding:.35rem .75rem;border-radius:6px;font-family:var(--mono);font-size:.75rem;display:flex;align-items:center;gap:.4rem;}
        .dp-hud-stat span{opacity:.6;}
        .dp-hud-stat strong{color:#c9a84c;font-weight:700;}
        .dp-xp-bar{flex:1;min-width:120px;max-width:240px;height:8px;background:rgba(0,0,0,.5);border-radius:4px;overflow:hidden;}
        .dp-xp-fill{height:100%;background:linear-gradient(90deg,#c9a84c,#f1c40f);transition:width .25s;}
        .dp-canvas{display:block;width:100%;height:100vh;cursor:crosshair;}
        .dp-intro{max-width:480px;margin:5vh auto;text-align:center;padding:2rem;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.1);border-radius:12px;}
        .dp-title{font-family:var(--serif);font-size:3rem;font-weight:700;color:#3498db;letter-spacing:.05em;margin-bottom:.4rem;}
        .dp-sub{font-family:var(--mono);font-size:.9rem;color:rgba(255,255,255,.7);margin-bottom:1.5rem;}
        .dp-input{width:100%;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.2);color:#fff;padding:.65rem .85rem;border-radius:8px;font-family:var(--serif);font-size:1rem;outline:none;margin-bottom:.75rem;text-align:center;}
        .dp-start{display:block;width:100%;padding:.75rem;background:linear-gradient(135deg,#3498db,#2980b9);color:#fff;border:none;border-radius:30px;font-family:var(--serif);font-weight:700;font-size:1rem;cursor:pointer;}
        .dp-rules{list-style:none;padding:0;text-align:left;margin-top:1rem;}
        .dp-rules li{font-size:.82rem;line-height:1.85;color:rgba(255,255,255,.7);}
        .dp-rules li::before{content:'·';color:#3498db;margin-right:.5rem;}
        .dp-leaderboard{position:fixed;top:10px;right:10px;background:rgba(0,0,0,.65);padding:.75rem 1rem;border-radius:8px;font-family:var(--mono);font-size:.78rem;min-width:180px;z-index:50;}
        .dp-lb-title{font-family:var(--serif);font-weight:700;margin-bottom:.4rem;color:#3498db;font-size:.85rem;}
        .dp-lb-row{display:flex;justify-content:space-between;gap:.6rem;padding:.18rem 0;}
        .dp-lb-rank{width:18px;color:rgba(255,255,255,.45);}
        .dp-lb-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .dp-lb-mass{color:rgba(255,255,255,.8);}
      `}</style>
    </main>
  )
}
