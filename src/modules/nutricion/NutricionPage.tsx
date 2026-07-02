// src/modules/nutricion/NutricionPage.tsx — BRC v3 + AI Scanner + Export
import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/shared/firebase/config'
import { useAuthStore } from '@/shared/store/authStore'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { nutritionToExcel, exportPDF } from '@/shared/utils/export'
import PhotoScanner, { type ScanResult } from '@/shared/components/PhotoScanner'
import { Empty, Toast } from '@/shared/components/ui'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { NutritionPlan, Meal, MealItem } from '@/shared/types'

const MEAL_TYPES = ['Colazione','Pranzo','Pre-allenamento','Merenda','Cena'] as const
type MealType = typeof MEAL_TYPES[number]
const MEAL_ICONS:Record<string,string> = {
  // Italian
  Colazione:'☀️', Pranzo:'🍽', 'Pre-allenamento':'⚡', Merenda:'🍎', Cena:'🌙',
  // Legacy Spanish (backwards compat for existing Firestore data)
  Desayuno:'☀️', Almuerzo:'🍽', 'Pre-entreno':'⚡', Merienda:'🍎',
}

function ProgressBar({ label, current, total, unit='g', fill='var(--red)' }: { label:string;current:number;total:number;unit?:string;fill?:string }) {
  const pct = total > 0 ? Math.min(Math.round((current/total)*100), 100) : 0
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontSize:13, fontWeight:600, color:'var(--navy)' }}>{label}</span>
        <span style={{ fontSize:11, color:'var(--g400)' }}>{current}{unit} / {total}{unit} <span style={{ fontWeight:700, color:pct>=100?'var(--red)':'var(--gold-d)' }}>({pct}%)</span></span>
      </div>
      <div style={{ height:7, background:'var(--g100)', borderRadius:99, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:fill, borderRadius:99, transition:'width .6s ease' }}/>
      </div>
    </div>
  )
}

const emptyItem = (): MealItem => ({ name:'', quantity:'', calories:0, protein:0, carbs:0, fat:0 })
const emptyMeal = (type:MealType): Meal => ({ type, items:[emptyItem()] })

const WEIGHT_HISTORY = [
  {week:'S8',peso:86.5},{week:'S9',peso:87.0},{week:'S10',peso:87.3},{week:'S11',peso:87.8},{week:'S12',peso:88.0},
]

