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
    <div class="sfv-chip-group" role="radiogroup" aria-label="Default connection type for new links">
      <button
        v-for="t in CONNECTION_TYPES"
        :key="t"
        type="button"
        role="radio"
        :aria-checked="connectionTypeDefault === t"
        :class="['sfv-chip', { active: connectionTypeDefault === t }]"
        @click="connectionTypeDefault = t"
        :title="`New connections default to ${t}`"
      >
        <span class="sfv-dot" :style="{ background: CONNECTION_COLORS[t] }"></span>
        {{ t }}
      </button>
    </div>
    <div class="sfv-style-group" role="radiogroup" aria-label="Edge style">
      <button
        type="button"
        role="radio"
        :aria-checked="edgeStyle === 'bezier'"
        :class="['sfv-style-btn', { active: edgeStyle === 'bezier' }]"
        @click="setEdgeStyle('bezier')"
        title="Curved edges"
      >
        <Spline :size="14" :stroke-width="2" />
        <span class="sfv-style-label">Curves</span>
      </button>
      <button
        type="button"
        role="radio"
        :aria-checked="edgeStyle === 'smoothstep'"
        :class="['sfv-style-btn', { active: edgeStyle === 'smoothstep' }]"
        @click="setEdgeStyle('smoothstep')"
        title="Orthogonal edges with rounded corners"
      >
        <CornerDownRight :size="14" :stroke-width="2" />
        <span class="sfv-style-label">Steps</span>
      </button>
      <button
        type="button"
        role="radio"
        :aria-checked="edgeStyle === 'straight'"
        :class="['sfv-style-btn', { active: edgeStyle === 'straight' }]"
        @click="setEdgeStyle('straight')"
        title="Straight lines"
      >
        <Minus :size="14" :stroke-width="2" />
        <span class="sfv-style-label">Straight</span>
      </button>
    </div>
    <div class="sfv-toolbar-actions">
      <button class="sfv-add-btn" @click="openGearModal" title="Add gear (stagebox / recorder)">
        <Plus :size="14" :stroke-width="2" />
        <span class="sfv-add-label">Gear</span>
      </button>
      <button
        class="sfv-add-btn"
        @click="openVenueSourcesModal"
        :disabled="hasVenueSourcesNode"
        :title="hasVenueSourcesNode ? 'A Venue Sources node already exists' : 'Add Venue Sources hub'"
      >
        <Plus :size="14" :stroke-width="2" />
        <span class="sfv-add-label">Venue</span>
      </button>
      <div class="sfv-toolbar-divider"></div>
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
      :pan-on-drag="[0, 1, 2]"
      :pan-on-scroll="false"
      :zoom-on-scroll="true"
      :zoom-on-pinch="true"
      :zoom-on-double-click="false"
      :prevent-scrolling="true"
      :no-pan-class-name="'sfv-no-pan'"
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
       VueFlow transform context). Positioned near where the edge was
       clicked, with viewport-edge clamping. -->
  <Teleport to="body">
    <aside
      v-if="selectedEdge && selectedEdgeData"
      class="sfv-inspector"
      :style="edgeInspectorStyle"
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
        <EdgePortMapPanel
          v-if="edgePortMapEligible"
          :connection="selectedEdgeData.raw"
          :source-node="selectedEdgeData.fromNode"
          :target-node="selectedEdgeData.toNode"
          :project-id="projectId"
          @changed="onEdgePortMapChanged"
        />
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

  <!-- Add Gear modal -->
  <Teleport to="body">
    <div
      v-if="showGearModal"
      class="sfv-modal-backdrop"
      @click.self="showGearModal = false"
    >
      <div class="sfv-modal">
        <header class="sfv-modal-head">
          <h3 class="sfv-modal-title">Add gear</h3>
          <button
            class="sfv-modal-close"
            @click="showGearModal = false"
            aria-label="Close"
          >
            <X :size="18" :stroke-width="2" />
          </button>
        </header>
        <div class="sfv-modal-tabs" role="tablist">
          <button
            v-for="cat in ['Transformers', 'Recorders']"
            :key="cat"
            role="tab"
            :aria-selected="gearFilter === cat"
            :class="['sfv-modal-tab', { active: gearFilter === cat }]"
            @click="gearFilter = cat"
          >
            {{ cat }}
          </button>
        </div>
        <div class="sfv-modal-body">
          <ul v-if="availableGear.length" class="sfv-gear-list">
            <li
              v-for="gear in availableGear"
              :key="gear.id"
              class="sfv-gear-row"
              :class="{ 'is-full': gear.isFull }"
              :aria-disabled="gear.isFull ? 'true' : 'false'"
              @click="gear.isFull ? null : addGearNode(gear)"
            >
              <div class="sfv-gear-icon">
                <Workflow v-if="gear.gear_type === 'transformer'" :size="18" :stroke-width="2" />
                <HardDrive v-else :size="18" :stroke-width="2" />
              </div>
              <div class="sfv-gear-info">
                <div class="sfv-gear-name">{{ gear.gear_name }}</div>
                <div class="sfv-gear-meta">
                  {{ gear.num_inputs || 0 }} in · {{ gear.num_tracks || gear.num_outputs || 0 }} {{ gear.gear_type === 'recorder' ? 'tracks' : 'out' }}
                </div>
                <div v-if="gear.isFull" class="sfv-gear-allocated-msg">
                  All {{ gear.assigned }} allocated — delete one to add again
                </div>
              </div>
              <span class="sfv-gear-count" :class="{ 'is-full': gear.isFull }">
                {{ gear.placed }}/{{ gear.assigned }}
              </span>
              <Plus
                :size="16"
                :stroke-width="2"
                class="sfv-gear-add"
                :class="{ 'is-full': gear.isFull }"
              />
            </li>
          </ul>
          <div v-else class="sfv-modal-empty">
            <p class="sfv-modal-empty-title">
              No {{ gearFilter.toLowerCase() }} assigned to this location
            </p>
            <p class="sfv-modal-empty-hint">
              Add gear on the Project → Gear page and assign it to this stage first.
            </p>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Label-this-node modal (replaces native window.prompt) -->
  <Teleport to="body">
    <div
      v-if="showLabelModal"
      class="sfv-modal-backdrop"
      @click.self="cancelLabelModal"
    >
      <div class="sfv-modal sfv-modal--narrow" role="dialog" aria-labelledby="sfv-label-title">
        <header class="sfv-modal-head">
          <h3 id="sfv-label-title" class="sfv-modal-title">Label this node</h3>
          <button
            class="sfv-modal-close"
            type="button"
            @click="cancelLabelModal"
            aria-label="Close"
          >
            <X :size="18" :stroke-width="2" />
          </button>
        </header>
        <form class="sfv-label-form" @submit.prevent="confirmAddGearNode">
          <label class="sfv-label-field">
            <span class="sfv-label-caption">Display name</span>
            <input
              ref="labelInputEl"
              v-model="labelInputValue"
              type="text"
              class="sfv-label-input"
              placeholder="e.g. Stage Left Stagebox"
              autocomplete="off"
              spellcheck="false"
              @keydown.escape.prevent="cancelLabelModal"
            />
            <span class="sfv-label-hint">
              Shown on the node in Signal Flow. Leave blank to use “{{ defaultLabelFor(pendingGear) }}”.
            </span>
          </label>
          <div class="sfv-label-actions">
            <button
              type="button"
              class="sfv-btn sfv-btn-ghost"
              @click="cancelLabelModal"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="sfv-btn sfv-btn-primary"
            >
              Add node
            </button>
          </div>
        </form>
      </div>
    </div>
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
  Spline,
  CornerDownRight,
  Minus,
  Plus,
  HardDrive,
} from 'lucide-vue-next'
import { useToast } from 'vue-toastification'
import {
  addConnection,
  updateConnection,
  deleteConnection as deleteConnectionFromDB,
  updateNode,
  addNode,
} from '@/services/signalMapperService'
import NodeInspector from '@/components/signalmapper/NodeInspector.vue'
import VenueSourcesConfigModal from '@/components/signalmapper/VenueSourcesConfigModal.vue'
import EdgePortMapPanel from '@/components/signalmapper/EdgePortMapPanel.vue'

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
      // Sources/venue only send (source handle). Transformers AND recorders get
      // both handles so a recorder can forward to a backup recorder (e.g. Scorpio
      // → BU) in the correct direction — an 'output'-only node has no source handle.
      type: cat === 'source' || cat === 'venue' ? 'input' : 'default',
      class: [`sfv-node`, `sfv-node-${cat}`],
      style: {
        width: `${NODE_DEFAULT_SIZE}px`,
      },
    }
  })
})

