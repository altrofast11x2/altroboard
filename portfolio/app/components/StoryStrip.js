'use client'
import { useState, useEffect, lazy, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n'

const StoryComposer = lazy(() => import('./StoryComposer'))

// 메인 페이지 상단 스토리 스트립.
// - 비로그인 사용자에게는 아예 렌더 안 됨
// - "스토리 작성" 클릭 시 같은 페이지에서 모달로 작성 (Instagram 패턴)
// - 다른 사람 스토리 클릭 시 /stories?view=<authorId> 로 이동

export default function StoryStrip() {
  const [stories, setStories] = useState([])
  const [user,    setUser]    = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const router = useRouter()
  const { t } = useI18n()

  const loadStories = () => {
    fetch('/api/stories').then(r => r.json()).then(d => setStories(Array.isArray(d) ? d : [])).catch(() => {})
  }

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (!u) return
    setUser(JSON.parse(u))
    loadStories()
  }, [])

  if (!user) return null

  // group by author, dedupe
  const seen = {}
  const groups = []
  stories.forEach(s => {
    if (!seen[s.authorId]) {
      seen[s.authorId] = true
      groups.push({ authorId: s.authorId, authorName: s.authorName, authorAvatar: s.authorAvatar, bg: s.bgColor })
    }
  })

  return (
    <div className="strip-wrap">
      <div className="strip-row">
        {/* 인라인 작성 모달 — 다른 페이지로 가지 않고 메인에서 바로 작성 */}
        <button type="button" onClick={() => setShowCreate(true)} className="strip-item strip-btn">
          <div className="strip-bubble add">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="rgba(245,240,232,0.7)" strokeWidth="2.4" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
          <span className="strip-name">{t('story.create')}</span>
        </button>
        {groups.slice(0, 10).map(g => (
          <Link href={`/stories?view=${encodeURIComponent(g.authorId)}`} key={g.authorId} className="strip-item">
            <div className="strip-bubble" style={{ background: g.bg || '#1a1208' }}>
              {g.authorAvatar
                ? <img src={g.authorAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : <span style={{ color: '#fff', fontFamily: 'var(--serif)', fontWeight: 700, fontSize: '1rem' }}>
                    {(g.authorName || '?')[0].toUpperCase()}
                  </span>
              }
            </div>
            <span className="strip-name">{g.authorName}</span>
          </Link>
        ))}
        {groups.length === 0 && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--muted)', padding: '0 0.5rem', alignSelf: 'center' }}>
            {t('story.empty')}
          </span>
        )}
      </div>

      {/* 작성 모달 — 메인 페이지 내에서 직접 렌더 */}
      {showCreate && (
        <Suspense fallback={null}>
          <StoryComposer
            user={user}
            onClose={() => setShowCreate(false)}
            onPosted={() => loadStories()}
          />
        </Suspense>
      )}

      <style>{`
        .strip-wrap{padding:.25rem 0;}
        .strip-row{display:flex;gap:1rem;overflow-x:auto;padding-bottom:.25rem;scrollbar-width:none;}
        .strip-row::-webkit-scrollbar{display:none;}
        .strip-item{display:flex;flex-direction:column;align-items:center;gap:.3rem;flex-shrink:0;cursor:pointer;text-decoration:none;}
        .strip-btn{background:none;border:none;padding:0;font:inherit;color:inherit;}
        .strip-bubble{width:60px;height:60px;border-radius:50%;border:2.5px solid var(--accent);display:flex;align-items:center;justify-content:center;overflow:hidden;transition:transform .2s;background:var(--surface2);}
        .strip-bubble:hover{transform:scale(1.08);}
        .strip-bubble.add{background:var(--ink);border-style:dashed;border-color:var(--border-dark);}
        .strip-name{font-family:var(--mono);font-size:.65rem;color:var(--muted);max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      `}</style>
    </div>
  )
}
