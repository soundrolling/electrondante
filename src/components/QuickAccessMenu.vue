<template>
  <!-- Floating Menu Button (Tablet/Desktop only) - Shows only when on a stage route -->
  <button 
    v-if="shouldShowButton && currentStage" 
    class="floating-menu-button"
    @click="openStageMenu"
    aria-label="Quick Access Stage Menu"
  >
    <span class="floating-menu-icon">⚡</span>
  </button>

  <!-- Stage Modal -->
  <StageQuickAccessMenu
    v-if="showStageModal && currentStage"
    :stage="currentStage"
    :project-id="currentProject?.id"
    :stages="allStages"
    :visible="showStageModal"
    @close="closeStageModal"
    @stage-change="handleStageChange"
  />
</template>

<script>
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useUserStore } from '../stores/userStore';
import { fetchTableData } from '../services/dataService';
import StageQuickAccessMenu from './stage/StageQuickAccessMenu.vue';

export default {
  name: 'QuickAccessMenu',
  components: { StageQuickAccessMenu },
  setup() {
    const route = useRoute();
    const userStore = useUserStore();

    const showStageModal = ref(false);
    const currentStage = ref(null);
    const isLoadingStage = ref(false);
    const allStages = ref([]);

    const currentProject = computed(() => userStore.getCurrentProject);
    
    // Get locationId from route params or query
    const locationId = computed(() => {
      return route.params.locationId || route.query.locationId || route.query.stageId;
    });

    // Check if we're on a project route
    const isProjectRoute = computed(() => {
      return route.path.startsWith('/projects/') && route.params.id;
    });

    // Only show button if on project route, have a project, and have a locationId (stage route)
    const shouldShowButton = computed(() => {
      return isProjectRoute.value && currentProject.value && locationId.value && !isLoadingStage.value;
    });

    // Load all stages for the project
    watch([currentProject], async ([project]) => {
      if (project?.id) {
        await loadAllStages(project.id);
      } else {
        allStages.value = [];
      }
    }, { immediate: true });

    // Load current stage when locationId changes
    watch([locationId, currentProject], async ([locId, project]) => {
      if (locId && project?.id) {
        await loadCurrentStage(locId);
      } else {
        currentStage.value = null;
      }
    }, { immediate: true });

    /* ---------------- Load all stages for project ---------------- */
    async function loadAllStages(projectId) {
      if (!projectId) return;
      
      try {
        allStages.value = await fetchTableData('locations', {
          eq: { project_id: projectId },
          order: [{ column: 'order', ascending: true }],
        });
      } catch (err) {
        console.error('Error loading all stages:', err.message);
        allStages.value = [];
      }
    }

    /* ---------------- Load current stage ---------------- */
    async function loadCurrentStage(stageId) {
      if (!stageId) return;
      
      try {
        isLoadingStage.value = true;
        // First try to find in already loaded stages
        const foundStage = allStages.value.find(s => s.id === stageId);
        if (foundStage) {
          currentStage.value = foundStage;
        } else {
          // Fallback to fetching if not found
          const stages = await fetchTableData('locations', {
            eq: { id: stageId },
          });
          currentStage.value = stages.length > 0 ? stages[0] : null;
        }
      } catch (err) {
        console.error('Error loading current stage:', err.message);
        currentStage.value = null;
      } finally {
        isLoadingStage.value = false;
      }
    }

    /* ---------------- Stage menu helpers ---------------- */
    function openStageMenu() {
      if (currentStage.value) {
        showStageModal.value = true;
      }
    }
    
    function closeStageModal() {
      showStageModal.value = false;
    }

    function handleStageChange(stageId) {
      if (stageId) {
        loadCurrentStage(stageId);
      }
    }

    return {
      currentProject,
      currentStage,
      allStages,
      shouldShowButton,
      showStageModal,
      openStageMenu,
      closeStageModal,
      handleStageChange,
    };
  },
};
</script>

<style scoped>
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

.floating-menu-icon {
  font-size: 28px;
  color: #ffffff;
}

/* Show floating button only on tablet/desktop */
@media (min-width: 601px) {
  .floating-menu-button {
    display: flex;
  }
}
</style>

