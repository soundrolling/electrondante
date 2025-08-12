<template>
<div class="travel-dashboard">
  <div class="header-section">
    <h1>Travel Dashboard</h1>
    <p>Manage all your travel details in one place</p>
  </div>

  <div class="dashboard-grid">
    <!-- Upcoming Trips Section -->
    <div class="dashboard-card upcoming-trips">
      <div class="card-header">
        <h2>Upcoming Trips</h2>
        <button @click="createNewTrip" class="add-button">
          <span class="icon">+</span> New Trip
        </button>
      </div>
      <div v-if="isLoading" class="loading-spinner">
        <div class="spinner"></div>
        <p>Loading trips...</p>
      </div>
      <div v-else-if="trips.length === 0" class="empty-state">
        <p>No upcoming trips. Create your first trip to get started!</p>
      </div>
      <div v-else class="trip-list">
        <div
          v-for="trip in trips"
          :key="trip.id"
          class="trip-card"
          @click="selectTrip(trip)"
        >
          <div class="trip-card-header">
            <h3>{{ trip.destination }}</h3>
            <span class="trip-dates">
              {{ formatDateRange(trip.start_date, trip.end_date) }}
            </span>
          </div>
          <div class="trip-card-status-row">
            <span class="trip-status" :class="getTripStatusClass(trip)">
              Status: {{ getTripStatus(trip) }}
            </span>
          </div>
          <div class="trip-card-footer">
            <div class="trip-card-actions">
              <button @click.stop="openEditTripModal(trip)" class="edit-button">Edit</button>
              <button @click.stop="deleteTrip(trip)" class="delete-button">Delete</button>
              <router-link
                :to="{
                  path: `/projects/${userStore.currentProject.id}/trips/${trip.id}/detail`,
                  params: {
                    tripName: trip.name,
                    tripDates: formatDateRange(trip.start_date, trip.end_date),
                    tripDestination: trip.destination
                  }
                }"
                class="view-trip-btn"
                @click.stop
              >
                View
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
  <div v-if="showNewTripModal" class="modal">
    <div class="modal-overlay" @click="showNewTripModal = false"></div>
    <div class="modal-container">
      <div class="modal-header">
        <h2>Create New Trip</h2>
        <button @click="showNewTripModal = false" class="close-button">×</button>
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
              />
            </div>
            <div class="form-group">
              <label for="endDate">End Date</label>
              <input
                type="date"
                id="endDate"
                v-model="newTrip.end_date"
                required
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
            ></textarea>
          </div>
          <div class="form-actions">
            <button
              type="button"
              @click="showNewTripModal = false"
              class="cancel-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="save-button"
              :disabled="isSaving"
            >
              {{ isSaving ? 'Saving...' : 'Create Trip' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- Edit Trip Modal -->
  <div v-if="showEditTripModal" class="modal">
    <div class="modal-overlay" @click="showEditTripModal = false"></div>
    <div class="modal-container">
      <div class="modal-header">
        <h2>Edit Trip</h2>
        <button @click="showEditTripModal = false" class="close-button">×</button>
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
              placeholder="e.g., Summer Vacation 2025"
            />
          </div>
          <div class="form-group">
            <label for="editDestination">Destination</label>
            <input
              type="text"
              id="editDestination"
              v-model="editTrip.destination"
              required
              placeholder="e.g., Paris, France"
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
              />
            </div>
            <div class="form-group">
              <label for="editEndDate">End Date</label>
              <input
                type="date"
                id="editEndDate"
                v-model="editTrip.end_date"
                required
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
            ></textarea>
          </div>
          <div class="form-actions">
            <button
              type="button"
              @click="showEditTripModal = false"
              class="cancel-button"
            >
              Cancel
            </button>
            <button type="submit" class="save-button">
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
.travel-dashboard {
  width: 100%;
  padding: 32px;
  margin: 0 auto;
  box-sizing: border-box;
  font-family: 'Segoe UI', Arial, sans-serif;
  color: #222;
  line-height: 1.5;
  background: #f8f9fa;
}
@media (min-width: 1024px) {
  .travel-dashboard {
    max-width: 1200px;
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

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}
@media (min-width: 768px) {
  .dashboard-grid {
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  }
}

.dashboard-card {
  background: #fff;
  border-radius: 12px;
  padding: 1.5rem 1.2rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  border: 1.5px solid #e5e7eb;
  transition: box-shadow 0.2s, transform 0.2s;
}
.dashboard-card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.10);
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.2rem;
}
.card-header h2 {
  font-size: 1.3rem;
  margin: 0;
  color: #1f2937;
  font-weight: 600;
}

button {
  border: none;
  border-radius: 8px;
  padding: 10px 18px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: background 0.2s, color 0.2s, box-shadow 0.2s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}
button:focus {
  outline: none;
  box-shadow: 0 0 0 2px #dbeafe;
}
.add-button {
  background: #3b82f6;
  color: #fff;
}
.add-button:hover {
  background: #2563eb;
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

.loading-spinner {
  text-align: center;
  padding: 1.5rem 0;
}
.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3b82f6;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  animation: spin 1s linear infinite;
  margin: 0 auto 0.75rem;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 1.2rem;
  color: #64748b;
  background-color: #fefefe;
  border: 1.5px dashed #cbd5e1;
  border-radius: 10px;
  font-style: italic;
}

.trip-list {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}
.trip-card {
  background: #f8fafc;
  border-radius: 10px;
  padding: 1.1rem 1rem 0.8rem 1rem;
  border: 1.5px solid #e5e7eb;
  position: relative;
  transition: background 0.2s, box-shadow 0.2s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.trip-card:hover {
  background: #f1f5f9;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.trip-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.trip-card-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #1f2937;
  font-weight: 600;
}
.trip-dates {
  font-size: 0.95rem;
  color: #64748b;
}
.trip-card-status-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin: 0.5em 0 0.5em 0;
  min-height: 1.5em;
}
.trip-status {
  font-weight: 500;
  font-size: 0.97rem;
  display: inline-block;
  margin-right: 0;
}
.trip-card-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  border-top: 1px solid #e5e7eb;
  padding-top: 0.7em;
  margin-top: 0.7em;
}
.trip-card-actions {
  display: flex;
  flex-direction: row;
  gap: 0.5em;
  width: 100%;
}
.edit-button,
.delete-button,
.view-trip-btn {
  margin: 0;
  flex: 1 1 0;
  min-width: 0;
}
.delete-button {
  order: 0;
}
.edit-button {
  order: 1;
}
.view-trip-btn {
  order: 2;
}
.view-trip-btn {
  background: #2563eb;
  color: #fff;
  border-radius: 8px;
  padding: 0.5rem 1.2rem;
  font-size: 1rem;
  font-weight: 500;
  text-decoration: none;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 56px;
}
.view-trip-btn:hover {
  background: #1d4ed8;
}

