<template>
<div class="travel-dashboard">
  <!-- Header Section -->
  <div class="header-section">
    <h1>Travel Dashboard</h1>
    <p>Manage all your travel details in one place</p>
  </div>

  <!-- Dashboard Grid -->
  <div class="dashboard-grid">
    <!-- Upcoming Trips Section -->
    <div class="dashboard-card upcoming-trips">
      <div class="card-header">
        <h2>Upcoming Trips</h2>
        <button @click="createNewTrip" class="add-button" aria-label="Create new trip">
          <span class="icon">+</span>
          <span class="button-text">New Trip</span>
        </button>
      </div>
      
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <div class="skeleton-loader">
          <div class="skeleton-item"></div>
          <div class="skeleton-item"></div>
          <div class="skeleton-item"></div>
        </div>
      </div>
      
      <!-- Empty State -->
      <div v-else-if="trips.length === 0" class="empty-state">
        <div class="empty-icon">✈️</div>
        <h3>No upcoming trips</h3>
        <p>Create your first trip to get started!</p>
        <button @click="createNewTrip" class="primary-button">Create First Trip</button>
      </div>
      
      <!-- Trip List -->
      <div v-else class="trip-list">
        <div
          v-for="trip in trips"
          :key="trip.id"
          class="trip-card"
          @click="selectTrip(trip)"
          role="button"
          tabindex="0"
          @keydown.enter="selectTrip(trip)"
          @keydown.space="selectTrip(trip)"
        >
          <div class="trip-card-header">
            <h3>{{ trip.destination }}</h3>
            <span class="trip-dates">
              {{ formatDateRange(trip.start_date, trip.end_date) }}
            </span>
          </div>
          
          <div class="trip-card-status">
            <span class="status-badge" :class="getTripStatusClass(trip)">
              {{ getTripStatus(trip) }}
            </span>
          </div>
          
          <div class="trip-card-footer">
            <div class="trip-card-actions">
              <button 
                @click.stop="openEditTripModal(trip)" 
                class="action-button edit-button"
                aria-label="Edit trip"
              >
                <span class="action-icon">✏️</span>
                <span class="action-text">Edit</span>
              </button>
              
              <button 
                @click.stop="deleteTrip(trip)" 
                class="action-button delete-button"
                aria-label="Delete trip"
              >
                <span class="action-icon">🗑️</span>
                <span class="action-text">Delete</span>
              </button>
              
              <router-link
                :to="{
                  path: `/projects/${userStore.currentProject.id}/trips/${trip.id}/detail`,
                  params: {
                    tripName: trip.name,
                    tripDates: formatDateRange(trip.start_date, trip.end_date),
                    tripDestination: trip.destination
                  }
                }"
                class="action-button view-button"
                @click.stop
                aria-label="View trip details"
              >
                <span class="action-icon">👁️</span>
                <span class="action-text">View</span>
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Weather Section -->
    <Weather :destination="selectedDestination" />
  </div>

  <!-- New Trip Modal -->
  <div v-if="showNewTripModal" class="modal" role="dialog" aria-labelledby="modal-title">
    <div class="modal-overlay" @click="showNewTripModal = false"></div>
    <div class="modal-container">
      <div class="modal-header">
        <h2 id="modal-title">Create New Trip</h2>
        <button 
          @click="showNewTripModal = false" 
          class="close-button"
          aria-label="Close modal"
        >
          ×
        </button>
      </div>
      
      <div class="modal-body">
        <form @submit.prevent="saveNewTrip">
          <div class="form-group">
            <label for="tripName">Trip Name</label>
            <input
              type="text"
              id="tripName"
              v-model="newTrip.name"
              required
              placeholder="e.g., Summer Vacation 2025"
              class="form-input"
            />
          </div>
          
          <div class="form-group">
            <label for="destination">Destination</label>
            <input
              type="text"
              id="destination"
              v-model="newTrip.destination"
              required
              placeholder="e.g., Paris, France"
              class="form-input"
            />
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label for="startDate">Start Date</label>
              <input
                type="date"
                id="startDate"
                v-model="newTrip.start_date"
                required
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="endDate">End Date</label>
              <input
                type="date"
                id="endDate"
                v-model="newTrip.end_date"
                required
                class="form-input"
              />
            </div>
          </div>
          
          <div class="form-group">
            <label for="description">Description (Optional)</label>
            <textarea
              id="description"
              v-model="newTrip.description"
              rows="3"
              placeholder="Brief description of your trip"
              class="form-textarea"
            ></textarea>
          </div>
          
          <div class="form-actions">
            <button
              type="button"
              @click="showNewTripModal = false"
              class="secondary-button"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              class="primary-button"
              :disabled="isSaving"
            >
              <span v-if="isSaving" class="loading-spinner-small"></span>
              {{ isSaving ? 'Creating...' : 'Create Trip' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- Edit Trip Modal -->
  <div v-if="showEditTripModal" class="modal" role="dialog" aria-labelledby="edit-modal-title">
    <div class="modal-overlay" @click="showEditTripModal = false"></div>
    <div class="modal-container">
      <div class="modal-header">
        <h2 id="edit-modal-title">Edit Trip</h2>
        <button 
          @click="showEditTripModal = false" 
          class="close-button"
          aria-label="Close modal"
        >
          ×
        </button>
      </div>
      
      <div class="modal-body">
        <form @submit.prevent="updateTrip">
          <div class="form-group">
            <label for="editTripName">Trip Name</label>
            <input
              type="text"
              id="editTripName"
              v-model="editTrip.name"
              required
              class="form-input"
            />
          </div>
          
          <div class="form-group">
            <label for="editDestination">Destination</label>
            <input
              type="text"
              id="editDestination"
              v-model="editTrip.destination"
              required
              class="form-input"
            />
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label for="editStartDate">Start Date</label>
              <input
                type="date"
                id="editStartDate"
                v-model="editTrip.start_date"
                required
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="editEndDate">End Date</label>
              <input
                type="date"
                id="editEndDate"
                v-model="editTrip.end_date"
                required
                class="form-input"
              />
            </div>
          </div>
          
          <div class="form-group">
            <label for="editDescription">Description (Optional)</label>
            <textarea
              id="editDescription"
              v-model="editTrip.description"
              rows="3"
              placeholder="Brief description of your trip"
              class="form-textarea"
            ></textarea>
          </div>
          
          <div class="form-actions">
            <button
              type="button"
              @click="showEditTripModal = false"
              class="secondary-button"
            >
              Cancel
            </button>
            <button type="submit" class="primary-button">
              Update Trip
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { format, parseISO, isAfter, isBefore, isToday } from 'date-fns'
import { supabase } from '../../supabase'
import { useUserStore } from '../../stores/userStore'
import Weather from './Weather.vue'

export default {
name: 'TravelDashboard',
components: { Weather },
setup() {
  const router = useRouter()
  const toast = useToast()
  const userStore = useUserStore()

  const trips = ref([])
  const isLoading = ref(true)
  const showNewTripModal = ref(false)
  const showEditTripModal = ref(false)
  const isSaving = ref(false)

  const newTrip = ref({
    name: '',
    destination: '',
    start_date: '',
    end_date: '',
    description: '',
    project_id: userStore.currentProject.id
  })

  const editTrip = ref({})

  const defaultTripId = computed(() =>
    trips.value.length ? trips.value[0].id : null
  )

  // selectedDestination drives Weather.vue
  const selectedDestination = ref('')

  async function fetchTrips() {
    isLoading.value = true
    try {
      const projectId = userStore.currentProject.id
      const { data, error } = await supabase
        .from('travel_trips')
        .select('*')
        .eq('project_id', projectId)
        .order('start_date', { ascending: true })
      if (error) throw error

      const enriched = await Promise.all(
        data.map(async trip => {
          const [
            { data: flights },
            { data: accommodations },
            { data: documents },
            { data: expenses },
            { data: parking }
          ] = await Promise.all([
            supabase.from('travel_flights').select().eq('trip_id', trip.id),
            supabase.from('travel_accommodations').select().eq('trip_id', trip.id),
            supabase.from('travel_documents').select().eq('trip_id', trip.id),
            supabase.from('travel_expenses').select().eq('trip_id', trip.id),
            supabase.from('travel_parking').select().eq('trip_id', trip.id)
          ])
          return {
            ...trip,
            flights_count: flights.length,
            accommodations_count: accommodations.length,
            documents_count: documents.length,
            expenses_count: expenses.length,
            parking_count: parking.length
          }
        })
      )
      trips.value = enriched
    } catch (err) {
      console.error(err)
      toast.error('Failed to load trips')
    } finally {
      isLoading.value = false
    }
  }

  function selectTrip(trip) {
    selectedDestination.value = trip.destination
  }

  // date/status helpers
  function formatDateRange(s, e) {
    const st = parseISO(s),
      en = parseISO(e)
    return `${format(st, 'MMM d')} - ${format(en, 'MMM d, yyyy')}`
  }
  function getTripStatus(t) {
    const now = new Date(),
      st = parseISO(t.start_date),
      en = parseISO(t.end_date)
    if (isAfter(st, now)) return 'Upcoming'
    if (isBefore(en, now)) return 'Completed'
    if (
      isToday(st) ||
      isToday(en) ||
      (isAfter(now, st) && isBefore(now, en))
    )
      return 'In Progress'
    return 'Unknown'
  }
  function getTripStatusClass(t) {
    return {
      Upcoming: 'status-upcoming',
      'In Progress': 'status-in-progress',
      Completed: 'status-completed'
    }[getTripStatus(t)]
  }

  // CRUD
  function createNewTrip() {
    newTrip.value = {
      name: '',
      destination: '',
      start_date: '',
      end_date: '',
      description: '',
      project_id: userStore.currentProject.id
    }
    showNewTripModal.value = true
  }
  async function saveNewTrip() {
    const sd = new Date(newTrip.value.start_date),
      ed = new Date(newTrip.value.end_date)
    if (ed < sd) {
      toast.error('End date cannot be before start date')
      return
    }
    isSaving.value = true
    try {
      await supabase.from('travel_trips').insert([newTrip.value])
      toast.success('Trip created successfully')
      showNewTripModal.value = false
      await fetchTrips()
    } catch {
      toast.error('Failed to create trip')
    } finally {
      isSaving.value = false
    }
  }
  function openEditTripModal(trip) {
    editTrip.value = { ...trip }
    showEditTripModal.value = true
  }
  async function updateTrip() {
    const sd = new Date(editTrip.value.start_date),
      ed = new Date(editTrip.value.end_date)
    if (ed < sd) {
      toast.error('End date cannot be before start date')
      return
    }
    try {
      await supabase
        .from('travel_trips')
        .update(editTrip.value)
        .eq('id', editTrip.value.id)
      toast.success('Trip updated successfully')
      showEditTripModal.value = false
      await fetchTrips()
    } catch {
      toast.error('Failed to update trip')
    }
  }
  async function deleteTrip(t) {
    if (!confirm('Are you sure you want to delete this trip?')) return
    try {
      await supabase.from('travel_trips').delete().eq('id', t.id)
      toast.success('Trip deleted successfully')
      await fetchTrips()
    } catch {
      toast.error('Failed to delete trip')
    }
  }

  // Navigation
  function viewAccommodations(t) {
    router.push({ name: 'Accommodations', params: { id: userStore.currentProject.id, tripId: t.id } })
  }
  function viewFlightDetails(t) {
    router.push({ name: 'FlightDetails', params: { id: userStore.currentProject.id, tripId: t.id } })
  }
  function viewDocuments(t) {
    router.push({ name: 'Documents', params: { id: userStore.currentProject.id, tripId: t.id } })
  }
  function viewExpenses(t) {
    router.push({ name: 'Expenses', params: { id: userStore.currentProject.id, tripId: t.id } })
  }
  function viewParking(t) {
    router.push({
      name: 'FlightDetails',
      params: { id: userStore.currentProject.id, tripId: t.id, activeTab: 'parking' }
    })
  }

  onMounted(async () => {
    await fetchTrips()
    // auto‐select first future or first
    if (trips.value.length) {
      const next = trips.value.find(t => ['Upcoming','In Progress'].includes(getTripStatus(t))) || trips.value[0]
      selectedDestination.value = next.destination
    }
  })

  return {
    userStore,
    trips,
    isLoading,
    showNewTripModal,
    showEditTripModal,
    isSaving,
    newTrip,
    editTrip,
    defaultTripId,
    selectedDestination,
    createNewTrip,
    saveNewTrip,
    openEditTripModal,
    updateTrip,
    deleteTrip,
    viewAccommodations,
    viewFlightDetails,
    viewDocuments,
    viewExpenses,
    viewParking,
    formatDateRange,
    getTripStatus,
    getTripStatusClass,
    selectTrip
  }
}
}
</script>

<style scoped>
/* Mobile-first base styles */
.travel-dashboard {
  width: 100%;
  padding: 16px;
  margin: 0 auto;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #1f2937;
  line-height: 1.5;
  background: #f8fafc;
  min-height: 100vh;
}

/* Safe area margins for mobile devices */
@supports (padding: max(0px)) {
  .travel-dashboard {
    padding-left: max(16px, env(safe-area-inset-left));
    padding-right: max(16px, env(safe-area-inset-right));
    padding-top: max(16px, env(safe-area-inset-top));
    padding-bottom: max(16px, env(safe-area-inset-bottom));
  }
}

/* Header Section */
.header-section {
  text-align: center;
  margin-bottom: 24px;
  background: #ffffff;
  padding: 24px 16px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
}

.header-section h1 {
  font-size: 24px;
  margin: 0 0 8px 0;
  color: #111827;
  font-weight: 700;
  line-height: 1.4;
}

.header-section p {
  margin: 0;
  color: #6b7280;
  font-size: 16px;
  line-height: 1.5;
}

/* Dashboard Grid */
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

/* Dashboard Cards */
.dashboard-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 20px 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
  transition: all 0.2s ease;
}

.dashboard-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.card-header h2 {
  font-size: 20px;
  margin: 0;
  color: #111827;
  font-weight: 600;
  line-height: 1.4;
}

/* Buttons */
.add-button {
  background: #3b82f6;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 12px 16px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  min-width: 44px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.add-button:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.add-button:active {
  transform: translateY(0);
}

.add-button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
}

