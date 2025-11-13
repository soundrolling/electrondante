<!-- src/components/StageDocs.vue -->
<template>
<div class="container">
  <!-- Breadcrumb Navigation -->
  <nav class="breadcrumb">
    <button class="breadcrumb-item" @click="goBack">← Back</button>
    <span class="breadcrumb-separator">/</span>
    <span class="breadcrumb-text">{{ isProjectLevelView ? 'All Documents' : 'Stage Documents' }}</span>
  </nav>

  <!-- Project header removed per design (covered elsewhere) -->

  <!-- Top Bar: Compact Layout for Large Screens -->
  <div class="top-bar-container">
    <!-- Title Section -->
    <div class="top-bar-title">
      <h1 class="header-title">{{ isProjectLevelView ? 'All Documents' : `${stageName} Documents` }}</h1>
      <p v-if="!isProjectLevelView" class="header-subtitle">Venue: {{ venueName }}</p>
      <p v-else class="header-subtitle">Project: {{ currentProject?.project_name || 'Loading…' }}</p>
    </div>

    <!-- Controls Row: Upload, Search, Count, Filters, Export -->
    <div class="top-bar-controls">
      <!-- Upload Button - Only show when viewing a specific stage -->
      <div v-if="!isProjectLevelView && !isLoading" class="top-bar-upload">
        <input
          ref="fileInput"
          type="file"
          :accept="allowedMimes.join(',')"
          multiple
          @change="onFileChange"
          class="upload-input"
          :disabled="isUploading"
        />
        <button
          class="btn btn-primary btn-compact"
          @click="triggerFileInput"
          :disabled="isUploading"
        >
          <span class="btn-icon">📁</span>
          {{ isUploading ? 'Uploading…' : 'Upload' }}
        </button>
        <div v-if="isUploading" class="upload-progress-inline">
          <div class="progress-bar-inline">
            <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
          </div>
        </div>
      </div>

      <!-- Document Count -->
      <div v-if="!isLoading" class="top-bar-count">
        <span class="count-text">{{ filteredDocs.length }} Document{{ filteredDocs.length === 1 ? '' : 's' }}</span>
      </div>

      <!-- Search -->
      <div v-if="!isLoading" class="top-bar-search">
        <input
          v-model="searchTerm"
          placeholder="Search documents…"
          class="search-input-compact"
        />
      </div>

      <!-- Filters - Only show in project-level view -->
      <div v-if="!isLoading && isProjectLevelView" class="top-bar-filters">
        <select v-model="selectedVenueId" class="select-compact">
          <option value="">All Venues</option>
          <option v-for="venue in venues" :key="venue.id" :value="venue.id">
            {{ venue.venue_name }}
          </option>
        </select>
        <select v-model="selectedStageId" class="select-compact" :disabled="!selectedVenueId">
          <option value="">All Stages</option>
          <option v-for="stage in filteredStages" :key="stage.id" :value="stage.id">
            {{ stage.stage_name }}
          </option>
        </select>
      </div>

      <!-- Export PDF Button -->
      <div v-if="!isLoading" class="top-bar-export">
        <button 
          class="btn btn-secondary btn-compact" 
          @click="exportPdf"
          :disabled="!filteredDocs.length"
        >
          <span class="btn-icon">📄</span>
          Export PDF
        </button>
      </div>
    </div>
  </div>

  <!-- Upload Area - Full size for mobile, compact for desktop -->
  <div v-if="!isProjectLevelView && !isLoading" class="upload-section-mobile">
    <div 
      class="upload-area"
      :class="{ 'upload-area--dragover': isDragOver, 'upload-area--uploading': isUploading }"
      @drop="onDrop"
      @dragover.prevent="isDragOver = true"
      @dragleave.prevent="isDragOver = false"
      @click="triggerFileInput"
    >
      <input
        ref="fileInputMobile"
        type="file"
        :accept="allowedMimes.join(',')"
        multiple
        @change="onFileChange"
        class="upload-input"
        :disabled="isUploading"
      />
      
      <div class="upload-content">
        <div class="upload-icon">📁</div>
        <h3 class="upload-title">
          {{ isUploading ? 'Uploading Documents...' : 'Upload Stage Documents' }}
        </h3>
        <p class="upload-subtitle">
          {{ isUploading ? 'Please wait while we process your documents' : 'Drag & drop files here or click to browse' }}
        </p>
        <p class="upload-info">15 MB max (PDF, Word, Excel, CSV, Text)</p>
        
        <!-- Upload Progress -->
        <div v-if="isUploading" class="upload-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
          </div>
          <p class="progress-text">{{ uploadProgress }}% Complete</p>
        </div>
      </div>
    </div>

    <!-- Selected Files Preview -->
    <div v-if="selectedFiles.length" class="selected-files">
      <h4 class="selected-files-title">Selected Files ({{ selectedFiles.length }})</h4>
      <div class="file-list">
        <div 
          v-for="(file, index) in selectedFiles" 
          :key="index"
          class="file-item"
        >
          <div class="file-icon">
            {{ getFileIcon(file.type) }}
          </div>
          <div class="file-info">
            <p class="file-name">{{ file.name }}</p>
            <p class="file-size">{{ formatFileSize(file.size) }}</p>
          </div>
          <button 
            class="file-remove"
            @click="removeSelectedFile(index)"
            :disabled="isUploading"
          >
            ×
          </button>
        </div>
      </div>
      <!-- Upload Button -->
      <div class="selected-files-upload-btn">
        <button
          class="btn btn-primary"
          :disabled="isUploading || !selectedFiles.length"
          @click="uploadDocs"
        >
          {{ isUploading ? 'Uploading…' : 'Upload Selected Files' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Loading State -->
  <div v-if="isLoading" class="loading-section">
    <div class="loading-skeleton">
      <div class="skeleton-card" v-for="n in 6" :key="n">
        <div class="skeleton-icon"></div>
        <div class="skeleton-content">
          <div class="skeleton-line"></div>
          <div class="skeleton-line skeleton-line--short"></div>
          <div class="skeleton-line skeleton-line--short"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Documents List -->
  <section v-else-if="filteredDocs.length" class="docs-section">
    <div class="docs-list">
      <div
        v-for="(doc, idx) in filteredDocs"
        :key="doc.id"
        class="doc-card"
      >
        <!-- Document Icon & Info -->
        <div class="doc-header">
          <div class="doc-icon">
            {{ getFileIcon(doc.mime_type) }}
          </div>
          <div class="doc-info">
            <div class="doc-title-row">
              <a href="#" @click.prevent="viewDoc(doc)" class="doc-link">
                {{ doc.file_name }}
              </a>
              <div class="doc-actions">
                <button 
                  @click="viewDoc(doc)" 
                  class="action-btn view-btn"
                  title="View document"
                >
                  👁
                </button>
                <button 
                  @click="downloadDoc(doc)" 
                  class="action-btn download-btn"
                  title="Download document"
                >
                  📥
                </button>
                <button 
                  v-if="isAdmin"
                  @click="confirmRemove(doc)" 
                  class="action-btn delete-btn"
                  title="Delete document"
                >
                  🗑️
                </button>
              </div>
            </div>
            <div class="doc-meta">
              <span class="meta-item">{{ mimeLabel(doc.mime_type) }}</span>
              <span class="meta-item">📅 {{ formatDate(doc.inserted_at) }}</span>
              <span v-if="doc.uploaded_by" class="meta-item">👤 {{ doc.uploaded_by }}</span>
              <span v-if="isProjectLevelView && doc.venue_name" class="meta-item">🏢 {{ doc.venue_name }}</span>
              <span v-if="isProjectLevelView && doc.stage_name" class="meta-item">🎪 {{ doc.stage_name }}</span>
            </div>
          </div>
        </div>

        <!-- Reorder Controls -->
        <div class="reorder-section">
          <span class="reorder-title">Order:</span>
          <button
            class="order-btn"
            @click="moveDocUp(doc, idx)"
            :disabled="idx === 0"
            title="Move up"
          >
            ↑
          </button>
          <span class="order-number">{{ idx + 1 }}</span>
          <button
            class="order-btn"
            @click="moveDocDown(doc, idx)"
            :disabled="idx === filteredDocs.length - 1"
            title="Move down"
          >
            ↓
          </button>
        </div>

        <!-- Description Section -->
        <div class="description-section">
          <div v-if="editingId !== doc.id" class="description-display">
            <p class="description-text">{{ doc.description || 'No description' }}</p>
            <button class="icon-button" @click="startEditing(doc.id)" title="Edit description">
              ✏️
            </button>
          </div>
          <div v-else class="description-edit">
            <textarea v-model="doc.description" class="textarea-edit" placeholder="Enter description..."></textarea>
            <div class="edit-actions">
              <button class="btn btn-save" @click="saveDoc(doc)">Save</button>
              <button class="btn btn-cancel" @click="cancelEdit">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Empty State -->
  <div v-else-if="!isLoading" class="empty-state">
    <div class="empty-icon">📁</div>
    <h3 class="empty-title">No Documents Yet</h3>
    <p class="empty-description">
      <span v-if="isProjectLevelView">
        No documents found for this project. Documents are uploaded at the stage level. Navigate to a specific stage to upload documents.
      </span>
      <span v-else>
        Upload some documents to get started with documenting this stage.
      </span>
    </p>
  </div>

  <!-- Document Preview Modal -->
  <teleport to="body">
    <div v-if="showPreviewModal" class="preview-modal-overlay" @click.self="closePreviewModal">
      <div class="preview-modal">
        <div class="preview-modal-header">
          <span class="preview-modal-title">Preview: {{ previewDoc?.file_name }}</span>
          <button class="preview-modal-close" @click="closePreviewModal">×</button>
        </div>
        <div class="preview-modal-body">
          <iframe v-if="isPdf(previewDoc?.mime_type)" :src="previewDoc?.url" class="preview-iframe"></iframe>
          <div v-else class="preview-unsupported">
            <p>Preview not available for this file type.</p>
            <a :href="previewDoc?.url" target="_blank">Open in new tab</a>
          </div>
        </div>
        <div class="preview-modal-footer">
          <button class="btn btn-primary" @click="printPreview">Print</button>
          <button class="btn btn-secondary" @click="closePreviewModal">Close</button>
        </div>
      </div>
    </div>
  </teleport>

  <!-- Delete Confirmation Modal -->
  <teleport to="body">
    <ConfirmationModal
      :show="showDeleteConfirm"
      title="Delete Document"
      :message="docToDelete ? `Deleting '${docToDelete.file_name}' will remove it for everyone. Continue?` : ''"
      confirm-text="Delete"
      cancel-text="Cancel"
      @confirm="handleDeleteConfirm"
      @cancel="handleDeleteCancel"
    />
  </teleport>

  <!-- Download Confirmation Modal -->
  <teleport to="body">
    <ConfirmationModal
      :show="showDownloadConfirm"
      title="Download Document"
      :message="docToDownload ? `Download '${docToDownload.file_name}'?` : ''"
      confirm-text="Download"
      cancel-text="Cancel"
      @confirm="handleDownloadConfirm"
      @cancel="handleDownloadCancel"
    />
  </teleport>
</div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { supabase } from '@/supabase'
import { useUserStore } from '@/stores/userStore'
import jsPDF from 'jspdf'
import ConfirmationModal from '@/components/calendar/ConfirmationModal.vue'

// router, toast & store
const route      = useRoute()
const router     = useRouter()
const toast      = useToast()
const userStore  = useUserStore()

// reactive for project header
const currentProject   = computed(() => userStore.getCurrentProject)
const isLoadingProject = ref(true)

// IDs from route
const projectId = route.params.id
const venueId   = route.query.venueId
const stageId   = route.query.stageId

// Check if we're in project-level view (no venue/stage specified)
const isProjectLevelView = computed(() => !venueId || !stageId)

// Check if user is admin
const isAdmin = computed(() => {
  const role = userStore.currentProject?.role
  return role === 'admin' || role === 'owner'
})

// reactive page state
const venueName     = ref('Loading…')
const stageName     = ref('Loading…')
const docs          = ref([])
const searchTerm    = ref('')
const selectedFiles = ref([])
const isLoading     = ref(false)
const isUploading   = ref(false)
const isDragOver    = ref(false)
const uploadProgress = ref(0)
const fileInput     = ref(null)
const fileInputMobile = ref(null)
const editingId     = ref(null)
const showPreviewModal = ref(false)
const previewDoc = ref(null)
const venues      = ref([])
const stages      = ref([])
const selectedVenueId = ref('')
const selectedStageId = ref('')
const showDeleteConfirm = ref(false)
const showDownloadConfirm = ref(false)
const docToDelete = ref(null)
const docToDownload = ref(null)

// allowed MIME types
const allowedMimes = [
'application/pdf',
'application/msword',
'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
'application/vnd.ms-excel',
'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
'text/plain'
]

// navigation helpers
const goBack = () => router.back()

// file handling
function triggerFileInput() {
  if (!isUploading.value) {
    fileInput.value?.click() || fileInputMobile.value?.click()
  }
}

function onFileChange(e) {
  const files = Array.from(e.target.files)
  validateAndAddFiles(files)
}

function onDrop(e) {
  isDragOver.value = false
  const files = Array.from(e.dataTransfer.files)
  validateAndAddFiles(files)
}

function validateAndAddFiles(files) {
  const validFiles = files.filter(file => {
    if (!allowedMimes.includes(file.type)) {
      toast.error(`${file.name} is not an allowed file type`)
      return false
    }
    if (file.size > 15 * 1024 * 1024) { // 15MB limit
      toast.error(`${file.name} is too large (max 15MB)`)
      return false
    }
    return true
  })
  
  selectedFiles.value.push(...validFiles)
}

function removeSelectedFile(index) {
  selectedFiles.value.splice(index, 1)
}

function getFileIcon(mimeType) {
  if (mimeType.includes('pdf')) return '📄'
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊'
  if (mimeType.startsWith('text/')) return '📄'
  return '📁'
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// utils
function mimeLabel(mime) {
if (mime.includes('spreadsheet')) return 'Spreadsheet'
if (mime.includes('wordprocessingml') || mime.includes('msword')) return 'Document'
if (mime === 'application/pdf') return 'PDF'
if (mime.startsWith('text/')) return 'Text'
return 'File'
}
function formatDate(ts) {
return new Date(ts).toLocaleDateString()
}

// 1) Load project row & populate store
async function loadProject() {
try {
  const { data, error } = await supabase
    .from('projects')
    .select('project_name')
    .eq('id', projectId)
    .single()
  if (error) throw error
  
  // Ensure role is loaded if not already set
  let role = userStore.currentProject?.role
  if (!role) {
    const { data: session } = await supabase.auth.getSession()
    const email = session?.session?.user?.email?.toLowerCase()
    if (email) {
      const { data: member } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_email', email)
        .single()
      if (member) {
        role = member.role
      }
    }
  }
  
  userStore.setCurrentProject({ 
    id: projectId, 
    project_name: data.project_name,
    role: role || userStore.currentProject?.role
  })
} catch (e) {
  console.error('Error loading project:', e)
  toast.error('Could not load project')
} finally {
  isLoadingProject.value = false
}
}

// 2) Fetch venue & stage names (only if venueId/stageId are provided)
async function fetchNames() {
  if (!venueId || !stageId) {
    // Project-level view - fetch all venues and stages for filtering
    try {
      const { data: venuesData, error: venuesError } = await supabase
        .from('venues')
        .select('id, venue_name')
        .eq('project_id', projectId)
        .order('venue_name', { ascending: true })
      
      if (venuesError) throw venuesError
      venues.value = venuesData || []

      const { data: stagesData, error: stagesError } = await supabase
        .from('locations')
        .select('id, stage_name, venue_id')
        .eq('project_id', projectId)
        .order('stage_name', { ascending: true })
      
      if (stagesError) throw stagesError
      stages.value = stagesData || []
    } catch (e) {
      console.error('Error fetching venues/stages:', e)
    }
    return
  }

  // Stage-level view - fetch specific venue and stage names
  try {
    const { data: v } = await supabase
      .from('venues')
      .select('venue_name')
      .eq('id', venueId)
      .single()
    if (v) venueName.value = v.venue_name

    const { data: s } = await supabase
      .from('locations')
      .select('stage_name')
      .eq('id', stageId)
      .single()
    if (s) stageName.value = s.stage_name
  } catch (e) {
    console.error('Error fetching venue/stage names:', e)
  }
}

// 3) Fetch docs list + signed URLs
async function fetchDocs() {
isLoading.value = true
try {
  let query = supabase
    .from('stage_docs')
    .select('*')
    .eq('project_id', projectId)

  // Only filter by venue/stage if they're provided
  if (venueId) {
    query = query.eq('venue_id', venueId)
  } else if (selectedVenueId.value) {
    query = query.eq('venue_id', selectedVenueId.value)
  }

  if (stageId) {
    query = query.eq('stage_id', stageId)
  } else if (selectedStageId.value) {
    query = query.eq('stage_id', selectedStageId.value)
  }

  const { data, error } = await query.order('order', { ascending: true })
  if (error) throw error

  // Get venue and stage names for project-level view
  const venueMap = new Map()
  const stageMap = new Map()
  if (isProjectLevelView.value) {
    venues.value.forEach(v => venueMap.set(v.id, v.venue_name))
    stages.value.forEach(s => stageMap.set(s.id, s.stage_name))
  }

  for (let d of data) {
    const { data: urlData } = await supabase.storage
      .from('stage-docs')
      .createSignedUrl(d.file_path, 3600)
    d.url = urlData.signedUrl
    
    // Add venue/stage names for project-level view
    if (isProjectLevelView.value) {
      d.venue_name = venueMap.get(d.venue_id) || 'Unknown Venue'
      d.stage_name = stageMap.get(d.stage_id) || 'Unknown Stage'
    }
  }
  docs.value = data
} catch (e) {
  console.error(e)
  toast.error('Could not load documents')
} finally {
  isLoading.value = false
}
}

// filtered view
const filteredStages = computed(() => {
  if (!selectedVenueId.value) return stages.value
  return stages.value.filter(s => s.venue_id === selectedVenueId.value)
})

const filteredDocs = computed(() => {
const t = searchTerm.value.toLowerCase()
if (!t) return docs.value
return docs.value.filter(d =>
  d.file_name.toLowerCase().includes(t) ||
  (d.description || '').toLowerCase().includes(t) ||
  (isProjectLevelView.value && (d.venue_name || '').toLowerCase().includes(t)) ||
  (isProjectLevelView.value && (d.stage_name || '').toLowerCase().includes(t))
)
})

// Watch for filter changes in project-level view
watch([selectedVenueId, selectedStageId], () => {
  if (isProjectLevelView.value) {
    fetchDocs()
  }
})

// Reset stage filter when venue changes
watch(selectedVenueId, () => {
  if (isProjectLevelView.value) {
    selectedStageId.value = ''
  }
})

// upload to storage & insert rows
async function uploadDocs() {
if (!selectedFiles.value.length) return
if (!venueId || !stageId) {
  toast.error('Please navigate to a specific stage to upload documents')
  return
}

isUploading.value = true
uploadProgress.value = 0

let maxOrder = docs.value.length ? Math.max(...docs.value.map(d => d.order || 0)) : 0
let count = 0
const totalFiles = selectedFiles.value.length

for (const file of selectedFiles.value) {
  if (!allowedMimes.includes(file.type)) {
    toast.error(`"${file.name}" not allowed`)
    continue
  }
  const { data, error: upErr } = await supabase.storage
    .from('stage-docs')
    .upload(
      `${projectId}/${venueId}/${stageId}/${Date.now()}_${file.name}`,
      file
    )
  if (upErr) {
    toast.error(upErr.message)
    continue
  }

  maxOrder++
  const { error: dbErr } = await supabase
    .from('stage_docs')
    .insert({
      project_id: projectId,
      venue_id:   venueId,    // ← explicitly map here
      stage_id:   stageId,    // ← and here
      file_path:  data.path,
      file_name:  file.name,
      mime_type:  file.type,
      description:'',
      order:      maxOrder
    })
  if (dbErr) {
    toast.error(dbErr.message)
    continue
  }
  count++
  uploadProgress.value = Math.round((count / totalFiles) * 100)
}

selectedFiles.value = []
fileInput.value.value = null
fileInputMobile.value.value = null
uploadProgress.value = 0
toast.success(`${count} uploaded`)
await fetchDocs()
isUploading.value = false
}

// edit description
async function saveDoc(doc) {
const { error } = await supabase
  .from('stage_docs')
  .update({ description: doc.description })
  .eq('id', doc.id)
if (error) toast.error(error.message)
else {
  toast.success('Description saved')
  editingId.value = null
}
}
function startEditing(id) { editingId.value = id }
function cancelEdit() { editingId.value = null }

// delete
function confirmRemove(doc) {
  docToDelete.value = doc
  showDeleteConfirm.value = true
}

function handleDeleteConfirm() {
  if (docToDelete.value) {
    removeDoc(docToDelete.value)
    docToDelete.value = null
  }
  showDeleteConfirm.value = false
}

function handleDeleteCancel() {
  docToDelete.value = null
  showDeleteConfirm.value = false
}

async function removeDoc(doc) {
  try {
    // First, delete from storage
    const { error: remErr, data: remData } = await supabase.storage
      .from('stage-docs')
      .remove([doc.file_path])
    
    if (remErr) { 
      console.error('Storage removal error:', remErr)
      toast.error(remErr.message || 'Failed to delete file from storage')
      return 
    }
    
    console.log('Storage file removed:', remData)

    // Then, delete from database
    const { error: delErr } = await supabase
      .from('stage_docs')
      .delete()
      .eq('id', doc.id)
    
    if (delErr) {
      console.error('Database deletion error:', delErr)
      toast.error(delErr.message || 'Failed to delete document record')
    } else {
      console.log('Document deleted successfully:', doc.id)
      toast.success('Document deleted successfully')
      await fetchDocs()
    }
  } catch (e) {
    console.error('Error deleting document:', e)
    toast.error('Failed to delete document: ' + (e.message || 'Unknown error'))
  }
}

// view document in new tab
function viewDoc(doc) {
  previewDoc.value = doc
  showPreviewModal.value = true
}

// download document directly
function downloadDoc(doc) {
  docToDownload.value = doc
  showDownloadConfirm.value = true
}

function handleDownloadConfirm() {
  if (docToDownload.value) {
    try {
      const link = document.createElement('a')
      link.href = docToDownload.value.url
      link.download = docToDownload.value.file_name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('Download started')
    } catch (e) {
      toast.error('Failed to download')
    }
    docToDownload.value = null
  }
  showDownloadConfirm.value = false
}

function handleDownloadCancel() {
  docToDownload.value = null
  showDownloadConfirm.value = false
}

// reorder
async function swapOrder(a, b) {
const oa = a.order, ob = b.order
await supabase.from('stage_docs').update({ order: ob }).eq('id', a.id)
await supabase.from('stage_docs').update({ order: oa }).eq('id', b.id)
await fetchDocs()
toast.success('Order updated')
}
function moveDocUp(d, idx)    { if (idx > 0) swapOrder(d, filteredDocs.value[idx - 1]) }
function moveDocDown(d, idx)  { if (idx < filteredDocs.value.length - 1) swapOrder(d, filteredDocs.value[idx + 1]) }

// PDF Export
async function exportPdf() {
  if (!filteredDocs.value.length) {
    toast.warning('No documents to export')
    return
  }

  try {
    const doc = new jsPDF('p', 'pt', 'a4')
    const margin = 40
    let y = margin

    doc.setFontSize(18)
    doc.text(`${stageName.value} Documents`, margin, y)
    y += 24
    doc.setFontSize(12)
    doc.text(`Venue: ${venueName.value}`, margin, y)
    y += 32

    for (const docItem of filteredDocs.value) {
      if (y + 60 > doc.internal.pageSize.getHeight()) {
        doc.addPage()
        y = margin
      }

      doc.setFontSize(14)
      doc.text(docItem.file_name, margin, y)
      y += 20
      
      doc.setFontSize(10)
      doc.text(`Type: ${mimeLabel(docItem.mime_type)}`, margin, y)
      y += 16
      doc.text(`Added: ${formatDate(docItem.inserted_at)}`, margin, y)
      y += 16
      if (docItem.uploaded_by) {
        doc.text(`Uploaded by: ${docItem.uploaded_by}`, margin, y)
        y += 16
      }
      
      if (docItem.description) {
        const descLines = doc.splitTextToSize(
          `Description: ${docItem.description}`,
          doc.internal.pageSize.getWidth() - 2 * margin
        )
        doc.text(descLines, margin, y)
        y += descLines.length * 14
      }
      
      y += 20
    }

    doc.save(`${stageName.value.replace(/\s+/g, '_')}_Documents.pdf`)
    toast.success('PDF exported successfully')
  } catch (error) {
    console.error('PDF export error:', error)
    toast.error('Failed to export PDF')
  }
}

// on mount: load project, names & docs
onMounted(async () => {
await loadProject()
await fetchNames()
await fetchDocs()
})

function isPdf(mime) { return mime && mime.includes('pdf') }
function closePreviewModal() {
  showPreviewModal.value = false
  previewDoc.value = null
}
function printPreview() {
  const iframe = document.querySelector('.preview-iframe')
  if (iframe) {
    iframe.contentWindow.focus()
    iframe.contentWindow.print()
  } else {
    toast.error('Print preview only available for PDFs')
  }
}
</script>

<style scoped>
/* Base Styles */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  background: var(--bg-secondary);
  min-height: 100vh;
}

/* Top Bar Container - Compact Layout for Large Screens */
.top-bar-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
  padding: 20px;
  background: var(--bg-primary);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-light);
}

