// src/shared/components/PhotoScanner.tsx
// Claude Vision — AI photo scanning for food & exercise plans
import { useState, useRef } from 'react'

export interface ScanItem {
  name: string; quantity: string
  calories: number; protein: number; carbs: number; fat: number
}
export interface ScanResult {
  items: ScanItem[]
  type: 'food' | 'exercise'
}

interface Props {
  mode: 'food' | 'exercise'
  onResult: (result: ScanResult) => void
  onClose: () => void
}

export default function PhotoScanner({ mode, onResult, onClose }: Props) {
  const [step, setStep] = useState<'upload'|'scanning'|'result'|'error'>('upload')
  const [preview, setPreview] = useState<string|null>(null)
  const [items, setItems] = useState<ScanItem[]>([])
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError('La imagen debe pesar menos de 10MB'); setStep('error'); return }

    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      const base64 = dataUrl.split(',')[1]
      setPreview(dataUrl)
      setStep('scanning')

      const prompt = mode === 'food'
        ? `Analizza questa immagine. Può essere: foto di un piatto, etichetta nutrizionale, menù o piano dietetico scritto. Identifica TUTTI gli alimenti/pietanze visibili con i loro valori nutrizionali stimati. Se è un'etichetta, usa i valori esatti. Rispondi SOLO con JSON valido senza markdown né spiegazioni:
{"items":[{"name":"nombre del alimento","quantity":"cantidad ej: 200g o 1 unidad","calories":número_entero,"protein":número,"carbs":número,"fat":número}]}`
        : `Analizza questa immagine di un piano di allenamento, tabella esercizi o scheda di palestra. Estrai TUTTI gli esercizi con le loro serie e ripetizioni. Rispondi SOLO con JSON valido senza markdown:
{"items":[{"name":"nombre del ejercicio","quantity":"series x reps ej: 3x10 o 4 series de 8 reps","calories":0,"protein":0,"carbs":0,"fat":0}]}`

      try {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1500,
            messages: [{
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: file.type as 'image/jpeg'|'image/png'|'image/webp', data: base64 } },
                { type: 'text', text: prompt },
              ],
            }],
          }),
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()
        const text = data.content?.[0]?.text || ''
        const clean = text.replace(/```json|```/g, '').trim()
        const parsed = JSON.parse(clean)
        setItems(parsed.items || [])
        setStep('result')
      } catch (err: any) {
        console.error('Scanner error:', err)
        setError('Impossibile analizzare l\'immagine. Assicurati che sia chiara e ben illuminata.')
        setStep('error')
      }
    }
    reader.readAsDataURL(file)
  }

  const totalCal  = items.reduce((a, i) => a + (Number(i.calories) || 0), 0)
  const totalProt = items.reduce((a, i) => a + (Number(i.protein) || 0), 0)
  const totalCarb = items.reduce((a, i) => a + (Number(i.carbs) || 0), 0)
  const totalFat  = items.reduce((a, i) => a + (Number(i.fat) || 0), 0)

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(10,16,32,.8)', backdropFilter:'blur(5px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:16 }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:580, maxHeight:'94dvh', display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,.3)', overflow:'hidden' }} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{ background:'var(--navy)', padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:mode==='food'?'rgba(245,197,24,.2)':'rgba(200,16,46,.2)', border:`1px solid ${mode==='food'?'rgba(245,197,24,.3)':'rgba(200,16,46,.3)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
              {mode==='food'?'🍽':'💪'}
            </div>
            <div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:17, letterSpacing:'.05em', color:'#fff' }}>
                {mode==='food' ? 'SCANSIONA CIBO / DIETA' : 'SCANSIONA PIANO DI ALLENAMENTO'}
              </div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,.35)', marginTop:1, letterSpacing:'.04em' }}>
                IA · Claude Vision · Estrazione automatica dei dati
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ width:28, height:28, border:'none', background:'rgba(255,255,255,.1)', borderRadius:'50%', color:'rgba(255,255,255,.5)', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflow:'auto', padding:20 }}>

          {/* UPLOAD */}
          {step==='upload' && (
            <div>
              <div
                onClick={()=>fileRef.current?.click()}
                style={{ border:'2px dashed var(--g200)', borderRadius:14, padding:'32px 20px', textAlign:'center', cursor:'pointer', transition:'all .15s', background:'var(--g50)' }}
                onMouseEnter={e=>(e.currentTarget.style.cssText+='border-color:var(--navy);background:#fff')}
                onMouseLeave={e=>(e.currentTarget.style.cssText+=';border-color:var(--g200);background:var(--g50)')}
              >
                <div style={{ fontSize:44, marginBottom:12 }}>{mode==='food'?'🍽':'💪'}</div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:15, letterSpacing:'.05em', color:'var(--navy)', marginBottom:6 }}>
                  CARICA FOTO
                </div>
                <div style={{ fontSize:13, color:'var(--g400)', lineHeight:1.6 }}>
                  {mode==='food'
                    ? 'Foto di un piatto, etichetta nutrizionale, menù o piano dietetico'
                    : 'Foto di una tabella esercizi, scheda di allenamento o piano di training'}
                </div>
                <div style={{ marginTop:10, fontSize:11, color:'var(--g300)' }}>JPG · PNG · HEIC · Max 10MB</div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display:'none' }}/>

              <div style={{ marginTop:14, padding:'12px 16px', background:'var(--gold-l)', borderRadius:10, border:'1px solid rgba(245,197,24,.4)', display:'flex', gap:10, alignItems:'flex-start' }}>
                <span style={{ fontSize:15, flexShrink:0 }}>✨</span>
                <div style={{ fontSize:12, color:'var(--gold-d)', lineHeight:1.55 }}>
                  <strong>Claude Vision</strong> analizza l'immagine ed estrae automaticamente i dati. Puoi modificarli prima di aggiungerli al piano.
                </div>
              </div>
            </div>
          )}

          {/* SCANNING */}
          {step==='scanning' && (
            <div style={{ textAlign:'center', padding:'24px 0' }}>
              {preview && <img src={preview} alt="preview" style={{ width:'100%', maxHeight:180, objectFit:'contain', borderRadius:12, marginBottom:20, border:'1px solid var(--g100)' }}/>}
              <div style={{ fontSize:38, marginBottom:12 }}>🤖</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:17, letterSpacing:'.05em', color:'var(--navy)', marginBottom:6 }}>ANALISI IMMAGINE...</div>
              <div style={{ fontSize:13, color:'var(--g400)', marginBottom:20 }}>Claude Vision sta elaborando la foto, un momento...</div>
              <div style={{ height:5, background:'var(--g100)', borderRadius:99, overflow:'hidden', maxWidth:280, margin:'0 auto' }}>
                <div style={{ height:'100%', background:'linear-gradient(90deg,var(--red),var(--navy))', borderRadius:99, animation:'scanBar 1.8s ease-in-out infinite' }}/>
              </div>
              <style>{`@keyframes scanBar{0%{width:0%;margin-left:0}50%{width:65%;margin-left:17%}100%{width:0%;margin-left:100%}}`}</style>
            </div>
          )}

          {/* ERROR */}
          {step==='error' && (
            <div style={{ textAlign:'center', padding:'24px 0' }}>
              <div style={{ fontSize:40, marginBottom:14 }}>⚠️</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:17, color:'var(--red)', marginBottom:8 }}>ERRORE DI ANALISI</div>
              <div style={{ fontSize:13, color:'var(--g400)', marginBottom:22, lineHeight:1.6 }}>{error}</div>
              <button onClick={()=>{setStep('upload');setError('');setPreview(null)}} className="btn btn-primary">Riprova</button>
            </div>
          )}

          {/* RESULT */}
          {step==='result' && (
            <div>
              {/* Preview + summary */}
              <div style={{ display:'flex', gap:12, marginBottom:16, alignItems:'center', padding:'12px 14px', background:'var(--g50)', borderRadius:12 }}>
                {preview && <img src={preview} alt="" style={{ width:56, height:56, objectFit:'cover', borderRadius:9, flexShrink:0 }}/>}
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--navy)', marginBottom:3 }}>
                    ✓ {items.length} {mode==='food'?'alimenti':'esercizi'} rilevati
                  </div>
                  <div style={{ fontSize:11, color:'var(--g400)' }}>Controlla e modifica i dati prima di confermare</div>
                </div>
                <button onClick={()=>{setStep('upload');setPreview(null);setItems([])}} style={{ fontSize:11, color:'var(--g400)', background:'none', border:'1px solid var(--g200)', borderRadius:7, padding:'5px 10px', cursor:'pointer' }}>
                  ← Nuova foto
                </button>
              </div>

              {/* Items table */}
              {mode==='food' ? (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 75px 68px 52px 52px 52px 26px', gap:5, marginBottom:6 }}>
                    {['Alimento','Quantità','Kcal','Prot','Carb','Grassi',''].map((h,i)=>(
                      <div key={i} style={{ fontSize:9, fontWeight:700, color:'var(--g400)', textTransform:'uppercase', letterSpacing:'.05em', padding:'0 2px' }}>{h}</div>
                    ))}
                  </div>
                  {items.map((item,i)=>(
                    <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 75px 68px 52px 52px 52px 26px', gap:5, marginBottom:6, alignItems:'center' }}>
                      <input className="input" style={{ padding:'6px 8px', fontSize:12 }} value={item.name} onChange={e=>setItems(v=>v.map((x,j)=>j===i?{...x,name:e.target.value}:x))} placeholder="Alimento..."/>
                      <input className="input" style={{ padding:'6px 7px', fontSize:12 }} value={item.quantity} onChange={e=>setItems(v=>v.map((x,j)=>j===i?{...x,quantity:e.target.value}:x))} placeholder="200g"/>
                      <input className="input" type="number" style={{ padding:'6px 7px', fontSize:12 }} value={item.calories||''} onChange={e=>setItems(v=>v.map((x,j)=>j===i?{...x,calories:+e.target.value}:x))} placeholder="0"/>
                      <input className="input" type="number" style={{ padding:'6px 5px', fontSize:12 }} value={item.protein||''} onChange={e=>setItems(v=>v.map((x,j)=>j===i?{...x,protein:+e.target.value}:x))} placeholder="0"/>
                      <input className="input" type="number" style={{ padding:'6px 5px', fontSize:12 }} value={item.carbs||''} onChange={e=>setItems(v=>v.map((x,j)=>j===i?{...x,carbs:+e.target.value}:x))} placeholder="0"/>
                      <input className="input" type="number" style={{ padding:'6px 5px', fontSize:12 }} value={item.fat||''} onChange={e=>setItems(v=>v.map((x,j)=>j===i?{...x,fat:+e.target.value}:x))} placeholder="0"/>
                      <button onClick={()=>setItems(v=>v.filter((_,j)=>j!==i))} className="btn btn-danger btn-xs" style={{ padding:'5px 6px' }}>✕</button>
                    </div>
                  ))}
                  <button onClick={()=>setItems(v=>[...v,{name:'',quantity:'',calories:0,protein:0,carbs:0,fat:0}])} style={{ padding:'5px 12px', border:'1px dashed var(--g200)', borderRadius:7, background:'transparent', color:'var(--navy)', fontSize:11, fontWeight:600, cursor:'pointer', marginTop:4, marginBottom:14 }}>
                    + Agregar alimento
                  </button>
                  {/* Totals */}
                  {items.length > 0 && (
                    <div style={{ padding:'12px 16px', background:'var(--navy)', borderRadius:12, display:'flex', gap:0, marginBottom:2 }}>
                      {[{l:'Total kcal',v:totalCal,u:'kcal',c:'var(--gold)'},{l:'Proteína',v:totalProt,u:'g',c:'#6EE7B7'},{l:'Carbos',v:totalCarb,u:'g',c:'#93C5FD'},{l:'Grasa',v:totalFat,u:'g',c:'#FCA5A5'}].map(s=>(
                        <div key={s.l} style={{ flex:1, textAlign:'center', borderRight:'1px solid rgba(255,255,255,.08)', padding:'4px 0' }}>
                          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:s.c, lineHeight:1 }}>{Math.round(s.v)}</div>
                          <div style={{ fontSize:9, color:'rgba(255,255,255,.3)', textTransform:'uppercase', letterSpacing:'.05em', marginTop:2 }}>{s.l}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 150px 26px', gap:8, marginBottom:6 }}>
                    {['Ejercicio','Series × Reps',''].map((h,i)=>(
                      <div key={i} style={{ fontSize:9, fontWeight:700, color:'var(--g400)', textTransform:'uppercase', letterSpacing:'.05em' }}>{h}</div>
                    ))}
                  </div>
                  {items.map((item,i)=>(
                    <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 150px 26px', gap:8, marginBottom:7, alignItems:'center' }}>
                      <input className="input" style={{ padding:'7px 9px', fontSize:12 }} value={item.name} onChange={e=>setItems(v=>v.map((x,j)=>j===i?{...x,name:e.target.value}:x))} placeholder="Ejercicio..."/>
                      <input className="input" style={{ padding:'7px 9px', fontSize:12 }} value={item.quantity} onChange={e=>setItems(v=>v.map((x,j)=>j===i?{...x,quantity:e.target.value}:x))} placeholder="3 x 10"/>
                      <button onClick={()=>setItems(v=>v.filter((_,j)=>j!==i))} className="btn btn-danger btn-xs" style={{ padding:'5px 6px' }}>✕</button>
                    </div>
                  ))}
                  <button onClick={()=>setItems(v=>[...v,{name:'',quantity:'',calories:0,protein:0,carbs:0,fat:0}])} style={{ padding:'5px 12px', border:'1px dashed var(--g200)', borderRadius:7, background:'transparent', color:'var(--navy)', fontSize:11, fontWeight:600, cursor:'pointer', marginTop:4 }}>
                    + Agregar ejercicio
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step==='result' && items.length > 0 && (
          <div style={{ padding:'14px 20px', borderTop:'1px solid var(--g100)', display:'flex', gap:8, flexShrink:0, background:'#fff' }}>
            <button onClick={onClose} className="btn btn-ghost" style={{ flex:1 }}>Cancelar</button>
            <button onClick={()=>onResult({items, type:mode})} className="btn btn-red" style={{ flex:2, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:'.04em', fontSize:14 }}>
              ✓ USA QUESTI DATI
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
