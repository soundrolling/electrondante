<template>
<div class="travel-dashboard">
  <!-- Global header is provided by App.vue; local header removed to avoid duplication -->

  <!-- Dashboard Grid -->
  <div class="dashboard-grid">
    <!-- Upcoming Trips Section -->
    <div class="dashboard-card upcoming-trips">
      <div class="card-header">
        <h2>Upcoming Trips</h2>
        <button @click="createNewTrip" class="btn btn-positive add-button" aria-label="Create new trip">
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
        <button @click="createNewTrip" class="btn btn-positive primary-button">Create First Trip</button>
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
            <button type="submit" class="btn btn-positive primary-button">
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
    project_id: userStore.currentProject?.id || null
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
      const projectId = userStore.currentProject?.id
      if (!projectId) {
        console.error('No current project found')
        toast.error('No project selected')
        return
      }
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
    if (!userStore.currentProject?.id) {
      toast.error('No project selected')
      return
    }
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
    // Wait for userStore to be initialized
    if (!userStore.isInitialized) {
      // Wait a bit for initialization
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    if (userStore.currentProject?.id) {
      await fetchTrips()
      // auto‐select first future or first
      if (trips.value.length) {
        const next = trips.value.find(t => ['Upcoming','In Progress'].includes(getTripStatus(t))) || trips.value[0]
        selectedDestination.value = next.destination
      }
    } else {
      console.warn('No current project available for travel dashboard')
      isLoading.value = false
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
  padding: var(--space-5);
  margin: 0 auto;
  box-sizing: border-box;
  font-family: var(--font-family-sans);
  color: var(--text-primary);
  line-height: var(--leading-normal);
  background: var(--bg-secondary);
  min-height: 100vh;
}

/* Safe area margins for mobile devices */
@supports (padding: max(0px)) {
  .travel-dashboard {
    padding-left: max(var(--space-5), env(safe-area-inset-left));
    padding-right: max(var(--space-5), env(safe-area-inset-right));
    padding-top: max(var(--space-5), env(safe-area-inset-top));
    padding-bottom: max(var(--space-5), env(safe-area-inset-bottom));
  }
}

/* Header Section */
.header-section {
  text-align: center;
  margin-bottom: var(--space-6);
  background: var(--bg-primary);
  padding: var(--space-6) var(--space-4);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
}

.header-section h1 {
  font-size: var(--text-2xl);
  margin: 0 0 var(--space-2) 0;
  color: var(--text-primary);
  font-weight: var(--font-bold);
  line-height: var(--leading-snug);
}

.header-section p {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
}

/* Dashboard Grid */
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-5);
}

/* Dashboard Cards */
.dashboard-card {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-6) var(--space-5);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
  transition: all var(--transition-normal);
}

.dashboard-card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-1px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-5);
  flex-wrap: wrap;
  gap: var(--space-3);
}

.card-header h2 {
  font-size: var(--text-xl);
  margin: 0;
  color: var(--text-primary);
  font-weight: var(--font-semibold);
  line-height: var(--leading-snug);
}

/* Buttons */
.add-button {
  background: var(--color-primary-500);
  color: var(--text-inverse);
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  transition: all var(--transition-normal);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 44px;
  min-width: 44px;
  box-shadow: var(--shadow-sm);
}

.add-button:hover {
  background: var(--color-primary-600);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.add-button:active {
  transform: translateY(0);
}

.add-button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.3);
}

.icon {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
}

.button-text {
  display: none;
}

/* Loading State */
.loading-state {
  padding: var(--space-6) 0;
}

.skeleton-loader {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.skeleton-item {
  height: 80px;
  background: linear-gradient(90deg, var(--color-secondary-100) 25%, var(--color-secondary-200) 50%, var(--color-secondary-100) 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: var(--radius-md);
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: var(--space-9) var(--space-5);
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: var(--space-4);
}

.empty-state h3 {
  font-size: var(--text-xl);
  margin: 0 0 var(--space-2) 0;
  color: var(--text-primary);
  font-weight: var(--font-semibold);
}

.empty-state p {
  margin: 0 0 var(--space-5) 0;
  font-size: var(--text-base);
  line-height: var(--leading-normal);
}

.primary-button {
  background: var(--color-success-500);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-6);
  cursor: pointer;
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  transition: all var(--transition-normal);
  min-height: 44px;
  box-shadow: var(--shadow-sm);
  box-sizing: border-box;
}

.primary-button:hover {
  background: var(--color-success-600);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.primary-button:active {
  transform: translateY(0);
}

.primary-button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.3);
}

.primary-button:disabled {
  background: var(--color-secondary-400);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* Trip List */
.trip-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.trip-card {
  background: var(--bg-tertiary);
  border-radius: var(--radius-lg);
  padding: var(--space-6) var(--space-5);
  border: 1px solid var(--border-light);
  position: relative;
  transition: all var(--transition-normal);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
}

.trip-card:hover {
  background: var(--color-secondary-100);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.trip-card:active {
  transform: translateY(0);
}

.trip-card:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.3);
}

.trip-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-3);
  flex-wrap: wrap;
  gap: var(--space-2);
}

.trip-card-header h3 {
  margin: 0;
  font-size: var(--text-lg);
  color: var(--text-primary);
  font-weight: var(--font-semibold);
  line-height: var(--leading-snug);
}

.trip-dates {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: var(--leading-snug);
}

.trip-card-status {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-4);
}

.status-badge {
  font-weight: var(--font-medium);
  font-size: var(--text-sm);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-primary-100);
  color: var(--color-primary-700);
  line-height: var(--leading-snug);
}

.status-badge.status-upcoming {
  background: var(--color-primary-100);
  color: var(--color-primary-700);
}

