// PDF text extraction and parsing for rugby stats PDFs
import * as pdfjsLib from 'pdfjs-dist'

// Point worker to local asset
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export type PdfType = 'minutaggi' | 'presenze' | 'stats_generali' | 'stats_individuali' | 'unknown'

export interface MinutaggiRow {
  name: string
  starter: number
  finisher: number
  indisponibile: number
  nonConvocato: number
  presenzeTotal: number
  minutiStagione: number
}

export interface PresenzeRow {
  name: string
  pct: number
  presenti: number
  infortuni: number
  convocato: number  // C column
  malattia: number   // M column
  assenti: number
  tot: number
  fascia: 'OTTIMO' | 'BUONO' | 'SCARSO' | 'PESSIMO' | ''
}

export interface StatsGenerali {
  rival: string
  date: string
  // difesa
  placcaggiTotali: number
  placcaggiDominanti: number
  placcaggiMancati: number
  salitaPositiva: number
  salitaNegativa: number
  // attacco
  portatoriTotale: number
  portatoriPositivi: number
  sostegnoPositivo: number
  sostegnoNegativo: number
  erroriHandling: number
  // touche nostra
  toucheNostre: number
  toucheNostre_pos: number
  toucheNostre_neg: number
  // touche avversario
  toucheAvversario: number
  toucheAvversario_pos: number
  toucheAvversario_neg: number
  // mischia nostra
  mischiaNostre: number
  mischiaNostre_pos: number
  mischiaNostre_neg: number
  // mischia avversario
  mischiaAvversario: number
  mischiaAvversario_pos: number
  mischiaAvversario_neg: number
  // generale
  calciPunizione: number
  visiteZonaOro: number
  visiteProficue: number
}

export interface StatsIndividuali {
  matchTitle: string
  players: {
    code: string
    name: string          // resolved if possible
    minuti: number
    wrPesato: number
    workRatePct: number   // as integer, e.g. 235 for 235%
    gestEfficaci: number
    gestNonEfficaci: number
    workEfficacyPct: number
    gpsVolume: number     // metres
    gpsPerformance: number
    gpsPerformancePct: number
    // technical
    ballCarrierAvanzante: number
    tackleDominante: number
    tackleNeutro: number
    tackleIneffice: number
    cleanOut: number
  }[]
}

// ─────────────────────────────────────────────────────────────────
// Extract all text items from a PDF file
// ─────────────────────────────────────────────────────────────────
export async function extractPdfText(file: File): Promise<string[][]> {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const pages: string[][] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const items = content.items
      .map((i: any) => (i.str as string).trim())
      .filter(s => s.length > 0)
    pages.push(items)
  }
  return pages
}

// ─────────────────────────────────────────────────────────────────
// Detect PDF type from its text tokens
// ─────────────────────────────────────────────────────────────────
export function detectPdfType(pages: string[][]): PdfType {
  const flat = pages.flat().join(' ').toUpperCase()
  if (flat.includes('MINUTI GIOCATI') || flat.includes('STAGIONE 25/26') || flat.includes('STARTER') && flat.includes('FINISHER') && flat.includes('INDISPONIBILE')) return 'minutaggi'
  if (flat.includes('FASCIA') && flat.includes('OTTIMO') && flat.includes('BUONO')) return 'presenze'
  if (flat.includes('STATISTICHE GENERALI') || flat.includes('PLACCAGGI TOTALI')) return 'stats_generali'
  if (flat.includes('WORK RATE') || flat.includes('GPS PERFORMANCE') || flat.includes('WR PESATO')) return 'stats_individuali'
  return 'unknown'
}