/* ─── Map DB connections → Vue Flow edges ─────────────── */
function buildEdge(c, etype) {
  const type = c.connection_type || 'Mic'
  const color = CONNECTION_COLORS[type] || CONNECTION_COLORS.Default
  return {
    id: String(c.id),
    source: String(c.from_node_id),
    target: String(c.to_node_id),
    type: etype,
    style: {
      stroke: color,
      strokeWidth: 2,
    },
    markerEnd: { type: 'arrowclosed', color, width: 16, height: 16 },
    data: { raw: c, connection_type: type },
  }
}

const vfEdges = computed(() => {
  const etype = edgeTypeName.value
  return (props.connections || []).map(c => buildEdge(c, etype))
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
  addEdges: vfAddEdges,
  findEdge: vfFindEdge,
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

/* ─── Edge style (persisted) ───────────────────────────── */
const EDGE_STYLE_KEY = 'signalMapper.edgeStyle' // 'bezier' | 'smoothstep' | 'straight'
const edgeStyle = ref(
  typeof localStorage !== 'undefined'
    ? (localStorage.getItem(EDGE_STYLE_KEY) || 'bezier')
    : 'bezier'
)
function setEdgeStyle(next) {
  edgeStyle.value = next
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(EDGE_STYLE_KEY, next)
  } catch {}
}
// Map our style name → vue-flow edge type name
const edgeTypeName = computed(() => {
  switch (edgeStyle.value) {
    case 'bezier': return 'default'      // default = cubic bezier
    case 'straight': return 'straight'
    case 'smoothstep':
    default: return 'smoothstep'
  }
})

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
    raw,
    fromNode,
    toNode,
  }
})
// Show the per-feed → input mapping when a multi-feed source (venue source or
// any node with >1 output) feeds a stagebox/recorder.
const edgePortMapEligible = computed(() => {
  const d = selectedEdgeData.value
  if (!d || !d.raw || !d.fromNode || !d.toNode) return false
  const srcType = (d.fromNode.gear_type || d.fromNode.node_type || d.fromNode.type || '').toLowerCase()
  const tgtCat = categoryOf(d.toNode)
  const multiFeed = srcType === 'venue_sources' || Number(d.fromNode.num_outputs || d.fromNode.outputs || 0) > 1
  return multiFeed && (tgtCat === 'transformer' || tgtCat === 'recorder')
})

