import { useState } from 'react'
export function Avatar({ initials='?', src, size=36, bg='#EEF1F6', color='#0A1628', radius }: { initials?:string;src?:string;size?:number;bg?:string;color?:string;radius?:number }) {
  const [err,setErr]=useState(false)
  const r=radius??Math.round(size*.25)
  return (
    <div style={{width:size,height:size,borderRadius:r,background:bg,color,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',fontSize:size*.33,fontWeight:700,flexShrink:0}}>
      {src&&!err?<img src={src} alt={initials} onError={()=>setErr(true)} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'top'}}/>:<span>{initials}</span>}
    </div>
  )
}
export function Toast({msg,type='ok'}:{msg:string;type?:'ok'|'err'}) {
  return <div className={`toast ${type}`}><span style={{fontWeight:700}}>{type==='ok'?'✓':'✕'}</span>{msg}</div>
}
export function Empty({icon='📭',title,desc,action}:{icon?:string;title:string;desc?:string;action?:React.ReactNode}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {desc&&<div className="empty-desc">{desc}</div>}
      {action&&<div style={{marginTop:16}}>{action}</div>}
    </div>
  )
}

export function StatCard({ label, value, delta, deltaType, accentColor, accent, icon }: {
  label:string; value:string; delta?:string; deltaType?:'up'|'warn'|'down'; accentColor?:string; accent?:string; icon?:string
}) {
  const a = accentColor || accent || 'var(--navy)'
  return (
    <div className="stat">
      <div className="stat-accent" style={{background:a}}/>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:8}}>
        <div className="stat-lbl">{label}</div>
        {icon&&<span style={{fontSize:17,opacity:.25}}>{icon}</span>}
      </div>
      <div className="stat-val">{value}</div>
      {delta&&<div className={`stat-sub ${deltaType??''}`}>{delta}</div>}
    </div>
  )
}

// Alias — backwards compat
export const EmptyState = Empty

export function Pill({ children, type='gray' }: { children:React.ReactNode; type?:string }) {
  const styles: Record<string,{bg:string;color:string}> = {
    green:  {bg:'#E6F9EE', color:'#0A6E2E'},
    red:    {bg:'var(--red-l)', color:'var(--red)'},
    gold:   {bg:'var(--gold-l)', color:'var(--gold-d)'},
    blue:   {bg:'#E6EEF9', color:'#0A3A8C'},
    purple: {bg:'#F3EEFF', color:'#5B21B6'},
    gray:   {bg:'var(--g100)', color:'var(--g500)'},
    navy:   {bg:'rgba(10,22,40,.08)', color:'var(--navy)'},
  }
  const s = styles[type] ?? styles.gray
  return <span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:600,background:s.bg,color:s.color,whiteSpace:'nowrap'}}>{children}</span>
}
