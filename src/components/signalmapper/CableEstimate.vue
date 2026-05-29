<!--
  CableEstimate — the Signal Mapper "Cabling" tab.

  Renders the stage floor plan + placed nodes read-only and draws each
  signal-flow connection as a measured cable run, as a layer you can toggle and
  filter to keep the map clean. A one-time calibration (draw a known distance →
  type its length) sets the scale; the bill-of-materials panel rolls everything
  up. The compute lives in useCableEstimate; persistence in useCableCalibration.

  Reuses the Mic Placement canvas composables (background image + view/coords +
  pan/zoom) so the floor plan and node positions line up exactly with the editor.
-->
<template>
  <div class="cable-estimate">
    <!-- Toolbar -->
    <div class="ce-toolbar">
      <div class="ce-toolbar-group">
        <button
          v-if="!cal.isCalibrating.value"
          class="ce-btn ce-btn-primary"
          @click="cal.startCalibration()"
        >
          <Ruler :size="15" :stroke-width="2" />
          {{ cal.isCalibrated.value ? 'Re-calibrate' : 'Calibrate scale' }}
        </button>
        <button v-else class="ce-btn ce-btn-secondary" @click="cal.cancelCalibration()">
          Cancel calibration
        </button>

        <span v-if="cal.isCalibrated.value && !cal.isCalibrating.value" class="ce-scale-chip" :class="{ stale: cal.isStale.value }">
          <CheckCircle2 v-if="!cal.isStale.value" :size="13" :stroke-width="2.5" />
          <AlertTriangle v-else :size="13" :stroke-width="2.5" />
          {{ cal.isStale.value ? 'Scale may be stale — floor plan changed' : `Scale: ${calibrationLabel}` }}
        </span>
      </div>

      <div class="ce-toolbar-group ce-toolbar-right">
        <label class="ce-toggle">
          <input type="checkbox" v-model="showCableLayer" />
          <span>Cable runs</span>
        </label>
        <label class="ce-toggle">
          <input type="checkbox" v-model="showLengths" :disabled="!showCableLayer || !estimate.calibrated" />
          <span>Lengths</span>
        </label>

        <div class="ce-unit-toggle" role="group" aria-label="Display unit">
          <button :class="['ce-unit-btn', { active: displayUnit === 'm' }]" @click="displayUnit = 'm'">m</button>
          <button :class="['ce-unit-btn', { active: displayUnit === 'ft' }]" @click="displayUnit = 'ft'">ft</button>
        </div>

        <div class="ce-zoom">
          <button class="ce-icon-btn" title="Zoom out" @click="zoomBy(1 / 1.2)"><Minus :size="16" /></button>
          <button class="ce-icon-btn" title="Reset view" @click="resetView"><Maximize :size="15" /></button>
          <button class="ce-icon-btn" title="Zoom in" @click="zoomBy(1.2)"><Plus :size="16" /></button>
        </div>
      </div>
    </div>

    <!-- Category filter / legend (only categories actually present) -->
    <div v-if="showCableLayer && presentCategories.length" class="ce-legend">
      <button
        v-for="key in presentCategories"
        :key="key"
        :class="['ce-legend-pill', { off: !isCatActive(key) }]"
        @click="toggleCategory(key)"
      >
        <span class="ce-swatch" :style="{ background: CATEGORY_META[key].color }"></span>
        {{ CATEGORY_META[key].label }}
      </button>
    </div>

    <!-- Canvas -->
    <div ref="canvasWrapperRef" class="ce-canvas-wrap">
      <canvas
        ref="canvasRef"
        :style="canvasStyle"
        :class="{ calibrating: cal.isCalibrating.value }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointerleave="onPointerUp"
        @wheel="onWheel"
      />
      <div v-if="!bgImage" class="ce-overlay-msg">
        No floor plan for this stage yet. Upload one in the <strong>Mic Placement</strong> tab first.
      </div>
      <div v-else-if="cal.isCalibrating.value" class="ce-overlay-msg ce-hint">
        {{ cal.draftP1.value ? 'Click the second point of a known distance' : 'Click the first point of a known distance' }}
      </div>
    </div>

    <p class="ce-tip">Tip: click a mic or stagebox to set its height (e.g. up a tower) — it's added to the cable run.</p>

    <!-- Bill of materials -->
    <CableEstimateBomPanel :estimate="estimate" />

    <CableCalibrateModal
      :show="cal.showModal.value"
      :busy="cal.saving.value"
      :default-unit="displayUnit"
      @confirm="onConfirmCalibration"
      @cancel="cal.cancelCalibration()"
    />

    <CableHeightModal
      :show="showHeightModal"
      :busy="heightSaving"
      :label="heightTargetLabel"
      :unit="displayUnit"
      :current-value="heightTargetValue"
      @confirm="onConfirmHeight"
      @clear="onClearHeight"
      @cancel="closeHeightModal"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Ruler, CheckCircle2, AlertTriangle, Plus, Minus, Maximize } from 'lucide-vue-next'

