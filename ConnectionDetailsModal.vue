<template>
<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @mousedown.self="$emit('cancel')">
  <div class="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col overflow-hidden">
    <div class="px-6 py-4 border-b flex items-center justify-between">
      <h2 class="text-xl font-bold text-gray-800">
        Create Connection
      </h2>
    </div>
    <div class="p-6 space-y-4">
      <div>
        <div class="mb-2 text-gray-700">
          <strong>From:</strong> {{ fromNode.label }}<br>
          <strong>To:</strong> {{ toNode.label }}
        </div>
      </div>
      <form @submit.prevent="submit">
        <div class="mb-4">
          <label class="block text-xs font-medium text-gray-600">Input # (on target)</label>
          <select v-model.number="input" class="mt-1 p-2 w-full border border-gray-300 rounded-md shadow-sm text-sm">
            <option v-for="n in toNode.numinputs" :key="n" :value="n">{{ n }}</option>
          </select>
        </div>
        <div class="mb-4">
          <label class="block text-xs font-medium text-gray-600">Output # (from source)</label>
          <select v-model.number="output" class="mt-1 p-2 w-full border border-gray-300 rounded-md shadow-sm text-sm">
            <option v-for="n in fromNode.num_outputs" :key="n" :value="n">{{ n }}</option>
          </select>
        </div>
        <div v-if="toNode.node_type === 'recorder'" class="mb-4">
          <label class="block text-xs font-medium text-gray-600">Track # (on recorder)</label>
          <select v-model.number="track" class="mt-1 p-2 w-full border border-gray-300 rounded-md shadow-sm text-sm">
            <option v-for="n in toNode.num_tracks" :key="n" :value="n">{{ n }}</option>
          </select>
        </div>
        <div class="flex space-x-2 pt-2">
          <button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm">Confirm</button>
          <button type="button" class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md text-sm" @click="$emit('cancel')">Cancel</button>
        </div>
      </form>
    </div>
  </div>
</div>
</template>

<script setup>
import { ref, watch, toRefs } from 'vue'

const props = defineProps({
fromNode: { type: Object, required: true },
toNode: { type: Object, required: true },
defaultInput: { type: Number, default: 1 },
defaultOutput: { type: Number, default: 1 },
defaultTrack: { type: Number, default: null }
})

const emit = defineEmits(['confirm', 'cancel'])

const input = ref(props.defaultInput)
const output = ref(props.defaultOutput)
const track = ref(props.defaultTrack)

watch(() => props.defaultInput, v => { input.value = v })
watch(() => props.defaultOutput, v => { output.value = v })
watch(() => props.defaultTrack, v => { track.value = v })

function submit() {
emit('confirm', {
  input_number: input.value,
  output_number: output.value,
  track_number: props.toNode.node_type === 'recorder' ? track.value : null
})
}
</script>

<style scoped>
</style> 