import React from 'react'
// src/modules/gimnasio/GimnasioPage.tsx — BRC v3
import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/shared/firebase/config'
import { useAuthStore } from '@/shared/store/authStore'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { Empty, Toast } from '@/shared/components/ui'
import PhotoScanner from '@/shared/components/PhotoScanner'
import { routineToExcel } from '@/shared/utils/export'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const DAYS    = ['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'] as const
const STYPES  = ['Forza','Potenza','Resistenza','Velocità','Tecnica','Riposo'] as const
const BLOCKS  = [
  {id:'entrada_calor',label:'Riscaldamento',icon:'🔥',bg:'#FFF0F2',color:'#C8102E'},
  {id:'principal',    label:'Blocco principale',icon:'💪',bg:'#EEF4FF',color:'#1A2F5A'},
  {id:'circuito',     label:'Circuito',        icon:'⚡',bg:'#F3EEFF',color:'#5B21B6'},
  {id:'skills',       label:'Skills',          icon:'🏉',bg:'#EDFFF5',color:'#065F46'},
  {id:'vuelta_calma', label:'Defaticamento',icon:'🧘',bg:'#F8F9FC',color:'#3D4A62'},
] as const
type BT = typeof BLOCKS[number]['id']

interface SD { reps:number; weight:number|null }
interface Ex { name:string; sets:number; reps:number; weight:number|null; unit:string; notes:string|null; setDetails:SD[]|null }
interface EB { blockType:BT; exercises:Ex[]; circuitRounds:number|null; circuitRestSecs:number|null }
interface RD { day:string; type:string; blocks:EB[]; completed:boolean; completedAt:any }
interface Rt { id:string; playerId:string; clubId:string; week:number; year:number; days:RD[]; createdBy:string }

const bm=(id:BT)=>BLOCKS.find(b=>b.id===id)??BLOCKS[1]
const eEx=():Ex=>({name:'',sets:3,reps:8,weight:null,unit:'kg',notes:null,setDetails:null})
const eBl=(t:BT):EB=>({blockType:t,exercises:[eEx()],circuitRounds:t==='circuito'?4:null,circuitRestSecs:t==='circuito'?30:null})
const eDay=(day:string):RD=>({day,type:'Forza',blocks:[eBl('entrada_calor'),eBl('principal')],completed:false,completedAt:null})

function san(days:RD[]) {
  return days.map(d=>({day:d.day,type:d.type,completed:d.completed??false,completedAt:d.completedAt??null,
    blocks:d.blocks.map(b=>({blockType:b.blockType,circuitRounds:b.circuitRounds??null,circuitRestSecs:b.circuitRestSecs??null,
      exercises:b.exercises.map(e=>({name:e.name??'',sets:e.sets??0,reps:e.reps??0,weight:e.weight??null,unit:e.unit??'kg',notes:e.notes??null,
        setDetails:e.setDetails?.map(s=>({reps:s.reps??0,weight:s.weight??null}))??null}))}))}))
}

const EVO=[{w:'S8',s:100,b:85,d:120},{w:'S9',s:105,b:87,d:125},{w:'S10',s:110,b:90,d:130},{w:'S11',s:115,b:95,d:130},{w:'S12',s:120,b:100,d:135}]

