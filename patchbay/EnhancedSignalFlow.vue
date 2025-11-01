<!-- src/components/patchbay/EnhancedSignalFlow.vue -->
<template>
<div class="border rounded-lg p-4 bg-white shadow-sm">
  <h3 class="text-lg font-semibold mb-3 text-gray-800 flex items-center">
    <span class="mr-2">🔗</span>
    Enhanced Signal Flow Tracking
  </h3>
  
  <div v-if="enhancedFlows.length === 0" class="text-gray-500 italic">
    No signal flows found. Add sources, transformers, and recorders to see signal flow tracking.
  </div>
  
  <div v-else class="space-y-6">
    <!-- Source-based flow view -->
    <div v-for="(flow, idx) in enhancedFlows" :key="idx" class="border rounded p-4 bg-gray-50">
      <h4 class="font-medium text-green-700 mb-3 flex items-center">
        <span class="mr-2">🎤</span>
        {{ flow.sourceLabel }}
      </h4>
      
      <div class="space-y-3">
        <div v-for="(target, j) in flow.targets" :key="j" class="border-l-2 border-blue-200 pl-4">
          <div class="flex items-center space-x-2 mb-2">
            <span class="text-gray-600">→</span>
            <span class="font-medium text-blue-700">{{ target.recorderLabel }}</span>
            <span class="text-gray-500 text-sm">(Track {{ target.track }})</span>
          </div>
          
          <!-- Transformers in the path -->
          <div v-if="target.transformers.length > 0" class="ml-4 mb-2">
            <div class="text-xs text-gray-600 mb-1">Transformers:</div>
            <div v-for="(transformer, k) in target.transformers" :key="k" class="ml-4 text-xs text-gray-500 mb-1">
              <span class="text-yellow-600">⚡</span>
              {{ transformer.label }}
              <span v-if="transformer.inputOutput" class="text-gray-400 ml-1">
                ({{ transformer.inputOutput }})
              </span>
            </div>
          </div>
          
          <!-- Full path -->
          <div v-if="target.path" class="ml-4 text-xs text-gray-500 italic">
            Full Path: {{ target.path }}
          </div>
          
          <!-- Connection details -->
          <div class="ml-4 text-xs text-gray-400 mt-1">
            Input {{ target.inputNumber || '—' }} → Output {{ target.outputNumber || '—' }}
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Summary statistics -->
  <div v-if="enhancedFlows.length > 0" class="mt-6 p-3 bg-blue-50 rounded">
    <h4 class="font-medium text-blue-800 mb-2">Signal Flow Summary</h4>
    <div class="text-sm text-blue-700 space-y-1">
      <p>• {{ totalSources }} source(s)</p>
      <p>• {{ totalRecorders }} recorder(s)</p>
      <p>• {{ totalTransformers }} transformer(s) in use</p>
      <p>• {{ totalConnections }} total signal paths</p>
    </div>
  </div>
  
  <div class="mt-4 pt-3 border-t">
    <button 
      @click="exportEnhancedSignalFlow"
      class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
    >
      Export Enhanced Signal Flow
    </button>
  </div>
</div>
</template>

<script setup>
import { computed } from 'vue'
import { usePatchBayStore } from '@/stores/patchBayStore'
import { jsPDF } from 'jspdf'

const patchBay = usePatchBayStore()

const enhancedFlows = computed(() => {
  return patchBay.getEnhancedSignalFlow()
})

const totalSources = computed(() => enhancedFlows.value.length)

const totalRecorders = computed(() => {
  const recorderIds = new Set()
  enhancedFlows.value.forEach(flow => {
    flow.targets.forEach(target => {
      recorderIds.add(target.recorderId)
    })
  })
  return recorderIds.size
})

const totalTransformers = computed(() => {
  const transformerIds = new Set()
  enhancedFlows.value.forEach(flow => {
    flow.targets.forEach(target => {
      target.transformers.forEach(transformer => {
        transformerIds.add(transformer.id)
      })
    })
  })
  return transformerIds.size
})

const totalConnections = computed(() => {
  return enhancedFlows.value.reduce((total, flow) => {
    return total + flow.targets.length
  }, 0)
})

function exportEnhancedSignalFlow() {
  if (enhancedFlows.value.length === 0) return

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  
  doc.setFontSize(20)
  doc.text('Enhanced Signal Flow Documentation', 40, 40)
  doc.setFontSize(12)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 60)
  
  let yPos = 100
  
  enhancedFlows.value.forEach((flow, index) => {
    if (yPos > pageH - 120) {
      doc.addPage()
      yPos = 40
    }
    
    // Source header
    doc.setFontSize(14)
    doc.text(`Source: ${flow.sourceLabel}`, 40, yPos)
    yPos += 25
    
    // Targets
    doc.setFontSize(10)
    flow.targets.forEach((target, j) => {
      if (yPos > pageH - 100) {
        doc.addPage()
        yPos = 40
      }
      
      // Recorder info
      doc.text(`→ ${target.recorderLabel} (Track ${target.track})`, 60, yPos)
      yPos += 20
      
      // Transformers
      if (target.transformers.length > 0) {
        doc.text('Transformers:', 80, yPos)
        yPos += 15
        
        target.transformers.forEach(transformer => {
          doc.setFontSize(8)
          const transformerText = `  • ${transformer.label}`
          doc.text(transformerText, 80, yPos)
          yPos += 15
          
          if (transformer.inputOutput) {
            doc.text(`    (${transformer.inputOutput})`, 100, yPos)
            yPos += 15
          }
        })
      }
      
      // Full path
      if (target.path) {
        doc.setFontSize(8)
        doc.text(`Path: ${target.path}`, 80, yPos)
        yPos += 15
      }
      
      yPos += 10
    })
    
    yPos += 20
  })
  
  // Add summary page
  doc.addPage()
  doc.setFontSize(16)
  doc.text('Signal Flow Summary', 40, 40)
  
  yPos = 80
  doc.setFontSize(12)
  doc.text(`Total Sources: ${totalSources.value}`, 40, yPos)
  yPos += 20
  doc.text(`Total Recorders: ${totalRecorders.value}`, 40, yPos)
  yPos += 20
  doc.text(`Total Transformers: ${totalTransformers.value}`, 40, yPos)
  yPos += 20
  doc.text(`Total Signal Paths: ${totalConnections.value}`, 40, yPos)
  
  doc.save('enhanced-signal-flow.pdf')
}
</script>

<style scoped>
/* Component-specific styles can be added here */
</style>
