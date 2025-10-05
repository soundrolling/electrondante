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
    <section class="compact-header">
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
        <button class="btn btn-primary action-button" @click="goToProfile">
          <span class="action-icon">👤</span>
          <span class="action-label">Profile</span>
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
</div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '../stores/userStore';
import { supabase } from '../supabase';
import { fetchTableData } from '../services/dataService';
import StageQuickAccessMenu from './stage/StageQuickAccessMenu.vue';

export default {
  name: 'ProjectDetail',
  components: { StageQuickAccessMenu },
  setup() {
    const route      = useRoute();
    const router     = useRouter();
    const userStore  = useUserStore();

    const isLoading       = ref(true);
    const currentProject  = computed(() => userStore.getCurrentProject);
    const stages          = ref([]);
    const showStageModal  = ref(false);
    const selectedStage   = ref(null);

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
    function goToProfile() {
      router.push({ name: 'UserProfile' });
    }
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
      goToProfile,
      goToLocations,
      goToCalendar,
      goToTravelHub,
      goToContacts,
      goToSettings,
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
    };
  },
};
</script>

<style scoped>
/* Base Styles - Mobile First */
.project-detail {
  min-height: 100vh;
  background: #ffffff;
  padding: 16px;
  padding-top: env(safe-area-inset-top, 16px);
  padding-bottom: env(safe-area-inset-bottom, 16px);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.5;
  color: #1a1a1a;
}

/* Typography Scale */
.project-title {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
  margin: 0 0 16px 0;
  color: #1a1a1a;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
  margin: 0 0 16px 0;
  color: #1a1a1a;
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
  background: #f8f9fa;
  border-radius: 12px;
  border: 1px solid #e9ecef;
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
  background: #f8f9fa;
  border-radius: 12px;
  border: 1px solid #e9ecef;
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
  background: #e3f2fd;
  color: #1976d2;
  border: 1px solid #bbdefb;
}

.timeline-chip.show {
  background: #f3e5f5;
  color: #7b1fa2;
  border: 1px solid #e1bee7;
}

.chip-icon {
  font-size: 14px;
  width: 16px;
  text-align: center;
}

.chip-text {
  line-height: 1.3;
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
  background: #ffffff;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
  text-align: left;
  width: 100%;
}

.stage-card:hover {
  border-color: #0066cc;
  box-shadow: 0 2px 8px rgba(0, 102, 204, 0.1);
}

.stage-card:active,
.stage-card.touch-active {
  transform: scale(0.98);
  background: #f8f9fa;
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
  color: #1a1a1a;
  margin-bottom: 2px;
}

.stage-venue {
  font-size: 14px;
  color: #6c757d;
}

.stage-arrow {
  font-size: 18px;
  color: #6c757d;
  font-weight: 300;
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
  background: #ffffff;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 88px;
  text-align: center;
  font-size: 16px;
  font-weight: 500;
  color: #1a1a1a;
}

.action-button:hover {
  border-color: #0066cc;
  box-shadow: 0 2px 8px rgba(0, 102, 204, 0.1);
}

.action-button:active {
  transform: scale(0.98);
  background: #f8f9fa;
}

.action-button.primary {
  background: #0066cc;
  color: #ffffff;
  border-color: #0066cc;
}

.action-button.primary:hover {
  background: #0052a3;
  box-shadow: 0 2px 8px rgba(0, 102, 204, 0.2);
}

/* Ensure high-contrast text on primary tiles even with global overrides */
.action-button.primary,
.action-button.primary .action-icon,
.action-button.primary .action-label {
  color: #ffffff !important;
}

/* Ensure non-primary tiles use dark text on light backgrounds */
.action-button:not(.primary),
.action-button:not(.primary) .action-icon,
.action-button:not(.primary) .action-label {
  color: #1a1a1a !important;
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
}

/* Focus States for Accessibility */
.stage-card:focus,
.action-button:focus,
.retry-button:focus {
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

/* Reduced Motion Support */
@media (prefers-reduced-motion: reduce) {
  .stage-card,
  .action-button {
    transition: none;
  }
  
  .stage-card:active,
  .stage-card.touch-active {
    transform: none;
  }
}
</style>
