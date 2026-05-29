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
        <template v-if="cal.isCalibrating.value">
          <button
            class="ce-btn ce-btn-primary"
            :disabled="cal.draftRefs.value.length === 0 || cal.saving.value"
            @click="onFinishCalibration"
          >
            {{ cal.saving.value ? 'Saving…' : `Done (${cal.draftRefs.value.length})` }}
          </button>
          <button class="ce-btn ce-btn-secondary" @click="cal.cancelCalibration()">Cancel</button>
          <span class="ce-scale-chip">{{ draftScaleText }}</span>
        </template>
        <template v-else>
          <button class="ce-btn ce-btn-primary" @click="cal.startCalibration()">
            <Ruler :size="15" :stroke-width="2" />
            {{ cal.isCalibrated.value ? 'Re-calibrate' : 'Calibrate scale' }}
          </button>
          <span v-if="cal.isCalibrated.value" class="ce-scale-chip" :class="{ stale: cal.isStale.value }">
            <CheckCircle2 v-if="!cal.isStale.value" :size="13" :stroke-width="2.5" />
            <AlertTriangle v-else :size="13" :stroke-width="2.5" />
            {{ cal.isStale.value ? 'Scale may be stale — floor plan changed' : `Scale: ${calibrationLabel}` }}
          </span>
        </template>
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
        <label class="ce-toggle">
          <input type="checkbox" v-model="showLabels" />
          <span>Labels</span>
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

        <button class="ce-icon-btn" title="Reset cabling layout (positions + turning points)" @click="onResetLayout"><RotateCcw :size="15" /></button>
        <button class="ce-icon-btn" :class="{ active: showSettings }" title="Cable length settings (slack % + rounding)" @click="showSettings = !showSettings"><Settings :size="15" /></button>
      </div>
    </div>

    <!-- Length settings -->
    <div v-if="showSettings" class="ce-settings">
      <label class="ce-setting">
        <span>Extra slack</span>
        <span class="ce-setting-input"><input type="number" min="0" step="1" v-model.number="slackPercent" /> %</span>
      </label>
      <label class="ce-setting">
        <span>Round up to nearest</span>
        <span class="ce-setting-input"><input type="number" min="0" step="1" v-model.number="roundStep" /> {{ displayUnit }}</span>
      </label>
      <label class="ce-setting">
        <span>Max single cable</span>
        <span class="ce-setting-input"><input type="number" min="0" step="1" v-model.number="maxSingle" /> {{ displayUnit }}</span>
      </label>
      <span class="ce-setting-hint">Each run = exact × (1 + %), rounded up, then split into cables no longer than the max (0 = no split / no round).</span>
    </div>

    <!-- Destination filter / legend — one pill per device the cables run into -->
    <div v-if="showCableLayer && destinations.length" class="ce-legend">
      <button
        v-for="d in destinations"
        :key="d.id"
        :class="['ce-legend-pill', { off: !isDestActive(d.id) }]"
        @click="toggleDest(d.id)"
      >
        <span class="ce-swatch" :style="{ background: d.color }"></span>
        → {{ d.label }}
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
        @dblclick="onDblClick"
        @wheel="onWheel"
      />
      <div v-if="!bgImage" class="ce-overlay-msg">
        No floor plan for this stage yet. Upload one in the <strong>Mic Placement</strong> tab first.
      </div>
      <div v-else-if="cal.isCalibrating.value" class="ce-overlay-msg ce-hint">
        {{ cal.draftP1.value ? 'Click the second point' : 'Click two points of a known distance — add several, then Done · double-click a line to remove' }}
      </div>
    </div>

    <p class="ce-tip">Drag a node to reposition it (mic map stays put) · click a node to set its height · click a cable to add a turning point, double-click a point to remove.</p>

    <!-- Bill of materials -->
    <CableEstimateBomPanel :estimate="estimate" />

    <CableCalibrateModal
      :show="cal.showModal.value"
      :busy="cal.saving.value"
      :default-unit="displayUnit"
      @confirm="onConfirmCalibration"
      @cancel="cal.cancelPoint()"
    />

    <CableNodeModal
      :show="showNodeModal"
      :busy="nodeSaving"
      :label="nodeTargetLabel"
      :unit="displayUnit"
      :current-value="nodeTargetValue"
      :cables="nodeTargetCables"
      @save="onSaveNode"
      @cancel="closeNodeModal"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Ruler, CheckCircle2, AlertTriangle, Plus, Minus, Maximize, RotateCcw, Settings } from 'lucide-vue-next'

