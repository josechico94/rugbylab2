import { NavLink } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase/config'
import { useAuthStore } from '../store/authStore'
import { Avatar } from './ui'

/* ── SVG ICONS ──────────────────────────────────── */
const IconDashboard = () => (
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
const IconComunicazioni = () => (
  <svg viewBox="0 0 18 18" fill="none">
    <path d="M2 3h14a1 1 0 011 1v8a1 1 0 01-1 1H5l-4 3V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
)
const IconPalestra = () => (
  <svg viewBox="0 0 18 18" fill="none">
    <path d="M1 9h3M14 9h3M4 9h10M4 6v6M14 6v6M6 4v10M12 4v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)
const IconNutrizione = () => (
  <svg viewBox="0 0 18 18" fill="none">
    <path d="M9 2C5.686 2 3 4.686 3 8c0 2.5 1.5 4.5 3.5 5.5V16h5v-2.5C13.5 12.5 15 10.5 15 8c0-3.314-2.686-6-6-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
)
const IconAllenamenti = () => (
  <svg viewBox="0 0 18 18" fill="none">
    <polygon points="5,2 16,9 5,16" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
)
const IconStatistiche = () => (
  <svg viewBox="0 0 18 18" fill="none">
    <path d="M2 14l4-5 4 3 4-7 2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IconMedico = () => (
  <svg viewBox="0 0 18 18" fill="none">
    <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)
const IconTattica = () => (
  <svg viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M9 2v14M2 9h14" stroke="currentColor" strokeWidth="1" strokeOpacity=".5"/>
    <circle cx="6" cy="6" r="1.5" fill="currentColor"/>
    <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
  </svg>
)
const IconLogistica = () => (
  <svg viewBox="0 0 18 18" fill="none">
    <rect x="1" y="6" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M5 6V4a4 4 0 018 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)
const IconUtenti = () => (
  <svg viewBox="0 0 18 18" fill="none">
    <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="12" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M1 15c0-2.761 2.239-5 5-5h6c2.761 0 5 2.239 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

const NAV = [
  { g:'Club', items:[
    {to:'/',    icon:<IconDashboard/>,    label:'Dashboard'},
    {to:'/plantel',   icon:<IconRosa/>,         label:'Rosa'},
    {to:'/calendario',icon:<IconCalendario/>,   label:'Calendario'},
    {to:'/comunicacion',icon:<IconComunicazioni/>,label:'Comunicazioni'},
  ]},
  { g:'Performance', items:[
    {to:'/gimnasio',      icon:<IconPalestra/>,    label:'Palestra'},
    {to:'/nutricion',     icon:<IconNutrizione/>,  label:'Nutrizione'},
    {to:'/entrenamientos',icon:<IconAllenamenti/>, label:'Allenamenti'},
    {to:'/estadisticas',  icon:<IconStatistiche/>, label:'Statistiche'},
    {to:'/medico',        icon:<IconMedico/>,      label:'Medico'},
  ]},
  { g:'Operazioni', items:[
    {to:'/tactica',  icon:<IconTattica/>,  label:'Tattica'},
    {to:'/logistica',icon:<IconLogistica/>,label:'Logistica'},
  ]},
]

const RL: Record<string,string> = {
  admin:'Amministratore',
  cuerpo_tecnico:'Staff Tecnico',
  jugador:'Giocatore',
}

export default function Sidebar() {
  const user = useAuthStore(s => s.user)
  const ini = user?.name?.split(' ').filter(Boolean).map((w:string) => w[0]).slice(0,2).join('').toUpperCase() || '?'

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sb-brand">
        <div className="sb-logo">
          <svg viewBox="0 0 28 28" fill="none" style={{width:22,height:22}}>
            <ellipse cx="14" cy="14" rx="10" ry="6" stroke="#fff" strokeWidth="1.8" transform="rotate(-35 14 14)"/>
            <path d="M7 8l14 12M11 6l6 16" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".7"/>
          </svg>
        </div>
        <div>
          <div className="sb-name">RugbyLab</div>
          <div className="sb-sub">Bologna RC</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sb-nav">
        {NAV.map(g => (
          <div key={g.g}>
            <div className="sb-group">{g.g}</div>
            {g.items.map(i => (
              <NavLink
                key={i.to} to={i.to} end={i.to === '/'}
                className={({isActive}) => `nav-item${isActive ? ' active' : ''}`}
              >
                <div className="nav-icon">{i.icon}</div>
                <span>{i.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
        {user?.role === 'admin' && (
          <>
            <div className="sb-group">Admin</div>
            <NavLink to="/admin/usuarios" className={({isActive}) => `nav-item${isActive ? ' active' : ''}`}>
              <div className="nav-icon"><IconUtenti/></div>
              <span>Utenti</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="sb-footer">
        <div className="sb-user">
          <Avatar initials={ini} src={user?.avatarUrl} size={30} bg="var(--red)" color="#fff" radius={8}/>
          <div style={{flex:1,minWidth:0}}>
            <div className="truncate" style={{color:'#fff',fontSize:12,fontWeight:600,lineHeight:1.2}}>{user?.name}</div>
            <div style={{color:'rgba(255,255,255,.32)',fontSize:10,marginTop:1}}>{RL[user?.role ?? '']}</div>
          </div>
          <button
            onClick={() => signOut(auth)}
            title="Esci"
            style={{
              background:'none',border:'none',color:'rgba(255,255,255,.25)',
              cursor:'pointer',fontSize:15,padding:4,borderRadius:6,
              flexShrink:0,transition:'color .14s',lineHeight:1,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,.6)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,.25)')}
          >↪</button>
        </div>
      </div>
    </aside>
  )
}
