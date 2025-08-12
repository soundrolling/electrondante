<template>
<div id="SignalMapper" class="signalmapper-container">
  <!-- Top Navigation Bar -->
  <div class="signalmapper-topbar">
    <button class="back-button" @click="goBack" aria-label="Back">← Back</button>
    <div class="location-label" v-if="currentLocation">
      <strong>Location:</strong>
      {{ currentLocation.venue_name }} – {{ currentLocation.stage_name }}
    </div>
    <div class="location-label" v-else>
      <strong>No location found.</strong>
    </div>
  </div>

  <div v-if="selectedLocationId && currentLocation">
    <!-- Title row with Doc/Exports button -->
    <div class="signalmapper-title-row">
      <h3 class="signalmapper-title">Signal Mapper Tool</h3>
      <button class="doc-btn" @click="showDocModal = true">Doc / Exports</button>
    </div>
    <p>
      Visualize and manage your signal flow from source to recorder. Place gear on floorplans, 
      connect signal paths, and track your entire audio chain.
    </p>

    <!-- Image Upload & Controls -->
    <div class="image-controls">
      <button @click="showImageSettings = !showImageSettings" aria-label="Image Settings" title="Image Settings">🖼️ Image Settings</button>
      <div v-if="showImageSettings" class="image-settings-popover" @click.stop>
        <div class="settings-row">
          <label><input type="checkbox" v-model="panImageMode" /> Pan Image</label>
        </div>
        <div class="settings-row">
          <button @click="zoomIn" :disabled="!bgImage">Zoom In</button>
          <button @click="zoomOut" :disabled="!bgImage">Zoom Out</button>
          <button @click="resetImageView" :disabled="!bgImage">Reset</button>
        </div>
        <div class="settings-row">
          <label>Opacity
            <input type="range" min="0.1" max="1" step="0.05" v-model.number="bgOpacity" />
            <span>{{ Math.round(bgOpacity * 100) }}%</span>
          </label>
        </div>
        <div class="settings-row">
          <input type="file" accept="image/*" @change="onImageUpload" id="image-upload-settings" style="display:none" />
          <button @click="triggerImageUploadSettings">Replace Image</button>
        </div>
      </div>
    </div>

    <!-- Unified Toolbar -->
    <div class="signalmapper-toolbar">
      <button :class="{ active: tool === 'select' }" @click="setTool('select')" aria-label="Select Tool" title="Select/Move (V)">👆</button>
      <button :class="{ active: tool === 'gear' }" @click="openGearSelectionModal" aria-label="Add Gear" title="Add Gear">➕</button>
      <button :class="{ active: tool === 'freehand' }" @click="setTool('freehand')" aria-label="Freehand Tool" title="Freehand Draw (F)">✏️</button>
      <button :class="{ active: tool === 'line' }" @click="setTool('line')" aria-label="Line Tool" title="Line Tool (L)">📏</button>
      <button :class="{ active: tool === 'text' }" @click="setTool('text')" aria-label="Text Tool" title="Text Tool (T)">🏷️</button>
      <button :class="{ active: tool === 'link' }" @click="setTool('link')" aria-label="Link Tool" title="Link/Connect Gear (C)">🔗</button>
      <button @click="deleteSelectedElement" :disabled="!hasSelectedElement" aria-label="Delete Selected" title="Delete Selected Element">🗑️</button>
      <div class="toolbar-divider"></div>
      <button @click="saveLayout" title="Save Layout">💾 Save</button>
      <button @click="openSavedLayoutsModal" title="Load Layout">📂 Load</button>
    </div>

    <!-- Canvas Management -->
    <div class="canvas-management">
      <div class="canvas-stats">
        <span class="stat-item">Gear: {{ connectionStats.gearCount }}</span>
        <span class="stat-item">Connections: {{ connectionStats.connectionCount }}</span>
        <span class="stat-item">Connected: {{ connectionStats.connectedGear }}</span>
      </div>
      <button @click="clearAll" :disabled="!elements.length" class="clear-canvas-btn">
        🗑️ Clear Canvas
      </button>
    </div>

    <!-- Unified Canvas Area -->
    <div class="signalmapper-canvas-container">
      <div class="canvas-wrapper">
        <canvas ref="canvas" 
                :width="canvasWidth * dpr" 
                :height="canvasHeight * dpr"
                :style="canvasStyle"
                @pointerdown="onPointerDown"
                @pointermove="onPointerMove"
                @pointerup="onPointerUp"
                @pointerleave="onPointerUp"
                @touchstart.prevent="onTouchStart"
                @touchmove.prevent="onTouchMove"
                @touchend.prevent="onTouchEnd"
                @click="onCanvasClick"
                @dblclick="onCanvasDblClick"
        />
        <div v-if="tool !== 'select'" class="tool-indicator">
          Active Tool: {{ tool.toUpperCase() }}
          <span v-if="panImageMode" class="pan-indicator"> (Pan Mode ON)</span>
          <span v-if="tool === 'link' && linkSourceElement" class="link-indicator"> (Selecting target...)</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Documentation Modal -->
  <div v-if="showDocModal" class="modal-overlay" @click="showDocModal = false">
    <div class="modal-content large" @click.stop>
      <div class="modal-header">
        <div class="modal-header-content">
          <h3>Signal Mapper Documentation</h3>
          <p class="modal-subtitle">Comprehensive documentation of your signal flow setup</p>
        </div>
        <button @click="showDocModal = false" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <SignalMapperDocumentation 
          :key="JSON.stringify(elements)"
          :locationId="selectedLocationId" 
          :projectId="projectId"
          :gear="documentationData.gear"
          :connections="documentationData.connections"
        />
      </div>
    </div>
  </div>

  <!-- Gear Selection Modal -->
  <div v-if="showGearModal" class="modal-overlay" @click="closeGearModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <div class="modal-header-content">
          <h3>Select Gear</h3>
          <p class="modal-subtitle">Only gear assigned to {{ currentLocation?.stage_name }} is shown</p>
        </div>
        <button @click="closeGearModal" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <div class="gear-categories">
          <button 
            v-for="category in gearCategories"
            :key="category"
            @click="selectedCategory = category"
            :class="{ active: selectedCategory === category }"
            class="category-btn"
          >
            {{ category }}
          </button>
        </div>
        <div v-if="loading" class="loading-indicator">
          <p>Loading gear...</p>
        </div>
        <div v-else-if="error" class="error-message">
          <p>{{ error }}</p>
        </div>
        <div v-else class="gear-list">
          <div 
            v-for="gear in filteredGear"
            :key="gear.id"
            @click="selectGear(gear)"
            class="gear-item"
            :class="{ 'user-gear': gear.is_user_gear, 'no-available': (gear.assignments?.[selectedLocationId] || 0) - elements.filter(el => el.type === 'gear' && el.gearId === gear.id).length <= 0 }"
          >
            <div class="gear-icon">{{ getGearIcon(gear.gear_type) }}</div>
            <div class="gear-info">
              <div class="gear-name">{{ gear.gear_name }}</div>
              <div class="gear-details">
                <div class="gear-type">{{ gear.gear_type }}</div>
                <div class="gear-availability">
                  <span class="available-label">Available:</span>
                  <span class="available-amount">
                    {{ (gear.assignments?.[selectedLocationId] || 0) - elements.filter(el => el.type === 'gear' && el.gearId === gear.id).length }}/{{ gear.assignments?.[selectedLocationId] || 0 }}
                  </span>
                </div>
                <div v-if="gear.is_user_gear" class="user-gear-info">
                  <span class="owner-label">Owner:</span>
                  <span class="owner-name">{{ gear.owner_name || 'Unknown' }}</span>
                </div>
                <div v-if="gear.num_inputs !== undefined || gear.num_outputs !== undefined" class="gear-ports">
                  {{ gear.num_inputs || 0 }} in, {{ gear.num_outputs || 0 }} out
                  <span v-if="gear.num_records || gear.num_tracks">, {{ gear.num_records || gear.num_tracks }} tracks</span>
                </div>
              </div>
            </div>
            <div class="gear-action">
              <button 
                :class="['assign-btn', { 'assign-btn-disabled': (gear.assignments?.[selectedLocationId] || 0) - elements.filter(el => el.type === 'gear' && el.gearId === gear.id).length <= 0 }]"
                :disabled="(gear.assignments?.[selectedLocationId] || 0) - elements.filter(el => el.type === 'gear' && el.gearId === gear.id).length <= 0"
                @click.stop="selectGear(gear)"
              >
                {{ (gear.assignments?.[selectedLocationId] || 0) - elements.filter(el => el.type === 'gear' && el.gearId === gear.id).length > 0 ? 'Assign' : 'None Available' }}
              </button>
            </div>
          </div>
                      <div v-if="filteredGear.length === 0" class="no-gear">
          <p v-if="selectedCategory === 'All'">
            No gear assigned to this location. Please assign gear to {{ currentLocation?.stage_name }} first.
          </p>
          <p v-else>
            No {{ selectedCategory.toLowerCase() }} gear assigned to this location.
          </p>
        </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Connection Details Modal -->
  <ConnectionDetailsModal
    v-if="showConnectionModal"
    :fromNode="pendingConnection?.fromNode"
    :toNode="pendingConnection?.toNode"
    :defaultInput="pendingConnection?.input_number"
    :defaultOutput="pendingConnection?.output_number"
    :defaultTrack="pendingConnection?.track_number"
    :existingConnections="elements.filter(e => e.type === 'connection')"
    :elements="elements"
    :projectId="projectId"
    @confirm="confirmConnection"
    @cancel="closeConnectionModal"
  />

  <!-- Gear Management Modal -->
  <div v-if="showGearManagementModal" class="modal-overlay" @click="closeGearManagementModal">
    <div class="modal-content large" @click.stop>
      <div class="modal-header">
        <h3>Manage Gear Assignments</h3>
        <button @click="closeGearManagementModal" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <div class="gear-management-content">
          <div class="gear-assignments-list">
            <h4>Current Assignments for {{ currentLocation?.stage_name }}</h4>
            <div v-if="loading" class="loading-indicator">
              <p>Loading assignments...</p>
            </div>
            <div v-else-if="assignedGear.length === 0" class="no-assignments">
              <p>No gear assigned to this location.</p>
            </div>
            <div v-else class="assignments-list">
              <div 
                v-for="gear in assignedGear" 
                :key="gear.id"
                class="assignment-item"
              >
                <div class="assignment-info">
                  <div class="gear-name">{{ gear.gear_name }}</div>
                  <div class="assignment-details">
                    <span class="assigned-amount">{{ gear.assigned_amount }} assigned</span>
                    <span class="total-amount">of {{ gear.gear_amount }} total</span>
                  </div>
                </div>
                <div class="assignment-actions">
                  <button 
                    class="btn btn-sm btn-danger"
                    @click="removeAssignment(gear)"
                    :disabled="gear.assigned_amount <= 0"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Matrix Port Mapper Modal -->
  <div v-if="showMatrixPortModal" class="modal-overlay" @click="closeMatrixPortModal">
    <div class="modal-content large" @click.stop>
      <div class="modal-header">
        <h3>Matrix Port Mapping</h3>
        <button @click="closeMatrixPortModal" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <MatrixPortMapper
          :targetNodeId="matrixPortMapperNodeId"
          @close="closeMatrixPortModal"
          @saved="handleMatrixPortMapperSaved"
        />
      </div>
    </div>
  </div>

  <!-- Saved Layouts Modal -->
  <div v-if="showSavedLayoutsModal" class="modal-overlay" @click="closeSavedLayoutsModal">
    <div class="modal-content large" @click.stop>
      <div class="modal-header">
        <h3>Saved Layouts</h3>
        <button @click="closeSavedLayoutsModal" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <div v-if="loadingLayouts" class="loading-indicator">
          <p>Loading saved layouts...</p>
        </div>
        <div v-else-if="savedLayouts.length === 0" class="no-layouts">
          <p>No saved layouts found for this location.</p>
        </div>
        <div v-else class="saved-layouts-list">
          <div 
            v-for="layout in savedLayouts" 
            :key="layout.id"
            class="layout-item"
          >
            <div class="layout-info">
              <div class="layout-name">{{ layout.name }}</div>
              <div class="layout-details">
                <span class="layout-date">{{ new Date(layout.inserted_at).toLocaleString() }}</span>
                <span v-if="layout.created_email" class="layout-author">by {{ layout.created_email }}</span>
              </div>
              <div class="layout-stats">
                <span>{{ layout.elements?.length || 0 }} elements</span>
                <span>{{ layout.canvas_width }}×{{ layout.canvas_height }}</span>
              </div>
            </div>
            <div class="layout-actions">
              <button @click="loadSpecificLayout(layout)" class="load-btn">Load</button>
              <button @click="deleteLayout(layout.id)" class="delete-btn">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <NodeConnectionMatrixModal
    v-if="showMatrixModal"
    :node="matrixModalNode"
    :elements="elements"
    :connections="elements.filter(e => e.type === 'connection')"
    :projectId="projectId"
    @close="closeMatrixModal"
    @edit-connection="editConnectionFromMatrix"
    @save="handleMatrixSave"
  />