// ─────────────────────────────────────────────────────────────────
// Parse MINUTAGGI PDF
// ─────────────────────────────────────────────────────────────────
export function parseMinutaggi(pages: string[][]): MinutaggiRow[] {
  const tokens = pages.flat()
  const rows: MinutaggiRow[] = []

  // Find start index (after header row)
  let i = 0
  while (i < tokens.length && !tokens[i].toUpperCase().includes('MINUTI GIOCATI')) i++
  i++ // skip the "stagione 25/26" token if present
  while (i < tokens.length && tokens[i].toUpperCase().includes('STAGIONE')) i++

  // Now parse rows: NAME (possibly 2-3 tokens with dash), then 6 numbers
  while (i < tokens.length) {
    // Collect name tokens (uppercase words, possibly with apostrophe)
    const nameParts: string[] = []
    while (i < tokens.length && isNameToken(tokens[i])) {
      nameParts.push(tokens[i])
      i++
    }
    if (nameParts.length === 0) { i++; continue }
    const name = nameParts.join(' ')

    // Next up to 6 values (some may be '-', empty cells produce no token)
    const nums: number[] = []
    while (i < tokens.length && nums.length < 6) {
      const t = tokens[i].replace(',', '.')
      if (t === '-' || t === '') { nums.push(0); i++ }
      else if (/^\d+$/.test(t)) { nums.push(parseInt(t)); i++ }
      else break
    }

    // If only 5 values, one column was an empty cell (most often "non convocato" at index 3).
    // Detect: last value is always minuti (large), second-to-last is presenze totali.
    // Insert 0 at index 3 when we have 5 values.
    if (nums.length === 5) {
      nums.splice(3, 0, 0)
    }

    if (nums.length === 6) {
      rows.push({
        name,
        starter: nums[0],
        finisher: nums[1],
        indisponibile: nums[2],
        nonConvocato: nums[3],
        presenzeTotal: nums[4],
        minutiStagione: nums[5],
      })
    }
  }
  return rows
}

