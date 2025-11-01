<template>
<!-- Outer viewport for pan/zoom -->
<div class="w-full h-full relative overflow-hidden touch-none" ref="viewport">
  <!-- Panzoom root -->
  <div
    ref="panzoomRoot"
    class="absolute border-2 border-gray-400 bg-grid"
    :style="{ width: worldSize.width + 'px', height: worldSize.height + 'px' }"
  >
    <!-- Canvas area -->
    <div
      class="w-full h-full relative"
      @click.self="onCanvasClick"
      @mousemove="handleCanvasMouseMove"
      @touchmove.passive="handleCanvasTouchMove"
      ref="canvasContainerRef"
    >
      <!-- Nodes -->
      <div
        v-for="node in patchBay.nodes"
        :key="node.id"
        :class="[
          'absolute bg-white border border-gray-300 rounded-lg shadow-lg select-none p-2 flex flex-col justify-between',
          {
            'cursor-pointer ring-2 ring-red-500 shadow-md':
              deleteMode && hoveredDeleteNodeId === node.id,
            'cursor-pointer hover:ring-2 hover:ring-red-300': deleteMode,
            'cursor-crosshair': linkingMode,
            'cursor-move': !linkingMode && !addMode && !deleteMode && !panMode,
            'ring-2 ring-blue-500 shadow-xl':
              linkingMode && props.linkCandidateFromNodeId === node.id,
            'ring-2 ring-yellow-400 shadow-lg':
              linkingMode &&
              tempLinkToNodeCandidate &&
              tempLinkToNodeCandidate.id === node.id &&
              props.linkCandidateFromNodeId !== node.id,
            'ring-2 ring-cyan-500 shadow-xl':
              props.selectedNodeId === node.id
          }
        ]"
        :style="{
          top: node.y + 'px',
          left: node.x + 'px',
          width: NODE_ELEMENT_WIDTH + 'px',
          minHeight: NODE_MIN_HEIGHT + 'px'
        }"
        @mousedown.prevent="startDrag(node, $event)"
        @touchstart.prevent="startDrag(node, $event)"
        @click.stop="onNodeClick(node)"
        @touchend.prevent="handleNodeTouch(node)"
        @dblclick.stop="onNodeDoubleClick(node)"
        @mouseenter="if (deleteMode) hoveredDeleteNodeId = node.id; handleNodeMouseEnter(node)"
        @mouseleave="if (deleteMode) hoveredDeleteNodeId = null; handleNodeMouseLeave()"
      >
        <div class="flex justify-between items-center mb-1">
          <span
            class="font-medium text-gray-800 text-sm"
            :title="node.label"
            style="white-space: normal; word-break: break-word;"
          >
            {{ node.label }}
          </span>
          <button
            v-if="!deleteMode && !linkingMode && !addMode && !panMode"
            @click.stop="$emit('edit-node', node.id)"
            class="text-gray-500 hover:text-gray-800 text-xs p-1 -mr-1 -mt-1 flex-shrink-0"
            title="Edit Node"
          >✎</button>
        </div>
        <div class="text-xxs text-gray-400 mt-auto text-center py-1 border-t border-gray-200">
          <span>In: {{ Number(node.numinputs) }}</span> |
          <span>Out: {{ Number(node.num_outputs) }}</span>
          <span v-if="node.node_type === 'recorder' && Number(node.num_tracks) > 0">
            | Trk: {{ Number(node.num_tracks) }}
          </span>
        </div>
        <!-- Track mapping indicator for recorders -->
        <div v-if="node.node_type === 'recorder' && getMappedTracks(node.id).length > 0" 
             class="text-xxs text-purple-600 text-center py-1 bg-purple-50 border-t border-purple-200">
          Mapped: {{ getMappedTracks(node.id).join(', ') }}
        </div>
        <!-- Connection indicator for transformers -->
        <div v-if="node.node_type === 'transformer' && getConnectionCount(node.id) > 0" 
             class="text-xxs text-blue-600 text-center py-1 bg-blue-50 border-t border-blue-200">
          {{ getConnectionCount(node.id) }} connections
        </div>
      </div>

      <!-- Linking preview line -->
      <svg
        v-if="linkingLine.visible && linkingMode"
        class="absolute inset-0 w-full h-full pointer-events-none z-10"
      >
        <line
          :x1="linkingLine.x1" :y1="linkingLine.y1"
          :x2="linkingLine.x2" :y2="linkingLine.y2"
          class="stroke-blue-500"
          stroke-width="2"
          stroke-dasharray="4,4"
        />
      </svg>
    </div>

    <!-- Routes overlay -->
    <SignalRoutes
      :deletePathMode="deletePathMode"
      class="absolute inset-0"
      @remove-route="$emit('remove-route', $event)"
    />
  </div>