@media (min-width: 1024px) {
  .top-bar-container {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 16px 24px;
  }
  
  .top-bar-title {
    flex-shrink: 0;
    min-width: 200px;
  }
  
  .top-bar-controls {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;
    flex-wrap: wrap;
  }
  
  .top-bar-upload {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .top-bar-count {
    white-space: nowrap;
  }
  
  .top-bar-search {
    flex: 1;
    min-width: 200px;
    max-width: 300px;
  }
  
  .top-bar-filters {
    display: flex;
    gap: 8px;
  }
  
  .top-bar-export {
    flex-shrink: 0;
  }
  
  /* Hide mobile upload section on large screens */
  .upload-section-mobile {
    display: none;
  }
}

.top-bar-title {
  margin-bottom: 0;
}

.top-bar-title .header-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 4px 0;
}

.top-bar-title .header-subtitle {
  color: var(--text-secondary);
  margin: 0;
  font-size: 0.875rem;
}

.top-bar-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.count-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
}

.search-input-compact {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s ease;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.search-input-compact:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.select-compact {
  padding: 8px 12px;
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  transition: border-color 0.2s ease;
  cursor: pointer;
  min-width: 120px;
}

.select-compact:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.select-compact:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-compact {
  padding: 8px 16px;
  font-size: 14px;
  white-space: nowrap;
}

.upload-progress-inline {
  width: 60px;
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar-inline {
  width: 100%;
  height: 100%;
  background: var(--bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar-inline .progress-fill {
  height: 100%;
  background: var(--color-success-500);
  transition: width 0.3s ease;
}

/* Upload Section - Mobile/Tablet */
.upload-section-mobile {
  margin-bottom: 32px;
}

@media (min-width: 1024px) {
  .upload-section-mobile {
    display: none;
  }
}

/* Breadcrumb */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
  font-size: 14px;
}

.breadcrumb-item {
  background: none;
  border: none;
  color: #3b82f6;
  cursor: pointer;
  padding: 0;
  font-size: 14px;
}

.breadcrumb-item:hover {
  text-decoration: underline;
}

.breadcrumb-separator {
  color: var(--text-secondary);
}

.breadcrumb-text {
  color: var(--text-secondary);
}

/* Project Header */
.loading-indicator {
  text-align: center;
  padding: 24px;
  background: var(--bg-primary);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-light);
}

.project-header {
  text-align: center;
  margin-bottom: 16px;
}

.project-title {
  font-size: 1.6rem;
  margin: 0;
  color: var(--text-primary);
}

/* Header Section - Legacy styles (kept for compatibility) */
.header-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
  padding: 24px;
  background: var(--bg-primary);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-light);
}

