<template>
<div class="signalmapper-layout">
  <!-- Image Upload Section -->
  <div class="upload-section">
    <label for="floorplan-upload">Upload Floorplan Image:</label>
    <input
      id="floorplan-upload"
      type="file"
      @change="uploadFloorplan"
      accept="image/*"
    />
    <button @click="clearCanvas" class="clear-btn">Clear Canvas</button>
  </div>

  <!-- Canvas Controls -->
  <div class="canvas-controls">
    <div class="control-group">
      <label>Canvas Size:</label>
      <input 
        v-model.number="canvasWidth" 
        type="number" 
        placeholder="Width"
        class="size-input"
      />
      <input 
        v-model.number="canvasHeight" 
        type="number" 
        placeholder="Height"
        class="size-input"
      />
      <button @click="updateCanvasSize" class="update-btn">Update</button>
    </div>
    
    <div class="control-group">
      <button @click="zoomIn" title="Zoom In">🔍+</button>
      <button @click="zoomOut" title="Zoom Out">🔍-</button>
      <button @click="fitToCanvas" title="Fit to Canvas">📐</button>
      <button @click="resetView" title="Reset View">🔄</button>
    </div>
  </div>

  <!-- Canvas Container -->
  <div class="canvas-container">
    <canvas
      ref="layoutCanvas"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @click="handleCanvasClick"
      style="touch-action: none;"
    ></canvas>
  </div>

  <!-- Element Controls -->
  <div v-if="selectedElement" class="element-controls">
    <div class="control-item">
      <button @click="rotateElement(-10)" title="Rotate Left">↺</button>
      <small>Rotate</small>
    </div>
    <div class="control-item">
      <button @click="rotateElement(10)" title="Rotate Right">↻</button>
      <small>Rotate</small>
    </div>
    <div class="control-item">
      <button @click="resizeElement(0.9)" title="Decrease Size">➖</button>
      <small>Size</small>
    </div>
    <div class="control-item">
      <button @click="resizeElement(1.1)" title="Increase Size">➕</button>
      <small>Size</small>
    </div>
    <div class="control-item">
      <button @click="deleteElement" title="Delete">🗑️</button>
      <small>Delete</small>
    </div>
  </div>

  <!-- Drawing Tools -->
  <div class="drawing-tools">
    <label>Drawing Tools:</label>
    <div class="tool-buttons">
      <button 
        @click="setDrawingMode('select')"
        :class="{ active: drawingMode === 'select' }"
        title="Select Mode"
        class="tool-btn"
      >
        👆
      </button>
      <button 
        @click="setDrawingMode('line')"
        :class="{ active: drawingMode === 'line' }"
        title="Line Tool"
        class="tool-btn"
      >
        📏
      </button>
      <button 
        @click="setDrawingMode('square')"
        :class="{ active: drawingMode === 'square' }"
        title="Square Tool"
        class="tool-btn"
      >
        ⬜
      </button>
      <button 
        @click="setDrawingMode('freehand')"
        :class="{ active: drawingMode === 'freehand' }"
        title="Freehand Draw"
        class="tool-btn"
      >
        ✏️
      </button>
      <button 
        @click="setDrawingMode('text')"
        :class="{ active: drawingMode === 'text' }"
        title="Text Label"
        class="tool-btn"
      >
        🏷️
      </button>
    </div>
    
    <div v-if="drawingMode === 'line' || drawingMode === 'freehand' || drawingMode === 'square'" class="drawing-options">
      <div class="option-group">
        <label>Stroke Width:</label>
        <input 
          type="range" 
          v-model="strokeWidth"
          min="1" 
          max="20" 
          class="stroke-width-slider"
        />
        <span>{{ strokeWidth }}px</span>
      </div>
      <div class="option-group">
        <label>Stroke Color:</label>
        <input 
          type="color" 
          v-model="strokeColor"
          class="color-picker"
        />
      </div>
    </div>
    
    <div v-if="drawingMode === 'text'" class="drawing-options">
      <div class="option-group">
        <label>Text:</label>
        <input 
          type="text" 
          v-model="textContent"
          placeholder="Enter text..."
          class="text-input"
        />
      </div>
      <div class="option-group">
        <label>Font Size:</label>
        <input 
          type="range" 
          v-model="fontSize"
          min="12" 
          max="48" 
          class="font-size-slider"
        />
        <span>{{ fontSize }}px</span>
      </div>
      <div class="option-group">
        <label>Text Color:</label>
        <input 
          type="color" 
          v-model="textColor"
          class="color-picker"
        />
      </div>
    </div>
  </div>

  <!-- Bottom Toolbar -->
  <div class="bottom-toolbar">
    <button @click="newCanvas">🆕 New</button>
    <button @click="$emit('gear-selected')">➕ Add Gear</button>
    <button @click="undo" :disabled="!canUndo">↺ Undo</button>
    <button @click="redo" :disabled="!canRedo">↻ Redo</button>
    <button @click="toggleGrid">
      ▦ {{ showGrid ? "Hide" : "Show" }} Grid
    </button>
    <button @click="exportCanvasPDF">⤓ Export</button>
    <button @click="saveLayout" class="save-btn" :disabled="savingLayout">
      {{ savingLayout ? 'Saving...' : (currentLayoutId ? "Update Layout" : "Save Layout") }}
    </button>
  </div>

  <!-- Layout Save Section -->
  <div class="layout-save-section">
    <label for="layoutName">Layout Name:</label>
    <input
      id="layoutName"
      type="text"
      v-model="layoutName"
      placeholder="Enter layout name"
      class="layout-name-input"
    />
  </div>

  <!-- Saved Layouts Table -->
  <div class="saved-layouts">
    <h4>Saved Layouts</h4>
    
    <!-- Loading State -->
    <div v-if="loadingLayouts" class="loading-state">
      <div class="loading-indicator">
        <p>Loading saved layouts...</p>
        <div class="loading-spinner"></div>
      </div>
    </div>
    
    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <div class="error-indicator">
        <p>Error loading layouts: {{ error }}</p>
        <button @click="loadSavedLayouts" class="retry-btn">Retry</button>
      </div>
    </div>
    
    <!-- Layouts Table -->
    <div v-else>
      <table class="layout-table">
        <thead>
          <tr>
            <th>Details</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!savedLayouts.length">
            <td colspan="2">No layouts saved.</td>
          </tr>
          <tr
            v-for="layout in savedLayouts"
            :key="layout.id"
            :class="{ hovered: hoveredLayoutId === layout.id }"
            @mouseover="hoveredLayoutId = layout.id"
            @mouseleave="hoveredLayoutId = null"
          >
            <td>
              <div class="details-cell">
                <strong>{{ layout.name }}</strong><br />
                <small>By: {{ layout.created_email }}</small><br />
                <small>{{ new Date(layout.inserted_at).toLocaleString() }}</small>
              </div>
            </td>
            <td class="actions-cell">
              <button
                @click="loadLayout(layout)"
                :disabled="layout.id === currentLayoutId"
              >
                Load
              </button>
              <button @click="deleteLayout(layout.id)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { supabase } from '@/supabase'
