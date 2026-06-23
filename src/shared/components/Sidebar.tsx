import { NavLink } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase/config'
import { useAuthStore } from '../store/authStore'
import { Avatar } from './ui'

const NAV = [
  { g:'Club', items:[
    {to:'/',icon:'⬡',label:'Dashboard'},
    {to:'/plantel',icon:'◈',label:'Rosa'},
    {to:'/calendario',icon:'◎',label:'Calendario'},
    {to:'/comunicacion',icon:'◉',label:'Comunicazioni'},
  ]},
  { g:'Performance', items:[
    {to:'/gimnasio',icon:'◆',label:'Palestra'},
    {to:'/nutricion',icon:'◍',label:'Nutrizione'},
    {to:'/entrenamientos',icon:'▶',label:'Allenamenti'},
    {to:'/estadisticas',icon:'▣',label:'Statistiche'},
    {to:'/medico',icon:'✚',label:'Medico'},
  ]},
  { g:'Operazioni', items:[
    {to:'/tactica',icon:'◇',label:'Tattica'},
    {to:'/logistica',icon:'▤',label:'Logistica'},
  ]},
]

const RL:Record<string,string>={admin:'Amministratore',cuerpo_tecnico:'Staff Tecnico',jugador:'Giocatore'}

export default function Sidebar() {
  const user = useAuthStore(s=>s.user)
  const ini = user?.name?.split(' ').filter(Boolean).map((w:string)=>w[0]).slice(0,2).join('').toUpperCase()||'?'
  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="sb-logo">🏉</div>
        <div>
          <div className="sb-name">RugbyLab</div>
          <div className="sb-sub">Bologna RC</div>
        </div>
      </div>
      <nav className="sb-nav">
        {NAV.map(g=>(
          <div key={g.g}>
            <div className="sb-group">{g.g}</div>
            {g.items.map(i=>(
              <NavLink key={i.to} to={i.to} end={i.to==='/'} className={({isActive})=>`nav-item${isActive?' active':''}`}>
                <div className="nav-icon">{i.icon}</div>
                <span>{i.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
        {user?.role==='admin'&&(
          <>
            <div className="sb-group">Admin</div>
            <NavLink to="/admin/usuarios" className={({isActive})=>`nav-item${isActive?' active':''}`}>
              <div className="nav-icon">👥</div><span>Utenti</span>
            </NavLink>
          </>
        )}
      </nav>
      <div className="sb-footer">
        <div className="sb-user">
          <Avatar initials={ini} src={user?.avatarUrl} size={30} bg="var(--red)" color="#fff" radius={8}/>
          <div style={{flex:1,minWidth:0}}>
            <div className="truncate" style={{color:'#fff',fontSize:12,fontWeight:600,lineHeight:1.2}}>{user?.name}</div>
            <div style={{color:'rgba(255,255,255,.32)',fontSize:10,marginTop:1}}>{RL[user?.role??'']}</div>
          </div>
          <button onClick={()=>signOut(auth)} title="Esci"
            style={{background:'none',border:'none',color:'rgba(255,255,255,.25)',cursor:'pointer',fontSize:15,padding:4,borderRadius:4,flexShrink:0,transition:'color .14s'}}
            onMouseEnter={e=>(e.currentTarget.style.color='rgba(255,255,255,.6)')}
            onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,.25)')}>↪</button>
        </div>
      </div>
    </aside>
  )
}
