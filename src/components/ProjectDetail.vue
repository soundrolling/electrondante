<template>
<div class="project-detail">
  <!-- Loading State -->
  <div v-if="isLoading" class="loading-skeleton">
    <div class="skeleton-header"></div>
    <div class="skeleton-meta"></div>
    <div class="skeleton-stages">
      <div class="skeleton-stage"></div>
      <div class="skeleton-stage"></div>
      <div class="skeleton-stage"></div>
    </div>
    <div class="skeleton-actions">
      <div class="skeleton-action"></div>
      <div class="skeleton-action"></div>
      <div class="skeleton-action"></div>
      <div class="skeleton-action"></div>
    </div>
  </div>

  <!-- Project Content -->
  <div v-else-if="currentProject" class="project-content">
    <!-- Compact Header with Timeline -->
    <section class="compact-header ui-page-header">
      <div class="header-main">
        <h1 class="project-title">{{ currentProject.project_name }}</h1>
        <div class="project-meta">
          <div v-if="currentProject.location" class="meta-item">
            <span class="meta-icon">📍</span>
            <span class="meta-text">{{ currentProject.location }}</span>
          </div>
          <div v-if="currentProject.official_website" class="meta-item">
            <span class="meta-icon">🌐</span>
            <a :href="currentProject.official_website" target="_blank" rel="noopener" class="meta-link">
              Official Website
            </a>
          </div>
        </div>
      </div>
      
      <!-- Inline Timeline -->
      <div v-if="(currentProject.main_show_days && currentProject.main_show_days.length) || (currentProject.build_days && currentProject.build_days.length)" class="inline-timeline">
        <div v-if="currentProject.build_days && currentProject.build_days.length" class="timeline-chip build">
          <span class="chip-icon">🔨</span>
          <span class="chip-text">Build: {{ formatSingleDate(currentProject.build_days[0]) }} - {{ formatSingleDate(currentProject.build_days[currentProject.build_days.length-1]) }}</span>
        </div>
        <div v-if="currentProject.main_show_days && currentProject.main_show_days.length" class="timeline-chip show">
          <span class="chip-icon">🎭</span>
          <span class="chip-text">Show: {{ formatSingleDate(currentProject.main_show_days[0]) }} - {{ formatSingleDate(currentProject.main_show_days[currentProject.main_show_days.length-1]) }}</span>
        </div>
      </div>
    </section>

    <!-- Quick Access Stages -->
    <section v-if="stages.length" class="stages-section">
      <h2 class="section-title">Quick Access Stages</h2>
      <div class="stages-grid">
        <button
          v-for="stage in stages"
          :key="stage.id"
          class="stage-card"
          @click="openStageModal(stage)"
          @touchstart="handleTouchStart"
          @touchend="handleTouchEnd"
        >
          <div class="stage-icon">🎪</div>
          <div class="stage-info">
            <div class="stage-name">{{ stage.stage_name }}</div>
            <div class="stage-venue">{{ stage.venue_name }}</div>
          </div>
          <div class="stage-arrow">→</div>
        </button>
      </div>
    </section>

    <!-- Startup Section - Show when no stages exist -->
    <section v-if="!stages.length" class="startup-section">
      <div class="startup-content">
        <div class="startup-icon">🏗️</div>
        <h2 class="startup-title">Get Started with Your Project</h2>
        <p class="startup-description">Add your first stage to begin organizing your recording locations and equipment.</p>
        <button class="btn btn-primary startup-button" @click="goToLocations">
          <span class="startup-button-icon">🏢</span>
          <span class="startup-button-text">Add Your First Stage</span>
        </button>
      </div>
    </section>

    <!-- Primary Actions -->
    <section class="actions-section">
      <h2 class="section-title">Project Tools</h2>
      <div class="actions-grid">
        <button class="btn btn-primary action-button primary" @click="goToLocations">
          <span class="action-icon">🏢</span>
          <span class="action-label">All Stages</span>
        </button>
        <button class="btn btn-positive action-button" @click="goToCalendar">
          <span class="action-icon">📅</span>
          <span class="action-label">Calendar</span>
        </button>
        <button class="btn btn-positive action-button" @click="goToTravelHub">
          <span class="action-icon">✈️</span>
          <span class="action-label">Travel Hub</span>
        </button>
        <button class="btn btn-positive action-button" @click="goToContacts">
          <span class="action-icon">👥</span>
          <span class="action-label">Contacts</span>
        </button>
        <button class="btn btn-warning action-button" @click="goToSettings">
          <span class="action-icon">⚙️</span>
          <span class="action-label">Settings</span>
        </button>
        <button class="btn btn-positive action-button" @click="goToGear">
          <span class="action-icon">🔧</span>
          <span class="action-label">Gear</span>
        </button>
        <button class="btn btn-positive action-button" @click="goToDocuments">
          <span class="action-icon">📄</span>
          <span class="action-label">Documents</span>
        </button>
        <button class="btn btn-positive action-button" @click="goToDataManagement">
          <span class="action-icon">📊</span>
          <span class="action-label">Data Management</span>
        </button>
        <button class="btn btn-positive action-button" @click="showToolsSection = !showToolsSection">
          <span class="action-icon">🛠️</span>
          <span class="action-label">Tools</span>
        </button>
      </div>
    </section>

    <!-- Tools Section -->
    <section v-if="showToolsSection" class="tools-section">
      <h2 class="section-title">Tools</h2>
      <div class="tools-grid">
        <button
          class="tool-card"
          @click="openTool('ltc')"
          @touchstart="handleTouchStart"
          @touchend="handleTouchEnd"
        >
          <div class="tool-icon">⏱️</div>
          <div class="tool-info">
            <div class="tool-name">LTC Timecode Generator</div>
            <div class="tool-description">Generate Linear Timecode audio signal</div>
          </div>
          <div class="tool-arrow">→</div>
        </button>
        <button
          class="tool-card"
          @click="openTool('audio-signal')"
          @touchstart="handleTouchStart"
          @touchend="handleTouchEnd"
        >
          <div class="tool-icon">🔊</div>
          <div class="tool-info">
            <div class="tool-name">Audio Signal Generator</div>
            <div class="tool-description">Generate sine waves, noise, and sweeps</div>
          </div>
          <div class="tool-arrow">→</div>
        </button>
      </div>
    </section>
    </div>

  <!-- Error State -->
  <div v-else class="error-state">
    <div class="error-icon">⚠️</div>
    <h2 class="error-title">Unable to Load Project</h2>
    <p class="error-message">Please check your connection and try again.</p>
    <button class="btn btn-warning retry-button" @click="loadProject">
      <span class="retry-icon">🔄</span>
      Retry
    </button>
  </div>

  <!-- Stage Modal -->
  <StageQuickAccessMenu
    v-if="showStageModal && selectedStage"
    :stage="selectedStage"
    :project-id="currentProject?.id"
    :visible="showStageModal"
    @close="closeStageModal"
  />

  <!-- Tool Modal -->
  <div v-if="showToolModal && selectedTool" class="tool-modal-backdrop" @click.self="closeToolModal">
    <div class="tool-modal">
      <div class="tool-modal-header">
        <h2 class="tool-modal-title">{{ toolTitle }}</h2>
        <button class="tool-modal-close" @click="closeToolModal">×</button>
      </div>
      <div class="tool-modal-body">
        <LTCTimecodeGenerator v-if="selectedTool === 'ltc'" />
        <AudioSignalGenerator v-if="selectedTool === 'audio-signal'" />
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
import StageQuickAccessMenu from './stage/StageQuickAccessMenu.vue';
import LTCTimecodeGenerator from './tools/LTCTimecodeGenerator.vue';
import AudioSignalGenerator from './tools/AudioSignalGenerator.vue';

