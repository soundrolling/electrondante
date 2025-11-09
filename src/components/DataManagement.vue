<template>
  <div class="data-management">
    <!-- Breadcrumb Navigation -->
    <nav class="breadcrumb">
      <button class="breadcrumb-item" @click="goBack">← Back</button>
      <span class="breadcrumb-separator">/</span>
      <span class="breadcrumb-text">Data Management</span>
    </nav>

    <!-- Header Section -->
    <header class="header-section ui-page-header">
      <div class="header-content">
        <h1 class="header-title">Data Management</h1>
        <p class="header-subtitle">Project: {{ currentProject?.project_name || projectId }}</p>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-section">
      <div class="loading-skeleton">
        <div class="skeleton-card" v-for="n in 6" :key="n"></div>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else class="content">
      <!-- Data Overview Section -->
      <section class="overview-section">
        <h2 class="section-title">Data Overview</h2>
        <div class="overview-grid">
          <div class="overview-card">
            <div class="card-icon">🎪</div>
            <div class="card-content">
              <div class="card-value">{{ dataCounts.stages }}</div>
              <div class="card-label">Stages</div>
            </div>
          </div>
          <div class="overview-card">
            <div class="card-icon">📄</div>
            <div class="card-content">
              <div class="card-value">{{ dataCounts.documents }}</div>
              <div class="card-label">Documents</div>
            </div>
          </div>
          <div class="overview-card">
            <div class="card-icon">🖼️</div>
            <div class="card-content">
              <div class="card-value">{{ dataCounts.pictures }}</div>
              <div class="card-label">Pictures</div>
            </div>
          </div>
          <div class="overview-card">
            <div class="card-icon">🔧</div>
            <div class="card-content">
              <div class="card-value">{{ dataCounts.gear }}</div>
              <div class="card-label">Gear Items</div>
            </div>
          </div>
          <div class="overview-card">
            <div class="card-icon">👥</div>
            <div class="card-content">
              <div class="card-value">{{ dataCounts.contacts }}</div>
              <div class="card-label">Contacts</div>
            </div>
          </div>
          <div class="overview-card">
            <div class="card-icon">✈️</div>
            <div class="card-content">
              <div class="card-value">{{ dataCounts.travel }}</div>
              <div class="card-label">Travel Trips</div>
            </div>
          </div>
          <div class="overview-card">
            <div class="card-icon">📅</div>
            <div class="card-content">
              <div class="card-value">{{ dataCounts.calendar }}</div>
              <div class="card-label">Calendar Events</div>
            </div>
          </div>
          <div class="overview-card">
            <div class="card-icon">🎵</div>
            <div class="card-content">
              <div class="card-value">{{ dataCounts.rushes }}</div>
              <div class="card-label">Rushes Files</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Export Selection Section -->
      <section class="export-section">
        <h2 class="section-title">Export Selection</h2>
        <div class="export-controls">
          <div class="filter-group">
            <label class="filter-label">Filter by Venue:</label>
            <select v-model="selectedVenueId" class="filter-select">
              <option value="">All Venues</option>
              <option v-for="venue in venues" :key="venue.id" :value="venue.id">
                {{ venue.venue_name }}
              </option>
            </select>
          </div>
          <div class="filter-group">
            <label class="filter-label">Filter by Stage:</label>
            <select v-model="selectedStageId" class="filter-select">
              <option value="">All Stages</option>
              <option v-for="stage in filteredStages" :key="stage.id" :value="stage.id">
                {{ stage.stage_name }}
              </option>
            </select>
          </div>
        </div>
        <div class="selection-group">
          <div class="selection-header">
            <button class="btn btn-link" @click="selectAll">Select All</button>
            <button class="btn btn-link" @click="deselectAll">Deselect All</button>
          </div>
          <div class="selection-checkboxes">
            <label class="checkbox-item">
              <input type="checkbox" v-model="exportSelections.stages" />
              <span>Stages/Locations</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" v-model="exportSelections.documents" />
              <span>Documents</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" v-model="exportSelections.pictures" />
              <span>Pictures</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" v-model="exportSelections.gear" />
              <span>Gear</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" v-model="exportSelections.contacts" />
              <span>Contacts</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" v-model="exportSelections.travel" />
              <span>Travel</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" v-model="exportSelections.calendar" />
              <span>Calendar Events</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" v-model="exportSelections.rushes" />
              <span>Rushes Files</span>
            </label>
          </div>
        </div>
        <div class="export-actions">
          <button 
            class="btn btn-primary export-button" 
            @click="handleExport"
            :disabled="!hasSelection || isExporting"
          >
            <span v-if="isExporting">⏳</span>
            <span v-else>📦</span>
            <span>{{ isExporting ? 'Exporting...' : 'Export Selected as ZIP' }}</span>
          </button>
          <div v-if="exportProgress.message" class="export-progress">
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                :style="{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }"
              ></div>
            </div>
            <p class="progress-text">{{ exportProgress.message }}</p>
          </div>
        </div>
      </section>

      <!-- Frame.io Upload Tracking Section -->
      <section class="rushes-section">
        <div class="section-header">
          <h2 class="section-title">Frame.io Upload Tracking</h2>
          <button class="btn btn-secondary" @click="scanForRushes" :disabled="isScanning">
            <span v-if="isScanning">⏳</span>
            <span v-else>🔍</span>
            <span>{{ isScanning ? 'Scanning...' : 'Scan for BWF Files' }}</span>
          </button>
        </div>
        <div class="rushes-filters">
          <select v-model="rushesFilter" class="filter-select">
            <option value="">All Status</option>
            <option value="not_uploaded">Not Uploaded</option>
            <option value="uploaded">Uploaded</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div v-if="isLoadingRushes" class="loading-text">Loading rushes files...</div>
        <div v-else-if="filteredRushes.length === 0" class="empty-state">
          <p>No rushes files found. Click "Scan for BWF Files" to detect files in storage.</p>
        </div>
        <div v-else class="rushes-table-container">
          <table class="rushes-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Stage</th>
                <th>Size</th>
                <th>Status</th>
                <th>Frame.io URL</th>
                <th>Uploaded By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="rush in filteredRushes" :key="rush.id">
                <td>{{ rush.file_name }}</td>
                <td>{{ getStageName(rush.location_id) }}</td>
                <td>{{ formatFileSize(rush.file_size) }}</td>
                <td>
                  <span :class="['status-badge', `status-${rush.upload_status}`]">
                    {{ formatStatus(rush.upload_status) }}
                  </span>
                </td>
                <td>
                  <a 
                    v-if="rush.frame_io_url" 
                    :href="rush.frame_io_url" 
                    target="_blank"
                    class="frame-io-link"
                  >
                    {{ rush.frame_io_url }}
                  </a>
                  <span v-else class="text-muted">—</span>
                </td>
                <td>{{ rush.uploaded_by || '—' }}</td>
                <td>
                  <button 
                    class="btn btn-sm btn-secondary" 
                    @click="openEditModal(rush)"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- Edit Upload Status Modal -->
    <div v-if="showEditModal" class="modal-backdrop" @click.self="closeEditModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Edit Upload Status</h3>
          <button class="modal-close" @click="closeEditModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Status</label>
            <select v-model="editForm.upload_status" class="form-control">
              <option value="not_uploaded">Not Uploaded</option>
              <option value="uploaded">Uploaded</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div class="form-group">
            <label>Frame.io URL (optional)</label>
            <input 
              v-model="editForm.frame_io_url" 
              type="url" 
              class="form-control"
              placeholder="https://frame.io/..."
            />
          </div>
          <div class="form-group">
            <label>Notes (optional)</label>
            <textarea 
              v-model="editForm.notes" 
              class="form-control"
              rows="3"
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeEditModal">Cancel</button>
          <button class="btn btn-primary" @click="saveEdit" :disabled="isSaving">
            {{ isSaving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '../stores/userStore';
import { supabase } from '../supabase';
import { fetchTableData } from '../services/dataService';
import { exportProjectData, downloadZip } from '../services/exportService';
import { 
  fetchRushesFiles, 
  updateUploadStatus, 
  detectBWFiles, 
  syncDetectedFiles 
} from '../services/rushesService';
import { useToast } from 'vue-toastification';

export default {
  name: 'DataManagement',
  setup() {
    const route = useRoute();
    const router = useRouter();
    const userStore = useUserStore();
    const toast = useToast();

    const projectId = computed(() => route.params.id);
    const currentProject = computed(() => userStore.getCurrentProject);

    const isLoading = ref(true);
    const isLoadingRushes = ref(false);
    const isExporting = ref(false);
    const isScanning = ref(false);
    const isSaving = ref(false);
    const showEditModal = ref(false);

    const dataCounts = ref({
      stages: 0,
      documents: 0,
      pictures: 0,
      gear: 0,
      contacts: 0,
      travel: 0,
      calendar: 0,
      rushes: 0,
    });

    const venues = ref([]);
    const stages = ref([]);
    const selectedVenueId = ref('');
    const selectedStageId = ref('');
    const rushesFilter = ref('');

    const exportSelections = ref({
      stages: false,
      documents: false,
      pictures: false,
      gear: false,
      contacts: false,
      travel: false,
      calendar: false,
      rushes: false,
    });

    const exportProgress = ref({
      current: 0,
      total: 0,
      message: '',
    });

    const rushes = ref([]);
    const editingRush = ref(null);
    const editForm = ref({
      upload_status: 'not_uploaded',
      frame_io_url: '',
      notes: '',
    });

    const filteredStages = computed(() => {
      if (!selectedVenueId.value) return stages.value;
      return stages.value.filter(s => s.venue_id === selectedVenueId.value);
    });

    const filteredRushes = computed(() => {
      let filtered = rushes.value;
      if (rushesFilter.value) {
        filtered = filtered.filter(r => r.upload_status === rushesFilter.value);
      }
      if (selectedStageId.value) {
        filtered = filtered.filter(r => r.location_id === parseInt(selectedStageId.value));
      }
      return filtered;
    });

    const hasSelection = computed(() => {
      return Object.values(exportSelections.value).some(Boolean);
    });

    onMounted(async () => {
      await loadData();
      await loadRushes();
    });

    async function loadData() {
      isLoading.value = true;
      try {
        // Load venues and stages
        venues.value = await fetchTableData('venues', {
          eq: { project_id: projectId.value },
        });
        stages.value = await fetchTableData('locations', {
          eq: { project_id: projectId.value },
        });

        // Load counts
        const [docs, pics, gear, contacts, trips, events, rushesData] = await Promise.all([
          fetchTableData('stage_docs', { eq: { project_id: projectId.value } }),
          fetchTableData('stage_pictures', { eq: { project_id: projectId.value } }),
          fetchTableData('gear_table', { eq: { project_id: projectId.value } }),
          fetchTableData('project_contacts', { eq: { project_id: projectId.value } }),
          fetchTableData('travel_trips', { eq: { project_id: projectId.value } }),
          fetchTableData('calendar_events', { eq: { project_id: projectId.value } }),
          fetchRushesFiles(projectId.value),
        ]);

        dataCounts.value = {
          stages: stages.value.length,
          documents: docs.length,
          pictures: pics.length,
          gear: gear.length,
          contacts: contacts.length,
          travel: trips.length,
          calendar: events.length,
          rushes: rushesData.length,
        };
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Failed to load data');
      } finally {
        isLoading.value = false;
      }
    }

    async function loadRushes() {
      isLoadingRushes.value = true;
      try {
        rushes.value = await fetchRushesFiles(projectId.value);
      } catch (error) {
        console.error('Error loading rushes:', error);
        toast.error('Failed to load rushes files');
      } finally {
        isLoadingRushes.value = false;
      }
    }

    async function scanForRushes() {
      isScanning.value = true;
      try {
        toast.info('Scanning for BWF files...');
        const detected = await detectBWFiles(projectId.value);
        if (detected.length === 0) {
          toast.info('No BWF files found in storage');
          return;
        }
        const result = await syncDetectedFiles(projectId.value, detected);
        toast.success(`Found ${result.total} files, created ${result.created} new records`);
        await loadRushes();
        await loadData(); // Refresh counts
      } catch (error) {
        console.error('Error scanning for rushes:', error);
        toast.error('Failed to scan for BWF files');
      } finally {
        isScanning.value = false;
      }
    }

    function selectAll() {
      Object.keys(exportSelections.value).forEach(key => {
        exportSelections.value[key] = true;
      });
    }

    function deselectAll() {
      Object.keys(exportSelections.value).forEach(key => {
        exportSelections.value[key] = false;
      });
    }

    async function handleExport() {
      if (!hasSelection.value) {
        toast.warning('Please select at least one data type to export');
        return;
      }

      isExporting.value = true;
      exportProgress.value = { current: 0, total: 0, message: 'Starting export...' };

      try {
        const selections = {
          ...exportSelections.value,
          venueFilter: selectedVenueId.value || null,
          stageFilter: selectedStageId.value || null,
        };

        const blob = await exportProjectData(projectId.value, selections, {
          onProgress: (progress) => {
            exportProgress.value = progress;
          },
        });

        const filename = `project-${projectId.value}-export-${Date.now()}.zip`;
        downloadZip(blob, filename);
        toast.success('Export completed successfully');
      } catch (error) {
        console.error('Error exporting:', error);
        toast.error('Failed to export project data');
      } finally {
        isExporting.value = false;
        exportProgress.value = { current: 0, total: 0, message: '' };
      }
    }

    function openEditModal(rush) {
      editingRush.value = rush;
      editForm.value = {
        upload_status: rush.upload_status,
        frame_io_url: rush.frame_io_url || '',
        notes: rush.notes || '',
      };
      showEditModal.value = true;
    }

    function closeEditModal() {
      showEditModal.value = false;
      editingRush.value = null;
      editForm.value = {
        upload_status: 'not_uploaded',
        frame_io_url: '',
        notes: '',
      };
    }

    async function saveEdit() {
      if (!editingRush.value) return;

      isSaving.value = true;
      try {
        const user = userStore.user?.email || userStore.user?.name || 'Unknown';
        await updateUploadStatus(
          editingRush.value.id,
          editForm.value.upload_status,
          editForm.value.frame_io_url || null,
          user,
          editForm.value.notes || null
        );
        await loadRushes();
        closeEditModal();
      } catch (error) {
        console.error('Error saving edit:', error);
        toast.error('Failed to update upload status');
      } finally {
        isSaving.value = false;
      }
    }

    function getStageName(locationId) {
      if (!locationId) return '—';
      const stage = stages.value.find(s => s.id === locationId);
      return stage ? stage.stage_name : 'Unknown';
    }

    function formatFileSize(bytes) {
      if (!bytes) return '—';
      const units = ['B', 'KB', 'MB', 'GB'];
      let size = bytes;
      let unitIndex = 0;
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
      }
      return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    function formatStatus(status) {
      const statusMap = {
        not_uploaded: 'Not Uploaded',
        uploaded: 'Uploaded',
        failed: 'Failed',
      };
      return statusMap[status] || status;
    }

    function goBack() {
      router.push({ name: 'ProjectDetail', params: { id: projectId.value } });
    }

    return {
      projectId,
      currentProject,
      isLoading,
      isLoadingRushes,
      isExporting,
      isScanning,
      isSaving,
      showEditModal,
      dataCounts,
      venues,
      stages,
      selectedVenueId,
      selectedStageId,
      rushesFilter,
      exportSelections,
      exportProgress,
      filteredStages,
      filteredRushes,
      hasSelection,
      editForm,
      loadRushes,
      scanForRushes,
      selectAll,
      deselectAll,
      handleExport,
      openEditModal,
      closeEditModal,
      saveEdit,
      getStageName,
      formatFileSize,
      formatStatus,
      goBack,
    };
  },
};
</script>

<style scoped>
.data-management {
  min-height: 100vh;
  background: var(--bg-primary);
  padding: 16px;
  padding-top: env(safe-area-inset-top, 16px);
  padding-bottom: env(safe-area-inset-bottom, 16px);
  font-family: var(--font-family-sans);
  color: var(--text-primary);
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 14px;
}

.breadcrumb-item {
  background: none;
  border: none;
  color: var(--text-link);
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

.header-section {
  margin-bottom: 24px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-light);
}

.header-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: var(--text-heading);
}

.header-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

.loading-section {
  padding: 24px;
}

.loading-skeleton {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.skeleton-card {
  height: 100px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 8px;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.content {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: var(--text-heading);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

/* Overview Section */
.overview-section {
  margin-bottom: 32px;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 16px;
}

.overview-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 12px;
}

.card-icon {
  font-size: 32px;
}

.card-content {
  flex: 1;
}

.card-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-heading);
}

.card-label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Export Section */
.export-section {
  margin-bottom: 32px;
  padding: 24px;
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-light);
}

