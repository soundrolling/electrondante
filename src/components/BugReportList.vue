<template>
  <div class="bug-report-list">
    <!-- Header with filters and actions -->
    <div class="list-header">
      <div class="header-top">
        <h3>Bug Reports & Suggestions</h3>
        <div class="header-actions">
          <button @click="refreshReports" class="btn btn-warning refresh-btn" :disabled="isLoading">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23,4 23,10 17,10"></polyline>
              <polyline points="1,20 1,14 7,14"></polyline>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4a9 9 0 0 1-14.85 4.36L23 14"></path>
            </svg>
            {{ isLoading ? 'Loading...' : 'Refresh' }}
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters">
        <div class="filter-group">
          <label for="statusFilter">Status:</label>
          <select v-model="filters.status" id="statusFilter" @change="applyFilters">
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div class="filter-group">
          <label for="typeFilter">Type:</label>
          <select v-model="filters.type" id="typeFilter" @change="applyFilters">
            <option value="">All</option>
            <option value="bug">Bug Report</option>
            <option value="suggestion">Suggestion</option>
            <option value="improvement">Improvement</option>
          </select>
        </div>

        <div class="filter-group">
          <label for="priorityFilter">Priority:</label>
          <select v-model="filters.priority" id="priorityFilter" @change="applyFilters">
            <option value="">All</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <button @click="clearFilters" class="btn btn-warning clear-filters-btn">Clear Filters</button>
      </div>
    </div>

    <!-- Statistics -->
    <div class="statistics" v-if="statistics">
      <div class="stat-card">
        <div class="stat-number">{{ statistics.total }}</div>
        <div class="stat-label">Total Reports</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ statistics.byStatus?.open || 0 }}</div>
        <div class="stat-label">Open</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ statistics.byStatus?.in_progress || 0 }}</div>
        <div class="stat-label">In Progress</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ statistics.byStatus?.closed || 0 }}</div>
        <div class="stat-label">Closed</div>
      </div>
    </div>

    <!-- Reports List -->
    <div class="reports-container">
      <div v-if="isLoading && reports.length === 0" class="loading-state">
        <div class="spinner"></div>
        <p>Loading reports...</p>
      </div>

      <div v-else-if="filteredReports.length === 0" class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h4>No reports found</h4>
        <p>{{ hasActiveFilters ? 'Try adjusting your filters' : 'No bug reports or suggestions have been submitted yet.' }}</p>
      </div>

      <div v-else class="reports-list">
        <div 
          v-for="report in filteredReports" 
          :key="report.id" 
          class="report-card"
          :class="[`priority-${report.priority}`, `status-${report.status}`]"
        >
          <div class="report-header">
            <div class="report-meta">
              <span class="report-type">{{ getTypeLabel(report.type) }}</span>
              <span class="report-priority" :class="`priority-${report.priority}`">
                {{ getPriorityLabel(report.priority) }}
              </span>
              <span class="report-status" :class="`status-${report.status}`">
                {{ getStatusLabel(report.status) }}
              </span>
            </div>
            <div class="report-actions">
              <router-link
                :to="{ name: 'BugReportDetail', params: { projectId: currentProjectId, reportId: report.id } }"
                class="btn btn-primary view-details-btn"
                title="View Details"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                View Details
              </router-link>
              <button 
                @click="toggleReportDetails(report.id)"
                class="btn btn-primary toggle-btn"
                :title="expandedReports.includes(report.id) ? 'Collapse' : 'Expand'"
              >
                <svg 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  stroke-width="2"
                  :class="{ 'rotated': expandedReports.includes(report.id) }"
                >
                  <polyline points="6,9 12,15 18,9"></polyline>
                </svg>
              </button>
            </div>
          </div>

          <div class="report-content">
            <h4 class="report-title">{{ report.title }}</h4>
            <p class="report-description">{{ report.description }}</p>
            
            <div class="report-details" v-if="expandedReports.includes(report.id)">
              <div class="detail-section">
                <h5>Additional Information</h5>
                <div class="detail-grid">
                  <div v-if="report.browser" class="detail-item">
                    <strong>Browser:</strong> {{ report.browser }}
                  </div>
                  <div v-if="report.device" class="detail-item">
                    <strong>Device:</strong> {{ report.device }}
                  </div>
                  <div v-if="report.platform" class="detail-item">
                    <strong>Platform:</strong> {{ report.platform }}
                  </div>
                  <div v-if="report.screen_resolution" class="detail-item">
                    <strong>Screen:</strong> {{ report.screen_resolution }}
                  </div>
                  <div v-if="report.viewport_size" class="detail-item">
                    <strong>Viewport:</strong> {{ report.viewport_size }}
                  </div>
                  <div v-if="report.timezone" class="detail-item">
                    <strong>Timezone:</strong> {{ report.timezone }}
                  </div>
                  <div class="detail-item">
                    <strong>Submitted:</strong> {{ formatDate(report.created_at) }}
                  </div>
                  <div v-if="report.updated_at !== report.created_at" class="detail-item">
                    <strong>Last Updated:</strong> {{ formatDate(report.updated_at) }}
                  </div>
                </div>
              </div>

              <div v-if="report.description" class="detail-section">
                <h5>Description</h5>
                <div class="description-content">{{ report.description }}</div>
              </div>

              <div v-if="report.steps" class="detail-section">
                <h5>Steps to Reproduce</h5>
                <div class="steps-content">{{ report.steps }}</div>
              </div>

              <div v-if="report.expected_behavior || report.actual_behavior" class="detail-section">
                <h5>Expected vs Actual Behavior</h5>
                <div class="behavior-comparison">
                  <div v-if="report.expected_behavior" class="behavior-item">
                    <strong>Expected:</strong>
                    <div class="behavior-text">{{ report.expected_behavior }}</div>
                  </div>
                  <div v-if="report.actual_behavior" class="behavior-item">
                    <strong>Actual:</strong>
                    <div class="behavior-text">{{ report.actual_behavior }}</div>
                  </div>
                </div>
              </div>


              <div v-if="report.url || report.page_title" class="detail-section">
                <h5>Page Information</h5>
                <div class="detail-grid">
                  <div v-if="report.page_title" class="detail-item">
                    <strong>Page Title:</strong> {{ report.page_title }}
                  </div>
                  <div v-if="report.url" class="detail-item">
                    <strong>URL:</strong> 
                    <a :href="report.url" target="_blank" class="url-link">{{ report.url }}</a>
                  </div>
                  <div v-if="report.referrer" class="detail-item">
                    <strong>Referrer:</strong> {{ report.referrer }}
                  </div>
                </div>
              </div>

              <div class="detail-section">
                <h5>Status Management</h5>
                <div class="status-controls">
                  <select 
                    :value="report.status" 
                    @change="updateReportStatus(report.id, $event.target.value)"
                    class="status-select"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="closed">Closed</option>
                  </select>
                  
                  <button 
                    @click="deleteReport(report.id)"
                    class="btn btn-danger delete-btn"
                    title="Delete report"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3,6 5,6 21,6"></polyline>
                      <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useBugReportStore } from '../stores/bugReportStore'
