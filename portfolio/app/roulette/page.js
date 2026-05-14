'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

// 유럽식 룰렛 (0 + 1~36 = 37칸)
// 표준 휠 순서
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
const colorOf = (n) => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black')

const SECTOR = 360 / WHEEL.length
const sectorMid = (n) => {
  const idx = WHEEL.indexOf(n)
  return idx * SECTOR + SECTOR / 2
}

// 베팅 종류
const BET_TYPES = {
  red:    { label: '빨강',  pays: 1, test: (n) => n !== 0 && RED.has(n) },
  black:  { label: '검정',  pays: 1, test: (n) => n !== 0 && !RED.has(n) },
  even:   { label: '짝수',  pays: 1, test: (n) => n !== 0 && n % 2 === 0 },
  odd:    { label: '홀수',  pays: 1, test: (n) => n !== 0 && n % 2 === 1 },
  low:    { label: '1-18',  pays: 1, test: (n) => n >= 1 && n <= 18 },
  high:   { label: '19-36', pays: 1, test: (n) => n >= 19 && n <= 36 },
  dozen1: { label: '1-12',  pays: 2, test: (n) => n >= 1 && n <= 12 },
  dozen2: { label: '13-24', pays: 2, test: (n) => n >= 13 && n <= 24 },
  dozen3: { label: '25-36', pays: 2, test: (n) => n >= 25 && n <= 36 },
}

