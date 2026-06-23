// src/modules/estadisticas/EstadisticasPage.tsx
import { useEffect, useState } from 'react'
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/shared/firebase/config'
import { useAuthStore } from '@/shared/store/authStore'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { matchStatsToPDF } from '@/shared/utils/export'
import { StatCard, Empty as EmptyState } from '@/shared/components/ui'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip,
} from 'recharts'
import type { Match, PlayerMatchStats, TeamMatchStats } from '@/shared/types'

const COMPETICIONES = ['Campionato Regionale','Coppa Regionale','Torneo di Apertura','Torneo di Chiusura','Amichevole','Altro']

const EMPTY_TEAM = (): TeamMatchStats => ({
  puntosAFavor:0,puntoEnContra:0,triesAFavor:0,triesEnContra:0,
  posesionPct:50,territorioPct:50,
  scrumGanados:0,scrumTotales:0,lineoutGanados:0,lineoutTotales:0,
  metrosTotales:0,pasesTotales:0,tacklesPct:0,penalesCometidos:0,amarillas:0,rojas:0,
})

const EMPTY_PLAYER = (id='',name='',pos=''): PlayerMatchStats => ({
  playerId:id,playerName:name,position:pos,minutosJugados:80,
  tries:0,asistencias:0,metrosGanados:0,pasesCompletados:0,pasesTotales:0,carreras:0,
  tacklesCompletados:0,tacklesTotales:0,tacklesFallados:0,turnoversGanados:0,
  lineoutsGanados:0,lineoutsTotales:0,amarillas:0,rojas:0,penalesCometidos:0,
  pateadasTotal:0,pateadasMetros:0,nota:null,
})

function sanitize(team: TeamMatchStats, players: PlayerMatchStats[]) {
  const ts: Record<string,any> = {}
  for (const [k,v] of Object.entries(team)) ts[k] = v ?? 0
  const ps = players.map(p => {
    const o: Record<string,any> = {}
    for (const [k,v] of Object.entries(p)) o[k] = v ?? (k==='nota'?null:0)
    return o
  })
  return { teamStats: ts, playerStats: ps }
}

function Label({children}: {children: React.ReactNode}) {
  return <label style={{fontSize:12,fontWeight:600,color:'var(--g500)',display:'block',marginBottom:5}}>{children}</label>
}

function Num({label,value,onChange}: {label:string;value:number;onChange:(v:number)=>void}) {
  return (
    <div>
      <div style={{fontSize:11,color:'var(--g400)',marginBottom:3}}>{label}</div>
      <input className="input" type="number" min={0} value={value||''} placeholder="0"
        onChange={e=>onChange(Number(e.target.value))} style={{padding:'6px 8px',textAlign:'center'}} />
    </div>
  )
}

function ResultBadge({favor,contra}: {favor:number;contra:number}) {
  const w=favor>contra,d=favor===contra
  return <span style={{background:w?'var(--g50)':d?'#FEF3DC':'var(--red-l)',color:w?'var(--red)':d?'#B45309':'var(--red)',fontSize:11,fontWeight:800,padding:'3px 9px',borderRadius:20,marginLeft:8}}>{w?'W':d?'D':'L'}</span>
}

function pct(a:number,b:number){return b?Math.round(a/b*100):0}