import { useUserStore } from '../stores/userStore'

export default {
  name: 'BugReportList',
  setup() {
    const bugReportStore = useBugReportStore()
    const userStore = useUserStore()
    const currentProjectId = computed(() => userStore.getCurrentProject?.id)
    
    const filters = ref({
      status: '',
      type: '',
      priority: ''
    })
    
    const expandedReports = ref([])
    
    const reports = computed(() => bugReportStore.reports)
    const statistics = computed(() => bugReportStore.statistics)
    const isLoading = computed(() => bugReportStore.isLoading)
    
    const hasActiveFilters = computed(() => {
      return filters.value.status || filters.value.type || filters.value.priority
    })
    
    const filteredReports = computed(() => {
      let filtered = reports.value
      
      if (filters.value.status) {
        filtered = filtered.filter(report => report.status === filters.value.status)
      }
      
      if (filters.value.type) {
        filtered = filtered.filter(report => report.type === filters.value.type)
      }
      
      if (filters.value.priority) {
        filtered = filtered.filter(report => report.priority === filters.value.priority)
      }
      
      return filtered
    })
    
    const getTypeLabel = (type) => {
      const labels = {
        bug: 'Bug Report',
        suggestion: 'Suggestion',
        improvement: 'Improvement'
      }
      return labels[type] || type
    }
    
    const getPriorityLabel = (priority) => {
      const labels = {
        low: 'Low',
        medium: 'Medium',
        high: 'High',
        critical: 'Critical'
      }
      return labels[priority] || priority
    }
    
    const getStatusLabel = (status) => {
      const labels = {
        open: 'Open',
        in_progress: 'In Progress',
        closed: 'Closed'
      }
      return labels[status] || status
    }
    
    const formatDate = (dateString) => {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    
    const toggleReportDetails = (reportId) => {
      const index = expandedReports.value.indexOf(reportId)
      if (index > -1) {
        expandedReports.value.splice(index, 1)
      } else {
        expandedReports.value.push(reportId)
      }
    }
    
    const applyFilters = () => {
      // Filters are applied reactively through computed property
    }
    
    const clearFilters = () => {
      filters.value = {
        status: '',
        type: '',
        priority: ''
      }
    }
    
    const refreshReports = async () => {
      try {
        await bugReportStore.fetchReports()
        await bugReportStore.fetchStatistics()
      } catch (error) {
        console.error('Error refreshing reports:', error)
      }
    }
    
    const updateReportStatus = async (reportId, newStatus) => {
      try {
        await bugReportStore.updateReportStatus(reportId, newStatus)
      } catch (error) {
        console.error('Error updating report status:', error)
      }
    }
    
    const deleteReport = async (reportId) => {
      if (confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
        try {
          await bugReportStore.deleteReport(reportId)
        } catch (error) {
          console.error('Error deleting report:', error)
        }
      }
    }
    
    onMounted(async () => {
      await refreshReports()
    })
    
    return {
      filters,
      expandedReports,
      reports,
      statistics,
      isLoading,
      hasActiveFilters,
      filteredReports,
      getTypeLabel,
      getPriorityLabel,
      getStatusLabel,
      formatDate,
      toggleReportDetails,
      applyFilters,
      clearFilters,
      refreshReports,
      updateReportStatus,
      deleteReport,
      currentProjectId
    }
  }
}
</script>

<style scoped>
.bug-report-list {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-6);
}

