// ── 입력값 sanitize ──────────────────────────────────────────
export function sanitize(str) {
  if (typeof str !== 'string') return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
}

// HTML 태그 완전 제거 (DB 저장용)
export function stripTags(str) {
  if (typeof str !== 'string') return ''
  return str.replace(/<[^>]*>/g, '').trim()
}

// ── XSS/스크립트 감지 ────────────────────────────────────────
export function hasXSS(str) {
  if (typeof str !== 'string') return false
  const patterns = [
    /<script[\s\S]*?>/i,
    /javascript\s*:/i,
    /on\w+\s*=\s*['"]/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /eval\s*\(/i,
    /document\.cookie/i,
    /localStorage/i,
    /fetch\s*\(/i,
    /XMLHttpRequest/i,
  ]
  return patterns.some(p => p.test(str))
}

// ── 스팸 계정 감지 ───────────────────────────────────────────
export function isSpamAccount(name, email) {
  const spamNames = ['admin', 'administrator', 'root', 'system', 'test', 'bot', 'hack', 'spam']
  const spamEmails = ['@admin', 'admin@', 'root@', 'test@test', 'spam@']
  const nameLower = (name || '').toLowerCase()
  const emailLower = (email || '').toLowerCase()
  if (spamNames.some(s => nameLower.includes(s))) return true
  if (spamEmails.some(s => emailLower.includes(s))) return true
  return false
}

// ── 이메일 형식 검증 ─────────────────────────────────────────
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
}

// ── Rate limiting (메모리 기반, 서버리스라 재시작 시 초기화) ──
const rateLimitMap = new Map()
export function rateLimit(key, maxRequests = 5, windowMs = 60000) {
  const now = Date.now()
  const record = rateLimitMap.get(key) || { count: 0, resetAt: now + windowMs }
  if (now > record.resetAt) {
    record.count = 0
    record.resetAt = now + windowMs
  }
  record.count++
  rateLimitMap.set(key, record)
  return record.count <= maxRequests
}

// IP 추출
export function getIP(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}
