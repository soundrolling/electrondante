<template>
<div class="project-locations">
  <!-- ────────── header ────────── -->
  <div class="header-section tight-header">
    <div class="header-title-row center-header-row">
      <h1>Manage Stages</h1>
      <button class="icon-action" @click="openLocationsModal" title="Manage Stages">
        <span class="icon">⚙️</span>
      </button>
    </div>
  </div>

  <!-- ────────── loading / error ────────── -->
  <div v-if="loading" class="loading-indicator">
    <svg
      class="spinner"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8H4z"
      />
    </svg>
    <span class="loading-text">Loading...</span>
  </div>
  <div v-if="error" class="error-message" role="alert">
    <strong>Error:</strong> <span>{{ error }}</span>
  </div>

  <!-- ────────── project-level quick-access ────────── -->
  <div class="project-quick-access" v-if="!loading && !error">
    <h2 class="quick-access-title">Quick Access</h2>
    <div class="quick-access-row">
      <div class="qa-tile" @click="goToProjectArtistSchedule">
        <span class="emoji">📗</span>
        <span class="label">Artist Schedule</span>
      </div>
      <div class="qa-tile" @click="goToProjectDocs">
        <span class="emoji">📂</span>
        <span class="label">All Documents</span>
      </div>
      <div class="qa-tile" @click="goToProjectGear">
        <span class="emoji">🎸</span>
        <span class="label">Project Gear</span>
      </div>
      <div class="qa-tile" @click="goToProjectCalendar">
        <span class="emoji">📅</span>
        <span class="label">Calendar</span>
      </div>
    </div>
  </div>

  <!-- ────────── stage-level quick-access ────────── -->
  <div
    class="stages-quick-access"
    v-if="!loading && !error && filteredStagesMain.length"
  >
    <h2 class="quick-access-title">Your Recording Stages</h2>
    <input
      class="search-input mb-3"
      v-model="mainSearch"
      placeholder="Search by stage or venue…"
    />
    <div class="stage-cards-container">
      <div
        v-for="stage in filteredStagesMain"
        :key="stage.id"
        class="stage-card"
      >
        <div class="stage-header">
          <h3 class="stage-title">
            Stage: {{ stage.stage_name }}
            <button
              class="icon-button"
              @click="openStageModal(stage)"
              :title="`Edit ${stage.stage_name}`"
              aria-label="Edit Stage"
            >
              <span class="emoji">✍️</span>
            </button>
          </h3>
        </div>
        <p class="venue-label">Venue: {{ stage.venue_name }}</p>
        
        <!-- Per-day Stage Hours -->
        <div class="stage-availability">
          <div class="availability-info">
            <span v-if="getTodaySlot(stage.id)">
              <span v-if="isStageOpenNow(stage.id)">🟢 Open now</span>
              Today: {{ formatSlot(getTodaySlot(stage.id)) }}
            </span>
            <span v-else class="no-availability">Closed</span>
          </div>
          <button class="availability-button" @click="openViewAllHoursModal(stage)">
            <span class="icon">🕒</span> Manage Hours
          </button>
        </div>
        <div class="quick-access-grid">
          <div class="qa-tile" @click="goToLocationNotes(stage)">
            <span class="emoji">📝</span><span class="label">Notes</span>
          </div>
          <div class="qa-tile" @click="goToSignalMapper(stage)">
            <span class="emoji">🗺️</span><span class="label">Signal Mapper</span>
          </div>
          <div class="qa-tile" @click="goToGear(stage)">
            <span class="emoji">🎸</span><span class="label">Gear</span>
          </div>
          <div class="qa-tile" @click="goToStagePictures(stage)">
            <span class="emoji">🖼️</span><span class="label">Photos</span>
          </div>
          <div class="qa-tile" @click="goToStageDocs(stage)">
            <span class="emoji">📄</span><span class="label">Documents</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else-if="!loading && !error && !stages.length">
    <p>No stages found. Click <strong>Edit Venues</strong> to create one.</p>
  </div>

  <!-- ────────── Venue Modal ────────── -->
  <transition name="fade">
    <div v-if="showLocationsModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header modal-header-row">
          <h2>Manage Stages</h2>
          <button class="close-button" @click="closeLocationsModal">×</button>
        </div>
        <div class="modal-tabs">
          <button :class="['modal-tab', {active: modalTab==='edit'}]" @click="modalTab='edit'">Edit Venues</button>
          <button :class="['modal-tab', {active: modalTab==='add'}]" @click="modalTab='add'">Add Venue</button>
        </div>
        <div class="modal-body">
          <template v-if="modalTab==='add'">
            <form class="modal-form-grid" @submit.prevent="createVenueWithStage">
              <div class="form-group">
                <label>Venue Name</label>
                <input v-model="newVenueName" placeholder="Enter Venue Name" />
              </div>
              <div class="form-group">
                <label>City</label>
                <input v-model="newVenueCity" placeholder="Enter City" />
              </div>
              <div class="form-group">
                <label>Country</label>
                <input v-model="newVenueCountry" placeholder="Enter Country" />
              </div>
              <div class="form-group">
                <label>First Stage (optional)</label>
                <input v-model="newStageName" placeholder="First Stage Name (optional)" />
              </div>
              <div class="form-actions">
                <button class="primary-button" type="submit">Save Venue</button>
              </div>
            </form>
          </template>
          <template v-else>
            <div class="section-block">
              <label for="venueSelection">
                Select venue to edit, or
                <button class="link-button" type="button" @click="modalTab='add'">create a new one</button>
              </label>
              <select
                id="venueSelection"
                v-model="selectedVenue"
                class="input-field"
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

            <div v-if="selectedVenue && selectedVenue !== 'create'">
              <div class="section-block">
                <h3>Stages in this Venue</h3>

                <table
                  class="stages-table"
                  v-if="filteredStagesForSelectedVenue.length"
                >
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Stage Name</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(s, idx) in filteredStagesForSelectedVenue"
                      :key="s.id"
                    >
                      <td>
                        <button class="icon-action order-btn" @click="moveStage(s.id, -1)" :disabled="idx === 0" :aria-disabled="idx === 0" title="Move Up">
                          <span class="icon">▲</span>
                        </button>
                        <button class="icon-action order-btn" @click="moveStage(s.id, 1)" :disabled="idx === filteredStagesForSelectedVenue.length - 1" :aria-disabled="idx === filteredStagesForSelectedVenue.length - 1" title="Move Down">
                          <span class="icon">▼</span>
                        </button>
                      </td>
                      <td>{{ s.stage_name }}</td>
                      <td>
                        <button class="icon-action" @click="openStageModal(s)" title="Edit"><span class="icon">✏️</span></button>
                        <button class="icon-action delete" @click="promptDeleteStageFromVenue(s.id)" title="Delete"><span class="icon">🗑️</span></button>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p v-else>No stages match your filter.</p>
                <h4 class="mt-2">Add a Stage to This Venue</h4>
                <input v-model="newStageName" placeholder="New Stage Name" />
                <button
                  class="secondary-button"
                  @click="createStage"
                  :disabled="!newStageName"
                >
                  Add Stage
                </button>
              </div>

              <hr />

              <div class="section-block form-container">
                <h3>Edit Venue Details</h3>
                <p>
                  <label>Venue Name:</label>
                  <input v-model="editVenueNameValue" placeholder="New Venue Name" />
                </p>
                <p>
                  <label>City:</label>
                  <input v-model="editVenueCityValue" placeholder="New City" />
                </p>
                <p>
                  <label>Country:</label>
                  <input v-model="editVenueCountryValue" placeholder="New Country" />
                </p>
                <button class="primary-button" @click="updateVenue">
                  Update Venue
                </button>
                <hr />
                <div class="danger-zone">
                  <p class="danger-text">
                    Deleting this venue will permanently remove
                    <strong>all stages</strong> associated with it.<br />
                    <em>This action cannot be undone.</em>
                  </p>
                  <button class="delete-button" @click="promptDeleteVenue">
                    Delete Venue ⚠️
                  </button>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </transition>

  <!-- ────────── Stage Modal ────────── -->
  <transition name="fade">
    <div v-if="showStageModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header modal-header-row">
          <h2>Edit Stage</h2>
          <button class="close-button" @click="closeStageModal">×</button>
        </div>
        <div class="modal-body">
          <form class="edit-stage-form" @submit.prevent="saveStageEdit">
            <div class="form-group">
              <label><strong>Venue:</strong></label>
              <span>{{ activeStage.venue_name }}</span>
            </div>
            <div class="form-group">
              <label>Stage Name</label>
              <input v-model="editStageNameValue" placeholder="New Stage Name" />
            </div>
            <div class="form-actions">
              <button class="delete-button" type="button" @click="promptDeleteStage"><span class="icon" style="margin-right:0.4em;">⚠️</span>Delete Stage</button>
              <button class="secondary-button" type="button" @click="closeStageModal">Cancel</button>
              <button class="primary-button" type="submit">Save</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </transition>

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
    openLocationsModal
  };
},
};
</script>