.list-header {
  margin-bottom: var(--space-6);
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.header-top h3 {
  margin: 0;
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  gap: var(--space-3);
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-normal);
}

.refresh-btn:hover:not(:disabled) {
  background: var(--color-secondary-200);
  border-color: var(--border-medium);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-btn svg {
  width: 16px;
  height: 16px;
}

.filters {
  display: flex;
  gap: var(--space-4);
  align-items: center;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.filter-group label {
  font-weight: var(--font-medium);
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.filter-group select {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--text-sm);
  min-width: 120px;
}

.clear-filters-btn {
  padding: var(--space-2) var(--space-3);
  background: var(--color-error-600);
  color: var(--text-inverse);
  border: 1px solid var(--color-error-700);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-normal);
}

.clear-filters-btn:hover {
  background: var(--color-error-700);
  border-color: var(--color-error-800);
}

.statistics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.stat-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  text-align: center;
}

.stat-number {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--color-primary-600);
  margin-bottom: var(--space-1);
}

.stat-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: var(--font-medium);
}

.reports-container {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12);
  text-align: center;
}

.loading-state .spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-secondary-200);
  border-top: 3px solid var(--color-primary-500);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: var(--space-4);
}

.empty-state svg {
  width: 48px;
  height: 48px;
  color: var(--text-secondary);
  margin-bottom: var(--space-4);
}

.empty-state h4 {
  margin: 0 0 var(--space-2) 0;
  color: var(--text-primary);
  font-size: var(--text-lg);
}

.empty-state p {
  margin: 0;
  color: var(--text-secondary);
}

.reports-list {
  max-height: 600px;
  overflow-y: auto;
}

.report-card {
  border-bottom: 1px solid var(--border-light);
  padding: var(--space-4);
  transition: all var(--transition-normal);
}

.report-card:last-child {
  border-bottom: none;
}

