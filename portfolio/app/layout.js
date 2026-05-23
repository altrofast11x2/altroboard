import './globals.css'
import NavBar from './components/NavBar'
import LoadingScreen from './components/LoadingScreen'
import MessageNotification from './components/MessageNotification'
import DevToolsGuard from './components/DevToolsGuard'
import MessageFab from './components/MessageFab'

export const metadata = {
  title: 'Altro',
  description: 'Altro — 개인 SNS · 커뮤니티',
}

// 페이지 로드 시 즉시 테마 적용 (FOUC 방지) — head 에 인라인 스크립트로 삽입
const THEME_BOOTSTRAP = `
(function(){try{
  var t = localStorage.getItem('altroboard_theme') || 'light';
  if (t === 'auto') t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
}catch(e){}})();
`

export default function RootLayout({ children }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body suppressHydrationWarning>
        <LoadingScreen />
        <DevToolsGuard />
        <div className="app-shell">
          <NavBar />
          <div className="app-content">
            <MessageNotification />
            {children}
          </div>
        </div>
        {/* 전역 메시지 플로팅 버튼 — 컴포넌트 안에서 로그인/페이지 가드 처리 */}
        <MessageFab />
      </body>
    </html>
  )
}
