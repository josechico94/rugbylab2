// src/modules/estadisticas/PdfImportModal.tsx
import { useState, useRef } from 'react'
import {
  extractPdfText, detectPdfType,
  parseMinutaggi, parsePresenze, parseStatsGenerali, parseStatsIndividuali,
  type PdfType, type MinutaggiRow, type PresenzeRow, type StatsGenerali, type StatsIndividuali,
} from '@/shared/utils/pdfParser'

interface Props {
  onClose: () => void
  onImportMinutaggi: (rows: MinutaggiRow[]) => void
  onImportPresenze: (rows: PresenzeRow[]) => void
  onImportStatsGenerali: (data: StatsGenerali) => void
  onImportStatsIndividuali: (data: StatsIndividuali) => void
}

type Step = 'upload' | 'preview' | 'done'

export default function PdfImportModal({ onClose, onImportMinutaggi, onImportPresenze, onImportStatsGenerali, onImportStatsIndividuali }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pdfType, setPdfType] = useState<PdfType>('unknown')
  const [fileName, setFileName] = useState('')

  const [minutaggi, setMinutaggi] = useState<MinutaggiRow[]>([])
  const [presenze, setPresenze] = useState<PresenzeRow[]>([])
  const [statsGen, setStatsGen] = useState<StatsGenerali | null>(null)
  const [statsInd, setStatsInd] = useState<StatsIndividuali | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setLoading(true)
    setError('')
    setFileName(file.name)
    try {
      const pages = await extractPdfText(file)
      const type = detectPdfType(pages)
      setPdfType(type)

      if (type === 'minutaggi') {
        setMinutaggi(parseMinutaggi(pages))
      } else if (type === 'presenze') {
        setPresenze(parsePresenze(pages))
      } else if (type === 'stats_generali') {
        setStatsGen(parseStatsGenerali(pages))
      } else if (type === 'stats_individuali') {
        setStatsInd(parseStatsIndividuali(pages))
      } else {
        setError('Tipo di PDF non riconosciuto. Sono accettati: Minutaggi Stagione, Presenze Stagione, Statistiche Generali, Statistiche Individuali.')
        setLoading(false)
        return
      }
      setStep('preview')
    } catch (e: any) {
      setError('Errore nella lettura del PDF: ' + (e?.message ?? String(e)))
    }
    setLoading(false)
  }

  function handleConfirm() {
    if (pdfType === 'minutaggi') onImportMinutaggi(minutaggi)
    else if (pdfType === 'presenze') onImportPresenze(presenze)
    else if (pdfType === 'stats_generali' && statsGen) onImportStatsGenerali(statsGen)
    else if (pdfType === 'stats_individuali' && statsInd) onImportStatsIndividuali(statsInd)
    onClose()
  }

  const TYPE_LABELS: Record<PdfType, string> = {
    minutaggi: '⏱ Minutaggi Stagione',
    presenze: '📋 Presenze Stagione',
    stats_generali: '📊 Statistiche Generali partita',
    stats_individuali: '🏃 Statistiche Individuali (GPS)',
    unknown: '❓ Sconosciuto',
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Importa PDF</div>
            <div style={{ fontSize: 11, color: 'var(--g300)', marginTop: 2 }}>Carica un PDF ufficiale per importare automaticamente i dati</div>
          </div>
          <button className="modal-x" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {step === 'upload' && (
            <div>
              {/* Supported types info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                {([
                  { icon: '⏱', label: 'Minutaggi Stagione', desc: 'Aggiorna minuti, presenze e status per ogni giocatore' },
                  { icon: '📋', label: 'Presenze Stagione',  desc: 'Importa % presenza, allenamenti e categorie fascia' },
                  { icon: '📊', label: 'Statistiche Generali', desc: 'Placcaggi, attacco, touche, mischia di una partita' },
                  { icon: '🏃', label: 'Statistiche Individuali', desc: 'GPS e work rate per ogni giocatore della partita' },
                ] as const).map(t => (
                  <div key={t.label} style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--g100)', background: 'var(--g50)' }}>
                    <div style={{ fontSize: 18, marginBottom: 5 }}>{t.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 3 }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--g400)', lineHeight: 1.4 }}>{t.desc}</div>
                  </div>
                ))}
              </div>

              {/* Drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = 'var(--red)' }}
                onDragLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--g100)' }}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                style={{
                  border: '2px dashed var(--g100)', borderRadius: 14, padding: '36px 20px',
                  textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s',
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>
                  {loading ? 'Analisi in corso...' : 'Trascina qui il PDF o clicca per selezionare'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--g300)' }}>Solo file .pdf</div>
              </div>
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

              {error && (
                <div style={{ marginTop: 14, padding: '12px 14px', background: '#FFF0F2', borderRadius: 10, fontSize: 12, color: 'var(--red)', border: '1px solid #FECDD3' }}>
                  ⚠️ {error}
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '10px 14px', background: '#EDFFF5', borderRadius: 10, border: '1px solid #A7F3D0' }}>
                <span style={{ fontSize: 20 }}>✅</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#065F46' }}>PDF analizzato: {TYPE_LABELS[pdfType]}</div>
                  <div style={{ fontSize: 11, color: '#059669' }}>{fileName}</div>
                </div>
              </div>

              {/* MINUTAGGI preview */}
              {pdfType === 'minutaggi' && minutaggi.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>
                    {minutaggi.length} giocatori trovati
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto', borderRadius: 10, border: '1px solid var(--g100)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: 'var(--g50)', position: 'sticky', top: 0 }}>
                          {['Giocatore','Start','Finish','Indispon.','Non conv.','Presenze','Minuti'].map(h => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--g400)', fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid var(--g100)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {minutaggi.map((r, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--g50)' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--navy)' }}>{r.name}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--g500)' }}>{r.starter}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--g500)' }}>{r.finisher}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--g500)' }}>{r.indisponibile}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--g500)' }}>{r.nonConvocato}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--g500)' }}>{r.presenzeTotal}</td>
                            <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--red)' }}>{r.minutiStagione}'</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* PRESENZE preview */}
              {pdfType === 'presenze' && presenze.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>
                    {presenze.length} giocatori trovati
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto', borderRadius: 10, border: '1px solid var(--g100)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: 'var(--g50)', position: 'sticky', top: 0 }}>
                          {['Giocatore','%','Presenti','Infortuni','Assenti','Tot','Fascia'].map(h => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--g400)', fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid var(--g100)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {presenze.map((r, i) => {
                          const fasciaColor = r.fascia === 'OTTIMO' ? '#065F46' : r.fascia === 'BUONO' ? '#0369A1' : r.fascia === 'SCARSO' ? '#B45309' : r.fascia === 'PESSIMO' ? '#C8102E' : 'var(--g400)'
                          const fasciaBg = r.fascia === 'OTTIMO' ? '#EDFFF5' : r.fascia === 'BUONO' ? '#EFF6FF' : r.fascia === 'SCARSO' ? '#FFFAEB' : r.fascia === 'PESSIMO' ? '#FFF0F2' : 'var(--g50)'
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid var(--g50)' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--navy)' }}>{r.name}</td>
                              <td style={{ padding: '8px 10px', fontWeight: 700, color: r.pct >= 85 ? '#065F46' : r.pct >= 70 ? '#0369A1' : r.pct >= 50 ? '#B45309' : '#C8102E' }}>{r.pct}%</td>
                              <td style={{ padding: '8px 10px', color: 'var(--g500)' }}>{r.presenti}</td>
                              <td style={{ padding: '8px 10px', color: 'var(--g500)' }}>{r.infortuni}</td>
                              <td style={{ padding: '8px 10px', color: 'var(--g500)' }}>{r.assenti}</td>
                              <td style={{ padding: '8px 10px', color: 'var(--g500)' }}>{r.tot}</td>
                              <td style={{ padding: '8px 10px' }}>
                                {r.fascia && <span style={{ background: fasciaBg, color: fasciaColor, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{r.fascia}</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* STATS GENERALI preview */}
              {pdfType === 'stats_generali' && statsGen && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    {
                      title: '⚔️ Difesa', items: [
                        ['Placcaggi totali', statsGen.placcaggiTotali],
                        ['Placcaggi dominanti', statsGen.placcaggiDominanti],
                        ['Placcaggi mancati', statsGen.placcaggiMancati],
                        ['Salita positiva', statsGen.salitaPositiva],
                        ['Salita negativa', statsGen.salitaNegativa],
                      ]
                    },
                    {
                      title: '🏉 Attacco', items: [
                        ['Portatori totale', statsGen.portatoriTotale],
                        ['Portatori positivi', statsGen.portatoriPositivi],
                        ['Sostegno positivo', statsGen.sostegnoPositivo],
                        ['Sostegno negativo', statsGen.sostegnoNegativo],
                        ['Errori handling', statsGen.erroriHandling],
                      ]
                    },
                    {
                      title: '🎯 Touche', items: [
                        ['Nostre totali', statsGen.toucheNostre],
                        ['Nostre positive', statsGen.toucheNostre_pos],
                        ['Nostre negative', statsGen.toucheNostre_neg],
                        ['Avversario tot.', statsGen.toucheAvversario],
                        ['Avversario pos.', statsGen.toucheAvversario_pos],
                      ]
                    },
                    {
                      title: '🔄 Mischia + Generale', items: [
                        ['Mischie nostre', statsGen.mischiaNostre],
                        ['Mischie positive', statsGen.mischiaNostre_pos],
                        ['Calci punizione', statsGen.calciPunizione],
                        ['Visite zona oro', statsGen.visiteZonaOro],
                        ['Visite proficue', statsGen.visiteProficue],
                      ]
                    },
                  ].map(sec => (
                    <div key={sec.title} style={{ borderRadius: 10, border: '1px solid var(--g100)', overflow: 'hidden' }}>
                      <div style={{ padding: '8px 12px', background: 'var(--g50)', fontSize: 11, fontWeight: 700, color: 'var(--navy)' }}>{sec.title}</div>
                      {sec.items.map(([l, v]) => (
                        <div key={String(l)} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', borderTop: '1px solid var(--g50)', fontSize: 12 }}>
                          <span style={{ color: 'var(--g500)' }}>{l}</span>
                          <span style={{ fontWeight: 700 }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  {statsGen.rival && (
                    <div style={{ gridColumn: '1/-1', padding: '10px 14px', background: '#EFF6FF', borderRadius: 10, fontSize: 12, color: '#0369A1', fontWeight: 600 }}>
                      ℹ️ Partita rilevata: vs {statsGen.rival} {statsGen.date ? `— ${statsGen.date}` : ''}
                    </div>
                  )}
                </div>
              )}

              {/* STATS INDIVIDUALI preview */}
              {pdfType === 'stats_individuali' && statsInd && statsInd.players.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>
                    {statsInd.players.length} giocatori · {statsInd.matchTitle}
                  </div>
                  <div style={{ maxHeight: 300, overflowY: 'auto', borderRadius: 10, border: '1px solid var(--g100)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: 'var(--g50)', position: 'sticky', top: 0 }}>
                          {['Codice','Min','WR','Work Rate %','GPS Vol (m)','GPS %','Ball Carrier','Tackle Dom.','Clean Out'].map(h => (
                            <th key={h} style={{ padding: '7px 9px', textAlign: 'left', fontWeight: 700, color: 'var(--g400)', fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid var(--g100)', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {statsInd.players.map((p, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--g50)' }}>
                            <td style={{ padding: '7px 9px', fontWeight: 700, color: 'var(--navy)' }}>{p.code}</td>
                            <td style={{ padding: '7px 9px', color: 'var(--g500)' }}>{p.minuti}'</td>
                            <td style={{ padding: '7px 9px', fontWeight: 600 }}>{p.wrPesato.toFixed(1)}</td>
                            <td style={{ padding: '7px 9px' }}>
                              <span style={{ color: p.workRatePct >= 100 ? '#065F46' : p.workRatePct >= 80 ? '#B45309' : '#C8102E', fontWeight: 700 }}>{p.workRatePct}%</span>
                            </td>
                            <td style={{ padding: '7px 9px', color: 'var(--g500)' }}>{p.gpsVolume}</td>
                            <td style={{ padding: '7px 9px', color: 'var(--g500)' }}>{p.gpsPerformancePct}%</td>
                            <td style={{ padding: '7px 9px', color: 'var(--g500)' }}>{p.ballCarrierAvanzante}</td>
                            <td style={{ padding: '7px 9px', color: 'var(--g500)' }}>{p.tackleDominante}</td>
                            <td style={{ padding: '7px 9px', color: 'var(--g500)' }}>{p.cleanOut}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--g100)' }}>
                <button onClick={() => { setStep('upload'); setError('') }} style={{ flex: 1, padding: '10px', border: '1px solid var(--g100)', borderRadius: 9, background: '#fff', color: 'var(--g500)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  ← Carica un altro
                </button>
                <button onClick={handleConfirm} style={{ flex: 2, padding: '10px', border: 'none', borderRadius: 9, background: 'var(--red)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  ✓ Importa dati
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