export default function NutricionPage() {
  const isMobile = useIsMobile()
  const user    = useAuthStore(s=>s.user)
  const canEdit = user?.role==='admin' || user?.role==='cuerpo_tecnico'

  const [plans, setPlans]     = useState<NutritionPlan[]>([])
  const [players, setPlayers] = useState<{id:string;name:string}[]>([])
  const [loading, setL]       = useState(true)
  const [active, setActive]   = useState<NutritionPlan|null>(null)
  const [expanded, setExpanded] = useState<string|null>('Colazione')
  const [modal, setModal]     = useState<'none'|'form'|'del'>('none')
  const [scanner, setScanner] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [toast, setToast]     = useState<{msg:string;ok:boolean}|null>(null)

  // form
  const [fPid, setFPid]     = useState('')
  const [fCal, setFCal]     = useState('2800')
  const [fProt, setFProt]   = useState('200')
  const [fCarb, setFCarb]   = useState('350')
  const [fFat, setFFat]     = useState('70')
  const [fMeals, setFMeals] = useState<Meal[]>(MEAL_TYPES.map(emptyMeal))

  function showToast(msg:string,ok=true){setToast({msg,ok});setTimeout(()=>setToast(null),3000)}

  useEffect(()=>{
    if(!user) return
    Promise.all([
      getDocs(query(collection(db,'nutrition_plans'),where('clubId','==',user.clubId))),
      getDocs(query(collection(db,'players'),where('clubId','==',user.clubId))),
    ]).then(([ps,ys])=>{
      const p2=ps.docs.map(d=>({id:d.id,...d.data()}) as NutritionPlan)
      setPlans(p2); setPlayers(ys.docs.map(d=>({id:d.id,name:(d.data() as any).name})))
      if(user.role==='jugador'){const m=p2.find(p=>p.playerId===user.uid);if(m)setActive(m)}
    }).catch(console.error).finally(()=>setL(false))
  },[user])

  function openCreate(){setFPid(players[0]?.id??'');setFCal('2800');setFProt('200');setFCarb('350');setFFat('70');setFMeals(MEAL_TYPES.map(emptyMeal));setActive(null);setModal('form')}
  function openEdit(p:NutritionPlan){setFPid(p.playerId);setFCal(String(p.targetCalories));setFProt(String(p.targetProtein));setFCarb(String(p.targetCarbs));setFFat(String(p.targetFat));setFMeals(JSON.parse(JSON.stringify(p.meals)));setActive(p);setModal('form')}

  // ── When scanner returns data ─────────────────────────────
  function onScanResult(result: ScanResult) {
    setScanner(false)
    // If form is open, add items to Colazione by default
    if (modal === 'form') {
      const newItems = result.items.map(i => ({ name:i.name, quantity:i.quantity, calories:i.calories, protein:i.protein, carbs:i.carbs, fat:i.fat }))
      setFMeals(prev => {
        const updated = [...prev]
        const lunchIdx = updated.findIndex(m => m.type === 'Colazione')
        if (lunchIdx >= 0) {
          updated[lunchIdx] = { ...updated[lunchIdx], items: [...updated[lunchIdx].items.filter((i:any)=>i.name), ...newItems] }
        } else {
          updated.push({ type:'Colazione', items:newItems })
        }
        return updated
      })
      showToast(`✓ ${result.items.length} alimenti aggiunti al piano`)
    } else {
      // Open form with scanned data pre-filled
      setFPid(players[0]?.id??'')
      const totalCal  = result.items.reduce((a,i)=>a+(i.calories||0),0)
      const totalProt = result.items.reduce((a,i)=>a+(i.protein||0),0)
      const totalCarb = result.items.reduce((a,i)=>a+(i.carbs||0),0)
      const totalFat  = result.items.reduce((a,i)=>a+(i.fat||0),0)
      setFCal(String(Math.max(totalCal, 2000)))
      setFProt(String(Math.max(totalProt, 150)))
      setFCarb(String(Math.max(totalCarb, 200)))
      setFFat(String(Math.max(totalFat, 50)))
      const items = result.items.map(i => ({ name:i.name, quantity:i.quantity, calories:i.calories, protein:i.protein, carbs:i.carbs, fat:i.fat }))
      setFMeals([{ type:'Colazione', items }, ...MEAL_TYPES.filter(t=>t!=='Colazione').map(emptyMeal)])
      setActive(null)
      setModal('form')
    }
  }

  function addItem(mi:number){setFMeals(p=>p.map((m,i)=>i===mi?{...m,items:[...m.items,emptyItem()]}:m))}
  function rmItem(mi:number,ii:number){setFMeals(p=>p.map((m,i)=>i===mi?{...m,items:m.items.filter((_,j)=>j!==ii)}:m))}
  function updItem(mi:number,ii:number,patch:Partial<MealItem>){setFMeals(p=>p.map((m,i)=>i===mi?{...m,items:m.items.map((it,j)=>j===ii?{...it,...patch}:it)}:m))}

  function sanitize(meals:Meal[]){return meals.map(m=>({type:m.type,items:m.items.map(it=>({name:it.name??'',quantity:it.quantity??'',calories:it.calories??0,protein:it.protein??0,carbs:it.carbs??0,fat:it.fat??0}))}))}

  async function handleSave(){
    if(!user||!fPid)return;setSaving(true)
    const data={playerId:fPid,clubId:user.clubId,meals:sanitize(fMeals),targetCalories:+fCal,targetProtein:+fProt,targetCarbs:+fCarb,targetFat:+fFat,createdBy:user.uid}
    try{
      if(active){await updateDoc(doc(db,'nutrition_plans',active.id),data);const upd={...active,...data};setPlans(p=>p.map(x=>x.id===active.id?upd:x));setActive(upd);showToast('Piano aggiornato')}
      else{const ref=await addDoc(collection(db,'nutrition_plans'),{...data,createdAt:serverTimestamp()});const np={id:ref.id,...data} as unknown as NutritionPlan;setPlans(p=>[...p,np]);setActive(np);showToast('Piano creato')}
      setModal('none')
    }catch{showToast('Errore nel salvataggio',false)}finally{setSaving(false)}
  }

  async function handleDel(){
    if(!active)return;setSaving(true)
    try{await deleteDoc(doc(db,'nutrition_plans',active.id));setPlans(p=>p.filter(x=>x.id!==active.id));setActive(null);setModal('none');showToast('Piano eliminato')}
    catch{showToast('Errore',false)}finally{setSaving(false)}
  }

  // ── Export ────────────────────────────────────────────────
  function handleExcelDownload(){
    if(!active)return
    const pName=players.find(p=>p.id===active.playerId)?.name??'Jugador'
    nutritionToExcel(active,pName)
  }

  async function handlePDFDownload(){
    if(!active)return
    const pName=players.find(p=>p.id===active.playerId)?.name??'Jugador'
    const totals=active.meals.reduce((acc,m)=>{m.items.forEach(it=>{acc.cal+=it.calories||0;acc.prot+=it.protein||0;acc.carb+=it.carbs||0;acc.fat+=it.fat||0});return acc},{cal:0,prot:0,carb:0,fat:0})
    await exportPDF({
      title:`Piano Nutrizionale — ${pName}`,
      subtitle:`Obiettivo: ${active.targetCalories}kcal · P:${active.targetProtein}g · C:${active.targetCarbs}g · G:${active.targetFat}g`,
      filename:`nutricion_${pName.replace(/ /g,'_')}`,
      tables: active.meals.map(meal=>({
        title:`${MEAL_ICONS[meal.type]||''} ${meal.type}`,
        head:[['Alimento','Quantità','Calorie','Proteine (g)','Carboidrati (g)','Grassi (g)']],
        body:meal.items.map(it=>[it.name,it.quantity,it.calories,it.protein,it.carbs,it.fat]),
      })).concat([{
        title:'Riepilogo del piano',
        head:[['Metrica','Obiettivo','Attuale','%']],
        body:[
          ['Calorie',`${active.targetCalories} kcal`,`${totals.cal} kcal`,`${active.targetCalories>0?Math.round(totals.cal/active.targetCalories*100):0}%`],
          ['Proteine',`${active.targetProtein} g`,`${totals.prot} g`,`${active.targetProtein>0?Math.round(totals.prot/active.targetProtein*100):0}%`],
          ['Carboidrati',`${active.targetCarbs} g`,`${totals.carb} g`,`${active.targetCarbs>0?Math.round(totals.carb/active.targetCarbs*100):0}%`],
          ['Grassi',`${active.targetFat} g`,`${totals.fat} g`,`${active.targetFat>0?Math.round(totals.fat/active.targetFat*100):0}%`],
        ],
      }]),
    })
  }

  const pName=(id:string)=>players.find(p=>p.id===id)?.name??'—'
  const totals=active?.meals.reduce((acc,m)=>{m.items.forEach(it=>{acc.cal+=it.calories||0;acc.prot+=it.protein||0;acc.carb+=it.carbs||0;acc.fat+=it.fat||0});return acc},{cal:0,prot:0,carb:0,fat:0})||{cal:0,prot:0,carb:0,fat:0}

  return (
    <div className="fade-in" style={{padding: isMobile ? "16px 16px 0" : undefined}}>
      {toast && <Toast msg={toast.msg} type={toast.ok?'ok':'err'}/>}
      {scanner && <PhotoScanner mode="food" onClose={()=>setScanner(false)} onResult={onScanResult}/>}

      {/* Stats */}
      <div className="stats-grid" style={{ display:'grid', gridTemplateColumns:'var(--cols-4)', gap:12, marginBottom:22 }}>
        {[
          {l:'Calorie tot.',   v:active?`${totals.cal}`:'—',       a:'var(--red)',    i:'🔥'},
          {l:'Proteine',     v:active?`${totals.prot}g`:'—',      a:'var(--navy)',   i:'💪'},
          {l:'Carboidrati',v:active?`${totals.carb}g`:'—',      a:'var(--gold-d)', i:'🌾'},
          {l:'Piani caricati',v:String(plans.length),         a:'#5B21B6',       i:'📋'},
        ].map(s=>(
          <div key={s.l} className="stat">
            <div className="stat-accent" style={{background:s.a}}/>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
              <div className="stat-lbl">{s.l}</div>
              <span style={{fontSize:18,opacity:.25}}>{s.i}</span>
            </div>
            <div className="stat-val">{loading?'—':s.v}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      {canEdit && (
        <div style={{ display:'flex', gap:8, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
          {plans.length > 0 && (
            <select className="input" style={{ maxWidth:320 }} value={active?.id??''} onChange={e=>{const p=plans.find(x=>x.id===e.target.value)??null;setActive(p)}}>
              <option value="">— Seleziona piano —</option>
              {plans.map(p=><option key={p.id} value={p.id}>{pName(p.playerId)}</option>)}
            </select>
          )}
          <button onClick={openCreate} className="btn btn-red">+ Nuovo piano</button>
          {/* AI Scanner button — prominent */}
          <button onClick={()=>setScanner(true)} style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 16px', borderRadius:8, border:'1.5px solid var(--gold-d)', background:'var(--gold-l)', color:'var(--gold-d)', fontSize:13, fontWeight:700, cursor:'pointer', transition:'all .14s' }}
            onMouseEnter={e=>(e.currentTarget.style.background='var(--gold)')}
            onMouseLeave={e=>(e.currentTarget.style.background='var(--gold-l)')}>
            <span style={{fontSize:15}}>📷</span> Scansiona con IA
          </button>
          {active && (
            <>
              <button onClick={()=>openEdit(active)} className="btn btn-ghost btn-sm">Modifica</button>
              <button onClick={()=>setModal('del')} className="btn btn-danger btn-sm">Elimina</button>
              <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
                <button onClick={handleExcelDownload} className="btn btn-ghost btn-sm" style={{ display:'flex', alignItems:'center', gap:6 }}>📊 Excel</button>
                <button onClick={handlePDFDownload} className="btn btn-primary btn-sm" style={{ display:'flex', alignItems:'center', gap:6 }}>📄 PDF</button>
              </div>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div style={{textAlign:'center',padding:40,color:'var(--g300)'}}>Caricamento...</div>
      ) : !active ? (
        <div className="card">
          <Empty icon="🥗" title="Nessun piano nutrizionale"
            desc={canEdit ? 'Crea un nuovo piano oppure usa "Scansiona con IA" per estrarre i dati da una foto' : 'Il nutrizionista non ha ancora assegnato il tuo piano'}
            action={canEdit ? <div style={{display:'flex',gap:8}}><button onClick={openCreate} className="btn btn-red btn-sm">+ Nuovo piano</button><button onClick={()=>setScanner(true)} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:7,border:'1.5px solid var(--gold-d)',background:'var(--gold-l)',color:'var(--gold-d)',fontSize:12,fontWeight:700,cursor:'pointer'}}>📷 Scansiona</button></div> : undefined}
          />
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"minmax(240px,280px) 1fr",gap:16}}>
          {/* Left: macros panel */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* Macros */}
            <div className="card">
              <div className="card-hdr"><span className="card-title">MACRO GIORNALIERI</span></div>
              <div style={{ padding:'14px 16px' }}>
                <ProgressBar label="Calorie" current={totals.cal}  total={active.targetCalories} unit=" kcal" fill="var(--red)"/>
                <ProgressBar label="Proteine" current={totals.prot} total={active.targetProtein}  fill="var(--navy)"/>
                <ProgressBar label="Carboidrati" current={totals.carb} total={active.targetCarbs}    fill="var(--gold-d)"/>
                <ProgressBar label="Grassi"   current={totals.fat}  total={active.targetFat}      fill="#5B21B6"/>
              </div>
            </div>

            {/* Weight chart */}
            <div className="card">
              <div className="card-hdr"><span className="card-title">PESO CORPOREO</span></div>
              <div style={{ padding:'12px 14px' }}>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={WEIGHT_HISTORY} margin={{top:5,right:10,bottom:0,left:-20}}>
                    <XAxis dataKey="week" tick={{fontSize:10,fill:'var(--g400)'}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:'var(--g400)'}} axisLine={false} tickLine={false} unit="kg" domain={['dataMin - 1','dataMax + 1']}/>
                    <Tooltip contentStyle={{background:'#fff',border:'1px solid var(--g100)',borderRadius:8,fontSize:11}} formatter={(v:number)=>[`${v} kg`,'Peso']}/>
                    <Area type="monotone" dataKey="peso" stroke="var(--navy)" fill="rgba(10,22,40,.06)" strokeWidth={2.5}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Jugador */}
            <div style={{ padding:'12px 16px', background:'var(--g50)', borderRadius:12, border:'1px solid var(--g100)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--g400)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>Giocatore</div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--navy)' }}>{pName(active.playerId)}</div>
            </div>
          </div>

          {/* Right: meals */}
          <div>
            {active.meals.map((meal,mi)=>{
              const mealTotals=meal.items.reduce((a,it)=>({cal:a.cal+(it.calories||0),prot:a.prot+(it.protein||0),carb:a.carb+(it.carbs||0),fat:a.fat+(it.fat||0)}),{cal:0,prot:0,carb:0,fat:0})
              const isOpen=expanded===meal.type
              return (
                <div key={meal.type} className="card" style={{ marginBottom:10 }}>
                  <div onClick={()=>setExpanded(isOpen?null:meal.type)} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', cursor:'pointer', userSelect:'none' }}>
                    <span style={{ fontSize:18 }}>{MEAL_ICONS[meal.type]||'🍽'}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--navy)' }}>{meal.type}</div>
                      <div style={{ fontSize:11, color:'var(--g400)', marginTop:1 }}>{meal.items.length} elementi · {mealTotals.cal} kcal · P:{mealTotals.prot}g · C:{mealTotals.carb}g · G:{mealTotals.fat}g</div>
                    </div>
                    <span style={{ fontSize:12, color:'var(--g400)', transition:'transform .2s', transform:isOpen?'rotate(180deg)':'none' }}>▼</span>
                  </div>
                  {isOpen && (
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:480 }}>
                        <thead><tr style={{ background:'var(--g50)' }}>
                          {['Alimento','Quantità','Kcal','Prot','Carb','Grassi'].map(h=><th key={h} style={{ padding:'7px 14px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--g400)', textTransform:'uppercase', letterSpacing:'.05em', borderBottom:'1px solid var(--g100)', whiteSpace:'nowrap' }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {meal.items.map((it,i)=>(
                            <tr key={i} style={{ borderBottom:'1px solid var(--g50)' }}>
                              <td style={{ padding:'9px 14px', fontWeight:600, color:'var(--navy)' }}>{it.name||'—'}</td>
                              <td style={{ padding:'9px 14px', color:'var(--g500)' }}>{it.quantity||'—'}</td>
                              <td style={{ padding:'9px 14px' }}><span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:15, color:'var(--red)' }}>{it.calories}</span></td>
                              <td style={{ padding:'9px 14px', color:'var(--navy)' }}>{it.protein}g</td>
                              <td style={{ padding:'9px 14px', color:'var(--gold-d)' }}>{it.carbs}g</td>
                              <td style={{ padding:'9px 14px', color:'#5B21B6' }}>{it.fat}g</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── FORM MODAL ── */}
      {modal==='form' && (
        <div className="overlay" onClick={()=>setModal('none')}>
          <div className="modal" style={{ maxWidth:760, maxHeight:'92dvh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
            <div className="modal-hdr">
              <div>
                <div className="modal-title">{active?'MODIFICA PIANO':'NUOVO PIANO NUTRIZIONALE'}</div>
                <div style={{ fontSize:12, color:'var(--g400)', marginTop:2 }}>Definisci i macro obiettivo e gli alimenti di ogni pasto</div>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                {/* Scanner button inside modal too */}
                <button onClick={()=>setScanner(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 12px', border:'1.5px solid var(--gold-d)', borderRadius:8, background:'var(--gold-l)', color:'var(--gold-d)', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                  📷 Escanear
                </button>
                <button className="modal-x" onClick={()=>setModal('none')}>×</button>
              </div>
            </div>
            <div className="modal-body">
              {/* Player */}
              <div style={{ marginBottom:16 }}>
                <div className="fl">Giocatore *</div>
                <select className="input" value={fPid} onChange={e=>setFPid(e.target.value)}>
                  <option value="">— Seleziona —</option>
                  {players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {/* Macros */}
              <div style={{ borderBottom:'1px solid var(--g100)', paddingBottom:16, marginBottom:16 }}>
                <div className="fl">Obiettivi giornalieri</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
                  {[{l:'Calorie (kcal)',v:fCal,set:setFCal},{l:'Proteine (g)',v:fProt,set:setFProt},{l:'Carboidrati (g)',v:fCarb,set:setFCarb},{l:'Grassi (g)',v:fFat,set:setFFat}].map(f=>(
                    <div key={f.l}>
                      <div style={{ fontSize:10, color:'var(--g400)', marginBottom:4 }}>{f.l}</div>
                      <input className="input" type="number" value={f.v} onChange={e=>f.set(e.target.value)}/>
                    </div>
                  ))}
                </div>
              </div>

              {/* Meals */}
              <div className="fl">Pasti della giornata</div>
              {fMeals.map((meal,mi)=>(
                <div key={meal.type} style={{ border:'1.5px solid var(--g100)', borderRadius:12, marginBottom:12, overflow:'hidden' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--g50)', borderBottom:'1px solid var(--g100)' }}>
                    <span style={{ fontSize:16 }}>{MEAL_ICONS[meal.type]||'🍽'}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:'var(--navy)', flex:1 }}>{meal.type}</span>
                    <span style={{ fontSize:11, color:'var(--g400)' }}>
                      {meal.items.reduce((a,i)=>a+(i.calories||0),0)} kcal
                    </span>
                  </div>
                  <div style={{ padding:'10px 12px', background:'#fff', overflowX:'auto' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 64px 52px 52px 52px 26px', gap:5, marginBottom:6, minWidth:520 }}>
                      {['Alimento','Quantità','Kcal','Prot','Carb','Grassi',''].map((h,i)=>(
                        <div key={i} style={{ fontSize:9, fontWeight:700, color:'var(--g400)', textTransform:'uppercase', letterSpacing:'.04em' }}>{h}</div>
                      ))}
                    </div>
                    {meal.items.map((it,ii)=>(
                      <div key={ii} style={{ display:'grid', gridTemplateColumns:'1fr 80px 64px 52px 52px 52px 26px', gap:5, marginBottom:5, alignItems:'center', minWidth:520 }}>
                        <input className="input" style={{ padding:'5px 8px', fontSize:12 }} placeholder="Alimento..." value={it.name} onChange={e=>updItem(mi,ii,{name:e.target.value})}/>
                        <input className="input" style={{ padding:'5px 7px', fontSize:12 }} placeholder="100g" value={it.quantity} onChange={e=>updItem(mi,ii,{quantity:e.target.value})}/>
                        <input className="input" type="number" style={{ padding:'5px 6px', fontSize:12 }} value={it.calories||''} onChange={e=>updItem(mi,ii,{calories:+e.target.value})} placeholder="0"/>
                        <input className="input" type="number" style={{ padding:'5px 5px', fontSize:12 }} value={it.protein||''} onChange={e=>updItem(mi,ii,{protein:+e.target.value})} placeholder="0"/>
                        <input className="input" type="number" style={{ padding:'5px 5px', fontSize:12 }} value={it.carbs||''} onChange={e=>updItem(mi,ii,{carbs:+e.target.value})} placeholder="0"/>
                        <input className="input" type="number" style={{ padding:'5px 5px', fontSize:12 }} value={it.fat||''} onChange={e=>updItem(mi,ii,{fat:+e.target.value})} placeholder="0"/>
                        <button onClick={()=>rmItem(mi,ii)} className="btn btn-danger btn-xs" style={{ padding:'4px 6px' }}>✕</button>
                      </div>
                    ))}
                    <button onClick={()=>addItem(mi)} style={{ padding:'4px 11px', border:'1px dashed var(--g200)', borderRadius:7, background:'transparent', color:'var(--navy)', fontSize:11, fontWeight:600, cursor:'pointer', marginTop:4 }}>
                      + Aggiungi alimento
                    </button>
                  </div>
                </div>
              ))}

              <div style={{ display:'flex', gap:8, paddingTop:14, borderTop:'1px solid var(--g100)', marginTop:8 }}>
                <button onClick={()=>setModal('none')} className="btn btn-ghost" style={{ flex:1 }}>Annulla</button>
                <button onClick={handleSave} disabled={saving||!fPid} className="btn btn-red" style={{ flex:2, opacity:saving||!fPid?0.6:1 }}>
                  {saving ? 'Salvataggio...' : active ? 'Salva modifiche' : 'Crea piano nutrizionale'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal==='del' && (
        <div className="overlay" onClick={()=>setModal('none')}>
          <div className="modal" style={{ maxWidth:360 }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:'30px 24px', textAlign:'center' }}>
              <div style={{ width:50, height:50, borderRadius:'50%', background:'var(--red-l)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', fontSize:20 }}>🗑</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:'var(--navy)', marginBottom:8 }}>ELIMINA PIANO</div>
              <p style={{ fontSize:13, color:'var(--g400)', lineHeight:1.6, marginBottom:20 }}>Eliminare il piano di <strong style={{ color:'var(--navy)' }}>{pName(active?.playerId??'')}</strong>?</p>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>setModal('none')} className="btn btn-ghost" style={{ flex:1 }}>Annulla</button>
                <button onClick={handleDel} disabled={saving} className="btn btn-red" style={{ flex:1, opacity:saving?0.6:1 }}>{saving?'...':'Sì, elimina'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
