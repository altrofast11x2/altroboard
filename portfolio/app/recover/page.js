'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function RecoverPage() {
  const router = useRouter()
  const [mode, setMode] = useState('oldPassword') // oldPassword | email
  const [oldF, setOldF] = useState({ email: '', oldPassword: '', newPassword: '' })
  const [emailF, setEmailF] = useState({ email: '' })
  const [tokenF, setTokenF] = useState({ uid: '', token: '', newPassword: '' })
  const [stage, setStage] = useState('input') // input | tokenInput | done
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [devToken, setDevToken] = useState(null)

  const submitOld = async () => {
    if (!oldF.email || !oldF.oldPassword || !oldF.newPassword) { setError('모든 항목을 입력하세요'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/account/recover', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'oldPassword', email: oldF.email, oldPassword: oldF.oldPassword, newPassword: oldF.newPassword }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || '복구 실패'); return }
    setSuccess('비밀번호가 변경되었습니다. 로그인해주세요.')
    setStage('done')
    setTimeout(() => router.push('/login'), 1500)
  }

  const submitEmail = async () => {
    if (!emailF.email) { setError('이메일을 입력하세요'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/account/recover', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'requestEmail', email: emailF.email }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || '요청 실패'); return }
    // 개발 단계: 토큰을 화면에 표시
    if (data._dev?.token) {
      setDevToken(data._dev)
      setTokenF({ uid: data._dev.uid, token: data._dev.token, newPassword: '' })
      setStage('tokenInput')
    } else {
      setSuccess('이메일이 등록되어 있다면 재설정 안내를 발송했습니다. (개발 환경에서는 직접 토큰을 받아 입력해주세요)')
    }
  }

  const submitToken = async () => {
    if (!tokenF.uid || !tokenF.token || !tokenF.newPassword) { setError('모든 항목을 입력하세요'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/account/recover', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'resetWithToken', uid: tokenF.uid, token: tokenF.token, newPassword: tokenF.newPassword }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || '재설정 실패'); return }
    setSuccess('비밀번호가 변경되었습니다. 로그인해주세요.')
    setStage('done')
    setTimeout(() => router.push('/login'), 1500)
  }

  return (
    <main>
      <div className="login-wrap">
        <div className="login-box">
          <h2 style={{fontFamily:'var(--serif)',fontSize:'1.3rem',fontWeight:700,color:'var(--ink)',marginBottom:'1rem'}}>비밀번호 복구</h2>

          {stage !== 'tokenInput' && stage !== 'done' && (
            <div className="tab-row">
              <button className={`tab-btn ${mode==='oldPassword'?'active':''}`} onClick={()=>setMode('oldPassword')}>예전 비밀번호로</button>
              <button className={`tab-btn ${mode==='email'?'active':''}`} onClick={()=>setMode('email')}>이메일로</button>
            </div>
          )}

          <div className="card card-accent">
            {error   && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {stage === 'input' && mode === 'oldPassword' && (
              <>
                <p style={{fontSize:'.78rem',color:'var(--muted)',marginBottom:'.85rem',lineHeight:1.6}}>
                  이전에 사용했던 비밀번호로 재설정합니다. 최근 3개까지 인정됩니다.
                </p>
                <div className="form-group">
                  <label>이메일</label>
                  <input type="email" value={oldF.email} onChange={e=>setOldF({...oldF, email: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>이전 비밀번호</label>
                  <input type="password" value={oldF.oldPassword} onChange={e=>setOldF({...oldF, oldPassword: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>새 비밀번호 <span style={{color:'var(--muted)',fontWeight:300}}>(영문+숫자 8자 이상)</span></label>
                  <input type="password" value={oldF.newPassword} onChange={e=>setOldF({...oldF, newPassword: e.target.value})} />
                </div>
                <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} onClick={submitOld} disabled={loading}>
                  {loading?'처리 중...':'비밀번호 변경'}
                </button>
              </>
            )}

            {stage === 'input' && mode === 'email' && (
              <>
                <p style={{fontSize:'.78rem',color:'var(--muted)',marginBottom:'.85rem',lineHeight:1.6}}>
                  이메일로 재설정 토큰을 발송합니다.<br/>
                  <span style={{color:'var(--accent)'}}>※ 개발 환경에서는 토큰이 화면에 직접 표시됩니다.</span>
                </p>
                <div className="form-group">
                  <label>이메일</label>
                  <input type="email" value={emailF.email} onChange={e=>setEmailF({email: e.target.value})} />
                </div>
                <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} onClick={submitEmail} disabled={loading}>
                  {loading?'처리 중...':'재설정 토큰 받기'}
                </button>
              </>
            )}

            {stage === 'tokenInput' && (
              <>
                <p style={{fontSize:'.78rem',color:'var(--muted)',marginBottom:'.85rem'}}>
                  발급된 토큰으로 새 비밀번호를 설정합니다.
                </p>
                {devToken && (
                  <div style={{background:'var(--surface2)',border:'1px solid var(--border)',padding:'.6rem .8rem',borderRadius:4,marginBottom:'.85rem',fontFamily:'var(--mono)',fontSize:'.72rem',wordBreak:'break-all'}}>
                    <strong>개발 토큰</strong><br/>
                    UID: {devToken.uid}<br/>
                    Token: {devToken.token}<br/>
                    만료: {new Date(devToken.expiresAt).toLocaleString('ko-KR')}
                  </div>
                )}
                <div className="form-group">
                  <label>UID</label>
                  <input value={tokenF.uid} onChange={e=>setTokenF({...tokenF, uid: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>토큰</label>
                  <input value={tokenF.token} onChange={e=>setTokenF({...tokenF, token: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>새 비밀번호</label>
                  <input type="password" value={tokenF.newPassword} onChange={e=>setTokenF({...tokenF, newPassword: e.target.value})} />
                </div>
                <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} onClick={submitToken} disabled={loading}>
                  {loading?'처리 중...':'비밀번호 재설정'}
                </button>
              </>
            )}
          </div>

          <p style={{textAlign:'center',marginTop:'1.25rem',fontSize:'.8rem',color:'var(--muted)',fontFamily:'var(--mono)'}}>
            <Link href="/login" style={{color:'var(--accent)'}}>← 로그인으로</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
