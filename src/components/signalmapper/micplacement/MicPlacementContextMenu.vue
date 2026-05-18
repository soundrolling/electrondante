<template>
  <div v-if="show" class="context-menu-overlay" @click="$emit('close-without-deselect')">
    <div class="context-menu" @click.stop>
      <div class="context-menu-header">
        <h4>{{ selectedMic?.track_name || selectedMic?.label || 'Mic' }}</h4>
        <button @click="$emit('close')" class="close-btn">×</button>
      </div>
      <div class="context-menu-body">
        <div class="context-menu-section">
          <label>Track Name:</label>
          <input
            :value="trackName"
            @input="$emit('update:track-name', $event.target.value)"
            @change="$emit('save')"
            type="text"
            placeholder="e.g. Stage L"
            class="context-menu-input"
          />
        </div>
        <div class="context-menu-section">
          <label>Rotation (degrees):</label>
          <div class="rotation-controls">
            <input
              :value="rotation"
              @input="$emit('update:rotation', Number($event.target.value))"
              @change="$emit('save')"
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
                @click="$emit('set-quick-rotation', angle)"
                class="quick-rotation-btn"
                :class="{ active: Math.abs((rotation % 360) - angle) < 1 }"
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
              @click="$emit('toggle-legend-management')"
              :title="showLegendManagement ? 'Hide management' : 'Show management'"
            >
              {{ showLegendManagement ? '▼' : '▶' }} Manage
            </button>
          </div>

          <div class="color-button-selector">
            <div class="color-button-buttons">
              <button
                v-for="btn in uniqueColorButtons"
                :key="btn.id"
                class="color-button-select-btn"
                :class="{ active: isDedupBtnActive(btn) }"
                :style="{
                  '--btn-color': btn.color,
                  '--btn-text': getContrastColor(btn.color)
                }"
                @click="$emit('apply-color-button', btn.id)"
                :title="btn.name"
              >
                <div class="select-btn-swatch" :style="{ backgroundColor: btn.color }"></div>
                <span>{{ btn.name }}</span>
              </button>
              <button
                v-if="colorButtons.length === 0"
                class="color-button-select-btn no-buttons"
                @click="$emit('open-color-button-modal')"
              >
                No colour legend entries. Click to create.
              </button>
            </div>
          </div>

          <div v-if="showLegendManagement" class="legend-management-inline">
            <div class="management-header-inline">
              <span class="management-title">Manage Colour Legend</span>
            </div>

            <button class="btn btn-primary add-color-btn-inline" @click="$emit('open-color-button-modal')">
              {{ editingColorButton !== null ? '✏️ Edit' : '➕ Add' }} Entry
            </button>

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
                        Used by {{ nodeUsageCount(btn.id) }} mic{{ nodeUsageCount(btn.id) !== 1 ? 's' : '' }}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="item-actions-inline">
                  <button @click="$emit('edit-color-button', idx)" class="btn btn-warning icon-btn-inline" title="Edit">✏️</button>
                  <button @click="$emit('delete-color-button', btn.id, idx)" class="btn btn-danger icon-btn-inline" title="Delete">🗑️</button>
                </div>
              </div>
            </div>
            <div v-else class="empty-state-inline">
              <p>No colour legend entries yet. Click "Add Entry" to create one.</p>
            </div>
          </div>
        </div>
        <div class="context-menu-actions">
          <button @click="$emit('delete-mic')" class="btn btn-danger context-menu-btn">
            🗑️ Delete
          </button>
          <button @click="$emit('save-and-close')" class="btn btn-primary context-menu-btn">
            Save
          </button>
          <button @click="$emit('close')" class="btn btn-secondary context-menu-btn">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { getContrastColor } from '@/composables/micPlacement/colorHelpers'

const props = defineProps({
  show: { type: Boolean, default: false },
  selectedMic: { type: Object, default: null },
  trackName: { type: String, default: '' },
  rotation: { type: Number, default: 0 },
  showLegendManagement: { type: Boolean, default: false },
  uniqueColorButtons: { type: Array, default: () => [] },
  colorButtons: { type: Array, default: () => [] },
  editingColorButton: { type: Number, default: null },
  isDedupBtnActive: { type: Function, default: () => false },
  nodes: { type: Array, default: () => [] }
})

defineEmits([
  'close',
  'close-without-deselect',
  'update:track-name',
  'update:rotation',
  'save',
  'save-and-close',
  'set-quick-rotation',
  'toggle-legend-management',
  'apply-color-button',
  'open-color-button-modal',
  'edit-color-button',
  'delete-color-button',
  'delete-mic'
])

function nodeUsageCount(buttonId) {
  return props.nodes.filter(n => n.color_button_id === buttonId).length
}
</script>

