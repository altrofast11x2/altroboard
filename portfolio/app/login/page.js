'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LoginPage() {
  const [tab, setTab]       = useState('login')
  const [login, setLogin]   = useState({ id: '', password: '' })
  const [signup, setSignup] = useState({ name: '', email: '', password: '' })
  const [error, setError]   = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailErr, setEmailErr] = useState('')
  const router = useRouter()

  const validateEmail = (val) => {
    if (!val) { setEmailErr(''); return }
    if (!EMAIL_RE.test(val)) setEmailErr('올바른 이메일 형식으로 입력해주세요 (예: user@example.com)')
    else setEmailErr('')
  }

  const doLogin = async () => {
    if (!login.id.trim()) { setError('이메일을 입력해주세요'); return }
    if (!login.password)  { setError('비밀번호를 입력해주세요'); return }
    setLoading(true); setError('')
    const res  = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(login),
    })
    const data = await res.json()
    if (data.error) { setError(data.error); setLoading(false) }
    else { localStorage.setItem('user', JSON.stringify(data.user)); router.push('/') }
  }

  const doSignup = async () => {
    if (!signup.name.trim())            { setError('닉네임을 입력해주세요'); return }
    if (!signup.email.trim())           { setError('이메일을 입력해주세요'); return }
    if (!EMAIL_RE.test(signup.email))   { setError('올바른 이메일 형식으로 입력해주세요'); return }
    if (signup.password.length < 6)     { setError('비밀번호를 6자 이상 입력해주세요'); return }
    setLoading(true); setError(''); setSuccess('')
    const res  = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signup),
    })
    const data = await res.json()
    if (data.error) { setError(data.error); setLoading(false) }
    else { setSuccess('회원가입 완료! 로그인해주세요'); setTab('login'); setLoading(false) }
  }

  return (
    <main>
      <div className="login-wrap">
        <div className="login-box">
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--ink)' }}>
              {tab === 'login' ? '로그인' : '회원가입'}
            </h2>
          </div>

          <div className="tab-row">
            {[['login', '로그인'], ['signup', '회원가입']].map(([t, l]) => (
              <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`}
                onClick={() => { setTab(t); setError(''); setSuccess(''); setEmailErr('') }}>
                {l}
              </button>
            ))}
          </div>

          <div className="card card-accent">
            {error   && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {tab === 'login' ? (
              <>
                <div className="form-group">
                  <label>이메일</label>
                  <input
                    type="email"
                    placeholder="이메일을 입력하세요 (예: user@example.com)"
                    value={login.id}
                    onChange={e => setLogin({ ...login, id: e.target.value })}
                    onKeyDown={e => e.key === 'Enter' && doLogin()}
                  />
                </div>
                <div className="form-group">
                  <label>비밀번호</label>
                  <input
                    type="password"
                    placeholder="비밀번호를 입력하세요"
                    value={login.password}
                    onChange={e => setLogin({ ...login, password: e.target.value })}
                    onKeyDown={e => e.key === 'Enter' && doLogin()}
                  />
                </div>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={doLogin}
                  disabled={loading}
                >
                  {loading ? '로그인 중...' : '로그인'}
                </button>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label>닉네임</label>
                  <input
                    placeholder="사용할 닉네임을 입력하세요"
                    value={signup.name}
                    onChange={e => setSignup({ ...signup, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>이메일</label>
                  <input
                    type="email"
                    placeholder="이메일을 입력하세요 (예: user@example.com)"
                    value={signup.email}
                    onChange={e => { setSignup({ ...signup, email: e.target.value }); validateEmail(e.target.value) }}
                    style={emailErr ? { borderColor: 'var(--accent)' } : {}}
                  />
                  {emailErr && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontFamily: 'var(--mono)', marginTop: '0.25rem', display: 'block' }}>
                      ⚠ {emailErr}
                    </span>
                  )}
                </div>
                <div className="form-group">
                  <label>비밀번호 <span style={{ color: 'var(--muted)', fontWeight: 300 }}>(6자 이상)</span></label>
                  <input
                    type="password"
                    placeholder="비밀번호를 입력하세요 (6자 이상)"
                    value={signup.password}
                    onChange={e => setSignup({ ...signup, password: e.target.value })}
                    onKeyDown={e => e.key === 'Enter' && doSignup()}
                  />
                </div>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={doSignup}
                  disabled={loading || !!emailErr}
                >
                  {loading ? '처리 중...' : '회원가입'}
                </button>
              </>
            )}
          </div>

          <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.8rem', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
            <Link href="/" style={{ color: 'var(--accent)' }}>← 홈으로</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
