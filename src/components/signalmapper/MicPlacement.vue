<template>
<div class="mic-placement-container">
  <div class="placement-header">
    <h3>Mic Placement</h3>
    <p>Place microphones on the floor plan and assign track names</p>
  </div>

  <!-- Mobile Message -->
  <div v-if="isMobile" class="mobile-message">
    <p>📱 For better usability and to prevent errors, please view this page on a larger screen (desktop or tablet).</p>
    <p>Mobile devices are not recommended for mic placement due to precision requirements.</p>
  </div>

  <!-- Unified Toolbar Row -->
  <div class="placement-toolbar unified" :class="{ mobileHidden: isMobile }">
    <!-- Mobile: collapsible image settings trigger -->
    <div class="mobile-controls" v-if="!isMobile">
      <button class="btn-secondary" @click="showMobileSettings = !showMobileSettings">Image Settings</button>
    </div>
    <div class="left-group" :class="{ mobileHidden: !showMobileSettings || isMobile }">
      <label class="inline-setting">
        <input type="checkbox" v-model="panImageMode" />
        <span>Pan</span>
      </label>
      <button @click="zoomIn" :disabled="!bgImage" class="btn-secondary">🔍+</button>
      <button @click="zoomOut" :disabled="!bgImage" class="btn-secondary">🔍-</button>
      <button @click="resetImageView" :disabled="!bgImage" class="btn-secondary">Reset</button>
      <input type="file" accept="image/*" @change="onImageUpload" id="image-upload" style="display:none" />
      <button @click="triggerImageUpload" class="btn-secondary">{{ bgImage ? 'Replace' : 'Upload' }} Image</button>
    </div>
    <div class="center-group mobile-stack">
      <button @click="openGearModal" class="btn-primary">➕ Add Microphone</button>
    </div>
    <div class="right-group">
      <span class="mic-count">Mics Placed: {{ nodes.length }}</span>
      <span v-if="rotationMode" class="mode-badge">Rotation mode</span>
      <button @click="exportToPDF" class="btn-secondary">📥 Download Image</button>
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
      @wheel="onWheel"
      @dblclick="onDoubleClick"
    />
  </div>

  <!-- Mic Context Menu -->
  <div v-if="showContextMenu" class="context-menu-overlay" @click="closeContextMenu">
    <div class="context-menu" @click.stop>
      <div class="context-menu-header">
        <h4>{{ selectedMic?.track_name || selectedMic?.label || 'Mic' }}</h4>
        <button @click="closeContextMenu" class="close-btn">×</button>
      </div>
      <div class="context-menu-body">
        <div class="context-menu-section">
          <label>Track Name:</label>
          <input 
            v-model="contextMenuTrackName" 
            @change="updateMicFromContextMenu"
            type="text"
            placeholder="e.g. Stage L"
            class="context-menu-input"
          />
        </div>
        <div class="context-menu-section">
          <label>Rotation (degrees):</label>
          <div class="rotation-controls">
            <input 
              v-model.number="contextMenuRotation" 
              @change="updateMicFromContextMenu"
              type="number"
              min="0"
              max="360"
              step="1"
              class="context-menu-input rotation-input"
            />
            <div class="quick-rotation-buttons">
              <button 
                v-for="angle in [0, 45, 90, 135, 180, 225, 270, 315]"
                :key="angle"
                @click="setQuickRotation(angle)"
                class="quick-rotation-btn"
                :class="{ active: Math.abs((contextMenuRotation % 360) - angle) < 1 }"
                :title="`${angle}°`"
              >
                {{ angle }}°
              </button>
            </div>
          </div>
        </div>
        <div class="context-menu-section">
          <label>Label Background Color:</label>
          <div class="color-picker-container">
            <input 
              v-model="contextMenuLabelBgColorHex" 
              @change="updateMicFromContextMenu"
              type="color"
              class="color-picker-input"
              :title="contextMenuLabelBgColor"
            />
            <input 
              v-model="contextMenuLabelBgColor" 
              @change="updateMicFromContextMenu"
              type="text"
              placeholder="e.g. rgba(255,255,255,0.92) or #ffffff"
              class="context-menu-input color-text-input"
            />
          </div>
          <div class="color-presets">
            <button 
              v-for="preset in colorPresets"
              :key="preset"
              @click="setLabelColor(preset)"
              class="color-preset-btn"
              :style="{ '--preset-color': preset }"
              :title="preset"
            ></button>
          </div>
        </div>
        <div class="context-menu-actions">
          <button @click="deleteMicFromContextMenu" class="btn-danger context-menu-btn">
            🗑️ Delete
          </button>
          <button @click="saveAndCloseContextMenu" class="btn-primary context-menu-btn">
            Save
          </button>
          <button @click="closeContextMenu" class="btn-secondary context-menu-btn">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Gear Selection Modal -->
  <div v-if="showGearModal" class="modal-overlay" @click="closeGearModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>{{ selectedMicForOrientation ? 'Select Orientation' : 'Select Microphone' }}</h3>
        <button @click="closeGearModal" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <div v-if="!selectedMicForOrientation">
          <div v-if="availableMics.length === 0" class="no-gear">
            <p>No microphones (sources) available for this location.</p>
          </div>
          <div v-else class="gear-list">
            <div 
              v-for="mic in availableMics" 
              :key="mic.id"
              @click="selectMicForOrientation(mic)"
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
        <div v-else class="orientation-picker">
          <div class="orientation-mic-info">
            <div class="gear-icon-large">🎤</div>
            <div class="orientation-mic-name">{{ selectedMicForOrientation.gear_name }}</div>
          </div>
          <div class="orientation-track-name-input">
            <label for="track-name-input">Track Name:</label>
            <input 
              id="track-name-input"
              type="text" 
              v-model="trackNameInput" 
              :placeholder="selectedMicForOrientation.gear_name"
              class="track-name-input-field"
            />
          </div>
          <div class="orientation-picker-label">Choose initial orientation:</div>
          <div class="orientation-grid">
            <button
              v-for="(angle, index) in [315, 0, 45, 270, null, 90, 225, 180, 135]"
              :key="index"
              v-if="angle !== null"
              @click="selectedOrientation = angle"
              class="orientation-arrow"
              :class="{ selected: selectedOrientation === angle }"
              :style="{ transform: `rotate(${angle}deg)` }"
              :title="`${angle}°`"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3 L12 14 M12 3 L7 8 M12 3 L17 8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div v-else class="orientation-center"></div>
          </div>
          <div class="orientation-actions">
            <button @click="placeMic" :disabled="!trackNameInput.trim() || selectedOrientation === null" class="btn-primary">Place Mic</button>
            <button @click="cancelOrientation" class="btn-secondary">Cancel</button>
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
import { addNode, updateNode, deleteNode, getConnections, deleteConnection as deleteConnectionFromDB } from '@/services/signalMapperService'

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
  `width: ${canvasWidth.value}px; height: ${canvasHeight.value}px; display: block; margin: 0 auto; background: var(--bg-primary); border-radius: 8px; border: 1px solid #e9ecef; touch-action: none;`
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

