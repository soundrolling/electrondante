<template>
  <!-- Backdrop intentionally does NOT close on click: this is a data-entry form,
       so we avoid accidental dismissal (e.g. selecting text in a field and
       releasing the mouse on the backdrop). Close only via × or Cancel. -->
  <div class="modal-overlay">
    <div class="modal-content venue-sources-config">
      <div class="modal-header">
        <h3>Configure Venue Sources</h3>
        <button @click="close" class="close-btn" aria-label="Close">×</button>
      </div>

      <div class="modal-body">
        <!-- Source Types Management -->
        <section class="source-types-section">
          <div class="section-header">
            <h4 class="section-title">Source Types</h4>
            <button @click="addSourceType" class="btn btn-secondary btn-sm">
              <span aria-hidden="true">+</span> Add Source Type
            </button>
          </div>

          <div v-if="sourceTypes.length === 0" class="empty-state">
            No source types yet — add one to get started.
          </div>

          <div
            v-for="(typeConfig, index) in sourceTypes"
            :key="index"
            class="source-type-card"
          >
            <div class="source-type-header">
              <div class="field">
                <label class="field-label">Name</label>
                <input
                  v-model="typeConfig.name"
                  class="field-input source-type-name"
                  placeholder="e.g., DJ, Program"
                  @blur="saveSourceType(index)"
                />
              </div>
              <div class="field">
                <label class="field-label">Numbering</label>
                <select
                  v-model="typeConfig.numberingStyle"
                  class="field-input"
                  @change="saveSourceType(index)"
                >
                  <option value="letters">Letters (A, B, C…)</option>
                  <option value="numbers">Numbers (1, 2, 3…)</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">Channels</label>
                <select
                  v-model="typeConfig.channels"
                  class="field-input"
                  @change="saveSourceType(index)"
                >
                  <option :value="1">Mono</option>
                  <option :value="2">Stereo (L/R)</option>
                </select>
              </div>
              <button
                @click="removeSourceType(index)"
                class="icon-btn icon-btn-danger"
                title="Remove source type"
                aria-label="Remove source type"
              >×</button>
            </div>

            <!-- Feeds for this source type -->
            <div class="feeds-section">
              <div class="feeds-header">
                <span class="feeds-label">Feeds</span>
                <button @click="addFeed(index)" class="btn btn-secondary btn-xs">
                  <span aria-hidden="true">+</span> Add Feed
                </button>
              </div>
              <div class="feeds-list">
                <div
                  v-for="(feed, feedIndex) in typeConfig.feeds"
                  :key="feedIndex"
                  class="feed-item"
                >
                  <input
                    v-model="feed.identifier"
                    class="field-input feed-identifier"
                    :placeholder="typeConfig.numberingStyle === 'letters' ? 'A' : '1'"
                    @blur="updateFeeds(index)"
                  />
                  <span class="feed-channels">
                    <template v-if="typeConfig.channels === 2">
                      {{ feed.identifier || '—' }} L
                      <span class="feed-sep">/</span>
                      {{ feed.identifier || '—' }} R
                    </template>
                    <template v-else>{{ feed.identifier || '—' }}</template>
                  </span>
                  <button
                    @click="removeFeed(index, feedIndex)"
                    class="icon-btn icon-btn-danger icon-btn-sm"
                    title="Remove feed"
                    aria-label="Remove feed"
                  >×</button>
                </div>
                <div v-if="typeConfig.feeds.length === 0" class="empty-feeds">
                  No feeds — add one above.
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Preview -->
        <section class="preview-section">
          <div class="section-header">
            <h4 class="section-title">Port Preview</h4>
            <span class="total-ports-pill">
              {{ totalPorts }} {{ totalPorts === 1 ? 'port' : 'ports' }}
            </span>
          </div>
          <div class="port-preview">
            <div
              v-if="portPreview.length === 0"
              class="empty-state empty-state-inset"
            >
              Add a source type with feeds to preview ports.
            </div>
            <div
              v-for="(port, idx) in portPreview"
              :key="idx"
              class="port-preview-item"
            >
              <span class="port-number">Port {{ port.portNumber }}</span>
              <span class="port-label">{{ port.label }}</span>
            </div>
          </div>
        </section>
      </div>

      <div class="modal-footer">
        <button @click="close" class="btn btn-secondary">Cancel</button>
        <button
          @click="save"
          class="btn btn-primary"
          :disabled="loading"
        >
          {{ loading ? 'Saving…' : 'Save Configuration' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '@/supabase'
import { useToast } from 'vue-toastification'
import { propagateVenueSourceNameChanges } from '@/services/signalMapperService'

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
          // Mono by default. A stereo feed is stored as two rows (channel 1 = L,
          // channel 2 = R), so detect stereo from the presence of a channel-2 row
          // rather than from whichever row happens to load first (the L/channel-1
          // row sorts first by port_number and would otherwise read as Mono).
          channels: 1,
          feeds: []
        }
      }

      // Any channel-2 row means this source type is stereo
      if (Number(feed.channel) === 2) {
        grouped[feed.source_type].channels = 2
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
    
    // Propagate name changes to downstream transformers and recorders
    try {
      // Get the node's location_id for proper propagation
      const { data: nodeData } = await supabase
        .from('nodes')
        .select('location_id')
        .eq('id', props.nodeId)
        .single()
      
      const locationId = nodeData?.location_id || null
      await propagateVenueSourceNameChanges(props.nodeId, props.projectId, locationId)
    } catch (propagateError) {
      console.error('Error propagating venue source name changes:', propagateError)
      // Don't fail the save if propagation fails
    }
    
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
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1050;
  padding: var(--space-4, 16px);
  animation: vsc-fade 140ms ease-out;
}

