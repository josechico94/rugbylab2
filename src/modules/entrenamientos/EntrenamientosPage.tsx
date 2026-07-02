// src/modules/entrenamientos/EntrenamientosPage.tsx
// Biblioteca de recursos del club — videos, PDFs, imágenes, documentos y links externos
import { useEffect, useState, useRef } from 'react'
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/shared/firebase/config'
import { useAuthStore } from '@/shared/store/authStore'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { Empty, Toast } from '@/shared/components/ui'

const POSITIONS  = ['Tutti','Avanti','Trequarti','Piloni','Tallonatori','2a linea','Flanker','N°8','Mediano di mischia','Apertura','Centri','Ali','Estremo']
const CATEGORIES = ['Mischia','Touche','Placcaggio','Attacco','Difesa','Calci','Fitness','Tattica','Regolamento','Altro']
const RESOURCE_TYPES = [
  { id:'video',    label:'Video',      icon:'🎬', accept:'video/mp4,video/webm,video/quicktime', maxMB:200, color:'#C8102E', bg:'#FFF0F2' },
  { id:'pdf',      label:'PDF',        icon:'📄', accept:'application/pdf',                       maxMB:30,  color:'#1A2F5A', bg:'#EEF4FF' },
  { id:'image',    label:'Immagine',     icon:'🖼',  accept:'image/jpeg,image/png,image/webp',       maxMB:15,  color:'#5B21B6', bg:'#F3EEFF' },
  { id:'document', label:'Documento',  icon:'📝', accept:'.doc,.docx,.ppt,.pptx,.xls,.xlsx',       maxMB:30,  color:'#065F46', bg:'#EDFFF5' },
  { id:'link',     label:'Link esterno', icon:'🔗', accept:'',                                     maxMB:0,   color:'#9A3412', bg:'#FFF7ED' },
] as const
type ResourceType = typeof RESOURCE_TYPES[number]['id']

interface Resource {
  id: string
  title: string
  description?: string
  type: ResourceType
  url: string
  fileName?: string
  fileSizeKB?: number
  position: string[]
  category: string
  clubId: string
  uploadedBy: string
  uploadedByName: string
  createdAt?: any
}

function rt(type: ResourceType) { return RESOURCE_TYPES.find(r => r.id === type)! }

function detectLinkType(url: string): { provider: string; embedUrl?: string; thumb?: string } {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)
  if (yt) return { provider: 'YouTube', embedUrl: `https://www.youtube.com/embed/${yt[1]}`, thumb: `https://img.youtube.com/vi/${yt[1]}/mqdefault.jpg` }
  const vm = url.match(/vimeo\.com\/(\d+)/)
  if (vm) return { provider: 'Vimeo', embedUrl: `https://player.vimeo.com/video/${vm[1]}` }
  if (url.includes('drive.google.com')) return { provider: 'Google Drive' }
  if (url.includes('dropbox.com')) return { provider: 'Dropbox' }
  return { provider: 'Link externo' }
}

function FL({ c }: { c: React.ReactNode }) { return <div className="fl">{c}</div> }

const emptyForm = () => ({
  title: '', description: '', type: 'link' as ResourceType, url: '',
  position: ['Tutti'] as string[], category: 'Tattica',
})

