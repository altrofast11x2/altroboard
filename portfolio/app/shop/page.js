'use client'
import Link from 'next/link'

// 쇼핑몰 페이지 — placeholder.
// 추후 별도 주소로 분리될 예정. 지금은 /shop 라우트에 안내 페이지만.

export default function ShopPage() {
  return (
    <main>
      <div className="container" style={{ maxWidth: 720, padding: '4rem 1.5rem' }}>
        <Link href="/" className="btn btn-sm" style={{ marginBottom: '1.5rem', display: 'inline-flex' }}>← 홈으로</Link>

        <div className="card card-accent" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: 18, background: 'linear-gradient(135deg, var(--accent), #7b1a12)', color: '#fff', marginBottom: '1.25rem' }}>
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
          </div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: '1.8rem', fontWeight: 700, color: 'var(--ink)', marginBottom: '.5rem' }}>
            altroboard 쇼핑몰
          </h1>
          <p style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: '.85rem', lineHeight: 1.75, marginBottom: '1.5rem' }}>
            아직 준비 중인 페이지입니다.<br />
            가까운 시일 내에 별도 주소로 정식 오픈할 예정입니다.
          </p>
          <p style={{ color: 'var(--muted)', fontSize: '.82rem', lineHeight: 1.7, marginBottom: '2rem' }}>
            altroboard 굿즈, 디지털 상품, 그리고 사용자 분들이 직접 등록하는 마켓플레이스를 준비하고 있습니다.
            오픈 시 공지사항으로 안내드리겠습니다.
          </p>
          <Link href="/" className="btn btn-primary">홈으로 돌아가기</Link>
        </div>

        <div style={{ marginTop: '2rem', padding: '1rem 1.25rem', background: 'var(--surface2)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: '.72rem', color: 'var(--muted)', lineHeight: 1.7 }}>
          소식을 가장 먼저 받고 싶다면 게시판의 [공지] 카테고리를 팔로우하거나, 알림을 켜두세요.
        </div>
      </div>
    </main>
  )
}