<style scoped>
.context-menu-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.55);
  z-index: var(--z-modal-backdrop);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  padding: var(--space-4);
  animation: mp-fade 140ms ease-out;
}
@keyframes mp-fade { from { opacity: 0; } to { opacity: 1; } }
.context-menu {
  position: relative;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  min-width: 320px;
  max-width: 440px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  margin: auto;
  z-index: var(--z-modal);
  overflow: hidden;
  animation: mp-pop 180ms cubic-bezier(0.25, 0.8, 0.35, 1);
}
@keyframes mp-pop { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
.context-menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--surface-card);
  border-bottom: 1px solid var(--surface-border);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  flex-shrink: 0;
}
.context-menu-header h4 {
  margin: 0;
  font-size: var(--text-base);
  font-weight: var(--font-bold);
  color: var(--text-heading);
  letter-spacing: -0.01em;
}
.context-menu-header .close-btn {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-tertiary);
  font-size: var(--text-xl);
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
}
.context-menu-header .close-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
  border-color: var(--surface-border);
}
.context-menu-body {
  padding: var(--space-4);
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.context-menu-section {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.context-menu-section label {
  font-size: 11px;
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0;
}
.context-menu-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  background: var(--surface-card);
  color: var(--text-primary);
  min-height: 40px;
  font-family: inherit;
  transition: border-color var(--transition-normal), box-shadow var(--transition-normal);
}
.context-menu-input:hover { border-color: var(--surface-border-strong); }
.context-menu-input:focus {
  outline: none;
  border-color: var(--color-primary-400);
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.rotation-controls { display: flex; flex-direction: column; gap: 6px; }
.rotation-input { max-width: 120px; }

.quick-rotation-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  padding: 3px;
  background: var(--chip-bg);
  border-radius: var(--radius-md);
}
.quick-rotation-btn {
  padding: 6px 4px;
  background: transparent;
  border: none;
  border-radius: calc(var(--radius-md) - 3px);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  font-variant-numeric: tabular-nums;
  transition: background var(--transition-normal), color var(--transition-normal);
  min-height: 30px;
}
.quick-rotation-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}
.quick-rotation-btn.active {
  background: var(--surface-card);
  color: var(--color-primary-700);
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
}

.section-header-with-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.toggle-manage-btn {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}
.toggle-manage-btn:hover { color: var(--text-primary); background: var(--surface-hover); }

.color-button-selector { display: flex; flex-direction: column; gap: 8px; }
.color-button-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  gap: 6px;
}
.color-button-select-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-xs);
  color: var(--text-primary);
}
.color-button-select-btn.active {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 2px var(--focus-ring);
}
.color-button-select-btn.no-buttons {
  grid-column: 1 / -1;
  justify-content: center;
  color: var(--text-tertiary);
  font-style: italic;
}
.select-btn-swatch {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid rgba(0,0,0,0.12);
  flex-shrink: 0;
}

.legend-management-inline {
  border: 1px dashed var(--surface-border);
  border-radius: var(--radius-md);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.management-header-inline { display: flex; align-items: center; justify-content: space-between; }
.management-title {
  font-size: 11px;
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.add-color-btn-inline {
  align-self: flex-start;
  padding: 6px 10px;
  font-size: var(--text-xs);
  background: var(--color-primary-500);
  color: #fff;
  border: 1px solid var(--color-primary-600);
  border-radius: var(--radius-md);
  cursor: pointer;
}
.color-button-list-inline { display: flex; flex-direction: column; gap: 6px; }
.color-button-item-inline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 8px;
  background: var(--surface-secondary, var(--bg-secondary));
  border-radius: var(--radius-md);
  border: 1px solid var(--surface-border);
}
.item-info-inline { display: flex; gap: 8px; flex: 1; min-width: 0; }
.item-color-inline {
  width: 18px; height: 18px;
  border-radius: 4px;
  border: 1px solid rgba(0,0,0,0.12);
  flex-shrink: 0;
  margin-top: 2px;
}
.item-details-inline { min-width: 0; }
.item-name-inline { font-weight: 600; font-size: 13px; color: var(--text-primary); }
.item-description-inline { font-size: 11px; color: var(--text-tertiary); }
.item-meta-inline { display: flex; gap: 8px; font-size: 11px; color: var(--text-tertiary); }
.item-color-code-inline { font-family: monospace; }
.item-actions-inline { display: flex; gap: 4px; }
.icon-btn-inline {
  padding: 4px 6px;
  font-size: 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--surface-border);
}

.empty-state-inline {
  text-align: center;
  color: var(--text-tertiary);
  font-style: italic;
  font-size: var(--text-xs);
  padding: 8px;
}

.context-menu-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  padding-top: var(--space-2);
  border-top: 1px solid var(--surface-border);
}
.context-menu-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal), box-shadow var(--transition-normal), border-color var(--transition-normal);
  min-height: 36px;
  border: 1px solid transparent;
}
.context-menu-btn.btn-primary {
  background: var(--color-primary-500);
  color: #ffffff;
  border-color: var(--color-primary-600);
}
.context-menu-btn.btn-primary:hover {
  background: var(--color-primary-600);
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.25);
}
.context-menu-btn.btn-secondary {
  background: transparent;
  color: var(--text-secondary);
  border-color: var(--surface-border);
}
.context-menu-btn.btn-secondary:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
  border-color: var(--surface-border-strong);
}
.context-menu-btn.btn-danger {
  background: var(--color-error-500);
  color: #ffffff;
  border-color: var(--color-error-600);
}
.context-menu-btn.btn-danger:hover {
  background: var(--color-error-600);
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.25);
}

@media (max-width: 600px) {
  .context-menu-overlay {
    padding: 0;
    align-items: flex-end;
  }
  .context-menu {
    min-width: 0;
    width: 100%;
    max-height: 88vh;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    animation: mp-sheet 200ms cubic-bezier(0.25, 0.8, 0.35, 1);
  }
  @keyframes mp-sheet { from { transform: translateY(100%); } to { transform: translateY(0); } }
}

@media (prefers-reduced-motion: reduce) {
  .context-menu,
  .context-menu-overlay { animation: none; }
}
</style>