.header-content {
  flex: 1;
}

.header-title {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.header-subtitle {
  color: var(--text-secondary);
  margin: 0;
  font-size: 1rem;
}

.header-actions {
  display: flex;
  gap: 12px;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary) !important;
  border: 1px solid var(--border-medium);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-tertiary);
  color: var(--text-heading) !important;
  border-color: var(--border-medium);
}

.btn-primary {
  background: var(--color-primary-600);
  color: var(--text-inverse) !important;
  border: 1px solid var(--color-primary-700);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-700);
  color: var(--text-inverse) !important;
  border-color: var(--color-primary-800);
}

.btn-save {
  background: var(--color-success-500);
  color: var(--text-inverse) !important;
}

.btn-save:hover:not(:disabled) {
  background: var(--color-success-600);
  color: var(--text-inverse) !important;
}

.btn-delete {
  background: var(--color-error-500);
  color: var(--text-inverse) !important;
}

.btn-delete:hover:not(:disabled) {
  background: var(--color-error-600);
  color: var(--text-inverse) !important;
}

.btn-cancel {
  background: var(--color-secondary-500);
  color: var(--text-inverse) !important;
}

.btn-cancel:hover:not(:disabled) {
  background: var(--color-secondary-600);
  color: var(--text-inverse) !important;
}

