<!-- src/components/patchbay/SimpleLinkModal.vue -->
<template>
<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @mousedown.self="$emit('cancel')">
  <div class="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col overflow-hidden">
    <div class="px-6 py-4 border-b flex items-center justify-between">
      <h2 class="text-xl font-bold text-gray-800">
        Link Nodes
      </h2>
    </div>
    <div class="p-6 space-y-4">
      <div>
        <div class="mb-2 text-gray-700">
          <strong>From:</strong> {{ fromNode.label }}<br>
          <strong>To:</strong> {{ toNode.label }}
        </div>
      </div>
      
      <div class="text-sm text-gray-600">
        <p>This will create a simple link between the nodes.</p>
        <p class="mt-2">Port mappings can be configured later in the node details.</p>
      </div>
      
      <div class="flex space-x-2 pt-4">
        <button 
          type="button" 
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
          @click="confirmLink"
        >
          Create Link
        </button>
        <button 
          type="button" 
          class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md text-sm" 
          @click="$emit('cancel')"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</div>
</template>

<script setup>
const props = defineProps({
fromNode: { type: Object, required: true },
toNode: { type: Object, required: true }
})

const emit = defineEmits(['confirm', 'cancel'])

function confirmLink() {
emit('confirm', {
  fromNode: props.fromNode,
  toNode: props.toNode
})
}
</script>

<style scoped>
</style> 