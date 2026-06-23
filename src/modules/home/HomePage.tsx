import { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { db } from '@/shared/firebase/config'
import { useAuthStore } from '@/shared/store/authStore'

const MODS = [
  {to:'/plantel',       icon:'◈',name:'Rosa',          desc:'Profili e stato della squadra',              accent:'#0A1628',ibg:'#EEF2FF',ic:'#0A1628',col:'players'},
  {to:'/gimnasio',      icon:'◆',name:'Palestra',      desc:'Schede e serie individualizzate',          accent:'#C8102E',ibg:'#FFF0F2',ic:'#C8102E',col:'routines'},
  {to:'/nutricion',     icon:'◍',name:'Nutrizione',    desc:'Piani alimentari con macro',             accent:'#B87A00',ibg:'#FFFAEB',ic:'#B87A00',col:'nutrition_plans'},
  {to:'/estadisticas',  icon:'▣',name:'Statistiche',   desc:'Metriche delle partite e rendimento',        accent:'#1A2F5A',ibg:'#EEF4FF',ic:'#1A2F5A',col:'matches'},
  {to:'/medico',        icon:'✚',name:'Area Medica',   desc:'Infortuni e monitoraggio della rosa',        accent:'#C8102E',ibg:'#FFF0F2',ic:'#C8102E',col:'lesiones'},
  {to:'/calendario',    icon:'◎',name:'Calendario',    desc:'Eventi, partite e allenamenti',        accent:'#0A6E2E',ibg:'#EDFFF5',ic:'#0A6E2E',col:'eventos'},
  {to:'/entrenamientos',icon:'▶',name:'Allenamenti',   desc:'Libreria di video tecnici',             accent:'#5B21B6',ibg:'#F3EEFF',ic:'#5B21B6',col:'videos'},
  {to:'/comunicacion',  icon:'◉',name:'Comunicazioni', desc:'Bacheca ufficiale del club in tempo reale',     accent:'#0369A1',ibg:'#EFF6FF',ic:'#0369A1',col:'messages'},
  {to:'/tactica',       icon:'◇',name:'Tattica',       desc:'Lavagna RugbyBoard Pro interattiva',       accent:'#065F46',ibg:'#ECFDF5',ic:'#065F46',col:null},
  {to:'/logistica',     icon:'▤',name:'Logistica',     desc:'Convocazioni e Fantasy BRC',              accent:'#9A3412',ibg:'#FFF7ED',ic:'#9A3412',col:null},
]

export default function HomePage() {
  const user=useAuthStore(s=>s.user)
  const nav=useNavigate()
  const [counts,setCounts]=useState<Record<string,number>>({})
  const [loading,setL]=useState(true)

  const hour=new Date().getHours()
  const greet=hour<12?'Buongiorno':hour<20?'Buon pomeriggio':'Buonasera'
  const first=user?.name?.split(' ')[0]??''
  const date=new Date().toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'})

  useEffect(()=>{
    if(!user) return
    const cols=['players','matches','lesiones','eventos','routines','messages']
    Promise.all(cols.map(c=>
      getDocs(query(collection(db,c),where('clubId','==',user.clubId)))
        .then(s=>[c,s.size] as [string,number]).catch(()=>[c,0] as [string,number])
    )).then(r=>{const m:any={};r.forEach(([k,v])=>m[k]=v);setCounts(m);setL(false)})
  },[user])

  return (
    <div className="fade-in mobile-home">
      {/* HERO */}
      <div className="hero">
        <div style={{position:'relative',zIndex:1}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:18,gap:12}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,fontWeight:600,color:'rgba(255,255,255,.3)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:6}}>{date}</div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(28px,5vw,42px)',letterSpacing:'.04em',color:'#fff',lineHeight:.92,marginBottom:8}}>
                {greet},<br/><span style={{color:'var(--gold)'}}>{first}</span>
              </div>
              <div style={{fontSize:13,color:'rgba(255,255,255,.45)'}}>
                {loading?'Caricamento dati...':`${counts.players||0} giocatori · ${counts.eventos||0} eventi · ${counts.matches||0} partite`}
              </div>
            </div>
            <div style={{width:56,height:56,borderRadius:14,background:'rgba(255,255,255,.07)',border:'1.5px solid rgba(255,255,255,.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,flexShrink:0}}>🏉</div>
          </div>
          {/* Quick stats */}
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {[{v:counts.players||0,l:'Rosa',c:'#fff'},{v:counts.matches||0,l:'Partite',c:'var(--gold)'},{v:counts.lesiones||0,l:'Infortuni',c:(counts.lesiones||0)>0?'#FF6B7A':'rgba(255,255,255,.5)'},{v:counts.eventos||0,l:'Eventi',c:'#6EE7B7'}].map(s=>(
              <div key={s.l} style={{padding:'7px 12px',background:'rgba(255,255,255,.07)',borderRadius:9,border:'1px solid rgba(255,255,255,.08)'}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:'.02em',color:s.c,lineHeight:1}}>{loading?'—':s.v}</div>
                <div style={{fontSize:9,color:'rgba(255,255,255,.32)',textTransform:'uppercase',letterSpacing:'.06em',marginTop:1}}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODULE GRID */}
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:'.08em',color:'var(--g400)',marginBottom:12,textTransform:'uppercase'}}>Moduli del sistema</div>

      <div className="stagger mod-grid home-mod-grid" style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:20}}>
        {MODS.map(m=>{
          const val=m.col?(counts[m.col]??null):null
          return (
            <div key={m.to} className="mod-card fade-up" style={{'--accent':m.accent} as any} onClick={()=>nav(m.to)}>
              <div className="mod-icon" style={{background:m.ibg,color:m.ic}}><span style={{fontSize:20}}>{m.icon}</span></div>
              <div className="mod-name">{m.name}</div>
              <div className="mod-desc">{m.desc}</div>
              <div className="mod-stat">
                <div>
                  {val!==null&&!loading?<><div className="mod-val" style={{color:m.accent}}>{val}</div><div className="mod-lbl">{m.col}</div></>
                    :<div className="mod-lbl" style={{color:'var(--g300)'}}>Accedi →</div>}
                </div>
                <div className="mod-arrow">→</div>
              </div>
            </div>
          )
        })}
      </div>

      {user?.role==='admin'&&(
        <div className="mod-card" style={{'--accent':'var(--gold)'} as any} onClick={()=>nav('/admin/usuarios')}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:42,height:42,borderRadius:11,background:'var(--gold-l)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:19,flexShrink:0}}>👥</div>
            <div style={{flex:1,minWidth:0}}>
              <div className="mod-name" style={{fontSize:15,marginBottom:2}}>Utenti e ruoli</div>
              <div className="mod-desc">Gestione degli accessi e permessi</div>
            </div>
            <div className="mod-arrow">→</div>
          </div>
        </div>
      )}
    </div>
  )
}
