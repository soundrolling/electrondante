<template>
<div class="sfv-root">
  <!-- Header / toolbar -->
  <header class="sfv-head">
    <div class="sfv-head-title">
      <h2 class="sfv-title">Signal Flow <span class="sfv-beta-tag">Beta</span></h2>
      <p class="sfv-subtitle">New editor — pinch to zoom, drag nodes, drag between ports to connect</p>
    </div>
    <div class="sfv-counts">
      <span class="sfv-count">
        <span class="sfv-count-value">{{ sourceCount }}</span>
        <span class="sfv-count-label">sources</span>
      </span>
      <span class="sfv-count">
        <span class="sfv-count-value">{{ transformerCount }}</span>
        <span class="sfv-count-label">stageboxes</span>
      </span>
      <span class="sfv-count">
        <span class="sfv-count-value">{{ recorderCount }}</span>
        <span class="sfv-count-label">recorders</span>
      </span>
      <span class="sfv-count muted">
        <span class="sfv-count-value">{{ connectionCount }}</span>
        <span class="sfv-count-label">conns</span>
      </span>
    </div>
  </header>

  <div class="sfv-toolbar">
    <div class="sfv-chip-group">
      <button
        type="button"
        :class="['sfv-chip', { active: connectionTypeDefault === 'Mic' }]"
        @click="connectionTypeDefault = 'Mic'"
        title="New connections default to Mic"
      >
        <span class="sfv-dot" :style="{ background: CONNECTION_COLORS.Mic }"></span>
        Mic
      </button>
      <button
        type="button"
        :class="['sfv-chip', { active: connectionTypeDefault === 'Line' }]"
        @click="connectionTypeDefault = 'Line'"
      >
        <span class="sfv-dot" :style="{ background: CONNECTION_COLORS.Line }"></span>
        Line
      </button>
      <button
        type="button"
        :class="['sfv-chip', { active: connectionTypeDefault === 'Dante' }]"
        @click="connectionTypeDefault = 'Dante'"
      >
        <span class="sfv-dot" :style="{ background: CONNECTION_COLORS.Dante }"></span>
        Dante
      </button>
      <button
        type="button"
        :class="['sfv-chip', { active: connectionTypeDefault === 'Midi' }]"
        @click="connectionTypeDefault = 'Midi'"
      >
        <span class="sfv-dot" :style="{ background: CONNECTION_COLORS.Midi }"></span>
        Midi
      </button>
      <button
        type="button"
        :class="['sfv-chip', { active: connectionTypeDefault === 'Madi' }]"
        @click="connectionTypeDefault = 'Madi'"
      >
        <span class="sfv-dot" :style="{ background: CONNECTION_COLORS.Madi }"></span>
        Madi
      </button>
    </div>
    <div class="sfv-toolbar-actions">
      <button class="sfv-icon-btn" @click="fitView" title="Fit to view" aria-label="Fit to view">
        <Maximize2 :size="16" :stroke-width="2" />
      </button>
      <button class="sfv-icon-btn" @click="zoomIn" title="Zoom in" aria-label="Zoom in">
        <ZoomIn :size="16" :stroke-width="2" />
      </button>
      <button class="sfv-icon-btn" @click="zoomOut" title="Zoom out" aria-label="Zoom out">
        <ZoomOut :size="16" :stroke-width="2" />
      </button>
    </div>
  </div>

  <!-- The canvas -->
  <div class="sfv-canvas" :class="{ empty: !vfNodes.length }">
    <VueFlow
      v-if="vfNodes.length"
      :nodes="vfNodes"
      :edges="vfEdges"
      :default-viewport="{ x: 0, y: 0, zoom: 0.9 }"
      :min-zoom="0.2"
      :max-zoom="2.5"
      :nodes-draggable="true"
      :edges-updatable="false"
      :elements-selectable="true"
      :snap-to-grid="false"
      :delete-key-code="['Delete', 'Backspace']"
      :connection-radius="60"
      fit-view-on-init
      @node-drag-stop="onNodeDragStop"
      @connect="onConnect"
      @nodes-change="onNodesChange"
      @edges-change="onEdgesChange"
      @edge-click="onEdgeClick"
      @node-click="onNodeClick"
      @pane-click="onPaneClick"
    >
      <template #connection-line="{ sourceX, sourceY, targetX, targetY }">
        <path
          :d="bezierPath(sourceX, sourceY, targetX, targetY)"
          :stroke="CONNECTION_COLORS[connectionTypeDefault] || CONNECTION_COLORS.Default"
          stroke-width="2.5"
          stroke-dasharray="5 5"
          fill="none"
          pointer-events="none"
        />
      </template>
    </VueFlow>

    <div v-else class="sfv-empty">
      <div class="sfv-empty-icon">
        <Workflow :size="28" :stroke-width="1.5" />
      </div>
      <p class="sfv-empty-title">No nodes yet</p>
      <p class="sfv-empty-hint">
        Add microphones on the Mic Placement tab, then come back here to wire them up.
      </p>
    </div>
  </div>

  <!-- Edge inspector (teleported so it anchors to the viewport, not the
       VueFlow transform context). -->
  <Teleport to="body">
    <aside
      v-if="selectedEdge && selectedEdgeData"
      class="sfv-inspector"
      @click.stop
    >
      <header class="sfv-inspector-head">
        <div>
          <div class="sfv-inspector-label">Connection</div>
          <h4 class="sfv-inspector-title">
            {{ selectedEdgeData.fromLabel }} → {{ selectedEdgeData.toLabel }}
          </h4>
        </div>
        <button class="sfv-inspector-close" @click="clearSelection" aria-label="Close">
          <X :size="16" :stroke-width="2" />
        </button>
      </header>
      <div class="sfv-inspector-body">
        <label class="sfv-field-label">Type</label>
        <div class="sfv-type-grid">
          <button
            v-for="t in CONNECTION_TYPES"
            :key="t"
            type="button"
            :class="['sfv-type-btn', { active: selectedEdgeData.connection_type === t }]"
            @click="setEdgeType(t)"
          >
            <span class="sfv-dot" :style="{ background: CONNECTION_COLORS[t] }"></span>
            {{ t }}
          </button>
        </div>
        <button
          class="sfv-danger-btn"
          @click="deleteSelectedEdge"
        >
          <Trash2 :size="14" :stroke-width="2" />
          Delete connection
        </button>
      </div>
    </aside>
  </Teleport>

  <!-- Full node inspector (reuses classic component).
       Teleported to body so position:fixed is viewport-anchored
       and the modal isn't trapped inside VueFlow's transform context. -->
  <Teleport to="body">
    <NodeInspector
      v-if="inspectorNode"
      :projectId="projectId"
      :node="inspectorNode"
      :elements="props.nodes"
      :locationId="locationId"
      :stageHourId="stageHourId"
      viewType="signal-flow"
      @close="inspectorNode = null"
      @node-deleted="onInspectorNodeDeleted"
      @node-updated="onInspectorNodeUpdated"
    />
  </Teleport>

  <!-- Venue sources modal when a venue_sources node is clicked -->
  <Teleport to="body">
    <VenueSourcesConfigModal
      v-if="venueSourcesNode"
      :nodeId="venueSourcesNode.id"
      :projectId="projectId"
      @close="venueSourcesNode = null"
      @saved="onVenueSourcesSaved"
    />
  </Teleport>
