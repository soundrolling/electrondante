<!--
  MicPlacement orchestrates a canvas-based mic-placement editor.

  Decomposition (post-refactor, see #2 in the improvement plan):
    - Composables under src/composables/micPlacement/ own discrete slices of
      state: background image, canvas view + transforms, drawing, pointer
      interaction, colour buttons, legend, crop, export, and placement actions.
    - Sub-components under src/components/signalmapper/micplacement/ render the
      toolbar, canvas, context menu, and modals. They take primitives in via
      props and emit events back; no composable lives inside a sub-component.
    - This file wires the composables to the sub-components, owns the local
      ref()s for canvas/wrapper/legend DOM nodes, and handles the keyboard /
      lifecycle wiring. Public surface (props, emits, `getCanvasDataURL` on
      the exposed instance) is unchanged from the pre-refactor god component.
-->
<template>
  <div class="mic-placement-container">
    <MicPlacementHeader
      :node-count="props.nodes.length"
      :selected-count="selectedMics.size"
      :is-mobile="isMobile"
    />

    <MicPlacementToolbar
      :pan-image-mode="panImageMode"
      :rotate-mode="rotateMode"
      :has-bg-image="!!bgImage"
      :is-mobile="isMobile"
      :has-legend-entries="legendEntriesByMic.length > 0"
      :show-mobile-legend="showMobileLegend"
      @open-gear-modal="openGearModal"
      @update:pan-image-mode="panImageMode = $event"
      @update:rotate-mode="rotateMode = $event"
      @zoom-in="zoomIn"
      @zoom-out="zoomOut"
      @reset-view="resetView"
      @open-crop="openCropModal"
      @image-upload="onImageUpload"
      @trigger-image-upload="triggerImageUpload"
      @export-png="exportToPDF"
      @update:show-mobile-legend="showMobileLegend = $event"
    />

    <MicPlacementCanvas
      ref="canvasComponentRef"
      :canvas-width="canvasWidth"
      :canvas-height="canvasHeight"
      :dpr="dpr"
      :canvas-style="canvasStyle"
      :show-legend="showLegend"
      :is-mobile="isMobile"
      :legend-dragging="legendDragging"
      :legend-style="legendStyle"
      :legend-entries-by-mic="legendEntriesByMic"
      :stage-name="props.stageName"
      @pointer-down="onPointerDown"
      @pointer-move="onPointerMove"
      @pointer-up="onPointerUp"
      @wheel="onWheel"
      @double-click="onDoubleClick"
      @legend-drag-start="onLegendDragStart"
      @close-legend="showLegend = false"
    />

    <MicPlacementContextMenu
      :show="showContextMenu"
      :selected-mic="selectedMic"
      :track-name="contextMenuTrackName"
      :rotation="contextMenuRotation"
      :show-legend-management="showLegendManagement"
      :unique-color-buttons="uniqueColorButtons"
      :color-buttons="colorButtons"
      :editing-color-button="editingColorButton"
      :is-dedup-btn-active="isDedupBtnActive"
      :nodes="props.nodes"
      @close="closeContextMenu"
      @close-without-deselect="closeContextMenuWithoutDeselect"
      @update:track-name="contextMenuTrackName = $event"
      @update:rotation="contextMenuRotation = $event"
      @save="updateMicFromContextMenu"
      @save-and-close="saveAndCloseContextMenu"
      @set-quick-rotation="setQuickRotation"
      @toggle-legend-management="showLegendManagement = !showLegendManagement"
      @apply-color-button="applyColorButtonToMic"
      @open-color-button-modal="openColorButtonModal"
      @edit-color-button="editColorButton"
      @delete-color-button="onDeleteColorButton"
      @delete-mic="deleteMicFromContextMenu"
    />

    <MicPlacementFilenameModal
      :show="showFilenameModal"
      :filename="exportFilename"
      @close="closeFilenameModal"
      @confirm="confirmExport"
      @update:filename="exportFilename = $event"
    />

    <MicPlacementColorButtonModal
      :show="showColorButtonModal"
      :editing-color-button="editingColorButton"
      :form="colorButtonForm"
      :busy="colorButtonBusy"
      @close="closeColorButtonModal"
      @save="saveColorButton"
      @update:form="colorButtonForm = $event"
    />

    <MicPlacementCropModal
      ref="cropModalRef"
      :show="showCropModal"
      :busy="cropBusy"
      @close="closeCropModal"
      @apply="applyCrop"
      @mouse-down="onCropMouseDown"
      @mouse-move="onCropMouseMove"
      @mouse-up="onCropMouseUp"
    />

    <MicPlacementDeleteConfirm
      :show="showDeleteConfirm"
      :message="deleteConfirmMessage"
      :warning="deleteConfirmWarning"
      @cancel="cancelDelete"
      @confirm="confirmDelete"
    />

    <MicPlacementGearModal
      :show="showGearModal"
      :selected-mic-for-orientation="selectedMicForOrientation"
      :track-name-input="trackNameInput"
      :selected-orientation="selectedOrientation"
      :available-mics="availableMics"
      :get-available-count="getAvailableCount"
      @close="closeGearModal"
      @select-mic-for-orientation="selectMicForOrientation"
      @update:track-name-input="trackNameInput = $event"
      @update:selected-orientation="selectedOrientation = $event"
      @place-mic="placeMic"
      @cancel-orientation="cancelOrientation"
    />

    <MicPlacementMobileLegend
      :show="isMobile && showMobileLegend"
      :entries="legendEntriesByMic"
      :stage-name="props.stageName"
      @close="showMobileLegend = false"
    />

    <MicPlacementPdfPageModal
      :show="showPdfPageModal"
      :page-count="pdfPageCount"
      :page-number="pdfPageNumber"
      :busy="pdfBusy"
      @cancel="cancelPdfPage"
      @confirm="confirmPdfPage"
      @update:page-number="pdfPageNumber = $event"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'

import MicPlacementHeader from './micplacement/MicPlacementHeader.vue'
import MicPlacementToolbar from './micplacement/MicPlacementToolbar.vue'
import MicPlacementCanvas from './micplacement/MicPlacementCanvas.vue'
import MicPlacementContextMenu from './micplacement/MicPlacementContextMenu.vue'
import MicPlacementFilenameModal from './micplacement/MicPlacementFilenameModal.vue'
import MicPlacementColorButtonModal from './micplacement/MicPlacementColorButtonModal.vue'
import MicPlacementCropModal from './micplacement/MicPlacementCropModal.vue'
import MicPlacementDeleteConfirm from './micplacement/MicPlacementDeleteConfirm.vue'
import MicPlacementGearModal from './micplacement/MicPlacementGearModal.vue'
import MicPlacementMobileLegend from './micplacement/MicPlacementMobileLegend.vue'
import MicPlacementPdfPageModal from './micplacement/MicPlacementPdfPageModal.vue'

import { isPdfFile, getPdfPageCount, pdfPageToPngFile } from '@/utils/pdfToImage'

import { useMicBackgroundImage } from '@/composables/micPlacement/useMicBackgroundImage'
import { useMicCanvasView } from '@/composables/micPlacement/useMicCanvasView'
import { useMicCanvasDrawing } from '@/composables/micPlacement/useMicCanvasDrawing'
import { useMicPointerInteraction } from '@/composables/micPlacement/useMicPointerInteraction'
import { useMicColorButtons } from '@/composables/micPlacement/useMicColorButtons'
import { useMicLegend } from '@/composables/micPlacement/useMicLegend'
import { useMicCrop } from '@/composables/micPlacement/useMicCrop'
import { useMicPlacementActions } from '@/composables/micPlacement/useMicPlacementActions'
import { useMicExport } from '@/composables/micPlacement/useMicExport'

const props = defineProps({
  projectId: { type: [String, Number], required: true },
  locationId: { type: [String, Number], default: null },
  stageHourId: { type: [String, Number], default: null },
  nodes: { type: Array, default: () => [] },
  gearList: { type: Array, default: () => [] },
  stageName: { type: String, default: null }
})

const emit = defineEmits(['node-updated', 'node-added', 'node-deleted', 'connection-deleted'])

// ── DOM refs (resolved after sub-components mount) ───────
const canvasComponentRef = ref(null)
const cropModalRef = ref(null)
const canvasWrapperRef = ref(null)
const canvasRef = ref(null)
const legendElRef = ref(null)
const cropCanvasRef = ref(null)

// ── UI toggles ───────────────────────────────────────────
const panImageMode = ref(false)
const rotateMode = ref(false)

const isMobile = ref(false)
function checkScreenSize() {
  isMobile.value = window.innerWidth < 768
}

// ── Context menu state ───────────────────────────────────
const showContextMenu = ref(false)
const contextMenuTrackName = ref('')
const contextMenuRotation = ref(0)

// ── Delete confirmation state ────────────────────────────
const showDeleteConfirm = ref(false)
const deleteConfirmMessage = ref('')
const deleteConfirmWarning = ref('')
const pendingDeleteAction = ref(null)

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
  if (pendingDeleteAction.value) await pendingDeleteAction.value()
  cancelDelete()
}

