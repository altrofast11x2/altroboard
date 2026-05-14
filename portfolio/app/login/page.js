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
  const [reactivate, setReactivate] = useState(null) // { uid, name, email, deletionScheduledAt }
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

    // 삭제 유예 중 → 재활성화 모달
    if (res.status === 202 && data.pendingDeletion) {
      setReactivate({ uid: data.uid, name: data.name, email: data.email, deletionScheduledAt: data.deletionScheduledAt })
      setLoading(false)
      return
    }
    if (data.error) {
      setError(data.suspended
        ? `이용이 정지된 계정입니다. 관리자에게 문의해주세요.${data.reason ? `\n사유: ${data.reason}` : ''}`
        : data.error)
      setLoading(false)
      return
    }
    localStorage.setItem('user', JSON.stringify(data.user))
    router.push('/')
  }

  const doSignup = async () => {
    if (!signup.name.trim())            { setError('닉네임을 입력해주세요'); return }
    if (!signup.email.trim())           { setError('이메일을 입력해주세요'); return }
    if (!EMAIL_RE.test(signup.email))   { setError('올바른 이메일 형식으로 입력해주세요'); return }
    if (signup.password.length < 8)     { setError('비밀번호를 8자 이상 입력해주세요'); return }
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

  const reactivateNow = async () => {
    if (!reactivate) return
    setLoading(true)
    const res = await fetch('/api/account/reactivate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: reactivate.uid }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || '재활성화 실패'); return }
    // 재활성화 후 다시 로그인 요청
    setReactivate(null)
    doLogin()
  }

  const logoutFromReactivate = () => {
    setReactivate(null)
    setLogin({ id: '', password: '' })
  }

  const fmtDate = (ts) => new Date(ts).toLocaleString('ko-KR')

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
            {error   && <div className="alert alert-error" style={{whiteSpace:'pre-line'}}>{error}</div>}
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
                <div style={{textAlign:'center',marginTop:'1rem',fontSize:'.78rem',fontFamily:'var(--mono)'}}>
                  <Link href="/recover" style={{color:'var(--accent)'}}>비밀번호 복구</Link>
                </div>
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
                  <label>비밀번호 <span style={{ color: 'var(--muted)', fontWeight: 300 }}>(영문+숫자 8자 이상)</span></label>
                  <input
                    type="password"
                    placeholder="비밀번호를 입력하세요 (영문+숫자 8자 이상)"
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

      {/* 재활성화 모달 */}
      {reactivate && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:8000,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
          <div className="card card-accent" style={{maxWidth:420,width:'100%'}}>
            <h3 style={{fontFamily:'var(--serif)',fontSize:'1.1rem',marginBottom:'.75rem',color:'var(--ink)'}}>
              계정이 삭제 예정입니다
            </h3>
            <p style={{fontSize:'.85rem',color:'var(--text)',lineHeight:1.7,marginBottom:'.85rem'}}>
              <strong>{reactivate.name}</strong> ({reactivate.email}) 계정은 삭제가 예약된 상태입니다.<br/>
              <span style={{color:'var(--accent)',fontFamily:'var(--mono)',fontSize:'.78rem'}}>
                삭제 예정 시각: {fmtDate(reactivate.deletionScheduledAt)}
              </span>
            </p>
            <p style={{fontSize:'.82rem',color:'var(--muted)',marginBottom:'1.25rem'}}>
              계정을 다시 활성화 하시겠습니까?<br/>
              아니면 그냥 로그아웃하면 예정대로 기간이 지난 뒤 삭제됩니다.
            </p>
            <div style={{display:'flex',gap:'.5rem',justifyContent:'flex-end'}}>
              <button className="btn btn-sm" onClick={logoutFromReactivate}>로그아웃하기</button>
              <button className="btn btn-primary btn-sm" onClick={reactivateNow} disabled={loading}>
                {loading ? '처리 중...' : '내 계정 활성화 하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
