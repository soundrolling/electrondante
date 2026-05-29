<!--
  Combined node editor for the Cabling tab. Opened by clicking a node (mic /
  stagebox / recorder). Edits the node's height above the floor (e.g. up a
  tower) AND the cable type for each run leaving this node toward its next
  connection point. Values are entered in the current display unit; the parent
  converts + persists (height → nodes.height_m, cable types → cable_layout).
-->
<template>
  <div v-if="show" class="modal-overlay" @click="$emit('cancel')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>{{ label || 'Node' }}</h3>
        <button class="close-btn" @click="$emit('cancel')">×</button>
      </div>

      <div class="modal-body">
        <div class="form-field">
          <label>Height above floor ({{ unit }})</label>
          <input
            ref="firstInput"
            v-model="height"
            type="number"
            min="0"
            step="0.1"
            inputmode="decimal"
            placeholder="0 (ground)"
            class="ce-input"
            @keyup.enter="save"
          />
          <p class="field-hint">Leave blank for ground level. Any height adds a vertical cable run (e.g. up a tower).</p>
        </div>

        <div v-if="cableRows.length" class="cables-block">
          <label class="block-label">Cable to next point</label>
          <div v-for="row in cableRows" :key="row.connId" class="cable-row">
            <span class="cable-dest" :title="row.destLabel">→ {{ row.destLabel }}</span>
            <input
              v-model="row.type"
              list="ce-cable-types"
              placeholder="e.g. XLR, Cat5e, 12-way multicore"
              class="ce-input"
            />
          </div>
          <datalist id="ce-cable-types">
            <option v-for="t in CABLE_TYPES" :key="t" :value="t" />
          </datalist>
        </div>
        <p v-else class="field-hint">This node has no outgoing cable in the signal flow.</p>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="$emit('cancel')">Cancel</button>
        <button class="btn btn-primary" :disabled="busy" @click="save">{{ busy ? 'Saving…' : 'Save' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  label: { type: String, default: '' },
  unit: { type: String, default: 'm' },
  currentValue: { type: Number, default: null },
  // [{ connId, destLabel, type }] — outgoing runs from this node
  cables: { type: Array, default: () => [] },
})

const emit = defineEmits(['save', 'cancel'])

const CABLE_TYPES = [
  'XLR', 'Cat5e', 'Cat6', 'Cat5e (Dante)', 'AES50',
  '8-way multicore', '12-way multicore', '16-way multicore', '24-way multicore',
  'Fibre', 'Speakon',
]

const height = ref('')
const cableRows = ref([])
const firstInput = ref(null)

watch(() => props.show, (open) => {
  if (open) {
    height.value = props.currentValue != null ? String(props.currentValue) : ''
    cableRows.value = props.cables.map(c => ({ connId: c.connId, destLabel: c.destLabel, type: c.type || '' }))
    nextTick(() => firstInput.value?.focus())
  }
})

function save() {
  const raw = height.value === '' ? null : Number(height.value)
  emit('save', {
    height: Number.isFinite(raw) ? raw : null,
    cables: cableRows.value.map(r => ({ connId: r.connId, type: r.type.trim() })),
  })
}
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
  animation: ce-fade 140ms ease-out;
}
@keyframes ce-fade { from { opacity: 0; } to { opacity: 1; } }
.modal-content {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  max-width: 440px;
  width: 90%;
  padding: 24px;
  display: flex;
  flex-direction: column;
  color: var(--text-primary);
  animation: ce-pop 180ms cubic-bezier(0.25, 0.8, 0.35, 1);
}
@keyframes ce-pop { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 0 16px 0;
  border-bottom: 1px solid var(--border-light);
}
.modal-header h3 { margin: 0; font-size: 18px; color: var(--text-primary); }
.close-btn {
  background: none; border: none;
  font-size: 24px; cursor: pointer;
  color: var(--text-secondary);
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 4px;
}
.close-btn:hover { background: var(--bg-secondary); }
.modal-body { padding: 16px 0; display: flex; flex-direction: column; gap: 18px; }
.modal-footer {
  padding: 16px 0 0 0;
  border-top: 1px solid var(--border-light);
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
.form-field { display: flex; flex-direction: column; gap: 6px; }
.form-field label, .block-label { font-weight: 500; font-size: 13px; color: var(--text-primary); }
.field-hint { font-size: 11px; color: var(--text-tertiary); margin: 0; }
.cables-block { display: flex; flex-direction: column; gap: 8px; }
.cable-row { display: flex; align-items: center; gap: 10px; }
.cable-dest {
  flex: 0 0 38%;
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ce-input {
  flex: 1;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  background: var(--surface-card);
  color: var(--text-primary);
  min-height: 40px;
  font-family: inherit;
}
.btn { padding: 10px 16px; border-radius: 6px; border: 1px solid transparent; cursor: pointer; font-weight: 500; }
.btn-primary { background: var(--color-primary-500); color: #fff; border-color: var(--color-primary-600); }
.btn-primary:hover:not(:disabled) { background: var(--color-primary-600); }
.btn-primary:disabled { background: var(--color-secondary-400); cursor: not-allowed; opacity: 0.6; }
.btn-secondary { background: var(--color-secondary-500); color: #fff; border-color: var(--color-secondary-600); }
.btn-secondary:hover { background: var(--color-secondary-600); }
@media (prefers-reduced-motion: reduce) {
  .modal-content, .modal-overlay { animation: none; }
}
</style>
