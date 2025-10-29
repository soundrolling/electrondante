<template>
<div class="signal-flow-container">
  <div class="flow-header">
    <h3>Signal Flow</h3>
    <p>Connect sources, transformers, and recorders to build your signal chain</p>
  </div>

  <!-- Toolbar -->
  <div class="flow-toolbar">
    <button :class="{ active: tool === 'select' }" @click="tool = 'select'">
      👆 Select
    </button>
    <button :class="{ active: tool === 'link' }" @click="tool = 'link'">
      🔗 Connect
    </button>
    <button @click="openGearModal" class="btn-add">
      ➕ Add Gear
    </button>
    <button @click="deleteSelected" :disabled="!selectedNode" class="btn-danger">
      🗑️ Delete
    </button>
    <div class="toolbar-divider"></div>
    <span class="node-count">
      Sources: {{ sourceCount }} | Transformers: {{ transformerCount }} | Recorders: {{ recorderCount }}
    </span>
  </div>

  <!-- Canvas -->
  <div class="canvas-wrapper">
    <canvas 
      ref="canvas" 
      :width="canvasWidth * dpr" 
      :height="canvasHeight * dpr"
      :style="canvasStyle"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
    />
    <div v-if="tool === 'link' && linkSource" class="tool-indicator">
      Connecting from: {{ linkSource.track_name || linkSource.label }} (click target node)
    </div>
    <div v-if="selectedConnectionId" class="connection-details">
      <h4>Connection Details</h4>
      <div class="detail-row">
        <span class="label">From:</span>
        <span class="value">{{ getNodeLabelById(selectedConn?.from_node_id) }}</span>
      </div>
      <div class="detail-row">
        <span class="label">To:</span>
        <span class="value">{{ getNodeLabelById(selectedConn?.to_node_id) }}</span>
      </div>
      <div class="detail-row" v-if="selectedConn?.input_number">
        <span class="label">Input:</span>
        <span class="value">{{ selectedConn.input_number }}</span>
      </div>
      <div class="detail-row" v-if="selectedConn?.track_number">
        <span class="label">Track:</span>
        <span class="value">{{ selectedConn.track_number }}</span>
      </div>
      <div class="detail-row">
        <span class="label">Pad:</span>
        <span class="value">{{ selectedConn?.pad ? 'Yes' : 'No' }}</span>
      </div>
      <div class="detail-row">
        <span class="label">Phantom Power:</span>
        <span class="value">{{ selectedConn?.phantom_power ? 'Yes' : 'No' }}</span>
      </div>
      <div class="detail-row">
        <span class="label">Type:</span>
        <span class="value">{{ selectedConn?.connection_type || '—' }}</span>
      </div>
    </div>
  </div>

  <!-- Gear Selection Modal -->
  <div v-if="showGearModal" class="modal-overlay" @click="closeGearModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Add Gear</h3>
        <button @click="closeGearModal" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <div class="gear-categories">
          <button 
            v-for="cat in ['Transformers', 'Recorders']" 
            :key="cat"
            @click="gearFilter = cat"
            :class="{ active: gearFilter === cat }"
          >
            {{ cat }}
          </button>
        </div>
        <div class="gear-list">
          <div 
            v-for="gear in availableGear" 
            :key="gear.id"
            @click="addGearNode(gear)"
            class="gear-item"
          >
            <div class="gear-icon">{{ getGearIcon(gear.gear_type) }}</div>
            <div class="gear-info">
              <div class="gear-name">{{ gear.gear_name }}</div>
              <div class="gear-details">
                {{ gear.num_inputs || 0 }} in, {{ gear.num_outputs || 0 }} out
                <span v-if="gear.num_tracks">, {{ gear.num_tracks }} tracks</span>
              </div>
            </div>
          </div>
          <div v-if="availableGear.length === 0" class="no-gear">
            <p>No {{ gearFilter.toLowerCase() }} available for this location.</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Connection Details Modal -->
  <ConnectionDetailsModal
    v-if="showConnectionModal"
    :fromNode="pendingConnection?.from"
    :toNode="pendingConnection?.to"
    :existingConnections="connections"
    :elements="allNodesForModal"
    :projectId="projectId"
    @confirm="confirmConnection"
    @cancel="closeConnectionModal"
  />