import { useToast } from 'vue-toastification'

import CableEstimateBomPanel from './cableestimate/CableEstimateBomPanel.vue'
import CableCalibrateModal from './cableestimate/CableCalibrateModal.vue'
import CableNodeModal from './cableestimate/CableNodeModal.vue'

import { useMicBackgroundImage } from '@/composables/micPlacement/useMicBackgroundImage'
import { useMicCanvasView } from '@/composables/micPlacement/useMicCanvasView'
import { useCableCalibration } from '@/composables/cableEstimate/useCableCalibration'
import { useCableLayout } from '@/composables/cableEstimate/useCableLayout'
import { useCableEstimate, nodeKind, hasPosition, heightMetres, effectivePosition, deriveScale } from '@/composables/cableEstimate/useCableEstimate'
import { setNodeHeight, saveCableSummary } from '@/services/cableEstimateService'

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

// ── Run styling ──────────────────────────────────────────────
// Runs are coloured by the device they terminate at; multicore trunks
// (transformer-originated) draw thicker than single tails.
const DEST_PALETTE = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#14b8a6', '#ec4899', '#0ea5e9', '#a16207', '#64748b']
function widthForRun(run) {
  return run.fromKind === 'transformer' ? 3.5 : 2
}

// ── UI state ─────────────────────────────────────────────────
const canvasWrapperRef = ref(null)
const canvasRef = ref(null)
const isMobile = ref(false)
const showCableLayer = ref(true)
const showLengths = ref(true)
const showLabels = ref(true)
const showSettings = ref(false)
const displayUnit = ref('m')
const slackPercent = ref(15) // extra % added to every run
const roundStep = ref(5)     // round each run up to nearest N (display unit); 0 = exact
const maxSingle = ref(20)    // longest single cable; longer runs split into pieces; 0 = don't split
const hiddenDestinations = ref(new Set()) // destination node ids hidden from the layer

const toast = useToast()
const M_TO_FT = 3.280839895
const toDisplay = (metres) => (displayUnit.value === 'ft' ? metres * M_TO_FT : metres)
const fromDisplay = (value) => (displayUnit.value === 'ft' ? value / M_TO_FT : value)

