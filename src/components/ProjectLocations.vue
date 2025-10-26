<template>
<div class="project-locations">
  <!-- Header removed (duplicate of global header) -->

  <!-- ────────── loading / error ────────── -->
  <div v-if="loading" class="loading-skeleton">
    <div class="skeleton-header"></div>
    <div class="skeleton-quick-access"></div>
    <div class="skeleton-stages">
      <div class="skeleton-stage"></div>
      <div class="skeleton-stage"></div>
      <div class="skeleton-stage"></div>
    </div>
  </div>
  
  <div v-if="error" class="error-message" role="alert">
    <div class="error-icon">⚠️</div>
    <div class="error-content">
      <strong>Error:</strong> <span>{{ error }}</span>
    </div>
  </div>

  <!-- ────────── project-level quick-access ────────── -->
  <section v-if="!loading && !error" class="quick-access-section">
    <h2 class="section-title">Quick Access</h2>
    <div class="quick-access-grid">
      <button class="qa-tile" @click="goToProjectArtistSchedule">
        <span class="qa-icon">📗</span>
        <span class="qa-label">Artist Schedule</span>
      </button>
      <button class="qa-tile" @click="goToProjectDocs">
        <span class="qa-icon">📂</span>
        <span class="qa-label">All Documents</span>
      </button>
      <button class="qa-tile" @click="goToProjectGear">
        <span class="qa-icon">🎸</span>
        <span class="qa-label">Project Gear</span>
      </button>
      <button class="qa-tile" @click="goToProjectCalendar">
        <span class="qa-icon">📅</span>
        <span class="qa-label">Calendar</span>
      </button>
    </div>
  </section>

  <!-- ────────── venues & stages management ────────── -->
  <section v-if="!loading && !error" class="venues-stages-section">
    <div class="venues-stages-header">
      <h2 class="section-title">Venues & Stages</h2>
      <button class="manage-btn" @click="openLocationsModal">
        <span class="btn-icon">⚙️</span>
        <span class="btn-text">Manage</span>
      </button>
    </div>
  </section>

  <!-- ────────── stage-level quick-access ────────── -->
  <section
    v-if="!loading && !error && filteredStagesMain.length"
    class="stages-section"
  >
    <div class="stages-header">
      <h2 class="section-title">Your Recording Stages</h2>
      <div class="search-wrapper">
        <span class="search-icon">🔍</span>
        <input
          class="search-input"
          v-model="mainSearch"
          placeholder="Search by stage or venue…"
        />
      </div>
    </div>
    
    <div class="stages-grid">
      <div
        v-for="stage in filteredStagesMain"
        :key="stage.id"
        class="stage-card"
      >
        <div class="stage-header">
          <h3 class="stage-title">
            {{ stage.stage_name }}
          </h3>
          <button
            class="stage-edit-btn"
            @click="openStageModal(stage)"
            :title="`Edit ${stage.stage_name}`"
            aria-label="Edit Stage"
          >
            <span class="btn-icon">✍️</span>
          </button>
        </div>
        
        <div class="stage-meta">
          <div class="venue-info">
            <span class="meta-icon">🏢</span>
            <span class="venue-name">{{ stage.venue_name }}</span>
          </div>
        </div>
        
        <!-- Per-day Stage Hours -->
        <div class="stage-availability">
          <div class="availability-info">
            <span v-if="getTodaySlot(stage.id)" class="availability-status">
              <span v-if="isStageOpenNow(stage.id)" class="status-open">🟢 Open now</span>
              <span class="availability-time">Today: {{ formatSlot(getTodaySlot(stage.id)) }}</span>
            </span>
            <span v-else class="status-closed">🔴 Closed</span>
          </div>
          <button class="availability-btn" @click="openViewAllHoursModal(stage)">
            <span class="btn-icon">🕒</span>
            <span class="btn-text">Manage Hours</span>
          </button>
        </div>
        
        <div class="stage-actions">
          <button class="stage-action-btn" @click="goToLocationNotes(stage)">
            <span class="btn-icon">📝</span>
            <span class="btn-text">Notes</span>
          </button>
          <button class="stage-action-btn" @click="goToSignalMapper(stage)">
            <span class="btn-icon">🗺️</span>
            <span class="btn-text">Signal Mapper</span>
          </button>
          <button class="stage-action-btn" @click="goToGear(stage)">
            <span class="btn-icon">🎸</span>
            <span class="btn-text">Gear</span>
          </button>
          <button class="stage-action-btn" @click="goToStagePictures(stage)">
            <span class="btn-icon">🖼️</span>
            <span class="btn-text">Photos</span>
          </button>
          <button class="stage-action-btn" @click="goToStageDocs(stage)">
            <span class="btn-icon">📄</span>
            <span class="btn-text">Documents</span>
          </button>
        </div>
      </div>
    </div>
  </section>

  <div v-else-if="!loading && !error && !stages.length" class="empty-state">
    <div class="empty-icon">🏗️</div>
    <h3 class="empty-title">No stages found</h3>
    <p class="empty-message">Get started by adding your first stage to organize your recording locations and equipment.</p>
    <button class="btn btn-primary empty-state-button" @click="openLocationsModal">
      <span class="btn-icon">🏢</span>
      <span class="btn-text">Add Your First Stage</span>
    </button>
  </div>

  <!-- ────────── Venue Modal ────────── -->
  <div v-if="showLocationsModal" class="modal-overlay" @click="closeLocationsModal">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h2 class="modal-title">Manage Stages</h2>
        <button class="modal-close" @click="closeLocationsModal">✕</button>
      </div>
      
      <div class="modal-tabs">
        <button 
          :class="['modal-tab', {active: modalTab==='edit'}]" 
          @click="modalTab='edit'"
        >
          Edit Venues
        </button>
        <button 
          :class="['modal-tab', {active: modalTab==='add'}]" 
          @click="modalTab='add'"
        >
          Add Venue
        </button>
      </div>
      
      <div class="modal-body">
        <template v-if="modalTab==='add'">
          <form class="modal-form" @submit.prevent="createVenueWithStage">
            <div class="form-grid">
              <div class="form-group">
                <label for="newVenueName" class="form-label">Venue Name</label>
                <input 
                  id="newVenueName"
                  v-model="newVenueName" 
                  placeholder="Enter Venue Name" 
                  class="form-input"
                  required
                />
              </div>
              <div class="form-group">
                <label for="newVenueCity" class="form-label">City</label>
                <input 
                  id="newVenueCity"
                  v-model="newVenueCity" 
                  placeholder="Enter City" 
                  class="form-input"
                  required
                />
              </div>
              <div class="form-group">
                <label for="newVenueCountry" class="form-label">Country</label>
                <input 
                  id="newVenueCountry"
                  v-model="newVenueCountry" 
                  placeholder="Enter Country" 
                  class="form-input"
                  required
                />
              </div>
              <div class="form-group">
                <label for="newStageName" class="form-label">First Stage (optional)</label>
                <input 
                  id="newStageName"
                  v-model="newStageName" 
                  placeholder="First Stage Name (optional)" 
                  class="form-input"
                />
              </div>
            </div>
            <div class="form-actions">
              <button class="btn btn-primary" type="submit">Save Venue</button>
            </div>
          </form>
        </template>
        
        <template v-else>
          <div class="venue-selection">
            <label for="venueSelection" class="form-label">
              Select venue to edit, or
              <button class="link-btn" type="button" @click="modalTab='add'">create a new one</button>
            </label>
            <select
              id="venueSelection"
              v-model="selectedVenue"
              class="form-select"
              @change="handleVenueChange"
            >
              <option value="">-- Choose a venue --</option>
              <option
                v-for="v in filteredVenues"
                :key="v.id"
                :value="v.id"
              >
                {{ v.venue_name }}
              </option>
            </select>
          </div>

          <div v-if="selectedVenue && selectedVenue !== 'create'" class="venue-editor">
            <div class="stages-section">
              <h3 class="subsection-title">Stages in this Venue</h3>

              <div v-if="filteredStagesForSelectedVenue.length" class="stages-list">
                <div
                  v-for="(s, idx) in filteredStagesForSelectedVenue"
                  :key="s.id"
                  class="stage-item"
                >
                  <div class="stage-order">
                    <button 
                      class="order-btn" 
                      @click="moveStage(s.id, -1)" 
                      :disabled="idx === 0" 
                      :aria-disabled="idx === 0" 
                      title="Move Up"
                    >
                      <span class="btn-icon">▲</span>
                    </button>
                    <button 
                      class="order-btn" 
                      @click="moveStage(s.id, 1)" 
                      :disabled="idx === filteredStagesForSelectedVenue.length - 1" 
                      :aria-disabled="idx === filteredStagesForSelectedVenue.length - 1" 
                      title="Move Down"
                    >
                      <span class="btn-icon">▼</span>
                    </button>
                  </div>
                  <div class="stage-name">{{ s.stage_name }}</div>
                  <div class="stage-actions">
                    <button class="action-btn" @click="openStageModal(s)" title="Edit">
                      <span class="btn-icon">✏️</span>
                    </button>
                    <button class="action-btn delete" @click="promptDeleteStageFromVenue(s.id)" title="Delete">
                      <span class="btn-icon">🗑️</span>
                    </button>
                  </div>
                </div>
              </div>
              
              <p v-else class="no-stages">No stages match your filter.</p>
              
              <div class="add-stage">
                <h4 class="add-stage-title">Add a Stage to This Venue</h4>
                <div class="add-stage-form">
                  <input 
                    v-model="newStageName" 
                    placeholder="New Stage Name" 
                    class="form-input"
                  />
                  <button
                    class="btn btn-secondary"
                    @click="createStage"
                    :disabled="!newStageName"
                  >
                    Add Stage
                  </button>
                </div>
              </div>
            </div>

            <div class="venue-details">
              <h3 class="subsection-title">Edit Venue Details</h3>
              <div class="form-grid">
                <div class="form-group">
                  <label for="editVenueName" class="form-label">Venue Name</label>
                  <input 
                    id="editVenueName"
                    v-model="editVenueNameValue" 
                    placeholder="New Venue Name" 
                    class="form-input"
                  />
                </div>
                <div class="form-group">
                  <label for="editVenueCity" class="form-label">City</label>
                  <input 
                    id="editVenueCity"
                    v-model="editVenueCityValue" 
                    placeholder="New City" 
                    class="form-input"
                  />
                </div>
                <div class="form-group">
                  <label for="editVenueCountry" class="form-label">Country</label>
                  <input 
                    id="editVenueCountry"
                    v-model="editVenueCountryValue" 
                    placeholder="New Country" 
                    class="form-input"
                  />
                </div>
              </div>
              <button class="btn btn-primary" @click="updateVenue">
                Update Venue
              </button>
            </div>
            
            <div class="danger-zone">
              <h4 class="danger-title">⚠️ Danger Zone</h4>
              <p class="danger-text">
                Deleting this venue will permanently remove
                <strong>all stages</strong> associated with it.<br />
                <em>This action cannot be undone.</em>
              </p>
              <button class="btn btn-danger" @click="promptDeleteVenue">
                Delete Venue
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>

  <!-- ────────── Stage Modal ────────── -->
  <div v-if="showStageModal" class="modal-overlay" @click="closeStageModal">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h2 class="modal-title">Edit Stage</h2>
        <button class="modal-close" @click="closeStageModal">✕</button>
      </div>
      <div class="modal-body">
        <form class="edit-stage-form" @submit.prevent="saveStageEdit">
          <div class="form-group">
            <label class="form-label"><strong>Venue:</strong></label>
            <span class="venue-display">{{ activeStage.venue_name }}</span>
          </div>
          <div class="form-group">
            <label for="editStageName" class="form-label">Stage Name</label>
            <input 
              id="editStageName"
              v-model="editStageNameValue" 
              placeholder="New Stage Name" 
              class="form-input"
              required
            />
          </div>
          <div class="form-actions">
            <button class="btn btn-danger" type="button" @click="promptDeleteStage">
              <span class="btn-icon">⚠️</span>
              Delete Stage
            </button>
            <button class="btn btn-secondary" type="button" @click="closeStageModal">Cancel</button>
            <button class="btn btn-primary" type="submit">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- View All Hours Modal -->
  <transition name="fade">
    <div v-if="showViewAllHoursModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2>All Hours for {{ modalStage?.stage_name }}</h2>
          <button class="close-button" @click="closeViewAllHoursModal">×</button>
        </div>
        <div class="modal-body">
          <table class="hours-table">
            <thead>
              <tr>
                <th>Start</th>
                <th>End</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="slot in allSlotsForModalStage" :key="slot.id">
                <td>{{ formatDateTime(slot.start_datetime) }}</td>
                <td>{{ formatDateTime(slot.end_datetime) }}</td>
                <td>{{ slot.notes }}</td>
                <td class="actions-cell">
                  <button class="icon-action" @click="openAddEditSlotModal(modalStage, slot)" title="Edit"><span class="icon">✏️</span></button>
                  <button class="icon-action delete" @click="deleteSlot(slot)" title="Delete"><span class="icon">🗑️</span></button>
                </td>
              </tr>
            </tbody>
          </table>
          <button class="primary-button" @click="openAddEditSlotModal(modalStage)"><span class="icon">➕</span> Add New Slot</button>
        </div>
      </div>
    </div>
  </transition>

  <!-- Add/Edit Slot Modal -->
  <transition name="fade">
    <div v-if="showAddEditSlotModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ editingSlot ? 'Edit' : 'Add' }} Hours for {{ modalStage?.stage_name }}</h2>
          <button class="close-button" @click="closeAddEditSlotModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-field">
            <label>Start Date & Time</label>
            <input type="datetime-local" v-model="slotForm.start_datetime" />
          </div>
          <div class="form-field">
            <label>End Date & Time</label>
            <input type="datetime-local" v-model="slotForm.end_datetime" />
          </div>
          <div class="form-field">
            <label>Notes</label>
            <input type="text" v-model="slotForm.notes" placeholder="Optional" />
          </div>
          <div class="form-actions">
            <button class="primary-button" @click="saveSlot">Save</button>
            <button class="secondary-button" @click="closeAddEditSlotModal">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import { fetchTableData, mutateTableData } from '@/services/dataService';
