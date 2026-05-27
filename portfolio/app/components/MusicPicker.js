'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

// 음악 라이브러리 선택 UI (Instagram 음악 추천 화면 스타일).
// 승인된 음악 목록 + 검색 + 미리듣기 + 선택.
//
// props:
//   - selected: { id, fileUrl, title, artist, coverUrl } | null
//   - onSelect(music): 선택 시 콜백 (null 이면 선택 해제)
//   - compact: true 면 작은 모드 (메모용)

export default function MusicPicker({ selected, onSelect, compact = false }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [playingId, setPlayingId] = useState(null)
  const audioRef = useRef(null)

  useEffect(() => {
    fetch('/api/music?status=approved')
      .then(r => r.json())
      .then(d => setList(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const togglePlay = (m) => {
    if (!audioRef.current) audioRef.current = new Audio()
    const a = audioRef.current
    if (playingId === m.id) { a.pause(); setPlayingId(null); return }
    a.src = m.fileUrl
    a.play().catch(() => {})
    setPlayingId(m.id)
    a.onended = () => setPlayingId(cur => cur === m.id ? null : cur)
  }
  useEffect(() => () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null } }, [])

  const choose = (m) => {
    if (selected?.id === m.id) {
      onSelect?.(null)
    } else {
      onSelect?.({ id: m.id, fileUrl: m.fileUrl, title: m.title, artist: m.artist, coverUrl: m.coverUrl })
    }
  }

  const filtered = list.filter(m => {
    const s = q.trim().toLowerCase()
    if (!s) return true
    return (m.title || '').toLowerCase().includes(s) || (m.artist || '').toLowerCase().includes(s)
  })

  return (
    <div className={`mpk-wrap ${compact ? 'mpk-compact' : ''}`}>
      <input
        className="mpk-search"
        placeholder="음악 검색"
        value={q}
        onChange={e => setQ(e.target.value)}
      />

      {selected && (
        <div className="mpk-section-label">선택됨</div>
      )}
      {selected && (
        <div className="mpk-item mpk-selected">
          {selected.coverUrl ? <img src={selected.coverUrl} alt=""/> : <div className="mpk-cover-ph">♪</div>}
          <div className="mpk-meta">
            <div className="mpk-title">{selected.title}</div>
            <div className="mpk-artist">{selected.artist || '아티스트 미상'}</div>
          </div>
          <button type="button" className="mpk-remove" onClick={() => onSelect?.(null)} aria-label="선택 해제">×</button>
        </div>
      )}

      <div className="mpk-section-label">회원님을 위한 추천</div>
      {loading ? (
        <div className="mpk-empty">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="mpk-empty">
          {list.length === 0
            ? <>승인된 음악이 아직 없어요. <Link href="/music/upload" style={{color:'var(--accent)'}}>업로드 신청</Link></>
            : '검색 결과가 없습니다.'
          }
        </div>
      ) : (
        <div className="mpk-list">
          {filtered.map(m => {
            const isSelected = selected?.id === m.id
            const isPlaying = playingId === m.id
            return (
              <div key={m.id} className={`mpk-item ${isSelected ? 'on' : ''}`} onClick={() => choose(m)}>
                {m.coverUrl ? <img src={m.coverUrl} alt={m.title}/> : <div className="mpk-cover-ph">♪</div>}
                <div className="mpk-meta">
                  <div className="mpk-title">{m.title}</div>
                  <div className="mpk-artist">{m.artist || '아티스트 미상'} · {m.uploaderName}</div>
                </div>
                <button type="button" className="mpk-play" onClick={(e) => { e.stopPropagation(); togglePlay(m) }} aria-label={isPlaying ? '정지' : '재생'}>
                  {isPlaying ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <style jsx>{`
        .mpk-wrap{display:flex;flex-direction:column;gap:.5rem;}
        .mpk-search{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:.5rem .75rem;font-family:var(--font);font-size:.85rem;outline:none;color:var(--text);}
        .mpk-search:focus{border-color:var(--accent);}
        .mpk-section-label{font-family:var(--mono);font-size:.7rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-top:.4rem;}
        .mpk-list{display:flex;flex-direction:column;gap:.35rem;max-height:${compact ? '260px' : '380px'};overflow-y:auto;padding-right:.25rem;}
        .mpk-item{display:flex;align-items:center;gap:.65rem;padding:.45rem .55rem;border-radius:8px;cursor:pointer;background:var(--surface);border:1px solid var(--border);transition:background .15s;}
        .mpk-item:hover{background:var(--surface2);}
        .mpk-item.on{background:rgba(192,57,43,.1);border-color:var(--accent);}
        .mpk-item.mpk-selected{background:rgba(192,57,43,.08);border-color:var(--accent);}
        .mpk-item img,.mpk-cover-ph{width:42px;height:42px;border-radius:6px;object-fit:cover;flex-shrink:0;}
        .mpk-cover-ph{background:linear-gradient(135deg,var(--ink),var(--surface2));display:flex;align-items:center;justify-content:center;color:rgba(245,240,232,.5);font-size:1rem;}
        .mpk-meta{flex:1;min-width:0;}
        .mpk-title{font-family:var(--serif);font-weight:600;font-size:.85rem;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .mpk-artist{font-family:var(--mono);font-size:.66rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .mpk-play{background:var(--accent);color:#fff;border:none;width:32px;height:32px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .mpk-play:hover{filter:brightness(1.1);}
        .mpk-remove{background:none;border:none;color:var(--muted);cursor:pointer;font-size:1.2rem;padding:0 .3rem;}
        .mpk-empty{font-family:var(--mono);font-size:.75rem;color:var(--muted);padding:.8rem .4rem;text-align:center;line-height:1.65;}
      `}</style>
    </div>
  )
}