export default {
  name: 'ProjectDetail',
  components: { StageQuickAccessMenu, LTCTimecodeGenerator, AudioSignalGenerator },
  setup() {
    const route      = useRoute();
    const router     = useRouter();
    const userStore  = useUserStore();

    const isLoading       = ref(true);
    const currentProject  = computed(() => userStore.getCurrentProject);
    const stages          = ref([]);
    const showStageModal  = ref(false);
    const selectedStage   = ref(null);
    const showToolsSection = ref(false);
    const showToolModal   = ref(false);
    const selectedTool    = ref(null);

    onMounted(loadProject);

    /* ---------------- Project loading ---------------- */
    async function loadProject() {
      try {
        const projectId = route.params.id;
        if (!projectId) { isLoading.value = false; return; }

        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();

        if (error || !data) {
          console.error('Error fetching project:', error?.message);
        } else {
          userStore.setCurrentProject(data);
        }

        // Load stages for this project
        await loadStages();
      } catch (err) {
        console.error('Unexpected error fetching project:', err.message);
      } finally {
        isLoading.value = false;
      }
    }

    /* ---------------- Stages loading ---------------- */
    async function loadStages() {
      try {
        const projectId = route.params.id;
        stages.value = await fetchTableData('locations', {
          eq: { project_id: projectId },
          order: [{ column: 'order', ascending: true }],
        });
      } catch (err) {
        console.error('Error loading stages:', err.message);
        stages.value = [];
      }
    }

    /* ---------------- Navigation helpers ---------------- */
    function goToLocations() {
      router.push({ name: 'ProjectLocations', params: { id: currentProject.value.id } });
    }
    function goToCalendar() {
      router.push({ name: 'Calendar', params: { id: currentProject.value.id } });
    }
    function goToTravelHub() {
      router.push({ name: 'TravelDashboard', params: { id: currentProject.value.id } });
    }
    function goToContacts() {
      router.push({ name: 'ProjectContacts', params: { id: currentProject.value.id } });
    }
    function goToSettings() {
      router.push({ name: 'ProjectSettings', params: { id: currentProject.value.id } });
    }
    function goToGear() {
      router.push({ name: 'ProjectGear', params: { id: currentProject.value.id } });
    }
    function goToDocuments() {
      router.push({ name: 'ProjectDocs', params: { id: currentProject.value.id } });
    }
    function goToDataManagement() {
      router.push({ name: 'DataManagement', params: { id: currentProject.value.id } });
    }

    /* ---------------- Touch feedback ---------------- */
    function handleTouchStart(event) {
      event.currentTarget.classList.add('touch-active');
    }
    function handleTouchEnd(event) {
      event.currentTarget.classList.remove('touch-active');
    }

    /* ---------------- Stage navigation helpers ---------------- */
    function openStageModal(stage) {
      selectedStage.value = stage;
      showStageModal.value = true;
    }
    function closeStageModal() {
      showStageModal.value = false;
      selectedStage.value = null;
    }

    /* ---------------- Tool navigation helpers ---------------- */
    function openTool(toolName) {
      selectedTool.value = toolName;
      showToolModal.value = true;
    }
    function closeToolModal() {
      showToolModal.value = false;
      selectedTool.value = null;
    }

    const toolTitle = computed(() => {
      if (selectedTool.value === 'ltc') return 'LTC Timecode Generator';
      if (selectedTool.value === 'audio-signal') return 'Audio Signal Generator';
      return 'Tool';
    });

    function ordinal(n) {
      const s = ["th", "st", "nd", "rd"], v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }
    function formatSingleDate(dStr) {
      if (!dStr) return '';
      const d = new Date(dStr);
      const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
      const day = ordinal(d.getDate());
      const month = d.toLocaleDateString(undefined, { month: 'long' });
      return `${weekday} ${day} ${month}`;
    }

    return {
      isLoading,
      currentProject,
      stages,
      /* navigation */
      goToLocations,
      goToCalendar,
      goToTravelHub,
      goToContacts,
      goToSettings,
      goToGear,
      goToDocuments,
      goToDataManagement,
      /* stage navigation */
      openStageModal,
      closeStageModal,
      formatSingleDate,
      showStageModal,
      selectedStage,
      /* touch feedback */
      handleTouchStart,
      handleTouchEnd,
      loadProject,
      /* tools */
      showToolsSection,
      showToolModal,
      selectedTool,
      openTool,
      closeToolModal,
      toolTitle,
    };
  },
};
</script>

