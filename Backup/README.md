# hyeonjun.dev — 개인 홈페이지

Next.js App Router 기반 풀스택 개인 홈페이지

## 기능

- **홈**: 스킬 진행 바, 프로젝트 카드, 통계
- **게시판**: 글 목록/상세/작성/삭제, 카테고리 필터, 검색
- **학습 기록**: 타임라인 형태의 공부 이력
- **외부 데이터**: 날씨(Open-Meteo), GitHub API, 환율(Open Exchange Rates)
- **로그인**: 관리자/방문자 계정 분리

## 로컬 실행

```bash
npm install
npm run dev
# http://localhost:3000
```

## Vercel 배포

```bash
npm i -g vercel
vercel --prod
```

또는 GitHub 연결 후 자동 배포

## 테스트 계정

| 역할 | 이메일 | 비밀번호 |
|------|--------|----------|
| 관리자 | hyeonjun@example.com | password123 |
| 방문자 | guest@example.com | guest123 |

## 기술 스택

- **프레임워크**: Next.js 15 (App Router)
- **스타일**: 커스텀 CSS (Syne + IBM Plex Mono + Noto Sans KR)
- **배포**: Vercel
- **외부 API**: Open-Meteo, GitHub REST API, Open Exchange Rates

## 데이터 영구 저장 (선택)

현재는 인메모리 저장소 사용 (서버 재시작 시 초기화).  
영구 저장이 필요하면 Vercel KV 또는 PlanetScale 연동 필요.

```bash
# Vercel KV 연동 시
npm install @vercel/kv
# vercel.json에 KV 설정 추가
```