</div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/supabase'
import { fetchTableData, mutateTableData } from '@/services/dataService'
import { useToast } from 'vue-toastification'
import SignalMapperLayout from './SignalMapperLayout.vue'
import SignalMapperFlow from './SignalMapperFlow.vue'
import SignalMapperDocumentation from './SignalMapperDocumentation.vue'
import ConnectionDetailsModal from './ConnectionDetailsModal.vue'
import MatrixPortMapper from '../patchbay/MatrixPortMapper.vue'
import jsPDF from 'jspdf'
import NodeConnectionMatrixModal from './NodeConnectionMatrixModal.vue'
import { 
  getNodes, 
  addNode, 
  updateNode, 
  deleteNode, 
  getConnections, 
  addConnection as addConnectionToDB, 
  updateConnection, 
  deleteConnection,
  subscribeToNodes,
  subscribeToConnections
} from '@/services/signalMapperService'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const goBack = () => router.back()

const props = defineProps({
locationId: {
  type: [String, Number],
  default: null
},
projectId: {
  type: [String, Number],
  required: true
}
})

// Main state for unified canvas
const tool = ref('select')
const connections = ref([]) // For explicit connection objects if needed
const selectedElement = ref(null)
const canvas = ref(null)

// Linking state
const linkSourceElement = ref(null)
const linkMode = ref(false)

// Component state
const currentMode = ref('layout')
const selectedLocationId = ref(null)
const currentLocation = ref(null)
const projectId = computed(() => props.projectId || route.params.id)

// Modal states
const showGearModal = ref(false)
const showGearManagementModal = ref(false)
const showConnectionModal = ref(false)
const showMatrixPortModal = ref(false)
const showImageSettings = ref(false)
const showSavedLayoutsModal = ref(false)
const selectedCategory = ref('All')
const pendingConnection = ref(null)
const matrixPortMapperNodeId = ref(null)
const showMatrixModal = ref(false)
const matrixModalNode = ref(null)

// Gear data
const gearList = ref([])
const gearCategories = ['All', 'Sources', 'Transformers', 'Recorders', 'Other']
const loading = ref(false)
const error = ref(null)

// Database loading states
const loadingNodes = ref(false)
const loadingConnections = ref(false)
const savingNode = ref(false)
const savingConnection = ref(false)

const filteredGear = computed(() => {
  // First filter to only show gear assigned to current location
  const assignedGear = gearList.value.filter(gear => 
    gear.assignments?.[selectedLocationId.value] > 0
  )
  
  if (selectedCategory.value === 'All') return assignedGear
  
  const categoryMap = {
    'Sources': ['source'],
    'Transformers': ['transformer'],
    'Recorders': ['recorder'],
    'Other': ['user_gear']
  }
  
  const validTypes = categoryMap[selectedCategory.value] || []
  return assignedGear.filter(gear => 
    validTypes.some(type => gear.gear_type?.includes(type))
  )
})

const assignedGear = computed(() => {
if (!selectedLocationId.value) return []
return gearList.value
  .filter(gear => gear.assignments?.[selectedLocationId.value] > 0)
  .map(gear => ({
    ...gear,
    assigned_amount: gear.assignments[selectedLocationId.value]
  }))
})

// Additional state
const isDrawing = ref(false)
const drawingPath = ref([])
let dragStart = null
let dragStartPos = null
let draggingElement = null
const linkStartElement = ref(null)

// Documentation modal state
const showDocModal = ref(false)

// Device pixel ratio for crisp canvas
const dpr = window.devicePixelRatio || 1
const canvasWidth = ref(500)
const canvasHeight = ref(500)
const canvasStyle = computed(() => `width: ${canvasWidth.value}px; height: ${canvasHeight.value}px; display: block; margin: 0 auto; background: #fff; border-radius: 8px; border: 1px solid #e9ecef; max-width: 100%; min-height: 300px;`)

// --- Image pan/zoom state ---
const imageOffsetX = ref(0)
const imageOffsetY = ref(0)
const scaleFactor = ref(1)

// --- Image state ---
const bgImage = ref(null)
const bgImageObj = ref(null)

// --- Elements: store in image-relative coordinates ---
const elements = ref([]) // { x: imgX, y: imgY, ... }

// --- Image upload: fit and center image ---
function onImageUpload(e) {
const file = e.target.files[0]
if (!file) return
const reader = new FileReader()
reader.onload = function(ev) {
  bgImage.value = ev.target.result
  const img = new window.Image()
  img.onload = () => {
    bgImageObj.value = img
    // Fit image to canvas, preserve aspect ratio
    const fit = fitImageToCanvas(img)
    scaleFactor.value = fit.scale
    imageOffsetX.value = fit.offsetX
    imageOffsetY.value = fit.offsetY
    drawCanvas()
  }
  img.src = ev.target.result
}
reader.readAsDataURL(file)
}

// --- Image fit helpers ---
function fitImageToCanvas(img) {
// Calculate scale and offset to fit image in canvas, preserving aspect ratio
const canvasW = canvasWidth.value
const canvasH = canvasHeight.value
const imgW = img.width
const imgH = img.height
const scale = Math.min(canvasW / imgW, canvasH / imgH)
const offsetX = (canvasW - imgW * scale) / 2
const offsetY = (canvasH - imgH * scale) / 2
return { scale, offsetX, offsetY }
}

function resetImageView() {
if (bgImageObj.value) {
  const fit = fitImageToCanvas(bgImageObj.value)
  scaleFactor.value = fit.scale
  imageOffsetX.value = fit.offsetX
  imageOffsetY.value = fit.offsetY
  drawCanvas()
} else {
  imageOffsetX.value = 0
  imageOffsetY.value = 0
  scaleFactor.value = 1
  drawCanvas()
}
}

function zoomIn() { scaleFactor.value *= 1.1; drawCanvas() }
function zoomOut() { scaleFactor.value /= 1.1; drawCanvas() }

// --- Drawing ---
function drawCanvas() {
const ctx = canvas.value?.getContext('2d')
if (!ctx) return
ctx.setTransform(1, 0, 0, 1, 0, 0)
ctx.clearRect(0, 0, canvasWidth.value * dpr, canvasHeight.value * dpr)
ctx.scale(dpr, dpr)

// Always draw a white background
ctx.fillStyle = '#fff'
ctx.fillRect(0, 0, canvasWidth.value, canvasHeight.value)

// Draw image with opacity
if (bgImageObj.value) {
  ctx.globalAlpha = bgOpacity.value
  ctx.drawImage(
    bgImageObj.value,
    imageOffsetX.value,
    imageOffsetY.value,
    bgImageObj.value.width * scaleFactor.value,
    bgImageObj.value.height * scaleFactor.value
  )
  ctx.globalAlpha = 1.0 // Reset for elements
}

// Draw elements
elements.value.forEach(el => {
  drawElement(ctx, el)
})

// Draw preview for current drawing operation
if (isDrawing.value && drawingPath.value.length > 0) {
  drawDrawingPreview(ctx)
}
}

