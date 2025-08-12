<template>
<div class="project-gear modern-bg">
  <div class="gear-card">
    <!-- TOP BAR -->
    <header class="gear-topbar">
      <button class="back-button" @click="goBack">← Back</button>
    </header>

    <!-- HEADER -->
    <section class="header-section">
      <h1>Project Gear</h1>
      <p>Manage and organize your project's gear efficiently.</p>
      <div class="section-divider"></div>
    </section>

    <!-- FILTER -->
    <div class="filter-container">
      <label for="filterAssignment" class="filter-label">Filter:</label>
      <select id="filterAssignment" v-model="filterLocationId" class="filter-select">
        <option value="all">All</option>
        <option value="unassigned">Unassigned</option>
        <option value="assigned">Assigned</option>
        <option
          v-for="loc in locationsList"
          :key="loc.id"
          :value="String(loc.id)"
        >
          {{ loc.stage_name }} ({{ loc.venue_name }})
        </option>
      </select>
    </div>

    <!-- LOADING -->
    <div v-if="loading" class="loading-indicator">
      <svg class="spinner" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="spinner-track"/>
        <path d="M4 12a8 8 0 018-8v8H4z" fill="currentColor" class="spinner-head"/>
      </svg>
      <p class="loading-text">Loading gear...</p>
    </div>

    <!-- ERROR -->
    <div v-if="error" class="error-message" role="alert">
      <strong>Error:</strong> {{ error }}
    </div>

    <!-- GEAR MANAGEMENT -->
    <section v-else class="gear-management">
      <div class="actions-header">
        <h2>Gear List</h2>
        <div class="actions-group">
          <button class="btn btn-accent" @click="toggleAddGear">
            <span class="btn-icon">➕</span> {{ showAddGearForm ? 'Hide Add Gear' : 'Add New Gear' }}
          </button>
          <button class="btn btn-primary" @click="openUserGearSelector">
            <span class="btn-icon">👤</span> Add User Gear
          </button>
          <button class="btn btn-warning" @click="openReorderModal">
            <span class="btn-icon">↕️</span> Reorder Gear
          </button>
        </div>
      </div>

      <p class="tip-text">
        Filter your gear by "All," "Unassigned," "Assigned," or a specific stage.
      </p>

      <!-- Desktop Table View -->
      <div class="table-wrapper desktop-only">
        <table class="table modern-table">
          <thead>
            <tr>
              <th>Gear Name</th>
              <th>Type</th>
              <th>Info</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(gear, idx) in filteredGearList"
              :key="gear.id"
              :class="{ stripe: idx % 2 === 1 }"
            >
              <td class="gear-name-cell">
                <div class="gear-name">{{ gear.gear_name }}</div>
                <div v-if="gear.is_user_gear" class="user-gear-indicator">
                  <span class="user-gear-badge">Personal</span>
                  <span class="owner-name">{{ gear.owner_name || 'Unknown' }}</span>
                </div>
              </td>
              <td>{{ gear.gear_type || 'No type' }}</td>
              <td>
                <button class="btn btn-info btn-sm" @click="openGearInfoModal(gear)">
                  <span class="info-icon">ℹ️</span>
                  <span class="info-text">{{ gear.total_assigned }}/{{ gear.gear_amount }}</span>
                </button>
              </td>
                          <td class="action-buttons">
              <button class="btn btn-primary btn-sm" @click="openAssignmentModal(gear)" title="Assign/Edit">
                <span class="btn-icon">📋</span>
                <span class="btn-text desktop-only">Assign</span>
              </button>
              <button class="btn btn-secondary btn-sm" @click="openEditModal(gear)" title="Edit">
                <span class="btn-icon">✏️</span>
                <span class="btn-text desktop-only">Edit</span>
              </button>
              <button class="btn btn-danger btn-sm" @click="confirmDelete(gear.id)" title="Delete">
                <span class="btn-icon">🗑️</span>
                <span class="btn-text desktop-only">Delete</span>
              </button>
            </td>
            </tr>
            <tr v-if="!filteredGearList.length">
              <td colspan="4" class="no-data">No gear found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile Card View -->
      <div class="mobile-gear-cards mobile-only">
        <div v-if="!filteredGearList.length" class="no-data-card">
          <p>No gear found.</p>
        </div>
        <div 
          v-for="(gear, idx) in filteredGearList" 
          :key="gear.id"
          class="gear-card-item"
          :class="{ 'user-gear': gear.is_user_gear }"
        >
          <div class="gear-card-header">
            <div class="gear-name-section">
              <h3 class="gear-name">{{ gear.gear_name }}</h3>
              <div v-if="gear.is_user_gear" class="user-gear-indicator">
                <span class="user-gear-badge">Personal</span>
                <span class="owner-name">{{ gear.owner_name || 'Unknown' }}</span>
              </div>
            </div>
            <div class="gear-type-badge">
              {{ gear.gear_type || 'No type' }}
            </div>
          </div>
          
          <div class="gear-card-details">
            <div class="detail-row">
              <span class="detail-label">Available:</span>
              <span class="detail-value">{{ gear.unassigned_amount }}/{{ gear.gear_amount }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Assigned:</span>
              <span class="detail-value">{{ gear.total_assigned }}</span>
            </div>
            <div v-if="gear.vendor" class="detail-row">
              <span class="detail-label">Vendor:</span>
              <span class="detail-value">{{ gear.vendor }}</span>
            </div>
          </div>

          <div class="gear-card-actions">
            <button class="btn btn-info btn-sm" @click="openGearInfoModal(gear)" title="Info">
              <span class="btn-icon">ℹ️</span>
              <span class="btn-text">Info</span>
            </button>
            <button class="btn btn-primary btn-sm" @click="openAssignmentModal(gear)" title="Assign">
              <span class="btn-icon">📋</span>
              <span class="btn-text">Assign</span>
            </button>
            <button class="btn btn-secondary btn-sm" @click="openEditModal(gear)" title="Edit">
              <span class="btn-icon">✏️</span>
              <span class="btn-text">Edit</span>
            </button>
            <button class="btn btn-danger btn-sm" @click="confirmDelete(gear.id)" title="Delete">
              <span class="btn-icon">🗑️</span>
              <span class="btn-text">Delete</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ADD GEAR MODAL -->
      <transition name="fade">
        <div v-if="showAddGearForm" class="modal-backdrop">
          <div class="modal-content">
            <h3>Add New Gear</h3>
            <form @submit.prevent="addGear" class="form-stack">
              <div class="form-group">
                <label>Gear Name<span>*</span></label>
                <input v-model="gearName" required placeholder="Enter Gear Name" />
              </div>
              <div class="form-group">
                <label>Type<span>*</span></label>
                <select v-model="gearType" required>
                  <option disabled value="">Select type</option>
                  <option value="source">Source (Microphones)</option>
                  <option value="transformer">Transformer</option>
                  <option value="recorder">Recorder</option>
                </select>
              </div>

              <template v-if="gearType !== 'source'">
                <div class="form-group">
                  <label>Max Inputs<span>*</span></label>
                  <input
                    type="number"
                    v-model.number="gearNumInputs"
                    min="0"
                    required
                  />
                </div>
                <div class="form-group">
                  <label>Max Outputs<span>*</span></label>
                  <input
                    type="number"
                    v-model.number="gearNumOutputs"
                    :min="gearType==='recorder'?1:0"
                    required
                  />
                </div>
              </template>

              <template v-if="gearType === 'recorder'">
                <div class="form-group">
                  <label>Number of Record Tracks<span>*</span></label>
                  <input
                    type="number"
                    v-model.number="gearNumRecords"
                    min="1"
                    required
                  />
                </div>
              </template>

              <div class="form-group">
                <label>Total Amount<span>*</span></label>
                <input
                  type="number"
                  v-model.number="gearAmount"
                  min="1"
                  required
                />
              </div>

              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="isRented" />
                  <span>Is Rented?</span>
                </label>
              </div>

              <div class="form-group">
                <label>Vendor / Owner</label>
                <input v-model="vendor" placeholder="Enter Vendor or Owner" />
              </div>

              <div class="form-group">
                <label>Assign to Stage (optional)</label>
                <select v-model="selectedLocationId">
                  <option value="">-- None --</option>
                  <option
                    v-for="loc in locationsList"
                    :key="loc.id"
                    :value="String(loc.id)"
                  >
                    {{ loc.stage_name }} ({{ loc.venue_name }})
                  </option>
                </select>
              </div>

              <div v-if="selectedLocationId" class="form-group">
                <label>Assign Immediately</label>
                <input
                  type="number"
                  v-model.number="immediateAssignedAmount"
                  :max="gearAmount"
                  min="0"
                />
              </div>

              <div v-if="formError" class="form-error">{{ formError }}</div>

              <div class="form-actions">
                <button type="button" class="btn btn-secondary" @click="toggleAddGear">
                  Cancel
                </button>
                <button type="submit" :disabled="loading" class="btn btn-success">
                  Add Gear
                </button>
              </div>
            </form>
          </div>
        </div>
      </transition>

      <!-- ASSIGNMENT MODAL -->
      <transition name="fade">
        <div v-if="assignmentModalVisible" class="modal-backdrop">
          <div class="modal-content">
            <h3>Assign Gear: {{ currentAssignmentGear.gear_name }}</h3>
            <p class="available-text">
              Available: {{ currentAssignmentGear.unassigned_amount }}
            </p>
            <form @submit.prevent="saveGearAssignments" class="form-stack">
              <div class="form-group" v-for="loc in locationsList" :key="loc.id">
                <label :for="'assign-'+loc.id">
                  {{ loc.stage_name }} ({{ loc.venue_name }})
                </label>
                <input
                  :id="'assign-'+loc.id"
                  type="number"
                  v-model.number="gearAssignments[loc.id]"
                  :max="calcMaxAssignment(loc.id)"
                  min="0"
                />
              </div>
              <div class="form-actions">
                <button type="button" class="btn btn-secondary" @click="closeAssignmentModal">
                  Cancel
                </button>
                <button type="submit" class="btn btn-success">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      </transition>

      <!-- EDIT GEAR MODAL -->
      <transition name="fade">
        <div v-if="editModalVisible" class="modal-backdrop">
          <div class="modal-content">
            <h3>Edit Gear: {{ currentEditGear.gear_name }}</h3>
            <form @submit.prevent="saveEdit" class="form-stack">
              <div class="form-group">
                <label>Name<span>*</span></label>
                <input v-model="editGearName" required />
              </div>
              <div class="form-group">
                <label>Type<span>*</span></label>
                <select v-model="editGearType" required>
                  <option value="source">Source (Microphones)</option>
                  <option value="transformer">Transformer</option>
                  <option value="recorder">Recorder</option>
                </select>
              </div>

              <template v-if="editGearType !== 'source'">
                <div class="form-group">
                  <label>Max Inputs<span>*</span></label>
                  <input
                    type="number"
                    v-model.number="editNumInputs"
                    min="0"
                    required
                  />
                </div>
                <div class="form-group">
                  <label>Max Outputs<span>*</span></label>
                  <input
                    type="number"
                    v-model.number="editNumOutputs"
                    :min="editGearType==='recorder'?1:0"
                    required
                  />
                </div>
              </template>

              <template v-if="editGearType === 'recorder'">
                <div class="form-group">
                  <label>Number of Record Tracks<span>*</span></label>
                  <input
                    type="number"
                    v-model.number="editNumRecords"
                    min="1"
                    required
                  />
                </div>
              </template>

              <div class="form-group">
                <label>Total Amount<span>*</span></label>
                <input
                  type="number"
                  v-model.number="editGearAmount"
                  min="1"
                  required
                />
              </div>

              <div class="form-group">
                <label>Vendor / Owner</label>
                <input v-model="editVendor" placeholder="Enter Vendor or Owner" />
              </div>

              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="editIsRented" />
                  <span>Is Rented?</span>
                </label>
              </div>

              <div class="form-actions">
                <button class="btn btn-secondary" @click="closeEditModal">
                  Cancel
                </button>
                <button type="submit" :disabled="loading" class="btn btn-success">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </transition>

      <!-- REORDER GEAR MODAL -->
      <transition name="fade">
        <div v-if="reorderModalVisible" class="modal-backdrop">
          <div class="modal-content">
            <h3>Reorder Gear</h3>
            <ul class="reorder-list">
              <li v-for="(g, idx) in reorderList" :key="g.id" class="reorder-item">
                <span>{{ g.gear_name }}</span>
                <div class="reorder-buttons">
                  <button
                    class="btn btn-light btn-sm"
                    @click="moveInReorder(idx, -1)"
                    :disabled="idx===0"
                  >↑</button>
                  <button
                    class="btn btn-light btn-sm"
                    @click="moveInReorder(idx, 1)"
                    :disabled="idx===reorderList.length-1"
                  >↓</button>
                </div>
              </li>
            </ul>
            <div class="form-actions">
              <button class="btn btn-secondary" @click="closeReorderModal">
                Cancel
              </button>
              <button class="btn btn-success" @click="saveReorder">
                Save Order
              </button>
            </div>
          </div>
        </div>
      </transition>

      <!-- GEAR INFO MODAL -->
      <transition name="fade">
        <div v-if="gearInfoModalVisible" class="modal-backdrop">
          <div class="modal-content gear-info-modal">
            <div class="modal-header">
              <h3>Gear Details: {{ currentGearInfo.gear_name }}</h3>
              <button class="modal-close" @click="closeGearInfoModal">×</button>
            </div>
            <div class="modal-body">
              <div class="gear-info-grid">
                <div class="info-section">
                  <h4>Basic Information</h4>
                  <div class="info-row">
                    <span class="info-label">Type:</span>
                    <span class="info-value">{{ currentGearInfo.gear_type }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Total Amount:</span>
                    <span class="info-value">{{ currentGearInfo.gear_amount }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Assigned:</span>
                    <span class="info-value">{{ currentGearInfo.total_assigned }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Unassigned:</span>
                    <span class="info-value">{{ currentGearInfo.unassigned_amount }}</span>
                  </div>
                  <div v-if="currentGearInfo.num_inputs !== undefined" class="info-row">
                    <span class="info-label">Max Inputs:</span>
                    <span class="info-value">{{ currentGearInfo.num_inputs }}</span>
                  </div>
                  <div v-if="currentGearInfo.num_outputs !== undefined" class="info-row">
                    <span class="info-label">Max Outputs:</span>
                    <span class="info-value">{{ currentGearInfo.num_outputs }}</span>
                  </div>
                  <div v-if="currentGearInfo.num_records" class="info-row">
                    <span class="info-label">Record Tracks:</span>
                    <span class="info-value">{{ currentGearInfo.num_records }}</span>
                  </div>
                </div>

                <div class="info-section">
                  <h4>Ownership</h4>
                  <div v-if="currentGearInfo.is_user_gear" class="info-row">
                    <span class="info-label">Type:</span>
                    <span class="info-value user-gear-type">Personal Gear</span>
                  </div>
                  <div v-if="currentGearInfo.is_user_gear" class="info-row">
                    <span class="info-label">Owner:</span>
                    <span class="info-value">{{ currentGearInfo.owner_name || 'Unknown' }}</span>
                  </div>
                  <div v-if="currentGearInfo.owner_company" class="info-row">
                    <span class="info-label">Company:</span>
                    <span class="info-value">{{ currentGearInfo.owner_company }}</span>
                  </div>
                  <div v-if="!currentGearInfo.is_user_gear" class="info-row">
                    <span class="info-label">Type:</span>
                    <span class="info-value project-gear-type">Project Gear</span>
                  </div>
                  <div v-if="!currentGearInfo.is_user_gear && currentGearInfo.vendor" class="info-row">
                    <span class="info-label">Vendor:</span>
                    <span class="info-value">{{ currentGearInfo.vendor }}</span>
                  </div>
                  <div v-if="currentGearInfo.is_rented" class="info-row">
                    <span class="info-label">Status:</span>
                    <span class="info-value rented-status">Rented</span>
                  </div>
                </div>

                <div class="info-section">
                  <h4>Assignments</h4>
                  <div v-if="Object.keys(currentGearInfo.assignments || {}).length === 0" class="info-row">
                    <span class="info-value no-assignments">No assignments</span>
                  </div>
                  <div v-else v-for="(amount, locationId) in currentGearInfo.assignments" :key="locationId" class="info-row">
                    <span class="info-label">{{ getLocationName(locationId) }}:</span>
                    <span class="info-value">{{ amount }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>

      <!-- USER GEAR SELECTOR MODAL -->
      <transition name="fade">
        <div v-if="showUserGearSelector" class="modal-backdrop">
          <div class="modal-content user-gear-modal">
            <div class="modal-header">
              <h3>Add User Gear to Project</h3>
              <button class="modal-close" @click="closeUserGearSelector">×</button>
            </div>
            <div class="modal-body">
              <UserGearSelector
                :project-id="currentProject?.id"
                @gear-selected="handleUserGearSelected"
                @gear-added="handleUserGearAdded"
              />
            </div>
          </div>
        </div>
      </transition>

      <!-- EXPORT BUTTON -->
      <button
        @click="exportGearToPDF"
        class="btn btn-success full-width mt-2"
        :disabled="gearList.length===0 || loading"
      >
        Export Gear List to PDF
      </button>
    </section>
  </div>
</div>
</template>

<script>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Swal from 'sweetalert2'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useUserStore } from '../stores/userStore'
import { useToast } from 'vue-toastification'
import { fetchTableData, mutateTableData } from '../services/dataService'
import { supabase } from '../supabase'
import UserGearSelector from './UserGearSelector.vue'

export default {
name: 'ProjectGear',
components: {
  UserGearSelector
},
setup() {
  const route     = useRoute()
  const router    = useRouter()
  const toast     = useToast()
  const userStore = useUserStore()

  const filterLocationId        = ref(route.query.locationId || 'all')
  const loading                 = ref(false)
  const error                   = ref(null)
  const formError               = ref(null)
  const gearList                = ref([])
  const locationsList           = ref([])

  const showAddGearForm         = ref(false)
  const gearName                = ref('')
  const gearType                = ref('transformer')
  const gearNumInputs           = ref(1)
  const gearNumOutputs          = ref(1)
  const gearNumRecords          = ref(1)
  const gearAmount              = ref(1)
  const isRented                = ref(false)
  const vendor                  = ref('')
  const selectedLocationId      = ref('')
  const immediateAssignedAmount = ref(0)

  const assignmentModalVisible  = ref(false)
  const currentAssignmentGear   = ref(null)
  const gearAssignments         = ref({})

  const editModalVisible        = ref(false)
  const currentEditGear         = ref({})
  const editGearName            = ref('')
  const editGearType            = ref('transformer')
  const editNumInputs           = ref(1)
  const editNumOutputs          = ref(1)
  const editNumRecords          = ref(1)
  const editGearAmount          = ref(1)
  const editVendor              = ref('')
  const editIsRented            = ref(false)

  const reorderModalVisible     = ref(false)
  const reorderList             = ref([])

  // Gear Info Modal
  const gearInfoModalVisible    = ref(false)
  const currentGearInfo         = ref({})

  // User Gear Selector Modal
  const showUserGearSelector    = ref(false)
  const selectedUserGear        = ref([])

  const currentProject = computed(() => userStore.getCurrentProject)

  const filteredGearList = computed(() => {
    if (filterLocationId.value === 'all')       return gearList.value
    if (filterLocationId.value === 'unassigned') return gearList.value.filter(g => g.unassigned_amount > 0)
    if (filterLocationId.value === 'assigned')   return gearList.value.filter(g => g.total_assigned > 0)
    return gearList.value.filter(g => g.assignments?.[filterLocationId.value] > 0)
  })

  watch(gearType, t => {
    if (t === 'source') {
      gearNumInputs.value  = 0
      gearNumOutputs.value = 1
    }
  })
  watch(editGearType, t => {
    if (t === 'source') {
      editNumInputs.value  = 0
      editNumOutputs.value = 1
    }
  })

  async function fetchLocations() {
    if (!currentProject.value?.id) return
    loading.value = true
    try {
      locationsList.value = await fetchTableData('locations',{ 
        eq: { project_id: currentProject.value.id },
        order: [{ column:'order', ascending:true }]
      })
    } catch (err) {
      toast.error(err.message)
    } finally {
      loading.value = false
    }
  }

  async function fetchGearList() {
    if (!currentProject.value?.id) {
      error.value = 'Project ID not found.'
      return
    }
    loading.value = true
    try {
      // Use the regular gear_table instead of the view
      const gearData = await fetchTableData('gear_table',{ 
        eq: { project_id: currentProject.value.id },
        order: [{ column:'sort_order', ascending:true }]
      })
      
      // If online, try to get user information for user gear
      let userGearInfo = {}
      if (navigator.onLine) {
        try {
          const userGearIds = gearData
            .filter(g => g.is_user_gear && g.user_gear_id)
            .map(g => g.user_gear_id)
          
          if (userGearIds.length > 0) {
            const { data: userGearData, error } = await supabase
              .from('user_gear_view')
              .select('id, owner_name, owner_company')
              .in('id', userGearIds)
            
            if (!error && userGearData) {
              userGearData.forEach(ug => {
                userGearInfo[ug.id] = ug
              })
            }
          }
        } catch (err) {
          console.warn('Could not fetch user gear info:', err)
        }
      }
      
      const ids = gearData.map(g => g.id)
      const asns = ids.length
        ? await fetchTableData('gear_assignments',{ in:{ gear_id: ids }})
        : []
      const map = {}
      asns.forEach(a=>{
        map[a.gear_id] = map[a.gear_id]||{}
        map[a.gear_id][a.location_id] = a.assigned_amount
      })
      
      gearList.value = gearData.map(g=>{
        const m = map[g.id]||{}
        const tot = Object.values(m).reduce((s,v)=>s+v,0)
        const userInfo = g.is_user_gear && g.user_gear_id ? userGearInfo[g.user_gear_id] : null
        // Ensure num_tracks is always set for recorders
        let num_tracks = g.num_tracks
        if (!num_tracks && g.num_records) num_tracks = g.num_records
        return {
          ...g,
          assignments: m,
          total_assigned: tot,
          unassigned_amount: g.gear_amount - tot,
          owner_name: userInfo?.owner_name || (g.is_user_gear ? 'Unknown' : null),
          owner_company: userInfo?.owner_company || null,
          num_tracks // always present for recorders
        }
      })
      error.value = null
    } catch (err) {
      error.value = err.message
      toast.error(err.message)
    } finally {
      loading.value = false
    }
  }

  function goBack() {
    router.push({ name: 'ProjectLocations', params: { id: route.params.id } })
  }

  function toggleAddGear() {
    showAddGearForm.value = !showAddGearForm.value
    if (showAddGearForm.value) {
      gearName.value                = ''
      gearType.value                = 'transformer'
      gearNumInputs.value           = 1
      gearNumOutputs.value          = 1
      gearNumRecords.value          = 1
      gearAmount.value              = 1
      isRented.value                = false
      vendor.value                  = ''
      selectedLocationId.value      = ''
      immediateAssignedAmount.value = 0
      formError.value               = null
    }
  }

  async function addGear() {
    formError.value = null
    if (!gearName.value || gearAmount.value < 1) {
      formError.value = 'Please fill required fields.'
      return
    }
    loading.value = true
    try {
      console.log('addGear: gearNumRecords.value =', gearNumRecords.value)
      const payload = {
        gear_name:   gearName.value,
        gear_type:   gearType.value,
        num_inputs:  gearType==='source' ? 0 : gearNumInputs.value,
        num_outputs: gearType==='source' ? 1 : gearNumOutputs.value,
        num_records: gearType.value === 'recorder' ? Number(gearNumRecords.value) : null,
        gear_amount: gearAmount.value,
        is_rented:   isRented.value,
        vendor:      vendor.value,
        project_id:  currentProject.value.id,
        sort_order:  gearList.value.length + 1
      }
      const inserted = await mutateTableData('gear_table','insert',payload)
      if (selectedLocationId.value && immediateAssignedAmount.value > 0) {
        await mutateTableData('gear_assignments','insert',{ 
          gear_id: inserted.id,
          location_id: +selectedLocationId.value,
          assigned_amount: immediateAssignedAmount.value
        })
      }
      toast.success('Gear added')
      toggleAddGear()
      await fetchGearList()
    } catch (err) {
      formError.value = err.message
      toast.error(err.message)
    } finally {
      loading.value = false
    }
  }

  async function confirmDelete(gearId) {
    if (!gearId) {
      toast.error('Invalid gear ID')
      return
    }

    // Check if this is user gear
    const gearToDelete = gearList.value.find(g => g.id === gearId)
    const isUserGear = gearToDelete?.is_user_gear

    const { isConfirmed } = await Swal.fire({
      title: 'Are you sure?',
      text: isUserGear 
        ? 'This will return the gear to its owner and remove it from the project.'
        : 'This will delete the gear and all related data (via cascade).',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: isUserGear ? 'Return to Owner' : 'Yes, delete'
    })
    if (!isConfirmed) return

    loading.value = true
    try {
      if (isUserGear) {
        // Try to use the database function to return user gear to owner
        if (navigator.onLine) {
          try {
            // Decrement assigned_quantity by gear amount
            const userGearId = gearToDelete.user_gear_id;
            const userGear = await fetchTableData('user_gear', { eq: { id: userGearId } });
            const currentAssigned = userGear[0]?.assigned_quantity || 0;
            const newAssigned = Math.max(0, currentAssigned - (gearToDelete.gear_amount || 1));
            const newQty = (userGear[0]?.quantity || 0) + (gearToDelete.gear_amount || 1);
            await mutateTableData('user_gear', 'update', {
              id: userGearId,
              assigned_quantity: newAssigned,
              quantity: newQty,
              availability: newQty > 0 ? 'available' : 'unavailable'
            });
          } catch (err) {
            console.warn('Could not update user gear assigned_quantity:', err)
          }
          try {
            const { data, error } = await supabase.rpc('return_user_gear_to_owner', { gear_id: gearId })
            if (error) throw error
            toast.success('Gear returned to owner successfully.')
          } catch (err) {
            console.warn('Could not use database function, falling back to manual delete:', err)
            // Fallback: manually delete the gear
            await mutateTableData('gear_table', 'delete', { id: gearId })
            toast.success('Gear removed from project.')
          }
        } else {
          // Offline: just delete from project (queue update for later)
          await mutateTableData('gear_table', 'delete', { id: gearId })
          toast.success('Gear removed from project.')
        }
      } else {
        await mutateTableData('gear_table', 'delete', { id: gearId })
        toast.success('Gear and all related data deleted.')
      }
      await fetchGearList()
    } catch (err) {
      console.error('Delete error:', err)
      toast.error(err.message || 'Failed to delete gear')
    } finally {
      loading.value = false
    }
  }

  function openAssignmentModal(gear) {
    currentAssignmentGear.value = gear
    const init = {}
    locationsList.value.forEach(l => init[l.id] = gear.assignments?.[l.id] || 0)
    gearAssignments.value = init
    assignmentModalVisible.value = true
  }
  function closeAssignmentModal() {
    assignmentModalVisible.value = false
  }

  async function saveGearAssignments() {
    if (!currentAssignmentGear.value) return
    loading.value = true
    try {
      const gid = currentAssignmentGear.value.id
      for (const loc in gearAssignments.value) {
        const amt = gearAssignments.value[loc]
        const existing = await fetchTableData('gear_assignments',{ 
          eq: { gear_id: gid, location_id: +loc }
        })
        if (amt > 0) {
          if (existing.length) {
            await mutateTableData('gear_assignments','update',{ id: existing[0].id, assigned_amount: amt })
          } else {
            await mutateTableData('gear_assignments','insert',{ gear_id: gid, location_id: +loc, assigned_amount: amt })
          }
        } else if (existing.length) {
          await mutateTableData('gear_assignments','delete',{ id: existing[0].id })
        }
      }
      toast.success('Assignments saved')
      closeAssignmentModal()
      await fetchGearList()
    } catch (err) {
      toast.error(err.message)
    } finally {
      loading.value = false
    }
  }

  function openEditModal(gear) {
    currentEditGear.value  = gear
    editGearName.value     = gear.gear_name
    editGearType.value     = gear.gear_type
    editNumInputs.value    = gear.num_inputs
    editNumOutputs.value   = gear.num_outputs
    editNumRecords.value   = gear.num_records || 1
    editGearAmount.value   = gear.gear_amount
    editVendor.value       = gear.vendor || ''
    editIsRented.value     = gear.is_rented
    editModalVisible.value = true
  }
  function closeEditModal() {
    editModalVisible.value = false
  }

  async function saveEdit() {
    formError.value = null
    if (!editGearName.value || editGearAmount.value < 1) {
      toast.error('Please fill required fields.')
      return
    }
    loading.value = true
    try {
      console.log('saveEdit: editNumRecords.value =', editNumRecords.value)
      await mutateTableData('gear_table','update',{ 
        id: currentEditGear.value.id,
        gear_name:   editGearName.value,
        gear_type:   editGearType.value,
        num_inputs:  editGearType==='source' ? 0 : editNumInputs.value,
        num_outputs: editGearType==='source'?1:editNumOutputs.value,
        num_records: editGearType.value === 'recorder' ? Number(editNumRecords.value) : null,
        gear_amount: editGearAmount.value,
        is_rented:   editIsRented.value,
        vendor:      editVendor.value
      })
      toast.success('Gear updated')
      closeEditModal()
      await fetchGearList()
    } catch (err) {
      toast.error(err.message)
    } finally {
      loading.value = false
    }
  }

  function openReorderModal() {
    reorderList.value = gearList.value.slice()
    reorderModalVisible.value = true
  }
  function closeReorderModal() {
    reorderModalVisible.value = false
  }

  function moveInReorder(idx, dir) {
    const i = idx + dir
    if (i < 0 || i >= reorderList.value.length) return
    ;[reorderList.value[idx], reorderList.value[i]] =
      [reorderList.value[i], reorderList.value[idx]]
  }

  async function saveReorder() {
    loading.value = true
    try {
      await Promise.all(
        reorderList.value.map((g, i) =>
          mutateTableData('gear_table','update',{ id: g.id, sort_order: i + 1 })
        )
      )
      toast.success('Order updated')
      closeReorderModal()
      await fetchGearList()
    } catch (err) {
      toast.error(err.message)
    } finally {
      loading.value = false
    }
  }

  function exportGearToPDF() {
    const doc = new jsPDF()
    const title =
      filterLocationId.value==='all'        ? 'All Gear' :
      filterLocationId.value==='unassigned' ? 'Unassigned Gear' :
      filterLocationId.value==='assigned'   ? 'Assigned Gear' :
      `Gear for ${locationsList.value.find(l=>String(l.id)===filterLocationId.value)?.stage_name}`
    doc.setFontSize(16)
    doc.text(title, 10, 20)
    const data = filteredGearList.value.map(g => [
      g.gear_name, g.gear_type, g.gear_amount,
      g.unassigned_amount, g.total_assigned,
      g.is_rented ? 'Yes' : 'No', g.vendor || ''
    ])
    autoTable(doc, {
      startY: 30,
      head: [['Name','Type','Total','Unassigned','Assigned','Rented?','Vendor']],
      body: data
    })
    doc.save(`gear_${new Date().toISOString().slice(0,10)}.pdf`)
    toast.success('Exported to PDF')
  }

  function calcMaxAssignment(locId) {
    const a = currentAssignmentGear.value?.assignments?.[locId] || 0
    const u = currentAssignmentGear.value?.unassigned_amount || 0
    return a + u
  }

  // User Gear Selector Functions
  function openUserGearSelector() {
    showUserGearSelector.value = true
    selectedUserGear.value = []
  }

  function closeUserGearSelector() {
    showUserGearSelector.value = false
    selectedUserGear.value = []
  }

  function handleUserGearSelected(selectedGear) {
    selectedUserGear.value = selectedGear
  }

  async function openGearInfoModal(gear) {
    currentGearInfo.value = gear
    gearInfoModalVisible.value = true
  }

  function closeGearInfoModal() {
    gearInfoModalVisible.value = false
    currentGearInfo.value = {}
  }

  function getLocationName(locationId) {
    const location = locationsList.value.find(l => l.id === parseInt(locationId))
    return location ? `${location.stage_name} (${location.venue_name})` : `Location ${locationId}`
  }

  async function handleUserGearAdded(gearToAdd) {
    if (!gearToAdd || gearToAdd.length === 0) return

    loading.value = true
    try {
      for (const { userGear, quantity } of gearToAdd) {
        if (!userGear || !quantity || quantity < 1) continue;
        // Convert user gear to project gear format
        const projectGearPayload = {
          gear_name: userGear.gear_name,
          gear_type: userGear.gear_type || 'user_gear',
          num_inputs: 0,
          num_outputs: 1,
          num_records: null,
          gear_amount: quantity,
          is_rented: false,
          vendor: `${userGear.owner_name || 'Unknown'} (Personal Gear)`,
          project_id: currentProject.value.id,
          sort_order: gearList.value.length + 1,
          user_gear_id: userGear.id, // Reference to original user gear
          owner_id: userGear.user_id,
          is_user_gear: true
        }

        await mutateTableData('gear_table', 'insert', projectGearPayload)
        
        // Update user gear assigned_quantity and availability if online
        if (navigator.onLine) {
          try {
            const newQty = (userGear.quantity || 0) - quantity;
            const newAssigned = (userGear.assigned_quantity || 0) + quantity;
            await mutateTableData('user_gear', 'update', {
              id: userGear.id,
              quantity: newQty,
              assigned_quantity: newAssigned,
              availability: newQty > 0 ? 'available' : 'unavailable'
            })
          } catch (err) {
            console.warn('Could not update user gear assigned_quantity:', err)
          }
        }

        toast.success(`Added ${quantity} × ${userGear.gear_name} from ${userGear.owner_name || 'Unknown'}`)
      }

      closeUserGearSelector()
      await fetchGearList()
    } catch (err) {
      console.error('Error adding user gear to project:', err)
      toast.error(err.message || 'Failed to add user gear to project')
    } finally {
      loading.value = false
    }
  }

  onMounted(async () => {
    await fetchLocations()
    await fetchGearList()
    window.addEventListener('online', fetchGearList)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('online', fetchGearList)
  })

  return {
    goBack,
    filterLocationId,
    loading,
    error,
    formError,
    gearList,
    locationsList,
    showAddGearForm,
    gearName,
    gearType,
    gearNumInputs,
    gearNumOutputs,
    gearNumRecords,
    gearAmount,
    isRented,
    vendor,
    selectedLocationId,
    immediateAssignedAmount,
    toggleAddGear,
    addGear,
    filteredGearList,
    confirmDelete,
    openAssignmentModal,
    closeAssignmentModal,
    saveGearAssignments,
    assignmentModalVisible,
    currentAssignmentGear,
    gearAssignments,
    openEditModal,
    closeEditModal,
    saveEdit,
    editModalVisible,
    currentEditGear,
    editGearName,
    editGearType,
    editNumInputs,
    editNumOutputs,
    editNumRecords,
    editGearAmount,
    editVendor,
    editIsRented,
    openReorderModal,
    closeReorderModal,
    moveInReorder,
    saveReorder,
    reorderModalVisible,
    reorderList,
    exportGearToPDF,
    calcMaxAssignment,
    // Gear Info Modal
    gearInfoModalVisible,
    currentGearInfo,
    openGearInfoModal,
    closeGearInfoModal,
    getLocationName,
    // User Gear Selector
    showUserGearSelector,
    selectedUserGear,
    openUserGearSelector,
    closeUserGearSelector,
    handleUserGearSelected,
    handleUserGearAdded
  }
}
}
</script>

<style scoped>
/* Modern background and card */
.modern-bg {
  background: #f3f4f6;
  min-height: 100vh;
  padding: 2.5rem 0;
}
.gear-card {
  background: #fff;
  border-radius: 1.25rem;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08), 0 1.5px 4px rgba(0,0,0,0.03);
  max-width: 800px;
  margin: 0 auto;
  padding: 2.5rem 2rem 2rem 2rem;
}

body, .project-gear {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 1.08rem;
  color: #222;
}

.section-divider {
  border-bottom: 1.5px solid #e5e7eb;
  margin: 1.5rem 0 0.5rem 0;
}

.header-section h1 {
  font-size: 2.1rem;
  font-weight: 800;
  margin: 0.5rem 0 0.25rem;
  letter-spacing: -1px;
}
.header-section p {
  color: #6b7280;
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 1.3rem;
  border: none;
  border-radius: 0.7rem;
  font-size: 1.05rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s, box-shadow 0.18s, color 0.18s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}
.btn-sm {
  padding: 0.45rem 0.8rem;
  font-size: 0.98rem;
}
.btn-primary   { background: #2563eb; color: #fff; }
.btn-primary:hover, .btn-primary:focus { background: #1d4ed8; }
.btn-accent    { background: #0ea5e9; color: #fff; }
.btn-accent:hover, .btn-accent:focus { background: #0369a1; }
.btn-success   { background: #22c55e; color: #fff; }
.btn-success:hover, .btn-success:focus { background: #16a34a; }
.btn-warning   { background: #fbbf24; color: #222; }
.btn-warning:hover, .btn-warning:focus { background: #f59e42; }
.btn-danger    { background: #ef4444; color: #fff; }
.btn-danger:hover, .btn-danger:focus { background: #b91c1c; }
.btn-secondary { background: #64748b; color: #fff; }
.btn-secondary:hover, .btn-secondary:focus { background: #334155; }
.btn-light     { background: #f1f5f9; color: #222; }
.btn-light:hover, .btn-light:focus { background: #e0e7ef; }
.btn:active {
  box-shadow: 0 0 0 2px #2563eb33;
}
.btn-icon {
  font-size: 1.15em;
  vertical-align: middle;
}

.actions-header {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  margin-bottom: 1.2rem;
}
@media (min-width: 600px) {
  .actions-header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
  .actions-group {
    flex-direction: row;
    gap: 0.7rem;
  }
}
.actions-group {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.table-wrapper {
  overflow-x: auto;
  margin-bottom: 1.5rem;
}
.table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: #f9fafb;
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.03);
}
.table th, .table td {
  padding: 1rem 0.9rem;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
}
.table th {
  background: #2563eb;
  color: #fff;
  font-weight: 700;
  font-size: 1.05rem;
  letter-spacing: 0.5px;
}
.table tr:last-child td {
  border-bottom: none;
}
.stripe { background: #f3f4f6; }
.table tr:hover { background: #e0e7ef; transition: background 0.15s; }
.no-data { text-align: center; color: #6c757d; }

/* Gear Name Cell */
.gear-name-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.gear-name {
  font-weight: 500;
  color: #1e293b;
}

.user-gear-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
}

.user-gear-badge {
background: #3b82f6;
color: white;
padding: 0.125rem 0.375rem;
border-radius: 0.25rem;
font-size: 0.75rem;
font-weight: 500;
}

.owner-name {
  color: #64748b;
  font-size: 0.75rem;
}

/* Info Button */
.btn-info {
  background: #0ea5e9;
  color: white;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.5rem;
  font-size: 0.75rem;
}

.info-icon {
  font-size: 0.875rem;
}

.info-text {
  font-weight: 500;
}

/* User Gear Styling */
.user-gear-owner {
display: flex;
flex-direction: column;
gap: 0.25rem;
font-size: 0.875rem;
}

.project-gear-owner {
color: #64748b;
font-size: 0.875rem;
}

/* Modal backdrop */
.modal-backdrop {
position: fixed;
inset: 0;
background: rgba(0,0,0,0.5);
display: flex;
align-items: center;
justify-content: center;
padding: 1rem;
}
.modal-content {
background: #fff;
border-radius: 0.5rem;
padding: 1.25rem;
width: 100%;
max-width: 360px;
max-height: 90vh;
overflow-y: auto;
box-shadow: 0 10px 25px rgba(0,0,0,0.1);
}

/* Fade */
.fade-enter-active, .fade-leave-active {
transition: opacity .2s ease, transform .2s ease;
}
.fade-enter-from, .fade-leave-to {
opacity: 0;
transform: scale(0.95);
}

/* Form stack */
.form-stack { display: flex; flex-direction: column; gap: 1rem; }
.form-group { display: flex; flex-direction: column; }
label { font-weight: 500; }

/* Gear Info Modal */
.gear-info-modal {
  max-width: 600px;
  max-height: 90vh;
  width: 100%;
}

.gear-info-grid {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.info-section {
  background: #f8fafc;
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
}

.info-section h4 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  border-bottom: 1px solid #cbd5e1;
  padding-bottom: 0.5rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid #f1f5f9;
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-weight: 500;
  color: #475569;
  font-size: 0.875rem;
}

.info-value {
  font-weight: 600;
  color: #1e293b;
  font-size: 0.875rem;
}

.user-gear-type {
  color: #3b82f6;
}

.project-gear-type {
  color: #059669;
}

.rented-status {
  color: #dc2626;
}

.no-assignments {
  color: #64748b;
  font-style: italic;
  font-weight: normal;
}

/* User Gear Modal */
.user-gear-modal {
  max-width: 800px;
  max-height: 90vh;
  width: 100%;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 1rem;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #64748b;
  padding: 0.25rem;
  border-radius: 0.25rem;
}

.modal-close:hover {
  background: #f1f5f9;
}

.modal-body {
  max-height: calc(90vh - 120px);
  overflow-y: auto;
}
input, select { padding: 0.5rem; border: 1px solid #dee2e6; border-radius: 0.375rem; }

/* Checkbox */
.checkbox-label { display: inline-flex; align-items: center; cursor: pointer; }
.checkbox-label input { margin-right: 0.5rem; width: 1rem; height: 1rem; }

/* Form errors */
.form-error { color: #dc3545; font-size: 0.9rem; }

/* Form actions */
.form-actions { display: flex; flex-direction: column; gap: 0.5rem; }
@media (min-width: 480px) {
.form-actions { flex-direction: row; justify-content: flex-end; }
}

/* Responsive Design */
.desktop-only {
  display: block;
}
.mobile-only {
  display: none;
}

@media (max-width: 768px) {
  .desktop-only {
    display: none;
  }
  .mobile-only {
    display: block;
  }
  
  .gear-card {
    padding: 1.5rem 1rem;
    margin: 0 1rem;
  }
  
  .gear-card-item {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    padding: 1rem;
    margin-bottom: 0.75rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  
  .gear-card-item.user-gear {
    border-left: 4px solid #3b82f6;
  }
  
  .gear-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.75rem;
  }
  
  .gear-name-section {
    flex: 1;
  }
  
  .gear-name {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0 0 0.25rem 0;
    color: #1e293b;
  }
  
  .gear-type-badge {
    background: #f1f5f9;
    color: #475569;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    white-space: nowrap;
  }
  
  .gear-card-details {
    margin-bottom: 1rem;
  }
  
  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.25rem 0;
    font-size: 0.875rem;
  }
  
  .detail-label {
    color: #64748b;
    font-weight: 500;
  }
  
  .detail-value {
    color: #1e293b;
    font-weight: 600;
  }
  
  .gear-card-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  
  .gear-card-actions .btn {
    flex: 1;
    min-width: 0;
    justify-content: center;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
  }
  
  .btn-text {
    display: inline;
  }
  
  .no-data-card {
    text-align: center;
    padding: 2rem;
    color: #6c757d;
    background: #f8fafc;
    border-radius: 0.75rem;
    border: 1px solid #e2e8f0;
  }
  
  /* Adjust modal content for mobile */
  .modal-content {
    margin: 1rem;
    max-width: calc(100vw - 2rem);
  }
  
  /* Adjust gear card padding for mobile */
  .gear-card {
    padding: 1.5rem 1rem;
  }
  
  /* Make buttons more touch-friendly */
  .btn {
    min-height: 44px;
  }
  
  .btn-sm {
    min-height: 36px;
  }
}

/* Desktop button text hiding */
@media (min-width: 769px) {
  .btn-text {
    display: none;
  }
}

/* Keyframes */
@keyframes spin {
to { transform: rotate(360deg); }
}
</style>