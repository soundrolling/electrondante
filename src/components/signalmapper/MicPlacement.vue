<template>
<div class="mic-placement-container">
  <div class="placement-header">
    <h3>Mic Placement</h3>
    <p>Place microphones on the floor plan and assign track names</p>
  </div>

  <!-- Image Controls -->
  <div class="image-controls">
    <button @click="showImageSettings = !showImageSettings" title="Image Settings">
      🖼️ Image Settings
    </button>
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
        <input type="file" accept="image/*" @change="onImageUpload" id="image-upload" style="display:none" />
        <button @click="triggerImageUpload">{{ bgImage ? 'Replace' : 'Upload' }} Image</button>
      </div>
    </div>
  </div>

  <!-- Toolbar -->
  <div class="placement-toolbar">
    <button @click="openGearModal" class="btn-primary">➕ Add Microphone</button>
    <button @click="deleteSelected" :disabled="!selectedMic" class="btn-danger">
      🗑️ Delete Selected
    </button>
    <div class="toolbar-divider"></div>
    <span class="mic-count">Mics Placed: {{ nodes.length }}</span>
  </div>

  <!-- Properties Panel (when mic is selected) -->
  <div v-if="selectedMic" class="properties-panel">
    <h4>Mic Properties</h4>
    <div class="property-row">
      <label>Track Name:</label>
      <input 
        v-model="selectedMic.track_name" 
        @change="updateSelectedMic"
        type="text"
        placeholder="e.g. Stage L"
      />
    </div>
    <div class="property-row">
      <label>Rotation (degrees):</label>
      <input 
        v-model.number="selectedMic.rotation" 
        @change="updateSelectedMic"
        type="number"
        min="0"
        max="360"
        step="1"
      />
    </div>
    <div class="property-row">
      <label>Label:</label>
      <span>{{ selectedMic.label }}</span>
    </div>
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
  </div>

  <!-- Gear Selection Modal -->
  <div v-if="showGearModal" class="modal-overlay" @click="closeGearModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Select Microphone</h3>
        <button @click="closeGearModal" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <div v-if="availableMics.length === 0" class="no-gear">
          <p>No microphones (sources) available for this location.</p>
        </div>
        <div v-else class="gear-list">
          <div 
            v-for="mic in availableMics" 
            :key="mic.id"
            @click="selectMic(mic)"
            class="gear-item"
          >
            <div class="gear-icon">🎤</div>
            <div class="gear-info">
              <div class="gear-name">{{ mic.gear_name }}</div>
              <div class="gear-details">
                Available: {{ getAvailableCount(mic) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { addNode, updateNode, deleteNode } from '@/services/signalMapperService'

const props = defineProps({
  projectId: { type: [String, Number], required: true },
  locationId: { type: [String, Number], default: null },
  nodes: { type: Array, default: () => [] },
  gearList: { type: Array, default: () => [] }
})

const emit = defineEmits(['node-updated', 'node-added', 'node-deleted'])

const toast = useToast()
const canvas = ref(null)
const dpr = window.devicePixelRatio || 1
const canvasWidth = ref(800)
const canvasHeight = ref(600)
const canvasStyle = computed(() => 
  `width: ${canvasWidth.value}px; height: ${canvasHeight.value}px; display: block; margin: 0 auto; background: #fff; border-radius: 8px; border: 1px solid #e9ecef;`
)

// Image state
const bgImage = ref(null)
const bgImageObj = ref(null)
const bgOpacity = ref(1.0)
const imageOffsetX = ref(0)
const imageOffsetY = ref(0)
const scaleFactor = ref(1)
const panImageMode = ref(false)
const showImageSettings = ref(false)

// Mic state
const selectedMic = ref(null)
const draggingMic = ref(null)
const rotatingMic = ref(null)
let dragStart = null
let dragStartPos = null

// Modal state
const showGearModal = ref(false)

// Available mics (sources only)
const availableMics = computed(() => {
  return props.gearList.filter(g => 
    (g.gear_type === 'source' || g.gear_type?.includes('source')) &&
    g.assignments?.[props.locationId] > 0
  )
})

function getAvailableCount(mic) {
  const assigned = mic.assignments?.[props.locationId] || 0
  const placed = props.nodes.filter(n => n.gear_id === mic.id).length
  return Math.max(0, assigned - placed)
}

// Canvas drawing
function drawCanvas() {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) return
  
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvasWidth.value * dpr, canvasHeight.value * dpr)
  ctx.scale(dpr, dpr)

  // Background
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvasWidth.value, canvasHeight.value)

  // Draw background image
  if (bgImageObj.value) {
    ctx.globalAlpha = bgOpacity.value
    ctx.drawImage(
      bgImageObj.value,
      imageOffsetX.value,
      imageOffsetY.value,
      bgImageObj.value.width * scaleFactor.value,
      bgImageObj.value.height * scaleFactor.value
    )
    ctx.globalAlpha = 1.0
  }

  // Draw mics
  props.nodes.forEach(mic => {
    drawMic(ctx, mic)
  })
}

