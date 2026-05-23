// 간단한 i18n 헬퍼.
//
// 사용:
//   import { useI18n, t } from '@/lib/i18n'
//   const { lang, t } = useI18n()
//   t('story.empty')
//
// 우선순위: localStorage('cozyboard_lang') > navigator.language > 'en'
// 지원: ko / en / ja
//
// 키 누락 시 영어 → 키 자체 순으로 폴백.

import { useEffect, useState } from 'react'

export const SUPPORTED = ['ko', 'en', 'ja']
export const STORAGE_KEY = 'cozyboard_lang'

// 디바이스/브라우저 언어 감지
export function detectSystemLang() {
  if (typeof navigator === 'undefined') return 'en'
  const langs = navigator.languages && navigator.languages.length
    ? navigator.languages
    : [navigator.language || 'en']
  for (const l of langs) {
    const code = String(l || '').slice(0, 2).toLowerCase()
    if (SUPPORTED.includes(code)) return code
  }
  return 'en'
}

// 현재 적용 언어 — 저장값 > 시스템 > 'en'
export function getLang() {
  if (typeof window === 'undefined') return 'en'
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && SUPPORTED.includes(saved)) return saved
  } catch {}
  return detectSystemLang()
}

export function setLang(lang) {
  if (typeof window === 'undefined') return
  if (!SUPPORTED.includes(lang)) return
  try { localStorage.setItem(STORAGE_KEY, lang) } catch {}
  // 같은 페이지의 모든 useI18n 구독자에게 알림
  try { window.dispatchEvent(new CustomEvent('altro:langchange', { detail: lang })) } catch {}
}

