import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/shared/firebase/config'
import { useIsMobile } from '@/shared/hooks/useIsMobile'

function Icon({ children, size = 16 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}
const IconMail    = (p:{size?:number}) => <Icon {...p}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></Icon>
const IconLock    = (p:{size?:number}) => <Icon {...p}><rect x="3" y="11" width="18" height="11" rx="2.5"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></Icon>
const IconEye     = (p:{size?:number}) => <Icon {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></Icon>
const IconEyeOff  = (p:{size?:number}) => <Icon {...p}><path d="M17.9 17.9A10.4 10.4 0 0 1 12 20c-7 0-11-8-11-8a18.6 18.6 0 0 1 5-5.9M9.9 4.2A9.5 9.5 0 0 1 12 4c7 0 11 8 11 8a18.7 18.7 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2"/><line x1="1" y1="1" x2="23" y2="23"/></Icon>
const IconArrow   = (p:{size?:number}) => <Icon {...p}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></Icon>
const IconAlert   = (p:{size?:number}) => <Icon {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></Icon>
const IconInfo    = (p:{size?:number}) => <Icon {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></Icon>
const IconUser    = (p:{size?:number}) => <Icon {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Icon>
const IconActivity= (p:{size?:number}) => <Icon {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></Icon>
const IconBarChart= (p:{size?:number}) => <Icon {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></Icon>
const IconShield  = (p:{size?:number}) => <Icon {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></Icon>

const FEATURES = [
  { Ic: IconActivity, label: 'Pianificazione fisica e nutrizione' },
  { Ic: IconBarChart, label: 'Statistiche e rendimento' },
  { Ic: IconShield,   label: 'Tattica e logistica del club' },
]

export default function LoginPage() {
  const nav = useNavigate()
  const isMobile = useIsMobile(900)
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
    <div style={{minHeight:'100dvh',background:'#060B14',display:'flex',flexDirection:isMobile?'column':'row',overflowY:isMobile?'auto':'hidden',overflowX:'hidden',position:'relative'}}>
      {/* Hero panel */}
      <div style={{flex:isMobile?'none':1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:isMobile?'clamp(26px,7vh,36px) 24px 20px':48,position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',inset:0,pointerEvents:'none',background:'radial-gradient(120% 90% at 15% 0%,#132345 0%,#060B14 55%),radial-gradient(80% 60% at 100% 100%,#1a0d16 0%,transparent 60%)'}}/>
        <div style={{position:'absolute',inset:0,pointerEvents:'none'}}>
          <div style={{position:'absolute',top:'-14%',right:'-8%',width:'55%',paddingBottom:'55%',borderRadius:'50%',background:'radial-gradient(circle,rgba(200,16,46,.25) 0%,transparent 68%)',filter:'blur(2px)'}}/>
          <div style={{position:'absolute',bottom:'-16%',left:'-8%',width:'46%',paddingBottom:'46%',borderRadius:'50%',background:'radial-gradient(circle,rgba(245,197,24,.14) 0%,transparent 70%)'}}/>
          <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:.05}} xmlns="http://www.w3.org/2000/svg">
            <defs><pattern id="g" width="46" height="46" patternUnits="userSpaceOnUse"><path d="M46 0H0V46" fill="none" stroke="white" strokeWidth=".6"/></pattern></defs>
            <rect width="100%" height="100%" fill="url(#g)"/>
          </svg>
          <div style={{position:'absolute',inset:0,background:'linear-gradient(180deg,transparent 60%,rgba(0,0,0,.35) 100%)'}}/>
        </div>

        <div className="login-anim" style={{position:'relative',zIndex:1,textAlign:'center',maxWidth:380,width:'100%'}}>
          {!isMobile && (
            <div className="login-kicker"><span className="login-kicker-dot"/>Sistema attivo</div>
          )}
          <div style={{width:isMobile?50:76,height:isMobile?50:76,borderRadius:isMobile?14:18,background:'linear-gradient(155deg,var(--red) 0%,#8C0C22 100%)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:isMobile?22:32,margin:isMobile?'0 auto 12px':'0 auto 24px',boxShadow:'0 10px 32px rgba(200,16,46,.38),inset 0 1px 0 rgba(255,255,255,.18)',border:'1px solid rgba(255,255,255,.12)'}}>🏉</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:isMobile?36:56,letterSpacing:'.04em',color:'#fff',lineHeight:.92,marginBottom:isMobile?4:10}}>
            RUGBY<span style={{color:'var(--gold)'}}>LAB</span>
          </div>
          <div style={{width:36,height:2,background:'linear-gradient(90deg,var(--red),var(--gold))',margin:isMobile?'0 auto 10px':'0 auto 18px',borderRadius:2}}/>
          <div style={{color:'rgba(255,255,255,.38)',fontSize:isMobile?11:12.5,letterSpacing:'.06em',textTransform:'uppercase',marginBottom:isMobile?0:34}}>Bologna Rugby Club · Sistema Integrato</div>
          {!isMobile && (
            <div style={{textAlign:'left'}}>
              {FEATURES.map(({Ic,label},i)=>(
                <div key={i} className="login-feature">
                  <div className="login-feature-ic"><Ic size={15}/></div>
                  <span style={{color:'rgba(255,255,255,.62)',fontSize:13,fontWeight:500}}>{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {!isMobile && (
          <div style={{position:'absolute',left:48,bottom:28,zIndex:1,color:'rgba(255,255,255,.22)',fontSize:11,letterSpacing:'.03em'}}>© {new Date().getFullYear()} Bologna Rugby Club</div>
        )}
      </div>

      {/* Form panel */}
      <div className="login-panel login-anim" style={{width:isMobile?'100%':'min(452px,100%)',flex:isMobile?1:undefined,background:'#fff',display:'flex',flexDirection:'column',justifyContent:'center',padding:isMobile?'26px 22px calc(30px + env(safe-area-inset-bottom,0px))':'52px clamp(24px,5vw,52px)',boxShadow:isMobile?'none':'-24px 0 70px rgba(0,0,0,.32)',position:'relative',flexShrink:0,borderRadius:isMobile?'22px 22px 0 0':0}}>
        <div style={{position:'absolute',top:0,left:isMobile?22:0,right:isMobile?22:0,height:3,background:'linear-gradient(90deg,var(--red),var(--gold))',borderRadius:isMobile?'22px 22px 0 0':0}}/>

        <div style={{marginBottom:isMobile?22:30}}>
          <div style={{fontSize:11,fontWeight:700,color:'var(--red)',letterSpacing:'.09em',textTransform:'uppercase',marginBottom:6}}>{mode==='login'?'Bentornato':'Nuovo accesso'}</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:isMobile?26:30,letterSpacing:'.03em',color:'var(--navy)',lineHeight:1}}>
            {mode==='login'?'ACCEDI AL SISTEMA':'CREA IL TUO ACCOUNT'}
          </div>
          <div style={{fontSize:13,color:'var(--g400)',marginTop:6}}>
            {mode==='login'?'Inserisci le tue credenziali per continuare':'Completa i tuoi dati per registrarti'}
          </div>
        </div>

        <div className="seg-track">
          <div className="seg-thumb" style={{transform:`translateX(${mode==='login'?'0%':'100%'})`}}/>
          {(['login','register'] as const).map(m=>(
            <button key={m} type="button" className="seg-btn" onClick={()=>{setMode(m);setErr('')}} style={{color:mode===m?'var(--navy)':'var(--g400)'}}>
              {m==='login'?'Accedi':'Registrati'}
            </button>
          ))}
        </div>

        <form onSubmit={submit}>
          {mode==='register'&&(
            <div style={{marginBottom:14}}>
              <div className="field-label">Nome completo</div>
              <div className="field-wrap">
                <span className="field-ic"><IconUser size={15}/></span>
                <input className="input" style={{paddingLeft:38}} type="text" placeholder="Es: Marco Rossi" value={name} onChange={e=>setName(e.target.value)} required/>
              </div>
            </div>
          )}
          <div style={{marginBottom:14}}>
            <div className="field-label">Email</div>
            <div className="field-wrap">
              <span className="field-ic"><IconMail size={15}/></span>
              <input className="input" style={{paddingLeft:38}} type="email" placeholder="tuamail@esempio.com" value={email} onChange={e=>setEmail(e.target.value)} required/>
            </div>
          </div>
          <div style={{marginBottom:20}}>
            <div className="field-label">Password</div>
            <div className="field-wrap">
              <span className="field-ic"><IconLock size={15}/></span>
              <input className="input" type={show?'text':'password'} placeholder="Minimo 6 caratteri" value={pass} onChange={e=>setPass(e.target.value)} required minLength={6} style={{paddingLeft:38,paddingRight:42}}/>
              <button type="button" onClick={()=>setShow(s=>!s)} className="field-toggle" aria-label={show?'Nascondi password':'Mostra password'}>
                {show?<IconEyeOff size={16}/>:<IconEye size={16}/>}
              </button>
            </div>
          </div>

          {err&&<div className="login-error"><IconAlert size={16}/><span>{err}</span></div>}

          <button type="submit" disabled={loading} className="login-submit">
            {loading?(<><span className="spinner"/>Elaborazione...</>):(<>{mode==='login'?'ENTRA NEL SISTEMA':'CREA ACCOUNT'}<IconArrow size={16}/></>)}
          </button>
        </form>

        <div className="login-note">
          <IconInfo size={15}/>
          <div>{mode==='login'?'Problemi di accesso? Contatta l\'amministratore del club.':'Il tuo account avrà accesso base. L\'admin potrà assegnarti un ruolo.'}</div>
        </div>
      </div>
    </div>
  )
}