<style scoped>
/* Base Styles - Mobile First */
.project-detail {
  min-height: 100vh;
  background: var(--bg-primary);
  padding: 16px;
  padding-top: env(safe-area-inset-top, 16px);
  padding-bottom: env(safe-area-inset-bottom, 16px);
  font-family: var(--font-family-sans);
  line-height: 1.5;
  color: var(--text-primary);
}

/* Typography Scale */
.project-title {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
  margin: 0 0 16px 0;
  color: var(--text-heading);
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
  margin: 0 0 16px 0;
  color: var(--text-heading);
}

/* Loading Skeleton */
.loading-skeleton {
  padding: 16px;
}

.skeleton-header, .skeleton-meta, .skeleton-stages, .skeleton-actions {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 8px;
  margin-bottom: 16px;
}

.skeleton-header {
  height: 32px;
}

.skeleton-meta {
  height: 48px;
}

.skeleton-stages {
  height: 120px;
  display: flex;
  gap: 12px;
}

.skeleton-stage {
  flex: 1;
  height: 100%;
  background: inherit;
  border-radius: 8px;
}

.skeleton-actions {
  height: 200px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.skeleton-action {
  height: 100%;
  background: inherit;
  border-radius: 8px;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Project Header */
.project-header {
  margin-bottom: 24px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-light);
}

.project-meta {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
}

.meta-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
}

