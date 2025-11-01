<template>
<div class="project-notes">
  <!-- Header Section -->
  <div class="header-section ui-page-header">
    <h1>Project Notes</h1>
  </div>

  <!-- Locations Section -->
  <div class="locations-section">
    <h2>Select a location to make notes for.</h2>
    <p>
      Select a location from the list below to start writing notes. Ensure your desired timecode source is selected to accurately timestamp your notes.
    </p>
    <div v-if="locations.length > 0" class="location-list">
      <div v-for="location in locations" :key="location.id" class="location-item">
        <button class="location-button" @click="goToLocationNotes(location.id)">
          {{ location.venue_name }} - {{ location.stage_name }}
        </button>
      </div>
    </div>
    <div v-else class="no-locations">
      <p>No locations available for this project.</p>
      <router-link
        :to="{ name: 'ProjectLocations', params: { id: $route.params.id } }"
        class="nav-link"
      >
        Go to Locations Tab to Add New Locations
      </router-link>
    </div>
  </div>
</div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/userStore';
import { useToast } from 'vue-toastification';
import { fetchTableData } from '../services/dataService';

export default {
setup() {
  const router = useRouter();
  const userStore = useUserStore();
  const toast = useToast();
  const locations = ref([]);

  // Timecode state and methods (if needed on this page)
  const liveTimecode = computed(() => userStore.getLiveTimecode);
  const timeSource = ref(localStorage.getItem('timeSource') || 'device');
  const customTimecode = ref(localStorage.getItem('customTimecode') || '00:00:00');
  const worldTimeAdjustment = ref(parseFloat(localStorage.getItem('worldTimeAdjustment')) || 0);
  const currentGMTTime = ref(null);
  const currentAdjustedGMTTime = ref(null);
  const lastTimeSource = ref(localStorage.getItem('lastTimeSource') || 'Device Time');

  const currentTimeSourceLabel = computed(() => {
    if (lastTimeSource.value === 'Device Time') return 'Device Time';
    if (lastTimeSource.value === 'Custom Timecode') return 'Custom Timecode';
    if (lastTimeSource.value === 'World Time (GMT)') return 'World Time (GMT)';
    return 'Unknown';
  });

  // Fetch locations with offline caching
  const fetchLocations = async () => {
    const projectId = router.currentRoute.value.params.id;
    // If offline, try to load cached locations
    if (!navigator.onLine) {
      const cached = localStorage.getItem(`projectLocations_${projectId}`);
      if (cached) {
        locations.value = JSON.parse(cached);
        return;
      }
    }
    try {
      const data = await fetchTableData('locations', {
        eq: { project_id: projectId },
        order: [
          { column: 'venue_name', ascending: true },
          { column: 'stage_name', ascending: true }
        ]
      });
      locations.value = data;
      // Cache the data for offline use
      localStorage.setItem(`projectLocations_${projectId}`, JSON.stringify(data));
    } catch (error) {
      toast.error(`Error fetching locations: ${error.message}`);
    }
  };

  const goToLocationNotes = (locationId) => {
    router.push({ name: 'LocationNotes', params: { locationId } });
  };

  // Handle connection changes: refetch locations when back online
  const handleConnectionChange = () => {
    if (navigator.onLine) {
      fetchLocations();
    }
  };

  onMounted(() => {
    fetchLocations();
    window.addEventListener('online', handleConnectionChange);
    window.addEventListener('offline', handleConnectionChange);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('online', handleConnectionChange);
    window.removeEventListener('offline', handleConnectionChange);
  });

  return {
    locations,
    liveTimecode,
    timeSource,
    customTimecode,
    worldTimeAdjustment,
    currentGMTTime,
    currentAdjustedGMTTime,
    currentTimeSourceLabel,
    goToLocationNotes,
  };
},
};
</script>

<style scoped>
/* Container */
.project-notes {
padding: 20px;
max-width: 1200px;
margin: 0 auto;
font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

/* Header Section */
.header-section h1 {
text-align: center;
margin-bottom: 10px;
font-size: 2em;
color: var(--text-primary);
}

.header-section p {
text-align: center;
color: var(--text-secondary);
}

/* Locations Section */
.locations-section {
padding: 20px;
background-color: var(--bg-secondary);
border-radius: 8px;
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
margin-bottom: 20px;
}

.locations-section h2 {
margin-bottom: 15px;
color: var(--text-primary);
}

.location-list {
display: flex;
flex-direction: column;
gap: 10px;
}

.location-item {
/* Additional styling if needed */
}

.location-button {
background-color: var(--color-primary-500);
color: white;
padding: 10px 15px;
width: 100%;
text-align: left;
border: none;
border-radius: 5px;
cursor: pointer;
transition: background-color 0.3s ease;
}

.location-button:hover {
background-color: var(--color-primary-600);
}

.no-locations p {
text-align: center;
color: var(--text-secondary);
margin-bottom: 10px;
}

.nav-link {
display: inline-block;
background-color: var(--color-success-500);
color: white;
padding: 8px 12px;
text-decoration: none;
border-radius: 5px;
transition: background-color 0.3s ease;
}

.nav-link:hover {
background-color: var(--color-success-600);
}

/* Responsive Styles */
@media (max-width: 768px) {
.project-notes {
  padding: 15px;
}
.header-section h1 {
  font-size: 1.8em;
}
.header-section p {
  font-size: 1em;
}
.locations-section {
  padding: 15px;
}
.location-button,
.nav-link {
  width: 100%;
  text-align: center;
}
}

@media (max-width: 480px) {
.header-section h1 {
  font-size: 1.5em;
}
}
</style>