function FL({c}:{c:React.ReactNode}){return<div style={{fontSize:11,fontWeight:700,color:'var(--g400)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:5}}>{c}</div>}

// Legacy day name translation (for Firestore data saved with Spanish names)
const DAY_IT: Record<string,string> = {
  'Lunes':'Lunedì','Martes':'Martedì','Miércoles':'Mercoledì','Jueves':'Giovedì',
  'Viernes':'Venerdì','Sábado':'Sabato','Domingo':'Domenica',
  'Lunedì':'Lunedì','Martedì':'Martedì','Mercoledì':'Mercoledì','Giovedì':'Giovedì',
  'Venerdì':'Venerdì','Sabato':'Sabato','Domenica':'Domenica',
}
const TYPE_IT: Record<string,string> = {
  'Fuerza':'Forza','Potencia':'Potenza','Resistencia':'Resistenza','Velocidad':'Velocità',
  'Técnica':'Tecnica','Descanso':'Riposo',
  'Forza':'Forza','Potenza':'Potenza','Resistenza':'Resistenza','Velocità':'Velocità',
  'Tecnica':'Tecnica','Riposo':'Riposo',
}

export default function GimnasioPage(){
  const [showScanner, setShowScanner] = useState(false)
  const [scanTarget, setScanTarget] = useState<{di:number;bi:number}|null>(null)

  const isMobile = useIsMobile()
  const user=useAuthStore(s=>s.user)
  const canEdit=user?.role==='admin'||user?.role==='cuerpo_tecnico'
  const [rts,setRts]=useState<Rt[]>([])
  const [players,setPlayers]=useState<{id:string;name:string}[]>([])
  const [loading,setL]=useState(true)
  const [active,setActive]=useState<Rt|null>(null)
  const [aDay,setADay]=useState<RD|null>(null)
  const [tab,setTab]=useState<'r'|'e'>('r')
  const [modal,setModal]=useState<'none'|'form'|'del'|'picker'>('none')
  const [saving,setSaving]=useState(false)
  const [toast,setToast]=useState<{msg:string;ok:boolean}|null>(null)
  const [fPid,setFPid]=useState('')
  const [fW,setFW]=useState('')
  const [fY,setFY]=useState('')
  const [fDays,setFDays]=useState<RD[]>([])

  function gw(){const n=new Date(),s=new Date(n.getFullYear(),0,1);return Math.ceil(((n.getTime()-s.getTime())/86400000+s.getDay()+1)/7)}
  function t2(msg:string,ok=true){setToast({msg,ok});setTimeout(()=>setToast(null),3000)}

  useEffect(()=>{
    if(!user)return
    Promise.all([getDocs(query(collection(db,'routines'),where('clubId','==',user.clubId))),getDocs(query(collection(db,'players'),where('clubId','==',user.clubId)))])
      .then(([rs,ps])=>{const r2=rs.docs.map(d=>({id:d.id,...d.data()}) as Rt);setRts(r2);setPlayers(ps.docs.map(d=>({id:d.id,name:(d.data() as any).name})));if(user.role==='jugador'){const m=r2.find(r=>r.playerId===user.uid);if(m){setActive(m);setADay(m.days[0]??null)}}}).catch(console.error).finally(()=>setL(false))
  },[user])

  function openCreate(){setFPid(players[0]?.id??'');setFW(String(gw()));setFY(String(new Date().getFullYear()));setFDays([eDay('Lunedì'),eDay('Mercoledì'),eDay('Venerdì')]);setActive(null);setModal('form')}
  function openEdit(r:Rt){setFPid(r.playerId);setFW(String(r.week));setFY(String(r.year));setFDays(JSON.parse(JSON.stringify(r.days.map(d=>({...d,blocks:(d.blocks&&d.blocks.length>0)?d.blocks:[{blockType:'principal' as BT,exercises:(d as any).exercises??[],circuitRounds:null,circuitRestSecs:null}]})))));setActive(r);setModal('form')}

  const aD=(i:number,p:Partial<RD>)=>setFDays(v=>v.map((d,j)=>j===i?{...d,...p}:d))
  const aBl=(di:number,bt:BT)=>setFDays(v=>v.map((d,i)=>i===di?{...d,blocks:[...d.blocks,eBl(bt)]}:d))
  const rBl=(di:number,bi:number)=>setFDays(v=>v.map((d,i)=>i===di?{...d,blocks:d.blocks.filter((_,j)=>j!==bi)}:d))
  const uBl=(di:number,bi:number,p:Partial<EB>)=>setFDays(v=>v.map((d,i)=>i===di?{...d,blocks:d.blocks.map((b,j)=>j===bi?{...b,...p}:b)}:d))
  const aEx=(di:number,bi:number)=>setFDays(v=>v.map((d,i)=>i===di?{...d,blocks:d.blocks.map((b,j)=>j===bi?{...b,exercises:[...b.exercises,eEx()]}:b)}:d))
  const rEx=(di:number,bi:number,ei:number)=>setFDays(v=>v.map((d,i)=>i===di?{...d,blocks:d.blocks.map((b,j)=>j===bi?{...b,exercises:b.exercises.filter((_,k)=>k!==ei)}:b)}:d))
  const uEx=(di:number,bi:number,ei:number,p:Partial<Ex>)=>setFDays(v=>v.map((d,i)=>i===di?{...d,blocks:d.blocks.map((b,j)=>j===bi?{...b,exercises:b.exercises.map((e,k)=>k===ei?{...e,...p}:e)}:b)}:d))
  const tSets=(di:number,bi:number,ei:number,ex:Ex)=>ex.setDetails?uEx(di,bi,ei,{setDetails:null}):uEx(di,bi,ei,{setDetails:Array.from({length:ex.sets||3},()=>({reps:ex.reps||8,weight:ex.weight??null}))})
  const uSet=(di:number,bi:number,ei:number,si:number,p:Partial<SD>)=>setFDays(v=>v.map((d,i)=>i===di?{...d,blocks:d.blocks.map((b,j)=>j===bi?{...b,exercises:b.exercises.map((e,k)=>k===ei?{...e,setDetails:e.setDetails?.map((s,l)=>l===si?{...s,...p}:s)??null}:e)}:b)}:d))
  const aSet=(di:number,bi:number,ei:number,ex:Ex)=>{const l=ex.setDetails?.[ex.setDetails.length-1];uEx(di,bi,ei,{setDetails:[...(ex.setDetails??[]),{reps:l?.reps??6,weight:l?.weight??null}],sets:(ex.setDetails?.length??0)+1})}
  const rSet=(di:number,bi:number,ei:number,si:number,ex:Ex)=>{const u=ex.setDetails?.filter((_,l)=>l!==si)??[];uEx(di,bi,ei,{setDetails:u.length>0?u:null,sets:u.length||ex.sets})}

  async function handleSave(){
    if(!user||!fPid)return;setSaving(true)
    const data={playerId:fPid,clubId:user.clubId,week:+fW,year:+fY,days:san(fDays),createdBy:user.uid}
    try{
      if(active){await updateDoc(doc(db,'routines',active.id),data);setRts(p=>p.map(r=>r.id===active.id?{...r,...data}:r));t2('Scheda aggiornata')}
      else{const ref=await addDoc(collection(db,'routines'),{...data,createdAt:serverTimestamp()});const nr={id:ref.id,...data} as unknown as Rt;setRts(p=>[...p,nr]);setActive(nr);setADay(nr.days[0]??null);t2('Scheda creata')}
      setModal('none')
    }catch{t2('Errore nel salvataggio',false)}finally{setSaving(false)}
  }
  async function handleDel(){
    if(!active)return;setSaving(true)
    try{await deleteDoc(doc(db,'routines',active.id));setRts(p=>p.filter(r=>r.id!==active.id));setActive(null);setADay(null);setModal('none');t2('Scheda eliminata')}
    catch{t2('Errore',false)}finally{setSaving(false)}
  }
  async function markDone(dayName:string){
    if(!active)return;const upd={...active,days:active.days.map(d=>d.day===dayName?{...d,completed:!d.completed}:d)};setActive(upd);setADay(upd.days.find(d=>d.day===dayName)??null);try{await updateDoc(doc(db,'routines',active.id),{days:upd.days})}catch{}
  }

  const pName=(id:string)=>players.find(p=>p.id===id)?.name??'—'

  function onScanResult(result: ScanResult) {
    setShowScanner(false)
    if (scanTarget && result.type === 'exercise') {
      const newExs = result.items.map(i => ({
        name: i.name,
        sets: parseInt(i.quantity.split('x')[0]) || 3,
        reps: parseInt(i.quantity.split('x')[1] || i.quantity) || 10,
        weight: null, unit: 'kg', notes: i.quantity, setDetails: null,
      }))
      const { di, bi } = scanTarget
      setFDays(v => v.map((d, i) => i === di ? {
        ...d, blocks: d.blocks.map((b, j) => j === bi ? { ...b, exercises: [...b.exercises, ...newExs] } : b)
      } : d))
      showToast2(`✓ ${result.items.length} ejercicios agregados`)
      setScanTarget(null)
    } else if (result.type === 'exercise') {
      // Open form with scanned exercises in main block
      setFPid(players[0]?.id ?? '')
      const days = [{ day: 'Lunedì', type: 'Forza', completed: false, completedAt: null,
        blocks: [{ blockType: 'principal' as const, circuitRounds: null, circuitRestSecs: null,
          exercises: result.items.map(i => ({
            name: i.name,
            sets: parseInt(i.quantity.split('x')[0]) || 3,
            reps: parseInt(i.quantity.split('x')[1] || i.quantity) || 10,
            weight: null, unit: 'kg', notes: i.quantity, setDetails: null,
          }))
        }]
      }]
      setFDays(days)
      setActive(null)
      setModal('form')
    }
  }

  function showToast2(msg: string) { t2(msg, true) }

  async function handleExcelDownload() {
    if (!active) return
    routineToExcel(active, pName(active.playerId))
  }

  async function handlePDFDownload() {
    if (!active) return
    const name = pName(active.playerId)
    const rows: string[][] = []
    for (const day of active.days || []) {
      rows.push([day.day, day.type, '', '', '', '', ''])
      for (const block of day.blocks || []) {
        rows.push(['', block.blockType, '', '', '', '', ''])
        for (const ex of block.exercises || []) {
          if (ex.setDetails?.length) {
            rows.push(['', '', ex.name, `${ex.sets} series`, '', ex.unit || 'kg', ex.notes || ''])
            ex.setDetails.forEach((s: any, si: number) => {
              rows.push(['', '', `  Serie ${si+1}`, '', String(s.reps), String(s.weight || ''), ''])
            })
          } else {
            rows.push(['', '', ex.name, `${ex.sets} x ${ex.reps}`, '', `${ex.weight || '-'} ${ex.unit || 'kg'}`, ex.notes || ''])
          }
        }
      }
    }
    await exportPDF({
      title: `Rutina — ${name}`,
      subtitle: `Settimana ${active.week}/${active.year}`,
      filename: `rutina_semana${active.week}_${name.replace(/ /g,'_')}`,
      tables: [{
        title: `Settimana ${active.week} · ${name}`,
        head: [['Día','Tipo','Ejercicio','Series','Reps/Dur','Carga','Notas']],
        body: rows,
      }],
    })
  }
  const disp=aDay??active?.days[0]??null
  const doneN=active?.days.filter(d=>d.completed).length??0

  return(
    <div className="fade-in" style={{padding: isMobile ? "14px 14px 0" : undefined}}>
      {showScanner && <PhotoScanner mode="exercise" onClose={() => setShowScanner(false)} onResult={onScanResult}/>}
      {toast&&<Toast msg={toast.msg} type={toast.ok?'ok':'err'}/>}
      <div className="stats-grid" style={{marginBottom:22}}>
        {[{l:'Schede',v:String(rts.length),a:'var(--navy)'},{l:'Settimana',v:active?`${doneN}/${active.days.length}`:'—',a:'var(--red)'},{l:'1RM Squat',v:'120 kg',a:'#5B21B6'},{l:'Peso',v:'88 kg',a:'var(--gold-d)'}].map(s=>(
          <div key={s.l} className="stat"><div className="stat-accent" style={{background:s.a}}/><div className="stat-lbl">{s.l}</div><div className="stat-val">{s.v}</div></div>
        ))}
      </div>

      {canEdit&&(
        <div style={{display:'flex',gap:10,marginBottom:18,flexWrap:'wrap',alignItems:'center'}}>
          {rts.length>0&&(
            <button type="button" className="picker-trigger" style={{maxWidth:320}} onClick={()=>setModal('picker')}>
              <span className={active?'picker-trigger-label':'picker-trigger-placeholder'}>{active?`${pName(active.playerId)} — Settimana ${active.week}/${active.year}`:'— Seleziona scheda —'}</span>
              <span className="picker-chev">▾</span>
            </button>
          )}
          <button onClick={openCreate} className="btn btn-red">+ Nuova scheda</button>
            <button onClick={() => setShowScanner(true)} className="btn btn-ghost btn-sm" style={{display:'flex',alignItems:'center',gap:6}}>📷 Scansiona scheda</button>
          {active&&<>
            <button onClick={()=>openEdit(active)} className="btn btn-ghost btn-sm">Modifica</button>
            <button onClick={()=>setModal('del')} className="btn btn-danger btn-sm">Elimina</button>
            <button onClick={()=>routineToExcel(active, pName(active.playerId))} className="btn btn-ghost btn-sm" style={{display:'flex',alignItems:'center',gap:5}}>📊 Excel</button>
          </>}
        </div>
      )}

      <div className="module-tabs" style={{display:'flex',gap:0,marginBottom:18,background:'#fff',border:'1px solid var(--g100)',borderRadius:9,padding:3,width:'fit-content'}}>
        {(['r','e'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:'6px 18px',border:'none',borderRadius:7,fontSize:12.5,fontWeight:600,cursor:'pointer',background:tab===t?'var(--navy)':'transparent',color:tab===t?'#fff':'var(--g400)',transition:'all .14s'}}>
            {t==='r'?'Scheda settimanale':'Evoluzione dei carichi'}
          </button>
        ))}
      </div>

      {tab==='r'&&(
        loading?<div style={{textAlign:'center',padding:40,color:'var(--g300)'}}>Caricamento...</div>
        :!active?<div className="card"><Empty icon="🏋️" title="Nessuna scheda assegnata" desc={canEdit?'Crea una nuova scheda':'Il preparatore non ha ancora assegnato la tua scheda'}/></div>
        :(
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"minmax(160px,200px) 1fr",gap:16}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:'var(--g400)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:10}}>Settimana {active.week}</div>
              {active.days.map(d=>{const isA=disp?.day===d.day;return(
                <button key={d.day} onClick={()=>setADay(d)} style={{display:'flex',alignItems:'center',gap:9,padding:'10px 12px',borderRadius:10,border:isA?'none':'1px solid var(--g100)',background:isA?'var(--navy)':'#fff',color:isA?'#fff':'var(--navy)',cursor:'pointer',textAlign:'left',width:'100%',marginBottom:5,transition:'all .14s'}}>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700}}>{d.day}</div><div style={{fontSize:11,opacity:.5,marginTop:1}}>{d.type}</div></div>
                  {d.completed?<span style={{fontSize:12,color:isA?'#6EE7B7':'var(--success)'}}>✓</span>:<span style={{width:7,height:7,borderRadius:'50%',background:'var(--g200)',display:'block'}}/>}
                </button>
              )})}
            </div>
            {disp&&(
              <div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:'.04em',color:'var(--navy)'}}>{disp.day}</div>
                    <span className="pill pill-gray">{disp.type}</span>
                  </div>
                  {disp.completed?<span className="pill pill-green">✓ Completato</span>:<button onClick={()=>markDone(disp.day)} className="btn btn-red btn-sm">Segna come completato</button>}
                </div>
                {(disp.blocks??[]).map((block,bi)=>{const b=bm(block.blockType);return(
                  <div key={bi} className="card" style={{marginBottom:12,overflow:'visible'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',background:b.bg,borderBottom:'1px solid var(--g100)'}}>
                      <span style={{fontSize:16}}>{b.icon}</span><span style={{fontSize:13,fontWeight:700,color:b.color}}>{b.label}</span>
                      {block.blockType==='circuito'&&block.circuitRounds&&<span style={{fontSize:11,color:b.color,opacity:.7}}>{block.circuitRounds} rondas · {block.circuitRestSecs}s</span>}
                    </div>
                    <div style={{overflowX:'auto'}}>
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:400}}>
                        <thead><tr style={{background:'var(--g50)'}}>{['Esercizio','Serie / Carico','Note'].map(h=><th key={h} style={{padding:'7px 14px',textAlign:'left',fontSize:10,fontWeight:700,color:'var(--g400)',textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid var(--g100)',whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
                        <tbody>{block.exercises.map((ex,ei)=>(
                          <tr key={ei} style={{borderBottom:'1px solid var(--g50)'}}>
                            <td style={{padding:'10px 14px',fontWeight:600,color:'var(--navy)',whiteSpace:'nowrap'}}>{ex.name}</td>
                            <td style={{padding:'10px 14px'}}>
                              {ex.setDetails?(
                                <div style={{display:'flex',flexDirection:'column',gap:3}}>
                                  {ex.setDetails.map((s,si)=>(
                                    <div key={si} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--g600)'}}>
                                      <span style={{width:18,height:18,borderRadius:'50%',background:'var(--navy)',color:'var(--gold)',fontSize:9,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{si+1}</span>
                                      {s.reps} reps{s.weight?` · ${s.weight} ${ex.unit}`:''}
                                    </div>
                                  ))}
                                </div>
                              ):<span style={{color:'var(--g500)'}}>{ex.sets}×{ex.reps} rip{ex.weight?` · ${ex.weight} ${ex.unit}`:''}</span>}
                            </td>
                            <td style={{padding:'10px 14px',color:'var(--g400)',fontSize:11}}>{ex.notes||'—'}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </div>
        )
      )}

      {tab==='e'&&(
        <div className="card">
          <div className="card-hdr"><span className="card-title">EVOLUZIONE DEI CARICHI</span></div>
          <div style={{padding:'16px 18px'}}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={EVO} margin={{top:5,right:20,bottom:5,left:0}}>
                <XAxis dataKey="w" tick={{fontSize:11,fill:'var(--g400)'}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:11,fill:'var(--g400)'}} axisLine={false} tickLine={false} unit=" kg"/>
                <Tooltip contentStyle={{background:'#fff',border:'1px solid var(--g100)',borderRadius:8,fontSize:12}} formatter={(v:number,n:string)=>[`${v} kg`,n==='s'?'Squat':n==='b'?'Panca piana':'Stacco da terra']}/>
                <Line type="monotone" dataKey="s" name="s" stroke="var(--navy)"   strokeWidth={2.5} dot={{r:4,fill:'var(--navy)'}}/>
                <Line type="monotone" dataKey="b" name="b" stroke="var(--red)"    strokeWidth={2.5} dot={{r:4,fill:'var(--red)'}}/>
                <Line type="monotone" dataKey="d" name="d" stroke="var(--gold-d)" strokeWidth={2.5} dot={{r:4,fill:'var(--gold-d)'}}/>
              </LineChart>
            </ResponsiveContainer>
            <div style={{display:'flex',gap:18,justifyContent:'center',marginTop:10}}>
              {[['var(--navy)','Squat'],['var(--red)','Panca piana'],['var(--gold-d)','Stacco da terra']].map(([c,l])=>(
                <div key={l} style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:10,height:10,borderRadius:'50%',background:c}}/><span style={{fontSize:12,color:'var(--g500)'}}>{l}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PICKER — SELEZIONA SCHEDA */}
      {modal==='picker'&&(
        <div className="overlay overlay-full" onClick={()=>setModal('none')}>
          <div className="modal modal-full modal-picker" onClick={e=>e.stopPropagation()}>
            <div className="modal-hdr">
              <div className="modal-title">SELEZIONA SCHEDA</div>
              <button className="modal-x" onClick={()=>setModal('none')}>×</button>
            </div>
            <div className="modal-body">
              {rts.length===0?(
                <div className="picker-empty">Nessuna scheda disponibile</div>
              ):rts.map(r=>(
                <button key={r.id} type="button" className={`picker-row${active?.id===r.id?' active':''}`} onClick={()=>{setActive(r);setADay(r.days[0]??null);setModal('none')}}>
                  <div>
                    <div>{pName(r.playerId)}</div>
                    <div className="picker-row-sub">Settimana {r.week}/{r.year} · {r.days.length} giorni</div>
                  </div>
                  <div className="picker-row-check">{active?.id===r.id?'✓':''}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FORM MODAL */}
      {modal==='form'&&(
        <div className="overlay overlay-full" onClick={()=>setModal('none')}>
          <div className="modal modal-full" onClick={e=>e.stopPropagation()}>
            <div className="modal-hdr">
              <div><div className="modal-title">{active?'MODIFICA SCHEDA':'NUOVA SCHEDA'}</div><div style={{fontSize:12,color:'var(--g400)',marginTop:2}}>Organizza per blocchi con serie individualizzate</div></div>
              <button className="modal-x" onClick={()=>setModal('none')}>×</button>
            </div>
            <div className="modal-body">
              <div style={{display:'grid',gridTemplateColumns:'1fr 100px 100px',gap:12,marginBottom:20}}>
                <div><div style={{fontSize:11,fontWeight:700,color:'var(--g400)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:5}}>Giocatore *</div><select className="input" value={fPid} onChange={e=>setFPid(e.target.value)}><option value="">— Seleziona —</option>{players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div><div style={{fontSize:11,fontWeight:700,color:'var(--g400)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:5}}>Semana</div><input className="input" type="number" value={fW} onChange={e=>setFW(e.target.value)}/></div>
                <div><div style={{fontSize:11,fontWeight:700,color:'var(--g400)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:5}}>Anno</div><input className="input" type="number" value={fY} onChange={e=>setFY(e.target.value)}/></div>
              </div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:700,color:'var(--g400)',textTransform:'uppercase',letterSpacing:'.07em'}}>Giorni di allenamento</div>
                {fDays.length<7&&<button onClick={()=>setFDays(p=>{const used=new Set(p.map(d=>d.day));const next=DAYS.find(d=>!used.has(d));return next?[...p,eDay(next)]:p})} className="btn btn-ghost btn-sm">+ Giorno</button>}
              </div>
              {fDays.map((d,di)=>(
                <div key={di} style={{border:'1.5px solid var(--g100)',borderRadius:12,marginBottom:14,overflow:'hidden'}}>
                  <div style={{display:'grid',gridTemplateColumns:'130px 150px 1fr auto',gap:8,padding:'10px 12px',background:'var(--g50)',alignItems:'center'}}>
                    <select className="input" style={{padding:'6px 8px',fontSize:12}} value={d.day} onChange={e=>aD(di,{day:e.target.value})}>{DAYS.map(x=><option key={x} value={x}>{x}</option>)}</select>
                    <select className="input" style={{padding:'6px 8px',fontSize:12}} value={d.type} onChange={e=>aD(di,{type:e.target.value})}>{STYPES.map(t=><option key={t} value={t}>{t}</option>)}</select>
                    <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                      {BLOCKS.filter(bt=>!d.blocks.some(b=>b.blockType===bt.id)).map(bt=>(
                        <button key={bt.id} onClick={()=>aBl(di,bt.id as BT)} style={{padding:'3px 8px',border:`1px solid ${bt.color}`,borderRadius:6,background:bt.bg,color:bt.color,fontSize:10,fontWeight:600,cursor:'pointer'}}>{bt.icon} {bt.label}</button>
                      ))}
                    </div>
                    <button onClick={()=>setFDays(p=>p.filter((_,j)=>j!==di))} className="btn btn-danger btn-xs">✕</button>
                  </div>
                  {d.blocks.map((block,bi)=>{const b=bm(block.blockType);return(
                    <div key={bi} style={{borderTop:'1px solid var(--g100)'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:b.bg,flexWrap:'wrap'}}>
                        <span style={{fontSize:13}}>{b.icon}</span><span style={{fontSize:12,fontWeight:700,color:b.color,flex:1}}>{b.label}</span>
                        {block.blockType==='circuito'&&<div style={{display:'flex',gap:6,alignItems:'center'}}>
                          <span style={{fontSize:10,color:b.color}}>Round:</span><input className="input" type="number" min={1} max={20} value={block.circuitRounds??4} onChange={e=>uBl(di,bi,{circuitRounds:+e.target.value})} style={{width:50,padding:'3px 6px',fontSize:12}}/>
                          <span style={{fontSize:10,color:b.color}}>Rec:</span><input className="input" type="number" min={0} value={block.circuitRestSecs??30} onChange={e=>uBl(di,bi,{circuitRestSecs:+e.target.value})} style={{width:56,padding:'3px 6px',fontSize:12}}/>
                        </div>}
                        <button onClick={()=>rBl(di,bi)} style={{padding:'2px 8px',border:'none',borderRadius:5,background:'rgba(0,0,0,.07)',color:b.color,fontSize:10,fontWeight:600,cursor:'pointer'}}>Rimuovi</button>
                      </div>
                      <div style={{padding:'10px 12px',background:'#fff',overflowX:'auto'}}>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 50px 50px 65px 58px 1fr 28px',gap:6,marginBottom:6,minWidth:480}}>
                          {['Esercizio','Serie','Rip','Carico','Unità','Note',''].map((h,i)=><div key={i} style={{fontSize:9,fontWeight:700,color:'var(--g400)',textTransform:'uppercase',letterSpacing:'.04em'}}>{h}</div>)}
                        </div>
                        {block.exercises.map((ex,ei)=>(
                          <div key={ei} style={{marginBottom:9,paddingBottom:9,borderBottom:ei<block.exercises.length-1?'1px dashed var(--g100)':'none'}}>
                            <div style={{display:'grid',gridTemplateColumns:'1fr 50px 50px 65px 58px 1fr 28px',gap:6,alignItems:'center',marginBottom:6,minWidth:480}}>
                              <input className="input" style={{padding:'5px 8px',fontSize:12}} placeholder="Esercizio..." value={ex.name} onChange={e=>uEx(di,bi,ei,{name:e.target.value})}/>
                              <input className="input" type="number" min={1} max={20} value={ex.sets} onChange={e=>{const n=+e.target.value;uEx(di,bi,ei,{sets:n,setDetails:ex.setDetails?Array.from({length:n},(_,i)=>ex.setDetails![i]??{reps:ex.reps,weight:ex.weight??null}):null})}} style={{padding:'5px 6px',fontSize:12}}/>
                              <input className="input" type="number" min={1} value={ex.reps} onChange={e=>uEx(di,bi,ei,{reps:+e.target.value})} style={{padding:'5px 6px',fontSize:12}}/>
                              <input className="input" type="number" min={0} placeholder="0" value={ex.weight??''} onChange={e=>uEx(di,bi,ei,{weight:e.target.value?+e.target.value:null})} style={{padding:'5px 6px',fontSize:12}}/>
                              <select className="input" style={{padding:'5px 4px',fontSize:11}} value={ex.unit??'kg'} onChange={e=>uEx(di,bi,ei,{unit:e.target.value})}>{['kg','lb','min','seg','m','km'].map(u=><option key={u} value={u}>{u}</option>)}</select>
                              <input className="input" style={{padding:'5px 8px',fontSize:12}} placeholder="Note..." value={ex.notes??''} onChange={e=>uEx(di,bi,ei,{notes:e.target.value||null})}/>
                              <button onClick={()=>rEx(di,bi,ei)} className="btn btn-danger btn-xs" style={{padding:'4px 7px'}}>✕</button>
                            </div>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:ex.setDetails?6:0}}>
                              <button onClick={()=>tSets(di,bi,ei,ex)} style={{padding:'3px 10px',border:`1px solid ${ex.setDetails?'var(--navy)':'var(--g200)'}`,borderRadius:99,background:ex.setDetails?'rgba(10,22,40,.07)':'#fff',color:ex.setDetails?'var(--navy)':'var(--g400)',fontSize:10,fontWeight:600,cursor:'pointer'}}>
                                {ex.setDetails?'✓ Serie individualizzate':'+ Individualizza serie'}
                              </button>
                            </div>
                            {ex.setDetails&&(
                              <div style={{marginLeft:12,padding:'8px 10px',background:'var(--g50)',borderRadius:8,border:'1px solid var(--g100)'}}>
                                <div style={{display:'grid',gridTemplateColumns:'24px 70px 85px 24px',gap:6,marginBottom:5}}>
                                  {['#','Rip','Carico',''].map((h,i)=><div key={i} style={{fontSize:9,fontWeight:700,color:'var(--g400)',textTransform:'uppercase',letterSpacing:'.04em'}}>{h}</div>)}
                                </div>
                                {ex.setDetails.map((s,si)=>(
                                  <div key={si} style={{display:'grid',gridTemplateColumns:'24px 70px 85px 24px',gap:6,marginBottom:4,alignItems:'center'}}>
                                    <div style={{width:20,height:20,borderRadius:'50%',background:'var(--navy)',color:'var(--gold)',fontSize:9,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>{si+1}</div>
                                    <input className="input" type="number" min={1} value={s.reps} onChange={e=>uSet(di,bi,ei,si,{reps:+e.target.value})} style={{padding:'4px 6px',fontSize:12}}/>
                                    <div style={{display:'flex',gap:3,alignItems:'center'}}>
                                      <input className="input" type="number" min={0} placeholder="kg" value={s.weight??''} onChange={e=>uSet(di,bi,ei,si,{weight:e.target.value?+e.target.value:null})} style={{padding:'4px 6px',fontSize:12}}/>
                                      <span style={{fontSize:10,color:'var(--g400)',flexShrink:0}}>{ex.unit}</span>
                                    </div>
                                    <button onClick={()=>rSet(di,bi,ei,si,ex)} className="btn btn-danger btn-xs" style={{padding:'3px 6px',fontSize:10}}>✕</button>
                                  </div>
                                ))}
                                <button onClick={()=>aSet(di,bi,ei,ex)} style={{padding:'3px 10px',border:'1px dashed var(--g200)',borderRadius:6,background:'transparent',color:'var(--navy)',fontSize:10,fontWeight:600,cursor:'pointer',marginTop:2}}>+ Aggiungi serie</button>
                              </div>
                            )}
                          </div>
                        ))}
                        <button onClick={()=>aEx(di,bi)} style={{padding:'4px 11px',border:'1px dashed var(--g200)',borderRadius:7,background:'transparent',color:b.color,fontSize:11,fontWeight:600,cursor:'pointer'}}>+ Aggiungi esercizio</button>
                      </div>
                    </div>
                  )})}
                </div>
              ))}
              <div className="modal-actions">
                <button onClick={()=>setModal('none')} className="btn btn-ghost" style={{flex:1}}>Annulla</button>
                <button onClick={handleSave} disabled={saving||!fPid} className="btn btn-red" style={{flex:2,opacity:saving||!fPid?0.6:1}}>{saving?'Salvataggio...':'Salva scheda'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal==='del'&&(
        <div className="overlay" onClick={()=>setModal('none')}>
          <div className="modal" style={{maxWidth:360}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'30px 24px',textAlign:'center'}}>
              <div style={{width:50,height:50,borderRadius:'50%',background:'var(--red-l)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px',fontSize:20}}>🗑</div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:'.05em',color:'var(--navy)',marginBottom:8}}>ELIMINA SCHEDA</div>
              <p style={{fontSize:13,color:'var(--g400)',lineHeight:1.6,marginBottom:20}}>Eliminare la scheda di <strong style={{color:'var(--navy)'}}>{pName(active?.playerId??'')}</strong>?</p>
              <div style={{display:'flex',gap:10}}><button onClick={()=>setModal('none')} className="btn btn-ghost" style={{flex:1}}>Annulla</button><button onClick={handleDel} disabled={saving} className="btn btn-red" style={{flex:1,opacity:saving?0.6:1}}>{saving?'...':'Sì, elimina'}</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