// 사전 — 핵심 UI 텍스트. 점진적으로 확장.
const DICT = {
  ko: {
    // NavBar
    'nav.home': '홈',
    'nav.about': '소개',
    'nav.board': '게시판',
    'nav.galleries': '갤러리',
    'nav.study': '학습',
    'nav.data': '외부데이터',
    'nav.shorts': '쇼츠',
    'nav.games': '게임',
    'nav.msg': '메시지',
    'nav.mypage': '마이페이지',
    'nav.settings': '설정',
    'nav.adminPanel': '관리자',
    'nav.logout': '로그아웃',
    'nav.login': '로그인',
    'nav.menu': '메뉴',
    'nav.more': '더 보기',
    'nav.otherApps': 'Altro 다른 앱',
    'nav.shop': '쇼핑몰',
    'nav.activity': '내 활동',
    'nav.saved': '저장됨',
    'nav.themeToggle': '모드 전환',
    'nav.report': '문제 신고',
    'nav.switchAccount': '계정 전환',
    'nav.search': '검색',
    'nav.adminMode': '관리자 모드 — 게시글 삭제 · 사용자 정지 · 신고 처리 가능',
    // Story
    'story.title': '스토리',
    'story.empty': '아직 스토리가 없어요',
    'story.create': '스토리 작성',
    'story.viewAll': '전체 보기',
    // 공통
    'common.feed': '피드',
    'common.feedAll': '전체 게시판',
    'common.loading': '불러오는 중...',
    'common.noPosts': '아직 게시글이 없습니다',
    'common.firstPost': '첫 글을 작성해보세요',
    'common.like': '좋아요',
    'common.likes': '좋아요',
    'common.comment': '댓글',
    'common.share': '공유',
    'common.save': '저장',
    'common.follow': '팔로우',
    'common.following': '팔로잉',
    'common.viewComments': '댓글 보기',
    'common.views': '조회',
    'common.copied': '링크 복사됨',
    // 로그인 안내
    'login.heart': '게시글이 마음에 드시나요?',
    'login.body': '로그인하면 좋아요, 댓글, 메시지 기능을 모두 사용할 수 있어요.',
    'login.do': '로그인',
    'common.close': '닫기',
  },
  en: {
    'nav.home': 'Home',
    'nav.about': 'About',
    'nav.board': 'Board',
    'nav.galleries': 'Galleries',
    'nav.study': 'Study',
    'nav.data': 'Data',
    'nav.shorts': 'Shorts',
    'nav.games': 'Games',
    'nav.msg': 'Messages',
    'nav.mypage': 'My Page',
    'nav.settings': 'Settings',
    'nav.adminPanel': 'Admin',
    'nav.logout': 'Logout',
    'nav.login': 'Login',
    'nav.menu': 'Menu',
    'nav.more': 'More',
    'nav.otherApps': "Altro's other apps",
    'nav.shop': 'Shop',
    'nav.activity': 'Your activity',
    'nav.saved': 'Saved',
    'nav.themeToggle': 'Switch appearance',
    'nav.report': 'Report a problem',
    'nav.switchAccount': 'Switch accounts',
    'nav.search': 'Search',
    'nav.adminMode': 'Admin mode — manage posts, suspend users, handle reports',
    'story.title': 'Stories',
    'story.empty': 'No stories yet',
    'story.create': 'Create story',
    'story.viewAll': 'View all',
    'common.feed': 'Feed',
    'common.feedAll': 'Full board',
    'common.loading': 'Loading...',
    'common.noPosts': 'No posts yet',
    'common.firstPost': 'Write the first post',
    'common.like': 'Like',
    'common.likes': 'likes',
    'common.comment': 'Comment',
    'common.share': 'Share',
    'common.save': 'Save',
    'common.follow': 'Follow',
    'common.following': 'Following',
    'common.viewComments': 'View comments',
    'common.views': 'views',
    'common.copied': 'Link copied',
    'login.heart': 'Like this post?',
    'login.body': 'Log in to use likes, comments, and messages.',
    'login.do': 'Log in',
    'common.close': 'Close',
  },
  ja: {
    'nav.home': 'ホーム',
    'nav.about': '紹介',
    'nav.board': '掲示板',
    'nav.galleries': 'ギャラリー',
    'nav.study': '学習',
    'nav.data': '外部データ',
    'nav.shorts': 'ショート',
    'nav.games': 'ゲーム',
    'nav.msg': 'メッセージ',
    'nav.mypage': 'マイページ',
    'nav.settings': '設定',
    'nav.adminPanel': '管理者',
    'nav.logout': 'ログアウト',
    'nav.login': 'ログイン',
    'nav.menu': 'メニュー',
    'nav.more': 'もっと見る',
    'nav.otherApps': 'Altro の他のアプリ',
    'nav.shop': 'ショップ',
    'nav.activity': 'アクティビティ',
    'nav.saved': '保存済み',
    'nav.themeToggle': '表示モード切替',
    'nav.report': '問題を報告',
    'nav.switchAccount': 'アカウント切替',
    'nav.search': '検索',
    'nav.adminMode': '管理者モード — 投稿削除・ユーザー停止・通報処理可能',
    'story.title': 'ストーリー',
    'story.empty': 'まだストーリーがありません',
    'story.create': 'ストーリーを作成',
    'story.viewAll': 'すべて見る',
    'common.feed': 'フィード',
    'common.feedAll': '全掲示板',
    'common.loading': '読み込み中...',
    'common.noPosts': 'まだ投稿がありません',
    'common.firstPost': '最初の投稿を書いてみましょう',
    'common.like': 'いいね',
    'common.likes': 'いいね',
    'common.comment': 'コメント',
    'common.share': '共有',
    'common.save': '保存',
    'common.follow': 'フォロー',
    'common.following': 'フォロー中',
    'common.viewComments': 'コメントを見る',
    'common.views': '閲覧',
    'common.copied': 'リンクをコピーしました',
    'login.heart': 'この投稿が気に入りましたか？',
    'login.body': 'ログインするといいね、コメント、メッセージが使えます。',
    'login.do': 'ログイン',
    'common.close': '閉じる',
  },
}

export function translate(key, lang) {
  const L = SUPPORTED.includes(lang) ? lang : 'en'
  return (DICT[L] && DICT[L][key]) || (DICT.en && DICT.en[key]) || key
}

// React hook — lang 변경 시 자동 리렌더
export function useI18n() {
  const [lang, setLangState] = useState(() => 'en')   // SSR-safe 기본값

  useEffect(() => {
    setLangState(getLang())
    const onChange = () => setLangState(getLang())
    window.addEventListener('altro:langchange', onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener('altro:langchange', onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  return {
    lang,
    setLang: (l) => { setLang(l); setLangState(l) },
    t: (key) => translate(key, lang),
  }
}
