<template>
<div class="accommodations">
  <div class="header-section">
    <h1>Accommodations</h1>
    <p>Manage your hotel and lodging information</p>
    <button class="back-button" @click="goBackToDashboard">Back to Dashboard</button>
  </div>

  <div class="trip-selector">
    <label for="trip-select">Select Trip:</label>
    <select
      id="trip-select"
      v-model="selectedTripId"
      @change="loadAccommodations"
    >
      <option value="">-- Select a Trip --</option>
      <option v-for="trip in trips" :key="trip.id" :value="trip.id">
        {{ trip.name }} ({{ formatDateRange(trip.start_date, trip.end_date) }})
      </option>
    </select>
  </div>

  <div v-if="isLoading" class="loading-spinner">
    <div class="spinner"></div>
    <p>Loading accommodations...</p>
  </div>

  <div v-else-if="!selectedTripId" class="empty-state">
    <p>Please select a trip to view accommodations</p>
  </div>

  <div v-else class="content-container">
    <div class="section-header">
      <h2>Accommodations</h2>
      <button @click="openAddForm" class="add-button">
        <span class="icon">+</span> Add Accommodation
      </button>
    </div>

    <!-- Inline Add/Edit Form -->
    <div v-if="showAccommodationForm" class="accommodation-form-container">
      <h3>{{ editingAccommodation ? 'Edit Accommodation' : 'Add New Accommodation' }}</h3>
      <form @submit.prevent="saveAccommodation">
        <div class="form-group">
          <label for="accommodationName">Accommodation Name</label>
          <input
            type="text"
            id="accommodationName"
            v-model="accommodationForm.name"
            required
            placeholder="e.g., Hilton Downtown"
          />
        </div>

        <div class="form-group">
          <label for="accommodationType">Accommodation Type</label>
          <select id="accommodationType" v-model="accommodationForm.type" required>
            <option value="">-- Select Type --</option>
            <option value="Hotel">Hotel</option>
            <option value="Airbnb">Airbnb</option>
            <option value="Hostel">Hostel</option>
            <option value="Resort">Resort</option>
            <option value="Apartment">Apartment</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div class="form-group">
          <label for="accommodationAddress">Address</label>
          <input
            type="text"
            id="accommodationAddress"
            v-model="accommodationForm.address"
            required
            placeholder="Full address"
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="checkInDate">Check-in Date</label>
            <input
              type="date"
              id="checkInDate"
              v-model="accommodationForm.check_in_date"
              required
            />
          </div>
          <div class="form-group">
            <label for="checkOutDate">Check-out Date</label>
            <input
              type="date"
              id="checkOutDate"
              v-model="accommodationForm.check_out_date"
              required
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="checkInTime">Check-in Time</label>
            <input
              type="time"
              id="checkInTime"
              v-model="accommodationForm.check_in_time"
              required
            />
          </div>
          <div class="form-group">
            <label for="checkOutTime">Check-out Time</label>
            <input
              type="time"
              id="checkOutTime"
              v-model="accommodationForm.check_out_time"
              required
            />
          </div>
        </div>

        <div class="form-group">
          <label for="confirmationNumber">Confirmation Number (Optional)</label>
          <input
            type="text"
            id="confirmationNumber"
            v-model="accommodationForm.confirmation_number"
            placeholder="e.g., ABC123"
          />
        </div>

        <div class="form-group">
          <label for="roomType">Room Type (Optional)</label>
          <input
            type="text"
            id="roomType"
            v-model="accommodationForm.room_type"
            placeholder="e.g., King Suite"
          />
        </div>

        <div class="form-group">
          <label for="mapLink">Map Link (Optional)</label>
          <input
            type="url"
            id="mapLink"
            v-model="accommodationForm.map_link"
            placeholder="Google Maps URL"
          />
        </div>

        <div class="form-group">
          <label for="amenities">Amenities (Optional, comma separated)</label>
          <input
            type="text"
            id="amenities"
            v-model="accommodationForm.amenities"
            placeholder="e.g., WiFi, Pool, Breakfast"
          />
        </div>

        <div class="form-group">
          <label for="accommodationNotes">Notes (Optional)</label>
          <textarea
            id="accommodationNotes"
            v-model="accommodationForm.notes"
            rows="3"
            placeholder="Any additional information"
          ></textarea>
        </div>

        <div class="form-actions">
          <button type="button" @click="closeForm" class="cancel-button">Cancel</button>
          <button type="submit" class="save-button" :disabled="isSaving">
            {{ isSaving ? 'Saving...' : (editingAccommodation ? 'Update Accommodation' : 'Add Accommodation') }}
          </button>
        </div>
      </form>
    </div>

    <div v-if="accommodations.length === 0" class="empty-state">
      <p>No accommodations added yet. Add your first accommodation to get started!</p>
    </div>

    <div v-else class="accommodations-list">
      <div
        v-for="accommodation in sortedAccommodations"
        :key="accommodation.id"
        class="accommodation-card"
      >
        <div class="accommodation-card-header">
          <h3>{{ accommodation.name }}</h3>
          <div class="accommodation-dates">
            {{ formatDateRange(accommodation.check_in_date, accommodation.check_out_date) }}
          </div>
        </div>
        <div class="accommodation-card-body">
          <div class="accommodation-address">
            <div class="address-icon">📍</div>
            <div class="address-text">{{ accommodation.address }}</div>
          </div>
          <div class="accommodation-details">
            <div class="detail-item">
              <span class="detail-label">Confirmation #:</span>
              <span class="detail-value">{{ accommodation.confirmation_number || 'N/A' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Room Type:</span>
              <span class="detail-value">{{ accommodation.room_type || 'N/A' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Check-in:</span>
              <span class="detail-value">{{ formatTime(accommodation.check_in_time) || 'N/A' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Check-out:</span>
              <span class="detail-value">{{ formatTime(accommodation.check_out_time) || 'N/A' }}</span>
            </div>
          </div>
          <div v-if="accommodation.notes" class="accommodation-notes">
            <div class="detail-label">Notes:</div>
            <p>{{ accommodation.notes }}</p>
          </div>
          <div v-if="accommodation.amenities" class="accommodation-amenities">
            <div class="detail-label">Amenities:</div>
            <div class="amenities-list">
              <span
                v-for="(amenity, index) in parseAmenities(accommodation.amenities)"
                :key="index"
                class="amenity-tag"
              >
                {{ amenity }}
              </span>
            </div>
          </div>
        </div>
        <div class="accommodation-card-footer">
          <button @click="editAccommodation(accommodation)" class="edit-button">Edit</button>
          <button @click="deleteAccommodation(accommodation.id)" class="delete-button">Delete</button>
          <button
            v-if="accommodation.map_link"
            @click="openMapLink(accommodation.map_link)"
            class="map-button"
          >
            View Map
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { supabase } from '../../supabase';
import { useToast } from 'vue-toastification';
import { format, parseISO } from 'date-fns';

// NEW: import the router & user store
import { useRouter } from 'vue-router';
import { useUserStore } from '../../stores/userStore';

export default {
name: 'Accommodations',
props: ['id', 'tripId'],
setup(props) {
  const toast = useToast();
  // We create the router instance
  const router = useRouter();
  // We also get the userStore
  const userStore = useUserStore();

  const projectId = ref(props.id || '');
  const selectedTripId = ref(props.tripId || '');
  const isLoading = ref(false);

  const trips = ref([]);
  const accommodations = ref([]);

  const showAccommodationForm = ref(false);
  const editingAccommodation = ref(null);
  const isSaving = ref(false);

  const accommodationForm = ref({
    name: '',
    type: '',
    address: '',
    check_in_date: '',
    check_out_date: '',
    check_in_time: '15:00',
    check_out_time: '12:00',
    confirmation_number: '',
    room_type: '',
    map_link: '',
    amenities: '',
    notes: ''
  });

  const sortedAccommodations = computed(() => {
    return [...accommodations.value].sort((a, b) => {
      return new Date(a.check_in_date) - new Date(b.check_in_date);
    });
  });

  const loadTrips = async () => {
    try {
      const { data, error } = await supabase
        .from('travel_trips')
        .select('*')
        .order('start_date', { ascending: true });
      if (error) throw error;
      trips.value = data || [];
    } catch (err) {
      console.error('Error loading trips:', err);
      toast.error('Failed to load trips');
    }
  };

  const loadAccommodations = async () => {
    if (!selectedTripId.value) return;
    isLoading.value = true;
    try {
      const { data, error } = await supabase
        .from('travel_accommodations')
        .select('*')
        .eq('trip_id', selectedTripId.value)
        .order('check_in_date', { ascending: true });
      if (error) throw error;
      accommodations.value = data || [];
    } catch (err) {
      console.error('Error loading accommodations:', err);
      toast.error('Failed to load accommodations');
    } finally {
      isLoading.value = false;
    }
  };

  // Fix the "Back to Dashboard" button
  const goBackToDashboard = () => {
    // For example, if your main route is 'TravelDashboard' by name:
    router.push({
      name: 'TravelDashboard',
      params: {
        id: userStore.currentProject?.id || projectId.value
      }
    });
  };

  const openAddForm = () => {
    resetAccommodationForm();
    editingAccommodation.value = null;
    showAccommodationForm.value = true;
  };

  const editAccommodation = (acc) => {
    editingAccommodation.value = acc;
    accommodationForm.value = { ...acc };
    showAccommodationForm.value = true;
  };

  const deleteAccommodation = async (accommodationId) => {
    if (!confirm('Are you sure you want to delete this accommodation?')) return;
    try {
      const { error } = await supabase
        .from('travel_accommodations')
        .delete()
        .eq('id', accommodationId)
        .select();
      if (error) {
        console.error('Error deleting accommodation:', error);
        toast.error(`Failed to delete: ${error.message ?? ''}`);
        return;
      }
      accommodations.value = accommodations.value.filter(a => a.id !== accommodationId);
      toast.success('Accommodation deleted');
    } catch (err) {
      console.error('Error deleting accommodation:', err);
      toast.error('Failed to delete accommodation');
    }
  };

  const saveAccommodation = async () => {
    if (!selectedTripId.value) {
      toast.error('No trip selected');
      return;
    }
    isSaving.value = true;
    try {
      const payload = {
        ...accommodationForm.value,
        trip_id: selectedTripId.value,
        project_id: projectId.value
      };

      if (editingAccommodation.value) {
        // update
        const { error } = await supabase
          .from('travel_accommodations')
          .update(payload)
          .eq('id', editingAccommodation.value.id)
          .select();
        if (error) {
          console.error('Error updating accommodation:', error);
          toast.error(`Failed to update: ${error.message ?? ''}`);
        } else {
          toast.success('Accommodation updated');
          await loadAccommodations();
          showAccommodationForm.value = false;
          editingAccommodation.value = null;
        }
      } else {
        // insert
        const { error } = await supabase
          .from('travel_accommodations')
          .insert(payload)
          .select();
        if (error) {
          console.error('Error inserting accommodation:', error);
          toast.error(`Failed to add: ${error.message ?? ''}`);
        } else {
          toast.success('Accommodation added');
          await loadAccommodations();
          showAccommodationForm.value = false;
          editingAccommodation.value = null;
        }
      }
    } catch (err) {
      console.error('Exception while saving accommodation:', err);
      toast.error('Unexpected error while saving accommodation');
    } finally {
      isSaving.value = false;
    }
  };

  const resetAccommodationForm = () => {
    accommodationForm.value = {
      name: '',
      type: '',
      address: '',
      check_in_date: '',
      check_out_date: '',
      check_in_time: '15:00',
      check_out_time: '12:00',
      confirmation_number: '',
      room_type: '',
      map_link: '',
      amenities: '',
      notes: ''
    };
  };

  const closeForm = () => {
    showAccommodationForm.value = false;
    resetAccommodationForm();
    editingAccommodation.value = null;
  };

  const openMapLink = (link) => {
    window.open(link, '_blank');
  };

  const formatDateRange = (start, end) => {
    if (!start || !end) return '';
    const s = parseISO(start);
    const e = parseISO(end);
    return `${format(s, 'MMM d, yyyy')} - ${format(e, 'MMM d, yyyy')}`;
  };

  const formatTime = (time) => {
    if (!time) return '';
    const [hour, minute] = time.split(':');
    if (!hour || !minute) return '';
    const date = new Date();
    date.setHours(hour, minute);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const parseAmenities = (amenities) => {
    if (!amenities) return [];
    return amenities.split(',').map(item => item.trim());
  };

  onMounted(() => {
    loadTrips();
    if (selectedTripId.value) {
      loadAccommodations();
    }
  });

  return {
    projectId,
    trips,
    accommodations,
    selectedTripId,
    isLoading,
    showAccommodationForm,
    editingAccommodation,
    isSaving,
    accommodationForm,
    sortedAccommodations,

    loadAccommodations,
    openAddForm,
    editAccommodation,
    deleteAccommodation,
    openMapLink,
    saveAccommodation,
    closeForm,

    // The fixed method
    goBackToDashboard,

    // Helpers
    formatDateRange,
    formatTime,
    parseAmenities
  };
}
};
</script>


<style scoped>
.accommodations {
  width: 100%;
  padding: 32px;
  margin: 0 auto;
  box-sizing: border-box;
  color: #222;
  line-height: 1.5;
  font-family: 'Segoe UI', Arial, sans-serif;
  background: #f8f9fa;
}
@media (min-width: 768px) {
  .accommodations {
    max-width: 900px;
    padding: 48px;
  }
}

.header-section {
  text-align: center;
  margin-bottom: 2rem;
  background: #fff;
  padding: 2rem 1rem 1.5rem 1rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  border: 1.5px solid #e5e7eb;
}
.header-section h1 {
  font-size: 2rem;
  margin: 0 0 0.5rem;
  color: #1f2937;
  font-weight: 700;
}
.header-section p {
  margin: 0;
  color: #64748b;
  font-size: 1.1rem;
}
.back-button {
  background: #f1f5f9;
  color: #2563eb;
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  padding: 0.5rem 1.2rem;
  font-size: 1rem;
  font-weight: 500;
  margin-top: 1rem;
  transition: background 0.2s, color 0.2s, border 0.2s;
  cursor: pointer;
}
.back-button:hover {
  background: #e0e7ef;
  color: #1d4ed8;
  border-color: #3b82f6;
}

.trip-selector {
  display: flex;
  flex-direction: column;
  margin-bottom: 1.5rem;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  border: 1.5px solid #e5e7eb;
  padding: 1.2rem 1rem 1rem 1rem;
}
.trip-selector label {
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: #222;
}
.trip-selector select {
  padding: 0.6rem;
  font-size: 1rem;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  max-width: 100%;
  background: #f8fafc;
  color: #222;
}
@media (min-width: 768px) {
  .trip-selector {
    flex-direction: row;
    align-items: center;
    gap: 1rem;
  }
  .trip-selector label {
    margin-bottom: 0;
  }
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 0;
}
.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3b82f6;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.section-header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
@media (min-width: 480px) {
  .section-header {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}
.section-header h2 {
  font-size: 1.4rem;
  margin: 0;
  color: #1f2937;
  font-weight: 600;
}

button {
  border: none;
  border-radius: 8px;
  padding: 10px 18px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, box-shadow 0.2s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}
button:focus {
  outline: none;
  box-shadow: 0 0 0 2px #dbeafe;
}
.add-button {
  background: #10b981;
  color: #fff;
}
.add-button:hover {
  background: #059669;
}
.edit-button {
  background: #f1f5f9;
  color: #2563eb;
  border: 1.5px solid #cbd5e1;
}
.edit-button:hover {
  background: #e0e7ef;
  color: #1d4ed8;
  border-color: #3b82f6;
}
.delete-button {
  background: #ef4444;
  color: #fff;
}
.delete-button:hover {
  background: #dc2626;
}
.map-button {
  background: #3b82f6;
  color: #fff;
}
.map-button:hover {
  background: #2563eb;
}

.accommodation-form-container {
  background-color: #fff;
  border: 1.5px solid #e5e7eb;
  padding: 1.2rem 1rem 1rem 1rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.accommodation-form-container h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #1f2937;
  font-weight: 600;
}
.form-group {
  margin-bottom: 1.25rem;
}
.form-group label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: #222;
}
.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.6rem;
  font-size: 1rem;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  box-sizing: border-box;
  background: #fff;
  color: #222;
}
.form-row {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
@media (min-width: 576px) {
  .form-row {
    flex-direction: row;
  }
}
.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: flex-end;
}
.cancel-button {
  background-color: #6c757d;
  color: #fff;
}
.cancel-button:hover {
  background-color: #5a6268;
}
.save-button {
  background-color: #10b981;
  color: #fff;
}
.save-button:hover {
  background-color: #059669;
}
.save-button:disabled {
  background-color: #a7f3d0;
  cursor: not-allowed;
}

.accommodations-list {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}
.accommodation-card {
  background-color: #fff;
  border: 1.5px solid #e5e7eb;
  padding: 1.1rem 1rem 0.8rem 1rem;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  transition: background 0.2s, box-shadow 0.2s;
}
.accommodation-card:hover {
  background: #f1f5f9;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.accommodation-card-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
@media (min-width: 480px) {
  .accommodation-card-header {
    flex-direction: row;
    justify-content: space-between;
    align-items: baseline;
  }
}
.accommodation-card-header h3 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
  color: #1f2937;
}
.accommodation-dates {
  font-size: 0.95rem;
  color: #64748b;
}
.accommodation-card-body {
  margin-top: 1rem;
}
.accommodation-address {
  display: flex;
  align-items: center;
  margin-bottom: 0.75rem;
}
.address-icon {
  font-size: 1.2rem;
  margin-right: 0.5rem;
}
.accommodation-details {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 0.5rem;
}
.detail-item {
  flex: 1 1 45%;
  font-size: 0.9rem;
  color: #555;
}
.detail-label {
  font-weight: 600;
  margin-right: 0.25rem;
}
.accommodation-notes,
.accommodation-amenities {
  margin-top: 0.75rem;
  font-size: 0.9rem;
  color: #555;
}
.amenities-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.5rem;
}
.amenity-tag {
  background-color: #e9ecef;
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
}
.accommodation-card-footer {
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.empty-state {
  text-align: center;
  padding: 1rem;
  background-color: #fefefe;
  border: 1.5px dashed #cbd5e1;
  border-radius: 10px;
  font-style: italic;
  color: #64748b;
}
@media (max-width: 700px) {
  .accommodations {
    padding: 10px;
  }
  .accommodation-form-container {
    padding: 1.2rem 0.5rem 1rem 0.5rem;
  }
}
</style>