</div>
</template>

<script setup>
import { defineProps, ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import panzoom from 'panzoom'
import { usePatchBayStore } from '@/stores/patchBayStore'
import SignalRoutes from './SignalRoutes.vue'

const patchBay = usePatchBayStore()

const props = defineProps({
panMode: Boolean,
linkingMode: Boolean,
addMode: Boolean,
deleteMode: Boolean,
deletePathMode: Boolean,
linkCandidateFromNodeId: { type: [String, Number], default: null },
selectedNodeId: { type: [String, Number], default: null }
})
const emit = defineEmits([
'edit-node',
'select-link-node',
'canvas-click',
'delete-node',
'open-node-details',
'remove-route',
'node-selected'
])

// "world" for pan/zoom
const worldSize = { width: 3000, height: 2000 }
const NODE_ELEMENT_WIDTH = 140
const NODE_MIN_HEIGHT    = 70

const panzoomRoot   = ref(null)
let panzoomInstance = null

// canvas & interactions
const canvasContainerRef       = ref(null)
const dragging                 = ref(null)
const offset                   = ref({ x: 0, y: 0 })
const linkingLine              = ref({ x1:0, y1:0, x2:0, y2:0, visible: false })
const tempLinkToNodeCandidate = ref(null)
const hoveredDeleteNodeId      = ref(null)
const lastTap                  = ref(0)

const linkCandidateFromNode = computed(() =>
props.linkCandidateFromNodeId != null
  ? patchBay.nodes.find(n => n.id === props.linkCandidateFromNodeId)
  : null
)

// initialize panzoom (paused by default)
onMounted(() => {
panzoomInstance = panzoom(panzoomRoot.value, {
  maxZoom: 3, minZoom: 0.5,
  bounds: false,
  zoomDoubleClickSpeed: 1
})
panzoomInstance.pause()
})
onBeforeUnmount(() => panzoomInstance?.dispose())

// toggle pan mode
watch(() => props.panMode, p => p ? panzoomInstance.resume() : panzoomInstance.pause())

// linking preview
function updateLinkingLineOrigin() {
if (props.linkingMode && linkCandidateFromNode.value) {
  const o = getNodeCenter(linkCandidateFromNode.value)
  linkingLine.value = { x1: o.x, y1: o.y, x2: o.x, y2: o.y, visible: true }
} else {
  linkingLine.value.visible = false
}
}
watch(() => props.linkingMode, linking => {
if (!linking) {
  linkingLine.value.visible = false
  tempLinkToNodeCandidate.value = null
} else updateLinkingLineOrigin()
})
watch(linkCandidateFromNode, () => updateLinkingLineOrigin(), { deep: true })

// pointer utilities
function getPointerPosition(e) {
if (e.touches?.length) {
  return { x: e.touches[0].clientX, y: e.touches[0].clientY }
}
return { x: e.clientX, y: e.clientY }
}
function getNodeCenter(n) {
return {
  x: n.x + NODE_ELEMENT_WIDTH/2,
  y: n.y + NODE_MIN_HEIGHT/2
}
}

// preview moves
function handleCanvasMouseMove(e) { updatePreview(e.clientX, e.clientY) }
function handleCanvasTouchMove(e) {
const p = getPointerPosition(e)
updatePreview(p.x, p.y)
}
function updatePreview(cx, cy) {
if (props.linkingMode && linkingLine.value.visible && !tempLinkToNodeCandidate.value) {
  const rect = canvasContainerRef.value.getBoundingClientRect()
  linkingLine.value.x2 = cx - rect.left
  linkingLine.value.y2 = cy - rect.top
}
}
function handleNodeMouseEnter(n) {
if (props.linkingMode && linkCandidateFromNode.value?.id !== n.id) {
  tempLinkToNodeCandidate.value = n
  const c = getNodeCenter(n)
  linkingLine.value.x2 = c.x; linkingLine.value.y2 = c.y
}
}
function handleNodeMouseLeave() {
tempLinkToNodeCandidate.value = null
}

// drag logic
function startDrag(node, e) {
if (props.panMode||props.linkingMode||props.addMode||props.deleteMode) return
dragging.value = { ...node }
const p = getPointerPosition(e)
const rect = canvasContainerRef.value.getBoundingClientRect()
offset.value = { x: p.x - rect.left - node.x, y: p.y - rect.top - node.y }
window.addEventListener('mousemove', onDrag)
window.addEventListener('mouseup',   endDrag)
window.addEventListener('touchmove', onDrag,   { passive: false })
window.addEventListener('touchend',  endDrag)
}
function onDrag(e) {
e.preventDefault()
if (!dragging.value) return
const p = getPointerPosition(e)
const rect = canvasContainerRef.value.getBoundingClientRect()
let x = p.x - rect.left - offset.value.x
let y = p.y - rect.top  - offset.value.y
x = Math.max(0, Math.min(x, rect.width  - NODE_ELEMENT_WIDTH))
y = Math.max(0, Math.min(y, rect.height - NODE_MIN_HEIGHT))
dragging.value.x = x; dragging.value.y = y
patchBay.updateNodePositionInStore(dragging.value.id, x, y)
}
function endDrag() {
window.removeEventListener('mousemove', onDrag)
window.removeEventListener('mouseup',   endDrag)
window.removeEventListener('touchmove', onDrag)
window.removeEventListener('touchend',  endDrag)
if (dragging.value) {
  patchBay.updateNode({ id: dragging.value.id, x: dragging.value.x, y: dragging.value.y })
    .catch(console.error)
}
dragging.value = null
}

// clicks/taps
function onCanvasClick(e) {
if (props.addMode) {
  const rect = canvasContainerRef.value.getBoundingClientRect()
  const p = getPointerPosition(e)
  emit('canvas-click', { x: p.x - rect.left, y: p.y - rect.top })
}
else if (props.linkingMode) {
  emit('select-link-node', null)
  linkingLine.value.visible = false
}
}
function onNodeClick(n) {
if (props.deleteMode)  return emit('delete-node', n.id)
if (props.linkingMode) return emit('select-link-node', n.id)
// Emit node selection for port mapper
emit('node-selected', n.id)
}
// desktop doubleclick
function onNodeDoubleClick(n) {
if (!props.linkingMode && !props.addMode && !props.deleteMode) {
  emit('open-node-details', n.id)
}
}
// mobile double-tap
function handleNodeTouch(n) {
const now = Date.now()
if (now - lastTap.value < 300) {
  onNodeDoubleClick(n)
} else {
  onNodeClick(n)
}
lastTap.value = now
}

// Helper function to get mapped tracks for a recorder
function getMappedTracks(nodeId) {
  const connections = patchBay.connections.filter(c => 
    c.to_node === nodeId && c.track_number
  )
  return connections.map(c => c.track_number).sort((a, b) => a - b)
}

// Helper function to get connection count for a transformer
function getConnectionCount(nodeId) {
  const inputConnections = patchBay.connections.filter(c => c.to_node === nodeId)
  const outputConnections = patchBay.connections.filter(c => c.from_node === nodeId)
  return inputConnections.length + outputConnections.length
}

// Expose methods for external use
defineExpose({
  getCanvasBounds: () => {
    if (!patchBay.nodes.length) return worldSize
    
    const PADDING = 100
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    
    patchBay.nodes.forEach(node => {
      minX = Math.min(minX, node.x)
      minY = Math.min(minY, node.y)
      maxX = Math.max(maxX, node.x + NODE_ELEMENT_WIDTH)
      maxY = Math.max(maxY, node.y + NODE_MIN_HEIGHT)
    })
    
    return {
      x: minX - PADDING,
      y: minY - PADDING,
      width: maxX - minX + PADDING * 2,
      height: maxY - minY + PADDING * 2
    }
  },
  
  getWorldSize: () => worldSize,
  
  getNodeDimensions: () => ({
    width: NODE_ELEMENT_WIDTH,
    height: NODE_MIN_HEIGHT
  })
})
</script>

<style scoped>
.touch-none { touch-action: none; }
.truncate   { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.text-xxs   { font-size: 0.65rem; line-height: 0.85rem; }

/* subtle grid */
.bg-grid {
background-size: 50px 50px;
background-image:
  linear-gradient(to right, #eee 1px, transparent 1px),
  linear-gradient(to bottom, #eee 1px, transparent 1px);
}

.node-label {
  white-space: normal;
  word-break: break-word;
  display: block;
  width: 100%;
}
</style>