function drawElement(ctx, el) {
const { x, y } = imageToCanvasCoords(el.x, el.y)

ctx.save()

switch (el.type) {
  case 'gear':
    // Draw gear as circle
    ctx.beginPath()
    ctx.arc(x, y, 28, 0, 2 * Math.PI)
    ctx.fillStyle = '#fff' // solid white fill
    ctx.strokeStyle = el.selected ? '#0056b3' : '#007bff'
    ctx.lineWidth = el.selected ? 3 : 2
    ctx.fill()
    ctx.stroke()
    
    // Add selection indicator
    if (el.selected) {
      ctx.beginPath()
      ctx.arc(x, y, 35, 0, 2 * Math.PI)
      ctx.strokeStyle = '#007bff'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.stroke()
      ctx.setLineDash([])
    }
    
    ctx.fillStyle = '#222'
    ctx.font = 'bold 14px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(el.label, x, y)
    break
    
  case 'text':
    // Draw text element
    const textCoords = imageToCanvasCoords(el.x, el.y)
    
    // Add selection background for text
    if (el.selected) {
      const textMetrics = ctx.measureText(el.text)
      const padding = 8
      ctx.fillStyle = 'rgba(0, 123, 255, 0.2)'
      ctx.fillRect(
        textCoords.x - textMetrics.width/2 - padding,
        textCoords.y - 10 - padding,
        textMetrics.width + padding * 2,
        20 + padding * 2
      )
    }
    
    ctx.fillStyle = el.color || '#222'
    ctx.font = `${el.size || 18}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(el.text, textCoords.x, textCoords.y)
    break
    
  case 'line':
    // Draw line element
    const startCoords = imageToCanvasCoords(el.x1, el.y1)
    const endCoords = imageToCanvasCoords(el.x2, el.y2)
    ctx.strokeStyle = el.selected ? '#007bff' : (el.color || '#000000')
    ctx.lineWidth = el.selected ? 4 : (el.width || 2)
    ctx.beginPath()
    ctx.moveTo(startCoords.x, startCoords.y)
    ctx.lineTo(endCoords.x, endCoords.y)
    ctx.stroke()
    
    // Add selection handles for line
    if (el.selected) {
      ctx.fillStyle = '#007bff'
      ctx.beginPath()
      ctx.arc(startCoords.x, startCoords.y, 6, 0, 2 * Math.PI)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(endCoords.x, endCoords.y, 6, 0, 2 * Math.PI)
      ctx.fill()
    }
    break
    
  case 'connection':
    // Draw connection between gear elements
    // Calculate edge-to-edge points
    const fromEl = elements.value.find(e => e.id === el.from)
    const toEl = elements.value.find(e => e.id === el.to)
    let start = imageToCanvasCoords(fromEl?.x ?? el.x1, fromEl?.y ?? el.y1)
    let end = imageToCanvasCoords(toEl?.x ?? el.x2, toEl?.y ?? el.y2)
    // Move start/end to edge of gear circle (radius 28)
    function moveToEdge(pt1, pt2, radius) {
      const dx = pt2.x - pt1.x
      const dy = pt2.y - pt1.y
      const dist = Math.sqrt(dx*dx + dy*dy)
      if (dist === 0) return pt1
      return {
        x: pt1.x + (dx * radius) / dist,
        y: pt1.y + (dy * radius) / dist
      }
    }
    start = moveToEdge(start, end, 28)
    end = moveToEdge(end, start, 28)
    ctx.strokeStyle = el.selected ? '#007bff' : (el.color || '#007bff')
    ctx.lineWidth = el.selected ? 5 : (el.width || 3)
    ctx.setLineDash([8, 4]) // Dashed line for connections
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
    ctx.setLineDash([])
    // Draw arrowhead at midpoint
    function drawArrowhead(ctx, from, to, size = 12) {
      const angle = Math.atan2(to.y - from.y, to.x - from.x)
      const mx = (from.x + to.x) / 2
      const my = (from.y + to.y) / 2
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(mx, my)
      ctx.lineTo(mx - size * Math.cos(angle - Math.PI / 6), my - size * Math.sin(angle - Math.PI / 6))
      ctx.moveTo(mx, my)
      ctx.lineTo(mx - size * Math.cos(angle + Math.PI / 6), my - size * Math.sin(angle + Math.PI / 6))
      ctx.strokeStyle = el.selected ? '#007bff' : (el.color || '#007bff')
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.restore()
    }
    drawArrowhead(ctx, start, end)
    // Add selection indicators for connection
    if (el.selected) {
      ctx.fillStyle = '#007bff'
      ctx.beginPath()
      ctx.arc(start.x, start.y, 8, 0, 2 * Math.PI)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(end.x, end.y, 8, 0, 2 * Math.PI)
      ctx.fill()
    }
    break
    
  case 'freehand':
    // Draw freehand path
    if (el.path && el.path.length > 1) {
      ctx.strokeStyle = el.selected ? '#007bff' : (el.color || '#000000')
      ctx.lineWidth = el.selected ? 4 : (el.width || 2)
      ctx.beginPath()
      const firstPoint = imageToCanvasCoords(el.path[0].x, el.path[0].y)
      ctx.moveTo(firstPoint.x, firstPoint.y)
      for (let i = 1; i < el.path.length; i++) {
        const point = imageToCanvasCoords(el.path[i].x, el.path[i].y)
        ctx.lineTo(point.x, point.y)
      }
      ctx.stroke()
      
      // Add selection bounding box for freehand
      if (el.selected) {
        const bounds = getFreehandBounds(el.path)
        const minCoords = imageToCanvasCoords(bounds.minX, bounds.minY)
        const maxCoords = imageToCanvasCoords(bounds.maxX, bounds.maxY)
        ctx.strokeStyle = '#007bff'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.strokeRect(minCoords.x - 5, minCoords.y - 5, maxCoords.x - minCoords.x + 10, maxCoords.y - minCoords.y + 10)
        ctx.setLineDash([])
      }
    }
    break
}

ctx.restore()
}

function drawDrawingPreview(ctx) {
if (tool.value === 'freehand' && drawingPath.value.length > 1) {
  // Draw freehand preview
  ctx.strokeStyle = '#007bff'
  ctx.lineWidth = 2
  ctx.beginPath()
  const firstPoint = imageToCanvasCoords(drawingPath.value[0].x, drawingPath.value[0].y)
  ctx.moveTo(firstPoint.x, firstPoint.y)
  for (let i = 1; i < drawingPath.value.length; i++) {
    const point = imageToCanvasCoords(drawingPath.value[i].x, drawingPath.value[i].y)
    ctx.lineTo(point.x, point.y)
  }
  ctx.stroke()
} else if (tool.value === 'line' && drawingPath.value.length === 2) {
  // Draw line preview
  const startCoords = imageToCanvasCoords(drawingPath.value[0].x, drawingPath.value[0].y)
  const endCoords = imageToCanvasCoords(drawingPath.value[1].x, drawingPath.value[1].y)
  ctx.strokeStyle = '#007bff'
  ctx.lineWidth = 2
  ctx.setLineDash([5, 5])
  ctx.beginPath()
  ctx.moveTo(startCoords.x, startCoords.y)
  ctx.lineTo(endCoords.x, endCoords.y)
  ctx.stroke()
  ctx.setLineDash([])
}
}

// --- Element placement ---

// --- Dragging logic ---
function onPointerDown(e) {
e.preventDefault()
console.log('Pointer down:', tool.value, panImageMode.value, e.pointerType) // Debug log

// Only respond to left mouse button or touch
if (e.button !== undefined && e.button !== 0 && e.pointerType !== 'touch') return

// Set pointer capture for better touch handling
if (e.target && e.pointerId !== undefined && e.target.setPointerCapture) {
  try {
    e.target.setPointerCapture(e.pointerId)
  } catch (err) {
    console.log('Pointer capture failed:', err)
  }
}

const { x, y } = getCanvasCoords(e)

// Pan image mode
if (panImageMode.value && bgImageObj.value) {
  dragStart = { x, y }
  dragStartPos = { x: imageOffsetX.value, y: imageOffsetY.value }
  return
}

// Handle different tools
if (tool.value === 'select') {
  // Element selection/movement
  const imgPt = canvasToImageCoords(x, y)
  const el = getElementAt(imgPt.imgX, imgPt.imgY)
  if (el) {
    console.log('Selected element:', el) // Debug log
    draggingElement = el
    selectedElement.value = el
    dragStart = { x: imgPt.imgX, y: imgPt.imgY }
    dragStartPos = { x: el.x, y: el.y }
    el.selected = true
    // Clear other selections
    elements.value.forEach(e => {
      if (e !== el) e.selected = false
    })
  } else {
    // Clear all selections if clicking on empty space
    elements.value.forEach(e => e.selected = false)
    selectedElement.value = null
  }
  drawCanvas()
} else if (tool.value === 'link') {
  // Handle linking mode
  const imgPt = canvasToImageCoords(x, y)
  const el = getElementAt(imgPt.imgX, imgPt.imgY)
  console.log('[LINK MODE] Clicked element:', el)
  console.log('[LINK MODE] Current linkSourceElement:', linkSourceElement.value)
  if (el && el.type === 'gear') {
    if (!linkSourceElement.value) {
      // First click - select source element
      linkSourceElement.value = el
      el.selected = true
      toast.info(`Selected ${el.label} as source. Click another gear to connect.`)
      console.log('[LINK MODE] Selected source:', el)
    } else if (linkSourceElement.value.id !== el.id) {
      // Second click on different element
      const fromType = getNodeType(linkSourceElement.value)
      const toType = getNodeType(el)
      console.log('[LINK MODE] fromType:', fromType, 'toType:', toType)
      if (fromType === 'transformer' && toType === 'recorder') {
        // Directly create the connection and open recorder matrix modal
        createConnection(linkSourceElement.value, el).then(() => {
          matrixModalNode.value = el
          showMatrixModal.value = true
          // Clear selections
          elements.value.forEach(e => e.selected = false)
          linkSourceElement.value = null
          nextTick(drawCanvas)
        }).catch(err => {
          console.error('Failed to create connection:', err)
        })
      } else {
        // Open connection details modal for other types
        const connectionData = { fromNode: linkSourceElement.value, toNode: el }
        openConnectionModal(connectionData)
        // Clear selections
        elements.value.forEach(e => e.selected = false)
        linkSourceElement.value = null
        nextTick(drawCanvas)
      }
    } else {
      // Clicked same element - deselect
      el.selected = false
      linkSourceElement.value = null
      toast.info('Selection cleared.')
    }
    drawCanvas()
  } else if (!el) {
    // Clicked empty space - clear selection
    elements.value.forEach(e => e.selected = false)
    linkSourceElement.value = null
    drawCanvas()
  }
} else if (tool.value === 'freehand') {
  // Start freehand drawing
  console.log('Starting freehand drawing') // Debug log
  isDrawing.value = true
  drawingPath.value = []
  const imgPt = canvasToImageCoords(x, y)
  drawingPath.value.push({ x: imgPt.imgX, y: imgPt.imgY })
  
  // For mobile, add a small delay to prevent immediate end
  if (e.pointerType === 'touch') {
    setTimeout(() => {
      if (isDrawing.value && drawingPath.value.length === 1) {
        // Still drawing, add another point to continue
        drawingPath.value.push({ x: imgPt.imgX, y: imgPt.imgY })
      }
    }, 50)
  }
} else if (tool.value === 'line') {
  // Start line drawing
  console.log('Starting line drawing') // Debug log
  isDrawing.value = true
  const imgPt = canvasToImageCoords(x, y)
  drawingPath.value = [{ x: imgPt.imgX, y: imgPt.imgY }]
}
}

function onPointerMove(e) {
e.preventDefault()
const { x, y } = getCanvasCoords(e)

// Pan image mode
if (panImageMode.value && dragStart && bgImageObj.value) {
  const dx = x - dragStart.x
  const dy = y - dragStart.y
  imageOffsetX.value = dragStartPos.x + dx
  imageOffsetY.value = dragStartPos.y + dy
  drawCanvas()
  return
}

// Handle different tools
if (tool.value === 'select' && draggingElement) {
  // Element dragging: set element center directly under mouse
  const imgPt = canvasToImageCoords(x, y)
  draggingElement.x = imgPt.imgX
  draggingElement.y = imgPt.imgY
  
  // Update connections if dragging a gear element
  if (draggingElement.type === 'gear') {
    updateConnectionsForElement(draggingElement.id)
  }
  
  drawCanvas()
} else if (tool.value === 'freehand' && isDrawing.value) {
  // Continue freehand drawing
  const imgPt = canvasToImageCoords(x, y)
  
  // For mobile, use a smaller threshold to capture more points
  const threshold = e.pointerType === 'touch' ? 0.002 : 0.005
  
  // Only add point if it's significantly different from the last point
  if (drawingPath.value.length === 0 || 
      Math.abs(drawingPath.value[drawingPath.value.length - 1].x - imgPt.imgX) > threshold ||
      Math.abs(drawingPath.value[drawingPath.value.length - 1].y - imgPt.imgY) > threshold) {
    drawingPath.value.push({ x: imgPt.imgX, y: imgPt.imgY })
  }
  drawCanvas()
} else if (tool.value === 'line' && isDrawing.value) {
  // Update line preview
  const imgPt = canvasToImageCoords(x, y)
  if (drawingPath.value.length > 0) {
    drawingPath.value[1] = { x: imgPt.imgX, y: imgPt.imgY }
  }
  drawCanvas()
}
}

function onPointerUp(e) {
e.preventDefault()

// Release pointer capture
if (e.target && e.pointerId !== undefined && e.target.releasePointerCapture) {
  try {
    e.target.releasePointerCapture(e.pointerId)
  } catch (err) {
    console.log('Pointer release failed:', err)
  }
}

if (panImageMode.value) {
  dragStart = null
  dragStartPos = null
  return
}

// For mobile, add a small delay before finishing drawing to prevent premature ending
if (isDrawing.value && e.pointerType === 'touch') {
  setTimeout(() => {
    finishDrawing()
  }, 100)
} else {
  finishDrawing()
}

draggingElement = null
}

function finishDrawing() {
  // Finish drawing operations
  if (isDrawing.value) {
    if (tool.value === 'freehand' && drawingPath.value.length > 1) {
      // Create freehand path element
      elements.value.push({
        type: 'freehand',
        id: Date.now(),
        path: [...drawingPath.value],
        color: '#000000',
        width: 2
      })
    } else if (tool.value === 'line' && drawingPath.value.length === 2) {
      // Create line element
      elements.value.push({
        type: 'line',
        id: Date.now(),
        x1: drawingPath.value[0].x,
        y1: drawingPath.value[0].y,
        x2: drawingPath.value[1].x,
        y2: drawingPath.value[1].y,
        color: '#000000',
        width: 2
      })
    }
    isDrawing.value = false
    drawingPath.value = []
    drawCanvas()
  }
  // Persist element position if moved
  if (draggingElement) {
    if (draggingElement.type === 'gear') {
      // Update node position in Supabase
      updateNode({
        id: draggingElement.id,
        x: draggingElement.x,
        y: draggingElement.y
      })
    } else if (draggingElement.type === 'text') {
      // For text, update in local layout (and Supabase if supported)
      saveLayout() // Save all elements to persist text position
    } else if (draggingElement.type === 'freehand') {
      // For freehand, update in local layout (and Supabase if supported)
      saveLayout() // Save all elements to persist freehand path
    } else if (draggingElement.type === 'line') {
      // For line, update in local layout (and Supabase if supported)
      saveLayout() // Save all elements to persist line position
    }
  }
}

// --- Hit test ---
function getElementAt(imgX, imgY) {
console.log('Hit testing at:', imgX, imgY) // Debug log
for (let i = elements.value.length - 1; i >= 0; i--) {
  const el = elements.value[i]
  console.log('Checking element:', el.type, el.x, el.y) // Debug log
  if (el.type === 'gear') {
    const dx = imgX - el.x, dy = imgY - el.y
    const hitRadius = 0.12 // 12% of image size for hit testing (increased from 0.08)
    const distance = Math.sqrt(dx * dx + dy * dy)
    console.log('Gear hit test:', distance, hitRadius, distance < hitRadius) // Debug log
    if (distance < hitRadius) return el
  } else if (el.type === 'text') {
    // Simple hit test for text: treat as a rectangle
    const textWidth = 0.08 // ~8% of image width (tweak as needed)
    const textHeight = 0.04 // ~4% of image height
    if (
      imgX > el.x - textWidth/2 && imgX < el.x + textWidth/2 &&
      imgY > el.y - textHeight/2 && imgY < el.y + textHeight/2
    ) return el
  } else if (el.type === 'line') {
    // Hit test for line - check if point is close to line
    const tolerance = 0.02 // 2% of image size
    const dist = distanceToLine(imgX, imgY, el.x1, el.y1, el.x2, el.y2)
    if (dist < tolerance) return el
  } else if (el.type === 'connection') {
    // Hit test for connection - check if point is close to connection line
    const tolerance = 0.02 // 2% of image size
    const dist = distanceToLine(imgX, imgY, el.x1, el.y1, el.x2, el.y2)
    if (dist < tolerance) return el
  } else if (el.type === 'freehand') {
    // Hit test for freehand - check if point is close to any segment
    if (el.path && el.path.length > 1) {
      for (let i = 0; i < el.path.length - 1; i++) {
        const dist = distanceToLine(imgX, imgY, el.path[i].x, el.path[i].y, el.path[i+1].x, el.path[i+1].y)
        if (dist < 0.02) return el
      }
    }
  }
}
console.log('No element found') // Debug log
return null
}

// Helper function to calculate distance from point to line
function distanceToLine(px, py, x1, y1, x2, y2) {
const A = px - x1
const B = py - y1
const C = x2 - x1
const D = y2 - y1

const dot = A * C + B * D
const lenSq = C * C + D * D

if (lenSq === 0) return Math.sqrt(A * A + B * B)

let param = dot / lenSq

let xx, yy
if (param < 0) {
  xx = x1
  yy = y1
} else if (param > 1) {
  xx = x2
  yy = y2
} else {
  xx = x1 + param * C
  yy = y1 + param * D
}

const dx = px - xx
const dy = py - yy
return Math.sqrt(dx * dx + dy * dy)
}

// Helper function to get bounding box for freehand path
function getFreehandBounds(path) {
if (!path || path.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }

let minX = path[0].x, maxX = path[0].x
let minY = path[0].y, maxY = path[0].y

for (const point of path) {
  minX = Math.min(minX, point.x)
  maxX = Math.max(maxX, point.x)
  minY = Math.min(minY, point.y)
  maxY = Math.max(maxY, point.y)
}

return { minX, minY, maxX, maxY }
}

// Methods
async function fetchLocation() {
// Try to get locationId from prop or route query
const locId = props.locationId || route.query.locationId || selectedLocationId.value
if (!locId) return

const { data, error } = await supabase
  .from('locations')
  .select('*')
  .eq('id', locId)
  .single()

if (!error && data) {
  selectedLocationId.value = data.id
  currentLocation.value = data
}
}

async function fetchGearList() {
if (!projectId.value) return

loading.value = true
try {
  // Use the same logic as ProjectGear.vue
  const gearData = await fetchTableData('gear_table',{ 
    eq: { project_id: projectId.value },
    order: [{ column:'sort_order', ascending:true }]
  })
  
  // If online, try to get user information for user gear
  let userGearInfo = {}
  if (navigator.onLine) {
    try {
      const userGearIds = gearData
        .filter(g => g.is_user_gear && g.user_gear_id)
        .map(g => g.user_gear_id)
      
      if (userGearIds.length > 0) {
        const { data: userGearData, error } = await supabase
          .from('user_gear_view')
          .select('id, owner_name, owner_company')
          .in('id', userGearIds)
        
        if (!error && userGearData) {
          userGearData.forEach(ug => {
            userGearInfo[ug.id] = ug
          })
        }
      }
    } catch (err) {
      console.warn('Could not fetch user gear info:', err)
    }
  }
  
  const ids = gearData.map(g => g.id)
  const asns = ids.length
    ? await fetchTableData('gear_assignments',{ in:{ gear_id: ids }})
    : []
  const map = {}
  asns.forEach(a=>{
    map[a.gear_id] = map[a.gear_id]||{}
    map[a.gear_id][a.location_id] = a.assigned_amount
  })
  
  gearList.value = gearData.map(g=>{
    const m = map[g.id]||{}
    const tot = Object.values(m).reduce((s,v)=>s+v,0)
    const userInfo = g.is_user_gear && g.user_gear_id ? userGearInfo[g.user_gear_id] : null
    
    return {
      ...g,
      assignments: m,
      total_assigned: tot,
      unassigned_amount: g.gear_amount - tot,
      owner_name: userInfo?.owner_name || (g.is_user_gear ? 'Unknown' : null),
      owner_company: userInfo?.owner_company || null
    }
  })
  error.value = null
} catch (err) {
  error.value = err.message
  toast.error(err.message)
} finally {
  loading.value = false
}
}

function openGearSelectionModal() {
showGearModal.value = true
selectedCategory.value = 'All'
}

function closeGearModal() {
showGearModal.value = false
}

function openGearManagementModal() {
showGearManagementModal.value = true
}

function closeGearManagementModal() {
showGearManagementModal.value = false
}

async function removeAssignment(gear) {
if (!selectedLocationId.value || !gear) return

try {
  const existing = await fetchTableData('gear_assignments',{ 
    eq: { gear_id: gear.id, location_id: selectedLocationId.value }
  })
  
  if (existing.length > 0) {
    const newAmount = Math.max(0, existing[0].assigned_amount - 1)
    
    if (newAmount === 0) {
      // Remove assignment entirely
      await mutateTableData('gear_assignments','delete',{ id: existing[0].id })
    } else {
      // Update assignment
      await mutateTableData('gear_assignments','update',{ 
        id: existing[0].id, 
        assigned_amount: newAmount 
      })
    }
    
    toast.success(`Removed 1 × ${gear.gear_name} from ${currentLocation.value?.stage_name}`)
    await fetchGearList() // Refresh the list
  }
} catch (err) {
  console.error('Error removing assignment:', err)
  toast.error(err.message || 'Failed to remove assignment')
}
}

function getGearIcon(gearType) {
const iconMap = {
  'source': '🎤',
  'transformer': '⚡',
  'recorder': '📼',
  'user_gear': '👤',
  'mixer': '🎛️',
  'processor': '🔧',
  'converter': '🔄'
}
return iconMap[gearType] || '🎵'
}

async function assignGearToLocation(gear) {
if (!selectedLocationId.value || !gear) return

try {
  const currentAssignment = gear.assignments?.[selectedLocationId.value] || 0
  const availableAmount = gear.unassigned_amount + currentAssignment
  
  if (availableAmount <= 0) {
    toast.error(`No ${gear.gear_name} available to assign`)
    return
  }
  
  // Assign 1 unit by default, or all available if only 1 left
  const assignAmount = Math.min(1, availableAmount)
  
  const existing = await fetchTableData('gear_assignments',{ 
    eq: { gear_id: gear.id, location_id: selectedLocationId.value }
  })
  
  if (existing.length > 0) {
    // Update existing assignment
    await mutateTableData('gear_assignments','update',{ 
      id: existing[0].id, 
      assigned_amount: existing[0].assigned_amount + assignAmount 
    })
  } else {
    // Create new assignment
    await mutateTableData('gear_assignments','insert',{ 
      gear_id: gear.id, 
      location_id: selectedLocationId.value, 
      assigned_amount: assignAmount 
    })
  }
  
  toast.success(`Assigned ${assignAmount} × ${gear.gear_name} to ${currentLocation.value?.stage_name}`)
  await fetchGearList() // Refresh the list
} catch (err) {
  console.error('Error assigning gear:', err)
  toast.error(err.message || 'Failed to assign gear')
}
}

function openConnectionModal(connectionData) {
  console.log('[CONNECTION MODAL] Opening modal with data:', connectionData)
  console.log('[CONNECTION MODAL] connectionData.fromNode:', connectionData?.fromNode)
  console.log('[CONNECTION MODAL] connectionData.toNode:', connectionData?.toNode)
  
  // Ensure the data structure is correct
  if (!connectionData?.fromNode || !connectionData?.toNode) {
    console.error('[CONNECTION MODAL] Invalid connection data:', connectionData)
    toast.error('Invalid connection data')
    return
  }
  
  pendingConnection.value = connectionData
  showConnectionModal.value = true
  console.log('[CONNECTION MODAL] Modal state set to:', showConnectionModal.value)
  console.log('[CONNECTION MODAL] pendingConnection.value:', pendingConnection.value)
}

function closeConnectionModal() {
showConnectionModal.value = false
pendingConnection.value = null
}

async function confirmConnection(connectionDetails) {
// Actually create the connection with details
if (pendingConnection.value && pendingConnection.value.fromNode && pendingConnection.value.toNode) {
  try {
    await createConnection(pendingConnection.value.fromNode, pendingConnection.value.toNode, connectionDetails)
    // If fromNode is a transformer and toNode is a recorder or transformer, open the matrix modal for fromNode
    const fromType = pendingConnection.value.fromNode.gearType || pendingConnection.value.fromNode.node_type
    const toType = pendingConnection.value.toNode.gearType || pendingConnection.value.toNode.node_type
    if ((fromType === 'transformer') && (toType === 'recorder' || toType === 'transformer')) {
      matrixModalNode.value = pendingConnection.value.fromNode
      showMatrixModal.value = true
    }
  } catch (err) {
    console.error('Failed to create connection:', err)
    toast.error('Failed to create connection: ' + err.message)
  }
}
closeConnectionModal()
}

function openMatrixPortModal(nodeId) {
matrixPortMapperNodeId.value = nodeId
showMatrixPortModal.value = true
}

function closeMatrixPortModal() {
showMatrixPortModal.value = false
matrixPortMapperNodeId.value = null
}

function handleMatrixPortMapperSaved() {
closeMatrixPortModal()
// Refresh data if needed
}

function setTool(t) { 
  tool.value = t 
  // Clear link mode when switching tools
  if (t !== 'link') {
    linkSourceElement.value = null
    elements.value.forEach(e => e.selected = false)
  }
}

function onCanvasClick(e) {
console.log('Canvas click:', tool.value) // Debug log
if (tool.value === 'text') {
  const rect = canvas.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const text = prompt('Enter text:')
  if (text) {
    // Convert canvas coordinates to image coordinates
    const imgPt = canvasToImageCoords(x, y)
    elements.value.push({ 
      type: 'text', 
      text, 
      x: imgPt.imgX, 
      y: imgPt.imgY, 
      size: 18, 
      color: '#222' 
    })
    drawCanvas()
  }
}
}

// Redraw on element/tool change
watch([elements, tool], () => nextTick(drawCanvas))

// Save layout to Supabase or localStorage
async function saveLayout() {
  if (!selectedLocationId.value) {
    toast.error('No location selected')
    return
  }

  try {
    // First, sync all elements to Supabase
    await saveAllToSupabase()
    
    // Then save the layout data
    const layoutData = {
      name: `Signal Mapper Layout - ${new Date().toLocaleString()}`,
      location_id: selectedLocationId.value,
      elements: elements.value,
      canvas_width: canvasWidth.value,
      canvas_height: canvasHeight.value,
      created_email: 'Current User' // This will be set by the backend
    }

    if (supabase) {
      // Save to Supabase
      const { data, error } = await supabase
        .from('signal_mapper_layouts')
        .insert(layoutData)
        .select()
        .single()

      if (error) {
        console.error('Save error:', error)
        toast.error('Failed to save layout: ' + error.message)
      } else {
        toast.success('Layout saved successfully!')
        console.log('Saved layout:', data)
      }
    } else {
      // Fallback to localStorage
      localStorage.setItem('signal_mapper_layout', JSON.stringify(layoutData))
      toast.success('Layout saved locally!')
    }
  } catch (err) {
    console.error('Save failed:', err)
    toast.error('Save failed: ' + err.message)
  }
}

// Sync all elements to Supabase
async function saveAllToSupabase() {
  if (!projectId.value) {
    toast.error('No project ID available')
    return
  }

  try {
    // Get current nodes and connections from Supabase
    const existingNodes = await getNodes(projectId.value)
    const existingConnections = await getConnections(projectId.value)
    
    // Separate gear elements and connection elements
    const gearElements = elements.value.filter(el => el.type === 'gear')
    const connectionElements = elements.value.filter(el => el.type === 'connection')
    
    // Process nodes (gear elements)
    for (const gearEl of gearElements) {
      const existingNode = existingNodes.find(n => n.id === gearEl.id)
      
      if (existingNode) {
        // Update existing node
        await updateNode({
          id: gearEl.id,
          label: gearEl.label,
          x: gearEl.x,
          y: gearEl.y,
          gear_id: gearEl.gearId,
          gear_type: gearEl.gear_type || gearEl.gearType || 'other',
          num_inputs: gearEl.num_inputs || 1,
          num_outputs: gearEl.num_outputs || 1,
          num_tracks: gearEl.num_tracks || 0
        })
      } else {
        // Create new node
        await addNode({
          project_id: projectId.value,
          type: 'gear',
          gear_id: gearEl.gearId,
          label: gearEl.label,
          x: gearEl.x,
          y: gearEl.y,
          gear_type: gearEl.gear_type || gearEl.gearType || 'other',
          num_inputs: gearEl.num_inputs || 1,
          num_outputs: gearEl.num_outputs || 1,
          num_tracks: gearEl.num_tracks || 0
        })
      }
    }
    
    // Process connections
    for (const connEl of connectionElements) {
      const existingConnection = existingConnections.find(c => c.id === connEl.id)
      
      if (existingConnection) {
        // Update existing connection
        await updateConnection({
          id: connEl.id,
          from_node_id: connEl.from,
          to_node_id: connEl.to,
          x1: connEl.x1,
          y1: connEl.y1,
          x2: connEl.x2,
          y2: connEl.y2,
          input_number: connEl.input_number,
          output_number: connEl.output_number,
          track_number: connEl.track_number
        })
      } else {
        // Create new connection
        await addConnectionToDB({
          project_id: projectId.value,
          from_node_id: connEl.from,
          to_node_id: connEl.to,
          x1: connEl.x1,
          y1: connEl.y1,
          x2: connEl.x2,
          y2: connEl.y2,
          input_number: connEl.input_number,
          output_number: connEl.output_number,
          track_number: connEl.track_number
        })
      }
    }
    
    // Remove nodes that exist in Supabase but not in current elements
    for (const existingNode of existingNodes) {
      if (!gearElements.some(el => el.id === existingNode.id)) {
        await deleteNode(existingNode.id)
      }
    }
    
    // Remove connections that exist in Supabase but not in current elements
    for (const existingConnection of existingConnections) {
      if (!connectionElements.some(el => el.id === existingConnection.id)) {
        await deleteConnection(existingConnection.id)
      }
    }
    
    console.log('Successfully synced all elements to Supabase')
  } catch (err) {
    console.error('Error syncing to Supabase:', err)
    throw new Error('Failed to sync elements to Supabase: ' + err.message)
  }
}

// Clear all elements from Supabase and local state
async function clearAllFromSupabase() {
  if (!projectId.value) {
    toast.error('No project ID available')
    return
  }

  if (!confirm('This will permanently delete all nodes and connections for this location. Are you sure?')) {
    return
  }

  try {
    // Get all nodes and connections for this project
    const existingNodes = await getNodes(projectId.value)
    const existingConnections = await getConnections(projectId.value)
    
    // Delete all connections first (to avoid foreign key constraints)
    for (const connection of existingConnections) {
      await deleteConnection(connection.id)
    }
    
    // Delete all nodes
    for (const node of existingNodes) {
      await deleteNode(node.id)
    }
    
    // Clear local elements array
    elements.value = []
    
    nextTick(drawCanvas)
    toast.success('All data cleared successfully!')
    console.log('Cleared all nodes and connections from Supabase')
  } catch (err) {
    console.error('Error clearing from Supabase:', err)
    toast.error('Failed to clear data: ' + err.message)
  }
}

// Load layout from Supabase or localStorage
async function loadLayout() {
if (!selectedLocationId.value) {
  toast.error('No location selected')
  return
}

console.log('Loading layout for location:', selectedLocationId.value) // Debug log

try {
  let layout
  if (supabase) {
    // Load from Supabase - get the most recent layout
    console.log('Querying Supabase for layouts...') // Debug log
    const { data, error } = await supabase
      .from('signal_mapper_layouts')
      .select('*')
      .eq('location_id', selectedLocationId.value)
      .order('inserted_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Load error:', error)
      toast.error('Failed to load layout: ' + error.message)
      return
    }
    
    console.log('Supabase query result:', data) // Debug log
    
    // Check if we got any results
    if (data && data.length > 0) {
      layout = data[0] // Take the most recent one
      console.log('Found layout:', layout.name, 'with', layout.elements?.length || 0, 'elements') // Debug log
    } else {
      console.log('No saved layouts found for this location')
      layout = null
    }
  } else {
    // Fallback to localStorage
    const localData = localStorage.getItem('signal_mapper_layout')
    layout = localData ? JSON.parse(localData) : null
    console.log('Loaded from localStorage:', layout) // Debug log
  }

  if (layout && layout.elements) {
    elements.value = layout.elements
    if (layout.canvas_width) canvasWidth.value = layout.canvas_width
    if (layout.canvas_height) canvasHeight.value = layout.canvas_height
    nextTick(drawCanvas)
    toast.success('Layout loaded successfully!')
    console.log('Loaded layout:', layout)
  } else {
    toast.info('No saved layout found for this location')
  }
} catch (err) {
  console.error('Load failed:', err)
  toast.error('Load failed: ' + err.message)
}
}

// Load all saved layouts for the current location
async function loadSavedLayouts() {
if (!selectedLocationId.value || !supabase) {
  savedLayouts.value = []
  return
}

loadingLayouts.value = true

try {
  const { data, error } = await supabase
    .from('signal_mapper_layouts')
    .select('*')
    .eq('location_id', selectedLocationId.value)
    .order('inserted_at', { ascending: false })

  if (error) {
    console.error('Error loading saved layouts:', error)
    toast.error('Failed to load saved layouts: ' + error.message)
    savedLayouts.value = []
  } else {
    savedLayouts.value = data || []
    console.log('Loaded saved layouts:', savedLayouts.value.length)
  }
} catch (err) {
  console.error('Failed to load saved layouts:', err)
  toast.error('Failed to load saved layouts: ' + err.message)
  savedLayouts.value = []
} finally {
  loadingLayouts.value = false
}
}

// Delete a specific layout
async function deleteLayout(layoutId) {
if (!supabase) return

try {
  const { error } = await supabase
    .from('signal_mapper_layouts')
    .delete()
    .eq('id', layoutId)

  if (error) {
    console.error('Delete error:', error)
    toast.error('Failed to delete layout: ' + error.message)
  } else {
    toast.success('Layout deleted successfully!')
  }
} catch (err) {
  console.error('Delete failed:', err)
  toast.error('Delete failed: ' + err.message)
}
}

// Export canvas to PNG
function exportCanvas() {
const c = canvas.value
if (!c) return
const url = c.toDataURL('image/png')
const a = document.createElement('a')
a.href = url
a.download = 'signal-mapper-canvas.png'
a.click()
}

// Export canvas to PDF
function exportCanvasPDF() {
const c = canvas.value
if (!c) return
const imgData = c.toDataURL('image/png')
const pdf = new jsPDF('landscape', 'mm', 'a4')
const imgWidth = 297
const imgHeight = (c.height * imgWidth) / c.width
pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
pdf.save('signal-mapper-canvas.pdf')
}

// Clear all elements
async function clearAll() {
  if (confirm('Clear all elements from the canvas?')) {
    await clearAllFromSupabase()
  }
}

// Update connection positions when gear elements are moved
function updateConnectionsForElement(elementId) {
  elements.value.forEach(el => {
    if (el.type === 'connection') {
      if (el.from === elementId) {
        const fromElement = elements.value.find(e => e.id === elementId)
        if (fromElement) {
          el.x1 = fromElement.x
          el.y1 = fromElement.y
        }
      }
      if (el.to === elementId) {
        const toElement = elements.value.find(e => e.id === elementId)
        if (toElement) {
          el.x2 = toElement.x
          el.y2 = toElement.y
        }
      }
    }
  })
}

// Deselect gear after dragging or linking
watch(draggingElement, (val, oldVal) => {
  if (!val && oldVal) {
    elements.value.forEach(e => e.selected = false)
    selectedElement.value = null
    nextTick(drawCanvas)
  }
})

// Create connection between two gear elements (now handled by async version)
// Legacy function kept for backward compatibility
function createConnectionLegacy(fromEl, toEl, details = {}) {
  // This function is deprecated - use the async version instead
  console.warn('createConnectionLegacy is deprecated - use async createConnection instead')
}

// Prevent duplicate connections (legacy function)
function addConnection(fromEl, toEl) {
  createConnection(fromEl, toEl, {})
}

// Optionally, call loadLayout on mount
let cleanupRealtime = null;

onMounted(async () => {
  await fetchLocation()
  await fetchGearList()

  // Set canvas buffer size and CSS size for dpr
  if (canvas.value) {
    canvas.value.width = canvasWidth.value * dpr
    canvas.value.height = canvasHeight.value * dpr
    canvas.value.style.width = canvasWidth.value + 'px'
    canvas.value.style.height = canvasHeight.value + 'px'
  }

  // Load nodes and connections from Supabase
  if (projectId.value) {
    await loadNodesAndConnections()
    cleanupRealtime = setupRealtimeSubscriptions()
  }

  nextTick(drawCanvas)
})

onUnmounted(() => {
  if (cleanupRealtime) cleanupRealtime();
})

function triggerImageUpload() {
document.getElementById('image-upload').click()
}

// --- Coordinate transform helpers ---
function canvasToImageCoords(canvasX, canvasY) {
// Convert from CSS pixel coordinates (displayed size) to image-relative coordinates
// Use canvasWidth.value and canvasHeight.value (CSS pixels)
if (!bgImageObj.value) {
  // If no background image, treat canvas as 1:1 mapping
  return { 
    imgX: canvasX / canvasWidth.value, 
    imgY: canvasY / canvasHeight.value 
  }
}
const imgW = bgImageObj.value.width
const imgH = bgImageObj.value.height
// Use displayed canvas size, not buffer size
const scale = scaleFactor.value
const offsetX = imageOffsetX.value
const offsetY = imageOffsetY.value
return {
  imgX: (canvasX - offsetX) / (imgW * scale),
  imgY: (canvasY - offsetY) / (imgH * scale)
}
}

function imageToCanvasCoords(imgX, imgY) {
// Convert from image-relative coordinates to CSS pixel coordinates
if (!bgImageObj.value) {
  // If no background image, treat canvas as 1:1 mapping
  return {
    x: imgX * canvasWidth.value,
    y: imgY * canvasHeight.value
  }
}
const imgW = bgImageObj.value.width
const imgH = bgImageObj.value.height
const scale = scaleFactor.value
const offsetX = imageOffsetX.value
const offsetY = imageOffsetY.value
return {
  x: imgX * (imgW * scale) + offsetX,
  y: imgY * (imgH * scale) + offsetY
}
}

// --- Canvas coordinate helper ---
function getCanvasCoords(e) {
const rect = canvas.value.getBoundingClientRect();
// Always use the ratio of buffer size to CSS size
const scaleX = canvas.value.width / rect.width;
const scaleY = canvas.value.height / rect.height;
return {
  x: (e.clientX - rect.left) * scaleX / dpr,
  y: (e.clientY - rect.top) * scaleY / dpr
};
}

// Image settings state
const panImageMode = ref(false)
const bgOpacity = ref(1.0)

function triggerImageUploadSettings() {
document.getElementById('image-upload-settings').click()
}

// Watch for changes in bgOpacity to redraw canvas
watch([bgOpacity], drawCanvas)

// Watch for panImageMode changes to update cursor
watch(panImageMode, (newVal) => {
if (canvas.value) {
  canvas.value.style.cursor = newVal ? 'grab' : 'default'
}
})

// Add keyboard shortcuts for testing
onMounted(() => {
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return // Don't interfere with input fields
  
  switch (e.key.toLowerCase()) {
    case 'v':
      setTool('select')
      break
    case 'f':
      setTool('freehand')
      break
    case 'l':
      setTool('line')
      break
    case 't':
      setTool('text')
      break
    case 'c':
      setTool('link')
      break
    case 'p':
      panImageMode.value = !panImageMode.value
      break
    case 's':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        saveLayout()
      }
      break
  }
})
})

const hasSelectedElement = computed(() => {
  return selectedElement.value !== null || elements.value.some(el => el.selected)
})

const connectionStats = computed(() => {
  const gearElements = elements.value.filter(el => el.type === 'gear')
  const connectionElements = elements.value.filter(el => el.type === 'connection')
  return {
    gearCount: gearElements.length,
    connectionCount: connectionElements.length,
    connectedGear: connectionElements.length > 0 ? 
      new Set([...connectionElements.map(c => c.from), ...connectionElements.map(c => c.to)]).size : 0
  }
})

// Data for documentation component
const documentationData = computed(() => {
  const gearElements = elements.value.filter(el => el.type === 'gear')
  const connectionElements = elements.value.filter(el => el.type === 'connection')
  
  return {
    gear: gearElements.map(el => ({
      id: el.id,
      label: el.label, // include node name
      gearType: el.gearType,
      x: el.x,
      y: el.y,
      num_inputs: el.num_inputs || 0,
      num_outputs: el.num_outputs || 0,
      num_tracks: el.num_tracks || 0
    })),
    connections: connectionElements.map(conn => ({
      id: conn.id,
      from_node_id: conn.from,
      to_node_id: conn.to,
      input_number: conn.input_number,
      output_number: conn.output_number,
      track_number: conn.track_number
    })),
    locationId: selectedLocationId.value,
    projectId: projectId.value
  }
})

// Delete selected element (now handled by async version)
// Legacy function kept for backward compatibility
function deleteSelectedElementLegacy() {
  // This function is deprecated - use the async version instead
  console.warn('deleteSelectedElementLegacy is deprecated - use async deleteSelectedElement instead')
}

function openSavedLayoutsModal() {
showSavedLayoutsModal.value = true
loadSavedLayouts()
}

function closeSavedLayoutsModal() {
showSavedLayoutsModal.value = false
}

async function loadSpecificLayout(layout) {
  if (confirm('Load this layout? Current work will be lost.')) {
    // First clear existing data from Supabase
    await clearAllFromSupabase()
    
    // Then load the new layout
    elements.value = layout.elements || []
    if (layout.canvas_width) canvasWidth.value = layout.canvas_width
    if (layout.canvas_height) canvasHeight.value = layout.canvas_height
    nextTick(drawCanvas)
    closeSavedLayoutsModal()
    toast.success(`Loaded "${layout.name}"`)
  }
}

// --- Mouse debug overlay ---
// const mousePos = ref({ x: null, y: null }) // Remove debug overlay

function onCanvasDblClick(e) {
  console.log('Double-click detected') // Debug log
  e.preventDefault()
  e.stopPropagation()
  
  const { x, y } = getCanvasCoords(e)
  console.log('Canvas coordinates:', x, y) // Debug log
  
  const imgPt = canvasToImageCoords(x, y)
  console.log('Image coordinates:', imgPt) // Debug log
  
  const el = getElementAt(imgPt.imgX, imgPt.imgY)
  
  console.log('Element found:', el) // Debug log
  if (el && el.type === 'gear') {
    // Open matrix modal for any gear node (source, transformer, recorder)
    matrixModalNode.value = el
    showMatrixModal.value = true
    nextTick(() => {
      console.log('After nextTick - showMatrixModal:', showMatrixModal.value)
      console.log('After nextTick - matrixModalNode:', matrixModalNode.value)
    })
  } else {
    console.log('No element found at click position') // Debug log
  }
}

// --- Mobile/touch support ---
// Touch events are delegated to pointer event logic for consistency.
// Double-tap on mobile triggers the matrix modal (like double-click on desktop).
// touch-action: none is set on the canvas to prevent unwanted scrolling while drawing/moving.
// All drawing/moving logic is unified for both mouse and touch.
let lastTap = 0
function onTouchEnd(e) {
  e.preventDefault()
  console.log('Touch end detected')

  // Double-tap support for matrix modal
  const now = Date.now()
  if (now - lastTap < 400) {
    // Double-tap triggers matrix modal
    onCanvasDblClick(e.changedTouches ? e.changedTouches[0] : e)
  }
  lastTap = now

  const touchDuration = Date.now() - touchStartTime

  // Convert to pointer event for consistency
  const pointerEvent = {
    clientX: e.changedTouches?.[0]?.clientX || 0,
    clientY: e.changedTouches?.[0]?.clientY || 0,
    button: 0,
    pointerType: 'touch',
    pointerId: e.changedTouches?.[0]?.identifier || 0,
    preventDefault: () => e.preventDefault()
  }

  onPointerUp(pointerEvent)

  // Reset touch state
  touchStartTime = 0
  touchStartPos = null
  isTouchDrawing = false
  touchDrawingPath = []
}

function closeMatrixModal() {
  showMatrixModal.value = false
  matrixModalNode.value = null
}

function editConnectionFromMatrix(editDetails) {
  // This will be implemented to allow editing/adding connections from the matrix modal
}

// Load nodes and connections from Supabase
async function loadNodesAndConnections() {
  if (!projectId.value) return;

  loadingNodes.value = true;
  loadingConnections.value = true;

  try {
    // Clear current elements before loading new ones
    elements.value = [];

    // Load nodes
    const nodes = await getNodes(projectId.value);
    elements.value = nodes.map(node => ({
      ...node,
      selected: false
    }));

    // Load connections
    const connectionsData = await getConnections(projectId.value);
    const connectionElements = connectionsData.map(conn => ({
      type: 'connection',
      id: conn.id,
      x1: conn.x1 || 0,
      y1: conn.y1 || 0,
      x2: conn.x2 || 0,
      y2: conn.y2 || 0,
      from: conn.from_node_id,
      to: conn.to_node_id,
      color: '#007bff',
      width: 3,
      input_number: conn.input_number,
      output_number: conn.output_number,
      track_number: conn.track_number,
      selected: false
    }));

    // Add connection elements to elements array
    elements.value.push(...connectionElements);

    nextTick(drawCanvas);
  } catch (err) {
    console.error('Error loading nodes and connections:', err);
    toast.error('Failed to load signal mapper data: ' + err.message);
  } finally {
    loadingNodes.value = false;
    loadingConnections.value = false;
  }
}

// Subscribe to real-time updates
function setupRealtimeSubscriptions() {
  if (!projectId.value) return
  
  // Subscribe to node changes
  const nodesSubscription = subscribeToNodes(projectId.value, (payload) => {
    console.log('Node change:', payload)
    if (payload.eventType === 'INSERT') {
      // Prevent duplicate nodes
      if (!elements.value.some(el => el.id === payload.new.id)) {
        elements.value.push({
          ...payload.new,
          selected: false
        })
      }
    } else if (payload.eventType === 'UPDATE') {
      const index = elements.value.findIndex(el => el.id === payload.new.id)
      if (index !== -1) {
        elements.value[index] = { ...payload.new, selected: false }
      }
    } else if (payload.eventType === 'DELETE') {
      elements.value = elements.value.filter(el => el.id !== payload.old.id)
    }
    nextTick(drawCanvas)
  })
  
  // Subscribe to connection changes
  const connectionsSubscription = subscribeToConnections(projectId.value, (payload) => {
    console.log('Connection change:', payload)
    if (payload.eventType === 'INSERT') {
      // Prevent duplicate connections
      if (!elements.value.some(el => el.id === payload.new.id)) {
        const connectionElement = {
          type: 'connection',
          id: payload.new.id,
          x1: payload.new.x1 || 0,
          y1: payload.new.y1 || 0,
          x2: payload.new.x2 || 0,
          y2: payload.new.y2 || 0,
          from: payload.new.from_node_id,
          to: payload.new.to_node_id,
          color: '#007bff',
          width: 3,
          input_number: payload.new.input_number,
          output_number: payload.new.output_number,
          track_number: payload.new.track_number,
          selected: false
        }
        elements.value.push(connectionElement)
      }
    } else if (payload.eventType === 'UPDATE') {
      const index = elements.value.findIndex(el => el.id === payload.new.id)
      if (index !== -1) {
        elements.value[index] = {
          ...elements.value[index],
          x1: payload.new.x1 || 0,
          y1: payload.new.y1 || 0,
          x2: payload.new.x2 || 0,
          y2: payload.new.y2 || 0,
          input_number: payload.new.input_number,
          output_number: payload.new.output_number,
          track_number: payload.new.track_number
        }
      }
    } else if (payload.eventType === 'DELETE') {
      elements.value = elements.value.filter(el => el.id !== payload.old.id)
    }
    nextTick(drawCanvas)
  })
  
  // Return cleanup function
  return () => {
    nodesSubscription?.unsubscribe()
    connectionsSubscription?.unsubscribe()
  }
}

// Update selectGear to save to Supabase
async function selectGear(gear) {
  console.log('Selected gear:', gear)
  const countOnCanvas = elements.value.filter(el => el.type === 'gear' && el.gearId === gear.id).length
  const assignedAmount = gear.assignments?.[selectedLocationId.value] || 0
  if (countOnCanvas >= assignedAmount) {
    toast.error(`All assigned units of ${gear.gear_name} are already placed on the canvas.`)
    return
  }
  
  let label = ''
  while (true) {
    label = window.prompt('Enter a unique name for this node:', gear.gear_name || gear.label || 'Gear')
    if (!label) {
      toast.error('Node name is required.')
      return
    }
    const duplicate = elements.value.some(el => el.type === 'gear' && el.label === label)
    if (duplicate) {
      toast.error('A node with this name already exists. Please choose another name.')
    } else {
      break
    }
  }
  
  const centerX = canvasWidth.value / 2
  const centerY = canvasHeight.value / 2
  const imgCoords = canvasToImageCoords(centerX, centerY)
  
  savingNode.value = true
  try {
    // Log the gear object to see what fields are available
    console.log('Gear object:', gear)
    
    const nodeData = {
      project_id: projectId.value,
      type: 'gear',
      gear_id: gear.id,
      label,
      x: imgCoords.imgX,
      y: imgCoords.imgY,
      gear_type: gear.gear_type || gear.gearType || 'other',
      num_inputs: gear.num_inputs || gear.numinputs || gear.inputs || 1,
      num_outputs: gear.num_outputs || gear.numoutputs || gear.outputs || 1,
      num_tracks: gear.num_tracks || gear.tracks || gear.num_records || gear.numrecord || 0
    }
    
    console.log('Saving node data:', nodeData)
    const savedNode = await addNode(nodeData)
    closeGearModal()
    nextTick(drawCanvas)
    toast.success(`Added ${label} to canvas`)
  } catch (err) {
    console.error('Error adding node:', err)
    toast.error('Failed to add node: ' + err.message)
  } finally {
    savingNode.value = false
  }
}

// Update createConnection to save to Supabase
async function createConnection(fromEl, toEl, details = {}) {
  // Check for duplicate connections
  if (elements.value.some(e => e.type === 'connection' && 
      ((e.from === fromEl.id && e.to === toEl.id) || 
       (e.from === toEl.id && e.to === fromEl.id)))) {
    toast.error('Connection already exists between these gear elements.')
    return
  }
  savingConnection.value = true
  try {
    // Determine node types
    const fromType = fromEl.gearType || fromEl.node_type
    const toType = toEl.gearType || toEl.node_type
    // If transformer -> recorder, do not prompt for input, just link and open matrix for recorder
    if (fromType === 'transformer' && toType === 'recorder') {
      const connectionData = {
        project_id: projectId.value,
        from_node_id: fromEl.id,
        to_node_id: toEl.id,
        // No input_number, output_number, or track_number here
      }
      await addConnectionToDB(connectionData)
      // Open matrix modal for recorder to assign tracks
      matrixModalNode.value = toEl
      showMatrixModal.value = true
      nextTick(drawCanvas)
      toast.success('Connection created. Assign tracks in the matrix modal.')
    } else {
      // Default: allow input assignment if needed
      const connectionData = {
        project_id: projectId.value,
        from_node_id: fromEl.id,
        to_node_id: toEl.id,
        input_number: (toType !== 'recorder' && (fromType !== 'source' || fromType === 'transformer')) ? details.input_number : undefined,
        output_number: undefined, // never set output_number
        track_number: toType === 'recorder' ? details.track_number : undefined
      }
      await addConnectionToDB(connectionData)
      nextTick(drawCanvas)
      toast.success('Connection created successfully')
    }
  } catch (err) {
    console.error('Error creating connection:', err)
    toast.error('Failed to create connection: ' + err.message)
  } finally {
    savingConnection.value = false
  }
}

// Update deleteSelectedElement to remove from Supabase
async function deleteSelectedElement() {
  console.log('Deleting selected element')
  const selected = elements.value.find(el => el.selected) || selectedElement.value
  if (selected) {
    try {
      if (selected.type === 'gear') {
        // Delete node from Supabase
        await deleteNode(selected.id)
        // Remove gear and its connections from local state
        elements.value = elements.value.filter(el => 
          el.id !== selected.id && 
          !(el.type === 'connection' && (el.from === selected.id || el.to === selected.id))
        )
      } else if (selected.type === 'connection') {
        // Delete connection from Supabase
        await deleteConnection(selected.id)
        // Remove connection from local state
        elements.value = elements.value.filter(e => e.id !== selected.id)
        // Reload connections from DB to ensure UI is in sync
        await loadNodesAndConnections()
      } else {
        // For other element types, just remove from local state
        elements.value = elements.value.filter(e => e.id !== selected.id)
      }
      selectedElement.value = null
      nextTick(drawCanvas)
      toast.success('Element deleted successfully')
    } catch (err) {
      console.error('Error deleting element:', err)
      toast.error('Failed to delete element: ' + err.message)
    }
  }
}

function handleMatrixSave(assignments) {
  console.log('Matrix assignments saved:', assignments)
  closeMatrixModal()
  // Refresh nodes and connections to update the canvas
  loadNodesAndConnections()
}

// Helper to get normalized node type
function getNodeType(node) {
  return (node.gearType || node.node_type || '').toLowerCase()
}

const loadingLayouts = ref(false)
const savedLayouts = ref([])

// Enhanced touch event handlers for mobile
let touchStartTime = 0
let touchStartPos = null
let isTouchDrawing = false
let touchDrawingPath = []

function onTouchStart(e) {
  e.preventDefault()
  console.log('Touch start detected')
  
  if (e.touches.length > 1) {
    // Multi-touch - ignore for now
    return
  }
  
  const touch = e.touches[0]
  const rect = canvas.value.getBoundingClientRect()
  const x = touch.clientX - rect.left
  const y = touch.clientY - rect.top
  
  touchStartTime = Date.now()
  touchStartPos = { x, y }
  
  // Convert to pointer event for consistency
  const pointerEvent = {
    clientX: touch.clientX,
    clientY: touch.clientY,
    button: 0,
    pointerType: 'touch',
    pointerId: touch.identifier,
    preventDefault: () => e.preventDefault()
  }
  
  onPointerDown(pointerEvent)
}

function onTouchMove(e) {
  e.preventDefault()
  
  if (e.touches.length > 1) {
    // Multi-touch - ignore for now
    return
  }
  
  const touch = e.touches[0]
  const rect = canvas.value.getBoundingClientRect()
  const x = touch.clientX - rect.left
  const y = touch.clientY - rect.top
  
  // Convert to pointer event for consistency
  const pointerEvent = {
    clientX: touch.clientX,
    clientY: touch.clientY,
    button: 0,
    pointerType: 'touch',
    pointerId: touch.identifier,
    preventDefault: () => e.preventDefault()
  }
  
  onPointerMove(pointerEvent)
}

</script>

<style scoped>
.signalmapper-container {
padding: 20px;
max-width: 1200px;
margin: 0 auto;
}

.signalmapper-topbar {
display: flex;
align-items: center;
gap: 20px;
margin-bottom: 20px;
padding: 15px;
background: #f8f9fa;
border-radius: 8px;
border: 1px solid #e9ecef;
position: relative;
}

.back-button {
padding: 8px 16px;
background: #6c757d;
color: white;
border: none;
border-radius: 6px;
cursor: pointer;
font-size: 14px;
transition: background-color 0.2s;
}

.back-button:hover {
background: #5a6268;
}

.location-label {
font-size: 14px;
color: #495057;
}

.signalmapper-title-row {
display: flex;
align-items: center;
justify-content: space-between;
margin-bottom: 0.5rem;
gap: 1rem;
}

.signalmapper-title {
margin: 0;
font-size: 1.6rem;
font-weight: 700;
color: #222;
}

.doc-btn {
background: #007bff;
color: #fff;
border: none;
border-radius: 6px;
padding: 10px 24px;
font-size: 1.1rem;
font-weight: 600;
cursor: pointer;
transition: background 0.18s;
z-index: 2;
}

.doc-btn:hover {
background: #0056b3;
}

.signalmapper-toolbar {
display: flex;
gap: 10px;
margin-bottom: 20px;
padding: 10px 0;
background: #f8f9fa;
border-radius: 8px;
border: 1px solid #e9ecef;
justify-content: center;
flex-wrap: wrap;
}

.signalmapper-toolbar button {
padding: 10px 18px;
border: none;
border-radius: 6px;
background: #fff;
color: #222;
font-size: 18px;
font-weight: 500;
cursor: pointer;
transition: background 0.18s, color 0.18s;
outline: none;
}

.signalmapper-toolbar button.active {
background: #007bff;
color: #fff;
}

.signalmapper-toolbar button:disabled {
background: #e9ecef;
color: #aaa;
cursor: not-allowed;
}

.signalmapper-toolbar button:focus {
box-shadow: 0 0 0 2px #007bff55;
}

.signalmapper-canvas-container {
display: flex;
justify-content: center;
align-items: center;
margin-bottom: 30px;
width: 100%;
}

.canvas-wrapper {
position: relative;
display: flex;
justify-content: center;
align-items: center;
margin-bottom: 30px;
width: 100%;
}

.canvas-wrapper canvas {
max-width: 100%;
min-height: 300px;
background: #fff;
border-radius: 8px;
border: 1px solid #e9ecef;
touch-action: none;
}

.tool-indicator {
position: absolute;
top: 10px;
left: 10px;
background: rgba(0, 0, 0, 0.7);
color: #fff;
padding: 8px 12px;
border-radius: 6px;
font-size: 12px;
font-weight: 500;
z-index: 10;
}

.pan-indicator {
font-size: 0.8em;
font-weight: normal;
color: #007bff;
}

.link-indicator {
font-size: 0.8em;
font-weight: normal;
color: #28a745;
}

.mode-selector {
display: flex;
gap: 10px;
margin-bottom: 20px;
padding: 15px;
background: #f8f9fa;
border-radius: 8px;
border: 1px solid #e9ecef;
}

.mode-btn {
padding: 12px 24px;
background: #fff;
border: 2px solid #dee2e6;
border-radius: 8px;
cursor: pointer;
font-size: 14px;
font-weight: 500;
transition: all 0.2s;
min-width: 120px;
}

.mode-btn:hover {
border-color: #007bff;
background: #f8f9fa;
}

.mode-btn.active {
background: #007bff;
color: white;
border-color: #007bff;
}

.mode-content {
background: white;
border-radius: 8px;
border: 1px solid #e9ecef;
min-height: 500px;
}

/* Gear Management Section */
.gear-management-section {
background: #f8f9fa;
border-radius: 8px;
border: 1px solid #e9ecef;
padding: 20px;
margin-bottom: 20px;
}

.gear-actions {
display: flex;
gap: 10px;
margin-bottom: 15px;
flex-wrap: wrap;
}

.gear-summary {
font-size: 14px;
color: #495057;
}

.gear-summary p {
margin: 5px 0;
}

/* Button Styles */
.btn {
display: inline-flex;
align-items: center;
gap: 0.5rem;
padding: 0.7rem 1.3rem;
border: none;
border-radius: 0.7rem;
font-size: 1.05rem;
font-weight: 600;
cursor: pointer;
transition: background 0.18s, box-shadow 0.18s, color 0.18s;
box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}

.btn-sm {
padding: 0.45rem 0.8rem;
font-size: 0.98rem;
}

.btn-primary { background: #2563eb; color: #fff; }
.btn-primary:hover, .btn-primary:focus { background: #1d4ed8; }
.btn-secondary { background: #64748b; color: #fff; }
.btn-secondary:hover, .btn-secondary:focus { background: #334155; }
.btn-danger { background: #ef4444; color: #fff; }
.btn-danger:hover, .btn-danger:focus { background: #b91c1c; }

.btn-icon {
font-size: 1.15em;
vertical-align: middle;
}

/* Modal Styles */
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

.modal-content.large {
max-width: 900px;
width: 95%;
}

.modal-header {
display: flex;
justify-content: space-between;
align-items: center;
padding: 20px;
border-bottom: 1px solid #e9ecef;
}

.modal-header-content {
flex: 1;
}

.modal-header h3 {
margin: 0;
font-size: 18px;
font-weight: 600;
color: #212529;
}

.modal-subtitle {
margin: 5px 0 0 0;
font-size: 14px;
color: #6c757d;
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
color: #495057;
}

.modal-body {
padding: 20px;
max-height: 60vh;
overflow-y: auto;
}

.gear-categories {
display: flex;
gap: 8px;
margin-bottom: 20px;
flex-wrap: wrap;
}

.category-btn {
padding: 8px 16px;
background: #f8f9fa;
border: 1px solid #dee2e6;
border-radius: 6px;
cursor: pointer;
font-size: 12px;
transition: all 0.2s;
}

.category-btn:hover {
background: #e9ecef;
}

.category-btn.active {
background: #007bff;
color: white;
border-color: #007bff;
}

.gear-list {
display: grid;
gap: 12px;
grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
}

.gear-item {
display: flex;
align-items: center;
gap: 12px;
padding: 12px;
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
font-size: 24px;
width: 40px;
height: 40px;
display: flex;
align-items: center;
justify-content: center;
background: #f8f9fa;
border-radius: 6px;
}

.gear-info {
flex: 1;
display: flex;
flex-direction: column;
gap: 4px;
}

.gear-name {
font-weight: 500;
color: #212529;
margin-bottom: 4px;
}

.gear-details {
font-size: 12px;
color: #6c757d;
display: flex;
flex-direction: column;
gap: 2px;
}

.gear-type {
font-weight: 500;
color: #495057;
text-transform: capitalize;
}

.gear-availability {
display: flex;
align-items: center;
gap: 4px;
}

.available-label {
color: #6c757d;
}

.available-amount {
font-weight: 600;
color: #28a745;
}

.user-gear-info {
display: flex;
align-items: center;
gap: 4px;
}

.owner-label {
color: #6c757d;
}

.owner-name {
font-weight: 500;
color: #007bff;
}

.gear-ports {
color: #6c757d;
}

.gear-action {
display: flex;
align-items: center;
}

.assign-btn {
padding: 6px 12px;
background: #007bff;
color: white;
border: none;
border-radius: 4px;
cursor: pointer;
font-size: 12px;
font-weight: 500;
transition: all 0.2s;
}

.assign-btn:hover:not(:disabled) {
background: #0056b3;
}

.assign-btn:disabled {
background: #6c757d;
cursor: not-allowed;
}

.gear-item.user-gear {
border-left: 4px solid #007bff;
}

.gear-item.no-available {
opacity: 0.6;
cursor: not-allowed;
}

.gear-item.no-available:hover {
background: transparent;
border-color: #e9ecef;
}

.loading-indicator {
text-align: center;
padding: 20px;
color: #6c757d;
}

.error-message {
text-align: center;
padding: 20px;
color: #dc3545;
}

.no-gear {
text-align: center;
padding: 20px;
color: #6c757d;
}

/* Gear Management Modal */
.gear-management-content {
max-height: 60vh;
overflow-y: auto;
}

.gear-assignments-list h4 {
margin: 0 0 15px 0;
color: #212529;
font-size: 16px;
font-weight: 600;
}

.no-assignments {
text-align: center;
padding: 20px;
color: #6c757d;
}

.assignments-list {
display: flex;
flex-direction: column;
gap: 10px;
}

.assignment-item {
display: flex;
justify-content: space-between;
align-items: center;
padding: 12px;
border: 1px solid #e9ecef;
border-radius: 8px;
background: #f8f9fa;
}

.assignment-info {
flex: 1;
}

.assignment-info .gear-name {
font-weight: 600;
color: #212529;
margin-bottom: 4px;
}

.assignment-details {
font-size: 12px;
color: #6c757d;
}

.assigned-amount {
font-weight: 600;
color: #28a745;
}

.total-amount {
color: #6c757d;
}

.assignment-actions {
display: flex;
gap: 8px;
}

@media (max-width: 768px) {
.signalmapper-container {
  padding: 15px;
}

.mode-selector {
  flex-direction: column;
}

.mode-btn {
  min-width: auto;
}

.gear-list {
  grid-template-columns: 1fr;
}
}

@media (max-width: 900px) {
.signalmapper-canvas-container canvas {
  max-width: 100vw;
  height: 40vh;
}
}

.doc-modal-content {
max-height: 80vh;
overflow-y: auto;
position: relative;
}

.image-controls {
display: flex;
gap: 10px;
margin-bottom: 10px;
align-items: center;
position: relative;
}
.image-controls button {
background: #f8f9fa;
border: 1px solid #dee2e6;
border-radius: 6px;
padding: 7px 16px;
font-size: 1rem;
font-weight: 500;
cursor: pointer;
transition: background 0.18s;
}
.image-controls button:hover {
background: #e9ecef;
}

.image-settings-popover {
position: absolute;
top: 40px;
left: 0;
z-index: 10;
background: #fff;
border: 1px solid #dee2e6;
border-radius: 8px;
box-shadow: 0 2px 8px rgba(0,0,0,0.08);
padding: 14px 18px;
min-width: 220px;
display: flex;
flex-direction: column;
gap: 12px;
}
.settings-row {
display: flex;
align-items: center;
gap: 10px;
justify-content: space-between;
}
.settings-row label {
font-size: 1rem;
font-weight: 500;
}
.settings-row input[type="range"] {
width: 90px;
}

.canvas-management {
display: flex;
justify-content: space-between;
align-items: center;
margin-bottom: 20px;
}

.canvas-stats {
display: flex;
gap: 20px;
font-size: 14px;
color: #6c757d;
}

.stat-item {
padding: 4px 8px;
background: #f8f9fa;
border-radius: 4px;
border: 1px solid #e9ecef;
}

.clear-canvas-btn {
padding: 10px 20px;
background: #dc3545;
color: white;
border: none;
border-radius: 6px;
cursor: pointer;
font-size: 1rem;
font-weight: 600;
transition: background 0.18s;
}

.clear-canvas-btn:hover {
background: #b91c1c;
}

.toolbar-divider {
width: 1px;
background: #dee2e6;
margin: 0 5px;
height: 30px;
}

.saved-layouts-list {
display: flex;
flex-direction: column;
gap: 12px;
}

.layout-item {
display: flex;
justify-content: space-between;
align-items: center;
padding: 15px;
border: 1px solid #e9ecef;
border-radius: 8px;
background: #f8f9fa;
transition: all 0.2s;
}

.layout-item:hover {
background: #e9ecef;
border-color: #007bff;
}

.layout-info {
flex: 1;
}

.layout-name {
font-weight: 600;
color: #212529;
margin-bottom: 4px;
font-size: 14px;
}

.layout-details {
font-size: 12px;
color: #6c757d;
margin-bottom: 4px;
}

.layout-date {
margin-right: 10px;
}

.layout-author {
color: #007bff;
font-weight: 500;
}

.layout-stats {
font-size: 11px;
color: #6c757d;
}

.layout-stats span {
margin-right: 10px;
}

.layout-actions {
display: flex;
gap: 8px;
}

.load-btn {
padding: 6px 12px;
background: #007bff;
color: white;
border: none;
border-radius: 4px;
cursor: pointer;
font-size: 12px;
font-weight: 500;
transition: all 0.2s;
}

.load-btn:hover {
background: #0056b3;
}

.delete-btn {
padding: 6px 12px;
background: #dc3545;
color: white;
border: none;
border-radius: 4px;
cursor: pointer;
font-size: 12px;
font-weight: 500;
transition: all 0.2s;
}

.delete-btn:hover {
background: #b91c1c;
}

.no-layouts {
text-align: center;
padding: 40px;
color: #6c757d;
}

.assign-btn-disabled {
background: #e9ecef !important;
color: #aaa !important;
cursor: not-allowed !important;
border: none;
}


</style> 