function isNameToken(t: string): boolean {
  // Name tokens are: uppercase words, may contain apostrophe, dash prefix (-) not a number
  if (/^\d+$/.test(t)) return false
  if (t === '-') return false
  if (t === '') return false
  if (/^[A-ZÀÈÌÒÙÁÉÍÓÚ'\s]+$/.test(t) && t.length > 1) return true
  return false
}

// ─────────────────────────────────────────────────────────────────
// Parse PRESENZE PDF
// ─────────────────────────────────────────────────────────────────
export function parsePresenze(pages: string[][]): PresenzeRow[] {
  const tokens = pages.flat()
  const rows: PresenzeRow[] = []

  // Skip header row
  let i = 0
  while (i < tokens.length && !tokens[i].toUpperCase().includes('COGNOME')) i++
  // skip header tokens: COGNOME NOME % P I C M A TOT FASCIA
  while (i < tokens.length && ['COGNOME','NOME','%','P','I','C','M','A','TOT','FASCIA'].includes(tokens[i].toUpperCase())) i++

  const FASCIA_LABELS = ['OTTIMO', 'BUONO', 'SCARSO', 'PESSIMO']

  while (i < tokens.length) {
    // row number (optional)
    if (/^\d{1,2}$/.test(tokens[i]) && !tokens[i+1]?.includes('%')) { i++; continue }

    // Name (2-3 uppercase tokens)
    const nameParts: string[] = []
    while (i < tokens.length && isNameToken(tokens[i])) {
      nameParts.push(tokens[i]); i++
    }
    if (nameParts.length === 0) { i++; continue }
    const name = nameParts.join(' ')

    // %, then P I C M A TOT
    // % token looks like "96,7%"
    const pctStr = tokens[i] ?? ''
    if (!pctStr.includes('%')) continue
    const pct = parseFloat(pctStr.replace(',', '.').replace('%', ''))
    i++

    const nums: number[] = []
    while (i < tokens.length && nums.length < 6) {
      const t = tokens[i]
      if (/^\d+$/.test(t)) { nums.push(parseInt(t)); i++ }
      else if (t === '-') { nums.push(0); i++ }
      else break
    }
    if (nums.length < 6) continue

    // Optional FASCIA label (might appear inline or as separate column)
    let fascia: PresenzeRow['fascia'] = ''
    if (i < tokens.length && FASCIA_LABELS.includes(tokens[i]?.toUpperCase())) {
      fascia = tokens[i].toUpperCase() as PresenzeRow['fascia']
      i++
    }

    // Skip extended fascia descriptions like "85 - 100 %"
    while (i < tokens.length && (tokens[i] === '-' || /^\d+$/.test(tokens[i]) || tokens[i] === '%')) i++

    rows.push({
      name,
      pct,
      presenti: nums[0],
      infortuni: nums[1],
      convocato: nums[2],
      malattia: nums[3],
      assenti: nums[4],
      tot: nums[5],
      fascia,
    })
  }
  return rows
}

// ─────────────────────────────────────────────────────────────────
// Parse STATISTICHE GENERALI PDF
// ─────────────────────────────────────────────────────────────────
export function parseStatsGenerali(pages: string[][]): StatsGenerali {
  const tokens = pages.flat()
  const text = tokens.join(' ')

  function extract(keyword: string): number {
    const re = new RegExp(keyword.replace(/\s+/g, '\\s+') + '\\s+(\\d+)', 'i')
    const m = text.match(re)
    return m ? parseInt(m[1]) : 0
  }

  // Match title e.g. "BOLOGNA RUGBY CLUB - RUGBY COLORNO (3/05/2026)"
  const titleMatch = text.match(/BOLOGNA[^-]+-\s*(.+?)\s*\((\d{1,2}\/\d{2}\/\d{4})\)/i)
  const rival = titleMatch ? titleMatch[1].trim() : ''
  const dateRaw = titleMatch ? titleMatch[2] : ''
  // convert dd/mm/yyyy to yyyy-mm-dd
  const dateParts = dateRaw.split('/')
  const date = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1].padStart(2,'0')}-${dateParts[0].padStart(2,'0')}` : ''

  return {
    rival, date,
    placcaggiTotali:     extract('PLACCAGGI TOTALI'),
    placcaggiDominanti:  extract('PLACCAGGI DOMINANTI'),
    placcaggiMancati:    extract('PLACCAGGI MANCATI'),
    salitaPositiva:      extract('SALITA POSITIVA'),
    salitaNegativa:      extract('SALITA NEGATIVA'),
    portatoriTotale:     extract('PORTATORI TOTALE'),
    portatoriPositivi:   extract('PORTATORI POSITIVI'),
    sostegnoPositivo:    extract('SOSTEGNO POSITIVO'),
    sostegnoNegativo:    extract('SOSTEGNO NEGATIVO'),
    erroriHandling:      extract('ERRORI HANDLING'),
    // For touche/mischia we pick first occurrence for "nostre" and second for "avversario"
    toucheNostre:        extractNth(text, 'TOTALI NOSTRE', 1),
    toucheNostre_pos:    extractNth(text, 'POSITIVE', 1),
    toucheNostre_neg:    extractNth(text, 'NEGATIVE', 1),
    toucheAvversario:    extractNth(text, 'TOTALI AVVERSARIO', 1),
    toucheAvversario_pos: extractNth(text, 'POSITIVE', 2),
    toucheAvversario_neg: extractNth(text, 'NEGATIVE', 2),
    mischiaNostre:       extractNth(text, 'TOTALI NOSTRE', 2),
    mischiaNostre_pos:   extractNth(text, 'POSITIVE', 3),
    mischiaNostre_neg:   extractNth(text, 'NEGATIVE', 3),
    mischiaAvversario:   extractNth(text, 'TOTALI AVVERSARIO', 2),
    mischiaAvversario_pos: extractNth(text, 'POSITIVE', 4),
    mischiaAvversario_neg: extractNth(text, 'NEGATIVE', 4),
    calciPunizione:      extract('CALCI PUNIZIONE'),
    visiteZonaOro:       extract('VISITE ZONA ORO'),
    visiteProficue:      extract('VISITE PROFICUE'),
  }
}

function extractNth(text: string, keyword: string, nth: number): number {
  const re = new RegExp(keyword.replace(/\s+/g, '\\s+') + '\\s+(\\d+)', 'gi')
  let count = 0
  let m
  while ((m = re.exec(text)) !== null) {
    count++
    if (count === nth) return parseInt(m[1])
  }
  return 0
}

// ─────────────────────────────────────────────────────────────────
// Parse STATISTICHE INDIVIDUALI PDF (GPS + Technical)
// ─────────────────────────────────────────────────────────────────
export function parseStatsIndividuali(pages: string[][]): StatsIndividuali {
  const tokens = pages.flat()
  const text = tokens.join(' ')

  // Match title
  const titleMatch = text.match(/BOLOGNA[^V]*VS[^(]+\(([^)]+)\)/i)
  const matchTitle = titleMatch ? titleMatch[0] : ''

  // Extract player codes from header row (uppercase 2-8 char codes that appear before MINUTI)
  // The header has codes like: AVERAGE B BIONDI BOSCHETTI DENIS FATTORI GAMBA GIOVA ...
  const minutiIdx = tokens.findIndex(t => t.toUpperCase() === 'MINUTI')
  // Player codes are the tokens between the title info and MINUTI row
  // They start after the match/club name tokens and before MINUTI

  // Strategy: find the MINUTI row, then read each row as: label weight? val1 val2 ...
  // The number of columns = number of players + 1 (AVERAGE column)

  // Find row indices for key stats
  const rows = parseIndividualiRows(tokens)

  return { matchTitle, players: rows }
}

function parseIndividualiRows(tokens: string[]): StatsIndividuali['players'] {
  // Find column header codes - they appear as single uppercase abbreviations
  // before the MINUTI row
  const minutiIdx = tokens.findIndex(t => t.toUpperCase() === 'MINUTI')
  if (minutiIdx < 0) return []

  // Collect column codes: go backwards from MINUTI, picking short uppercase tokens
  const codes: string[] = []
  // The codes appear just before MINUTI in the PDF text flow
  // Scan for them: they're all-caps, 1-12 chars, appear in a sequence
  let ci = minutiIdx - 1
  while (ci >= 0 && codes.length < 25) {
    const t = tokens[ci]
    if (/^[A-Z0-9_'àèìòùÀÈÌÒÙ]{1,12}$/.test(t) && t !== 'MINUTI') {
      codes.unshift(t)
      ci--
    } else {
      break
    }
  }

  // Remove "AVERAGE" column (first one)
  const playerCodes = codes.filter(c => c !== 'AVERAGE' && c !== 'MEDIA')

  // Now read the MINUTI row values
  const minutiValues = readRowValues(tokens, minutiIdx, playerCodes.length + 1)
  const minutiPlayer = minutiValues.slice(1) // skip AVERAGE

  // Find other key rows
  const wrPesatoIdx   = findRowIdx(tokens, 'WR PESATO', minutiIdx)
  const workRateIdx   = findRowIdx(tokens, 'WORK RATE', minutiIdx)
  const gpsVolIdx     = findRowIdx(tokens, 'VOLUME', minutiIdx)
  const gpsPerfIdx    = findRowIdx(tokens, 'GPS PERFORMANCE %', minutiIdx)
  const gestEffIdx    = findRowIdx(tokens, 'GESTI EFFICACI', minutiIdx)
  const gestNEIdx     = findRowIdx(tokens, 'GESTI NON', minutiIdx)
  const bcAvIdx       = findRowIdx2(tokens, 'BALL CARRIER', 'AVANZANTE', minutiIdx)
  const tackDomIdx    = findRowIdx2(tokens, 'TACKLE', 'DOMINANTE', minutiIdx)
  const tackNeutIdx   = findRowIdx2(tokens, 'TACKLE', 'NEUTRO', minutiIdx)
  const tackIneffIdx  = findRowIdx2(tokens, 'INEFFICACE', 'TACKLE', minutiIdx)
  const cleanOutIdx   = findRowIdx2(tokens, 'CLEAN OUT', '1°', minutiIdx)

  const wrPesato       = wrPesatoIdx  >= 0 ? readRowValues(tokens, wrPesatoIdx,  playerCodes.length+1).slice(1) : []
  const workRate       = workRateIdx  >= 0 ? readRowPctValues(tokens, workRateIdx, playerCodes.length+1).slice(1) : []
  const gpsVol         = gpsVolIdx    >= 0 ? readRowValues(tokens, gpsVolIdx,     playerCodes.length+1).slice(1) : []
  const gpsPerf        = gpsPerfIdx   >= 0 ? readRowPctValues(tokens, gpsPerfIdx, playerCodes.length+1).slice(1) : []
  const gestEff        = gestEffIdx   >= 0 ? readRowValues(tokens, gestEffIdx,    playerCodes.length+1).slice(1) : []
  const gestNE         = gestNEIdx    >= 0 ? readRowValues(tokens, gestNEIdx,     playerCodes.length+1).slice(1) : []
  const bcAv           = bcAvIdx      >= 0 ? readRowValues(tokens, bcAvIdx,       playerCodes.length+1).slice(1) : []
  const tackDom        = tackDomIdx   >= 0 ? readRowValues(tokens, tackDomIdx,    playerCodes.length+1).slice(1) : []
  const tackNeut       = tackNeutIdx  >= 0 ? readRowValues(tokens, tackNeutIdx,   playerCodes.length+1).slice(1) : []
  const tackIneff      = tackIneffIdx >= 0 ? readRowValues(tokens, tackIneffIdx,  playerCodes.length+1).slice(1) : []
  const cleanOut       = cleanOutIdx  >= 0 ? readRowValues(tokens, cleanOutIdx,   playerCodes.length+1).slice(1) : []

  return playerCodes.map((code, idx) => ({
    code,
    name: code,
    minuti: minutiPlayer[idx] ?? 0,
    wrPesato: wrPesato[idx] ?? 0,
    workRatePct: workRate[idx] ?? 0,
    gestEfficaci: gestEff[idx] ?? 0,
    gestNonEfficaci: gestNE[idx] ?? 0,
    workEfficacyPct: 0,
    gpsVolume: gpsVol[idx] ?? 0,
    gpsPerformance: 0,
    gpsPerformancePct: gpsPerf[idx] ?? 0,
    ballCarrierAvanzante: bcAv[idx] ?? 0,
    tackleDominante: tackDom[idx] ?? 0,
    tackleNeutro: tackNeut[idx] ?? 0,
    tackleIneffice: tackIneff[idx] ?? 0,
    cleanOut: cleanOut[idx] ?? 0,
  }))
}

function findRowIdx(tokens: string[], keyword: string, after: number): number {
  const kw = keyword.toUpperCase()
  for (let i = after; i < tokens.length; i++) {
    if (tokens[i].toUpperCase().includes(kw.split(' ')[0]) &&
        (!kw.split(' ')[1] || tokens[i+1]?.toUpperCase().includes(kw.split(' ')[1]))) {
      return i
    }
  }
  return -1
}

function findRowIdx2(tokens: string[], kw1: string, kw2: string, after: number): number {
  for (let i = after; i < tokens.length - 1; i++) {
    if (tokens[i].toUpperCase().includes(kw1.toUpperCase()) && tokens[i+1]?.toUpperCase().includes(kw2.toUpperCase())) return i
  }
  return -1
}

function readRowValues(tokens: string[], startIdx: number, count: number): number[] {
  const vals: number[] = []
  let i = startIdx + 1
  // skip any non-numeric tokens (label continuations, % symbols)
  while (i < tokens.length && vals.length < count) {
    const t = tokens[i].replace(',', '.')
    if (/^-?[\d.]+$/.test(t)) { vals.push(parseFloat(t)); i++ }
    else if (t === '-' || t === '#DIV/0!') { vals.push(0); i++ }
    else if (/^[A-Z%]+$/.test(t) && t.length < 6 && vals.length === 0) { i++ } // skip label continuation
    else if (vals.length > 0) break
    else { i++ }
  }
  return vals
}

function readRowPctValues(tokens: string[], startIdx: number, count: number): number[] {
  const vals: number[] = []
  let i = startIdx + 1
  while (i < tokens.length && vals.length < count) {
    const t = tokens[i]
    if (t.endsWith('%')) {
      vals.push(parseInt(t.replace('%', '').replace(',', '.')))
      i++
    } else if (t === '-' || t === '#DIV/0!') { vals.push(0); i++ }
    else if (/^[A-Z%\s]+$/.test(t) && t.length < 10 && vals.length === 0) { i++ }
    else if (vals.length > 0) break
    else { i++ }
  }
  return vals
}