// Detect mobile/small screens
const isMobile = ref(false)
function checkScreenSize() {
  isMobile.value = window.innerWidth < 768
}

// No local persistence - background lives in Supabase storage

async function loadImageState() {
  try {
    const cloudUrl = await getBgPublicUrl()
    if (cloudUrl) {
      await setBackgroundImage(cloudUrl)
    }
  } catch (_) {}
}

// Storage helpers: use a fixed path per stage so it persists for everyone
function storagePathForStage() {
  // Fallback to a project-level default scope when no location id is set
  if (!props.projectId) return null
  const scope = props.locationId ?? 'default'
  return `mic-placement/${props.projectId}/${scope}/bg.png`
}


async function getBgPublicUrl() {
  try {
    const path = storagePathForStage()
    if (!path) return null
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
  if (!path) throw new Error('Missing project id for background path')
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

// Persist background transform state (currently no-op; reserved for future use)
function saveImageState() {
  // Intentionally left blank; transforms are session-only for now
}

// Mic state
const selectedMic = ref(null)

// Safe two-way bindings so inputs remain mounted when nothing is selected
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
// Auto-rotation state
const autoRotatingMic = ref(null)
let autoRotationInterval = null
const AUTO_ROTATION_SPEED = 1 // degrees per frame

// Modal state
const showGearModal = ref(false)
const selectedMicForOrientation = ref(null)
const selectedOrientation = ref(null)
const trackNameInput = ref('')

// Context menu state
const showContextMenu = ref(false)
const contextMenuTrackName = ref('')
const contextMenuRotation = ref(0)
const contextMenuLabelBgColor = ref('rgba(255,255,255,0.92)')

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
    ctx.globalAlpha = 1.0 // Fixed opacity - no longer using bgOpacity
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

  // Selection indicator - enhanced highlighting
  if (mic === selectedMic.value) {
    // Outer glow ring
    ctx.beginPath()
    ctx.arc(0, 0, 35, 0, 2 * Math.PI)
    ctx.strokeStyle = '#007bff'
    ctx.lineWidth = 3
    ctx.setLineDash([8, 4])
    ctx.stroke()
    ctx.setLineDash([])
    
    // Inner selection ring
    ctx.beginPath()
    ctx.arc(0, 0, 30, 0, 2 * Math.PI)
    ctx.strokeStyle = '#0056b3'
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

  // Draw gear name inside circle for source mics (first 6 characters)
  if (mic.gear_id && (mic.gear_type === 'source' || mic.node_type === 'source')) {
    const gear = props.gearList.find(g => g.id === mic.gear_id)
    if (gear && gear.gear_name) {
      const gearNameText = gear.gear_name.length > 6 
        ? gear.gear_name.substring(0, 6).toUpperCase() + '...'
        : gear.gear_name.toUpperCase()
      ctx.save()
      ctx.font = 'bold 9px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = mic === selectedMic.value ? '#fff' : '#495057'
      ctx.fillText(gearNameText, x, y)
      ctx.restore()
    }
  }

  // Draw label positioned opposite to mic direction
  ctx.font = 'bold 12px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const labelText = mic.track_name || mic.label
  const textMetrics = ctx.measureText(labelText)
  const padX = 6
  const padY = 4
  const bgW = Math.ceil(textMetrics.width) + padX * 2
  const bgH = 18 + padY * 2
  
  // Calculate label position opposite to mic direction
  // Mic points in rotation direction (0° = up), so label goes opposite (180° offset)
  const labelAngle = (rotation + 180) * (Math.PI / 180)
  const labelDistance = 40 // Distance from mic center
  const labelX = x + Math.sin(labelAngle) * labelDistance
  const labelY = y - Math.cos(labelAngle) * labelDistance
  
  // Background color - use stored color or default to white
  const bgColor = mic.label_bg_color || 'rgba(255,255,255,0.92)'
  ctx.fillStyle = bgColor
  ctx.strokeStyle = 'rgba(0,0,0,0.1)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.rect(labelX - bgW / 2, labelY - bgH / 2, bgW, bgH)
  ctx.fill()
  ctx.stroke()
  // Text
  ctx.fillStyle = '#222'
  ctx.fillText(labelText, labelX, labelY)
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

function zoomIn() { 
  scaleFactor.value *= 1.1
  drawCanvas() 
}
function zoomOut() { 
  scaleFactor.value /= 1.1
  drawCanvas() 
}
function resetImageView() {
  const PADDING = 20
  
  // Calculate bounding box of all elements
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  
  // Include background image bounds if present
  if (bgImageObj.value) {
    const bx = imageOffsetX.value
    const by = imageOffsetY.value
    const bw = bgImageObj.value.width * scaleFactor.value
    const bh = bgImageObj.value.height * scaleFactor.value
    minX = Math.min(minX, bx)
    minY = Math.min(minY, by)
    maxX = Math.max(maxX, bx + bw)
    maxY = Math.max(maxY, by + bh)
  }
  
  // Include all mic nodes (circle radius and label box)
  const circleRadius = 30
  const measure = document.createElement('canvas').getContext('2d')
  if (measure) {
    measure.font = 'bold 12px sans-serif'
  }
  
  props.nodes.forEach(mic => {
    const { x, y } = imageToCanvasCoords(mic.x, mic.y)
    
    // Circle extents
    minX = Math.min(minX, x - circleRadius)
    minY = Math.min(minY, y - circleRadius)
    maxX = Math.max(maxX, x + circleRadius)
    maxY = Math.max(maxY, y + circleRadius)
    
    // Label extents - positioned opposite to mic direction
    const labelText = mic.track_name || mic.label || ''
    const textMetrics = measure ? measure.measureText(labelText) : null
    const padX = 6
    const padY = 4
    const bgW = textMetrics ? Math.ceil(textMetrics.width) + padX * 2 : (labelText.length * 7) + padX * 2
    const bgH = 18 + padY * 2
    const rotation = mic.rotation || 0
    const labelAngle = (rotation + 180) * (Math.PI / 180)
    const labelDistance = 40
    const labelX = x + Math.sin(labelAngle) * labelDistance
    const labelY = y - Math.cos(labelAngle) * labelDistance
    const lx = labelX - bgW / 2
    const ly = labelY - bgH / 2
    minX = Math.min(minX, lx)
    minY = Math.min(minY, ly)
    maxX = Math.max(maxX, lx + bgW)
    maxY = Math.max(maxY, ly + bgH)
  })
  
  // If no elements found, fall back to fitting image or canvas
  if (!isFinite(minX) || !isFinite(minY)) {
    if (bgImageObj.value) {
      const fit = fitImageToCanvas(bgImageObj.value)
      scaleFactor.value = fit.scale
      imageOffsetX.value = fit.offsetX
      imageOffsetY.value = fit.offsetY
      drawCanvas()
    }
    return
  }
  
  // Calculate dimensions with padding
  const contentWidth = maxX - minX
  const contentHeight = maxY - minY
  const paddedWidth = contentWidth + PADDING * 2
  const paddedHeight = contentHeight + PADDING * 2
  
  // Calculate scale to fit canvas
  const scaleX = canvasWidth.value / paddedWidth
  const scaleY = canvasHeight.value / paddedHeight
  const scale = Math.min(scaleX, scaleY)
  
  // Calculate center of content
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  
  // If we have a background image, adjust it to frame the content
  if (bgImageObj.value) {
    // Target area on canvas (with padding)
    const targetWidth = canvasWidth.value - PADDING * 2
    const targetHeight = canvasHeight.value - PADDING * 2
    const targetCenterX = canvasWidth.value / 2
    const targetCenterY = canvasHeight.value / 2
    
    // Calculate scale to fit content into target area
    const scaleX = targetWidth / contentWidth
    const scaleY = targetHeight / contentHeight
    const contentScale = Math.min(scaleX, scaleY)
    
    // Find mic bounds in image coordinates (0-1 normalized)
    let imgMinX = 0, imgMinY = 0, imgMaxX = 1, imgMaxY = 1
    props.nodes.forEach(mic => {
      imgMinX = Math.min(imgMinX, mic.x)
      imgMinY = Math.min(imgMinY, mic.y)
      imgMaxX = Math.max(imgMaxX, mic.x)
      imgMaxY = Math.max(imgMaxY, mic.y)
    })
    
    // Image-space content dimensions (account for mics)
    const imgContentWidth = Math.max(imgMaxX - imgMinX, 0.1)
    const imgContentHeight = Math.max(imgMaxY - imgMinY, 0.1)
    
    // Calculate image scale needed to fit image content to target
    const imgScaleX = targetWidth / (imgContentWidth * bgImageObj.value.width)
    const imgScaleY = targetHeight / (imgContentHeight * bgImageObj.value.height)
    const newImageScale = Math.min(imgScaleX, imgScaleY)
    
    // Calculate image content center in image coords
    const imgContentCenterX = (imgMinX + imgMaxX) / 2
    const imgContentCenterY = (imgMinY + imgMaxY) / 2
    
    // Calculate offset to center image content on canvas
    const newOffsetX = targetCenterX - imgContentCenterX * bgImageObj.value.width * newImageScale
    const newOffsetY = targetCenterY - imgContentCenterY * bgImageObj.value.height * newImageScale
    
    scaleFactor.value = newImageScale
    imageOffsetX.value = newOffsetX
    imageOffsetY.value = newOffsetY
  }
  
  drawCanvas()
}
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
  return {
    imgX: (canvasX - imageOffsetX.value) / (imgW * scaleFactor.value),
    imgY: (canvasY - imageOffsetY.value) / (imgH * scaleFactor.value)
  }
}

function imageToCanvasCoords(imgX, imgY) {
  if (!bgImageObj.value) {
    return { x: imgX * canvasWidth.value, y: imgY * canvasHeight.value }
  }
  const imgW = bgImageObj.value.width
  const imgH = bgImageObj.value.height
  return {
    x: imgX * (imgW * scaleFactor.value) + imageOffsetX.value,
    y: imgY * (imgH * scaleFactor.value) + imageOffsetY.value
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

  // Pan image mode
  if (panImageMode.value && bgImageObj.value) {
    dragStart = { x, y }
    dragStartPos = { x: imageOffsetX.value, y: imageOffsetY.value }
    return
  }

  const imgPt = canvasToImageCoords(x, y)
  const clickedMic = getMicAt(imgPt.imgX, imgPt.imgY)

  // Stop auto-rotation when user interacts
  stopAutoRotation()

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
    } else {
      // Start dragging
      draggingMic.value = clickedMic
      selectedMic.value = clickedMic
      dragStart = { x: imgPt.imgX, y: imgPt.imgY }
      dragStartPos = { x: clickedMic.x, y: clickedMic.y }
      rotationMode.value = false
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
        return
      }
    }
    selectedMic.value = null
    rotationMode.value = false
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
  // Stop auto-rotation when user scrolls
  stopAutoRotation()
  
  // Allow normal page scrolling - zoom is controlled via buttons only
  // Do not prevent default or handle zoom here
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

// Double-click handler for context menu
function onDoubleClick(e) {
  const { x, y } = getCanvasCoords(e)
  const imgPt = canvasToImageCoords(x, y)
  const clickedMic = getMicAt(imgPt.imgX, imgPt.imgY)
  
  if (clickedMic) {
    // Check if not clicking on rotation handle
    const { x: micX, y: micY } = imageToCanvasCoords(clickedMic.x, clickedMic.y)
    const handleY = micY - 35
    const dist = Math.sqrt((x - micX) ** 2 + (y - handleY) ** 2)
    
    if (dist >= 14) {
      // Stop any auto-rotation
      stopAutoRotation()
      // Select the mic and show context menu
      selectedMic.value = clickedMic
      openContextMenu(e)
    }
  }
}

// Start auto-rotation
function startAutoRotation(mic) {
  stopAutoRotation() // Stop any existing rotation
  autoRotatingMic.value = mic
  
  const rotate = () => {
    if (autoRotatingMic.value) {
      autoRotatingMic.value.rotation = ((autoRotatingMic.value.rotation || 0) + AUTO_ROTATION_SPEED) % 360
      drawCanvas()
    }
  }
  
  // Use requestAnimationFrame for smooth rotation
  let lastTime = performance.now()
  const animate = (currentTime) => {
    if (!autoRotatingMic.value) return
    
    const deltaTime = currentTime - lastTime
    if (deltaTime >= 16) { // ~60fps
      rotate()
      lastTime = currentTime
    }
    autoRotationInterval = requestAnimationFrame(animate)
  }
  autoRotationInterval = requestAnimationFrame(animate)
}

// Stop auto-rotation
function stopAutoRotation() {
  if (autoRotationInterval !== null) {
    cancelAnimationFrame(autoRotationInterval)
    autoRotationInterval = null
  }
  if (autoRotatingMic.value) {
    // Save the rotation state when stopping
    saveMicUpdate(autoRotatingMic.value)
    autoRotatingMic.value = null
  }
}

// Gear modal
function openGearModal() {
  showGearModal.value = true
}

function closeGearModal() {
  showGearModal.value = false
  selectedMicForOrientation.value = null
  selectedOrientation.value = null
  trackNameInput.value = ''
}

function cancelOrientation() {
  selectedMicForOrientation.value = null
  selectedOrientation.value = null
  trackNameInput.value = ''
}

function selectMicForOrientation(mic) {
  const available = getAvailableCount(mic)
  if (available <= 0) {
    toast.error('No more units of this microphone available')
    return
  }
  selectedMicForOrientation.value = mic
  selectedOrientation.value = 0 // Default to 0 degrees
  trackNameInput.value = mic.gear_name // Pre-fill with mic name
}

async function placeMic() {
  const mic = selectedMicForOrientation.value
  const rotation = selectedOrientation.value
  const trackName = trackNameInput.value.trim()
  
  if (!mic || rotation === null) return
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
      location_id: props.locationId || null,
      type: 'gear',
      gear_id: mic.id,
      label: mic.gear_name,
      track_name: trackName,
      x: imgCoords.imgX,
      y: imgCoords.imgY,
      rotation: rotation,
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

async function saveMicUpdate(mic) {
  try {
    await updateNode({
      id: mic.id,
      x: mic.x,
      y: mic.y,
      rotation: mic.rotation,
      track_name: mic.track_name,
      label_bg_color: mic.label_bg_color
    })
    emit('node-updated', mic)
  } catch (err) {
    console.error('Error updating mic:', err)
    toast.error('Failed to update microphone')
  }
}

async function cascadeDeleteNode(nodeId) {
  // Fetch all connections for this project
  const allConnections = await getConnections(props.projectId)
  
  // Find all connections FROM this node (outgoing)
  const outgoingConns = allConnections.filter(c => c.from_node_id === nodeId)
  
  // Find all connections TO this node (incoming)
  const incomingConns = allConnections.filter(c => c.to_node_id === nodeId)

  // Delete all port mappings for these connections
  const allConnIds = [...outgoingConns.map(c => c.id), ...incomingConns.map(c => c.id)]
  if (allConnIds.length > 0) {
    try {
      await supabase
        .from('connection_port_map')
        .delete()
        .in('connection_id', allConnIds)
    } catch (err) {
      console.error('Error deleting port mappings:', err)
    }
  }

  // Delete all outgoing and incoming connections (but keep the nodes they connect to)
  for (const conn of [...outgoingConns, ...incomingConns]) {
    try {
      await deleteConnectionFromDB(conn.id)
    } catch (err) {
      console.error('Error deleting connection:', err)
    }
  }

  // Finally, delete the node itself
  try {
    await deleteNode(nodeId)
    emit('node-deleted', nodeId)
  } catch (err) {
    console.error('Error deleting node:', err)
    throw err
  }
}

async function deleteSelected() {
  if (!selectedMic.value) return
  
  // Only allow deleting gear source nodes in mic placement view
  // Gear source nodes have gear_id and gear_type === 'source'
  const isGearSource = selectedMic.value.gear_id && selectedMic.value.gear_type === 'source'
  
  if (!isGearSource) {
    toast.error('Only gear source nodes can be deleted from Mic Placement view.')
    return
  }
  
  const micLabel = selectedMic.value.track_name || selectedMic.value.label

  try {
    await cascadeDeleteNode(selectedMic.value.id)
    selectedMic.value = null
    closeContextMenu()
    toast.success(`${micLabel} and connections deleted`)
    nextTick(drawCanvas)
  } catch (err) {
    console.error('Error deleting mic:', err)
    toast.error('Failed to delete microphone')
  }
}

// Color presets for label background - 8 unique colors
const colorPresets = [
  'rgba(255,255,255,0.92)',  // White (transparent)
  'rgba(0,0,0,0.8)',          // Black (transparent)
  'rgba(255,0,0,0.9)',        // Red (transparent)
  'rgba(0,255,0,0.9)',        // Green (transparent)
  'rgba(0,0,255,0.9)',        // Blue (transparent)
  'rgba(255,255,0,0.9)',      // Yellow (transparent)
  'rgba(255,0,255,0.9)',      // Magenta (transparent)
  'rgba(0,255,255,0.9)'       // Cyan (transparent)
]

// Helper function to convert rgba/rgb/hex to hex for color input
function colorToHex(color) {
  if (!color) return '#ffffff'
  // If already hex, return as is
  if (color.startsWith('#')) return color
  // If rgba or rgb, extract RGB values
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (match) {
    const r = parseInt(match[1]).toString(16).padStart(2, '0')
    const g = parseInt(match[2]).toString(16).padStart(2, '0')
    const b = parseInt(match[3]).toString(16).padStart(2, '0')
    return `#${r}${g}${b}`
  }
  return '#ffffff'
}

// Computed property for color picker (hex format)
const contextMenuLabelBgColorHex = computed({
  get: () => colorToHex(contextMenuLabelBgColor.value),
  set: (hex) => {
    // Convert hex to rgba with opacity
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    // Preserve opacity if original was rgba, otherwise use 0.92
    const originalColor = contextMenuLabelBgColor.value
    let opacity = 0.92
    if (originalColor && originalColor.includes('rgba')) {
      const opacityMatch = originalColor.match(/rgba\([^)]+,\s*([\d.]+)\)/)
      if (opacityMatch) {
        opacity = parseFloat(opacityMatch[1])
      }
    }
    contextMenuLabelBgColor.value = `rgba(${r},${g},${b},${opacity})`
  }
})

// Context menu functions
function openContextMenu(e) {
  if (!selectedMic.value) return
  
  // Set the context menu values
  contextMenuTrackName.value = selectedMic.value.track_name || ''
  contextMenuRotation.value = selectedMic.value.rotation || 0
  contextMenuLabelBgColor.value = selectedMic.value.label_bg_color || 'rgba(255,255,255,0.92)'
  
  showContextMenu.value = true
}

function closeContextMenu() {
  showContextMenu.value = false
  contextMenuTrackName.value = ''
  contextMenuRotation.value = 0
  contextMenuLabelBgColor.value = 'rgba(255,255,255,0.92)'
}

function setQuickRotation(angle) {
  contextMenuRotation.value = angle
  updateMicFromContextMenu()
}

function setLabelColor(color) {
  contextMenuLabelBgColor.value = color
  updateMicFromContextMenu()
}

async function updateMicFromContextMenu() {
  if (!selectedMic.value) return
  
  selectedMic.value.track_name = contextMenuTrackName.value
  selectedMic.value.rotation = contextMenuRotation.value
  selectedMic.value.label_bg_color = contextMenuLabelBgColor.value
  
  await saveMicUpdate(selectedMic.value)
  drawCanvas()
}

async function saveAndCloseContextMenu() {
  if (!selectedMic.value) return
  
  // Ensure all current values are saved
  selectedMic.value.track_name = contextMenuTrackName.value
  selectedMic.value.rotation = contextMenuRotation.value
  selectedMic.value.label_bg_color = contextMenuLabelBgColor.value
  
  await saveMicUpdate(selectedMic.value)
  drawCanvas()
  closeContextMenu()
}

async function deleteMicFromContextMenu() {
  if (!selectedMic.value) return
  
  // Only allow deleting gear source nodes in mic placement view
  // Gear source nodes have gear_id and gear_type === 'source'
  const isGearSource = selectedMic.value.gear_id && selectedMic.value.gear_type === 'source'
  
  if (!isGearSource) {
    toast.error('Only gear source nodes can be deleted from Mic Placement view.')
    closeContextMenu()
    return
  }
  
  const micLabel = selectedMic.value.track_name || selectedMic.value.label

  try {
    await cascadeDeleteNode(selectedMic.value.id)
    const deletedLabel = micLabel
    selectedMic.value = null
    closeContextMenu()
    toast.success(`${deletedLabel} and connections deleted`)
    nextTick(drawCanvas)
  } catch (err) {
    console.error('Error deleting mic:', err)
    toast.error('Failed to delete microphone')
  }
}

// Watchers
watch(() => props.nodes, () => nextTick(drawCanvas))

// Persist opacity changes
// no-op: opacity changes are not persisted locally

// Keyboard handler for context menu and delete
function handleKeyDown(e) {
  if (e.key === 'Escape' && showContextMenu.value) {
    closeContextMenu()
  }
  // Handle Delete or Backspace key
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedMic.value && !showContextMenu.value) {
    // Prevent default browser behavior (e.g., going back in history)
    e.preventDefault()
    deleteSelected()
  }
}

// Lifecycle
onMounted(() => {
  checkScreenSize()
  window.addEventListener('resize', checkScreenSize)
  window.addEventListener('keydown', handleKeyDown)
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
  window.removeEventListener('resize', checkScreenSize)
  window.removeEventListener('resize', updateCanvasSize)
  window.removeEventListener('keydown', handleKeyDown)
  stopAutoRotation()
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

// Export/Download the current canvas as PNG image
function exportToPDF() {
  if (!canvas.value) return
  
  // Use getCanvasDataURL to get a properly bounded export with all elements
  const dataURL = getCanvasDataURL()
  if (!dataURL) {
    toast.error('Failed to generate export image')
    return
  }
  
  try {
    // Create a temporary anchor element to trigger download
    const link = document.createElement('a')
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filename = `mic-placement-${timestamp}.png`
    
    // Set the download attributes
    link.href = dataURL
    link.download = filename
    link.style.display = 'none'
    
    // Append to body, click, and remove
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    toast.success('Mic placement exported successfully')
  } catch (e) {
    console.error('Error exporting canvas:', e)
    toast.error('Failed to export mic placement')
  }
}

// Expose a method to retrieve the current canvas as a data URL for parent exports
function getCanvasDataURL() {
  // Build an export canvas that fits the background image and all mic drawings with padding
  const PADDING = 20
  const dprLocal = window.devicePixelRatio || 1

  // If nothing to draw, return current canvas data
  if (!canvas.value) return null

  // Create a measurement context
  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) return null
  measure.font = 'bold 12px sans-serif'

  // Compute bounds in current canvas coordinates
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  // Include background image bounds if present
  if (bgImageObj.value) {
    const bx = imageOffsetX.value
    const by = imageOffsetY.value
    const bw = bgImageObj.value.width * scaleFactor.value
    const bh = bgImageObj.value.height * scaleFactor.value
    minX = Math.min(minX, bx)
    minY = Math.min(minY, by)
    maxX = Math.max(maxX, bx + bw)
    maxY = Math.max(maxY, by + bh)
  } else {
    // Fall back to visible canvas
    minX = Math.min(minX, 0)
    minY = Math.min(minY, 0)
    maxX = Math.max(maxX, canvasWidth.value)
    maxY = Math.max(maxY, canvasHeight.value)
  }

  // Include all mic nodes (circle radius and label box)
  const circleRadius = 30
  props.nodes.forEach(mic => {
    const { x, y } = imageToCanvasCoords(mic.x, mic.y)
    // Circle extents
    minX = Math.min(minX, x - circleRadius)
    minY = Math.min(minY, y - circleRadius)
    maxX = Math.max(maxX, x + circleRadius)
    maxY = Math.max(maxY, y + circleRadius)

    // Label extents - positioned opposite to mic direction
    const labelText = mic.track_name || mic.label || ''
    const textMetrics = measure.measureText(labelText)
    const padX = 6
    const padY = 4
    const bgW = Math.ceil(textMetrics.width) + padX * 2
    const bgH = 18 + padY * 2
    const rotation = mic.rotation || 0
    const labelAngle = (rotation + 180) * (Math.PI / 180)
    const labelDistance = 40
    const labelX = x + Math.sin(labelAngle) * labelDistance
    const labelY = y - Math.cos(labelAngle) * labelDistance
    const lx = labelX - bgW / 2
    const ly = labelY - bgH / 2
    minX = Math.min(minX, lx)
    minY = Math.min(minY, ly)
    maxX = Math.max(maxX, lx + bgW)
    maxY = Math.max(maxY, ly + bgH)
  })

  // Apply padding
  const exportW = Math.max(1, Math.ceil((maxX - minX) + PADDING * 2))
  const exportH = Math.max(1, Math.ceil((maxY - minY) + PADDING * 2))

  // Prepare offscreen canvas
  const off = document.createElement('canvas')
  off.width = exportW * dprLocal
  off.height = exportH * dprLocal
  const ctx = off.getContext('2d')
  if (!ctx) return null
  ctx.scale(dprLocal, dprLocal)

  // Background
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, exportW, exportH)

  // Shift drawing so that minX/minY are inside the frame with padding
  ctx.save()
  ctx.translate(-minX + PADDING, -minY + PADDING)

  // Draw background image (with current opacity)
  if (bgImageObj.value) {
    ctx.globalAlpha = 1.0 // Fixed opacity
    ctx.drawImage(
      bgImageObj.value,
      imageOffsetX.value,
      imageOffsetY.value,
      bgImageObj.value.width * scaleFactor.value,
      bgImageObj.value.height * scaleFactor.value
    )
    ctx.globalAlpha = 1.0
  }

  // Draw all mics using the same routine as screen draw
  props.nodes.forEach(mic => {
    drawMic(ctx, mic)
  })

  ctx.restore()

  try {
    return off.toDataURL('image/png')
  } catch (e) {
    return null
  }
}

defineExpose({ getCanvasDataURL })
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
  color: var(--text-primary);
}