</div>
</template>

<script setup>
import { computed, ref, onMounted, nextTick } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import {
  Workflow,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  Trash2,
} from 'lucide-vue-next'
import { useToast } from 'vue-toastification'
import {
  addConnection,
  updateConnection,
  deleteConnection as deleteConnectionFromDB,
  updateNode,
} from '@/services/signalMapperService'
import NodeInspector from '@/components/signalmapper/NodeInspector.vue'
import VenueSourcesConfigModal from '@/components/signalmapper/VenueSourcesConfigModal.vue'

const props = defineProps({
  projectId: { type: [String, Number], required: true },
  locationId: { type: [String, Number], default: null },
  stageHourId: { type: [String, Number], default: null },
  nodes: { type: Array, default: () => [] },
  connections: { type: Array, default: () => [] },
  gearList: { type: Array, default: () => [] },
  initialSelectedConnectionId: { type: [String, Number], default: null },
})

const emit = defineEmits([
  'node-added',
  'node-updated',
  'node-deleted',
  'connection-added',
  'connection-updated',
  'connection-deleted',
])

const toast = useToast()

/* ─── Constants ───────────────────────────────────────── */
const CONNECTION_TYPES = ['Mic', 'Line', 'Dante', 'Midi', 'Madi']
const CONNECTION_COLORS = {
  Mic: '#dc3545',
  Line: '#007bff',
  Dante: '#28a745',
  Midi: '#ffc107',
  Madi: '#6f42c1',
  Default: '#6c757d',
}
// Canvas "world" size we map normalized flow_x/flow_y into.
const WORLD_WIDTH = 1200
const WORLD_HEIGHT = 800
const NODE_DEFAULT_SIZE = 120