.btn-icon {
  font-size: 16px;
}

/* Upload Section */
.upload-section {
  margin-bottom: 32px;
}

.upload-area {
  position: relative;
  border: 2px dashed var(--border-medium);
  border-radius: 12px;
  padding: 48px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--bg-primary);
}

.upload-area:hover {
  border-color: var(--color-primary-500);
  background: var(--bg-secondary);
}

.upload-area--dragover {
  border-color: var(--color-primary-500);
  background: rgba(59, 130, 246, 0.1);
}

.upload-area--uploading {
  border-color: var(--color-success-500);
  background: rgba(34, 197, 94, 0.1);
  cursor: not-allowed;
}

.upload-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.upload-content {
  pointer-events: none;
}

.upload-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.upload-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.upload-subtitle {
  color: var(--text-secondary);
  margin: 0 0 8px 0;
}

.upload-info {
  color: #9ca3af;
  font-size: 14px;
  margin: 0;
}

.upload-progress {
  margin-top: 24px;
  max-width: 300px;
  margin-left: auto;
  margin-right: auto;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: var(--color-success-500);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

/* Selected Files */
.selected-files {
  margin-top: 24px;
  background: var(--bg-primary);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-light);
}

.selected-files-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 16px 0;
}

.file-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-secondary);
}

