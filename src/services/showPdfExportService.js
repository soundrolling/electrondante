/**
 * showPdfExportService.js
 *
 * Assembles a multi-page "show bible" PDF for one recording day:
 *   - Cover page (project, venue, stage, recording day, timestamp)
 *   - Mic placement image (one page, fitted)
 *   - Signal flow image (one page, fitted)
 *   - Track list (one or more pages, grouped by recorder)
 *
 * Consumers pass pre-rendered PNG data URLs (via the children's
 * getCanvasDataURL() methods) plus the already-fetched signal paths.
 *
 * All sections are optional via the `include` flags so a user can, for
 * example, export just mic placement + track list.
 */

const PAGE_MARGIN_MM = 10
const ACCENT_RGB = [14, 165, 233] // matches --color-primary-500
const TEXT_DARK_RGB = [29, 29, 31]
const TEXT_MUTED_RGB = [109, 109, 112]

function formatTimestamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function drawPageHeader(doc, { title, subtitle, pageLabel }) {
  const pageWidth = doc.internal.pageSize.getWidth()
  // accent rule
  doc.setFillColor(...ACCENT_RGB)
  doc.rect(0, 0, pageWidth, 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...TEXT_DARK_RGB)
  doc.text(title, PAGE_MARGIN_MM, 10)

  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...TEXT_MUTED_RGB)
    doc.text(subtitle, PAGE_MARGIN_MM, 15)
  }

  if (pageLabel) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...TEXT_MUTED_RGB)
    const textWidth = doc.getTextWidth(pageLabel)
    doc.text(pageLabel, pageWidth - PAGE_MARGIN_MM - textWidth, 10)
  }
}

function drawPageFooter(doc, { pageNumber, totalPages, footerText }) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...TEXT_MUTED_RGB)

  if (footerText) {
    doc.text(footerText, PAGE_MARGIN_MM, pageHeight - 6)
  }
  const pageLabel = `${pageNumber} / ${totalPages}`
  const textWidth = doc.getTextWidth(pageLabel)
  doc.text(pageLabel, pageWidth - PAGE_MARGIN_MM - textWidth, pageHeight - 6)
}

function drawCoverPage(doc, meta) {
  const pageWidth = doc.internal.pageSize.getWidth()

  // Accent band
  doc.setFillColor(...ACCENT_RGB)
  doc.rect(0, 0, pageWidth, 40, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.text('Show Bible', PAGE_MARGIN_MM, 24)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  if (meta.recordingDayLabel) {
    doc.text(meta.recordingDayLabel, PAGE_MARGIN_MM, 33)
  }

  let y = 60
  doc.setTextColor(...TEXT_DARK_RGB)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.text(meta.projectName || 'Untitled project', PAGE_MARGIN_MM, y)
  y += 10

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(14)
  doc.setTextColor(...TEXT_MUTED_RGB)
  const venueStageParts = []
  if (meta.venueName) venueStageParts.push(meta.venueName)
  if (meta.stageName) venueStageParts.push(meta.stageName)
  if (venueStageParts.length) {
    doc.text(venueStageParts.join('  ·  '), PAGE_MARGIN_MM, y)
    y += 8
  }

  // Summary stats
  y += 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...TEXT_DARK_RGB)
  doc.text('SUMMARY', PAGE_MARGIN_MM, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...TEXT_DARK_RGB)
  const summaryLines = []
  if (typeof meta.micCount === 'number') summaryLines.push(`Microphones placed: ${meta.micCount}`)
  if (typeof meta.trackCount === 'number') summaryLines.push(`Tracks recorded: ${meta.trackCount}`)
  if (typeof meta.recorderCount === 'number') summaryLines.push(`Recorders: ${meta.recorderCount}`)
  if (typeof meta.connectionCount === 'number') summaryLines.push(`Connections: ${meta.connectionCount}`)
  summaryLines.forEach(line => {
    doc.text(line, PAGE_MARGIN_MM, y)
    y += 6
  })

  // Footer on cover
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...TEXT_MUTED_RGB)
  doc.text(`Generated ${formatTimestamp()}`, PAGE_MARGIN_MM, pageHeight - 12)
  if (meta.appName) {
    const rightText = meta.appName
    const w = doc.getTextWidth(rightText)
    doc.text(rightText, pageWidth - PAGE_MARGIN_MM - w, pageHeight - 12)
  }
}