/* ─── Categorisation ──────────────────────────────────── */
function categoryOf(node) {
  const g = String(node.gear_type || node.type || '').toLowerCase()
  if (g === 'source') return 'source'
  if (g === 'transformer') return 'transformer'
  if (g === 'recorder') return 'recorder'
  if (g === 'venue_sources' || g === 'venue-sources') return 'venue'
  return 'source'
}

function labelOf(node) {
  return (
    node.track_name ||
    node.label ||
    node.display_name ||
    node.gear_name ||
    node.gear_label ||
    node.name ||
    (categoryOf(node) === 'recorder' ? 'Recorder' : 'Node')
  )
}

/* ─── Map DB nodes → Vue Flow nodes ───────────────────── */
const vfNodes = computed(() => {
  return (props.nodes || []).map(n => {
    const cat = categoryOf(n)
    const x = typeof n.flow_x === 'number' ? n.flow_x * WORLD_WIDTH : Math.random() * WORLD_WIDTH
    const y = typeof n.flow_y === 'number' ? n.flow_y * WORLD_HEIGHT : Math.random() * WORLD_HEIGHT
    return {
      id: String(n.id),
      position: { x, y },
      data: {
        label: labelOf(n),
        category: cat,
        raw: n,
      },
      type: cat === 'source' || cat === 'venue' ? 'input' : cat === 'recorder' ? 'output' : 'default',
      class: [`sfv-node`, `sfv-node-${cat}`],
      style: {
        width: `${NODE_DEFAULT_SIZE}px`,
      },
    }
  })
})

/* ─── Map DB connections → Vue Flow edges ─────────────── */
const vfEdges = computed(() => {
  return (props.connections || []).map(c => {
    const type = c.connection_type || 'Mic'
    const color = CONNECTION_COLORS[type] || CONNECTION_COLORS.Default
    return {
      id: String(c.id),
      source: String(c.from_node_id),
      target: String(c.to_node_id),
      type: 'smoothstep',
      label: type === 'Mic' ? '' : type,
      style: {
        stroke: color,
        strokeWidth: 2.5,
      },
      labelStyle: { fill: color, fontWeight: 600, fontSize: 11 },
      labelBgStyle: { fill: 'var(--surface-card)', fillOpacity: 0.9 },
      markerEnd: { type: 'arrowclosed', color, width: 16, height: 16 },
      data: { raw: c, connection_type: type },
    }
  })
})

/* ─── Counts for header ───────────────────────────────── */
const sourceCount = computed(() =>
  (props.nodes || []).filter(n => ['source', 'venue'].includes(categoryOf(n))).length
)
const transformerCount = computed(() =>
  (props.nodes || []).filter(n => categoryOf(n) === 'transformer').length
)
const recorderCount = computed(() =>
  (props.nodes || []).filter(n => categoryOf(n) === 'recorder').length
)
const connectionCount = computed(() => (props.connections || []).length)

/* ─── Vue Flow interop helpers ────────────────────────── */
const {
  zoomIn: vfZoomIn,
  zoomOut: vfZoomOut,
  fitView: vfFitView,
  onPaneReady,
} = useVueFlow()

function fitView() {
  try { vfFitView({ padding: 0.2 }) } catch {}
}
function zoomIn() { try { vfZoomIn() } catch {} }
function zoomOut() { try { vfZoomOut() } catch {} }

onPaneReady(() => {
  // initial fit once nodes are ready
  nextTick(() => fitView())
})

/* ─── Default connection type for new edges ───────────── */
const connectionTypeDefault = ref('Mic')

/* ─── Selection (edges only for now) ──────────────────── */
const selectedEdge = ref(null) // vue-flow edge object
const selectedEdgeData = computed(() => {
  if (!selectedEdge.value) return null
  const raw = selectedEdge.value.data?.raw
  const fromNode = props.nodes.find(n => String(n.id) === String(selectedEdge.value.source))
  const toNode = props.nodes.find(n => String(n.id) === String(selectedEdge.value.target))
  return {
    id: selectedEdge.value.id,
    connection_type: raw?.connection_type || 'Mic',
    fromLabel: fromNode ? labelOf(fromNode) : 'Source',
    toLabel: toNode ? labelOf(toNode) : 'Destination',
  }
})