import { jsPDF } from 'jspdf'
import { getNodes, getConnections } from '@/services/signalMapperService'

const props = defineProps({
locationId: {
  type: [String, Number],
  required: true
},
projectId: {
  type: [String, Number],
  required: true
}
})

const emit = defineEmits(['gear-selected', 'connection-requested', 'matrix-port-requested'])

// Canvas and drawing state
const layoutCanvas = ref(null)
const canvasWidth = ref(800)
const canvasHeight = ref(600)
const drawingMode = ref('select')
const strokeWidth = ref(3)
const strokeColor = ref('#000000')
const textContent = ref('')
const fontSize = ref(16)
const textColor = ref('#000000')
const showGrid = ref(true)

// Element management
const selectedElement = ref(null)
const elements = ref([])
const canUndo = ref(false)
const canRedo = ref(false)
const undoStack = ref([])
const redoStack = ref([])

// Layout management
const layoutName = ref('')
const currentLayoutId = ref(null)
const savedLayouts = ref([])
const hoveredLayoutId = ref(null)

// Loading states
const loadingLayouts = ref(false)
const savingLayout = ref(false)
const error = ref(null)

// Canvas context and drawing state
let ctx = null
let isDrawing = false
let lastX = 0
let lastY = 0

onMounted(() => {
initializeCanvas()
loadSavedLayouts()
})

