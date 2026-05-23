'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const LANGS = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
]
const THEMES = [
  { value: 'light', label: '라이트' },
  { value: 'dark',  label: '다크' },
  { value: 'auto',  label: '시스템 설정' },
]

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [language, setLanguage] = useState('ko')
  const [theme, setTheme]       = useState('light')

  // 비밀번호 변경
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [pwMsg, setPwMsg]   = useState({ type: '', text: '' })
  const [pwLoading, setPwLoading] = useState(false)

  // 계정 삭제
  const [delPw, setDelPw] = useState('')
  const [delLoading, setDelLoading] = useState(false)
  const [delMsg, setDelMsg] = useState({ type: '', text: '' })
  const [showDelConfirm, setShowDelConfirm] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (!raw) { router.push('/login'); return }
    const u = JSON.parse(raw)
    setUser(u)
    setLanguage(localStorage.getItem('cozyboard_lang') || 'en')
    setTheme(localStorage.getItem('altroboard_theme') || 'light')
  }, [])

  const saveLanguage = async (newLang) => {
    setLanguage(newLang)
    localStorage.setItem('cozyboard_lang', newLang)
    // useI18n 구독자에게 즉시 알림 (NavBar 등이 바로 갱신)
    try { window.dispatchEvent(new CustomEvent('altro:langchange', { detail: newLang })) } catch {}
    if (user) {
      try {
        await fetch(`/api/user/${user.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, language: newLang }),
        })
      } catch {}
    }
  }

  const saveTheme = async (newTheme) => {
    setTheme(newTheme)
    localStorage.setItem('altroboard_theme', newTheme)
    applyTheme(newTheme)
    if (user) {
      try {
        await fetch(`/api/user/${user.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, theme: newTheme }),
        })
      } catch {}
    }
  }

  const applyTheme = (t) => {
    const root = document.documentElement
    let effective = t
    if (t === 'auto') {
      effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    root.setAttribute('data-theme', effective)
  }

  const changePw = async () => {
    setPwMsg({ type: '', text: '' })
    if (!pwForm.currentPassword || !pwForm.newPassword) {
      setPwMsg({ type: 'error', text: '모든 필드를 입력하세요' }); return
    }
    if (pwForm.newPassword !== pwForm.confirm) {
      setPwMsg({ type: 'error', text: '새 비밀번호가 확인과 일치하지 않습니다' }); return
    }
    setPwLoading(true)
    const res = await fetch('/api/account/change-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: user.id,
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      }),
    })
    const data = await res.json()
    setPwLoading(false)
    if (!res.ok) { setPwMsg({ type: 'error', text: data.error || '변경 실패' }); return }
    setPwMsg({ type: 'success', text: '비밀번호가 변경되었습니다' })
    setPwForm({ currentPassword: '', newPassword: '', confirm: '' })
  }

  const deleteAccount = async () => {
    setDelMsg({ type: '', text: '' })
    if (!delPw) { setDelMsg({ type: 'error', text: '비밀번호를 입력하세요' }); return }
    setDelLoading(true)
    const res = await fetch('/api/account/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: user.id, password: delPw }),
    })
    const data = await res.json()
    setDelLoading(false)
    if (!res.ok) { setDelMsg({ type: 'error', text: data.error || '실패' }); return }
    setDelMsg({
      type: 'success',
      text: `계정 삭제가 예약되었습니다.\n${new Date(data.deletionScheduledAt).toLocaleString('ko-KR')} 까지 다시 로그인하지 않으면 영구 삭제됩니다.\n그 전까지 로그인하면 활성화 옵션이 표시됩니다.`,
    })
    setTimeout(() => {
      localStorage.removeItem('user')
      router.push('/')
    }, 4500)
  }

  if (!user) return <main><div className="container" style={{padding:'3rem',textAlign:'center',color:'var(--muted)'}}>로딩 중...</div></main>

  return (
    <main>
      <div className="container" style={{maxWidth:'720px'}}>
        <Link href="/mypage" className="btn btn-sm" style={{marginBottom:'1rem',display:'inline-flex'}}>← 마이페이지</Link>
        <div className="section-header">
          <h2>설정</h2>
          <p>{user.name} · {user.email}</p>
        </div>

        {/* 언어 */}
        <div className="card card-accent" style={{marginBottom:'1rem'}}>
          <div className="section-header" style={{marginBottom:'.75rem'}}>
            <h2 style={{fontSize:'1rem'}}>언어</h2>
            <p>화면 표시 언어</p>
          </div>
          <div style={{display:'flex',gap:'.5rem',flexWrap:'wrap'}}>
            {LANGS.map(l => (
              <button key={l.value} className={`btn btn-sm ${language===l.value?'btn-primary':''}`} onClick={()=>saveLanguage(l.value)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* 테마 */}
        <div className="card card-accent" style={{marginBottom:'1rem'}}>
          <div className="section-header" style={{marginBottom:'.75rem'}}>
            <h2 style={{fontSize:'1rem'}}>테마</h2>
            <p>화면 색상 모드</p>
          </div>
          <div style={{display:'flex',gap:'.5rem',flexWrap:'wrap'}}>
            {THEMES.map(t => (
              <button key={t.value} className={`btn btn-sm ${theme===t.value?'btn-primary':''}`} onClick={()=>saveTheme(t.value)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 비밀번호 변경 */}
        <div className="card card-accent" style={{marginBottom:'1rem'}}>
          <div className="section-header" style={{marginBottom:'.75rem'}}>
            <h2 style={{fontSize:'1rem'}}>비밀번호 변경</h2>
            <p>영문+숫자 8자 이상</p>
          </div>
          {pwMsg.text && <div className={`alert alert-${pwMsg.type==='error'?'error':'success'}`} style={{whiteSpace:'pre-line'}}>{pwMsg.text}</div>}
          <div className="form-group">
            <label>현재 비밀번호</label>
            <input type="password" value={pwForm.currentPassword} onChange={e=>setPwForm({...pwForm, currentPassword: e.target.value})}/>
          </div>
          <div className="form-group">
            <label>새 비밀번호</label>
            <input type="password" value={pwForm.newPassword} onChange={e=>setPwForm({...pwForm, newPassword: e.target.value})}/>
          </div>
          <div className="form-group">
            <label>새 비밀번호 확인</label>
            <input type="password" value={pwForm.confirm} onChange={e=>setPwForm({...pwForm, confirm: e.target.value})}/>
          </div>
          <button className="btn btn-primary btn-sm" onClick={changePw} disabled={pwLoading}>
            {pwLoading?'변경 중...':'변경하기'}
          </button>
        </div>

        {/* 계정 삭제 — Owner 는 비활성화 */}
        <div className="card" style={{borderTop:'3px solid #e74c3c',marginBottom:'2rem'}}>
          <div className="section-header" style={{marginBottom:'.75rem'}}>
            <h2 style={{fontSize:'1rem',color:'#e74c3c'}}>계정 삭제</h2>
            <p>위험 영역</p>
          </div>
          {user.role === 'owner' ? (
            <div className="alert alert-error" style={{whiteSpace:'pre-line',lineHeight:1.7}}>
              Owner 계정은 사이트 소유자 계정이라 본인이 직접 삭제할 수 없어요.
              {'\n'}소유권 이전이 필요하면 별도 절차로 진행해야 합니다.
            </div>
          ) : (
            <>
              <p style={{fontSize:'.82rem',color:'var(--muted)',lineHeight:1.75,marginBottom:'1rem'}}>
                계정 삭제 요청 시 <strong>1주일간 비활성화 상태</strong>로 유지된 후 영구 삭제됩니다.<br/>
                유예 기간 안에 다시 로그인하면 <strong>활성화 옵션이 표시</strong>되어 계정을 복구할 수 있습니다.<br/>
                로그아웃 상태에서 기간이 지나면 자동으로 영구 삭제됩니다.
              </p>
              {!showDelConfirm ? (
                <button className="btn btn-danger btn-sm" onClick={()=>setShowDelConfirm(true)}>계정 삭제 진행</button>
              ) : (
                <>
                  {delMsg.text && <div className={`alert alert-${delMsg.type==='error'?'error':'success'}`} style={{whiteSpace:'pre-line'}}>{delMsg.text}</div>}
                  <div className="form-group">
                    <label>비밀번호 확인</label>
                    <input type="password" value={delPw} onChange={e=>setDelPw(e.target.value)} placeholder="현재 비밀번호"/>
                  </div>
                  <div style={{display:'flex',gap:'.5rem'}}>
                    <button className="btn btn-sm" onClick={()=>{setShowDelConfirm(false); setDelPw(''); setDelMsg({type:'',text:''})}} disabled={delLoading}>취소</button>
                    <button className="btn btn-danger btn-sm" onClick={deleteAccount} disabled={delLoading}>
                      {delLoading?'처리 중...':'정말 삭제하기'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  )
}
