// 인증 사용자(verified) 별 배지 — 사용자 이름 옆에 공용으로 붙임
export default function VerifiedBadge({ size = 14, color = '#2980b9' }) {
  return (
    <span
      title="인증된 사용자"
      style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', flexShrink: 0 }}
      aria-label="인증된 사용자"
    >
      <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
        <path d="M12 1l3.09 2.26L18.5 2.5l.74 3.41L22 8l-2.26 3.09L20.5 14.5l-3.41.74L16 18l-3.09-2.26L9.5 16.5 8.76 13.09 6 11l2.26-3.09L7.5 4.5l3.41-.74z"/>
      </svg>
    </span>
  )
}