.file-icon {
  font-size: 24px;
  width: 40px;
  text-align: center;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin: 0 0 4px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
}

.file-remove {
  background: #fef2f2;
  color: #dc2626 !important;
  border: 1px solid #fecaca;
  border-radius: 4px;
  width: 24px;
  height: 24px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-remove:hover:not(:disabled) {
  background: #b91c1c;
  color: #ffffff !important;
  border-color: #991b1b;
}

/* Upload Button */
.selected-files-upload-btn {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

/* Document Count Section */
.docs-count-section {
  margin-bottom: 32px;
}

.docs-count-container {
  background: var(--bg-primary);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-light);
}

.docs-count-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

/* Search Section */
.search-section {
  margin-bottom: 32px;
}

.search-container {
  background: var(--bg-primary);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-light);
}

.search-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.2s ease;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Filter Section */
.filter-section {
  margin-bottom: 32px;
}

.filter-section .filter-container {
  background: var(--bg-primary);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stage-filter {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.select-stage {
  padding: 12px 16px;
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  transition: border-color 0.2s ease;
  cursor: pointer;
}

.select-stage:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.select-stage:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Loading Section */
.loading-section {
  margin-bottom: 32px;
}

.loading-skeleton {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
}

.skeleton-card {
  background: var(--bg-primary);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-light);
}

.skeleton-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-tertiary) 50%, var(--bg-secondary) 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 8px;
  margin-bottom: 16px;
}

