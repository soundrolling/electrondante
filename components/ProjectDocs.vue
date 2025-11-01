<!-- src/components/ProjectDocs.vue -->
<template>
<div class="container">
  

  <!-- Header Section -->
  <header class="header-section ui-page-header">
    <div class="header-content">
      <h1 class="header-title">All Documents</h1>
      <p class="header-subtitle">Project: {{ projectName }}</p>
    </div>
    <div class="header-actions">
      <button 
        class="btn btn-warning" 
        @click="exportPdf"
        :disabled="!filteredDocs.length"
      >
        <span class="btn-icon">📄</span>
        Export PDF
      </button>
    </div>
  </header>

  <!-- Upload Section -->
  <div class="upload-section">
    <div 
      class="upload-area"
      :class="{ 'upload-area--dragover': isDragOver, 'upload-area--uploading': isUploading }"
      @drop="onDrop"
      @dragover.prevent="isDragOver = true"
      @dragleave.prevent="isDragOver = false"
      @click="triggerFileInput"
    >
      <input
        ref="fileInput"
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
          {{ isUploading ? 'Uploading Documents...' : 'Upload Project Documents' }}
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
          class="btn btn-positive"
          :disabled="isUploading || !selectedFiles.length"
          @click="uploadProjectDocs"
        >
          {{ isUploading ? 'Uploading…' : 'Upload Selected Files' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Search Section -->
  <section v-if="!isLoading" class="search-filter-section">
    <div class="filter-container ui-filter-bar">
      <div class="search-section" style="flex:1">
        <input
          v-model="searchTerm"
          placeholder="Search documents…"
          class="search-input"
        />
      </div>
    </div>
  </section>

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
    <div class="docs-header">
      <h3 class="docs-title">{{ filteredDocs.length }} Document{{ filteredDocs.length === 1 ? '' : 's' }}</h3>
    </div>

    <div class="docs-list">
      <div v-for="doc in filteredDocs" :key="doc.id" class="doc-card">
        <div class="doc-header">
          <div class="doc-icon">
            {{ getFileIcon(doc.mime_type) }}
          </div>
          <div class="doc-info">
            <div class="doc-title-row">
              <a @click.prevent="viewDoc(doc)" href="#" class="doc-link">
                {{ doc.file_name }}
              </a>
            <div class="doc-actions">
                <button 
                  @click="viewDoc(doc)" 
                  class="btn btn-primary action-btn view-btn"
                  title="View document"
                >
                  👁
                </button>
                <button 
                  @click="downloadDoc(doc)" 
                  class="btn btn-positive action-btn download-btn"
                  title="Download document"
                >
                  📥
                </button>
              <button
                @click="deleteDoc(doc)"
                class="btn btn-warning action-btn"
                title="Delete document"
              >
                🗑
              </button>
              </div>
            </div>
            <div class="doc-meta">
              <span class="meta-item">{{ mimeLabel(doc.mime_type) }}</span>
              <span class="meta-item">📅 {{ formatDate(doc.inserted_at) }}</span>
              <span v-if="doc.uploaded_by" class="meta-item">👤 {{ doc.uploaded_by }}</span>
            </div>
          </div>
        </div>
        <div class="description">{{ doc.description || '—' }}</div>
      </div>
    </div>
  </section>

  <!-- Empty State -->
  <div v-else-if="!isLoading" class="empty-state">
    <div class="empty-icon">📁</div>
    <h3 class="empty-title">No Documents Found</h3>
    <p class="empty-description">
      No documents found for this project/stage. Upload some documents to get started.
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
          <div v-if="isPdf(previewDoc?.mime_type)" class="pdf-viewer">
            <div v-if="pdfLoading" class="preview-unsupported"><p>Loading PDF…</p></div>
            <div v-else-if="pdfError" class="preview-unsupported"><p>{{ pdfError }}</p></div>
            <div v-else class="pdf-pages" ref="pdfPagesContainer"></div>
          </div>
          <div v-else class="preview-unsupported">
            <p>Preview not available for this file type.</p>
            <a :href="previewDoc?.url" target="_blank">Open in new tab</a>
          </div>
        </div>
        <div class="preview-modal-footer">
          <button class="btn btn-positive" @click="printPreview">Print</button>
          <button class="btn btn-warning" @click="closePreviewModal">Close</button>
        </div>
      </div>
    </div>
  </teleport>
</div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { supabase } from '@/supabase'
import ProjectBreadcrumbs from '@/components/ProjectBreadcrumbs.vue'
// pdf.js for streaming multi-page preview
import * as pdfjsLib from 'pdfjs-dist/build/pdf'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url'

// ─── ROUTER & STATE ────────────────────────────────────────────────────────────
const route      = useRoute()
const router     = useRouter()
const toast      = useToast()

const projectId   = route.params.id
const projectName = ref('Loading…')

const isLoading   = ref(false)
const docs        = ref([])
const searchTerm  = ref('')

// Project-level documents (no stage filtering on this page)

// ─── UPLOAD STATE ───────────────────────────────────────────────────────────────
const selectedFiles = ref([])
const isUploading   = ref(false)
const isDragOver    = ref(false)
const uploadProgress = ref(0)
const fileInput     = ref(null)

const allowedMimes = [
'application/pdf',
'application/msword',
'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
'application/vnd.ms-excel',
'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
'text/plain'
]

// Navigate back to the locations page
function goBack() {
router.push({ name: 'ProjectLocations', params: { id: projectId } })
}

// file handling
function triggerFileInput() {
  if (!isUploading.value) {
    fileInput.value?.click()
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

// ─── MIME & DATE HELPERS ────────────────────────────────────────────────────────
function mimeLabel(mime) {
if (mime.includes('spreadsheet')) return 'Spreadsheet'
if (mime.includes('presentation')) return 'Presentation'
if (mime.includes('wordprocessingml') || mime.includes('msword')) return 'Document'
if (mime === 'application/pdf') return 'PDF'
if (mime.startsWith('text/')) return 'Text'
return 'File'
}

function formatDate(ts) {
return new Date(ts).toLocaleDateString()
}

// ─── FETCH PROJECT NAME ─────────────────────────────────────────────────────────
async function fetchProjectName() {
const { data, error } = await supabase
  .from('projects')
  .select('project_name')
  .eq('id', projectId)
  .single()

if (error) {
  console.error(error)
  projectName.value = 'Unknown Project'
} else {
  projectName.value = data.project_name
}
}

// ─── FETCH PROJECT_DOCS ─────────────────────────────────────────────────────────
async function fetchProjectDocs() {
isLoading.value = true

try {
  const { data, error } = await supabase
    .from('project_docs')
    .select(`
      id,
      file_name,
      mime_type,
      description,
      inserted_at,
      file_path,
      uploaded_by,
      order
    `)
    .eq('project_id', projectId)
    .order('order', { ascending: true })
  if (error) throw error

  // Build signed URLs for each document
  docs.value = await Promise.all(
    data.map(async (d) => {
      const { data: urlData, error: urlError } = await supabase.storage
        .from('stage-docs')
        .createSignedUrl(d.file_path, 3600)
      if (urlError) throw urlError

      return {
        id:          d.id,
        file_name:   d.file_name,
        mime_type:   d.mime_type,
        description: d.description,
        inserted_at: d.inserted_at,
        uploaded_by: d.uploaded_by || null,
        url:         urlData.signedUrl,
        file_path:   d.file_path
      }
    })
  )
} catch (e) {
  console.error(e)
  toast.error('Failed to load documents')
} finally {
  isLoading.value = false
}
}

// ─── UPLOAD PROJECT DOCS ────────────────────────────────────────────────────────
// Upload selected files into the existing "stage-docs" bucket, then insert into project_docs
async function uploadProjectDocs() {
if (!selectedFiles.value.length) return
isUploading.value = true
uploadProgress.value = 0

// Get current max order from project_docs for this project
let { data: existing, error: exErr } = await supabase
  .from('project_docs')
  .select('order')
  .eq('project_id', projectId)
if (exErr) {
  console.error(exErr)
  toast.error('Could not determine upload order')
  isUploading.value = false
  return
}
let maxOrder = existing && existing.length
  ? Math.max(...existing.map((r) => r.order || 0))
  : 0

let successCount = 0
const totalFiles = selectedFiles.value.length

for (const file of selectedFiles.value) {
  if (!allowedMimes.includes(file.type)) {
    toast.error(`"${file.name}" not allowed`)
    continue
  }

  // Upload to "stage-docs" bucket
  const filePath = `${projectId}/${Date.now()}_${file.name}`
  const { data: upData, error: upErr } = await supabase.storage
    .from('stage-docs')
    .upload(filePath, file)
  if (upErr) {
    console.error(upErr)
    toast.error(upErr.message)
    continue
  }

  // Insert new row into project_docs
  maxOrder++
  const { error: dbErr } = await supabase
    .from('project_docs')
    .insert({
      project_id:  projectId,
      file_path:   upData.path,
      file_name:   file.name,
      mime_type:   file.type,
      description: '',
      order:       maxOrder
    })
  if (dbErr) {
    console.error(dbErr)
    toast.error(dbErr.message)
    continue
  }

  successCount++
  uploadProgress.value = Math.round((successCount / totalFiles) * 100)
}

// Reset file input
selectedFiles.value = []
fileInput.value.value = null
uploadProgress.value = 0

toast.success(`${successCount} file(s) uploaded to project docs`)
isUploading.value = false
}

// ─── VIEW DOCUMENT ─────────────────────────────────────────────────────────
const showPreviewModal = ref(false)
const previewDoc = ref(null)
function isPdf(mime) { return mime && mime.includes('pdf') }
function viewDoc(doc) {
  previewDoc.value = doc
  showPreviewModal.value = true
  if (isPdf(doc.mime_type)) {
    renderPdf(doc.url)
  }
}
function closePreviewModal() {
  showPreviewModal.value = false
  previewDoc.value = null
  cleanupPdf()
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

// ─── PDF.JS RENDERING ───────────────────────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker
const pdfLoading = ref(false)
const pdfError = ref('')
const pdfDocRef = ref(null)
const pdfPagesContainer = ref(null)

async function renderPdf(url) {
  pdfLoading.value = true
  pdfError.value = ''
  await nextTick()
  cleanupPdf()
  try {
    const loadingTask = pdfjsLib.getDocument({ url, withCredentials: false, rangeChunkSize: 65536 })
    const pdf = await loadingTask.promise
    pdfDocRef.value = pdf
    const container = pdfPagesContainer.value
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: 1.25 })
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = viewport.width + 'px'
      canvas.style.height = viewport.height + 'px'
      container.appendChild(canvas)
      await page.render({ canvasContext: context, viewport }).promise
    }
  } catch (e) {
    console.error('PDF preview error', e)
    pdfError.value = 'Failed to load PDF preview'
  } finally {
    pdfLoading.value = false
  }
}

function cleanupPdf() {
  const container = pdfPagesContainer.value
  if (container) container.innerHTML = ''
  if (pdfDocRef.value) {
    try { pdfDocRef.value.destroy() } catch (_) {}
    pdfDocRef.value = null
  }
}

onBeforeUnmount(() => cleanupPdf())

// ─── DOWNLOAD DOCUMENT ─────────────────────────────────────────────────────────
async function downloadDoc(doc) {
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

// ─── DELETE DOCUMENT ─────────────────────────────────────────────────────────────
async function deleteDoc(doc) {
  if (!confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return
  try {
    // Remove from storage first
    const { error: rmErr } = await supabase.storage
      .from('stage-docs')
      .remove([doc.file_path])
    if (rmErr) throw rmErr

    // Remove row from project_docs
    const { error: dbErr } = await supabase
      .from('project_docs')
      .delete()
      .eq('id', doc.id)
    if (dbErr) throw dbErr

    // Update local list
    docs.value = docs.value.filter((d) => d.id !== doc.id)
    toast.success('Document deleted')
  } catch (e) {
    console.error('Delete failed', e)
    toast.error('Failed to delete document')
  }
}

// ─── COMPUTED FILTER ────────────────────────────────────────────────────────────
const filteredDocs = computed(() => {
const term = searchTerm.value.trim().toLowerCase()
if (!term) return docs.value

return docs.value.filter((d) =>
  d.file_name.toLowerCase().includes(term) ||
  (d.description || '').toLowerCase().includes(term)
)
})

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
    doc.text('Project Documents', margin, y)
    y += 24
    doc.setFontSize(12)
    doc.text(`Project: ${projectName.value}`, margin, y)
    y += 32

    for (const docItem of filteredDocs.value) {
      if (y + 80 > doc.internal.pageSize.getHeight()) {
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
      doc.text(`Venue: ${docItem.venue_name}`, margin, y)
      y += 16
      doc.text(`Stage: ${docItem.stage_name}`, margin, y)
      y += 16
      if (docItem.uploaded_by) {
        doc.text(`Uploaded by: ${docItem.uploaded_by}`, margin, y)
        y += 16
      }
      
      if (docItem.description && docItem.description !== '—') {
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
await fetchProjectName()
await fetchProjectDocs()
})
</script>

<style scoped>
/* Base Styles */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  background: #f8fafc;
  min-height: 100vh;
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
  color: #6b7280;
}

.breadcrumb-text {
  color: #6b7280;
}

/* Header Section */
.header-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
  padding: 24px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.header-content {
  flex: 1;
}

.header-title {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 8px 0;
}

.header-subtitle {
  color: #6b7280;
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
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background: #e5e7eb;
}

.btn-primary {
  background: #2563eb;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #1e40af;
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
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  padding: 48px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: white;
}

.upload-area:hover {
  border-color: #3b82f6;
  background: #f8fafc;
}

.upload-area--dragover {
  border-color: #3b82f6;
  background: #eff6ff;
}

.upload-area--uploading {
  border-color: #10b981;
  background: #f0fdf4;
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
  color: #1f2937;
  margin: 0 0 8px 0;
}

.upload-subtitle {
  color: #6b7280;
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
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: #10b981;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

/* Selected Files */
.selected-files {
  margin-top: 24px;
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.selected-files-title {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
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
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
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
  color: #1f2937;
  margin: 0 0 4px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 12px;
  color: #6b7280;
  margin: 0;
}

.file-remove {
  background: #fef2f2;
  color: #dc2626;
  border: none;
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
  background: #fecaca;
}

/* Upload Button */
.selected-files-upload-btn {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

/* Search & Filter Section */
.search-filter-section {
  margin-bottom: 32px;
}

.filter-container {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  gap: 24px;
  align-items: end;
}

.stage-filter {
  display: flex;
  flex-direction: column;
  min-width: 200px;
}

.filter-label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
}

.select-stage {
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  font-size: 14px;
  transition: border-color 0.2s ease;
}

.select-stage:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-section {
  flex: 1;
}

.search-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
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
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.skeleton-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
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
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
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

.docs-header {
  margin-bottom: 24px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.docs-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
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
  background: white;
  border: 1px solid #e5e7eb;
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
  color: #3b82f6;
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
  background: #f3f4f6;
  color: #374151;
  border: none;
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
  background: #e5e7eb;
  transform: scale(1.05);
}

.view-btn:hover {
  background: #dbeafe;
  color: #2563eb;
}

.download-btn:hover {
  background: #dcfce7;
  color: #16a34a;
}

.doc-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.meta-item {
  font-size: 12px;
  color: #6b7280;
}

.description {
  color: #374151;
  line-height: 1.5;
  margin: 0;
  font-size: 14px;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 64px 24px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 24px;
}

.empty-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 12px 0;
}

.empty-description {
  color: #6b7280;
  margin: 0;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}

/* Responsive Design */
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
  
  .filter-container {
    flex-direction: column;
    gap: 16px;
  }
  
  .stage-filter {
    min-width: auto;
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
  background: #fff;
  border-radius: 12px;
  max-width: 90vw;
  max-height: 90vh;
  width: 700px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.preview-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #e5e7eb;
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
.preview-modal-body {
  flex: 1;
  padding: 0;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-iframe {
  width: 100%;
  height: 70vh;
  border: none;
  background: #fff;
}
.pdf-viewer { width: 100%; height: 70vh; overflow: auto; background: #fff; padding: 16px; }
.pdf-pages { display: flex; flex-direction: column; gap: 12px; align-items: center; }
.preview-unsupported {
  padding: 32px;
  text-align: center;
  color: #6b7280;
}
.preview-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

.preview-modal-footer .btn {
  color: white;
}
</style>