.meta-text {
  color: #495057;
}

.meta-link {
  color: #0066cc;
  text-decoration: none;
  font-weight: 500;
}

.meta-link:hover {
  text-decoration: underline;
}

/* Compact Header with Timeline */
.compact-header {
  margin-bottom: 24px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-light);
}

.header-main {
  margin-bottom: 16px;
}

.project-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.meta-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.meta-text {
  color: var(--text-secondary);
}

.meta-link {
  color: var(--text-link);
  text-decoration: none;
  font-weight: 500;
}

.meta-link:hover {
  text-decoration: underline;
}

/* Inline Timeline */
.inline-timeline {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.timeline-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
}

.timeline-chip.build {
  background: var(--color-primary-100);
  color: var(--color-primary-700);
  border: 1px solid var(--color-primary-200);
}

.timeline-chip.show {
  background: var(--color-secondary-100);
  color: var(--color-secondary-800);
  border: 1px solid var(--color-secondary-300);
}

/* Ensure icons and text have proper contrast in dark mode */
.dark .timeline-chip.build {
  background: var(--color-primary-600);
  color: var(--text-inverse);
  border: 1px solid var(--color-primary-700);
}

.dark .timeline-chip.show {
  background: var(--color-secondary-600);
  color: var(--text-inverse);
  border: 1px solid var(--color-secondary-700);
}

.chip-icon {
  font-size: 14px;
  width: 16px;
  text-align: center;
  color: inherit;
}

.dark .timeline-chip .chip-icon {
  color: var(--text-inverse);
  filter: none;
}

.chip-text {
  line-height: 1.3;
  color: inherit;
}

.dark .timeline-chip .chip-text {
  color: var(--text-inverse);
}



/* Stages Section */
.stages-section {
  margin-bottom: 24px;
}

.stages-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stage-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
  text-align: left;
  width: 100%;
}

.stage-card:hover {
  border-color: var(--color-primary-500);
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.1);
}

.stage-card:active,
.stage-card.touch-active {
  transform: scale(0.98);
  background: var(--bg-secondary);
}

.stage-icon {
  font-size: 24px;
  width: 48px;
  text-align: center;
  flex-shrink: 0;
}

.stage-info {
  flex: 1;
}