<style scoped>
.project-locations {
  max-width: 900px;
  margin: 16px auto 0 auto;
  padding: 16px 24px 20px 24px;
  background-color: #f8f9fa;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.07);
  border: 1.5px solid #e5e7eb;
}

.header-section {
  margin-top: 0;
  padding-top: 0;
}
.header-section h1 {
  font-size: 2rem;
  text-align: center;
  margin-bottom: 8px;
  color: #1f2937;
  font-weight: 700;
}
.header-section p {
  text-align: center;
  color: #64748b;
  margin-bottom: 18px;
}

.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 150px;
}
.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #eee;
  border-top: 4px solid #10b981;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.loading-text {
  font-size: 1.2rem;
  color: #10b981;
}

.error-message {
  color: #ef4444;
  margin-bottom: 15px;
  text-align: center;
  padding: 10px;
  background-color: #fef2f2;
  border-radius: 6px;
  border: 1px solid #fecaca;
}
.success-message {
  color: #10b981;
  margin-bottom: 15px;
  text-align: center;
  padding: 10px;
  background-color: #ecfdf5;
  border-radius: 6px;
  border: 1px solid #bbf7d0;
}

.top-actions {
  text-align: center;
  margin: 1.5rem 0 1rem 0;
}
.primary-button, .secondary-button, .edit-button, .delete-button {
  border: none;
  border-radius: 8px;
  padding: 12px 18px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
  margin-top: 0.5rem;
  box-sizing: border-box;
}
.primary-button {
  background: #10b981;
  color: #fff;
}
.primary-button:hover {
  background: #059669;
}
.secondary-button {
  background: #f1f5f9;
  color: #2563eb;
  border: 1.5px solid #cbd5e1;
}
.secondary-button:hover {
  background: #e0e7ef;
  color: #1d4ed8;
  border-color: #3b82f6;
}
.edit-button {
  background: #fbbf24;
  color: #222;
  margin-right: 0.5rem;
}
.edit-button:hover {
  background: #f59e42;
}
.delete-button {
  background: #ef4444;
  color: #fff;
}
.delete-button:hover {
  background: #dc2626;
}

