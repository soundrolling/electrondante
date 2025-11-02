<!-- src/views/ProjectPatchbay.vue -->
<template>

  
<div class="p-4 space-y-4">
  <!-- Venue / Stage Selectors -->
  <!-- Back button -->
<button @click="goBack" class="btn-outline-gray mb-4">
← Back
</button>
  <div class="flex items-center space-x-4">
    <select v-model="selectedVenue" class="input-std">
      <option :value="null" disabled>Select Venue</option>
      <option v-for="v in venues" :key="v.id" :value="v.id">
        {{ v.venue_name }}
      </option>
    </select>
    <select v-model="selectedStage" :disabled="!selectedVenue" class="input-std">
      <option :value="null" disabled>Select Stage</option>
      <option v-for="l in layouts" :key="l.id" :value="l.id">
        {{ l.stage_name }}
      </option>
    </select>
  </div>

  <!-- Export Buttons -->
  <div class="flex space-x-2">
    <button @click="exportPdf" class="btn-outline-blue">📄 Export PDF</button>
    <button @click="exportImage" class="btn-outline-green">🖼️ Export Image</button>
  </div>

  <!-- Mode Buttons -->
  <div class="flex items-center space-x-2">
    <button
      @click="toggleAddMode"
      :class="addMode ? 'btn-active-green' : 'btn-outline-green'"
    >
      {{ addMode ? 'Tap Canvas to Place…' : '+ Add Node' }}
    </button>
    <button
      @click="toggleLinkMode"
      :class="linkingMode ? 'btn-active-yellow' : 'btn-outline-yellow'"
    >
      {{ linkingMode
          ? (linkCandidateFromNode ? 'Select To Node…' : 'Select From Node…')
          : 'Link Nodes' }}
    </button>
    <button
      @click="toggleDeleteNodeMode"
      :class="deleteNodeMode ? 'btn-active-red' : 'btn-outline-red'"
    >
      {{ deleteNodeMode ? 'Cancel Delete Node' : 'Delete Node' }}
    </button>
    <button
      @click="toggleDeletePathMode"
      :class="deletePathMode ? 'btn-active-purple' : 'btn-outline-purple'"
    >
      {{ deletePathMode ? 'Cancel Delete Path' : 'Delete Path' }}
    </button>
    <button
      @click="togglePanMode"
      :class="panMode ? 'btn-active-indigo' : 'btn-outline-indigo'"
    >
      {{ panMode ? 'Cancel Pan' : 'Pan Mode' }}
    </button>
  </div>

  <!-- Canvas + Routes -->
  <div
    id="patchbay-canvas"
    class="relative border rounded h-[600px] bg-gray-100 overflow-hidden"
  >
    <CanvasView
      ref="canvasViewRef"
      :nodes="nodes"
      :connections="connections"
      :panMode="panMode"
      :linkingMode="linkingMode"
      :addMode="addMode"
      :deleteMode="deleteNodeMode"
      :deletePathMode="deletePathMode"
      :linkCandidateFromNodeId="linkCandidateFromNode?.id"
      :selectedNodeId="selectedNodeForMapping"
      @edit-node="openEditNodeFormViaPencil"
      @select-link-node="handleSelectLinkNode"
      @canvas-click="handleCanvasClick"
      @delete-node="handleDeleteSingleNode"
      @open-node-details="handleOpenNodeDetailsModal"
      @remove-route="removeRoute"
      @node-selected="handleNodeSelected"
    />
  </div>

  <!-- Simple Add/Edit Form -->
  <NodeForm
    v-if="editingNodeDataForSimpleForm"
    :node="editingNodeDataForSimpleForm"
    :gearList="gearList"
    @save="handleSaveNode"
    @delete="handleDeleteNodeFromForm"
    @close="closeSimpleNodeForm"
  />

  <!-- Node Detail / Port‐Mapping Modal -->
  <NodeDetailModal
    v-if="editingNodeForDetailModal"
    :nodeId="editingNodeForDetailModal.id"
    :gearList="gearList"
    :projectId="projectId"
    @close="closeNodeDetailModal"
    @node-updated="handleNodeUpdatedFromDetailModal"
    @connections-updated="handleConnectionsUpdatedFromDetailModal"
  />

  <!-- Add the modal component for connection details -->
  <ConnectionDetailsModal
    v-if="showConnectionModal"
    :fromNode="pendingConnection?.fromNode"
    :toNode="pendingConnection?.toNode"
    :defaultInput="pendingConnection?.input_number"
    :defaultOutput="pendingConnection?.output_number"
    :defaultTrack="pendingConnection?.track_number"
    @confirm="confirmConnectionDetails"
    @cancel="cancelConnectionDetails"
  />

  <!-- Add the simple link modal -->
  <SimpleLinkModal
    v-if="showSimpleLinkModal"
    :fromNode="pendingSimpleLink?.fromNode"
    :toNode="pendingSimpleLink?.toNode"
    @confirm="confirmSimpleLink"
    @cancel="cancelSimpleLink"
  />

  <!-- Add the matrix port mapper modal -->
  <MatrixPortMapper
    v-if="showMatrixPortMapper"
    :targetNodeId="matrixPortMapperNodeId"
    @close="closeMatrixPortMapper"
    @saved="handleMatrixPortMapperSaved"
  />
