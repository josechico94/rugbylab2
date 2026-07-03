// src/modules/medico/MedicoPage.tsx
import { useEffect, useState } from 'react'
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/shared/firebase/config'
import { useAuthStore } from '@/shared/store/authStore'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { lesionesToExcel } from '@/shared/utils/export'
import { StatCard, Empty as EmptyState } from '@/shared/components/ui'
import type { Lesion, LesionEstado, LesionZona } from '@/shared/types'

// ── Constants ──────────────────────────────────────────────────
const ZONAS: { id: LesionZona; label: string; grupo: string }[] = [
  { id:'cabeza',       label:'Testa',               grupo:'Superiore' },
  { id:'cuello',       label:'Collo',               grupo:'Superiore' },
  { id:'hombro_der',   label:'Spalla destra',      grupo:'Superiore' },
  { id:'hombro_izq',   label:'Spalla sinistra',    grupo:'Superiore' },
  { id:'codo_der',     label:'Gomito destro',         grupo:'Superiore' },
  { id:'codo_izq',     label:'Gomito sinistro',       grupo:'Superiore' },
  { id:'muneca_der',   label:'Polso destro',       grupo:'Superiore' },
  { id:'muneca_izq',   label:'Polso sinistro',     grupo:'Superiore' },
  { id:'espalda_alta', label:'Schiena alta',          grupo:'Tronco'   },
  { id:'espalda_baja', label:'Schiena bassa / Lombare', grupo:'Tronco'   },
  { id:'cadera',       label:'Anca / Inguine',        grupo:'Inferiore' },
  { id:'muslo_der',    label:'Coscia destra',          grupo:'Inferiore' },
  { id:'muslo_izq',    label:'Coscia sinistra',        grupo:'Inferiore' },
  { id:'rodilla_der',  label:'Ginocchio destro',        grupo:'Inferiore' },
  { id:'rodilla_izq',  label:'Ginocchio sinistro',      grupo:'Inferiore' },
  { id:'tobillo_der',  label:'Caviglia destra',        grupo:'Inferiore' },
  { id:'tobillo_izq',  label:'Caviglia sinistra',      grupo:'Inferiore' },
  { id:'otro',         label:'Altro',                   grupo:'Altro'     },
]

const ESTADOS: { id: LesionEstado; label: string; bg: string; color: string }[] = [
  { id:'activa',          label:'Attivo',           bg:'var(--red-l)', color:'var(--red)' },
  { id:'en_recuperacion', label:'In recupero',  bg:'#FEF3DC', color:'#B45309' },
  { id:'alta_medica',     label:'Dimesso',      bg:'var(--g50)', color:'var(--red)' },
]

function estadoStyle(e: LesionEstado) {
  return ESTADOS.find(x => x.id === e) ?? ESTADOS[0]
}
function zonaLabel(z: LesionZona) {
  return ZONAS.find(x => x.id === z)?.label ?? z
}
function diasDesde(fecha: string) {
  const d = Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000)
  return d === 0 ? 'Oggi' : d === 1 ? 'Ieri' : `Hace ${d} días`
}
function diasHasta(fecha: string | null) {
  if (!fecha) return '—'
  const d = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
  if (d < 0) return 'Scaduto'
  if (d === 0) return 'Oggi'
  return `${d} días`
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--g500)', display: 'block', marginBottom: 5 }}>{children}</label>
}
function EstadoPill({ estado }: { estado: LesionEstado }) {
  const s = estadoStyle(estado)
  return <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{s.label}</span>
}

const EMPTY_FORM = () => ({
  playerId: '', playerName: '', zona: 'rodilla_der' as LesionZona,
  descripcion: '', fechaLesion: new Date().toISOString().slice(0, 10),
  fechaAltaEstimada: '', fechaAltaReal: '',
  estado: 'activa' as LesionEstado,
  mecanismo: '', tratamiento: '', observaciones: '',
})

type Modal = 'none' | 'form' | 'delete' | 'detail'