.quick-access-title {
  font-size: 1.3rem;
  text-align: center;
  margin-bottom: 1rem;
  color: #1f2937;
  font-weight: 600;
}
.quick-access-row {
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: nowrap;
}
.quick-access-row .qa-tile {
  flex: 1 1 0;
  min-width: 0;
  max-width: none;
  padding: 0.7rem 0.3rem;
  font-size: 0.97rem;
  white-space: normal;
  text-align: center;
  overflow: hidden;
  border: 2px solid #2563eb;
  border-radius: 8px;
  background: #f1f5f9;
  box-shadow: 0 1px 4px rgba(37,99,235,0.04);
  cursor: pointer;
  transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
}
.quick-access-row .qa-tile:hover {
  border-color: #1d4ed8;
  background: #e0e7ef;
  box-shadow: 0 2px 8px rgba(37,99,235,0.10);
}
.quick-access-row .emoji {
  font-size: 1.2rem;
  margin-bottom: 0.1rem;
  display: block;
}
.quick-access-row .label {
  font-size: 0.97rem;
  display: block;
  overflow: visible;
  white-space: normal;
}

.stage-cards-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.2rem;
}

.stage-card {
  background: #fff;
  border-radius: 10px;
  padding: 1.2rem 1rem 1rem 1rem;
  display: flex;
  flex-direction: column;
  border: 1.5px solid #e5e7eb;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.stage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.stage-title {
  font-size: 1.1rem;
  margin: 0;
  color: #222;
  font-weight: 600;
}
.icon-button {
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 6px;
  padding: 2px 6px;
  transition: background 0.2s;
}
.icon-button .emoji {
  font-size: 1.2rem;
}
.icon-button:hover {
  background: #f1f5f9;
}
.venue-label {
  margin-top: 0.5rem;
  color: #64748b;
  font-size: 0.97rem;
}

