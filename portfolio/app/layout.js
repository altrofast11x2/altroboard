import './globals.css'
import NavBar from './components/NavBar'
import LoadingScreen from './components/LoadingScreen'

export const metadata = {
  title: 'CozyBoard',
  description: '김현준의 개인 홈페이지 & 게시판',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <LoadingScreen />
        <NavBar />
        {children}
      </body>
    </html>
  )
}
