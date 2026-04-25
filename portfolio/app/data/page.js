'use client'
import { useState, useEffect } from 'react'

export default function DataPage() {
  const [weather, setWeather] = useState(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [cityInput, setCityInput] = useState('Seoul')
  const [github, setGithub] = useState(null)
  const [githubLoading, setGithubLoading] = useState(false)
  const [githubUser, setGithubUser] = useState('torvalds')
  const [exchange, setExchange] = useState(null)
  const [exchangeLoading, setExchangeLoading] = useState(false)

  const fetchWeather = async (c) => {
    setWeatherLoading(true)
    const res = await fetch(`/api/weather?city=${encodeURIComponent(c)}`)
    setWeather(await res.json())
    setWeatherLoading(false)
  }

  const fetchGithub = async (u) => {
    setGithubLoading(true)
    try { setGithub(await (await fetch(`https://api.github.com/users/${u}`)).json()) }
    catch { setGithub({ message:'불러오기 실패' }) }
    setGithubLoading(false)
  }

  const fetchExchange = async () => {
    setExchangeLoading(true)
    try {
      const d = await (await fetch('https://open.er-api.com/v6/latest/USD')).json()
      setExchange({ KRW:d.rates.KRW, JPY:d.rates.JPY, EUR:d.rates.EUR, CNY:d.rates.CNY, updated:d.time_last_update_utc })
    } catch { setExchange(null) }
    setExchangeLoading(false)
  }

  useEffect(() => { fetchWeather('Seoul'); fetchGithub('torvalds'); fetchExchange() }, [])

  const icons = {'맑음':'☀️','대체로 맑음':'🌤','약간 흐림':'⛅','흐림':'☁️','안개':'🌫','비':'🌧','눈':'❄️','소나기':'🌦','뇌우':'⛈'}

  return (
    <main>
      <div className="container">
        <div className="section-header">
          <h2>외부 데이터 연동</h2>
          <p>Open API 실시간 데이터</p>
        </div>

        <div className="data-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.25rem',marginBottom:'1.25rem'}}>
          {/* WEATHER */}
          <div className="card card-accent">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
              <div>
                <span className="badge badge-green" style={{marginBottom:'0.4rem',display:'block'}}>Open-Meteo</span>
                <strong style={{fontFamily:'var(--serif)'}}>날씨</strong>
              </div>
              <span style={{fontSize:'2rem'}}>{weather?.desc?icons[weather.desc]||'🌡':'🌡'}</span>
            </div>
            <div style={{display:'flex',gap:'0.5rem',marginBottom:'0.75rem'}}>
              <input style={{flex:1,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'2px',padding:'0.4rem 0.7rem',fontFamily:'var(--font)',fontSize:'0.82rem',color:'var(--text)',outline:'none'}}
                placeholder="도시명 (영어)" value={cityInput} onChange={e=>setCityInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&fetchWeather(cityInput)} />
              <button className="btn btn-primary btn-sm" onClick={()=>fetchWeather(cityInput)}>검색</button>
            </div>
            {weatherLoading ? <p style={{fontFamily:'var(--mono)',fontSize:'0.78rem',color:'var(--muted)'}}>불러오는 중...</p>
            : weather?.error ? <p style={{color:'var(--accent)',fontSize:'0.82rem'}}>{weather.error}</p>
            : weather && <>
              <div className="weather-temp">{weather.temp}°C</div>
              <div className="weather-city">{weather.desc} · {weather.name}, {weather.country}</div>
              <div style={{display:'flex',gap:'1rem',marginTop:'0.75rem'}}>
                <span style={{fontFamily:'var(--mono)',fontSize:'0.72rem',color:'var(--muted)'}}>💨 {weather.wind}km/h</span>
                <span style={{fontFamily:'var(--mono)',fontSize:'0.72rem',color:'var(--muted)'}}>💧 {weather.humidity}%</span>
              </div>
            </>}
          </div>

          {/* GITHUB */}
          <div className="card card-accent">
            <div style={{marginBottom:'1rem'}}>
              <span className="badge badge-green" style={{marginBottom:'0.4rem',display:'block'}}>GitHub API</span>
              <strong style={{fontFamily:'var(--serif)'}}>GitHub 유저</strong>
            </div>
            <div style={{display:'flex',gap:'0.5rem',marginBottom:'0.75rem'}}>
              <input style={{flex:1,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'2px',padding:'0.4rem 0.7rem',fontFamily:'var(--font)',fontSize:'0.82rem',color:'var(--text)',outline:'none'}}
                placeholder="유저네임" value={githubUser} onChange={e=>setGithubUser(e.target.value)} onKeyDown={e=>e.key==='Enter'&&fetchGithub(githubUser)} />
              <button className="btn btn-primary btn-sm" onClick={()=>fetchGithub(githubUser)}>검색</button>
            </div>
            {githubLoading ? <p style={{fontFamily:'var(--mono)',fontSize:'0.78rem',color:'var(--muted)'}}>불러오는 중...</p>
            : github?.message ? <p style={{color:'var(--accent)',fontSize:'0.82rem'}}>{github.message}</p>
            : github && (
              <div style={{display:'flex',gap:'0.85rem',alignItems:'flex-start'}}>
                <img src={github.avatar_url} alt="" style={{width:'56px',height:'56px',borderRadius:'50%',border:'2px solid var(--border)'}} />
                <div>
                  <div style={{fontWeight:500,marginBottom:'0.2rem'}}>{github.name||github.login}</div>
                  <div style={{fontSize:'0.78rem',color:'var(--muted)',marginBottom:'0.5rem'}}>{github.bio||'소개 없음'}</div>
                  <div style={{display:'flex',gap:'1rem'}}>
                    <span style={{fontFamily:'var(--mono)',fontSize:'0.72rem'}}><b>{github.public_repos}</b> repos</span>
                    <span style={{fontFamily:'var(--mono)',fontSize:'0.72rem'}}><b>{github.followers}</b> followers</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* EXCHANGE */}
        <div className="card card-accent">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.25rem',flexWrap:'wrap',gap:'0.5rem'}}>
            <div>
              <span className="badge badge-green" style={{marginBottom:'0.4rem',display:'block'}}>Open Exchange Rates</span>
              <strong style={{fontFamily:'var(--serif)'}}>환율 (기준: 1 USD)</strong>
            </div>
            <button className="btn btn-sm" onClick={fetchExchange}>새로고침</button>
          </div>
          {exchangeLoading ? <p style={{fontFamily:'var(--mono)',fontSize:'0.78rem',color:'var(--muted)'}}>불러오는 중...</p>
          : exchange && <>
            <div className="data-stats-grid" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'0.75rem'}}>
              {[['KRW','한국 원','₩',0],['JPY','일본 엔','¥',2],['EUR','유로','€',2],['CNY','위안','¥',2]].map(([code,name,sym,dp])=>(
                <div key={code} style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'2px',padding:'0.85rem'}}>
                  <div style={{fontFamily:'var(--mono)',fontSize:'0.68rem',color:'var(--muted)',marginBottom:'0.3rem'}}>1 USD =</div>
                  <div style={{fontFamily:'var(--serif)',fontSize:'1.3rem',fontWeight:700}}>{sym}{exchange[code].toFixed(dp)}</div>
                  <div style={{fontSize:'0.75rem',color:'var(--muted)',marginTop:'0.2rem'}}>{name}</div>
                </div>
              ))}
            </div>
            <p style={{fontFamily:'var(--mono)',fontSize:'0.68rem',color:'var(--muted)',marginTop:'0.75rem'}}>{exchange.updated}</p>
          </>}
        </div>
      </div>
    
      <style>{`@media(max-width:640px){:root{--data-cols:1fr!important;--stats-cols:repeat(2,1fr)!important;}}`}</style>
    </main>
  )
}