function initializeCanvas() {
const canvas = layoutCanvas.value
if (!canvas) return

ctx = canvas.getContext('2d')
canvas.width = canvasWidth.value
canvas.height = canvasHeight.value

drawCanvas()
}

function drawCanvas() {
if (!ctx) return

// Clear canvas
ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value)

// Draw grid
if (showGrid.value) {
  drawGrid()
}

// Draw elements
elements.value.forEach(element => {
  drawElement(element)
})
}

function drawGrid() {
const gridSize = 20
ctx.strokeStyle = '#e0e0e0'
ctx.lineWidth = 1

for (let x = 0; x <= canvasWidth.value; x += gridSize) {
  ctx.beginPath()
  ctx.moveTo(x, 0)
  ctx.lineTo(x, canvasHeight.value)
  ctx.stroke()
}

for (let y = 0; y <= canvasHeight.value; y += gridSize) {
  ctx.beginPath()
  ctx.moveTo(0, y)
  ctx.lineTo(canvasWidth.value, y)
  ctx.stroke()
}
}

function drawElement(element) {
ctx.save()

// Apply transformations
ctx.translate(element.x + element.width / 2, element.y + element.height / 2)
ctx.rotate(element.rotation * Math.PI / 180)
ctx.scale(element.scale, element.scale)

// Draw element based on type
switch (element.type) {
  case 'gear':
    drawGearElement(element)
    break
  case 'line':
    drawLineElement(element)
    break
  case 'shape':
    drawShapeElement(element)
    break
  case 'text':
    drawTextElement(element)
    break
}

ctx.restore()
}

function drawGearElement(element) {
// Draw gear icon/representation
ctx.fillStyle = element.color || '#007bff'
ctx.fillRect(-element.width / 2, -element.height / 2, element.width, element.height)

// Draw label
ctx.fillStyle = '#ffffff'
ctx.font = '12px Arial'
ctx.textAlign = 'center'
ctx.fillText(element.label, 0, 0)
}

function drawLineElement(element) {
ctx.strokeStyle = element.color || strokeColor.value
ctx.lineWidth = element.width || strokeWidth.value
ctx.beginPath()
ctx.moveTo(element.startX, element.startY)
ctx.lineTo(element.endX, element.endY)
ctx.stroke()
}

function drawShapeElement(element) {
ctx.fillStyle = element.color || strokeColor.value
ctx.fillRect(-element.width / 2, -element.height / 2, element.width, element.height)
}

function drawTextElement(element) {
ctx.fillStyle = element.color || textColor.value
ctx.font = `${element.fontSize || fontSize.value}px Arial`
ctx.textAlign = 'center'
ctx.fillText(element.text, 0, 0)
}

// Event handlers
function onPointerDown(event) {
const rect = layoutCanvas.value.getBoundingClientRect()
const x = event.clientX - rect.left
const y = event.clientY - rect.top

if (drawingMode.value === 'select') {
  selectElement(x, y)
} else {
  startDrawing(x, y)
}
}