import { useToast } from 'vue-toastification'

import CableEstimateBomPanel from './cableestimate/CableEstimateBomPanel.vue'
import CableCalibrateModal from './cableestimate/CableCalibrateModal.vue'
import CableHeightModal from './cableestimate/CableHeightModal.vue'

import { useMicBackgroundImage } from '@/composables/micPlacement/useMicBackgroundImage'
import { useMicCanvasView } from '@/composables/micPlacement/useMicCanvasView'
import { useCableCalibration } from '@/composables/cableEstimate/useCableCalibration'
import { useCableEstimate, nodeKind, hasPosition, heightMetres } from '@/composables/cableEstimate/useCableEstimate'
import { setNodeHeight } from '@/services/cableEstimateService'

const props = defineProps({
  projectId: { type: [String, Number], required: true },
  locationId: { type: [String, Number], default: null },
  stageHourId: { type: [String, Number], default: null },
  nodes: { type: Array, default: () => [] },        // all nodes (need stagebox/recorder positions)
  connections: { type: Array, default: () => [] },  // signal-flow connections
  gearList: { type: Array, default: () => [] },
  stageName: { type: String, default: null },
})

const emit = defineEmits(['node-updated'])

// ── Run-type styling (line colours + filter legend) ──────────
const CATEGORY_META = {
  tail:   { label: 'Mic → box', color: '#3b82f6', width: 2 },
  trunk:  { label: 'Box → rec', color: '#8b5cf6', width: 3.5 },
  direct: { label: 'Mic → rec', color: '#f59e0b', width: 2 },
  link:   { label: 'Box → box', color: '#64748b', width: 2 },
  other:  { label: 'Other',     color: '#94a3b8', width: 1.5 },
}

// ── UI state ─────────────────────────────────────────────────
const canvasWrapperRef = ref(null)
const canvasRef = ref(null)
const isMobile = ref(false)
const showCableLayer = ref(true)
const showLengths = ref(true)
const displayUnit = ref('m')
const activeCategories = ref(new Set(['tail', 'trunk', 'direct', 'link', 'other']))

const toast = useToast()
const M_TO_FT = 3.280839895
const toDisplay = (metres) => (displayUnit.value === 'ft' ? metres * M_TO_FT : metres)
const fromDisplay = (value) => (displayUnit.value === 'ft' ? value / M_TO_FT : value)

// Height editor (set a node's elevation — e.g. a mic up a tower)
const showHeightModal = ref(false)
const heightSaving = ref(false)
const heightTarget = ref(null)
const heightTargetLabel = computed(() => heightTarget.value?.track_name || heightTarget.value?.label || '')
const heightTargetValue = computed(() => {
  const h = heightMetres(heightTarget.value)
  return h > 0 ? round1(toDisplay(h)) : null
})

// Forward-declared redraw so the view composable can call back into the draw
// loop without a construction-order cycle (mirrors MicPlacement.vue).
let _redraw = () => {}
const redraw = () => _redraw()

// 1. Background image (same storage path as Mic Placement)
const bg = useMicBackgroundImage({
  getProjectId: () => props.projectId,
  getLocationId: () => props.locationId,
  getCanvasWidth: () => canvasWidth.value,
  getCanvasHeight: () => canvasHeight.value,
  getIsMobile: () => isMobile.value,
  redraw,
})
const { bgImage, bgImageObj, imageOffsetX, imageOffsetY, scaleFactor, storagePathForStage, loadImageState, fitImageToCanvas } = bg

// 2. Canvas view + coordinate transforms + zoom
const view = useMicCanvasView({
  canvasWrapperRef,
  canvasRef,
  bgImageObj,
  imageOffsetX,
  imageOffsetY,
  scaleFactor,
  getProjectId: () => props.projectId,
  getLocationId: () => props.locationId,
  redraw,
})
const {
  dpr, canvasWidth, canvasHeight, canvasStyle,
  canvasToImageCoords, imageToCanvasCoords, getCanvasCoords,
  applyZoom, updateCanvasSize,
} = view

// 3. Calibration (state + persistence + draw-line interaction)
const cal = useCableCalibration({
  getLocationId: () => props.locationId,
  getImageRef: () => storagePathForStage(),
})