.skeleton-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-line {
  height: 12px;
  background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-tertiary) 50%, var(--bg-secondary) 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 4px;
}

.skeleton-line--short {
  width: 60%;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Docs Section */
.docs-section {
  margin-bottom: 32px;
}

.docs-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
@media (min-width: 700px) {
  .docs-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 24px;
  }
}

/* Document Card */
.doc-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
  max-width: 700px;
  width: 100%;
  box-sizing: border-box;
  margin-left: auto;
  margin-right: auto;
}

.doc-card:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.doc-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}

.doc-icon {
  font-size: 32px;
  width: 48px;
  text-align: center;
  flex-shrink: 0;
}

.doc-info {
  flex: 1;
  min-width: 0;
}

.doc-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.doc-link {
  color: var(--text-link);
  text-decoration: none;
  font-weight: 500;
  font-size: 16px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-link:hover {
  text-decoration: underline;
}

.doc-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.action-btn {
  background: var(--bg-secondary);
  color: var(--text-primary) !important;
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  width: 32px;
  height: 32px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary) !important;
  border-color: var(--border-medium);
  transform: scale(1.05);
}

.view-btn:hover {
  background: var(--color-primary-600);
  color: var(--text-inverse) !important;
  border-color: var(--color-primary-700);
}

.download-btn:hover {
  background: var(--color-success-600);
  color: var(--text-inverse) !important;
  border-color: var(--color-success-700);
}

