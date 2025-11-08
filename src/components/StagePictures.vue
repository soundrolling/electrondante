<!-- src/components/StagePictures.vue -->
<template>
<div class="container">
  <!-- Breadcrumb Navigation -->
  <nav class="breadcrumb">
    <button class="breadcrumb-item" @click="goBack">← Back</button>
    <span class="breadcrumb-separator">/</span>
    <select v-model="selectedStageId" @change="onStageDropdownChange" class="stage-dropdown">
      <option v-for="s in allStages" :key="s.id" :value="s.id">{{ s.stage_name }}</option>
    </select>
  </nav>

  <!-- Header Section -->
  <header class="header-section">
    <div class="header-content">
      <h1 class="header-title">{{ stageName }} Pictures</h1>
      <p class="header-subtitle">Venue: {{ venueName }}</p>
    </div>
    <div class="header-actions">
      <button 
        class="btn btn-secondary" 
        @click="exportPdf"
        :disabled="!images.length"
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
        accept="image/*"
        multiple
        @change="onFileChange"
        class="upload-input"
        :disabled="isUploading"
      />
      
      <div class="upload-content">
        <div class="upload-icon">📷</div>
        <h3 class="upload-title">
          {{ isUploading ? 'Uploading Images...' : 'Upload Stage Pictures' }}
        </h3>
        <p class="upload-subtitle">
          {{ isUploading ? 'Please wait while we process your images' : 'Drag & drop images here or click to browse' }}
        </p>
        
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
          <img 
            :src="getFilePreview(file)" 
            :alt="file.name"
            class="file-preview"
          />
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
          @click="uploadImages"
        >
          {{ isUploading ? 'Uploading…' : 'Upload Selected Images' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Loading State -->
  <div v-if="isLoading" class="loading-section">
    <div class="loading-skeleton">
      <div class="skeleton-card" v-for="n in 6" :key="n">
        <div class="skeleton-image"></div>
        <div class="skeleton-content">
          <div class="skeleton-line"></div>
          <div class="skeleton-line skeleton-line--short"></div>
        </div>
      </div>
    </div>
  </div>


  <!-- Images Grid -->
  <div v-else-if="images.length" class="images-section">
    <div class="images-header">
      <h3 class="images-title">{{ images.length }} Image{{ images.length === 1 ? '' : 's' }}</h3>
      <div class="images-actions">
        <button 
          class="btn btn-outline"
          @click="toggleBulkMode"
          :class="{ 'btn-outline--active': bulkMode }"
        >
          {{ bulkMode ? 'Cancel' : 'Select Multiple' }}
        </button>
        <button 
          v-if="bulkMode"
          class="btn btn-secondary"
          @click="exportSelectedPdf"
          :disabled="!selectedImages.length"
        >
          <span class="btn-icon">📄</span>
          Export Selected ({{ selectedImages.length }})
        </button>
        <button 
          v-if="bulkMode"
          class="btn btn-danger"
          @click="deleteSelectedImages"
          :disabled="!selectedImages.length"
        >
          Delete Selected ({{ selectedImages.length }})
        </button>
      </div>
    </div>

    <div class="images-grid">
      <div
        v-for="(img, idx) in images"
        :key="img.id"
        class="card"
        :class="{ 'image-card--selected': selectedImages.includes(img.id) }"
      >
        <!-- Image Container -->
        <div class="image-container">
          <!-- Bulk Selection Checkbox -->
          <div v-if="bulkMode" class="image-overlay">
            <input
              type="checkbox"
              :checked="selectedImages.includes(img.id)"
              @change="toggleImageSelection(img.id)"
              class="image-checkbox"
            />
          </div>
          
          <img 
            :src="img.url" 
            :alt="img.name || 'Stage picture'"
            class="image-preview"
            :class="{ 'image-preview--selectable': bulkMode }"
            @click="bulkMode ? toggleImageSelection(img.id) : viewImage(img.file_path)"
            @load="onImageLoad"
          />
          <!-- Tiles Row: Date, Size, and Uploader -->
          <div class="image-tiles-row">
            <span class="image-tile">
              📅 {{ formatDate(img.created_at) }}
            </span>
            <span class="image-tile">
              📦 {{ img.size ? formatFileSize(img.size) : 'Unknown size' }}
            </span>
            <span v-if="img.uploaded_by" class="image-tile">
              👤 {{ img.uploaded_by }}
            </span>
          </div>
          <!-- Editing Canvas Overlay & Toolbar -->
          <div v-if="editingCardId === img.id" class="edit-img-canvas-stack">
            <canvas
              ref="el => setEditCanvasRef(img.id, el)"
              class="edit-img-canvas"
              :width="img.naturalWidth || 0"
              :height="img.naturalHeight || 0"
            ></canvas>
            <div class="edit-toolbar">
              <button @click="enableAddText(img)">Add Text</button>
              <button @click="enableFreeDraw(img)">Free Draw</button>
              <button @click="enableCrop(img)">Crop</button>
              <button @click="() => saveEditedImage(img)" class="save-btn">Save</button>
              <button @click="() => revertImage(img)" class="revert-btn">Revert</button>
              <button @click="closeEditMode">Close</button>
            </div>
          </div>
        </div>

        <!-- Unified Action Row -->
        <div class="card-action-row">
          <button class="card-action-btn" @click="viewImage(img.file_path)" :title="'View full image'">
            <span class="card-action-icon">👁️</span>
          </button>
          <button class="card-action-btn" @click="toggleEditMode(img)" :title="'Edit image'">
            <span class="card-action-icon">✏️</span>
          </button>
          <div class="move-action-wrap">
            <button class="card-action-btn" @click="openMoveDropdown(img.id)" :title="'Move to another stage'">
              <span class="card-action-icon">⇄</span>
            </button>
            <div v-if="moveDropdownOpen === img.id" class="move-stage-dropdown-pop">
              <select v-model="img.stage_id" @change="moveImageToStage(img, img.stage_id)" class="move-stage-dropdown">
                <option v-for="s in allStages" :key="s.id" :value="s.id">{{ s.stage_name }}</option>
              </select>
              <button class="move-stage-cancel" @click="closeMoveDropdown">Cancel</button>
            </div>
          </div>
          <button class="card-action-btn card-action-btn--delete" @click="confirmRemoveImage(img)" :title="'Delete photo'">
            <span class="card-action-icon">🗑️</span>
          </button>
        </div>

        <!-- Image Details -->
        <div class="image-details">
          <div class="image-order">
            <button
              class="order-btn"
              @click="moveImageUp(img, idx)"
              :disabled="idx === 0"
              title="Move up"
            >
              ↑
            </button>
            <span class="order-number">{{ idx + 1 }}</span>
            <button
              class="order-btn"
              @click="moveImageDown(img, idx)"
              :disabled="idx === images.length - 1"
              title="Move down"
            >
              ↓
            </button>
          </div>

          <input
            v-model="img.name"
            placeholder="Image name"
            class="input-field"
            @blur="updateImage(img)"
          />
          <textarea
            v-model="img.description"
            placeholder="Description"
            class="textarea-field"
            @blur="updateImage(img)"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- Empty State -->
  <div v-else class="empty-state">
    <div class="empty-icon">📷</div>
    <h3 class="empty-title">No Images Yet</h3>
    <p class="empty-description">
      Upload some pictures to get started with documenting this stage.
    </p>
  </div>
</div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '@/supabase';
import { useToast } from 'vue-toastification';
import jsPDF from 'jspdf';
import { useUserStore } from '@/stores/userStore';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const userStore = useUserStore();

// Pull IDs from route
const projectId = route.params.id;
const venueId = route.query.venueId;
const stageId = route.query.stageId;

// Reactive state
const venueName = ref('Loading…');
const stageName = ref('Loading…');
const projectName = ref('Loading…');
const images = ref([]);
const selectedFiles = ref([]);
const isLoading = ref(false);
const isUploading = ref(false);
const isDragOver = ref(false);
const uploadProgress = ref(0);
const bulkMode = ref(false);
const selectedImages = ref([]);

const fileInput = ref(null);
const editingCardId = ref(null);
const editCanvasRefs = ref({});

// Stages for dropdown
const allStages = ref([]);
const selectedStageId = ref(stageId);

// Computed properties
const hasImages = computed(() => images.value.length > 0);
const hasSelectedFiles = computed(() => selectedFiles.value.length > 0);

// Navigation
const goBack = () => router.back();

// File handling
function triggerFileInput() {
  if (!isUploading.value) {
    fileInput.value?.click();
  }
}

function onFileChange(e) {
  const files = Array.from(e.target.files);
  validateAndAddFiles(files);
}

function onDrop(e) {
  isDragOver.value = false;
  const files = Array.from(e.dataTransfer.files);
  validateAndAddFiles(files);
}

function validateAndAddFiles(files) {
  const validFiles = files.filter(file => {
    if (!file.type.startsWith('image/')) {
      toast.error(`${file.name} is not an image file`);
      return false;
    }
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error(`${file.name} is too large (max 10MB)`);
      return false;
    }
    return true;
  });
  
  selectedFiles.value.push(...validFiles);
}

function removeSelectedFile(index) {
  selectedFiles.value.splice(index, 1);
}

function getFilePreview(file) {
  return URL.createObjectURL(file);
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Data fetching
async function fetchNames() {
  try {
    const { data: p } = await supabase
      .from('projects')
      .select('project_name')
      .eq('id', projectId)
      .single();
    if (p) projectName.value = p.project_name;

    const { data: v } = await supabase
      .from('venues')
      .select('venue_name')
      .eq('id', venueId)
      .single();
    if (v) venueName.value = v.venue_name;

    const { data: s } = await supabase
      .from('locations')
      .select('stage_name')
      .eq('id', stageId)
      .single();
    if (s) stageName.value = s.stage_name;
  } catch (error) {
    console.error('Error fetching names:', error);
    toast.error('Could not load venue and stage information');
  }
}

async function fetchImages() {
  isLoading.value = true;
  try {
    const { data, error } = await supabase
      .from('stage_pictures')
      .select('*')
      .eq('project_id', projectId)
      .eq('venue_id', venueId)
      .eq('stage_id', stageId)
      .order('order', { ascending: true });
    
    if (error) throw error;

    const loaded = [];
    for (const img of data) {
      let url = supabase.storage
        .from('stage-pictures')
        .getPublicUrl(img.file_path).publicURL;
      
      if (!url) {
        const { data: signed } = await supabase.storage
          .from('stage-pictures')
          .createSignedUrl(img.file_path, 3600);
        url = signed.signedUrl;
      }
      // Try to get file size from storage metadata if not present
      let size = img.size;
      if (!size) {
        try {
          const { data: meta } = await supabase.storage
            .from('stage-pictures')
            .list(img.file_path.substring(0, img.file_path.lastIndexOf('/')) || '', { limit: 100 });
          if (meta && Array.isArray(meta)) {
            const found = meta.find(f => f.name === img.file_path.split('/').pop());
            if (found && found.metadata && found.metadata.size) {
              size = found.metadata.size;
            } else if (found && found.size) {
              size = found.size;
            }
          }
        } catch {}
      }
      loaded.push({ ...img, url, size });
    }
    images.value = loaded;
  } catch (error) {
    console.error('Error fetching images:', error);
    toast.error('Could not load images');
  } finally {
    isLoading.value = false;
  }
}

// Upload functionality
async function uploadStorageFile(file) {
  const path = `projects/${projectId}/venues/${venueId}/stages/${stageId}/${Date.now()}_${file.name}`;
  const { data, error } = await supabase.storage
    .from('stage-pictures')
    .upload(path, file);
  return { path: data?.path, error };
}

async function uploadImages() {
  if (!selectedFiles.value.length) return;
  
  isUploading.value = true;
  uploadProgress.value = 0;

  const totalFiles = selectedFiles.value.length;
  let uploadedCount = 0;

  // Determine current max order
  let maxOrder = images.value.length
    ? Math.max(...images.value.map(i => i.order ?? 0))
    : 0;

  // Get uploader name/email from user store
  const uploader = userStore.user?.name || userStore.user?.email || 'Unknown';

  for (const file of selectedFiles.value) {
    try {
      const { path, error: upErr } = await uploadStorageFile(file);
      if (upErr) {
        toast.error(`Upload failed for ${file.name}: ${upErr.message}`);
        continue;
      }

      maxOrder++;
      const { error: dbErr } = await supabase
        .from('stage_pictures')
        .insert([{
          project_id: projectId,
          venue_id: venueId,
          stage_id: stageId,
          file_path: path,
          name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension for default name
          description: '',
          order: maxOrder,
          created_at: new Date().toISOString(),
          uploaded_by: uploader // <-- requires DB column
        }]);

      if (dbErr) {
        toast.error(`Save failed for ${file.name}: ${dbErr.message}`);
        continue;
      }

      uploadedCount++;
      uploadProgress.value = Math.round((uploadedCount / totalFiles) * 100);
    } catch (error) {
      toast.error(`Error uploading ${file.name}: ${error.message}`);
    }
  }

  // Reset upload state
  selectedFiles.value = [];
  if (fileInput.value) fileInput.value.value = null;
  uploadProgress.value = 0;
  isUploading.value = false;

  if (uploadedCount > 0) {
    toast.success(`${uploadedCount} image${uploadedCount === 1 ? '' : 's'} uploaded successfully`);
    await fetchImages();
  }
}

// Image management
async function updateImage(img) {
  try {
    const { error } = await supabase
      .from('stage_pictures')
      .update({ name: img.name, description: img.description })
      .eq('id', img.id);
    
    if (error) {
      toast.error(`Save failed: ${error.message}`);
    } else {
      toast.success('Image updated');
    }
  } catch (error) {
    toast.error('Error updating image');
  }
}

async function removeImage(img) {
  // Remove from Supabase storage
  const { error: remErr } = await supabase.storage
    .from('stage-pictures').remove([img.file_path]);
  if (remErr) {
    toast.error(`Delete failed: ${remErr.message}`);
    return;
  }
  // Remove from DB
  const { error: delErr } = await supabase
    .from('stage_pictures').delete().eq('id', img.id);
  if (delErr) toast.error(`Delete failed: ${delErr.message}`);
  else {
    toast.success('Deleted');
    await fetchImages();
  }
}

// Bulk operations
function toggleBulkMode() {
  bulkMode.value = !bulkMode.value;
  selectedImages.value = [];
}

function toggleImageSelection(imageId) {
  const index = selectedImages.value.indexOf(imageId);
  if (index > -1) {
    selectedImages.value.splice(index, 1);
  } else {
    selectedImages.value.push(imageId);
  }
}

async function deleteSelectedImages() {
  if (!selectedImages.value.length) return;
  
  if (!confirm(`Are you sure you want to delete ${selectedImages.value.length} image${selectedImages.value.length === 1 ? '' : 's'}?`)) {
    return;
  }

  const imagesToDelete = images.value.filter(img => selectedImages.value.includes(img.id));
  
  for (const img of imagesToDelete) {
    await removeImage(img);
  }
  
  selectedImages.value = [];
  bulkMode.value = false;
}

// Reordering
async function swapOrder(a, b) {
  const oa = a.order, ob = b.order;
  
  try {
    const { error: e1 } = await supabase
      .from('stage_pictures')
      .update({ order: ob })
      .eq('id', a.id);
    
    const { error: e2 } = await supabase
      .from('stage_pictures')
      .update({ order: oa })
      .eq('id', b.id);
    
    if (e1 || e2) {
      console.error(e1 || e2);
      toast.error('Reorder failed');
    } else {
      await fetchImages();
      toast.success('Order updated');
    }
  } catch (error) {
    toast.error('Error reordering images');
  }
}

function moveImageUp(img, idx) {
  if (idx > 0) swapOrder(img, images.value[idx - 1]);
}

function moveImageDown(img, idx) {
  if (idx < images.value.length - 1) swapOrder(img, images.value[idx + 1]);
}

// Image viewing
async function viewImage(path) {
  try {
    const { data, error } = await supabase.storage
      .from('stage-pictures')
      .createSignedUrl(path, 60);
    
    if (error) {
      toast.error(`Could not open image: ${error.message}`);
    } else {
      window.open(data.signedUrl, '_blank');
    }
  } catch (error) {
    toast.error('Error opening image');
  }
}

// Image Editing Modal State
function toggleEditMode(img) {
  if (editingCardId.value === img.id) {
    editingCardId.value = null;
  } else {
    editingCardId.value = img.id;
    nextTick(() => {
      // Optionally initialize canvas overlay here
    });
  }
}

function closeEditMode() {
  editingCardId.value = null;
}

function setEditCanvasRef(id, el) {
  if (el) editCanvasRefs.value[id] = el;
}

function enableAddText(img) { /* implement text tool for img */ }
function enableFreeDraw(img) { /* implement free draw tool for img */ }
function enableCrop(img) { /* implement crop tool for img */ }
function saveEditedImage(img) { /* implement save for img */ }
function revertImage(img) { /* implement revert for img */ }

// Utility functions
function formatDate(dateString) {
  if (!dateString) return 'Unknown';
  return new Date(dateString).toLocaleDateString();
}

function onImageLoad(event) {
  const img = event.target;
  const dimensions = `${img.naturalWidth} × ${img.naturalHeight}`;
  
  // Find the image in our data and update dimensions
  const imageIndex = images.value.findIndex(img => img.url === event.target.src);
  if (imageIndex !== -1) {
    images.value[imageIndex].dimensions = dimensions;
  }
}

// PDF Export
async function exportPdf() {
  if (!images.value.length) {
    toast.warning('No images to export');
    return;
  }

  try {
    const doc = new jsPDF('p', 'pt', 'a4');
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = margin;
    let isFirstPage = true;

    for (const img of images.value) {
      // Check if we need a new page (account for image + text space)
      if (y + 500 > pageHeight) {
        doc.addPage();
        y = margin;
        isFirstPage = false;
      }

      // Add header on first page only
      if (isFirstPage && y === margin) {
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.text(projectName.value || 'Project', margin, y);
        y += 24;
        doc.setFontSize(14);
        doc.setFont(undefined, 'normal');
        doc.text(stageName.value || 'Stage', margin, y);
        y += 32;
        isFirstPage = false;
      }

      const blob = await (await fetch(img.url)).blob();
      const dataUrl = await new Promise(r => {
        const fr = new FileReader();
        fr.onload = () => r(fr.result);
        fr.readAsDataURL(blob);
      });
      
      const htmlImg = new Image();
      await new Promise(r => {
        htmlImg.onload = r;
        htmlImg.src = dataUrl;
      });

      const maxH = 400;
      const maxW = pageWidth - (margin * 2);
      const scale = Math.min(1, maxH / htmlImg.height, maxW / htmlImg.width);
      const imgW = htmlImg.width * scale;
      const imgH = htmlImg.height * scale;
      
      // Center the image horizontally
      const imgX = margin + (maxW - imgW) / 2;

      // Add the image
      doc.addImage(dataUrl, 'PNG', imgX, y, imgW, imgH);
      y += imgH + 12;

      // Add description if it exists
      if (img.description && img.description.trim()) {
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        const descLines = doc.splitTextToSize(
          img.description,
          pageWidth - (margin * 2)
        );
        doc.text(descLines, margin, y);
        y += descLines.length * 14;
      }

      y += 20; // Space before next image
    }

    doc.save(`${stageName.value.replace(/\s+/g, '_')}_Pictures.pdf`);
    toast.success('PDF exported successfully');
  } catch (error) {
    console.error('PDF export error:', error);
    toast.error('Failed to export PDF');
  }
}

// Bulk PDF Export for selected images
async function exportSelectedPdf() {
  if (!selectedImages.value.length) {
    toast.warning('No images selected for export');
    return;
  }

  try {
    const doc = new jsPDF('p', 'pt', 'a4');
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = margin;
    let isFirstPage = true;

    // Get only selected images
    const selectedImagesData = images.value.filter(img => selectedImages.value.includes(img.id));

    for (const img of selectedImagesData) {
      // Check if we need a new page (account for image + text space)
      if (y + 500 > pageHeight) {
        doc.addPage();
        y = margin;
        isFirstPage = false;
      }

      // Add header on first page only
      if (isFirstPage && y === margin) {
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.text(projectName.value || 'Project', margin, y);
        y += 24;
        doc.setFontSize(14);
        doc.setFont(undefined, 'normal');
        doc.text(stageName.value || 'Stage', margin, y);
        y += 32;
        isFirstPage = false;
      }

      const blob = await (await fetch(img.url)).blob();
      const dataUrl = await new Promise(r => {
        const fr = new FileReader();
        fr.onload = () => r(fr.result);
        fr.readAsDataURL(blob);
      });
      
      const htmlImg = new Image();
      await new Promise(r => {
        htmlImg.onload = r;
        htmlImg.src = dataUrl;
      });

      const maxH = 400;
      const maxW = pageWidth - (margin * 2);
      const scale = Math.min(1, maxH / htmlImg.height, maxW / htmlImg.width);
      const imgW = htmlImg.width * scale;
      const imgH = htmlImg.height * scale;
      
      // Center the image horizontally
      const imgX = margin + (maxW - imgW) / 2;

      // Add the image
      doc.addImage(dataUrl, 'PNG', imgX, y, imgW, imgH);
      y += imgH + 12;

      // Add description if it exists
      if (img.description && img.description.trim()) {
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        const descLines = doc.splitTextToSize(
          img.description,
          pageWidth - (margin * 2)
        );
        doc.text(descLines, margin, y);
        y += descLines.length * 14;
      }

      y += 20; // Space before next image
    }

    doc.save(`${stageName.value.replace(/\s+/g, '_')}_Selected_Pictures.pdf`);
    toast.success(`PDF exported successfully with ${selectedImages.value.length} selected image${selectedImages.value.length === 1 ? '' : 's'}`);
  } catch (error) {
    console.error('PDF export error:', error);
    toast.error('Failed to export selected images as PDF');
  }
}

function confirmRemoveImage(img) {
  if (!window.confirm('Are you sure you want to delete this photo? This cannot be undone.')) return;
  removeImage(img);
}

// Stages for dropdown
async function fetchAllStages() {
  // Fetch all stages for the current project (include venue_id)
  const { data, error } = await supabase
    .from('locations')
    .select('id, stage_name, venue_id')
    .eq('project_id', projectId)
    .order('stage_name');
  if (!error && data) {
    allStages.value = data;
  }
}

function onStageDropdownChange() {
  // Find the selected stage's venueId
  const selectedStage = allStages.value.find(s => s.id == selectedStageId.value);
  const newVenueId = selectedStage ? selectedStage.venue_id : venueId;
  // Update the route/query to show the selected stage's pictures and venue
  router.replace({
    name: 'StagePictures',
    params: { id: projectId },
    query: { venueId: newVenueId, stageId: selectedStageId.value }
  });
}

const moveDropdownOpen = ref(null); // Holds the img.id of the open dropdown

function openMoveDropdown(imgId) {
  moveDropdownOpen.value = imgId;
}
function closeMoveDropdown() {
  moveDropdownOpen.value = null;
}
async function moveImageToStage(img, newStageId) {
  if (img.stage_id === newStageId) {
    closeMoveDropdown();
    return;
  }
  const { error } = await supabase
    .from('stage_pictures')
    .update({ stage_id: newStageId })
    .eq('id', img.id);
  if (error) {
    toast.error('Failed to move image: ' + error.message);
  } else {
    toast.success('Image moved to new stage!');
    await fetchImages();
  }
  closeMoveDropdown();
}

// Initialize
onMounted(async () => {
  await fetchNames();
  await fetchImages();
  await fetchAllStages();
});

watch(() => route.query.stageId, async (newVal) => {
  selectedStageId.value = newVal;
  await fetchNames();
  await fetchImages();
});
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
  color: var(--color-primary-500);
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

/* Header Section */
.header-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 18px;
  padding: 12px 14px;
  background: var(--bg-primary);
  border-radius: 10px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.07);
  border: 1px solid var(--border-light);
}

