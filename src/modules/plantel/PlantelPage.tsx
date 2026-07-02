// src/modules/plantel/PlantelPage.tsx
// Lógica completa v1 · Diseño BRC v3 (navy/rojo/dorado · Bebas Neue)
import { useEffect, useState, useRef } from 'react'
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/shared/firebase/config'
import { useAuthStore } from '@/shared/store/authStore'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { playersToExcel } from '@/shared/utils/export'
import type { Player } from '@/shared/types'

const POSITIONS = [
  'Pilone sinistro','Pilone destro','Tallonatore',
  'Seconda linea','Flanker aperto','Flanker chiuso','Numero 8',
  'Mediano di mischia','Apertura','Centro','Ala sinistra','Ala destra','Estremo',
]

const STATUS_OPTIONS = ['Disponibile','Infortunato','Dubbio','Squalificato'] as const
type PlayerStatus = typeof STATUS_OPTIONS[number]

const STATUS_META: Record<PlayerStatus,{bg:string;color:string;dot:string}> = {
  Disponibile: { bg:'#E6F9EE', color:'#0A6E2E', dot:'#00C853' },
  Infortunato: { bg:'#FFE8EC', color:'#C8102E', dot:'#C8102E' },
  Dubbio:      { bg:'#FFF8E1', color:'#B45309', dot:'#FFB300' },
  Squalificato:{ bg:'#EEF0F3', color:'#4B5563', dot:'#9CA3AF' },
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).map(w=>w[0]).slice(0,2).join('').toUpperCase()
}

function PlayerAvatar({ name, photoUrl, size=40 }: { name:string; photoUrl?:string; size?:number }) {
  const [err, setErr] = useState(false)
  const r = Math.round(size * 0.25)
  if (photoUrl && !err) return (
    <img src={photoUrl} alt={name} onError={()=>setErr(true)}
      style={{width:size,height:size,borderRadius:r,objectFit:'cover',objectPosition:'top',flexShrink:0}}/>
  )
  return (
    <div style={{width:size,height:size,borderRadius:r,background:'var(--navy)',color:'var(--gold)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.32,fontWeight:700,flexShrink:0,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:'0.04em'}}>
      {getInitials(name||'?')}
    </div>
  )
}

function StatusBadge({ status }: { status:string }) {
  const m = STATUS_META[status as PlayerStatus] ?? STATUS_META.Disponibile
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:5,background:m.bg,color:m.color,fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:99}}>
      <span style={{width:6,height:6,borderRadius:'50%',background:m.dot,flexShrink:0}}/>
      {status}
    </span>
  )
}

