<template>
<teleport to="body">
  <transition name="fade">
    <div
      v-if="visible"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @mousedown.self="close"
    >
      <form
        @submit.prevent="save"
        class="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 transform transition-all"
      >
        <h2 class="text-2xl font-bold text-gray-800">
          {{ isEditing ? 'Edit Node' : 'New Node' }}
        </h2>

        <!-- ========== Node Type ========== -->
        <div>
          <label for="nodeType" class="block text-sm font-medium text-gray-700">
            Node Type
          </label>
          <select
            id="nodeType"
            v-model="nodeData.node_type"
            @change="onNodeTypeChange"
            class="mt-1 w-full input-std"
            required
          >
            <option value="" disabled>Select type</option>
            <option value="source">Source</option>
            <option value="transformer">Transformer</option>
            <option value="recorder">Recorder</option>
          </select>
        </div>

        <!-- ========== Label ========== -->
        <div>
          <label for="nodeLabel" class="block text-sm font-medium text-gray-700">
            Label
          </label>
          <input
            id="nodeLabel"
            v-model="nodeData.label"
            class="mt-1 w-full input-std"
            required
          />
        </div>

        <!-- ========== Gear selector + info ========== -->
        <div>
          <label for="nodeGear" class="block text-sm font-medium text-gray-700">
            Gear
          </label>
          <select
            id="nodeGear"
            v-model="nodeData.gear_id"
            @change="onGearChange"
            class="mt-1 w-full input-std"
          >
            <option :value="null">-- none --</option>
            <option
              v-for="g in gearListOfThisType"
              :key="g.id"
              :value="g.id"
            >
              {{ g.name }}
            </option>
          </select>

          <p v-if="selectedGear" class="text-gray-500 text-sm mt-1">
            Selected gear:
            <span class="font-medium">{{ selectedGear.name }}</span>
            — Max Inputs: {{ selectedGear.numinputs }},
            Max Outputs: {{ selectedGear.num_outputs }}
          </p>
        </div>

        <!-- ========== Inputs & Outputs ========== -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="nodeInputs" class="block text-sm font-medium text-gray-700">
              Inputs
            </label>
            <input
              id="nodeInputs"
              type="number"
              v-model.number="nodeData.numinputs"
              min="0"
              :max="selectedGear ? selectedGear.numinputs : undefined"
              class="mt-1 w-full input-std"
              :readonly="!canEditPorts"
            />
          </div>
          <div>
            <label for="nodeOutputs" class="block text-sm font-medium text-gray-700">
              Outputs
            </label>
            <input
              id="nodeOutputs"
              type="number"
              v-model.number="nodeData.num_outputs"
              min="0"
              :max="selectedGear ? selectedGear.num_outputs : undefined"
              class="mt-1 w-full input-std"
              :readonly="!canEditPorts"
            />
          </div>
        </div>

        <!-- ========== Recorder‐only Tracks ========== -->
        <div v-if="isRecorderNodeComputed">
          <label for="nodeNumTracks" class="block text-sm font-medium text-gray-700">
            Tracks
          </label>
          <input
            id="nodeNumTracks"
            type="number"
            v-model.number="nodeData.num_tracks"
            min="0"
            class="mt-1 w-full input-std"
          />
        </div>

        <!-- ========== Signal Type & Pads ========== -->
        <div>
          <label for="nodeSignalType" class="block text-sm font-medium text-gray-700">
            Signal Type
          </label>
          <input
            id="nodeSignalType"
            v-model="nodeData.signal_type"
            class="mt-1 w-full input-std"
            placeholder="e.g., Mic, Line, Dante"
          />
        </div>
        <div class="flex items-center space-x-6 text-sm text-gray-700">
          <label class="flex items-center">
            <input type="checkbox" v-model="nodeData.pad" class="checkbox-std"/>
            Pad
          </label>
          <label class="flex items-center">
            <input type="checkbox" v-model="nodeData.phantom_power" class="checkbox-std"/>
            Phantom
          </label>
          <label class="flex items-center">
            <input type="checkbox" v-model="nodeData.wireless" class="checkbox-std"/>
            Wireless
          </label>
        </div>

        <!-- ========== Actions ========== -->
        <div class="flex justify-end space-x-3 pt-2">
          <button type="button" @click="close" class="secondary-button">
            Cancel
          </button>
          <button
            v-if="isEditing"
            type="button"
            @click="del"
            class="btn-danger"
          >
            Delete
          </button>
          <button type="submit" class="primary-button" :disabled="isSaving">
            {{ saveButtonText }}
          </button>
        </div>
      </form>
    </div>
  </transition>
