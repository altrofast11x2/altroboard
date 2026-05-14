'use client'
import { useState, useEffect } from 'react'

export default function DataPage() {
  // GitHub 컨트리뷰션
  const [ghUser, setGhUser]       = useState('altrofast11x2')
  const [ghInput, setGhInput]     = useState('altrofast11x2')
  const [contrib, setContrib]     = useState(null)
  const [contribLoad, setContribLoad] = useState(false)
  const [contribErr, setContribErr]   = useState('')

  // 날씨
  const [weather, setWeather]               = useState(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [cityInput, setCityInput]           = useState('Seoul')

  // 환율
  const [exchange, setExchange]               = useState(null)
  const [exchangeLoading, setExchangeLoading] = useState(false)

  const fetchContrib = async (u) => {
    setContribLoad(true); setContribErr('')
    try {
      const res = await fetch(`/api/github-contributions?username=${encodeURIComponent(u)}`)
      const data = await res.json()
      if (!res.ok) { setContribErr(data.error || '불러오기 실패'); setContrib(null) }
      else { setContrib(data); setGhUser(u) }
    } catch { setContribErr('네트워크 오류'); setContrib(null) }
    setContribLoad(false)
  }

  const fetchWeather = async (c) => {
    setWeatherLoading(true)
    try {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(c)}`)
      setWeather(await res.json())
    } catch { setWeather({ error: '불러오기 실패' }) }
    setWeatherLoading(false)
  }

  const fetchExchange = async () => {
    setExchangeLoading(true)
    try {
      const d = await (await fetch('https://open.er-api.com/v6/latest/USD')).json()
      setExchange({ KRW: d.rates.KRW, JPY: d.rates.JPY, EUR: d.rates.EUR, CNY: d.rates.CNY, updated: d.time_last_update_utc })
    } catch { setExchange(null) }
    setExchangeLoading(false)
  }

  useEffect(() => {
    fetchContrib('altrofast11x2')
    fetchWeather('Seoul')
    fetchExchange()
  }, [])

  const icons = { '맑음': '☀️', '대체로 맑음': '🌤', '약간 흐림': '⛅', '흐림': '☁️', '안개': '🌫', '비': '🌧', '눈': '❄️', '소나기': '🌦', '뇌우': '⛈' }

  const levelColor = (level) => {
    if (level === 0) return '#ebedf0'
    if (level === 1) return '#9be9a8'
    if (level === 2) return '#40c463'
    if (level === 3) return '#30a14e'
    return '#216e39'
  }

  const fmtDate = (d) => new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })

  return (
    <main>
      <div className="container">
        <div className="section-header">
          <h2>외부 데이터 연동</h2>
          <p>GitHub 컨트리뷰션, 날씨, 환율을 한눈에</p>
        </div>

        {/* GITHUB CONTRIBUTIONS */}
        <div className="card card-accent" style={{marginBottom:'1.25rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'1rem',flexWrap:'wrap',marginBottom:'1rem'}}>
            <div>
              <span className="badge badge-green" style={{marginBottom:'.4rem',display:'inline-block'}}>GitHub Contributions</span>
              <div style={{fontFamily:'var(--serif)',fontSize:'1.1rem',fontWeight:700,color:'var(--ink)'}}>GitHub 1년 활동</div>
              {contrib && <div style={{fontFamily:'var(--mono)',fontSize:'.78rem',color:'var(--muted)',marginTop:'.25rem'}}>
                @{contrib.username} · 최근 1년 <strong style={{color:'var(--accent)'}}>{(contrib.total || 0).toLocaleString()}</strong> 컨트리뷰션
              </div>}
            </div>
            <div style={{display:'flex',gap:'.4rem'}}>
              <input style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:2,padding:'.4rem .7rem',fontSize:'.82rem',outline:'none',width:160}}
                value={ghInput} onChange={e=>setGhInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&fetchContrib(ghInput)} placeholder="GitHub 사용자명"/>
              <button className="btn btn-primary btn-sm" onClick={()=>fetchContrib(ghInput)} disabled={contribLoad||!ghInput.trim()}>
                {contribLoad ? '...' : '조회'}
              </button>
            </div>
          </div>

          {contribErr && <div className="alert alert-error" style={{marginBottom:'1rem'}}>{contribErr}</div>}

          {contribLoad ? (
            <div style={{padding:'2.5rem',textAlign:'center',color:'var(--muted)',fontFamily:'var(--mono)',fontSize:'.82rem'}}>불러오는 중...</div>
          ) : contrib && contrib.weeks?.length > 0 ? (
            <div className="contrib-wrap">
              <div className="contrib-grid" style={{gridTemplateColumns:`repeat(${contrib.weeks.length}, minmax(0, 1fr))`}}>
                {contrib.weeks.map((week, wi) => (
                  <div key={wi} className="contrib-col">
                    {week.map((day, di) => (
                      <div key={di}
                        className="contrib-cell"
                        title={day ? `${day.date} · ${day.count ?? 0} 컨트리뷰션` : ''}
                        style={{background: day ? levelColor(day.level) : 'transparent'}}/>
                    ))}
                  </div>
                ))}
              </div>
              <div className="contrib-legend">
                <span>Less</span>
                {[0,1,2,3,4].map(l => <div key={l} className="contrib-cell contrib-cell-fixed" style={{background:levelColor(l)}}/>)}
                <span>More</span>
              </div>
              <p style={{fontFamily:'var(--mono)',fontSize:'.65rem',color:'var(--muted)',marginTop:'.5rem'}}>
                * github.com 의 공개 페이지에서 파싱 — 비공개 리포지토리는 포함되지 않습니다.
              </p>
            </div>
          ) : (
            <div style={{padding:'1rem',color:'var(--muted)',fontFamily:'var(--mono)',fontSize:'.82rem'}}>데이터가 없습니다.</div>
          )}
        </div>

        <div className="data-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.25rem',marginBottom:'1.25rem'}}>
          {/* WEATHER */}
          <div className="card card-accent">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
              <div>
                <span className="badge badge-green" style={{marginBottom:'.4rem',display:'block'}}>Open-Meteo</span>
                <strong style={{fontFamily:'var(--serif)'}}>날씨</strong>
              </div>
              <span style={{fontSize:'2rem'}}>{weather?.desc?icons[weather.desc]||'🌡':'🌡'}</span>
            </div>
            <div style={{display:'flex',gap:'.5rem',marginBottom:'.75rem'}}>
              <input style={{flex:1,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:2,padding:'.4rem .7rem',fontSize:'.82rem',outline:'none'}}
                placeholder="도시명 (영어)" value={cityInput} onChange={e=>setCityInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&fetchWeather(cityInput)} />
              <button className="btn btn-primary btn-sm" onClick={()=>fetchWeather(cityInput)}>검색</button>
            </div>
            {weatherLoading ? <p style={{fontFamily:'var(--mono)',fontSize:'.78rem',color:'var(--muted)'}}>불러오는 중...</p>
            : weather?.error ? <p style={{color:'var(--accent)',fontSize:'.82rem'}}>{weather.error}</p>
            : weather && <>
              <div className="weather-temp">{weather.temp}°C</div>
              <div className="weather-city">{weather.desc} · {weather.name}, {weather.country}</div>
              <div style={{display:'flex',gap:'1rem',marginTop:'.75rem'}}>
                <span style={{fontFamily:'var(--mono)',fontSize:'.72rem',color:'var(--muted)'}}>💨 {weather.wind}km/h</span>
                <span style={{fontFamily:'var(--mono)',fontSize:'.72rem',color:'var(--muted)'}}>💧 {weather.humidity}%</span>
              </div>
            </>}
          </div>

          {/* EXCHANGE */}
          <div className="card card-accent">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
              <div>
                <span className="badge badge-green" style={{marginBottom:'.4rem',display:'block'}}>Open Exchange Rates</span>
                <strong style={{fontFamily:'var(--serif)'}}>환율 (1 USD)</strong>
              </div>
              <button className="btn btn-sm" onClick={fetchExchange}>↻</button>
            </div>
            {exchangeLoading ? <p style={{fontFamily:'var(--mono)',fontSize:'.78rem',color:'var(--muted)'}}>불러오는 중...</p>
            : exchange && (
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'.5rem'}}>
                {[['KRW','₩',0],['JPY','¥',2],['EUR','€',2],['CNY','¥',2]].map(([code,sym,dp])=>(
                  <div key={code} style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:2,padding:'.55rem .7rem'}}>
                    <div style={{fontFamily:'var(--mono)',fontSize:'.65rem',color:'var(--muted)'}}>1 USD</div>
                    <div style={{fontFamily:'var(--serif)',fontSize:'1rem',fontWeight:700}}>{sym}{exchange[code].toFixed(dp)}</div>
                    <div style={{fontSize:'.7rem',color:'var(--muted)'}}>{code}</div>
                  </div>
                ))}
              </div>
            )}
            {exchange && <p style={{fontFamily:'var(--mono)',fontSize:'.62rem',color:'var(--muted)',marginTop:'.75rem'}}>{exchange.updated}</p>}
          </div>
        </div>
      </div>

      <style>{`
        .contrib-wrap{width:100%;overflow-x:auto;}
        .contrib-grid{display:grid;grid-auto-flow:column;gap:3px;padding:.5rem 0;min-width:600px;}
        .contrib-col{display:grid;grid-template-rows:repeat(7,1fr);gap:3px;}
        .contrib-cell{aspect-ratio:1/1;width:100%;min-width:10px;border-radius:2px;border:1px solid rgba(27,31,35,.06);}
        .contrib-cell-fixed{width:12px;height:12px;aspect-ratio:auto;}
        .contrib-legend{display:flex;align-items:center;gap:4px;justify-content:flex-end;font-family:var(--mono);font-size:.7rem;color:var(--muted);margin-top:.4rem;}
        @media(max-width:640px){.data-grid{grid-template-columns:1fr!important;}}
      `}</style>
    </main>
  )
}