function onPointerMove(event) {
if (!isDrawing) return

const rect = layoutCanvas.value.getBoundingClientRect()
const x = event.clientX - rect.left
const y = event.clientY - rect.top

continueDrawing(x, y)
}

function onPointerUp() {
if (isDrawing) {
  finishDrawing()
}
}

function handleCanvasClick(event) {
if (drawingMode.value === 'select') {
  const rect = layoutCanvas.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  
  // Check if clicked on empty space
  const clickedElement = getElementAtPosition(x, y)
  if (!clickedElement) {
    selectedElement.value = null
    drawCanvas()
  }
}
}

// Drawing functions
function startDrawing(x, y) {
isDrawing = true
lastX = x
lastY = y

if (drawingMode.value === 'line') {
  // Start line drawing
} else if (drawingMode.value === 'freehand') {
  // Start freehand drawing
}
}

function continueDrawing(x, y) {
if (drawingMode.value === 'freehand') {
  ctx.beginPath()
  ctx.moveTo(lastX, lastY)
  ctx.lineTo(x, y)
  ctx.strokeStyle = strokeColor.value
  ctx.lineWidth = strokeWidth.value
  ctx.stroke()
  
  lastX = x
  lastY = y
}
}

function finishDrawing() {
isDrawing = false

if (drawingMode.value === 'line') {
  // Create line element
  const lineElement = {
    id: Date.now(),
    type: 'line',
    startX: lastX,
    startY: lastY,
    endX: lastX,
    endY: lastY,
    color: strokeColor.value,
    width: strokeWidth.value
  }
  elements.value.push(lineElement)
}

saveState()
drawCanvas()
}

// Element selection and manipulation
function selectElement(x, y) {
const element = getElementAtPosition(x, y)
selectedElement.value = element
drawCanvas()
}

function getElementAtPosition(x, y) {
// Find element at position (simplified)
return elements.value.find(element => {
  return x >= element.x && x <= element.x + element.width &&
         y >= element.y && y <= element.y + element.height
})
}

function rotateElement(angle) {
if (!selectedElement.value) return

selectedElement.value.rotation += angle
saveState()
drawCanvas()
}

function resizeElement(factor) {
if (!selectedElement.value) return

selectedElement.value.scale *= factor
saveState()
drawCanvas()
}

function deleteElement() {
if (!selectedElement.value) return

const index = elements.value.indexOf(selectedElement.value)
if (index > -1) {
  elements.value.splice(index, 1)
  selectedElement.value = null
  saveState()
  drawCanvas()
}
}

// Canvas controls
function zoomIn() {
// Implement zoom functionality
}

function zoomOut() {
// Implement zoom functionality
}

function fitToCanvas() {
// Implement fit to canvas
}

function resetView() {
// Reset view transformations
}

function updateCanvasSize() {
initializeCanvas()
}

function toggleGrid() {
showGrid.value = !showGrid.value
drawCanvas()
}

// Undo/Redo
function saveState() {
undoStack.value.push(JSON.stringify(elements.value))
canUndo.value = true
redoStack.value = []
canRedo.value = false
}

function undo() {
if (undoStack.value.length === 0) return

redoStack.value.push(JSON.stringify(elements.value))
elements.value = JSON.parse(undoStack.value.pop())
canUndo.value = undoStack.value.length > 0
canRedo.value = true
drawCanvas()
}

function redo() {
if (redoStack.value.length === 0) return

undoStack.value.push(JSON.stringify(elements.value))
elements.value = JSON.parse(redoStack.value.pop())
canRedo.value = redoStack.value.length > 0
canUndo.value = true
drawCanvas()
}

// Drawing mode
function setDrawingMode(mode) {
drawingMode.value = mode
selectedElement.value = null
}

