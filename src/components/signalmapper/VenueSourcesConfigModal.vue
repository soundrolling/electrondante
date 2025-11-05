<template>
  <div class="modal-overlay" @click="close">
    <div class="modal-content venue-sources-config" @click.stop>
      <div class="modal-header">
        <h3>Configure Venue Sources</h3>
        <button @click="close" class="close-btn">×</button>
      </div>
      
      <div class="modal-body">
        <!-- Source Types Management -->
        <div class="source-types-section">
          <div class="section-header">
            <h4>Source Types</h4>
            <button @click="addSourceType" class="btn-add-small">+ Add Source Type</button>
          </div>
          
          <div v-for="(typeConfig, index) in sourceTypes" :key="index" class="source-type-item">
            <div class="source-type-header">
              <input 
                v-model="typeConfig.name" 
                class="source-type-name" 
                placeholder="Source Type (e.g., DJ, Program)"
                @blur="saveSourceType(index)"
              />
              <select v-model="typeConfig.numberingStyle" class="numbering-style-select" @change="saveSourceType(index)">
                <option value="letters">Letters (A, B, C...)</option>
                <option value="numbers">Numbers (1, 2, 3...)</option>
              </select>
              <select v-model="typeConfig.channels" class="channels-select" @change="saveSourceType(index)">
                <option :value="1">Mono</option>
                <option :value="2">Stereo (L/R)</option>
              </select>
              <button @click="removeSourceType(index)" class="btn-remove-small">×</button>
            </div>
            
            <!-- Feeds for this source type -->
            <div class="feeds-section">
              <div class="feeds-header">
                <span class="feeds-label">Feeds:</span>
                <button @click="addFeed(index)" class="btn-add-tiny">+ Add Feed</button>
              </div>
              <div class="feeds-list">
                <div 
                  v-for="(feed, feedIndex) in typeConfig.feeds" 
                  :key="feedIndex"
                  class="feed-item"
                >
                  <input 
                    v-model="feed.identifier" 
                    class="feed-identifier"
                    :placeholder="typeConfig.numberingStyle === 'letters' ? 'A, B, C...' : '1, 2, 3...'"
                    @blur="updateFeeds(index)"
                  />
                  <span class="feed-channels">
                    <span v-if="typeConfig.channels === 2">{{ feed.identifier }} L / {{ feed.identifier }} R</span>
                    <span v-else>{{ feed.identifier }}</span>
                  </span>
                  <button @click="removeFeed(index, feedIndex)" class="btn-remove-tiny">×</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Preview -->
        <div class="preview-section">
          <h4>Port Preview</h4>
          <div class="port-preview">
            <div v-for="(port, idx) in portPreview" :key="idx" class="port-preview-item">
              <span class="port-number">Port {{ port.portNumber }}:</span>
              <span class="port-label">{{ port.label }}</span>
            </div>
          </div>
          <div class="total-ports">
            Total Output Ports: <strong>{{ totalPorts }}</strong>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button @click="close" class="btn-cancel">Cancel</button>
        <button @click="save" class="btn-primary" :disabled="loading">Save Configuration</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '@/supabase'
import { useToast } from 'vue-toastification'

const props = defineProps({
  nodeId: { type: [String, Number], required: true },
  projectId: { type: [String, Number], required: true }
})

const emit = defineEmits(['saved', 'close'])
const toast = useToast()

const loading = ref(false)
const sourceTypes = ref([])

// Default source types
const defaultSourceTypes = [
  { name: 'DJ', numberingStyle: 'letters', channels: 2, feeds: [{ identifier: 'A' }, { identifier: 'B' }] },
  { name: 'Program', numberingStyle: 'numbers', channels: 2, feeds: [{ identifier: '1' }] }
]