import { getData } from '@/utils/indexedDB';
import { supabase } from '@/supabase';

export default {
name: 'ProjectLocations',
setup() {
  const route = useRoute();
  const router = useRouter();
  const toast = useToast();

  const loading = ref(false);
  const error = ref(null);
  const venues = ref([]);
  const stages = ref([]);
  const stageHours = ref([]); // All slots from stage_hours table

  const mainSearch = ref('');
  const venueSearch = ref('');
  const stageSearch = ref('');

  const showLocationsModal = ref(false);
  const selectedVenue = ref('');
  const newVenueName = ref('');
  const newVenueCity = ref('');
  const newVenueCountry = ref('');
  const editVenueNameValue = ref('');
  const editVenueCityValue = ref('');
  const editVenueCountryValue = ref('');

  const showStageModal = ref(false);
  const activeStage = ref(null);
  const editStageNameValue = ref('');
  const newStageName = ref('');

  // Modal state
  const showViewAllHoursModal = ref(false);
  const showAddEditSlotModal = ref(false);
  const modalStage = ref(null); // The stage being viewed/edited
  const allSlotsForModalStage = ref([]);
  const editingSlot = ref(null); // The slot being edited (null for add)
  const slotForm = ref({
    start_datetime: '',
    end_datetime: '',
    notes: ''
  });

  const modalTab = ref('edit');

  async function fetchData() {
    loading.value = true;
    error.value = null;
    try {
      const pid = route.params.id;
      venues.value = await fetchTableData('venues', {
        eq: { project_id: pid },
      });
      stages.value = await fetchTableData('locations', {
        eq: { project_id: pid },
        order: [{ column: 'order', ascending: true }],
      });
      
      // Fetch all slots for this project
      const { data, error: hoursError } = await supabase
        .from('stage_hours')
        .select('*')
        .eq('project_id', pid);
      
      if (hoursError) throw hoursError;
      stageHours.value = data || [];
    } catch (e) {
      console.error(
        'Error fetching from Supabase; falling back to IndexedDB:',
        e
      );
      try {
        venues.value = (await getData('venues')) || [];
        stages.value = (await getData('locations')) || [];
      } catch (idbError) {
        console.error('IndexedDB fallback failed:', idbError);
      }
      error.value = e.message;
      toast.error(e.message);
    } finally {
      loading.value = false;
    }
  }

  onMounted(fetchData);

  const filteredStagesMain = computed(() => {
    if (!mainSearch.value.trim()) return stages.value;
    const t = mainSearch.value.toLowerCase();
    return stages.value.filter(
      (s) =>
        s.stage_name.toLowerCase().includes(t) ||
        s.venue_name.toLowerCase().includes(t)
    );
  });

  const filteredVenues = computed(() => {
    if (!venueSearch.value.trim()) return venues.value;
    const t = venueSearch.value.toLowerCase();
    return venues.value.filter(
      (v) =>
        v.venue_name.toLowerCase().includes(t) ||
        (v.city && v.city.toLowerCase().includes(t)) ||
        (v.country && v.country.toLowerCase().includes(t))
    );
  });

  const filteredStagesForSelectedVenue = computed(() => {
    const vid = Number(selectedVenue.value);
    if (!vid) return [];
    let list = stages.value.filter((s) => s.venue_id === vid);
    if (stageSearch.value.trim()) {
      const t = stageSearch.value.toLowerCase();
      list = list.filter((s) =>
        s.stage_name.toLowerCase().includes(t)
      );
    }
    return list.sort((a, b) => a.order - b.order);
  });

  // Helper function to get stages for a specific venue
  const getStagesForVenue = (venueId) => {
    return stages.value.filter(stage => stage.venue_id === venueId);
  };

  async function createVenueWithStage() {
    if (!newVenueName.value.trim()) {
      toast.error('Provide a venue name');
      return;
    }
    loading.value = true;
    try {
      const { id: venueId } = await mutateTableData('venues', 'insert', {
        venue_name: newVenueName.value,
        city: newVenueCity.value,
        country: newVenueCountry.value,
        project_id: route.params.id,
      });
      if (newStageName.value.trim()) {
        await mutateTableData('locations', 'insert', {
          venue_id: venueId,
          venue_name: newVenueName.value,
          stage_name: newStageName.value,
          order: 1,
          project_id: route.params.id,
        });
      }
      toast.success('Venue created!');
      newVenueName.value = '';
      newVenueCity.value = '';
      newVenueCountry.value = '';
      newStageName.value = '';
      await fetchData();
      modalTab.value = 'edit';
    } catch (e) {
      toast.error(e.message);
    } finally {
      loading.value = false;
    }
  }

  async function updateVenue() {
    if (!editVenueNameValue.value.trim()) {
      toast.error('Provide a venue name');
      return;
    }
    loading.value = true;
    try {
      await mutateTableData('venues', 'update', {
        id: Number(selectedVenue.value),
        venue_name: editVenueNameValue.value,
        city: editVenueCityValue.value,
        country: editVenueCountryValue.value,
      });
      toast.success('Venue updated!');
      await fetchData();
    } catch (e) {
      toast.error(e.message);
    } finally {
      loading.value = false;
    }
  }

  async function promptDeleteVenue() {
    const vid = Number(selectedVenue.value);
    const ven = venues.value.find((v) => v.id === vid);
    if (!ven) {
      toast.error('Venue not found');
      return;
    }
    if (
      !confirm(
        `Delete venue “${ven.venue_name}”? All stages will be deleted.`
      )
    )
      return;
    if (!confirm('This cannot be undone. Are you absolutely sure?'))
      return;
    loading.value = true;
    try {
      await mutateTableData('locations', 'delete', {
        eq: { venue_id: vid },
      });
      await mutateTableData('venues', 'delete', { id: vid });
      toast.success('Venue and its stages deleted.');
      selectedVenue.value = '';
      await fetchData();
    } catch (e) {
      toast.error(e.message);
    } finally {
      loading.value = false;
    }
  }

  async function createStage() {
    if (!newStageName.value.trim()) return;
    loading.value = true;
    try {
      const ven = venues.value.find(
        (v) => v.id === Number(selectedVenue.value)
      );
      const maxOrder = stages.value.length
        ? Math.max(...stages.value.map((s) => s.order))
        : 0;
      await mutateTableData('locations', 'insert', {
        venue_id: ven.id,
        venue_name: ven.venue_name,
        stage_name: newStageName.value,
        order: maxOrder + 1,
        project_id: route.params.id,
      });
      toast.success('Stage added!');
      newStageName.value = '';
      await fetchData();
    } catch (e) {
      toast.error(e.message);
    } finally {
      loading.value = false;
    }
  }

  function openStageModal(s) {
    activeStage.value = s;
    editStageNameValue.value = s.stage_name;
    showStageModal.value = true;
  }
  function closeStageModal() {
    showStageModal.value = false;
    activeStage.value = null;
    editStageNameValue.value = '';
  }

  async function saveStageEdit() {
    if (!editStageNameValue.value.trim()) {
      toast.error('Provide a stage name');
      return;
    }
    loading.value = true;
    try {
      await mutateTableData('locations', 'update', {
        id: activeStage.value.id,
        stage_name: editStageNameValue.value,
      });
      toast.success('Stage updated!');
      await fetchData();
      closeStageModal();
    } catch (e) {
      toast.error(e.message);
    } finally {
      loading.value = false;
    }
  }

  async function promptDeleteStage() {
    if (!activeStage.value) return;
    if (!confirm('Delete this stage? This cannot be undone.')) return;
    loading.value = true;
    try {
      await mutateTableData('locations', 'delete', {
        id: activeStage.value.id,
      });
      toast.success('Stage deleted.');
      await fetchData();
      closeStageModal();
    } catch (e) {
      toast.error(e.message);
    } finally {
      loading.value = false;
    }
  }

  async function promptDeleteStageFromVenue(id) {
    if (!confirm('Delete this stage? This cannot be undone.')) return;
    loading.value = true;
    try {
      await mutateTableData('locations', 'delete', { id });
      toast.success('Stage deleted.');
      await fetchData();
    } catch (e) {
      toast.error(e.message);
    } finally {
      loading.value = false;
    }
  }

  function moveStage(id, dir) {
    const list = filteredStagesForSelectedVenue.value;
    const idx = list.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    const cur = list[idx],
      swap = list[target];
    updateStageOrder(cur.id, swap.order);
    updateStageOrder(swap.id, cur.order);
  }

  async function updateStageOrder(id, newOrder) {
    try {
      await mutateTableData('locations', 'update', { id, order: newOrder });
      await fetchData();
    } catch (e) {
      toast.error(`Error reordering: ${e.message}`);
    }
  }

  function closeLocationsModal() {
    showLocationsModal.value = false;
    selectedVenue.value = '';
    newStageName.value = '';
  }

  function handleVenueChange() {
    if (selectedVenue.value === 'create') {
      newVenueName.value = '';
      newVenueCity.value = '';
      newVenueCountry.value = '';
      return;
    }
    const ven = venues.value.find(
      (v) => v.id === Number(selectedVenue.value)
    );
    if (ven) {
      editVenueNameValue.value = ven.venue_name;
      editVenueCityValue.value = ven.city || '';
      editVenueCountryValue.value = ven.country || '';
    }
  }

  // Per-day hours logic
  function getTodaySlot(stageId) {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    return stageHours.value.find(slot =>
      slot.stage_id === stageId &&
      slot.start_datetime.slice(0, 10) === today
    );
  }
  function isStageOpenNow(stageId) {
    const now = new Date();
    return stageHours.value.some(slot =>
      slot.stage_id === stageId &&
      new Date(slot.start_datetime) <= now &&
      now < new Date(slot.end_datetime)
    );
  }
  function formatSlot(slot) {
    if (!slot) return '';
    return `${formatTime(slot.start_datetime)}–${formatTime(slot.end_datetime)}`;
  }
  function formatTime(dt) {
    if (!dt) return '';
    const d = new Date(dt);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  function formatDateTime(dt) {
    if (!dt) return '';
    const d = new Date(dt);
    return d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  }

  // Modal logic
  function openViewAllHoursModal(stage) {
    modalStage.value = stage;
    allSlotsForModalStage.value = stageHours.value
      .filter(slot => slot.stage_id === stage.id)
      .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
    showViewAllHoursModal.value = true;
  }
  function closeViewAllHoursModal() {
    showViewAllHoursModal.value = false;
    modalStage.value = null;
    allSlotsForModalStage.value = [];
  }
  function openAddEditSlotModal(stage, slot = null) {
    modalStage.value = stage;
    editingSlot.value = slot;
    showAddEditSlotModal.value = true;
    if (slot) {
      slotForm.value = {
        start_datetime: toLocalInputValue(slot.start_datetime),
        end_datetime: toLocalInputValue(slot.end_datetime),
        notes: slot.notes || ''
      };
    } else {
      slotForm.value = {
        start_datetime: '',
        end_datetime: '',
        notes: ''
      };
    }
  }
  function closeAddEditSlotModal() {
    showAddEditSlotModal.value = false;
    editingSlot.value = null;
    slotForm.value = { start_datetime: '', end_datetime: '', notes: '' };
  }
  async function upsertCalendarEventForStageHour(slot, stage, projectId) {
    const event_date = slot.start_datetime.slice(0, 10);
    const start_time = slot.start_datetime.slice(11, 16);
    const end_time = slot.end_datetime.slice(11, 16);
    // Try to find an existing event for this slot
    const { data: existing, error: findError } = await supabase
      .from('calendar_events')
      .select('id')
      .eq('project_id', projectId)
      .eq('location_id', stage.id)
      .eq('event_date', event_date)
      .eq('start_time', start_time)
      .eq('category', 'recording')
      .maybeSingle();
    if (findError) throw findError;
    if (existing) {
      // Update
      await supabase.from('calendar_events').update({
        end_time,
        notes: slot.notes,
        title: 'Stage Hour',
      }).eq('id', existing.id);
    } else {
      // Insert
      await supabase.from('calendar_events').insert([{
        project_id: projectId,
        category: 'recording',
        event_date,
        start_time,
        end_time,
        title: 'Stage Hour',
        location_id: stage.id,
        notes: slot.notes,
      }]);
    }
  }

  async function deleteCalendarEventForStageHour(slot, stage, projectId) {
    const event_date = slot.start_datetime.slice(0, 10);
    const start_time = slot.start_datetime.slice(11, 16);
    await supabase.from('calendar_events')
      .delete()
      .eq('project_id', projectId)
      .eq('location_id', stage.id)
      .eq('event_date', event_date)
      .eq('start_time', start_time)
      .eq('category', 'recording');
  }

  async function saveSlot() {
    if (!modalStage.value) return;
    const pid = route.params.id;
    const payload = {
      project_id: pid,
      stage_id: modalStage.value.id,
      start_datetime: toUTCISOString(slotForm.value.start_datetime),
      end_datetime: toUTCISOString(slotForm.value.end_datetime),
      notes: slotForm.value.notes
    };
    try {
      let slotId;
      if (editingSlot.value) {
        // Update
        const { error } = await supabase
          .from('stage_hours')
          .update(payload)
          .eq('id', editingSlot.value.id);
        if (error) throw error;
        slotId = editingSlot.value.id;
      } else {
        // Insert
        const { data, error } = await supabase
          .from('stage_hours')
          .insert([payload])
          .select('id')
          .single();
        if (error) throw error;
        slotId = data.id;
      }
      // Upsert calendar event
      await upsertCalendarEventForStageHour(payload, modalStage.value, pid);
      await fetchData();
      closeAddEditSlotModal();
      closeViewAllHoursModal();
    } catch (e) {
      alert('Failed to save: ' + e.message);
    }
  }
  async function deleteSlot(slot) {
    if (!confirm('Delete this slot?')) return;
    try {
      const pid = route.params.id;
      const stage = stages.value.find(s => s.id === slot.stage_id);
      const { error } = await supabase
        .from('stage_hours')
        .delete()
        .eq('id', slot.id);
      if (error) throw error;
      // Delete calendar event
      await deleteCalendarEventForStageHour(slot, stage, pid);
      await fetchData();
      closeViewAllHoursModal();
    } catch (e) {
      alert('Failed to delete: ' + e.message);
    }
  }

  // Navigation
  const goToProjectQuickfire = () =>
    router.push({
      name: 'ProjectQuickfire',
      params: { id: route.params.id },
    });
  const goToProjectArtistSchedule = () =>
    router.push({
      name: 'ProjectSchedule',
      params: { id: route.params.id },
    });
  const goToProjectDocs = () =>
    router.push({ name: 'ProjectDocs', params: { id: route.params.id } });

  const goToLocationNotes = (s) =>
    router.push({
      name: 'LocationNotes',
      params: { id: route.params.id, locationId: s.id },
    });
  const goToSignalMapper = (s) =>
    router.push({
      name: 'SignalMapper',
      params: { id: route.params.id },
      query: { 
        venueId: s.venue_id, 
        stageId: s.id,
        locationId: s.id
      }
    });
  const goToGear = (s) =>
    router.push({
      name: 'ProjectGear',
      params: { id: route.params.id },
      query: { locationId: s.id },
    });
  const goToStagePictures = (s) =>
    router.push({
      name: 'StagePictures',
      params: { id: route.params.id },
      query: { venueId: s.venue_id, stageId: s.id },
    });
  const goToStageDocs = (s) =>
    router.push({
      name: 'StageDocs',
      params: { id: route.params.id },
      query: { venueId: s.venue_id, stageId: s.id },
    });

  const goToProjectGear = () =>
    router.push({ name: 'ProjectGear', params: { id: route.params.id } });
  const goToProjectCalendar = () =>
    router.push({ name: 'Calendar', params: { id: route.params.id } });

  // Helper functions for converting between local and UTC
  function toLocalInputValue(utcString) {
    const d = new Date(utcString);
    // Adjust for timezone offset
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  }
  function toUTCISOString(localString) {
    // localString: 'YYYY-MM-DDTHH:mm'
    const d = new Date(localString);
    return d.toISOString();
  }

  function openLocationsModal() {
    modalTab.value = 'edit';
    showLocationsModal.value = true;
  }

  return {
    loading,
    error,
    venues,
    stages,
    mainSearch,
    venueSearch,
    stageSearch,
    showLocationsModal,
    selectedVenue,
    newVenueName,
    newVenueCity,
    newVenueCountry,
    editVenueNameValue,
    editVenueCityValue,
    editVenueCountryValue,
    showStageModal,
    activeStage,
    editStageNameValue,
    newStageName,
    filteredStagesMain,
    filteredVenues,
    filteredStagesForSelectedVenue,
    fetchData,
    createVenueWithStage,
    updateVenue,
    promptDeleteVenue,
    createStage,
    openStageModal,
    closeStageModal,
    saveStageEdit,
    promptDeleteStage,
    promptDeleteStageFromVenue,
    moveStage,
    updateStageOrder,
    closeLocationsModal,
    handleVenueChange,
    goToProjectQuickfire,
    goToProjectArtistSchedule,
    goToProjectDocs,
    goToLocationNotes,
    goToSignalMapper,
    goToGear,
    goToStagePictures,
    goToStageDocs,
    goToProjectGear,
    goToProjectCalendar,
    // Per-day hours
    getTodaySlot,
    isStageOpenNow,
    formatSlot,
    formatTime,
    formatDateTime,
    // Modal logic
    showViewAllHoursModal,
    openViewAllHoursModal,
    closeViewAllHoursModal,
    showAddEditSlotModal,
    openAddEditSlotModal,
    closeAddEditSlotModal,
    modalStage,
    allSlotsForModalStage,
    slotForm,
    saveSlot,
    editingSlot,
    deleteSlot,
    modalTab,
    openLocationsModal,
    getStagesForVenue
  };
},
};
</script>

<style scoped>
/* Base Styles - Mobile First */
.project-locations {
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

.section-title {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
  margin: 0 0 16px 0;
  color: #1a1a1a;
}

.subsection-title {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
  margin: 0 0 16px 0;
  color: #1a1a1a;
}

/* Page Header */
.page-header {
  margin-bottom: 16px;
  padding: 12px 16px; /* align with standardized header density */
  background: #f8f9fa;
  border-radius: 12px;
  border: 1px solid #e9ecef;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.header-action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #0066cc;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
}

.header-action-btn:hover {
  background: #0052a3;
  box-shadow: 0 2px 8px rgba(0, 102, 204, 0.2);
}

.header-action-btn:active {
  transform: scale(0.98);
}

.btn-icon {
  font-size: 18px;
}

.btn-text {
  font-size: 16px;
}

/* Loading Skeleton */
.loading-skeleton {
  padding: 16px;
}

.skeleton-header,
.skeleton-quick-access,
.skeleton-stages {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 8px;
  margin-bottom: 16px;
}

.skeleton-header {
  height: 80px;
}

.skeleton-quick-access {
  height: 120px;
}

.skeleton-stages {
  height: 400px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-stage {
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

/* Quick Access Section */
.quick-access-section {
  margin-bottom: 24px;
}

/* Venues & Stages Section */
.venues-stages-section {
  margin-bottom: 24px;
  background: #ffffff;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.venues-stages-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.manage-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
  color: #1a1a1a;
}

.manage-btn:hover {
  background: #e9ecef;
  border-color: #0066cc;
  box-shadow: 0 2px 8px rgba(0, 102, 204, 0.1);
}

.manage-btn:active {
  transform: scale(0.98);
}


.quick-access-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.qa-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 16px;
  background: #ffffff;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 88px;
  text-align: center;
  font-size: 16px;
  font-weight: 500;
  color: #1a1a1a;
}

.qa-tile:hover {
  border-color: #0066cc;
  box-shadow: 0 2px 8px rgba(0, 102, 204, 0.1);
}

.qa-tile:active {
  transform: scale(0.98);
}

.qa-icon {
  font-size: 32px;
  margin-bottom: 8px;
  display: block;
}

.qa-label {
  font-size: 14px;
  line-height: 1.3;
}

/* Stages Section */
.stages-section {
  margin-bottom: 24px;
}

.stages-header {
  margin-bottom: 20px;
}

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  margin-top: 16px;
}

.search-icon {
  position: absolute;
  left: 16px;
  font-size: 18px;
  color: #6c757d;
  z-index: 2;
}

.search-input {
  width: 100%;
  padding: 12px 16px 12px 48px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  font-size: 16px;
  background: #ffffff;
  color: #1a1a1a;
  min-height: 44px;
}

.search-input:focus {
  outline: none;
  border-color: #0066cc;
  box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
}

.stages-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stage-card {
  background: #ffffff;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.stage-card:hover {
  border-color: #0066cc;
  box-shadow: 0 4px 12px rgba(0, 102, 204, 0.15);
  transform: translateY(-2px);
}

.stage-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.stage-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
  line-height: 1.4;
}

.stage-edit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 36px;
  min-width: 36px;
}

