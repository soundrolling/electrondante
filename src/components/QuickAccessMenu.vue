<template>
  <!-- Quick Access Menu Popup (Tablet/Desktop) -->
  <div v-if="showQuickAccessMenu" class="quick-access-menu-backdrop" @click.self="closeQuickAccessMenu">
    <div class="quick-access-menu">
      <div class="quick-access-menu-header">
        <h2 class="quick-access-menu-title">Quick Access</h2>
        <button class="quick-access-menu-close" @click="closeQuickAccessMenu">×</button>
      </div>
      <div class="quick-access-menu-body">
        <!-- Stages Section -->
        <div v-if="stages.length" class="quick-access-stages">
          <h3 class="quick-access-section-title">Stages</h3>
          <div class="quick-access-stages-grid">
            <button
              v-for="stage in stages"
              :key="stage.id"
              class="quick-access-stage-card"
              @click="openStageFromMenu(stage)"
            >
              <div class="quick-access-stage-icon">🎪</div>
              <div class="quick-access-stage-info">
                <div class="quick-access-stage-name">{{ stage.stage_name }}</div>
                <div class="quick-access-stage-venue">{{ stage.venue_name }}</div>
              </div>
            </button>
          </div>
        </div>

        <!-- Project Tools Section -->
        <div class="quick-access-tools">
          <h3 class="quick-access-section-title">Project Tools</h3>
          <div class="quick-access-tools-grid">
            <button class="quick-access-tool-btn primary" @click="goToProjectHomeFromMenu">
              <span class="quick-access-tool-icon">🏠</span>
              <span class="quick-access-tool-label">Project Home</span>
            </button>
            <button class="quick-access-tool-btn" @click="goToLocationsFromMenu">
              <span class="quick-access-tool-icon">🏢</span>
              <span class="quick-access-tool-label">All Stages</span>
            </button>
            <button class="quick-access-tool-btn" @click="goToCalendarFromMenu">
              <span class="quick-access-tool-icon">📅</span>
              <span class="quick-access-tool-label">Calendar</span>
            </button>
            <button class="quick-access-tool-btn" @click="goToTravelHubFromMenu">
              <span class="quick-access-tool-icon">✈️</span>
              <span class="quick-access-tool-label">Travel Hub</span>
            </button>
            <button class="quick-access-tool-btn" @click="goToContactsFromMenu">
              <span class="quick-access-tool-icon">👥</span>
              <span class="quick-access-tool-label">Contacts</span>
            </button>
            <button class="quick-access-tool-btn" @click="goToSettingsFromMenu">
              <span class="quick-access-tool-icon">⚙️</span>
              <span class="quick-access-tool-label">Settings</span>
            </button>
            <button class="quick-access-tool-btn" @click="goToGearFromMenu">
              <span class="quick-access-tool-icon">🔧</span>
              <span class="quick-access-tool-label">Gear</span>
            </button>
            <button class="quick-access-tool-btn" @click="goToDocumentsFromMenu">
              <span class="quick-access-tool-icon">📄</span>
              <span class="quick-access-tool-label">Documents</span>
            </button>
            <button class="quick-access-tool-btn" @click="goToDataManagementFromMenu">
              <span class="quick-access-tool-icon">📊</span>
              <span class="quick-access-tool-label">Data Management</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Floating Menu Button (Tablet/Desktop only) -->
  <button 
    v-if="shouldShowButton" 
    class="floating-menu-button"
    @click="toggleQuickAccessMenu"
    :class="{ active: showQuickAccessMenu }"
    aria-label="Quick Access Menu"
  >
    <span class="floating-menu-icon">⚡</span>
  </button>

  <!-- Stage Modal -->
  <StageQuickAccessMenu
    v-if="showStageModal && selectedStage"
    :stage="selectedStage"
    :project-id="currentProject?.id"
    :visible="showStageModal"
    @close="closeStageModal"
  />
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '../stores/userStore';
import { fetchTableData } from '../services/dataService';
import StageQuickAccessMenu from './stage/StageQuickAccessMenu.vue';

