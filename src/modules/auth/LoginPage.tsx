import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/shared/firebase/config'

export default function LoginPage() {
  const nav = useNavigate()
  const [mode,setMode]   = useState<'login'|'register'>('login')
  const [email,setEmail] = useState('')
  const [pass,setPass]   = useState('')
  const [name,setName]   = useState('')
  const [show,setShow]   = useState(false)
  const [err,setErr]     = useState('')
  const [loading,setL]   = useState(false)

  async function submit(e:React.FormEvent) {
    e.preventDefault(); setErr(''); setL(true)
    try {
      if (mode==='login') {
        await signInWithEmailAndPassword(auth,email,pass); nav('/')
      } else {
        const {user}=await createUserWithEmailAndPassword(auth,email,pass)
        await setDoc(doc(db,'users',user.uid),{uid:user.uid,email,name:name.trim(),role:'jugador',clubId:'rugbylab',createdAt:new Date()})
        nav('/')
      }
    } catch(e:any) {
      const c=e?.code||''
      if (c.includes('invalid-credential')||c.includes('wrong-password')||c.includes('user-not-found')) setErr('Email o password non corretti')
      else if (c.includes('email-already-in-use')) setErr('Questa email è già registrata')
      else if (c.includes('weak-password')) setErr('La password deve avere almeno 6 caratteri')
      else if (c.includes('too-many-requests')) setErr('Troppi tentativi. Attendi un momento.')
      else setErr('Errore durante l\'elaborazione. Riprova.')
    } finally { setL(false) }
  }

  return (
    <div style={{minHeight:'100dvh',background:'var(--navy)',display:'flex',overflow:'hidden',position:'relative'}}>
      {/* Left panel — desktop only */}
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:48,position:'relative',overflow:'hidden'}} className="login-left-panel">
        <div style={{position:'absolute',inset:0,pointerEvents:'none'}}>
          <div style={{position:'absolute',top:'-10%',right:'-5%',width:'50%',paddingBottom:'50%',borderRadius:'50%',background:'radial-gradient(circle,rgba(200,16,46,.22) 0%,transparent 70%)'}}/>
          <div style={{position:'absolute',bottom:'-10%',left:'-5%',width:'42%',paddingBottom:'42%',borderRadius:'50%',background:'radial-gradient(circle,rgba(245,197,24,.12) 0%,transparent 70%)'}}/>
          <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:.04}} xmlns="http://www.w3.org/2000/svg">
            <defs><pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0L0 0 0 40" fill="none" stroke="white" strokeWidth=".5"/></pattern></defs>
            <rect width="100%" height="100%" fill="url(#g)"/>
          </svg>
        </div>
        <div style={{position:'relative',zIndex:1,textAlign:'center',maxWidth:380}}>
          <div style={{width:80,height:80,borderRadius:20,background:'var(--red)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:36,margin:'0 auto 28px',boxShadow:'0 8px 32px rgba(200,16,46,.4)'}}>🏉</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:58,letterSpacing:'.05em',color:'#fff',lineHeight:.9,marginBottom:12}}>
            RUGBY<br/><span style={{color:'var(--gold)'}}>LAB</span>
          </div>
          <div style={{color:'rgba(255,255,255,.4)',fontSize:13,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:36}}>Bologna Rugby Club · Sistema Integrato</div>
          {['🏃 Pianificazione fisica e nutrizione','📊 Statistiche e rendimento','🏉 Tattica e logistica del club'].map((f,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',background:'rgba(255,255,255,.05)',borderRadius:10,marginBottom:8,textAlign:'left',border:'1px solid rgba(255,255,255,.06)'}}>
              <span style={{fontSize:16}}>{f.slice(0,2)}</span>
              <span style={{color:'rgba(255,255,255,.55)',fontSize:13}}>{f.slice(3)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{width:'min(440px,100%)',background:'#fff',display:'flex',flexDirection:'column',justifyContent:'center',padding:'48px clamp(20px,5vw,40px)',boxShadow:'-20px 0 60px rgba(0,0,0,.2)',position:'relative',flexShrink:0}} className="login-right-panel">
        <div style={{position:'absolute',top:0,left:0,right:0,height:4,background:'linear-gradient(90deg,var(--red),var(--gold))'}}/>
        <div style={{marginBottom:32}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:'.05em',color:'var(--navy)',marginBottom:4}}>
            {mode==='login'?'ACCEDI AL SISTEMA':'CREA IL TUO ACCOUNT'}
          </div>
          <div style={{fontSize:13,color:'var(--g400)'}}>
            {mode==='login'?'Accedi con le tue credenziali':'Completa i tuoi dati per registrarti'}
          </div>
        </div>

        <div style={{display:'flex',background:'var(--g50)',borderRadius:10,padding:3,marginBottom:24,gap:2}}>
          {(['login','register'] as const).map(m=>(
            <button key={m} onClick={()=>{setMode(m);setErr('')}} style={{flex:1,padding:'9px 8px',border:'none',borderRadius:8,fontSize:12.5,fontWeight:600,cursor:'pointer',transition:'all .14s',background:mode===m?'#fff':'transparent',color:mode===m?'var(--navy)':'var(--g400)',boxShadow:mode===m?'0 1px 4px rgba(0,0,0,.1)':'none'}}>
              {m==='login'?'Accedi':'Registrati'}
            </button>
          ))}
        </div>

        <form onSubmit={submit}>
          {mode==='register'&&(
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--g400)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:5}}>Nome completo</div>
              <input className="input" type="text" placeholder="Es: Marco Rossi" value={name} onChange={e=>setName(e.target.value)} required/>
            </div>
          )}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:'var(--g400)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:5}}>Email</div>
            <input className="input" type="email" placeholder="tuamail@esempio.com" value={email} onChange={e=>setEmail(e.target.value)} required/>
          </div>
          <div style={{marginBottom:22}}>
            <div style={{fontSize:11,fontWeight:700,color:'var(--g400)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:5}}>Password</div>
            <div style={{position:'relative'}}>
              <input className="input" type={show?'text':'password'} placeholder="Minimo 6 caratteri" value={pass} onChange={e=>setPass(e.target.value)} required minLength={6} style={{paddingRight:42}}/>
              <button type="button" onClick={()=>setShow(s=>!s)} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',border:'none',background:'none',cursor:'pointer',color:'var(--g300)',fontSize:16,padding:2}}>{show?'👁':'🔒'}</button>
            </div>
          </div>
          {err&&<div style={{display:'flex',alignItems:'center',gap:8,background:'var(--red-l)',color:'var(--red)',fontSize:13,padding:'10px 13px',borderRadius:9,marginBottom:16,fontWeight:500,border:'1px solid rgba(200,16,46,.15)'}}>⚠️ {err}</div>}
          <button type="submit" disabled={loading}
            style={{width:'100%',padding:'13px',border:'none',borderRadius:10,background:loading?'var(--g200)':'var(--navy)',color:loading?'var(--g400)':'#fff',fontSize:15,fontWeight:700,cursor:loading?'not-allowed':'pointer',letterSpacing:'.06em',transition:'all .14s',fontFamily:"'Bebas Neue',sans-serif"}}>
            {loading?'Caricamento...':mode==='login'?'ENTRA NEL SISTEMA →':'CREA ACCOUNT →'}
          </button>
        </form>

        <div style={{marginTop:24,padding:'13px 15px',background:'var(--g50)',borderRadius:10,display:'flex',gap:9,alignItems:'flex-start'}}>
          <span style={{fontSize:15}}>ℹ️</span>
          <div style={{fontSize:12,color:'var(--g400)',lineHeight:1.5}}>
            {mode==='login'?'Problemi di accesso? Contatta l\'amministratore del club.':'Il tuo account avrà accesso base. L\'admin potrà assegnarti un ruolo.'}
          </div>
        </div>
      </div>
    </div>
  )
}