const imageNaturalSize = computed(() =>
  bgImageObj.value ? { width: bgImageObj.value.width, height: bgImageObj.value.height } : null,
)
const options = computed(() => ({ slackFactor: 1.15, roundUpToStock: true, displayUnit: displayUnit.value }))

// 4. The estimate (recomputes on nodes/connections/calibration/scale/options)
const estimateRef = useCableEstimate({
  nodes: computed(() => props.nodes),
  connections: computed(() => props.connections),
  calibration: cal.calibration,
  imageNaturalSize,
  options,
})
const estimate = computed(() => estimateRef.value)

const presentCategories = computed(() => Object.keys(estimate.value.totals.byCategory || {}))
const calibrationLabel = computed(() => {
  const c = cal.calibration.value
  return c ? `${c.realLength} ${c.unit} reference` : ''
})

function isCatActive(key) {
  return activeCategories.value.has(key)
}
function toggleCategory(key) {
  const next = new Set(activeCategories.value)
  next.has(key) ? next.delete(key) : next.add(key)
  activeCategories.value = next
  redraw()
}

// ── Drawing ──────────────────────────────────────────────────
const round1 = (v) => Math.round(v * 10) / 10

function drawPill(ctx, text, x, y, { bg: bgCol = 'rgba(255,255,255,0.92)', fg = '#1f2937', font = 'bold 11px sans-serif' } = {}) {
  ctx.font = font
  const w = Math.ceil(ctx.measureText(text).width) + 10
  const h = 16
  ctx.fillStyle = bgCol
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.rect(x - w / 2, y - h / 2, w, h)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
}

function drawRuns(ctx) {
  const est = estimate.value
  for (const run of est.runs) {
    if (!activeCategories.value.has(run.category)) continue
    const a = imageToCanvasCoords(run.from.x, run.from.y)
    const b = imageToCanvasCoords(run.to.x, run.to.y)
    const style = CATEGORY_META[run.category] || CATEGORY_META.other
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.strokeStyle = style.color
    ctx.lineWidth = style.width
    ctx.stroke()
    if (showLengths.value && run.length != null) {
      drawPill(ctx, `${round1(run.length)} ${est.unit}`, (a.x + b.x) / 2, (a.y + b.y) / 2)
    }
  }
}

function drawNode(ctx, node) {
  const { x, y } = imageToCanvasCoords(Number(node.x), Number(node.y))
  const kind = nodeKind(node)
  ctx.save()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#ffffff'
  if (kind === 'source') {
    ctx.beginPath()
    ctx.arc(x, y, 6, 0, 2 * Math.PI)
    ctx.fillStyle = '#10b981'
    ctx.fill()
    ctx.stroke()
  } else if (kind === 'transformer') {
    ctx.fillStyle = '#3b82f6'
    ctx.beginPath()
    ctx.rect(x - 8, y - 8, 16, 16)
    ctx.fill()
    ctx.stroke()
    drawPill(ctx, labelOf(node), x, y + 18)
  } else if (kind === 'recorder') {
    ctx.fillStyle = '#1f2937'
    ctx.beginPath()
    ctx.moveTo(x, y - 9)
    ctx.lineTo(x + 11, y)
    ctx.lineTo(x, y + 9)
    ctx.lineTo(x - 11, y)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    drawPill(ctx, labelOf(node), x, y + 19)
  } else {
    ctx.beginPath()
    ctx.arc(x, y, 5, 0, 2 * Math.PI)
    ctx.fillStyle = '#94a3b8'
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()

  // Elevation badge (e.g. a mic up a tower).
  const h = heightMetres(node)
  if (h > 0) {
    drawPill(ctx, `▲ ${round1(toDisplay(h))}${displayUnit.value}`, x, y - 16, { bg: '#f59e0b', fg: '#fff', font: 'bold 10px sans-serif' })
  }
}

function labelOf(node) {
  return node.track_name || node.label || node.gear_name || ''
}

function drawCalibration(ctx) {
  const c = cal.calibration.value
  // Saved reference line (subtle dashed teal).
  if (!cal.isCalibrating.value && c?.p1 && c?.p2 && Number(c.realLength) > 0) {
    const a = imageToCanvasCoords(c.p1.x, c.p1.y)
    const b = imageToCanvasCoords(c.p2.x, c.p2.y)
    ctx.save()
    ctx.strokeStyle = '#14b8a6'
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    ctx.setLineDash([])
    drawCalEndpoint(ctx, a); drawCalEndpoint(ctx, b)
    drawPill(ctx, `${c.realLength} ${c.unit}`, (a.x + b.x) / 2, (a.y + b.y) / 2, { bg: '#14b8a6', fg: '#fff' })
    ctx.restore()
  }
  // In-progress line while calibrating.
  if (cal.isCalibrating.value && cal.draftP1.value) {
    const a = imageToCanvasCoords(cal.draftP1.value.x, cal.draftP1.value.y)
    const endPt = cal.draftP2.value || cursorImg.value
    ctx.save()
    ctx.strokeStyle = '#0ea5e9'
    ctx.lineWidth = 2
    if (endPt) {
      const b = imageToCanvasCoords(endPt.x, endPt.y)
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      drawCalEndpoint(ctx, b)
    }
    drawCalEndpoint(ctx, a)
    ctx.restore()
  }
}

function drawCalEndpoint(ctx, p) {
  ctx.beginPath()
  ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI)
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#0ea5e9'
  ctx.lineWidth = 2
  ctx.fill()
  ctx.stroke()
}