/* ─── Node inspector state ─────────────────────────────── */
const inspectorNode = ref(null)      // classic NodeInspector
const venueSourcesNode = ref(null)   // special-cased venue_sources modal

/* Edge inspector popover position — anchored near the click */
const edgeInspectorPos = ref({ top: null, left: null })
const EDGE_INSPECTOR_WIDTH = 320
const EDGE_INSPECTOR_HEIGHT_EST = 240

function positionEdgeInspector(clientX, clientY) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const margin = 12
  let left = clientX + margin
  let top = clientY + margin
  // Clamp right
  if (left + EDGE_INSPECTOR_WIDTH + margin > vw) {
    left = Math.max(margin, clientX - EDGE_INSPECTOR_WIDTH - margin)
  }
  // Clamp bottom
  if (top + EDGE_INSPECTOR_HEIGHT_EST + margin > vh) {
    top = Math.max(margin, clientY - EDGE_INSPECTOR_HEIGHT_EST - margin)
  }
  edgeInspectorPos.value = { top, left }
}

const edgeInspectorStyle = computed(() => {
  // Disable this style on small viewports — the CSS @media rule below takes
  // over and pins the inspector to a bottom sheet instead of following the
  // finger tap.
  if (typeof window !== 'undefined' && window.innerWidth <= 600) return {}
  const { top, left } = edgeInspectorPos.value
  if (top == null || left == null) return {}
  return { top: `${top}px`, left: `${left}px`, right: 'auto' }
})