.placement-header p {
  margin: 0;
  color: var(--text-secondary);
}

.image-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  position: relative;
}

.image-controls button {
  padding: 8px 16px;
  background: var(--bg-secondary);
  border: 1px solid #dee2e6;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.image-controls button:hover {
  background: var(--border-light);
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
  background: var(--bg-secondary);
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
  background: var(--border-medium);
  margin: 0 10px;
}

.mic-count {
  color: var(--text-secondary);
  font-size: 14px;
}

.mode-badge {
  background: rgba(59, 130, 246, 0.1);
  color: var(--color-primary-600);
  border: 1px solid #b6d4fe;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.btn-primary {
  padding: 10px 20px;
  background: var(--color-primary-500);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: var(--color-primary-600);
}

.btn-primary:disabled {
  background: var(--color-secondary-400);
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-secondary {
  padding: 10px 20px;
  background: var(--color-secondary-500);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: var(--color-secondary-600);
}

.btn-danger {
  padding: 10px 20px;
  background: var(--color-error-500);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-danger:hover {
  background: var(--color-error-600);
}

.btn-danger:disabled {
  background: var(--border-light);
  color: var(--text-tertiary);
  cursor: not-allowed;
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
  background: var(--bg-primary);
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow: hidden;
  color: var(--text-primary);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-primary);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: var(--bg-secondary);
}

.modal-body {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
  background: var(--bg-primary);
  color: var(--text-primary);
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
  border: 1px solid var(--border-light);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--bg-primary);
}