.status-badge.status-in-progress {
  background: var(--color-warning-100);
  color: var(--color-warning-700);
}

.status-badge.status-completed {
  background: var(--color-success-100);
  color: var(--color-success-700);
}

.trip-card-footer {
  border-top: 1px solid var(--border-light);
  padding-top: var(--space-4);
}

.trip-card-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  text-decoration: none;
  transition: all var(--transition-normal);
  border: 1px solid var(--border-light);
  color: var(--text-primary);
  background: var(--bg-tertiary);
  min-height: 44px;
  min-width: 44px;
  flex: 1;
  box-shadow: var(--shadow-sm);
}

.action-button:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.action-button:active {
  transform: translateY(0);
}

.action-button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.3);
}

.action-button.edit-button {
  background: var(--color-primary-500);
  color: var(--text-inverse);
  border-color: var(--color-primary-600);
}

.action-button.edit-button:hover {
  background: var(--color-primary-600);
  border-color: var(--color-primary-700);
}

.action-button.delete-button {
  background: var(--color-error-500);
  color: var(--text-inverse);
  border-color: var(--color-error-600);
}

.action-button.delete-button:hover {
  background: var(--color-error-600);
  border-color: var(--color-error-700);
}

.action-button.view-button {
  background: var(--color-success-500);
  color: var(--text-inverse);
  border-color: var(--color-success-600);
}

.action-button.view-button:hover {
  background: var(--color-success-600);
  border-color: var(--color-success-700);
}

.action-icon {
  font-size: var(--text-base);
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
  z-index: var(--z-modal);
  padding: var(--space-4);
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
  background: var(--bg-primary);
  border-radius: var(--radius-2xl);
  padding: var(--space-7) var(--space-6);
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  z-index: var(--z-modal);
  box-shadow: var(--shadow-xl);
  box-sizing: border-box;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-6);
}

.modal-header h2 {
  margin: 0;
  font-size: var(--text-xl);
  color: var(--text-primary);
  font-weight: var(--font-semibold);
  line-height: var(--leading-snug);
}

.close-button {
  background: none;
  border: none;
  font-size: var(--text-2xl);
  cursor: pointer;
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  transition: all var(--transition-normal);
  padding: var(--space-2);
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.close-button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.3);
}

.modal-body {
  max-height: calc(90vh - 120px);
  overflow-y: auto;
  padding: 0;
  box-sizing: border-box;
}

/* Form Styles */
.form-group {
  margin-bottom: var(--space-6);
  width: 100%;
  box-sizing: border-box;
}

.form-group label {
  display: block;
  margin-bottom: var(--space-2);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  font-size: var(--text-base);
  line-height: var(--leading-snug);
}

.form-input,
.form-textarea {
  width: 100%;
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  box-sizing: border-box;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: all var(--transition-normal);
  min-height: 48px;
  max-width: 100%;
}

.form-textarea {
  min-height: 80px;
  resize: vertical;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  box-sizing: border-box;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-6);
  flex-wrap: wrap;
  padding: 0;
  box-sizing: border-box;
}

.secondary-button {
  background: var(--color-secondary-500);
  color: var(--text-inverse);
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-6);
  cursor: pointer;
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  transition: all var(--transition-normal);
  min-height: 44px;
  box-shadow: var(--shadow-sm);
  box-sizing: border-box;
}

.secondary-button:hover {
  background: var(--color-secondary-600);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.secondary-button:active {
  transform: translateY(0);
}

.secondary-button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(100, 116, 139, 0.3);
}

.loading-spinner-small {
  border: 2px solid var(--color-secondary-200);
  border-top: 2px solid var(--color-success-500);
  border-radius: 50%;
  width: 16px;
  height: 16px;
  animation: spin 0.8s linear infinite;
  margin-right: var(--space-2);
  display: inline-block;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Tablet Breakpoint (601px - 1024px) */
@media (min-width: 601px) {
  .travel-dashboard {
    padding: var(--space-7);
  }
  
  .header-section {
    padding: var(--space-9) var(--space-7);
    margin-bottom: var(--space-9);
  }
  
  .header-section h1 {
    font-size: var(--text-3xl);
  }
  
  .dashboard-grid {
    gap: var(--space-7);
  }
  
  .dashboard-card {
    padding: var(--space-7) var(--space-6);
  }
  
  .trip-card {
    padding: var(--space-6) var(--space-5);
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
    padding: var(--space-9);
  }
  
  .dashboard-grid {
    grid-template-columns: 2fr 1fr;
    gap: var(--space-9);
  }
  
  .header-section {
    padding: var(--space-12) var(--space-9);
    margin-bottom: var(--space-12);
  }
  
  .header-section h1 {
    font-size: var(--text-4xl);
  }
  
  .dashboard-card {
    padding: var(--space-9) var(--space-8);
  }
  
  .trip-card {
    padding: var(--space-7) var(--space-6);
  }
  
  .modal-container {
    padding: var(--space-8) var(--space-7);
    max-width: 560px;
  }
}

/* Mobile-specific adjustments */
@media (max-width: 600px) {
  .travel-dashboard {
    padding: var(--space-3);
  }
  
  .header-section {
    padding: var(--space-5) var(--space-4);
    margin-bottom: var(--space-5);
  }
  
  .header-section h1 {
    font-size: var(--text-xl);
  }
  
  .dashboard-card {
    padding: var(--space-5) var(--space-4);
  }
  
  .trip-card {
    padding: var(--space-5) var(--space-4);
  }
  
  .card-header {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-3);
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
    padding: var(--space-6) var(--space-5);
    margin: var(--space-4);
    max-height: calc(100vh - 32px);
    box-sizing: border-box;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .form-actions button {
    width: 100%;
  }
}
</style>