</div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { addNode, updateNode, deleteNode, addConnection as addConnectionToDB } from '@/services/signalMapperService'
import ConnectionDetailsModal from './ConnectionDetailsModal.vue'

const props = defineProps({
  projectId: { type: [String, Number], required: true },
  locationId: { type: [String, Number], default: null },
  nodes: { type: Array, default: () => [] },
  connections: { type: Array, default: () => [] },
  gearList: { type: Array, default: () => [] }
})

const emit = defineEmits([
  'node-updated', 'node-added', 'node-deleted',
  'connection-added', 'connection-updated', 'connection-deleted'
])

const toast = useToast()
const canvas = ref(null)
const dpr = window.devicePixelRatio || 1
const canvasWidth = ref(1000)
const canvasHeight = ref(700)
const canvasStyle = computed(() => 
  `width: ${canvasWidth.value}px; height: ${canvasHeight.value}px;`
)

// Tool state
const tool = ref('select')
const linkSource = ref(null)
const selectedNode = ref(null)
const selectedConnectionId = ref(null)
const draggingNode = ref(null)
let dragStart = null

// Modal state
const showGearModal = ref(false)
const showConnectionModal = ref(false)
const pendingConnection = ref(null)
const gearFilter = ref('Transformers')

// Node counts
const sourceCount = computed(() => 
  props.nodes.filter(n => (n.gear_type || n.node_type) === 'source').length
)
const transformerCount = computed(() => 
  props.nodes.filter(n => (n.gear_type || n.node_type) === 'transformer').length
)
const recorderCount = computed(() => 
  props.nodes.filter(n => (n.gear_type || n.node_type) === 'recorder').length
)

// Available gear for modal
const availableGear = computed(() => {
  const filterType = gearFilter.value === 'Transformers' ? 'transformer' : 'recorder'
  return props.gearList.filter(g => 
    g.gear_type === filterType && g.assignments?.[props.locationId] > 0
  )
})

// Combined nodes for modal
const allNodesForModal = computed(() => props.nodes)

const selectedConn = computed(() => props.connections.find(c => c.id === selectedConnectionId.value) || null)

function getGearIcon(type) {
  const icons = {
    source: '🎤',
    transformer: '⚡',
    recorder: '📼'
  }
  return icons[type] || '🎵'
}

// Drawing
function drawCanvas() {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) return

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvasWidth.value * dpr, canvasHeight.value * dpr)
  ctx.scale(dpr, dpr)

  // Background
  ctx.fillStyle = '#f8f9fa'
  ctx.fillRect(0, 0, canvasWidth.value, canvasHeight.value)

  // Draw connections
  props.connections.forEach(conn => {
    drawConnection(ctx, conn, conn.id === selectedConnectionId.value)
  })

  // Draw nodes
  props.nodes.forEach(node => {
    drawNode(ctx, node)
  })
}

function drawNode(ctx, node) {
  const isSource = (node.gear_type || node.node_type) === 'source'
  const isSelected = node === selectedNode.value
  const pos = getCanvasPos(node)
  
  ctx.save()
  
  // Node circle
  ctx.beginPath()
  ctx.arc(pos.x, pos.y, 35, 0, 2 * Math.PI)
  
  // Color based on type
  const colors = {
    source: '#28a745',
    transformer: '#007bff',
    recorder: '#dc3545'
  }
  const color = colors[node.gear_type || node.node_type] || '#6c757d'
  
  ctx.fillStyle = isSelected ? color : '#fff'
  ctx.strokeStyle = color
  ctx.lineWidth = isSelected ? 4 : 2
  ctx.fill()
  ctx.stroke()

  // Selection indicator
  if (isSelected) {
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 45, 0, 2 * Math.PI)
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Label
  ctx.fillStyle = '#222'
  ctx.font = 'bold 12px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  
  // For sources, show track name if available
  const label = isSource && node.track_name ? node.track_name : node.label
  ctx.fillText(label, pos.x, pos.y + 40)

  ctx.restore()
}

