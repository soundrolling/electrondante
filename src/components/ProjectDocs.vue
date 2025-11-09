<!-- src/components/ProjectDocs.vue -->
<template>
<div class="container">
  <!-- Breadcrumb Navigation -->
  <nav class="breadcrumb">
    <button class="breadcrumb-item" @click="goBack">← Back</button>
    <span class="breadcrumb-separator">/</span>
    <span class="breadcrumb-text">All Documents</span>
  </nav>

  <!-- Desktop Layout: 2 Columns -->
  <div class="desktop-layout">
    <!-- Left Column: Header -->
    <div class="left-column">
      <!-- Header Section -->
      <header class="header-section ui-page-header">
        <div class="header-content">
          <h1 class="header-title">All Documents</h1>
          <p class="header-subtitle">Project: {{ currentProject?.project_name || projectName }}</p>
        </div>
        <div class="header-actions">
          <button 
            class="btn btn-secondary" 
            @click="exportPdf"
            :disabled="!filteredDocs.length"
          >
            <span class="btn-icon">📄</span>
            Export PDF
          </button>
        </div>
      </header>
    </div>

    <!-- Right Column: Document Count + Search + Filters -->
    <div class="right-column">
      <!-- Document Count Section -->
      <section v-if="!isLoading" class="docs-count-section">
        <div class="docs-count-container">
          <h3 class="docs-count-title">{{ filteredDocs.length }} Document{{ filteredDocs.length === 1 ? '' : 's' }}</h3>
        </div>
      </section>

      <!-- Search Section -->
      <section v-if="!isLoading" class="search-section">
        <div class="search-container">
          <input
            v-model="searchTerm"
            placeholder="Search documents…"
            class="search-input"
          />
        </div>
      </section>

      <!-- Filter Section -->
      <section v-if="!isLoading" class="filter-section">
        <div class="filter-container">
          <div class="stage-filter">
            <label class="filter-label">Filter by Venue</label>
            <select v-model="selectedVenueId" class="select-stage">
              <option value="">All Venues</option>
              <option v-for="venue in venues" :key="venue.id" :value="venue.id">
                {{ venue.venue_name }}
              </option>
            </select>
          </div>
          <div class="stage-filter">
            <label class="filter-label">Filter by Stage</label>
            <select v-model="selectedStageId" class="select-stage" :disabled="!selectedVenueId">
              <option value="">All Stages</option>
              <option v-for="stage in filteredStages" :key="stage.id" :value="stage.id">
                {{ stage.stage_name }}
              </option>
            </select>
          </div>
        </div>
      </section>
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
              </div>
            </div>
            <div class="doc-meta">
              <span class="meta-item">{{ mimeLabel(doc.mime_type) }}</span>
              <span class="meta-item">📅 {{ formatDate(doc.inserted_at) }}</span>
              <span v-if="doc.uploaded_by" class="meta-item">👤 {{ doc.uploaded_by }}</span>
              <span v-if="doc.venue_name" class="meta-item">🏢 {{ doc.venue_name }}</span>
              <span v-if="doc.stage_name" class="meta-item">🎪 {{ doc.stage_name }}</span>
            </div>
          </div>
        </div>

        <!-- Description Section -->
        <div class="description-section">
          <div class="description-display">
            <p class="description-text">{{ doc.description || 'No description' }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Empty State -->
  <div v-else-if="!isLoading" class="empty-state">
    <div class="empty-icon">📁</div>
    <h3 class="empty-title">No Documents Found</h3>
    <p class="empty-description">
      No documents found for this project. Documents are uploaded at the stage level. Navigate to a specific stage to upload documents.
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
</div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { supabase } from '@/supabase'
import { useUserStore } from '@/stores/userStore'
import jsPDF from 'jspdf'

// ─── PROPS ──────────────────────────────────────────────────────────────────────
const props = defineProps({
  projectId: {
    type: String,
    required: true
  }
})

// ─── ROUTER & STATE ────────────────────────────────────────────────────────────
const route      = useRoute()
const router     = useRouter()
const toast      = useToast()
const userStore  = useUserStore()

// reactive for project header
const currentProject   = computed(() => userStore.getCurrentProject)
const isLoadingProject = ref(true)

const projectId   = props.projectId || route.params.id
const projectName = ref('Loading…')

// reactive page state
const docs          = ref([])
const searchTerm    = ref('')
const isLoading     = ref(true)
const venues        = ref([])
const stages        = ref([])
const selectedVenueId = ref('')
const selectedStageId = ref('')
const showPreviewModal = ref(false)
const previewDoc = ref(null)

// ─── NAVIGATION ─────────────────────────────────────────────────────────────────
const goBack = () => router.back()

// ─── UTILS ──────────────────────────────────────────────────────────────────────
function getFileIcon(mimeType) {
  if (mimeType.includes('pdf')) return '📄'
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊'
  if (mimeType.startsWith('text/')) return '📄'
  return '📁'
}

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

// ─── LOAD PROJECT ──────────────────────────────────────────────────────────────
async function loadProject() {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('project_name')
      .eq('id', projectId)
      .single()
    if (error) throw error
    userStore.setCurrentProject({ id: projectId, project_name: data.project_name })
    projectName.value = data.project_name
  } catch (e) {
    console.error('Error loading project:', e)
    toast.error('Could not load project')
  } finally {
    isLoadingProject.value = false
  }
}