.stage-edit-btn:hover {
  background: #e9ecef;
  border-color: #0066cc;
}

.stage-meta {
  margin-bottom: 16px;
}

.venue-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.meta-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
}

.venue-name {
  color: #495057;
  font-size: 16px;
}

/* Stage Availability */
.stage-availability {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.availability-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.availability-status {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-open {
  color: #059669;
  font-weight: 500;
}

.status-closed {
  color: #dc2626;
  font-weight: 500;
}

.availability-time {
  color: #6c757d;
  font-size: 14px;
}

.availability-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #ffffff;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
  color: #1a1a1a;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.availability-btn:hover {
  border-color: #0066cc;
  box-shadow: 0 4px 12px rgba(0, 102, 204, 0.15);
  transform: translateY(-1px);
}

.availability-btn:active {
  transform: scale(0.98);
}

/* Stage Actions */
.stage-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.stage-action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px 12px;
  background: #ffffff;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 72px;
  text-align: center;
  font-size: 14px;
  font-weight: 500;
  color: #1a1a1a;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.stage-action-btn:hover {
  border-color: #0066cc;
  background: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 102, 204, 0.15);
  transform: translateY(-2px);
}

.stage-action-btn:active {
  transform: scale(0.98);
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

.empty-state-button {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  background: #0066cc;
  color: #ffffff;
  border: none;
  border-radius: 12px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 56px;
  box-shadow: 0 4px 12px rgba(0, 102, 204, 0.2);
}

.empty-state-button:hover {
  background: #0052a3;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 102, 204, 0.3);
}

.empty-state-button:active {
  transform: scale(0.98);
}

.empty-state-button .btn-icon {
  font-size: 20px;
  color: #ffffff;
}

.empty-state-button .btn-text {
  font-size: 16px;
  color: #ffffff;
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

.modal-content {
  background: #ffffff;
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
}

.modal {
  background: #ffffff;
  border-radius: 16px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  margin: 20px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 28px 20px 28px;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
  border-radius: 16px 16px 0 0;
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

.modal-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid #e9ecef;
  background: #ffffff;
  padding: 0 8px;
}

.modal-tab {
  flex: 1;
  padding: 20px 24px;
  background: none;
  border: none;
  font-size: 16px;
  font-weight: 500;
  color: #6c757d;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 48px;
  border-bottom: 2px solid transparent;
  margin: 0 4px;
  border-radius: 8px 8px 0 0;
}

.modal-tab:hover {
  color: #0066cc;
  background: #f8f9fa;
}

.modal-tab.active {
  color: #0066cc;
  border-bottom-color: #0066cc;
  background: #f8f9fa;
}

.modal-body {
  padding: 28px;
  background: #ffffff;
}

/* Form Elements */
.modal-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-grid {
  display: grid;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-label {
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 0;
  font-size: 16px;
  line-height: 1.4;
}

.form-input {
  width: 100%;
  padding: 16px 20px;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  font-size: 16px;
  background: #ffffff;
  color: #1a1a1a;
  transition: all 0.2s ease;
  min-height: 48px;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #0066cc;
  box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
}

.form-select {
  width: 100%;
  padding: 16px 20px;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  font-size: 16px;
  background: #ffffff;
  color: #1a1a1a;
  min-height: 48px;
  appearance: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.form-actions {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 8px;
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
  background: #0066cc;
  color: #ffffff !important;
}

.btn-primary:hover {
  background: #0052a3;
  color: #ffffff !important;
  box-shadow: 0 2px 8px rgba(0, 102, 204, 0.2);
}

.btn-secondary {
  background: #f8f9fa;
  color: #1a1a1a !important;
  border: 2px solid #e9ecef;
}

.btn-secondary:hover {
  background: #e9ecef;
  color: #1a1a1a !important;
  border-color: #0066cc;
}

.btn-danger {
  background: #dc3545;
  color: #ffffff !important;
}

.btn-danger:hover {
  background: #c82333;
  color: #ffffff !important;
}

/* Hours Table */
.hours-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
  background: #ffffff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.hours-table th {
  background: #f8f9fa;
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: #1a1a1a;
  border-bottom: 2px solid #e9ecef;
}

.hours-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #e9ecef;
  color: #1a1a1a;
}

.hours-table tr:hover {
  background: #f8f9fa;
}

.actions-cell {
  display: flex;
  gap: 8px;
  align-items: center;
}

.icon-action {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 36px;
  min-width: 36px;
}

.icon-action:hover {
  background: #e9ecef;
  border-color: #0066cc;
}

.icon-action.delete:hover {
  background: #fef2f2;
  border-color: #dc3545;
  color: #dc3545;
}

/* Primary Button */
.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  background: #0066cc;
  color: #ffffff !important;
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

.primary-button:hover {
  background: #0052a3;
  color: #ffffff !important;
  box-shadow: 0 2px 8px rgba(0, 102, 204, 0.2);
  transform: translateY(-1px);
}

.primary-button:active {
  color: #ffffff !important;
  transform: scale(0.98);
}

.secondary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  background: #f8f9fa;
  color: #1a1a1a !important;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
  text-decoration: none;
  box-sizing: border-box;
}

.secondary-button:hover {
  background: #e9ecef;
  color: #1a1a1a !important;
  border-color: #0066cc;
  transform: translateY(-1px);
}

.secondary-button:active {
  color: #1a1a1a !important;
  transform: scale(0.98);
}

/* Link Button */
.link-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #10b981;
  border: 2px solid #10b981;
  color: #ffffff;
  text-decoration: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  padding: 8px 16px;
  margin: 0 8px;
  border-radius: 8px;
  transition: all 0.2s ease;
  min-height: 36px;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
}