// ── Composables (order matters: each may consume the previous) ──

// Forward-declared so composables can call back into the running drawCanvas
// without a chicken-and-egg construction order.
let _drawCanvas = () => {}
const redraw = () => _drawCanvas()

// 1. Background image
const bg = useMicBackgroundImage({
  getProjectId: () => props.projectId,
  getLocationId: () => props.locationId,
  getCanvasWidth: () => canvasWidth.value,
  getCanvasHeight: () => canvasHeight.value,
  getIsMobile: () => isMobile.value,
  redraw
})
const {
  bgImage, bgImageObj, imageOffsetX, imageOffsetY, scaleFactor,
  setBackgroundImage, uploadBgToStorage, fitImageToCanvas,
  loadImageState, saveImageState
} = bg

// 2. Canvas view + transforms
const view = useMicCanvasView({
  canvasWrapperRef,
  canvasRef,
  bgImageObj,
  imageOffsetX,
  imageOffsetY,
  scaleFactor,
  redraw
})
const {
  dpr, canvasWidth, canvasHeight, nodeScaleFactor, canvasStyle,
  canvasToImageCoords, imageToCanvasCoords, getCanvasCoords,
  zoomIn, zoomOut, applyZoom, updateCanvasSize
} = view

function resetView() {
  view.resetImageView({
    getNodes: () => props.nodes,
    fitImageToCanvas
  })
}