// Node editor: height (e.g. up a tower) + the cable type for each outgoing run.
const showNodeModal = ref(false)
const nodeSaving = ref(false)
const nodeTarget = ref(null)
const nodeTargetLabel = computed(() =>
  nodeTarget.value?.track_name || nodeTarget.value?.label || nodeTarget.value?.gear_name || 'Node',
)
const nodeTargetValue = computed(() => {
  const h = heightMetres(nodeTarget.value)
  return h > 0 ? round1(toDisplay(h)) : null
})
const nodeTargetCables = computed(() => {
  const node = nodeTarget.value
  if (!node) return []
  const byId = {}
  for (const x of props.nodes) byId[x.id] = x
  const runByConn = {}
  for (const r of estimate.value.runs) runByConn[r.connectionId] = r
  return props.connections
    .filter(c => c.from_node_id === node.id)
    .map(c => {
      const run = runByConn[c.id]
      const u = estimate.value.unit
      let lengthText
      let splitText = ''
      if (run && run.length != null) {
        const exact = round1(run.rawLength)
        const order = round1(run.length)
        lengthText = exact === order ? `≈ ${exact} ${u}` : `${exact} ${u} → ${order} ${u}`
        if (run.pieces && run.pieces.length > 1) splitText = `${run.pieces.map(p => round1(p)).join(' + ')} ${u}`
      } else if (run) {
        lengthText = 'calibrate for length'
      } else {
        lengthText = 'destination not on plan'
      }
      return {
        connId: c.id,
        destLabel: labelOf(byId[c.to_node_id]) || 'Next point',
        type: layout.value.cables?.[c.id]?.type || '',
        lengthText,
        splitText,
      }
    })
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

// 3b. Cabling layout — drag overrides + cable waypoints, stored separately
// from mic placement / signal flow.
const cableLayout = useCableLayout({ getLocationId: () => props.locationId })
const layout = cableLayout.layout
const effPos = (node) => effectivePosition(node, layout.value)

const imageNaturalSize = computed(() =>
  bgImageObj.value ? { width: bgImageObj.value.width, height: bgImageObj.value.height } : null,
)
const options = computed(() => ({
  slackFactor: 1 + (Number(slackPercent.value) || 0) / 100,
  roundStep: Number(roundStep.value) || 0,
  maxSingle: Number(maxSingle.value) || 0,
  displayUnit: displayUnit.value,
}))

// 4. The estimate (recomputes on nodes/connections/calibration/scale/options)
const estimateRef = useCableEstimate({
  nodes: computed(() => props.nodes),
  connections: computed(() => props.connections),
  calibration: cal.calibration,
  imageNaturalSize,
  layout,
  options,
})
const estimate = computed(() => estimateRef.value)

// Distinct destination devices among the runs, each with a stable colour.
const destinations = computed(() => {
  const seen = new Map()
  for (const run of estimate.value.runs) {
    if (!seen.has(run.toId)) seen.set(run.toId, run.toLabel)
  }
  const list = [...seen.entries()].map(([id, label]) => ({ id, label: label || 'Device' }))
  list.sort((a, b) => String(a.label).localeCompare(String(b.label)))
  return list.map((d, i) => ({ ...d, color: DEST_PALETTE[i % DEST_PALETTE.length] }))
})
const destColorById = computed(() => {
  const m = {}
  for (const d of destinations.value) m[d.id] = d.color
  return m
})
const calibrationLabel = computed(() => {
  const n = cal.referenceCount.value
  if (!n) return ''
  if (n === 1) {
    const r = cal.savedRefs.value[0]
    return `${r.realLength} ${r.unit || 'm'} reference`
  }
  return `${n} references · ±${Math.round(estimate.value.scaleSpreadPct || 0)}%`
})
const draftScaleText = computed(() => {
  const info = deriveScale({ refs: cal.draftRefs.value }, imageNaturalSize.value)
  if (!info.referenceCount) return 'Draw a known distance'
  const n = info.referenceCount
  return n === 1 ? '1 reference' : `${n} references · ±${Math.round(info.spreadPct)}%`
})

function isDestActive(id) {
  return !hiddenDestinations.value.has(id)
}
function toggleDest(id) {
  const next = new Set(hiddenDestinations.value)
  next.has(id) ? next.delete(id) : next.add(id)
  hiddenDestinations.value = next
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
    if (hiddenDestinations.value.has(run.toId)) continue
    const color = destColorById.value[run.toId] || '#64748b'
    const pts = run.points.map(p => imageToCanvasCoords(p.x, p.y))
    // Polyline through any turning points.
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.strokeStyle = color
    ctx.lineWidth = widthForRun(run)
    ctx.stroke()
    // Length label at the polyline midpoint.
    if (showLengths.value && run.length != null) {
      const mid = polylineMidpoint(pts)
      drawPill(ctx, `${round1(run.length)} ${est.unit}`, mid.x, mid.y)
    }
    // Turning-point handles.
    for (let j = 1; j < pts.length - 1; j++) drawWaypointHandle(ctx, pts[j], color)
  }
}

function drawWaypointHandle(ctx, p, color) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI)
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function polylineMidpoint(pts) {
  // Point at half the total polyline length — nicer than the bounding-box centre.
  const segs = []
  let total = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y)
    segs.push(d); total += d
  }
  let half = total / 2
  for (let i = 0; i < segs.length; i++) {
    if (half <= segs[i] || i === segs.length - 1) {
      const t = segs[i] ? half / segs[i] : 0
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t }
    }
    half -= segs[i]
  }
  return pts[0]
}

