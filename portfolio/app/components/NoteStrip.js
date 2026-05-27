'use client'
import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import Link from 'next/link'

const NoteComposer = lazy(() => import('./NoteComposer'))

// 채팅 페이지 상단 메모 row (Instagram '노트' 패턴).
// - 좌측: 내 메모 버블 (없으면 + 아이콘, 있으면 텍스트 미리보기)
// - 우측: 팔로잉 사용자 메모들 (24시간 이내)
// - 클릭 시 메모 작성 모달 / 다른 사람 메모는 툴팁으로 전문 보기

export default function NoteStrip({ user }) {
  const [notes, setNotes] = useState([])
  const [myNote, setMyNote] = useState(null)
  const [showComposer, setShowComposer] = useState(false)
  const [openNoteId, setOpenNoteId] = useState(null)
  const popoverRef = useRef(null)

  const load = async () => {
    if (!user) return
    try {
      const r = await fetch(`/api/notes?userId=${encodeURIComponent(user.id)}`)
      const d = await r.json()
      setNotes(Array.isArray(d?.notes) ? d.notes : [])
      setMyNote(d?.myNote || null)
    } catch {}
  }

  useEffect(() => { load() }, [user?.id])

  // 다른 메모 클릭 시 popover 토글
  const togglePopover = (authorId) => {
    setOpenNoteId(cur => cur === authorId ? null : authorId)
  }

  // popover 외부 클릭 시 닫기
  useEffect(() => {
    if (!openNoteId) return
    const onDoc = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpenNoteId(null)
      }
    }
    const id = setTimeout(() => document.addEventListener('click', onDoc), 0)
    return () => { clearTimeout(id); document.removeEventListener('click', onDoc) }
  }, [openNoteId])

  const deleteMyNote = async () => {
    if (!user || !confirm('메모를 삭제할까요?')) return
    await fetch('/api/notes', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    })
    setMyNote(null)
    load()
  }

  const others = notes.filter(n => n.authorId !== user?.id)
  const openNote = openNoteId ? notes.find(n => n.authorId === openNoteId) : null

  return (
    <div className="ns-wrap">
      <div className="ns-row">
        {/* 내 메모 */}
        <div className="ns-item">
          <div className="ns-avatar-wrap" onClick={() => myNote ? deleteMyNote() : setShowComposer(true)} title={myNote ? '메모 삭제' : '메모 작성'}>
            {myNote ? (
              <div className="ns-bubble ns-mine" title={myNote.text || (myNote.music && '🎵 ' + myNote.music.title) || ''}>
                {myNote.text ? <span className="ns-text">{myNote.text}</span> : (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                )}
              </div>
            ) : (
              <div className="ns-bubble ns-add">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </div>
            )}
            <div className="ns-av">
              {user?.avatar
                ? <img src={user.avatar} alt={user.name}/>
                : <span>{(user?.name || '?')[0]?.toUpperCase()}</span>
              }
            </div>
          </div>
          <span className="ns-name">내 메모</span>
        </div>

        {/* 다른 사람 메모 */}
        {others.map(n => (
          <div key={n.authorId} className="ns-item">
            <div className="ns-avatar-wrap" onClick={(e) => { e.stopPropagation(); togglePopover(n.authorId) }}>
              <div className="ns-bubble" title={n.text || (n.music ? '🎵 ' + n.music.title : '')}>
                <span className="ns-text">{n.text || (n.music ? '♪' : '')}</span>
              </div>
              <div className="ns-av">
                {n.authorAvatar
                  ? <img src={n.authorAvatar} alt={n.authorName}/>
                  : <span>{(n.authorName || '?')[0]?.toUpperCase()}</span>
                }
              </div>
            </div>
            <span className="ns-name">{n.authorName}</span>

            {openNoteId === n.authorId && openNote && (
              <div className="ns-popover" ref={popoverRef} onClick={e => e.stopPropagation()}>
                <div className="ns-pop-head">
                  <Link href={`/profile/${n.authorId}`} className="ns-pop-name">{n.authorName}</Link>
                  <button className="ns-pop-x" onClick={() => setOpenNoteId(null)} aria-label="닫기">×</button>
                </div>
                {n.text && <div className="ns-pop-text">{n.text}</div>}
                {n.gifUrl && (
                  <img src={n.gifUrl} alt="GIF" style={{maxWidth:'100%',borderRadius:6,marginBottom:'.4rem'}}/>
                )}
                {n.music && (
                  <div className="ns-pop-music">
                    {n.music.thumbnail && <img src={n.music.thumbnail} alt=""/>}
                    <div>
                      <div className="ns-pop-music-title">{n.music.title}</div>
                      <div className="ns-pop-music-author">{n.music.author}</div>
                    </div>
                    {n.music.url && (
                      <a href={n.music.url} target="_blank" rel="noopener noreferrer" className="ns-pop-music-link">↗</a>
                    )}
                  </div>
                )}
                <div className="ns-pop-time">{new Date(n.createdAt).toLocaleString('ko-KR')}</div>
              </div>
            )}
          </div>
        ))}

        {others.length === 0 && (
          <span className="ns-empty">팔로잉 사용자의 메모가 여기에 표시됩니다</span>
        )}
      </div>

      {showComposer && (
        <Suspense fallback={null}>
          <NoteComposer
            user={user}
            onClose={() => setShowComposer(false)}
            onPosted={() => { setShowComposer(false); load() }}
          />
        </Suspense>
      )}

      <style jsx>{`
        .ns-wrap{padding:.6rem 1rem;border-bottom:1px solid var(--border);background:var(--surface);}
        .ns-row{display:flex;gap:1rem;overflow-x:auto;scrollbar-width:none;align-items:flex-start;}
        .ns-row::-webkit-scrollbar{display:none;}
        .ns-item{display:flex;flex-direction:column;align-items:center;gap:.3rem;flex-shrink:0;position:relative;}
        .ns-avatar-wrap{position:relative;cursor:pointer;}

        .ns-bubble{
          position:relative;background:var(--surface2);border:1.5px solid var(--border);
          border-radius:14px 14px 14px 4px;padding:.3rem .6rem;
          font-family:var(--mono);font-size:.7rem;color:var(--text);
          max-width:120px;min-width:46px;min-height:24px;
          display:flex;align-items:center;justify-content:center;
          margin-bottom:-8px;text-align:center;line-height:1.3;
          box-shadow:0 2px 6px rgba(0,0,0,.15);
        }
        .ns-bubble.ns-mine{background:var(--accent);color:#fff;border-color:var(--accent);}
        .ns-bubble.ns-add{background:var(--ink);color:rgba(245,240,232,.7);border-style:dashed;border-color:var(--border-dark);min-width:30px;}
        .ns-text{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100px;}

        .ns-av{
          width:50px;height:50px;border-radius:50%;
          background:var(--accent);color:#fff;
          font-family:var(--serif);font-weight:700;font-size:1rem;
          display:flex;align-items:center;justify-content:center;
          overflow:hidden;border:2px solid var(--surface);
          margin:0 auto;
        }
        .ns-av img{width:100%;height:100%;object-fit:cover;}

        .ns-name{font-family:var(--mono);font-size:.62rem;color:var(--muted);max-width:56px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .ns-empty{font-family:var(--mono);font-size:.7rem;color:var(--muted);padding:1.2rem .5rem;align-self:center;}

        /* Popover */
        .ns-popover{
          position:absolute;top:100%;left:50%;transform:translateX(-50%);
          margin-top:.5rem;width:260px;z-index:50;
          background:var(--surface);border:1px solid var(--border);border-radius:10px;
          box-shadow:0 8px 24px rgba(0,0,0,.2);padding:.7rem .85rem;
        }
        .ns-pop-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem;}
        .ns-pop-name{font-family:var(--mono);font-size:.78rem;font-weight:700;color:var(--ink);text-decoration:none;}
        .ns-pop-x{background:none;border:none;color:var(--muted);font-size:1.1rem;cursor:pointer;padding:0 .25rem;}
        .ns-pop-text{font-size:.85rem;color:var(--text);line-height:1.55;margin-bottom:.5rem;white-space:pre-wrap;word-break:break-word;}
        .ns-pop-music{display:flex;align-items:center;gap:.5rem;background:var(--surface2);border-radius:6px;padding:.4rem .55rem;}
        .ns-pop-music img{width:32px;height:32px;border-radius:4px;object-fit:cover;}
        .ns-pop-music>div{flex:1;min-width:0;}
        .ns-pop-music-title{font-family:var(--mono);font-size:.72rem;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .ns-pop-music-author{font-family:var(--mono);font-size:.65rem;color:var(--muted);}
        .ns-pop-music-link{color:var(--accent);font-size:1.1rem;font-weight:700;text-decoration:none;}
        .ns-pop-time{font-family:var(--mono);font-size:.62rem;color:var(--muted);margin-top:.45rem;text-align:right;}
      `}</style>
    </div>
  )
}