.export-controls {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-heading);
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
}

.selection-group {
  margin-bottom: 24px;
}

.selection-header {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.btn-link {
  background: none;
  border: none;
  color: var(--text-link);
  cursor: pointer;
  text-decoration: underline;
  font-size: 14px;
  padding: 0;
}

.selection-checkboxes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
}

.checkbox-item input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.export-actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.export-button {
  padding: 16px 24px;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
}

.export-progress {
  margin-top: 16px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--bg-primary);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary-500);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

/* Rushes Section */
.rushes-section {
  margin-bottom: 32px;
  padding: 24px;
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-light);
}

.rushes-filters {
  margin-bottom: 16px;
}

.rushes-table-container {
  overflow-x: auto;
}

.rushes-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.rushes-table th,
.rushes-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-light);
}

.rushes-table th {
  font-weight: 600;
  color: var(--text-heading);
  background: var(--bg-primary);
}

.rushes-table td {
  color: var(--text-primary);
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-not_uploaded {
  background: var(--color-warning-100);
  color: var(--color-warning-800);
}

.status-uploaded {
  background: var(--color-success-100);
  color: var(--color-success-800);
}

.status-failed {
  background: var(--color-error-100);
  color: var(--color-error-800);
}

.frame-io-link {
  color: var(--text-link);
  text-decoration: none;
  word-break: break-all;
}

.frame-io-link:hover {
  text-decoration: underline;
}

.text-muted {
  color: var(--text-secondary);
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.empty-state {
  padding: 48px;
  text-align: center;
  color: var(--text-secondary);
}

.loading-text {
  padding: 24px;
  text-align: center;
  color: var(--text-secondary);
}

/* Modal */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1000;
}

.modal-content {
  width: 100%;
  max-width: 500px;
  background: var(--bg-primary);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  overflow: hidden;
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid var(--border-light);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-heading);
}

.form-control {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
}

.form-control:focus {
  outline: none;
  border-color: var(--color-primary-500);
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary-500);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-600);
}

.btn-secondary {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-light);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-secondary);
}

/* Responsive */
@media (min-width: 768px) {
  .data-management {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .overview-grid {
    grid-template-columns: repeat(4, 1fr);
  }

  .selection-checkboxes {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .overview-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>