function drawCableCanvas() {
  const ctx = canvasRef.value?.getContext('2d')
  if (!ctx) return
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvasWidth.value * dpr, canvasHeight.value * dpr)
  ctx.scale(dpr, dpr)

  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvasWidth.value, canvasHeight.value)

  if (bgImageObj.value) {
    ctx.drawImage(
      bgImageObj.value,
      imageOffsetX.value,
      imageOffsetY.value,
      bgImageObj.value.width * scaleFactor.value,
      bgImageObj.value.height * scaleFactor.value,
    )
  }

  if (showCableLayer.value) drawRuns(ctx)

  for (const node of props.nodes) {
    if (hasPosition(node)) drawNode(ctx, node)
  }

  drawCalibration(ctx)
}
_redraw = drawCableCanvas

// ── Pointer interaction (pan / zoom / calibration clicks) ────
const cursorImg = ref(null)
let panning = false
let lastPan = null

function onPointerDown(e) {
  try { canvasRef.value?.setPointerCapture?.(e.pointerId) } catch {}
  const cc = getCanvasCoords(e)
  if (cal.isCalibrating.value) {
    const img = canvasToImageCoords(cc.x, cc.y)
    cal.addPoint(img.imgX, img.imgY)
    redraw()
    return
  }
  const node = getNodeAtCanvas(cc.x, cc.y)
  if (node) {
    openHeightEditor(node)
    return
  }
  panning = true
  lastPan = cc
}

function onPointerMove(e) {
  if (cal.isCalibrating.value && cal.draftP1.value && !cal.draftP2.value) {
    const cc = getCanvasCoords(e)
    const img = canvasToImageCoords(cc.x, cc.y)
    cursorImg.value = { x: img.imgX, y: img.imgY }
    redraw()
    return
  }
  if (panning && lastPan) {
    const cc = getCanvasCoords(e)
    imageOffsetX.value += cc.x - lastPan.x
    imageOffsetY.value += cc.y - lastPan.y
    lastPan = cc
    redraw()
  }
}

function onPointerUp(e) {
  panning = false
  lastPan = null
  try { canvasRef.value?.releasePointerCapture?.(e.pointerId) } catch {}
}

function onWheel(e) {
  e.preventDefault()
  const cc = getCanvasCoords(e)
  applyZoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, cc.x, cc.y)
}

function zoomBy(factor) {
  applyZoom(factor, canvasWidth.value / 2, canvasHeight.value / 2)
}

function resetView() {
  view.resetImageView({ getNodes: () => props.nodes.filter(hasPosition), fitImageToCanvas })
}

async function onConfirmCalibration(length, unit) {
  await cal.confirm(length, unit)
  displayUnit.value = unit
  redraw()
}

// ── Node height editor (mic towers etc.) ─────────────────────
function getNodeAtCanvas(cx, cy) {
  for (let i = props.nodes.length - 1; i >= 0; i--) {
    const node = props.nodes[i]
    if (!hasPosition(node)) continue
    const p = imageToCanvasCoords(Number(node.x), Number(node.y))
    if (Math.hypot(p.x - cx, p.y - cy) <= 14) return node
  }
  return null
}

function openHeightEditor(node) {
  heightTarget.value = node
  showHeightModal.value = true
}

function closeHeightModal() {
  showHeightModal.value = false
  heightTarget.value = null
}

async function saveHeight(nodeId, metres) {
  heightSaving.value = true
  try {
    const stored = await setNodeHeight(nodeId, metres, props.projectId)
    emit('node-updated', { id: nodeId, height_m: stored })
    closeHeightModal()
    nextTick(redraw)
  } catch (err) {
    toast.error('Could not save height')
  } finally {
    heightSaving.value = false
  }
}

