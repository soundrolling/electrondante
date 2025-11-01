<template>
  <div v-if="isOpen" class="modal-overlay" @click="closeModal">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <h3>Report Center</h3>
        <button @click="closeModal" class="btn btn-warning close-btn" title="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button type="button" class="tab" :class="{ active: activeTab === 'new' }" @click="activeTab = 'new'">New Report</button>
        <button type="button" class="tab" :class="{ active: activeTab === 'review' }" @click="activeTab = 'review'">
          Review <span v-if="openReportsCount > 0" class="tab-badge">{{ openReportsCount }}</span>
        </button>
      </div>

      <form v-if="activeTab === 'new'" @submit.prevent="submitReport" class="modal-form">
        <!-- Quick Actions -->
        <div class="quick-actions">
          <h4>Quick Report</h4>
          <div class="quick-buttons">
            <button type="button" @click="quickReport('bug')" class="btn btn-danger quick-btn bug">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              Report Bug
            </button>
            <button type="button" @click="quickReport('suggestion')" class="btn btn-positive quick-btn suggestion">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 12l2 2 4-4"></path>
                <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"></path>
              </svg>
              Suggest Feature
            </button>
            <button type="button" @click="quickReport('improvement')" class="btn btn-warning quick-btn improvement">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
              </svg>
              Suggest Improvement
            </button>
          </div>
        </div>

        <div class="form-group">
          <label for="reportType">Type</label>
          <select v-model="formData.type" id="reportType" required>
            <option value="">Select type...</option>
            <option value="bug">Bug Report</option>
            <option value="suggestion">Feature Suggestion</option>
            <option value="improvement">Improvement</option>
          </select>
        </div>

        <div class="form-group">
          <label for="title">Title</label>
          <input
            v-model="formData.title"
            type="text"
            id="title"
            :placeholder="getTitlePlaceholder()"
            required
            maxlength="100"
            @input="autoFillDescription"
          />
        </div>

        <div class="form-group" v-if="formData.type !== 'bug'">
          <label for="description">Description</label>
          <textarea
            v-model="formData.description"
            id="description"
            :placeholder="getDescriptionPlaceholder()"
            required
            rows="6"
            maxlength="1000"
          ></textarea>
          <div class="char-count">{{ formData.description.length }}/1000</div>
        </div>

        <div class="form-group">
          <label for="priority">Priority</label>
          <select v-model="formData.priority" id="priority" required>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div class="form-group">
          <label for="browser">Browser & Version</label>
          <input
            v-model="formData.browser"
            type="text"
            id="browser"
            placeholder="Auto-detected browser information"
            readonly
            class="auto-filled"
          />
          <small class="field-note">Automatically detected from your browser</small>
        </div>

        <div class="form-group">
          <label for="device">Device Information</label>
          <input
            v-model="formData.device"
            type="text"
            id="device"
            placeholder="Auto-detected device information"
            readonly
            class="auto-filled"
          />
          <small class="field-note">Automatically detected from your system</small>
        </div>

        <div class="form-group" v-if="formData.type === 'bug'">
          <label for="steps">Steps to Reproduce</label>
          <textarea
            v-model="formData.steps"
            id="steps"
            rows="4"
            maxlength="2000"
          ></textarea>
          <div class="char-count">{{ formData.steps.length }}/2000</div>
        </div>

        <div class="form-group" v-if="formData.type === 'bug'">
          <label for="expected">Expected vs Actual Behavior</label>
          <div class="behavior-grid">
            <div>
              <label for="expectedBehavior">Expected:</label>
              <textarea
                v-model="formData.expectedBehavior"
                id="expectedBehavior"
                rows="3"
                maxlength="1000"
              ></textarea>
              <div class="char-count">{{ formData.expectedBehavior.length }}/1000</div>
            </div>
            <div>
              <label for="actualBehavior">Actual:</label>
              <textarea
                v-model="formData.actualBehavior"
                id="actualBehavior"
                rows="3"
                maxlength="1000"
              ></textarea>
              <div class="char-count">{{ formData.actualBehavior.length }}/1000</div>
            </div>
          </div>
        </div>


        <div class="form-actions">
          <button type="button" @click="closeModal" class="btn btn-warning cancel-btn">
            Cancel
          </button>
          <button 
            type="submit" 
            class="btn btn-positive submit-btn"
            :disabled="isSubmitting || !isFormValid"
          >
            {{ isSubmitting ? 'Submitting...' : 'Submit Report' }}
          </button>
        </div>
      </form>

      <div v-else class="modal-form review-pane">
        <BugReportList />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import BugReportList from './BugReportList.vue'