// Load existing configuration
async function loadConfiguration() {
  try {
    loading.value = true
    
    // Load existing feeds from database
    const { data: feeds, error } = await supabase
      .from('venue_source_feeds')
      .select('*')
      .eq('node_id', props.nodeId)
      .order('port_number')
    
    if (error) throw error
    
    if (!feeds || feeds.length === 0) {
      // No existing feeds - use defaults
      sourceTypes.value = JSON.parse(JSON.stringify(defaultSourceTypes))
      return
    }
    
    // Group feeds by source_type
    const grouped = {}
    feeds.forEach(feed => {
      if (!grouped[feed.source_type]) {
        grouped[feed.source_type] = {
          name: feed.source_type,
          numberingStyle: feed.numbering_style || 'letters',
          channels: feed.channel === 2 ? 2 : 1,
          feeds: []
        }
      }
      
      // Find or create feed identifier
      const feedId = feed.feed_identifier
      let feedObj = grouped[feed.source_type].feeds.find(f => f.identifier === feedId)
      if (!feedObj) {
        feedObj = { identifier: feedId, ports: [] }
        grouped[feed.source_type].feeds.push(feedObj)
      }
      feedObj.ports.push(feed.port_number)
    })
    
    sourceTypes.value = Object.values(grouped)
  } catch (err) {
    console.error('Error loading configuration:', err)
    toast.error('Failed to load configuration')
    sourceTypes.value = JSON.parse(JSON.stringify(defaultSourceTypes))
  } finally {
    loading.value = false
  }
}

// Add new source type
function addSourceType() {
  sourceTypes.value.push({
    name: '',
    numberingStyle: 'letters',
    channels: 2,
    feeds: []
  })
}

// Remove source type
function removeSourceType(index) {
  sourceTypes.value.splice(index, 1)
  updateFeeds()
}

// Add feed to source type
function addFeed(typeIndex) {
  const typeConfig = sourceTypes.value[typeIndex]
  const existingIds = typeConfig.feeds.map(f => f.identifier)
  
  let newId
  if (typeConfig.numberingStyle === 'letters') {
    // Find next available letter
    for (let i = 0; i < 26; i++) {
      const letter = String.fromCharCode(65 + i) // A-Z
      if (!existingIds.includes(letter)) {
        newId = letter
        break
      }
    }
  } else {
    // Find next available number
    let num = 1
    while (existingIds.includes(String(num))) num++
    newId = String(num)
  }
  
  if (newId) {
    typeConfig.feeds.push({ identifier: newId })
    updateFeeds()
  }
}

// Remove feed
function removeFeed(typeIndex, feedIndex) {
  sourceTypes.value[typeIndex].feeds.splice(feedIndex, 1)
  updateFeeds()
}

// Save source type changes
function saveSourceType(index) {
  updateFeeds()
}

// Update all feeds (recalculate port numbers)
function updateFeeds() {
  // This will trigger portPreview recomputation
}

// Calculate port preview
const portPreview = computed(() => {
  const preview = []
  let portNumber = 1
  
  sourceTypes.value.forEach(typeConfig => {
    typeConfig.feeds.forEach(feed => {
      if (typeConfig.channels === 2) {
        // Stereo: two ports (L and R)
        preview.push({
          portNumber: portNumber++,
          label: `${typeConfig.name} ${feed.identifier} L`
        })
        preview.push({
          portNumber: portNumber++,
          label: `${typeConfig.name} ${feed.identifier} R`
        })
      } else {
        // Mono: one port
        preview.push({
          portNumber: portNumber++,
          label: `${typeConfig.name} ${feed.identifier}`
        })
      }
    })
  })
  
  return preview
})

const totalPorts = computed(() => portPreview.value.length)