// File operations
function uploadFloorplan(event) {
const file = event.target.files[0]
if (!file) return

const reader = new FileReader()
reader.onload = function(e) {
  const img = new Image()
  img.onload = function() {
    // Add image as background or element
    const imageElement = {
      id: Date.now(),
      type: 'image',
      x: 0,
      y: 0,
      width: img.width,
      height: img.height,
      src: e.target.result
    }
    elements.value.unshift(imageElement)
    saveState()
    drawCanvas()
  }
  img.src = e.target.result
}
reader.readAsDataURL(file)
}

function clearCanvas() {
elements.value = []
selectedElement.value = null
saveState()
drawCanvas()
}

function newCanvas() {
if (confirm('Are you sure you want to start a new canvas? This will clear all current work.')) {
  clearCanvas()
}
}

// Export
function exportCanvasPDF() {
const canvas = layoutCanvas.value
if (!canvas) return

const imgData = canvas.toDataURL('image/png')
const pdf = new jsPDF('landscape', 'mm', 'a4')
const imgWidth = 297
const imgHeight = (canvas.height * imgWidth) / canvas.width
pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
pdf.save('signal-mapper-layout.pdf')
}

// Layout management
async function loadSavedLayouts() {
if (!props.locationId) return

loadingLayouts.value = true
error.value = null

try {
  const { data, error: supabaseError } = await supabase
    .from('signal_mapper_layouts')
    .select('*')
    .eq('location_id', props.locationId)
    .order('inserted_at', { ascending: false })
  
  if (supabaseError) {
    throw supabaseError
  }
  
  savedLayouts.value = data || []
} catch (err) {
  console.error('Error loading saved layouts:', err)
  error.value = err.message || 'Failed to load saved layouts'
} finally {
  loadingLayouts.value = false
}
}

async function saveLayoutToSupabase() {
if (!layoutName.value.trim()) {
  alert('Please enter a layout name')
  return
}

if (!props.locationId) {
  alert('No location ID available')
  return
}

savingLayout.value = true
error.value = null

try {
  const layoutData = {
    name: layoutName.value,
    location_id: props.locationId,
    project_id: props.projectId,
    elements: elements.value,
    canvas_width: canvasWidth.value,
    canvas_height: canvasHeight.value
  }
  
  if (currentLayoutId.value) {
    // Update existing layout
    const { error: supabaseError } = await supabase
      .from('signal_mapper_layouts')
      .update(layoutData)
      .eq('id', currentLayoutId.value)
    
    if (supabaseError) {
      throw supabaseError
    }
    
    alert('Layout updated successfully')
  } else {
    // Create new layout
    const { error: supabaseError } = await supabase
      .from('signal_mapper_layouts')
      .insert(layoutData)
    
    if (supabaseError) {
      throw supabaseError
    }
    
    alert('Layout saved successfully')
  }
  
  await loadSavedLayouts()
} catch (err) {
  console.error('Error saving layout:', err)
  error.value = err.message || 'Failed to save layout'
  alert('Failed to save layout: ' + err.message)
} finally {
  savingLayout.value = false
}
}

function saveLayout() {
// Quick save without modal
if (!layoutName.value) {
  layoutName.value = `Layout ${new Date().toLocaleString()}`
}
saveLayoutToSupabase()
}

async function loadLayout(layout) {
if (confirm('Load this layout? Current work will be lost.')) {
  try {
    elements.value = layout.elements || []
    canvasWidth.value = layout.canvas_width || 800
    canvasHeight.value = layout.canvas_height || 600
    layoutName.value = layout.name
    currentLayoutId.value = layout.id
    
    nextTick(() => {
      initializeCanvas()
    })
  } catch (err) {
    console.error('Error loading layout:', err)
    alert('Failed to load layout: ' + err.message)
  }
}
}

async function deleteLayout(layoutId) {
if (confirm('Delete this layout?')) {
  try {
    const { error: supabaseError } = await supabase
      .from('signal_mapper_layouts')
      .delete()
      .eq('id', layoutId)
    
    if (supabaseError) {
      throw supabaseError
    }
    
    await loadSavedLayouts()
  } catch (err) {
    console.error('Error deleting layout:', err)
    alert('Failed to delete layout: ' + err.message)
  }
}
}
</script>

