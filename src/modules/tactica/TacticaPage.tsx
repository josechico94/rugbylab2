// src/modules/tactica/TacticaPage.tsx — Premium redirect to RugbyBoard Pro
import { useIsMobile } from '@/shared/hooks/useIsMobile'

export default function TacticaPage() {
  const isMobile = useIsMobile()
  function open() {
    window.open('https://rugbyboardpro.com', '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="fade-in">
      {/* ── HERO ── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--navy) 0%, #050D18 100%)',
        borderRadius: 'var(--r-2xl)', padding: 'clamp(28px,6vw,56px) clamp(20px,5vw,40px)',
        position: 'relative', overflow: 'hidden', marginBottom: 20,
        textAlign: 'center', isolation: 'isolate',
      }}>
        {/* Pitch lines decoration */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.06, zIndex: 0 }} viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice">
          <line x1="0" y1="200" x2="800" y2="200" stroke="#fff" strokeWidth="1.5"/>
          <line x1="150" y1="0" x2="150" y2="400" stroke="#fff" strokeWidth="1" strokeDasharray="6,6"/>
          <line x1="400" y1="0" x2="400" y2="400" stroke="#fff" strokeWidth="2"/>
          <line x1="650" y1="0" x2="650" y2="400" stroke="#fff" strokeWidth="1" strokeDasharray="6,6"/>
          <circle cx="400" cy="200" r="60" stroke="#fff" strokeWidth="1" fill="none"/>
        </svg>

        {/* Glow blobs */}
        <div style={{ position: 'absolute', top: -80, right: -60, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,197,24,.18) 0%, transparent 70%)', filter: 'blur(10px)', zIndex: 0 }}/>
        <div style={{ position: 'absolute', bottom: -100, left: -60, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,16,46,.22) 0%, transparent 70%)', filter: 'blur(10px)', zIndex: 0 }}/>

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '6px 14px', borderRadius: 99, marginBottom: 22,
            background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
            fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.6)', letterSpacing: '.05em',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00C853', boxShadow: '0 0 8px #00C853' }}/>
            STRUMENTO ESTERNO · INTEGRATO NEL CLUB
          </div>

          {/* Logo mark */}
          <div style={{
            width: 84, height: 84, borderRadius: 22, margin: '0 auto 22px',
            background: 'linear-gradient(135deg, var(--gold) 0%, #E8A020 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 38, boxShadow: '0 12px 40px rgba(245,197,24,.35), inset 0 2px 4px rgba(255,255,255,.3)',
            transform: 'rotate(-6deg)',
          }}>
            <span style={{ transform: 'rotate(6deg)' }}>🏉</span>
          </div>

          <div style={{
            fontFamily: "'Bebas Neue',sans-serif", fontSize: isMobile ? 'clamp(28px,8vw,40px)' : 'clamp(32px,7vw,56px)',
            letterSpacing: '.05em', color: '#fff', lineHeight: .95, marginBottom: 14,
          }}>
            RUGBY<span style={{ color: 'var(--gold)' }}>BOARD</span> PRO
          </div>

          <div style={{
            fontSize: 'clamp(13px,2vw,15px)', color: 'rgba(255,255,255,.5)',
            maxWidth: 440, margin: '0 auto 30px', lineHeight: 1.6,
          }}>
            Lavagna tattica interattiva per progettare azioni, animare movimenti e pianificare la strategia della squadra in tempo reale.
          </div>

          <button onClick={open}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '16px 32px', border: 'none', borderRadius: 14,
              background: 'linear-gradient(135deg, var(--gold) 0%, #E8A020 100%)',
              color: 'var(--navy)', fontFamily: "'Bebas Neue',sans-serif",
              fontSize: 'clamp(15px,2.5vw,19px)', letterSpacing: '.06em', cursor: 'pointer',
              boxShadow: '0 8px 28px rgba(245,197,24,.4)', transition: 'all .2s cubic-bezier(.34,1.56,.64,1)',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(245,197,24,.5)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(245,197,24,.4)' }}
          >
            <span style={{ fontSize: '1.1em' }}>⛶</span> APRI RUGBYBOARD PRO
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, fontSize: 11, color: 'rgba(255,255,255,.3)' }}>
            <span>🔗</span> rugbyboardpro.com
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,.3)' }}/>
            si apre in una nuova scheda
          </div>
        </div>
      </div>

      {/* ── FEATURE GRID ── */}
      <div style={{padding: isMobile ? '0 14px' : 0}}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 13, letterSpacing: '.08em', color: 'var(--g400)', marginBottom: 14, textTransform: 'uppercase' }}>
        Cosa puoi fare
      </div>

      <div className="mod-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { icon: '🎨', iconBg: '#F3EEFF', iconColor: '#5B21B6', title: 'Disegna azioni', desc: 'Frecce, traiettorie curve e annotazioni di testo direttamente sul campo da gioco', accent: '#5B21B6' },
          { icon: '👥', iconBg: '#EBF4FF', iconColor: '#1D5FAD', title: 'Giocatori animati', desc: 'Muovi ogni giocatore e registra sequenze passo per passo per creare animazioni complete', accent: '#1D5FAD' },
          { icon: '☁️', iconBg: '#EDFFF5', iconColor: '#065F46', title: 'Salvato nel cloud', desc: 'Le tue azioni si sincronizzano automaticamente — accedi da qualsiasi dispositivo', accent: '#065F46' },
          { icon: '📤', iconBg: '#FFF7ED', iconColor: '#9A3412', title: 'Esporta e condividi', desc: 'Scarica in JPG, WebM o MP4 da inviare al gruppo squadra o a un giocatore specifico', accent: '#9A3412' },
        ].map(f => (
          <div key={f.title} className="mod-card" style={{ '--accent': f.accent, cursor: 'default' } as any}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <div className="mod-icon" style={{ background: f.iconBg, color: f.iconColor }}>
              <span style={{ fontSize: 21 }}>{f.icon}</span>
            </div>
            <div className="mod-name">{f.title}</div>
            <div className="mod-desc">{f.desc}</div>
          </div>
        ))}
      </div>

      </div>
      <div style={{padding: isMobile ? '0 14px 20px' : 0}}>
      {/* ── SECONDARY CTA ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', background: '#fff', borderRadius: 'var(--r-lg)',
        border: '1px solid var(--g100)', boxShadow: 'var(--sh-xs)', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--g50)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>💡</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 1 }}>Prima volta sulla lavagna?</div>
            <div style={{ fontSize: 12, color: 'var(--g400)' }}>Accedi direttamente e inizia a creare la tua prima azione</div>
          </div>
        </div>
        <button onClick={open} className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }}>
          🌐 Vai a rugbyboardpro.com →
        </button>
      </div>
    </div></div>
  )
}