.gear-item:hover {
  background: var(--bg-secondary);
  border-color: #007bff;
}

.gear-icon {
  font-size: 32px;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.gear-info {
  flex: 1;
}

.gear-name {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.gear-details {
  font-size: 12px;
  color: var(--text-secondary);
}

.no-gear {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
}

.orientation-picker {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 20px;
}

.orientation-mic-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
  width: 100%;
}

.gear-icon-large {
  font-size: 48px;
}

.orientation-mic-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.orientation-track-name-input {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}

.orientation-track-name-input label {
  font-weight: 500;
  color: #495057;
  font-size: 14px;
}

.track-name-input-field {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid var(--border-medium);
  border-radius: 6px;
  font-size: 16px;
  transition: border-color 0.2s;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.track-name-input-field:focus {
  outline: none;
  border-color: var(--color-primary-500);
}

.orientation-picker-label {
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.orientation-actions {
  display: flex;
  gap: 12px;
  margin-top: 10px;
  width: 100%;
  justify-content: center;
}

.orientation-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 12px;
  width: 180px;
  height: 180px;
  margin: 20px auto;
}

.orientation-arrow {
  width: 48px;
  height: 48px;
  border: 2px solid #000000;
  border-radius: 50%;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  color: #000000;
  padding: 0;
}

.orientation-arrow:hover {
  transform: scale(1.05);
  border-color: #333;
}

.orientation-arrow.selected {
  background: #22c55e !important;
  border-color: #16a34a !important;
  border-width: 3px !important;
  color: #ffffff !important;
  transform: scale(1.1);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2);
}

.orientation-arrow.selected:hover {
  transform: scale(1.15);
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.4), 0 6px 12px rgba(0, 0, 0, 0.3);
}