import { useBugReportStore } from '../stores/bugReportStore'
import { useToast } from 'vue-toastification'

export default {
  name: 'BugReportModal',
  components: { BugReportList },
  props: {
    isOpen: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'submit'],
  setup(props, { emit }) {
    const toast = useToast()
    const bugReportStore = useBugReportStore()
    
    const isSubmitting = ref(false)
    const activeTab = ref('new')
    const openReportsCount = computed(() => bugReportStore.openReportsCount)
    
    const formData = ref({
      type: '',
      title: '',
      description: '',
      priority: 'medium',
      browser: '',
      device: '',
      steps: '',
      expectedBehavior: '',
      actualBehavior: ''
    })

    const isFormValid = computed(() => {
      const hasType = formData.value.type
      const hasTitle = formData.value.title.trim()
      
      // For bugs, we don't require description since we have steps and behavior
      if (formData.value.type === 'bug') {
        return hasType && hasTitle
      }
      
      // For suggestions and improvements, description is required
      return hasType && hasTitle && formData.value.description.trim()
    })

    const closeModal = () => {
      emit('close')
    }

    const detectBrowserInfo = () => {
      const ua = navigator.userAgent
      let browserName = 'Unknown'
      let browserVersion = 'Unknown'
      
      // Detect browser
      if (ua.includes('Chrome') && !ua.includes('Edg')) {
        browserName = 'Chrome'
        const match = ua.match(/Chrome\/(\d+)/)
        if (match) browserVersion = match[1]
      } else if (ua.includes('Firefox')) {
        browserName = 'Firefox'
        const match = ua.match(/Firefox\/(\d+)/)
        if (match) browserVersion = match[1]
      } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
        browserName = 'Safari'
        const match = ua.match(/Version\/(\d+)/)
        if (match) browserVersion = match[1]
      } else if (ua.includes('Edg')) {
        browserName = 'Edge'
        const match = ua.match(/Edg\/(\d+)/)
        if (match) browserVersion = match[1]
      } else if (ua.includes('Opera')) {
        browserName = 'Opera'
        const match = ua.match(/Opera\/(\d+)/)
        if (match) browserVersion = match[1]
      }
      
      return `${browserName} ${browserVersion}`
    }

    const detectDeviceInfo = () => {
      const ua = navigator.userAgent
      const platform = navigator.platform
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
      const isTablet = /iPad|Android/i.test(ua) && !/Mobile/i.test(ua)
      
      let deviceType = 'Desktop'
      let deviceName = platform
      
      if (isMobile) {
        deviceType = 'Mobile'
        if (ua.includes('iPhone')) {
          deviceName = 'iPhone'
          const match = ua.match(/iPhone OS (\d+_\d+)/)
          if (match) deviceName += ` (iOS ${match[1].replace('_', '.')})`
        } else if (ua.includes('Android')) {
          deviceName = 'Android'
          const match = ua.match(/Android (\d+\.\d+)/)
          if (match) deviceName += ` ${match[1]}`
        }
      } else if (isTablet) {
        deviceType = 'Tablet'
        if (ua.includes('iPad')) {
          deviceName = 'iPad'
        } else if (ua.includes('Android')) {
          deviceName = 'Android Tablet'
        }
      } else {
        // Desktop
        if (platform.includes('Mac')) {
          deviceName = 'Mac'
        } else if (platform.includes('Win')) {
          deviceName = 'Windows'
        } else if (platform.includes('Linux')) {
          deviceName = 'Linux'
        }
      }
      
      return `${deviceType} - ${deviceName}`
    }

    const getTitlePlaceholder = () => {
      const type = formData.value.type
      if (type === 'bug') return 'e.g., Login button not working on mobile'
      if (type === 'suggestion') return 'e.g., Add dark mode toggle'
      if (type === 'improvement') return 'e.g., Make calendar more responsive'
      return 'Brief description of the issue or suggestion'
    }

    const getDescriptionPlaceholder = () => {
      const type = formData.value.type
      if (type === 'bug') return 'Describe what happened, what you expected to happen, and any error messages you saw...'
      if (type === 'suggestion') return 'Describe the feature you\'d like to see and how it would help you...'
      if (type === 'improvement') return 'Describe what could be improved and how it would make things better...'
      return 'Please provide detailed information about the bug or suggestion...'
    }

    const autoFillDescription = () => {
      // Auto-fill description based on title for common patterns
      if (formData.value.description) return // Don't overwrite existing description
      
      const title = formData.value.title.toLowerCase()
      const type = formData.value.type
      
      if (type === 'bug') {
        if (title.includes('not working') || title.includes('broken')) {
          formData.value.description = 'The feature is not functioning as expected. Please investigate and fix.'
        } else if (title.includes('error') || title.includes('crash')) {
          formData.value.description = 'An error occurred. Please check the console for more details.'
        } else if (title.includes('slow') || title.includes('loading')) {
          formData.value.description = 'The page/feature is loading slowly or taking too long to respond.'
        }
      } else if (type === 'suggestion') {
        if (title.includes('add') || title.includes('new')) {
          formData.value.description = 'This feature would be helpful because...'
        } else if (title.includes('dark mode') || title.includes('theme')) {
          formData.value.description = 'A dark mode option would improve usability and reduce eye strain.'
        }
      }
    }

    const quickReport = (type) => {
      formData.value.type = type
      
      // Set smart defaults based on type
      if (type === 'bug') {
        formData.value.title = 'Bug: '
        formData.value.priority = 'medium'
        // Don't set description for bugs - they use steps and behavior instead
        formData.value.description = ''
      } else if (type === 'suggestion') {
        formData.value.title = 'Suggestion: '
        formData.value.priority = 'low'
        // Leave description empty - placeholder will show
        formData.value.description = ''
      } else if (type === 'improvement') {
        formData.value.title = 'Improvement: '
        formData.value.priority = 'low'
        // Leave description empty - placeholder will show
        formData.value.description = ''
      }
      
      // Focus on title field
      setTimeout(() => {
        const titleInput = document.getElementById('title')
        if (titleInput) {
          titleInput.focus()
          titleInput.setSelectionRange(titleInput.value.length, titleInput.value.length)
        }
      }, 100)
    }

    const resetForm = () => {
      formData.value = {
        type: '',
        title: '',
        description: '',
        priority: 'medium',
        browser: detectBrowserInfo(),
        device: detectDeviceInfo(),
        steps: '',
        expectedBehavior: '',
        actualBehavior: ''
      }
    }

    const submitReport = async () => {
      if (!isFormValid.value) return
      
      isSubmitting.value = true
      try {
        // Capture comprehensive system information
        const systemInfo = {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          cookieEnabled: navigator.cookieEnabled,
          onLine: navigator.onLine,
          screenResolution: `${screen.width}x${screen.height}`,
          viewportSize: `${window.innerWidth}x${window.innerHeight}`,
          colorDepth: screen.colorDepth,
          pixelRatio: window.devicePixelRatio || 1,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          referrer: document.referrer || 'Direct',
          pageTitle: document.title,
          // Capture any console errors if available
          consoleErrors: window.consoleErrors || []
        }

        const reportData = {
          ...formData.value,
          ...systemInfo,
          status: 'open'
        }
        
        emit('submit', reportData)
        resetForm()
        closeModal()
        toast.success('Report submitted successfully!')
      } catch (error) {
        console.error('Error submitting report:', error)
        toast.error('Failed to submit report. Please try again.')
      } finally {
        isSubmitting.value = false
      }
    }

    // Reset form and refresh reports when modal opens
    watch(() => props.isOpen, async (isOpen) => {
      if (isOpen) {
        resetForm()
        activeTab.value = 'new'
        try { await bugReportStore.fetchReports() } catch {}
      }
    })

    return {
      formData,
      isSubmitting,
      isFormValid,
      closeModal,
      submitReport,
      getTitlePlaceholder,
      getDescriptionPlaceholder,
      autoFillDescription,
      quickReport,
      activeTab,
      openReportsCount
    }
  }
}
</script>