function onEdgeClick({ edge, event }) {
  selectedEdge.value = edge
  inspectorNode.value = null
  venueSourcesNode.value = null
  const ev = event && (event.changedTouches?.[0] || event.touches?.[0] || event)
  const cx = typeof ev?.clientX === 'number' ? ev.clientX : window.innerWidth / 2
  const cy = typeof ev?.clientY === 'number' ? ev.clientY : window.innerHeight / 2
  positionEdgeInspector(cx, cy)
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
    if (row) {
      // Push the edge into Vue Flow's internal store immediately so the line
      // renders without waiting for the parent's prop sync to round-trip.
      // On touch devices the prop-based update can be missed by Vue Flow's
      // edge sync until the next interaction, so this ensures parity with
      // desktop mouse behavior.
      try {
        const edgeId = String(row.id)
        if (!vfFindEdge(edgeId)) {
          vfAddEdges([buildEdge(row, edgeTypeName.value)])
        }
      } catch (e) {
        console.warn('SignalFlowVF: vfAddEdges failed (non-fatal)', e)
      }
      emit('connection-added', row)
    }
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

function onEdgePortMapChanged() {
  // Port maps changed for this connection — nudge the parent to refresh paths.
  const raw = selectedEdge.value?.data?.raw
  if (raw) emit('connection-updated', raw)
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

/* ─── Add Gear / Venue Sources ─────────────────────────── */
const showGearModal = ref(false)
const gearFilter = ref('Transformers') // 'Transformers' | 'Recorders'

// Label-this-node modal (replaces native window.prompt)
const showLabelModal = ref(false)
const labelInputValue = ref('')
const pendingGear = ref(null)
const labelInputEl = ref(null)

const placedGearCounts = computed(() => {
  const counts = {}
  for (const n of props.nodes || []) {
    if (n?.gear_id == null) continue
    const key = String(n.gear_id)
    counts[key] = (counts[key] || 0) + 1
  }
  return counts
})

const availableGear = computed(() => {
  const filterType = gearFilter.value === 'Transformers' ? 'transformer' : 'recorder'
  const counts = placedGearCounts.value
  return (props.gearList || [])
    .filter(g => {
      if (g.gear_type !== filterType) return false
      const assigned = g.assignments ? g.assignments[props.locationId] : 0
      return (assigned || 0) > 0
    })
    .map(g => {
      const assigned = (g.assignments && g.assignments[props.locationId]) || 0
      const placed = counts[String(g.id)] || 0
      const remaining = Math.max(0, assigned - placed)
      return { ...g, assigned, placed, remaining, isFull: remaining <= 0 }
    })
})

const hasVenueSourcesNode = computed(() => {
  return (props.nodes || []).some(n =>
    (n.gear_type === 'venue_sources' || n.type === 'venue_sources')
  )
})

function openGearModal() {
  showGearModal.value = true
}

function defaultLabelFor(gear) {
  return gear?.gear_name || (gear?.gear_type === 'recorder' ? 'Recorder' : 'Stagebox')
}

function addGearNode(gear) {
  if (gear?.isFull) {
    toast.info(`All ${gear.assigned} allocated — delete one to add again`)
    return
  }
  pendingGear.value = gear
  labelInputValue.value = defaultLabelFor(gear)
  showLabelModal.value = true
  nextTick(() => {
    const el = labelInputEl.value
    if (el) {
      el.focus()
      el.select()
    }
  })
}

function cancelLabelModal() {
  showLabelModal.value = false
  pendingGear.value = null
  labelInputValue.value = ''
}

async function confirmAddGearNode() {
  const gear = pendingGear.value
  if (!gear) return
  try {
    const fallback = defaultLabelFor(gear)
    const finalLabel = (labelInputValue.value || '').trim() || fallback

    const newNode = await addNode({
      project_id: props.projectId,
      location_id: props.locationId || null,
      stage_hour_id: props.stageHourId || null,
      type: 'gear',
      gear_id: gear.id,
      label: finalLabel,
      track_name: finalLabel,
      x: 0.5,
      y: 0.5,
      flow_x: 0.5,
      flow_y: 0.5,
      gear_type: gear.gear_type,
      num_inputs: gear.num_inputs || 0,
      num_outputs: gear.num_tracks || gear.num_outputs || 0,
      num_tracks: gear.num_tracks || 0,
    })

    emit('node-added', newNode)
    showLabelModal.value = false
    showGearModal.value = false
    pendingGear.value = null
    labelInputValue.value = ''
    toast.success(`Added ${finalLabel}`)
  } catch (err) {
    console.error('SignalFlowVF: addGearNode failed', err)
    toast.error('Failed to add gear')
  }
}

async function openVenueSourcesModal() {
  if (hasVenueSourcesNode.value) {
    toast.warning('A Venue Sources node already exists. Click it to configure feeds.')
    return
  }
  try {
    const newNode = await addNode({
      project_id: props.projectId,
      location_id: props.locationId || null,
      stage_hour_id: props.stageHourId || null,
      type: 'venue_sources',
      label: 'Venue Sources',
      track_name: 'Venue Sources',
      x: 0.5,
      y: 0.5,
      flow_x: 0.5,
      flow_y: 0.5,
      gear_type: 'venue_sources',
      num_inputs: 0,
      num_outputs: 0,
      num_tracks: 0,
      output_port_labels: {},
    })
    emit('node-added', newNode)
    toast.success('Venue Sources node created. Click to configure feeds.')
  } catch (err) {
    console.error('SignalFlowVF: addVenueSources failed', err)
    toast.error('Failed to add Venue Sources: ' + (err?.message || 'unknown error'))
  }
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
.sfv-style-group {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: var(--chip-bg);
  border-radius: var(--radius-md);
  margin-left: var(--space-2);
}
.sfv-style-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
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
.sfv-style-btn:hover { color: var(--text-primary); }
.sfv-style-btn.active {
  background: var(--surface-card);
  color: var(--text-primary);
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}
.sfv-style-label { display: inline; }

.sfv-toolbar-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}
.sfv-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 10px;
  height: 32px;
  background: var(--color-primary-50);
  border: 1px solid var(--color-primary-200);
  color: var(--color-primary-700);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: background var(--transition-normal), border-color var(--transition-normal), color var(--transition-normal);
}
.sfv-add-btn:hover:not(:disabled) {
  background: var(--color-primary-100);
  border-color: var(--color-primary-300);
}
.sfv-add-btn:disabled { opacity: 0.5; cursor: not-allowed; }
:deep(.dark) .sfv-add-btn {
  background: rgba(14, 165, 233, 0.15);
  border-color: rgba(14, 165, 233, 0.3);
  color: var(--color-primary-200);
}
:deep(.dark) .sfv-add-btn:hover:not(:disabled) {
  background: rgba(14, 165, 233, 0.25);
  border-color: rgba(14, 165, 233, 0.45);
}
.sfv-toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--surface-border);
  margin: 0 4px;
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
  /* Stop the browser from interpreting touch gestures as page pan/zoom while
     the user is dragging nodes or pinching the canvas. Vue Flow handles its
     own gesture pipeline; the browser must stay out of the way. */
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}
.sfv-canvas.empty { background: var(--surface-card); }
.sfv-canvas :deep(.vue-flow) {
  height: 100%;
  min-height: 500px;
  touch-action: none;
}
/* Same as above — required so a single-finger drag actually drags a node
   instead of scrolling the page on mobile Safari / Chrome. */