</div>
</template>

<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import { useRoute, useRouter }             from 'vue-router'
import { supabase }                        from '@/supabase'
import { usePatchBayStore }                from '@/stores/patchBayStore'
import { useGraphStore }                   from '@/stores/graphStore'
import html2canvas                         from 'html2canvas'
import { jsPDF }                           from 'jspdf'

import CanvasView      from '@/components/patchbay/CanvasView.vue'
import NodeForm        from '@/components/patchbay/NodeForm.vue'
import NodeDetailModal from '@/components/patchbay/NodeDetailModal.vue'
import ConnectionDetailsModal from '@/components/patchbay/ConnectionDetailsModal.vue'
import SimpleLinkModal from '@/components/patchbay/SimpleLinkModal.vue'
import MatrixPortMapper from '@/components/patchbay/MatrixPortMapper.vue'

const route    = useRoute()
const router   = useRouter()
const goBack = () => router.back()
const patchBay = usePatchBayStore()
const graphStore = useGraphStore()

// — Venue & Layouts —
const projectId     = computed(() => route.params.id)
const venues        = ref([])
const layouts       = computed(() => patchBay.layouts || [])
const gearList      = computed(() => patchBay.gearList || [])
const selectedVenue = ref(route.query.venueId ? Number(route.query.venueId) : null)
const selectedStage = ref(route.query.stageId ? Number(route.query.stageId) : null)

// --- Use shared graphStore for nodes/connections ---
const nodes = computed(() => graphStore.nodes)
const connections = computed(() => graphStore.connections)

async function fetchVenues() {
if (!projectId.value) return
const { data, error } = await supabase
  .from('venues')
  .select('id,venue_name')
  .eq('project_id', projectId.value)
  .order('venue_name')
if (!error) venues.value = data || []
}

onMounted(async () => {
await fetchVenues()
if (selectedVenue.value) {
  await patchBay.fetchGearList(projectId.value)
  await patchBay.loadLayouts(projectId.value, selectedVenue.value)
  if (selectedStage.value) {
    const L = patchBay.layouts.find(x => x.id === selectedStage.value)
    if (L) await patchBay.selectLayout(L)
    else   patchBay.clearLayout()
  } else {
    patchBay.clearLayout()
  }
}
})

// keep URL & store in sync
watch(projectId, async (n,o) => {
if (n === o) return
venues.value = []
selectedVenue.value = null
selectedStage.value = null
patchBay.clearLayout()
await fetchVenues()
router.replace({ query:{ ...route.query, venueId:undefined, stageId:undefined }})
})
watch(selectedVenue, async nv => {
router.replace({ query:{ ...route.query, venueId:nv||undefined, stageId:undefined }})
selectedStage.value = null
patchBay.clearLayout()
if (nv) await patchBay.loadLayouts(projectId.value, nv)
})
watch(selectedStage, async nv => {
router.replace({ query:{ ...route.query, stageId:nv||undefined }})
if (nv) {
  const L = patchBay.layouts.find(x => x.id === nv)
  if (L) await patchBay.selectLayout(L)
  else   patchBay.clearLayout()
} else {
  patchBay.clearLayout()
}
})

// — Mode toggles & shared state —
const addMode                      = ref(false)
const linkingMode                  = ref(false)
const deleteNodeMode               = ref(false)
const deletePathMode               = ref(false)
const panMode                      = ref(false)
const editingNodeDataForSimpleForm = ref(null)
const editingNodeForDetailModal    = ref(null)
const linkCandidateFromNode        = ref(null)
const canvasViewRef                = ref(null)

// Modal state for connection details
const pendingConnection = ref(null)
const showConnectionModal = ref(false)

// Modal state for simple link
const pendingSimpleLink = ref(null)
const showSimpleLinkModal = ref(false)

// Modal state for matrix port mapper
const showMatrixPortMapper = ref(false)
const matrixPortMapperNodeId = ref(null)
const selectedNodeForMapping = ref(null)