.header-content {
  flex: 1;
}

.header-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 4px 0;
}

.header-subtitle {
  color: var(--text-secondary);
  margin: 0;
  font-size: 0.95rem;
  font-weight: 400;
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
  color: inherit;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-medium);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.btn-outline {
  background: transparent;
  color: #3b82f6 !important;
  border: 1px solid #3b82f6;
}

.btn-outline:hover:not(:disabled) {
  background: var(--color-primary-500);
  color: var(--text-inverse) !important;
}

.btn-outline--active {
  background: #3b82f6 !important;
  color: #ffffff !important;
}

.btn-danger {
  background: var(--color-error-500) !important;
  color: var(--text-inverse) !important;
}

.btn-danger:hover:not(:disabled) {
  background: var(--color-error-600) !important;
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

.file-preview {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 4px;
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

.btn-primary {
  background: #2563eb;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary:hover:not(:disabled) {
  background: #1e40af;
  color: #ffffff;
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

.skeleton-image {
  width: 100%;
  height: 200px;
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

/* Images Section */
.images-section {
  margin-bottom: 32px;
}

.images-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  padding: 10px 12px;
  background: var(--bg-primary);
  border-radius: 10px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.07);
  border: 1px solid var(--border-light);
}

.images-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
}

.images-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 24px;
}

