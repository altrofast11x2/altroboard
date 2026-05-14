'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'

// 표준 블랙잭 — 6덱(312장). 딜러 17 스탠드. 더블/스플릿 미지원 (간단 버전).
const SUITS = ['♠', '♥', '♦', '♣']
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

const newShoe = (decks = 6) => {
  const cards = []
  for (let d = 0; d < decks; d++) {
    for (const s of SUITS) for (const r of RANKS) cards.push({ s, r })
  }
  // Fisher-Yates
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[cards[i], cards[j]] = [cards[j], cards[i]]
  }
  return cards
}

const cardValue = (r) => (r === 'A' ? 11 : ['J', 'Q', 'K'].includes(r) ? 10 : parseInt(r, 10))

const handTotal = (hand) => {
  let total = hand.reduce((s, c) => s + cardValue(c.r), 0)
  let aces = hand.filter(c => c.r === 'A').length
  while (total > 21 && aces > 0) { total -= 10; aces -= 1 }
  return total
}

const isBlackjack = (hand) => hand.length === 2 && handTotal(hand) === 21

const cardColor = (c) => (c.s === '♥' || c.s === '♦' ? '#e74c3c' : '#1a1208')

export default function BlackjackPage() {
  const [chips, setChips]     = useState(1000)
  const [bet, setBet]         = useState(50)
  const [shoe, setShoe]       = useState([])
  const [player, setPlayer]   = useState([])
  const [dealer, setDealer]   = useState([])
  const [phase, setPhase]     = useState('bet')   // bet | player | dealer | settled
  const [result, setResult]   = useState('')
  const [stats, setStats]     = useState({ wins: 0, losses: 0, pushes: 0, plays: 0 })
  const [dealerHide, setDealerHide] = useState(true)
  const audioCtx = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem('bj_state')
    if (saved) {
      try {
        const s = JSON.parse(saved)
        if (typeof s.chips === 'number') setChips(s.chips)
        if (s.stats) setStats(s.stats)
      } catch {}
    }
    setShoe(newShoe(6))
  }, [])

  useEffect(() => {
    localStorage.setItem('bj_state', JSON.stringify({ chips, stats }))
  }, [chips, stats])

  const beep = (freq = 660, dur = 80) => {
    try {
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)()
      const ctx = audioCtx.current
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'triangle'
      o.frequency.value = freq
      g.gain.value = 0.05
      o.connect(g); g.connect(ctx.destination)
      o.start()
      o.stop(ctx.currentTime + dur / 1000)
    } catch {}
  }

  const ensureShoe = () => {
    if (shoe.length < 30) { setShoe(newShoe(6)); return newShoe(6) }
    return shoe
  }

  const deal = () => {
    if (bet < 10 || bet > chips) return
    const s = ensureShoe().slice()
    const p = [s.shift(), s.shift()]
    const d = [s.shift(), s.shift()]
    setPlayer(p); setDealer(d); setShoe(s)
    setChips(c => c - bet)
    setResult(''); setDealerHide(true)
    beep(880, 60)
    // 즉시 블랙잭 체크
    if (isBlackjack(p) || isBlackjack(d)) {
      setTimeout(() => settle(p, d, s), 600)
      setPhase('dealer')
    } else {
      setPhase('player')
    }
  }

  const hit = () => {
    if (phase !== 'player') return
    const s = shoe.slice()
    const card = s.shift()
    const np = [...player, card]
    setShoe(s); setPlayer(np)
    beep(700, 50)
    const total = handTotal(np)
    if (total > 21) {
      // 버스트 → 즉시 결과
      setPhase('settled')
      setDealerHide(false)
      setStats(st => ({ ...st, losses: st.losses + 1, plays: st.plays + 1 }))
      setResult('💀 버스트! 패배')
      beep(220, 200)
    } else if (total === 21) {
      stand(np, s)
    }
  }

  const stand = (handOverride, shoeOverride) => {
    if (phase !== 'player' && !handOverride) return
    const p = handOverride || player
    let s = (shoeOverride || shoe).slice()
    let d = [...dealer]
    setPhase('dealer')
    setDealerHide(false)
    // 딜러 17 스탠드
    const draw = () => {
      const dt = handTotal(d)
      if (dt < 17) {
        d.push(s.shift())
        setDealer([...d]); setShoe([...s])
        beep(600, 50)
        setTimeout(draw, 500)
      } else {
        setTimeout(() => settle(p, d, s), 400)
      }
    }
    setTimeout(draw, 600)
  }

  const settle = (p, d, s) => {
    const pt = handTotal(p), dt = handTotal(d)
    const pBJ = isBlackjack(p), dBJ = isBlackjack(d)
    let outcome = '', payout = 0
    if (pBJ && dBJ) { outcome = '🤝 둘 다 블랙잭 - 무승부'; payout = bet }
    else if (pBJ)   { outcome = '🎉 블랙잭! 3:2 승리'; payout = Math.floor(bet * 2.5) }
    else if (dBJ)   { outcome = '💔 딜러 블랙잭 - 패배'; payout = 0 }
    else if (pt > 21) { outcome = '💀 버스트 - 패배'; payout = 0 }
    else if (dt > 21) { outcome = '🎉 딜러 버스트 - 승리'; payout = bet * 2 }
    else if (pt > dt) { outcome = `🎉 ${pt} vs ${dt} - 승리`; payout = bet * 2 }
    else if (pt < dt) { outcome = `💔 ${pt} vs ${dt} - 패배`; payout = 0 }
    else { outcome = `🤝 ${pt} vs ${dt} - 무승부`; payout = bet }

    setChips(c => c + payout)
    setResult(outcome)
    setPhase('settled')
    setShoe(s)
    setStats(st => ({
      wins: st.wins + (payout > bet ? 1 : 0),
      losses: st.losses + (payout === 0 ? 1 : 0),
      pushes: st.pushes + (payout === bet && payout !== 0 ? 1 : 0),
      plays: st.plays + 1,
    }))
    beep(payout > bet ? 1000 : payout === 0 ? 220 : 440, payout > bet ? 200 : 120)
  }

  const nextRound = () => {
    setPlayer([]); setDealer([])
    setResult(''); setPhase('bet')
    setDealerHide(true)
  }

  const resetChips = () => {
    if (!confirm('칩을 초기화하시겠습니까?')) return
    setChips(1000); setStats({ wins: 0, losses: 0, pushes: 0, plays: 0 })
    nextRound()
  }

  const pTotal = handTotal(player)
  const dTotalVisible = dealerHide && dealer.length >= 1 ? cardValue(dealer[0].r) : handTotal(dealer)

  return (
    <main>
      <div className="bj-wrap">
        <div className="bj-top">
          <Link href="/games" className="btn btn-sm">← 게임 목록</Link>
          <div className="bj-stats">
            <div className="bj-stat"><span>칩</span><strong>${chips}</strong></div>
            <div className="bj-stat"><span>승</span><strong>{stats.wins}</strong></div>
            <div className="bj-stat"><span>패</span><strong>{stats.losses}</strong></div>
            <div className="bj-stat"><span>무</span><strong>{stats.pushes}</strong></div>
          </div>
          <button className="btn btn-sm" onClick={resetChips}>초기화</button>
        </div>

        <div className="bj-table">
          <div className="bj-area">
            <div className="bj-label">딜러 {phase!=='bet' && (
              <span className="bj-total">{dealerHide ? '?' : dTotalVisible}</span>
            )}</div>
            <div className="bj-hand">
              {dealer.map((c, i) => (
                <div key={i} className={`bj-card ${dealerHide && i===1 ? 'flip' : ''}`} style={{color: cardColor(c)}}>
                  {dealerHide && i === 1 ? (
                    <div className="bj-back">CB</div>
                  ) : (
                    <><span className="bj-rank">{c.r}</span><span className="bj-suit">{c.s}</span></>
                  )}
                </div>
              ))}
              {dealer.length === 0 && <div className="bj-empty">대기 중</div>}
            </div>
          </div>

          <div className="bj-center">
            {phase === 'bet' && (
              <div className="bj-bet">
                <div style={{fontFamily:'var(--mono)',fontSize:'.85rem',color:'rgba(255,255,255,.6)',marginBottom:'.5rem'}}>베팅 금액</div>
                <div style={{display:'flex',gap:'.4rem',justifyContent:'center',flexWrap:'wrap',marginBottom:'.6rem'}}>
                  {[10, 25, 50, 100, 250].map(n => (
                    <button key={n} className={`bj-chip ${bet===n?'on':''}`} onClick={()=>setBet(n)} disabled={n>chips}>${n}</button>
                  ))}
                </div>
                <input type="number" min={10} max={chips} value={bet}
                  onChange={e=>setBet(Math.min(chips, Math.max(10, parseInt(e.target.value)||10)))}
                  style={{width:120,background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.2)',color:'#fff',padding:'.4rem .6rem',borderRadius:4,fontFamily:'var(--mono)',outline:'none',textAlign:'center'}}/>
                <button className="bj-deal" onClick={deal} disabled={bet<10||bet>chips}>딜!</button>
              </div>
            )}
            {result && phase === 'settled' && (
              <div className="bj-result">{result}</div>
            )}
            {phase === 'player' && (
              <div className="bj-actions">
                <button className="bj-action hit" onClick={hit}>HIT</button>
                <button className="bj-action stand" onClick={() => stand()}>STAND</button>
              </div>
            )}
            {phase === 'settled' && (
              <button className="bj-deal" onClick={nextRound}>다시</button>
            )}
          </div>

          <div className="bj-area">
            <div className="bj-label">플레이어 {phase!=='bet' && (
              <span className="bj-total">{pTotal}</span>
            )}</div>
            <div className="bj-hand">
              {player.map((c, i) => (
                <div key={i} className="bj-card" style={{color: cardColor(c)}}>
                  <span className="bj-rank">{c.r}</span><span className="bj-suit">{c.s}</span>
                </div>
              ))}
              {player.length === 0 && <div className="bj-empty">대기 중</div>}
            </div>
          </div>
        </div>

        <div className="bj-rules">
          <strong>규칙</strong>
          <ul>
            <li>딜러는 17 이상에서 스탠드. 16 이하면 계속 받음.</li>
            <li>블랙잭(첫 2장 21)은 3:2 (베팅 ×1.5 추가).</li>
            <li>HIT으로 카드 추가, STAND로 종료. 21 초과 시 버스트.</li>
            <li>A는 1 또는 11, J/Q/K 는 10. 슈는 6덱.</li>
          </ul>
        </div>
      </div>

      <style>{`
        .bj-wrap{min-height:100vh;background:linear-gradient(180deg,#0b3d0b,#082a08);padding:1.25rem;color:#fff;}
        .bj-top{display:flex;justify-content:space-between;align-items:center;gap:.75rem;margin-bottom:1rem;flex-wrap:wrap;}
        .bj-stats{display:flex;gap:.75rem;flex-wrap:wrap;}
        .bj-stat{background:rgba(255,255,255,.08);padding:.4rem .75rem;border-radius:4px;display:flex;flex-direction:column;align-items:center;min-width:60px;}
        .bj-stat span{font-family:var(--mono);font-size:.62rem;color:rgba(255,255,255,.5);}
        .bj-stat strong{font-family:var(--mono);font-size:.88rem;color:#fff;}
        .bj-table{background:radial-gradient(ellipse at center,#1e6f1e,#0b3d0b);border-radius:200px/100px;padding:2.5rem 1.5rem;margin:0 auto;max-width:880px;box-shadow:inset 0 0 60px rgba(0,0,0,.5),0 8px 30px rgba(0,0,0,.5);}
        .bj-area{margin:.5rem 0;}
        .bj-label{font-family:var(--mono);font-size:.85rem;color:rgba(255,255,255,.65);margin-bottom:.5rem;display:flex;align-items:center;gap:.6rem;}
        .bj-total{background:rgba(255,255,255,.15);padding:.15rem .5rem;border-radius:10px;font-weight:700;}
        .bj-hand{display:flex;gap:.6rem;justify-content:center;min-height:120px;align-items:center;flex-wrap:wrap;}
        .bj-card{width:80px;height:112px;background:#fff;border-radius:8px;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:var(--serif);font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,.4);animation:bj-in .3s ease both;}
        .bj-rank{font-size:1.6rem;line-height:1;}
        .bj-suit{font-size:1.8rem;line-height:1;}
        .bj-back{background:repeating-linear-gradient(45deg,#7b1a12,#7b1a12 6px,#a02d22 6px,#a02d22 12px);width:100%;height:100%;border-radius:8px;color:rgba(255,255,255,.4);display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:1.3rem;font-weight:700;}
        .bj-empty{color:rgba(255,255,255,.3);font-family:var(--mono);font-size:.75rem;}
        @keyframes bj-in{from{transform:translateY(-30px) rotate(-10deg);opacity:0;}to{transform:none;opacity:1;}}
        .bj-center{margin:1.5rem 0;display:flex;flex-direction:column;align-items:center;gap:.75rem;}
        .bj-bet{display:flex;flex-direction:column;align-items:center;gap:.5rem;}
        .bj-chip{padding:.55rem 1rem;border-radius:50px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);color:#fff;font-family:var(--mono);font-size:.78rem;font-weight:700;cursor:pointer;}
        .bj-chip:hover{background:rgba(255,255,255,.15);}
        .bj-chip.on{background:#c0392b;border-color:#c0392b;}
        .bj-chip:disabled{opacity:.3;cursor:not-allowed;}
        .bj-deal{margin-top:.5rem;padding:.7rem 2rem;border-radius:30px;background:linear-gradient(135deg,#c9a84c,#a08735);border:none;color:#fff;font-family:var(--serif);font-weight:700;font-size:1rem;cursor:pointer;letter-spacing:.05em;box-shadow:0 4px 14px rgba(201,168,76,.4);}
        .bj-deal:hover{transform:translateY(-1px);}
        .bj-deal:disabled{opacity:.4;cursor:not-allowed;}
        .bj-actions{display:flex;gap:.75rem;}
        .bj-action{padding:.7rem 1.8rem;border-radius:30px;border:none;color:#fff;font-family:var(--serif);font-weight:700;font-size:.92rem;cursor:pointer;letter-spacing:.05em;}
        .bj-action.hit{background:linear-gradient(135deg,#52b788,#379070);}
        .bj-action.stand{background:linear-gradient(135deg,#c0392b,#7b1a12);}
        .bj-action:hover{transform:translateY(-1px);}
        .bj-result{font-family:var(--serif);font-size:1.4rem;font-weight:700;padding:.5rem 1.25rem;background:rgba(0,0,0,.4);border-radius:6px;animation:bj-pop .3s ease;}
        @keyframes bj-pop{from{transform:scale(.85);opacity:0;}to{transform:scale(1);opacity:1;}}
        .bj-rules{margin-top:1.5rem;max-width:600px;margin-left:auto;margin-right:auto;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:1rem 1.25rem;}
        .bj-rules strong{font-family:var(--mono);font-size:.78rem;letter-spacing:.05em;color:#c9a84c;}
        .bj-rules ul{list-style:none;padding:0;margin-top:.4rem;}
        .bj-rules li{font-size:.78rem;color:rgba(255,255,255,.7);padding:.2rem 0;line-height:1.5;}
        .bj-rules li::before{content:'•';color:#c9a84c;margin-right:.5rem;}
      `}</style>
    </main>
  )
}