export default function EntrenamientosPage() {
  const isMobile = useIsMobile()
  const user = useAuthStore(s => s.user)
  const canEdit = user?.role === 'admin' || user?.role === 'cuerpo_tecnico'

  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [posFilter, setPosFilter] = useState('Tutti')
  const [catFilter, setCatFilter] = useState('Tutte')
  const [typeFilter, setTypeFilter] = useState<ResourceType | 'Tutti'>('Tutti')
  const [search, setSearch] = useState('')
  const [active, setActive] = useState<Resource | null>(null)
  const [modal, setModal] = useState<'none' | 'form' | 'delete'>('none')
  const [editing, setEditing] = useState<Resource | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadPct, setUploadPct] = useState<number | null>(null)

  const [form, setForm] = useState(emptyForm())
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000) }

  useEffect(() => {
    if (!user) return
    getDocs(query(collection(db, 'videos'), where('clubId', '==', user.clubId)))
      .then(snap => setResources(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Resource)))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  function openCreate() {
    setForm(emptyForm()); setFile(null); setEditing(null); setModal('form')
  }
  function openEdit(r: Resource) {
    setForm({ title: r.title, description: r.description || '', type: r.type, url: r.url, position: r.position, category: r.category })
    setFile(null); setEditing(r); setModal('form')
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const limits = rt(form.type)
    if (f.size > limits.maxMB * 1024 * 1024) {
      showToast(`El archivo supera el límite de ${limits.maxMB}MB para ${limits.label}`, false)
      return
    }
    setFile(f)
  }

  function togglePosition(pos: string) {
    setForm(f => {
      if (pos === 'Tutti') return { ...f, position: ['Tutti'] }
      const withoutTodos = f.position.filter(p => p !== 'Tutti')
      const next = withoutTodos.includes(pos) ? withoutTodos.filter(p => p !== pos) : [...withoutTodos, pos]
      return { ...f, position: next.length ? next : ['Tutti'] }
    })
  }

  async function handleSave() {
    if (!user) return
    if (!form.title.trim()) { showToast('Il titolo è obbligatorio', false); return }
    if (form.type === 'link' && !form.url.trim()) { showToast('Incolla il link della risorsa', false); return }
    if (form.type !== 'link' && !file && !editing) { showToast('Carica un file', false); return }

    setSaving(true)
    try {
      let finalUrl = form.url
      let fileName: string | undefined
      let fileSizeKB: number | undefined

      if (form.type !== 'link' && file) {
        setUploadPct(0)
        const ext = file.name.split('.').pop()
        const path = `videos/${user.clubId}/${Date.now()}_${form.title.replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`
        const storageRef = ref(storage, path)
        await uploadBytes(storageRef, file)
        finalUrl = await getDownloadURL(storageRef)
        fileName = file.name
        fileSizeKB = Math.round(file.size / 1024)
        setUploadPct(100)
      }

      const data: Omit<Resource, 'id'> = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        type: form.type,
        url: finalUrl,
        position: form.position,
        category: form.category,
        clubId: user.clubId,
        uploadedBy: user.uid,
        uploadedByName: user.name,
      } as any
      // Only set fileName/fileSizeKB if a new file was uploaded this time
      if (file) {
        (data as any).fileName = fileName ?? null
        ;(data as any).fileSizeKB = fileSizeKB ?? null
      } else if (!editing) {
        (data as any).fileName = null
        ;(data as any).fileSizeKB = null
      }

      if (editing) {
        await updateDoc(doc(db, 'videos', editing.id), data as any)
        setResources(prev => prev.map(r => r.id === editing.id ? { ...r, ...data } : r))
        showToast('Risorsa aggiornata')
      } else {
        const ref2 = await addDoc(collection(db, 'videos'), { ...data, createdAt: serverTimestamp() })
        setResources(prev => [{ id: ref2.id, ...data }, ...prev])
        showToast('Risorsa aggiunta alla libreria')
      }
      setModal('none')
    } catch (e) {
      console.error(e)
      showToast('Errore nel salvataggio — controlla Storage/CORS', false)
    } finally {
      setSaving(false); setUploadPct(null)
    }
  }

  async function handleDelete() {
    if (!active) return
    setSaving(true)
    try {
      await deleteDoc(doc(db, 'videos', active.id))
      setResources(prev => prev.filter(r => r.id !== active.id))
      setModal('none'); setActive(null)
      showToast('Risorsa eliminata')
    } catch { showToast('Errore durante l\'eliminazione', false) }
    finally { setSaving(false) }
  }

  const filtered = resources.filter(r => {
    const matchPos = posFilter === 'Tutti' || r.position.includes(posFilter) || r.position.includes('Tutti')
    const matchCat = catFilter === 'Tutte' || r.category === catFilter
    const matchType = typeFilter === 'Tutti' || r.type === typeFilter
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase())
    return matchPos && matchCat && matchType && matchSearch
  })

  const counts = RESOURCE_TYPES.reduce((acc, t) => ({ ...acc, [t.id]: resources.filter(r => r.type === t.id).length }), {} as Record<string, number>)

  // ── DETAIL VIEW ──────────────────────────────────────────────
  if (active) {
    const link = active.type === 'link' ? detectLinkType(active.url) : null
    const meta = rt(active.type)
    return (
      <div className="fade-in" style={{padding: isMobile ? "16px 16px 0" : undefined}}>
        {toast && <Toast msg={toast.msg} type={toast.ok ? 'ok' : 'err'} />}
        <button onClick={() => setActive(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, border: 'none', background: 'transparent', color: 'var(--red)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
          ← Torna alla libreria
        </button>

        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 300px",gap:16}}>
          <div>
            {/* Preview */}
            <div style={{ background: 'var(--navy)', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
              {active.type === 'video' && (
                <video src={active.url} controls style={{ width: '100%', display: 'block', aspectRatio: '16/9', background: '#000' }} />
              )}
              {active.type === 'link' && link?.embedUrl && (
                <iframe src={link.embedUrl} style={{ width: '100%', aspectRatio: '16/9', border: 'none', display: 'block' }} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
              )}
              {active.type === 'link' && !link?.embedUrl && (
                <div style={{ aspectRatio: '16/9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }}>
                  <div style={{ fontSize: 44 }}>🔗</div>
                  <div style={{ color: '#fff', fontSize: 14, textAlign: 'center' }}>Recurso alojado en {link?.provider}</div>
                  <a href={active.url} target="_blank" rel="noopener noreferrer" className="btn btn-gold btn-sm">Abrir {link?.provider} →</a>
                </div>
              )}
              {active.type === 'pdf' && (
                <iframe src={active.url} style={{ width: '100%', height: 520, border: 'none', display: 'block', background: '#fff' }} />
              )}
              {active.type === 'image' && (
                <img src={active.url} alt={active.title} style={{ width: '100%', display: 'block', maxHeight: 480, objectFit: 'contain', background: '#000' }} />
              )}
              {active.type === 'document' && (
                <div style={{ aspectRatio: '16/9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }}>
                  <div style={{ fontSize: 44 }}>{meta.icon}</div>
                  <div style={{ color: '#fff', fontSize: 14, textAlign: 'center' }}>{active.fileName}</div>
                  <a href={active.url} target="_blank" rel="noopener noreferrer" download className="btn btn-gold btn-sm">⬇ Descargar documento</a>
                </div>
              )}
            </div>

            <div className="card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <div>
                  <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: 'var(--navy)' }}>{active.title}</h2>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className="pill" style={{ background: meta.bg, color: meta.color }}>{meta.icon} {meta.label}</span>
                    <span className="pill pill-navy">{active.category}</span>
                    {active.position.map(p => <span key={p} className="pill pill-green">{p}</span>)}
                  </div>
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => openEdit(active)} className="btn btn-ghost btn-xs">Editar</button>
                    <button onClick={() => setModal('delete')} className="btn btn-danger btn-xs">✕</button>
                  </div>
                )}
              </div>
              {active.description && <p style={{ fontSize: 13, color: 'var(--g500)', lineHeight: 1.6, margin: '0 0 12px' }}>{active.description}</p>}
              <div style={{ fontSize: 12, color: 'var(--g400)', paddingTop: 12, borderTop: '1px solid var(--g100)' }}>
                Caricato da {active.uploadedByName}{active.fileSizeKB ? ` · ${(active.fileSizeKB / 1024).toFixed(1)} MB` : ''}
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>Altro da {active.category}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {resources.filter(r => r.category === active.category && r.id !== active.id).slice(0, 8).map(r => {
                const m = rt(r.type)
                return (
                  <button key={r.id} onClick={() => setActive(r)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--g100)', borderRadius: 10, background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{m.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)', lineHeight: 1.3 }} className="truncate">{r.title}</div>
                      <div style={{ fontSize: 10, color: 'var(--g400)', marginTop: 2 }}>{m.label}</div>
                    </div>
                  </button>
                )
              })}
              {resources.filter(r => r.category === active.category && r.id !== active.id).length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--g400)', padding: '8px 0' }}>Non ci sono altre risorse in questa categoria</div>
              )}
            </div>
          </div>
        </div>

        {modal === 'delete' && <DeleteModal item={active} onClose={() => setModal('none')} onConfirm={handleDelete} saving={saving} />}
        {modal === 'form' && <FormModal form={form} setForm={setForm} file={file} setFile={setFile} fileRef={fileRef} onFileChange={onFileChange} togglePosition={togglePosition} editing={editing} saving={saving} uploadPct={uploadPct} onSave={handleSave} onClose={() => setModal('none')} />}
      </div>
    )
  }

  // ── LIBRARY VIEW ─────────────────────────────────────────────
  return (
    <div className="fade-in" style={{padding: isMobile ? "16px 16px 0" : undefined}}>
      {toast && <Toast msg={toast.msg} type={toast.ok ? 'ok' : 'err'} />}

      {/* Stats by type */}
      <div className="grid-auto-sm" style={{ marginBottom: 22 }}>
        {RESOURCE_TYPES.map(t => (
          <div key={t.id} className="stat" style={{ cursor: 'pointer' }} onClick={() => setTypeFilter(typeFilter === t.id ? 'Tutti' : t.id)}>
            <div className="stat-accent" style={{ background: t.color }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="stat-lbl">{t.label}{typeFilter === t.id ? ' ✓' : ''}</div>
              <span style={{ fontSize: 16 }}>{t.icon}</span>
            </div>
            <div className="stat-val">{counts[t.id] || 0}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <input className="input toolbar-search" placeholder="Cerca risorsa..." value={search} onChange={e => setSearch(e.target.value)} />
        {canEdit && <button onClick={openCreate} className="btn btn-red toolbar-push">+ Carica risorsa</button>}
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--g400)', alignSelf: 'center', marginRight: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Posizione</span>
          {POSITIONS.map(p => (
            <button key={p} onClick={() => setPosFilter(p)} style={{ padding: '5px 13px', borderRadius: 20, border: '1px solid var(--g100)', background: posFilter === p ? 'var(--navy)' : '#fff', color: posFilter === p ? '#fff' : 'var(--g500)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{p}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--g400)', alignSelf: 'center', marginRight: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Categoria</span>
          {['Tutte', ...CATEGORIES].map(c => (
            <button key={c} onClick={() => setCatFilter(c)} style={{ padding: '5px 13px', borderRadius: 20, border: '1px solid var(--g100)', background: catFilter === c ? 'var(--red)' : '#fff', color: catFilter === c ? '#fff' : 'var(--g500)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{c}</button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 50, color: 'var(--g300)' }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>🎬</div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, letterSpacing: '.06em' }}>Caricamento libreria...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <Empty icon="🎥" title={resources.length === 0 ? 'Libreria vuota' : 'Nessun risultato'}
            desc={resources.length === 0 ? (canEdit ? 'Carica il primo video, PDF o documento del club' : 'Lo staff tecnico non ha ancora caricato risorse') : 'Prova con un altro filtro o ricerca'}
            action={canEdit && resources.length === 0 ? <button onClick={openCreate} className="btn btn-red btn-sm">+ Carica risorsa</button> : undefined}
          />
        </div>
      ) : (
        <div className="mod-grid" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(220px,1fr))', gap: isMobile ? 10 : 14 }}>
          {filtered.map(r => {
            const m = rt(r.type)
            const link = r.type === 'link' ? detectLinkType(r.url) : null
            return (
              <div key={r.id} onClick={() => setActive(r)} className="card" style={{ cursor: 'pointer', transition: 'transform .15s, box-shadow .15s' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = '')}>
                <div style={{ background: m.bg, height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                  {link?.thumb
                    ? <img src={link.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : r.type === 'image'
                      ? <img src={r.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 36 }}>{m.icon}</span>
                  }
                  <div style={{ position: 'absolute', bottom: 7, right: 8, background: 'rgba(10,22,40,.85)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 5, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    {m.label}
                  </div>
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', lineHeight: 1.4, marginBottom: 8 }} className="truncate">{r.title}</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    <span className="pill pill-green" style={{ fontSize: 10 }}>{r.position[0]}</span>
                    <span className="pill pill-navy" style={{ fontSize: 10 }}>{r.category}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal === 'form' && <FormModal form={form} setForm={setForm} file={file} setFile={setFile} fileRef={fileRef} onFileChange={onFileChange} togglePosition={togglePosition} editing={editing} saving={saving} uploadPct={uploadPct} onSave={handleSave} onClose={() => setModal('none')} />}
    </div>
  )
}

// ── FORM MODAL ───────────────────────────────────────────────
function FormModal({ form, setForm, file, setFile, fileRef, onFileChange, togglePosition, editing, saving, uploadPct, onSave, onClose }: any) {
  const meta = rt(form.type)
  const isLink = form.type === 'link'

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600, maxHeight: '92dvh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div>
            <div className="modal-title">{editing ? 'MODIFICA RISORSA' : 'CARICA RISORSA'}</div>
            <div style={{ fontSize: 12, color: 'var(--g400)', marginTop: 2 }}>Video, PDF, immagine, documento o link esterno</div>
          </div>
          <button className="modal-x" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">

          {/* Type selector */}
          <div style={{ marginBottom: 18 }}>
            <FL c="Tipo di risorsa *" />
            <div className="form-grid-4" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
              {RESOURCE_TYPES.map(t => {
                const active = form.type === t.id
                return (
                  <button key={t.id} onClick={() => { setForm((f: any) => ({ ...f, type: t.id })); setFile(null) }}
                    disabled={!!editing}
                    style={{ padding: '10px 6px', borderRadius: 10, border: `2px solid ${active ? t.color : 'var(--g100)'}`, background: active ? t.bg : '#fff', cursor: editing ? 'not-allowed' : 'pointer', textAlign: 'center', opacity: editing && !active ? 0.4 : 1, transition: 'all .12s' }}>
                    <div style={{ fontSize: 18, marginBottom: 3 }}>{t.icon}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: active ? t.color : 'var(--g500)' }}>{t.label}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Title */}
          <div style={{ marginBottom: 14 }}>
            <FL c="Titolo *" />
            <input className="input" placeholder="Es: Mischia — posizione e spinta del pilone" value={form.title} onChange={(e: any) => setForm((f: any) => ({ ...f, title: e.target.value }))} />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 18 }}>
            <FL c="Descrizione (opzionale)" />
            <textarea className="input" rows={2} placeholder="Breve descrizione del contenuto..." value={form.description} onChange={(e: any) => setForm((f: any) => ({ ...f, description: e.target.value }))} />
          </div>

          {/* Upload or Link */}
          {isLink ? (
            <div style={{ marginBottom: 18 }}>
              <FL c="URL della risorsa *" />
              <input className="input" placeholder="https://youtube.com/watch?v=... · https://drive.google.com/..." value={form.url} onChange={(e: any) => setForm((f: any) => ({ ...f, url: e.target.value }))} />
              <div style={{ fontSize: 11, color: 'var(--g400)', marginTop: 6 }}>
                Supporta YouTube, Vimeo, Google Drive, Dropbox o qualsiasi link diretto
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 18 }}>
              <FL c={`File (${meta.label}) ${editing ? '— opzionale, lascia vuoto per mantenere quello attuale' : '*'}`} />
              <div
                onClick={() => fileRef.current?.click()}
                style={{ border: `2px dashed ${file ? meta.color : 'var(--g200)'}`, borderRadius: 12, padding: '24px 16px', textAlign: 'center', cursor: 'pointer', background: file ? meta.bg : 'var(--g50)', transition: 'all .15s' }}>
                {file ? (
                  <>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{meta.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: meta.color, marginBottom: 2 }}>{file.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--g400)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>{meta.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--g500)', marginBottom: 2 }}>Clicca per selezionare il file</div>
                    <div style={{ fontSize: 11, color: 'var(--g300)' }}>Máx {meta.maxMB}MB</div>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept={meta.accept} onChange={onFileChange} style={{ display: 'none' }} />
              {uploadPct !== null && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ height: 6, background: 'var(--g100)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${uploadPct}%`, background: meta.color, transition: 'width .3s' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--g400)', marginTop: 4 }}>Caricamento... {uploadPct}%</div>
                </div>
              )}
            </div>
          )}

          {/* Position */}
          <div style={{ marginBottom: 18 }}>
            <FL c="Posizione/i" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {POSITIONS.map(p => {
                const active = form.position.includes(p)
                return (
                  <button key={p} onClick={() => togglePosition(p)} style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${active ? 'var(--navy)' : 'var(--g200)'}`, background: active ? 'var(--navy)' : '#fff', color: active ? '#fff' : 'var(--g500)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{p}</button>
                )
              })}
            </div>
          </div>

          {/* Category */}
          <div style={{ marginBottom: 22 }}>
            <FL c="Categoria" />
            <select className="input" value={form.category} onChange={(e: any) => setForm((f: any) => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 10, paddingTop: 14, borderTop: '1px solid var(--g100)' }}>
            <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Annulla</button>
            <button onClick={onSave} disabled={saving} className="btn btn-red" style={{ flex: 2, opacity: saving ? 0.6 : 1 }}>
              {saving ? (uploadPct !== null ? 'Caricamento file...' : 'Salvataggio...') : editing ? 'Salva modifiche' : 'Carica nella libreria'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── DELETE MODAL ─────────────────────────────────────────────
function DeleteModal({ item, onClose, onConfirm, saving }: any) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '30px 24px', textAlign: 'center' }}>
          <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--red-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 20 }}>🗑</div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: 'var(--navy)', marginBottom: 8 }}>ELIMINA RISORSA</div>
          <p style={{ fontSize: 13, color: 'var(--g400)', lineHeight: 1.6, marginBottom: 20 }}>Eliminare <strong style={{ color: 'var(--navy)' }}>{item.title}</strong> dalla libreria?</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Annulla</button>
            <button onClick={onConfirm} disabled={saving} className="btn btn-red" style={{ flex: 1, opacity: saving ? 0.6 : 1 }}>{saving ? '...' : 'Sì, elimina'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