.quick-access h2 {
  margin-bottom: 1rem;
  font-size: 1.2rem;
  color: #1f2937;
  font-weight: 600;
}
.quick-access-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}
.quick-access-item {
  background: #f1f5f9;
  border-radius: 8px;
  padding: 0.9rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  color: #222;
  transition: background 0.2s, box-shadow 0.2s;
  border: 1.5px solid #e5e7eb;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.quick-access-item:hover {
  background: #e0e7ef;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.icon-container {
  font-size: 2rem;
  margin-bottom: 0.25rem;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}
.modal-overlay {
  position: absolute;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
}
.modal-container {
  position: relative;
  background: #fff;
  border-radius: 12px;
  padding: 2rem 1.5rem 1.5rem 1.5rem;
  width: 90%;
  max-width: 500px;
  z-index: 1000;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.18);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.modal-header h2 {
  margin: 0;
  font-size: 1.3rem;
  color: #1f2937;
  font-weight: 600;
}
.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #64748b;
  border-radius: 6px;
  transition: background 0.2s;
  padding: 2px 8px;
}
.close-button:hover {
  background: #f1f5f9;
  color: #1d4ed8;
}
.modal-body {
  max-height: 70vh;
  overflow-y: auto;
}
.form-group {
  margin-bottom: 1.25rem;
}
.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #222;
  font-size: 0.97rem;
}
.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.6rem;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  box-sizing: border-box;
  background: #fff;
  color: #222;
}
.form-row {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
@media (min-width: 480px) {
  .form-row {
    flex-direction: row;
  }
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1rem;
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

@media (max-width: 700px) {
  .travel-dashboard {
    padding: 10px;
  }
  .dashboard-card {
    padding: 10px 4px;
  }
  .modal-container {
    padding: 1.2rem 0.5rem 1rem 0.5rem;
  }
  .trip-card-footer {
    flex-direction: row;
    align-items: center;
    gap: 0;
    padding-top: 0.5em;
  }
  .trip-card-actions {
    flex-direction: row;
    gap: 0.5em;
    width: 100%;
  }
}
</style>