.delete-btn:hover {
  background: var(--color-error-600);
  color: var(--text-inverse) !important;
  border-color: var(--color-error-700);
}

.doc-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.meta-item {
  font-size: 12px;
  color: var(--text-secondary);
}

/* Reorder Section */
.reorder-section {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-light);
}

.reorder-title {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 14px;
}

.order-btn {
  background: var(--bg-secondary);
  color: var(--text-primary) !important;
  border: 1px solid var(--border-medium);
  border-radius: 4px;
  width: 28px;
  height: 28px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-weight: 600;
}

.order-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
  color: var(--text-primary) !important;
  border-color: var(--border-medium);
}

.order-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.order-number {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  min-width: 20px;
  text-align: center;
}

/* Description Section */
.description-section {
  margin-top: 16px;
}

.description-display {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.description-text {
  flex: 1;
  margin: 0;
  color: var(--text-primary);
  line-height: 1.5;
  min-height: 20px;
}

.icon-button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s ease;
  flex-shrink: 0;
  color: var(--text-primary);
}

.icon-button:hover {
  background: var(--bg-secondary);
}

.description-edit {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.textarea-edit {
  width: 100%;
  min-height: 80px;
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.2s ease;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.textarea-edit:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.edit-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 64px 24px;
  background: var(--bg-primary);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-light);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 24px;
}