function drawConnection(ctx, conn, isSelected = false) {
  const fromNode = props.nodes.find(n => n.id === conn.from_node_id)
  const toNode = props.nodes.find(n => n.id === conn.to_node_id)
  
  if (!fromNode || !toNode) return

  const fromPos = getCanvasPos(fromNode)
  const toPos = getCanvasPos(toNode)

  ctx.save()
  ctx.strokeStyle = isSelected ? '#ff7a00' : '#007bff'
  ctx.lineWidth = isSelected ? 4 : 3
  ctx.setLineDash(isSelected ? [4, 4] : [8, 4])

  ctx.beginPath()
  ctx.moveTo(fromPos.x, fromPos.y)
  ctx.lineTo(toPos.x, toPos.y)
  ctx.stroke()

  ctx.setLineDash([])

  // Arrow at midpoint
  const mx = (fromPos.x + toPos.x) / 2
  const my = (fromPos.y + toPos.y) / 2
  const angle = Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x)

  ctx.beginPath()
  ctx.moveTo(mx, my)
  ctx.lineTo(mx - 12 * Math.cos(angle - Math.PI / 6), my - 12 * Math.sin(angle - Math.PI / 6))
  ctx.moveTo(mx, my)
  ctx.lineTo(mx - 12 * Math.cos(angle + Math.PI / 6), my - 12 * Math.sin(angle + Math.PI / 6))
  ctx.strokeStyle = isSelected ? '#ff7a00' : '#007bff'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.restore()
}

// Pointer events
function onPointerDown(e) {
  e.preventDefault()
  const { x, y } = getCanvasCoords(e)
  const clickedNode = getNodeAt(x, y)
  if (!clickedNode) {
    const conn = getConnectionAt(x, y)
    selectedConnectionId.value = conn?.id || null
    selectedNode.value = null
    drawCanvas()
    return
  }

  if (tool.value === 'select') {
    if (clickedNode) {
      selectedNode.value = clickedNode
      draggingNode.value = clickedNode
      dragStart = { x, y }
    } else {
      selectedNode.value = null
    }
  } else if (tool.value === 'link') {
    if (clickedNode) {
      if (!linkSource.value) {
        linkSource.value = clickedNode
        toast.info(`Selected ${clickedNode.track_name || clickedNode.label}. Click target node.`)
      } else if (clickedNode !== linkSource.value) {
        // Validate connection
        if (!canConnect(linkSource.value, clickedNode)) {
          toast.error('Invalid connection')
          linkSource.value = null
          return
        }
        
        // Open connection modal
        pendingConnection.value = { from: linkSource.value, to: clickedNode }
        showConnectionModal.value = true
        linkSource.value = null
      } else {
        linkSource.value = null
      }
    }
  }

  drawCanvas()
}

function onPointerMove(e) {
  e.preventDefault()
  if (!draggingNode.value || !dragStart) return

  const { x, y } = getCanvasCoords(e)
  // Update normalized position
  draggingNode.value.x = x / canvasWidth.value
  draggingNode.value.y = y / canvasHeight.value
  drawCanvas()
}

async function onPointerUp(e) {
  e.preventDefault()
  
  if (draggingNode.value) {
    // Save normalized position
    await saveNodePosition(draggingNode.value)
    draggingNode.value = null
  }
  
  dragStart = null
}

