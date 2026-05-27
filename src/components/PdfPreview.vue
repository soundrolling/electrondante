<template>
  <div class="pdf-preview">
    <div v-if="loading" class="pdf-status">
      <div class="pdf-spinner"></div>
      <p>Loading PDF…</p>
    </div>

    <div v-else-if="error" class="pdf-status pdf-error">
      <p>⚠️ Couldn't render this PDF in-browser.</p>
      <p class="pdf-error-detail">{{ error }}</p>
      <a :href="src" target="_blank" rel="noopener" class="pdf-fallback-link">
        Open in new tab
      </a>
    </div>

    <template v-else>
      <div class="pdf-toolbar">
        <div class="pdf-toolbar-group">
          <button
            class="pdf-toolbar-btn"
            :disabled="scale <= MIN_SCALE"
            @click="zoomOut"
            title="Zoom out"
            aria-label="Zoom out"
          >−</button>
          <span class="pdf-scale">{{ Math.round(scale * 100) }}%</span>
          <button
            class="pdf-toolbar-btn"
            :disabled="scale >= MAX_SCALE"
            @click="zoomIn"
            title="Zoom in"
            aria-label="Zoom in"
          >+</button>
          <button
            class="pdf-toolbar-btn"
            @click="fitWidth"
            title="Fit width"
            aria-label="Fit width"
          >⤢</button>
        </div>
        <div class="pdf-toolbar-group">
          <span class="pdf-page-count">{{ pageCount }} page{{ pageCount === 1 ? '' : 's' }}</span>
        </div>
      </div>

      <div ref="scrollerRef" class="pdf-scroller">
        <div
          v-for="page in pageCount"
          :key="page"
          class="pdf-page-wrap"
        >
          <canvas
            :ref="el => setCanvas(el, page)"
            class="pdf-page-canvas"
          ></canvas>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps({
  src: { type: String, required: true }
})

const MIN_SCALE = 0.5
const MAX_SCALE = 3.0
const ZOOM_STEP = 0.25

const loading = ref(true)
const error = ref(null)
const pageCount = ref(0)
const scale = ref(1.25)
const scrollerRef = ref(null)

let pdfDoc = null
let canvases = new Map()
let renderTasks = []
let pdfjsLib = null

function setCanvas(el, pageNum) {
  if (el) canvases.set(pageNum, el)
  else canvases.delete(pageNum)
}

async function getPdfjs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString()
  }
  return pdfjsLib
}

async function loadPdf() {
  loading.value = true
  error.value = null
  cancelRenders()
  try {
    const lib = await getPdfjs()
    const resp = await fetch(props.src)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.arrayBuffer()
    const doc = await lib.getDocument({ data }).promise
    pdfDoc = doc
    pageCount.value = doc.numPages
    loading.value = false
    await nextTick()
    await renderAllPages()
  } catch (e) {
    console.error('PDF load error:', e)
    error.value = e.message || 'Failed to load PDF'
    loading.value = false
  }
}

function cancelRenders() {
  for (const task of renderTasks) {
    try { task.cancel() } catch {}
  }
  renderTasks = []
}

async function renderPage(pageNum) {
  if (!pdfDoc) return
  const canvas = canvases.get(pageNum)
  if (!canvas) return
  try {
    const page = await pdfDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale: scale.value * (window.devicePixelRatio || 1) })
    const cssViewport = page.getViewport({ scale: scale.value })
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    canvas.style.width = `${Math.ceil(cssViewport.width)}px`
    canvas.style.height = `${Math.ceil(cssViewport.height)}px`
    const ctx = canvas.getContext('2d')
    const task = page.render({ canvasContext: ctx, viewport })
    renderTasks.push(task)
    await task.promise
  } catch (e) {
    if (e?.name !== 'RenderingCancelledException') {
      console.warn(`Failed to render page ${pageNum}:`, e)
    }
  }
}

async function renderAllPages() {
  cancelRenders()
  for (let i = 1; i <= pageCount.value; i++) {
    await renderPage(i)
  }
}

function zoomIn() {
  scale.value = Math.min(MAX_SCALE, +(scale.value + ZOOM_STEP).toFixed(2))
}

function zoomOut() {
  scale.value = Math.max(MIN_SCALE, +(scale.value - ZOOM_STEP).toFixed(2))
}

function fitWidth() {
  if (!scrollerRef.value || !pdfDoc) return
  pdfDoc.getPage(1).then(page => {
    const viewport = page.getViewport({ scale: 1 })
    const available = scrollerRef.value.clientWidth - 32
    if (available > 0) {
      scale.value = +(available / viewport.width).toFixed(2)
    }
  })
}

watch(scale, () => {
  if (pdfDoc) renderAllPages()
})

watch(() => props.src, () => loadPdf())

onMounted(() => {
  loadPdf()
})

onBeforeUnmount(() => {
  cancelRenders()
  if (pdfDoc) {
    try { pdfDoc.destroy() } catch {}
    pdfDoc = null
  }
  canvases.clear()
})
</script>

<style scoped>
.pdf-preview {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--bg-secondary, #f1f5f9);
}

.pdf-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 12px;
  padding: 32px;
  color: var(--text-secondary, #64748b);
  text-align: center;
}

.pdf-error-detail {
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
  margin: 0;
}

.pdf-fallback-link {
  margin-top: 8px;
  padding: 8px 16px;
  background: #0066cc;
  color: #fff !important;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 500;
}

.pdf-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--bg-tertiary, #e2e8f0);
  border-top-color: var(--color-primary-500, #3b82f6);
  border-radius: 50%;
  animation: pdf-spin 0.8s linear infinite;
}

@keyframes pdf-spin {
  to { transform: rotate(360deg); }
}

.pdf-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-primary, #fff);
  border-bottom: 1px solid var(--border-light, #e2e8f0);
  gap: 12px;
  flex-wrap: wrap;
}

.pdf-toolbar-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pdf-toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 10px;
  background: var(--bg-secondary, #f1f5f9);
  color: var(--text-primary, #0f172a);
  border: 1px solid var(--border-medium, #cbd5e1);
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: background 0.15s;
}

.pdf-toolbar-btn:hover:not(:disabled) {
  background: var(--bg-tertiary, #e2e8f0);
}

.pdf-toolbar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pdf-scale,
.pdf-page-count {
  font-size: 0.8125rem;
  color: var(--text-secondary, #64748b);
  min-width: 48px;
  text-align: center;
}

.pdf-scroller {
  flex: 1;
  overflow: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  -webkit-overflow-scrolling: touch;
}

.pdf-page-wrap {
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  max-width: 100%;
}

.pdf-page-canvas {
  display: block;
  max-width: 100%;
  height: auto;
}
</style>
