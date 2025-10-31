<template>
<div class="project-gear">
  
  <!-- TOP BAR -->
  <header class="page-header ui-page-header">
    <div class="header-content">
      <button class="btn btn-warning back-btn" @click="goBack">
        <span class="btn-icon">←</span>
        <span class="btn-text">Back</span>
      </button>
      <h1 class="page-title">Project Gear</h1>
    </div>
    <p class="page-subtitle">Manage and organize your project's gear efficiently.</p>
  </header>

  <!-- FILTER & SORT -->
  <section class="filter-section">
    <div class="filter-container ui-filter-bar">
      <div class="filter-row">
        <div class="filter-group">
          <label for="filterAssignment" class="filter-label">Filter Gear:</label>
          <select id="filterAssignment" v-model="filterLocationId" class="filter-select">
            <option value="all">All Gear</option>
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
        <div class="filter-group">
          <label for="sortGear" class="filter-label">Sort By:</label>
          <select id="sortGear" v-model="sortBy" class="filter-select">
            <option value="default">Default Order</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="quantity-desc">Quantity (Most to Least)</option>
            <option value="quantity-asc">Quantity (Least to Most)</option>
          </select>
        </div>
      </div>
    </div>
  </section>

  <!-- LOADING -->
  <div v-if="loading" class="loading-skeleton">
    <div class="skeleton-header"></div>
    <div class="skeleton-filter"></div>
    <div class="skeleton-gear">
      <div class="skeleton-gear-item"></div>
      <div class="skeleton-gear-item"></div>
      <div class="skeleton-gear-item"></div>
    </div>
  </div>

  <!-- ERROR -->
  <div v-if="error" class="error-message" role="alert">
    <div class="error-icon">⚠️</div>
    <div class="error-content">
      <strong>Error:</strong> {{ error }}
    </div>
  </div>

  <!-- GEAR MANAGEMENT -->
  <section v-else class="gear-management">
    <div class="actions-header">
      <h2 class="section-title">Gear List</h2>
      <div class="actions-group">
        <button class="btn btn-positive" @click="toggleAddGear">
          <span class="btn-icon">{{ showAddGearForm ? '✕' : '➕' }}</span>
          <span class="btn-text">{{ showAddGearForm ? 'Hide' : 'Add Gear' }}</span>
        </button>
        <button class="btn btn-purple" @click="openUserGearSelector">
          <span class="btn-icon">👤</span>
          <span class="btn-text">Add Team Gear</span>
        </button>
        <button class="btn btn-warning" @click="openReorderModal">
          <span class="btn-icon">↕️</span>
          <span class="btn-text">Reorder</span>
        </button>
        <button class="btn btn-primary" @click="exportGearToPDF">
          <span class="btn-icon">📄</span>
          <span class="btn-text">Export PDF</span>
        </button>
      </div>
    </div>

    <p class="tip-text">
      Filter your gear by "All," "Unassigned," "Assigned," or a specific stage.
    </p>

    <!-- Gear Cards (Mobile-First) -->
    <div class="gear-cards">
      <div v-if="!filteredGearList.length" class="empty-state">
        <div class="empty-icon">🎸</div>
        <h3 class="empty-title">No gear found</h3>
        <p class="empty-message">Add some gear to get started!</p>
      </div>
      
      <div 
        v-for="(gear, idx) in filteredGearList" 
        :key="gear.id"
        class="gear-card"
        :class="{ 'user-gear': gear.is_user_gear }"
      >
        <div class="gear-header">
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
        
        <div class="gear-details">
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

        <div class="gear-actions">
          <button class="btn btn-primary" @click="openGearInfoModal(gear)" title="Info">
            <span class="btn-icon">ℹ️</span>
            <span class="btn-text">Info</span>
          </button>
          <button class="btn btn-positive" @click="openAssignmentModal(gear)" title="Assign">
            <span class="btn-icon">📋</span>
            <span class="btn-text">Assign</span>
          </button>
          <button class="btn btn-warning" @click="openEditModal(gear)" title="Edit">
            <span class="btn-icon">✏️</span>
            <span class="btn-text">Edit</span>
          </button>
          <button class="btn btn-danger" @click="confirmDelete(gear.id)" title="Delete">
            <span class="btn-icon">🗑️</span>
            <span class="btn-text">Delete</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ADD GEAR MODAL -->
    <div v-if="showAddGearForm" class="modal-overlay" @click="toggleAddGear">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">Add New Gear</h3>
          <button class="modal-close" @click="toggleAddGear">✕</button>
        </div>
        <form @submit.prevent="addGear" class="modal-form">
          <div class="form-grid">
            <div class="form-group">
              <label for="gearName" class="form-label">Gear Name<span class="required">*</span></label>
              <input 
                id="gearName"
                v-model="gearName" 
                required 
                placeholder="Enter Gear Name" 
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="gearType" class="form-label">Type<span class="required">*</span></label>
              <select id="gearType" v-model="gearType" required class="form-select">
                <option disabled value="">Select type</option>
                <option value="source">Source (Microphones)</option>
                <option value="transformer">Transformer</option>
                <option value="recorder">Recorder</option>
              </select>
            </div>
            <div class="form-group">
              <label for="gearAmount" class="form-label">Amount<span class="required">*</span></label>
              <input 
                id="gearAmount"
                v-model="gearAmount" 
                type="number" 
                min="1" 
                required 
                placeholder="1" 
                class="form-input"
              />
            </div>
            <!-- Optional IO fields (hidden for sources) -->
            <div v-if="gearType !== 'source'" class="form-group">
              <label for="gearNumInputs" class="form-label">Inputs</label>
              <input 
                id="gearNumInputs"
                v-model.number="gearNumInputs" 
                type="number" 
                min="0" 
                class="form-input"
              />
            </div>
            <div v-if="gearType !== 'source'" class="form-group">
              <label for="gearNumOutputs" class="form-label">Outputs</label>
              <input 
                id="gearNumOutputs"
                v-model.number="gearNumOutputs" 
                type="number" 
                min="0" 
                class="form-input"
              />
            </div>
            <!-- Tracks for recorders -->
            <div v-if="gearType === 'recorder'" class="form-group">
              <label for="gearNumRecords" class="form-label">Tracks</label>
              <input 
                id="gearNumRecords"
                v-model.number="gearNumRecords" 
                type="number" 
                min="1" 
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="gearVendor" class="form-label">Vendor</label>
              <input 
                id="gearVendor"
                v-model="vendor" 
                placeholder="Vendor name (optional)" 
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label for="gearIsRented" class="form-label">Rented?</label>
              <input 
                id="gearIsRented"
                v-model="isRented" 
                type="checkbox"
                style="width:auto; min-height:unset;"
              />
            </div>
            <div class="form-group">
              <label for="addGearStage" class="form-label">Assign to Stage (Optional)</label>
              <select id="addGearStage" v-model="selectedLocationId" class="form-select">
                <option value="">None</option>
                <option
                  v-for="location in locationsList"
                  :key="location.id"
                  :value="String(location.id)"
                >
                  {{ location.stage_name }} ({{ location.venue_name }})
                </option>
              </select>
            </div>
            <div v-if="selectedLocationId" class="form-group">
              <label for="addGearAmount" class="form-label">Amount to Assign</label>
              <input 
                id="addGearAmount"
                v-model.number="immediateAssignedAmount" 
                type="number" 
                min="0" 
                :max="gearAmount"
                placeholder="0" 
                class="form-input"
              />
              <small style="color: #6c757d; margin-top: 4px; display: block;">
                Available: {{ gearAmount }} - Max assignable: {{ gearAmount }}
              </small>
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-positive">Add Gear</button>
            <button type="button" @click="toggleAddGear" class="btn btn-warning">Cancel</button>
          </div>
        </form>
      </div>
    </div>

    <!-- GEAR INFO MODAL -->
    <div v-if="gearInfoModalVisible" class="modal-overlay" @click="closeGearInfoModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">Gear Information</h3>
          <button class="modal-close" @click="closeGearInfoModal">✕</button>
        </div>
        <div class="modal-body">
          <div v-if="currentGearInfo && Object.keys(currentGearInfo).length" class="gear-info">
            <div class="info-section">
              <h4 class="info-title">Basic Details</h4>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Name:</span>
                  <span class="info-value">{{ currentGearInfo.gear_name }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Type:</span>
                  <span class="info-value">{{ currentGearInfo.gear_type || 'No type' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Total Amount:</span>
                  <span class="info-value">{{ currentGearInfo.gear_amount }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Available:</span>
                  <span class="info-value">{{ currentGearInfo.unassigned_amount }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Assigned:</span>
                  <span class="info-value">{{ currentGearInfo.total_assigned }}</span>
                </div>
                <div v-if="currentGearInfo.vendor" class="info-item">
                  <span class="info-label">Vendor:</span>
                  <span class="info-value">{{ currentGearInfo.vendor }}</span>
                </div>
              </div>
            </div>

            <div v-if="currentGearAssignmentsList.length" class="info-section">
              <h4 class="info-title">Current Assignments</h4>
              <div class="assignments-list">
                <div 
                  v-for="assignment in currentGearAssignmentsList" 
                  :key="assignment.location_id"
                  class="assignment-item"
                >
                  <div class="assignment-header">
                    <span class="assignment-stage">{{ assignment.stage_name }}</span>
                    <span class="assignment-amount">{{ assignment.amount }}</span>
                  </div>
                  <div class="assignment-details">
                    <span class="assignment-venue">{{ assignment.venue_name }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ASSIGNMENT MODAL -->
    <div v-if="assignmentModalVisible" class="modal-overlay" @click="closeAssignmentModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">Assign Gear</h3>
          <button class="modal-close" @click="closeAssignmentModal">✕</button>
        </div>
        <div class="modal-body">
          <div v-if="selectedGear" class="assignment-form">
            <div class="gear-summary">
              <h4 class="gear-summary-title">{{ selectedGear.gear_name }}</h4>
              <div class="gear-summary-details">
                <span class="summary-item">Available: {{ selectedGear.unassigned_amount }}</span>
                <span class="summary-item">Total: {{ selectedGear.gear_amount }}</span>
              </div>
            </div>

            <form @submit.prevent="saveAssignment" class="assignment-form-content">
              <div class="form-grid">
                <div class="form-group">
                  <label for="assignmentStage" class="form-label">Stage<span class="required">*</span></label>
                  <select id="assignmentStage" v-model="assignmentStageId" required class="form-select">
                    <option value="">Select a stage</option>
                    <option
                      v-for="location in locationsList"
                      :key="location.id"
                      :value="location.id"
                    >
                      {{ location.stage_name }} ({{ location.venue_name }})
                    </option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="assignmentAmount" class="form-label">Amount<span class="required">*</span></label>
                  <input 
                    id="assignmentAmount"
                    v-model="assignmentAmount" 
                    type="number" 
                    min="1" 
                    :max="selectedGear.unassigned_amount"
                    required 
                    class="form-input"
                  />
                </div>
              </div>
              <div class="form-actions">
                <button type="submit" class="btn btn-positive">Save Assignment</button>
                <button type="button" @click="closeAssignmentModal" class="btn btn-warning">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- EDIT GEAR MODAL -->
    <div v-if="editModalVisible" class="modal-overlay" @click="closeEditModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">Edit Gear</h3>
          <button class="modal-close" @click="closeEditModal">✕</button>
        </div>
        <div class="modal-body">
          <div v-if="currentEditGear" class="edit-form">
            <form @submit.prevent="saveEdit" class="edit-form-content">
              <div class="form-grid">
                <div class="form-group">
                  <label for="editGearName" class="form-label">Gear Name<span class="required">*</span></label>
                  <input 
                    id="editGearName"
                    v-model="editGearName" 
                    required 
                    class="form-input"
                  />
                </div>
                <div class="form-group">
                  <label for="editGearType" class="form-label">Type<span class="required">*</span></label>
                  <select id="editGearType" v-model="editGearType" required class="form-select">
                    <option value="source">Source (Microphones)</option>
                    <option value="transformer">Transformer</option>
                    <option value="recorder">Recorder</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="editGearAmount" class="form-label">Amount<span class="required">*</span></label>
                  <input 
                    id="editGearAmount"
                    v-model="editGearAmount" 
                    type="number" 
                    min="1" 
                    required 
                    class="form-input"
                  />
                </div>
                <!-- Inputs/Outputs (hidden for sources) -->
                <div v-if="editGearType !== 'source'" class="form-group">
                  <label for="editNumInputs" class="form-label">Inputs</label>
                  <input 
                    id="editNumInputs"
                    v-model.number="editNumInputs"
                    type="number"
                    min="0"
                    class="form-input"
                  />
                </div>
                <div v-if="editGearType !== 'source'" class="form-group">
                  <label for="editNumOutputs" class="form-label">Outputs</label>
                  <input 
                    id="editNumOutputs"
                    v-model.number="editNumOutputs"
                    type="number"
                    min="0"
                    class="form-input"
                  />
                </div>
                <!-- Tracks (for recorders) -->
                <div v-if="editGearType === 'recorder'" class="form-group">
                  <label for="editNumRecords" class="form-label">Tracks</label>
                  <input 
                    id="editNumRecords"
                    v-model.number="editNumRecords"
                    type="number"
                    min="1"
                    class="form-input"
                  />
                </div>
                <div class="form-group">
                  <label for="editGearVendor" class="form-label">Vendor</label>
                  <input 
                    id="editGearVendor"
                    v-model="editGearVendor" 
                    class="form-input"
                  />
                </div>
                <div class="form-group">
                  <label for="editIsRented" class="form-label">Rented?</label>
                  <input 
                    id="editIsRented"
                    v-model="editIsRented" 
                    type="checkbox"
                    style="width:auto; min-height:unset;"
                  />
                </div>
              </div>
              <div class="form-actions">
                <button type="submit" class="btn btn-positive">Save Changes</button>
                <button type="button" @click="closeEditModal" class="btn btn-warning">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- REORDER MODAL -->
    <div v-if="reorderModalVisible" class="modal-overlay" @click="closeReorderModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">Reorder Gear</h3>
          <button class="modal-close" @click="closeReorderModal">✕</button>
        </div>
        <div class="modal-body">
          <div class="reorder-sort-options">
            <span class="sort-label">Quick Sort:</span>
            <div class="sort-buttons">
              <button class="btn btn-secondary btn-sm" @click="sortReorderList('name-asc')">A-Z</button>
              <button class="btn btn-secondary btn-sm" @click="sortReorderList('name-desc')">Z-A</button>
              <button class="btn btn-secondary btn-sm" @click="sortReorderList('group-asc')">Group (A-Z)</button>
              <button class="btn btn-secondary btn-sm" @click="sortReorderList('group-desc')">Group (Z-A)</button>
            </div>
          </div>
          <div class="reorder-list">
            <div 
              v-for="(g, i) in reorderList" 
              :key="g.id" 
              class="reorder-item"
              :class="{ 'dragging': draggedIndex === i, 'drag-over': dragOverIndex === i }"
              draggable="true"
              @dragstart="handleDragStart($event, i)"
              @dragend="handleDragEnd"
              @dragover.prevent="handleDragOver($event, i)"
              @dragenter.prevent="handleDragEnter(i)"
              @dragleave="handleDragLeave"
              @drop.prevent="handleDrop($event, i)"
              @touchstart="handleTouchStart($event, i)"
              @touchmove="handleTouchMove"
              @touchend="handleTouchEnd"
            >
              <div class="drag-handle" title="Drag to reorder">
                <span class="drag-icon">☰</span>
              </div>
              <span class="reorder-name">{{ g.gear_name }}</span>
              <div class="reorder-actions">
                <button class="btn btn-secondary btn-arrow" @click="moveInReorder(i, -1)" title="Move up">↑</button>
                <button class="btn btn-secondary btn-arrow" @click="moveInReorder(i, 1)" title="Move down">↓</button>
              </div>
            </div>
          </div>
          <div class="form-actions" style="margin-top: 12px;">
            <button class="btn btn-positive" @click="saveReorder">Save Order</button>
            <button class="btn btn-warning" @click="closeReorderModal">Cancel</button>
          </div>
        </div>
      </div>
    </div>

    <!-- USER GEAR SELECTOR MODAL -->
    <div v-if="showUserGearSelector" class="modal-overlay" @click="closeUserGearSelector">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3 class="modal-title">Add Team Gear</h3>
          <button class="modal-close" @click="closeUserGearSelector">✕</button>
        </div>
        <div class="modal-body">
          <UserGearSelector 
            :project-id="String(currentProject?.id || '')"
            :locations-list="locationsList"
            @gear-selected="handleUserGearSelected"
            @gear-added="handleUserGearAdded"
          />
          <div class="form-actions" style="margin-top: 12px;">
            <button class="btn btn-warning" @click="closeUserGearSelector">Close</button>
          </div>
        </div>
      </div>
    </div>
  </section>
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
import ProjectBreadcrumbs from '@/components/ProjectBreadcrumbs.vue'

export default {
name: 'ProjectGear',
components: {
  UserGearSelector,
  ProjectBreadcrumbs
},
setup() {
  const route     = useRoute()
  const router    = useRouter()
  const toast     = useToast()
  const userStore = useUserStore()

  const filterLocationId        = ref(route.query.locationId || 'all')
  const sortBy                  = ref('default')
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

  // Single-assignment workflow state (used by Assign modal form)
  const selectedGear            = ref(null)
  const assignmentStageId       = ref('')
  const assignmentAmount        = ref(1)

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
  
  // Drag and drop state
  const draggedIndex            = ref(null)
  const dragOverIndex           = ref(null)
  const touchStartY             = ref(null)
  const touchStartIndex         = ref(null)
  const touchCurrentIndex       = ref(null)

  // Gear Info Modal
  const gearInfoModalVisible    = ref(false)
  const currentGearInfo         = ref({})

  // User Gear Selector Modal
  const showUserGearSelector    = ref(false)
  const selectedUserGear        = ref([])

  const currentProject = computed(() => userStore.getCurrentProject)

  const filteredGearList = computed(() => {
    let filtered = []
    
    // Apply filter
    if (filterLocationId.value === 'all') {
      filtered = gearList.value
    } else if (filterLocationId.value === 'unassigned') {
      filtered = gearList.value.filter(g => g.unassigned_amount > 0)
    } else if (filterLocationId.value === 'assigned') {
      filtered = gearList.value.filter(g => g.total_assigned > 0)
    } else {
      filtered = gearList.value.filter(g => g.assignments?.[filterLocationId.value] > 0)
    }
    
    // Apply sorting
    if (sortBy.value === 'default') {
      // Keep original order (by sort_order)
      return filtered
    } else if (sortBy.value === 'name-asc') {
      return [...filtered].sort((a, b) => 
        (a.gear_name || '').localeCompare(b.gear_name || '', undefined, { sensitivity: 'base' })
      )
    } else if (sortBy.value === 'name-desc') {
      return [...filtered].sort((a, b) => 
        (b.gear_name || '').localeCompare(a.gear_name || '', undefined, { sensitivity: 'base' })
      )
    } else if (sortBy.value === 'quantity-desc') {
      return [...filtered].sort((a, b) => (b.gear_amount || 0) - (a.gear_amount || 0))
    } else if (sortBy.value === 'quantity-asc') {
      return [...filtered].sort((a, b) => (a.gear_amount || 0) - (b.gear_amount || 0))
    }
    
    return filtered
  })

  const currentGearAssignmentsList = computed(() => {
    const info = currentGearInfo.value
    if (!info || !info.assignments) return []
    const entries = Object.entries(info.assignments)
    return entries
      .filter(([, amount]) => (amount || 0) > 0)
      .map(([locationId, amount]) => {
        const loc = locationsList.value.find(l => l.id === Number(locationId))
        return {
          location_id: Number(locationId),
          amount: amount,
          stage_name: loc?.stage_name || `Location ${locationId}`,
          venue_name: loc?.venue_name || ''
        }
      })
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
    if (selectedLocationId.value && immediateAssignedAmount.value > gearAmount.value) {
      formError.value = 'Assigned amount cannot exceed total gear amount.'
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
        const assignAmount = Math.min(immediateAssignedAmount.value, gearAmount.value)
        await mutateTableData('gear_assignments','insert',{ 
          gear_id: inserted.id,
          location_id: +selectedLocationId.value,
          assigned_amount: assignAmount
        })
        toast.success(`Gear added and ${assignAmount} assigned to stage`)
      } else {
        toast.success('Gear added')
      }
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
            // Decrement assigned_quantity by gear amount (quantity stays the same - it's total owned)
            const userGearId = gearToDelete.user_gear_id;
            const userGear = await fetchTableData('user_gear', { eq: { id: userGearId } });
            if (!userGear || userGear.length === 0) {
              console.warn('Could not find user gear to update:', userGearId)
              return
            }
            
            const currentAssigned = userGear[0]?.assigned_quantity || 0;
            const currentQuantity = userGear[0]?.quantity || 0;
            const gearAmount = gearToDelete.gear_amount || 1;
            const newAssigned = Math.max(0, currentAssigned - gearAmount);
            const availableQty = currentQuantity - newAssigned;
            
            await mutateTableData('user_gear', 'update', {
              id: userGearId,
              assigned_quantity: newAssigned,
              availability: availableQty > 0 ? 'available' : 'unavailable'
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
    // Legacy batch-assignment state (kept for compatibility)
    currentAssignmentGear.value = gear
    const init = {}
    locationsList.value.forEach(l => init[l.id] = gear.assignments?.[l.id] || 0)
    gearAssignments.value = init

    // New single-assignment form state
    selectedGear.value        = gear
    assignmentStageId.value   = ''
    assignmentAmount.value    = Math.min(1, Math.max(0, gear.unassigned_amount || 1))

    assignmentModalVisible.value = true
  }
  function closeAssignmentModal() {
    assignmentModalVisible.value = false
    selectedGear.value        = null
    assignmentStageId.value   = ''
    assignmentAmount.value    = 1
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

  // Save from the single-assignment form
  async function saveAssignment() {
    try {
      if (!selectedGear.value) { toast.error('No gear selected'); return }
      if (!assignmentStageId.value) { toast.error('Please choose a stage'); return }
      const amount = Number(assignmentAmount.value || 0)
      if (amount < 1) { toast.error('Amount must be at least 1'); return }
      if (amount > (selectedGear.value.unassigned_amount || 0)) {
        toast.error('Amount exceeds available')
        return
      }

      const gid = selectedGear.value.id
      const sid = Number(assignmentStageId.value)

      // Upsert by gear_id + location_id
      const existing = await fetchTableData('gear_assignments', {
        eq: { gear_id: gid, location_id: sid }
      })

      if (existing.length) {
        await mutateTableData('gear_assignments', 'update', {
          id: existing[0].id,
          assigned_amount: amount,
        })
      } else {
        await mutateTableData('gear_assignments', 'insert', {
          gear_id: gid,
          location_id: sid,
          assigned_amount: amount,
        })
      }

      toast.success('Assignment saved')
      closeAssignmentModal()
      await fetchGearList()
    } catch (err) {
      toast.error(err.message || 'Failed to save assignment')
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
    // Reset drag state
    draggedIndex.value = null
    dragOverIndex.value = null
    touchStartY.value = null
    touchStartIndex.value = null
    touchCurrentIndex.value = null
  }
  function closeReorderModal() {
    reorderModalVisible.value = false
    // Reset drag state
    draggedIndex.value = null
    dragOverIndex.value = null
    touchStartY.value = null
    touchStartIndex.value = null
    touchCurrentIndex.value = null
  }

  function moveInReorder(idx, dir) {
    const i = idx + dir
    if (i < 0 || i >= reorderList.value.length) return
    ;[reorderList.value[idx], reorderList.value[i]] =
      [reorderList.value[i], reorderList.value[idx]]
  }

  function sortReorderList(sortType) {
    const list = [...reorderList.value]
    
    if (sortType === 'name-asc') {
      list.sort((a, b) => 
        (a.gear_name || '').localeCompare(b.gear_name || '', undefined, { sensitivity: 'base' })
      )
    } else if (sortType === 'name-desc') {
      list.sort((a, b) => 
        (b.gear_name || '').localeCompare(a.gear_name || '', undefined, { sensitivity: 'base' })
      )
    } else if (sortType === 'group-asc') {
      list.sort((a, b) => {
        const typeA = (a.gear_type || '').toLowerCase()
        const typeB = (b.gear_type || '').toLowerCase()
        const nameA = (a.gear_name || '').toLowerCase()
        const nameB = (b.gear_name || '').toLowerCase()
        
        if (typeA !== typeB) {
          return typeA.localeCompare(typeB)
        }
        return nameA.localeCompare(nameB)
      })
    } else if (sortType === 'group-desc') {
      list.sort((a, b) => {
        const typeA = (a.gear_type || '').toLowerCase()
        const typeB = (b.gear_type || '').toLowerCase()
        const nameA = (a.gear_name || '').toLowerCase()
        const nameB = (b.gear_name || '').toLowerCase()
        
        if (typeA !== typeB) {
          return typeA.localeCompare(typeB)
        }
        return nameB.localeCompare(nameA)
      })
    }
    
    reorderList.value = list
  }

  // Drag and Drop Handlers (Desktop)
  function handleDragStart(event, index) {
    draggedIndex.value = index
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/html', event.target.outerHTML)
    // Add visual feedback
    event.target.style.opacity = '0.5'
  }

  function handleDragEnd(event) {
    event.target.style.opacity = ''
    draggedIndex.value = null
    dragOverIndex.value = null
  }

  function handleDragOver(event, index) {
    if (draggedIndex.value === null || draggedIndex.value === index) return
    dragOverIndex.value = index
  }

  function handleDragEnter(index) {
    if (draggedIndex.value === null || draggedIndex.value === index) return
    dragOverIndex.value = index
  }

  function handleDragLeave(event) {
    // Only clear if we're actually leaving the item (not entering a child)
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX
    const y = event.clientY
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      dragOverIndex.value = null
    }
  }

  function handleDrop(event, dropIndex) {
    if (draggedIndex.value === null || draggedIndex.value === dropIndex) {
      dragOverIndex.value = null
      return
    }

    const items = [...reorderList.value]
    const draggedItem = items[draggedIndex.value]
    items.splice(draggedIndex.value, 1)
    items.splice(dropIndex, 0, draggedItem)
    reorderList.value = items

    draggedIndex.value = null
    dragOverIndex.value = null
  }

  // Touch Handlers (Mobile)
  function handleTouchStart(event, index) {
    touchStartY.value = event.touches[0].clientY
    touchStartIndex.value = index
    touchCurrentIndex.value = index
    draggedIndex.value = index
    
    // Get the element for visual feedback
    const target = event.currentTarget
    if (target) {
      target.style.opacity = '0.7'
      target.style.transform = 'scale(1.02)'
    }
  }

  function handleTouchMove(event) {
    if (touchStartIndex.value === null) return
    
    event.preventDefault()
    const touchY = event.touches[0].clientY
    
    // Find the reorder list container to get all items
    const targetElement = event.currentTarget
    const listContainer = targetElement?.closest('.reorder-list')
    if (!listContainer) return
    
    const reorderItems = Array.from(listContainer.children) || []
    let newIndex = touchStartIndex.value
    
    // Find which item's center the touch is closest to
    for (let i = 0; i < reorderItems.length; i++) {
      const item = reorderItems[i]
      const rect = item.getBoundingClientRect()
      const itemTop = rect.top
      const itemBottom = rect.bottom
      const itemCenterY = itemTop + rect.height / 2
      
      // Check if touch is within this item's bounds
      if (touchY >= itemTop && touchY <= itemBottom) {
        // Determine if we should insert before or after based on touch position
        if (touchY < itemCenterY) {
          newIndex = Math.max(0, i)
          break
        } else {
          newIndex = Math.min(reorderList.value.length - 1, i + 1)
        }
      } else if (i === 0 && touchY < itemTop) {
        newIndex = 0
        break
      } else if (i === reorderItems.length - 1 && touchY > itemBottom) {
        newIndex = reorderList.value.length - 1
        break
      }
    }
    
    // Clamp the index
    newIndex = Math.max(0, Math.min(newIndex, reorderList.value.length - 1))
    
    if (newIndex !== touchCurrentIndex.value && newIndex !== touchStartIndex.value) {
      touchCurrentIndex.value = newIndex
      dragOverIndex.value = newIndex
      
      // Reorder the array
      const items = [...reorderList.value]
      const draggedItem = items[touchStartIndex.value]
      items.splice(touchStartIndex.value, 1)
      items.splice(newIndex, 0, draggedItem)
      reorderList.value = items
      
      // Update the start index since we've reordered
      touchStartIndex.value = newIndex
    }
  }

  function handleTouchEnd(event) {
    const target = event.currentTarget
    if (target) {
      target.style.opacity = ''
      target.style.transform = ''
    }
    
    draggedIndex.value = null
    dragOverIndex.value = null
    touchStartY.value = null
    touchStartIndex.value = null
    touchCurrentIndex.value = null
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
      for (const { userGear, quantity, locationId, assignedAmount } of gearToAdd) {
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

        const inserted = await mutateTableData('gear_table', 'insert', projectGearPayload)
        
        // Create assignment if location and amount specified
        if (locationId && assignedAmount && assignedAmount > 0) {
          const assignAmount = Math.min(assignedAmount, quantity)
          await mutateTableData('gear_assignments', 'insert', {
            gear_id: inserted.id,
            location_id: +locationId,
            assigned_amount: assignAmount
          })
        }
        
        // Check for date conflicts with other projects (don't block, just warn)
        if (navigator.onLine && currentProject.value) {
          try {
            const { checkGearAssignmentConflicts, formatConflictMessage } = await import('../utils/gearConflictHelper')
            const conflicts = await checkGearAssignmentConflicts(
              userGear.id,
              currentProject.value.id,
              currentProject.value,
              supabase
            )
            
            if (conflicts.length > 0) {
              const conflictMsg = formatConflictMessage(conflicts, userGear.gear_name)
              toast.warning(conflictMsg, { timeout: 8000 })
            }
          } catch (err) {
            console.warn('Could not check gear conflicts:', err)
            // Don't block on conflict check errors
          }
        }

        const assignMsg = locationId && assignedAmount ? ` and ${Math.min(assignedAmount, quantity)} assigned to stage` : ''
        toast.success(`Added ${quantity} × ${userGear.gear_name} from ${userGear.owner_name || 'Unknown'}${assignMsg}`)
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
    sortBy,
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
    saveAssignment,
    assignmentModalVisible,
    currentAssignmentGear,
    gearAssignments,
    // Single-assign form state
    selectedGear,
    assignmentStageId,
    assignmentAmount,
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
    sortReorderList,
    saveReorder,
    reorderModalVisible,
    reorderList,
    // Drag and drop
    draggedIndex,
    dragOverIndex,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    exportGearToPDF,
    calcMaxAssignment,
    // Gear Info Modal
    gearInfoModalVisible,
    currentGearInfo,
    currentGearAssignmentsList,
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
/* Base Styles - Mobile First */
.project-gear {
  min-height: 100vh;
  background: #ffffff;
  padding: 16px;
  padding-top: env(safe-area-inset-top, 16px);
  padding-bottom: env(safe-area-inset-bottom, 16px);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.5;
  color: #1a1a1a;
}

/* Typography Scale */
.page-title {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
  margin: 0;
  color: #1a1a1a;
}

.page-subtitle {
  font-size: 16px;
  color: #6c757d;
  margin: 8px 0 0 0;
  line-height: 1.4;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
  margin: 0 0 16px 0;
  color: #1a1a1a;
}

/* Page Header */
.page-header {
  margin-bottom: 24px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 12px;
  border: 1px solid #e9ecef;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #ffffff;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
  color: #1a1a1a;
}

.back-btn:hover {
  border-color: #0066cc;
  box-shadow: 0 2px 8px rgba(0, 102, 204, 0.1);
}

.back-btn:active {
  transform: scale(0.98);
}

.btn-icon {
  font-size: 18px;
}

.btn-text {
  font-size: 16px;
}

/* Filter Section */
.filter-section {
  margin-bottom: 24px;
}

.filter-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-xl);
  background: var(--bg-grouped);
  padding: var(--space-6);
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(20px);
}

.filter-row {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.filter-label {
  font-weight: 600;
  color: #1a1a1a;
  font-size: 16px;
  line-height: 1.4;
}

.filter-select {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--border-medium);
  border-radius: 0.5rem;
  font-size: 16px;
  background: var(--bg-primary);
  color: #1a1a1a;
  min-height: 44px;
  appearance: none;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
}

.filter-select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1), var(--shadow-sm);
}

/* Loading Skeleton */
.loading-skeleton {
  padding: 16px;
}

.skeleton-header,
.skeleton-filter,
.skeleton-gear {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 8px;
  margin-bottom: 16px;
}

.skeleton-header {
  height: 80px;
}

.skeleton-filter {
  height: 60px;
}

.skeleton-gear {
  height: 400px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-gear-item {
  flex: 1;
  background: inherit;
  border-radius: 8px;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Error Message */
.error-message {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: #fff5f5;
  border: 1px solid #fed7d7;
  border-radius: 8px;
  margin-bottom: 24px;
  color: #dc2626;
}

.error-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.error-content {
  flex: 1;
}

/* Gear Management */
.gear-management {
  margin-bottom: 24px;
}

.actions-header {
  margin-bottom: 20px;
}

.actions-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.tip-text {
  color: #6c757d;
  font-size: 14px;
  margin-bottom: 24px;
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

/* Gear Cards */
.gear-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.gear-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  transition: all var(--transition-normal);
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(20px);
}

.gear-card:hover {
  border-color: var(--text-link);
  box-shadow: var(--shadow-elevated);
  transform: translateY(-2px);
}

.gear-card.user-gear {
  border-color: #f59e0b;
  background: #fffbeb;
}

.gear-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.gear-name-section {
  flex: 1;
}

.gear-name {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 8px 0;
  line-height: 1.4;
}

.user-gear-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-gear-badge {
  background: #f59e0b;
  color: #ffffff;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.owner-name {
  color: #6c757d;
  font-size: 14px;
}

.gear-type-badge {
  background: #e3f2fd;
  color: #1976d2;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

/* Gear Details */
.gear-details {
  margin-bottom: 20px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f1f3f4;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  color: #6c757d;
  font-size: 14px;
}

.detail-value {
  color: #1a1a1a;
  font-weight: 500;
  font-size: 14px;
}

/* Gear Actions */
.gear-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 48px 16px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #1a1a1a;
}

.empty-message {
  font-size: 16px;
  color: #6c757d;
  margin-bottom: 24px;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
  padding-top: env(safe-area-inset-top, 16px);
  padding-bottom: env(safe-area-inset-bottom, 16px);
}

.modal {
  background: #ffffff;
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 24px 20px 24px;
  border-bottom: 1px solid #e9ecef;
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: #1a1a1a;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #6c757d;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  background: #f8f9fa;
  color: #1a1a1a;
}

.modal-body {
  padding: 24px;
}

/* Form Elements */
.modal-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
}

.form-grid {
  display: grid;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-label {
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
  font-size: 16px;
  line-height: 1.4;
}

.required {
  color: #dc3545;
}

.form-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  font-size: 16px;
  background: #ffffff;
  color: #1a1a1a;
  transition: all 0.2s ease;
  min-height: 44px;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #0066cc;
  box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
}

.form-select {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  font-size: 16px;
  background: #ffffff;
  color: #1a1a1a;
  min-height: 44px;
  appearance: none;
  cursor: pointer;
}

.form-select:focus {
  outline: none;
  border-color: #0066cc;
  box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
}

.form-actions {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  padding-top: 8px;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
  text-decoration: none;
  box-sizing: border-box;
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.btn:active {
  transform: scale(0.98);
}

.btn-primary {
  background: #1d4ed8;
  color: #ffffff;
  border-color: #1e40af;
}

.btn-primary:hover {
  background: #1e40af;
  border-color: #1e3a8a;
  box-shadow: 0 2px 8px rgba(29, 78, 216, 0.3);
}

.btn-secondary {
  background: #6c757d;
  color: #ffffff;
}

.btn-secondary:hover {
  background: #5a6268;
}

.btn-info {
  background: #17a2b8;
  color: #ffffff;
}

.btn-info:hover {
  background: #138496;
}

.btn-warning {
  background: #f59e0b;
  color: #ffffff;
  border-color: #d97706;
}

.btn-warning:hover {
  background: #d97706;
  border-color: #b45309;
}

.btn-danger {
  background: #dc3545;
  color: #ffffff;
}

.btn-danger:hover {
  background: #c82333;
}

/* Gear Info Modal */
.gear-info {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.info-section {
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.info-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: #1a1a1a;
}

.info-grid {
  display: grid;
  gap: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #e9ecef;
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  color: #6c757d;
  font-size: 14px;
}

.info-value {
  color: #1a1a1a;
  font-weight: 500;
  font-size: 14px;
}

/* Assignments List */
.assignments-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.assignment-item {
  padding: 12px;
  background: #ffffff;
  border: 1px solid #e9ecef;
  border-radius: 6px;
}

.assignment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.assignment-stage {
  font-weight: 600;
  color: #1a1a1a;
  font-size: 14px;
}

.assignment-amount {
  background: #e3f2fd;
  color: #1976d2;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.assignment-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.assignment-venue {
  color: #6c757d;
  font-size: 12px;
}

.assignment-dates {
  color: #6c757d;
  font-size: 12px;
}

/* Assignment Form */
.assignment-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.gear-summary {
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.gear-summary-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: #1a1a1a;
}

.gear-summary-details {
  display: flex;
  gap: 16px;
}

.summary-item {
  color: #6c757d;
  font-size: 14px;
}

/* Edit Form */
.edit-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.edit-form-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Focus States for Accessibility */
.back-btn:focus,
.filter-select:focus,
.btn:focus,
.modal-close:focus,
.form-input:focus,
.form-select:focus {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}

/* Tablet Breakpoint (601px - 1024px) */
@media (min-width: 601px) {
  .project-gear {
    padding: 24px;
  }

  .page-title {
    font-size: 28px;
  }

  .filter-row {
    flex-direction: row;
    gap: 16px;
  }

  .filter-group {
    flex: 1;
  }

  .actions-group {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 12px;
  }

  .gear-actions {
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }

  .modal {
    max-width: 600px;
  }

  .form-grid {
    grid-template-columns: 1fr 1fr;
  }

  .info-grid {
    grid-template-columns: 1fr 1fr;
  }
}

/* Desktop Breakpoint (1025px+) */
@media (min-width: 1025px) {
  .project-gear {
    padding: 32px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .page-title {
    font-size: 32px;
  }

  .actions-group {
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 16px;
  }

  .gear-cards {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
  }

  .modal {
    max-width: 700px;
  }

  .form-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* High Contrast Button Overrides */
.btn-positive,
.btn-positive .btn-icon,
.btn-positive .btn-text {
  background-color: #047857 !important;
  color: #ffffff !important;
  border-color: #065f46 !important;
}

.btn-warning,
.btn-warning .btn-icon,
.btn-warning .btn-text {
  background-color: #f59e0b !important;
  color: #ffffff !important;
  border-color: #d97706 !important;
}

.btn-primary,
.btn-primary .btn-icon,
.btn-primary .btn-text {
  background-color: #1d4ed8 !important;
  color: #ffffff !important;
  border-color: #1e40af !important;
}

.btn-danger,
.btn-danger .btn-icon,
.btn-danger .btn-text {
  background-color: #dc2626 !important;
  color: #ffffff !important;
  border-color: #b91c1c !important;
}

.btn-purple,
.btn-purple .btn-icon,
.btn-purple .btn-text {
  background-color: #8b5cf6 !important;
  color: #ffffff !important;
  border-color: #7c3aed !important;
}

.btn-purple:hover {
  background-color: #7c3aed !important;
  border-color: #6d28d9 !important;
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
}

/* High Contrast Mode Support */
@media (prefers-contrast: high) {
  .gear-card,
  .btn,
  .form-input,
  .form-select,
  .filter-select {
    border-width: 2px;
  }
}

/* Reorder Modal Styles */
.reorder-sort-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.sort-label {
  font-weight: 600;
  color: #1a1a1a;
  font-size: 14px;
}

.sort-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.btn-sm {
  padding: 8px 16px;
  font-size: 14px;
  min-height: 36px;
}

.reorder-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
  margin-bottom: 16px;
}

.reorder-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #ffffff;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  transition: all 0.2s ease;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  position: relative;
}

.reorder-item:active {
  cursor: grabbing;
}

.reorder-item.dragging {
  opacity: 0.5;
  transform: scale(0.95);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

.reorder-item.drag-over {
  border-color: #0066cc;
  border-width: 2px;
  background: #e3f2fd;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 102, 204, 0.2);
}

.reorder-item:hover {
  border-color: #0066cc;
  box-shadow: 0 2px 4px rgba(0, 102, 204, 0.1);
}

.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  margin-right: 12px;
  color: #6c757d;
  cursor: grab;
  transition: color 0.2s ease;
  touch-action: none;
}

.reorder-item:active .drag-handle {
  cursor: grabbing;
}

.drag-handle:hover {
  color: #0066cc;
}

.drag-icon {
  font-size: 18px;
  line-height: 1;
  display: inline-block;
}

.reorder-name {
  flex: 1;
  font-size: 16px;
  color: #1a1a1a;
  font-weight: 500;
  margin-right: 12px;
}

.reorder-actions {
  display: flex;
  gap: 6px;
}

.reorder-actions .btn-arrow {
  padding: 8px 12px;
  min-height: 36px;
  min-width: 40px;
  font-size: 18px;
  font-weight: 600;
  background: #6c757d;
  color: #ffffff;
  border: 2px solid #5a6268;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.reorder-actions .btn-arrow:hover {
  background: #5a6268;
  border-color: #495057;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.reorder-actions .btn-arrow:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* Reduced Motion Support */
@media (prefers-reduced-motion: reduce) {
  .back-btn,
  .btn,
  .reorder-item,
  .drag-handle {
    transition: none;
  }
  
  .back-btn:hover,
  .btn:hover,
  .reorder-item:hover,
  .reorder-item.drag-over {
    transform: none;
  }
  
  .back-btn:active,
  .btn:active,
  .reorder-item.dragging {
    transform: none;
  }
}

/* Tablet and Desktop adjustments for reorder modal */
@media (min-width: 601px) {
  .reorder-sort-options {
    flex-direction: row;
    align-items: center;
    gap: 16px;
  }
  
  .sort-buttons {
    flex-wrap: nowrap;
  }
}
</style>