.stage-name {
  font-weight: 600;
  font-size: 16px;
  color: var(--text-heading);
  margin-bottom: 2px;
}

.stage-venue {
  font-size: 14px;
  color: var(--text-secondary);
}

.stage-arrow {
  font-size: 18px;
  color: var(--text-secondary);
  font-weight: 300;
}

/* Startup Section */
.startup-section {
  margin-bottom: 32px;
  padding: 32px 24px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 2px solid #dee2e6;
  border-radius: 16px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.startup-content {
  max-width: 400px;
  margin: 0 auto;
}

.startup-icon {
  font-size: 48px;
  margin-bottom: 16px;
  display: block;
}

.startup-title {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 12px 0;
  line-height: 1.3;
}

.startup-description {
  font-size: 16px;
  color: #6c757d;
  margin: 0 0 24px 0;
  line-height: 1.5;
}

.startup-button {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  background: #0066cc;
  color: #ffffff;
  border: none;
  border-radius: 12px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 56px;
  box-shadow: 0 4px 12px rgba(0, 102, 204, 0.2);
}

.startup-button:hover {
  background: #0052a3;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 102, 204, 0.3);
}

.startup-button:active {
  transform: scale(0.98);
}

.startup-button-icon {
  font-size: 20px;
  color: #ffffff;
}

.startup-button-text {
  font-size: 16px;
  color: #ffffff;
}

/* Actions Section */
.actions-section {
  margin-bottom: 24px;
}

.actions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.action-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 16px;
  background: #e0f2fe; /* consistent light background */
  border: 1px solid #7dd3fc; /* sky-300 */
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 88px;
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  color: #0c4a6e; /* dark readable text */
}

.action-button:hover {
  background: #bae6fd; /* subtle */
  border-color: #38bdf8; /* sky-400 */
  box-shadow: 0 2px 8px rgba(56, 189, 248, 0.15);
}

.action-button:active {
  transform: scale(0.98);
  background: #bfe3fb;
}

/* Primary variant aligns with same palette (no drastic inversion) */
.action-button.primary {
  background: #e0f2fe;
  color: #0c4a6e !important;
  border-color: #7dd3fc;
}

.action-button.primary:hover {
  background: #bae6fd;
  box-shadow: 0 2px 8px rgba(56, 189, 248, 0.2);
}

/* Ensure icon/label use the readable dark text on light background */
.action-button .action-icon,
.action-button .action-label {
  color: #0c4a6e !important;
}

/* Dark mode styling for action buttons */
.dark .action-button {
  background: var(--color-primary-700) !important;
  border: 1px solid var(--color-primary-600) !important;
  color: #ffffff !important;
}

.dark .action-button:hover {
  background: var(--color-primary-600) !important;
  border-color: var(--color-primary-500) !important;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
  color: #ffffff !important;
}

.dark .action-button:active {
  background: var(--color-primary-800) !important;
  color: #ffffff !important;
}

.dark .action-button.primary,
.dark .btn-primary.action-button {
  background: var(--color-primary-700) !important;
  color: #ffffff !important;
  border-color: var(--color-primary-600) !important;
}

.dark .action-button.primary:hover,
.dark .btn-primary.action-button:hover {
  background: var(--color-primary-600) !important;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
  color: #ffffff !important;
}

.dark .btn-positive.action-button {
  background: var(--color-success-700) !important;
  color: #ffffff !important;
  border-color: var(--color-success-600) !important;
}

.dark .btn-positive.action-button:hover {
  background: var(--color-success-600) !important;
  color: #ffffff !important;
}

.dark .btn-warning.action-button {
  background: var(--color-warning-700) !important;
  color: #ffffff !important;
  border-color: var(--color-warning-600) !important;
}

.dark .btn-warning.action-button:hover {
  background: var(--color-warning-600) !important;
  color: #ffffff !important;
}

/* Ensure icon/label use white text in dark mode */
.dark .action-button .action-icon,
.dark .action-button .action-label,
.dark .action-button * {
  color: #ffffff !important;
}

