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
      <button @click="openCropModal" :disabled="!bgImage" class="btn-secondary">✂️ Crop</button>
      <input type="file" accept="image/*" @change="onImageUpload" id="image-upload" style="display:none" />
      <button @click="triggerImageUpload" class="btn-secondary">{{ bgImage ? 'Replace' : 'Upload' }} Image</button>
    </div>
    <div class="center-group mobile-stack">
      <button @click="openGearModal" class="btn-primary">➕ Add Microphone</button>
    </div>
    <div class="right-group">
      <span class="mic-count">Mics Placed: {{ nodes.length }}</span>
      <span v-if="selectedMics.size > 0" class="selection-count">{{ selectedMics.size }} selected</span>
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
    <!-- Color Legend -->
    <div 
      v-if="showLegend" 
      class="color-legend" 
      :class="{ 'legend-dragging': legendDragging }"
      :style="legendStyle"
      draggable="false"
      @pointerdown="onLegendDragStart"
      @dragstart.prevent.stop
      @drag.prevent.stop
      @dragend.prevent.stop
      @mousedown.prevent.stop
    >
      <div class="legend-header" draggable="false" @dragstart.prevent.stop>
        <h4 draggable="false">{{ stageName || 'Color Legend' }}</h4>
        <div class="legend-header-actions">
          <button @click="showLegend = false" class="legend-close-btn" draggable="false">×</button>
        </div>
      </div>
      <div class="legend-items" draggable="false" @dragstart.prevent.stop>
        <div 
          v-for="(label, buttonId) in colorLegendMap" 
          :key="buttonId"
          class="legend-item"
          draggable="false"
          @dragstart.prevent.stop
        >
          <div 
            class="legend-color-swatch"
            :style="{ backgroundColor: colorButtons.find(b => b.id === buttonId)?.color || '#ccc' }"
            draggable="false"
          ></div>
          <span class="legend-label-text" draggable="false">{{ label }}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Mic Context Menu -->
  <div v-if="showContextMenu" class="context-menu-overlay" @click="closeContextMenuWithoutDeselect">
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
          <div class="section-header-with-toggle">
            <label>Colour Legend:</label>
            <button 
              class="toggle-manage-btn"
              @click="showLegendManagement = !showLegendManagement"
              :title="showLegendManagement ? 'Hide management' : 'Show management'"
            >
              {{ showLegendManagement ? '▼' : '▶' }} Manage
            </button>
          </div>
          
          <!-- Colour Button Selector -->
          <div class="color-button-selector">
            <div class="color-button-buttons">
              <button
                v-for="btn in colorButtons"
                :key="btn.id"
                class="color-button-select-btn"
                :class="{ active: selectedMic?.color_button_id === btn.id }"
                :style="{ 
                  '--btn-color': btn.color, 
                  '--btn-text': getContrastColor(btn.color) 
                }"
                @click="applyColorButtonToMic(btn.id)"
                :title="btn.name"
              >
                <div class="select-btn-swatch" :style="{ backgroundColor: btn.color }"></div>
                <span>{{ btn.name }}</span>
              </button>
              <button
                v-if="colorButtons.length === 0"
                class="color-button-select-btn no-buttons"
                @click="showLegendManagement = true"
              >
                No colour legend entries. Click to create.
              </button>
            </div>
          </div>

          <!-- Inline Management Section -->
          <div v-if="showLegendManagement" class="legend-management-inline">
            <div class="management-header-inline">
              <span class="management-title">Manage Colour Legend</span>
            </div>
            
            <!-- Add/Edit Button -->
            <button class="btn-primary add-color-btn-inline" @click="openColorButtonModal">
              {{ editingColorButton !== null ? '✏️ Edit' : '➕ Add' }} Entry
            </button>

            <!-- Colour Legend List -->
            <div v-if="colorButtons.length > 0" class="color-button-list-inline">
              <div 
                v-for="(btn, idx) in colorButtons" 
                :key="btn.id"
                class="color-button-item-inline"
              >
                <div class="item-info-inline">
                  <div class="item-color-inline" :style="{ backgroundColor: btn.color }"></div>
                  <div class="item-details-inline">
                    <div class="item-name-inline">{{ btn.name }}</div>
                    <div class="item-description-inline">{{ btn.description || 'No description' }}</div>
                    <div class="item-meta-inline">
                      <span class="item-color-code-inline">{{ btn.color }}</span>
                      <span class="item-usage-count-inline">
                        Used by {{ props.nodes.filter(n => n.color_button_id === btn.id).length }} mic{{ props.nodes.filter(n => n.color_button_id === btn.id).length !== 1 ? 's' : '' }}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="item-actions-inline">
                  <button @click="editColorButton(idx)" class="btn-warning icon-btn-inline" title="Edit">✏️</button>
                  <button @click="deleteColorButton(btn.id, idx)" class="btn-danger icon-btn-inline" title="Delete">🗑️</button>
                </div>
              </div>
            </div>
            <div v-else class="empty-state-inline">
              <p>No colour legend entries yet. Click "Add Entry" to create one.</p>
            </div>
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

  <!-- Filename Prompt Modal -->
  <div v-if="showFilenameModal" class="modal-overlay" @click="closeFilenameModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Name Your Export</h3>
        <button @click="closeFilenameModal" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <div class="filename-input-section">
          <label for="filename-input">Filename:</label>
          <input 
            id="filename-input"
            type="text" 
            v-model="exportFilename" 
            placeholder="mic-placement"
            class="filename-input-field"
            @keyup.enter="confirmExport"
          />
          <p class="filename-hint">.png</p>
        </div>
        <div class="filename-actions">
          <button @click="confirmExport" class="btn-primary">Export</button>
          <button @click="closeFilenameModal" class="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Colour Legend Entry Modal -->
  <div v-if="showColorButtonModal" class="modal-overlay" @click="closeColorButtonModal">
    <div class="modal-content color-button-modal" @click.stop>
      <div class="modal-header">
        <h3>{{ editingColorButton !== null ? 'Edit' : 'Add' }} Colour Legend Entry</h3>
        <button @click="closeColorButtonModal" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <div class="form-field">
          <label>Name*</label>
          <input 
            v-model="colorButtonForm.name" 
            placeholder="e.g. Vocals, Drums, Stage Left, etc."
            required
            class="context-menu-input"
          />
          <p class="field-hint">This name will appear in the legend on exported images</p>
        </div>
        <div class="form-field">
          <label>Colour*</label>
          <select v-model="colorButtonForm.color" required class="context-menu-input" @change="updateColorPreview">
            <option disabled value="">Select a colour</option>
            <option v-for="c in colorOptions" :key="c.value" :value="c.value">
              {{ c.name }}
            </option>
          </select>
          <div v-if="colorButtonForm.color" class="color-preview-box">
            <div class="preview-label">Preview:</div>
            <div class="preview-mic-sample">
              <div class="preview-circle" :style="{ borderColor: colorButtonForm.color }">
                <div class="preview-arrow"></div>
              </div>
              <div class="preview-label-box" :style="{ backgroundColor: colorButtonForm.color, color: getContrastColor(colorButtonForm.color) }">
                Sample Label
              </div>
            </div>
          </div>
        </div>
        <div class="form-field">
          <label>Description</label>
          <input 
            v-model="colorButtonForm.description" 
            placeholder="Optional description (e.g., 'Used for vocal microphones')"
            class="context-menu-input"
          />
          <p class="field-hint">Optional note about what this colour represents</p>
        </div>
        <p v-if="colorButtonForm.error" class="error-text">{{ colorButtonForm.error }}</p>
      </div>
      <div class="modal-footer">
        <button @click="closeColorButtonModal" class="btn-secondary">Cancel</button>
        <button @click="saveColorButton" class="btn-primary" :disabled="colorButtonBusy || !colorButtonForm.name || !colorButtonForm.color">
          {{ colorButtonBusy ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Crop Image Modal -->
  <div v-if="showCropModal" class="modal-overlay" @click="closeCropModal">
    <div class="modal-content crop-modal" @click.stop>
      <div class="modal-header">
        <h3>Crop Background Image</h3>
        <button @click="closeCropModal" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <div class="crop-container">
          <canvas 
            ref="cropCanvas" 
            class="crop-canvas"
            @mousedown="onCropMouseDown"
            @mousemove="onCropMouseMove"
            @mouseup="onCropMouseUp"
            @mouseleave="onCropMouseUp"
          ></canvas>
          <div class="crop-instructions">
            <p>Drag the corners or edges of the crop box to adjust the selection</p>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button @click="closeCropModal" class="btn-secondary">Cancel</button>
        <button @click="applyCrop" class="btn-primary" :disabled="cropBusy">Apply Crop</button>
      </div>
    </div>
  </div>

  <!-- Delete Confirmation Modal -->
  <div v-if="showDeleteConfirm" class="modal-overlay" @click="cancelDelete">
    <div class="modal-content delete-confirm-modal" @click.stop>
      <div class="modal-header">
        <h3>🗑️ Confirm Delete</h3>
        <button @click="cancelDelete" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <div class="delete-confirm-content">
          <p class="delete-confirm-message">{{ deleteConfirmMessage }}</p>
          <p v-if="deleteConfirmWarning" class="delete-confirm-warning">{{ deleteConfirmWarning }}</p>
        </div>
      </div>
      <div class="modal-footer">
        <button @click="cancelDelete" class="btn-secondary">Cancel</button>
        <button @click="confirmDelete" class="btn-danger">Delete</button>
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
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch, watchEffect } from 'vue'
import { supabase } from '@/supabase'
import { useToast } from 'vue-toastification'
import { useRouter } from 'vue-router'
import { addNode, updateNode, deleteNode, getConnections, deleteConnection as deleteConnectionFromDB } from '@/services/signalMapperService'
import { fetchTableData, mutateTableData } from '@/services/dataService'
import { useUserStore } from '@/stores/userStore'

const props = defineProps({
  projectId: { type: [String, Number], required: true },
  locationId: { type: [String, Number], default: null },
  nodes: { type: Array, default: () => [] },
  gearList: { type: Array, default: () => [] },
  stageName: { type: String, default: null }
})

const emit = defineEmits(['node-updated', 'node-added', 'node-deleted'])

const toast = useToast()
const router = useRouter()
const store = useUserStore()
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
const nodeScaleFactor = ref(1) // Separate scale factor for nodes only
const panImageMode = ref(false)
// no popover; show inline controls
const showMobileSettings = ref(false)

// Detect mobile/small screens
const isMobile = ref(false)
function checkScreenSize() {
  isMobile.value = window.innerWidth < 768
}

// Project information for export header
const projectName = ref('')
const projectDateRange = ref('')

// Fetch project information
async function fetchProjectInfo() {
  try {
    if (props.projectId) {
      const { data: projectData } = await supabase
        .from('projects')
        .select('project_name, main_show_days')
        .eq('id', props.projectId)
        .single()
      
      if (projectData) {
        projectName.value = projectData.project_name || ''
        
        // Format date range from main_show_days
        if (projectData.main_show_days && Array.isArray(projectData.main_show_days) && projectData.main_show_days.length > 0) {
          const dates = projectData.main_show_days
            .map(d => new Date(d))
            .filter(d => !isNaN(d.getTime()))
            .sort((a, b) => a - b)
          
          if (dates.length > 0) {
            const start = dates[0]
            const end = dates[dates.length - 1]
            
            const formatDate = (date) => {
              return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: start.getFullYear() !== end.getFullYear() ? 'numeric' : undefined
              })
            }
            
            if (start.getTime() === end.getTime()) {
              projectDateRange.value = formatDate(start)
            } else {
              projectDateRange.value = `${formatDate(start)} - ${formatDate(end)}`
            }
          } else {
            projectDateRange.value = ''
          }
        } else {
          projectDateRange.value = ''
        }
      }
    }
  } catch (error) {
    console.error('Error fetching project info:', error)
    projectName.value = ''
    projectDateRange.value = ''
  }
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
const selectedMics = ref(new Set()) // Multi-select support

