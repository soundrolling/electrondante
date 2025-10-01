<template>
  <div v-if="isOpen" class="modal-overlay" @click="closeModal">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <h3>Report a Bug or Suggestion</h3>
        <button @click="closeModal" class="close-btn" title="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <form @submit.prevent="submitReport" class="modal-form">
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
            placeholder="Brief description of the issue or suggestion"
            required
            maxlength="100"
          />
        </div>

        <div class="form-group">
          <label for="description">Description</label>
          <textarea
            v-model="formData.description"
            id="description"
            placeholder="Please provide detailed information about the bug or suggestion..."
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
          <label for="browser">Browser & Version (optional)</label>
          <input
            v-model="formData.browser"
            type="text"
            id="browser"
            placeholder="e.g., Chrome 120, Safari 17, Firefox 121"
          />
        </div>

        <div class="form-group">
          <label for="device">Device (optional)</label>
          <input
            v-model="formData.device"
            type="text"
            id="device"
            placeholder="e.g., iPhone 15, MacBook Pro, Windows PC"
          />
        </div>

        <div class="form-group">
          <label for="steps">Steps to Reproduce (for bugs)</label>
          <textarea
            v-model="formData.steps"
            id="steps"
            placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
            rows="4"
            maxlength="2000"
          ></textarea>
          <div class="char-count">{{ formData.steps.length }}/2000</div>
        </div>

        <div class="form-group">
          <label for="expected">Expected vs Actual Behavior</label>
          <div class="behavior-grid">
            <div>
              <label for="expectedBehavior">Expected:</label>
              <textarea
                v-model="formData.expectedBehavior"
                id="expectedBehavior"
                placeholder="What should have happened?"
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
                placeholder="What actually happened?"
                rows="3"
                maxlength="1000"
              ></textarea>
              <div class="char-count">{{ formData.actualBehavior.length }}/1000</div>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="additionalInfo">Additional Information</label>
          <textarea
            v-model="formData.additionalInfo"
            id="additionalInfo"
            placeholder="Any other relevant information, screenshots description, etc."
            rows="3"
            maxlength="1500"
          ></textarea>
          <div class="char-count">{{ formData.additionalInfo.length }}/1500</div>
        </div>

        <div class="form-actions">
          <button type="button" @click="closeModal" class="cancel-btn">
            Cancel
          </button>
          <button 
            type="submit" 
            class="submit-btn"
            :disabled="isSubmitting || !isFormValid"
          >
            {{ isSubmitting ? 'Submitting...' : 'Submit Report' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { useToast } from 'vue-toastification'

export default {
  name: 'BugReportModal',
  props: {
    isOpen: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'submit'],
  setup(props, { emit }) {
    const toast = useToast()
    
    const isSubmitting = ref(false)
    
    const formData = ref({
      type: '',
      title: '',
      description: '',
      priority: 'medium',
      browser: '',
      device: '',
      steps: '',
      expectedBehavior: '',
      actualBehavior: '',
      additionalInfo: ''
    })

    const isFormValid = computed(() => {
      return formData.value.type && 
             formData.value.title.trim() && 
             formData.value.description.trim()
    })

    const closeModal = () => {
      emit('close')
    }

    const resetForm = () => {
      formData.value = {
        type: '',
        title: '',
        description: '',
        priority: 'medium',
        browser: '',
        device: '',
        steps: '',
        expectedBehavior: '',
        actualBehavior: '',
        additionalInfo: ''
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

    // Reset form when modal opens
    watch(() => props.isOpen, (isOpen) => {
      if (isOpen) {
        resetForm()
      }
    })

    return {
      formData,
      isSubmitting,
      isFormValid,
      closeModal,
      submitReport
    }
  }
}
</script>

<style scoped>
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