.sfv-canvas :deep(.vue-flow__pane),
.sfv-canvas :deep(.vue-flow__viewport),
.sfv-canvas :deep(.vue-flow__node) {
  touch-action: none;
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
  width: 14px;
  height: 14px;
  background: var(--surface-card);
  border: 2px solid var(--text-tertiary);
  /* Block any inherited touch-action that might prevent the connection
     drag gesture from starting on touch devices. */
  touch-action: none;
}
.sfv-canvas :deep(.vue-flow__handle:hover) {
  background: var(--color-primary-200);
  border-color: var(--color-primary-500);
}
/* Bigger handle hit area on touch devices so fingers can actually grab it.
   The visible dot stays the same — we just inflate the surrounding tap
   target with a transparent pseudo-element. */
@media (pointer: coarse) {
  .sfv-canvas :deep(.vue-flow__handle) {
    width: 18px;
    height: 18px;
    border-width: 3px;
  }
  .sfv-canvas :deep(.vue-flow__handle)::after {
    content: '';
    position: absolute;
    inset: -10px;
    border-radius: 50%;
  }
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
/* ─── Add-gear modal ───────────────────────────────────── */
.sfv-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-4);
  animation: sfv-fade 140ms ease-out;
}
@keyframes sfv-fade { from { opacity: 0; } to { opacity: 1; } }
.sfv-modal {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xl);
  width: 520px;
  max-width: 100%;
  max-height: 88vh;
  overflow: hidden;
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  animation: sfv-pop 180ms cubic-bezier(0.25, 0.8, 0.35, 1);
}
@keyframes sfv-pop { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
.sfv-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--surface-border);
}
.sfv-modal-title {
  margin: 0;
  font-size: var(--text-base);
  font-weight: var(--font-bold);
  color: var(--text-heading);
  letter-spacing: -0.01em;
}
.sfv-modal-close {
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
}
.sfv-modal-close:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
  border-color: var(--surface-border);
}
.sfv-modal-tabs {
  display: flex;
  gap: 2px;
  padding: 3px;
  margin: var(--space-3) var(--space-4);
  background: var(--chip-bg);
  border-radius: var(--radius-md);
}
.sfv-modal-tab {
  flex: 1;
  background: transparent;
  border: none;
  padding: 6px 12px;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  border-radius: calc(var(--radius-md) - 3px);
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal);
}
.sfv-modal-tab:hover { color: var(--text-primary); }
.sfv-modal-tab.active {
  background: var(--surface-card);
  color: var(--text-primary);
  font-weight: var(--font-semibold);
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}
.sfv-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 var(--space-4) var(--space-4);
}
.sfv-gear-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sfv-gear-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 10px 12px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-normal), border-color var(--transition-normal), transform var(--transition-fast);
}
.sfv-gear-row:hover {
  background: var(--surface-hover);
  border-color: var(--color-primary-300);
}
.sfv-gear-row:active { transform: scale(0.99); }
.sfv-gear-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: var(--surface-card-muted);
  color: var(--color-primary-600);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.sfv-gear-info { flex: 1; min-width: 0; }
