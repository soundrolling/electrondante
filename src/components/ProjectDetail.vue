<template>
<div class="project-detail modern-detail">
  <div v-if="isLoading" class="loading-indicator">
    <p>Loading project...</p>
  </div>

  <div v-else-if="currentProject">
    <!-- Title -->
    <h2 class="project-title modern-title">
      Project: {{ currentProject.project_name }}
    </h2>

    <!-- Project Details (location, build/show days) -->
    <div class="project-meta-section">
      <div v-if="currentProject.location" class="project-location">
        <strong>Location:</strong> {{ currentProject.location }}
      </div>
      <div v-if="currentProject.official_website" class="project-website">
        <a :href="currentProject.official_website" target="_blank" rel="noopener" class="website-link">
          <strong>Website</strong>
        </a>
      </div>
      <table v-if="(currentProject.main_show_days && currentProject.main_show_days.length) || (currentProject.build_days && currentProject.build_days.length)" class="date-table">
        <thead>
          <tr>
            <th></th>
            <th>Start</th>
            <th>End</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="currentProject.build_days && currentProject.build_days.length">
            <td><strong>Build</strong></td>
            <td>{{ formatSingleDate(currentProject.build_days[0]) }}</td>
            <td>{{ formatSingleDate(currentProject.build_days[currentProject.build_days.length-1]) }}</td>
          </tr>
          <tr v-if="currentProject.main_show_days && currentProject.main_show_days.length">
            <td><strong>Show</strong></td>
            <td>{{ formatSingleDate(currentProject.main_show_days[0]) }}</td>
            <td>{{ formatSingleDate(currentProject.main_show_days[currentProject.main_show_days.length-1]) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Stage Shortcuts -->
    <div v-if="stages.length" class="mini-stage-cards-section">
      <h3 class="stage-shortcuts-title">Quick Access Stages</h3>
      <div class="mini-stage-cards-row">
        <div
          v-for="stage in stages"
          :key="stage.id"
          class="mini-stage-card"
          @click="openStageModal(stage)"
          :tabindex="0"
          @keydown.enter="openStageModal(stage)"
        >
          <div class="mini-stage-name">{{ stage.stage_name }}</div>
          <div class="mini-stage-venue">{{ stage.venue_name }}</div>
        </div>
      </div>
      <StageQuickAccessMenu
        v-if="showStageModal && selectedStage"
        :stage="selectedStage"
        :project-id="currentProject.id"
        :visible="showStageModal"
        @close="closeStageModal"
      />
    </div>

    <!-- Quick‑Access Tiles -->
    <div class="quick-access-container modern-qa-grid">
      <div class="qa-tile modern-qa-tile" @click="goToLocations">
        <span class="emoji">🏢</span>
        <span class="label">All Stages</span>
      </div>
      <div class="qa-tile modern-qa-tile" @click="goToCalendar">
        <span class="emoji">📆</span>
        <span class="label">Calendar</span>
      </div>
      <div class="qa-tile modern-qa-tile" @click="goToTravelHub">
        <span class="emoji">✈️</span>
        <span class="label">Travel&nbsp;Hub</span>
      </div>
      <div class="qa-tile modern-qa-tile" @click="goToContacts">
        <span class="emoji">👥</span>
        <span class="label">Contacts</span>
      </div>
      <div class="qa-tile modern-qa-tile" @click="goToSettings">
        <span class="emoji">⚙️</span>
        <span class="label">Settings</span>
      </div>
      <div class="qa-tile modern-qa-tile" @click="goToProfile">
        <span class="emoji">🙋‍♂️</span>
        <span class="label">My&nbsp;Profile</span>
      </div>
    </div>
  </div>

  <div v-else>
    <p>Error loading project details.</p>
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
    // goToCallSheet removed
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

    /* ---------------- Stage navigation helpers ---------------- */
    function goToLocationNotes(stage) {
      router.push({
        name: 'LocationNotes',
        params: { id: currentProject.value.id, locationId: stage.id },
      });
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

    function openStageModal(stage) {
      selectedStage.value = stage;
      showStageModal.value = true;
    }
    function closeStageModal() {
      showStageModal.value = false;
      selectedStage.value = null;
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
      goToLocationNotes,
      formatSingleDate,
      showStageModal,
      selectedStage,
      openStageModal,
      closeStageModal,
    };
  },
};
</script>

<style scoped>
.project-detail.modern-detail {
  max-width: 900px;
  margin: 32px auto;
  padding: 32px;
  background: #f8f9fa;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  border: 1px solid #e5e7eb;
  font-family: 'Segoe UI', Arial, sans-serif;
}
.project-title.modern-title {
  text-align: center;
  font-size: 2.1rem;
  margin-bottom: 10px;
  color: #1f2937;
  font-weight: 700;
}
.loading-indicator {
  text-align: center;
  margin-top: 50px;
}
.project-meta-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
  gap: 6px;
}
.project-location {
  color: #374151;
  font-size: 1.05rem;
  margin-bottom: 2px;
}
.project-website {
  color: #374151;
  font-size: 1.05rem;
  margin-bottom: 2px;
}
.website-link {
  color: #3b82f6;
  text-decoration: none;
}
.date-table {
  border-collapse: collapse;
  margin-top: 4px;
  margin-bottom: 4px;
  font-size: 0.97rem;
}
.date-table th, .date-table td {
  border: 1px solid #e5e7eb;
  padding: 4px 8px;
  text-align: left;
}
.date-table th {
  background: #f1f5f9;
  color: #222;
  font-weight: 600;
}
.date-table tr:nth-child(even) td {
  background: #f8fafc;
}

/* Mini Stage Cards Row */
.mini-stage-cards-section {
  margin-bottom: 24px;
}
.mini-stage-cards-row {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;
  scrollbar-width: thin;
}
.mini-stage-card {
  background: #fff;
  border-radius: 8px;
  padding: 10px 16px;
  min-width: 140px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  border: 1.5px solid #e5e7eb;
  cursor: pointer;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  transition: box-shadow 0.18s, border-color 0.18s;
}
.mini-stage-card:focus {
  outline: 2px solid #3b82f6;
}
.mini-stage-card:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  border-color: #3b82f6;
}
.mini-stage-name {
  font-weight: 600;
  font-size: 1rem;
  color: #1f2937;
  margin-bottom: 2px;
}
.mini-stage-venue {
  font-size: 0.92rem;
  color: #64748b;
}

.quick-access-container.modern-qa-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 20px;
  justify-items: center;
  margin-top: 18px;
}
.qa-tile.modern-qa-tile {
  background: #f1f5f9;
  border-radius: 8px;
  width: 100%;
  padding: 30px 0;
  cursor: pointer;
  transition: background 0.2s, box-shadow 0.2s;
  text-align: center;
  font-weight: 600;
  font-size: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1.5px solid #e5e7eb;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.qa-tile.modern-qa-tile:hover {
  background: #e0e7ef;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.qa-tile .emoji {
  font-size: 2rem;
  margin-bottom: 10px;
}

@media (max-width: 700px) {
  .project-detail.modern-detail {
    padding: 14px;
  }
  .project-title.modern-title {
    font-size: 1.2rem;
  }
  .mini-stage-cards-row {
    gap: 8px;
  }
  .mini-stage-card {
    min-width: 110px;
    padding: 8px 8px;
  }
  .mini-stage-name {
    font-size: 0.95rem;
  }
  .mini-stage-venue {
    font-size: 0.85rem;
  }
  .quick-access-container.modern-qa-grid {
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .qa-tile.modern-qa-tile {
    padding: 18px 0;
    font-size: 0.97rem;
  }
}
</style>
