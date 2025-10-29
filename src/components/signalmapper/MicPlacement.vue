<template>
<div class="mic-placement-container">
  <div class="placement-header">
    <h3>Mic Placement</h3>
    <p>Place microphones on the floor plan and assign track names</p>
  </div>

  <!-- Unified Toolbar Row -->
  <div class="placement-toolbar unified">
    <!-- Mobile: collapsible image settings trigger -->
    <div class="mobile-controls">
      <button class="btn-secondary" @click="showMobileSettings = !showMobileSettings">Image Settings</button>
    </div>
    <div class="left-group" :class="{ mobileHidden: !showMobileSettings }">
      <label class="inline-setting">
        <input type="checkbox" v-model="panImageMode" />
        <span>Pan</span>
      </label>
      <button @click="zoomIn" :disabled="!bgImage" class="btn-secondary">🔍+</button>
      <button @click="zoomOut" :disabled="!bgImage" class="btn-secondary">🔍-</button>
      <button @click="resetImageView" :disabled="!bgImage" class="btn-secondary">Reset</button>
      <div class="inline-setting">
        <label>Opacity</label>
        <input type="range" min="0.1" max="1" step="0.05" v-model.number="bgOpacity" />
        <span>{{ Math.round(bgOpacity * 100) }}%</span>
      </div>
      <input type="file" accept="image/*" @change="onImageUpload" id="image-upload" style="display:none" />
      <button @click="triggerImageUpload" class="btn-secondary">{{ bgImage ? 'Replace' : 'Upload' }} Image</button>
    </div>
    <div class="center-group mobile-stack">
      <button @click="openGearModal" class="btn-primary">➕ Add Microphone</button>
      <button @click="deleteSelected" :disabled="!selectedMic" class="btn-danger">
        🗑️ Delete Selected
      </button>
    </div>
    <div class="right-group">
      <span class="mic-count">Mics Placed: {{ nodes.length }}</span>
      <span v-if="rotationMode" class="mode-badge">Rotation mode</span>
    </div>
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
  <div class="canvas-wrapper" ref="canvasWrapper">
    <canvas 
      ref="canvas" 
      :width="canvasWidth * dpr" 
      :height="canvasHeight * dpr"
      :style="canvasStyle"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
      @wheel.prevent="onWheel"
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
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { supabase } from '@/supabase'
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
const canvasWrapper = ref(null)
const dpr = window.devicePixelRatio || 1
const canvasWidth = ref(800)
const canvasHeight = ref(600)
const canvasStyle = computed(() => 
  `width: ${canvasWidth.value}px; height: ${canvasHeight.value}px; display: block; margin: 0 auto; background: #fff; border-radius: 8px; border: 1px solid #e9ecef; touch-action: none;`
)

// Image state
const bgImage = ref(null)
const bgImageObj = ref(null)
const bgOpacity = ref(1.0)
const imageOffsetX = ref(0)
const imageOffsetY = ref(0)
const scaleFactor = ref(1)
const panImageMode = ref(false)
// no popover; show inline controls
const showMobileSettings = ref(false)

// No local persistence - background lives in Supabase storage

async function loadImageState() {
  try {
    const cloudUrl = await getBgPublicUrl()
    if (cloudUrl) await setBackgroundImage(cloudUrl)
  } catch (_) {}
}

// Storage helpers: use a fixed path per stage so it persists for everyone
function storagePathForStage() {
  return `mic-placement/${props.projectId}/${props.locationId}/bg.png`
}

async function getBgPublicUrl() {
  try {
    const path = storagePathForStage()
    // Prefer a signed URL to avoid public-read requirements and 400s
    const { data, error } = await supabase.storage
      .from('stage-pictures')
      .createSignedUrl(path, 60 * 60) // 1 hour
    if (error) return null
    return data?.signedUrl || null
  } catch {
    return null
  }
}

async function uploadBgToStorage(file) {
  const path = storagePathForStage()
  let removed = false
  try {
    const { error: remErr } = await supabase.storage.from('stage-pictures').remove([path])
    if (!remErr) removed = true
  } catch {}
  const { error } = await supabase.storage
    .from('stage-pictures')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  // Return a signed URL so it renders even if the object isn't public
  const { data: signed, error: signErr } = await supabase.storage
    .from('stage-pictures')
    .createSignedUrl(path, 60 * 60)
  if (signErr) throw signErr
  return { url: `${signed.signedUrl}&v=${Date.now()}`, removed }
}