// 3. Colour buttons (used by drawing + legend + context menu)
const colorBtns = useMicColorButtons({
  getProjectId: () => props.projectId,
  getLocationId: () => props.locationId,
  getNodes: () => props.nodes,
  getSelectedMic: () => selectedMic.value,
  saveMic: async (mic) => { await saveMicUpdate(mic); _drawCanvas() }
})
const {
  colorButtons, editingColorButton, colorButtonForm, showColorButtonModal,
  colorButtonBusy, showLegendManagement,
  uniqueColorButtons, legendEntriesByMic,
  getColorButtonForMic, isDedupBtnActive, fetchColorButtons,
  openColorButtonModal, closeColorButtonModal,
  editColorButton, saveColorButton, deleteColorButtonById,
  applyColorButtonToMic, findOrCreateColorButtonForGear
} = colorBtns

// 4. Selection state lives inside pointer interaction so all input-driven
//    state stays in one place. We need a forward ref to selectedMic because
//    the colour-buttons composable above already captured `getSelectedMic`.
let selectedMic = ref(null)
let selectedMics = ref(new Set())

// 5. Drawing (depends on view + selection + colour buttons)
const drawing = useMicCanvasDrawing({
  canvasRef,
  dpr,
  canvasWidth,
  canvasHeight,
  bgImageObj,
  imageOffsetX,
  imageOffsetY,
  scaleFactor,
  nodeScaleFactor,
  getNodes: () => props.nodes,
  getSelectedMics: () => selectedMics.value,
  imageToCanvasCoords,
  getColorButtonForMic
})
const { drawCanvas, drawMic, calculateLabelPositions, rectangleCircleOverlap, getMicAt } = drawing
_drawCanvas = drawCanvas

// 6. Pointer interaction (owns the canonical selectedMic / selectedMics refs)
const interaction = useMicPointerInteraction({
  canvasRef,
  panImageMode,
  rotateMode,
  bgImageObj,
  imageOffsetX,
  imageOffsetY,
  showContextMenu,
  isMobile,
  getCanvasCoords,
  canvasToImageCoords,
  applyZoom,
  drawCanvas,
  getMicAt,
  saveMicUpdate: (mic) => saveMicUpdate(mic),
  openContextMenu: (e) => openContextMenu(e),
  saveImageState
})
// Rebind the forward refs to the canonical state owned by the composable.
selectedMic = interaction.selectedMic
selectedMics = interaction.selectedMics
const {
  onPointerDown, onPointerMove, onPointerUp, onWheel, onDoubleClick
} = interaction