/* ─── Node inspector state ─────────────────────────────── */
const inspectorNode = ref(null)      // classic NodeInspector
const venueSourcesNode = ref(null)   // special-cased venue_sources modal

function onEdgeClick({ edge }) {
  selectedEdge.value = edge
  inspectorNode.value = null
  venueSourcesNode.value = null
}
function onNodeClick({ node }) {
  selectedEdge.value = null
  const raw = node?.data?.raw
  if (!raw) return
  const cat = categoryOf(raw)
  if (cat === 'venue') {
    venueSourcesNode.value = raw
    inspectorNode.value = null
  } else {
    inspectorNode.value = raw
    venueSourcesNode.value = null
  }
}
function onPaneClick() {
  selectedEdge.value = null
  inspectorNode.value = null
  venueSourcesNode.value = null
}
function clearSelection() {
  selectedEdge.value = null
}

function onInspectorNodeUpdated(updatedNode) {
  inspectorNode.value = null
  emit('node-updated', updatedNode)
}
function onInspectorNodeDeleted(nodeId) {
  inspectorNode.value = null
  emit('node-deleted', nodeId)
}
function onVenueSourcesSaved() {
  const raw = venueSourcesNode.value
  venueSourcesNode.value = null
  if (raw) emit('node-updated', raw)
}

/* ─── Interactions ─────────────────────────────────────── */
async function onNodeDragStop({ node }) {
  const raw = node.data?.raw
  if (!raw || !raw.id) return
  const normX = Math.max(0, Math.min(1, node.position.x / WORLD_WIDTH))
  const normY = Math.max(0, Math.min(1, node.position.y / WORLD_HEIGHT))
  try {
    const updated = { ...raw, flow_x: normX, flow_y: normY }
    const saved = await updateNode(updated)
    emit('node-updated', saved || updated)
  } catch (err) {
    console.error('SignalFlowVF: updateNode failed', err)
    toast.error('Failed to save node position')
  }
}

async function onConnect({ source, target }) {
  if (!source || !target || source === target) return
  const already = (props.connections || []).find(c =>
    String(c.from_node_id) === String(source) && String(c.to_node_id) === String(target)
  )
  if (already) {
    toast.info('Those nodes are already connected')
    return
  }
  try {
    const row = await addConnection({
      project_id: props.projectId,
      location_id: props.locationId || null,
      stage_hour_id: props.stageHourId || null,
      from_node_id: source,
      to_node_id: target,
      connection_type: connectionTypeDefault.value || 'Mic',
    })
    if (row) emit('connection-added', row)
  } catch (err) {
    console.error('SignalFlowVF: addConnection failed', err)
    toast.error('Failed to create connection')
  }
}

function onNodesChange(changes) {
  // Vue Flow emits fine-grained changes. We only care about 'remove' here;
  // 'position' is handled by node-drag-stop which already persists once.
  for (const ch of changes) {
    if (ch.type === 'remove') {
      // Node deletion via keyboard: we don't auto-delete from DB here to
      // avoid accidental destructive ops. Surface a toast instead.
      toast.info('Use the Mic Placement tab or the classic editor to delete nodes for now.')
    }
  }
}

async function onEdgesChange(changes) {
  for (const ch of changes) {
    if (ch.type === 'remove') {
      try {
        await deleteConnectionFromDB(ch.id)
        emit('connection-deleted', ch.id)
      } catch (err) {
        console.error('SignalFlowVF: deleteConnection failed', err)
        toast.error('Failed to delete connection')
      }
    }
  }
}

async function setEdgeType(newType) {
  if (!selectedEdge.value) return
  const raw = selectedEdge.value.data?.raw
  if (!raw) return
  try {
    const updated = await updateConnection({ ...raw, connection_type: newType })
    emit('connection-updated', updated || { ...raw, connection_type: newType })
    // update local selection so UI reacts immediately
    if (selectedEdge.value?.data) {
      selectedEdge.value.data.raw = { ...raw, connection_type: newType }
    }
  } catch (err) {
    console.error('SignalFlowVF: updateConnection failed', err)
    toast.error('Failed to update connection type')
  }
}