async function setBackgroundImage(src, state) {
  return new Promise((resolve) => {
    bgImage.value = src
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      bgImageObj.value = img
      if (state) {
        bgOpacity.value = state.opacity ?? 1.0
        imageOffsetX.value = state.offsetX ?? 0
        imageOffsetY.value = state.offsetY ?? 0
        scaleFactor.value = state.scale ?? 1
      } else {
        // Auto-fit when no prior state is provided
        const fit = fitImageToCanvas(img)
        scaleFactor.value = fit.scale
        imageOffsetX.value = fit.offsetX
        imageOffsetY.value = fit.offsetY
      }
      drawCanvas()
      resolve()
    }
    img.onerror = () => {
      // If fetch fails (e.g., permissions), clear background gracefully
      bgImage.value = null
      bgImageObj.value = null
      drawCanvas()
      resolve()
    }
    img.src = src
  })
}

// Mic state
const selectedMic = ref(null)
const draggingMic = ref(null)
const rotatingMic = ref(null)
const rotationMode = ref(false) // stays enabled until user clicks off
let dragStart = null
let dragStartPos = null
// Pinch zoom helpers
const activePointers = new Map()
let lastPinchDistance = null
const MIN_SCALE = 0.2
const MAX_SCALE = 5
// Desktop rotation via wheel while mouse is held down on selected mic
const mouseDownOnSelected = ref(false)

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
    ctx.arc(0, -35, 8, 0, 2 * Math.PI) // bigger handle for easier hit
    ctx.fillStyle = '#22c55e'
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.fill()
    ctx.stroke()
  }

  ctx.restore()

  // Draw label with white background for readability over dark images
  ctx.font = 'bold 12px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const labelText = mic.track_name || mic.label
  const textMetrics = ctx.measureText(labelText)
  const padX = 6
  const padY = 4
  const bgW = Math.ceil(textMetrics.width) + padX * 2
  const bgH = 18 + padY * 2
  const labelY = y + 40
  // Background
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.strokeStyle = 'rgba(0,0,0,0.1)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.rect(x - bgW / 2, labelY - padY, bgW, bgH)
  ctx.fill()
  ctx.stroke()
  // Text
  ctx.fillStyle = '#222'
  ctx.fillText(labelText, x, labelY)
}

// Image handling
async function onImageUpload(e) {
  const file = e.target.files[0]
  if (!file) return
  try {
    const { url, removed } = await uploadBgToStorage(file)
    await setBackgroundImage(url)
    toast.success(removed ? 'Previous background removed and new image uploaded' : 'Background uploaded')
  } catch (err) {
    toast.error(`Failed to upload background: ${err.message || err}`)
  }
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
  activePointers.set(e.pointerId, { x, y })

  // Pan mode
  if (panImageMode.value && bgImageObj.value) {
    dragStart = { x, y }
    dragStartPos = { x: imageOffsetX.value, y: imageOffsetY.value }
    return
  }

  const imgPt = canvasToImageCoords(x, y)
  const clickedMic = getMicAt(imgPt.imgX, imgPt.imgY)

  if (clickedMic) {
    // If rotation mode is latched on, start rotating regardless of pointer position
    if (rotationMode.value && selectedMic.value && clickedMic.id === selectedMic.value.id) {
      rotatingMic.value = clickedMic
      selectedMic.value = clickedMic
      return
    }

    // Check if clicking rotation handle (with generous hitbox)
    const { x: micX, y: micY } = imageToCanvasCoords(clickedMic.x, clickedMic.y)
    const handleY = micY - 35
    const dist = Math.sqrt((x - micX) ** 2 + (y - handleY) ** 2)
    
    if (dist < 14) {
      // Clicked rotation handle
      rotatingMic.value = clickedMic
      selectedMic.value = clickedMic
      rotationMode.value = true
      mouseDownOnSelected.value = true
    } else {
      // Start dragging
      draggingMic.value = clickedMic
      selectedMic.value = clickedMic
      dragStart = { x: imgPt.imgX, y: imgPt.imgY }
      dragStartPos = { x: clickedMic.x, y: clickedMic.y }
      rotationMode.value = false
      mouseDownOnSelected.value = true
    }
  } else {
    // If no mic center was clicked, allow grabbing the rotation handle of the
    // currently selected mic so users can click the green dot to start rotation
    if (selectedMic.value) {
      const { x: micX, y: micY } = imageToCanvasCoords(selectedMic.value.x, selectedMic.value.y)
      const handleY = micY - 35
      const dist = Math.sqrt((x - micX) ** 2 + (y - handleY) ** 2)
      if (dist < 14) {
        rotatingMic.value = selectedMic.value
        rotationMode.value = true
        mouseDownOnSelected.value = true
        return
      }
    }
    selectedMic.value = null
    rotationMode.value = false
    mouseDownOnSelected.value = false
  }
  
  drawCanvas()
}