function drawMic(ctx, mic) {
  const { x, y } = imageToCanvasCoords(mic.x, mic.y)
  const rotation = mic.rotation || 0
  
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((rotation * Math.PI) / 180)

  // Draw mic circle
  ctx.beginPath()
  ctx.arc(0, 0, 20, 0, 2 * Math.PI)
  ctx.fillStyle = mic === selectedMic.value ? '#007bff' : '#fff'
  ctx.strokeStyle = mic === selectedMic.value ? '#0056b3' : '#007bff'
  ctx.lineWidth = mic === selectedMic.value ? 3 : 2
  ctx.fill()
  ctx.stroke()

  // Draw direction indicator (arrow)
  ctx.beginPath()
  ctx.moveTo(0, -15)
  ctx.lineTo(5, -5)
  ctx.lineTo(-5, -5)
  ctx.closePath()
  ctx.fillStyle = mic === selectedMic.value ? '#007bff' : '#495057'
  ctx.fill()

  // Selection indicator
  if (mic === selectedMic.value) {
    ctx.beginPath()
    ctx.arc(0, 0, 30, 0, 2 * Math.PI)
    ctx.strokeStyle = '#007bff'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.stroke()
    ctx.setLineDash([])

    // Rotation handle
    ctx.beginPath()
    ctx.arc(0, -35, 5, 0, 2 * Math.PI)
    ctx.fillStyle = '#28a745'
    ctx.fill()
  }

  ctx.restore()

  // Draw label
  ctx.fillStyle = '#222'
  ctx.font = 'bold 12px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(mic.track_name || mic.label, x, y + 40)
}