function setMode(mode) {
addMode.value        = mode === 'add'
linkingMode.value    = mode === 'link'
deleteNodeMode.value = mode === 'deleteNode'
deletePathMode.value = mode === 'deletePath'
panMode.value        = mode === 'pan'

if (mode !== 'add')  editingNodeDataForSimpleForm.value = null
if (mode !== 'link') linkCandidateFromNode.value        = null
editingNodeForDetailModal.value = null
}

const toggleAddMode        = () => setMode(addMode.value ? '' : 'add')
const toggleLinkMode       = () => setMode(linkingMode.value ? '' : 'link')
const toggleDeleteNodeMode = () => setMode(deleteNodeMode.value ? '' : 'deleteNode')
const toggleDeletePathMode = () => setMode(deletePathMode.value ? '' : 'deletePath')
const togglePanMode        = () => setMode(panMode.value ? '' : 'pan')

// — Close the inline add/edit form —
function closeSimpleNodeForm() {
editingNodeDataForSimpleForm.value = null
}

// — Add / Edit Node via Canvas —
function handleCanvasClick({ x,y }) {
if (!addMode.value) return
editingNodeDataForSimpleForm.value = {
  id: null, x, y,
  node_type: 'transformer',
  label: 'New Node',
  gear_id: null,
  numinputs: 1,
  num_outputs: 1,
  pad: false,
  phantom_power: false,
  wireless: false,
  signal_type: '',
  num_tracks: 0,
  port_map: null
}
// only turn off addMode, leave the form open
addMode.value = false
}

function openEditNodeFormViaPencil(nodeId) {
const n = nodes.value.find(n => n.id === nodeId)
if (!n) return
editingNodeDataForSimpleForm.value = { ...n }
setMode('add')
}

function handleSaveNode(payload) {
  // Use graphStore for add/update
  if (payload.id) graphStore.updateNode(payload)
  else graphStore.addNode(payload)
  closeSimpleNodeForm()
}

function handleDeleteNodeFromForm(nodeId) {
  if (!confirm('Delete this node?')) return
  graphStore.deleteNode(nodeId)
  closeSimpleNodeForm()
}

function handleDeleteSingleNode(nodeId) {
  if (!confirm('Delete this node and its connections?')) return
  graphStore.deleteNode(nodeId)
  setMode('')
}

// — Two‐click "Link Nodes" → simple link —
function handleSelectLinkNode(nodeId) {
  if (!linkingMode.value || nodeId == null) return
  const picked = nodes.value.find(n => n.id === nodeId)
  if (!picked) return

  // first click picks source
  if (!linkCandidateFromNode.value) {
    linkCandidateFromNode.value = picked
    return
  }
  // second click on same → cancel
  if (linkCandidateFromNode.value.id === picked.id) {
    linkCandidateFromNode.value = null
    return
  }

  // Check if link already exists
  const existingLink = connections.value.find(
    c => c.from === linkCandidateFromNode.value.id && c.to === picked.id
  )
  
  if (existingLink) {
    if (confirm('Link already exists between these nodes. Remove it?')) {
      graphStore.deleteConnection(existingLink.id)
    }
    linkCandidateFromNode.value = null
    setMode('')
    return
  }

  // Add connection
  graphStore.addConnection({
    id: 'conn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    from: linkCandidateFromNode.value.id,
    to: picked.id
  })
  linkCandidateFromNode.value = null
  setMode('')
}

// Handler for when the user confirms the connection details in the modal
function confirmConnectionDetails({ input_number, output_number, track_number }) {
  // You can extend this to support more detailed connection info if needed
  // For now, just add a basic connection
  if (pendingConnection.value && pendingConnection.value.fromNode && pendingConnection.value.toNode) {
    graphStore.addConnection({
      id: 'conn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      from: pendingConnection.value.fromNode.id,
      to: pendingConnection.value.toNode.id
    })
  }
  showConnectionModal.value = false
  pendingConnection.value = null
  setMode('')
}

function cancelConnectionDetails() {
  showConnectionModal.value = false
  pendingConnection.value = null
  setMode('')
}

// — Delete a path on canvas —
function removeRoute(connId) {
  if (!confirm('Delete this path?')) return
  graphStore.deleteConnection(connId)
  setMode('')
}

function handleOpenNodeDetailsModal(nodeId) {
  setMode('')
  editingNodeForDetailModal.value = nodes.value.find(n => n.id === nodeId) || null
}
function closeNodeDetailModal() {
  editingNodeForDetailModal.value = null
}
function handleNodeUpdatedFromDetailModal() { /* no-op */ }
function handleConnectionsUpdatedFromDetailModal() { /* no-op */ }

