'use client'
import { useState } from 'react'

const REPORT_REASONS = [
  '스팸/광고',
  '욕설/혐오',
  '음란물/성인',
  '폭력/위협',
  '저작권 침해',
  '개인정보 노출',
  '도배',
  '기타',
]

/**
 * 신고 버튼 + 모달
 * props: { type, targetId, targetUrl, targetAuthorId, targetAuthorName, className, label }
 * 로그인이 필요. type: 'post'|'gallery_post'|'short'|'comment'|'user'|'story'
 */
export default function ReportButton({
  type, targetId, targetUrl, targetAuthorId, targetAuthorName,
  className = 'btn btn-sm', label = '🚩 신고',
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState(REPORT_REASONS[0])
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async () => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    if (!raw) { setError('로그인이 필요합니다'); return }
    const u = JSON.parse(raw)
    setLoading(true); setError('')
    const res = await fetch('/api/reports', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type, targetId, targetUrl,
        targetAuthorId, targetAuthorName,
        reporterId: u.id, reporterName: u.name,
        reason, description,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || '신고 실패'); return }
    setDone(true)
    setTimeout(() => { setOpen(false); setDone(false); setReason(REPORT_REASONS[0]); setDescription('') }, 1500)
  }

  return (
    <>
      <button type="button" className={className} onClick={()=>setOpen(true)}>{label}</button>
      {open && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:8500,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}
          onClick={()=>!loading && setOpen(false)}>
          <div className="card card-accent" style={{maxWidth:420,width:'100%'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{fontFamily:'var(--serif)',fontSize:'1.1rem',marginBottom:'.75rem'}}>신고하기</h3>
            {error && <div className="alert alert-error">{error}</div>}
            {done ? (
              <div className="alert alert-success">신고가 접수되었습니다. 관리자가 검토합니다.</div>
            ) : (
              <>
                <div className="form-group">
                  <label>사유</label>
                  <select value={reason} onChange={e=>setReason(e.target.value)}>
                    {REPORT_REASONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>자세한 설명 (선택, 500자 이하)</label>
                  <textarea rows={3} maxLength={500} value={description} onChange={e=>setDescription(e.target.value)}
                    placeholder="문제가 되는 부분을 구체적으로 적어주세요"/>
                </div>
                <div style={{display:'flex',gap:'.5rem',justifyContent:'flex-end'}}>
                  <button className="btn btn-sm" onClick={()=>setOpen(false)} disabled={loading}>취소</button>
                  <button className="btn btn-primary btn-sm" onClick={submit} disabled={loading}>
                    {loading?'처리 중...':'신고하기'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
