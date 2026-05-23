'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n'

// 메인 페이지에서 사용하는 스토리 스트립.
// - 로그인 안 한 사용자에게는 아예 노출 안 됨 (메인페이지에서 user 가드, 여기서도 한 번 더)
// - "전체 보기" 같은 자세히 보기 링크 제거
// - "스토리 작성" 클릭 시 /stories?create=1 로 가서 곧장 작성 모달 오픈

export default function StoryStrip() {
  const [stories, setStories] = useState([])
  const [user,    setUser]    = useState(null)
  const router = useRouter()
  const { t } = useI18n()

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (!u) return                                // 비로그인 = 아무것도 안 함
    setUser(JSON.parse(u))
    fetch('/api/stories').then(r => r.json()).then(d => setStories(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  // 비로그인은 아예 렌더 안 함
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
        {/* 즉시 작성 — /stories?create=1 로 가면 작성 모달이 자동 열림 */}
        <Link href="/stories?create=1" className="strip-item">
          <div className="strip-bubble add">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="rgba(245,240,232,0.7)" strokeWidth="2.4" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
          <span className="strip-name">{t('story.create')}</span>
        </Link>
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

      <style>{`
        .strip-wrap{padding:.25rem 0;}
        .strip-row{display:flex;gap:1rem;overflow-x:auto;padding-bottom:.25rem;scrollbar-width:none;}
        .strip-row::-webkit-scrollbar{display:none;}
        .strip-item{display:flex;flex-direction:column;align-items:center;gap:.3rem;flex-shrink:0;cursor:pointer;text-decoration:none;}
        .strip-bubble{width:60px;height:60px;border-radius:50%;border:2.5px solid var(--accent);display:flex;align-items:center;justify-content:center;overflow:hidden;transition:transform .2s;background:var(--surface2);}
        .strip-bubble:hover{transform:scale(1.08);}
        .strip-bubble.add{background:var(--ink);border-style:dashed;border-color:var(--border-dark);}
        .strip-name{font-family:var(--mono);font-size:.65rem;color:var(--muted);max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      `}</style>
    </div>
  )
}
