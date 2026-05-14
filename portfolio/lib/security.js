// ─────────────────────────────────────────────────────────
// 입력 검증 · 새니타이즈 유틸리티
// XSS, 인젝션, 페이로드 폭주를 막기 위한 공통 모듈.
// 모든 API route, 서버측 createX/updateX는 이 모듈을 사용합니다.
// ─────────────────────────────────────────────────────────

// 컨트롤 문자 제거 (NULL, BEL 등 — DB/UI 깨짐 방지)
// \t (0x09) \n (0x0A) \r (0x0D) 는 보존. 그 외 0x00-0x1F 및 0x7F 제거.
function stripControl(s) {
  let out = ''
  const str = String(s)
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    if (c === 0x09 || c === 0x0A || c === 0x0D) { out += str[i]; continue }
    if (c < 0x20 || c === 0x7F) continue
    out += str[i]
  }
  return out
}

// HTML 엔티티 이스케이프 (서버측 백업; React JSX 는 기본적으로 이스케이프함)
export function escapeHtml(s) {
  if (s === null || s === undefined) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// 일반 텍스트 정리 (DB 저장용) — 줄바꿈 보존
export function cleanText(value, maxLen = 2000) {
  if (value === null || value === undefined) return ''
  const s = stripControl(String(value)).trim()
  return s.slice(0, maxLen)
}

// 한 줄 텍스트 (제목/이름 등) — 줄바꿈 제거
export function cleanLine(value, maxLen = 120) {
  if (value === null || value === undefined) return ''
  const s = stripControl(String(value)).replace(/[\r\n\t]+/g, ' ').trim()
  return s.slice(0, maxLen)
}

// 식별자 (Firebase 키, userId 등) — 영숫자, dash, underscore, dot, colon
export function cleanId(value) {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  if (!/^[A-Za-z0-9_\-:.]{1,64}$/.test(s)) return null
  return s
}

// 이메일 정규화 + 검증
const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,255}\.[^\s@<>"']{1,32}$/
export function cleanEmail(value) {
  if (!value) return null
  const s = String(value).trim().toLowerCase()
  if (s.length > 254 || !EMAIL_RE.test(s)) return null
  return s
}

// 카테고리 (허용 목록만)
export function cleanEnum(value, allowed, fallback = null) {
  const s = value == null ? '' : String(value)
  return allowed.includes(s) ? s : fallback
}

// URL 검증 — http/https/data 만 허용. javascript:, vbscript:, file: 차단
export function cleanUrl(value, { allowData = false } = {}) {
  if (!value) return null
  const s = String(value).trim()
  if (!s) return null
  if (/^\s*javascript:/i.test(s) || /^\s*vbscript:/i.test(s) || /^\s*file:/i.test(s)) return null
  if (allowData && /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(s)) return s
  try {
    const u = new URL(s)
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString()
  } catch {}
  return null
}

// 정수 검증
export function cleanInt(value, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER, fallback = null } = {}) {
  const n = Number.parseInt(value, 10)
  if (!Number.isFinite(n)) return fallback
  if (n < min || n > max) return fallback
  return n
}

// 불리언
export function cleanBool(value) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

// 비정상적으로 깊거나 큰 객체로 인한 가공/직렬화 공격 가드
export function isSafeShallowObject(obj, maxKeys = 32) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false
  const keys = Object.keys(obj)
  if (keys.length > maxKeys) return false
  for (const k of keys) {
    if (!/^[A-Za-z0-9_\-]{1,64}$/.test(k)) return false
    const v = obj[k]
    if (v && typeof v === 'object') return false
  }
  return true
}

// JSON 본문 안전 파싱 — 크기 제한 + 파싱 실패 시 null
export async function safeJson(req, { maxBytes = 512 * 1024 } = {}) {
  try {
    const text = await req.text()
    if (text.length > maxBytes) return null
    return JSON.parse(text)
  } catch {
    return null
  }
}

// 비밀번호 정책
export function validatePassword(pw) {
  if (typeof pw !== 'string') return '비밀번호 형식이 잘못되었습니다'
  if (pw.length < 8)   return '비밀번호는 8자 이상이어야 합니다'
  if (pw.length > 128) return '비밀번호가 너무 깁니다'
  if (!/[A-Za-z]/.test(pw)) return '비밀번호에 영문자가 포함되어야 합니다'
  if (!/[0-9]/.test(pw))    return '비밀번호에 숫자가 포함되어야 합니다'
  return null
}

export function cleanDisplayName(value) {
  const s = cleanLine(value, 24)
  if (s.length < 1) return null
  return s
}

// 요청 IP — rate limit 등에 사용
export function getClientIp(req) {
  const h = req.headers
  const xf = h.get('x-forwarded-for')
  if (xf) return xf.split(',')[0].trim()
  return h.get('x-real-ip') || 'unknown'
}

// 매우 단순한 IP 기반 슬라이딩 윈도우 (메모리)
const rateBucket = new Map()
export function rateLimit(key, { windowMs = 10_000, max = 20 } = {}) {
  const now = Date.now()
  const arr = rateBucket.get(key) || []
  const filtered = arr.filter(t => now - t < windowMs)
  filtered.push(now)
  rateBucket.set(key, filtered)
  if (rateBucket.size > 5000) {
    for (const [k, v] of rateBucket.entries()) {
      if (v.every(t => now - t > windowMs)) rateBucket.delete(k)
    }
  }
  return filtered.length <= max
}

// CSP/공통 보안 헤더 — next.config.ts headers() 에서 사용
export const SECURITY_HEADERS = [
  { key: 'X-Frame-Options',        value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-XSS-Protection',       value: '1; mode=block' },
]

// SHA-256 헬퍼
export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// 비밀번호 해시 (단방향)
export async function hashPassword(plain, salt = '') {
  return sha256Hex(`v1$${salt}$${plain}`)
}