// Save configuration
async function save() {
  try {
    loading.value = true
    
    // Validate
    for (const typeConfig of sourceTypes.value) {
      if (!typeConfig.name || !typeConfig.name.trim()) {
        toast.error('All source types must have a name')
        return
      }
      if (typeConfig.feeds.length === 0) {
        toast.error(`Source type "${typeConfig.name}" must have at least one feed`)
        return
      }
      // Check for duplicate feed identifiers
      const identifiers = typeConfig.feeds.map(f => f.identifier)
      if (new Set(identifiers).size !== identifiers.length) {
        toast.error(`Source type "${typeConfig.name}" has duplicate feed identifiers`)
        return
      }
    }
    
    // Delete existing feeds
    await supabase
      .from('venue_source_feeds')
      .delete()
      .eq('node_id', props.nodeId)
    
    // Insert new feeds
    const feedsToInsert = []
    let portNumber = 1
    const outputPortLabels = {}
    
    sourceTypes.value.forEach(typeConfig => {
      const sourceType = typeConfig.name.toLowerCase().replace(/\s+/g, '_')
      
      typeConfig.feeds.forEach(feed => {
        if (typeConfig.channels === 2) {
          // Stereo: create two feed entries (L and R)
          const lLabel = `${typeConfig.name} ${feed.identifier} L`
          const rLabel = `${typeConfig.name} ${feed.identifier} R`
          
          feedsToInsert.push({
            node_id: props.nodeId,
            project_id: props.projectId,
            source_type: sourceType,
            feed_identifier: feed.identifier,
            port_number: portNumber,
            channel: 1,
            numbering_style: typeConfig.numberingStyle,
            output_port_label: lLabel
          })
          outputPortLabels[String(portNumber)] = lLabel
          portNumber++
          
          feedsToInsert.push({
            node_id: props.nodeId,
            project_id: props.projectId,
            source_type: sourceType,
            feed_identifier: feed.identifier,
            port_number: portNumber,
            channel: 2,
            numbering_style: typeConfig.numberingStyle,
            output_port_label: rLabel
          })
          outputPortLabels[String(portNumber)] = rLabel
          portNumber++
        } else {
          // Mono: create one feed entry
          const label = `${typeConfig.name} ${feed.identifier}`
          
          feedsToInsert.push({
            node_id: props.nodeId,
            project_id: props.projectId,
            source_type: sourceType,
            feed_identifier: feed.identifier,
            port_number: portNumber,
            channel: 1,
            numbering_style: typeConfig.numberingStyle,
            output_port_label: label
          })
          outputPortLabels[String(portNumber)] = label
          portNumber++
        }
      })
    })
    
    if (feedsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('venue_source_feeds')
        .insert(feedsToInsert)
      
      if (insertError) throw insertError
    }
    
    // Update node with new output count and labels (authoritative mirror)
    const { error: updateError } = await supabase
      .from('nodes')
      .update({
        num_outputs: totalPorts.value,
        output_port_labels: outputPortLabels
      })
      .eq('id', props.nodeId)
    
    if (updateError) throw updateError
    
    toast.success('Venue Sources configuration saved')
    emit('saved')
    close()
  } catch (err) {
    console.error('Error saving configuration:', err)
    toast.error('Failed to save configuration: ' + (err.message || 'Unknown error'))
  } finally {
    loading.value = false
  }
}

function close() {
  emit('close')
}

onMounted(() => {
  loadConfiguration()
})
</script>

<style scoped>
.venue-sources-config {
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
}

.source-types-section {
  margin-bottom: 2rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.source-type-item {
  border: 1px solid var(--border-light);
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.source-type-header {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 1rem;
}

.source-type-name {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--border-medium);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.numbering-style-select,
.channels-select {
  padding: 0.5rem;
  border: 1px solid var(--border-medium);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.feeds-section {
  margin-left: 1rem;
}

.feeds-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.feeds-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.feed-item {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.feed-identifier {
  width: 60px;
  padding: 0.25rem;
  border: 1px solid var(--border-medium);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.feed-channels {
  flex: 1;
  color: var(--text-secondary);
  font-size: 0.9em;
}

.preview-section {
  border-top: 2px solid var(--border-light);
  padding-top: 1rem;
  margin-top: 2rem;
}

.port-preview {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border-light);
  border-radius: 4px;
  padding: 0.5rem;
  margin: 0.5rem 0;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.port-preview-item {
  display: flex;
  gap: 1rem;
  padding: 0.25rem 0;
}

.port-number {
  font-weight: bold;
  min-width: 80px;
}

.total-ports {
  margin-top: 0.5rem;
  text-align: right;
  color: var(--text-secondary);
}

.btn-add-small,
.btn-add-tiny {
  padding: 0.25rem 0.5rem;
  font-size: 0.85em;
}

.btn-remove-small,
.btn-remove-tiny {
  padding: 0.25rem 0.5rem;
  font-size: 0.85em;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-remove-tiny {
  padding: 0.15rem 0.4rem;
  font-size: 0.75em;
}
</style>

