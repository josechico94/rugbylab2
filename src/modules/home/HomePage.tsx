import { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from 'recharts'
import { db } from '@/shared/firebase/config'
import { useAuthStore } from '@/shared/store/authStore'
import { useIsMobile } from '@/shared/hooks/useIsMobile'

const MODS = [
  {to:'/plantel',        icon:'👥', name:'Rosa',          accent:'#0A1628', ibg:'#EEF2FF', ic:'#0A1628'},
  {to:'/gimnasio',       icon:'🏋️', name:'Palestra',      accent:'#C8102E', ibg:'#FFF0F2', ic:'#C8102E'},
  {to:'/nutricion',      icon:'🥗', name:'Nutrizione',    accent:'#B87A00', ibg:'#FFFAEB', ic:'#B87A00'},
  {to:'/estadisticas',   icon:'📊', name:'Statistiche',   accent:'#1A2F5A', ibg:'#EEF4FF', ic:'#1A2F5A'},
  {to:'/medico',         icon:'🏥', name:'Medico',        accent:'#C8102E', ibg:'#FFF0F2', ic:'#C8102E'},
  {to:'/calendario',     icon:'📅', name:'Calendario',    accent:'#0A6E2E', ibg:'#EDFFF5', ic:'#0A6E2E'},
  {to:'/entrenamientos', icon:'🎥', name:'Video',         accent:'#5B21B6', ibg:'#F3EEFF', ic:'#5B21B6'},
  {to:'/comunicacion',   icon:'💬', name:'Chat',          accent:'#0369A1', ibg:'#EFF6FF', ic:'#0369A1'},
  {to:'/tactica',        icon:'🧠', name:'Tattica',       accent:'#065F46', ibg:'#ECFDF5', ic:'#065F46'},
  {to:'/logistica',      icon:'📦', name:'Logistica',     accent:'#9A3412', ibg:'#FFF7ED', ic:'#9A3412'},
]

const TRAINING_DATA = [
  { day: 'Lun', intensity: 62, minuti: 75 },
  { day: 'Mar', intensity: 48, minuti: 60 },
  { day: 'Mer', intensity: 78, minuti: 90 },
  { day: 'Gio', intensity: 55, minuti: 70 },
  { day: 'Ven', intensity: 88, minuti: 110 },
  { day: 'Sab', intensity: 72, minuti: 95 },
  { day: 'Dom', intensity: 40, minuti: 45 },
]

const RADAR_DATA = [
  { subject: 'Forza',   A: 80 },
  { subject: 'Velocità',A: 65 },
  { subject: 'Tecnica', A: 72 },
  { subject: 'Stamina', A: 88 },
  { subject: 'Tattica', A: 70 },
  { subject: 'Mentale', A: 75 },
]

const RECENT_VIDEOS = [
  { title: 'Rucks e Mauls – avanzati', dur: '14 min', icon: '🏉' },
  { title: 'Lineout: varianti di chiamata', dur: '9 min', icon: '📐' },
  { title: 'Kick-off e restart', dur: '11 min', icon: '🦶' },
]

export default function HomePage() {
  const user = useAuthStore(s => s.user)
  const nav = useNavigate()
  const isMobile = useIsMobile()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setL] = useState(true)

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Buongiorno' : hour < 20 ? 'Buon pomeriggio' : 'Buonasera'
  const first = user?.name?.split(' ')[0] ?? ''
  const date = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })

  useEffect(() => {
    if (!user) return
    const cols = ['players', 'matches', 'lesiones', 'eventos', 'routines', 'messages']
    Promise.all(cols.map(c =>
      getDocs(query(collection(db, c), where('clubId', '==', user.clubId)))
        .then(s => [c, s.size] as [string, number]).catch(() => [c, 0] as [string, number])
    )).then(r => { const m: any = {}; r.forEach(([k, v]) => m[k] = v); setCounts(m); setL(false) })
  }, [user])

  const statCards = [
    { icon: '🏉', label: 'Rosa',      value: loading ? '—' : String(counts.players || 0),  sub: 'giocatori',   color: '#C8102E', bg: '#FFF0F2' },
    { icon: '📅', label: 'Partite',   value: loading ? '—' : String(counts.matches || 0),  sub: 'registrate',  color: '#1A2F5A', bg: '#EEF4FF' },
    { icon: '🏥', label: 'Infortuni', value: loading ? '—' : String(counts.lesiones || 0), sub: 'attivi',      color: (counts.lesiones || 0) > 0 ? '#C8102E' : '#0A6E2E', bg: '#EDFFF5' },
    { icon: '📣', label: 'Messaggi',  value: loading ? '—' : String(counts.messages || 0), sub: 'nel club',    color: '#0369A1', bg: '#EFF6FF' },
  ]

  return (
    <div className="fade-in home-page" style={{ padding: isMobile ? '14px 14px 80px' : '0 0 32px' }}>

      {/* TOP HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--g300)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{date}</div>
          <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, color: 'var(--navy)', letterSpacing: '-.02em', lineHeight: 1.1 }}>
            {greet}, <span style={{ color: 'var(--red)' }}>{first}</span> 👋
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {['Sett.', 'Mese', 'Anno'].map((t, i) => (
            <button key={t} style={{
              padding: '6px 12px', borderRadius: 20, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: i === 0 ? 'var(--red)' : 'var(--g50)',
              color: i === 0 ? '#fff' : 'var(--g400)',
            }}>{t}</button>
          ))}
        </div>
      </div>

      {/* STAT CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {statCards.map(s => (
          <div key={s.label} className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, letterSpacing: '-.02em', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--g300)', marginTop: 3, fontWeight: 500 }}>{s.label} <span style={{ color: 'var(--g200)' }}>· {s.sub}</span></div>
            </div>
          </div>
        ))}
      </div>

      {/* MAIN GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap: 16, alignItems: 'start' }}>

        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ACTIVITY CHART */}
          <div className="card" style={{ padding: '20px 20px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)' }}>Attività di allenamento</div>
                <div style={{ fontSize: 11, color: 'var(--g300)', marginTop: 2 }}>Intensità settimanale della squadra</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--g400)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)' }} /> Intensità
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--g400)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#5B21B6' }} /> Minuti
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={TRAINING_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C8102E" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#C8102E" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gPurple" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5B21B6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#5B21B6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--g100)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--g300)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--g300)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--g100)', fontSize: 12 }} />
                <Area type="monotone" dataKey="intensity" stroke="#C8102E" strokeWidth={2.5} fill="url(#gRed)" dot={false} />
                <Area type="monotone" dataKey="minuti" stroke="#5B21B6" strokeWidth={2} fill="url(#gPurple)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* PERFORMANCE + MODULES ROW */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>

            {/* RADAR / PERFORMANCE */}
            <div className="card" style={{ padding: '18px 18px 10px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Profilo prestazioni</div>
              <div style={{ fontSize: 11, color: 'var(--g300)', marginBottom: 12 }}>Media squadra · questa settimana</div>
              <ResponsiveContainer width="100%" height={180}>
                <RadarChart data={RADAR_DATA} margin={{ top: 0, right: 10, bottom: 0, left: 10 }}>
                  <PolarGrid stroke="var(--g100)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'var(--g400)' }} />
                  <Radar name="Team" dataKey="A" stroke="#C8102E" fill="#C8102E" fillOpacity={0.15} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* NEXT EVENT + QUICK ACTIONS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Next match card */}
              <div style={{ background: 'linear-gradient(135deg,#0A1628 0%,#1A2F5A 100%)', borderRadius: 16, padding: '18px 18px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 80, opacity: .06, lineHeight: 1 }}>🏉</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Prossima partita</div>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Sabato · 15:00</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginBottom: 14 }}>Campo centrale · vs. Roma Rugby</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,.07)', borderRadius: 8, padding: '6px 0' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#F5C518' }}>22</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase' }}>Convocati</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,.07)', borderRadius: 8, padding: '6px 0' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#6EE7B7' }}>5</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase' }}>Giorni</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,.07)', borderRadius: 8, padding: '6px 0' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#93C5FD' }}>3</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase' }}>Assenti</div>
                  </div>
                </div>
              </div>

              {/* Injury alert */}
              {(counts.lesiones || 0) > 0 && (
                <div style={{ background: '#FFF0F2', border: '1.5px solid #FECDD3', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }} onClick={() => nav('/medico')} role="button">
                  <div style={{ fontSize: 22 }}>🏥</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#C8102E' }}>{counts.lesiones} infortuni attivi</div>
                    <div style={{ fontSize: 11, color: '#F87171' }}>Controlla area medica →</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* MODULE QUICK ACCESS */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              Moduli del sistema
              <span style={{ fontSize: 11, color: 'var(--g300)', fontWeight: 500 }}>10 moduli</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 4 : 5},1fr)`, gap: 10 }}>
              {MODS.map(m => (
                <div
                  key={m.to}
                  onClick={() => nav(m.to)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '14px 8px', borderRadius: 14, cursor: 'pointer', transition: 'transform .15s,box-shadow .15s', border: '1px solid var(--g100)', background: '#fff' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(0,0,0,.08)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '' }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: m.ibg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{m.icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--navy)', textAlign: 'center', lineHeight: 1.2 }}>{m.name}</div>
                </div>
              ))}
              {user?.role === 'admin' && (
                <div
                  onClick={() => nav('/admin/usuarios')}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '14px 8px', borderRadius: 14, cursor: 'pointer', transition: 'transform .15s', border: '1px solid var(--g100)', background: '#fff' }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--gold-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>⚙️</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--navy)', textAlign: 'center', lineHeight: 1.2 }}>Admin</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* USER PROFILE CARD */}
          <div className="card" style={{ padding: '20px 18px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,var(--red),#8B0F1F)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff', fontWeight: 800, margin: '0 auto 12px', boxShadow: '0 4px 16px rgba(200,16,46,.3)' }}>
              {(user?.name ?? 'U').split(' ').map(w => w[0]).slice(0, 2).join('')}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--navy)', marginBottom: 3 }}>{user?.name ?? '—'}</div>
            <div style={{ fontSize: 11, color: 'var(--g300)', marginBottom: 16, textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ') ?? '—'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {[{ v: counts.routines || 4, l: 'Schede' }, { v: counts.eventos || 0, l: 'Eventi' }, { v: 87, l: '% Pres.' }].map(s => (
                <div key={s.l} style={{ background: 'var(--g50)', borderRadius: 10, padding: '8px 4px' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)' }}>{loading ? '—' : s.v}</div>
                  <div style={{ fontSize: 9, color: 'var(--g300)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ATTENDANCE CALENDAR WIDGET */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>Presenze — Giugno</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
              {['L','M','M','G','V','S','D'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 9, color: 'var(--g300)', fontWeight: 700, paddingBottom: 4 }}>{d}</div>
              ))}
              {Array.from({ length: 30 }, (_, i) => {
                const day = i + 1
                const present = [2,3,5,6,9,10,12,13,16,17,19,20,23,24].includes(day)
                const today = day === new Date().getDate()
                return (
                  <div key={day} style={{
                    textAlign: 'center', fontSize: 10, fontWeight: today ? 800 : 500,
                    padding: '4px 0', borderRadius: 6,
                    background: today ? 'var(--red)' : present ? '#DCFCE7' : 'transparent',
                    color: today ? '#fff' : present ? '#16A34A' : 'var(--g300)',
                  }}>{day}</div>
                )
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--g50)' }}>
              <span style={{ fontSize: 11, color: 'var(--g400)' }}>Presenze totali</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#16A34A' }}>87%</span>
            </div>
          </div>

          {/* TRENDING VIDEOS */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>Video in tendenza</div>
              <span onClick={() => nav('/entrenamientos')} style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600, cursor: 'pointer' }}>Tutti →</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {RECENT_VIDEOS.map((v, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => nav('/entrenamientos')}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,var(--red),#8B0F1F)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{v.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.title}</div>
                    <div style={{ fontSize: 10, color: 'var(--g300)', marginTop: 2 }}>{v.dur}</div>
                  </div>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--g50)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>▶</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