// ─── FETCH VENUES & STAGES ─────────────────────────────────────────────────────
async function fetchNames() {
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
    toast.error('Failed to load venues and stages')
  }
}

// ─── FETCH DOCS ────────────────────────────────────────────────────────────────
async function fetchDocs() {
  isLoading.value = true
  try {
    let query = supabase
      .from('stage_docs')
      .select('*')
      .eq('project_id', projectId)

    // Apply venue filter if selected
    if (selectedVenueId.value) {
      query = query.eq('venue_id', selectedVenueId.value)
    }

    // Apply stage filter if selected
    if (selectedStageId.value) {
      query = query.eq('stage_id', selectedStageId.value)
    }

    const { data, error } = await query.order('order', { ascending: true })
    if (error) throw error

    // Get venue and stage names
    const venueMap = new Map()
    const stageMap = new Map()
    venues.value.forEach(v => venueMap.set(v.id, v.venue_name))
    stages.value.forEach(s => stageMap.set(s.id, s.stage_name))

    for (let d of data) {
      const { data: urlData } = await supabase.storage
        .from('stage-docs')
        .createSignedUrl(d.file_path, 3600)
      d.url = urlData.signedUrl
      
      // Add venue/stage names
      d.venue_name = venueMap.get(d.venue_id) || 'Unknown Venue'
      d.stage_name = stageMap.get(d.stage_id) || 'Unknown Stage'
    }
    docs.value = data
  } catch (e) {
    console.error(e)
    toast.error('Could not load documents')
  } finally {
    isLoading.value = false
  }
}

// ─── FILTERED VIEW ─────────────────────────────────────────────────────────────
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
    (d.venue_name || '').toLowerCase().includes(t) ||
    (d.stage_name || '').toLowerCase().includes(t)
  )
})

// ─── WATCHERS ──────────────────────────────────────────────────────────────────
watch([selectedVenueId, selectedStageId], () => {
  fetchDocs()
})

// Reset stage filter when venue changes
watch(selectedVenueId, () => {
  selectedStageId.value = ''
})

// ─── VIEW DOCUMENT ─────────────────────────────────────────────────────────────
function isPdf(mime) { return mime && mime.includes('pdf') }
function viewDoc(doc) {
  previewDoc.value = doc
  showPreviewModal.value = true
}
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

// ─── DOWNLOAD DOCUMENT ─────────────────────────────────────────────────────────
function downloadDoc(doc) {
  if (!confirm(`Download "${doc.file_name}"?`)) return
  try {
    const link = document.createElement('a')
    link.href = doc.url
    link.download = doc.file_name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Download started')
  } catch (e) {
    toast.error('Failed to download')
  }
}

// ─── PDF EXPORT ───────────────────────────────────────────────────────────────
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
    doc.text('Project Documents', margin, y)
    y += 24
    doc.setFontSize(12)
    doc.text(`Project: ${projectName.value}`, margin, y)
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
      if (docItem.venue_name) {
        doc.text(`Venue: ${docItem.venue_name}`, margin, y)
        y += 16
      }
      if (docItem.stage_name) {
        doc.text(`Stage: ${docItem.stage_name}`, margin, y)
        y += 16
      }
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

    doc.save(`${projectName.value.replace(/\s+/g, '_')}_Documents.pdf`)
    toast.success('PDF exported successfully')
  } catch (error) {
    console.error('PDF export error:', error)
    toast.error('Failed to export PDF')
  }
}

// ─── ON MOUNT ───────────────────────────────────────────────────────────────────
onMounted(async () => {
  await loadProject()
  await fetchNames()
  await fetchDocs()
})
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

/* Desktop Layout: 2 Columns */
.desktop-layout {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

@media (min-width: 1024px) {
  .desktop-layout {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 24px;
    align-items: start;
  }
  
  .left-column {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  
  .right-column {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  
  .header-section {
    margin-bottom: 0;
  }
  
  .docs-count-section {
    margin-bottom: 0;
  }
  
  .search-section {
    margin-bottom: 0;
  }
  
  .filter-section {
    margin-bottom: 0;
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

/* Header Section */
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

.btn-icon {
  font-size: 16px;
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

.doc-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.meta-item {
  font-size: 12px;
  color: var(--text-secondary);
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
  .desktop-layout {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  
  .left-column {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  
  .right-column {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
}

@media (max-width: 768px) {
  .container {
    padding: 16px;
  }
  
  .header-section {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .header-actions {
    justify-content: flex-start;
  }
  
  .docs-list {
    grid-template-columns: 1fr;
  }
  
  .loading-skeleton {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
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
