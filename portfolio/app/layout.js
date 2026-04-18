import './globals.css'
import NavBar from './components/NavBar'

export const metadata = {
  title: 'CozyBoard',
  description: '김현준의 개인 홈페이지 & 게시판',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <NavBar />
        {children}
      </body>
    </html>
  )
}