// Safe two-way bindings so inputs remain mounted when nothing is selected
const draggingMic = ref(null)
const draggingMics = ref(new Set()) // Multi-drag support
const dragStartPositions = new Map() // Track starting positions for all dragged mics
let dragStart = null
let dragStartPos = null
// Pinch zoom helpers
const activePointers = new Map()
let lastPinchDistance = null
const MIN_SCALE = 0.2
const MAX_SCALE = 5

// Gesture detection for iPad/touch
const pointerTypes = new Map() // Track pointer types (touch, pen, mouse)
const gestureState = ref({
  isTwoFingerPan: false,
  isTwoFingerZoom: false,
  panStart: null,
  panStartImageOffset: null
})
const DRAG_THRESHOLD = 5 // pixels - minimum movement to consider it a drag
const TAP_TIMEOUT = 300 // ms - maximum time between taps for double-tap
let lastTapTime = 0
let lastTapPoint = null

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

// Color legend state
const showLegend = ref(false)
const colorLegendMap = ref({}) // Map of color -> label
const defaultColor = 'rgba(255,255,255,0.92)'

// Legend position for DOM element (manual drag positioning)
const legendStyle = ref({})
const legendPosition = ref({ x: null, y: null }) // Canvas coordinates
const legendDragging = ref(false)
const legendDragStart = ref({ x: 0, y: 0 })

// Get localStorage key for legend position
function getLegendPositionKey() {
  const scope = props.locationId ?? 'default'
  return `mic-placement-legend-pos-${props.projectId}-${scope}`
}

// Load saved legend position from localStorage
function loadLegendPosition() {
  try {
    const key = getLegendPositionKey()
    const saved = localStorage.getItem(key)
    if (saved) {
      const parsed = JSON.parse(saved)
      legendPosition.value = { x: parsed.x, y: parsed.y }
      updateLegendStyle()
      return true
    }
  } catch (err) {
    console.error('Error loading legend position:', err)
  }
  return false
}

// Save legend position to localStorage
function saveLegendPosition() {
  try {
    const key = getLegendPositionKey()
    if (legendPosition.value.x !== null && legendPosition.value.y !== null) {
      localStorage.setItem(key, JSON.stringify(legendPosition.value))
    }
  } catch (err) {
    console.error('Error saving legend position:', err)
  }
}

// Update legend style from position
function updateLegendStyle() {
  if (!showLegend.value || Object.keys(colorLegendMap.value).length === 0) {
    legendStyle.value = {}
    return
  }
  
  // If no saved position, calculate default position (bottom-right)
  if (legendPosition.value.x === null || legendPosition.value.y === null) {
    const legendItems = []
    Object.entries(colorLegendMap.value).forEach(([buttonId, label]) => {
      const btn = colorButtons.value.find(b => b.id === buttonId)
      if (btn) legendItems.push([btn.color, label || btn.name])
    })
    
    if (legendItems.length === 0) {
      legendStyle.value = {}
      return
    }
    
    // Estimate dimensions
    const LEGEND_PADDING = 12
    const LEGEND_ITEM_HEIGHT = 24
    const LEGEND_ITEM_GAP = 8
    const SWATCH_SIZE = 16
    const SWATCH_MARGIN = 8
    const estimatedTextWidth = 120
    const legendWidth = SWATCH_SIZE + SWATCH_MARGIN + estimatedTextWidth + LEGEND_PADDING * 2
    const legendHeight = (LEGEND_ITEM_HEIGHT * legendItems.length) + (LEGEND_ITEM_GAP * (legendItems.length - 1)) + LEGEND_PADDING * 2 + 20
    
    // Calculate canvas offset within wrapper (canvas is centered)
    const wrapperWidth = canvasWrapper.value ? canvasWrapper.value.clientWidth : canvasWidth.value
    const canvasOffsetX = (wrapperWidth - canvasWidth.value) / 2
    
    // Default to bottom-right of canvas area
    const EDGE_MARGIN = 20
    legendPosition.value = {
      x: canvasOffsetX + canvasWidth.value - legendWidth - EDGE_MARGIN,
      y: canvasHeight.value - legendHeight - EDGE_MARGIN
    }
    saveLegendPosition()
  }
  
  legendStyle.value = {
    left: '0',
    top: '0',
    bottom: 'auto',
    right: 'auto',
    transform: `translate(${legendPosition.value.x}px, ${legendPosition.value.y}px)`,
    cursor: legendDragging.value ? 'grabbing' : 'grab'
  }
}

// Legend drag handlers
function onLegendDragStart(e) {
  // Don't start drag if clicking on close button
  if (e.target.closest('.legend-close-btn')) {
    return
  }
  
  e.preventDefault()
  e.stopPropagation()
  
  // Prevent default drag behavior to avoid ghost image
  const legendElement = e.target.closest('.color-legend')
  if (legendElement) {
    legendElement.setPointerCapture(e.pointerId)
  }
  
  legendDragging.value = true
  const rect = canvasWrapper.value.getBoundingClientRect()
  const startX = e.clientX - rect.left
  const startY = e.clientY - rect.top
  
  legendDragStart.value = {
    x: startX - legendPosition.value.x,
    y: startY - legendPosition.value.y
  }
  
  // Update position immediately to prevent ghost
  const newX = startX - legendDragStart.value.x
  const newY = startY - legendDragStart.value.y
  
  // Get legend dimensions to constrain within canvas
  const legendItems = []
  Object.entries(colorLegendMap.value).forEach(([buttonId, label]) => {
    const btn = colorButtons.value.find(b => b.id === buttonId)
    if (btn) legendItems.push([btn.color, label || btn.name])
  })
  
  const LEGEND_PADDING = 12
  const LEGEND_ITEM_HEIGHT = 24
  const LEGEND_ITEM_GAP = 8
  const SWATCH_SIZE = 16
  const SWATCH_MARGIN = 8
  const estimatedTextWidth = 120
  const legendWidth = SWATCH_SIZE + SWATCH_MARGIN + estimatedTextWidth + LEGEND_PADDING * 2
  const legendHeight = (LEGEND_ITEM_HEIGHT * legendItems.length) + (LEGEND_ITEM_GAP * (legendItems.length - 1)) + LEGEND_PADDING * 2 + 20
  
  // Calculate canvas position within wrapper (canvas is centered)
  const wrapperWidth = rect.width
  const canvasOffsetX = (wrapperWidth - canvasWidth.value) / 2
  
  // Constrain to canvas bounds
  legendPosition.value = {
    x: Math.max(canvasOffsetX, Math.min(newX, canvasOffsetX + canvasWidth.value - legendWidth)),
    y: Math.max(0, Math.min(newY, canvasHeight.value - legendHeight))
  }
  
  updateLegendStyle()
  
  // Add global event listeners for drag
  window.addEventListener('pointermove', onLegendDragMove)
  window.addEventListener('pointerup', onLegendDragEnd)
}

function onLegendDragMove(e) {
  if (!legendDragging.value) return
  
  e.preventDefault()
  const rect = canvasWrapper.value.getBoundingClientRect()
  const newX = e.clientX - rect.left - legendDragStart.value.x
  const newY = e.clientY - rect.top - legendDragStart.value.y
  
  // Get legend dimensions to constrain within canvas
  const legendItems = []
  Object.entries(colorLegendMap.value).forEach(([buttonId, label]) => {
    const btn = colorButtons.value.find(b => b.id === buttonId)
    if (btn) legendItems.push([btn.color, label || btn.name])
  })
  
  const LEGEND_PADDING = 12
  const LEGEND_ITEM_HEIGHT = 24
  const LEGEND_ITEM_GAP = 8
  const SWATCH_SIZE = 16
  const SWATCH_MARGIN = 8
  const estimatedTextWidth = 120
  const legendWidth = SWATCH_SIZE + SWATCH_MARGIN + estimatedTextWidth + LEGEND_PADDING * 2
  const legendHeight = (LEGEND_ITEM_HEIGHT * legendItems.length) + (LEGEND_ITEM_GAP * (legendItems.length - 1)) + LEGEND_PADDING * 2 + 20
  
  // Calculate canvas position within wrapper (canvas is centered)
  const wrapperWidth = rect.width
  const canvasOffsetX = (wrapperWidth - canvasWidth.value) / 2
  
  // Constrain to canvas bounds (accounting for canvas being centered in wrapper)
  legendPosition.value = {
    x: Math.max(canvasOffsetX, Math.min(newX, canvasOffsetX + canvasWidth.value - legendWidth)),
    y: Math.max(0, Math.min(newY, canvasHeight.value - legendHeight))
  }
  
  updateLegendStyle()
}

function onLegendDragEnd(e) {
  if (!legendDragging.value) return
  
  legendDragging.value = false
  
  // Release pointer capture
  if (e.target && e.target.releasePointerCapture) {
    try {
      e.target.releasePointerCapture(e.pointerId)
    } catch (err) {
      // Ignore if pointer capture wasn't set
    }
  }
  
  saveLegendPosition()
  
  // Remove global event listeners
  window.removeEventListener('pointermove', onLegendDragMove)
  window.removeEventListener('pointerup', onLegendDragEnd)
  
  updateLegendStyle()
}

// Update legend style when canvas size changes
watch([showLegend, colorLegendMap, canvasWidth, canvasHeight], () => {
  updateLegendStyle()
}, { deep: true })

// Filename modal state
const showFilenameModal = ref(false)
const exportFilename = ref('')

// Color button management state
const colorButtons = ref([])
const editingColorButton = ref(null)
const colorButtonForm = ref({ name: '', color: '', description: '' })
const showColorButtonModal = ref(false)
const colorButtonBusy = ref(false)
const showLegendManagement = ref(false)

// Crop modal state
const showCropModal = ref(false)
const cropCanvas = ref(null)
const cropBusy = ref(false)
const cropBox = ref({ x: 0, y: 0, width: 0, height: 0 })
const cropImageObj = ref(null)
const cropScale = ref(1)
const cropOffsetX = ref(0)
const cropOffsetY = ref(0)
const cropDragging = ref(false)
const cropDragType = ref(null) // 'move', 'resize-nw', 'resize-ne', 'resize-sw', 'resize-se', 'resize-n', 'resize-s', 'resize-w', 'resize-e'
const cropDragStart = ref({ x: 0, y: 0 })
const cropBoxStart = ref({ x: 0, y: 0, width: 0, height: 0 })

// Delete confirmation modal state
const showDeleteConfirm = ref(false)
const deleteConfirmMessage = ref('')
const deleteConfirmWarning = ref('')
const pendingDeleteAction = ref(null) // Store the delete function to execute

const colorOptions = [
  { name: 'Red', value: '#ff4d4f' },
  { name: 'Orange', value: '#fa8c16' },
  { name: 'Yellow', value: '#fadb14' },
  { name: 'Green', value: '#52c41a' },
  { name: 'Blue', value: '#1890ff' },
  { name: 'Purple', value: '#722ed1' },
  { name: 'Pink', value: '#eb2f96' },
  { name: 'Cyan', value: '#13c2c2' },
  { name: 'Magenta', value: '#f759ab' },
  { name: 'Lime', value: '#a0d911' }
]

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

// Color button helper functions
function getContrastColor(hexColor) {
  if (!hexColor) return '#000'
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness < 128 ? '#fff' : '#000'
}

