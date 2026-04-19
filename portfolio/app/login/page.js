'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [tab, setTab] = useState('login')
  const [login, setLogin] = useState({ id:'', password:'' })
  const [signup, setSignup] = useState({ name:'', email:'', password:'' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const doLogin = async () => {
    setLoading(true); setError('')
    const res = await fetch('/api/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(login) })
    const data = await res.json()
    if (data.error) { setError(data.error); setLoading(false) }
    else { localStorage.setItem('user', JSON.stringify(data.user)); router.push('/') }
  }

  const doSignup = async () => {
    setLoading(true); setError(''); setSuccess('')
    const res = await fetch('/api/signup', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(signup) })
    const data = await res.json()
    if (data.error) { setError(data.error); setLoading(false) }
    else { setSuccess('회원가입 완료! 로그인해주세요'); setTab('login'); setLoading(false) }
  }

  return (
    <main>
      <div className="login-wrap">
        <div className="login-box">
          <div style={{marginBottom:'1.5rem'}}>
            <h2 style={{fontFamily:'var(--serif)',fontSize:'1.3rem',fontWeight:700,color:'var(--ink)'}}>
              {tab==='login'?'로그인':'회원가입'}
            </h2>
          </div>

          <div className="tab-row">
            {[['login','로그인'],['signup','회원가입']].map(([t,l])=>(
              <button key={t} className={`tab-btn ${tab===t?'active':''}`} onClick={()=>{setTab(t);setError('');setSuccess('')}}>{l}</button>
            ))}
          </div>

          <div className="card card-accent">
            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {tab==='login' ? (
              <>
                <div className="form-group"><label>아이디</label><input placeholder="아이디 입력" value={login.id} onChange={e=>setLogin({...login,id:e.target.value})} onKeyDown={e=>e.key==='Enter'&&doLogin()} /></div>
                <div className="form-group"><label>비밀번호</label><input type="password" placeholder="비밀번호 입력" value={login.password} onChange={e=>setLogin({...login,password:e.target.value})} onKeyDown={e=>e.key==='Enter'&&doLogin()} /></div>
                <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} onClick={doLogin} disabled={loading}>{loading?'로그인 중...':'로그인'}</button>
              </>
            ) : (
              <>
                <div className="form-group"><label>닉네임</label><input placeholder="닉네임 입력" value={signup.name} onChange={e=>setSignup({...signup,name:e.target.value})} /></div>
                <div className="form-group"><label>이메일</label><input type="email" placeholder="이메일 입력" value={signup.email} onChange={e=>setSignup({...signup,email:e.target.value})} /></div>
                <div className="form-group"><label>비밀번호 (6자 이상)</label><input type="password" placeholder="비밀번호 입력" value={signup.password} onChange={e=>setSignup({...signup,password:e.target.value})} onKeyDown={e=>e.key==='Enter'&&doSignup()} /></div>
                <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} onClick={doSignup} disabled={loading}>{loading?'처리 중...':'회원가입'}</button>
              </>
            )}
          </div>
          <p style={{textAlign:'center',marginTop:'1.25rem',fontSize:'0.8rem',color:'var(--muted)',fontFamily:'var(--mono)'}}>
            <Link href="/" style={{color:'var(--accent)'}}>← 홈으로</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