function drawNode(ctx, node) {
  const ep = effPos(node)
  const { x, y } = imageToCanvasCoords(ep.x, ep.y)
  const kind = nodeKind(node)
  ctx.save()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#ffffff'
  let labelY = y + 16
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
    labelY = y + 18
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
    labelY = y + 19
  } else {
    ctx.beginPath()
    ctx.arc(x, y, 5, 0, 2 * Math.PI)
    ctx.fillStyle = '#94a3b8'
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()

  // Node name (mic source / gear / venue source), toggleable.
  if (showLabels.value) {
    const name = labelOf(node)
    if (name) drawPill(ctx, name, x, labelY, { font: 'bold 10px sans-serif' })
  }

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
  // Saved references (when idle) or the in-progress drafts (while calibrating).
  const refs = cal.isCalibrating.value ? cal.draftRefs.value : savedRefsForDraw()
  for (const r of refs) drawRefLine(ctx, r)

  // The line currently being drawn.
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

function drawRefLine(ctx, r) {
  if (!r?.p1 || !r?.p2) return
  const a = imageToCanvasCoords(r.p1.x, r.p1.y)
  const b = imageToCanvasCoords(r.p2.x, r.p2.y)
  ctx.save()
  ctx.strokeStyle = '#14b8a6'
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 4])
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
  ctx.setLineDash([])
  drawCalEndpoint(ctx, a); drawCalEndpoint(ctx, b)
  if (Number(r.realLength) > 0) {
    drawPill(ctx, `${r.realLength} ${r.unit || 'm'}`, (a.x + b.x) / 2, (a.y + b.y) / 2, { bg: '#14b8a6', fg: '#fff' })
  }
  ctx.restore()
}