<style scoped>
.signalmapper-layout {
padding: 20px;
}

.upload-section {
margin-bottom: 20px;
padding: 15px;
background: #f8f9fa;
border-radius: 8px;
border: 1px solid #e9ecef;
}

.upload-section label {
display: block;
margin-bottom: 8px;
font-weight: 500;
color: #495057;
}

.clear-btn {
margin-left: 10px;
padding: 6px 12px;
background: #dc3545;
color: white;
border: none;
border-radius: 4px;
cursor: pointer;
font-size: 12px;
}

.canvas-controls {
display: flex;
gap: 20px;
margin-bottom: 20px;
padding: 15px;
background: #f8f9fa;
border-radius: 8px;
border: 1px solid #e9ecef;
flex-wrap: wrap;
}

.control-group {
display: flex;
align-items: center;
gap: 8px;
}

.control-group label {
font-weight: 500;
color: #495057;
font-size: 14px;
}

.size-input {
width: 80px;
padding: 4px 8px;
border: 1px solid #ced4da;
border-radius: 4px;
font-size: 12px;
}

.update-btn {
padding: 4px 8px;
background: #007bff;
color: white;
border: none;
border-radius: 4px;
cursor: pointer;
font-size: 12px;
}

.control-group button {
padding: 6px 10px;
background: #6c757d;
color: white;
border: none;
border-radius: 4px;
cursor: pointer;
font-size: 12px;
}

.canvas-container {
margin-bottom: 20px;
border: 2px solid #dee2e6;
border-radius: 8px;
overflow: hidden;
background: white;
}

.canvas-container canvas {
display: block;
max-width: 100%;
height: auto;
}

.element-controls {
display: flex;
gap: 15px;
margin-bottom: 20px;
padding: 15px;
background: #f8f9fa;
border-radius: 8px;
border: 1px solid #e9ecef;
justify-content: center;
}

.control-item {
display: flex;
flex-direction: column;
align-items: center;
gap: 4px;
}

.control-item button {
width: 40px;
height: 40px;
font-size: 18px;
border: 2px solid #dee2e6;
border-radius: 6px;
background: white;
cursor: pointer;
transition: all 0.2s;
}

.control-item button:hover {
border-color: #007bff;
background: #f8f9fa;
}

.control-item small {
font-size: 10px;
color: #6c757d;
}

.drawing-tools {
margin-bottom: 20px;
padding: 15px;
background: #f8f9fa;
border-radius: 8px;
border: 1px solid #e9ecef;
}

.drawing-tools label {
display: block;
margin-bottom: 8px;
font-weight: 500;
color: #495057;
}

.tool-buttons {
display: flex;
gap: 8px;
margin-bottom: 15px;
}

.tool-btn {
width: 50px;
height: 50px;
font-size: 20px;
border: 2px solid #dee2e6;
border-radius: 6px;
background: white;
cursor: pointer;
transition: all 0.2s;
}

.tool-btn:hover {
border-color: #007bff;
background: #f8f9fa;
}

.tool-btn.active {
border-color: #007bff;
background: #007bff;
color: white;
}

.drawing-options {
display: flex;
gap: 20px;
flex-wrap: wrap;
}

.option-group {
display: flex;
align-items: center;
gap: 8px;
}

.option-group label {
font-size: 12px;
color: #495057;
min-width: 80px;
}

.stroke-width-slider,
.font-size-slider {
width: 100px;
}

.color-picker {
width: 40px;
height: 30px;
border: 1px solid #ced4da;
border-radius: 4px;
}

.text-input {
width: 150px;
padding: 4px 8px;
border: 1px solid #ced4da;
border-radius: 4px;
font-size: 12px;
}