.link-btn:hover {
  background: #059669;
  border-color: #059669;
  color: #ffffff;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
}

.link-btn:active {
  transform: scale(0.98);
}

/* Venue Selection */
.venue-selection {
  margin-bottom: 32px;
  padding: 24px;
  background: #f8f9fa;
  border-radius: 12px;
  border: 1px solid #e9ecef;
}

.venue-selection .form-label {
  margin-bottom: 16px;
  font-size: 18px;
  font-weight: 600;
}

/* Venue Editor */
.venue-editor {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.stages-section {
  margin-bottom: 32px;
  padding: 24px;
  background: #f8f9fa;
  border-radius: 12px;
  border: 1px solid #e9ecef;
}

.stages-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.stage-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: #ffffff;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.stage-item:hover {
  border-color: #0066cc;
  box-shadow: 0 2px 8px rgba(0, 102, 204, 0.1);
}

.stage-order {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.order-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  background: #ffffff;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 32px;
  min-width: 32px;
  font-size: 14px;
}

.order-btn:hover:not(:disabled) {
  background: #e9ecef;
  border-color: #0066cc;
}

.order-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stage-name {
  flex: 1;
  font-weight: 500;
  color: #1a1a1a;
}

.stage-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  background: #ffffff;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 36px;
  min-width: 36px;
}