<style scoped>
.tabs {
  display: flex;
  gap: 8px;
  padding: 0 var(--space-6);
  margin-top: var(--space-4);
}
.tab {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
}
.tab.active {
  background: var(--color-primary-100);
  border-color: var(--color-primary-300);
}
.tab-badge {
  background: #ef4444;
  color: #fff;
  border-radius: 9999px;
  padding: 0 6px;
  margin-left: 6px;
  font-size: 12px;
}
.review-pane {
  padding-top: 0;
}
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: var(--space-4);
  overflow-y: auto;
}

.modal-container {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  border: 1px solid var(--border-light);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-6);
  border-bottom: 1px solid var(--border-light);
}

.modal-header h3 {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  transition: all var(--transition-normal);
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.close-btn svg {
  width: 20px;
  height: 20px;
}

.modal-form {
  padding: var(--space-6);
}

.form-group {
  margin-bottom: var(--space-5);
}

.form-group label {
  display: block;
  margin-bottom: var(--space-2);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: var(--space-3);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: all var(--transition-normal);
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px var(--color-primary-100);
}

.form-group textarea {
  resize: vertical;
  min-height: 120px;
}

.char-count {
  text-align: right;
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-top: var(--space-1);
}

.behavior-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.behavior-grid > div {
  display: flex;
  flex-direction: column;
}

.behavior-grid label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.auto-filled {
  background-color: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: not-allowed;
}

.field-note {
  display: block;
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-top: var(--space-1);
  font-style: italic;
}

.quick-actions {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-6);
}