async function deleteSelectedEdge() {
  if (!selectedEdge.value) return
  const id = selectedEdge.value.id
  try {
    await deleteConnectionFromDB(id)
    emit('connection-deleted', id)
    selectedEdge.value = null
  } catch (err) {
    console.error('SignalFlowVF: deleteConnection failed', err)
    toast.error('Failed to delete connection')
  }
}

/* ─── Connection-line helper for drag preview ─────────── */
function bezierPath(sx, sy, tx, ty) {
  const dx = Math.abs(tx - sx) * 0.5
  return `M${sx},${sy} C${sx + dx},${sy} ${tx - dx},${ty} ${tx},${ty}`
}

/* ─── Exposed methods (match classic component contract) ─ */
function getCanvasDataURL() {
  // The beta editor exports via vue-flow's toImage helper, but that needs
  // a package we don't have. Falls back to null so callers know to use the
  // classic canvas path for now.
  return null
}
function selectConnection(connId) {
  const edge = vfEdges.value.find(e => String(e.id) === String(connId))
  if (edge) selectedEdge.value = edge
}

defineExpose({ getCanvasDataURL, selectConnection })

onMounted(() => {
  if (props.initialSelectedConnectionId) {
    nextTick(() => selectConnection(props.initialSelectedConnectionId))
  }
})
</script>

<style scoped>
.sfv-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  min-height: 560px;
}

/* ─── Header ───────────────────────────────────────────── */
.sfv-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.sfv-title {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--text-heading);
  margin: 0;
  letter-spacing: -0.02em;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.sfv-beta-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  font-size: 10px;
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  background: var(--color-primary-50);
  color: var(--color-primary-700);
  border-radius: var(--radius-full);
}
.sfv-subtitle {
  margin: 2px 0 0;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}
.sfv-counts { display: flex; gap: var(--space-3); }
.sfv-count { display: inline-flex; flex-direction: column; align-items: flex-end; line-height: 1; }
.sfv-count-value {
  font-size: var(--text-base);
  font-weight: var(--font-bold);
  color: var(--color-primary-600);
  font-variant-numeric: tabular-nums;
}
.sfv-count.muted .sfv-count-value { color: var(--text-tertiary); }
.sfv-count-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
  margin-top: 2px;
  font-weight: var(--font-medium);
}

/* ─── Toolbar ──────────────────────────────────────────── */
.sfv-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 8px;
  background: var(--surface-card-muted);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  flex-wrap: wrap;
}
.sfv-chip-group {
  display: flex;
  gap: 4px;
  padding: 3px;
  background: var(--chip-bg);
  border-radius: var(--radius-md);
}
.sfv-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  height: 28px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  border-radius: calc(var(--radius-md) - 3px);
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal);
}
.sfv-chip:hover { color: var(--text-primary); }
.sfv-chip.active {
  background: var(--surface-card);
  color: var(--text-primary);
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}
.sfv-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}
.sfv-toolbar-actions {
  display: flex;
  gap: 4px;
}
.sfv-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
}
.sfv-icon-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
  border-color: var(--surface-border-strong);
}

/* ─── Canvas ───────────────────────────────────────────── */
.sfv-canvas {
  position: relative;
  background: var(--surface-card-muted);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  min-height: 500px;
  flex: 1;
}
.sfv-canvas.empty { background: var(--surface-card); }
.sfv-canvas :deep(.vue-flow) {
  height: 100%;
  min-height: 500px;
}

/* Node styling */
.sfv-canvas :deep(.vue-flow__node.sfv-node) {
  font-family: var(--font-family-sans);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  background: var(--surface-card);
  border: 1.5px solid var(--surface-border-strong);
  box-shadow: var(--shadow-sm);
  text-align: center;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}