.sfv-gear-name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sfv-gear-meta {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 2px;
  font-variant-numeric: tabular-nums;
}
.sfv-gear-add { color: var(--color-primary-500); flex-shrink: 0; }
.sfv-gear-count {
  font-size: 11px;
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--surface-card-muted);
  border: 1px solid var(--surface-border);
  flex-shrink: 0;
  white-space: nowrap;
}
.sfv-gear-count.is-full {
  color: var(--text-tertiary);
  background: transparent;
  border-color: var(--surface-border);
}
.sfv-gear-row.is-full {
  cursor: not-allowed;
  opacity: 0.6;
}
.sfv-gear-row.is-full:hover {
  background: var(--surface-card);
  border-color: var(--surface-border);
}
.sfv-gear-row.is-full:active { transform: none; }
.sfv-gear-add.is-full {
  color: var(--text-tertiary);
  opacity: 0.5;
}
.sfv-gear-allocated-msg {
  font-size: 11px;
  color: var(--text-tertiary);
  font-style: italic;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sfv-modal-empty {
  padding: var(--space-8) var(--space-4);
  text-align: center;
}
.sfv-modal-empty-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  margin: 0;
}
.sfv-modal-empty-hint {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: 6px 0 0 0;
  max-width: 38ch;
  margin-left: auto;
  margin-right: auto;
}

/* ─── Label-this-node modal ────────────────────────────── */
.sfv-modal--narrow { width: 420px; }
.sfv-label-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
}
.sfv-label-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sfv-label-caption {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.sfv-label-input {
  width: 100%;
  padding: 10px 12px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: border-color var(--transition-normal), box-shadow var(--transition-normal);
}
.sfv-label-input:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}
.sfv-label-hint {
  font-size: 11px;
  color: var(--text-tertiary);
}
.sfv-label-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
.sfv-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 14px;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  border: 1px solid transparent;
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal), transform var(--transition-fast);
}
.sfv-btn:active { transform: scale(0.98); }
.sfv-btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border-color: var(--surface-border);
}
.sfv-btn-ghost:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}
.sfv-btn-primary {
  background: var(--color-primary-600);
  color: #fff;
  border-color: var(--color-primary-600);
}
.sfv-btn-primary:hover {
  background: var(--color-primary-700);
  border-color: var(--color-primary-700);
}

@media (max-width: 600px) {
  .sfv-root { padding: var(--space-3); }
  .sfv-head { flex-direction: column; align-items: stretch; }
  .sfv-counts { justify-content: flex-start; gap: var(--space-3); }
  .sfv-count { align-items: flex-start; }
  /* Bigger toolbar buttons on mobile for thumb-friendly tap targets. */
  .sfv-icon-btn { width: 40px; height: 40px; }
  .sfv-add-btn { height: 40px; min-width: 40px; }
  /* Slightly larger node text so labels stay legible while dragging with
     a fingertip in front of them. */
  .sfv-canvas :deep(.vue-flow__node.sfv-node) {
    font-size: 13px;
    padding: 11px 13px;
  }
  .sfv-toolbar { padding: 6px; gap: var(--space-2); }
  .sfv-chip-group { flex: 1; overflow-x: auto; scrollbar-width: none; }
  .sfv-chip-group::-webkit-scrollbar { display: none; }
  .sfv-style-group { margin-left: 0; }
  .sfv-style-label { display: none; }
  .sfv-add-label { display: none; }
  .sfv-add-btn { padding: 0; width: 32px; justify-content: center; }
  .sfv-modal-backdrop { padding: 0; align-items: flex-end; }
  .sfv-modal {
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    width: 100%;
    max-height: 85vh;
  }
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