.quick-actions h4 {
  margin: 0 0 var(--space-3) 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.quick-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--space-3);
}

.quick-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--transition-normal);
  font-weight: var(--font-medium);
  text-align: center;
}

.quick-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  border-color: var(--border-medium);
}

.quick-btn.bug:hover {
  background: var(--color-error-50);
  border-color: var(--color-error-200);
  color: var(--color-error-700);
}

.quick-btn.suggestion:hover {
  background: var(--color-primary-50);
  border-color: var(--color-primary-200);
  color: var(--color-primary-700);
}

.quick-btn.improvement:hover {
  background: var(--color-warning-50);
  border-color: var(--color-warning-200);
  color: var(--color-warning-700);
}

.quick-btn svg {
  width: 24px;
  height: 24px;
}

.form-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  margin-top: var(--space-6);
  padding-top: var(--space-5);
  border-top: 1px solid var(--border-light);
}

.cancel-btn,
.submit-btn {
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-md);
  font-weight: var(--font-medium);
  font-size: var(--text-base);
  cursor: pointer;
  transition: all var(--transition-normal);
  border: 1px solid transparent;
  min-height: 44px;
}

.cancel-btn {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-color: var(--border-light);
}

.cancel-btn:hover {
  background: var(--color-secondary-200);
  border-color: var(--border-medium);
}

.submit-btn {
  background: var(--color-primary-500);
  color: var(--text-inverse);
  border-color: var(--color-primary-500);
}

.submit-btn:hover:not(:disabled) {
  background: var(--color-primary-600);
  border-color: var(--color-primary-600);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Mobile responsiveness */
@media (max-width: 640px) {
  .modal-overlay {
    padding: var(--space-2);
  }
  
  .modal-header,
  .modal-form {
    padding: var(--space-4);
  }
  
  .behavior-grid {
    grid-template-columns: 1fr;
    gap: var(--space-3);
  }
  
  .quick-buttons {
    grid-template-columns: 1fr;
  }
  
  .quick-btn {
    padding: var(--space-3);
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .cancel-btn,
  .submit-btn {
    width: 100%;
  }
}

/* Focus states for accessibility */
.cancel-btn:focus,
.submit-btn:focus,
.close-btn:focus {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .modal-container {
    border-width: 2px;
  }
  
  .form-group input,
  .form-group select,
  .form-group textarea,
  .cancel-btn,
  .submit-btn {
    border-width: 2px;
  }
}
</style>
