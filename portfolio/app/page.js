'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import StoryStrip from './components/StoryStrip'

const skills = [
  { name: 'HTML / CSS', level: 90 },
  { name: 'JavaScript', level: 82 },
  { name: 'PHP / MVC', level: 75 },
  { name: 'Node.js', level: 68 },
  { name: 'MySQL', level: 65 },
  { name: 'React / Next.js', level: 60 },
]

const projects = [
  { title: 'CozyBoard', desc: '파일 기반 익명 게시판 → Firebase 연동 풀스택으로 확장', tag: 'Next.js' },
  { title: 'MVC 좌석예약', desc: 'PHP MVC 패턴으로 구현한 좌석 예약 시스템', tag: 'PHP' },
  { title: '도서관 현황', desc: 'SVG 맵 + 바 차트 + 검색/정렬 테이블', tag: 'PHP' },
]

export default function Home() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <main>
      {/* HERO */}
      <div className="container">
        <div className="hero fade-up">
          <p className="hero-label">Full Stack Developer in Progress</p>
          <h1>안녕하세요,<br />김현준입니다</h1>
          <p>서울디지털고등학교에서 웹 개발과 디자인을 공부하고 있습니다.<br />사용자 경험을 최우선으로 생각하는 개발자가 되기 위해 노력 중입니다.</p>
          <div className="hero-btns">
            <Link href="/board" className="btn btn-primary">게시판 보기</Link>
            <Link href="/study" className="btn">학습 기록</Link>
          </div>
        </div>

        {/* ── STORY STRIP ── */}
        <StoryStrip />

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.5rem',marginBottom:'3rem'}} className="grid-resp">
          {/* SKILLS */}
          <div className="card card-accent">
            <div className="section-header">
              <h2>기술 스택</h2>
              <p>현재 학습 중인 기술들</p>
            </div>
            {skills.map(s => (
              <div className="skill-bar" key={s.name}>
                <div className="skill-bar-label">
                  <span>{s.name}</span>
                  <span>{s.level}%</span>
                </div>
                <div className="skill-bar-track">
                  <div className="skill-bar-fill" style={{width: mounted ? `${s.level}%` : '0%'}} />
                </div>
              </div>
            ))}
          </div>

          {/* PROJECTS */}
          <div>
            <div className="section-header">
              <h2>주요 프로젝트</h2>
              <p>수업 및 개인 작업</p>
            </div>
            {projects.map(p => (
              <div className="card" key={p.title} style={{marginBottom:'0.75rem'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.35rem'}}>
                  <strong style={{fontFamily:'var(--serif)',fontSize:'0.95rem'}}>{p.title}</strong>
                  <span className="badge badge-red">{p.tag}</span>
                </div>
                <p style={{fontSize:'0.82rem',color:'var(--muted)',lineHeight:1.6}}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CONTACT */}
        <div className="card" style={{display:'flex',gap:'2rem',flexWrap:'wrap',alignItems:'center',marginBottom:'3rem'}}>
          {[
            ['주소','서울특별시 용산구 회나무로12길 27'],
            ['연락처','@altrofast11x2'],
            ['이메일','sdhs250306@sdh.hs.kr'],
          ].map(([k,v]) => (
            <div key={k}>
              <div style={{fontFamily:'var(--mono)',fontSize:'0.7rem',color:'var(--muted)',marginBottom:'0.2rem'}}>{k}</div>
              <div style={{fontSize:'0.88rem'}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <footer style={{borderTop:'1px solid var(--border)',padding:'1.5rem',textAlign:'center',fontFamily:'var(--mono)',fontSize:'0.72rem',color:'var(--muted)'}}>
        CozyBoard Copyright By © kazinobel
      </footer>

      <style>{`.grid-resp{} @media(max-width:640px){.grid-resp{grid-template-columns:1fr!important;}}`}</style>
    </main>
  )
}
