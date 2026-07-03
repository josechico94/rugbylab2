// src/modules/calendario/CalendarioPage.tsx
import React, { useEffect, useState } from 'react'
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/shared/firebase/config'
import { useAuthStore } from '@/shared/store/authStore'
import { Empty as EmptyState } from '@/shared/components/ui'
import type { Evento, EventoTipo } from '@/shared/types'

// ── Constants ──────────────────────────────────────────────────
const TIPOS: { id: EventoTipo; label: string; icon: string; bg: string; color: string }[] = [
  { id:'partido',       label:'Partita',         icon:'🏉', bg:'var(--g50)', color:'var(--red)' },
  { id:'entrenamiento', label:'Allenamento',   icon:'💪', bg:'#EBF4FF', color:'#1D5FAD' },
  { id:'concentracion', label:'Raduno',   icon:'🏨', bg:'#F0EFFE', color:'#5047E5' },
  { id:'medico',        label:'Visita medica',          icon:'🏥', bg:'#FEF3DC', color:'#B45309' },
  { id:'otro',          label:'Altro',            icon:'📌', bg:'#F1EFE8', color:'#5F5E5A' },
]

const MESES = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']
const DIAS_SEMANA = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab']

function tipoMeta(t: EventoTipo) { return TIPOS.find(x => x.id === t) ?? TIPOS[4] }

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--g500)', display: 'block', marginBottom: 5 }}>{children}</label>
}

function TipoPill({ tipo }: { tipo: EventoTipo }) {
  const m = tipoMeta(tipo)
  return <span style={{ background: m.bg, color: m.color, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20 }}>{m.icon} {m.label}</span>
}

function formatHora(h: string | null) { return h ?? '' }

const EMPTY_FORM = () => ({
  titulo: '', descripcion: '', tipo: 'entrenamiento' as EventoTipo,
  fecha: new Date().toISOString().slice(0, 10),
  horaInicio: '19:00', horaFin: '',
  lugar: '', rival: '', obligatorio: false,
})

type Modal = 'none' | 'form' | 'delete' | 'detail'
type ViewMode = 'mes' | 'lista'

function useIsMobile() {
  const [v,set] = React.useState(()=>typeof window!=='undefined'&&window.innerWidth<769)
  React.useEffect(()=>{const mq=window.matchMedia('(max-width:768px)');const h=(e:MediaQueryListEvent)=>set(e.matches);mq.addEventListener('change',h);return()=>mq.removeEventListener('change',h)},[])
  return v
}