.empty-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px 0;
}

.empty-description {
  color: var(--text-secondary);
  margin: 0;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}

/* Responsive Design */
@media (max-width: 1023px) {
  .top-bar-controls {
    flex-direction: column;
    gap: 12px;
  }
  
  .top-bar-search {
    width: 100%;
    max-width: none;
  }
  
  .top-bar-filters {
    flex-direction: column;
    width: 100%;
  }
  
  .select-compact {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .container {
    padding: 16px;
  }
  
  .top-bar-container {
    padding: 16px;
  }
  
  .top-bar-title .header-title {
    font-size: 1.25rem;
  }
  
  .docs-list {
    grid-template-columns: 1fr;
  }
  
  .file-list {
    grid-template-columns: 1fr;
  }
  
  .loading-skeleton {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .upload-area {
    padding: 32px 16px;
  }
  
  .upload-title {
    font-size: 1.125rem;
  }
  
  .doc-card {
    padding: 16px;
  }
}

/* Document Preview Modal */
.preview-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-modal {
  background: var(--bg-primary);
  border-radius: 12px;
  max-width: 90vw;
  max-height: 90vh;
  width: 700px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-medium);
}
.preview-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-light);
}
.preview-modal-header .preview-modal-title {
  color: var(--text-primary);
}
.preview-modal-close {
  color: var(--text-primary);
}
.preview-modal-title {
  font-size: 1.1rem;
  font-weight: 600;
}
.preview-modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
}
.btn:focus-visible,
.action-btn:focus-visible,
.order-btn:focus-visible,
.file-remove:focus-visible,
.preview-modal-close:focus-visible,
.breadcrumb-item:focus-visible {
  outline: 3px solid rgba(59, 130, 246, 0.6);
  outline-offset: 2px;
}
.preview-modal-body {
  flex: 1;
  padding: 0;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-iframe {
  width: 100%;
  height: 70vh;
  border: none;
  background: var(--bg-primary);
}
.preview-unsupported {
  padding: 32px;
  text-align: center;
  color: var(--text-secondary);
}
.preview-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--border-light);
  background: var(--bg-secondary);
}
</style>