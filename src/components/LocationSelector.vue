<template>
<div id="LocationSelector">
  <h2>Select Venue and Location</h2>
  
  <!-- Venue Selection -->
  <div class="form-group">
    <label for="venue">Select Venue:</label>
    <select v-model="selectedVenue" @change="fetchLocations" class="form-select">
      <option disabled value="">-- Select Venue --</option>
      <option v-for="venue in venues" :value="venue.id" :key="venue.id">
        {{ venue.venue_name }}
      </option>
    </select>
    <p v-if="isLoadingVenues" class="info-message">Loading venues...</p>
    <p v-if="venueError" class="error-message">{{ venueError }}</p>
  </div>
  
  <!-- Location Selection -->
  <div v-if="selectedVenue" class="form-group">
    <label for="location">Select Location:</label>
    <select v-model="selectedLocation" class="form-select">
      <option disabled value="">-- Select Location --</option>
      <option v-for="location in locations" :value="location.id" :key="location.id">
        {{ location.location_name }}
      </option>
    </select>
    <p v-if="isLoadingLocations" class="info-message">Loading locations...</p>
    <p v-if="locationError" class="error-message">{{ locationError }}</p>
  </div>
  
  <!-- Proceed to Signal Mapper -->
  <div v-if="selectedLocation" class="form-actions">
    <router-link 
      :to="{ name: 'SignalMapper', query: { venueId: selectedVenue, stageId: selectedLocation, locationId: selectedLocation } }">
      <button class="proceed-button">Proceed to Signal Mapper</button>
    </router-link>
  </div>
</div>
</template>

<script>
import { ref, onMounted } from 'vue';
// Use your offline service function instead of direct Supabase calls
import { fetchTableData } from '../services/dataService';

export default {
name: 'LocationSelector',
setup() {
  const venues = ref([]);
  const locations = ref([]);
  const selectedVenue = ref('');
  const selectedLocation = ref('');
  const isLoadingVenues = ref(false);
  const isLoadingLocations = ref(false);
  const venueError = ref('');
  const locationError = ref('');

  // Fetch venues using an offline-aware function
  const fetchVenues = async () => {
    isLoadingVenues.value = true;
    venueError.value = '';
    try {
      const data = await fetchTableData('venues', {}); // Adjust filters as needed
      venues.value = data;
    } catch (error) {
      venueError.value = error.message;
      console.error('Error fetching venues:', error);
    } finally {
      isLoadingVenues.value = false;
    }
  };

  // Fetch locations based on the selected venue
  const fetchLocations = async () => {
    if (!selectedVenue.value) return;
    isLoadingLocations.value = true;
    locationError.value = '';
    try {
      const data = await fetchTableData('locations', { eq: { venue_id: selectedVenue.value } });
      locations.value = data;
    } catch (error) {
      locationError.value = error.message;
      console.error('Error fetching locations:', error);
    } finally {
      isLoadingLocations.value = false;
    }
  };

  onMounted(() => {
    fetchVenues();
  });

  return {
    venues,
    locations,
    selectedVenue,
    selectedLocation,
    fetchLocations,
    isLoadingVenues,
    isLoadingLocations,
    venueError,
    locationError,
  };
},
};
</script>

<style scoped>
.form-group {
margin-bottom: 20px;
}

.form-select {
width: 100%;
padding: 8px 12px;
font-size: 1rem;
border: 1px solid #ced4da;
border-radius: 4px;
}

.info-message {
margin-top: 8px;
font-size: 0.9rem;
color: #007bff;
}

.error-message {
margin-top: 8px;
font-size: 0.9rem;
color: #e74c3c;
}

.proceed-button {
background-color: #007bff;
color: white;
padding: 10px 20px;
border: none;
border-radius: 5px;
cursor: pointer;
}

.proceed-button:hover {
background-color: #0056b3;
}
</style>
