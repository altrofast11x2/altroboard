'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function StudyPage() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title:'', content:'', period:'', tags:'' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (u) setUser(JSON.parse(u))
    fetch('/api/study').then(r=>r.json()).then(d=>{setPosts(d);setLoading(false)})
  }, [])

  const submit = async () => {
    if (!form.title.trim() || !form.content.trim()) { setError('제목과 내용을 입력하세요'); return }
    setSaving(true)
    const res = await fetch('/api/study', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ ...form, tags: form.tags.split(',').map(t=>t.trim()).filter(Boolean), role: user?.role })
    })
    const data = await res.json()
    if (data.error) { setError(data.error); setSaving(false) }
    else { setPosts(prev=>[data,...prev]); setShowForm(false); setForm({title:'',content:'',period:'',tags:''}); setSaving(false) }
  }

  const del = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/study/${id}`, { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({role:user?.role}) })
    setPosts(prev=>prev.filter(p=>p.id!==id))
  }

  return (
    <main>
      <div className="container">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:'1.5rem',flexWrap:'wrap',gap:'0.75rem'}}>
          <div className="section-header" style={{marginBottom:0}}>
            <h2>학습 기록</h2>
            <p>배운 것들을 기록합니다 {user?.role!=='admin'&&'— 관리자만 작성 가능'}</p>
          </div>
          {user?.role==='admin' && (
            <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(!showForm)}>
              {showForm?'✕ 닫기':'+ 학습 기록 추가'}
            </button>
          )}
        </div>

        {/* 작성 폼 - 관리자만 */}
        {showForm && user?.role==='admin' && (
          <div className="card card-accent" style={{marginBottom:'2rem'}}>
            <div className="section-header"><h2>새 학습 기록</h2></div>
            {error && <div className="alert alert-error">{error}</div>}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.7rem'}}>
              <div className="form-group" style={{margin:0}}>
                <label>제목</label>
                <input placeholder="예: Next.js App Router 학습" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} />
              </div>
              <div className="form-group" style={{margin:0}}>
                <label>기간</label>
                <input placeholder="예: 2025.04 ~ 현재" value={form.period} onChange={e=>setForm({...form,period:e.target.value})} />
              </div>
            </div>
            <div className="form-group">
              <label>내용</label>
              <textarea rows={5} placeholder="배운 내용을 자세히 적어주세요" value={form.content} onChange={e=>setForm({...form,content:e.target.value})} />
            </div>
            <div className="form-group">
              <label>태그 (쉼표로 구분)</label>
              <input placeholder="Next.js, React, TypeScript" value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})} />
            </div>
            <div style={{display:'flex',gap:'0.5rem',justifyContent:'flex-end'}}>
              <button className="btn btn-sm" onClick={()=>setShowForm(false)}>취소</button>
              <button className="btn btn-primary btn-sm" onClick={submit} disabled={saving}>{saving?'저장 중...':'저장'}</button>
            </div>
          </div>
        )}

        {/* 타임라인 */}
        {loading ? (
          <div style={{fontFamily:'var(--mono)',fontSize:'0.82rem',color:'var(--muted)'}}>불러오는 중...</div>
        ) : posts.length === 0 ? (
          <div style={{fontFamily:'var(--mono)',fontSize:'0.82rem',color:'var(--muted)',padding:'3rem 0'}}>
            아직 학습 기록이 없습니다{user?.role==='admin'&&' — 위 버튼으로 추가하세요'}
          </div>
        ) : (
          <div className="timeline">
            {posts.map(p => (
              <div className="timeline-item" key={p.id}>
                <span className="timeline-period">{p.period || new Date(p.createdAt).toLocaleDateString('ko-KR')}</span>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <h4>{p.title}</h4>
                  {user?.role==='admin' && (
                    <button className="btn btn-danger btn-sm" style={{padding:'0.2rem 0.6rem',fontSize:'0.7rem'}} onClick={()=>del(p.id)}>삭제</button>
                  )}
                </div>
                <p style={{marginTop:'0.4rem',marginBottom:'0.6rem'}}>{p.content}</p>
                {p.tags?.length>0 && (
                  <div style={{display:'flex',gap:'0.35rem',flexWrap:'wrap'}}>
                    {p.tags.map(t=><span className="badge badge-red" key={t}>{t}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
