// 비밀번호 복구
// mode='oldPassword': 이전에 사용했던 비밀번호로 재설정
// mode='requestEmail': 이메일로 일회용 토큰 발급 (실제 메일 발송 미구현 — 개발 단계엔 토큰 반환)
// mode='resetWithToken': 토큰으로 재설정

import { recoverByOldPassword, requestEmailReset, resetPasswordWithToken } from '@/lib/users'
import {
  safeJson, cleanEmail, cleanId, cleanEnum, validatePassword,
  getClientIp, rateLimit,
} from '@/lib/security'

export async function POST(req) {
  if (!rateLimit(`recover:${getClientIp(req)}`, { windowMs: 60_000, max: 6 }))
    return Response.json({ error: '잠시 후 다시 시도하세요' }, { status: 429 })

  const body = await safeJson(req, { maxBytes: 4 * 1024 })
  if (!body) return Response.json({ error: '요청 형식이 잘못되었습니다' }, { status: 400 })

  const mode = cleanEnum(body.mode, ['oldPassword', 'requestEmail', 'resetWithToken'])
  if (!mode) return Response.json({ error: '잘못된 요청' }, { status: 400 })

  if (mode === 'oldPassword') {
    const email = cleanEmail(body.email)
    const oldPw = typeof body.oldPassword === 'string' ? body.oldPassword : ''
    const newPw = typeof body.newPassword === 'string' ? body.newPassword : ''
    if (!email || !oldPw || !newPw) return Response.json({ error: '필수 정보 누락' }, { status: 400 })
    const pwErr = validatePassword(newPw)
    if (pwErr) return Response.json({ error: pwErr }, { status: 400 })
    const r = await recoverByOldPassword(email, oldPw, newPw)
    if (r.error) return Response.json(r, { status: 400 })
    return Response.json(r)
  }

  if (mode === 'requestEmail') {
    const email = cleanEmail(body.email)
    if (!email) return Response.json({ error: '이메일을 입력하세요' }, { status: 400 })
    const r = await requestEmailReset(email)
    if (r.error) {
      // 보안상 존재 여부 노출 안 함 — 동일한 응답으로 위장
      return Response.json({ ok: true })
    }
    // 운영 환경에서는 이메일로 발송해야 함. 현재는 개발 단계라 토큰 정보 반환.
    // TODO: SendGrid/Resend 등으로 메일 발송
    return Response.json({
      ok: true,
      _dev: { token: r.token, uid: r.uid, expiresAt: r.expiresAt, note: '운영 시 이메일로 발송 필요' },
    })
  }

  if (mode === 'resetWithToken') {
    const uid = cleanId(body.uid)
    const token = typeof body.token === 'string' ? body.token.trim().slice(0, 64) : ''
    const newPw = typeof body.newPassword === 'string' ? body.newPassword : ''
    if (!uid || !token || !newPw) return Response.json({ error: '필수 정보 누락' }, { status: 400 })
    const pwErr = validatePassword(newPw)
    if (pwErr) return Response.json({ error: pwErr }, { status: 400 })
    const r = await resetPasswordWithToken(uid, token, newPw)
    if (r.error) return Response.json(r, { status: 400 })
    return Response.json(r)
  }

  return Response.json({ error: '알 수 없는 모드' }, { status: 400 })
}