function onConfirmHeight(displayValue) {
  if (!heightTarget.value) return
  saveHeight(heightTarget.value.id, fromDisplay(Number(displayValue)))
}

function onClearHeight() {
  if (!heightTarget.value) return
  saveHeight(heightTarget.value.id, null)
}

// ── Load + lifecycle ─────────────────────────────────────────
function checkScreenSize() {
  isMobile.value = window.innerWidth < 768
}

async function loadStage() {
  await cal.load()
  if (cal.calibration.value?.unit) displayUnit.value = cal.calibration.value.unit
  await loadImageState() // triggers redraw on image load
  nextTick(redraw)
}

onMounted(() => {
  checkScreenSize()
  window.addEventListener('resize', checkScreenSize)
  if (canvasRef.value) {
    canvasRef.value.width = canvasWidth.value * dpr
    canvasRef.value.height = canvasHeight.value * dpr
  }
  updateCanvasSize()
  window.addEventListener('resize', updateCanvasSize)
  loadStage()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkScreenSize)
  window.removeEventListener('resize', updateCanvasSize)
})

// Reload when the stage changes (defensive — parent usually remounts via :key).
watch(() => props.locationId, () => { loadStage() })

// Redraw on any data / display change.
watch(estimate, () => nextTick(redraw))
watch([showCableLayer, showLengths, displayUnit], () => nextTick(redraw))
</script>

<style scoped>
.cable-estimate { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
@media (max-width: 600px) { .cable-estimate { padding: 10px; } }

.ce-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}
.ce-toolbar-group { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ce-toolbar-right { margin-left: auto; }

.ce-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 12px; border-radius: var(--radius-md);
  border: 1px solid transparent; cursor: pointer; font-weight: 500; font-size: 13px;
}
.ce-btn-primary { background: var(--color-primary-500); color: #fff; border-color: var(--color-primary-600); }
.ce-btn-primary:hover { background: var(--color-primary-600); }
.ce-btn-secondary { background: var(--color-secondary-500); color: #fff; border-color: var(--color-secondary-600); }
.ce-btn-secondary:hover { background: var(--color-secondary-600); }

.ce-scale-chip {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--color-success-700, #047857);
  background: var(--color-success-100, #d1fae5);
  border-radius: 999px; padding: 4px 10px;
}
.ce-scale-chip.stale { color: var(--color-warning-700, #b45309); background: var(--color-warning-100, #fef3c7); }

.ce-toggle { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; color: var(--text-secondary); cursor: pointer; }
.ce-toggle input { cursor: pointer; }

.ce-unit-toggle { display: inline-flex; }
.ce-unit-btn {
  padding: 6px 10px; border: 1px solid var(--surface-border); background: var(--surface-card);
  color: var(--text-secondary); cursor: pointer; font-size: 12px; min-width: 34px;
}
.ce-unit-btn:first-child { border-radius: var(--radius-md) 0 0 var(--radius-md); }
.ce-unit-btn:last-child { border-radius: 0 var(--radius-md) var(--radius-md) 0; border-left: none; }
.ce-unit-btn.active { background: var(--color-primary-500); color: #fff; border-color: var(--color-primary-600); }

.ce-zoom { display: inline-flex; gap: 4px; }
.ce-icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: var(--radius-md);
  border: 1px solid var(--surface-border); background: var(--surface-card);
  color: var(--text-secondary); cursor: pointer;
}
.ce-icon-btn:hover { background: var(--bg-secondary); }

.ce-legend { display: flex; flex-wrap: wrap; gap: 6px; }
.ce-legend-pill {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; padding: 3px 10px; border-radius: 999px;
  border: 1px solid var(--surface-border); background: var(--surface-card);
  color: var(--text-primary); cursor: pointer;
}
.ce-legend-pill.off { opacity: 0.4; }
.ce-swatch { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }

.ce-canvas-wrap { position: relative; width: 100%; }
.ce-canvas-wrap canvas.calibrating { cursor: crosshair; }
.ce-overlay-msg {
  position: absolute; left: 50%; top: 16px; transform: translateX(-50%);
  background: rgba(15,23,42,0.82); color: #fff; padding: 8px 14px;
  border-radius: var(--radius-md); font-size: 13px; max-width: 90%; text-align: center;
  pointer-events: none;
}
.ce-overlay-msg.ce-hint { background: rgba(14,165,233,0.92); }

.ce-tip { font-size: 12px; color: var(--text-secondary); margin: 0; }
</style>