export default function MedicoPage() {
  const isMobile = useIsMobile()
  const user    = useAuthStore(s => s.user)
  const canEdit = user?.role === 'admin' || user?.role === 'cuerpo_tecnico'

  const [lesiones,  setLesiones]  = useState<Lesion[]>([])
  const [players,   setPlayers]   = useState<{ id: string; name: string; position: string }[]>([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState<Modal>('none')
  const [active,    setActive]    = useState<Lesion | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState<{ msg: string; ok: boolean } | null>(null)
  const [filterE,   setFilterE]   = useState<LesionEstado | 'all'>('all')
  const [search,    setSearch]    = useState('')
  const [form,      setForm]      = useState(EMPTY_FORM())

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (!user) return
    async function load() {
      const [lSnap, pSnap] = await Promise.all([
        getDocs(query(collection(db, 'lesiones'), where('clubId', '==', user!.clubId))),
        getDocs(query(collection(db, 'players'),  where('clubId', '==', user!.clubId))),
      ])
      setLesiones(lSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Lesion)
        .sort((a, b) => new Date(b.fechaLesion).getTime() - new Date(a.fechaLesion).getTime()))
      setPlayers(pSnap.docs.map(d => ({ id: d.id, name: (d.data() as any).name, position: (d.data() as any).position ?? '' })))
      setLoading(false)
    }
    load().catch(() => setLoading(false))
  }, [user])

  function openCreate() {
    setForm({ ...EMPTY_FORM(), playerId: players[0]?.id ?? '', playerName: players[0]?.name ?? '' })
    setActive(null); setModal('form')
  }

  function openEdit(l: Lesion) {
    setForm({
      playerId: l.playerId, playerName: l.playerName, zona: l.zona,
      descripcion: l.descripcion, fechaLesion: l.fechaLesion,
      fechaAltaEstimada: l.fechaAltaEstimada ?? '',
      fechaAltaReal: l.fechaAltaReal ?? '',
      estado: l.estado, mecanismo: l.mecanismo ?? '',
      tratamiento: l.tratamiento ?? '', observaciones: l.observaciones ?? '',
    })
    setActive(l); setModal('form')
  }

  function selectPlayer(id: string) {
    const p = players.find(p => p.id === id)
    setForm(f => ({ ...f, playerId: id, playerName: p?.name ?? '' }))
  }

  async function handleSave() {
    if (!user || !form.playerId || !form.descripcion.trim()) return showToast('Completa giocatore e descrizione', false)
    setSaving(true)
    const data = {
      playerId: form.playerId, playerName: form.playerName, clubId: user.clubId,
      zona: form.zona, descripcion: form.descripcion.trim(),
      fechaLesion: form.fechaLesion,
      fechaAltaEstimada: form.fechaAltaEstimada || null,
      fechaAltaReal: form.fechaAltaReal || null,
      estado: form.estado,
      mecanismo: form.mecanismo.trim() || null,
      tratamiento: form.tratamiento.trim() || null,
      observaciones: form.observaciones.trim() || null,
      createdBy: user.uid,
    }
    try {
      if (active) {
        await updateDoc(doc(db, 'lesiones', active.id), data)
        setLesiones(prev => prev.map(l => l.id === active.id ? { ...l, ...data } : l))
        showToast('Infortunio aggiornato')
      } else {
        const ref = await addDoc(collection(db, 'lesiones'), { ...data, createdAt: serverTimestamp() })
        setLesiones(prev => [{ id: ref.id, ...data, createdAt: new Date() } as unknown as Lesion, ...prev])
        showToast('Infortunio registrato')
      }
      setModal('none')
    } catch (e) { console.error(e); showToast('Errore nel salvataggio', false) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!active) return
    setSaving(true)
    try {
      await deleteDoc(doc(db, 'lesiones', active.id))
      setLesiones(prev => prev.filter(l => l.id !== active.id))
      setModal('none'); setActive(null); showToast('Infortunio eliminato')
    } catch { showToast('Errore durante l\'eliminazione', false) }
    finally { setSaving(false) }
  }

  async function quickEstado(l: Lesion, estado: LesionEstado) {
    try {
      const patch: Partial<Lesion> = { estado }
      if (estado === 'alta_medica' && !l.fechaAltaReal) patch.fechaAltaReal = new Date().toISOString().slice(0, 10)
      await updateDoc(doc(db, 'lesiones', l.id), patch)
      setLesiones(prev => prev.map(x => x.id === l.id ? { ...x, ...patch } : x))
      showToast('Stato aggiornato')
    } catch { showToast('Error', false) }
  }

  const filtered = lesiones.filter(l => {
    const matchE = filterE === 'all' || l.estado === filterE
    const matchS = l.playerName.toLowerCase().includes(search.toLowerCase()) ||
                   zonaLabel(l.zona).toLowerCase().includes(search.toLowerCase())
    return matchE && matchS
  })

  const activas       = lesiones.filter(l => l.estado === 'activa').length
  const recuperando   = lesiones.filter(l => l.estado === 'en_recuperacion').length
  const altas         = lesiones.filter(l => l.estado === 'alta_medica').length

  return (
    <div className="fade-in" style={{padding: isMobile ? "14px 14px 0" : undefined}}>
      {toast && <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 1000, background: toast.ok ? 'var(--navy)' : 'var(--red)', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{toast.msg}</div>}

      {/* Stats */}
      <div className="stats-grid">
        <StatCard label="Totale infortuni"     value={String(lesiones.length)} accentColor="var(--g400)" />
        <StatCard label="Infortuni attivi"   value={String(activas)}          accentColor="var(--red)" deltaType="warn" />
        <StatCard label="En recuperación"    value={String(recuperando)}      accentColor="var(--gold-d)" deltaType="warn" />
        <StatCard label="Dimissioni mediche"      value={String(altas)}            accentColor="var(--red)" deltaType="up" />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 8, marginBottom: 14, alignItems: isMobile ? 'stretch' : 'center', flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: isMobile ? '1' : undefined, maxWidth: isMobile ? '100%' : 260 }} placeholder="Cerca giocatore o zona..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="status-filter-row" style={{ display: 'flex', gap: 6 }}>
          {([['all','Tutti'],['activa','Attivi'],['en_recuperacion','In recupero'],['alta_medica','Dimessi']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setFilterE(val as any)} style={{ padding: '6px 13px', borderRadius: 20, border: '1px solid var(--g100)', background: filterE === val ? 'var(--navy)' : '#fff', color: filterE === val ? '#fff' : 'var(--g500)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
          ))}
        </div>
        {canEdit && <button onClick={openCreate} style={{ marginLeft: 'auto', padding: '9px 18px', border: 'none', borderRadius: 9, background: 'var(--red)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Registra infortunio</button>}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--g300)' }}>Caricamento...</div>
      : lesiones.length === 0 ? <EmptyState icon="🏥" title="Nessun infortunio registrato" desc={canEdit ? 'Clicca su "+ Registra infortunio"' : 'Nessun infortunio registrato'} />
      : (
        <div className="card">
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '180px 160px 110px 110px 120px 130px 140px', gap: 12, padding: '10px 18px', background: 'var(--g50)', borderBottom: '1px solid var(--g100)' }}>
            {['Jugador','Zona','Lesión','Alta est.','Días lesión','Estado','Acciones'].map((h, i) => (
              <div key={i} style={{ fontSize: 11, fontWeight: 700, color: 'var(--g400)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
            ))}
          </div>

          {filtered.length === 0 ? <EmptyState icon="🔍" title="Nessun risultato" desc="Prova con un altro filtro" />
          : filtered.map((l, i) => {
            const es = estadoStyle(l.estado)
            return (
              <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '180px 160px 110px 110px 120px 130px 140px', gap: 12, padding: '12px 18px', borderBottom: i < filtered.length - 1 ? '1px solid var(--g50)' : 'none', alignItems: 'center', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--g50)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{l.playerName}</div>
                  <div style={{ fontSize: 11, color: 'var(--g300)', marginTop: 1 }}>
                    {players.find(p => p.id === l.playerId)?.position ?? ''}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--g500)' }}>{zonaLabel(l.zona)}</div>
                <div style={{ fontSize: 12, color: 'var(--g400)' }}>{diasDesde(l.fechaLesion)}</div>
                <div style={{ fontSize: 12, color: l.fechaAltaEstimada && diasHasta(l.fechaAltaEstimada) === 'Scaduto' ? 'var(--red)' : 'var(--g500)' }}>
                  {diasHasta(l.fechaAltaEstimada)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--g400)' }}>
                  {Math.floor((Date.now() - new Date(l.fechaLesion).getTime()) / 86400000)} días
                </div>
                <div>
                  {canEdit ? (
                    <select
                      value={l.estado}
                      onChange={e => quickEstado(l, e.target.value as LesionEstado)}
                      style={{ background: es.bg, color: es.color, border: 'none', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      {ESTADOS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                    </select>
                  ) : <EstadoPill estado={l.estado} />}
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button onClick={() => { setActive(l); setModal('detail') }} style={{ padding: '5px 10px', border: '1px solid var(--g100)', borderRadius: 7, background: '#fff', color: 'var(--g500)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Vedi</button>
                  {canEdit && <>
                    <button onClick={() => openEdit(l)} style={{ padding: '5px 10px', border: '1px solid var(--g200)', borderRadius: 7, background: 'var(--g50)', color: 'var(--red)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Modifica</button>
                    <button onClick={() => { setActive(l); setModal('delete') }} style={{ padding: '5px 9px', border: '1px solid #FEECEC', borderRadius: 7, background: 'var(--red-l)', color: 'var(--red)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✕</button>
                  </>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── DETAIL MODAL ── */}
      {modal === 'detail' && active && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,34,24,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, overflow: 'hidden', animation: 'fadeIn 0.15s ease' }}>
            <div style={{ background: 'var(--navy)', padding: '22px 24px', position: 'relative' }}>
              <button onClick={() => setModal('none')} style={{ position: 'absolute', top: 14, right: 14, width: 28, height: 28, border: 'none', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', color: 'rgba(255,255,255,0.6)', fontSize: 16, cursor: 'pointer' }}>×</button>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{active.playerName}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{zonaLabel(active.zona)}</div>
              <div style={{ marginTop: 10 }}><EstadoPill estado={active.estado} /></div>
            </div>
            <div style={{ padding: '20px 24px' }}>
              {[
                ['Descrizione', active.descripcion],
                ['Fecha lesión', active.fechaLesion],
                ['Alta estimada', active.fechaAltaEstimada ?? '—'],
                ['Alta real', active.fechaAltaReal ?? '—'],
                ['Mecanismo', active.mecanismo ?? '—'],
                ['Trattamento', active.tratamiento ?? '—'],
              ].map(([l, v], i, arr) => (
                <div key={l} style={{ padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--g50)' : 'none' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--g300)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{l}</div>
                  <div style={{ fontSize: 13, color: 'var(--navy)' }}>{v}</div>
                </div>
              ))}
              {active.observaciones && (
                <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--g50)', borderRadius: 9, borderLeft: '3px solid var(--red)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--g300)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Observaciones</div>
                  <div style={{ fontSize: 13, color: 'var(--g500)', lineHeight: 1.55 }}>{active.observaciones}</div>
                </div>
              )}
              {canEdit && (
                <button onClick={() => { setModal('none'); setTimeout(() => openEdit(active!), 80) }} style={{ width: '100%', marginTop: 16, padding: 12, border: 'none', borderRadius: 10, background: 'var(--red)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Modifica infortunio
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── FORM MODAL ── */}
      {modal === 'form' && (
        <div className="overlay overlay-full" onClick={() => setModal('none')}>
          <div className="modal modal-full" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <div>
                <div className="modal-title">{active ? 'MODIFICA INFORTUNIO' : 'REGISTRA INFORTUNIO'}</div>
                <div style={{ fontSize: 12, color: 'var(--g400)', marginTop: 2 }}>Completa i dati dell'infortunio</div>
              </div>
              <button className="modal-x" onClick={() => setModal('none')}>×</button>
            </div>
            <div className="modal-body">

              {/* Jugador */}
              <div style={{ marginBottom: 16 }}>
                <Label>Giocatore *</Label>
                <select className="input" value={form.playerId} onChange={e => selectPlayer(e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Zona */}
              <div style={{ marginBottom: 16 }}>
                <Label>Zona interessata *</Label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                  {ZONAS.map(z => {
                    const active2 = form.zona === z.id
                    return (
                      <button key={z.id} onClick={() => setForm(f => ({ ...f, zona: z.id }))} style={{ padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${active2 ? 'var(--red)' : 'var(--g100)'}`, background: active2 ? 'var(--g50)' : '#fff', color: active2 ? 'var(--red)' : 'var(--g500)', fontSize: 12, fontWeight: active2 ? 700 : 400, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 3, border: `1.5px solid ${active2 ? 'var(--red)' : '#C5D5C9'}`, background: active2 ? 'var(--red)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', flexShrink: 0 }}>{active2 ? '✓' : ''}</span>
                        {z.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Descripción */}
              <div style={{ marginBottom: 16 }}>
                <Label>Descrizione dell'infortunio *</Label>
                <textarea className="input" rows={2} placeholder="Es: Distorsione di II grado legamento collaterale esterno" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} style={{ resize: 'vertical', lineHeight: 1.5 }} />
              </div>

              {/* Fechas */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 16 }}>
                <div><Label>Data infortunio</Label><input className="input" type="date" value={form.fechaLesion} onChange={e => setForm(f => ({ ...f, fechaLesion: e.target.value }))} /></div>
                <div><Label>Dimissione prevista</Label><input className="input" type="date" value={form.fechaAltaEstimada} onChange={e => setForm(f => ({ ...f, fechaAltaEstimada: e.target.value }))} /></div>
                <div><Label>Alta real</Label><input className="input" type="date" value={form.fechaAltaReal} onChange={e => setForm(f => ({ ...f, fechaAltaReal: e.target.value }))} /></div>
              </div>

              {/* Estado */}
              <div style={{ marginBottom: 16 }}>
                <Label>Stato</Label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  {ESTADOS.map(e => {
                    const active2 = form.estado === e.id
                    return <button key={e.id} onClick={() => setForm(f => ({ ...f, estado: e.id }))} style={{ padding: '10px 8px', borderRadius: 9, border: `2px solid ${active2 ? e.color : 'var(--g100)'}`, background: active2 ? e.bg : '#fff', color: active2 ? e.color : 'var(--g400)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{e.label}</button>
                  })}
                </div>
              </div>

              {/* Mecanismo + Tratamiento */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <Label>Meccanismo <span style={{ fontWeight: 400, color: 'var(--g300)' }}>(cómo ocurrió)</span></Label>
                  <input className="input" placeholder="Es: Placcaggio, caduta, sovraccarico..." value={form.mecanismo} onChange={e => setForm(f => ({ ...f, mecanismo: e.target.value }))} />
                </div>
                <div>
                  <Label>Trattamento</Label>
                  <input className="input" placeholder="Es: Fisioterapia 3x settimana, ghiaccio..." value={form.tratamiento} onChange={e => setForm(f => ({ ...f, tratamiento: e.target.value }))} />
                </div>
              </div>

              {/* Observaciones */}
              <div style={{ marginBottom: 20 }}>
                <Label>Osservazioni <span style={{ fontWeight: 400, color: 'var(--g300)' }}>(opcional)</span></Label>
                <textarea className="input" rows={2} placeholder="Note aggiuntive del medico o fisioterapista..." value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} style={{ resize: 'vertical', lineHeight: 1.5 }} />
              </div>

              <div className="modal-actions">
                <button onClick={() => setModal('none')} className="btn btn-ghost" style={{ flex: 1 }}>Annulla</button>
                <button onClick={handleSave} disabled={saving} className="btn btn-red" style={{ flex: 2, opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Salvataggio...' : active ? 'Salva modifiche' : 'Registra infortunio'}
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
              <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: 'var(--navy)' }}>Elimina infortunio</h2>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--g400)', lineHeight: 1.6 }}>Eliminare l\'infortunio di <strong style={{ color: 'var(--navy)' }}>{active.playerName}</strong>?</p>
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
