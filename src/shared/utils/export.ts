// src/shared/utils/export.ts
// Excel + PDF export utilities for RugbyLab

// ── EXCEL ─────────────────────────────────────────────────────
export async function exportExcel(data: any[][], filename: string, sheetName = 'Datos') {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(data)
  
  // Style header row
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[cell]) {
      ws[cell].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '0A1628' } },
        alignment: { horizontal: 'center' },
      }
    }
  }
  
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// ── PLAYERS EXCEL ─────────────────────────────────────────────
export function playersToExcel(players: any[]) {
  const headers = ['#', 'Nome', 'Posizione', 'Stato', 'Altezza (cm)', 'Peso (kg)', 'Nascita', 'Note']
  const rows = players.map(p => [
    p.number, p.name,
    Array.isArray(p.positions) ? p.positions.join(', ') : p.position || '',
    p.status, p.height || '', p.weight || '',
    p.birthDate || '', p.notes || '',
  ])
  return exportExcel([headers, ...rows], 'plantel_brc')
}

// ── ROUTINE EXCEL ─────────────────────────────────────────────
export function routineToExcel(routine: any, playerName: string) {
  const rows: any[][] = [
    [`SCHEDA — ${playerName} — Settimana ${routine.week}/${routine.year}`],
    [],
  ]
  
  for (const day of routine.days || []) {
    rows.push([`📅 ${day.day} — ${day.type}`])
    for (const block of day.blocks || []) {
      rows.push([`  ${block.blockType.toUpperCase()}`])
      rows.push(['  Esercizio', 'Serie', 'Rip.', 'Carico', 'Unità', 'Note'])
      for (const ex of block.exercises || []) {
        if (ex.setDetails?.length) {
          rows.push([`  ${ex.name}`, '', '', '', ex.unit || 'kg', ex.notes || ''])
          ex.setDetails.forEach((s: any, i: number) => {
            rows.push([`    Serie ${i + 1}`, '', s.reps, s.weight || '', ex.unit || 'kg', ''])
          })
        } else {
          rows.push([`  ${ex.name}`, ex.sets, ex.reps, ex.weight || '', ex.unit || 'kg', ex.notes || ''])
        }
      }
    }
    rows.push([])
  }
  
  return exportExcel(rows, `rutina_semana${routine.week}`)
}

// ── NUTRITION EXCEL ───────────────────────────────────────────
export function nutritionToExcel(plan: any, playerName: string) {
  const headers = ['Pasto', 'Alimento', 'Quantità', 'Calorie', 'Proteine (g)', 'Carboidrati (g)', 'Grassi (g)']
  const rows: any[][] = [
    [`PIANO NUTRIZIONALE — ${playerName}`],
    [`Obiettivo: ${plan.targetCalories} kcal | P:${plan.targetProtein}g C:${plan.targetCarbs}g G:${plan.targetFat}g`],
    [],
    headers,
  ]
  
  for (const meal of plan.meals || []) {
    for (const item of meal.items || []) {
      rows.push([meal.type, item.name, item.quantity, item.calories, item.protein, item.carbs, item.fat])
    }
  }
  
  return exportExcel(rows, `nutricion_${playerName.replace(/ /g,'_')}`)
}

// ── LESIONES EXCEL ────────────────────────────────────────────
export function lesionesToExcel(lesiones: any[]) {
  const headers = ['Giocatore', 'Zona', 'Descrizione', 'Data infortunio', 'Dimissione prevista', 'Dimissione effettiva', 'Stato', 'Meccanismo', 'Trattamento']
  const rows = lesiones.map(l => [
    l.playerName, l.zona, l.descripcion,
    l.fechaLesion, l.fechaAltaEstimada || '', l.fechaAltaReal || '',
    l.estado, l.mecanismo || '', l.tratamiento || '',
  ])
  return exportExcel([headers, ...rows], 'lesiones_brc')
}