</teleport>
</template>

<script setup>
import { reactive, watch, computed, ref, nextTick, toRef } from 'vue';

const props = defineProps({
node:     { type: Object, default: null },
gearList: { type: Array,  default: () => [] }
});
const emit = defineEmits(['save', 'delete', 'close']);

// Make gearList reactive
const gearListRef = toRef(props, 'gearList');

// “visible” if props.node is non-null
const visible   = computed(() => props.node !== null);
const isEditing = computed(() => props.node && props.node.id != null);

// Local copy of the node:
const nodeData = reactive({
id:            null,
x:             0,
y:             0,
node_type:     'transformer',
label:         '',
gear_id:       null,       // WILL store a UUID string
numinputs:     1,
num_outputs:   1,
pad:           false,
phantom_power: false,
wireless:      false,
signal_type:   '',
num_tracks:    0,
port_map:      null
});

const allowSourceOutputConfig = ref(false);
const isSaving               = ref(false);
const saveButtonText         = ref('Save');

// Computed flags for template convenience
const isSourceNodeComputed   = computed(() => nodeData.node_type === 'source');
const isRecorderNodeComputed = computed(() => nodeData.node_type === 'recorder');

// “Selected gear” object (if nodeData.gear_id is set to a UUID)
const selectedGear = computed(() => {
return gearListRef.value.find(g => g.id === nodeData.gear_id) || null;
});

// Only show gear whose gear_type matches node_type
const gearListOfThisType = computed(() => {
if (!nodeData.node_type) return [];
return gearListRef.value.filter(g => g.gear_type === nodeData.node_type);
});

// canEditPorts = true if either:
// - It’s a source with no gear selected (full manual control), OR
// - It’s a transformer/recorder with no gear selected (manual control), OR
// - It’s a source/transformer/recorder with gear selected but you still want to lock ports to gear (so canEditPorts=false).
//
// In short: if gear_id !== null, lock the fields. Otherwise, allow editing.
const canEditPorts = computed(() => nodeData.gear_id === null);

// Watch for changes to props.node (opening the form or editing an existing node)
watch(
() => props.node,
(newNode) => {
  saveButtonText.value = 'Save';
  isSaving.value = false;

  if (newNode) {
    // Deep‐clone into nodeData
    Object.assign(nodeData, JSON.parse(JSON.stringify(newNode)));

    // Ensure numeric fields are numbers:
    nodeData.numinputs   = Number(nodeData.numinputs   ?? (nodeData.node_type === 'source' ? 0 : 1));
    nodeData.num_outputs = Number(nodeData.num_outputs ?? (nodeData.node_type === 'source' ? 1 : 1));
    nodeData.num_tracks  = Number(nodeData.num_tracks  ?? 0);

    // If it’s a source and gear_id is non-null, pull gear properties.
    if (nodeData.node_type === 'source' && nodeData.gear_id) {
      applyGearProperties(nodeData.gear_id);
    }
    // If it’s a transformer/recorder and gear_id is non-null, pull gear properties.
    if ((nodeData.node_type === 'transformer' || nodeData.node_type === 'recorder') && nodeData.gear_id) {
      applyGearProperties(nodeData.gear_id);
    }

    // If brand‐new (not editing) and ports are zero, default to 1 (for non‐source)
    if (!isEditing.value && nodeData.node_type !== 'source') {
      if (nodeData.numinputs === 0) nodeData.numinputs = 1;
      if (nodeData.num_outputs === 0) nodeData.num_outputs = 1;
    }

    // If not a recorder, clear num_tracks
    if (nodeData.node_type !== 'recorder') {
      nodeData.num_tracks = 0;
    }

    nextTick(() => {
      // Optionally focus a field
    });
  } else {
    // “New node” case: reset all to defaults
    Object.assign(nodeData, {
      id:            null,
      x:             0,
      y:             0,
      node_type:     'transformer',
      label:         '',
      gear_id:       null,
      numinputs:     1,
      num_outputs:   1,
      pad:           false,
      phantom_power: false,
      wireless:      false,
      signal_type:   '',
      num_tracks:    0,
      port_map:      null
    });
  }
},
{ immediate: true }
);

