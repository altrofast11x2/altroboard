'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './games.module.css'

const GAMES = [
  { id:'agar',      name:'agar.io',        desc:'실시간 멀티플레이 · 먹어서 자라기',  icon:'◯', color:'#5b8dee', available:true, href:'/agar' },
  { id:'slither',   name:'slither.io',     desc:'실시간 멀티플레이 · 뱀으로 자라기',  icon:'§', color:'#27ae60', available:true, href:'/slither' },
  { id:'diep',      name:'diep.io',        desc:'실시간 멀티플레이 · 탱크 전투',      icon:'◊', color:'#3498db', available:true, href:'/diep' },
  { id:'chess',     name:'Chess',          desc:'온라인 체스 · AI 대국',              icon:'♞', color:'#769656', available:true, href:'/chess' },
  { id:'poker',     name:"Texas Hold'em",  desc:'실시간 멀티플레이어 포커',           icon:'♠', color:'#c9a84c', available:true, href:'/poker' },
]

export default function GamesPage() {
  const router = useRouter()
  return (
    <div className={styles.wrap}>
      <div style={{padding:'1rem 1.5rem'}}>
        <Link href="/" className="btn btn-sm">← 홈으로</Link>
      </div>
      <div className={styles.hero}>
        <h1 className={styles.title}>Game Center</h1>
        <p className={styles.sub}>즐길 게임을 선택하세요</p>
      </div>
      <div className={styles.grid}>
        {GAMES.map(g => (
          <div key={g.id} className={`${styles.card} ${!g.available?styles.soon:''}`}
            onClick={() => g.available && router.push(g.href)}
            style={{'--gcolor':g.color}}>
            <div className={styles.cardIcon}>{g.icon}</div>
            <div className={styles.cardName}>{g.name}</div>
            <div className={styles.cardDesc}>{g.desc}</div>
            {!g.available
              ? <div className={styles.soonBadge}>COMING SOON</div>
              : <div className={styles.playBtn}>플레이</div>
            }
          </div>
        ))}
      </div>
    </div>
  )
}