.stage-availability {
  margin: 0.75rem 0;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1.5px solid #e5e7eb;
}
.availability-info {
  margin-bottom: 0.5rem;
}
.availability-times {
  color: #10b981;
  font-weight: 500;
  font-size: 0.97rem;
}
.no-availability {
  color: #95a5a6;
  font-style: italic;
  font-size: 0.97rem;
}
.availability-button {
  background: #2563eb;
  color: #fff;
  border: none;
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: background 0.2s;
}
.availability-button:hover {
  background: #1d4ed8;
}

.form-field label {
  font-weight: 600;
  margin-bottom: 0.3rem;
  display: block;
  color: #222;
}
.form-field input,
.form-field select,
.input-field,
.select-field {
  width: 100%;
  padding: 12px 14px;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  background: #fff;
  color: #222;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
  margin-bottom: 0.5rem;
}
.form-field input:focus,
.form-field select:focus,
.input-field:focus,
.select-field:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px #dbeafe;
  outline: none;
}

.days-checkboxes {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}
.day-checkbox {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.9rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

.search-input {
  width: 100%;
  padding: 12px 14px;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  background: #fff;
  color: #222;
  margin-bottom: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.search-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px #dbeafe;
  outline: none;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}
.modal-content {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  padding: 32px 40px 24px 40px;
  min-width: 320px;
  max-width: 95vw;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: stretch;
  max-height: 90vh;
  overflow-y: auto;
}
.modal-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 8px;
  width: 100%;
  gap: 0.5rem;
}
.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  color: #1f2937;
  text-align: center;
}
.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  line-height: 1;
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
  padding: 0.75rem 0 0 0;
  width: 100%;
}

/* Form sections */
.section-block {
  margin-bottom: 1.2rem;
}
.form-container input,
.input-field,
.select-field {
  width: 100%;
  padding: 12px 14px;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  background: #fff;
  color: #222;
  margin-bottom: 0.5rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}
.form-container input:focus,
.input-field:focus,
.select-field:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px #dbeafe;
  outline: none;
}

.danger-zone {
  margin-top: 1rem;
}
.danger-text {
  color: #ef4444;
  font-size: 0.97rem;
}

.stages-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.5rem;
  font-size: 1rem;
}
.stages-table th,
.stages-table td {
  padding: 0.5rem 0.75rem;
  border: 1px solid #e5e7eb;
  text-align: left;
}
.stages-table th {
  background: #f1f5f9;
  color: #222;
  font-weight: 600;
}
.stages-table tr:nth-child(even) td {
  background: #f8fafc;
}
.stages-table td {
  vertical-align: middle;
}
.stages-table td .icon-action {
  font-size: 1.1rem;
  padding: 0.18em 0.38em;
  margin: 0 0.15em 0 0;
  background: none;
  color: #374151;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.18s;
}
.stages-table td .icon-action.delete {
  color: #ef4444;
}
.stages-table td .icon-action:hover {
  background: #f1f5f9;
}
.stages-table td .icon-action.delete:hover {
  background: #ffeaea;
}
.stages-table td .icon {
  font-size: 1.1em;
}
.stages-table td {
  white-space: nowrap;
}

.mt-2 {
  margin-top: 0.5rem;
}
.mt-3 {
  margin-top: 1rem;
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.fade-enter-to,
.fade-leave-from {
  opacity: 1;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .project-locations {
    padding: 12px 2px 18px 2px;
    max-width: 100vw;
  }
  .modal-content {
    min-width: 0;
    padding: 18px 16px 12px 16px;
  }
  .stage-cards-container {
    grid-template-columns: 1fr;
  }
}

.hours-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
  font-size: 1rem;
}
.hours-table th, .hours-table td {
  border: 1px solid #e5e7eb;
  padding: 0.5rem 0.75rem;
  text-align: left;
}
.hours-table th {
  background: #f1f5f9;
  color: #222;
  font-weight: 600;
}
.hours-table tr:nth-child(even) td {
  background: #f8fafc;
}