.icon {
  font-size: 18px;
  font-weight: bold;
}

.button-text {
  display: none;
}

/* Loading State */
.loading-state {
  padding: 24px 0;
}

.skeleton-loader {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-item {
  height: 80px;
  background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 8px;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 32px 16px;
  color: #6b7280;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 20px;
  margin: 0 0 8px 0;
  color: #374151;
  font-weight: 600;
}

.empty-state p {
  margin: 0 0 20px 0;
  font-size: 16px;
  line-height: 1.5;
}

.primary-button {
  background: #10b981;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.2s ease;
  min-height: 44px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.primary-button:hover {
  background: #059669;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.primary-button:active {
  transform: translateY(0);
}

.primary-button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.3);
}

.primary-button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* Trip List */
.trip-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.trip-card {
  background: #f9fafb;
  border-radius: 12px;
  padding: 20px 16px;
  border: 1px solid #e5e7eb;
  position: relative;
  transition: all 0.2s ease;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.trip-card:hover {
  background: #f3f4f6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.trip-card:active {
  transform: translateY(0);
}

.trip-card:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
}

.trip-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}

.trip-card-header h3 {
  margin: 0;
  font-size: 18px;
  color: #111827;
  font-weight: 600;
  line-height: 1.4;
}

.trip-dates {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.4;
}