.sfv-canvas :deep(.vue-flow__node.sfv-node.selected) {
  box-shadow: 0 0 0 2px var(--focus-ring);
}
.sfv-canvas :deep(.vue-flow__node.sfv-node-source) {
  background: var(--color-primary-50);
  border-color: var(--color-primary-300);
  color: var(--color-primary-800);
}
.sfv-canvas :deep(.vue-flow__node.sfv-node-transformer) {
  background: var(--color-warning-50);
  border-color: var(--color-warning-300);
  color: var(--color-warning-800);
}
.sfv-canvas :deep(.vue-flow__node.sfv-node-recorder) {
  background: var(--color-error-50);
  border-color: var(--color-error-300);
  color: var(--color-error-800);
}
.sfv-canvas :deep(.vue-flow__node.sfv-node-venue) {
  background: color-mix(in srgb, #6f42c1 12%, transparent);
  border-color: color-mix(in srgb, #6f42c1 35%, transparent);
  color: #4b2a82;
}
:deep(.dark) .sfv-canvas :deep(.vue-flow__node.sfv-node-source) {
  background: rgba(14, 165, 233, 0.12);
  border-color: rgba(14, 165, 233, 0.4);
  color: var(--color-primary-200);
}
:deep(.dark) .sfv-canvas :deep(.vue-flow__node.sfv-node-transformer) {
  background: rgba(245, 158, 11, 0.14);
  border-color: rgba(245, 158, 11, 0.4);
  color: var(--color-warning-200);
}
:deep(.dark) .sfv-canvas :deep(.vue-flow__node.sfv-node-recorder) {
  background: rgba(239, 68, 68, 0.14);
  border-color: rgba(239, 68, 68, 0.4);
  color: var(--color-error-200);
}

.sfv-canvas :deep(.vue-flow__handle) {
  width: 12px;
  height: 12px;
  background: var(--surface-card);
  border: 2px solid var(--text-tertiary);
}
.sfv-canvas :deep(.vue-flow__handle:hover) {
  background: var(--color-primary-200);
  border-color: var(--color-primary-500);
}
.sfv-canvas :deep(.vue-flow__edge-path) { stroke-linecap: round; }
.sfv-canvas :deep(.vue-flow__controls) {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

/* Empty state */
.sfv-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: var(--space-12);
  text-align: center;
  height: 100%;
  min-height: 500px;
}
.sfv-empty-icon {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-lg);
  background: var(--chip-bg);
  color: var(--text-tertiary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-2);
}
.sfv-empty-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  margin: 0;
}
.sfv-empty-hint {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin: 0;
  max-width: 36ch;
}

/* ─── Inspector drawer ─────────────────────────────────── */
.sfv-inspector {
  position: fixed;
  top: calc(16px + env(safe-area-inset-top, 0));
  right: 16px;
  width: min(320px, calc(100vw - 32px));
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  z-index: var(--z-popover);
  animation: sfv-inspector-in 140ms ease-out;
}
@keyframes sfv-inspector-in {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}
.sfv-inspector-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--surface-border);
}
.sfv-inspector-label {
  font-size: 10px;
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
}
.sfv-inspector-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  margin: 2px 0 0 0;
  line-height: 1.3;
}
.sfv-inspector-close {
  width: 28px;
  height: 28px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal);
  flex-shrink: 0;
}
.sfv-inspector-close:hover { background: var(--surface-hover); color: var(--text-primary); }
.sfv-inspector-body {
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.sfv-field-label {
  font-size: 10px;
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-tertiary);
}
.sfv-type-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}
.sfv-type-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--chip-bg);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
}
.sfv-type-btn:hover { background: var(--surface-hover); color: var(--text-primary); }
.sfv-type-btn.active {
  background: var(--surface-card);
  color: var(--text-heading);
  border-color: var(--surface-border-strong);
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}
.sfv-danger-btn {
  margin-top: var(--space-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  background: transparent;
  color: var(--color-error-600);
  border: 1px solid var(--color-error-200);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
}
.sfv-danger-btn:hover {
  background: var(--color-error-50);
  color: var(--color-error-700);
  border-color: var(--color-error-300);
}

/* ─── Mobile ───────────────────────────────────────────── */
@media (max-width: 600px) {
  .sfv-root { padding: var(--space-3); }
  .sfv-head { flex-direction: column; align-items: stretch; }
  .sfv-counts { justify-content: flex-start; gap: var(--space-3); }
  .sfv-count { align-items: flex-start; }
  .sfv-toolbar { padding: 6px; gap: var(--space-2); }
  .sfv-chip-group { flex: 1; overflow-x: auto; scrollbar-width: none; }
  .sfv-chip-group::-webkit-scrollbar { display: none; }
  .sfv-inspector {
    left: var(--space-3);
    right: var(--space-3);
    top: auto;
    bottom: calc(72px + env(safe-area-inset-bottom, 0));
    width: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sfv-chip,
  .sfv-icon-btn,
  .sfv-type-btn,
  .sfv-danger-btn,
  .sfv-inspector-close { transition: none; }
  .sfv-inspector { animation: none; }
}
</style>