@keyframes vsc-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg, 12px);
  box-shadow: var(--shadow-xl, 0 20px 60px rgba(0, 0, 0, 0.3));
  display: flex;
  flex-direction: column;
  width: 100%;
  animation: vsc-pop 180ms cubic-bezier(0.25, 0.8, 0.35, 1);
}

@keyframes vsc-pop {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.venue-sources-config {
  max-width: 820px;
  max-height: 90vh;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3, 12px);
  padding: var(--space-5, 20px) var(--space-6, 24px);
  border-bottom: 1px solid var(--border-light);
}

.modal-header h3 {
  margin: 0;
  font-size: var(--text-xl, 1.25rem);
  font-weight: var(--font-semibold, 600);
  color: var(--text-heading, var(--text-primary));
  line-height: 1.3;
}

.close-btn {
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md, 8px);
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  line-height: 1;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.close-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.modal-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: var(--space-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--space-6, 24px);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3, 12px);
  padding: var(--space-5, 20px) var(--space-6, 24px);
  border-top: 1px solid var(--border-light);
  background: var(--bg-secondary);
  border-bottom-left-radius: var(--radius-lg, 12px);
  border-bottom-right-radius: var(--radius-lg, 12px);
}

/* Buttons in the footer/header inherit global .btn / .btn-primary /
   .btn-secondary styles from index.css. Make compact variants here. */
.btn-sm {
  min-height: 36px;
  padding: var(--space-2, 8px) var(--space-4, 16px);
  font-size: var(--text-sm, 0.875rem);
  border-radius: var(--radius-md, 8px);
}

.btn-xs {
  min-height: 30px;
  min-width: 0;
  padding: var(--space-1, 4px) var(--space-3, 12px);
  font-size: var(--text-xs, 0.8125rem);
  border-radius: var(--radius-md, 6px);
}

/* Sections */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3, 12px);
  margin-bottom: var(--space-4, 16px);
}

.section-title {
  margin: 0;
  font-size: var(--text-base, 0.95rem);
  font-weight: var(--font-semibold, 600);
  color: var(--text-heading, var(--text-primary));
  letter-spacing: 0.01em;
}

/* Source type card */
.source-type-card {
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg, 10px);
  padding: var(--space-4, 16px);
  margin-bottom: var(--space-3, 12px);
  background: var(--bg-primary);
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(15, 23, 42, 0.04));
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.source-type-card:hover {
  border-color: var(--border-medium);
}