export default function RoulettePage() {
  const [chips, setChips]   = useState(1000)
  const [bets, setBets]     = useState({})  // { [key]: amount }  e.g. { red: 50, num_7: 25 }
  const [chipValue, setChipValue] = useState(25)
  const [angle, setAngle]   = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const audioRef = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem('roul_state')
    if (saved) {
      try {
        const s = JSON.parse(saved)
        if (typeof s.chips === 'number') setChips(s.chips)
        if (Array.isArray(s.history)) setHistory(s.history)
      } catch {}
    }
  }, [])
  useEffect(() => {
    localStorage.setItem('roul_state', JSON.stringify({ chips, history }))
  }, [chips, history])

  const beep = (freq = 660, dur = 60) => {
    try {
      if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)()
      const ctx = audioRef.current
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.type = 'triangle'; o.frequency.value = freq; g.gain.value = .03
      o.connect(g); g.connect(ctx.destination)
      o.start(); o.stop(ctx.currentTime + dur / 1000)
    } catch {}
  }

  const totalBet = Object.values(bets).reduce((s, v) => s + v, 0)

  const addBet = (key) => {
    if (spinning) return
    if (chips < chipValue) return
    setBets(b => ({ ...b, [key]: (b[key] || 0) + chipValue }))
    setChips(c => c - chipValue)
    beep(800, 40)
  }

  const clearBets = () => {
    if (spinning) return
    setChips(c => c + totalBet)
    setBets({})
  }

  const spin = () => {
    if (spinning) return
    if (totalBet === 0) return
    setSpinning(true); setResult(null)
    const winning = Math.floor(Math.random() * 37) // 0..36
    const targetMid = sectorMid(winning)
    // 5~7 바퀴 + 표적 각도. 휠 0도가 12시 방향이라 가정.
    const fullSpins = 5 + Math.floor(Math.random() * 3)
    const final = fullSpins * 360 + (360 - targetMid)
    setAngle(prev => prev + final)
    setTimeout(() => settle(winning), 4200)
  }

  const settle = (winning) => {
    let payout = 0
    for (const [key, amt] of Object.entries(bets)) {
      if (key.startsWith('num_')) {
        const n = parseInt(key.slice(4), 10)
        if (n === winning) payout += amt * 36 // 35:1 + 원금
      } else if (BET_TYPES[key]) {
        if (BET_TYPES[key].test(winning)) payout += amt * (BET_TYPES[key].pays + 1)
      }
    }
    setChips(c => c + payout)
    setResult({ winning, payout, profit: payout - totalBet, color: colorOf(winning) })
    setHistory(h => [winning, ...h].slice(0, 12))
    setBets({})
    setSpinning(false)
    beep(payout > 0 ? 1000 : 220, payout > 0 ? 200 : 120)
  }

  const resetAll = () => {
    if (!confirm('칩을 초기화하시겠습니까?')) return
    setChips(1000); setBets({}); setHistory([])
  }

  return (
    <main>
      <div className="rl-wrap">
        <div className="rl-top">
          <Link href="/games" className="btn btn-sm">← 게임 목록</Link>
          <div className="rl-stats">
            <div className="rl-stat"><span>칩</span><strong>${chips}</strong></div>
            <div className="rl-stat"><span>베팅</span><strong>${totalBet}</strong></div>
          </div>
          <button className="btn btn-sm" onClick={resetAll}>초기화</button>
        </div>

        <div className="rl-main">
          <div className="rl-wheel-col">
            <div className="rl-wheel-frame">
              <div className="rl-wheel" style={{transform:`rotate(${-angle}deg)`}}>
                {WHEEL.map((n, i) => {
                  const a = i * SECTOR
                  return (
                    <div key={n} className={`rl-sector ${colorOf(n)}`}
                      style={{transform: `rotate(${a}deg)`, '--sector': `${SECTOR}deg`}}>
                      <span style={{transform:`rotate(${SECTOR/2}deg) translateY(-80px) rotate(${-a-SECTOR/2}deg)`}}>{n}</span>
                    </div>
                  )
                })}
                <div className="rl-hub"/>
              </div>
              <div className="rl-pointer"/>
            </div>
            {result && (
              <div className={`rl-result ${result.profit>0?'win':result.profit<0?'lose':'draw'}`}>
                <div className="rl-result-num" style={{background: result.color==='red'?'#c0392b':result.color==='black'?'#1a1208':'#1a6e3a'}}>{result.winning}</div>
                <div className="rl-result-text">
                  {result.profit > 0 ? `+$${result.profit} 획득!` : result.profit === 0 ? '본전' : `$${-result.profit} 손실`}
                </div>
              </div>
            )}

            <div className="rl-history">
              <span className="rl-hist-label">최근:</span>
              {history.length === 0 && <span style={{color:'rgba(255,255,255,.3)',fontSize:'.72rem'}}>없음</span>}
              {history.map((n, i) => (
                <span key={i} className={`rl-hist-pill ${colorOf(n)}`}>{n}</span>
              ))}
            </div>
          </div>

          <div className="rl-bet-col">
            <div className="rl-chip-row">
              <span style={{color:'rgba(255,255,255,.6)',fontFamily:'var(--mono)',fontSize:'.72rem'}}>칩 단위:</span>
              {[10, 25, 50, 100, 250].map(v => (
                <button key={v} className={`rl-chip ${chipValue===v?'on':''}`} onClick={()=>setChipValue(v)} disabled={v>chips}>${v}</button>
              ))}
            </div>

            <div className="rl-grid">
              {/* 0 */}
              <button className="rl-cell rl-zero" onClick={()=>addBet('num_0')}>
                0{bets.num_0 ? <span className="rl-bet-tag">${bets.num_0}</span> : null}
              </button>
              {/* 1-36 */}
              <div className="rl-numbers">
                {Array.from({length: 36}, (_, i) => i+1).map(n => (
                  <button key={n} className={`rl-cell ${colorOf(n)}`} onClick={()=>addBet(`num_${n}`)}>
                    {n}{bets[`num_${n}`] ? <span className="rl-bet-tag">${bets[`num_${n}`]}</span> : null}
                  </button>
                ))}
              </div>
              <div className="rl-outside">
                {[['dozen1','1st 12'],['dozen2','2nd 12'],['dozen3','3rd 12']].map(([k,l])=>(
                  <button key={k} className="rl-cell rl-wide" onClick={()=>addBet(k)}>
                    {l}{bets[k] ? <span className="rl-bet-tag">${bets[k]}</span> : null}
                  </button>
                ))}
              </div>
              <div className="rl-outside">
                {[['low','1-18'],['even','짝'],['red','빨강'],['black','검정'],['odd','홀'],['high','19-36']].map(([k,l])=>(
                  <button key={k} className={`rl-cell rl-half ${k==='red'?'red':k==='black'?'black':''}`} onClick={()=>addBet(k)}>
                    {l}{bets[k] ? <span className="rl-bet-tag">${bets[k]}</span> : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="rl-actions">
              <button className="btn btn-sm" onClick={clearBets} disabled={spinning||totalBet===0}>베팅 취소</button>
              <button className="rl-spin" onClick={spin} disabled={spinning||totalBet===0}>
                {spinning ? '돌리는 중...' : '🎰 스핀'}
              </button>
            </div>
          </div>
        </div>

        <div className="rl-payout">
          <strong>배당</strong>
          <ul>
            <li>스트레이트 (단일 숫자): <b>35:1</b></li>
            <li>1-12 / 13-24 / 25-36 (다즌): <b>2:1</b></li>
            <li>빨강 / 검정 / 짝 / 홀 / 1-18 / 19-36: <b>1:1</b></li>
            <li>0은 외곽 베팅(빨강/검정/짝/홀 등)에서 모두 패배 — 하우스 엣지의 원천</li>
          </ul>
        </div>
      </div>

      <style>{`
        .rl-wrap{min-height:100vh;background:linear-gradient(180deg,#1a0c08,#0a0504);color:#fff;padding:1.25rem;}
        .rl-top{display:flex;justify-content:space-between;align-items:center;gap:.75rem;margin-bottom:1.25rem;flex-wrap:wrap;}
        .rl-stats{display:flex;gap:.75rem;}
        .rl-stat{background:rgba(255,255,255,.08);padding:.4rem .85rem;border-radius:4px;display:flex;flex-direction:column;align-items:center;}
        .rl-stat span{font-family:var(--mono);font-size:.62rem;color:rgba(255,255,255,.5);}
        .rl-stat strong{font-family:var(--mono);font-size:.88rem;color:#c9a84c;}

        .rl-main{display:grid;grid-template-columns:340px 1fr;gap:1.5rem;max-width:1100px;margin:0 auto;}
        @media(max-width:880px){.rl-main{grid-template-columns:1fr;}}

        .rl-wheel-frame{position:relative;width:300px;height:300px;margin:0 auto 1rem;}
        .rl-wheel{position:relative;width:300px;height:300px;border-radius:50%;background:#2a1a0a;border:6px solid #8b6f1f;box-shadow:inset 0 0 30px rgba(0,0,0,.7),0 8px 30px rgba(0,0,0,.5);transition:transform 4s cubic-bezier(.18,.6,.18,1);}
        .rl-sector{position:absolute;top:0;left:50%;width:1px;height:50%;transform-origin:bottom;}
        .rl-sector::before{content:'';position:absolute;left:-72px;top:0;width:144px;height:50px;clip-path:polygon(50% 0%, 100% 100%, 0% 100%);background:var(--c);}
        .rl-sector.red::before{--c:#c0392b;}
        .rl-sector.black::before{--c:#1a1208;}
        .rl-sector.green::before{--c:#1a6e3a;}
        .rl-sector span{position:absolute;left:50%;top:0;color:#fff;font-family:var(--mono);font-size:.62rem;font-weight:700;display:block;}
        .rl-hub{position:absolute;left:50%;top:50%;width:48px;height:48px;background:radial-gradient(circle,#c9a84c,#8b6f1f);border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 4px 12px rgba(0,0,0,.6);}
        .rl-pointer{position:absolute;top:-8px;left:50%;transform:translateX(-50%);width:0;height:0;border:14px solid transparent;border-top:22px solid #c9a84c;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5));z-index:5;}

        .rl-result{display:flex;align-items:center;gap:.75rem;justify-content:center;margin-bottom:.85rem;animation:rl-pop .3s ease;}
        .rl-result-num{width:54px;height:54px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-weight:700;font-size:1.4rem;color:#fff;box-shadow:0 4px 12px rgba(0,0,0,.4);}
        .rl-result-text{font-family:var(--mono);font-weight:700;}
        .rl-result.win .rl-result-text{color:#2ecc71;}
        .rl-result.lose .rl-result-text{color:#e74c3c;}
        @keyframes rl-pop{from{transform:scale(.85);opacity:0;}to{transform:scale(1);opacity:1;}}

        .rl-history{display:flex;align-items:center;gap:.3rem;flex-wrap:wrap;justify-content:center;}
        .rl-hist-label{font-family:var(--mono);font-size:.7rem;color:rgba(255,255,255,.5);margin-right:.3rem;}
        .rl-hist-pill{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;font-family:var(--mono);font-size:.65rem;font-weight:700;color:#fff;}
        .rl-hist-pill.red{background:#c0392b;}
        .rl-hist-pill.black{background:#1a1208;}
        .rl-hist-pill.green{background:#1a6e3a;}

        .rl-bet-col{display:flex;flex-direction:column;gap:1rem;}
        .rl-chip-row{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;}
        .rl-chip{padding:.4rem .85rem;border-radius:50px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);color:#fff;font-family:var(--mono);font-size:.75rem;font-weight:700;cursor:pointer;}
        .rl-chip.on{background:#c0392b;border-color:#c0392b;}
        .rl-chip:disabled{opacity:.3;cursor:not-allowed;}

        .rl-grid{background:#082208;border-radius:8px;padding:.75rem;border:2px solid #8b6f1f;display:grid;grid-template-columns:50px 1fr;grid-template-areas:'zero numbers' '. outside1' '. outside2';gap:.4rem;}
        .rl-zero{grid-area:zero;background:#1a6e3a !important;color:#fff;height:100%;}
        .rl-numbers{grid-area:numbers;display:grid;grid-template-columns:repeat(12,1fr);grid-auto-rows:36px;gap:3px;}
        .rl-outside:nth-of-type(2){grid-area:outside1;display:grid;grid-template-columns:repeat(3,1fr);gap:3px;}
        .rl-outside:nth-of-type(3){grid-area:outside2;display:grid;grid-template-columns:repeat(6,1fr);gap:3px;}
        .rl-cell{position:relative;background:#1a1208;color:#fff;border:1px solid rgba(255,255,255,.08);font-family:var(--mono);font-size:.75rem;font-weight:700;cursor:pointer;border-radius:3px;display:flex;align-items:center;justify-content:center;padding:0 .25rem;height:36px;}
        .rl-cell:hover{box-shadow:0 0 0 2px #c9a84c;}
        .rl-cell.red{background:#c0392b;}
        .rl-cell.black{background:#1a1208;}
        .rl-cell.green{background:#1a6e3a;}
        .rl-wide{font-size:.68rem;}
        .rl-half{font-size:.7rem;}
        .rl-bet-tag{position:absolute;top:-6px;right:-6px;background:#c9a84c;color:#1a1208;border-radius:10px;font-size:.55rem;padding:.05rem .35rem;border:2px solid #1a1208;font-weight:700;}

        .rl-actions{display:flex;gap:.5rem;justify-content:flex-end;}
        .rl-spin{padding:.65rem 1.5rem;border-radius:30px;background:linear-gradient(135deg,#c9a84c,#8b6f1f);border:none;color:#1a1208;font-family:var(--serif);font-weight:700;font-size:1rem;cursor:pointer;box-shadow:0 4px 14px rgba(201,168,76,.4);}
        .rl-spin:disabled{opacity:.4;cursor:not-allowed;}

        .rl-payout{margin-top:1.5rem;max-width:600px;margin-left:auto;margin-right:auto;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:1rem 1.25rem;}
        .rl-payout strong{font-family:var(--mono);font-size:.78rem;letter-spacing:.05em;color:#c9a84c;}
        .rl-payout ul{list-style:none;padding:0;margin-top:.4rem;}
        .rl-payout li{font-size:.78rem;color:rgba(255,255,255,.7);padding:.2rem 0;line-height:1.5;}
        .rl-payout li::before{content:'•';color:#c9a84c;margin-right:.5rem;}
      `}</style>
    </main>
  )
}
