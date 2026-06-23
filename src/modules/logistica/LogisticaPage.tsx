// src/modules/logistica/LogisticaPage.tsx
// Fantasy & Puntos BRC — integrado nativamente en RugbyLab
import { useEffect, useState, useMemo, useRef } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, collection, doc, addDoc, setDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuthStore } from '@/shared/store/authStore'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { logisticaStatsToPDF } from '@/shared/utils/export'

// ── Firebase Logística (proyecto separado para familias BRC) ──
const LAPP_ID = 'brc-logistica-famiglie'
let lApp = getApps().find(a => a.name === LAPP_ID)
if (!lApp) lApp = initializeApp({
  apiKey: "AIzaSyB_9OlPqcZ78v9NDJAlr9FxNvYcmgjbyJE",
  authDomain: "brc-logistica-famiglie.firebaseapp.com",
  projectId: "brc-logistica-famiglie",
  storageBucket: "brc-logistica-famiglie.firebasestorage.app",
  messagingSenderId: "1097198392202",
  appId: "1:1097198392202:web:90ebc7279ab8fd1c7aae73",
}, LAPP_ID)
const ldb = getFirestore(lApp)
const lauth = getAuth(lApp)

const ALLOWED = ["admin@gmail.com","aless.pagnini@gmail.com","admin@brc.com","andreafava03@gmail.com","salvicristiano@libero.it","admin.brc@gmail.com","bottesilvio@hotmail.com","nicco.rega@gmail.com","joseichico94@gmail.com"]

const TEAMS = [
  {id:"ISOLANI",  name:"Isolani",  color:"#1D5FAD",bg:"#EBF4FF"},
  {id:"ALBERGATI",name:"Albergati",color:"#1B6B3A",bg:"#E8F5EE"},
  {id:"CASALI",   name:"Casali",   color:"#B45309",bg:"#FEF3DC"},
  {id:"MAGNANI",  name:"Magnani",  color:"#B91C1C",bg:"#FEECEC"},
]

const BRC_PHOTOS: Record<string,string> = {
  "JOSE_CHICO_CISTOLA":"https://www.bolognarugbyclub.it/wp-content/uploads/2025/10/ChicoJose2.png",
  "CRISTIANO_SALVI":"https://www.bolognarugbyclub.it/wp-content/uploads/2025/09/SalviCristiano.png",
  "FABIO_PRIOLA":"https://www.bolognarugbyclub.it/wp-content/uploads/2025/10/PriolaFabio2.png",
  "LUCA_PANCALDI":"https://www.bolognarugbyclub.it/wp-content/uploads/2025/10/PancaldiLuca2.png",
  "BERNARDO_LIVOTTO":"https://www.bolognarugbyclub.it/wp-content/uploads/2026/03/LivottoBernardo26.png",
  "EDO_RESTA":"https://www.bolognarugbyclub.it/wp-content/uploads/2026/01/RestaEdo.png",
  "TOMMASO_BOSCHETTI":"https://www.bolognarugbyclub.it/wp-content/uploads/2025/10/BoschettiTommaso.png",
  "SIMONE_DE_ANGELIS":"https://www.bolognarugbyclub.it/wp-content/uploads/2025/09/DeAngelisSimone.png",
  "MATTIA_BARATTA":"https://www.bolognarugbyclub.it/wp-content/uploads/2025/09/BarattaMattia.png",
  "RICCARDO_TERUGGI":"https://www.bolognarugbyclub.it/wp-content/uploads/2025/09/TeruggiRiccardo.png",
  "NICOLAS_BONINI":"https://www.bolognarugbyclub.it/wp-content/uploads/2025/09/BoniniNicolas.png",
  "MATTEO_CESARI":"https://www.bolognarugbyclub.it/wp-content/uploads/2026/03/CesariMatteo26.png",
  "ALBERTO_BIONDI":"https://www.bolognarugbyclub.it/wp-content/uploads/2026/03/BiondiAlberto26.png",
  "MASSIMO_SIGNORE":"https://www.bolognarugbyclub.it/wp-content/uploads/2025/10/SignoreMassimo2.png",
  "FEDERICO_SILVESTRI":"https://www.bolognarugbyclub.it/wp-content/uploads/2025/09/SilvestriFederico.png",
  "DENIS_AMICO":"https://www.bolognarugbyclub.it/wp-content/uploads/2025/09/AmicoDenis.png",
  "ALESSANDRO_PAGNINI":"https://www.bolognarugbyclub.it/wp-content/uploads/2025/09/PagniniAlessandro.png",
  "PIETRO_FATTORI":"https://www.bolognarugbyclub.it/wp-content/uploads/2025/09/FattoriPietro.png",
}

const FP_POS = [
  {key:"pilone_sx",  label:"Pilone sin.", short:"1"},
  {key:"tallonatore",label:"Tallonatore",    short:"2"},
  {key:"pilone_dx",  label:"Pilone des.", short:"3"},
  {key:"seconda_a",  label:"2a Linea",  short:"4"},
  {key:"seconda_b",  label:"2a Linea",  short:"5"},
  {key:"flanker_sx", label:"Flanker",   short:"6"},
  {key:"numero8",    label:"Numero 8",    short:"8"},
  {key:"flanker_dx", label:"Flanker",   short:"7"},
  {key:"apertura",   label:"Apertura",  short:"10"},
  {key:"mischia",    label:"Mediano",        short:"9"},
  {key:"centro_sx",  label:"Centro",    short:"12"},
  {key:"centro_dx",  label:"Centro",    short:"13"},
  {key:"ala_sx",     label:"Ala sin.",   short:"11"},
  {key:"estremo",    label:"Estremo",  short:"15"},
  {key:"ala_dx",     label:"Ala des.",   short:"14"},
]

const PC: Record<string,string[]> = {
  pilone_sx:["pilone_sx","pilone_dx"],tallonatore:["tallonatore"],pilone_dx:["pilone_dx","pilone_sx"],
  seconda_a:["seconda_a","seconda_b"],seconda_b:["seconda_b","seconda_a"],
  flanker_sx:["flanker_sx","flanker_dx","numero8"],numero8:["numero8","flanker_sx","flanker_dx"],flanker_dx:["flanker_dx","flanker_sx","numero8"],
  apertura:["apertura"],mischia:["mischia"],
  centro_sx:["centro_sx","centro_dx"],centro_dx:["centro_dx","centro_sx"],
  ala_sx:["ala_sx","ala_dx"],estremo:["estremo"],ala_dx:["ala_dx","ala_sx"],
}

const PITCH_SLOTS = [
  {key:"ala_sx",    x:13,y:84},{key:"estremo",    x:50,y:89},{key:"ala_dx",    x:87,y:84},
  {key:"centro_sx", x:33,y:73},{key:"centro_dx",  x:67,y:73},
  {key:"apertura",  x:36,y:62},{key:"mischia",    x:64,y:62},
  {key:"flanker_sx",x:23,y:50},{key:"numero8",    x:50,y:52},{key:"flanker_dx",x:77,y:50},
  {key:"seconda_a", x:37,y:38},{key:"seconda_b",  x:63,y:38},
  {key:"pilone_sx", x:27,y:26},{key:"tallonatore",x:50,y:24},{key:"pilone_dx", x:73,y:26},
]

