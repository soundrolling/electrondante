<template>
  <div v-if="visible" class="modal-overlay" @click="$emit('close')">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">Reorder Gear</h3>
        <button class="modal-close" @click="$emit('close')">✕</button>
      </div>
      <div class="modal-body">
        <div class="reorder-sort-options">
          <span class="sort-label">Quick Sort:</span>
          <div class="sort-buttons">
            <button class="btn btn-secondary btn-sm" @click="$emit('sort', 'name-asc')">A-Z</button>
            <button class="btn btn-secondary btn-sm" @click="$emit('sort', 'name-desc')">Z-A</button>
            <button class="btn btn-secondary btn-sm" @click="$emit('sort', 'group-asc')">Group (A-Z)</button>
            <button class="btn btn-secondary btn-sm" @click="$emit('sort', 'group-desc')">Group (Z-A)</button>
          </div>
        </div>
        <div class="reorder-list">
          <div 
            v-for="(gear, i) in gearList" 
            :key="gear.id" 
            class="reorder-item"
            :class="{ 'dragging': draggedIndex === i, 'drag-over': dragOverIndex === i }"
            draggable="true"
            @dragstart="handleDragStart($event, i)"
            @dragend="handleDragEnd"
            @dragover.prevent="handleDragOver($event, i)"
            @dragenter.prevent="handleDragEnter(i)"
            @dragleave="handleDragLeave"
            @drop.prevent="handleDrop($event, i)"
            @touchstart="handleTouchStart($event, i)"
            @touchmove="handleTouchMove"
            @touchend="handleTouchEnd"
          >
            <div class="drag-handle" title="Drag to reorder">
              <span class="drag-icon">☰</span>
            </div>
            <span class="reorder-name">{{ gear.gear_name }}</span>
            <div class="reorder-actions">
              <button class="btn btn-secondary btn-arrow" @click="$emit('move', i, -1)" title="Move up">↑</button>
              <button class="btn btn-secondary btn-arrow" @click="$emit('move', i, 1)" title="Move down">↓</button>
            </div>
          </div>
        </div>
        <div class="form-actions" style="margin-top: 12px;">
          <button class="btn btn-positive" @click="$emit('save')">Save Order</button>
          <button class="btn btn-warning" @click="$emit('close')">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  gearList: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close', 'sort', 'move', 'save', 'reorder'])

const draggedIndex = ref(null)
const dragOverIndex = ref(null)
const touchStartY = ref(null)
const touchStartIndex = ref(null)
const touchCurrentIndex = ref(null)

function handleDragStart(event, index) {
  draggedIndex.value = index
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/html', event.target.outerHTML)
}

function handleDragEnd() {
  draggedIndex.value = null
  dragOverIndex.value = null
}

function handleDragOver(event, index) {
  event.preventDefault()
  if (draggedIndex.value !== null && draggedIndex.value !== index) {
    dragOverIndex.value = index
  }
}

function handleDragEnter(index) {
  if (draggedIndex.value !== null && draggedIndex.value !== index) {
    dragOverIndex.value = index
  }
}

function handleDragLeave() {
  dragOverIndex.value = null
}

function handleDrop(event, dropIndex) {
  event.preventDefault()
  if (draggedIndex.value !== null && draggedIndex.value !== dropIndex) {
    emit('reorder', draggedIndex.value, dropIndex)
  }
  handleDragEnd()
}

function handleTouchStart(event, index) {
  touchStartY.value = event.touches[0].clientY
  touchStartIndex.value = index
  touchCurrentIndex.value = index
}

function handleTouchMove(event) {
  if (touchStartIndex.value === null) return
  const currentY = event.touches[0].clientY
  const targetElement = document.elementFromPoint(event.touches[0].clientX, currentY)
  const listContainer = targetElement?.closest('.reorder-list')
  if (!listContainer) return
  
  const items = Array.from(listContainer.children)
  const currentItem = items.findIndex(item => item.contains(targetElement))
  if (currentItem !== -1 && currentItem !== touchCurrentIndex.value) {
    touchCurrentIndex.value = currentItem
  }
}

function handleTouchEnd() {
  if (touchStartIndex.value !== null && touchCurrentIndex.value !== null && touchStartIndex.value !== touchCurrentIndex.value) {
    emit('reorder', touchStartIndex.value, touchCurrentIndex.value)
  }
  touchStartY.value = null
  touchStartIndex.value = null
  touchCurrentIndex.value = null
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1000;
}

.modal {
  width: 100%;
  max-width: 600px;
  background: var(--bg-primary);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.reorder-sort-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.sort-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-heading);
}

.sort-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.reorder-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.reorder-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  cursor: move;
  transition: all 0.2s ease;
}

.reorder-item.dragging {
  opacity: 0.5;
}

.reorder-item.drag-over {
  border-color: var(--color-primary-500);
  background: var(--bg-tertiary);
}

.drag-handle {
  cursor: grab;
  color: var(--text-secondary);
  font-size: 18px;
  user-select: none;
}

.drag-handle:active {
  cursor: grabbing;
}

.reorder-name {
  flex: 1;
  font-size: 14px;
  color: var(--text-primary);
}

.reorder-actions {
  display: flex;
  gap: 4px;
}

.btn-arrow {
  min-width: 32px;
  padding: 4px 8px;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
</style>

