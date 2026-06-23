import { Outlet, useLocation, NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import Sidebar from './Sidebar'
import { Avatar } from './ui'

const META: Record<string,{title:string;sub:string}> = {
  '/':'/Dashboard/Resumen general del club'.split('/').reduce((a,v,i)=>({...a,[i===0?'title':'sub']:v}),{}) as any,
}
const METAS: Record<string,{title:string;sub:string}> = {
  '/':               {title:'Dashboard',       sub:'Riepilogo generale del club'},
  '/plantel':        {title:'Rosa',             sub:'Profili e stato della squadra'},
  '/gimnasio':       {title:'Palestra',         sub:'Pianificazione fisica'},
  '/nutricion':      {title:'Nutrizione',       sub:'Piano alimentare'},
  '/entrenamientos': {title:'Allenamenti',      sub:'Libreria video'},
  '/comunicacion':   {title:'Comunicazioni',    sub:'Bacheca del club'},
  '/estadisticas':   {title:'Statistiche',      sub:'Rendimento nelle partite'},
  '/medico':         {title:'Area Medica',      sub:'Infortuni e monitoraggio'},
  '/calendario':     {title:'Calendario',       sub:'Eventi e partite'},
  '/tactica':        {title:'Tattica',          sub:'rugbyboardpro.com'},
  '/logistica':      {title:'Logistica',        sub:'Convocazioni e Fantasy'},
  '/admin/usuarios': {title:'Utenti',           sub:'Gestione degli accessi'},
}

const TABS = [
  {to:'/',icon:'⬡',label:'Home'},
  {to:'/plantel',icon:'◈',label:'Rosa'},
  {to:'/calendario',icon:'◎',label:'Agenda'},
  {to:'/estadisticas',icon:'▣',label:'Stats'},
  {to:'/logistica',icon:'▤',label:'Club'},
]

function useIsMobile() {
  const [v,set] = useState(()=>typeof window!=='undefined'&&window.innerWidth<769)
  useEffect(()=>{
    const mq=window.matchMedia('(max-width:768px)')
    const h=(e:MediaQueryListEvent)=>set(e.matches)
    mq.addEventListener('change',h)
    return ()=>mq.removeEventListener('change',h)
  },[])
  return v
}

export default function Layout() {
  const {pathname}=useLocation()
  const user=useAuthStore(s=>s.user)
  const isMobile=useIsMobile()
  const meta=METAS[pathname]??{title:'RugbyLab',sub:''}
  const isFs=false
  const ini=user?.name?.split(' ').filter(Boolean).map((w:string)=>w[0]).slice(0,2).join('').toUpperCase()||'?'

  if (!isMobile) return (
    <div className="app">
      <Sidebar/>
      <div className="main">
        {!isFs&&(
          <header className="topbar">
            <div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:21,letterSpacing:'.06em',color:'var(--navy)',lineHeight:1}}>{meta.title}</div>
              <div style={{fontSize:11.5,color:'var(--g400)',marginTop:2}}>{meta.sub}</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <button style={{width:36,height:36,border:'1.5px solid var(--g100)',borderRadius:9,background:'var(--white)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',position:'relative',fontSize:16,transition:'border-color .14s'}}
                onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--g300)')}
                onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--g100)')}>
                🔔<div style={{position:'absolute',top:8,right:8,width:6,height:6,borderRadius:'50%',background:'var(--red)',border:'1.5px solid #fff'}}/>
              </button>
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'4px 8px 4px 4px',borderRadius:9,border:'1.5px solid var(--g100)',background:'var(--white)',cursor:'pointer'}}
                onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--g200)')}
                onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--g100)')}>
                <Avatar initials={ini} src={user?.avatarUrl} size={26} bg="var(--red)" color="#fff" radius={6}/>
                <span style={{fontSize:12.5,fontWeight:600,color:'var(--g700)',maxWidth:110}} className="truncate">{user?.name?.split(' ')[0]}</span>
              </div>
            </div>
          </header>
        )}
        <main className="page" style={{overflow:isFs?'hidden':undefined,padding:isFs?0:undefined}}>
          <Outlet/>
        </main>
      </div>
    </div>
  )

  // ─── MOBILE — World-class dark UI ────────────────────────────
  const BNAV_ICONS: Record<string,string> = {
    '/':'🏠', '/plantel':'👥', '/calendario':'📅',
    '/estadisticas':'📊', '/logistica':'🏆',
  }

  return (
    <div style={{
      display:'flex', flexDirection:'column',
      height:'100dvh', overflow:'hidden',
      background:'#050A12',
    }}>
      {/* ── TOP BAR ─────────────────────────────── */}
      <header className="mobile-topbar" style={{
        flexShrink:0, display:'flex',
        alignItems:'center', justifyContent:'space-between',
        padding:'0 16px',
        paddingTop:'env(safe-area-inset-top, 0px)',
        height:'calc(54px + env(safe-area-inset-top, 0px))',
      }}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{
            width:34,height:34,borderRadius:10,flexShrink:0,
            background:'linear-gradient(140deg,#C8102E 0%,#7A0A1E 100%)',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,
            boxShadow:'0 4px 12px rgba(200,16,46,.45)',
          }}>🏉</div>
          <div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.07em',color:'#fff',lineHeight:1.0}}>RUGBYLAB</div>
            <div style={{fontSize:9.5,color:'rgba(255,255,255,.38)',textTransform:'uppercase',letterSpacing:'.1em',marginTop:1.5}}>{meta.title}</div>
          </div>
        </div>
        <div style={{display:'flex',gap:9,alignItems:'center'}}>
          <button style={{
            width:36,height:36,borderRadius:11,border:'none',
            background:'rgba(255,255,255,.09)',cursor:'pointer',position:'relative',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,
          }}>
            🔔
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

      {/* ── SCROLL CONTENT ──────────────────────── */}
      <main className="mobile-scroll" style={{
        flex:1, overflowY:'auto', overflowX:'hidden',
        background:'#050A12',
        paddingBottom:'calc(80px + env(safe-area-inset-bottom, 0px))',
        WebkitOverflowScrolling:'touch',
      }}>
        <div className="page" style={{padding:0}}>
          <Outlet/>
        </div>
      </main>

      {/* ── BOTTOM NAV ──────────────────────────── */}
      <nav className="mobile-nav">
        {TABS.map(t=>(
          <NavLink
            key={t.to} to={t.to} end={t.to==='/'}
            className={({isActive})=>`bnav-btn${isActive?' active':''}`}
            style={{outline:'none'}}
          >
            <div className="nav-icon-wrap">
              {BNAV_ICONS[t.to]||t.icon}
            </div>
            <span style={{fontSize:9,letterSpacing:'.02em'}}>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