.trip-card-status {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.status-badge {
  font-weight: 500;
  font-size: 14px;
  padding: 6px 12px;
  border-radius: 6px;
  background: #dbeafe;
  color: #1d4ed8;
  line-height: 1.4;
}

.status-badge.status-upcoming {
  background: #dbeafe;
  color: #1d4ed8;
}

.status-badge.status-in-progress {
  background: #fef3c7;
  color: #d97706;
}

.status-badge.status-completed {
  background: #d1fae5;
  color: #059669;
}

.trip-card-footer {
  border-top: 1px solid #e5e7eb;
  padding-top: 16px;
}

.trip-card-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s ease;
  border: 1px solid #e5e7eb;
  color: #374151;
  background: #f9fafb;
  min-height: 44px;
  min-width: 44px;
  flex: 1;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.action-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.action-button:active {
  transform: translateY(0);
}

.action-button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
}

.action-button.edit-button {
  background: #f0f9ff;
  color: #1d4ed8;
  border-color: #bae6fd;
}

.action-button.edit-button:hover {
  background: #e0f2fe;
  border-color: #7dd3fc;
}

.action-button.delete-button {
  background: #fef2f2;
  color: #dc2626;
  border-color: #fecaca;
}

.action-button.delete-button:hover {
  background: #fee2e2;
  border-color: #fca5a5;
}

