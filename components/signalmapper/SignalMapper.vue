<template>
  <SignalMapperParent 
    :projectId="projectId" 
    :locationId="locationId" 
  />
</template>

<script setup>
import SignalMapperParent from './SignalMapperParent.vue'

const props = defineProps({
  projectId: { 
    type: [String, Number], 
    required: true 
  },
  locationId: { 
    type: [String, Number], 
    default: null 
  }
})
</script>
