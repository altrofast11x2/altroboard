'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ROLE_META } from '@/lib/roles'

export default function AdminUsersPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('') // 'all'|'suspended'|'staff'|''=all
  const [search, setSearch] = useState('')

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (!raw) { router.push('/login'); return }
    const u = JSON.parse(raw)
    if (!['owner', 'admin'].includes(u.role)) { router.push('/'); return }
    setUser(u)
    load(u)
  }, [])

  const load = async (u) => {
    setLoading(true)
    const res = await fetch(`/api/admin/users?actorId=${encodeURIComponent(u.id)}`)
    if (!res.ok) { setLoading(false); return }
    setUsers(await res.json())
    setLoading(false)
  }

  const act = async (uid, action, extra = {}) => {
    const res = await fetch('/api/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorId: user.id, uid, action, ...extra }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error || '실패'); return }
    load(user)
  }

  const onSuspend = (u) => {
    const reason = prompt(`'${u.name}' 계정을 정지합니다.\n사유를 입력하세요 (선택):`, '커뮤니티 가이드라인 위반')
    if (reason === null) return
    act(u.id, 'suspend', { reason })
  }
  const onUnsuspend = (u) => {
    if (!confirm(`'${u.name}' 계정 정지를 해제합니다.`)) return
    act(u.id, 'unsuspend')
  }
  const onSetRole = (u) => {
    const role = prompt(`'${u.name}' 의 등급을 입력하세요 (owner/admin/tester/developer/user):`, u.role)
    if (!role) return
    act(u.id, 'setRole', { role })
  }
  const onPurge = (u) => {
    if (!confirm(`'${u.name}' 계정 삭제를 예약합니다.\n7일 후 모든 활동 (게시글·스토리·쇼츠·댓글·갤러리)이 함께 영구 삭제됩니다.\n유예 기간 안에 본인이 다시 로그인하면 복구할 수 있습니다.\n진행하시겠습니까?`)) return
    act(u.id, 'purge')
  }
  const onPurgeNow = (u) => {
    if (!confirm(`[즉시 삭제 - Owner 전용]\n'${u.name}' 계정과 모든 활동을 지금 바로 영구 삭제합니다. 되돌릴 수 없습니다.\n정말 진행하시겠습니까?`)) return
    if (!confirm(`다시 한 번 확인: '${u.name}' 즉시 영구 삭제. 동의합니까?`)) return
    act(u.id, 'purgeNow')
  }
  const onCancelDelete = (u) => {
    if (!confirm(`'${u.name}' 계정의 삭제 예약을 취소합니다.`)) return
    act(u.id, 'cancelDelete')
  }

  const filtered = users.filter(u => {
    if (filter === 'suspended' && !u.suspended) return false
    if (filter === 'staff' && !['owner', 'admin', 'tester', 'developer'].includes(u.role)) return false
    if (filter === 'pending_deletion' && !u.deletionScheduledAt) return false
    if (search && !(u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()))) return false
    return true
  })

  const isOwner = user?.role === 'owner'

  return (
    <main>
      <div className="container">
        <Link href="/admin" className="btn btn-sm" style={{marginBottom:'1rem',display:'inline-flex'}}>← 관리자</Link>
        <div className="section-header">
          <h2>사용자 관리</h2>
          <p>총 {users.length}명 · 표시 {filtered.length}명</p>
        </div>
        <div className="board-filters">
          <input placeholder="이름/이메일 검색" value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:240}}/>
          {[
            ['','전체'],
            ['suspended','정지'],
            ['pending_deletion','삭제 예정'],
            ['staff','스태프'],
          ].map(([k,l]) => (
            <button key={k} className={`btn btn-sm ${filter===k?'btn-primary':''}`} onClick={()=>setFilter(k)}>{l}</button>
          ))}
        </div>

        <div className="board-wrap">
          {loading ? (
            <div style={{padding:'3rem',textAlign:'center',color:'var(--muted)',fontFamily:'var(--mono)'}}>불러오는 중...</div>
          ) : filtered.length === 0 ? (
            <div style={{padding:'3rem',textAlign:'center',color:'var(--muted)',fontFamily:'var(--mono)'}}>해당하는 사용자가 없습니다.</div>
          ) : (
            <table className="board-table">
              <thead>
                <tr>
                  <th style={{width:'200px'}}>이름</th>
                  <th>이메일</th>
                  <th style={{width:'100px'}}>등급</th>
                  <th style={{width:'90px'}}>상태</th>
                  <th style={{width:'320px'}}>액션</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const meta = ROLE_META[u.role] || ROLE_META.user
                  // 권한 규칙: owner 대상은 owner만 건드림. admin은 admin/tester/developer/owner 못 건드림.
                  const isSelf       = u.id === user.id
                  const targetIsHigh = ['owner','admin','tester','developer'].includes(u.role)
                  const canTouch     = !isSelf && (
                    isOwner ? u.role !== 'owner' || true  // owner 는 모두 가능
                            : !targetIsHigh                // admin 은 일반 user 만
                  )
                  const canTouchAdmin = !isSelf && (isOwner
                    ? (u.role === 'owner' ? false : true)  // owner 끼리는 못 건드림
                    : !targetIsHigh)
                  return (
                    <tr key={u.id}>
                      <td>
                        <Link href={`/profile/${u.id}`} style={{color:'var(--accent)'}}>{u.name}</Link>
                        {isSelf && <span style={{fontSize:'.62rem',color:'var(--muted)',marginLeft:6,fontFamily:'var(--mono)'}}>(나)</span>}
                      </td>
                      <td className="meta">{u.email}</td>
                      <td>
                        <span style={{display:'inline-block',padding:'.15rem .5rem',borderRadius:10,background:meta.color,color:meta.textColor,fontFamily:'var(--mono)',fontSize:'.65rem',fontWeight:700}}>
                          {meta.icon} {meta.label}
                        </span>
                      </td>
                      <td>
                        {u.suspended ? <span style={{color:'#e74c3c',fontFamily:'var(--mono)',fontSize:'.7rem',fontWeight:700}}>정지</span>
                          : u.deletionScheduledAt ? <span style={{color:'#e67e22',fontFamily:'var(--mono)',fontSize:'.7rem'}}>삭제예정</span>
                          : <span style={{color:'var(--admin)',fontFamily:'var(--mono)',fontSize:'.7rem'}}>활성</span>}
                      </td>
                      <td>
                        <div style={{display:'flex',gap:'.3rem',flexWrap:'wrap'}}>
                          {canTouchAdmin ? (
                            <>
                              {u.suspended
                                ? <button className="btn btn-sm" onClick={()=>onUnsuspend(u)}>정지 해제</button>
                                : <button className="btn btn-danger btn-sm" onClick={()=>onSuspend(u)}>정지</button>}
                              {u.deletionScheduledAt
                                ? <button className="btn btn-sm" onClick={()=>onCancelDelete(u)}>삭제 취소</button>
                                : <button className="btn btn-danger btn-sm" onClick={()=>onPurge(u)}>삭제 예약</button>}
                            </>
                          ) : (
                            <span style={{fontFamily:'var(--mono)',fontSize:'.62rem',color:'var(--muted)'}}>
                              {isSelf ? '본인 계정' : u.role === 'owner' ? '보호됨' : '권한 부족'}
                            </span>
                          )}
                          {isOwner && !isSelf && u.role !== 'owner' && (
                            <>
                              <button className="btn btn-sm" onClick={()=>onSetRole(u)}>등급</button>
                              <button className="btn btn-danger btn-sm" style={{borderColor:'#7f0000'}} onClick={()=>onPurgeNow(u)}>즉시삭제</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  )
}