.orientation-arrow svg {
  display: block;
}

.orientation-center {
  width: 48px;
  height: 48px;
  border: 2px solid #dee2e6;
  border-radius: 50%;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

/* Hide mobile controls on larger screens */
.mobile-controls {
  display: none;
}

/* Mobile message styling */
.mobile-message {
  background: #fff3cd;
  border: 2px solid #ffc107;
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
  text-align: center;
}

.mobile-message p {
  margin: 8px 0;
  color: #856404;
  font-size: 14px;
  line-height: 1.5;
}

.mobile-message p:first-child {
  font-weight: 600;
  font-size: 16px;
}

/* Hide toolbar on mobile */
.placement-toolbar.mobileHidden {
  display: none;
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

/* Context Menu Styles */
.context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1001;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  padding: 20px;
}

.context-menu {
  position: relative;
  background: var(--bg-primary);
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  min-width: 320px;
  max-width: 400px;
  width: 100%;
  max-height: 90vh;
  border: 1px solid var(--border-light);
  z-index: 1002;
  display: flex;
  flex-direction: column;
  margin: auto;
}

.context-menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-secondary);
  border-radius: 12px 12px 0 0;
  flex-shrink: 0;
}

.context-menu-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.context-menu-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.context-menu-section {
  margin-bottom: 20px;
}