// 7. Legend (depends on colour buttons + drawing math)
const legend = useMicLegend({
  legendElRef,
  canvasWrapperRef,
  legendEntriesByMic,
  getProjectId: () => props.projectId,
  getLocationId: () => props.locationId,
  getStageName: () => props.stageName,
  getNodes: () => props.nodes,
  canvasWidth,
  canvasHeight,
  nodeScaleFactor,
  imageToCanvasCoords,
  rectangleCircleOverlap
})
const {
  showLegend, showMobileLegend, legendStyle, legendDragging,
  loadLegendPosition,
  onLegendDragStart,
  cleanup: cleanupLegend,
  updateColorLegend,
  drawLegend
} = legend

// 8. Crop
const crop = useMicCrop({
  cropCanvasRef,
  bgImageObj,
  uploadBgToStorage,
  setBackgroundImage
})
const {
  showCropModal, cropBusy,
  openCropModal, closeCropModal,
  onCropMouseDown, onCropMouseMove, onCropMouseUp, applyCrop
} = crop

// 9. Placement actions
const actions = useMicPlacementActions({
  props,
  emit,
  canvasWidth,
  canvasHeight,
  canvasToImageCoords,
  findOrCreateColorButtonForGear,
  showDeleteConfirmation,
  closeContextMenu: () => closeContextMenu(),
  drawCanvas: () => nextTick(drawCanvas)
})
const {
  showGearModal, selectedMicForOrientation, selectedOrientation, trackNameInput,
  availableMics, getAvailableCount,
  openGearModal, closeGearModal, cancelOrientation, selectMicForOrientation,
  placeMic, saveMicUpdate, cascadeDeleteNode
} = actions
const deleteSelected = actions.deleteSelectedFactory(
  () => selectedMic.value,
  (v) => { selectedMic.value = v }
)

// 10. Export
const exporter = useMicExport({
  props,
  canvasRef,
  canvasWidth,
  canvasHeight,
  bgImage,
  bgImageObj,
  imageOffsetX,
  imageOffsetY,
  scaleFactor,
  nodeScaleFactor,
  legendEntriesByMic,
  calculateLabelPositions,
  drawMic,
  drawLegend,
  imageToCanvasCoords
})
const {
  showFilenameModal, exportFilename,
  fetchProjectInfo,
  exportToPDF, closeFilenameModal, confirmExport, getCanvasDataURL
} = exporter

// ── Image / PDF upload entry point ───────────────────────
import { useToast } from 'vue-toastification'
const toast = useToast()

// PDF page-picker state: only shown for multi-page PDFs. For single-page
// PDFs we convert and upload immediately without prompting.
const showPdfPageModal = ref(false)
const pdfPageCount = ref(1)
const pdfPageNumber = ref(1)
const pdfBusy = ref(false)
let pendingPdfFile = null

async function uploadImageFile(file) {
  const { url, removed } = await uploadBgToStorage(file)
  await setBackgroundImage(url)
  toast.success(removed ? 'Previous background removed and new image uploaded' : 'Background uploaded')
}

async function convertAndUploadPdfPage(file, pageNumber) {
  const pngFile = await pdfPageToPngFile(file, pageNumber)
  await uploadImageFile(pngFile)
}

async function onImageUpload(e) {
  const file = e.target.files[0]
  // Reset so re-selecting the same file still fires `change`.
  if (e.target) e.target.value = ''
  if (!file) return
  try {
    if (isPdfFile(file)) {
      const count = await getPdfPageCount(file)
      if (count <= 1) {
        await convertAndUploadPdfPage(file, 1)
        return
      }
      pendingPdfFile = file
      pdfPageCount.value = count
      pdfPageNumber.value = 1
      showPdfPageModal.value = true
      return
    }
    await uploadImageFile(file)
  } catch (err) {
    toast.error(`Failed to upload background: ${err.message || err}`)
  }
}