function openMatrixPortMapper(nodeId) {
  matrixPortMapperNodeId.value = nodeId
  showMatrixPortMapper.value = true
  setMode('')
}

function closeMatrixPortMapper() {
  showMatrixPortMapper.value = false
  matrixPortMapperNodeId.value = null
}

function handleMatrixPortMapperSaved() { /* no-op */ }

function handleNodeSelected(nodeId) {
  selectedNodeForMapping.value = nodeId
}

function confirmSimpleLink(link) {
  graphStore.addConnection({
    id: 'conn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    from: link.fromNode.id,
    to: link.toNode.id
  })
  showSimpleLinkModal.value = false
  pendingSimpleLink.value = null
  setMode('')
}

function cancelSimpleLink() {
  showSimpleLinkModal.value = false
  pendingSimpleLink.value = null
  setMode('')
}

// — Export functions —
async function exportPdf() {
  try {
    const canvasElement = document.getElementById('patchbay-canvas')
    if (!canvasElement) {
      alert('Canvas element not found')
      return
    }

    // Store original transforms and reset them temporarily for better iPad compatibility
    // Find the panzoom root (the div with border-2 class that contains the panzoom content)
    const panzoomRoot = canvasElement.querySelector('.border-2.border-gray-400') || null
    let originalTransform = ''
    
    if (panzoomRoot) {
      originalTransform = panzoomRoot.style.transform || ''
      // Temporarily reset panzoom transforms for capture (iPad compatibility)
      panzoomRoot.style.transform = 'translate(0px, 0px) scale(1)'
    }

    // Use html2canvas with iPad/mobile-friendly options
    const canvas = await html2canvas(canvasElement, {
      useCORS: true,
      allowTaint: false,
      scale: 2, // Higher resolution for better quality
      logging: false,
      backgroundColor: '#f3f4f6', // Match the bg-gray-100 background
      // Important for iPad/iOS compatibility
      removeContainer: false,
      imageTimeout: 20000, // Longer timeout for iPad
      // Handle SVG and foreign elements better
      foreignObjectRendering: true,
      // Better handling on mobile Safari
      proxy: undefined,
      // Ensure proper rendering on touch devices
      onclone: (clonedDoc) => {
        // Reset all transforms in the cloned document for clean capture
        const clonedCanvas = clonedDoc.getElementById('patchbay-canvas')
        if (clonedCanvas) {
          // Reset any transforms on the container
          const clonedPanzoom = clonedCanvas.querySelector('.absolute')
          if (clonedPanzoom) {
            clonedPanzoom.style.transform = 'translate(0px, 0px) scale(1)'
            clonedPanzoom.style.position = 'absolute'
          }
          // Ensure overflow is visible for capture
          clonedCanvas.style.overflow = 'visible'
        }
      }
    })

    // Restore original transform after capture
    if (panzoomRoot && originalTransform) {
      panzoomRoot.style.transform = originalTransform
    }

    // Create PDF with proper dimensions
    const imgWidth = 210 // A4 width in mm
    const pageHeight = 297 // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    let heightLeft = imgHeight

    const doc = new jsPDF('p', 'mm', 'a4')
    let position = 0

    // Add first page
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight

    // Add additional pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight
      doc.addPage()
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    // Save PDF - use method that works on iPad
    const fileName = `patchbay-${selectedStage.value || 'export'}-${Date.now()}.pdf`
    
    // For iPad/iOS and better cross-browser compatibility, use blob approach
    try {
      // Try to get blob directly (works on modern browsers including iPad Safari)
      const pdfBlob = doc.output('blob')
      const url = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      // Clean up after a delay
      setTimeout(() => URL.revokeObjectURL(url), 100)
    } catch (blobError) {
      // Fallback: try using data URI (less reliable on iPad but may work)
      try {
        const pdfDataUri = doc.output('datauristring')
        const link = document.createElement('a')
        link.href = pdfDataUri
        link.download = fileName
        link.style.display = 'none'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } catch (dataUriError) {
        // Final fallback: use jsPDF's save method
        doc.save(fileName)
      }
    }
  } catch (error) {
    console.error('PDF export error:', error)
    alert('Failed to export PDF. Error: ' + (error.message || 'Unknown error'))
  }
}

