<template>
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>{{ selectedMicForOrientation ? 'Select Orientation' : 'Select Microphone' }}</h3>
        <button @click="$emit('close')" class="close-btn">×</button>
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
              @click="$emit('select-mic-for-orientation', mic)"
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
              :value="trackNameInput"
              @input="$emit('update:track-name-input', $event.target.value)"
              :placeholder="selectedMicForOrientation.gear_name"
              class="track-name-input-field"
            />
          </div>
          <div class="orientation-picker-label">Choose initial orientation:</div>
          <div class="orientation-grid">
            <template v-for="(angle, index) in [315, 0, 45, 270, null, 90, 225, 180, 135]" :key="index">
              <button
                v-if="angle !== null"
                @click="$emit('update:selected-orientation', angle)"
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
            </template>
          </div>
          <div class="orientation-actions">
            <button @click="$emit('place-mic')" :disabled="!trackNameInput.trim() || selectedOrientation === null" class="btn btn-primary">Place Mic</button>
            <button @click="$emit('cancel-orientation')" class="btn btn-secondary">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  show: { type: Boolean, default: false },
  selectedMicForOrientation: { type: Object, default: null },
  trackNameInput: { type: String, default: '' },
  selectedOrientation: { type: Number, default: null },
  availableMics: { type: Array, default: () => [] },
  getAvailableCount: { type: Function, required: true }
})

defineEmits([
  'close',
  'select-mic-for-orientation',
  'update:track-name-input',
  'update:selected-orientation',
  'place-mic',
  'cancel-orientation'
])
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.55);
  z-index: var(--z-modal-backdrop);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  animation: mp-fade 140ms ease-out;
}
@keyframes mp-fade { from { opacity: 0; } to { opacity: 1; } }
.modal-content {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  max-width: 640px;
  width: 100%;
  max-height: 80vh;
  overflow: hidden;
  color: var(--text-primary);
  animation: mp-pop 180ms cubic-bezier(0.25, 0.8, 0.35, 1);
}
@keyframes mp-pop { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-primary);
}
.modal-header h3 { margin: 0; font-size: 18px; color: var(--text-primary); }
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
.close-btn:hover { background: var(--bg-secondary); }
.modal-body {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.gear-list { display: grid; gap: 12px; }
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
.gear-item:hover { background: var(--bg-secondary); border-color: #007bff; }
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
.gear-info { flex: 1; }
.gear-name { font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
.gear-details { font-size: 12px; color: var(--text-secondary); }
.no-gear { text-align: center; padding: 40px; color: var(--text-secondary); }

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
.gear-icon-large { font-size: 48px; }
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
.orientation-arrow:hover { transform: scale(1.05); border-color: #333; }
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
.orientation-arrow svg { display: block; }
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

.btn { padding: 10px 16px; border-radius: 6px; border: 1px solid transparent; cursor: pointer; font-weight: 500; }
.btn-primary {
  background: var(--color-primary-500);
  color: white;
  border-color: var(--color-primary-600);
}
.btn-primary:hover { background: var(--color-primary-600); }
.btn-primary:disabled {
  background: var(--color-secondary-400);
  cursor: not-allowed;
  opacity: 0.6;
}
.btn-secondary {
  background: var(--color-secondary-500);
  color: white;
  border-color: var(--color-secondary-600);
}
.btn-secondary:hover { background: var(--color-secondary-600); }

@media (prefers-reduced-motion: reduce) {
  .modal-content, .modal-overlay { animation: none; }
}
</style>