function getCanvasCoords(e) {
  const rect = canvas.value.getBoundingClientRect()
  const scaleX = canvas.value.width / rect.width
  const scaleY = canvas.value.height / rect.height
  return {
    x: (e.clientX - rect.left) * scaleX / dpr,
    y: (e.clientY - rect.top) * scaleY / dpr
  }
}

function getNodeAt(x, y) {
  for (let i = props.nodes.length - 1; i >= 0; i--) {
    const node = props.nodes[i]
    const pos = getCanvasPos(node)
    const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2)
    if (dist < 35) return node
  }
  return null
}

function getConnectionAt(x, y) {
  const threshold = 6
  for (let i = props.connections.length - 1; i >= 0; i--) {
    const conn = props.connections[i]
    const fromNode = props.nodes.find(n => n.id === conn.from_node_id)
    const toNode = props.nodes.find(n => n.id === conn.to_node_id)
    if (!fromNode || !toNode) continue
    const fromPos = getCanvasPos(fromNode)
    const toPos = getCanvasPos(toNode)
    const dist = pointToSegmentDistance(x, y, fromPos.x, fromPos.y, toPos.x, toPos.y)
    if (dist <= threshold) return conn
  }
  return null
}

function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const A = px - x1
  const B = py - y1
  const C = x2 - x1
  const D = y2 - y1
  const dot = A * C + B * D
  const lenSq = C * C + D * D
  let param = -1
  if (lenSq !== 0) param = dot / lenSq
  let xx, yy
  if (param < 0) { xx = x1; yy = y1 }
  else if (param > 1) { xx = x2; yy = y2 }
  else { xx = x1 + param * C; yy = y1 + param * D }
  const dx = px - xx
  const dy = py - yy
  return Math.sqrt(dx * dx + dy * dy)
}

function canConnect(from, to) {
  const fromType = from.gear_type || from.node_type
  const toType = to.gear_type || to.node_type

  // Valid connections:
  // source -> transformer
  // source -> recorder
  // transformer -> transformer
  // transformer -> recorder

  if (fromType === 'source' && (toType === 'transformer' || toType === 'recorder')) return true
  if (fromType === 'transformer' && (toType === 'transformer' || toType === 'recorder')) return true
  
  return false
}

// Modal handlers
function openGearModal() {
  showGearModal.value = true
}

function closeGearModal() {
  showGearModal.value = false
}

async function addGearNode(gear) {
  try {
    const label = prompt('Enter label for this node:', gear.gear_name)
    if (!label) return

    const newNode = await addNode({
      project_id: props.projectId,
      type: 'gear',
      gear_id: gear.id,
      label,
      x: 0.5,
      y: 0.5,
      gear_type: gear.gear_type,
      num_inputs: gear.num_inputs || 0,
      num_outputs: gear.num_outputs || 0,
      num_tracks: gear.num_tracks || 0
    })

    emit('node-added', newNode)
    closeGearModal()
    toast.success(`Added ${label}`)
    nextTick(drawCanvas)
  } catch (err) {
    console.error('Error adding gear:', err)
    toast.error('Failed to add gear')
  }
}

async function saveNodePosition(node) {
  try {
    await updateNode({
      id: node.id,
      x: node.x,
      y: node.y
    })
    emit('node-updated', node)
  } catch (err) {
    console.error('Error updating node:', err)
    toast.error('Failed to update node position')
  }
}

// Coordinate helpers: nodes store normalized coords (0..1). Convert for canvas drawing.
function getCanvasPos(node) {
  const nx = node.x ?? 0
  const ny = node.y ?? 0
  // If values look already in pixels (legacy), use as-is
  const isPixel = nx > 1.5 || ny > 1.5
  return isPixel
    ? { x: nx, y: ny }
    : { x: nx * canvasWidth.value, y: ny * canvasHeight.value }
}

