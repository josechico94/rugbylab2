import { Outlet, useLocation, NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import Sidebar from './Sidebar'
import { Avatar } from './ui'

const METAS: Record<string,{title:string;sub:string}> = {
  '/':               {title:'Dashboard',    sub:'Riepilogo generale del club'},
  '/plantel':        {title:'Rosa',         sub:'Profili e stato della squadra'},
  '/gimnasio':       {title:'Palestra',     sub:'Pianificazione fisica'},
  '/nutricion':      {title:'Nutrizione',   sub:'Piano alimentare'},
  '/entrenamientos': {title:'Allenamenti',  sub:'Libreria video'},
  '/comunicacion':   {title:'Comunicazioni',sub:'Bacheca del club'},
  '/estadisticas':   {title:'Statistiche',  sub:'Rendimento nelle partite'},
  '/medico':         {title:'Area Medica',  sub:'Infortuni e monitoraggio'},
  '/calendario':     {title:'Calendario',   sub:'Eventi e partite'},
  '/tactica':        {title:'Tattica',      sub:'rugbyboardpro.com'},
  '/logistica':      {title:'Logistica',    sub:'Convocazioni e Fantasy'},
  '/admin/usuarios': {title:'Utenti',       sub:'Gestione degli accessi'},
}

/* ── SVG icons for mobile bottom nav ────────────── */
const IconHome = () => (
  <svg viewBox="0 0 18 18" fill="none">
    <rect x="1" y="1" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="10" y="1" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="1" y="10" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="10" y="10" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
)
const IconRosa = () => (
  <svg viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M3 16c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)
const IconCalendario = () => (
  <svg viewBox="0 0 18 18" fill="none">
    <rect x="2" y="3" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M6 1v4M12 1v4M2 8h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)
const IconStats = () => (
  <svg viewBox="0 0 18 18" fill="none">
    <path d="M2 14l4-5 4 3 4-7 2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IconLogistica = () => (
  <svg viewBox="0 0 18 18" fill="none">
    <rect x="1" y="6" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M5 6V4a4 4 0 018 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

const TABS = [
  {to:'/',             icon:<IconHome/>,      label:'Home'},
  {to:'/plantel',      icon:<IconRosa/>,      label:'Rosa'},
  {to:'/calendario',   icon:<IconCalendario/>,label:'Agenda'},
  {to:'/estadisticas', icon:<IconStats/>,     label:'Stats'},
  {to:'/logistica',    icon:<IconLogistica/>, label:'Club'},
]

function useIsMobile() {
  const [v, set] = useState(() => typeof window !== 'undefined' && window.innerWidth < 769)
  useEffect(() => {
    const mq = window.matchMedia('(max-width:768px)')
    const h = (e: MediaQueryListEvent) => set(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return v
}

/* ── Bell icon ── */
const IconBell = () => (
  <svg viewBox="0 0 20 20" fill="none" style={{width:18,height:18}}>
    <path d="M10 2a6 6 0 016 6v3l2 2H2l2-2V8a6 6 0 016-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M8 16a2 2 0 004 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

/* ── Search icon ── */
const IconSearch = () => (
  <svg viewBox="0 0 18 18" fill="none" style={{width:15,height:15}}>
    <circle cx="7.5" cy="7.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M11.5 11.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

export default function Layout() {
  const {pathname} = useLocation()
  const user = useAuthStore(s => s.user)
  const isMobile = useIsMobile()
  const meta = METAS[pathname] ?? {title:'RugbyLab', sub:''}
  const ini = user?.name?.split(' ').filter(Boolean).map((w:string) => w[0]).slice(0,2).join('').toUpperCase() || '?'

  if (!isMobile) return (
    <div className="app">
      <Sidebar/>
      <div className="main">
        <header className="topbar">
          <div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:'.06em',color:'var(--navy)',lineHeight:1}}>{meta.title}</div>
            <div style={{fontSize:11.5,color:'var(--g400)',marginTop:2}}>{meta.sub}</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {/* Search pill */}
            <div style={{
              display:'flex',alignItems:'center',gap:8,
              height:36,padding:'0 14px',
              background:'var(--g50)',borderRadius:99,
              border:'1.5px solid var(--g100)',
              color:'var(--g400)',fontSize:13,cursor:'text',
              transition:'border-color .14s,box-shadow .14s',
              userSelect:'none',
            }}>
              <IconSearch/>
              <span>Cerca…</span>
            </div>
            {/* Bell */}
            <button
              style={{
                width:38,height:38,border:'1.5px solid var(--g100)',
                borderRadius:12,background:'var(--white)',
                display:'flex',alignItems:'center',justifyContent:'center',
                cursor:'pointer',position:'relative',color:'var(--g500)',
                transition:'border-color .14s,background .14s',
              }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--g300)';e.currentTarget.style.background='var(--g50)'}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--g100)';e.currentTarget.style.background='var(--white)'}}
            >
              <IconBell/>
              <span style={{position:'absolute',top:8,right:8,width:7,height:7,borderRadius:'50%',background:'var(--red)',border:'2px solid #fff'}}/>
            </button>
            {/* User avatar */}
            <div
              style={{
                display:'flex',alignItems:'center',gap:9,
                padding:'4px 10px 4px 4px',borderRadius:12,
                border:'1.5px solid var(--g100)',background:'var(--white)',
                cursor:'pointer',transition:'border-color .14s,background .14s',
              }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--g200)';(e.currentTarget as HTMLElement).style.background='var(--g50)'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--g100)';(e.currentTarget as HTMLElement).style.background='var(--white)'}}
            >
              <Avatar initials={ini} src={user?.avatarUrl} size={28} bg="var(--red)" color="#fff" radius={7}/>
              <span style={{fontSize:13,fontWeight:600,color:'var(--g700)',maxWidth:110}} className="truncate">{user?.name?.split(' ')[0]}</span>
            </div>
          </div>
        </header>
        <main className="page">
          <Outlet/>
        </main>
      </div>
    </div>
  )

  /* ── MOBILE ───────────────────────────────────── */
  return (
    <div style={{
      display:'flex',flexDirection:'column',
      height:'100dvh',overflow:'hidden',
      background:'#050A12',
    }}>
      {/* TOP BAR */}
      <header className="mobile-topbar" style={{
        flexShrink:0,display:'flex',
        alignItems:'center',justifyContent:'space-between',
        padding:'0 16px',
        paddingTop:'env(safe-area-inset-top, 0px)',
        height:'calc(54px + env(safe-area-inset-top, 0px))',
      }}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{
            width:36,height:36,borderRadius:11,flexShrink:0,
            background:'linear-gradient(140deg,#C8102E 0%,#7A0A1E 100%)',
            display:'flex',alignItems:'center',justifyContent:'center',
            boxShadow:'0 4px 14px rgba(200,16,46,.45)',
          }}>
            <svg viewBox="0 0 28 28" fill="none" style={{width:20,height:20}}>
              <ellipse cx="14" cy="14" rx="10" ry="6" stroke="#fff" strokeWidth="1.8" transform="rotate(-35 14 14)"/>
              <path d="M7 8l14 12M11 6l6 16" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".7"/>
            </svg>
          </div>
          <div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:19,letterSpacing:'.07em',color:'#fff',lineHeight:1}}>RUGBYLAB</div>
            <div style={{fontSize:9.5,color:'rgba(255,255,255,.38)',textTransform:'uppercase',letterSpacing:'.1em',marginTop:1.5}}>{meta.title}</div>
          </div>
        </div>
        <div style={{display:'flex',gap:9,alignItems:'center'}}>
          <button style={{
            width:36,height:36,borderRadius:11,border:'none',
            background:'rgba(255,255,255,.09)',cursor:'pointer',position:'relative',
            display:'flex',alignItems:'center',justifyContent:'center',
            color:'rgba(255,255,255,.7)',
          }}>
            <IconBell/>
            <span style={{position:'absolute',top:8,right:8,width:7,height:7,borderRadius:'50%',background:'#C8102E',boxShadow:'0 0 6px #C8102E',border:'1.5px solid #050A12'}}/>
          </button>
          <div style={{
            width:36,height:36,borderRadius:11,
            background:'linear-gradient(140deg,#C8102E 0%,#7A0A1E 100%)',
            display:'flex',alignItems:'center',justifyContent:'center',
            fontFamily:"'Bebas Neue',sans-serif",fontSize:15,letterSpacing:'.04em',color:'#fff',
            boxShadow:'0 3px 10px rgba(200,16,46,.4)',
          }}>{ini}</div>
        </div>
      </header>

      {/* SCROLL CONTENT */}
      <main className="mobile-scroll" style={{
        flex:1,overflowY:'auto',overflowX:'hidden',
        background:'#050A12',
        paddingBottom:'calc(80px + env(safe-area-inset-bottom, 0px))',
        WebkitOverflowScrolling:'touch',
      }}>
        <div className="page" style={{padding:0}}>
          <Outlet/>
        </div>
      </main>

      {/* BOTTOM NAV */}
      <nav className="mobile-nav">
        {TABS.map(t => (
          <NavLink
            key={t.to} to={t.to} end={t.to === '/'}
            className={({isActive}) => `bnav-btn${isActive ? ' active' : ''}`}
            style={{outline:'none'}}
          >
            <div className="nav-icon-wrap">
              {t.icon}
            </div>
            <span style={{fontSize:9,letterSpacing:'.02em'}}>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