export default function CalendarioPage() {
  const user    = useAuthStore(s => s.user)
  const canEdit = user?.role === 'admin' || user?.role === 'cuerpo_tecnico'

  const today = new Date()
  const [eventos,  setEventos]  = useState<Evento[]>([])
  const [loading,  setLoading]  = useState(true)
  const isMobile = useIsMobile()
  const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? 'lista' : 'mes')
  const [curYear,  setCurYear]  = useState(today.getFullYear())
  const [curMonth, setCurMonth] = useState(today.getMonth())
  const [modal,    setModal]    = useState<Modal>('none')
  const [active,   setActive]   = useState<Evento | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null)
  const [filterT,  setFilterT]  = useState<EventoTipo | 'all'>('all')
  const [form,     setForm]     = useState(EMPTY_FORM())
  const [clickDay, setClickDay] = useState<string | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (!user) return
    getDocs(query(collection(db, 'eventos'), where('clubId', '==', user.clubId)))
      .then(snap => {
        setEventos(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Evento)
          .sort((a, b) => a.fecha.localeCompare(b.fecha)))
        setLoading(false)
      }).catch(() => setLoading(false))
  }, [user])

  function openCreate(fecha?: string) {
    setForm({ ...EMPTY_FORM(), fecha: fecha ?? new Date().toISOString().slice(0, 10) })
    setActive(null); setModal('form')
  }
  function openEdit(e: Evento) {
    setForm({
      titulo: e.titulo, descripcion: e.descripcion ?? '',
      tipo: e.tipo, fecha: e.fecha,
      horaInicio: e.horaInicio ?? '', horaFin: e.horaFin ?? '',
      lugar: e.lugar ?? '', rival: e.rival ?? '', obligatorio: e.obligatorio,
    })
    setActive(e); setModal('form')
  }

  async function handleSave() {
    if (!user || !form.titulo.trim()) return showToast('Inserisci un titolo', false)
    setSaving(true)
    const data = {
      clubId: user.clubId, titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim() || null,
      tipo: form.tipo, fecha: form.fecha,
      horaInicio: form.horaInicio || null, horaFin: form.horaFin || null,
      lugar: form.lugar.trim() || null,
      rival: form.tipo === 'partido' ? form.rival.trim() || null : null,
      obligatorio: form.obligatorio, createdBy: user.uid,
    }
    try {
      if (active) {
        await updateDoc(doc(db, 'eventos', active.id), data)
        setEventos(prev => prev.map(e => e.id === active.id ? { ...e, ...data } : e).sort((a,b)=>a.fecha.localeCompare(b.fecha)))
        showToast('Evento aggiornato')
      } else {
        const ref = await addDoc(collection(db, 'eventos'), { ...data, createdAt: serverTimestamp() })
        setEventos(prev => [...prev, { id: ref.id, ...data, createdAt: new Date() } as unknown as Evento].sort((a,b)=>a.fecha.localeCompare(b.fecha)))
        showToast('Evento creato')
      }
      setModal('none')
    } catch (e) { console.error(e); showToast('Errore nel salvataggio', false) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!active) return
    setSaving(true)
    try {
      await deleteDoc(doc(db, 'eventos', active.id))
      setEventos(prev => prev.filter(e => e.id !== active.id))
      setModal('none'); setActive(null); showToast('Evento eliminato')
    } catch { showToast("Errore durante l'eliminazione", false) }
    finally { setSaving(false) }
  }

  // ── Calendar grid ─────────────────────────────────────────────
  function buildCalendar() {
    const firstDay = new Date(curYear, curMonth, 1).getDay()
    const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate()
    const cells: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }

  function eventosDelDia(day: number) {
    const fecha = `${curYear}-${String(curMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return eventos.filter(e => e.fecha === fecha && (filterT === 'all' || e.tipo === filterT))
  }

  function isToday(day: number) {
    return day === today.getDate() && curMonth === today.getMonth() && curYear === today.getFullYear()
  }

  function prevMonth() { if (curMonth === 0) { setCurMonth(11); setCurYear(y=>y-1) } else setCurMonth(m=>m-1) }
  function nextMonth() { if (curMonth === 11) { setCurMonth(0); setCurYear(y=>y+1) } else setCurMonth(m=>m+1) }

  // proximos eventos (lista view)
  const filtered = eventos.filter(e =>
    (filterT === 'all' || e.tipo === filterT) && e.fecha >= today.toISOString().slice(0,10)
  )
  const pasados  = eventos.filter(e =>
    (filterT === 'all' || e.tipo === filterT) && e.fecha < today.toISOString().slice(0,10)
  ).reverse()

  const proximos7 = eventos.filter(e => {
    const d = new Date(e.fecha)
    const diff = (d.getTime() - today.getTime()) / 86400000
    return diff >= 0 && diff <= 7
  })

  const cells = buildCalendar()

  return (
    <div className="fade-in" style={{padding: isMobile ? "14px 14px 0" : undefined}}>
      {toast && <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 1000, background: toast.ok ? 'var(--navy)' : 'var(--red)', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{toast.msg}</div>}

      {/* Próximos 7 días strip */}
      {proximos7.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {proximos7.map(e => {
            const m = tipoMeta(e.tipo)
            return (
              <div key={e.id} onClick={() => { setActive(e); setModal('detail') }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: m.bg, borderRadius: 10, cursor: 'pointer', border: `1px solid ${m.color}22` }}>
                <span style={{ fontSize: 18 }}>{m.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{e.titulo}</div>
                  <div style={{ fontSize: 11, color: m.color, opacity: 0.7 }}>
                    {new Date(e.fecha).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })}
                    {e.horaInicio ? ` · ${e.horaInicio}` : ''}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* View toggle */}
        <div style={{ display: 'flex', background: '#fff', border: '1px solid var(--g100)', borderRadius: 8, padding: 3, gap: 2 }}>
          {(['mes','lista'] as const).map(v => (
            <button key={v} onClick={() => setViewMode(v)} style={{ padding: '5px 14px', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: viewMode === v ? 'var(--navy)' : 'transparent', color: viewMode === v ? '#fff' : 'var(--g400)' }}>
              {v === 'mes' ? '📅 Mes' : '📋 Lista'}
            </button>
          ))}
        </div>

        {/* Tipo filter */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setFilterT('all')} style={{ padding: '6px 12px', borderRadius: 20, border: '1px solid var(--g100)', background: filterT === 'all' ? 'var(--navy)' : '#fff', color: filterT === 'all' ? '#fff' : 'var(--g500)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Todos</button>
          {TIPOS.map(t => (
            <button key={t.id} onClick={() => setFilterT(t.id === filterT ? 'all' : t.id)} style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${filterT === t.id ? t.color : 'var(--g100)'}`, background: filterT === t.id ? t.bg : '#fff', color: filterT === t.id ? t.color : 'var(--g500)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {canEdit && <button onClick={() => openCreate()} style={{ marginLeft: 'auto', padding: '9px 18px', border: 'none', borderRadius: 9, background: 'var(--red)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Nuovo evento</button>}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--g300)' }}>Caricamento...</div> : (<>

      {/* ── VISTA MES ── */}
      {viewMode === 'mes' && (
        <div style={{ background: '#fff', border: '1px solid var(--g100)', borderRadius: 14, overflow: 'hidden' }}>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--g100)' }}>
            <button onClick={prevMonth} style={{ width: 32, height: 32, border: '1px solid var(--g100)', borderRadius: 8, background: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)' }}>{MESES[curMonth]} {curYear}</div>
            <button onClick={nextMonth} style={{ width: 32, height: 32, border: '1px solid var(--g100)', borderRadius: 8, background: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          </div>

          {/* Days header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
            {DIAS_SEMANA.map(d => (
              <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--g300)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--g100)' }}>{d}</div>
            ))}
          </div>

          {/* Calendar cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} style={{ minHeight: 90, borderBottom: '1px solid var(--g50)', borderRight: (idx+1)%7!==0?'1px solid var(--g50)':undefined, background: 'var(--g50)' }} />
              const evs = eventosDelDia(day)
              const today2 = isToday(day)
              const fechaStr = `${curYear}-${String(curMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              return (
                <div key={idx} onClick={() => { if (canEdit) { setClickDay(fechaStr); openCreate(fechaStr) } }} style={{ minHeight: 90, padding: '6px 8px', borderBottom: '1px solid var(--g50)', borderRight: (idx+1)%7!==0?'1px solid var(--g50)':undefined, cursor: canEdit ? 'pointer' : 'default', transition: 'background 0.1s', background: today2 ? '#F0F6F2' : undefined }}
                  onMouseEnter={e => { if(canEdit)(e.currentTarget.style.background=today2?'var(--g50)':'var(--g50)') }}
                  onMouseLeave={e => { e.currentTarget.style.background=today2?'#F0F6F2':'' }}
                >
                  <div style={{ fontSize: 13, fontWeight: today2 ? 800 : 500, color: today2 ? 'var(--red)' : 'var(--navy)', marginBottom: 4 }}>
                    {today2 ? <span style={{ background: 'var(--red)', color: '#fff', width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{day}</span> : day}
                  </div>
                  {evs.slice(0,3).map(e => {
                    const m = tipoMeta(e.tipo)
                    return (
                      <div key={e.id} onClick={ev => { ev.stopPropagation(); setActive(e); setModal('detail') }} style={{ background: m.bg, color: m.color, fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 5, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                        {m.icon} {e.titulo}
                      </div>
                    )
                  })}
                  {evs.length > 3 && <div style={{ fontSize: 10, color: 'var(--g300)', fontWeight: 600 }}>+{evs.length-3} más</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── VISTA LISTA ── */}
      {viewMode === 'lista' && (
        <div>
          {filtered.length === 0 && pasados.length === 0 ? (
            <EmptyState icon="📅" title="Nessun evento" desc={canEdit ? 'Clicca su "+ Nuovo evento"' : 'Nessun evento programmato'} />
          ) : (<>
            {filtered.length > 0 && <>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--g400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Prossimi</div>
              {filtered.map(e => <EventRow key={e.id} evento={e} onView={() => { setActive(e); setModal('detail') }} onEdit={canEdit ? () => openEdit(e) : undefined} onDelete={canEdit ? () => { setActive(e); setModal('delete') } : undefined} />)}
            </>}
            {pasados.length > 0 && <>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--g400)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '20px 0 10px' }}>Passati</div>
              {pasados.slice(0,10).map(e => <EventRow key={e.id} evento={e} past onView={() => { setActive(e); setModal('detail') }} onEdit={canEdit ? () => openEdit(e) : undefined} onDelete={canEdit ? () => { setActive(e); setModal('delete') } : undefined} />)}
            </>}
          </>)}
        </div>
      )}
      </>)}

      {/* ── DETAIL MODAL ── */}
      {modal === 'detail' && active && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,34,24,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, overflow: 'hidden', animation: 'fadeIn 0.15s ease' }}>
            {(() => { const m = tipoMeta(active.tipo); return (
              <>
                <div style={{ background: m.bg, padding: '22px 24px', position: 'relative', borderBottom: `2px solid ${m.color}33` }}>
                  <button onClick={() => setModal('none')} style={{ position: 'absolute', top: 14, right: 14, width: 28, height: 28, border: 'none', background: 'rgba(0,0,0,0.07)', borderRadius: '50%', fontSize: 16, cursor: 'pointer', color: m.color }}>×</button>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{m.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: m.color }}>{active.titulo}</div>
                  {active.tipo === 'partido' && active.rival && <div style={{ fontSize: 13, color: m.color, opacity: 0.8, marginTop: 2 }}>vs {active.rival}</div>}
                  <div style={{ marginTop: 10 }}><TipoPill tipo={active.tipo} /></div>
                </div>
                <div style={{ padding: '20px 24px' }}>
                  {[
                    ['Fecha', new Date(active.fecha).toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })],
                    ['Orario', active.horaInicio ? `${active.horaInicio}${active.horaFin ? ` → ${active.horaFin}` : ''}` : '—'],
                    ['Lugar', active.lugar ?? '—'],
                    ['Obbligatorio', active.obligatorio ? 'Sí — presencia obligatoria' : 'Non obbligatorio'],
                  ].map(([l,v],i,arr) => (
                    <div key={l} style={{ padding: '10px 0', borderBottom: i<arr.length-1?'1px solid var(--g50)':undefined }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--g300)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{l}</div>
                      <div style={{ fontSize: 13, color: 'var(--navy)' }}>{v}</div>
                    </div>
                  ))}
                  {active.descripcion && <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--g50)', borderRadius: 9 }}><div style={{ fontSize: 13, color: 'var(--g500)', lineHeight: 1.55 }}>{active.descripcion}</div></div>}
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                      <button onClick={() => { setModal('none'); setTimeout(()=>openEdit(active!),80) }} style={{ flex: 1, padding: 11, border: '1px solid var(--g100)', borderRadius: 9, background: '#fff', color: 'var(--red)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Modifica</button>
                      <button onClick={() => setModal('delete')} style={{ flex: 1, padding: 11, border: 'none', borderRadius: 9, background: 'var(--red-l)', color: 'var(--red)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Eliminar</button>
                    </div>
                  )}
                </div>
              </>
            )})()}
          </div>
        </div>
      )}

      {/* ── FORM MODAL ── */}
      {modal === 'form' && (
        <div className="overlay overlay-full" onClick={() => setModal('none')}>
          <div className="modal modal-full" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div className="modal-title">{active ? 'MODIFICA EVENTO' : 'NUOVO EVENTO'}</div>
              <button className="modal-x" onClick={() => setModal('none')}>×</button>
            </div>
            <div className="modal-body">

              {/* Tipo */}
              <div style={{ marginBottom: 16 }}>
                <Label>Tipo di evento</Label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 7 }}>
                  {TIPOS.map(t => {
                    const sel = form.tipo === t.id
                    return <button key={t.id} onClick={() => setForm(f => ({ ...f, tipo: t.id }))} style={{ padding: '10px 6px', borderRadius: 9, border: `2px solid ${sel ? t.color : 'var(--g100)'}`, background: sel ? t.bg : '#fff', color: sel ? t.color : 'var(--g400)', fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>
                      <div style={{ fontSize: 18, marginBottom: 3 }}>{t.icon}</div>
                      {t.label}
                    </button>
                  })}
                </div>
              </div>

              {/* Título */}
              <div style={{ marginBottom: 16 }}>
                <Label>Titolo *</Label>
                <input className="input" placeholder="Es: Allenamento tattico" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
              </div>

              {/* Rival (solo partidos) */}
              {form.tipo === 'partido' && (
                <div style={{ marginBottom: 16 }}>
                  <Label>Avversario</Label>
                  <input className="input" placeholder="Es: Rugby Parma" value={form.rival} onChange={e => setForm(f => ({ ...f, rival: e.target.value }))} />
                </div>
              )}

              {/* Fecha + Horario */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div><Label>Fecha</Label><input className="input" type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} /></div>
                <div><Label>Ora inizio</Label><input className="input" type="time" value={form.horaInicio} onChange={e => setForm(f => ({ ...f, horaInicio: e.target.value }))} /></div>
                <div><Label>Ora fine</Label><input className="input" type="time" value={form.horaFin} onChange={e => setForm(f => ({ ...f, horaFin: e.target.value }))} /></div>
              </div>

              {/* Lugar */}
              <div style={{ marginBottom: 16 }}>
                <Label>Luogo</Label>
                <input className="input" placeholder="Es: Campo principale / Palestra" value={form.lugar} onChange={e => setForm(f => ({ ...f, lugar: e.target.value }))} />
              </div>

              {/* Descripción */}
              <div style={{ marginBottom: 16 }}>
                <Label>Descrizione <span style={{ fontWeight: 400, color: 'var(--g300)' }}>(opcional)</span></Label>
                <textarea className="input" rows={2} placeholder="Dettagli aggiuntivi dell'evento..." value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} style={{ resize: 'vertical', lineHeight: 1.5 }} />
              </div>

              {/* Obligatorio */}
              <div style={{ marginBottom: 20 }}>
                <button onClick={() => setForm(f => ({ ...f, obligatorio: !f.obligatorio }))} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: `1.5px solid ${form.obligatorio ? 'var(--red)' : 'var(--g100)'}`, borderRadius: 9, background: form.obligatorio ? 'var(--red-l)' : '#fff', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                  <div style={{ width: 20, height: 20, borderRadius: 5, border: `1.5px solid ${form.obligatorio ? 'var(--red)' : '#C5D5C9'}`, background: form.obligatorio ? 'var(--red)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', flexShrink: 0 }}>{form.obligatorio ? '✓' : ''}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: form.obligatorio ? 'var(--red)' : 'var(--navy)' }}>Presenza obbligatoria</div>
                    <div style={{ fontSize: 11, color: 'var(--g300)' }}>Verrà notificato a tutti i giocatori</div>
                  </div>
                </button>
              </div>

              <div className="modal-actions">
                <button onClick={() => setModal('none')} className="btn btn-ghost" style={{ flex: 1 }}>Annulla</button>
                <button onClick={handleSave} disabled={saving} className="btn btn-red" style={{ flex: 2, opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Salvataggio...' : active ? 'Salva modifiche' : 'Crea evento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE MODAL ── */}
      {modal === 'delete' && active && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,34,24,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '32px', width: '100%', maxWidth: 380 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--red-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24 }}>🗑</div>
              <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: 'var(--navy)' }}>Elimina evento</h2>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--g400)', lineHeight: 1.6 }}>Eliminare <strong style={{ color: 'var(--navy)' }}>{active.titulo}</strong>?</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setModal('none')} style={{ flex: 1, padding: 12, border: '1px solid var(--g100)', borderRadius: 10, background: '#fff', color: 'var(--g500)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Annulla</button>
              <button onClick={handleDelete} disabled={saving} style={{ flex: 1, padding: 12, border: 'none', borderRadius: 10, background: 'var(--red)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Eliminazione...' : 'Sì, elimina'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── EventRow component ─────────────────────────────────────────
function EventRow({ evento, past, onView, onEdit, onDelete }: { evento: Evento; past?: boolean; onView: () => void; onEdit?: () => void; onDelete?: () => void }) {
  const m = tipoMeta(evento.tipo)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', background: '#fff', border: '1px solid var(--g100)', borderRadius: 11, marginBottom: 8, opacity: past ? 0.65 : 1, transition: 'opacity 0.1s' }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{m.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{evento.titulo}</span>
          {evento.tipo === 'partido' && evento.rival && <span style={{ fontSize: 12, color: 'var(--g400)' }}>vs {evento.rival}</span>}
          {evento.obligatorio && <span style={{ background: 'var(--red-l)', color: 'var(--red)', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20 }}>obligatorio</span>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--g400)', display: 'flex', gap: 10 }}>
          <span>{new Date(evento.fecha).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
          {evento.horaInicio && <span>{evento.horaInicio}{evento.horaFin ? ` → ${evento.horaFin}` : ''}</span>}
          {evento.lugar && <span>📍 {evento.lugar}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
        <button onClick={onView} style={{ padding: '5px 10px', border: '1px solid var(--g100)', borderRadius: 7, background: '#fff', color: 'var(--g500)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Vedi</button>
        {onEdit && <button onClick={onEdit} style={{ padding: '5px 10px', border: '1px solid var(--g200)', borderRadius: 7, background: 'var(--g50)', color: 'var(--red)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Modifica</button>}
        {onDelete && <button onClick={onDelete} style={{ padding: '5px 9px', border: '1px solid #FEECEC', borderRadius: 7, background: 'var(--red-l)', color: 'var(--red)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✕</button>}
      </div>
    </div>
  )
}