const FANTASY_BUDGET=2000; const MAX_SIZE=15

function slug(s:string){return(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"_").replace(/^_|_$/g,"").toUpperCase()}
function getPhoto(p:any){return p?.photoUrl||BRC_PHOTOS[slug(p?.name||"")]||null}

function PAv({player,size=38}:{player:any;size?:number}){
  const photo=getPhoto(player)
  const team=TEAMS.find(t=>t.id===player?.teamId)
  const [err,setErr]=useState(false)
  return(
    <div style={{width:size,height:size,borderRadius:size*.24,overflow:"hidden",background:team?.bg||"var(--g50)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.4,flexShrink:0}}>
      {photo&&!err?<img src={photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} onError={()=>setErr(true)}/>:"🏉"}
    </div>
  )
}

// ── PITCH SVG ─────────────────────────────────────────────────
function RugbyPitchSvg({players,onRemove}:{players:any[];onRemove:(id:string)=>void}){
  const [hov,setHov]=useState<string|null>(null)
  const slotMap=useMemo(()=>{
    const map:Record<string,any>={};const used=new Set<string>()
    for(const slot of PITCH_SLOTS){const e=players.find(p=>p.fantasyPosition===slot.key&&!used.has(p.id));if(e){map[slot.key]=e;used.add(e.id)}}
    for(const slot of PITCH_SLOTS){if(map[slot.key])continue;const c=players.find(p=>!used.has(p.id)&&(PC[p.fantasyPosition]||[]).includes(slot.key));if(c){map[slot.key]=c;used.add(c.id)}}
    return map
  },[players])
  const R=5.8
  return(
    <div style={{position:"relative",width:"100%",paddingBottom:"88%",background:"linear-gradient(180deg,#145a2e 0%,#1a7038 50%,#196b38 100%)"}}>
      <svg viewBox="0 0 100 100" style={{position:"absolute",inset:0,width:"100%",height:"100%"}} xmlns="http://www.w3.org/2000/svg">
        {[0,1,2,3,4,5,6,7,8,9].map(i=><rect key={i} x="0" y={i*10} width="100" height="5" fill={i%2===0?"#166534":"#15803d"} opacity="0.4"/>)}
        <line x1="2" y1="8"  x2="98" y2="8"  stroke="#fff" strokeWidth="0.6" opacity="0.9"/>
        <line x1="2" y1="92" x2="98" y2="92" stroke="#fff" strokeWidth="0.6" opacity="0.9"/>
        <line x1="2" y1="50" x2="98" y2="50" stroke="#fff" strokeWidth="0.5" opacity="0.7"/>
        <line x1="43" y1="2" x2="43" y2="8"  stroke="#F5C518" strokeWidth="0.7"/>
        <line x1="57" y1="2" x2="57" y2="8"  stroke="#F5C518" strokeWidth="0.7"/>
        <line x1="43" y1="5" x2="57" y2="5"  stroke="#F5C518" strokeWidth="0.5"/>
        <line x1="43" y1="92" x2="43" y2="98" stroke="#F5C518" strokeWidth="0.7"/>
        <line x1="57" y1="92" x2="57" y2="98" stroke="#F5C518" strokeWidth="0.7"/>
        <line x1="43" y1="95" x2="57" y2="95" stroke="#F5C518" strokeWidth="0.5"/>
        {PITCH_SLOTS.map(slot=>{
          const p=slotMap[slot.key];const pos=FP_POS.find(fp=>fp.key===slot.key);const isH=hov===slot.key;const photo=p?getPhoto(p):null;const cid=`c-${slot.key}`
          if(!p)return(<g key={slot.key}><circle cx={slot.x} cy={slot.y} r={R} fill="rgba(0,0,0,.2)" stroke="rgba(255,255,255,.2)" strokeWidth="0.5" strokeDasharray="2,2"/><text x={slot.x} y={slot.y+0.9} textAnchor="middle" dominantBaseline="middle" fontSize="3" fill="rgba(255,255,255,.4)">{pos?.short}</text></g>)
          return(
            <g key={slot.key} style={{cursor:"pointer"}} onMouseEnter={()=>setHov(slot.key)} onMouseLeave={()=>setHov(null)} onClick={()=>onRemove(p.id)}>
              <defs><clipPath id={cid}><circle cx={slot.x} cy={slot.y} r={R-0.3}/></clipPath></defs>
              <circle cx={slot.x+0.2} cy={slot.y+0.4} r={R} fill="rgba(0,0,0,.3)"/>
              <circle cx={slot.x} cy={slot.y} r={R} fill={isH?"#7c3aed":"var(--navy)"} stroke={isH?"#a78bfa":"var(--gold)"} strokeWidth={isH?0.9:0.6}/>
              {photo?<image href={photo} x={slot.x-(R-0.3)} y={slot.y-(R-0.3)} width={(R-0.3)*2} height={(R-0.3)*2} clipPath={`url(#${cid})`} preserveAspectRatio="xMidYMin slice"/>
                    :<text x={slot.x} y={slot.y+1.2} textAnchor="middle" dominantBaseline="middle" fontSize="4">🏉</text>}
              <circle cx={slot.x+R-1.5} cy={slot.y+R-1.5} r="2" fill="var(--navy)" stroke="var(--gold)" strokeWidth="0.3"/>
              <text x={slot.x+R-1.5} y={slot.y+R-0.8} textAnchor="middle" dominantBaseline="middle" fontSize="1.8" fill="var(--gold)" fontWeight="bold">{pos?.short}</text>
              <rect x={slot.x-8} y={slot.y+R+0.5} width="16" height="3.2" rx="1.3" fill="rgba(0,0,0,.8)"/>
              <text x={slot.x} y={slot.y+R+2.3} textAnchor="middle" fontSize="1.9" fill="#e2e8f0" fontWeight="600">{(()=>{const pts=(p.name||"").split(" ");return pts.length>1?`${pts[0][0]}. ${pts.slice(1).join(" ")}`.substring(0,11):(p.name||"").substring(0,11)})()}</text>
              {isH&&<><circle cx={slot.x} cy={slot.y} r={R} fill="rgba(124,58,237,.55)"/><text x={slot.x} y={slot.y+1.5} textAnchor="middle" dominantBaseline="middle" fontSize="5.5" fill="#fff" fontWeight="900">×</text></>}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────
export default function LogisticaPage(){
  const isMobile = useIsMobile()
  const mainUser=useAuthStore(s=>s.user)
  const [lUser,setLUser]=useState<any>(null)
  const [players,setPlayers]=useState<any[]>([])
  const [tx,setTx]=useState<any[]>([])
  const [events,setEvents]=useState<any[]>([])
  const [loading,setL]=useState(true)
  const [tab,setTab]=useState<"dashboard"|"historial"|"fantasy"|"admin">("dashboard")
  const [toast,setToast]=useState<string|null>(null)
  const [addOpen,setAddOpen]=useState(false)
  const [profileId,setProfileId]=useState<string|null>(null)
  const [loginOpen,setLoginOpen]=useState(false)
  const [pdfL,setPdfL]=useState(false)

  const isAllowed=lUser?.email&&ALLOWED.includes(lUser.email)
  const canEdit=isAllowed||mainUser?.role==="admin"||mainUser?.role==="cuerpo_tecnico"

  function showToast(msg:string){setToast(msg);setTimeout(()=>setToast(null),2800)}

  useEffect(()=>onAuthStateChanged(lauth,u=>setLUser(u||null)),[])
  useEffect(()=>{
    setL(true)
    const u1=onSnapshot(query(collection(ldb,"players"),orderBy("name")),s=>setPlayers(s.docs.map(d=>({id:d.id,...d.data()}))))
    const u2=onSnapshot(query(collection(ldb,"tx"),orderBy("ts","desc")),s=>setTx(s.docs.map(d=>({id:d.id,...d.data()}))))
    const u3=onSnapshot(query(collection(ldb,"events_config"),orderBy("name")),s=>{setEvents(s.docs.map(d=>({id:d.id,...d.data()})));setL(false)},()=>setL(false))
    return()=>{u1();u2();u3()}
  },[])

  const standings=useMemo(()=>{
    const m=Object.fromEntries(TEAMS.map(t=>[t.id,0]))
    for(const t of tx)if(m[t.teamId]!==undefined)m[t.teamId]+=Number(t.delta)||0
    return[...TEAMS].map(t=>({...t,points:m[t.id]||0})).sort((a,b)=>b.points-a.points)
  },[tx])

  const playerPoints=useMemo(()=>{
    const map=new Map<string,{points:number;count:number}>()
    for(const m of tx){if(!m.playerId)continue;const c=map.get(m.playerId)||{points:0,count:0};c.points+=Number(m.delta)||0;c.count+=1;map.set(m.playerId,c)}
    return players.map(p=>({...p,points:map.get(p.id)?.points||0,count:map.get(p.id)?.count||0})).sort((a,b)=>b.points-a.points)
  },[players,tx])

  async function handlePDF(){setPdfL(true);try{await logisticaStatsToPDF(TEAMS,players,tx)}catch{showToast("Error al generar PDF")}finally{setPdfL(false)}}

  const TABS=[
    {id:"dashboard" as const,icon:"📊",label:"Dashboard"},
    {id:"historial" as const,icon:"📋",label:"Storico"},
    {id:"fantasy"   as const,icon:"⭐",label:"Fantasy"},
    ...(canEdit?[{id:"admin" as const,icon:"⚙️",label:"Admin"}]:[]),
  ]

  return(
    <div className="fade-in" style={{padding: isMobile ? "14px 14px 0" : undefined}}>
      {toast&&<div className="toast ok">{toast}</div>}
      {loginOpen&&<LoginModal onClose={()=>setLoginOpen(false)} showToast={showToast}/>}
      {profileId&&<ProfileModal playerId={profileId} players={players} tx={tx} events={events} onClose={()=>setProfileId(null)}/>}
      {addOpen&&<AddModal players={players} events={events} lUser={lUser} isAllowed={isAllowed} onClose={()=>setAddOpen(false)} showToast={showToast}/>}

      {/* HERO */}
      <div className="hero" style={{marginBottom:20}}>
        <div style={{position:"relative",zIndex:1,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(24px,4vw,36px)",letterSpacing:".05em",color:"#fff",lineHeight:.95,marginBottom:6}}>FANTASY & PUNTOS</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,.45)",marginBottom:14}}>Bologna Rugby Club · Sistema punti e Fantasy Rugby</div>
            <div className="hero-standings" style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {standings.map((t,i)=>(
                <div key={t.id} style={{padding:"7px 12px",background:"rgba(255,255,255,.07)",borderRadius:10,border:"1px solid rgba(255,255,255,.08)",minWidth:80}}>
                  <div style={{fontSize:9,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:2}}>{["1°","2°","3°","4°"][i]}</div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:t.color,lineHeight:1}}>{t.name}</div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:"#fff",lineHeight:1}}>{t.points.toFixed(0)}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end",flexShrink:0,minWidth:0}}>
            {!lUser
              ?<button onClick={()=>setLoginOpen(true)} style={{padding:"8px 16px",border:"none",borderRadius:9,background:"var(--gold)",color:"var(--navy)",fontSize:13,fontWeight:700,cursor:"pointer"}}>🔐 Entrar Fantasy</button>
              :<div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>{lUser.email.split("@")[0]}</span><button onClick={()=>signOut(lauth)} style={{padding:"5px 10px",border:"1px solid rgba(255,255,255,.2)",borderRadius:7,background:"transparent",color:"rgba(255,255,255,.5)",fontSize:11,cursor:"pointer"}}>Esci</button></div>
            }
            <button onClick={handlePDF} disabled={pdfL} className="btn btn-sm" style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",color:"#fff",display:"flex",alignItems:"center",gap:6}}>{pdfL?"⏳":"📄"} PDF</button>
            {canEdit&&<button onClick={()=>setAddOpen(true)} style={{padding:"9px 16px",border:"none",borderRadius:9,background:"var(--red)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:"var(--sh-red)"}}>＋ Agregar puntos</button>}
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="logistica-tabs" style={{display:"flex",gap:0,marginBottom:20,background:"rgba(14,23,36,.8)",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,padding:3}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"9px 6px",border:"none",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .14s",background:tab===t.id?"var(--navy)":"transparent",color:tab===t.id?"#fff":"var(--g400)"}}>
            <span style={{marginRight:4}}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {loading?(
        <div style={{textAlign:"center",padding:40,color:"var(--g300)"}}>
          <div style={{fontSize:32,marginBottom:12}}>🏉</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:".06em"}}>Caricamento dati...</div>
        </div>
      ):(
        <>
          {tab==="dashboard"&&<DashTab standings={standings} playerPoints={playerPoints} tx={tx} events={events} onProfile={setProfileId} isMobile={isMobile}/>}
          {tab==="historial"&&<HistTab tx={tx} players={players} events={events} isAllowed={isAllowed} showToast={showToast}/>}
          {tab==="fantasy"&&<FantasyTab players={players} tx={tx} lUser={lUser} showToast={showToast} isAllowed={isAllowed}/>}
          {tab==="admin"&&canEdit&&<AdminTab events={events} showToast={showToast}/>}
        </>
      )}
    </div>
  )
}

// ── DASHBOARD ─────────────────────────────────────────────────
function DashTab({standings,playerPoints,tx,events,onProfile,isMobile}:any){
  const chartData=useMemo(()=>{
    const sorted=[...tx].sort((a:any,b:any)=>(a.ts?.toMillis?.()||0)-(b.ts?.toMillis?.()||0))
    const totals=Object.fromEntries(TEAMS.map(t=>[t.id,0]))
    const byDate:Record<string,any>={}
    for(const item of sorted){
      const d=item.ts?.toDate?.().toLocaleDateString("es-AR")||"?"
      if(!byDate[d])byDate[d]={date:d,...Object.fromEntries(TEAMS.map(t=>[t.id,(totals as any)[t.id]]))}
      if((totals as any)[item.teamId]!==undefined){(totals as any)[item.teamId]+=Number(item.delta)||0;byDate[d][item.teamId]=(totals as any)[item.teamId]}
    }
    return Object.values(byDate).slice(-12)
  },[tx])

  const evStats=useMemo(()=>{
    const map=new Map<string,{name:string;count:number;points:number}>()
    for(const m of tx){const ev=events.find((e:any)=>e.id===m.eventId);if(!ev)continue;const c=map.get(m.eventId)||{name:ev.name,count:0,points:0};c.count+=m.quantity||1;c.points+=Number(m.delta)||0;map.set(m.eventId,c)}
    return Array.from(map.values()).sort((a,b)=>b.count-a.count)
  },[tx,events])

  return(
    <div>
      <div className="stats-grid" style={{display:"grid",gridTemplateColumns:"var(--cols-4)",gap:12,marginBottom:20}}>
        {standings.map((t:any,i:number)=>(
          <div key={t.id} className="stat">
            <div className="stat-accent" style={{background:t.color}}/>
            <div className="stat-lbl">{["1°","2°","3°","4°"][i]} — {t.name}</div>
            <div className="stat-val" style={{color:t.color}}>{t.points.toFixed(1)}</div>
            <div className="stat-sub">puntos</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 300px",gap:16}}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="card">
            <div className="card-hdr"><span className="card-title">📈 ANDAMENTO</span></div>
            <div style={{padding:"14px 16px"}}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{top:5,right:10,bottom:5,left:-20}}>
                  <XAxis dataKey="date" tick={{fontSize:10,fill:"var(--g400)"}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:10,fill:"var(--g400)"}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{background:"#fff",border:"1px solid var(--g100)",borderRadius:8,fontSize:11}}/>
                  {TEAMS.map(t=><Line key={t.id} type="monotone" dataKey={t.id} name={t.name} stroke={t.color} strokeWidth={2.5} dot={false}/>)}
                </LineChart>
              </ResponsiveContainer>
              <div style={{display:"flex",gap:14,justifyContent:"center",marginTop:8}}>
                {TEAMS.map(t=><div key={t.id} style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:10,height:10,borderRadius:"50%",background:t.color}}/><span style={{fontSize:11,color:"var(--g500)"}}>{t.name}</span></div>)}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-hdr"><span className="card-title">🏆 RANKING INDIVIDUALE</span></div>
            {playerPoints.slice(0,12).map((p:any,i:number)=>{
              const team=TEAMS.find(t=>t.id===p.teamId)
              return(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",borderBottom:"1px solid var(--g50)",cursor:"pointer",transition:"background .1s"}} onClick={()=>onProfile(p.id)} onMouseEnter={e=>(e.currentTarget.style.background="var(--g50)")} onMouseLeave={e=>(e.currentTarget.style.background="")}>
                  <div style={{width:26,textAlign:"center",fontSize:13,fontWeight:800,color:i===0?"var(--gold)":i===1?"var(--g300)":i===2?"#B45309":"var(--g300)",flexShrink:0}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</div>
                  <PAv player={p} size={34}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:"#fff",marginBottom:1}} className="truncate">{p.name}</div>
                    <div style={{fontSize:11,color:team?.color||"var(--g400)"}}>{team?.name}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"var(--gold)"}}>{p.points.toFixed(1)}</div>
                    <div style={{fontSize:10,color:"var(--g400)"}}>{p.count} ev.</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="card" style={{alignSelf:"start"}}>
          <div className="card-hdr"><span className="card-title">📊 EVENTI</span></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Evento</th><th>Volte</th><th>Pti</th></tr></thead>
              <tbody>
                {evStats.length===0?<tr><td colSpan={3} style={{textAlign:"center",padding:"24px",color:"var(--g400)"}}>Nessun dato</td></tr>
                :evStats.map(r=>(
                  <tr key={r.name}>
                    <td style={{fontWeight:600,color:'var(--mobile-text, var(--navy))'}}>{r.name}</td>
                    <td>{r.count}</td>
                    <td><span style={{color:r.points>=0?"var(--g400)":"var(--red)",fontWeight:700}}>{r.points>=0?"+":""}{r.points.toFixed(1)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── HISTORIAL ─────────────────────────────────────────────────
function HistTab({tx,players,events,isAllowed,showToast}:any){
  const [search,setSearch]=useState("");const [team,setTeam]=useState("");const [from,setFrom]=useState("");const [to,setTo]=useState("")
  const enriched=useMemo(()=>tx.map((t:any)=>({...t,playerName:players.find((p:any)=>p.id===t.playerId)?.name||"",eventName:events.find((e:any)=>e.id===t.eventId)?.name||""})),[tx,players,events])
  const filtered=useMemo(()=>{
    const s=search.toLowerCase();const start=from?new Date(from+"T00:00:00").getTime():-Infinity;const end=to?new Date(to+"T23:59:59").getTime():Infinity
    return enriched.filter((x:any)=>{const t=x.ts?.toMillis?.()??0;return t>=start&&t<=end&&(!team||x.teamId===team)&&(!s||x.playerName.toLowerCase().includes(s)||x.eventName.toLowerCase().includes(s)||(x.note||"").toLowerCase().includes(s))})
  },[enriched,search,team,from,to])
  async function remove(id:string){if(!isAllowed)return;if(!window.confirm("¿Eliminar?"))return;await deleteDoc(doc(ldb,"tx",id));showToast("Movimiento eliminado")}
  return(
    <div>
      <div className="card" style={{marginBottom:14,padding:"14px 16px"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 160px 130px 130px auto",gap:10,alignItems:"end",flexWrap:"wrap"}}>
          <div><div className="fl">Buscar</div><input className="input" placeholder="Giocatore, evento..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
          <div><div className="fl">Equipo</div><select className="input" value={team} onChange={e=>setTeam(e.target.value)}><option value="">Todos</option>{TEAMS.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          <div><div className="fl">Desde</div><input className="input" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div>
          <div><div className="fl">Hasta</div><input className="input" type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
          {(search||team||from||to)&&<button onClick={()=>{setSearch("");setTeam("");setFrom("");setTo("")}} className="btn btn-ghost btn-sm">✕</button>}
        </div>
        <div style={{fontSize:11,color:"var(--g400)",marginTop:8}}>{filtered.length} movimientos</div>
      </div>
      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Squadra</th><th>Giocatore</th><th>Evento</th><th>Q.ta</th><th>Δ Pti</th><th>Nota</th><th>Data</th>{isAllowed&&<th></th>}</tr></thead>
            <tbody>
              {filtered.length===0?<tr><td colSpan={8} style={{textAlign:"center",padding:"32px",color:"var(--g400)"}}>Nessun risultato</td></tr>
              :filtered.map((item:any)=>{
                const t=TEAMS.find(x=>x.id===item.teamId);const stamp=item.ts?.toDate?.().toLocaleString("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})||"—"
                return(<tr key={item.id}>
                  <td><span style={{background:t?.bg||"var(--g50)",color:t?.color||"var(--g500)",padding:"2px 9px",borderRadius:99,fontSize:11,fontWeight:700}}>{t?.name||item.teamId}</span></td>
                  <td style={{fontWeight:600,color:"var(--navy)"}}>{item.playerName||"—"}</td>
                  <td>{item.eventName||"—"}</td>
                  <td>{item.quantity||1}</td>
                  <td><span style={{color:item.delta>=0?"var(--g400)":"var(--red)",fontWeight:700}}>{item.delta>=0?"+":""}{item.delta}</span></td>
                  <td style={{fontSize:11,color:"var(--g400)",maxWidth:160}} className="truncate">{item.note||"—"}</td>
                  <td style={{fontSize:11,whiteSpace:"nowrap"}}>{stamp}</td>
                  {isAllowed&&<td><button onClick={()=>remove(item.id)} className="btn btn-danger btn-xs">✕</button></td>}
                </tr>)
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── FANTASY ───────────────────────────────────────────────────
function FantasyTab({players,tx,lUser,showToast,isAllowed}:any){
  const [view,setView]=useState<"builder"|"ranking">("builder")
  const [myTeam,setMyTeam]=useState<string[]>([])
  const [teamName,setTeamName]=useState("Mi Equipo")
  const [search,setSearch]=useState("")
  const [filterPos,setFilterPos]=useState("")
  const [sortBy,setSortBy]=useState<"points"|"price"|"name">("points")
  const [fTeams,setFTeams]=useState<any[]>([])
  const [saving,setSaving]=useState(false)

  const statsMap=useMemo(()=>{const map=new Map<string,{points:number;count:number}>(); for(const t of tx){if(!t.playerId)continue;const c=map.get(t.playerId)||{points:0,count:0};c.points+=Number(t.delta)||0;c.count+=1;map.set(t.playerId,c)} return map},[tx])
  const enriched=useMemo(()=>players.map((p:any)=>{const s=statsMap.get(p.id)||{points:0,count:0};const team=TEAMS.find(t=>t.id===p.teamId);const price=Math.max(50,Math.min(300,Math.round(50+s.points*2)));return{...p,points:s.points,count:s.count,teamColor:team?.color||"#888",teamName:team?.name||"?",price,photo:getPhoto(p)}}),[players,statsMap])
  const filledSlots=useMemo(()=>{const map:Record<string,string>={};for(const pid of myTeam){const p=enriched.find((x:any)=>x.id===pid);if(!p?.fantasyPosition)continue;const compat=PC[p.fantasyPosition]||[p.fantasyPosition];for(const sk of compat){if(!map[sk]){map[sk]=pid;break}}} return map},[myTeam,enriched])
  const budget=useMemo(()=>{const spent=myTeam.reduce((a,id)=>{const p=enriched.find((x:any)=>x.id===id);return a+(p?.price||0)},0);return Math.round((FANTASY_BUDGET-spent)*10)/10},[myTeam,enriched])
  const myPlayers=useMemo(()=>myTeam.map(id=>enriched.find((p:any)=>p.id===id)).filter(Boolean),[myTeam,enriched])
  const myPoints=myPlayers.reduce((a:number,p:any)=>a+p.points,0)
  const freeSlots=FP_POS.filter(fp=>!filledSlots[fp.key])

  useEffect(()=>{const q=query(collection(ldb,"fantasy_teams"),orderBy("points","desc"));return onSnapshot(q,s=>setFTeams(s.docs.map(d=>({id:d.id,...d.data()}))),()=>{})},[])
  useEffect(()=>{if(!lUser?.email)return;const key=lUser.email.replace(/[^a-zA-Z0-9]/g,"_");return onSnapshot(doc(ldb,"fantasy_teams",key),s=>{if(s.exists()){const d=s.data() as any;setMyTeam(d.playerIds||[]);setTeamName(d.teamName||"Mi Equipo")}},()=>{})},[lUser])

  function togglePlayer(pid:string){
    const p=enriched.find((x:any)=>x.id===pid);if(!p)return
    if(myTeam.includes(pid)){setMyTeam(t=>t.filter(x=>x!==pid));return}
    if(!p.fantasyPosition){showToast(`${p.name} non ha posizione`);return}
    const compat=PC[p.fantasyPosition]||[p.fantasyPosition]
    if(!compat.some((sk:string)=>!filledSlots[sk])){showToast("Slot de posición lleno");return}
    if(myTeam.length>=MAX_SIZE){showToast(`Massimo ${MAX_SIZE} giocatori`);return}
    if(budget<p.price){showToast("Presupuesto insuficiente");return}
    setMyTeam(t=>[...t,pid])
  }

  async function saveTeam(){
    if(!lUser?.email){showToast("Iniciá sesión en Fantasy para guardar");return}
    setSaving(true)
    try{const key=lUser.email.replace(/[^a-zA-Z0-9]/g,"_");await setDoc(doc(ldb,"fantasy_teams",key),{teamName,playerIds:myTeam,points:myPoints,budget,userEmail:lUser.email,updatedAt:new Date().toISOString()});showToast("✓ Equipo guardado")}
    catch{showToast("Error al guardar")}finally{setSaving(false)}
  }

  const displayPlayers=useMemo(()=>{
    let list=[...enriched]
    if(search)list=list.filter((p:any)=>p.name.toLowerCase().includes(search.toLowerCase()))
    if(filterPos)list=list.filter((p:any)=>p.fantasyPosition===filterPos||(PC[p.fantasyPosition]||[]).includes(filterPos))
    if(sortBy==="price")list.sort((a:any,b:any)=>b.price-a.price)
    else if(sortBy==="points")list.sort((a:any,b:any)=>b.points-a.points)
    else list.sort((a:any,b:any)=>a.name.localeCompare(b.name))
    return list
  },[enriched,search,filterPos,sortBy])

  return(
    <div>
      {/* Fantasy header */}
      <div style={{background:"var(--navy)",borderRadius:14,padding:"18px 22px",marginBottom:18}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:".05em",color:"#fff"}}>🏉 FANTASY BRC</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginTop:2}}>Budget {FANTASY_BUDGET} crediti · Max {MAX_SIZE} giocatori</div>
          </div>
          <div style={{display:"flex",gap:14,alignItems:"center",flexWrap:"wrap"}}>
            {[{v:`💰 ${budget}`,l:"crediti",c:"var(--gold)"},{v:`${myTeam.length}/${MAX_SIZE}`,l:"giocatori",c:"#4ADE80"},{v:`⭐ ${myPoints.toFixed(0)}`,l:"punti",c:"#818CF8"}].map(s=>(
              <div key={s.l} style={{textAlign:"center"}}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:s.c}}>{s.v}</div><div style={{fontSize:9,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:".05em"}}>{s.l}</div></div>
            ))}
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input value={teamName} onChange={e=>setTeamName(e.target.value)} style={{padding:"7px 10px",borderRadius:8,border:"1px solid rgba(255,255,255,.15)",background:"rgba(255,255,255,.08)",color:"#fff",fontSize:12,width:130,outline:"none"}}/>
              <button onClick={saveTeam} disabled={saving||!lUser} style={{padding:"8px 14px",border:"none",borderRadius:8,background:lUser?"var(--gold)":"rgba(255,255,255,.1)",color:lUser?"var(--navy)":"rgba(255,255,255,.4)",fontSize:12,fontWeight:700,cursor:lUser?"pointer":"not-allowed"}}>{saving?"…":!lUser?"🔒":"💾"}</button>
            </div>
          </div>
        </div>
      </div>

      {/* View tabs */}
      <div style={{display:"flex",gap:0,marginBottom:16,background:"#fff",border:"1px solid var(--g100)",borderRadius:9,padding:3,width:"fit-content"}}>
        {(["builder","ranking"] as const).map(v=>(
          <button key={v} onClick={()=>setView(v)} style={{padding:"6px 18px",border:"none",borderRadius:7,fontSize:12,fontWeight:600,cursor:"pointer",background:view===v?"var(--navy)":"transparent",color:view===v?"#fff":"var(--g400)"}}>
            {v==="builder"?"🏗 Construir":"🏆 Ranking"}
          </button>
        ))}
      </div>

      {view==="builder"&&(
        <div className="split-3">
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div className="card" style={{overflow:"hidden"}}>
              <div style={{background:"var(--navy)",padding:"8px 14px",fontSize:11,fontWeight:700,color:"rgba(255,255,255,.5)",textTransform:"uppercase",letterSpacing:".06em"}}>{myPlayers.length}/15 seleccionados</div>
              <RugbyPitchSvg players={myPlayers} onRemove={togglePlayer}/>
            </div>
            {freeSlots.length>0&&(
              <div className="card" style={{padding:"10px 12px"}}>
                <div style={{fontSize:10,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:8}}>Slot liberi</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {freeSlots.map(fp=>(
                    <button key={fp.key} onClick={()=>setFilterPos(filterPos===fp.key?"":fp.key)} style={{padding:"3px 8px",borderRadius:99,border:`1px solid ${filterPos===fp.key?"var(--navy)":"var(--g200)"}`,background:filterPos===fp.key?"var(--navy)":"#fff",color:filterPos===fp.key?"#fff":"var(--g500)",fontSize:10,fontWeight:600,cursor:"pointer"}}>#{fp.short} {fp.label}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              <input className="input" placeholder="Cerca giocatore..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1}}/>
              <select className="input" style={{width:130}} value={sortBy} onChange={e=>setSortBy(e.target.value as any)}><option value="points">⭐ Puntos</option><option value="price">💰 Precio</option><option value="name">A-Z</option></select>
            </div>
            <div className="card">
              <div style={{display:"grid",gridTemplateColumns:"36px 1fr 80px 55px 80px",gap:8,padding:"8px 14px",background:"var(--g50)",borderBottom:"1px solid var(--g100)"}}>
                {["","Jugador","Pos.","Precio",""].map((h,i)=><div key={i} style={{fontSize:9,fontWeight:700,color:"var(--g400)",textTransform:"uppercase",letterSpacing:".04em"}}>{h}</div>)}
              </div>
              {displayPlayers.map((p:any)=>{
                const inTeam=myTeam.includes(p.id);const compat=PC[p.fantasyPosition]||[];const slotFull=!inTeam&&p.fantasyPosition&&compat.every((sk:string)=>filledSlots[sk]&&filledSlots[sk]!==p.id);const posInfo=FP_POS.find(fp=>fp.key===p.fantasyPosition)
                return(
                  <div key={p.id} style={{display:"grid",gridTemplateColumns:"36px 1fr 80px 55px 80px",gap:8,padding:"9px 14px",borderBottom:"1px solid var(--g50)",alignItems:"center",cursor:slotFull?"not-allowed":"pointer",opacity:slotFull?0.38:1,transition:"background .1s"}} onClick={()=>!slotFull&&togglePlayer(p.id)} onMouseEnter={e=>!slotFull&&(e.currentTarget.style.background="var(--g50)")} onMouseLeave={e=>(e.currentTarget.style.background="")}>
                    <PAv player={p} size={32}/>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:12.5,fontWeight:600,color:"var(--navy)",marginBottom:1}} className="truncate">{p.name}</div>
                      <div style={{fontSize:10,color:p.teamColor}}>{p.teamName}</div>
                    </div>
                    <div style={{fontSize:11,color:"var(--g400)"}}>{posInfo?`#${posInfo.short}`:"—"}</div>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:"var(--gold-d)"}}>💰{p.price}</div>
                    <span style={{fontSize:10,fontWeight:700,padding:"3px 7px",borderRadius:99,background:inTeam?"var(--navy)":slotFull?"var(--red-l)":"var(--g50)",color:inTeam?"#fff":slotFull?"var(--red)":"var(--navy)"}}>{inTeam?"✓":slotFull?"Lleno":"+"}</span>
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div className="card">
              <div className="card-hdr"><span className="card-title">👥 MI EQUIPO</span></div>
              {myPlayers.length===0?<div style={{padding:"24px",textAlign:"center",color:"var(--g400)",fontSize:12}}>Seleziona giocatori</div>
              :myPlayers.map((p:any)=>(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",borderBottom:"1px solid var(--g50)"}}>
                  <PAv player={p} size={30}/><div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600,color:"var(--navy)"}} className="truncate">{p.name}</div><div style={{fontSize:10,color:"var(--g400)"}}>⭐{p.points.toFixed(0)} pts</div></div>
                  <button onClick={()=>togglePlayer(p.id)} className="btn btn-danger btn-xs">✕</button>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="card-hdr"><span className="card-title">🏆 RANKING</span></div>
              {fTeams.length===0?<div style={{padding:"20px",textAlign:"center",color:"var(--g400)",fontSize:12}}>Nessuna squadra</div>
              :fTeams.map((team:any,i:number)=>(
                <div key={team.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:"1px solid var(--g50)"}}>
                  <div style={{width:22,textAlign:"center",fontSize:13,fontWeight:800}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}`}</div>
                  <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:700,color:"var(--navy)"}} className="truncate">{team.teamName}</div><div style={{fontSize:10,color:"var(--g400)"}}>{team.userEmail}</div></div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:"var(--navy)"}}>⭐{(team.points||0).toFixed(0)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {view==="ranking"&&(
        <div className="card" style={{maxWidth:540}}>
          {fTeams.map((team:any,i:number)=>(
            <div key={team.id} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",borderBottom:"1px solid var(--g50)",borderLeft:`4px solid ${i===0?"var(--gold)":i===1?"var(--g300)":i===2?"#B45309":"transparent"}`}}>
              <div style={{width:28,textAlign:"center",fontSize:18,fontWeight:800}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</div>
              <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:"var(--navy)"}}>{team.teamName}</div><div style={{fontSize:12,color:"var(--g400)"}}>{team.userEmail}</div></div>
              <div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:"var(--navy)"}}>⭐{(team.points||0).toFixed(1)}</div><div style={{fontSize:10,color:"var(--g400)"}}>💰{(team.budget||0).toFixed(0)} cr.</div></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── ADMIN ─────────────────────────────────────────────────────
function AdminTab({events,showToast}:any){
  const [evForm,setEvForm]=useState({id:"",name:"",points:"",allowQuantity:false})
  const [saving,setSaving]=useState(false)
  async function saveEvent(){
    if(!evForm.id||!evForm.name){showToast("ID y nombre requeridos");return}
    setSaving(true)
    try{await setDoc(doc(ldb,"events_config",evForm.id.toUpperCase()),{id:evForm.id.toUpperCase(),name:evForm.name,points:Number(evForm.points)||0,allowQuantity:evForm.allowQuantity});setEvForm({id:"",name:"",points:"",allowQuantity:false});showToast("✓ Evento guardado")}
    catch{showToast("Error")}finally{setSaving(false)}
  }
  return(
    <div style={{display:"grid",gridTemplateColumns:"320px 1fr",gap:16}}>
      <div className="card" style={{padding:18}}>
        <div className="card-title" style={{marginBottom:14}}>Nuovo evento</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div><div className="fl">ID</div><input className="input" placeholder="META_PROVA" value={evForm.id} onChange={e=>setEvForm(f=>({...f,id:e.target.value.toUpperCase()}))}/></div>
          <div><div className="fl">Nombre</div><input className="input" placeholder="Meta di Prova" value={evForm.name} onChange={e=>setEvForm(f=>({...f,name:e.target.value}))}/></div>
          <div><div className="fl">Puntos</div><input className="input" type="number" step="0.5" value={evForm.points} onChange={e=>setEvForm(f=>({...f,points:e.target.value}))}/></div>
          <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"var(--g600)",cursor:"pointer"}}><input type="checkbox" checked={evForm.allowQuantity} onChange={e=>setEvForm(f=>({...f,allowQuantity:e.target.checked}))}/>Consenti quantità</label>
          <button onClick={saveEvent} disabled={saving} className="btn btn-primary">{saving?"...":"Guardar evento"}</button>
        </div>
      </div>
      <div className="card">
        <div className="card-hdr"><span className="card-title">EVENTI</span></div>
        <table className="tbl"><thead><tr><th>ID</th><th>Nombre</th><th>Pts</th><th>Qty</th></tr></thead><tbody>
          {events.map((ev:any)=>(
            <tr key={ev.id}><td style={{fontFamily:"monospace",fontSize:11}}>{ev.id}</td><td style={{fontWeight:600,color:"var(--navy)"}}>{ev.name}</td><td><span style={{color:ev.points>=0?"var(--g400)":"var(--red)",fontWeight:700}}>{ev.points>0?"+":""}{ev.points}</span></td><td>{ev.allowQuantity?"✓":"—"}</td></tr>
          ))}
        </tbody></table>
      </div>
    </div>
  )
}

// ── MODALS ────────────────────────────────────────────────────
function AddModal({players,events,lUser,isAllowed,onClose,showToast}:any){
  const [selIds,setSelIds]=useState<string[]>([]);const [q,setQ]=useState("");const [showList,setShowList]=useState(false);const [selEv,setSelEv]=useState<any>(null);const [teamId,setTeamId]=useState("");const [note,setNote]=useState("");const [qty,setQty]=useState(1);const [saving,setSaving]=useState(false)
  const inputRef=useRef<HTMLInputElement>(null)
  const selPlayers=players.filter((p:any)=>selIds.includes(p.id));const filteredP=q?players.filter((p:any)=>p.name?.toLowerCase().includes(q.toLowerCase())):players;const showQty=selEv?.allowQuantity;const delta=(selEv?.points||0)*(showQty?Math.max(qty,1):1)
  async function submit(){
    if(!selEv){showToast("Seleccioná un evento");return}
    if(!selIds.length&&!teamId){showToast("Seleccioná jugador/es o equipo");return}
    if(!note.trim()){showToast("Escribí una nota");return}
    setSaving(true)
    try{
      const base={eventId:selEv.id,delta,note:note.trim(),quantity:showQty?qty:1,ts:serverTimestamp(),createdBy:lUser?.email||null}
      if(selIds.length)await Promise.all(selPlayers.map((p:any)=>addDoc(collection(ldb,"tx"),{...base,teamId:p.teamId,playerId:p.id})))
      else await addDoc(collection(ldb,"tx"),{...base,teamId,playerId:null})
      showToast(`✓ Registrato`);onClose()
    }catch(e:any){showToast("Error: "+e.message)}finally{setSaving(false)}
  }
  return(
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:680}} onClick={e=>e.stopPropagation()}>
        <div className="modal-hdr"><div className="modal-title">➕ AGREGAR PUNTOS</div><button className="modal-x" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
            <div>
              <div className="fl">Tipo de evento *</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6,marginBottom:16}}>
                {events.map((ev:any)=>(
                  <button key={ev.id} onClick={()=>setSelEv(ev)} style={{padding:"10px 8px",borderRadius:9,border:`2px solid ${selEv?.id===ev.id?"var(--navy)":"var(--g100)"}`,background:selEv?.id===ev.id?"var(--g50)":"#fff",cursor:"pointer",textAlign:"center",transition:"all .12s"}}>
                    <div style={{fontSize:12,fontWeight:700,color:"var(--navy)"}}>{ev.name}</div>
                    <div style={{fontSize:11,color:ev.points>=0?"var(--g400)":"var(--red)",marginTop:2,fontWeight:600}}>{ev.points>0?"+":""}{ev.points} pts</div>
                  </button>
                ))}
              </div>
              <div className="fl">Giocatore/i</div>
              <div style={{position:"relative",marginBottom:12}}>
                <input ref={inputRef} className="input" value={q} onChange={e=>{setQ(e.target.value);setShowList(true)}} onFocus={()=>setShowList(true)} onBlur={()=>setTimeout(()=>setShowList(false),200)} placeholder="Cerca giocatore..."/>
                {showList&&q&&(
                  <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"#fff",border:"1px solid var(--g100)",borderRadius:10,boxShadow:"var(--sh-md)",maxHeight:200,overflowY:"auto",zIndex:50}}>
                    {filteredP.slice(0,8).map((p:any)=>(
                      <div key={p.id} onMouseDown={e=>{e.preventDefault();setSelIds(ids=>ids.includes(p.id)?ids.filter(x=>x!==p.id):[...ids,p.id]);setQ("");setShowList(false)}} style={{padding:"9px 14px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid var(--g50)",fontSize:13}}>
                        <span>{p.name}</span>{selIds.includes(p.id)&&<span style={{color:"var(--navy)",fontWeight:700}}>✓</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {selPlayers.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>{selPlayers.map((p:any)=><span key={p.id} style={{display:"flex",alignItems:"center",gap:5,background:"var(--g50)",color:"var(--navy)",fontSize:12,fontWeight:600,padding:"3px 10px",borderRadius:99}}>{p.name}<button onClick={()=>setSelIds(ids=>ids.filter(x=>x!==p.id))} style={{background:"none",border:"none",color:"var(--navy)",fontSize:13,cursor:"pointer",padding:0}}>×</button></span>)}</div>}
              {!selIds.length&&<div><div className="fl">Equipo</div><div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6}}>{TEAMS.map(t=><button key={t.id} onClick={()=>setTeamId(teamId===t.id?"":t.id)} style={{padding:"9px",borderRadius:8,border:`2px solid ${teamId===t.id?t.color:"var(--g100)"}`,background:teamId===t.id?t.bg:"#fff",color:t.color,fontWeight:700,fontSize:12,cursor:"pointer"}}>{t.name}</button>)}</div></div>}
            </div>
            <div>
              {showQty&&<div style={{marginBottom:14}}><div className="fl">Cantidad</div><input className="input" type="number" min={1} value={qty} onChange={e=>setQty(parseInt(e.target.value)||1)}/></div>}
              <div style={{marginBottom:16}}><div className="fl">Nota *</div><input className="input" placeholder="Descripción..." value={note} onChange={e=>setNote(e.target.value)}/></div>
              {selEv&&<div style={{background:delta>=0?"var(--g50)":"var(--red-l)",borderRadius:12,padding:"16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:12,color:"var(--g500)",fontWeight:600,marginBottom:2}}>Preview</div><div style={{fontSize:14,fontWeight:700,color:"var(--navy)"}}>{selEv.name}</div></div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,color:delta>=0?"var(--navy)":"var(--red)"}}>{delta>0?"+":""}{delta}</div></div>}
              <button onClick={submit} disabled={saving} className="btn btn-red" style={{width:"100%",padding:13}}>{saving?"Guardando...":"REGISTRAR"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProfileModal({playerId,players,tx,events,onClose}:any){
  const player=players.find((p:any)=>p.id===playerId);if(!player)return null
  const ptx=tx.filter((t:any)=>t.playerId===playerId);const total=ptx.reduce((a:number,t:any)=>a+(Number(t.delta)||0),0);const team=TEAMS.find(t=>t.id===player.teamId)
  return(
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:440}} onClick={e=>e.stopPropagation()}>
        <div style={{background:"var(--navy)",padding:"22px 22px 20px",position:"relative"}}>
          <button onClick={onClose} style={{position:"absolute",top:14,right:14,width:28,height:28,border:"none",background:"rgba(255,255,255,.1)",borderRadius:"50%",color:"rgba(255,255,255,.5)",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <PAv player={player} size={56}/>
            <div style={{flex:1}}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:".04em",color:"#fff"}}>{player.name}</div><div style={{fontSize:12,color:team?.color||"rgba(255,255,255,.5)",marginTop:2}}>{team?.name}</div><div style={{display:"flex",gap:6,marginTop:8}}><span style={{background:"rgba(255,255,255,.1)",color:"#fff",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>{total.toFixed(1)} pts</span><span style={{background:"rgba(255,255,255,.1)",color:"#fff",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>{ptx.length} eventos</span></div></div>
          </div>
        </div>
        <div style={{padding:"18px 22px 22px"}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:".06em",color:"var(--g400)",marginBottom:10}}>STORICO</div>
          <table className="tbl"><thead><tr><th>Evento</th><th>Pts</th><th>Fecha</th></tr></thead><tbody>
            {ptx.slice(0,10).map((t:any)=>(
              <tr key={t.id}><td>{events.find((e:any)=>e.id===t.eventId)?.name||"—"}</td><td><span style={{color:t.delta>=0?"var(--g400)":"var(--red)",fontWeight:700}}>{t.delta>=0?"+":""}{t.delta}</span></td><td style={{fontSize:11}}>{t.ts?.toDate?.().toLocaleDateString("es-AR")||"—"}</td></tr>
            ))}
          </tbody></table>
        </div>
      </div>
    </div>
  )
}

function LoginModal({onClose,showToast}:any){
  const [email,setEmail]=useState("");const [pass,setPass]=useState("");const [show,setShow]=useState(false);const [loading,setL]=useState(false);const [error,setError]=useState("")
  async function submit(e:React.FormEvent){e.preventDefault();setError("");setL(true);try{await signInWithEmailAndPassword(lauth,email,pass);showToast("✓ Sesión iniciada");onClose()}catch{setError("Email o contraseña incorrectos")}finally{setL(false)}}
  return(
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:340}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"28px 24px"}}>
          <div style={{textAlign:"center",marginBottom:20}}><div style={{fontSize:32,marginBottom:8}}>🏉</div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:".05em",color:"var(--navy)"}}>FANTASY BRC</div><div style={{fontSize:12,color:"var(--g400)",marginTop:3}}>Solo usuarios autorizados del BRC</div></div>
          <form onSubmit={submit}>
            <div style={{marginBottom:12}}><div className="fl">Email</div><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
            <div style={{marginBottom:18,position:"relative"}}><div className="fl">Contraseña</div><input className="input" type={show?"text":"password"} value={pass} onChange={e=>setPass(e.target.value)} required style={{paddingRight:40}}/><button type="button" onClick={()=>setShow(s=>!s)} style={{position:"absolute",right:12,bottom:10,border:"none",background:"none",cursor:"pointer",color:"var(--g300)",fontSize:16}}>{show?"👁":"🔒"}</button></div>
            {error&&<div style={{background:"var(--red-l)",color:"var(--red)",padding:"9px 13px",borderRadius:9,fontSize:12,marginBottom:14}}>⚠️ {error}</div>}
            <div style={{display:"flex",gap:8}}><button type="button" onClick={onClose} className="btn btn-ghost" style={{flex:1}}>Annulla</button><button type="submit" disabled={loading} className="btn btn-red" style={{flex:2,opacity:loading?0.6:1}}>{loading?"...":"ENTRAR"}</button></div>
          </form>
        </div>
      </div>
    </div>
  )
}