.report-card:hover {
  background: var(--bg-secondary);
}

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.report-meta {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.report-type,
.report-priority,
.report-status {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.report-type {
  background: var(--color-primary-100);
  color: var(--color-primary-700);
}

.dark .report-type {
  background: var(--color-primary-600);
  color: var(--text-inverse);
}

.report-priority.priority-low {
  background: var(--color-success-100);
  color: var(--color-success-700);
}

.dark .report-priority.priority-low {
  background: var(--color-success-600);
  color: var(--text-inverse);
}

.report-priority.priority-medium {
  background: var(--color-warning-100);
  color: var(--color-warning-700);
}

.dark .report-priority.priority-medium {
  background: var(--color-warning-600);
  color: var(--text-inverse);
}

.report-priority.priority-high {
  background: var(--color-error-100);
  color: var(--color-error-700);
}

.dark .report-priority.priority-high {
  background: var(--color-error-600);
  color: var(--text-inverse);
}

.report-priority.priority-critical {
  background: var(--color-error-200);
  color: var(--color-error-800);
}

.dark .report-priority.priority-critical {
  background: var(--color-error-700);
  color: var(--text-inverse);
}

.report-status.status-open {
  background: var(--color-primary-100);
  color: var(--color-primary-700);
}

.dark .report-status.status-open {
  background: var(--color-primary-600);
  color: var(--text-inverse);
}

.report-status.status-in_progress {
  background: var(--color-warning-100);
  color: var(--color-warning-700);
}

.dark .report-status.status-in_progress {
  background: var(--color-warning-600);
  color: var(--text-inverse);
}

.report-status.status-closed {
  background: var(--color-success-100);
  color: var(--color-success-700);
}

.dark .report-status.status-closed {
  background: var(--color-success-600);
  color: var(--text-inverse);
}

.report-actions {
  display: flex;
  gap: var(--space-2);
}

.view-details-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  text-decoration: none;
  font-size: var(--text-sm);
}

.toggle-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  transition: all var(--transition-normal);
}

.toggle-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.toggle-btn svg {
  width: 16px;
  height: 16px;
  transition: transform var(--transition-normal);
}

.toggle-btn svg.rotated {
  transform: rotate(180deg);
}

.view-details-btn svg {
  width: 16px;
  height: 16px;
}

.report-content {
  margin-left: var(--space-2);
}

.report-title {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.report-description {
  margin: 0 0 var(--space-3) 0;
  color: var(--text-secondary);
  line-height: 1.5;
}

.report-details {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-light);
}

.detail-section {
  margin-bottom: var(--space-4);
}

.detail-section h5 {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-2);
}

.detail-item {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.detail-item strong {
  color: var(--text-primary);
  font-weight: var(--font-medium);
}

.steps-content,
.behavior-text,
.additional-info,
.description-content {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  margin-top: var(--space-2);
  white-space: pre-wrap;
  font-family: var(--font-mono, 'Monaco', 'Menlo', 'Ubuntu Mono', monospace);
  font-size: var(--text-sm);
  line-height: 1.5;
}

.behavior-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  margin-top: var(--space-2);
}

.behavior-item {
  display: flex;
  flex-direction: column;
}

.behavior-item strong {
  margin-bottom: var(--space-2);
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.url-link {
  color: var(--color-primary-600);
  text-decoration: none;
  word-break: break-all;
  font-size: var(--text-sm);
}

.url-link:hover {
  text-decoration: underline;
}

.status-controls {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

.status-select {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.delete-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  background: var(--color-error-50);
  color: var(--color-error-600);
  border: 1px solid var(--color-error-200);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-normal);
}

.delete-btn:hover {
  background: var(--color-error-100);
  border-color: var(--color-error-300);
}

.delete-btn svg {
  width: 14px;
  height: 14px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .bug-report-list {
    padding: var(--space-4);
  }
  
  .header-top {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }
  
  .filters {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-group {
    justify-content: space-between;
  }
  
  .statistics {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .report-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }
  
  .report-meta {
    width: 100%;
  }
  
  .status-controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .behavior-comparison {
    grid-template-columns: 1fr;
    gap: var(--space-3);
  }
}

/* Focus states for accessibility */
.refresh-btn:focus,
.toggle-btn:focus,
.delete-btn:focus,
.status-select:focus {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}
</style>
