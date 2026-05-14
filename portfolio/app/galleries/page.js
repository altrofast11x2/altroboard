'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const COLORS = ['#c0392b','#e67e22','#f1c40f','#27ae60','#16a085','#2980b9','#8e44ad','#34495e']

// 갤러리 아이콘 이미지 정사각형으로 압축
function resizeToSquareBase64(file, size = 256) {
  return new Promise((resolve, reject) => {
    if (file.size > 5 * 1024 * 1024) return reject(new Error('5MB 이하만 가능합니다'))
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size; canvas.height = size
      const ctx = canvas.getContext('2d')
      // 짧은 변 기준 center crop
      const s = Math.min(img.width, img.height)
      const sx = (img.width - s) / 2, sy = (img.height - s) / 2
      ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 불러올 수 없습니다')) }
    img.src = url
  })
}

export default function GalleriesPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [galleries, setGalleries] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', iconUrl: '', color: '#c0392b' })
  const [iconFile, setIconFile] = useState(null)
  const [iconProcessing, setIconProcessing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (raw) setUser(JSON.parse(raw))
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/galleries')
      const data = await res.json()
      setGalleries(Array.isArray(data) ? data : [])
    } catch { setGalleries([]) }
    setLoading(false)
  }

  const handlePickIcon = async (file) => {
    if (!file) return
    setIconProcessing(true); setErr('')
    try {
      const dataUrl = await resizeToSquareBase64(file, 256)
      setForm(f => ({ ...f, iconUrl: dataUrl }))
      setIconFile(file)
    } catch (e) {
      setErr(e.message || '이미지 처리 실패')
    }
    setIconProcessing(false)
  }

  const submit = async () => {
    if (!user) { router.push('/login'); return }
    if (!form.name.trim()) { setErr('이름을 입력하세요'); return }
    setCreating(true); setErr('')
    const res = await fetch('/api/galleries', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(), description: form.description.trim(),
        iconUrl: form.iconUrl || null, color: form.color,
        ownerId: user.id, ownerName: user.name,
      }),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) { setErr(data.error || '생성 실패'); return }
    setShowCreate(false)
    setForm({ name: '', description: '', iconUrl: '', color: '#c0392b' })
    setIconFile(null)
    router.push(`/galleries/${data.id}`)
  }

  const filtered = galleries.filter(g =>
    !search.trim() || g.name?.toLowerCase().includes(search.trim().toLowerCase()) ||
    g.description?.toLowerCase().includes(search.trim().toLowerCase())
  )

  const renderGalleryIcon = (g, size = 46) => (
    g.iconUrl ? (
      <img src={g.iconUrl} alt="" className="g-icon" style={{width:size,height:size,objectFit:'cover'}}/>
    ) : (
      <div className="g-icon" style={{width:size,height:size,background:g.color}}>
        {(g.name || '?')[0].toUpperCase()}
      </div>
    )
  )

  return (
    <main>
      <div className="container">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:'1.5rem',flexWrap:'wrap',gap:'0.75rem'}}>
          <div className="section-header" style={{marginBottom:0}}>
            <h2>갤러리 (클럽)</h2>
            <p>관심사로 모이는 작은 모임 · 가입 후 글쓰기 가능</p>
          </div>
          {user && <button className="btn btn-primary btn-sm" onClick={()=>setShowCreate(true)}>+ 갤러리 만들기</button>}
        </div>

        <div className="board-filters" style={{marginBottom:'1rem'}}>
          <input placeholder="갤러리 검색..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="card" style={{textAlign:'center',padding:'3rem',color:'var(--muted)',fontFamily:'var(--mono)'}}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{textAlign:'center',padding:'3rem',color:'var(--muted)',fontFamily:'var(--mono)',fontSize:'0.85rem'}}>
            {galleries.length === 0 ? '아직 갤러리가 없습니다. 첫 갤러리를 만들어보세요.' : '검색 결과가 없습니다.'}
          </div>
        ) : (
          <div className="g-grid">
            {filtered.map(g => (
              <Link key={g.id} href={`/galleries/${g.id}`} className="g-card" style={{borderTopColor:g.color}}>
                {renderGalleryIcon(g)}
                <div className="g-name">{g.name}</div>
                <div className="g-desc">{g.description || '소개 없음'}</div>
                <div className="g-meta">
                  <span>멤버 {g.memberCount || 0}</span>
                  <span>글 {g.postCount || 0}</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!user && (
          <p style={{marginTop:'1rem',fontSize:'0.8rem',color:'var(--muted)',fontFamily:'var(--mono)'}}>
            갤러리를 만들려면 <Link href="/login" style={{color:'var(--accent)'}}>로그인</Link>이 필요합니다
          </p>
        )}
      </div>

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="g-overlay" onClick={()=>!creating&&setShowCreate(false)}>
          <div className="g-modal" onClick={e=>e.stopPropagation()}>
            <div className="g-modal-head">
              <h3>새 갤러리 만들기</h3>
              <button className="g-close" onClick={()=>!creating&&setShowCreate(false)}>✕</button>
            </div>
            {err && <div className="alert alert-error">{err}</div>}
            <div className="form-group">
              <label>이름 (최대 30자)</label>
              <input value={form.name} onChange={e=>setForm({...form, name: e.target.value})} maxLength={30} placeholder="예: 음악 추천 모임" />
            </div>
            <div className="form-group">
              <label>소개</label>
              <textarea rows={3} maxLength={300} value={form.description}
                onChange={e=>setForm({...form, description: e.target.value})}
                placeholder="이 갤러리는 어떤 사람들이 모이는 곳인가요?" />
            </div>
            <div className="form-group">
              <label>아이콘 이미지 (선택, 정사각형 권장 · 5MB 이하)</label>
              <div style={{display:'flex',alignItems:'center',gap:'.7rem'}}>
                <div style={{
                  width:64,height:64,borderRadius:8,overflow:'hidden',flexShrink:0,
                  background: form.iconUrl ? '#fff' : form.color,
                  display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontFamily:'var(--serif)',fontWeight:700,fontSize:'1.6rem',
                  border:'1px solid var(--border)',
                }}>
                  {form.iconUrl
                    ? <img src={form.iconUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    : ((form.name || '?')[0].toUpperCase())
                  }
                </div>
                <button type="button" className="btn btn-sm" onClick={()=>fileRef.current?.click()} disabled={iconProcessing}>
                  {iconProcessing ? '처리 중...' : (form.iconUrl ? '이미지 변경' : '이미지 선택')}
                </button>
                {form.iconUrl && (
                  <button type="button" className="btn btn-sm" onClick={()=>{setForm(f=>({...f, iconUrl: ''})); setIconFile(null)}}>
                    제거
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{display:'none'}}
                  onChange={e=>handlePickIcon(e.target.files?.[0])}/>
              </div>
            </div>
            <div className="form-group">
              <label>강조 색상 (테두리/대체 배경)</label>
              <div className="g-color-pick">
                {COLORS.map(c => (
                  <button key={c} type="button" className={`g-color-btn ${form.color===c?'active':''}`}
                    style={{background:c}} onClick={()=>setForm({...form, color: c})}/>
                ))}
              </div>
            </div>
            <div className="g-preview" style={{borderTopColor: form.color}}>
              {form.iconUrl
                ? <img src={form.iconUrl} alt="" className="g-icon" style={{width:46,height:46,objectFit:'cover'}}/>
                : <div className="g-icon" style={{background:form.color}}>{(form.name||'?')[0].toUpperCase()}</div>
              }
              <div className="g-name">{form.name || '갤러리 이름'}</div>
              <div className="g-desc">{form.description || '소개 미리보기'}</div>
            </div>
            <div style={{display:'flex',gap:'0.5rem',justifyContent:'flex-end',marginTop:'1rem'}}>
              <button className="btn btn-sm" onClick={()=>!creating&&setShowCreate(false)}>취소</button>
              <button className="btn btn-primary btn-sm" onClick={submit} disabled={creating||!form.name.trim()}>
                {creating ? '만드는 중...' : '갤러리 만들기'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .g-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem;}
        .g-card{display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--border);border-top:3px solid var(--accent);border-radius:4px;padding:1.1rem;cursor:pointer;transition:all .15s;text-decoration:none;color:inherit;}
        .g-card:hover{transform:translateY(-2px);box-shadow:0 6px 16px var(--shadow);}
        .g-icon{width:46px;height:46px;border-radius:8px;background:var(--accent);color:#fff;font-size:1.4rem;font-family:var(--serif);font-weight:700;display:flex;align-items:center;justify-content:center;margin-bottom:.6rem;flex-shrink:0;overflow:hidden;}
        .g-name{font-family:var(--serif);font-size:1rem;font-weight:700;color:var(--ink);margin-bottom:.3rem;}
        .g-desc{font-size:.78rem;color:var(--muted);line-height:1.55;margin-bottom:.75rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;flex:1;}
        .g-meta{display:flex;gap:.85rem;font-family:var(--mono);font-size:.7rem;color:var(--muted);}
        .g-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:8000;display:flex;align-items:center;justify-content:center;padding:1rem;}
        .g-modal{background:var(--surface);border-radius:6px;width:min(480px,100%);max-height:92vh;overflow-y:auto;padding:1.5rem;box-shadow:0 20px 60px rgba(0,0,0,.4);}
        .g-modal-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;}
        .g-modal-head h3{font-family:var(--serif);font-size:1.1rem;color:var(--ink);}
        .g-close{background:none;border:none;cursor:pointer;color:var(--muted);font-size:1.1rem;padding:.2rem .4rem;}
        .g-color-pick{display:flex;gap:.5rem;flex-wrap:wrap;}
        .g-color-btn{width:30px;height:30px;border-radius:50%;border:2px solid var(--bg);cursor:pointer;box-shadow:0 0 0 1px var(--border);}
        .g-color-btn.active{box-shadow:0 0 0 2px var(--ink);}
        .g-preview{margin-top:1rem;padding:1rem;background:var(--bg);border:1px solid var(--border);border-top:3px solid var(--accent);border-radius:4px;}
      `}</style>
    </main>
  )
}