export default function EstadisticasPage() {
  const isMobile = useIsMobile()
  const user    = useAuthStore(s=>s.user)
  const canEdit = user?.role==='admin'||user?.role==='cuerpo_tecnico'

  const [matches,  setMatches]  = useState<Match[]>([])
  const [players,  setPlayers]  = useState<{id:string;name:string;position:string}[]>([])
  const [loading,  setLoading]  = useState(true)
  const [view,     setView]     = useState<'list'|'detail'|'form'>('list')
  const [active,   setActive]   = useState<Match|null>(null)
  const [dTab,     setDTab]     = useState<'equipo'|'jugadores'|'radar'>('equipo')
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState<{msg:string;ok:boolean}|null>(null)

  const [fRival,  setFRival]  = useState('')
  const [fFecha,  setFFecha]  = useState(new Date().toISOString().slice(0,10))
  const [fCancha, setFCancha] = useState<'local'|'visitante'|'neutral'>('local')
  const [fComp,   setFComp]   = useState(COMPETICIONES[0])
  const [fTeam,   setFTeam]   = useState<TeamMatchStats>(EMPTY_TEAM())
  const [fPlayers,setFPlayers]= useState<PlayerMatchStats[]>([])

  function toast2(msg:string,ok=true){setToast({msg,ok});setTimeout(()=>setToast(null),3000)}

  useEffect(()=>{
    if(!user)return
    async function load(){
      const [ms,ps]=await Promise.all([
        getDocs(query(collection(db,'matches'),where('clubId','==',user!.clubId))),
        getDocs(query(collection(db,'players'),where('clubId','==',user!.clubId))),
      ])
      setMatches(ms.docs.map(d=>({id:d.id,...d.data()}) as Match).sort((a,b)=>new Date(b.fecha).getTime()-new Date(a.fecha).getTime()))
      setPlayers(ps.docs.map(d=>({id:d.id,name:(d.data() as any).name,position:(d.data() as any).position??''})))
      setLoading(false)
    }
    load().catch(()=>setLoading(false))
  },[user])

  function openCreate(){
    setFRival('');setFFecha(new Date().toISOString().slice(0,10))
    setFCancha('local');setFComp(COMPETICIONES[0])
    setFTeam(EMPTY_TEAM())
    setFPlayers(players.map(p=>EMPTY_PLAYER(p.id,p.name,p.position)))
    setActive(null);setView('form')
  }

  function openEdit(m:Match){
    setFRival(m.rival);setFFecha(m.fecha)
    setFCancha(m.cancha);setFComp(m.competicion)
    setFTeam({...m.teamStats})
    setFPlayers(JSON.parse(JSON.stringify(m.playerStats)))
    setActive(m);setView('form')
  }

  function togglePlayer(p:{id:string;name:string;position:string}){
    const exists=fPlayers.some(fp=>fp.playerId===p.id)
    if(exists)setFPlayers(prev=>prev.filter(fp=>fp.playerId!==p.id))
    else setFPlayers(prev=>[...prev,EMPTY_PLAYER(p.id,p.name,p.position)])
  }

  function upPlayer(id:string,patch:Partial<PlayerMatchStats>){
    setFPlayers(prev=>prev.map(p=>p.playerId===id?{...p,...patch}:p))
  }

  async function handleSave(){
    if(!user||!fRival.trim())return toast2('Inserisci l\'avversario',false)
    setSaving(true)
    const {teamStats,playerStats}=sanitize(fTeam,fPlayers)
    const data={clubId:user.clubId,rival:fRival.trim(),fecha:fFecha,cancha:fCancha,competicion:fComp,teamStats,playerStats,createdBy:user.uid}
    try{
      if(active){
        await updateDoc(doc(db,'matches',active.id),data)
        const upd={...active,...data} as Match
        setMatches(prev=>prev.map(m=>m.id===active.id?upd:m))
        toast2('Partita aggiornata')
      } else {
        const ref=await addDoc(collection(db,'matches'),{...data,createdAt:serverTimestamp()})
        setMatches(prev=>[{id:ref.id,...data,createdAt:new Date()} as unknown as Match,...prev])
        toast2('Partita registrata correttamente')
      }
      setView('list')
    }catch(e){console.error(e);toast2('Errore nel salvataggio',false)}
    finally{setSaving(false)}
  }

  async function handleDelete(m:Match){
    if(!window.confirm(`¿Eliminar partido vs ${m.rival}?`))return
    try{
      await deleteDoc(doc(db,'matches',m.id))
      setMatches(prev=>prev.filter(x=>x.id!==m.id))
      if(active?.id===m.id)setView('list')
      toast2('Partita eliminata')
    }catch{toast2('Errore durante l\'eliminazione',false)}
  }

  const wins=matches.filter(m=>m.teamStats.puntosAFavor>m.teamStats.puntoEnContra).length
  const draws=matches.filter(m=>m.teamStats.puntosAFavor===m.teamStats.puntoEnContra).length
  const losses=matches.filter(m=>m.teamStats.puntosAFavor<m.teamStats.puntoEnContra).length
  const avgPF=matches.length?Math.round(matches.reduce((a,m)=>a+m.teamStats.puntosAFavor,0)/matches.length):0
  const avgPC=matches.length?Math.round(matches.reduce((a,m)=>a+m.teamStats.puntoEnContra,0)/matches.length):0

  const evoData=[...matches].reverse().map(m=>({fecha:m.fecha.slice(5),favor:m.teamStats.puntosAFavor,contra:m.teamStats.puntoEnContra}))

  const playerTotals: Record<string,{name:string;tries:number;tackles:number;metros:number}>={}
  matches.forEach(m=>m.playerStats.forEach(p=>{
    if(!playerTotals[p.playerId])playerTotals[p.playerId]={name:p.playerName,tries:0,tackles:0,metros:0}
    playerTotals[p.playerId].tries+=p.tries
    playerTotals[p.playerId].tackles+=p.tacklesCompletados
    playerTotals[p.playerId].metros+=p.metrosGanados
  }))
  const topScorers=Object.values(playerTotals).sort((a,b)=>b.tries-a.tries).slice(0,5)

  const radarData=active?[
    {stat:'Possesso',value:active.teamStats.posesionPct},
    {stat:'Territorio',value:active.teamStats.territorioPct},
    {stat:'Placcaggi',value:active.teamStats.tacklesPct},
    {stat:'Mischia',value:pct(active.teamStats.scrumGanados,active.teamStats.scrumTotales)},
    {stat:'Touche',value:pct(active.teamStats.lineoutGanados,active.teamStats.lineoutTotales)},
  ]:[]

  const s={card:{background:'#fff',border:'1px solid var(--g100)',borderRadius:12,overflow:'hidden'} as React.CSSProperties}

  return (
    <div className="fade-in" style={{padding: isMobile ? "14px 14px 0" : undefined}}>
      {toast&&<div style={{position:'fixed',top:20,right:24,zIndex:1000,background:toast.ok?'var(--navy)':'var(--red)',color:'#fff',padding:'12px 20px',borderRadius:10,fontSize:13,fontWeight:600}}>{toast.msg}</div>}

      {/* ══ LIST ══ */}
      {view==='list'&&<>
        <div className="stats-grid" style={{marginBottom:24}}>
          <StatCard label="Partite giocate" value={String(matches.length)} accentColor="var(--red)"/>
          <StatCard label="V / P / S" value={`${wins} / ${draws} / ${losses}`} accentColor="var(--red)" deltaType="up"/>
          <StatCard label="Media punti fatti" value={String(avgPF)} accentColor="#5B21B6"/>
          <StatCard label="Media punti subiti" value={String(avgPC)} accentColor="var(--red)" deltaType="warn"/>
        </div>

        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:700}}>Storico partite</div>
          {canEdit&&<button onClick={openCreate} style={{padding:'9px 18px',border:'none',borderRadius:9,background:'var(--red)',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>+ Registra partita</button>}
        </div>

        {loading?<div style={{textAlign:'center',padding:40,color:'var(--g300)'}}>Caricamento...</div>
        :matches.length===0?<EmptyState icon="📊" title="Nessuna partita registrata" desc={canEdit?'Clicca su "+ Registra partita"':'Non ci sono ancora partite caricate'}/>
        :<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 300px",gap:20}}>
          <div style={s.card}>
            <div style={{display:'grid',gridTemplateColumns:'90px 1fr 140px 80px 130px 120px',gap:12,padding:'10px 18px',background:'var(--g50)',borderBottom:'1px solid var(--g100)'}}>
              {['Data','Avversario','Competizione','Campo','Risultato',''].map((h,i)=><div key={i} style={{fontSize:11,fontWeight:700,color:'var(--g400)',textTransform:'uppercase',letterSpacing:'0.04em'}}>{h}</div>)}
            </div>
            {matches.map((m,i)=>(
              <div key={m.id} style={{display:'grid',gridTemplateColumns:'90px 1fr 140px 80px 130px 120px',gap:12,padding:'12px 18px',borderBottom:i<matches.length-1?'1px solid var(--g50)':'none',alignItems:'center',transition:'background 0.1s'}}
                onMouseEnter={e=>(e.currentTarget.style.background='var(--g50)')} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                <div style={{fontSize:12,color:'var(--g400)'}}>{new Date(m.fecha).toLocaleDateString('es-AR',{day:'2-digit',month:'short'})}</div>
                <div>
                  <div style={{fontSize:13,fontWeight:700}}>vs {m.rival}</div>
                  <div style={{fontSize:11,color:'var(--g300)',marginTop:1}}>{m.playerStats.length} jugadores</div>
                </div>
                <div style={{fontSize:12,color:'var(--g500)'}}>{m.competicion}</div>
                <div><span style={{background:m.cancha==='local'?'var(--g50)':'#EBF4FF',color:m.cancha==='local'?'var(--red)':'#1D5FAD',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600}}>{m.cancha==='local'?'Casa':m.cancha==='visitante'?'Visit.':'Neutr.'}</span></div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:16,fontWeight:800}}>{m.teamStats.puntosAFavor}</span>
                  <span style={{fontSize:12,color:'var(--g300)'}}>—</span>
                  <span style={{fontSize:16,fontWeight:800}}>{m.teamStats.puntoEnContra}</span>
                  <ResultBadge favor={m.teamStats.puntosAFavor} contra={m.teamStats.puntoEnContra}/>
                </div>
                <div style={{display:'flex',gap:5}}>
                  <button onClick={()=>{setActive(m);setDTab('equipo');setView('detail')}} style={{padding:'5px 10px',border:'1px solid var(--g100)',borderRadius:7,background:'#fff',color:'var(--g500)',fontSize:11,fontWeight:600,cursor:'pointer'}}>Vedi</button>
                  {canEdit&&<>
                    <button onClick={()=>openEdit(m)} style={{padding:'5px 10px',border:'1px solid var(--g200)',borderRadius:7,background:'var(--g50)',color:'var(--red)',fontSize:11,fontWeight:600,cursor:'pointer'}}>Modifica</button>
                    <button onClick={()=>handleDelete(m)} style={{padding:'5px 9px',border:'1px solid #FEECEC',borderRadius:7,background:'var(--red-l)',color:'var(--red)',fontSize:11,fontWeight:700,cursor:'pointer'}}>✕</button>
                  </>}
                </div>
              </div>
            ))}
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {evoData.length>1&&<div>
              <div style={{fontSize:13,fontWeight:700,color:'var(--navy)',marginBottom:10}}>Andamento punti</div>
              <div style={{background:'#fff',border:'1px solid var(--g100)',borderRadius:12,padding:'14px 16px'}}>
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={evoData}>
                    <XAxis dataKey="fecha" tick={{fontSize:10,fill:'var(--g400)'}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:'var(--g400)'}} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{background:'#fff',border:'1px solid var(--g100)',borderRadius:8,fontSize:12}}/>
                    <Line type="monotone" dataKey="favor"  name="Fatti"  stroke="var(--red)" strokeWidth={2} dot={{r:3,fill:'var(--red)'}}/>
                    <Line type="monotone" dataKey="contra" name="Subiti" stroke="#B91C1C" strokeWidth={2} dot={{r:3,fill:'var(--red)'}}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>}
            {topScorers.length>0&&<div>
              <div style={{fontSize:13,fontWeight:700,color:'var(--navy)',marginBottom:10}}>Top tries — acumulado</div>
              <div style={s.card}>
                {topScorers.map((p,i)=>(
                  <div key={p.name} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',borderBottom:i<topScorers.length-1?'1px solid var(--g50)':'none'}}>
                    <div style={{width:22,height:22,borderRadius:'50%',background:i===0?'#E8A020':'var(--g50)',color:i===0?'#fff':'var(--red)',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>{i+1}</div>
                    <div style={{flex:1,fontSize:13,fontWeight:600}}>{p.name}</div>
                    <span style={{background:'var(--g50)',color:'var(--red)',fontSize:12,fontWeight:700,padding:'2px 10px',borderRadius:20}}>{p.tries} tries</span>
                  </div>
                ))}
              </div>
            </div>}
          </div>
        </div>}
      </>}

      {/* ══ DETAIL ══ */}
      {view==='detail'&&active&&<>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
          <button onClick={()=>setView('list')} style={{border:'none',background:'transparent',color:'var(--red)',fontSize:13,fontWeight:600,cursor:'pointer',padding:0}}>← Volver</button>
          <div style={{flex:1}}>
            <h2 style={{margin:0,fontSize:18,fontWeight:800}}>vs {active.rival}<ResultBadge favor={active.teamStats.puntosAFavor} contra={active.teamStats.puntoEnContra}/></h2>
            <div style={{fontSize:12,color:'var(--g400)',marginTop:2}}>{new Date(active.fecha).toLocaleDateString('es-AR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})} · {active.competicion} · {active.cancha==='local'?'Casa':active.cancha==='visitante'?'Trasferta':'Campo neutro'}</div>
          </div>
          {canEdit&&<button onClick={()=>openEdit(active)} style={{padding:'8px 16px',border:'1px solid var(--g100)',borderRadius:9,background:'#fff',color:'var(--red)',fontSize:13,fontWeight:600,cursor:'pointer'}}>Modifica</button>}
        </div>

        {/* Score hero */}
        <div style={{background:'var(--navy)',borderRadius:16,padding:'24px 32px',marginBottom:24,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{textAlign:'center',flex:1}}>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>La nostra squadra</div>
            <div style={{fontSize:56,fontWeight:900,color:'#fff',lineHeight:1}}>{active.teamStats.puntosAFavor}</div>
            <div style={{fontSize:12,color:'rgba(255,255,255,0.5)',marginTop:4}}>{active.teamStats.triesAFavor} tries</div>
          </div>
          <div style={{fontSize:28,color:'rgba(255,255,255,0.25)',fontWeight:800,padding:'0 24px'}}>—</div>
          <div style={{textAlign:'center',flex:1}}>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>{active.rival}</div>
            <div style={{fontSize:56,fontWeight:900,color:'rgba(255,255,255,0.45)',lineHeight:1}}>{active.teamStats.puntoEnContra}</div>
            <div style={{fontSize:12,color:'rgba(255,255,255,0.35)',marginTop:4}}>{active.teamStats.triesEnContra} tries</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="module-tabs" style={{display:'flex',gap:0,marginBottom:20,background:'#fff',border:'1px solid var(--g100)',borderRadius:10,padding:4,width:'fit-content'}}>
          {(['equipo','jugadores','radar'] as const).map(t=>(
            <button key={t} onClick={()=>setDTab(t)} style={{padding:'7px 20px',border:'none',borderRadius:7,fontSize:13,fontWeight:600,cursor:'pointer',background:dTab===t?'var(--navy)':'transparent',color:dTab===t?'#fff':'var(--g400)',transition:'all 0.15s'}}>
              {t==='equipo'?'📋 Equipo':t==='jugadores'?'👤 Jugadores':'🎯 Radar'}
            </button>
          ))}
        </div>

        {dTab==='equipo'&&<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
          {[
            {title:'⚔️ Resultado',items:[['Punti fatti',active.teamStats.puntosAFavor,''],['Punti subiti',active.teamStats.puntoEnContra,''],['Mete fatte',active.teamStats.triesAFavor,''],['Mete subite',active.teamStats.triesEnContra,'']]},
            {title:'⚡ Posesión y ataque',items:[['Possesso',active.teamStats.posesionPct,'%'],['Territorio',active.teamStats.territorioPct,'%'],['Metri totali',active.teamStats.metrosTotales,'m'],['Passaggi totali',active.teamStats.pasesTotales,'']]},
            {title:'📐 Set piece',items:[['Mischie vinte',`${active.teamStats.scrumGanados}/${active.teamStats.scrumTotales}`,''],['Touche vinte',`${active.teamStats.lineoutGanados}/${active.teamStats.lineoutTotales}`,''],['Efficacia placcaggi',active.teamStats.tacklesPct,'%'],['Falli commessi',active.teamStats.penalesCometidos,'']]},
          ].map(sec=>(
            <div key={sec.title} style={s.card}>
              <div style={{padding:'12px 16px',borderBottom:'1px solid var(--g100)',fontSize:13,fontWeight:700}}>{sec.title}</div>
              {sec.items.map(([l,v,u])=>(
                <div key={String(l)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'11px 16px',borderBottom:'1px solid var(--g50)'}}>
                  <span style={{fontSize:13,color:'var(--g500)'}}>{l}</span>
                  <span style={{fontSize:16,fontWeight:800}}>{v}{u}</span>
                </div>
              ))}
            </div>
          ))}
        </div>}

        {dTab==='jugadores'&&<div style={s.card}><div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{background:'var(--g50)'}}>
                {['Giocatore','Min','Mete','Assist.','Metri','Passaggi','Placcaggi','Fall.','Turnov.','Giall.','Voto'].map(h=>(
                  <th key={h} style={{padding:'9px 12px',textAlign:'left',fontSize:10,fontWeight:700,color:'var(--g400)',textTransform:'uppercase',letterSpacing:'0.04em',borderBottom:'1px solid var(--g100)',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {active.playerStats.map((p,i)=>(
                <tr key={p.playerId} style={{borderBottom:i<active.playerStats.length-1?'1px solid var(--g50)':'none'}}>
                  <td style={{padding:'10px 12px',fontWeight:600,color:'var(--navy)',whiteSpace:'nowrap'}}><div>{p.playerName}</div><div style={{fontSize:11,color:'var(--g300)',fontWeight:400}}>{p.position}</div></td>
                  <td style={{padding:'10px 12px',color:'var(--g500)'}}>{p.minutosJugados}'</td>
                  <td style={{padding:'10px 12px'}}>{p.tries>0?<span style={{background:'var(--g50)',color:'var(--red)',fontWeight:700,padding:'2px 8px',borderRadius:20}}>{p.tries}</span>:<span style={{color:'#C5D5C9'}}>—</span>}</td>
                  <td style={{padding:'10px 12px',color:'var(--g500)'}}>{p.asistencias||'—'}</td>
                  <td style={{padding:'10px 12px',color:'var(--g500)'}}>{p.metrosGanados||'—'}</td>
                  <td style={{padding:'10px 12px',color:'var(--g500)'}}>{p.pasesCompletados}/{p.pasesTotales}</td>
                  <td style={{padding:'10px 12px',color:'var(--g500)'}}>{p.tacklesCompletados}/{p.tacklesTotales}</td>
                  <td style={{padding:'10px 12px',color:p.tacklesFallados>2?'var(--red)':'var(--g500)'}}>{p.tacklesFallados||'—'}</td>
                  <td style={{padding:'10px 12px',color:'var(--g500)'}}>{p.turnoversGanados||'—'}</td>
                  <td style={{padding:'10px 12px'}}>{p.amarillas>0?<span style={{background:'#FEF3DC',color:'#B45309',fontWeight:700,padding:'2px 8px',borderRadius:20}}>🟨{p.amarillas}</span>:<span style={{color:'#C5D5C9'}}>—</span>}</td>
                  <td style={{padding:'10px 12px',color:'var(--g400)',fontStyle:'italic',fontSize:11}}>{p.nota||'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>}

        {dTab==='radar'&&<div className="grid-auto">
          <div style={{...s.card,padding:'16px 18px'}}>
            <div style={{fontSize:13,fontWeight:700,color:'var(--navy)',marginBottom:16}}>Radar della partita</div>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--g100)"/>
                <PolarAngleAxis dataKey="stat" tick={{fontSize:12,fill:'var(--g500)'}}/>
                <Radar dataKey="value" stroke="var(--red)" fill="var(--red)" fillOpacity={0.25}/>
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div style={{...s.card,padding:'16px 18px'}}>
            <div style={{fontSize:13,fontWeight:700,color:'var(--navy)',marginBottom:16}}>Top performer</div>
            {[
              {label:'Più mete',player:[...active.playerStats].sort((a,b)=>b.tries-a.tries)[0],stat:(p: PlayerMatchStats)=>`${p.tries} tries`},
              {label:'Più placcaggi',player:[...active.playerStats].sort((a,b)=>b.tacklesCompletados-a.tacklesCompletados)[0],stat:(p: PlayerMatchStats)=>`${p.tacklesCompletados} tackles`},
              {label:'Più metri',player:[...active.playerStats].sort((a,b)=>b.metrosGanados-a.metrosGanados)[0],stat:(p: PlayerMatchStats)=>`${p.metrosGanados}m`},
            ].filter(x=>x.player).map(({label,player,stat})=>(
              <div key={label} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0',borderBottom:'1px solid var(--g50)'}}>
                <div><div style={{fontSize:11,color:'var(--g300)',marginBottom:2}}>{label}</div><div style={{fontSize:13,fontWeight:700}}>{player!.playerName}</div></div>
                <span style={{background:'var(--g50)',color:'var(--red)',fontSize:13,fontWeight:700,padding:'4px 14px',borderRadius:20}}>{stat(player!)}</span>
              </div>
            ))}
          </div>
        </div>}
      </>}

      {/* ══ FORM ══ */}
      {view==='form'&&<>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
          <div>
            <h2 style={{margin:0,fontSize:18,fontWeight:800}}>{active?'Modifica partita':'Registra partita'}</h2>
            <p style={{margin:'3px 0 0',fontSize:12,color:'var(--g400)'}}>Carica le statistiche della squadra e di ogni giocatore</p>
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>setView('list')} style={{padding:'9px 16px',border:'1px solid var(--g100)',borderRadius:9,background:'#fff',color:'var(--g500)',fontSize:13,fontWeight:600,cursor:'pointer'}}>Annulla</button>
            <button onClick={handleSave} disabled={saving} style={{padding:'9px 20px',border:'none',borderRadius:9,background:saving?'#C5D5C9':'var(--red)',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>{saving?'Salvataggio...':'Salva partita'}</button>
          </div>
        </div>

        {/* Info básica */}
        <div style={{...s.card,padding:'20px 22px',marginBottom:16,overflow:'visible'}}>
          <div style={{fontSize:13,fontWeight:700,color:'var(--navy)',marginBottom:14}}>📋 Informazioni sulla partita</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 160px 160px 220px',gap:14}}>
            <div><Label>Avversario *</Label><input className="input" placeholder="Es: Rugby Parma" value={fRival} onChange={e=>setFRival(e.target.value)}/></div>
            <div><Label>Data</Label><input className="input" type="date" value={fFecha} onChange={e=>setFFecha(e.target.value)}/></div>
            <div><Label>Campo</Label><select className="input" value={fCancha} onChange={e=>setFCancha(e.target.value as any)}><option value="local">Casa</option><option value="visitante">Trasferta</option><option value="neutral">Campo neutro</option></select></div>
            <div><Label>Competizione</Label><select className="input" value={fComp} onChange={e=>setFComp(e.target.value)}>{COMPETICIONES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          </div>
        </div>

        {/* Team stats */}
        <div style={{...s.card,padding:'20px 22px',marginBottom:16,overflow:'visible'}}>
          <div style={{fontSize:13,fontWeight:700,color:'var(--navy)',marginBottom:14}}>📊 Statistiche della squadra</div>
          <div className="stats-grid" style={{marginBottom:14}}>
            <Num label="Punti fatti"  value={fTeam.puntosAFavor}  onChange={v=>setFTeam(t=>({...t,puntosAFavor:v}))}/>
            <Num label="Punti subiti" value={fTeam.puntoEnContra} onChange={v=>setFTeam(t=>({...t,puntoEnContra:v}))}/>
            <Num label="Mete fatte"   value={fTeam.triesAFavor}   onChange={v=>setFTeam(t=>({...t,triesAFavor:v}))}/>
            <Num label="Mete subite" value={fTeam.triesEnContra} onChange={v=>setFTeam(t=>({...t,triesEnContra:v}))}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:14,marginBottom:14}}>
            <Num label="Possesso (%)"     value={fTeam.posesionPct}    onChange={v=>setFTeam(t=>({...t,posesionPct:v}))}/>
            <Num label="Territorio (%)"   value={fTeam.territorioPct}  onChange={v=>setFTeam(t=>({...t,territorioPct:v}))}/>
            <Num label="Metri totali"   value={fTeam.metrosTotales}  onChange={v=>setFTeam(t=>({...t,metrosTotales:v}))}/>
            <Num label="Passaggi totali"    value={fTeam.pasesTotales}   onChange={v=>setFTeam(t=>({...t,pasesTotales:v}))}/>
            <Num label="Placcaggi (%)"      value={fTeam.tacklesPct}     onChange={v=>setFTeam(t=>({...t,tacklesPct:v}))}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:14}}>
            <Num label="Mischie vinte"   value={fTeam.scrumGanados}    onChange={v=>setFTeam(t=>({...t,scrumGanados:v}))}/>
            <Num label="Mischie tot."   value={fTeam.scrumTotales}    onChange={v=>setFTeam(t=>({...t,scrumTotales:v}))}/>
            <Num label="Touche vinte" value={fTeam.lineoutGanados}  onChange={v=>setFTeam(t=>({...t,lineoutGanados:v}))}/>
            <Num label="Touche tot." value={fTeam.lineoutTotales}  onChange={v=>setFTeam(t=>({...t,lineoutTotales:v}))}/>
            <Num label="Gialli"     value={fTeam.amarillas}       onChange={v=>setFTeam(t=>({...t,amarillas:v}))}/>
            <Num label="Rossi"         value={fTeam.rojas}           onChange={v=>setFTeam(t=>({...t,rojas:v}))}/>
          </div>
        </div>

        {/* Player stats */}
        <div style={{...s.card,padding:'20px 22px',overflow:'visible'}}>
          <div style={{fontSize:13,fontWeight:700,color:'var(--navy)',marginBottom:12}}>👤 Stats per giocatore ({fPlayers.length} selezionati)</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:16,padding:'12px 14px',background:'var(--g50)',borderRadius:9}}>
            {players.map(p=>{
              const sel=fPlayers.some(fp=>fp.playerId===p.id)
              return <button key={p.id} onClick={()=>togglePlayer(p)} style={{padding:'5px 12px',borderRadius:20,border:`1.5px solid ${sel?'var(--red)':'var(--g100)'}`,background:sel?'var(--g50)':'#fff',color:sel?'var(--red)':'var(--g400)',fontSize:12,fontWeight:sel?700:400,cursor:'pointer'}}>{sel?'✓ ':''}{p.name}</button>
            })}
          </div>
          {fPlayers.map(p=>(
            <div key={p.playerId} style={{border:'1px solid var(--g100)',borderRadius:10,marginBottom:12,overflow:'hidden'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'var(--g50)',borderBottom:'1px solid var(--g100)'}}>
                <div style={{width:30,height:30,borderRadius:'50%',background:'var(--g50)',color:'var(--red)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700}}>{p.playerName.split(' ').map((w: string)=>w[0]).slice(0,2).join('')}</div>
                <div><div style={{fontSize:13,fontWeight:700}}>{p.playerName}</div><div style={{fontSize:11,color:'var(--g400)'}}>{p.position}</div></div>
                <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:11,color:'var(--g400)'}}>Minuti:</span>
                  <input className="input" type="number" min={0} max={100} value={p.minutosJugados} onChange={e=>upPlayer(p.playerId,{minutosJugados:Number(e.target.value)})} style={{width:70,padding:'5px 8px'}}/>
                </div>
              </div>
              <div style={{padding:'12px 14px'}}>
                <div className="stats-grid" style={{marginBottom:10}}>
                  <Num label="Mete"       value={p.tries}       onChange={v=>upPlayer(p.playerId,{tries:v})}/>
                  <Num label="Assist" value={p.asistencias} onChange={v=>upPlayer(p.playerId,{asistencias:v})}/>
                  <Num label="Metri"      value={p.metrosGanados} onChange={v=>upPlayer(p.playerId,{metrosGanados:v})}/>
                  <Num label="Corse"    value={p.carreras}    onChange={v=>upPlayer(p.playerId,{carreras:v})}/>
                </div>
                <div className="stats-grid" style={{marginBottom:10}}>
                  <Num label="Passaggi comp." value={p.pasesCompletados} onChange={v=>upPlayer(p.playerId,{pasesCompletados:v})}/>
                  <Num label="Passaggi tot." value={p.pasesTotales}     onChange={v=>upPlayer(p.playerId,{pasesTotales:v})}/>
                  <Num label="Placcaggi comp." value={p.tacklesCompletados} onChange={v=>upPlayer(p.playerId,{tacklesCompletados:v})}/>
                  <Num label="Placcaggi tot." value={p.tacklesTotales}     onChange={v=>upPlayer(p.playerId,{tacklesTotales:v})}/>
                </div>
                <div className="stats-grid" style={{marginBottom:10}}>
                  <Num label="Placc. falliti" value={p.tacklesFallados}  onChange={v=>upPlayer(p.playerId,{tacklesFallados:v})}/>
                  <Num label="Turnover vinti" value={p.turnoversGanados} onChange={v=>upPlayer(p.playerId,{turnoversGanados:v})}/>
                  <Num label="Gialli"      value={p.amarillas}        onChange={v=>upPlayer(p.playerId,{amarillas:v})}/>
                  <Num label="Rossi"          value={p.rojas}            onChange={v=>upPlayer(p.playerId,{rojas:v})}/>
                </div>
                <div><div style={{fontSize:11,color:'var(--g400)',marginBottom:4}}>Voto partita</div><input className="input" placeholder="Osservazioni sulla partita del giocatore..." value={p.nota??''} onChange={e=>upPlayer(p.playerId,{nota:e.target.value||null})}/></div>
              </div>
            </div>
          ))}
        </div>
      </>}
    </div>
  )
}