/**
 * Fit a rasterized PNG into the available area while preserving aspect.
 */
function drawImagePage(doc, dataURL, { title, subtitle, pageLabel, headerOffset = 20 }) {
  drawPageHeader(doc, { title, subtitle, pageLabel })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const availW = pageWidth - PAGE_MARGIN_MM * 2
  const availH = pageHeight - headerOffset - PAGE_MARGIN_MM - 10

  // jsPDF can't read image dimensions synchronously; we pass dataURL and
  // rely on a brief off-DOM Image to measure for aspect-correct fitting.
  // Since this is called in an async wrapper below, we do measurement there.
  const { w, h, x, y } = fitRect(
    dataURL.__w || 1000,
    dataURL.__h || 600,
    availW,
    availH,
    PAGE_MARGIN_MM,
    headerOffset
  )

  doc.addImage(dataURL.url, 'PNG', x, y, w, h, undefined, 'MEDIUM')
}

function fitRect(srcW, srcH, maxW, maxH, originX, originY) {
  const ratio = Math.min(maxW / srcW, maxH / srcH)
  const w = srcW * ratio
  const h = srcH * ratio
  const x = originX + (maxW - w) / 2
  const y = originY + (maxH - h) / 2
  return { w, h, x, y }
}

function measureDataURL(dataURL) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ url: dataURL, __w: img.naturalWidth, __h: img.naturalHeight })
    img.onerror = () => resolve({ url: dataURL, __w: 1000, __h: 600 })
    img.src = dataURL
  })
}

/**
 * Build the track list pages using jsPDF-autotable, grouped per recorder.
 * Mirrors the single-tab Track List export style so the PDFs stay consistent.
 */