async function confirmPdfPage() {
  if (!pendingPdfFile) {
    showPdfPageModal.value = false
    return
  }
  pdfBusy.value = true
  try {
    await convertAndUploadPdfPage(pendingPdfFile, pdfPageNumber.value)
    showPdfPageModal.value = false
    pendingPdfFile = null
  } catch (err) {
    toast.error(`Failed to render PDF page: ${err.message || err}`)
  } finally {
    pdfBusy.value = false
  }
}

function cancelPdfPage() {
  showPdfPageModal.value = false
  pendingPdfFile = null
}

function triggerImageUpload() {
  document.getElementById('image-upload').click()
}

// ── Context menu actions ─────────────────────────────────
function openContextMenu() {
  if (!selectedMic.value) return
  contextMenuTrackName.value = selectedMic.value.track_name || ''
  contextMenuRotation.value = selectedMic.value.rotation || 0
  showContextMenu.value = true
  nextTick(drawCanvas)
}

function closeContextMenu() {
  showContextMenu.value = false
  contextMenuTrackName.value = ''
  contextMenuRotation.value = 0
}

function closeContextMenuWithoutDeselect() {
  closeContextMenu()
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
  selectedMic.value.track_name = contextMenuTrackName.value
  selectedMic.value.rotation = contextMenuRotation.value
  await saveMicUpdate(selectedMic.value)
  drawCanvas()
  closeContextMenu()
}

async function deleteMicFromContextMenu() {
  if (!selectedMic.value) return

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

// ── Colour-button delete with confirmation ───────────────
function onDeleteColorButton(id, idx) {
  const btn = colorButtons.value[idx]
  const usageCount = props.nodes.filter(n => n.color_button_id === btn.id).length

  const message = `Delete colour legend entry "${btn.name}"?`
  const warning = usageCount > 0
    ? `This colour is used by ${usageCount} mic${usageCount !== 1 ? 's' : ''}. They will revert to the default colour.`
    : 'This will permanently remove the colour legend entry.'

  showDeleteConfirmation(message, warning, async () => {
    await deleteColorButtonById(id, idx)
    updateColorLegend(colorButtons)
  })
}

// ── Watchers ─────────────────────────────────────────────
watch(() => props.nodes, () => {
  updateColorLegend(colorButtons)
  nextTick(drawCanvas)
}, { deep: true })

watch(() => props.projectId, () => {
  fetchProjectInfo()
})

watch(colorButtons, () => {
  updateColorLegend(colorButtons)
}, { deep: true })

// ── Keyboard handling ────────────────────────────────────
function handleKeyDown(e) {
  const target = e.target
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    return
  }

  if (e.key === 'Escape' && showContextMenu.value) {
    closeContextMenu()
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedMic.value && !showContextMenu.value) {
    e.preventDefault()
    deleteSelected()
  }
}

// ── Lifecycle ────────────────────────────────────────────
onMounted(() => {
  // Resolve refs from sub-components after they mount
  canvasWrapperRef.value = canvasComponentRef.value?.canvasWrapperRef
  canvasRef.value = canvasComponentRef.value?.canvasRef
  legendElRef.value = canvasComponentRef.value?.legendElRef
  cropCanvasRef.value = cropModalRef.value?.cropCanvasRef

  checkScreenSize()
  if (isMobile.value) panImageMode.value = true
  window.addEventListener('resize', checkScreenSize)
  window.addEventListener('keydown', handleKeyDown)

  if (canvasRef.value) {
    canvasRef.value.width = canvasWidth.value * dpr
    canvasRef.value.height = canvasHeight.value * dpr
  }
  updateCanvasSize()
  window.addEventListener('resize', updateCanvasSize)
  loadImageState()
  fetchColorButtons().then(() => updateColorLegend(colorButtons))
  fetchProjectInfo()
  nextTick(() => {
    loadLegendPosition()
    drawCanvas()
  })
})

// Watch for crop-modal canvas mount so the crop logic can grab it.
watch(() => cropModalRef.value, (m) => {
  if (m) cropCanvasRef.value = m.cropCanvasRef
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkScreenSize)
  window.removeEventListener('resize', updateCanvasSize)
  window.removeEventListener('keydown', handleKeyDown)
  cleanupLegend()
})

defineExpose({ getCanvasDataURL })
</script>

<style scoped>
.mic-placement-container {
  padding: 20px;
}

@media (max-width: 600px) {
  .mic-placement-container {
    padding: 12px;
  }
}
</style>