// Image handling
function onImageUpload(e) {
  const file = e.target.files[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (ev) => {
    bgImage.value = ev.target.result
    const img = new Image()
    img.onload = () => {
      bgImageObj.value = img
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

function fitImageToCanvas(img) {
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
  }
}

function zoomIn() { scaleFactor.value *= 1.1; drawCanvas() }
function zoomOut() { scaleFactor.value /= 1.1; drawCanvas() }
function triggerImageUpload() {
  document.getElementById('image-upload').click()
}

// Coordinate transforms
function canvasToImageCoords(canvasX, canvasY) {
  if (!bgImageObj.value) {
    return { imgX: canvasX / canvasWidth.value, imgY: canvasY / canvasHeight.value }
  }
  const imgW = bgImageObj.value.width
  const imgH = bgImageObj.value.height
  const scale = scaleFactor.value
  const offsetX = imageOffsetX.value
  const offsetY = imageOffsetY.value
  return {
    imgX: (canvasX - offsetX) / (imgW * scale),
    imgY: (canvasY - offsetY) / (imgH * scale)
  }
}

function imageToCanvasCoords(imgX, imgY) {
  if (!bgImageObj.value) {
    return { x: imgX * canvasWidth.value, y: imgY * canvasHeight.value }
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

function getCanvasCoords(e) {
  const rect = canvas.value.getBoundingClientRect()
  const scaleX = canvas.value.width / rect.width
  const scaleY = canvas.value.height / rect.height
  return {
    x: (e.clientX - rect.left) * scaleX / dpr,
    y: (e.clientY - rect.top) * scaleY / dpr
  }
}

// Pointer events
function onPointerDown(e) {
  e.preventDefault()
  if (e.button !== 0) return

  const { x, y } = getCanvasCoords(e)

  // Pan mode
  if (panImageMode.value && bgImageObj.value) {
    dragStart = { x, y }
    dragStartPos = { x: imageOffsetX.value, y: imageOffsetY.value }
    return
  }

  const imgPt = canvasToImageCoords(x, y)
  const clickedMic = getMicAt(imgPt.imgX, imgPt.imgY)

  if (clickedMic) {
    // Check if clicking rotation handle
    const { x: micX, y: micY } = imageToCanvasCoords(clickedMic.x, clickedMic.y)
    const handleY = micY - 35
    const dist = Math.sqrt((x - micX) ** 2 + (y - handleY) ** 2)
    
    if (dist < 8) {
      // Clicked rotation handle
      rotatingMic.value = clickedMic
      selectedMic.value = clickedMic
    } else {
      // Start dragging
      draggingMic.value = clickedMic
      selectedMic.value = clickedMic
      dragStart = { x: imgPt.imgX, y: imgPt.imgY }
      dragStartPos = { x: clickedMic.x, y: clickedMic.y }
    }
  } else {
    selectedMic.value = null
  }
  
  drawCanvas()
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

  // Dragging mic
  if (draggingMic.value && dragStart) {
    const imgPt = canvasToImageCoords(x, y)
    draggingMic.value.x = imgPt.imgX
    draggingMic.value.y = imgPt.imgY
    drawCanvas()
  }

  // Rotating mic
  if (rotatingMic.value) {
    const { x: micX, y: micY } = imageToCanvasCoords(rotatingMic.value.x, rotatingMic.value.y)
    const angle = Math.atan2(y - micY, x - micX) * (180 / Math.PI)
    rotatingMic.value.rotation = (angle + 90 + 360) % 360
    drawCanvas()
  }
}

async function onPointerUp(e) {
  e.preventDefault()

  if (panImageMode.value) {
    dragStart = null
    dragStartPos = null
    return
  }

  // Save mic position/rotation
  if (draggingMic.value) {
    await saveMicUpdate(draggingMic.value)
    draggingMic.value = null
  }

  if (rotatingMic.value) {
    await saveMicUpdate(rotatingMic.value)
    rotatingMic.value = null
  }

  dragStart = null
  dragStartPos = null
}

// Mic detection
function getMicAt(imgX, imgY) {
  for (let i = props.nodes.length - 1; i >= 0; i--) {
    const mic = props.nodes[i]
    const dx = imgX - mic.x
    const dy = imgY - mic.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 0.05) return mic // 5% of image size
  }
  return null
}

// Gear modal
function openGearModal() {
  showGearModal.value = true
}

function closeGearModal() {
  showGearModal.value = false
}

async function selectMic(mic) {
  const available = getAvailableCount(mic)
  if (available <= 0) {
    toast.error('No more units of this microphone available')
    return
  }

  const trackName = prompt('Enter track name for this mic:', mic.gear_name)
  if (!trackName) {
    toast.error('Track name is required')
    return
  }

  try {
    const centerX = canvasWidth.value / 2
    const centerY = canvasHeight.value / 2
    const imgCoords = canvasToImageCoords(centerX, centerY)

    const newNode = await addNode({
      project_id: props.projectId,
      type: 'gear',
      gear_id: mic.id,
      label: mic.gear_name,
      track_name: trackName,
      x: imgCoords.imgX,
      y: imgCoords.imgY,
      rotation: 0,
      gear_type: 'source',
      node_type: 'source',
      num_inputs: mic.num_inputs || 0,
      num_outputs: mic.num_outputs || 1,
      num_tracks: 0
    })

    emit('node-added', newNode)
    closeGearModal()
    toast.success(`Added ${trackName}`)
    nextTick(drawCanvas)
  } catch (err) {
    console.error('Error adding mic:', err)
    toast.error('Failed to add microphone')
  }
}

async function updateSelectedMic() {
  if (!selectedMic.value) return
  await saveMicUpdate(selectedMic.value)
}

async function saveMicUpdate(mic) {
  try {
    await updateNode({
      id: mic.id,
      x: mic.x,
      y: mic.y,
      rotation: mic.rotation,
      track_name: mic.track_name
    })
    emit('node-updated', mic)
  } catch (err) {
    console.error('Error updating mic:', err)
    toast.error('Failed to update microphone')
  }
}

async function deleteSelected() {
  if (!selectedMic.value) return
  
  if (!confirm(`Delete ${selectedMic.value.track_name || selectedMic.value.label}?`)) return

  try {
    await deleteNode(selectedMic.value.id)
    emit('node-deleted', selectedMic.value.id)
    selectedMic.value = null
    toast.success('Microphone deleted')
    nextTick(drawCanvas)
  } catch (err) {
    console.error('Error deleting mic:', err)
    toast.error('Failed to delete microphone')
  }
}

// Watchers
watch([() => props.nodes, bgOpacity], () => nextTick(drawCanvas))

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
.mic-placement-container {
  padding: 20px;
}

.placement-header {
  margin-bottom: 20px;
  text-align: center;
}

.placement-header h3 {
  margin: 0 0 10px 0;
  font-size: 24px;
  color: #212529;
}

.placement-header p {
  margin: 0;
  color: #6c757d;
}

.image-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  position: relative;
}

.image-controls button {
  padding: 8px 16px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.image-controls button:hover {
  background: #e9ecef;
}

.image-settings-popover {
  position: absolute;
  top: 45px;
  left: 0;
  z-index: 10;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  padding: 15px;
  min-width: 250px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.settings-row label {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.placement-toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 15px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 8px;
}

.toolbar-divider {
  width: 1px;
  height: 30px;
  background: #dee2e6;
  margin: 0 10px;
}

.mic-count {
  color: #6c757d;
  font-size: 14px;
}

.btn-primary {
  padding: 10px 20px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn-danger {
  padding: 10px 20px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-danger:hover {
  background: #c82333;
}

.btn-danger:disabled {
  background: #e9ecef;
  color: #adb5bd;
  cursor: not-allowed;
}

.properties-panel {
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
  margin-bottom: 15px;
}

.properties-panel h4 {
  margin: 0 0 15px 0;
  font-size: 16px;
  color: #495057;
}

.property-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.property-row label {
  min-width: 150px;
  font-weight: 500;
  color: #495057;
}

.property-row input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 6px;
}

.canvas-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}

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