.action-btn:hover {
  background: #e9ecef;
  border-color: #0066cc;
}

.action-btn.delete:hover {
  background: #fef2f2;
  border-color: #dc3545;
  color: #dc3545;
}

.no-stages {
  text-align: center;
  color: #6c757d;
  font-style: italic;
  padding: 20px;
}

.add-stage {
  padding: 24px;
  background: #ffffff;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  margin-top: 16px;
}

.add-stage-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: #1a1a1a;
}

.add-stage-form {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.add-stage-form .form-input {
  flex: 1;
}

/* Venue Details */
.venue-details {
  padding: 24px;
  background: #f8f9fa;
  border-radius: 12px;
  border: 1px solid #e9ecef;
}

.venue-details .form-grid {
  margin-bottom: 24px;
}

/* Danger Zone */
.danger-zone {
  padding: 24px;
  background: #fef2f2;
  border: 1px solid #fed7d7;
  border-radius: 12px;
  margin-top: 24px;
}

.danger-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: #dc2626;
}

.danger-text {
  margin: 0 0 16px 0;
  color: #dc2626;
  font-size: 14px;
  line-height: 1.5;
}

/* Edit Stage Form */
.edit-stage-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.venue-display {
  color: #6c757d;
  font-style: italic;
}

/* Focus States for Accessibility */
.header-action-btn:focus,
.qa-tile:focus,
.stage-edit-btn:focus,
.availability-btn:focus,
.stage-action-btn:focus,
.modal-close:focus,
.modal-tab:focus,
.form-input:focus,
.form-select:focus,
.btn:focus,
.order-btn:focus,
.action-btn:focus,
.empty-state-button:focus,
.manage-btn:focus,
.link-btn:focus {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}

