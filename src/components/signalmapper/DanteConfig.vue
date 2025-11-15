<template>
<div class="dante-config-container">
  <div class="dante-header">
    <h3>Setup Files</h3>
    <p>Upload your Dante and stagebox setup files so you can download for future shows or with a show reset</p>
  </div>

  <!-- Upload Section -->
  <div class="dante-section">
    <h4>📤 Upload Setup Files</h4>
    <div 
      class="upload-area"
      :class="{ 'drag-over': isDragOver }"
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
      <div v-if="!selectedFile" class="upload-placeholder">
        <p>📁 Drag and drop a file here, or click to select</p>
        <button @click.stop="$refs.fileInput?.click()" class="btn-upload">
          Choose File
        </button>
      </div>
      <div v-else class="file-selected">
        <span class="file-name">📄 {{ selectedFile.name }}</span>
        <button @click.stop="clearFile" class="btn-clear">×</button>
      </div>
    </div>
    
    <!-- Title and Description Fields -->
    <div v-if="selectedFile" class="upload-form">
      <div class="form-group">
        <label>Title *</label>
        <input 
          v-model="uploadForm.title" 
          type="text" 
          class="input" 
          placeholder="e.g., Main Stage Dante Setup"
          required
        />
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea 
          v-model="uploadForm.description" 
          class="input" 
          rows="3"
          placeholder="Optional description of this setup file"
        />
      </div>
      <div class="form-actions">
        <button @click="clearFile" class="btn-secondary">Cancel</button>
        <button @click="handleUpload" class="btn-primary" :disabled="!uploadForm.title || uploading">
          {{ uploading ? 'Uploading...' : 'Upload' }}
        </button>
      </div>
    </div>
    
    <div v-if="fileContent && !selectedFile" class="file-preview">
      <h5>File Preview:</h5>
      <pre class="preview-content">{{ filePreview }}</pre>
    </div>
  </div>

  <!-- Saved Configurations -->
  <div class="dante-section">
    <h4>💾 Saved Configurations</h4>
    <div v-if="loading" class="loading-state">
      <p>Loading configurations...</p>
    </div>
    <div v-else-if="configurations.length === 0" class="no-data-state">
      <p>No saved configurations yet.</p>
      <p class="hint">Upload a Dante file and save it to get started.</p>
    </div>
    <div v-else class="configurations-list">
      <div 
        v-for="config in configurations" 
        :key="config.id" 
        class="config-card"
      >
        <div class="config-header">
          <h5>{{ config.name }}</h5>
          <div class="config-actions">
            <button @click="downloadConfiguration(config)" class="btn-download">Download</button>
            <button @click="editConfiguration(config)" class="btn-edit">Edit</button>
            <button @click="deleteConfiguration(config.id)" class="btn-delete">Delete</button>
          </div>
        </div>
        <div class="config-details">
          <p v-if="config.description" class="config-description">{{ config.description }}</p>
          <div class="config-meta">
            <span v-if="config.file_name">📄 {{ config.file_name }}</span>
            <span v-if="config.location_id">📍 {{ getLocationName(config.location_id) }}</span>
            <span>🕒 {{ formatDate(config.updated_at) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

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
  return loc ? `${loc.venue_name} – ${loc.stage_name}` : 'Unknown'
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
.dante-config-container {
  padding: 20px;
}

.dante-header {
  margin-bottom: 30px;
  text-align: center;
}

.dante-header h3 {
  margin: 0 0 10px 0;
  font-size: 24px;
  color: var(--text-primary);
}

.dante-header p {
  margin: 0;
  color: var(--text-secondary);
}

.dante-section {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid #e9ecef;
}

.dante-section h4 {
  margin: 0 0 15px 0;
  font-size: 18px;
  color: var(--text-primary);
}

.upload-area {
  border: 2px dashed #dee2e6;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 20px;
}

.upload-area:hover {
  border-color: var(--color-primary-500);
  background: rgba(37, 99, 235, 0.05);
}

.upload-area.drag-over {
  border-color: var(--color-primary-500);
  background: rgba(37, 99, 235, 0.1);
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.upload-placeholder p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.file-selected {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.file-name {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
}

.btn-clear {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.btn-clear:hover {
  background: #c82333;
}

@media (prefers-color-scheme: dark) {
  .btn-clear {
    background: #ef4444;
    color: white;
  }
  
  .btn-clear:hover {
    background: #dc2626;
  }
}

.upload-form {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #dee2e6;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.btn-upload {
  padding: 10px 20px;
  background: var(--color-primary-500, #0ea5e9);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn-upload:hover {
  background: var(--color-primary-600, #0284c7);
}

@media (prefers-color-scheme: dark) {
  .btn-upload {
    background: var(--color-primary-600, #0284c7);
    color: white;
  }
  
  .btn-upload:hover {
    background: var(--color-primary-700, #0369a1);
  }
}

.file-name {
  color: var(--text-secondary);
  font-size: 14px;
}

.file-preview {
  margin-top: 15px;
  padding: 15px;
  background: var(--bg-primary);
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.file-preview h5 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.preview-content {
  margin: 0;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 12px;
  font-family: 'Courier New', monospace;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.loading-state,
.no-data-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
}

.no-data-state .hint {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 8px;
}

.configurations-list {
  display: grid;
  gap: 15px;
}

.config-card {
  background: var(--bg-primary);
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 15px;
  transition: box-shadow 0.2s;
}

.config-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.config-header h5 {
  margin: 0;
  font-size: 16px;
  color: var(--text-primary);
}

.config-actions {
  display: flex;
  gap: 8px;
}

.btn-download,
.btn-edit,
.btn-delete {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn-download {
  background: var(--color-primary-500, #0ea5e9);
  color: white;
}

.btn-download:hover {
  background: var(--color-primary-600, #0284c7);
}

.btn-edit {
  background: var(--color-secondary-500, #64748b);
  color: white;
}

.btn-edit:hover {
  background: var(--color-secondary-600, #475569);
}

@media (prefers-color-scheme: dark) {
  .btn-download {
    background: var(--color-primary-600, #0284c7);
    color: white;
  }
  
  .btn-download:hover {
    background: var(--color-primary-700, #0369a1);
  }
  
  .btn-edit {
    background: var(--color-secondary-600, #475569);
    color: white;
  }
  
  .btn-edit:hover {
    background: var(--color-secondary-700, #334155);
  }
}

.btn-delete {
  background: #dc3545;
  color: white;
}

.btn-delete:hover {
  background: #c82333;
}

@media (prefers-color-scheme: dark) {
  .btn-delete {
    background: #ef4444;
    color: white;
  }
  
  .btn-delete:hover {
    background: #dc2626;
  }
}

.config-details {
  margin-top: 10px;
}

.config-description {
  margin: 0 0 10px 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.config-meta {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--text-muted);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-primary);
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #dee2e6;
}

.modal-header h4 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary, #6b7280);
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background: var(--bg-secondary, #f1f5f9);
}

@media (prefers-color-scheme: dark) {
  .close-btn {
    color: var(--text-secondary, #9ca3af);
  }
  
  .close-btn:hover {
    background: var(--bg-secondary, #374151);
  }
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 14px;
}

.input {
  width: 100%;
  padding: 10px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
}

.input:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 20px;
  border-top: 1px solid #dee2e6;
}

.btn-secondary,
.btn-primary {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn-secondary {
  background: var(--bg-secondary, #f1f5f9);
  color: var(--text-primary, #334155);
  border: 1px solid var(--border-light, #cbd5e1);
}

.btn-secondary:hover {
  background: var(--bg-hover, #e2e8f0);
  border-color: var(--border-medium, #94a3b8);
}

.btn-primary {
  background: var(--color-primary-500, #0ea5e9);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-600, #0284c7);
}

@media (prefers-color-scheme: dark) {
  .btn-secondary {
    background: var(--bg-secondary, #374151);
    color: var(--text-primary, #f9fafb);
    border-color: var(--border-light, #4b5563);
  }
  
  .btn-secondary:hover {
    background: var(--bg-hover, #4b5563);
    border-color: var(--border-medium, #6b7280);
  }
  
  .btn-primary {
    background: var(--color-primary-600, #0284c7);
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-700, #0369a1);
  }
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>