.actions-cell {
  display: flex;
  gap: 0.5rem;
}
.icon-action {
  background: none;
  color: #2563eb;
  border: none;
  border-radius: 8px;
  padding: 0.4em 0.7em;
  font-size: 1.5rem;
  cursor: pointer;
  margin-left: 0.5rem;
  transition: background 0.18s, color 0.18s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.icon-action:hover {
  background: #f1f5f9;
  color: #1d4ed8;
}
.icon-action.delete:hover {
  background: #ffeaea;
}
.icon {
  font-size: 1.2em;
  vertical-align: middle;
}

@media (max-width: 500px) {
  .quick-access-row {
    gap: 0.2rem;
  }
  .quick-access-row .qa-tile {
    padding: 0.4rem 0.1rem;
    font-size: 0.9rem;
  }
  .quick-access-row .emoji {
    font-size: 1rem;
  }
  .quick-access-row .label {
    font-size: 0.9rem;
  }
}

.quick-access-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}
.qa-tile {
  background: #f1f5f9;
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
  border: 1.5px solid #e5e7eb;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.qa-tile:hover {
  background: #e0e7ef;
}
.qa-tile .emoji {
  font-size: 1.8rem;
  margin-bottom: 0.5rem;
}
.qa-tile .label {
  font-size: 1rem;
  text-align: center;
}

.tight-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.5rem;
  margin-bottom: 1.2rem;
}
.tight-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.icon-action {
  background: none;
  color: #2563eb;
  border: none;
  border-radius: 8px;
  padding: 0.4em 0.7em;
  font-size: 1.5rem;
  cursor: pointer;
  margin-left: 0.5rem;
  transition: background 0.18s, color 0.18s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.icon-action:hover {
  background: #f1f5f9;
  color: #1d4ed8;
}

.modal-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.2rem;
}
.modal-tab {
  background: #f1f5f9;
  color: #2563eb;
  border: none;
  border-radius: 8px 8px 0 0;
  padding: 0.6em 1.2em;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.18s, color 0.18s;
}
.modal-tab.active {
  background: #fff;
  color: #1f2937;
  border-bottom: 2px solid #10b981;
  z-index: 1;
}

.center-header-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 1.2rem;
  width: 100%;
}
.header-title-row h1 {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  text-align: center;
  line-height: 1.1;
}

.modal-header-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 0.5rem;
}
.link-button {
  background: none;
  border: none;
  color: #2563eb;
  text-decoration: underline;
  font-size: 1em;
  cursor: pointer;
  padding: 0;
  margin-left: 0.2em;
}
.link-button:hover {
  color: #1d4ed8;
}
.modal-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem 1.5rem;
  padding: 0.5rem 0.5rem 0.5rem 0.5rem;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
@media (max-width: 600px) {
  .modal-form-grid {
    grid-template-columns: 1fr;
    gap: 0.7rem 0;
    padding: 0.5rem 0.1rem 0.5rem 0.1rem;
  }
}
.form-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.order-btn {
  font-size: 1.1rem;
  padding: 0.15em 0.32em;
  margin: 0 0.08em 0 0;
  background: none;
  color: #374151;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  transition: background 0.18s, color 0.18s;
}
.order-btn[disabled], .order-btn[aria-disabled="true"] {
  color: #cbd5e1;
  cursor: not-allowed;
  background: none;
  opacity: 0.7;
}
.order-btn:hover:not([disabled]):not([aria-disabled="true"]) {
  background: #f1f5f9;
}

.edit-stage-form {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  margin-bottom: 1.2rem;
}
.edit-stage-form .form-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.edit-stage-form label {
  font-weight: 500;
  color: #222;
}
.edit-stage-form input {
  width: 100%;
  padding: 0.7rem;
  font-size: 1rem;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #222;
  margin-top: 0.1rem;
  box-sizing: border-box;
}
.edit-stage-form input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px #dbeafe;
  outline: none;
}
.edit-stage-form .form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.7rem;
  margin-top: 0.5rem;
}
.delete-button {
  background: #ef4444;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 12px 18px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 0.3em;
}
.delete-button:hover {
  background: #dc2626;
}
</style>