<template>
<div class="dante-config-container">
  <header class="dc-head">
    <div class="dc-head-title">
      <h2 class="dc-title">Setup Files</h2>
      <p class="dc-subtitle">Store Dante and stagebox configs for future shows or show-reset</p>
    </div>
    <div class="dc-counts" v-if="configurations.length > 0">
      <span class="dc-count">
        <span class="dc-count-value">{{ configurations.length }}</span>
        <span class="dc-count-label">saved</span>
      </span>
    </div>
  </header>

  <!-- Search + filter toolbar (only when there's something to filter) -->
  <div v-if="configurations.length > 0" class="dc-toolbar">
    <div class="dc-search">
      <Search :size="16" :stroke-width="2" class="dc-search-icon" />
      <input
        v-model="configFilter"
        placeholder="Search configs, locations, filenames…"
        class="dc-search-input"
        type="search"
      />
    </div>
  </div>

  <!-- Upload Section -->
  <section class="dc-card">
    <div class="dc-card-head">
      <div class="dc-card-icon">
        <UploadCloud :size="16" :stroke-width="2" />
      </div>
      <h3 class="dc-card-title">Upload setup file</h3>
    </div>

    <div
      class="dc-dropzone"
      :class="{ 'drag-over': isDragOver, 'has-file': !!selectedFile }"
      @drop="handleFileDrop"
      @dragover.prevent="isDragOver = true"
      @dragleave="isDragOver = false"
      @click="!selectedFile && $refs.fileInput?.click()"
    >
      <input
        type="file"
        ref="fileInput"
        @change="handleFileSelect"
        accept=".json,.xml,.txt,.dante"
        style="display: none"
      />
      <template v-if="!selectedFile">
        <div class="dc-dropzone-icon">
          <FilePlus :size="22" :stroke-width="1.75" />
        </div>
        <p class="dc-dropzone-text">Drag and drop a file, or tap to select</p>
        <button @click.stop="$refs.fileInput?.click()" class="dc-primary-btn">
          <Upload :size="14" :stroke-width="2" />
          <span>Choose file</span>
        </button>
        <p class="dc-dropzone-hint">Accepts .json, .xml, .txt, .dante</p>
      </template>
      <div v-else class="dc-file-selected">
        <div class="dc-file-chip">
          <FileText :size="14" :stroke-width="2" />
          <span class="dc-file-name">{{ selectedFile.name }}</span>
        </div>
        <button @click.stop="clearFile" class="dc-icon-btn" aria-label="Remove selected file" title="Remove file">
          <X :size="14" :stroke-width="2" />
        </button>
      </div>
    </div>

    <!-- Title and description fields after file is selected -->
    <div v-if="selectedFile" class="dc-upload-form">
      <div class="dc-form-group">
        <label class="dc-label">Title *</label>
        <input
          v-model="uploadForm.title"
          type="text"
          class="dc-input"
          placeholder="e.g. Main Stage Dante setup"
          required
        />
      </div>
      <div class="dc-form-group">
        <label class="dc-label">Description</label>
        <textarea
          v-model="uploadForm.description"
          class="dc-input"
          rows="3"
          placeholder="Optional — what scenes, what gear, what venue…"
        />
      </div>
      <div class="dc-form-actions">
        <button @click="clearFile" class="dc-ghost-btn">Cancel</button>
        <button @click="handleUpload" class="dc-primary-btn" :disabled="!uploadForm.title || uploading">
          <Upload :size="14" :stroke-width="2" />
          <span>{{ uploading ? 'Uploading…' : 'Upload' }}</span>
        </button>
      </div>
    </div>

    <div v-if="fileContent && !selectedFile" class="dc-preview">
      <h5 class="dc-preview-title">Preview</h5>
      <pre class="dc-preview-body">{{ filePreview }}</pre>
    </div>
  </section>

  <!-- Saved Configurations -->
  <section class="dc-card">
    <div class="dc-card-head">
      <div class="dc-card-icon">
        <Save :size="16" :stroke-width="2" />
      </div>
      <h3 class="dc-card-title">Saved configurations</h3>
    </div>

    <div v-if="loading" class="dc-state loading">
      <RefreshCw :size="20" :stroke-width="2" class="dc-state-icon spinning" />
      <p>Loading…</p>
    </div>
    <div v-else-if="configurations.length === 0" class="dc-state empty">
      <div class="dc-state-icon-bg">
        <Save :size="22" :stroke-width="1.5" />
      </div>
      <p class="dc-state-title">No saved configurations yet</p>
      <p class="dc-state-hint">Upload a Dante file above and you'll see it here.</p>
    </div>
    <div v-else-if="filteredConfigurations.length === 0" class="dc-state empty">
      <div class="dc-state-icon-bg">
        <Search :size="22" :stroke-width="1.5" />
      </div>
      <p class="dc-state-title">No configs match your search</p>
      <p class="dc-state-hint">Try a different term or clear the search.</p>
    </div>

    <ul v-else class="dc-config-list">
      <li
        v-for="config in filteredConfigurations"
        :key="config.id"
        class="dc-config-row"
      >
        <div class="dc-config-icon">
          <FileText :size="18" :stroke-width="2" />
        </div>
        <div class="dc-config-body">
          <div class="dc-config-top">
            <span class="dc-config-name">{{ config.name }}</span>
            <span class="dc-config-time">
              <Clock :size="11" :stroke-width="2" />
              {{ formatDate(config.updated_at) }}
            </span>
          </div>
          <p v-if="config.description" class="dc-config-desc">{{ config.description }}</p>
          <div class="dc-config-meta">
            <span v-if="config.file_name" class="dc-config-chip">
              <FileText :size="11" :stroke-width="2" />
              {{ config.file_name }}
            </span>
            <span v-if="config.location_id" class="dc-config-chip">
              <MapPin :size="11" :stroke-width="2" />
              {{ getLocationName(config.location_id) }}
            </span>
          </div>
        </div>
        <div class="dc-config-actions">
          <button @click="downloadConfiguration(config)" class="dc-icon-btn" title="Download" aria-label="Download">
            <Download :size="16" :stroke-width="2" />
          </button>
          <button @click="editConfiguration(config)" class="dc-icon-btn" title="Edit" aria-label="Edit">
            <Pencil :size="16" :stroke-width="2" />
          </button>
          <button @click="deleteConfiguration(config.id)" class="dc-icon-btn danger" title="Delete" aria-label="Delete">
            <Trash2 :size="16" :stroke-width="2" />
          </button>
        </div>
      </li>
    </ul>
  </section>

  <!-- Save Configuration Modal -->
  <div v-if="showSaveModal" class="modal-overlay" @click="showSaveModal = false">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h4>Save Configuration</h4>
        <button @click="showSaveModal = false" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Configuration Name *</label>
          <input 
            v-model="saveForm.name" 
            type="text" 
            class="input" 
            placeholder="e.g., Main Stage Dante Setup"
            required
          />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea 
            v-model="saveForm.description" 
            class="input" 
            rows="3"
            placeholder="Optional description of this configuration"
          />
        </div>
        <div class="form-group">
          <label>Save for Location</label>
          <select v-model="saveForm.location_id" class="input">
            <option :value="null">All Locations</option>
            <option v-for="loc in availableLocations" :key="loc.id" :value="loc.id">
              {{ loc.venue_name }} – {{ loc.stage_name }}
            </option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button @click="showSaveModal = false" class="btn-secondary">Cancel</button>
        <button @click="saveConfiguration" class="btn-primary" :disabled="!saveForm.name || saving">
          {{ saving ? 'Saving...' : 'Save Configuration' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Edit Configuration Modal -->
  <div v-if="editingConfig" class="modal-overlay" @click="editingConfig = null">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h4>Edit Configuration</h4>
        <button @click="editingConfig = null" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Configuration Name *</label>
          <input 
            v-model="editForm.name" 
            type="text" 
            class="input" 
            required
          />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea 
            v-model="editForm.description" 
            class="input" 
            rows="3"
          />
        </div>
        <div class="form-group">
          <label>Save for Location</label>
          <select v-model="editForm.location_id" class="input">
            <option :value="null">All Locations</option>
            <option v-for="loc in availableLocations" :key="loc.id" :value="loc.id">
              {{ loc.venue_name }} – {{ loc.stage_name }}
            </option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button @click="editingConfig = null" class="btn-secondary">Cancel</button>
        <button @click="updateConfiguration" class="btn-primary" :disabled="!editForm.name || saving">
          {{ saving ? 'Updating...' : 'Update Configuration' }}
        </button>
      </div>
    </div>
  </div>
</div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { supabase } from '@/supabase'
import {
  Search,
  UploadCloud,
  Upload,
  FilePlus,
  FileText,
  Save,
  RefreshCw,
  X,
  Clock,
  MapPin,
  Download,
  Pencil,
  Trash2,
} from 'lucide-vue-next'

const props = defineProps({
  projectId: { type: [String, Number], required: true },
  locationId: { type: [String, Number], default: null }
})

const toast = useToast()
const fileInput = ref(null)
const selectedFile = ref(null)
const fileContent = ref(null)
const fileType = ref(null)
const configurations = ref([])
const loading = ref(false)
const saving = ref(false)
const uploading = ref(false)
const isDragOver = ref(false)
const showSaveModal = ref(false)
const editingConfig = ref(null)
const availableLocations = ref([])
const configFilter = ref('')

const filteredConfigurations = computed(() => {
  const q = configFilter.value.trim().toLowerCase()
  if (!q) return configurations.value
  return configurations.value.filter(c => {
    const loc = c.location_id ? getLocationName(c.location_id) : ''
    const fields = [c.name, c.description, c.file_name, loc]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return fields.includes(q)
  })
})

const uploadForm = ref({
  title: '',
  description: ''
})

const saveForm = ref({
  name: '',
  description: '',
  location_id: null
})

const editForm = ref({
  name: '',
  description: '',
  location_id: null
})

const filePreview = computed(() => {
  if (!fileContent.value) return ''
  // Show first 500 characters as preview
  const content = typeof fileContent.value === 'string' 
    ? fileContent.value 
    : JSON.stringify(fileContent.value, null, 2)
  return content.length > 500 ? content.substring(0, 500) + '...' : content
})

function handleFileDrop(event) {
  isDragOver.value = false
  event.preventDefault()
  const file = event.dataTransfer.files[0]
  if (file) {
    processFile(file)
  }
}

async function handleFileSelect(event) {
  const file = event.target.files[0]
  if (file) {
    processFile(file)
  }
}

function processFile(file) {
  selectedFile.value = file
  
  // Determine file type
  const fileName = file.name.toLowerCase()
  if (fileName.endsWith('.json')) {
    fileType.value = 'json'
  } else if (fileName.endsWith('.xml')) {
    fileType.value = 'xml'
  } else {
    fileType.value = 'txt'
  }

  // Pre-fill title with filename (without extension)
  uploadForm.value = {
    title: file.name.replace(/\.[^/.]+$/, ''),
    description: ''
  }

  // Read file content
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const content = e.target.result
      if (fileType.value === 'json') {
        fileContent.value = JSON.parse(content)
      } else {
        fileContent.value = content
      }
    } catch (err) {
      console.error('Error reading file:', err)
      toast.error('Failed to read file. Please check the file format.')
      clearFile()
    }
  }
  reader.readAsText(file)
}

function clearFile() {
  selectedFile.value = null
  fileContent.value = null
  fileType.value = null
  uploadForm.value = {
    title: '',
    description: ''
  }
  if (fileInput.value) fileInput.value.value = ''
}

async function handleUpload() {
  if (!uploadForm.value.title || !fileContent.value) {
    toast.error('Please provide a title and select a file')
    return
  }

  uploading.value = true
  try {
    // Try to parse stagebox settings from file content
    let stageboxSettings = null
    let deviceInfo = null

    if (fileType.value === 'json' && typeof fileContent.value === 'object') {
      // Extract stagebox settings if present
      stageboxSettings = fileContent.value.stagebox || fileContent.value.settings || fileContent.value
      deviceInfo = fileContent.value.device || fileContent.value.deviceInfo
    }

    const { data, error } = await supabase
      .from('dante_configurations')
      .insert([{
        project_id: props.projectId,
        location_id: props.locationId || null,
        name: uploadForm.value.title,
        description: uploadForm.value.description || null,
        file_name: selectedFile.value?.name || null,
        file_content: typeof fileContent.value === 'string' 
          ? fileContent.value 
          : JSON.stringify(fileContent.value, null, 2),
        file_type: fileType.value,
        stagebox_settings: stageboxSettings,
        device_info: deviceInfo
      }])
      .select()
      .single()

    if (error) throw error

    toast.success('Setup file uploaded successfully')
    clearFile()
    await loadConfigurations()
  } catch (err) {
    console.error('Error uploading file:', err)
    toast.error('Failed to upload setup file')
  } finally {
    uploading.value = false
  }
}

async function saveConfiguration() {
  if (!saveForm.value.name || !fileContent.value) {
    toast.error('Please provide a name and file content')
    return
  }

  saving.value = true
  try {
    // Try to parse stagebox settings from file content
    let stageboxSettings = null
    let deviceInfo = null

    if (fileType.value === 'json' && typeof fileContent.value === 'object') {
      // Extract stagebox settings if present
      stageboxSettings = fileContent.value.stagebox || fileContent.value.settings || fileContent.value
      deviceInfo = fileContent.value.device || fileContent.value.deviceInfo
    }

    const { data, error } = await supabase
      .from('dante_configurations')
      .insert([{
        project_id: props.projectId,
        location_id: saveForm.value.location_id,
        name: saveForm.value.name,
        description: saveForm.value.description || null,
        file_name: selectedFile.value?.name || null,
        file_content: typeof fileContent.value === 'string' 
          ? fileContent.value 
          : JSON.stringify(fileContent.value, null, 2),
        file_type: fileType.value,
        stagebox_settings: stageboxSettings,
        device_info: deviceInfo
      }])
      .select()
      .single()

    if (error) throw error

    toast.success('Configuration saved successfully')
    showSaveModal.value = false
    selectedFile.value = null
    fileContent.value = null
    fileType.value = null
    if (fileInput.value) fileInput.value.value = ''
    
    await loadConfigurations()
  } catch (err) {
    console.error('Error saving configuration:', err)
    toast.error('Failed to save configuration')
  } finally {
    saving.value = false
  }
}

async function loadConfigurations() {
  loading.value = true
  try {
    let query = supabase
      .from('dante_configurations')
      .select('*')
      .eq('project_id', props.projectId)
      .order('updated_at', { ascending: false })

    // Optionally filter by location
    if (props.locationId) {
      query = query.or(`location_id.is.null,location_id.eq.${props.locationId}`)
    }

    const { data, error } = await query

    if (error) throw error
    configurations.value = data || []
  } catch (err) {
    console.error('Error loading configurations:', err)
    toast.error('Failed to load configurations')
  } finally {
    loading.value = false
  }
}

function downloadConfiguration(config) {
  try {
    // Get file content
    let content = config.file_content
    let mimeType = 'text/plain'
    let fileExtension = '.txt'
    
    // Determine MIME type and extension based on file type
    if (config.file_type === 'json') {
      mimeType = 'application/json'
      fileExtension = '.json'
      // Ensure content is properly formatted JSON
      try {
        const parsed = JSON.parse(content)
        content = JSON.stringify(parsed, null, 2)
      } catch {
        // If not valid JSON, use as-is
      }
    } else if (config.file_type === 'xml') {
      mimeType = 'application/xml'
      fileExtension = '.xml'
    }
    
    // Create blob and download
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = config.file_name || `${config.name}${fileExtension}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    toast.success(`Downloaded: ${config.name}`)
  } catch (err) {
    console.error('Error downloading configuration:', err)
    toast.error('Failed to download configuration')
  }
}

function editConfiguration(config) {
  editingConfig.value = config
  editForm.value = {
    name: config.name,
    description: config.description || '',
    location_id: config.location_id
  }
}

async function updateConfiguration() {
  if (!editForm.value.name) {
    toast.error('Please provide a name')
    return
  }

  saving.value = true
  try {
    const { error } = await supabase
      .from('dante_configurations')
      .update({
        name: editForm.value.name,
        description: editForm.value.description || null,
        location_id: editForm.value.location_id
      })
      .eq('id', editingConfig.value.id)

    if (error) throw error

    toast.success('Configuration updated successfully')
    editingConfig.value = null
    await loadConfigurations()
  } catch (err) {
    console.error('Error updating configuration:', err)
    toast.error('Failed to update configuration')
  } finally {
    saving.value = false
  }
}

async function deleteConfiguration(id) {
  if (!confirm('Are you sure you want to delete this configuration?')) {
    return
  }

  try {
    const { error } = await supabase
      .from('dante_configurations')
      .delete()
      .eq('id', id)

    if (error) throw error

    toast.success('Configuration deleted successfully')
    await loadConfigurations()
  } catch (err) {
    console.error('Error deleting configuration:', err)
    toast.error('Failed to delete configuration')
  }
}

async function loadLocations() {
  try {
    const { data, error } = await supabase
      .from('locations')
      .select('id, venue_name, stage_name')
      .eq('project_id', props.projectId)
      .order('venue_name, stage_name')

    if (error) throw error
    availableLocations.value = data || []
  } catch (err) {
    console.error('Error loading locations:', err)
  }
}

function getLocationName(locationId) {
  const loc = availableLocations.value.find(l => l.id === locationId)
  if (!loc) return 'Unknown'
  const parts = [loc.venue_name, loc.stage_name].filter(Boolean)
  return parts.join(' · ') || 'Unknown'
}

function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

onMounted(async () => {
  await loadLocations()
  await loadConfigurations()
})
</script>



<style scoped>
/* ─── Container ────────────────────────────────────────── */
.dante-config-container {
  padding: var(--space-4);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* ─── Header ───────────────────────────────────────────── */
.dc-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.dc-head-title { min-width: 0; }
.dc-title {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--text-heading);
  margin: 0;
  letter-spacing: -0.02em;
}
.dc-subtitle {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: 2px 0 0 0;
}
.dc-counts { display: flex; gap: var(--space-3); flex-shrink: 0; }
.dc-count { display: inline-flex; flex-direction: column; align-items: flex-end; line-height: 1; }
.dc-count-value {
  font-size: var(--text-base);
  font-weight: var(--font-bold);
  color: var(--color-primary-600);
  font-variant-numeric: tabular-nums;
}
.dc-count-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
  margin-top: 2px;
  font-weight: var(--font-medium);
}

/* ─── Search ───────────────────────────────────────────── */
.dc-toolbar { padding: 0; }
.dc-search { position: relative; width: 100%; }
.dc-search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  pointer-events: none;
}
.dc-search-input {
  width: 100%;
  height: 36px;
  padding: 0 12px 0 34px;
  font-size: var(--text-sm);
  background: var(--surface-card-muted);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  transition: background var(--transition-normal), border-color var(--transition-normal), box-shadow var(--transition-normal);
  -webkit-appearance: none;
  appearance: none;
}
.dc-search-input::placeholder { color: var(--text-tertiary); }
.dc-search-input:focus {
  outline: none;
  background: var(--surface-card);
  border-color: var(--color-primary-300);
  box-shadow: 0 0 0 3px var(--focus-ring);
}

/* ─── Card ─────────────────────────────────────────────── */
.dc-card {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.dc-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--surface-border);
  background: var(--surface-card-muted);
}
.dc-card-icon {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  background: var(--surface-card);
  color: var(--color-primary-600);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.dc-card-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  margin: 0;
}

/* ─── Dropzone ─────────────────────────────────────────── */
.dc-dropzone {
  margin: var(--space-4);
  padding: var(--space-6) var(--space-4);
  border: 1.5px dashed var(--surface-border-strong);
  border-radius: var(--radius-md);
  background: var(--surface-card-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  text-align: center;
  cursor: pointer;
  transition: border-color var(--transition-normal), background var(--transition-normal);
}
.dc-dropzone:hover {
  border-color: var(--color-primary-400);
  background: var(--surface-hover);
}
.dc-dropzone.drag-over {
  border-color: var(--color-primary-500);
  background: var(--color-primary-50);
}
.dc-dropzone.has-file {
  cursor: default;
  padding: var(--space-3) var(--space-4);
  flex-direction: row;
  justify-content: space-between;
}
.dc-dropzone-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-lg);
  background: var(--surface-card);
  color: var(--color-primary-600);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.dc-dropzone-text {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}
.dc-dropzone-hint {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: 0;
}

.dc-file-selected {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  justify-content: space-between;
}
.dc-file-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  min-width: 0;
}
.dc-file-chip svg { color: var(--color-primary-600); flex-shrink: 0; }
.dc-file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

/* ─── Buttons ──────────────────────────────────────────── */
.dc-primary-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  height: 36px;
  background: var(--color-primary-500);
  border: 1px solid var(--color-primary-600);
  border-radius: var(--radius-md);
  color: #ffffff;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: background var(--transition-normal), box-shadow var(--transition-normal);
}
.dc-primary-btn:hover:not(:disabled) {
  background: var(--color-primary-600);
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.25);
}
.dc-primary-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.dc-primary-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.dc-ghost-btn {
  display: inline-flex;
  align-items: center;
  padding: 0 14px;
  height: 36px;
  background: transparent;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
}
.dc-ghost-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
  border-color: var(--surface-border-strong);
}

.dc-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
  flex-shrink: 0;
}
.dc-icon-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
  border-color: var(--surface-border);
}
.dc-icon-btn.danger:hover {
  background: var(--color-error-50);
  color: var(--color-error-600);
  border-color: var(--color-error-200);
}
.dc-icon-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring);
}

/* ─── Upload form ──────────────────────────────────────── */
.dc-upload-form {
  padding: 0 var(--space-4) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.dc-form-group { display: flex; flex-direction: column; gap: 6px; }
.dc-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.dc-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: var(--surface-card);
  color: var(--text-primary);
  font-size: var(--text-sm);
  min-height: 40px;
  font-family: inherit;
}
.dc-input:focus {
  outline: none;
  border-color: var(--color-primary-400);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.dc-form-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
}

/* ─── Preview ──────────────────────────────────────────── */
.dc-preview { padding: 0 var(--space-4) var(--space-4); }
.dc-preview-title {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0 0 6px 0;
}
.dc-preview-body {
  background: var(--surface-card-muted);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  font-family: var(--font-family-mono);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  max-height: 200px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

/* ─── States ───────────────────────────────────────────── */
.dc-state {
  padding: var(--space-8) var(--space-4);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  text-align: center;
}
.dc-state-icon-bg {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-lg);
  background: var(--chip-bg);
  color: var(--text-tertiary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-2);
}
.dc-state-icon.spinning { animation: dcSpin 0.9s linear infinite; color: var(--color-primary-500); }
@keyframes dcSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.dc-state-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  margin: 0;
}
.dc-state-hint {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: 0;
  max-width: 40ch;
}
.dc-state.loading p { font-size: var(--text-sm); color: var(--text-tertiary); margin: 0; }

/* ─── Config list ──────────────────────────────────────── */
.dc-config-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.dc-config-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--surface-border);
}
.dc-config-row:last-child { border-bottom: none; }
.dc-config-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: var(--surface-card-muted);
  color: var(--color-primary-600);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.dc-config-body { flex: 1; min-width: 0; }
.dc-config-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
.dc-config-name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.dc-config-time {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.dc-config-desc {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin: 4px 0 0 0;
  line-height: 1.4;
}
.dc-config-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.dc-config-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: var(--chip-bg);
  border-radius: var(--radius-full);
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.4;
}
.dc-config-chip svg { color: var(--text-tertiary); }
.dc-config-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

/* ─── Modal (save + edit) ──────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-4);
}
.modal-content {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  max-width: 480px;
  width: 100%;
  max-height: 90vh;
  overflow: auto;
  box-shadow: var(--shadow-xl);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--surface-border);
}
.modal-header h4 {
  margin: 0;
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
}
.close-btn {
  background: none;
  border: none;
  font-size: var(--text-xl);
  cursor: pointer;
  color: var(--text-tertiary);
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
}
.close-btn:hover { background: var(--surface-hover); color: var(--text-primary); }
.modal-body {
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  background: var(--surface-card);
  color: var(--text-primary);
  font-size: var(--text-sm);
  min-height: 40px;
  font-family: inherit;
}
.input:focus {
  outline: none;
  border-color: var(--color-primary-400);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid var(--surface-border);
}
.btn-secondary {
  display: inline-flex;
  align-items: center;
  padding: 0 14px;
  height: 36px;
  background: transparent;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: background var(--transition-normal), border-color var(--transition-normal), color var(--transition-normal);
}
.btn-secondary:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
  border-color: var(--surface-border-strong);
}
.btn-primary {
  display: inline-flex;
  align-items: center;
  padding: 0 14px;
  height: 36px;
  background: var(--color-primary-500);
  border: 1px solid var(--color-primary-600);
  border-radius: var(--radius-md);
  color: #ffffff;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: background var(--transition-normal), box-shadow var(--transition-normal);
}
.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-600);
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.25);
}
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }

/* ─── Mobile ───────────────────────────────────────────── */
@media (max-width: 600px) {
  .dante-config-container { padding: var(--space-3); }
  .dc-head { flex-direction: column; align-items: stretch; }
  .dc-counts { justify-content: flex-start; }
  .dc-count { align-items: flex-start; }
  .dc-dropzone { margin: var(--space-3); padding: var(--space-4); }
  .dc-config-row { padding: var(--space-3); gap: var(--space-2); }
  .dc-config-actions { flex-direction: column; }
}

/* ─── Accessibility ────────────────────────────────────── */
@media (prefers-contrast: high) {
  .dc-card,
  .dc-dropzone,
  .dc-search-input,
  .dc-input,
  .input,
  .dc-ghost-btn,
  .dc-icon-btn:hover,
  .dc-primary-btn { border-width: 2px; }
}
@media (prefers-reduced-motion: reduce) {
  .dc-dropzone,
  .dc-icon-btn,
  .dc-primary-btn,
  .dc-ghost-btn,
  .dc-search-input,
  .btn-primary,
  .btn-secondary { transition: none; }
  .dc-state-icon.spinning { animation: none; }
}
</style>
