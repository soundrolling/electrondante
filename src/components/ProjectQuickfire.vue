<template>
<div class="project-quickfire">
  <!-- ────────── TOP BAR ────────── -->
  <div class="quickfire-topbar">
    <button class="back-button" @click="goBack">← Back</button>
    <h1>Quickfire Buttons</h1>
  </div>

  <!-- ────────── LOADING / ERROR ────────── -->
  <div v-if="isLoading" class="loading-indicator">
    <div class="spinner"></div>
    <span>Loading…</span>
  </div>
  <div v-else-if="error" class="error-message">
    <strong>Error:</strong> {{ error }}
  </div>

  <div v-else>
    <!-- ────────── FILTER ────────── -->
    <div class="filter-container">
      <label for="filterLocation">Filter by Location:</label>
      <select id="filterLocation" v-model="filterLocationId">
        <option :value="null">All Locations</option>
        <option
          v-for="loc in locations"
          :key="loc.id"
          :value="loc.id"
        >
          {{ loc.venue_name }} – {{ loc.stage_name }}
        </option>
      </select>
    </div>

    <!-- ────────── CREATE FORM ────────── -->
    <div class="form-container">
      <h2>Create New Button</h2>
      <form @submit.prevent="addQuickfireButton">
        <div class="form-group">
          <label for="newLocationSelect">Location:</label>
          <select
            id="newLocationSelect"
            v-model="newLocationId"
            required
          >
            <option disabled value="">— choose location —</option>
            <option
              v-for="loc in locations"
              :key="loc.id"
              :value="loc.id"
            >
              {{ loc.venue_name }} – {{ loc.stage_name }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label for="newButtonName">Name:</label>
          <input
            id="newButtonName"
            v-model="newButtonName"
            type="text"
            required
          />
        </div>
        <div class="form-group">
          <label for="newButtonColor">Color:</label>
          <select
            id="newButtonColor"
            v-model="newButtonColor"
            required
          >
            <option disabled value="">— choose color —</option>
            <option
              v-for="c in colorOptions"
              :key="c.value"
              :value="c.value"
            >
              {{ c.name }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label for="newButtonNote">Note:</label>
          <input
            id="newButtonNote"
            v-model="newButtonNote"
            type="text"
            required
          />
        </div>
        <button
          type="submit"
          class="primary-button"
          :disabled="isSubmitting"
        >
          {{ isSubmitting ? 'Creating…' : 'Create' }}
        </button>
      </form>
    </div>

    <!-- ────────── EDIT FORM ────────── -->
    <div
      v-if="editingIndex !== null"
      class="edit-form"
    >
      <h2>Edit Button</h2>
      <form @submit.prevent="updateQuickfireButton">
        <div class="form-group">
          <label for="editLocationSelect">Location:</label>
          <select
            id="editLocationSelect"
            v-model="editLocationId"
            required
          >
            <option disabled value="">— choose location —</option>
            <option
              v-for="loc in locations"
              :key="loc.id"
              :value="loc.id"
            >
              {{ loc.venue_name }} – {{ loc.stage_name }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label for="editButtonName">Name:</label>
          <input
            id="editButtonName"
            v-model="editButtonName"
            type="text"
            required
          />
        </div>
        <div class="form-group">
          <label for="editButtonColor">Color:</label>
          <select
            id="editButtonColor"
            v-model="editButtonColor"
            required
          >
            <option disabled value="">— choose color —</option>
            <option
              v-for="c in colorOptions"
              :key="c.value"
              :value="c.value"
            >
              {{ c.name }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label for="editButtonNote">Note:</label>
          <input
            id="editButtonNote"
            v-model="editButtonNote"
            type="text"
            required
          />
        </div>
        <div class="form-actions">
          <button
            type="submit"
            class="primary-button"
            :disabled="isSubmitting"
          >
            {{ isSubmitting ? 'Updating…' : 'Update' }}
          </button>
          <button
            type="button"
            class="secondary-button"
            @click="cancelEdit"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>

    <!-- ────────── TABLE ────────── -->
    <div
      v-if="filteredButtons.length"
      class="quickfire-table"
    >
      <h2>Configured Buttons</h2>
      <table>
        <thead>
          <tr>
            <th>Location</th>
            <th>Name</th>
            <th>Note</th>
            <th>Color</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(btn, idx) in filteredButtons"
            :key="btn.id"
          >
            <td>{{ locMap[btn.location_id] }}</td>
            <td>{{ btn.name }}</td>
            <td>{{ btn.note }}</td>
            <td>
              <span
                class="color-chip"
                :style="{
                  backgroundColor: btn.color,
                  color: getTextColor(btn.color)
                }"
              >{{ getColorName(btn.color) }}</span>
            </td>
            <td>
              <button
                class="edit-button"
                @click="startEdit(btn, idx)"
              >Edit</button>
              <button
                class="delete-button"
                @click="confirmDelete(btn.id, idx)"
              >Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div
      v-else
      class="no-buttons"
    >
      <p>No buttons found for this filter.</p>
    </div>
  </div>
</div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '../supabase';
import { useUserStore } from '../stores/userStore';

export default {
name: 'ProjectQuickfire',
setup() {
  const router = useRouter();
  const userStore = useUserStore();
  const projectId = computed(() => userStore.getCurrentProject?.id);

  // UI state
  const isLoading = ref(false);
  const error = ref(null);
  const isSubmitting = ref(false);

  // Data
  const locations = ref([]);
  const quickfireButtons = ref([]);

  // Filter
  const filterLocationId = ref(null);

  // Create form
  const newLocationId = ref('');
  const newButtonName = ref('');
  const newButtonColor = ref('');
  const newButtonNote = ref('');

  // Edit form
  const editingIndex = ref(null);
  const editId = ref(null);
  const editLocationId = ref('');
  const editButtonName = ref('');
  const editButtonColor = ref('');
  const editButtonNote = ref('');

  const colorOptions = [
    { name: 'Red', value: '#ff0000' },
    { name: 'Blue', value: '#0000ff' },
    { name: 'Green', value: '#00ff00' },
    { name: 'Yellow', value: '#ffff00' },
    { name: 'Black', value: '#000000' },
    { name: 'White', value: '#ffffff' },
  ];

  // Map for lookup
  const locMap = computed(() =>
    locations.value.reduce((m, loc) => {
      m[loc.id] = `${loc.venue_name} – ${loc.stage_name}`;
      return m;
    }, {})
  );

  // Filtered list
  const filteredButtons = computed(() =>
    filterLocationId.value
      ? quickfireButtons.value.filter(
          b => b.location_id === filterLocationId.value
        )
      : quickfireButtons.value
  );

  // Fetch locations
  async function fetchLocations() {
    if (!projectId.value) return;
    const { data, error: e } = await supabase
      .from('locations')
      .select('id,venue_name,stage_name')
      .eq('project_id', projectId.value)
      .order('venue_name', { ascending: true });
    if (e) error.value = e.message;
    else locations.value = data;
  }

  // Fetch all buttons
  async function fetchButtons() {
    if (!projectId.value) return;
    isLoading.value = true;
    const { data, error: e } = await supabase
      .from('quickfire_buttons')
      .select('*')
      .eq('project_id', projectId.value)
      .order('location_id', { ascending: true });
    isLoading.value = false;
    if (e) error.value = e.message;
    else quickfireButtons.value = data;
  }

  // Create
  async function addQuickfireButton() {
    if (!newLocationId.value) return;
    isSubmitting.value = true;
    const payload = {
      project_id: projectId.value,
      location_id: newLocationId.value,
      name: newButtonName.value,
      color: newButtonColor.value,
      note: newButtonNote.value,
    };
    const { error: e } = await supabase
      .from('quickfire_buttons')
      .insert([payload]);
    isSubmitting.value = false;
    if (e) error.value = e.message;
    else {
      await fetchButtons();
      newLocationId.value = '';
      newButtonName.value = '';
      newButtonColor.value = '';
      newButtonNote.value = '';
    }
  }

  // Start edit
  function startEdit(btn, idx) {
    editingIndex.value = idx;
    editId.value = btn.id;
    editLocationId.value = btn.location_id;
    editButtonName.value = btn.name;
    editButtonColor.value = btn.color;
    editButtonNote.value = btn.note;
  }

  // Update
  async function updateQuickfireButton() {
    isSubmitting.value = true;
    const updates = {
      project_id: projectId.value,
      location_id: editLocationId.value,
      name: editButtonName.value,
      color: editButtonColor.value,
      note: editButtonNote.value,
    };
    const { error: e } = await supabase
      .from('quickfire_buttons')
      .update(updates)
      .eq('id', editId.value);
    isSubmitting.value = false;
    if (e) error.value = e.message;
    else {
      editingIndex.value = null;
      await fetchButtons();
    }
  }

  function cancelEdit() {
    editingIndex.value = null;
  }

  // Delete
  async function confirmDelete(id, idx) {
    if (!confirm('Delete this button?')) return;
    const { error: e } = await supabase
      .from('quickfire_buttons')
      .delete()
      .eq('id', id);
    if (e) error.value = e.message;
    else quickfireButtons.value.splice(idx, 1);
  }

  // Utilities
  function getTextColor(bg) {
    const c = bg.replace('#','');
    const r = parseInt(c.substr(0,2),16),
          g = parseInt(c.substr(2,2),16),
          b = parseInt(c.substr(4,2),16);
    const brightness = (r*299 + g*587 + b*114)/1000;
    return brightness < 128 ? '#fff' : '#000';
  }
  function getColorName(val) {
    const o = colorOptions.find(c=>c.value===val);
    return o ? o.name : val;
  }

  function goBack() {
    router.back();
  }

  onMounted(async () => {
    await fetchLocations();
    await fetchButtons();
  });

  return {
    isLoading, error, isSubmitting,
    locations, quickfireButtons, locMap,
    filterLocationId, filteredButtons,
    newLocationId, newButtonName, newButtonColor, newButtonNote,
    editingIndex, editLocationId, editButtonName, editButtonColor, editButtonNote,
    colorOptions,
    addQuickfireButton, startEdit, updateQuickfireButton,
    cancelEdit, confirmDelete,
    getTextColor, getColorName, goBack
  };
}
};
</script>

<style scoped>
.project-quickfire {
max-width: 900px;
margin: 0 auto;
padding: 20px;
font-family: sans-serif;
}

/* TOP BAR */
.quickfire-topbar {
display: flex;
align-items: center;
gap: 1rem;
margin-bottom: 1rem;
}
.back-button {
background: #6c757d;
color: #fff;
padding: 6px 12px;
border: none;
border-radius: 4px;
cursor: pointer;
}
.back-button:hover { background: #5a6268; }
.quickfire-topbar h1 {
margin: 0;
font-size: 1.4rem;
}

/* LOADING / ERROR */
.loading-indicator,
.error-message {
text-align: center;
padding: 15px;
border-radius: 4px;
margin-bottom: 20px;
}
.loading-indicator .spinner {
border: 3px solid #f3f3f3;
border-top: 3px solid #007bff;
border-radius: 50%;
width: 24px;
height: 24px;
animation: spin 1s linear infinite;
margin: 0 auto 8px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.error-message {
background: #f8d7da;
color: #721c24;
}

/* FILTER */
.filter-container {
margin-bottom: 20px;
display: flex;
align-items: center;
gap: 10px;
}
.filter-container select {
padding: 6px;
border: 1px solid #ccc;
border-radius: 4px;
}

/* FORMS */
.form-container,
.edit-form {
background: #f8f9fa;
padding: 20px;
border-radius: 6px;
margin-bottom: 30px;
}
.form-group {
margin-bottom: 15px;
}
.form-group label {
display: block;
margin-bottom: 6px;
}
.form-group input,
.form-group select {
width: 100%;
padding: 8px;
border: 1px solid #ccd0d5;
border-radius: 4px;
}
.primary-button,
.secondary-button,
.edit-button,
.delete-button {
padding: 8px 14px;
border: none;
border-radius: 4px;
cursor: pointer;
font-size: 0.95rem;
margin-right: 6px;
}
.primary-button {
background: #007bff;
color: #fff;
}
.primary-button:hover {
background: #0056b3;
}
.secondary-button {
background: #6c757d;
color: #fff;
}
.secondary-button:hover {
background: #5a6268;
}
.edit-button {
background: #ffc107;
color: #212529;
}
.edit-button:hover {
background: #e0a800;
}
.delete-button {
background: #dc3545;
color: #fff;
}
.delete-button:hover {
background: #c82333;
}
.form-actions {
text-align: right;
}

/* TABLE */
.quickfire-table table {
width: 100%;
border-collapse: collapse;
}
.quickfire-table th,
.quickfire-table td {
border: 1px solid #dee2e6;
padding: 10px;
}
.quickfire-table th {
background: #e9ecef;
}
.color-chip {
padding: 4px 8px;
border-radius: 4px;
}

/* NO BUTTONS */
.no-buttons {
text-align: center;
color: #6c757d;
}
</style>