.context-menu-section label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-primary);
  font-size: 14px;
}

.context-menu-input {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid var(--border-medium);
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
  background: var(--bg-primary);
  color: var(--text-primary);
  box-sizing: border-box;
}

.context-menu-input:focus {
  outline: none;
  border-color: var(--color-primary-500);
}

.rotation-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rotation-input {
  width: 100%;
}

.quick-rotation-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.quick-rotation-btn {
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 2px solid var(--border-medium);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  transition: all 0.2s;
  text-align: center;
}

.quick-rotation-btn:hover {
  background: var(--color-primary-50);
  border-color: var(--color-primary-300);
  transform: translateY(-1px);
}

.quick-rotation-btn.active {
  background: var(--color-primary-500);
  border-color: var(--color-primary-600);
  color: white;
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.3);
}

.context-menu-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--border-light);
}

.context-menu-btn {
  flex: 1;
  padding: 10px 16px;
  font-size: 14px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  border: none;
}

.context-menu-btn.btn-danger {
  background: var(--color-error-500);
  color: white;
}

.context-menu-btn.btn-danger:hover {
  background: var(--color-error-600);
}

.context-menu-btn.btn-primary {
  background: var(--color-primary-500);
  color: white;
}

.context-menu-btn.btn-primary:hover {
  background: var(--color-primary-600);
}