// When the user changes “Node Type”:
function onNodeTypeChange() {
if (nodeData.node_type === 'source') {
  // If switching to “source”:
  // - Let user pick gear if they want. If they do, applyGearProperties will run.
  // - If no gear chosen, default to 0/1 for ports.
  if (!nodeData.gear_id) {
    nodeData.numinputs   = 0;
    nodeData.num_outputs = allowSourceOutputConfig.value ? nodeData.num_outputs : 1;
  } else {
    // If gear was already selected, re-apply its properties:
    applyGearProperties(nodeData.gear_id);
  }
  // Always clear tracks for a source:
  nodeData.num_tracks = 0;
} else {
  // Transformer or Recorder:
  if (nodeData.gear_id) {
    applyGearProperties(nodeData.gear_id);
  } else {
    // If brand‐new (no editing) and ports are zero, default them to 1
    if (!isEditing.value && nodeData.numinputs === 0) {
      nodeData.numinputs = 1;
    }
    if (!isEditing.value && nodeData.num_outputs === 0) {
      nodeData.num_outputs = 1;
    }
  }
  // If not a recorder, force num_tracks = 0:
  if (nodeData.node_type !== 'recorder') {
    nodeData.num_tracks = 0;
  }
}
}

// When the user picks/clears the gear dropdown:
function onGearChange() {
if (nodeData.gear_id != null) {
  applyGearProperties(nodeData.gear_id);
} else {
  // Gear was cleared → allow manual editing
  if (nodeData.node_type === 'source') {
    // For a pure source (no gear), default to 0/1
    nodeData.numinputs   = 0;
    nodeData.num_outputs = allowSourceOutputConfig.value ? nodeData.num_outputs : 1;
  } else {
    // If transformer/recorder and no gear chosen:
    nodeData.numinputs   = 0;
    nodeData.num_outputs = 0;
    if (!isEditing.value) {
      nodeData.numinputs   = 1;
      nodeData.num_outputs = 1;
    }
  }
}
}

// Copy the chosen gear’s port counts into nodeData
function applyGearProperties(gearId) {
const g = gearListRef.value.find(x => x.id === gearId);
if (!g) return;

// Pull from g.numinputs (no underscore) and g.num_outputs (with underscore)
nodeData.numinputs   = Number(g.numinputs)   || 0;
nodeData.num_outputs = Number(g.num_outputs) || 0;

// If label or signal_type was empty, seed from gear
if (!nodeData.label) {
  nodeData.label = g.name;
}
if (!nodeData.signal_type) {
  nodeData.signal_type = g.gear_type || '';
}
}

// Save / submit the form:
async function save() {
isSaving.value = true;
saveButtonText.value = 'Saving...';

try {
  // Shallow clone to plain object
  const toSave = { ...nodeData };

  // Ensure numeric fields
  toSave.numinputs   = Number(toSave.numinputs)   || 0;
  toSave.num_outputs = Number(toSave.num_outputs) || 0;
  toSave.num_tracks  = toSave.node_type === 'recorder'
                     ? (Number(toSave.num_tracks) || 0)
                     : 0;

  // Emit ‘save’ with full nodeData (including full-UUID gear_id)
  emit('save', toSave);

  saveButtonText.value = 'Saved ✔';
  setTimeout(() => {
    if (visible.value) saveButtonText.value = 'Save';
  }, 1500);
} catch (err) {
  console.error('[NodeForm] save error:', err);
  saveButtonText.value = 'Save Failed';
  setTimeout(() => {
    if (visible.value) saveButtonText.value = 'Save';
  }, 2000);
} finally {
  isSaving.value = false;
}
}

function del() {
if (isEditing.value) {
  emit('delete', nodeData.id);
}
}

function close() {
emit('close');
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
opacity: 0;
}

.input-std {
@apply mt-1 w-full border-gray-300 rounded-md shadow-sm text-sm p-2
       focus:ring-blue-500 focus:border-blue-500;
}
.checkbox-std {
@apply mr-1 rounded border-gray-300 text-blue-600 shadow-sm focus:ring-blue-500;
}
.primary-button {
@apply px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed;
}
.secondary-button {
@apply px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md text-sm transition-colors;
}
.btn-danger {
@apply px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm transition-colors;
}
</style>