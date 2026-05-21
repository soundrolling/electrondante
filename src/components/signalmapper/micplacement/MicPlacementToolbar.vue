<template>
  <div class="mp-toolbar">
    <button class="btn btn-primary mp-primary-btn" @click="$emit('open-gear-modal')">
      <Plus :size="16" :stroke-width="2" />
      <span class="mp-btn-label">Add microphone</span>
    </button>

    <div class="mp-image-controls">
      <label class="mp-pan-toggle" :class="{ active: panImageMode }">
        <input type="checkbox" :checked="panImageMode" @change="$emit('update:pan-image-mode', $event.target.checked)" />
        <Move :size="14" :stroke-width="2" />
        <span class="mp-toggle-label">Pan</span>
      </label>
      <label class="mp-pan-toggle" :class="{ active: rotateMode }" title="Rotate mode: tap a mic and drag around it to rotate">
        <input type="checkbox" :checked="rotateMode" @change="$emit('update:rotate-mode', $event.target.checked)" />
        <RotateCw :size="14" :stroke-width="2" />
        <span class="mp-toggle-label">Rotate</span>
      </label>
      <button class="btn mp-icon-btn" @click="$emit('zoom-in')" :disabled="!hasBgImage" title="Zoom in" aria-label="Zoom in">
        <ZoomIn :size="16" :stroke-width="2" />
      </button>
      <button class="btn mp-icon-btn" @click="$emit('zoom-out')" :disabled="!hasBgImage" title="Zoom out" aria-label="Zoom out">
        <ZoomOut :size="16" :stroke-width="2" />
      </button>
      <button class="btn mp-icon-btn" @click="$emit('reset-view')" :disabled="!hasBgImage" title="Reset view" aria-label="Reset view">
        <RotateCcw :size="16" :stroke-width="2" />
      </button>
      <button v-if="!isMobile" class="btn mp-icon-btn" @click="$emit('open-crop')" :disabled="!hasBgImage" title="Crop image" aria-label="Crop image">
        <Crop :size="16" :stroke-width="2" />
      </button>
      <input type="file" accept="image/*,application/pdf,.pdf" @change="$emit('image-upload', $event)" id="image-upload" style="display:none" />
      <button class="btn mp-icon-btn" @click="$emit('trigger-image-upload')" :title="hasBgImage ? 'Replace image or PDF' : 'Upload image or PDF'" aria-label="Upload or replace image or PDF">
        <ImageIcon :size="16" :stroke-width="2" />
      </button>
      <button v-if="!isMobile" class="btn btn-secondary mp-icon-btn" @click="$emit('export-png')" :disabled="!hasBgImage" title="Download image" aria-label="Download image">
        <Download :size="16" :stroke-width="2" />
      </button>
      <button
        v-if="isMobile && hasLegendEntries"
        class="btn mp-icon-btn"
        :class="{ active: showMobileLegend }"
        @click="$emit('update:show-mobile-legend', !showMobileLegend)"
        title="Toggle legend"
        aria-label="Toggle legend"
      >
        <List :size="16" :stroke-width="2" />
      </button>
    </div>
  </div>
</template>

<script setup>
import {
  Plus,
  Move,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Crop,
  Image as ImageIcon,
  Download,
  List,
} from 'lucide-vue-next'

defineProps({
  panImageMode: { type: Boolean, default: false },
  rotateMode: { type: Boolean, default: false },
  hasBgImage: { type: Boolean, default: false },
  isMobile: { type: Boolean, default: false },
  hasLegendEntries: { type: Boolean, default: false },
  showMobileLegend: { type: Boolean, default: false }
})

defineEmits([
  'open-gear-modal',
  'update:pan-image-mode',
  'update:rotate-mode',
  'zoom-in',
  'zoom-out',
  'reset-view',
  'open-crop',
  'image-upload',
  'trigger-image-upload',
  'export-png',
  'update:show-mobile-legend'
])
</script>

<style scoped>
.mp-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 8px var(--space-4) var(--space-3);
  flex-wrap: wrap;
}
.mp-primary-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  height: 38px;
  background: var(--color-primary-500);
  border: 1px solid var(--color-primary-600);
  border-radius: var(--radius-md);
  color: #ffffff;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: background var(--transition-normal), box-shadow var(--transition-normal), transform var(--transition-fast);
  flex-shrink: 0;
}
.mp-primary-btn:hover {
  background: var(--color-primary-600);
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.25);
}
.mp-primary-btn:active { transform: scale(0.98); }
.mp-primary-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.mp-image-controls {
  display: flex;
  gap: 4px;
  padding: 3px;
  background: var(--chip-bg);
  border-radius: var(--radius-md);
  align-items: center;
  margin-left: auto;
}
.mp-pan-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  height: 32px;
  border-radius: calc(var(--radius-md) - 3px);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal);
  user-select: none;
}
.mp-pan-toggle input { display: none; }
.mp-pan-toggle:hover { color: var(--text-primary); }
.mp-pan-toggle.active {
  background: var(--surface-card);
  color: var(--color-primary-700);
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}
.mp-pan-toggle.active svg { color: var(--color-primary-600); }
.mp-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: calc(var(--radius-md) - 3px);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal);
  padding: 0;
}
.mp-icon-btn:hover:not(:disabled) {
  background: var(--surface-card);
  color: var(--text-primary);
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}
.mp-icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.mp-icon-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring);
}

@media (max-width: 600px) {
  .mp-toolbar {
    padding: 6px var(--space-3) var(--space-2);
    flex-wrap: nowrap;
    gap: var(--space-2);
    overflow-x: auto;
  }
  .mp-primary-btn { height: 38px; flex-shrink: 0; }
  .mp-btn-label { display: none; }
  .mp-image-controls { margin-left: auto; flex-wrap: nowrap; flex-shrink: 0; }
  .mp-icon-btn { width: 36px; height: 36px; }
  .mp-icon-btn.active { background: var(--surface-card); color: var(--color-primary-600); }
  .mp-pan-toggle { height: 36px; padding: 0 8px; }
  .mp-toggle-label { display: none; }
}
</style>