async function exportImage() {
  try {
    const canvasElement = document.getElementById('patchbay-canvas')
    if (!canvasElement) {
      alert('Canvas element not found')
      return
    }

    // Store original transforms and reset them temporarily for better iPad compatibility
    // Find the panzoom root (the div with border-2 class that contains the panzoom content)
    const panzoomRoot = canvasElement.querySelector('.border-2.border-gray-400') || null
    let originalTransform = ''
    
    if (panzoomRoot) {
      originalTransform = panzoomRoot.style.transform || ''
      // Temporarily reset panzoom transforms for capture (iPad compatibility)
      panzoomRoot.style.transform = 'translate(0px, 0px) scale(1)'
    }

    // Use html2canvas with iPad/mobile-friendly options
    const canvas = await html2canvas(canvasElement, {
      useCORS: true,
      allowTaint: false,
      scale: 2, // Higher resolution for better quality
      logging: false,
      backgroundColor: '#f3f4f6', // Match the bg-gray-100 background
      // Important for iPad/iOS compatibility
      removeContainer: false,
      imageTimeout: 20000, // Longer timeout for iPad
      // Handle SVG and foreign elements better
      foreignObjectRendering: true,
      // Better handling on mobile Safari
      proxy: undefined,
      // Ensure proper rendering on touch devices
      onclone: (clonedDoc) => {
        // Reset all transforms in the cloned document for clean capture
        const clonedCanvas = clonedDoc.getElementById('patchbay-canvas')
        if (clonedCanvas) {
          // Reset any transforms on the container
          const clonedPanzoom = clonedCanvas.querySelector('.absolute')
          if (clonedPanzoom) {
            clonedPanzoom.style.transform = 'translate(0px, 0px) scale(1)'
            clonedPanzoom.style.position = 'absolute'
          }
          // Ensure overflow is visible for capture
          clonedCanvas.style.overflow = 'visible'
        }
      }
    })

    // Restore original transform after capture
    if (panzoomRoot && originalTransform) {
      panzoomRoot.style.transform = originalTransform
    }

    // Convert to blob and download
    canvas.toBlob((blob) => {
      if (!blob) {
        alert('Failed to create image')
        return
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `patchbay-${selectedStage.value || 'export'}-${Date.now()}.png`
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      // Clean up after a delay
      setTimeout(() => URL.revokeObjectURL(url), 100)
    }, 'image/png', 1.0)
  } catch (error) {
    console.error('Image export error:', error)
    alert('Failed to export image. Error: ' + (error.message || 'Unknown error'))
  }
}
</script>

<style scoped>
.input-std {
@apply border border-gray-300 rounded px-3 py-2
       focus:ring-blue-500 focus:border-blue-500 text-sm;
}
select:disabled {
background-color: #f3f4f6;
cursor: not-allowed;
}

/* Mode buttons */
.btn-outline-green {
@apply bg-white hover:bg-green-50 border border-green-600 text-green-600
       px-4 py-2 rounded text-sm font-medium transition-colors;
}
.btn-active-green   { @apply bg-green-600 text-white; }
.btn-outline-yellow {
@apply bg-white hover:bg-yellow-50 border border-yellow-500 text-yellow-500
       px-4 py-2 rounded text-sm font-medium transition-colors;
}
.btn-active-yellow  { @apply bg-yellow-500 text-white; }
.btn-outline-red {
@apply bg-white hover:bg-red-50 border border-red-600 text-red-600
       px-4 py-2 rounded text-sm font-medium transition-colors;
}
.btn-active-red     { @apply bg-red-600 text-white; }
.btn-outline-purple {
@apply bg-white hover:bg-purple-50 border border-purple-600 text-purple-600
       px-4 py-2 rounded text-sm font-medium transition-colors;
}
.btn-active-purple  { @apply bg-purple-600 text-white; }
.btn-outline-indigo {
@apply bg-white hover:bg-indigo-50 border border-indigo-600 text-indigo-600
       px-4 py-2 rounded text-sm font-medium transition-colors;
}
.btn-active-indigo  { @apply bg-indigo-600 text-white; }
.btn-outline-cyan {
@apply bg-white hover:bg-cyan-50 border border-cyan-600 text-cyan-600
       px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50;
}

/* Export buttons */
.btn-outline-blue {
@apply bg-white hover:bg-blue-50 border border-blue-600 text-blue-600
       px-4 py-2 rounded text-sm font-medium transition-colors;
}
.btn-outline-green {
@apply bg-white hover:bg-green-50 border border-green-600 text-green-600
       px-4 py-2 rounded text-sm font-medium transition-colors;
}

/* ← NEW: Back-button styling */
.btn-outline-gray {
  @apply bg-white hover:bg-gray-100 border border-gray-400 text-gray-700
         px-4 py-2 rounded text-sm font-medium transition-colors;
}
</style>