// ── PDF ───────────────────────────────────────────────────────
export async function exportPDF(config: {
  title: string
  subtitle?: string
  tables: { head: string[][]; body: any[][]; title?: string }[]
  filename: string
}) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  
  // Header bar
  doc.setFillColor(10, 22, 40) // navy
  doc.rect(0, 0, 210, 28, 'F')
  doc.setFillColor(200, 16, 46) // red
  doc.rect(0, 28, 210, 2, 'F')
  
  // Logo text
  doc.setTextColor(245, 197, 24) // gold
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('RUGBY', 14, 16)
  doc.setTextColor(255, 255, 255)
  doc.text('LAB', 37, 16)
  
  // Title
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 180, 180)
  doc.text('Bologna Rugby Club', 14, 23)
  
  // Right: title
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(config.title.toUpperCase(), 196, 14, { align: 'right' })
  if (config.subtitle) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(180, 180, 180)
    doc.text(config.subtitle, 196, 21, { align: 'right' })
  }
  
  // Date
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text(`Generato: ${new Date().toLocaleDateString('it-IT')}`, 196, 26, { align: 'right' })
  
  let y = 36
  
  for (const table of config.tables) {
    if (table.title) {
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(10, 22, 40)
      doc.text(table.title, 14, y)
      y += 6
    }
    
    autoTable(doc, {
      head: table.head,
      body: table.body,
      startY: y,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 9, cellPadding: 3, lineColor: [220, 226, 236], lineWidth: 0.3 },
      headStyles: { fillColor: [10, 22, 40], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 249, 252] },
      columnStyles: {},
    })
    
    y = (doc as any).lastAutoTable.finalY + 10
  }
  
  // Footer
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFillColor(10, 22, 40)
    doc.rect(0, 287, 210, 10, 'F')
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text('RugbyLab · Bologna Rugby Club', 14, 293)
    doc.text(`Pagina ${i} di ${pages}`, 196, 293, { align: 'right' })
  }
  
  doc.save(`${config.filename}.pdf`)
}

// ── STATISTICS PDF ────────────────────────────────────────────
export function matchStatsToPDF(match: any) {
  return exportPDF({
    title: `vs ${match.rival}`,
    subtitle: `${match.fecha} · ${match.competicion} · ${match.cancha}`,
    filename: `stats_vs_${match.rival.replace(/ /g,'_')}`,
    tables: [
      {
        title: 'Statistiche della squadra',
        head: [['Metrica', 'Valore']],
        body: [
          ['Risultato', `${match.teamStats.puntosAFavor} - ${match.teamStats.puntoEnContra}`],
          ['Mete', `${match.teamStats.triesAFavor} - ${match.teamStats.triesEnContra}`],
          ['Possesso', `${match.teamStats.posesionPct}%`],
          ['Territorio', `${match.teamStats.territorioPct}%`],
          ['Mischia', `${match.teamStats.scrumGanados}/${match.teamStats.scrumTotales}`],
          ['Touche', `${match.teamStats.lineoutGanados}/${match.teamStats.lineoutTotales}`],
          ['Metri', `${match.teamStats.metrosTotales}m`],
          ['Placcaggi', `${match.teamStats.tacklesPct}%`],
          ['Falli', `${match.teamStats.penalesCometidos}`],
          ['Gialli', `${match.teamStats.amarillas}`],
          ['Rossi', `${match.teamStats.rojas}`],
        ],
      },
      {
        title: 'Statistiche per giocatore',
        head: [['Giocatore', 'Min', 'Mete', 'Assist.', 'Metri', 'Passaggi', 'Placcaggi', 'Giall.']],
        body: (match.playerStats || []).map((p: any) => [
          p.playerName, `${p.minutosJugados}'`,
          p.tries, p.asistencias, `${p.metrosGanados}m`,
          `${p.pasesCompletados}/${p.pasesTotales}`,
          `${p.tacklesCompletados}/${p.tacklesTotales}`,
          p.amarillas || '—',
        ]),
      },
    ],
  })
}

// ── LOGISTICA PDF ─────────────────────────────────────────────
export async function logisticaStatsToPDF(teams: any[], players: any[], txList: any[]) {
  // Calculate team scores
  const teamScores = teams.map(t => {
    const pts = txList.filter(tx => tx.teamId === t.id).reduce((a: number, tx: any) => a + (tx.delta || 0), 0)
    return { ...t, points: pts }
  }).sort((a, b) => b.points - a.points)

  // Top players
  const playerMap: Record<string, { name: string; points: number; count: number }> = {}
  txList.forEach(tx => {
    if (!tx.playerId) return
    const p = players.find((x: any) => x.id === tx.playerId)
    if (!playerMap[tx.playerId]) playerMap[tx.playerId] = { name: p?.name || tx.playerId, points: 0, count: 0 }
    playerMap[tx.playerId].points += tx.delta || 0
    playerMap[tx.playerId].count += 1
  })
  const topPlayers = Object.values(playerMap).sort((a, b) => b.points - a.points).slice(0, 20)

  return exportPDF({
    title: 'Fantasy & Puntos',
    subtitle: `Temporada ${new Date().getFullYear()} · Bologna Rugby Club`,
    filename: 'logistica_fantasy_brc',
    tables: [
      {
        title: '🏆 Classifica squadre',
        head: [['Pos.', 'Squadra', 'Punti']],
        body: teamScores.map((t, i) => [`${i + 1}°`, t.name, t.points.toFixed(1)]),
      },
      {
        title: '⭐ Ranking individuale',
        head: [['Pos.', 'Giocatore', 'Punti', 'Eventi']],
        body: topPlayers.map((p, i) => [`${i + 1}°`, p.name, p.points.toFixed(1), p.count]),
      },
    ],
  })
}