function FL({ children }: { children: React.ReactNode }) {
  return <div style={{fontSize:11,fontWeight:700,color:'var(--g400)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:6}}>{children}</div>
}

const emptyForm = () => ({
  name:'', number:'', positions:[] as string[],
  status:'Disponibile' as PlayerStatus,
  birthDate:'', weight:'', height:'', notes:'', photoUrl:'',
})
type FormData = ReturnType<typeof emptyForm>
type Modal = {type:'none'} | {type:'form';player:Player|null} | {type:'delete';player:Player} | {type:'profile';player:Player}

export default function PlantelPage() {
  const user    = useAuthStore(s=>s.user)
  const isMobile = useIsMobile()
  const canEdit = user?.role==='admin' || user?.role==='cuerpo_tecnico'

  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [statusF, setStatusF] = useState<'Tutti'|PlayerStatus>('Tutti')
  const [modal, setModal]     = useState<Modal>({type:'none'})
  const [form, setForm]       = useState<FormData>(emptyForm())
  const [errors, setErrors]   = useState<Record<string,string>>({})
  const [saving, setSaving]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string|null>(null)
  const [photoFile, setPhotoFile] = useState<File|null>(null)
  const [toast, setToast]     = useState<{msg:string;ok:boolean}|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function showToast(msg:string, ok=true) { setToast({msg,ok}); setTimeout(()=>setToast(null),3000) }

  useEffect(() => {
    if (!user) return
    getDocs(query(collection(db,'players'),where('clubId','==',user.clubId)))
      .then(s=>setPlayers(s.docs.map(d=>({id:d.id,...d.data()}) as Player)))
      .catch(console.error).finally(()=>setLoading(false))
  },[user])

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    if (f.size>5*1024*1024) { showToast('La foto deve pesare meno di 5MB',false); return }
    setPhotoFile(f); setPreview(URL.createObjectURL(f))
  }

  async function uploadPhoto(pid:string): Promise<string|null> {
    if (!photoFile) return form.photoUrl||null
    setUploading(true)
    try {
      const r = ref(storage,`players/${pid}/avatar.jpg`)
      await uploadBytes(r,photoFile)
      return await getDownloadURL(r)
    } catch { showToast('Impossibile caricare la foto',false); return null }
    finally { setUploading(false) }
  }

  function openCreate() {
    setForm(emptyForm()); setErrors({}); setPreview(null); setPhotoFile(null)
    setModal({type:'form',player:null})
  }

  function openEdit(p:Player) {
    const positions = Array.isArray((p as any).positions)?(p as any).positions:p.position?[p.position]:[]
    setForm({name:p.name,number:String(p.number),positions,status:p.status as PlayerStatus,
      birthDate:p.birthDate??'',weight:p.weight?String(p.weight):'',
      height:p.height?String(p.height):'',notes:(p as any).notes??'',photoUrl:p.avatarUrl??''})
    setErrors({}); setPreview(p.avatarUrl??null); setPhotoFile(null)
    setModal({type:'form',player:p})
  }

  function togglePos(pos:string) {
    setForm(f=>({...f,positions:f.positions.includes(pos)?f.positions.filter(x=>x!==pos):[...f.positions,pos]}))
  }

  function validate() {
    const e:Record<string,string>={}
    if (!form.name.trim()) e.name='Il nome è obbligatorio'
    if (!form.number.trim()) e.number='Il numero è obbligatorio'
    else if (isNaN(+form.number)||+form.number<1||+form.number>99) e.number='Tra 1 e 99'
    if (!form.positions.length) e.positions='Seleziona almeno una posizione'
    setErrors(e); return !Object.keys(e).length
  }

  async function handleSave() {
    if (!validate()||!user) return; setSaving(true)
    try {
      const isEdit = modal.type==='form'&&modal.player
      const pid = isEdit ? modal.player!.id : `player_${Date.now()}`
      const photoUrl = await uploadPhoto(pid)
      const data:Record<string,any> = {
        name:form.name.trim(), number:+form.number, position:form.positions[0],
        positions:form.positions, status:form.status, birthDate:form.birthDate||null,
        weight:form.weight?+form.weight:null, height:form.height?+form.height:null,
        notes:form.notes.trim()||null, avatarUrl:photoUrl, clubId:user.clubId, role:'jugador',
      }
      if (isEdit) {
        await updateDoc(doc(db,'players',modal.player!.id),data)
        setPlayers(prev=>prev.map(p=>p.id===modal.player!.id?{...p,...data}:p))
        showToast('Giocatore aggiornato')
      } else {
        const r2=await addDoc(collection(db,'players'),{...data,createdAt:serverTimestamp()})
        setPlayers(prev=>[...prev,{id:r2.id,...data} as unknown as Player])
        showToast('Giocatore creato')
      }
      setModal({type:'none'})
    } catch { showToast('Errore nel salvataggio — controlla i permessi',false) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (modal.type!=='delete') return; setSaving(true)
    try {
      await deleteDoc(doc(db,'players',modal.player.id))
      setPlayers(prev=>prev.filter(p=>p.id!==modal.player.id))
      setModal({type:'none'}); showToast('Giocatore eliminato')
    } catch { showToast('Errore durante l\'eliminazione',false) }
    finally { setSaving(false) }
  }

  const filtered = players.filter(p=>{
    const q=search.toLowerCase()
    return (p.name?.toLowerCase().includes(q)||p.position?.toLowerCase().includes(q)||String(p.number).includes(q))
      && (statusF==='Tutti'||p.status===statusF)
  }).sort((a,b)=>a.number-b.number)

  const stats = {
    total:players.length,
    disp:players.filter(p=>p.status==='Disponibile').length,
    les:players.filter(p=>p.status==='Infortunato').length,
    duda:players.filter(p=>p.status==='Dubbio').length,
  }

  return (
    <div className="fade-in" style={{padding: isMobile ? "14px 14px 0" : undefined}}>
      {toast && <div className={`toast ${toast.ok?'ok':'err'}`}><span style={{fontWeight:700}}>{toast.ok?'✓':'✕'}</span>{toast.msg}</div>}

      {/* STATS */}
      <div className="stats-grid" style={{marginBottom:24}}>
        {[
          {l:'Totale rosa', v:stats.total, a:'var(--navy)',   i:'👥'},
          {l:'Disponibili',   v:stats.disp,  a:'#00C853',       i:'✅'},
          {l:'Infortunati',    v:stats.les,   a:'var(--red)',     i:'🏥'},
          {l:'In dubbio',      v:stats.duda,  a:'var(--gold)',    i:'❓'},
        ].map(s=>(
          <div key={s.l} className="stat">
            <div className="stat-accent" style={{background:s.a}}/>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
              <div className="stat-lbl">{s.l}</div>
              <span style={{fontSize:18,opacity:0.22}}>{s.i}</span>
            </div>
            <div className="stat-val">{s.v}</div>
          </div>
        ))}
      </div>

      {/* TOOLBAR */}
      <div style={{display:'flex',gap:10,marginBottom:18,alignItems:'center',flexWrap:'wrap'}}>
        <div style={{position:'relative',flex:'1 1 260px',maxWidth:320}}>
          <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:13,color:'var(--g300)',pointerEvents:'none'}}>🔍</span>
          <input className="input" style={{paddingLeft:36}} placeholder="Nome, posizione o numero..."
            value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <div className="status-filter-row">
          {(['Tutti',...STATUS_OPTIONS] as const).map(s=>{
            const active=statusF===s
            const m=s!=='Tutti'?STATUS_META[s as PlayerStatus]:null
            return (
              <button key={s} onClick={()=>setStatusF(s)}
                style={{padding:'6px 13px',borderRadius:99,border:`1.5px solid ${active?(m?.color??'var(--navy)'):'var(--g200)'}`,background:active?(m?.bg??'var(--navy)'):'var(--white)',color:active?(m?.color??'var(--white)'):'var(--g500)',fontSize:11.5,fontWeight:600,cursor:'pointer',transition:'all 0.15s'}}>
                {s}
              </button>
            )
          })}
        </div>
        {canEdit && <button onClick={openCreate} className="btn btn-red" style={{marginLeft:'auto'}}>+ Nuovo giocatore</button>}
        {players.length > 0 && <button onClick={() => playersToExcel(players)} className="btn btn-ghost btn-sm" style={{display:'flex',alignItems:'center',gap:6}}>📊 Excel</button>}
      </div>

      {/* TABLE */}
      {loading ? (
        <div style={{textAlign:'center',padding:60,color:'var(--g300)'}}>
          <div style={{fontSize:32,marginBottom:12,opacity:0.3}}>🏉</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:'0.06em'}}>Caricamento rosa...</div>
        </div>
      ) : isMobile ? (
        /* ── MOBILE: player cards ── */
        <div style={{display:'flex',flexDirection:'column',gap:0}}>
          {filtered.length===0 ? (
            <div className="card" style={{padding:'40px 16px',textAlign:'center'}}>
              <div style={{fontSize:32,marginBottom:10,opacity:.3}}>{players.length===0?'🏉':'🔍'}</div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:'.05em',color:'rgba(255,255,255,.5)',marginBottom:4}}>
                {players.length===0?'La rosa è vuota':'Nessun risultato'}
              </div>
            </div>
          ) : filtered.map((p,i)=>{
            const posArr:string[]=Array.isArray((p as any).positions)?(p as any).positions:[p.position]
            const STATUS_COLORS:any={Disponibile:'#00C853',Infortunato:'var(--red)',Dubbio:'#FFB300',Squalificato:'var(--g400)'}
            return (
              <div key={p.id}
                onClick={()=>setModal({type:'profile',player:p})}
                style={{display:'flex',alignItems:'center',gap:14,padding:'14px 4px',borderBottom:'1px solid rgba(255,255,255,.06)',cursor:'pointer',transition:'opacity .15s'}}
                onTouchStart={e=>e.currentTarget.style.opacity='.7'}
                onTouchEnd={e=>e.currentTarget.style.opacity='1'}
              >
                {/* Jersey number */}
                <div style={{width:36,height:36,borderRadius:10,background:'rgba(245,197,24,.1)',border:'1px solid rgba(245,197,24,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Bebas Neue',sans-serif",fontSize:17,color:'var(--gold)',flexShrink:0}}>
                  {p.number}
                </div>
                {/* Avatar */}
                <PlayerAvatar name={p.name} photoUrl={p.avatarUrl} size={44}/>
                {/* Info */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:700,color:'#fff',marginBottom:3}} className="truncate">{p.name}</div>
                  <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                    {posArr.slice(0,1).map(pos=>(
                      <span key={pos} style={{fontSize:10,fontWeight:600,color:'rgba(255,255,255,.45)',background:'rgba(255,255,255,.07)',padding:'2px 8px',borderRadius:6}}>{pos}</span>
                    ))}
                    <span style={{display:'flex',alignItems:'center',gap:4,fontSize:10,fontWeight:600,color:STATUS_COLORS[p.status]||'var(--g400)'}}>
                      <span style={{width:5,height:5,borderRadius:'50%',background:STATUS_COLORS[p.status]||'var(--g400)',display:'inline-block'}}/>
                      {p.status}
                    </span>
                  </div>
                </div>
                {/* Chevron */}
                <div style={{fontSize:14,color:'rgba(255,255,255,.2)',flexShrink:0}}>›</div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ── DESKTOP: full table ── */
        <div className="card">
          <div className="plantel-table-wrap">
          <div style={{minWidth:680}}>
          <div style={{display:'grid',gridTemplateColumns:'48px 52px 1fr 190px 130px 155px',gap:12,padding:'10px 20px',background:'var(--g50)',borderBottom:'1px solid var(--g100)'}}>
            {['#','','Giocatore','Posizione/i','Stato','Azioni'].map((h,i)=>(
              <div key={i} style={{fontSize:10,fontWeight:700,color:'var(--g400)',textTransform:'uppercase',letterSpacing:'0.07em'}}>{h}</div>
            ))}
          </div>
          {filtered.length===0 ? (
            <div style={{padding:'56px 24px',textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:14,opacity:0.3}}>{players.length===0?'🏉':'🔍'}</div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'0.05em',color:'var(--g400)',marginBottom:5}}>
                {players.length===0?'La rosa è vuota':'Nessun risultato'}
              </div>
            </div>
          ) : filtered.map((p,i)=>{
            const posArr:string[]=Array.isArray((p as any).positions)?(p as any).positions:[p.position]
            return (
              <div key={p.id}
                style={{display:'grid',gridTemplateColumns:'48px 52px 1fr 190px 130px 155px',gap:12,padding:'12px 20px',borderBottom:i<filtered.length-1?'1px solid var(--g50)':'none',alignItems:'center',transition:'background 0.1s',cursor:'pointer'}}
                onMouseEnter={e=>(e.currentTarget.style.background='var(--g50)')}
                onMouseLeave={e=>(e.currentTarget.style.background='')}
                onClick={()=>setModal({type:'profile',player:p})}
              >
                <div style={{width:32,height:32,borderRadius:8,background:'var(--navy)',color:'var(--gold)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Bebas Neue',sans-serif",fontSize:15,letterSpacing:'0.03em'}}>
                  {p.number}
                </div>
                <PlayerAvatar name={p.name} photoUrl={p.avatarUrl} size={36}/>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:13.5,fontWeight:600,color:'var(--navy)',marginBottom:2}} className="truncate">{p.name}</div>
                  <div style={{fontSize:11,color:'var(--g400)'}}>
                    {[p.height&&`${p.height}cm`,p.weight&&`${p.weight}kg`].filter(Boolean).join(' · ')||'Nessun dato fisico'}
                  </div>
                </div>
                <div style={{display:'flex',gap:4,flexWrap:'wrap'}} onClick={e=>e.stopPropagation()}>
                  {posArr.slice(0,2).map((pos,pi)=>(
                    <span key={pos} style={{fontSize:10.5,background:pi===0?'var(--navy)':'var(--g100)',color:pi===0?'var(--gold)':'var(--g500)',padding:'2px 8px',borderRadius:99,fontWeight:600}}>{pos}</span>
                  ))}
                  {posArr.length>2&&<span style={{fontSize:10.5,background:'var(--g100)',color:'var(--g400)',padding:'2px 8px',borderRadius:99,fontWeight:600}}>+{posArr.length-2}</span>}
                </div>
                <div onClick={e=>e.stopPropagation()}><StatusBadge status={p.status}/></div>
                <div style={{display:'flex',gap:5}} onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>setModal({type:'profile',player:p})} className="btn btn-ghost btn-xs">Vedi</button>
                  {canEdit&&<>
                    <button onClick={()=>openEdit(p)} style={{padding:'4px 10px',border:'1px solid var(--navy)',borderRadius:6,background:'rgba(10,22,40,0.06)',color:'var(--navy)',fontSize:11,fontWeight:600,cursor:'pointer'}}>Modifica</button>
                    <button onClick={()=>setModal({type:'delete',player:p})} className="btn btn-danger btn-xs">✕</button>
                  </>}
                </div>
              </div>
            )
          })}
          </div>
          </div>
        </div>
      )}

      {/* ── FORM MODAL ── */}
      {modal.type==='form'&&(
        <div className="overlay" onClick={()=>setModal({type:'none'})}>
          <div className="modal" style={{maxWidth:620,maxHeight:'92dvh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
            <div className="modal-hdr">
              <div>
                <div className="modal-title">{modal.player?'MODIFICA GIOCATORE':'NUOVO GIOCATORE'}</div>
                <div style={{fontSize:12,color:'var(--g400)',marginTop:2}}>{modal.player?`Modifica: ${modal.player.name}`:'Completa i dati del giocatore'}</div>
              </div>
              <button className="modal-x" onClick={()=>setModal({type:'none'})}>×</button>
            </div>
            <div className="modal-body">
              {/* FOTO */}
              <div style={{marginBottom:22}}>
                <FL>Foto profilo</FL>
                <div style={{display:'flex',alignItems:'center',gap:16}}>
                  <div style={{width:76,height:76,borderRadius:16,overflow:'hidden',background:'var(--navy)',flexShrink:0,border:'2px solid var(--g100)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {preview?<img src={preview} alt="preview" style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'top'}}/>
                      :<span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:'var(--gold)',letterSpacing:'0.04em'}}>{form.name?getInitials(form.name):'?'}</span>}
                  </div>
                  <div>
                    <button onClick={()=>fileRef.current?.click()} className="btn btn-ghost btn-sm" style={{marginBottom:6,display:'block'}}>
                      📷 {preview?'Cambia foto':'Carica foto'}
                    </button>
                    {preview&&<button onClick={()=>{setPreview(null);setPhotoFile(null);setForm(f=>({...f,photoUrl:''}))}} className="btn btn-danger btn-sm" style={{display:'block',marginBottom:6}}>Rimuovi</button>}
                    <div style={{fontSize:11,color:'var(--g300)'}}>JPG o PNG · Max 5MB</div>
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhotoChange} style={{display:'none'}}/>
                  </div>
                </div>
              </div>

              {/* NOMBRE + NÚMERO */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 140px',gap:14,marginBottom:16}}>
                <div>
                  <FL>Nome completo *</FL>
                  <input className="input" placeholder="Es: Marco Rossi" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
                  {errors.name&&<div style={{fontSize:11,color:'var(--red)',marginTop:3}}>{errors.name}</div>}
                </div>
                <div>
                  <FL>N° maglia *</FL>
                  <input className="input" type="number" min={1} max={99} placeholder="10" value={form.number} onChange={e=>setForm(f=>({...f,number:e.target.value}))}/>
                  {errors.number&&<div style={{fontSize:11,color:'var(--red)',marginTop:3}}>{errors.number}</div>}
                </div>
              </div>

              {/* POSICIONES */}
              <div style={{marginBottom:18}}>
                <FL>Posizione/i * {form.positions.length>0&&<span style={{fontWeight:400,textTransform:'none',letterSpacing:0,marginLeft:4,color:'var(--g300)'}}>{form.positions.length} {form.positions.length>1?'selezionate':'selezionata'}</span>}</FL>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                  {POSITIONS.map(pos=>{
                    const active=form.positions.includes(pos)
                    return (
                      <button key={pos} onClick={()=>togglePos(pos)}
                        style={{padding:'8px 10px',borderRadius:8,textAlign:'left',border:`1.5px solid ${active?'var(--navy)':'var(--g200)'}`,background:active?'var(--navy)':'var(--white)',color:active?'var(--gold)':'var(--g500)',fontSize:12,fontWeight:active?600:400,cursor:'pointer',transition:'all 0.12s',display:'flex',alignItems:'center',gap:8}}>
                        <span style={{width:14,height:14,borderRadius:4,border:`1.5px solid ${active?'var(--gold)':'var(--g200)'}`,background:active?'var(--gold)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:8,color:'var(--navy)',fontWeight:800}}>
                          {active?'✓':''}
                        </span>
                        {pos}
                      </button>
                    )
                  })}
                </div>
                {errors.positions&&<div style={{fontSize:11,color:'var(--red)',marginTop:5}}>{errors.positions}</div>}
              </div>

              {/* ESTADO */}
              <div style={{marginBottom:18}}>
                <FL>Stato</FL>
                <div style={{display:'grid',gridTemplateColumns:'var(--cols-4)',gap:8}}>
                  {STATUS_OPTIONS.map(s=>{
                    const m=STATUS_META[s]; const active=form.status===s
                    return (
                      <button key={s} onClick={()=>setForm(f=>({...f,status:s}))}
                        style={{padding:'10px 6px',borderRadius:9,border:`2px solid ${active?m.color:'var(--g200)'}`,background:active?m.bg:'var(--white)',color:active?m.color:'var(--g400)',fontSize:12,fontWeight:700,cursor:'pointer',transition:'all 0.12s',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
                        <span style={{width:7,height:7,borderRadius:'50%',background:active?m.dot:'var(--g200)',flexShrink:0}}/>
                        {s}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* DATOS FÍSICOS */}
              <div style={{borderTop:'1px solid var(--g100)',paddingTop:18,marginBottom:18}}>
                <FL>Dati fisici <span style={{fontWeight:400,textTransform:'none',letterSpacing:0}}>(opzionale)</span></FL>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                  {[{l:'Nascita',t:'date',k:'birthDate',p:''},{l:'Peso (kg)',t:'number',k:'weight',p:'88'},{l:'Altezza (cm)',t:'number',k:'height',p:'182'}].map(f=>(
                    <div key={f.k}>
                      <div style={{fontSize:11,color:'var(--g400)',marginBottom:4}}>{f.l}</div>
                      <input className="input" type={f.t} placeholder={f.p} value={(form as any)[f.k]} onChange={e=>setForm(prev=>({...prev,[f.k]:e.target.value}))}/>
                    </div>
                  ))}
                </div>
              </div>

              {/* NOTAS */}
              <div style={{marginBottom:22}}>
                <FL>Note <span style={{fontWeight:400,textTransform:'none',letterSpacing:0}}>(opzionale)</span></FL>
                <textarea className="input" rows={3} placeholder="Es: Capitano della squadra. Esperienza in nazionale giovanile..."
                  value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={{resize:'vertical',lineHeight:1.55}}/>
                <div style={{fontSize:11,color:'var(--g300)',marginTop:3}}>{form.notes.length} / 500</div>
              </div>

              <div style={{display:'flex',gap:10,paddingTop:14,borderTop:'1px solid var(--g100)'}}>
                <button onClick={()=>setModal({type:'none'})} className="btn btn-ghost" style={{flex:1}}>Annulla</button>
                <button onClick={handleSave} disabled={saving||uploading} className="btn btn-red" style={{flex:2,opacity:saving||uploading?0.6:1}}>
                  {uploading?'Caricamento foto...':saving?'Salvataggio...':modal.player?'Salva modifiche':'Crea giocatore'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE MODAL ── */}
      {modal.type==='delete'&&(
        <div className="overlay" onClick={()=>setModal({type:'none'})}>
          <div className="modal" style={{maxWidth:380}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'32px 28px',textAlign:'center'}}>
              <div style={{width:56,height:56,borderRadius:'50%',background:'var(--red-light)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',fontSize:22}}>🗑</div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:'0.05em',color:'var(--navy)',marginBottom:8}}>ELIMINA GIOCATORE</div>
              <p style={{fontSize:13,color:'var(--g400)',lineHeight:1.6,marginBottom:22}}>
                Sei sicuro di voler eliminare <strong style={{color:'var(--navy)'}}>{modal.player.name}</strong>? Questa azione non può essere annullata.
              </p>
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setModal({type:'none'})} className="btn btn-ghost" style={{flex:1}}>Annulla</button>
                <button onClick={handleDelete} disabled={saving} className="btn btn-red" style={{flex:1,opacity:saving?0.6:1}}>
                  {saving?'Eliminazione...':'Sì, elimina'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PROFILE MODAL ── */}
      {modal.type==='profile'&&(()=>{
        const p=modal.player
        const posArr:string[]=Array.isArray((p as any).positions)?(p as any).positions:[p.position]
        return (
          <div className="overlay" onClick={()=>setModal({type:'none'})}>
            <div className="modal" style={{maxWidth:440,overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
              {/* Hero */}
              <div style={{background:'var(--navy)',padding:'28px 24px 24px',position:'relative',overflow:'hidden'}}>
                <div style={{position:'absolute',top:-30,right:-30,width:150,height:150,borderRadius:'50%',background:'radial-gradient(circle,rgba(200,16,46,0.2) 0%,transparent 70%)',pointerEvents:'none'}}/>
                <button onClick={()=>setModal({type:'none'})} style={{position:'absolute',top:14,right:14,width:28,height:28,border:'none',background:'rgba(255,255,255,0.08)',borderRadius:'50%',color:'rgba(255,255,255,0.5)',fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                <div style={{display:'flex',alignItems:'center',gap:18,position:'relative',zIndex:1}}>
                  <div style={{width:72,height:72,borderRadius:16,overflow:'hidden',border:'2.5px solid rgba(255,255,255,0.15)',flexShrink:0}}>
                    {p.avatarUrl
                      ?<img src={p.avatarUrl} alt={p.name} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'top'}}/>
                      :<div style={{width:'100%',height:'100%',background:'var(--red)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:'#fff',letterSpacing:'0.04em'}}>{getInitials(p.name??'?')}</div>
                    }
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:'0.04em',color:'#fff',lineHeight:0.95,marginBottom:6}}>{p.name}</div>
                    <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginBottom:8}}>{posArr.slice(0,2).join(' · ')}{posArr.length>2?` +${posArr.length-2}`:''}</div>
                    <StatusBadge status={p.status}/>
                  </div>
                  <div style={{width:50,height:50,borderRadius:12,background:'var(--red)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:'var(--shadow-red)'}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:'0.02em',color:'#fff'}}>{p.number}</div>
                  </div>
                </div>
              </div>
              {/* Quick stats */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',background:'var(--g50)',borderBottom:'1px solid var(--g100)'}}>
                {[
                  {l:'Altezza',v:p.height?`${p.height}cm`:'—'},
                  {l:'Peso',  v:p.weight?`${p.weight}kg`:'—'},
                  {l:'Età',  v:p.birthDate?`${new Date().getFullYear()-new Date(p.birthDate).getFullYear()} anni`:'—'},
                ].map((s,i)=>(
                  <div key={s.l} style={{padding:'14px 16px',borderRight:i<2?'1px solid var(--g100)':undefined,textAlign:'center'}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:'0.02em',color:'var(--navy)'}}>{s.v}</div>
                    <div style={{fontSize:10,fontWeight:600,color:'var(--g400)',textTransform:'uppercase',letterSpacing:'0.06em',marginTop:2}}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{padding:'18px 22px 22px'}}>
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--g400)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:7}}>Posizioni</div>
                  <div className="status-filter-row">
                    {posArr.map((pos,i)=>(
                      <span key={pos} style={{fontSize:11,background:i===0?'var(--navy)':'var(--g100)',color:i===0?'var(--gold)':'var(--g500)',padding:'3px 10px',borderRadius:99,fontWeight:600}}>
                        {i===0?'★ ':''}{pos}
                      </span>
                    ))}
                  </div>
                </div>
                {(p as any).notes&&(
                  <div style={{padding:'12px 14px',background:'var(--g50)',borderRadius:10,borderLeft:'3px solid var(--red)',marginBottom:14}}>
                    <div style={{fontSize:10,fontWeight:700,color:'var(--g400)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>Note</div>
                    <div style={{fontSize:13,color:'var(--g600)',lineHeight:1.55}}>{(p as any).notes}</div>
                  </div>
                )}
                {canEdit&&(
                  <button onClick={()=>{setModal({type:'none'});setTimeout(()=>openEdit(p),80)}} className="btn btn-primary" style={{width:'100%',padding:'12px'}}>
                    Modifica giocatore
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