/* Tablet Breakpoint (601px - 1024px) */
@media (min-width: 601px) {
  .project-locations {
    padding: 24px;
  }

  .page-title {
    font-size: 28px;
  }

  .quick-access-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }

  .stage-actions {
    grid-template-columns: repeat(5, 1fr);
    gap: 12px;
  }

  .modal {
    max-width: 600px;
  }

  .form-grid {
    grid-template-columns: 1fr 1fr;
  }

  .add-stage-form {
    flex-direction: row;
    align-items: flex-end;
  }
}

/* Desktop Breakpoint (1025px+) */
@media (min-width: 1025px) {
  .project-locations {
    padding: 32px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .page-title {
    font-size: 32px;
  }

  .stages-grid {
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

/* High Contrast Mode Support */
@media (prefers-contrast: high) {
  .stage-card,
  .qa-tile,
  .btn,
  .form-input,
  .form-select {
    border-width: 2px;
  }
}

/* Reduced Motion Support */
@media (prefers-reduced-motion: reduce) {
  .header-action-btn,
  .qa-tile,
  .stage-edit-btn,
  .availability-btn,
  .stage-action-btn,
  .btn,
  .order-btn,
  .action-btn,
  .empty-state-button,
  .manage-btn {
    transition: none;
  }
  
  .header-action-btn:hover,
  .qa-tile:hover,
  .stage-edit-btn:hover,
  .availability-btn:hover,
  .stage-action-btn:hover,
  .btn:hover,
  .order-btn:hover,
  .action-btn:hover,
  .empty-state-button:hover,
  .manage-btn:hover {
    transform: none;
  }
  
  .header-action-btn:active,
  .qa-tile:active,
  .stage-edit-btn:active,
  .availability-btn:active,
  .stage-action-btn:active,
  .btn:active,
  .order-btn:active,
  .action-btn:active,
  .empty-state-button:active,
  .manage-btn:active {
    transform: none;
  }
}
</style>