function onPointerMove(e) {
  e.preventDefault()
  const { x, y } = getCanvasCoords(e)
  if (activePointers.has(e.pointerId)) activePointers.set(e.pointerId, { x, y })

  // Pinch to zoom
  if (activePointers.size >= 2 && bgImageObj.value) {
    const pts = Array.from(activePointers.values())
    const dx = pts[0].x - pts[1].x
    const dy = pts[0].y - pts[1].y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (lastPinchDistance != null) {
      const centerX = (pts[0].x + pts[1].x) / 2
      const centerY = (pts[0].y + pts[1].y) / 2
      applyZoom(dist / lastPinchDistance, centerX, centerY)
    }
    lastPinchDistance = dist
    return
  }

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
  activePointers.delete(e.pointerId)
  if (activePointers.size < 2) lastPinchDistance = null

  if (panImageMode.value) {
    dragStart = null
    dragStartPos = null
    saveImageState()
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
  mouseDownOnSelected.value = false
}

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)) }

function applyZoom(zoomFactor, centerX, centerY) {
  const prevScale = scaleFactor.value
  const newScale = clamp(prevScale * zoomFactor, MIN_SCALE, MAX_SCALE)
  if (newScale === prevScale) return
  // Zoom towards the pointer center
  const imgXBefore = (centerX - imageOffsetX.value) / prevScale
  const imgYBefore = (centerY - imageOffsetY.value) / prevScale
  scaleFactor.value = newScale
  imageOffsetX.value = centerX - imgXBefore * newScale
  imageOffsetY.value = centerY - imgYBefore * newScale
  drawCanvas()
}

function onWheel(e) {
  if (!bgImageObj.value) return
  // If the user is holding the mouse down on the selected mic (or has the rotation handle engaged),
  // rotate instead of zooming. Use wheel delta to control rotation speed.
  if ((mouseDownOnSelected.value || rotatingMic.value) && selectedMic.value) {
    const step = e.deltaY < 0 ? 3 : -3
    selectedMic.value.rotation = ((selectedMic.value.rotation || 0) + step + 360) % 360
    drawCanvas()
    return
  }
  const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1
  const rect = canvas.value.getBoundingClientRect()
  const cx = (e.clientX - rect.left) * (canvas.value.width / rect.width) / dpr
  const cy = (e.clientY - rect.top) * (canvas.value.height / rect.height) / dpr
  applyZoom(zoomFactor, cx, cy)
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

// Persist opacity changes
// no-op: opacity changes are not persisted locally

// Lifecycle
onMounted(() => {
  if (canvas.value) {
    canvas.value.width = canvasWidth.value * dpr
    canvas.value.height = canvasHeight.value * dpr
  }
  // Responsive canvas sizing
  updateCanvasSize()
  window.addEventListener('resize', updateCanvasSize)
  // Load background image (if any)
  loadImageState()
  nextTick(drawCanvas)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateCanvasSize)
})

function updateCanvasSize() {
  const el = canvasWrapper.value
  const maxW = el ? el.clientWidth : window.innerWidth
  const inner = Math.min(1200, Math.max(280, maxW - 24)) // 12px padding each side
  canvasWidth.value = inner
  canvasHeight.value = Math.round(inner * 0.75)
  if (canvas.value) {
    canvas.value.width = canvasWidth.value * dpr
    canvas.value.height = canvasHeight.value * dpr
  }
  drawCanvas()
}
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

.inline-setting { display: inline-flex; align-items: center; gap: 6px; }

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

.placement-toolbar.unified {
  justify-content: space-between;
}

.left-group, .center-group, .right-group {
  display: flex;
  align-items: center;
  gap: 10px;
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

.mode-badge {
  background: #e7f1ff;
  color: #0b5ed7;
  border: 1px solid #b6d4fe;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
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
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px; /* thin side padding so canvas never touches edges */
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

/* Mobile layout tweaks */
@media (max-width: 768px) {
  .placement-toolbar.unified { display: block; }
  .mobile-controls { display:flex; gap:8px; margin-bottom:8px; }
  .left-group.mobileHidden { display:none; }
  .left-group { display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:10px; }
  .inline-setting { grid-column: span 2; }
  .center-group.mobile-stack { display:grid; grid-template-columns: 1fr; gap:8px; }
  .canvas-wrapper { padding: 8px 12px; }
}
</style>