function savedRefsForDraw() {
  const c = cal.calibration.value
  if (!c) return []
  if (Array.isArray(c.refs)) return c.refs
  if (c.p1 && c.p2) return [{ p1: c.p1, p2: c.p2, realLength: c.realLength, unit: c.unit }]
  return []
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

// ── Pointer interaction (drag nodes / waypoints, add waypoints, pan, zoom) ──
const cursorImg = ref(null)
let panning = false
let lastPan = null
let nodePress = null  // { node, moved, start } — distinguishes click (height) from drag (move)
let wpDrag = null     // { connId, index } — waypoint being dragged
const DRAG_THRESHOLD = 4 // canvas px of movement before a node press becomes a drag

function onPointerDown(e) {
  try { canvasRef.value?.setPointerCapture?.(e.pointerId) } catch {}
  const cc = getCanvasCoords(e)

  if (cal.isCalibrating.value) {
    const img = canvasToImageCoords(cc.x, cc.y)
    cal.addPoint(img.imgX, img.imgY)
    redraw()
    return
  }

  // Existing turning point → drag it.
  const wp = getWaypointAtCanvas(cc.x, cc.y)
  if (wp) { wpDrag = wp; return }

  // Node → press (release without moving = height editor; drag = reposition).
  const node = getNodeAtCanvas(cc.x, cc.y)
  if (node) { nodePress = { node, moved: false, start: cc }; return }

  // Cable segment → drop a turning point there and start dragging it.
  const seg = getCableSegmentAtCanvas(cc.x, cc.y)
  if (seg) {
    const idx = cableLayout.addWaypoint(seg.connId, seg.point, seg.segIndex)
    wpDrag = { connId: seg.connId, index: idx }
    nextTick(redraw)
    return
  }

  // Empty space → pan.
  panning = true
  lastPan = cc
}

function onPointerMove(e) {
  const cc = getCanvasCoords(e)

  if (cal.isCalibrating.value && cal.draftP1.value && !cal.draftP2.value) {
    const img = canvasToImageCoords(cc.x, cc.y)
    cursorImg.value = { x: img.imgX, y: img.imgY }
    redraw()
    return
  }

  if (wpDrag) {
    const img = canvasToImageCoords(cc.x, cc.y)
    cableLayout.moveWaypoint(wpDrag.connId, wpDrag.index, { x: img.imgX, y: img.imgY })
    redraw()
    return
  }

  if (nodePress) {
    if (!nodePress.moved && Math.hypot(cc.x - nodePress.start.x, cc.y - nodePress.start.y) <= DRAG_THRESHOLD) return
    nodePress.moved = true
    const img = canvasToImageCoords(cc.x, cc.y)
    cableLayout.setNodePosition(nodePress.node.id, img.imgX, img.imgY)
    redraw()
    return
  }

  if (panning && lastPan) {
    imageOffsetX.value += cc.x - lastPan.x
    imageOffsetY.value += cc.y - lastPan.y
    lastPan = cc
    redraw()
  }
}

function onPointerUp(e) {
  if (nodePress) {
    if (!nodePress.moved) openNodeEditor(nodePress.node)
    nodePress = null
  }
  wpDrag = null
  panning = false
  lastPan = null
  try { canvasRef.value?.releasePointerCapture?.(e.pointerId) } catch {}
}

function onDblClick(e) {
  const cc = getCanvasCoords(e)
  // While calibrating, double-click removes a reference line.
  if (cal.isCalibrating.value) {
    const idx = getDraftRefAtCanvas(cc.x, cc.y)
    if (idx != null) { cal.removeDraftRef(idx); nextTick(redraw) }
    return
  }
  const wp = getWaypointAtCanvas(cc.x, cc.y)
  if (wp) {
    cableLayout.removeWaypoint(wp.connId, wp.index)
    nextTick(redraw)
  }
}

function getDraftRefAtCanvas(cx, cy) {
  const refs = cal.draftRefs.value
  for (let i = refs.length - 1; i >= 0; i--) {
    const r = refs[i]
    if (!r?.p1 || !r?.p2) continue
    const a = imageToCanvasCoords(r.p1.x, r.p1.y)
    const b = imageToCanvasCoords(r.p2.x, r.p2.y)
    if (projectOnSegment(cx, cy, a, b).dist <= 6) return i
  }
  return null
}

// Hit-tests (canvas px). onPointerDown order: waypoint → node → segment.
function getWaypointAtCanvas(cx, cy) {
  if (!showCableLayer.value) return null
  const est = estimate.value
  for (const run of est.runs) {
    if (hiddenDestinations.value.has(run.toId)) continue
    for (let j = 1; j < run.points.length - 1; j++) {
      const p = imageToCanvasCoords(run.points[j].x, run.points[j].y)
      if (Math.hypot(p.x - cx, p.y - cy) <= 7) return { connId: run.connectionId, index: j - 1 }
    }
  }
  return null
}

function getCableSegmentAtCanvas(cx, cy) {
  if (!showCableLayer.value) return null
  const est = estimate.value
  for (const run of est.runs) {
    if (hiddenDestinations.value.has(run.toId)) continue
    const pts = run.points.map(p => imageToCanvasCoords(p.x, p.y))
    for (let i = 0; i < pts.length - 1; i++) {
      const proj = projectOnSegment(cx, cy, pts[i], pts[i + 1])
      if (proj.dist <= 6) {
        const img = canvasToImageCoords(proj.x, proj.y)
        return { connId: run.connectionId, segIndex: i, point: { x: img.imgX, y: img.imgY } }
      }
    }
  }
  return null
}

function projectOnSegment(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  let t = len2 ? ((px - a.x) * dx + (py - a.y) * dy) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  const x = a.x + dx * t, y = a.y + dy * t
  return { x, y, dist: Math.hypot(px - x, py - y) }
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

function onResetLayout() {
  cableLayout.reset()
  nextTick(redraw)
}

function onConfirmCalibration(length, unit) {
  cal.addReference(length, unit)
  displayUnit.value = unit
  redraw()
}

async function onFinishCalibration() {
  const saved = await cal.finish()
  if (saved?.unit) displayUnit.value = saved.unit
  redraw()
}

// ── Node height editor (mic towers etc.) ─────────────────────
function getNodeAtCanvas(cx, cy) {
  for (let i = props.nodes.length - 1; i >= 0; i--) {
    const node = props.nodes[i]
    if (!hasPosition(node)) continue
    const ep = effPos(node)
    const p = imageToCanvasCoords(ep.x, ep.y)
    if (Math.hypot(p.x - cx, p.y - cy) <= 14) return node
  }
  return null
}

function openNodeEditor(node) {
  nodeTarget.value = node
  showNodeModal.value = true
}

function closeNodeModal() {
  showNodeModal.value = false
  nodeTarget.value = null
}

async function onSaveNode({ height, cables }) {
  const node = nodeTarget.value
  if (!node) return
  nodeSaving.value = true
  try {
    const metres = height == null ? null : fromDisplay(Number(height))
    const stored = await setNodeHeight(node.id, metres, props.projectId)
    emit('node-updated', { id: node.id, height_m: stored })
    for (const c of (cables || [])) cableLayout.setCable(c.connId, c.type)
    closeNodeModal()
    nextTick(redraw)
  } catch (err) {
    toast.error('Could not save node')
  } finally {
    nodeSaving.value = false
  }
}

// ── Cable estimate → search index (in-app assistant) ─────────
// Push a compact, keyword-rich summary of this stage's cabling so the Cmd/Ctrl-K
// assistant can answer "how much cable / how many channels". Run lengths only
// exist in the browser (they need the floor-plan image's natural pixel size), so
// the client owns this row. Debounced, and only when the plan is calibrated.
let cableSummaryTimer = null
function scheduleCableSummary(est) {
  if (cableSummaryTimer) clearTimeout(cableSummaryTimer)
  cableSummaryTimer = setTimeout(() => pushCableSummary(est), 1500)
}
function pushCableSummary(est) {
  try {
    if (!props.locationId || !est?.calibrated) return
    const t = est.totals
    if (!t || !(t.totalLength > 0)) return
    const toM = (v) => (est.unit === 'ft' ? v / M_TO_FT : v)
    const totalM = Math.round(toM(t.totalLength))
    const longestM = Math.round(toM(t.longestRun))
    const boxes = (est.stageboxes || []).filter(b => b.micCount > 0)
    const boxText = boxes.map(b => `${b.label} ${b.micCount}ch→${b.suggestedMulticore}-way`).join(', ')
    const content = [
      `≈ ${totalM} m of cable total across ${t.measuredRuns} runs`,
      `longest run ${longestM} m`,
      `${t.totalChannels} channels`,
      boxes.length ? `${boxes.length} stageboxes (${boxText})` : null,
      t.unroutedMicCount ? `${t.unroutedMicCount} sources not wired up` : null,
    ].filter(Boolean).join(' • ')
    saveCableSummary(props.locationId, {
      content,
      metadata: {
        total_m: totalM, longest_m: longestM, channels: t.totalChannels,
        runs: t.measuredRuns, stageboxes: boxes.length, unrouted: t.unroutedMicCount,
      },
    })
  } catch { /* best-effort: never disrupt the Cabling view */ }
}

// ── Load + lifecycle ─────────────────────────────────────────
function checkScreenSize() {
  isMobile.value = window.innerWidth < 768
}

async function loadStage() {
  await Promise.all([cal.load(), cableLayout.load()])
  if (cal.calibration.value?.unit) displayUnit.value = cal.calibration.value.unit
  const s = cableLayout.getSettings()
  if (Number.isFinite(Number(s.slackPercent))) slackPercent.value = Number(s.slackPercent)
  if (Number.isFinite(Number(s.roundStep))) roundStep.value = Number(s.roundStep)
  if (Number.isFinite(Number(s.maxSingle))) maxSingle.value = Number(s.maxSingle)
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
  cableLayout.flush() // persist any pending layout change
  if (cableSummaryTimer) { clearTimeout(cableSummaryTimer); cableSummaryTimer = null }
})

// Reload when the stage changes (defensive — parent usually remounts via :key).
watch(() => props.locationId, () => { loadStage() })

// Redraw on any data / display change.
watch(estimate, () => nextTick(redraw))
// Keep the assistant's cable summary fresh (debounced; calibrated stages only).
watch(estimate, (est) => scheduleCableSummary(est), { immediate: true })
watch([showCableLayer, showLengths, showLabels, displayUnit], () => nextTick(redraw))
watch([slackPercent, roundStep, maxSingle], () => {
  cableLayout.setSettings({
    slackPercent: Number(slackPercent.value) || 0,
    roundStep: Number(roundStep.value) || 0,
    maxSingle: Number(maxSingle.value) || 0,
  })
  nextTick(redraw)
})
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
.ce-icon-btn.active { background: var(--color-primary-500); color: #fff; border-color: var(--color-primary-600); }

.ce-settings {
  display: flex; flex-wrap: wrap; align-items: center; gap: 14px;
  padding: 10px 12px; border: 1px solid var(--surface-border);
  border-radius: var(--radius-md); background: var(--bg-secondary);
}
.ce-setting { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); }
.ce-setting-input { display: inline-flex; align-items: center; gap: 4px; color: var(--text-primary); }
.ce-setting-input input {
  width: 64px; padding: 6px 8px; border: 1px solid var(--surface-border);
  border-radius: var(--radius-md); background: var(--surface-card); color: var(--text-primary);
}
.ce-setting-hint { font-size: 11px; color: var(--text-tertiary); flex-basis: 100%; }

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