function getColorButtonForMic(mic) {
  if (!mic?.color_button_id) return null
  return colorButtons.value.find(btn => btn.id === mic.color_button_id)
}

// Color button CRUD functions
async function fetchColorButtons() {
  try {
    // Fetch color buttons for this project and location (or project-level if no location)
    let query = supabase
      .from('mic_color_buttons')
      .select('*')
      .eq('project_id', props.projectId)
    
    if (props.locationId) {
      query = query.or(`location_id.eq.${props.locationId},location_id.is.null`)
    } else {
      query = query.is('location_id', null)
    }
    
    const { data, error } = await query.order('name')
    
    if (error) throw error
    colorButtons.value = data || []
    updateColorLegend()
  } catch (err) {
    console.error('Error fetching color buttons:', err)
    // If table doesn't exist yet, just use empty array
    colorButtons.value = []
  }
}

function openColorButtonModal() {
  editingColorButton.value = null
  colorButtonForm.value = { name: '', color: '', description: '', error: null }
  showColorButtonModal.value = true
}

function updateColorPreview() {
  // Trigger reactivity for color preview
  // This is handled automatically by Vue reactivity
}

function closeColorButtonModal() {
  showColorButtonModal.value = false
  editingColorButton.value = null
  colorButtonForm.value = { name: '', color: '', description: '', error: null }
}

function editColorButton(idx) {
  const btn = colorButtons.value[idx]
  editingColorButton.value = idx
  colorButtonForm.value = {
    name: btn.name,
    color: btn.color,
    description: btn.description || '',
    error: null
  }
  showColorButtonModal.value = true
}

async function saveColorButton() {
  if (!colorButtonForm.value.name || !colorButtonForm.value.color) {
    colorButtonForm.value.error = 'Name and color are required'
    return
  }
  
  colorButtonForm.value.error = null
  colorButtonBusy.value = true
  
  try {
    const payload = {
      name: colorButtonForm.value.name,
      color: colorButtonForm.value.color,
      description: colorButtonForm.value.description || null,
      project_id: props.projectId,
      location_id: props.locationId || null
    }
    
    if (editingColorButton.value !== null) {
      await mutateTableData(
        'mic_color_buttons',
        'update',
        { id: colorButtons.value[editingColorButton.value].id, ...payload }
      )
    } else {
      await mutateTableData('mic_color_buttons', 'insert', payload)
    }
    
    await fetchColorButtons()
    closeColorButtonModal()
    toast.success('Color button saved')
  } catch (err) {
    colorButtonForm.value.error = err.message || 'Failed to save color button'
    console.error('Error saving color button:', err)
  } finally {
    colorButtonBusy.value = false
  }
}

// Delete confirmation modal functions
function showDeleteConfirmation(message, warning, deleteAction) {
  deleteConfirmMessage.value = message
  deleteConfirmWarning.value = warning || ''
  pendingDeleteAction.value = deleteAction
  showDeleteConfirm.value = true
}

function cancelDelete() {
  showDeleteConfirm.value = false
  deleteConfirmMessage.value = ''
  deleteConfirmWarning.value = ''
  pendingDeleteAction.value = null
}

async function confirmDelete() {
  if (pendingDeleteAction.value) {
    await pendingDeleteAction.value()
  }
  cancelDelete()
}

async function deleteColorButton(id, idx) {
  const btn = colorButtons.value[idx]
  const usageCount = props.nodes.filter(n => n.color_button_id === btn.id).length
  
  const message = `Delete colour legend entry "${btn.name}"?`
  const warning = usageCount > 0 
    ? `This colour is used by ${usageCount} mic${usageCount !== 1 ? 's' : ''}. They will revert to the default colour.`
    : 'This will permanently remove the colour legend entry.'
  
  showDeleteConfirmation(message, warning, async () => {
    try {
      await mutateTableData('mic_color_buttons', 'delete', { id })
      colorButtons.value.splice(idx, 1)
      toast.success('Color button deleted')
      updateColorLegend()
    } catch (err) {
      console.error('Error deleting color button:', err)
      toast.error('Failed to delete color button')
    }
  })
}

function applyColorButton(buttonId) {
  // This is called from inline management - mic should already be selected
  if (!selectedMic.value) {
    toast.info('Please select a mic first')
    return
  }
  applyColorButtonToMic(buttonId)
}

async function applyColorButtonToMic(buttonId) {
  if (!selectedMic.value) return
  
  selectedMic.value.color_button_id = buttonId
  await saveMicUpdate(selectedMic.value)
  drawCanvas()
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

  // Calculate label positions with collision avoidance
  const labelPositions = calculateLabelPositions(ctx)

  // Draw mics with optimized label positions
  props.nodes.forEach((mic, idx) => {
    drawMic(ctx, mic, labelPositions[idx])
  })

  // Note: Legend is only drawn on canvas during export, not during normal display
  // The HTML legend (with close button) is shown instead during normal display
}

// Calculate label positions with collision avoidance
function calculateLabelPositions(ctx) {
  const scale = nodeScaleFactor.value
  const labelPositions = []
  const labelRects = []
  const micNodeRadius = 20 * scale // Radius of mic node circle
  
  // First pass: calculate default positions and bounding boxes
  props.nodes.forEach((mic, idx) => {
    const { x, y } = imageToCanvasCoords(mic.x, mic.y)
    const rotation = mic.rotation || 0
    const labelText = mic.track_name || mic.label || ''
    
    ctx.font = `bold ${12 * scale}px sans-serif`
    const textMetrics = ctx.measureText(labelText)
    const padX = 6 * scale
    const padY = 4 * scale
    const bgW = Math.ceil(textMetrics.width) + padX * 2
    const bgH = (18 * scale) + padY * 2
    
    // Default position: opposite to mic direction
    const labelAngle = (rotation + 180) * (Math.PI / 180)
    const baseDistance = 40 * scale
    let labelX = x + Math.sin(labelAngle) * baseDistance
    let labelY = y - Math.cos(labelAngle) * baseDistance
    
    labelRects.push({
      micIdx: idx,
      micX: x,
      micY: y,
      defaultX: labelX,
      defaultY: labelY,
      defaultAngle: labelAngle,
      width: bgW,
      height: bgH,
      rotation: rotation
    })
  })
  
  // Second pass: resolve collisions
  labelRects.forEach((rect, idx) => {
    let finalX = rect.defaultX
    let finalY = rect.defaultY
    let needsLine = false
    
    // Check if default position overlaps with any mic node or other labels
    const hasCollision = checkLabelCollision(
      finalX, finalY, rect.width, rect.height,
      rect.micX, rect.micY, micNodeRadius,
      labelRects, labelPositions, idx
    )
    
    if (hasCollision) {
      // Try alternative positions
      const alternatives = findAlternativeLabelPosition(
        rect, labelRects, labelPositions, idx, scale, micNodeRadius
      )
      if (alternatives) {
        finalX = alternatives.x
        finalY = alternatives.y
        needsLine = true
      }
    }
    
    labelPositions.push({
      x: finalX,
      y: finalY,
      needsLine: needsLine,
      micX: rect.micX,
      micY: rect.micY
    })
  })
  
  return labelPositions
}

// Check if a label position collides with mic nodes or other labels
function checkLabelCollision(labelX, labelY, labelW, labelH, ownMicX, ownMicY, micRadius, labelRects, labelPositions, currentIdx) {
  // Check collision with all mic nodes (except own)
  for (let i = 0; i < props.nodes.length; i++) {
    if (i === currentIdx) continue // Skip own mic
    
    const { x: micX, y: micY } = imageToCanvasCoords(props.nodes[i].x, props.nodes[i].y)
    
    // Check if label rectangle overlaps with mic node circle
    if (rectangleCircleOverlap(
      labelX - labelW / 2, labelY - labelH / 2, labelW, labelH,
      micX, micY, micRadius
    )) {
      return true
    }
  }
  
  // Check collision with other labels (already positioned)
  for (let i = 0; i < currentIdx; i++) {
    const other = labelRects[i]
    const otherPos = labelPositions[i]
    
    if (rectanglesOverlap(
      labelX - labelW / 2, labelY - labelH / 2, labelW, labelH,
      otherPos.x - other.width / 2, otherPos.y - other.height / 2, other.width, other.height
    )) {
      return true
    }
  }
  
  return false
}

// Check if a rectangle overlaps with a circle
function rectangleCircleOverlap(rectX, rectY, rectW, rectH, circleX, circleY, circleRadius) {
  // Find the closest point on the rectangle to the circle center
  const closestX = Math.max(rectX, Math.min(circleX, rectX + rectW))
  const closestY = Math.max(rectY, Math.min(circleY, rectY + rectH))
  
  // Calculate distance from circle center to closest point
  const dx = circleX - closestX
  const dy = circleY - closestY
  const distanceSquared = dx * dx + dy * dy
  
  // Check if distance is less than radius
  return distanceSquared < (circleRadius * circleRadius)
}

// Check if two rectangles overlap
function rectanglesOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
  return !(x1 + w1 < x2 || x2 + w2 < x1 || y1 + h1 < y2 || y2 + h2 < y1)
}

// Find alternative position for label to avoid collision
// Always favors positions opposite to the arrow direction
function findAlternativeLabelPosition(rect, allRects, existingPositions, currentIdx, scale, micRadius) {
  const baseDistance = 40 * scale
  const maxDistance = 100 * scale // Increased max distance to find more options
  const angleStep = 15 // Try every 15 degrees for finer control
  
  // Generate angle offsets in order of preference (closest to default angle first)
  // Start with 0° (exactly opposite), then try ±15°, ±30°, ±45°, etc.
  const angleOffsets = [0]
  for (let step = angleStep; step <= 180; step += angleStep) {
    angleOffsets.push(step, -step)
  }
  
  // Try positions at different distances, starting from base distance
  for (let distance = baseDistance + 10 * scale; distance <= maxDistance; distance += 10 * scale) {
    // Try angles in order of preference (closest to opposite direction first)
    for (const angleOffset of angleOffsets) {
      const testAngle = rect.defaultAngle + (angleOffset * Math.PI / 180)
      const testX = rect.micX + Math.sin(testAngle) * distance
      const testY = rect.micY - Math.cos(testAngle) * distance
      
      // Check if this position collides with mic nodes or other labels
      const hasCollision = checkLabelCollision(
        testX, testY, rect.width, rect.height,
        rect.micX, rect.micY, micRadius,
        allRects, existingPositions, currentIdx
      )
      
      if (!hasCollision) {
        return { x: testX, y: testY }
      }
    }
  }
  
  // If no position found, return null (will use default)
  return null
}

