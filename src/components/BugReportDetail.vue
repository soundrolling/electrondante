<template>
  <div class="bug-report-detail">
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading report...</p>
    </div>

    <div v-else-if="report" class="detail-container">
      <!-- Header -->
      <div class="detail-header">
        <div class="header-left">
          <router-link :to="{ name: 'ProjectSettings', params: { id: projectId }, query: { tab: 'bug-reports' } }" class="back-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15,18 9,12 15,6"></polyline>
            </svg>
            Back to Reports
          </router-link>
          <h1 class="report-title">{{ report.title }}</h1>
          <div class="report-meta">
            <span class="report-type">{{ getTypeLabel(report.type) }}</span>
            <span class="report-priority" :class="`priority-${report.priority}`">
              {{ getPriorityLabel(report.priority) }}
            </span>
            <span class="report-status" :class="`status-${report.status}`">
              {{ getStatusLabel(report.status) }}
            </span>
          </div>
        </div>
        <div class="header-actions">
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

      <!-- Content -->
      <div class="detail-content">
        <div v-if="report.description" class="detail-section">
          <h2>Description</h2>
          <div class="description-content">{{ report.description }}</div>
        </div>

        <div v-if="report.steps" class="detail-section">
          <h2>Steps to Reproduce</h2>
          <div class="steps-content">{{ report.steps }}</div>
        </div>

        <div v-if="report.expected_behavior || report.actual_behavior" class="detail-section">
          <h2>Expected vs Actual Behavior</h2>
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

        <div class="detail-section">
          <h2>Additional Information</h2>
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

        <div v-if="report.url || report.page_title" class="detail-section">
          <h2>Page Information</h2>
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
      </div>
    </div>

    <div v-else class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <h2>Report Not Found</h2>
      <p>The bug report you're looking for doesn't exist or has been deleted.</p>
      <router-link :to="{ name: 'ProjectSettings', params: { id: projectId }, query: { tab: 'bug-reports' } }" class="btn btn-primary">
        Back to Reports
      </router-link>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBugReportStore } from '../stores/bugReportStore'

export default {
  name: 'BugReportDetail',
  props: {
    projectId: {
      type: String,
      required: true
    },
    reportId: {
      type: String,
      required: true
    }
  },
  setup(props) {
    const route = useRoute()
    const router = useRouter()
    const bugReportStore = useBugReportStore()
    
    const isLoading = ref(false)
    const report = ref(null)
    
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
    
    const loadReport = async () => {
      isLoading.value = true
      try {
        // Fetch all reports and find the one we need
        await bugReportStore.fetchReports()
        const foundReport = bugReportStore.reports.find(r => r.id === props.reportId)
        report.value = foundReport || null
      } catch (error) {
        console.error('Error loading report:', error)
        report.value = null
      } finally {
        isLoading.value = false
      }
    }
    
    const updateReportStatus = async (reportId, newStatus) => {
      try {
        await bugReportStore.updateReportStatus(reportId, newStatus)
        await loadReport() // Reload to get updated status
      } catch (error) {
        console.error('Error updating report status:', error)
      }
    }
    
    const deleteReport = async (reportId) => {
      if (confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
        try {
          await bugReportStore.deleteReport(reportId)
          // Navigate back to reports list
          router.push({
            name: 'ProjectSettings',
            params: { id: props.projectId },
            query: { tab: 'bug-reports' }
          })
        } catch (error) {
          console.error('Error deleting report:', error)
        }
      }
    }
    
    onMounted(() => {
      loadReport()
    })
    
    return {
      isLoading,
      report,
      getTypeLabel,
      getPriorityLabel,
      getStatusLabel,
      formatDate,
      updateReportStatus,
      deleteReport
    }
  }
}
</script>

<style scoped>
.bug-report-detail {
  max-width: 1000px;
  margin: 0 auto;
  padding: var(--space-6);
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

.empty-state h2 {
  margin: 0 0 var(--space-2) 0;
  color: var(--text-primary);
  font-size: var(--text-xl);
}

.empty-state p {
  margin: 0 0 var(--space-4) 0;
  color: var(--text-secondary);
}

.detail-container {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: var(--space-6);
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-secondary);
  flex-wrap: wrap;
  gap: var(--space-4);
}

.header-left {
  flex: 1;
  min-width: 0;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-primary-600);
  text-decoration: none;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  margin-bottom: var(--space-3);
  transition: color var(--transition-normal);
}

.back-link:hover {
  color: var(--color-primary-700);
}

.back-link svg {
  width: 16px;
  height: 16px;
}

.report-title {
  margin: 0 0 var(--space-3) 0;
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-heading);
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

.header-actions {
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
  cursor: pointer;
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

.detail-content {
  padding: var(--space-6);
}

.detail-section {
  margin-bottom: var(--space-6);
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-section h2 {
  margin: 0 0 var(--space-3) 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-3);
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
.description-content {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  margin-top: var(--space-2);
  white-space: pre-wrap;
  font-family: var(--font-mono, 'Monaco', 'Menlo', 'Ubuntu Mono', monospace);
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--text-primary);
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

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .bug-report-detail {
    padding: var(--space-4);
  }
  
  .detail-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .behavior-comparison {
    grid-template-columns: 1fr;
  }
}
</style>