.context-menu-btn.btn-secondary {
  background: var(--color-secondary-500);
  color: white;
}

.context-menu-btn.btn-secondary:hover {
  background: var(--color-secondary-600);
}

.color-picker-container {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.color-picker-input {
  width: 60px;
  height: 40px;
  border: 2px solid var(--border-medium);
  border-radius: 6px;
  cursor: pointer;
  padding: 0;
  background: none;
}

.color-picker-input::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-picker-input::-webkit-color-swatch {
  border: none;
  border-radius: 4px;
}

.color-text-input {
  flex: 1;
}

.color-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.color-preset-btn {
  width: 32px;
  height: 32px;
  border: 2px solid var(--border-medium);
  border-radius: 6px;
  cursor: pointer;
  padding: 0;
  transition: all 0.2s;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
  /* Checkered background pattern for transparency visibility - base layer */
  background-image: 
    linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 8px 8px;
  background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
}

.dark .color-preset-btn {
  background-image: 
    linear-gradient(45deg, #666 25%, transparent 25%),
    linear-gradient(-45deg, #666 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #666 75%),
    linear-gradient(-45deg, transparent 75%, #666 75%);
}

/* Layer the actual color on top using pseudo-element so checkered pattern shows through transparent colors */
.color-preset-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--preset-color, transparent);
  z-index: 1;
}

.color-preset-btn:hover {
  transform: scale(1.1);
  border-color: var(--color-primary-500);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  z-index: 2;
}

/* Ensure border is visible in dark mode */
.dark .color-preset-btn {
  border-color: #888;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1);
}

.dark .color-preset-btn:hover {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3), 0 2px 4px rgba(0, 0, 0, 0.4);
}
</style>