.action-button.view-button {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #bfdbfe;
}

.action-button.view-button:hover {
  background: #dbeafe;
  border-color: #93c5fd;
}

.action-icon {
  font-size: 16px;
}

.action-text {
  display: none;
}

/* Modal Styles */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
  box-sizing: border-box;
}

.modal-overlay {
  position: absolute;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal-container {
  position: relative;
  background: #ffffff;
  border-radius: 16px;
  padding: 24px 20px;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  z-index: 1001;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.modal-header h2 {
  margin: 0;
  font-size: 22px;
  color: #111827;
  font-weight: 600;
  line-height: 1.4;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6b7280;
  border-radius: 8px;
  transition: all 0.2s ease;
  padding: 8px;
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  background: #f3f4f6;
  color: #374151;
}

.close-button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
}

.modal-body {
  max-height: calc(90vh - 120px);
  overflow-y: auto;
}

/* Form Styles */
.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #374151;
  font-size: 16px;
  line-height: 1.4;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 16px;
  line-height: 1.5;
  box-sizing: border-box;
  background: #ffffff;
  color: #111827;
  transition: all 0.2s ease;
  min-height: 48px;
}

.form-textarea {
  min-height: 80px;
  resize: vertical;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  flex-wrap: wrap;
}

.secondary-button {
  background: #6b7280;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.2s ease;
  min-height: 44px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.secondary-button:hover {
  background: #4b5563;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.secondary-button:active {
  transform: translateY(0);
}

.secondary-button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(107, 114, 128, 0.3);
}