.source-type-header {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: var(--space-3, 12px);
  align-items: end;
  margin-bottom: var(--space-4, 16px);
  padding-bottom: var(--space-4, 16px);
  border-bottom: 1px dashed var(--border-light);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 4px);
  min-width: 0;
}

.field-label {
  font-size: var(--text-xs, 0.75rem);
  font-weight: var(--font-medium, 500);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}

/* Compact field input — overrides the global 44px min-height that's
   meant for full-width forms. */
.field-input {
  min-height: 36px;
  padding: var(--space-2, 8px) var(--space-3, 12px);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md, 6px);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--text-sm, 0.9rem);
  box-shadow: var(--shadow-sm, none);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  width: 100%;
}

.field-input:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15);
}

/* Feeds */
.feeds-section {
  padding-left: 0;
}

.feeds-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3, 12px);
}

.feeds-label {
  font-size: var(--text-xs, 0.75rem);
  font-weight: var(--font-medium, 500);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}

.feeds-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.feed-item {
  display: flex;
  gap: var(--space-3, 12px);
  align-items: center;
  padding: var(--space-2, 8px) var(--space-3, 12px);
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md, 6px);
}

.feed-identifier {
  width: 72px;
  min-height: 32px;
  flex: 0 0 auto;
  text-align: center;
  font-weight: var(--font-medium, 500);
}

.feed-channels {
  flex: 1;
  color: var(--text-secondary);
  font-size: var(--text-sm, 0.875rem);
}

.feed-sep {
  color: var(--text-tertiary, var(--text-secondary));
  margin: 0 var(--space-1, 4px);
}

.empty-feeds {
  padding: var(--space-3, 12px);
  text-align: center;
  color: var(--text-secondary);
  font-size: var(--text-sm, 0.875rem);
  background: var(--bg-secondary);
  border: 1px dashed var(--border-light);
  border-radius: var(--radius-md, 6px);
}

.empty-state {
  padding: var(--space-5, 20px);
  text-align: center;
  color: var(--text-secondary);
  font-size: var(--text-sm, 0.9rem);
  background: var(--bg-secondary);
  border: 1px dashed var(--border-light);
  border-radius: var(--radius-md, 8px);
}

.empty-state-inset {
  background: transparent;
  border: none;
  padding: var(--space-4, 16px);
}

/* Icon buttons (× delete) */
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md, 6px);
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  padding: 0;
}

.icon-btn-sm {
  width: 28px;
  height: 28px;
  font-size: 1.05rem;
  border-radius: var(--radius-sm, 4px);
}

.icon-btn-danger {
  color: var(--color-error-600, #dc2626);
  background: var(--color-error-50, #fef2f2);
  border-color: var(--color-error-100, #fee2e2);
}

.icon-btn-danger:hover {
  color: var(--text-inverse, #ffffff);
  background: var(--color-error-500, #ef4444);
  border-color: var(--color-error-500, #ef4444);
}

/* Port preview */
.preview-section {
  border-top: 1px solid var(--border-light);
  padding-top: var(--space-5, 20px);
}

.total-ports-pill {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1, 4px) var(--space-3, 12px);
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 999px;
  font-size: var(--text-xs, 0.75rem);
  font-weight: var(--font-medium, 500);
  color: var(--text-secondary);
}

.port-preview {
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md, 8px);
  background: var(--bg-primary);
}

.port-preview-item {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: var(--space-3, 12px);
  align-items: center;
  padding: var(--space-2, 8px) var(--space-4, 16px);
  border-bottom: 1px solid var(--border-light);
  font-size: var(--text-sm, 0.875rem);
}

.port-preview-item:last-child {
  border-bottom: none;
}

.port-number {
  font-weight: var(--font-semibold, 600);
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.port-label {
  color: var(--text-primary);
}

@media (max-width: 640px) {
  .modal-body {
    padding: var(--space-4, 16px);
    gap: var(--space-4, 16px);
  }
  .modal-header,
  .modal-footer {
    padding: var(--space-4, 16px);
  }
  .source-type-header {
    grid-template-columns: 1fr auto;
    gap: var(--space-2, 8px);
  }
  .source-type-header .field:nth-child(2),
  .source-type-header .field:nth-child(3) {
    grid-column: span 1;
  }
}
</style>