export default {
  name: 'QuickAccessMenu',
  components: { StageQuickAccessMenu },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const userStore = useUserStore();

    const showQuickAccessMenu = ref(false);
    const stages = ref([]);
    const showStageModal = ref(false);
    const selectedStage = ref(null);
    const isLoadingStages = ref(false);

    const currentProject = computed(() => userStore.getCurrentProject);
    
    // Check if we're on a project route
    const isProjectRoute = computed(() => {
      return route.path.startsWith('/projects/') && route.params.id;
    });

    // Only show button if on project route and have a project
    const shouldShowButton = computed(() => {
      return isProjectRoute.value && currentProject.value && !isLoadingStages.value;
    });

    // Load stages when project changes
    watch([currentProject, isProjectRoute], async ([project, isProject]) => {
      if (isProject && project?.id) {
        await loadStages();
      } else {
        stages.value = [];
      }
    }, { immediate: true });

    /* ---------------- Stages loading ---------------- */
    async function loadStages() {
      if (!currentProject.value?.id) return;
      
      try {
        isLoadingStages.value = true;
        stages.value = await fetchTableData('locations', {
          eq: { project_id: currentProject.value.id },
          order: [{ column: 'order', ascending: true }],
        });
      } catch (err) {
        console.error('Error loading stages:', err.message);
        stages.value = [];
      } finally {
        isLoadingStages.value = false;
      }
    }

    /* ---------------- Quick Access Menu helpers ---------------- */
    function toggleQuickAccessMenu() {
      showQuickAccessMenu.value = !showQuickAccessMenu.value;
    }
    
    function closeQuickAccessMenu() {
      showQuickAccessMenu.value = false;
    }

    /* ---------------- Navigation helpers ---------------- */
    function goToProjectHome() {
      if (!currentProject.value?.id) return;
      router.push({ name: 'ProjectDetail', params: { id: currentProject.value.id } });
    }
    
    function goToLocations() {
      if (!currentProject.value?.id) return;
      router.push({ name: 'ProjectLocations', params: { id: currentProject.value.id } });
    }
    
    function goToCalendar() {
      if (!currentProject.value?.id) return;
      router.push({ name: 'Calendar', params: { id: currentProject.value.id } });
    }
    
    function goToTravelHub() {
      if (!currentProject.value?.id) return;
      router.push({ name: 'TravelDashboard', params: { id: currentProject.value.id } });
    }
    
    function goToContacts() {
      if (!currentProject.value?.id) return;
      router.push({ name: 'ProjectContacts', params: { id: currentProject.value.id } });
    }
    
    function goToSettings() {
      if (!currentProject.value?.id) return;
      router.push({ name: 'ProjectSettings', params: { id: currentProject.value.id } });
    }
    
    function goToGear() {
      if (!currentProject.value?.id) return;
      router.push({ name: 'ProjectGear', params: { id: currentProject.value.id } });
    }
    
    function goToDocuments() {
      if (!currentProject.value?.id) return;
      router.push({ name: 'ProjectDocs', params: { id: currentProject.value.id } });
    }
    
    function goToDataManagement() {
      if (!currentProject.value?.id) return;
      router.push({ name: 'DataManagement', params: { id: currentProject.value.id } });
    }

    function openStageModal(stage) {
      selectedStage.value = stage;
      showStageModal.value = true;
    }
    
    function closeStageModal() {
      showStageModal.value = false;
      selectedStage.value = null;
    }

    function openStageFromMenu(stage) {
      closeQuickAccessMenu();
      openStageModal(stage);
    }
    
    function goToProjectHomeFromMenu() {
      closeQuickAccessMenu();
      goToProjectHome();
    }
    
    function goToLocationsFromMenu() {
      closeQuickAccessMenu();
      goToLocations();
    }
    
    function goToCalendarFromMenu() {
      closeQuickAccessMenu();
      goToCalendar();
    }
    
    function goToTravelHubFromMenu() {
      closeQuickAccessMenu();
      goToTravelHub();
    }
    
    function goToContactsFromMenu() {
      closeQuickAccessMenu();
      goToContacts();
    }
    
    function goToSettingsFromMenu() {
      closeQuickAccessMenu();
      goToSettings();
    }
    
    function goToGearFromMenu() {
      closeQuickAccessMenu();
      goToGear();
    }
    
    function goToDocumentsFromMenu() {
      closeQuickAccessMenu();
      goToDocuments();
    }
    
    function goToDataManagementFromMenu() {
      closeQuickAccessMenu();
      goToDataManagement();
    }

    return {
      showQuickAccessMenu,
      stages,
      currentProject,
      shouldShowButton,
      showStageModal,
      selectedStage,
      toggleQuickAccessMenu,
      closeQuickAccessMenu,
      openStageFromMenu,
      goToProjectHomeFromMenu,
      goToLocationsFromMenu,
      goToCalendarFromMenu,
      goToTravelHubFromMenu,
      goToContactsFromMenu,
      goToSettingsFromMenu,
      goToGearFromMenu,
      goToDocumentsFromMenu,
      goToDataManagementFromMenu,
      closeStageModal,
    };
  },
};
</script>