function drawTrackListSection(doc, {
  autoTable,
  signalPaths,
  hiddenTrackIds = new Set(),
  includeSignalPath = true,
  title,
  subtitle,
  pageLabelPrefix = 'Track list',
  getTrackId,
  reversedPath,
  compareTrackNumbers,
}) {
  // Build grouped data excluding hidden tracks
  const groups = {}
  ;(signalPaths || []).forEach((p) => {
    const trackId = getTrackId ? getTrackId(p) : `${p.recorder_label || 'Unknown'}::${p.track_number || ''}`
    if (hiddenTrackIds.has(trackId)) return
    const recorderName = p.recorder_label || 'Unknown Recorder'
    if (!groups[recorderName]) groups[recorderName] = []
    groups[recorderName].push(p)
  })
  Object.keys(groups).forEach((recorder) => {
    groups[recorder].sort((a, b) =>
      compareTrackNumbers ? compareTrackNumbers(a.track_number, b.track_number) : 0
    )
  })

  const recorderNames = Object.keys(groups).sort()
  if (!recorderNames.length) {
    doc.addPage()
    drawPageHeader(doc, { title, subtitle, pageLabel: pageLabelPrefix })
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(11)
    doc.setTextColor(...TEXT_MUTED_RGB)
    doc.text('No tracks to export for this recording day.', PAGE_MARGIN_MM, 30)
    return
  }

  recorderNames.forEach((recorderName, idx) => {
    doc.addPage()
    drawPageHeader(doc, {
      title,
      subtitle: `${subtitle ? subtitle + ' · ' : ''}${recorderName}`,
      pageLabel: `${pageLabelPrefix} ${idx + 1}/${recorderNames.length}`,
    })

    const tracks = groups[recorderName]
    const tableHead = ['Track #', 'Source']
    if (includeSignalPath) tableHead.push('Signal path')

    const tableBody = tracks.map((p) => {
      const num = p.track_number || '—'
      const source = p.track_name || p.source_label || '—'
      const row = [String(num), source]
      if (includeSignalPath) {
        const path = reversedPath
          ? reversedPath(p.path).join(' // ')
          : (Array.isArray(p.path) ? [...p.path].reverse().join(' // ') : '')
        row.push(path)
      }
      return row
    })

    autoTable(doc, {
      head: [tableHead],
      body: tableBody,
      startY: 22,
      margin: { left: PAGE_MARGIN_MM, right: PAGE_MARGIN_MM },
      styles: { fontSize: 9, cellPadding: 3, textColor: TEXT_DARK_RGB },
      headStyles: { fillColor: ACCENT_RGB, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      columnStyles: includeSignalPath
        ? { 0: { cellWidth: 18 }, 1: { cellWidth: 50 }, 2: { cellWidth: 'auto' } }
        : { 0: { cellWidth: 24 }, 1: { cellWidth: 'auto' } },
      didDrawPage: (data) => {
        drawPageHeader(doc, {
          title,
          subtitle: `${subtitle ? subtitle + ' · ' : ''}${recorderName}`,
          pageLabel: `${pageLabelPrefix} ${idx + 1}/${recorderNames.length}`,
        })
      },
    })
  })
}

/**
 * Main orchestration.
 *
 * @param {Object} opts
 * @param {Object} opts.meta                { projectName, venueName, stageName, recordingDayLabel, appName, micCount, connectionCount, trackCount, recorderCount }
 * @param {Object} opts.include             { cover, micPlacement, signalFlow, trackList }
 * @param {String} [opts.micPlacementDataURL]
 * @param {String} [opts.signalFlowDataURL]
 * @param {Array}  [opts.signalPaths]       Raw signal paths; passed through to the track-list section.
 * @param {Set}    [opts.hiddenTrackIds]
 * @param {Boolean}[opts.includeSignalPath]
 * @param {Function}[opts.getTrackId]
 * @param {Function}[opts.reversedPath]
 * @param {Function}[opts.compareTrackNumbers]
 *
 * @returns {Promise<jsPDF>}
 */
export async function buildShowPDF(opts) {
  const {
    meta = {},
    include = { cover: true, micPlacement: true, signalFlow: true, trackList: true },
    micPlacementDataURL,
    signalFlowDataURL,
    signalPaths = [],
    hiddenTrackIds = new Set(),
    includeSignalPath = true,
    getTrackId,
    reversedPath,
    compareTrackNumbers,
  } = opts

  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'landscape',
    compress: true,
  })

  const title = [meta.projectName, meta.venueName, meta.stageName].filter(Boolean).join(' · ')
  const subtitle = meta.recordingDayLabel || ''

  let pageCount = 0

  // 1. Cover
  if (include.cover) {
    drawCoverPage(doc, meta)
    pageCount++
  } else {
    // jsPDF always starts with one page; discard it if cover is skipped
  }

  // 2. Mic placement
  if (include.micPlacement && micPlacementDataURL) {
    const measured = await measureDataURL(micPlacementDataURL)
    if (pageCount > 0 || include.cover) doc.addPage()
    else {
      // first page reuse
    }
    drawImagePage(doc, measured, {
      title: title || 'Mic placement',
      subtitle,
      pageLabel: 'Mic placement',
    })
    pageCount++
  }

  // 3. Signal flow
  if (include.signalFlow && signalFlowDataURL) {
    const measured = await measureDataURL(signalFlowDataURL)
    if (pageCount > 0) doc.addPage()
    drawImagePage(doc, measured, {
      title: title || 'Signal flow',
      subtitle,
      pageLabel: 'Signal flow',
    })
    pageCount++
  }

  // 4. Track list (adds its own pages)
  if (include.trackList) {
    drawTrackListSection(doc, {
      autoTable,
      signalPaths,
      hiddenTrackIds,
      includeSignalPath,
      title: title || 'Track list',
      subtitle,
      pageLabelPrefix: 'Track list',
      getTrackId,
      reversedPath,
      compareTrackNumbers,
    })
  }

  // Page numbers / footer across all pages
  const totalPages = doc.internal.getNumberOfPages()
  const footerText = meta.appName ? `${meta.appName}${subtitle ? ' · ' + subtitle : ''}` : (subtitle || '')
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    if (i === 1 && include.cover) continue // skip on cover
    drawPageFooter(doc, { pageNumber: i, totalPages, footerText })
  }

  return doc
}

/**
 * Build a safe filename stem from meta + recording day.
 */
export function defaultShowBibleFilename(meta) {
  const parts = [
    meta.projectName,
    meta.venueName,
    meta.stageName,
    meta.recordingDayLabel,
    'show-bible',
  ]
    .filter(Boolean)
    .map(s => String(s).trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase())
    .filter(Boolean)
  return (parts.join('-') || 'show-bible').slice(0, 80)
}
