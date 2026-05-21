// Renders a single PDF page to a PNG File so the rest of the upload pipeline
// (Supabase storage + <img> background) can stay image-only. Lazy-loads
// pdfjs-dist to keep ~785 kB off the initial bundle.

let _pdfjsLib = null
async function getPdfjsLib() {
  if (!_pdfjsLib) {
    _pdfjsLib = await import('pdfjs-dist')
    _pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString()
  }
  return _pdfjsLib
}

export function isPdfFile(file) {
  if (!file) return false
  if (file.type === 'application/pdf') return true
  const name = (file.name || '').toLowerCase()
  return name.endsWith('.pdf')
}

export async function getPdfPageCount(file) {
  const pdfjsLib = await getPdfjsLib()
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const count = pdf.numPages
  try { await pdf.destroy() } catch {}
  return count
}

// Renders `pageNumber` (1-indexed) of `file` to a PNG File.
// `scale` controls render resolution — 2.5 is a good balance between
// crispness when zoomed-in and reasonable upload size for floor plans.
export async function pdfPageToPngFile(file, pageNumber = 1, scale = 2.5) {
  const pdfjsLib = await getPdfjsLib()
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  try {
    const idx = Math.min(Math.max(1, pageNumber | 0), pdf.numPages)
    const page = await pdf.getPage(idx)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport }).promise
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Failed to encode PDF page as PNG'))),
        'image/png'
      )
    })
    const baseName = (file.name || 'document').replace(/\.pdf$/i, '')
    const outName = pdf.numPages > 1 ? `${baseName}-p${idx}.png` : `${baseName}.png`
    return new File([blob], outName, { type: 'image/png' })
  } finally {
    try { await pdf.destroy() } catch {}
  }
}