.loading-spinner-small {
  border: 2px solid #f3f4f6;
  border-top: 2px solid #10b981;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  animation: spin 0.8s linear infinite;
  margin-right: 8px;
  display: inline-block;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Tablet Breakpoint (601px - 1024px) */
@media (min-width: 601px) {
  .travel-dashboard {
    padding: 24px;
  }
  
  .header-section {
    padding: 32px 24px;
    margin-bottom: 32px;
  }
  
  .header-section h1 {
    font-size: 28px;
  }
  
  .dashboard-grid {
    gap: 24px;
  }
  
  .dashboard-card {
    padding: 24px 20px;
  }
  
  .trip-card {
    padding: 24px 20px;
  }
  
  .action-text {
    display: inline;
  }
  
  .button-text {
    display: inline;
  }
  
  .form-row {
    flex-direction: row;
  }
  
  .form-row .form-group {
    flex: 1;
  }
}

/* Desktop Breakpoint (1025px+) */
@media (min-width: 1025px) {
  .travel-dashboard {
    max-width: 1200px;
    padding: 32px;
  }
  
  .dashboard-grid {
    grid-template-columns: 2fr 1fr;
    gap: 32px;
  }
  
  .header-section {
    padding: 40px 32px;
    margin-bottom: 40px;
  }
  
  .header-section h1 {
    font-size: 32px;
  }
  
  .dashboard-card {
    padding: 32px 28px;
  }
  
  .trip-card {
    padding: 28px 24px;
  }
  
  .modal-container {
    padding: 32px 28px;
    max-width: 560px;
  }
}

/* Mobile-specific adjustments */
@media (max-width: 600px) {
  .travel-dashboard {
    padding: 12px;
  }
  
  .header-section {
    padding: 20px 16px;
    margin-bottom: 20px;
  }
  
  .header-section h1 {
    font-size: 22px;
  }
  
  .dashboard-card {
    padding: 16px 12px;
  }
  
  .trip-card {
    padding: 16px 12px;
  }
  
  .card-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .add-button {
    width: 100%;
    justify-content: center;
  }
  
  .trip-card-actions {
    flex-direction: column;
  }
  
  .action-button {
    width: 100%;
  }
  
  .modal-container {
    padding: 20px 16px;
    margin: 16px;
    max-height: calc(100vh - 32px);
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .form-actions button {
    width: 100%;
  }
}
</style>