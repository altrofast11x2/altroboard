// CozyBoard 챗봇 — Anthropic Claude API 기반
// 환경변수:
//   ANTHROPIC_API_KEY=sk-ant-...
//   ANTHROPIC_MODEL=claude-haiku-4-5-20251001 (기본)
//
// 요청: { messages: [{ role: 'user'|'assistant', content: string }, ...] }
// 응답: { reply: string }
//
// API 키가 없으면 간단한 룰베이스 폴백을 사용한다.

import {
  safeJson, cleanText, cleanEnum,
  getClientIp, rateLimit,
} from '@/lib/security'

const MAX_TURNS = 16
const MAX_CHARS_PER_MSG = 1200
const MAX_TOKENS_REPLY = 600

const SYSTEM_PROMPT = `당신은 CozyBoard 사이트의 친근한 챗봇 도우미입니다.
CozyBoard 는 김현준(서울디지털고등학교 학생)이 만든 개인 홈페이지 겸 커뮤니티입니다.
주요 기능: 게시판, 갤러리(클럽), 스토리, 쇼츠, 포커/체스/블랙잭/룰렛 미니게임, 채팅, 메시지.

대화 규칙:
- 항상 한국어로, 짧고 친근하게 답하세요. 2~4문장이 적당합니다.
- 사이트 사용법을 물으면 어디로 가야 하는지 (예: "상단 메뉴의 '쇼츠'") 알려주세요.
- 정치/혐오/성인 콘텐츠/개인정보 추출 요청은 정중히 거절하세요.
- 모르는 것은 모른다고 솔직히 답하세요.
- 코드/기술 질문도 환영합니다. 답은 핵심만 짧게.`

// 룰베이스 폴백 (API 키가 없거나 호출 실패 시)
function fallbackReply(userText) {
  const t = userText.toLowerCase()
  if (/(안녕|하이|hello|hi)/.test(t)) return '안녕하세요! CozyBoard 챗봇이에요. 무엇을 도와드릴까요?'
  if (/(쇼츠|shorts)/.test(t))       return '상단 메뉴 "쇼츠" 에서 짧은 영상을 볼 수 있어요. 로그인 후 + 업로드 버튼으로 직접 영상도 올릴 수 있어요!'
  if (/(갤러리|클럽|모임)/.test(t)) return '상단 메뉴 "갤러리" 에서 관심사별 작은 모임을 만들거나 가입할 수 있어요. 가입 후 글쓰기가 가능해요.'
  if (/(게임|블랙잭|룰렛|체스|포커)/.test(t)) return '상단 "게임" 메뉴에서 포커·체스·블랙잭·룰렛을 플레이할 수 있어요. 칩은 로컬에 저장됩니다.'
  if (/(게시판|글|board)/.test(t))  return '상단 메뉴 "게시판" 에서 글을 보고, 로그인 후 글쓰기가 가능해요.'
  if (/(github|깃허브|컨트리뷰션)/.test(t)) return '"외부데이터" 페이지에서 GitHub 사용자의 1년 컨트리뷰션을 잔디 그래프로 볼 수 있어요.'
  if (/(스토리|story)/.test(t))     return '"스토리" 메뉴는 24시간 동안만 공개되는 짧은 메모예요. 인스타 스토리와 비슷합니다.'
  if (/(메시지|채팅|chat)/.test(t)) return '로그인 후 다른 사용자 프로필에서 메시지를 보낼 수 있어요. 상단 종 아이콘에 새 메시지가 표시됩니다.'
  if (/(만든|개발자|제작자|누가)/.test(t)) return 'CozyBoard 는 서울디지털고등학교 학생 김현준이 만들었어요. Next.js + Firebase 로 구현되었어요.'
  return '죄송해요, 챗봇 서버에 연결할 수 없어 자동 응답으로 답하고 있어요. 좀 더 구체적으로 질문해 주시면 도울 수 있을지도 몰라요!'
}

async function callClaude(messages) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001'

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS_REPLY,
      system: SYSTEM_PROMPT,
      messages,
    }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    console.error('Anthropic API error', res.status, txt.slice(0, 200))
    return null
  }
  const data = await res.json()
  const text = data?.content?.[0]?.text
  return typeof text === 'string' ? text.trim() : null
}

export async function POST(req) {
  if (!rateLimit(`chatbot:${getClientIp(req)}`, { windowMs: 60_000, max: 20 }))
    return Response.json({ reply: '잠시 후 다시 시도해 주세요!' }, { status: 429 })

  const body = await safeJson(req, { maxBytes: 64 * 1024 })
  if (!body || !Array.isArray(body.messages))
    return Response.json({ reply: '요청 형식이 잘못되었어요.' }, { status: 400 })

  const messages = body.messages
    .filter(m => m && typeof m.content === 'string')
    .slice(-MAX_TURNS)
    .map(m => ({
      role: cleanEnum(m.role, ['user', 'assistant'], 'user'),
      content: cleanText(m.content, MAX_CHARS_PER_MSG),
    }))
    .filter(m => m.content)

  if (messages.length === 0)
    return Response.json({ reply: '메시지를 입력해 주세요.' }, { status: 400 })

  // 마지막 메시지는 반드시 user 여야 한다 — Claude 의 요구사항
  if (messages[messages.length - 1].role !== 'user')
    return Response.json({ reply: '요청 형식이 잘못되었어요.' }, { status: 400 })

  let reply = null
  try {
    reply = await callClaude(messages)
  } catch (e) {
    console.error('chatbot call failed', e)
  }
  if (!reply) {
    const lastUser = messages[messages.length - 1].content
    reply = fallbackReply(lastUser)
  }

  return Response.json({ reply })
}