.action-icon {
  font-size: 32px;
  margin-bottom: 8px;
  display: block;
}

.action-label {
  font-size: 14px;
  line-height: 1.3;
}

/* Error State */
.error-state {
  text-align: center;
  padding: 48px 16px;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #1a1a1a;
}

.error-message {
  font-size: 16px;
  color: #6c757d;
  margin-bottom: 24px;
}

.retry-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: #0066cc;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease;
  min-height: 44px;
}

.retry-button:hover {
  background: #0052a3;
}

.retry-icon {
  font-size: 18px;
}

/* Tablet Breakpoint (601px - 1024px) */
@media (min-width: 601px) {
  .project-detail {
    padding: 24px;
    max-width: 768px;
    margin: 0 auto;
  }

  .project-title {
    font-size: 28px;
  }

  .actions-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  .stages-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .timeline-container {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
}

/* Desktop Breakpoint (1025px+) */
@media (min-width: 1025px) {
  .project-detail {
    padding: 32px;
    max-width: 1024px;
  }

  .project-title {
    font-size: 32px;
  }

  .actions-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }

  .stages-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }

  .timeline-container {
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
  }

  .compact-header {
    padding: 24px;
  }

  .inline-timeline {
    flex-direction: row;
    gap: 12px;
  }

  .stage-card {
    padding: 20px;
  }

  .action-button {
    padding: 24px 20px;
    min-height: 96px;
  }

  .startup-section {
    padding: 40px 32px;
  }

  .startup-title {
    font-size: 28px;
  }

  .startup-description {
    font-size: 18px;
  }

  .startup-button {
    padding: 20px 32px;
    font-size: 20px;
    min-height: 64px;
  }
}

/* Focus States for Accessibility */
.stage-card:focus,
.action-button:focus,
.retry-button:focus,
.startup-button:focus {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}

/* High Contrast Mode Support */
@media (prefers-contrast: high) {
  .project-detail {
    border: 2px solid #000000;
  }
  
  .stage-card,
  .action-button,
  .timeline-item {
    border-width: 2px;
  }
}

/* Tools Section */
.tools-section {
  margin-bottom: 24px;
}

.tools-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tool-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
  text-align: left;
  width: 100%;
}

.tool-card:hover {
  border-color: var(--color-primary-500);
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.1);
}

.tool-card:active,
.tool-card.touch-active {
  transform: scale(0.98);
  background: var(--bg-secondary);
}

.tool-icon {
  font-size: 24px;
  width: 48px;
  text-align: center;
  flex-shrink: 0;
}

.tool-info {
  flex: 1;
}

.tool-name {
  font-weight: 600;
  font-size: 16px;
  color: var(--text-heading);
  margin-bottom: 2px;
}

.tool-description {
  font-size: 14px;
  color: var(--text-secondary);
}

.tool-arrow {
  font-size: 18px;
  color: var(--text-secondary);
  font-weight: 300;
}

/* Tool Modal */
.tool-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1000;
  overflow-y: auto;
}

.tool-modal {
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  background: var(--bg-primary);
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.tool-modal-header {
  padding: 1rem 1.25rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.tool-modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-heading);
}

.tool-modal-close {
  background: none;
  border: none;
  font-size: 2rem;
  line-height: 1;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.tool-modal-close:hover {
  background: var(--bg-primary);
  color: var(--text-heading);
}

.tool-modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

/* Reduced Motion Support */
@media (prefers-reduced-motion: reduce) {
  .stage-card,
  .action-button,
  .startup-button,
  .tool-card {
    transition: none;
  }
  
  .stage-card:active,
  .stage-card.touch-active,
  .tool-card:active,
  .tool-card.touch-active {
    transform: none;
  }

  .startup-button:hover {
    transform: none;
  }

  .startup-button:active {
    transform: none;
  }
}

/* Tablet and Desktop adjustments for tools */
@media (min-width: 601px) {
  .tools-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
}

@media (min-width: 1025px) {
  .tools-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
}
</style>
