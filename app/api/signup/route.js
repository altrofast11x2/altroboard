import { findByEmail, createUser } from '@/lib/users'
import { isValidEmail, isSpamAccount, hasXSS, sanitize, rateLimit, getIP } from '@/lib/security'

export async function POST(req) {
  // Rate limiting: IP당 5분에 3회
  const ip = getIP(req)
  if (!rateLimit(`signup:${ip}`, 3, 5 * 60 * 1000)) {
    return Response.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: '잘못된 요청입니다' }, { status: 400 })

  const { name, email, password } = body

  // 필수값 확인
  if (!name?.trim() || !email?.trim() || !password)
    return Response.json({ error: '모든 항목을 입력하세요' }, { status: 400 })

  // 이메일 형식
  if (!isValidEmail(email))
    return Response.json({ error: '올바른 이메일 형식이 아닙니다' }, { status: 400 })

  // 비밀번호 길이
  if (password.length < 6)
    return Response.json({ error: '비밀번호는 6자 이상이어야 합니다' }, { status: 400 })

  // XSS 감지
  if (hasXSS(name) || hasXSS(email))
    return Response.json({ error: '허용되지 않는 문자가 포함되어 있습니다' }, { status: 400 })

  // 스팸/봇 계정 감지
  if (isSpamAccount(name, email))
    return Response.json({ error: '사용할 수 없는 이름 또는 이메일입니다' }, { status: 400 })

  // 닉네임 길이 제한
  const cleanName = sanitize(name.trim())
  if (cleanName.length < 2 || cleanName.length > 20)
    return Response.json({ error: '닉네임은 2~20자로 입력해주세요' }, { status: 400 })

  // 중복 이메일
  const existing = await findByEmail(email.toLowerCase().trim())
  if (existing) return Response.json({ error: '이미 사용 중인 이메일입니다' }, { status: 409 })

  const user = await createUser(cleanName, email.toLowerCase().trim(), password)
  return Response.json({ user }, { status: 201 })
}
