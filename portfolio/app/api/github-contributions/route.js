// GitHub 컨트리뷰션 캘린더
// 사용자명을 받아 GitHub 의 공개 컨트리뷰션 SVG 페이지를 파싱한다.
// 공식 REST API 는 컨트리뷰션 카운트를 제공하지 않으므로 https://github.com/users/<name>/contributions 의 HTML 파싱.
//
// 응답: { weeks: [ [ {date, count, level}, ... 7개 ], ... ], total: number, username }

import { cleanLine, getClientIp, rateLimit } from '@/lib/security'

const USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/

// 색상 단계 매핑 — GitHub 의 data-level 0~4 그대로 사용
function parseHtml(html) {
  const weeks = []
  // 각 주(week): <td class="ContributionCalendar-day" data-date="YYYY-MM-DD" data-level="N" ...>
  // 또는 옛 마크업: <rect class="day" ... data-count="N" data-date="YYYY-MM-DD" fill="..."/>
  // 새 마크업 시도
  const dayRegex = /<td[^>]*data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-level="(\d)"[^>]*>/g
  const dayItems = []
  let m
  while ((m = dayRegex.exec(html)) !== null) {
    dayItems.push({ date: m[1], level: parseInt(m[2], 10) })
  }
  if (dayItems.length === 0) {
    // 옛 마크업
    const rectRe = /<rect[^>]*data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-count="(\d+)"[^>]*data-level="(\d)"/g
    while ((m = rectRe.exec(html)) !== null) {
      dayItems.push({ date: m[1], count: parseInt(m[2], 10), level: parseInt(m[3], 10) })
    }
  }
  if (dayItems.length === 0) return { weeks: [], total: 0 }

  // tooltip 으로 count 도 추출 시도: data-date 와 매칭되는 contribution count
  if (dayItems[0].count === undefined) {
    // 새 마크업에서 count 는 <tool-tip> 또는 <span class="sr-only"> 같은 형태로 등장.
    // 간단 추출: "N contributions on YYYY-MM-DD" 패턴
    const tipRe = /(No|\d+)\s+contributions?\s+on\s+(\w+\s+\d+\w*,\s+\d+)/g
    const tipDateMap = new Map()
    while ((m = tipRe.exec(html)) !== null) {
      const num = m[1] === 'No' ? 0 : parseInt(m[1], 10)
      const dateStr = m[2]
      try {
        const d = new Date(dateStr)
        if (!isNaN(d.getTime())) tipDateMap.set(d.toISOString().slice(0, 10), num)
      } catch {}
    }
    for (const it of dayItems) {
      if (tipDateMap.has(it.date)) it.count = tipDateMap.get(it.date)
      else it.count = it.level === 0 ? 0 : null
    }
  }

  // total — 페이지 상단의 "1,234 contributions in the last year" 텍스트
  let total = 0
  const tot = html.match(/([\d,]+)\s+contributions?\s+in\s+the\s+last\s+year/i)
  if (tot) total = parseInt(tot[1].replace(/,/g, ''), 10) || 0
  if (!total) total = dayItems.reduce((s, d) => s + (d.count || 0), 0)

  // 일별 항목을 주(7일) 단위로 묶기 — 첫 항목의 요일을 기준으로 패딩
  // GitHub 페이지는 일요일 시작
  const sorted = dayItems.slice().sort((a, b) => a.date.localeCompare(b.date))
  const firstDow = new Date(sorted[0].date + 'T00:00:00Z').getUTCDay()
  let cur = new Array(firstDow).fill(null)
  for (const d of sorted) {
    cur.push(d)
    if (cur.length === 7) { weeks.push(cur); cur = [] }
  }
  if (cur.length > 0) {
    while (cur.length < 7) cur.push(null)
    weeks.push(cur)
  }
  return { weeks, total }
}

export async function GET(req) {
  if (!rateLimit(`gh-contrib:${getClientIp(req)}`, { windowMs: 60_000, max: 30 }))
    return Response.json({ error: '잠시 후 다시 시도하세요' }, { status: 429 })

  const { searchParams } = new URL(req.url)
  const raw = cleanLine(searchParams.get('username'), 39)
  if (!raw || !USERNAME_RE.test(raw))
    return Response.json({ error: '유효하지 않은 사용자명' }, { status: 400 })

  try {
    const res = await fetch(`https://github.com/users/${raw}/contributions`, {
      headers: {
        'User-Agent': 'CozyBoard/1.0 (+contributions widget)',
        'Accept': 'text/html',
      },
      cache: 'no-store',
    })
    if (!res.ok) {
      if (res.status === 404) return Response.json({ error: '존재하지 않는 사용자' }, { status: 404 })
      return Response.json({ error: '불러오기 실패' }, { status: 502 })
    }
    const html = await res.text()
    const data = parseHtml(html)
    return Response.json({ username: raw, ...data })
  } catch (e) {
    return Response.json({ error: '네트워크 오류' }, { status: 502 })
  }
}