function drawMic(ctx, mic, labelPos = null) {
  const { x, y } = imageToCanvasCoords(mic.x, mic.y)
  const rotation = mic.rotation || 0
  const scale = nodeScaleFactor.value
  
  // Get color button for this mic
  const colorBtn = getColorButtonForMic(mic)
  const isSelected = selectedMics.value.has(mic)
  const micColor = colorBtn ? colorBtn.color : (isSelected ? '#007bff' : '#fff')
  const borderColor = colorBtn ? colorBtn.color : (isSelected ? '#0056b3' : '#007bff')
  const labelBgColor = colorBtn ? colorBtn.color : 'rgba(255,255,255,0.92)'
  const labelTextColor = colorBtn ? getContrastColor(colorBtn.color) : '#222'
  
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.rotate((rotation * Math.PI) / 180)

  // Draw mic circle - fill with color
  ctx.beginPath()
  ctx.arc(0, 0, 20, 0, 2 * Math.PI)
  ctx.fillStyle = isSelected ? '#007bff' : micColor
  ctx.strokeStyle = borderColor
  ctx.lineWidth = (isSelected ? 3 : 2) / scale
  ctx.fill()
  ctx.stroke()

  // Draw direction indicator (arrow) - fill with color
  ctx.beginPath()
  ctx.moveTo(0, -18) // Top point, closer to circle edge
  ctx.lineTo(8, -2)  // Right bottom point, wider base
  ctx.lineTo(-8, -2) // Left bottom point, wider base
  ctx.closePath()
  // Use a slightly darker version of the color for the arrow, or white if no color
  if (colorBtn) {
    // Convert hex to RGB and darken
    const hex = colorBtn.color.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    const darkenFactor = 0.7
    ctx.fillStyle = `rgb(${Math.floor(r * darkenFactor)}, ${Math.floor(g * darkenFactor)}, ${Math.floor(b * darkenFactor)})`
  } else {
    ctx.fillStyle = isSelected ? '#0056b3' : '#495057'
  }
  ctx.fill()

  // Selection indicator - enhanced highlighting
  if (isSelected) {
    // Outer glow ring
    ctx.beginPath()
    ctx.arc(0, 0, 35, 0, 2 * Math.PI)
    ctx.strokeStyle = '#007bff'
    ctx.lineWidth = 3 / scale
    ctx.setLineDash([8, 4])
    ctx.stroke()
    ctx.setLineDash([])
    
    // Inner selection ring
    ctx.beginPath()
    ctx.arc(0, 0, 30, 0, 2 * Math.PI)
    ctx.strokeStyle = '#0056b3'
    ctx.lineWidth = 2 / scale
    ctx.setLineDash([5, 5])
    ctx.stroke()
    ctx.setLineDash([])
  }

  ctx.restore()

  // Draw label with optimized position
  ctx.font = `bold ${12 * scale}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const labelText = mic.track_name || mic.label
  const textMetrics = ctx.measureText(labelText)
  const padX = 6 * scale
  const padY = 4 * scale
  const bgW = Math.ceil(textMetrics.width) + padX * 2
  const bgH = (18 * scale) + padY * 2
  
  // Use calculated position or calculate default
  let labelX, labelY
  if (labelPos) {
    labelX = labelPos.x
    labelY = labelPos.y
  } else {
    // Fallback to default position
    const labelAngle = (rotation + 180) * (Math.PI / 180)
    const labelDistance = 40 * scale
    labelX = x + Math.sin(labelAngle) * labelDistance
    labelY = y - Math.cos(labelAngle) * labelDistance
  }
  
  // Draw connecting line if label is offset from default position
  if (labelPos && labelPos.needsLine) {
    ctx.save()
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'
    ctx.lineWidth = 1 / scale
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(labelX, labelY)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }
  
  // Background color - use color button or default
  ctx.fillStyle = labelBgColor
  ctx.strokeStyle = 'rgba(0,0,0,0.1)'
  ctx.lineWidth = 1 / scale
  ctx.beginPath()
  ctx.rect(labelX - bgW / 2, labelY - bgH / 2, bgW, bgH)
  ctx.fill()
  ctx.stroke()
  // Text with contrast color
  ctx.fillStyle = labelTextColor
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
  nodeScaleFactor.value *= 1.1
  drawCanvas() 
}
function zoomOut() { 
  nodeScaleFactor.value /= 1.1
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
  const circleRadius = 30 * nodeScaleFactor.value
  const measure = document.createElement('canvas').getContext('2d')
  if (measure) {
    measure.font = `bold ${12 * nodeScaleFactor.value}px sans-serif`
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
    const padX = 6 * nodeScaleFactor.value
    const padY = 4 * nodeScaleFactor.value
    const bgW = textMetrics ? Math.ceil(textMetrics.width) + padX * 2 : (labelText.length * 7 * nodeScaleFactor.value) + padX * 2
    const bgH = (18 * nodeScaleFactor.value) + padY * 2
    const rotation = mic.rotation || 0
    const labelAngle = (rotation + 180) * (Math.PI / 180)
    const labelDistance = 40 * nodeScaleFactor.value
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
  
  // Reset node scale to default
  nodeScaleFactor.value = 1
  
  drawCanvas()
}
function triggerImageUpload() {
  document.getElementById('image-upload').click()
}

// Crop functionality
function openCropModal() {
  if (!bgImageObj.value) {
    toast.error('No image to crop')
    return
  }
  showCropModal.value = true
  nextTick(() => {
    initializeCropCanvas()
  })
}

function closeCropModal() {
  showCropModal.value = false
  cropImageObj.value = null
  cropBox.value = { x: 0, y: 0, width: 0, height: 0 }
}

function initializeCropCanvas() {
  if (!cropCanvas.value || !bgImageObj.value) return
  
  const canvas = cropCanvas.value
  const img = bgImageObj.value
  const maxWidth = Math.min(800, window.innerWidth - 100)
  const maxHeight = Math.min(600, window.innerHeight - 200)
  
  // Calculate scale to fit image in modal
  const scaleX = maxWidth / img.width
  const scaleY = maxHeight / img.height
  cropScale.value = Math.min(scaleX, scaleY, 1) // Don't scale up
  
  const displayWidth = img.width * cropScale.value
  const displayHeight = img.height * cropScale.value
  
  canvas.width = displayWidth
  canvas.height = displayHeight
  canvas.style.width = displayWidth + 'px'
  canvas.style.height = displayHeight + 'px'
  
  cropOffsetX.value = 0
  cropOffsetY.value = 0
  
  // Initialize crop box to full image
  cropBox.value = {
    x: 0,
    y: 0,
    width: displayWidth,
    height: displayHeight
  }
  
  // Load image for cropping
  cropImageObj.value = new Image()
  cropImageObj.value.crossOrigin = 'anonymous'
  cropImageObj.value.onload = () => {
    drawCropCanvas()
  }
  cropImageObj.value.src = bgImage.value
}

function drawCropCanvas() {
  if (!cropCanvas.value || !cropImageObj.value) return
  
  const ctx = cropCanvas.value.getContext('2d')
  const canvas = cropCanvas.value
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  // Draw image
  ctx.drawImage(cropImageObj.value, 0, 0, canvas.width, canvas.height)
  
  // Draw overlay (darken outside crop area)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  // Clear crop area
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillRect(cropBox.value.x, cropBox.value.y, cropBox.value.width, cropBox.value.height)
  ctx.restore()
  
  // Draw crop box border
  ctx.strokeStyle = '#007bff'
  ctx.lineWidth = 2
  ctx.setLineDash([])
  ctx.strokeRect(cropBox.value.x, cropBox.value.y, cropBox.value.width, cropBox.value.height)
  
  // Draw corner handles
  const handleSize = 12
  const handles = [
    { x: cropBox.value.x, y: cropBox.value.y }, // NW
    { x: cropBox.value.x + cropBox.value.width, y: cropBox.value.y }, // NE
    { x: cropBox.value.x, y: cropBox.value.y + cropBox.value.height }, // SW
    { x: cropBox.value.x + cropBox.value.width, y: cropBox.value.y + cropBox.value.height }, // SE
  ]
  
  ctx.fillStyle = '#007bff'
  handles.forEach(handle => {
    ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize)
  })
  
  // Draw edge handles
  const edgeHandles = [
    { x: cropBox.value.x + cropBox.value.width / 2, y: cropBox.value.y }, // N
    { x: cropBox.value.x + cropBox.value.width / 2, y: cropBox.value.y + cropBox.value.height }, // S
    { x: cropBox.value.x, y: cropBox.value.y + cropBox.value.height / 2 }, // W
    { x: cropBox.value.x + cropBox.value.width, y: cropBox.value.y + cropBox.value.height / 2 }, // E
  ]
  
  edgeHandles.forEach(handle => {
    ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize)
  })
}

function getCropCanvasCoords(e) {
  const rect = cropCanvas.value.getBoundingClientRect()
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  }
}

function getCropDragType(x, y) {
  const box = cropBox.value
  const handleSize = 12
  const threshold = handleSize + 5
  
  // Check corners
  if (Math.abs(x - box.x) < threshold && Math.abs(y - box.y) < threshold) return 'resize-nw'
  if (Math.abs(x - (box.x + box.width)) < threshold && Math.abs(y - box.y) < threshold) return 'resize-ne'
  if (Math.abs(x - box.x) < threshold && Math.abs(y - (box.y + box.height)) < threshold) return 'resize-sw'
  if (Math.abs(x - (box.x + box.width)) < threshold && Math.abs(y - (box.y + box.height)) < threshold) return 'resize-se'
  
  // Check edges
  if (Math.abs(y - box.y) < threshold && x >= box.x && x <= box.x + box.width) return 'resize-n'
  if (Math.abs(y - (box.y + box.height)) < threshold && x >= box.x && x <= box.x + box.width) return 'resize-s'
  if (Math.abs(x - box.x) < threshold && y >= box.y && y <= box.y + box.height) return 'resize-w'
  if (Math.abs(x - (box.x + box.width)) < threshold && y >= box.y && y <= box.y + box.height) return 'resize-e'
  
  // Check if inside box (for moving)
  if (x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) return 'move'
  
  return null
}

function onCropMouseDown(e) {
  if (!cropCanvas.value) return
  e.preventDefault()
  
  const { x, y } = getCropCanvasCoords(e)
  cropDragType.value = getCropDragType(x, y)
  
  if (cropDragType.value) {
    cropDragging.value = true
    cropDragStart.value = { x, y }
    cropBoxStart.value = { ...cropBox.value }
    cropCanvas.value.style.cursor = getCropCursor(cropDragType.value)
  }
}

function onCropMouseMove(e) {
  if (!cropCanvas.value) return
  
  const { x, y } = getCropCanvasCoords(e)
  
  if (cropDragging.value && cropDragType.value) {
    const dx = x - cropDragStart.value.x
    const dy = y - cropDragStart.value.y
    
    let newBox = { ...cropBoxStart.value }
    
    switch (cropDragType.value) {
      case 'move':
        newBox.x = Math.max(0, Math.min(cropCanvas.value.width - newBox.width, cropBoxStart.value.x + dx))
        newBox.y = Math.max(0, Math.min(cropCanvas.value.height - newBox.height, cropBoxStart.value.y + dy))
        break
      case 'resize-nw':
        newBox.x = Math.max(0, cropBoxStart.value.x + dx)
        newBox.y = Math.max(0, cropBoxStart.value.y + dy)
        newBox.width = cropBoxStart.value.width - dx
        newBox.height = cropBoxStart.value.height - dy
        break
      case 'resize-ne':
        newBox.y = Math.max(0, cropBoxStart.value.y + dy)
        newBox.width = cropBoxStart.value.width + dx
        newBox.height = cropBoxStart.value.height - dy
        break
      case 'resize-sw':
        newBox.x = Math.max(0, cropBoxStart.value.x + dx)
        newBox.width = cropBoxStart.value.width - dx
        newBox.height = cropBoxStart.value.height + dy
        break
      case 'resize-se':
        newBox.width = cropBoxStart.value.width + dx
        newBox.height = cropBoxStart.value.height + dy
        break
      case 'resize-n':
        newBox.y = Math.max(0, cropBoxStart.value.y + dy)
        newBox.height = cropBoxStart.value.height - dy
        break
      case 'resize-s':
        newBox.height = cropBoxStart.value.height + dy
        break
      case 'resize-w':
        newBox.x = Math.max(0, cropBoxStart.value.x + dx)
        newBox.width = cropBoxStart.value.width - dx
        break
      case 'resize-e':
        newBox.width = cropBoxStart.value.width + dx
        break
    }
    
    // Ensure minimum size
    if (newBox.width < 50) {
      newBox.width = 50
      if (cropDragType.value.includes('w')) newBox.x = cropBoxStart.value.x + cropBoxStart.value.width - 50
    }
    if (newBox.height < 50) {
      newBox.height = 50
      if (cropDragType.value.includes('n')) newBox.y = cropBoxStart.value.y + cropBoxStart.value.height - 50
    }
    
    // Clamp to canvas bounds
    newBox.x = Math.max(0, Math.min(cropCanvas.value.width - newBox.width, newBox.x))
    newBox.y = Math.max(0, Math.min(cropCanvas.value.height - newBox.height, newBox.y))
    newBox.width = Math.min(cropCanvas.value.width - newBox.x, newBox.width)
    newBox.height = Math.min(cropCanvas.value.height - newBox.y, newBox.height)
    
    cropBox.value = newBox
    drawCropCanvas()
  } else {
    // Update cursor based on hover
    const dragType = getCropDragType(x, y)
    cropCanvas.value.style.cursor = dragType ? getCropCursor(dragType) : 'default'
  }
}

function onCropMouseUp(e) {
  if (cropDragging.value) {
    cropDragging.value = false
    cropDragType.value = null
    if (cropCanvas.value) {
      cropCanvas.value.style.cursor = 'default'
    }
  }
}

function getCropCursor(dragType) {
  const cursors = {
    'move': 'move',
    'resize-nw': 'nw-resize',
    'resize-ne': 'ne-resize',
    'resize-sw': 'sw-resize',
    'resize-se': 'se-resize',
    'resize-n': 'n-resize',
    'resize-s': 's-resize',
    'resize-w': 'w-resize',
    'resize-e': 'e-resize'
  }
  return cursors[dragType] || 'default'
}

async function applyCrop() {
  if (!bgImageObj.value || !cropCanvas.value) return
  
  cropBusy.value = true
  
  try {
    // Calculate crop area in original image coordinates
    const scale = bgImageObj.value.width / cropCanvas.value.width
    const cropX = cropBox.value.x * scale
    const cropY = cropBox.value.y * scale
    const cropW = cropBox.value.width * scale
    const cropH = cropBox.value.height * scale
    
    // Create offscreen canvas for cropped image
    const offCanvas = document.createElement('canvas')
    offCanvas.width = cropW
    offCanvas.height = cropH
    const ctx = offCanvas.getContext('2d')
    
    // Draw cropped portion
    ctx.drawImage(
      bgImageObj.value,
      cropX, cropY, cropW, cropH,
      0, 0, cropW, cropH
    )
    
    // Convert to blob
    offCanvas.toBlob(async (blob) => {
      if (!blob) {
        toast.error('Failed to create cropped image')
        cropBusy.value = false
        return
      }
      
      try {
        // Upload cropped image
        const file = new File([blob], 'cropped-bg.png', { type: 'image/png' })
        const { url } = await uploadBgToStorage(file)
        await setBackgroundImage(url)
        toast.success('Image cropped and saved')
        closeCropModal()
      } catch (err) {
        console.error('Error saving cropped image:', err)
        toast.error(`Failed to save cropped image: ${err.message || err}`)
      } finally {
        cropBusy.value = false
      }
    }, 'image/png')
  } catch (err) {
    console.error('Error cropping image:', err)
    toast.error('Failed to crop image')
    cropBusy.value = false
  }
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
  if (e.button !== 0 && e.pointerType !== 'touch' && e.pointerType !== 'pen') return

  const { x, y } = getCanvasCoords(e)
  const pointerInfo = { 
    x, 
    y, 
    initialX: x, 
    initialY: y, 
    type: e.pointerType || 'mouse', 
    timestamp: Date.now() 
  }
  activePointers.set(e.pointerId, pointerInfo)
  pointerTypes.set(e.pointerId, e.pointerType || 'mouse')

  // Detect two-finger gestures (iPad trackpad-like gestures)
  const activePointerIds = Array.from(activePointers.keys())
  const touchPointers = activePointerIds.filter(id => pointerTypes.get(id) === 'touch')
  
  // Two-finger touch detected - enable gesture mode
  if (activePointers.size === 2 && touchPointers.length === 2) {
    gestureState.value.isTwoFingerPan = true
    gestureState.value.isTwoFingerZoom = false
    const pts = Array.from(activePointers.values())
    gestureState.value.panStart = {
      centerX: (pts[0].x + pts[1].x) / 2,
      centerY: (pts[0].y + pts[1].y) / 2,
      pointers: [...pts]
    }
    gestureState.value.panStartImageOffset = {
      x: imageOffsetX.value,
      y: imageOffsetY.value
    }
    const dx = pts[0].x - pts[1].x
    const dy = pts[0].y - pts[1].y
    lastPinchDistance = Math.sqrt(dx * dx + dy * dy)
    return
  }

  // Single pointer - handle selection/dragging
  // Pan image mode (explicit mode toggle)
  if (panImageMode.value && bgImageObj.value) {
    dragStart = { x, y }
    dragStartPos = { x: imageOffsetX.value, y: imageOffsetY.value }
    return
  }

  const imgPt = canvasToImageCoords(x, y)
  const clickedMic = getMicAt(imgPt.imgX, imgPt.imgY)
  
  // For touch/pen: use two-finger tap for multi-select (simulated via timing)
  // For mouse: use Ctrl/Cmd key
  const isMultiSelect = e.ctrlKey || e.metaKey || 
    (e.pointerType === 'touch' && activePointers.size > 1)

  if (clickedMic) {
    // Multi-select logic
    if (isMultiSelect) {
      // Toggle selection: if already selected, remove it; otherwise add it
      if (selectedMics.value.has(clickedMic)) {
        selectedMics.value.delete(clickedMic)
      } else {
        selectedMics.value.add(clickedMic)
      }
      // Keep selectedMic in sync with selectedMics (use first item or null)
      selectedMic.value = selectedMics.value.size > 0 ? Array.from(selectedMics.value)[0] : null
    } else {
      // Single select: replace selection
      if (selectedMics.value.has(clickedMic) && selectedMics.value.size === 1) {
        // Already selected and only one - keep it selected for dragging
      } else {
        // Replace selection with just this mic
        selectedMics.value.clear()
        selectedMics.value.add(clickedMic)
      }
    }
    
    // Keep selectedMic in sync with selectedMics (use first item or null)
    selectedMic.value = selectedMics.value.size > 0 ? Array.from(selectedMics.value)[0] : null
    
    // Start dragging tracking for all selected mics
    draggingMics.value.clear()
    selectedMics.value.forEach(mic => {
      draggingMics.value.add(mic)
      dragStartPositions.set(mic, { x: mic.x, y: mic.y })
    })
    dragStart = { x: imgPt.imgX, y: imgPt.imgY }
    
    // Redraw to show selection highlight
    drawCanvas()
  } else {
    // Clicked empty space - deselect only if not clicking on context menu
    if (!showContextMenu.value) {
      if (!isMultiSelect) {
        // Only clear selection if not holding Ctrl/Cmd or using multi-touch
        selectedMics.value.clear()
        selectedMic.value = null
        drawCanvas()
      }
    }
  }
}

function onPointerMove(e) {
  e.preventDefault()
  const { x, y } = getCanvasCoords(e)
  if (activePointers.has(e.pointerId)) {
    const pointerInfo = activePointers.get(e.pointerId)
    pointerInfo.x = x
    pointerInfo.y = y
    activePointers.set(e.pointerId, pointerInfo)
  }

  // Two-finger gestures (iPad trackpad-like)
  if (activePointers.size >= 2 && bgImageObj.value) {
    const pts = Array.from(activePointers.values())
    const dx = pts[0].x - pts[1].x
    const dy = pts[0].y - pts[1].y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const centerX = (pts[0].x + pts[1].x) / 2
    const centerY = (pts[0].y + pts[1].y) / 2
    
    // Determine if this is zoom or pan based on distance change
    if (lastPinchDistance != null) {
      const distanceChange = Math.abs(dist - lastPinchDistance)
      const panThreshold = 10 // pixels - minimum distance change to trigger zoom
      
      if (distanceChange > panThreshold) {
        // Pinch to zoom (two-finger zoom gesture)
        gestureState.value.isTwoFingerZoom = true
        gestureState.value.isTwoFingerPan = false
        applyZoom(dist / lastPinchDistance, centerX, centerY)
        lastPinchDistance = dist
      } else if (gestureState.value.isTwoFingerPan && gestureState.value.panStart) {
        // Two-finger pan (iPad trackpad pan gesture)
        gestureState.value.isTwoFingerZoom = false
        const panDx = centerX - gestureState.value.panStart.centerX
        const panDy = centerY - gestureState.value.panStart.centerY
        imageOffsetX.value = gestureState.value.panStartImageOffset.x + panDx
        imageOffsetY.value = gestureState.value.panStartImageOffset.y + panDy
        drawCanvas()
      }
    } else {
      lastPinchDistance = dist
    }
    return
  }

  // Single pointer gestures
  // Pan image mode (explicit toggle mode)
  if (panImageMode.value && dragStart && bgImageObj.value) {
    const dx = x - dragStart.x
    const dy = y - dragStart.y
    imageOffsetX.value = dragStartPos.x + dx
    imageOffsetY.value = dragStartPos.y + dy
    drawCanvas()
    return
  }

  // Dragging mics (all selected mics together)
  // For Apple Pencil and touch: only drag if movement exceeds threshold
  if (draggingMics.value.size > 0 && dragStart) {
    const pointerType = pointerTypes.get(e.pointerId) || 'mouse'
    
    // For touch/pen: check if movement exceeds threshold before dragging
    // We need to track the initial canvas position for threshold checking
    if (pointerType === 'touch' || pointerType === 'pen') {
      const pointerInfo = activePointers.get(e.pointerId)
      if (pointerInfo && pointerInfo.initialX !== undefined) {
        const moveDistance = Math.sqrt(
          Math.pow(x - pointerInfo.initialX, 2) + Math.pow(y - pointerInfo.initialY, 2)
        )
        if (moveDistance < DRAG_THRESHOLD) {
          return // Don't start dragging until threshold is exceeded
        }
      }
    }
    
    const imgPt = canvasToImageCoords(x, y)
    // Calculate the offset from the drag start point
    const offsetX = imgPt.imgX - dragStart.x
    const offsetY = imgPt.imgY - dragStart.y
    
    // Move all dragging mics by the same offset
    draggingMics.value.forEach(mic => {
      const startPos = dragStartPositions.get(mic)
      if (startPos) {
        mic.x = startPos.x + offsetX
        mic.y = startPos.y + offsetY
      }
    })
    
    drawCanvas()
  }
}

async function onPointerUp(e) {
  e.preventDefault()
  const pointerType = pointerTypes.get(e.pointerId) || 'mouse'
  activePointers.delete(e.pointerId)
  pointerTypes.delete(e.pointerId)
  
  // Reset gesture state when all pointers are released
  if (activePointers.size < 2) {
    lastPinchDistance = null
    gestureState.value.isTwoFingerPan = false
    gestureState.value.isTwoFingerZoom = false
    gestureState.value.panStart = null
    gestureState.value.panStartImageOffset = null
  }

  if (panImageMode.value) {
    dragStart = null
    dragStartPos = null
    saveImageState()
    return
  }

  // Handle double-tap for Apple Pencil/touch (context menu)
  if (pointerType === 'pen' || pointerType === 'touch') {
    const { x, y } = getCanvasCoords(e)
    const currentTime = Date.now()
    const timeSinceLastTap = currentTime - lastTapTime
    const currentPoint = { x, y }
    
    // Check if this is a double-tap (within timeout and distance threshold)
    if (lastTapPoint && timeSinceLastTap < TAP_TIMEOUT) {
      const distance = Math.sqrt(
        Math.pow(currentPoint.x - lastTapPoint.x, 2) + 
        Math.pow(currentPoint.y - lastTapPoint.y, 2)
      )
      if (distance < 20) { // 20px threshold for double-tap
        // Double-tap detected - open context menu if mic is selected
        const imgPt = canvasToImageCoords(x, y)
        const clickedMic = getMicAt(imgPt.imgX, imgPt.imgY)
        if (clickedMic) {
          selectedMics.value.clear()
          selectedMics.value.add(clickedMic)
          selectedMic.value = clickedMic
          drawCanvas()
          nextTick(() => {
            openContextMenu(e)
          })
        }
        // Reset tap tracking
        lastTapTime = 0
        lastTapPoint = null
        return
      }
    }
    
    // Single tap - update tap tracking
    lastTapTime = currentTime
    lastTapPoint = currentPoint
  }

  // Check if this was a click (no drag) or a drag
  let wasDrag = false
  if (draggingMics.value.size > 0 && dragStart) {
    // Check if any mic was actually moved
    for (const mic of draggingMics.value) {
      const startPos = dragStartPositions.get(mic)
      if (startPos && (
        Math.abs(mic.x - startPos.x) > 0.001 ||
        Math.abs(mic.y - startPos.y) > 0.001
      )) {
        wasDrag = true
        break
      }
    }
  }

  // Save all dragged mic positions if they were dragged
  if (wasDrag && draggingMics.value.size > 0) {
    // Save all mics in parallel
    await Promise.all(
      Array.from(draggingMics.value).map(mic => saveMicUpdate(mic))
    )
  }

  // Clear dragging state but keep selection
  draggingMics.value.clear()
  dragStartPositions.clear()
  dragStart = null
  dragStartPos = null
  
  // Redraw to ensure selection highlight is visible
  if (selectedMics.value.size > 0) {
    drawCanvas()
  }
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
  // Allow normal page scrolling - zoom is controlled via buttons only
  // Do not prevent default or handle zoom here
}

// Mic detection
function getMicAt(imgX, imgY) {
  // Account for node scale when detecting clicks
  // Base detection radius is 0.05 (5% of image size), scaled by node scale
  const baseRadius = 0.05
  const scaledRadius = baseRadius * nodeScaleFactor.value
  
  for (let i = props.nodes.length - 1; i >= 0; i--) {
    const mic = props.nodes[i]
    const dx = imgX - mic.x
    const dy = imgY - mic.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < scaledRadius) return mic
  }
  return null
}

// Double-click handler for context menu
function onDoubleClick(e) {
  const { x, y } = getCanvasCoords(e)
  const imgPt = canvasToImageCoords(x, y)
  // Check mic node clicks
  const clickedMic = getMicAt(imgPt.imgX, imgPt.imgY)
  
  if (clickedMic) {
    // Select only this mic for context menu (single selection for editing)
    selectedMics.value.clear()
    selectedMics.value.add(clickedMic)
    selectedMic.value = clickedMic
    // Redraw to show selection highlight before opening menu
    drawCanvas()
    // Use nextTick to ensure canvas is updated before opening menu
    nextTick(() => {
      openContextMenu(e)
    })
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

    // If gear has a default_color, find or create a matching color button
    let colorButtonId = null
    if (mic.default_color) {
      // Try to find existing color button with this color
      let existingButton = colorButtons.value.find(
        btn => btn.color.toLowerCase() === mic.default_color.toLowerCase() && 
        (btn.location_id === props.locationId || (!btn.location_id && !props.locationId))
      )
      
      if (!existingButton) {
        // Create a new color button for this gear's default color
        try {
          const newButton = await mutateTableData('mic_color_buttons', 'insert', {
            name: mic.gear_name,
            color: mic.default_color,
            description: `Default color for ${mic.gear_name}`,
            project_id: props.projectId,
            location_id: props.locationId || null
          })
          await fetchColorButtons() // Refresh color buttons
          existingButton = colorButtons.value.find(btn => btn.id === newButton.id)
        } catch (err) {
          console.warn('Failed to create color button for gear default color:', err)
        }
      }
      
      if (existingButton) {
        colorButtonId = existingButton.id
      }
    }

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
      num_tracks: 0,
      color_button_id: colorButtonId
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
      color_button_id: mic.color_button_id || null
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
  const message = `Delete microphone "${micLabel}"?`
  const warning = 'This will permanently delete the microphone and all its connections. This action cannot be undone.'

  showDeleteConfirmation(message, warning, async () => {
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
  })
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
  // Keep legend management state when reopening context menu
  // showLegendManagement stays as is
  
  showContextMenu.value = true
  // Ensure canvas is redrawn to show selection highlight
  nextTick(drawCanvas)
}

function closeContextMenu() {
  showContextMenu.value = false
  contextMenuTrackName.value = ''
  contextMenuRotation.value = 0
  contextMenuLabelBgColor.value = 'rgba(255,255,255,0.92)'
}

function closeContextMenuWithoutDeselect() {
  // Close context menu but keep mic selected
  closeContextMenu()
  // Don't deselect the mic - keep it highlighted
}

function setQuickRotation(angle) {
  contextMenuRotation.value = angle
  updateMicFromContextMenu()
}

async function updateMicFromContextMenu() {
  if (!selectedMic.value) return
  
  selectedMic.value.track_name = contextMenuTrackName.value
  selectedMic.value.rotation = contextMenuRotation.value
  
  await saveMicUpdate(selectedMic.value)
  drawCanvas()
}

async function saveAndCloseContextMenu() {
  if (!selectedMic.value) return
  
  // Ensure all current values are saved
  selectedMic.value.track_name = contextMenuTrackName.value
  selectedMic.value.rotation = contextMenuRotation.value
  
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
  const message = `Delete microphone "${micLabel}"?`
  const warning = 'This will permanently delete the microphone and all its connections. This action cannot be undone.'

  showDeleteConfirmation(message, warning, async () => {
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
  })
}

// Generate a readable color name from color value
function getColorName(color) {
  if (!color) return 'Unknown'
  
  // Normalize color to lowercase for comparison
  const normalized = color.toLowerCase().trim()
  
  // Check for common color presets
  const colorMap = {
    'rgba(255,255,255,0.92)': 'White',
    'rgba(0,0,0,0.8)': 'Black',
    'rgba(255,0,0,0.9)': 'Red',
    'rgba(0,255,0,0.9)': 'Green',
    'rgba(0,0,255,0.9)': 'Blue',
    'rgba(255,255,0,0.9)': 'Yellow',
    'rgba(255,0,255,0.9)': 'Magenta',
    'rgba(0,255,255,0.9)': 'Cyan',
  }
  
  if (colorMap[normalized]) {
    return colorMap[normalized]
  }
  
  // Try to parse rgba/rgb
  const rgbaMatch = normalized.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1])
    const g = parseInt(rgbaMatch[2])
    const b = parseInt(rgbaMatch[3])
    
    // Generate a descriptive name based on RGB values
    if (r > 200 && g > 200 && b > 200) return 'Light'
    if (r < 50 && g < 50 && b < 50) return 'Dark'
    if (r > g && r > b) {
      if (g > 150) return 'Orange'
      if (b > 150) return 'Pink'
      return 'Red'
    }
    if (g > r && g > b) {
      if (r > 150) return 'Yellow-Green'
      if (b > 150) return 'Cyan'
      return 'Green'
    }
    if (b > r && b > g) {
      if (r > 150) return 'Purple'
      if (g > 150) return 'Teal'
      return 'Blue'
    }
    return 'Custom'
  }
  
  // Try hex
  if (normalized.startsWith('#')) {
    let hex = normalized.slice(1)
    // Handle 3-digit hex
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('')
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      
      if (r > 200 && g > 200 && b > 200) return 'Light'
      if (r < 50 && g < 50 && b < 50) return 'Dark'
      if (r > g && r > b) {
        if (g > 150) return 'Orange'
        if (b > 150) return 'Pink'
        return 'Red'
      }
      if (g > r && g > b) {
        if (r > 150) return 'Yellow-Green'
        if (b > 150) return 'Cyan'
        return 'Green'
      }
      if (b > r && b > g) {
        if (r > 150) return 'Purple'
        if (g > 150) return 'Teal'
        return 'Blue'
      }
      return 'Custom'
    }
  }
  
  return 'Custom'
}

// Update color legend when nodes change - now based on color buttons
function updateColorLegend() {
  // Build legend from color buttons that are actually used
  const usedButtonIds = new Set()
  props.nodes.forEach(mic => {
    if (mic.color_button_id) {
      usedButtonIds.add(mic.color_button_id)
    }
  })
  
  // Update legend map with used color buttons
  const newLegendMap = {}
  colorButtons.value.forEach(btn => {
    if (usedButtonIds.has(btn.id)) {
      newLegendMap[btn.id] = btn.name
    }
  })
  
  colorLegendMap.value = newLegendMap
  
  // Show legend if there are color buttons in use
  showLegend.value = Object.keys(colorLegendMap.value).length > 0
}

function saveLegend() {
  // Legend is saved automatically via v-model, but we can trigger a redraw
  nextTick(drawCanvas)
}

// Draw legend on canvas
// Calculate best position for legend around screen edges
function calculateLegendPosition(legendWidth, legendHeight, canvasW, canvasH, cornerPreference = 0) {
  const EDGE_MARGIN = 20
  const micNodeRadius = 20 * nodeScaleFactor.value
  
  // Define all corner positions
  // Format: [x, y, description]
  const corners = [
    [canvasW - legendWidth - EDGE_MARGIN, canvasH - legendHeight - EDGE_MARGIN, 'bottom-right'],
    [EDGE_MARGIN, canvasH - legendHeight - EDGE_MARGIN, 'bottom-left'],
    [canvasW - legendWidth - EDGE_MARGIN, EDGE_MARGIN, 'top-right'],
    [EDGE_MARGIN, EDGE_MARGIN, 'top-left'],
  ]
  
  // Define side positions (fallback)
  const sides = [
    [(canvasW - legendWidth) / 2, canvasH - legendHeight - EDGE_MARGIN, 'bottom-center'],
    [(canvasW - legendWidth) / 2, EDGE_MARGIN, 'top-center'],
    [EDGE_MARGIN, (canvasH - legendHeight) / 2, 'left-center'],
    [canvasW - legendWidth - EDGE_MARGIN, (canvasH - legendHeight) / 2, 'right-center'],
  ]
  
  // Reorder corners to prioritize the selected corner
  const reorderedCorners = [
    ...corners.slice(cornerPreference),
    ...corners.slice(0, cornerPreference)
  ]
  
  // Combine: preferred corner first, then other corners, then sides
  const positions = [...reorderedCorners, ...sides]
  
  // Try each position in order of preference
  for (const [x, y, desc] of positions) {
    if (x < 0 || y < 0 || x + legendWidth > canvasW || y + legendHeight > canvasH) {
      continue // Position is out of bounds
    }
    
    // Check if legend rectangle overlaps with any mic node
    let hasCollision = false
    for (const mic of props.nodes) {
      const { x: micX, y: micY } = imageToCanvasCoords(mic.x, mic.y)
      
      if (rectangleCircleOverlap(
        x, y, legendWidth, legendHeight,
        micX, micY, micNodeRadius
      )) {
        hasCollision = true
        break
      }
    }
    
    if (!hasCollision) {
      return { x, y }
    }
  }
  
  // If all positions collide, use bottom-right as fallback (original position)
  return {
    x: canvasW - legendWidth - EDGE_MARGIN,
    y: canvasH - legendHeight - EDGE_MARGIN
  }
}

function drawLegend(ctx, canvasW = null, canvasH = null) {
  // Build legend items from color buttons
  const legendItems = []
  Object.entries(colorLegendMap.value).forEach(([buttonId, label]) => {
    const btn = colorButtons.value.find(b => b.id === buttonId)
    if (btn) {
      legendItems.push([btn.color, label || btn.name])
    }
  })
  
  if (legendItems.length === 0) return
  
  // Use provided dimensions or fall back to current canvas dimensions
  const w = canvasW ?? canvasWidth.value
  const h = canvasH ?? canvasHeight.value
  
  const LEGEND_PADDING = 12
  const LEGEND_ITEM_HEIGHT = 24
  const LEGEND_ITEM_GAP = 8
  const SWATCH_SIZE = 16
  const SWATCH_MARGIN = 8
  const TEXT_MARGIN = 8
  
  // Calculate legend dimensions
  ctx.font = '12px sans-serif'
  let maxTextWidth = 0
  legendItems.forEach(([color, label]) => {
    const text = label || color
    const metrics = ctx.measureText(text)
    maxTextWidth = Math.max(maxTextWidth, metrics.width)
  })
  
  const legendWidth = SWATCH_SIZE + SWATCH_MARGIN + maxTextWidth + LEGEND_PADDING * 2
  const legendHeight = (LEGEND_ITEM_HEIGHT * legendItems.length) + (LEGEND_ITEM_GAP * (legendItems.length - 1)) + LEGEND_PADDING * 2 + 20 // +20 for header
  
  // Calculate best position that avoids mic nodes (use bottom-right as default for exports)
  const { x: legendX, y: legendY } = calculateLegendPosition(legendWidth, legendHeight, w, h, 0)
  
  // Draw legend background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'
  ctx.lineWidth = 1
  // Use roundRect if available, otherwise draw rounded rectangle manually
  if (ctx.roundRect) {
    ctx.beginPath()
    ctx.roundRect(legendX, legendY, legendWidth, legendHeight, 8)
    ctx.fill()
    ctx.stroke()
  } else {
    // Fallback: draw rounded rectangle manually
    const radius = 8
    ctx.beginPath()
    ctx.moveTo(legendX + radius, legendY)
    ctx.lineTo(legendX + legendWidth - radius, legendY)
    ctx.quadraticCurveTo(legendX + legendWidth, legendY, legendX + legendWidth, legendY + radius)
    ctx.lineTo(legendX + legendWidth, legendY + legendHeight - radius)
    ctx.quadraticCurveTo(legendX + legendWidth, legendY + legendHeight, legendX + legendWidth - radius, legendY + legendHeight)
    ctx.lineTo(legendX + radius, legendY + legendHeight)
    ctx.quadraticCurveTo(legendX, legendY + legendHeight, legendX, legendY + legendHeight - radius)
    ctx.lineTo(legendX, legendY + radius)
    ctx.quadraticCurveTo(legendX, legendY, legendX + radius, legendY)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  
  // Draw header
  ctx.fillStyle = '#333'
  ctx.font = 'bold 13px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(props.stageName || 'Color Legend', legendX + LEGEND_PADDING, legendY + LEGEND_PADDING)
  
  // Draw legend items
  let itemY = legendY + LEGEND_PADDING + 20
  legendItems.forEach(([color, label]) => {
    const text = label || getColorName(color)
    
    // Draw color swatch
    ctx.fillStyle = color
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.rect(legendX + LEGEND_PADDING, itemY, SWATCH_SIZE, SWATCH_SIZE)
    ctx.fill()
    ctx.stroke()
    
    // Draw text
    ctx.fillStyle = '#222'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, legendX + LEGEND_PADDING + SWATCH_SIZE + SWATCH_MARGIN, itemY + SWATCH_SIZE / 2)
    
    itemY += LEGEND_ITEM_HEIGHT + LEGEND_ITEM_GAP
  })
}

// Watchers
watch(() => props.nodes, () => {
  updateColorLegend()
  nextTick(drawCanvas)
}, { deep: true })

// Persist opacity changes
// no-op: opacity changes are not persisted locally

// Keyboard handler for context menu and delete
function handleKeyDown(e) {
  // Don't handle keys if user is typing in an input field
  const target = e.target
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    return
  }
  
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
  // Load color buttons
  fetchColorButtons()
  // Fetch project information for export header
  fetchProjectInfo()
  // Load saved legend position
  nextTick(() => {
    loadLegendPosition()
    drawCanvas()
  })
})

// Watch for projectId changes to refetch project info
watch(() => props.projectId, () => {
  fetchProjectInfo()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkScreenSize)
  window.removeEventListener('resize', updateCanvasSize)
  window.removeEventListener('keydown', handleKeyDown)
  // Clean up legend drag listeners if still active
  window.removeEventListener('pointermove', onLegendDragMove)
  window.removeEventListener('pointerup', onLegendDragEnd)
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
  
  // Show filename prompt modal
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  exportFilename.value = `mic-placement-${timestamp}`
  showFilenameModal.value = true
}

function closeFilenameModal() {
  showFilenameModal.value = false
  exportFilename.value = ''
}

async function confirmExport() {
  const filenameInput = exportFilename.value.trim()
  if (!filenameInput) {
    toast.error('Please enter a filename')
    return
  }
  
  // Store filename before closing modal (which clears it)
  // Sanitize filename (remove invalid characters, but preserve the name)
  // Remove or replace characters that aren't safe for filenames
  let sanitizedFilename = filenameInput
    .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid filename characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
  
  // Ensure we have a valid filename
  if (!sanitizedFilename || sanitizedFilename.length === 0) {
    sanitizedFilename = 'mic-placement-export'
  }
  
  // Remove .png extension if present (we'll add it back)
  sanitizedFilename = sanitizedFilename.replace(/\.png$/i, '')
  
  // Add .png extension
  const filename = `${sanitizedFilename}.png`
  
  console.log('Export filename:', filename, 'from input:', filenameInput)
  
  // Close modal (this clears exportFilename, but we've already stored the sanitized filename)
  closeFilenameModal()
  
  // Use getCanvasDataURL to get a properly bounded export with all elements
  const dataURL = getCanvasDataURL()
  if (!dataURL) {
    toast.error('Failed to generate export image')
    return
  }
  
  try {
    // Get venueId from locationId if available
    let venueId = null
    if (props.locationId) {
      try {
        const { data: locationData } = await supabase
          .from('locations')
          .select('venue_id')
          .eq('id', props.locationId)
          .single()
        
        if (locationData) {
          venueId = locationData.venue_id || null
        }
      } catch (err) {
        console.warn('Error fetching venue_id:', err)
      }
    }
    
    // Save to storage instead of downloading
    const { savePNGToStorage } = await import('@/services/exportStorageService')
    const description = `Mic placement export${props.stageName ? ` - ${props.stageName}` : ''}`
    
    const result = await savePNGToStorage(
      dataURL,
      filename,
      props.projectId,
      venueId,
      props.locationId,
      description
    )
    
    if (result.success) {
      // Navigate to Data Management first
      router.push({ name: 'DataManagement', params: { id: props.projectId } })
      
      // Show toast with link to documents
      const navigateToDocs = () => {
        if (venueId && props.locationId) {
          router.push({ 
            name: 'StageDocs', 
            params: { id: props.projectId },
            query: { venueId, stageId: props.locationId }
          })
        } else {
          router.push({ name: 'ProjectDocs', params: { id: props.projectId } })
        }
      }
      
      toast.success('Export saved! Click here to view in Documents', {
        onClick: navigateToDocs,
        closeOnClick: true,
        timeout: 5000
      })
    } else {
      toast.error(`Failed to save export: ${result.error || 'Unknown error'}`)
    }
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

  // Calculate label positions with collision avoidance (same as screen drawing)
  const exportLabelPositions = calculateLabelPositions(measure)
  
  // Include all mic nodes (circle radius and label box)
  const circleRadius = 30 * nodeScaleFactor.value
  const measureFont = `bold ${12 * nodeScaleFactor.value}px sans-serif`
  measure.font = measureFont
  props.nodes.forEach((mic, idx) => {
    const { x, y } = imageToCanvasCoords(mic.x, mic.y)
    // Circle extents
    minX = Math.min(minX, x - circleRadius)
    minY = Math.min(minY, y - circleRadius)
    maxX = Math.max(maxX, x + circleRadius)
    maxY = Math.max(maxY, y + circleRadius)

    // Label extents - use calculated collision-avoided positions
    const labelText = mic.track_name || mic.label || ''
    const textMetrics = measure.measureText(labelText)
    const padX = 6 * nodeScaleFactor.value
    const padY = 4 * nodeScaleFactor.value
    const bgW = Math.ceil(textMetrics.width) + padX * 2
    const bgH = (18 * nodeScaleFactor.value) + padY * 2
    
    // Use calculated label position or fallback to default
    let labelX, labelY
    if (exportLabelPositions[idx]) {
      labelX = exportLabelPositions[idx].x
      labelY = exportLabelPositions[idx].y
    } else {
      // Fallback to default position
      const rotation = mic.rotation || 0
      const labelAngle = (rotation + 180) * (Math.PI / 180)
      const labelDistance = 40 * nodeScaleFactor.value
      labelX = x + Math.sin(labelAngle) * labelDistance
      labelY = y - Math.cos(labelAngle) * labelDistance
    }
    
    const lx = labelX - bgW / 2
    const ly = labelY - bgH / 2
    minX = Math.min(minX, lx)
    minY = Math.min(minY, ly)
    maxX = Math.max(maxX, lx + bgW)
    maxY = Math.max(maxY, ly + bgH)
  })

  // Include legend bounds if it exists (will be positioned in bottom right of content)
  if (Object.keys(colorLegendMap.value).length > 0) {
    const legendMeasure = document.createElement('canvas').getContext('2d')
    if (legendMeasure) {
      legendMeasure.font = '12px sans-serif'
      let maxTextWidth = 0
      Object.entries(colorLegendMap.value).forEach(([color, label]) => {
        const text = label || color
        const metrics = legendMeasure.measureText(text)
        maxTextWidth = Math.max(maxTextWidth, metrics.width)
      })
      const LEGEND_PADDING = 12
      const LEGEND_ITEM_HEIGHT = 24
      const LEGEND_ITEM_GAP = 8
      const SWATCH_SIZE = 16
      const SWATCH_MARGIN = 8
      const legendItemCount = Object.keys(colorLegendMap.value).length
      const legendWidth = SWATCH_SIZE + SWATCH_MARGIN + maxTextWidth + LEGEND_PADDING * 2
      const legendHeight = (LEGEND_ITEM_HEIGHT * legendItemCount) + (LEGEND_ITEM_GAP * (legendItemCount - 1)) + LEGEND_PADDING * 2 + 20
      
      // Legend will be positioned in bottom right, so extend bounds to include it
      // Position it relative to the content bounds
      const legendX = maxX - legendWidth - 20
      const legendY = maxY - legendHeight - 20
      
      // Only extend bounds if legend would be outside current bounds
      if (legendX < minX) minX = legendX
      if (legendY < minY) minY = legendY
      if (legendX + legendWidth > maxX) maxX = legendX + legendWidth
      if (legendY + legendHeight > maxY) maxY = legendY + legendHeight
    }
  }

  // Calculate header dimensions if project info is available
  const HEADER_PADDING = 20
  const HEADER_BOTTOM_PADDING = 15
  let headerHeight = 0
  let headerText = ''
  let headerDateText = ''
  
  if (projectName.value || projectDateRange.value) {
    const headerMeasure = document.createElement('canvas').getContext('2d')
    if (headerMeasure) {
      // Measure project name
      headerMeasure.font = 'bold 28px sans-serif'
      const nameWidth = projectName.value ? headerMeasure.measureText(projectName.value).width : 0
      
      // Measure date range
      headerMeasure.font = '18px sans-serif'
      const dateWidth = projectDateRange.value ? headerMeasure.measureText(projectDateRange.value).width : 0
      
      // Calculate header height (name + spacing + date + padding)
      const nameHeight = 34 // Approximate height for 28px font
      const dateHeight = 22 // Approximate height for 18px font
      const nameDateGap = 8
      headerHeight = HEADER_PADDING + nameHeight + nameDateGap + dateHeight + HEADER_BOTTOM_PADDING
      
      headerText = projectName.value || ''
      headerDateText = projectDateRange.value || ''
    }
  }

  // Apply padding and add header height
  const exportW = Math.max(1, Math.ceil((maxX - minX) + PADDING * 2))
  const exportH = Math.max(1, Math.ceil((maxY - minY) + PADDING * 2 + headerHeight))

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

  // Draw header if project info is available
  if (headerHeight > 0) {
    ctx.save()
    
    // Draw project name
    if (headerText) {
      ctx.font = 'bold 28px sans-serif'
      ctx.fillStyle = '#1a1a1a'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(headerText, exportW / 2, HEADER_PADDING)
    }
    
    // Draw date range
    if (headerDateText) {
      ctx.font = '18px sans-serif'
      ctx.fillStyle = '#666666'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      const nameHeight = 34
      const nameDateGap = 8
      ctx.fillText(headerDateText, exportW / 2, HEADER_PADDING + nameHeight + nameDateGap)
    }
    
    // Draw a subtle line separator below header
    ctx.strokeStyle = '#e0e0e0'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(PADDING, headerHeight - HEADER_BOTTOM_PADDING)
    ctx.lineTo(exportW - PADDING, headerHeight - HEADER_BOTTOM_PADDING)
    ctx.stroke()
    
    ctx.restore()
  }

  // Shift drawing so that minX/minY are inside the frame with padding, accounting for header
  ctx.save()
  ctx.translate(-minX + PADDING, -minY + PADDING + headerHeight)

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

  // Draw all mics using the same routine as screen draw with collision-avoided label positions
  // Recalculate label positions for export (in case canvas size differs)
  const exportCtx = document.createElement('canvas').getContext('2d')
  if (exportCtx) {
    exportCtx.font = `bold ${12 * nodeScaleFactor.value}px sans-serif`
    const exportLabelPositions = calculateLabelPositions(exportCtx)
    
    props.nodes.forEach((mic, idx) => {
      drawMic(ctx, mic, exportLabelPositions[idx])
    })
  } else {
    // Fallback if context creation fails
    props.nodes.forEach(mic => {
      drawMic(ctx, mic)
    })
  }

  ctx.restore()

  // Draw legend if there are custom colors (after restore so it's in export canvas coordinates)
  if (Object.keys(colorLegendMap.value).length > 0) {
    // Calculate legend position in export canvas coordinates
    const legendMeasure = document.createElement('canvas').getContext('2d')
    if (legendMeasure) {
      legendMeasure.font = '12px sans-serif'
      let maxTextWidth = 0
      Object.entries(colorLegendMap.value).forEach(([color, label]) => {
        const text = label || color
        const metrics = legendMeasure.measureText(text)
        maxTextWidth = Math.max(maxTextWidth, metrics.width)
      })
      const LEGEND_PADDING = 12
      const LEGEND_ITEM_HEIGHT = 24
      const LEGEND_ITEM_GAP = 8
      const SWATCH_SIZE = 16
      const SWATCH_MARGIN = 8
      const legendItemCount = Object.keys(colorLegendMap.value).length
      const legendWidth = SWATCH_SIZE + SWATCH_MARGIN + maxTextWidth + LEGEND_PADDING * 2
      const legendHeight = (LEGEND_ITEM_HEIGHT * legendItemCount) + (LEGEND_ITEM_GAP * (legendItemCount - 1)) + LEGEND_PADDING * 2 + 20
      
      // Position legend in bottom right of export canvas
      const legendX = exportW - legendWidth - PADDING
      const legendY = exportH - legendHeight - PADDING
      
      // Draw legend with export canvas dimensions
      drawLegend(ctx, exportW, exportH)
    }
  }

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

.selection-count {
  color: var(--color-primary-600);
  font-size: 14px;
  font-weight: 600;
  padding: 4px 8px;
  background: var(--color-primary-50);
  border-radius: 4px;
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
  position: relative; /* Required for absolute positioning of legend */
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
  z-index: 2000; /* Higher than context menu (1001-1002) to ensure modals appear on top */
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

/* Color Button Modal - narrower with more padding */
.color-button-modal {
  max-width: 480px;
  width: 85%;
  padding: 24px;
  display: flex;
  flex-direction: column;
}

.color-button-modal .modal-header {
  padding: 0 0 20px 0;
  margin-bottom: 0;
}

.color-button-modal .modal-body {
  padding: 0;
  flex: 1;
}

.color-button-modal .modal-footer {
  padding: 24px 0 0 0;
  margin-top: 20px;
  border-top: 1px solid var(--border-light);
  display: flex;
  gap: 12px;
  justify-content: flex-end;
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

/* Color Legend Styles */
.color-legend {
  position: absolute;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 12px;
  min-width: 200px;
  max-width: 300px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10;
  backdrop-filter: blur(4px);
  user-select: none;
  touch-action: none;
  -webkit-user-drag: none;
  -khtml-user-drag: none;
  -moz-user-drag: none;
  -o-user-drag: none;
  user-drag: none;
  transition: opacity 0.1s;
}

.color-legend.legend-dragging {
  opacity: 1;
}

.dark .color-legend {
  background: rgba(30, 30, 30, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05);
}

.legend-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.dark .legend-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.legend-header h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.legend-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-swap-btn {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  line-height: 1;
  transition: all 0.2s;
}

.legend-swap-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
  transform: rotate(90deg);
}

.dark .legend-swap-btn {
  color: rgba(255, 255, 255, 0.7);
}

.dark .legend-swap-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.legend-close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  line-height: 1;
}

.legend-close-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.dark .legend-close-btn {
  color: rgba(255, 255, 255, 0.7);
}

.dark .legend-close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.legend-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-color-swatch {
  width: 16px;
  height: 16px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 3px;
  flex-shrink: 0;
  /* Checkered background for transparency */
  background-image: 
    linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 6px 6px;
  background-position: 0 0, 0 3px, 3px -3px, -3px 0px;
  position: relative;
}

.dark .legend-color-swatch {
  border: 1px solid rgba(255, 255, 255, 0.2);
  /* Darker checkered background for dark mode */
  background-image: 
    linear-gradient(45deg, #555 25%, transparent 25%),
    linear-gradient(-45deg, #555 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #555 75%),
    linear-gradient(-45deg, transparent 75%, #555 75%);
}

.legend-color-swatch::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: inherit;
  border-radius: 2px;
}

.legend-label-text {
  flex: 1;
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 500;
}

/* Filename Modal Styles */
.filename-input-section {
  margin-bottom: 20px;
}

.filename-input-section label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-primary);
  font-size: 14px;
}

.filename-input-field {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid var(--border-medium);
  border-radius: 6px;
  font-size: 16px;
  transition: border-color 0.2s;
  background: var(--bg-primary);
  color: var(--text-primary);
  box-sizing: border-box;
}

.filename-input-field:focus {
  outline: none;
  border-color: var(--color-primary-500);
}

.filename-hint {
  margin: 4px 0 0 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.filename-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

/* Inline Legend Management in Context Menu */
.section-header-with-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.toggle-manage-btn {
  padding: 4px 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-medium);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.toggle-manage-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.legend-management-inline {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
}

.management-header-inline {
  margin-bottom: 12px;
}

.management-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

.add-color-btn-inline {
  width: 100%;
  margin-bottom: 12px;
  padding: 8px 12px;
  font-size: 0.85rem;
}

.color-button-list-inline {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.color-button-item-inline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 6px;
}

.item-info-inline {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.item-color-inline {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
}

.item-details-inline {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}

.item-name-inline {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.85rem;
}

.item-description-inline {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.item-meta-inline {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  font-size: 0.7rem;
  flex-wrap: wrap;
}

.item-color-code-inline {
  font-family: monospace;
  color: var(--text-secondary);
  background: var(--bg-primary);
  padding: 2px 4px;
  border-radius: 2px;
}

.item-usage-count-inline {
  color: var(--text-secondary);
}

.item-actions-inline {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.icon-btn-inline {
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s;
  min-width: 32px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-state-inline {
  text-align: center;
  padding: 20px;
  color: var(--text-secondary);
  font-style: italic;
  font-size: 0.85rem;
}

/* Color Button Selector in Context Menu */
.color-button-selector {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.color-button-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
}

.color-button-select-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 2px solid var(--border-medium);
  border-radius: 6px;
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.85rem;
  color: var(--text-primary);
}

.color-button-select-btn:hover {
  border-color: var(--color-primary-500);
  background: var(--bg-primary);
}

.color-button-select-btn.active {
  border-color: var(--color-primary-500);
  border-width: 3px;
  background: var(--bg-primary);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.color-button-select-btn.no-buttons {
  grid-column: 1 / -1;
  justify-content: center;
  font-style: italic;
  color: var(--text-secondary);
}

.select-btn-swatch {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
}

.manage-color-buttons-btn {
  padding: 8px 16px;
  background: var(--color-secondary-500);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.2s;
  align-self: flex-start;
}

.manage-color-buttons-btn:hover {
  background: var(--color-secondary-600);
}

/* Manager Panel Enhancements */
.section-title {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
  font-style: italic;
}

.item-meta {
  display: flex;
  gap: 12px;
  margin-top: 6px;
  font-size: 0.75rem;
}

.item-color-code {
  font-family: monospace;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 2px 6px;
  border-radius: 3px;
}

.item-usage-count {
  color: var(--text-secondary);
}

/* Color Preview in Modal */
.color-preview-box {
  margin-top: 12px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-light);
}

.preview-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.preview-mic-sample {
  display: flex;
  align-items: center;
  gap: 16px;
  justify-content: center;
}

.preview-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 3px solid;
  background: #fff;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-arrow {
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 10px solid #495057;
  margin-top: -8px;
}

.preview-label-box {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.field-hint {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin: 4px 0 0 0;
  font-style: italic;
}

/* Crop Modal Styles */
.crop-modal {
  max-width: 900px;
  width: 95%;
}

.crop-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.crop-canvas {
  max-width: 100%;
  border: 2px solid var(--border-medium);
  border-radius: 8px;
  cursor: crosshair;
  background: #f0f0f0;
  display: block;
}

.crop-instructions {
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.9rem;
  padding: 8px;
}

.crop-instructions p {
  margin: 0;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 20px;
  border-top: 1px solid var(--border-light);
  background: var(--bg-primary);
}

/* Delete Confirmation Modal Styles */
.delete-confirm-modal {
  max-width: 480px;
  width: 90%;
}

.delete-confirm-content {
  text-align: center;
  padding: 20px 0;
}

.delete-confirm-message {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 16px 0;
  line-height: 1.5;
}

.delete-confirm-warning {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
  border-left: 3px solid var(--color-error-500);
}
</style>