<style scoped>
/* Quick Access Menu Popup */
.quick-access-menu-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 2000;
  overflow-y: auto;
}

.quick-access-menu {
  width: 100%;
  max-width: 800px;
  max-height: 90vh;
  background: var(--bg-primary);
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.quick-access-menu-header {
  padding: 1.25rem 1.5rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.quick-access-menu-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-heading);
}

.quick-access-menu-close {
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

.quick-access-menu-close:hover {
  background: var(--bg-primary);
  color: var(--text-heading);
}

.quick-access-menu-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.quick-access-section-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-heading);
  margin: 0 0 1rem 0;
}

.quick-access-stages {
  margin-bottom: 2rem;
}

.quick-access-stages-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.quick-access-stage-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
}

.quick-access-stage-card:hover {
  border-color: var(--color-primary-500);
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.1);
  transform: translateY(-2px);
}

.quick-access-stage-card:active {
  transform: scale(0.98);
}

.quick-access-stage-icon {
  font-size: 24px;
  width: 40px;
  text-align: center;
  flex-shrink: 0;
}

.quick-access-stage-info {
  flex: 1;
  min-width: 0;
}

.quick-access-stage-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-heading);
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.quick-access-stage-venue {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.quick-access-tools {
  margin-top: 1.5rem;
}

.quick-access-tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.quick-access-tool-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 80px;
  text-align: center;
}

.quick-access-tool-btn:hover {
  border-color: var(--color-primary-500);
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.1);
  transform: translateY(-2px);
  background: var(--bg-primary);
}

.quick-access-tool-btn:active {
  transform: scale(0.98);
}

.quick-access-tool-btn.primary {
  background: var(--color-primary-100);
  border-color: var(--color-primary-300);
  color: var(--color-primary-700);
}

.quick-access-tool-btn.primary:hover {
  background: var(--color-primary-200);
  border-color: var(--color-primary-400);
}

.dark .quick-access-tool-btn.primary {
  background: var(--color-primary-700);
  border-color: var(--color-primary-600);
  color: var(--text-inverse);
}

.dark .quick-access-tool-btn.primary:hover {
  background: var(--color-primary-600);
}

.quick-access-tool-icon {
  font-size: 28px;
  margin-bottom: 8px;
  display: block;
}

.quick-access-tool-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.3;
}

.dark .quick-access-tool-btn.primary .quick-access-tool-label {
  color: var(--text-inverse);
}

/* Floating Menu Button */
.floating-menu-button {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--color-primary-600);
  border: none;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  display: none; /* Hidden on mobile */
  align-items: center;
  justify-content: center;
  z-index: 1500;
  transition: all 0.3s ease;
}

.floating-menu-button:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  background: var(--color-primary-500);
}

.floating-menu-button:active {
  transform: scale(0.95);
}

.floating-menu-button.active {
  background: var(--color-primary-700);
  transform: rotate(45deg);
}

.floating-menu-icon {
  font-size: 28px;
  color: #ffffff;
  transition: transform 0.3s ease;
}

.floating-menu-button.active .floating-menu-icon {
  transform: rotate(-45deg);
}

/* Show floating button only on tablet/desktop */
@media (min-width: 601px) {
  .floating-menu-button {
    display: flex;
  }
}

/* Desktop adjustments for quick access menu */
@media (min-width: 1025px) {
  .quick-access-stages-grid {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
  }

  .quick-access-tools-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 16px;
  }

  .quick-access-tool-btn {
    padding: 20px 16px;
    min-height: 90px;
  }

  .quick-access-tool-icon {
    font-size: 32px;
  }

  .quick-access-tool-label {
    font-size: 14px;
  }
}
</style>