async function deleteSelected() {
  if (!selectedNode.value) return

  const isSource = (selectedNode.value.gear_type || selectedNode.value.node_type) === 'source'
  if (isSource) {
    toast.error('Cannot delete source nodes from Signal Flow. Delete from Mic Placement tab.')
    return
  }

  if (!confirm(`Delete ${selectedNode.value.label}?`)) return

  try {
    await deleteNode(selectedNode.value.id)
    emit('node-deleted', selectedNode.value.id)
    selectedNode.value = null
    toast.success('Node deleted')
    nextTick(drawCanvas)
  } catch (err) {
    console.error('Error deleting node:', err)
    toast.error('Failed to delete node')
  }
}

function closeConnectionModal() {
  showConnectionModal.value = false
  pendingConnection.value = null
}

async function confirmConnection(connectionData) {
  try {
    const newConn = await addConnectionToDB(connectionData)
    emit('connection-added', newConn)
    closeConnectionModal()
    toast.success('Connection created')
    nextTick(drawCanvas)
  } catch (err) {
    console.error('Error creating connection:', err)
    toast.error('Failed to create connection')
  }
}

// Watchers
watch([() => props.nodes, () => props.connections], () => nextTick(drawCanvas))

// Lifecycle
onMounted(() => {
  if (canvas.value) {
    canvas.value.width = canvasWidth.value * dpr
    canvas.value.height = canvasHeight.value * dpr
  }
  nextTick(drawCanvas)
})
</script>

<style scoped>
.signal-flow-container {
  padding: 20px;
}

.flow-header {
  margin-bottom: 20px;
  text-align: center;
}

.flow-header h3 {
  margin: 0 0 10px 0;
  font-size: 24px;
  color: #212529;
}

.flow-header p {
  margin: 0;
  color: #6c757d;
}

.flow-toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 15px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 8px;
}

.flow-toolbar button {
  padding: 10px 16px;
  background: white;
  border: 2px solid #dee2e6;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.flow-toolbar button:hover {
  border-color: #007bff;
}

.flow-toolbar button.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.btn-add {
  background: #007bff !important;
  color: white !important;
  border-color: #007bff !important;
}

.btn-add:hover {
  background: #0056b3 !important;
}

.btn-danger {
  background: #dc3545 !important;
  color: white !important;
  border-color: #dc3545 !important;
}

.btn-danger:hover {
  background: #c82333 !important;
}

.btn-danger:disabled {
  background: #e9ecef !important;
  color: #adb5bd !important;
  border-color: #dee2e6 !important;
  cursor: not-allowed;
}

.toolbar-divider {
  width: 1px;
  height: 30px;
  background: #dee2e6;
  margin: 0 10px;
}

.node-count {
  color: #6c757d;
  font-size: 14px;
}

.canvas-wrapper {
  position: relative;
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}

.canvas-wrapper canvas {
  border: 1px solid #e9ecef;
  border-radius: 8px;
  cursor: crosshair;
}

.tool-indicator {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;
}

.connection-details {
  position: absolute;
  top: 10px;
  right: 10px;
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 12px 14px;
  min-width: 220px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
}
.connection-details h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 700;
  color: #212529;
}
.detail-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin: 6px 0;
  font-size: 13px;
}
.detail-row .label { color: #6c757d; }
.detail-row .value { color: #212529; font-weight: 600; }

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #212529;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6c757d;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: #f8f9fa;
}

.modal-body {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.gear-categories {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.gear-categories button {
  flex: 1;
  padding: 10px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.gear-categories button:hover {
  background: #e9ecef;
}

.gear-categories button.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.gear-list {
  display: grid;
  gap: 12px;
}

.gear-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.gear-item:hover {
  background: #f8f9fa;
  border-color: #007bff;
}

.gear-icon {
  font-size: 32px;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  border-radius: 8px;
}

.gear-info {
  flex: 1;
}

.gear-name {
  font-weight: 600;
  color: #212529;
  margin-bottom: 4px;
}

.gear-details {
  font-size: 12px;
  color: #6c757d;
}

.no-gear {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}
</style>