.bottom-toolbar {
display: flex;
gap: 10px;
margin-bottom: 20px;
padding: 15px;
background: #f8f9fa;
border-radius: 8px;
border: 1px solid #e9ecef;
flex-wrap: wrap;
}

.bottom-toolbar button {
padding: 8px 16px;
background: #007bff;
color: white;
border: none;
border-radius: 6px;
cursor: pointer;
font-size: 14px;
transition: background-color 0.2s;
}

.bottom-toolbar button:hover {
background: #0056b3;
}

.bottom-toolbar button:disabled {
background: #6c757d;
cursor: not-allowed;
}

.layout-save-section {
margin-bottom: 20px;
padding: 15px;
background: #f8f9fa;
border-radius: 8px;
border: 1px solid #e9ecef;
display: flex;
align-items: center;
gap: 15px;
flex-wrap: wrap;
}

.layout-save-section label {
font-weight: 500;
color: #495057;
}

.layout-name-input {
flex: 1;
min-width: 200px;
padding: 8px 12px;
border: 1px solid #ced4da;
border-radius: 6px;
font-size: 14px;
}

.save-btn {
padding: 8px 16px;
background: #28a745;
color: white;
border: none;
border-radius: 6px;
cursor: pointer;
font-size: 14px;
transition: background-color 0.2s;
}

.save-btn:hover {
background: #218838;
}

.saved-layouts {
margin-top: 20px;
}

.saved-layouts h4 {
margin-bottom: 15px;
color: #495057;
font-size: 16px;
font-weight: 600;
}

.layout-table {
width: 100%;
border-collapse: collapse;
background: white;
border-radius: 8px;
overflow: hidden;
border: 1px solid #e9ecef;
}

.layout-table th {
background: #f8f9fa;
padding: 12px;
text-align: left;
font-weight: 600;
color: #495057;
border-bottom: 1px solid #e9ecef;
}

.layout-table td {
padding: 12px;
border-bottom: 1px solid #e9ecef;
}

.layout-table tr:hover {
background: #f8f9fa;
}

.details-cell strong {
color: #212529;
font-size: 14px;
}

.details-cell small {
color: #6c757d;
font-size: 11px;
}

.actions-cell {
display: flex;
gap: 8px;
}

.actions-cell button {
padding: 4px 8px;
border: 1px solid #ced4da;
border-radius: 4px;
background: white;
cursor: pointer;
font-size: 12px;
transition: all 0.2s;
}

.actions-cell button:hover {
background: #f8f9fa;
border-color: #007bff;
}

.actions-cell button:disabled {
opacity: 0.5;
cursor: not-allowed;
}

@media (max-width: 768px) {
.signalmapper-layout {
  padding: 15px;
}

.canvas-controls {
  flex-direction: column;
}

.element-controls {
  flex-wrap: wrap;
}

.bottom-toolbar {
  flex-direction: column;
}

.layout-save-section {
  flex-direction: column;
  align-items: stretch;
}

.layout-name-input {
  min-width: auto;
}
}

.loading-state,
.error-state {
padding: 20px;
text-align: center;
background: #f8f9fa;
border-radius: 8px;
border: 1px solid #e9ecef;
}

.loading-indicator,
.error-indicator {
display: flex;
flex-direction: column;
align-items: center;
gap: 10px;
}

.loading-spinner {
width: 20px;
height: 20px;
border: 2px solid #e9ecef;
border-top: 2px solid #007bff;
border-radius: 50%;
animation: spin 1s linear infinite;
}

@keyframes spin {
0% { transform: rotate(0deg); }
100% { transform: rotate(360deg); }
}

.retry-btn {
padding: 6px 12px;
background: #007bff;
color: white;
border: none;
border-radius: 4px;
cursor: pointer;
font-size: 12px;
}

.retry-btn:hover {
background: #0056b3;
}

.save-btn:disabled {
background: #6c757d;
cursor: not-allowed;
}
</style> 