/* Image Card */
.card {
  background: var(--bg-primary);
  border: 2px solid var(--border-medium);
  border-radius: 16px;
  padding: 16px 16px 0 16px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.07);
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 18px;
  position: relative;
}

.image-container {
  position: relative;
  overflow: hidden;
}

.image-preview {
  width: 100%;
  height: 250px;
  object-fit: cover;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.image-preview:hover {
  transform: scale(1.05);
}

.image-overlay {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
}

.image-checkbox {
  width: 24px;
  height: 24px;
  cursor: pointer;
  accent-color: #3b82f6;
  transform: scale(1.2);
}

.image-preview--selectable {
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.image-preview--selectable:hover {
  opacity: 0.8;
}

.image-card--selected {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.card-action-row {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 4px;
  background: var(--bg-secondary);
  border-radius: 0 0 12px 12px;
  padding: 6px 8px 0 8px;
  margin: 0;
  border-top: 1px solid var(--border-light);
}
.card-action-btn {
  flex: 1 1 0;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-medium);
  border-radius: 7px;
  padding: 8px 0;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, border 0.2s;
  min-width: 0;
  box-sizing: border-box;
  height: 36px;
}
.card-action-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-medium);
}
.card-action-btn--delete {
  background: #dc2626;
  color: #ffffff;
  border-color: #dc2626;
}
.card-action-btn--delete:hover {
  background: #b91c1c;
  border-color: #b91c1c;
  color: #ffffff;
}
.card-action-icon {
  font-size: 22px;
}
.move-action-wrap {
  position: relative;
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.move-stage-dropdown-pop {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-primary);
  border: 1.5px solid var(--border-medium);
  border-radius: 10px;
  padding: 10px 12px;
  position: absolute;
  z-index: 10;
  top: 110%;
  left: 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.move-stage-dropdown {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1.5px solid var(--border-medium);
  font-size: 1rem;
  min-width: 120px;
  background: var(--bg-primary);
  color: var(--text-primary);
}
.move-stage-cancel {
  background: none;
  color: #dc2626;
  border: none;
  font-size: 15px;
  cursor: pointer;
  padding: 0 8px;
}
.move-stage-cancel:hover {
  text-decoration: underline;
}

.image-details {
  padding: 20px;
}

.image-order {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.order-btn {
  background: var(--bg-secondary);
  color: var(--text-primary);
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
}

.order-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
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

.input-field,
.textarea-field {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
  margin-bottom: 12px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.input-field:focus,
.textarea-field:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.textarea-field {
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
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
@media (max-width: 768px) {
  .container {
    padding: 16px;
  }
  
  .header-section {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
    padding: 10px 6px;
  }
  
  .header-actions {
    justify-content: flex-start;
  }
  
  .images-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .images-actions {
    justify-content: flex-start;
  }
  
  .images-grid {
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
  
  .image-details {
    padding: 16px;
  }
}

@media (max-width: 600px) {
  .card {
    padding: 10px 6px 0 6px;
    border-radius: 12px;
    gap: 8px;
  }
  .card-action-row {
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px 4px 0 4px;
    border-radius: 0 0 8px 8px;
  }
  .card-action-btn {
    font-size: 14px;
    padding: 7px 0;
    border-radius: 6px;
    height: 32px;
  }
  .move-stage-dropdown-pop {
    left: 0;
    right: 0;
    min-width: 0;
    width: 100%;
    border-radius: 8px;
  }
  .image-tiles-row {
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 4px;
    margin: 6px 0 0 0;
    padding: 0 4px 4px 4px;
  }
  .images-header {
    flex-direction: row;
    gap: 6px;
    align-items: center;
    padding: 8px 4px;
  }
  .images-title {
    margin-bottom: 0;
  }
  .images-actions {
    justify-content: flex-end;
  }
}

/* Image Editing Modal */
.edit-img-canvas-stack {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
}
.edit-img-canvas {
  position: absolute;
  top: 0; left: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  border-radius: 12px;
  z-index: 2;
}
.edit-toolbar {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  padding: 8px 16px;
  z-index: 3;
}

/* New CSS for compact image-tiles-row and image-tile */
.image-tiles-row {
  display: flex;
  gap: 6px;
  margin: 8px 0 0 0;
  padding: 0 8px 6px 8px;
  flex-wrap: wrap;
  justify-content: flex-start;
}
.image-tile {
  display: inline-flex;
  align-items: center;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-radius: 16px;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 500;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
  border: 1px solid var(--border-light);
  min-width: 0;
}
</style>