<!-- src/components/ProjectContacts.vue -->
<template>
<div class="project-contacts-container">
  
  <!-- Global header handles navigation -->

  <!-- Main Content -->
  <div class="main-content">
    <!-- Header Section -->
    <div class="page-header">
      <div class="header-content">
        <h2 class="page-title-small">Project Contacts</h2>
        <p class="page-subtitle-small">Manage your project team and external contacts</p>
      </div>
    </div>

    <div class="filter-section">
      <div class="filter-controls">
        <div class="search-control">
          <label for="searchFilter" class="filter-label">Search</label>
          <div class="search-input-wrapper">
            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              id="searchFilter"
              v-model="searchFilter"
              type="text"
              placeholder="Search by name or email..."
              class="search-input"
            />
          </div>
        </div>
        <div class="filter-row">
          <div class="filter-control" style="flex:1;">
            <label for="roleFilter" class="filter-label">Role</label>
            <select id="roleFilter" v-model="roleFilter" class="filter-select">
              <option value="All">All Roles</option>
              <option
                v-for="p in PRESET_ROLES"
                :key="p"
                :value="p"
              >{{ p }}</option>
              <option value="Other/Custom">Other / Custom</option>
            </select>
          </div>
          <div class="filter-control" style="flex:1;">
            <label for="stageLocationFilter" class="filter-label">Stage Location</label>
            <select id="stageLocationFilter" v-model="stageLocationFilter" class="filter-select">
              <option value="All">All Locations</option>
              <option value="No Location">No Location</option>
              <option v-for="loc in projectStageLocations" :key="loc.id" :value="loc.stage_name">
                {{ loc.stage_name }}
              </option>
            </select>
          </div>
        </div>
      </div>
      <div class="contact-count-row">
        <div class="contact-count">
          {{ filteredContacts.length }} contact{{ filteredContacts.length !== 1 ? 's' : '' }}
        </div>
        <button @click="toggleAddContact" class="btn btn-positive add-contact-square" title="Add Contact">
          <span class="icon-text">+</span>
        </button>
      </div>
    </div>

    <!-- Contact Cards -->
    <div class="contacts-section">
      <!-- Loading State -->
      <div v-if="loadingContacts" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading contacts...</p>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="filteredContacts.length === 0"
        class="empty-state"
      >
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <h3>No contacts found</h3>
        <p>{{ roleFilter === 'All' ? 'Add your first contact to get started.' : `No contacts found for ${roleFilter} role.` }}</p>
        <button @click="toggleAddContact" class="btn btn-positive empty-state-btn">
          Add Your First Contact
        </button>
      </div>

      <!-- Contacts List (Flex Layout) -->
      <div class="contacts-list-container">
        <div
          v-for="contact in filteredContacts"
          :key="contact.id"
          class="contact-list-row"
        >
          <div class="contact-avatar" @click="openContactInfo(contact)" style="cursor:pointer;">
            {{ (contact.name || contact.email || '?').charAt(0).toUpperCase() }}
          </div>
          <div class="contact-list-details">
            <div class="contact-name">{{ contact.name || 'Unnamed Contact' }}</div>
            <div v-if="contact.role" class="contact-role">{{ displayRole(contact.role) }}</div>
            <div v-if="contact.stage_location" class="contact-location">{{ contact.stage_location }}</div>
            <!-- Desktop-only contact details -->
            <div v-if="contact.email" class="contact-email desktop-only">
              <span>{{ contact.email }}</span>
              <button 
                class="copy-btn" 
                @click="copyToClipboard(contact.email)"
                title="Copy email"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
            </div>
            <div v-if="contact.phone" class="contact-phone desktop-only">
              <span>{{ contact.phone }}</span>
              <button 
                class="copy-btn" 
                @click="copyToClipboard(contact.phone)"
                title="Copy phone"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="contact-actions-group" style="display:flex;align-items:center;gap:4px;margin-left:auto;">
            <button
              v-if="canManageProject"
              class="btn action-btn edit-btn"
              @click="startEdit(contact)"
              title="Edit or delete contact"
            >
              ✏️
            </button>
            <button
              class="btn btn-primary action-btn view-btn"
              @click="openContactInfo(contact)"
              title="View contact details"
            >
              ℹ️
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Edit Contact Modal -->
  <div
    v-if="showEditModal"
    class="modal-overlay"
    @click.self="closeEditModal"
  >
    <div class="modal-content">
      <div class="modal-header">
        <h2 class="modal-title">Edit Contact</h2>
        <button class="modal-close" @click="closeEditModal">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Name</label>
          <input v-model="editingFields.name" class="form-input" placeholder="Contact name"/>
        </div>

        <div class="form-group">
          <label class="form-label">Role</label>
          <select v-model="editingFields.role_select" class="form-select">
            <option
              v-for="p in PRESET_ROLES"
              :key="p"
              :value="p"
            >{{ p }}</option>
            <option value="__custom__">Other / custom…</option>
          </select>
          <input
            v-if="editingFields.role_select === '__custom__'"
            v-model="editingFields.role_custom_hint"
            class="form-input"
            placeholder="Custom role…"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Email</label>
          <input v-model="editingFields.email" class="form-input" placeholder="Email address"/>
        </div>

        <div class="form-group">
          <label class="form-label">Phone</label>
          <input v-model="editingFields.phone" class="form-input" placeholder="Phone number"/>
        </div>

        <div class="form-group">
          <label class="form-label">Comments</label>
          <textarea
            v-model="editingFields.comments"
            rows="3"
            class="form-textarea"
            placeholder="Additional notes…"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Stage Assignments</label>
          <select v-model="editingFields.stage_ids" class="form-select" multiple>
            <option v-for="loc in projectStageLocations" :key="loc.id" :value="loc.id">
              {{ loc.stage_name }}
            </option>
          </select>
        </div>
      </div>

      <div class="modal-footer">
        <button
          class="btn btn-positive"
          @click="saveContact"
          :disabled="saving"
        >
          <svg v-if="saving" class="spinner" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.416" stroke-dashoffset="31.416">
              <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
              <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/>
            </circle>
          </svg>
          {{ saving ? 'Saving...' : 'Save Changes' }}
        </button>
        <button class="btn btn-warning" @click="closeEditModal">Cancel</button>
      </div>
    </div>
  </div>

  <!-- Add Contact Modal -->
  <div
    v-if="showAddContact"
    class="modal-overlay"
    @click.self="toggleAddContact"
  >
    <div class="modal-content">
      <div class="modal-header">
        <h2 class="modal-title">Add New Contact</h2>
        <button class="modal-close" @click="toggleAddContact">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Add from existing member (optional)</label>
          <select
            v-model="selectedUserId"
            @change="prefillFromProfile"
            class="form-select"
          >
            <option value="">— New person (manual entry) —</option>
            <option
              v-for="u in memberProfiles"
              :key="u.user_email"
              :value="u.user_id"
            >
              {{ u.full_name || u.user_email }} ({{ u.role }})
            </option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Name</label>
          <input
            v-model="newContactName"
            placeholder="Contact name"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Email</label>
          <input
            v-model="newContactEmail"
            placeholder="Email address"
            type="email"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Phone</label>
          <input
            v-model="newContactPhone"
            placeholder="Phone number"
            type="tel"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Role</label>
          <select v-model="newContactRoleSelect" class="form-select">
            <option disabled value="">Select role…</option>
            <option
              v-for="p in PRESET_ROLES"
              :key="p"
              :value="p"
            >{{ p }}</option>
            <option value="__custom__">Other / custom…</option>
          </select>
          <input
            v-if="newContactRoleSelect === '__custom__'"
            v-model="newContactRoleCustom"
            placeholder="Custom role…"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Stage Locations</label>
          <div class="checkbox-list">
            <label
              v-for="loc in projectStageLocations"
              :key="loc.id"
              class="checkbox-item"
              style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;"
            >
              <input
                type="checkbox"
                :value="loc.id"
                v-model="newContactStageIds"
                style="accent-color: #3b82f6;"
              />
              <span>{{ loc.stage_name }}</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Comments</label>
          <textarea
            v-model="newContactComments"
            placeholder="Additional notes…"
            rows="3"
            class="form-textarea"
          />
        </div>
      </div>

      <div class="modal-footer">
        <button
          class="btn btn-positive"
          @click="addContact"
          :disabled="addingContact"
        >
          <svg v-if="addingContact" class="spinner" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.416" stroke-dashoffset="31.416">
              <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
              <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/>
            </circle>
          </svg>
          {{ addingContact ? 'Adding...' : 'Add Contact' }}
        </button>
        <button class="btn btn-warning" @click="toggleAddContact">Cancel</button>
      </div>
    </div>
  </div>

  <!-- Contact Info Modal -->
  <div v-if="showContactInfoModal" class="modal-overlay" @click.self="closeContactInfo">
    <div class="modal-content">
      <div class="modal-header">
        <h2 class="modal-title">Contact Details</h2>
        <button class="modal-close" @click="closeContactInfo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="contact-info-display">
          <div class="contact-header">
            <div class="contact-avatar-large">
              {{ (selectedContact?.name || selectedContact?.email || '?').charAt(0).toUpperCase() }}
            </div>
            <div class="contact-details-large">
              <h3 class="contact-name-large">{{ selectedContact?.name || 'Unnamed Contact' }}</h3>
            </div>
          </div>
          <div class="contact-info-list">
            <div class="info-row">
              <span class="info-label">Role:</span>
              <span class="info-value">{{ displayRole(selectedContact?.role) || 'Not set' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Stage Location:</span>
              <span class="info-value">{{ selectedContact?.stage_location || 'Not set' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Email:</span>
              <span v-if="selectedContact?.email" class="info-value-with-copy">
                <a :href="`mailto:${selectedContact.email}`" class="info-value link">{{ selectedContact.email }}</a>
                <button 
                  @click="copyToClipboard(selectedContact.email, 'Email')" 
                  class="copy-btn" 
                  title="Copy email to clipboard"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              </span>
              <span v-else class="info-value muted">Not set</span>
            </div>
            <div class="info-row">
              <span class="info-label">Phone:</span>
              <span v-if="selectedContact?.phone" class="info-value-with-copy">
                <a :href="`tel:${selectedContact.phone}`" class="info-value link">{{ selectedContact.phone }}</a>
                <button 
                  @click="copyToClipboard(selectedContact.phone, 'Phone')" 
                  class="copy-btn" 
                  title="Copy phone to clipboard"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              </span>
              <span v-else class="info-value muted">Not set</span>
            </div>
            <div class="info-row">
              <span class="info-label">Notes:</span>
              <span class="info-value">{{ selectedContact?.comments || 'Not set' }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-warning" @click="closeContactInfo">Close</button>
      </div>
    </div>
  </div>
</div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '../supabase';
import { useUserStore } from '../stores/userStore';
import ProjectBreadcrumbs from '@/components/ProjectBreadcrumbs.vue';

const PRESET_ROLES = ['Spatial Crew', 'FOH Crew', 'Production', 'Rentals', 'Key People'];
const projectStageLocations = ref([]);
const stageLocationFilter = ref('All');

export default {
components: { ProjectBreadcrumbs },
setup() {
const route = useRoute();
const router = useRouter();
const store = useUserStore();
const currentProject = computed(() => store.getCurrentProject);

const canManageProject = ref(false);
async function checkUserRole() {
  const { data: ses } = await supabase.auth.getSession();
  const email = ses?.session?.user?.email?.toLowerCase();
  if (!email) return;
  const { data } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', currentProject.value.id)
    .eq('user_email', email)
    .single();
  canManageProject.value = ['owner', 'admin'].includes(data?.role);
}

const contacts = ref([]);
const loadingContacts = ref(false);
async function fetchContacts() {
  if (!currentProject.value?.id) return;
  loadingContacts.value = true;
  const { data } = await supabase
    .from('project_contacts')
    .select('*')
    .eq('project_id', currentProject.value.id);
  
  // Process contacts to populate stage_location from stage_ids
  const processedContacts = (data || []).map(contact => {
    if (contact.stage_ids && contact.stage_ids.length > 0) {
      // Find the stage names for the assigned stage IDs
      const stageNames = contact.stage_ids.map(stageId => {
        const location = projectStageLocations.value.find(loc => loc.id === stageId);
        return location ? location.stage_name : null;
      }).filter(Boolean);
      
      // Set stage_location to the first stage name, or comma-separated list if multiple
      contact.stage_location = stageNames.length > 0 ? stageNames.join(', ') : null;
    } else {
      contact.stage_location = null;
    }
    return contact;
  });
  
  contacts.value = processedContacts;
  loadingContacts.value = false;
}

const memberProfiles = ref([]);
const loadingMembers = ref(false);
async function fetchMemberProfiles() {
  if (!currentProject.value?.id) return;
  loadingMembers.value = true;
  const { data: memberRows } = await supabase
    .from('project_members')
    .select('user_id, user_email, role')
    .eq('project_id', currentProject.value.id);
  const members = memberRows ?? [];
  const ids = members.map(m => m.user_id).filter(Boolean);
  let profiles = [];
  if (ids.length) {
    const { data } = await supabase
      .from('user_profiles')
      .select('user_id, full_name, phone')
      .in('user_id', ids);
    profiles = data ?? [];
  }
  memberProfiles.value = members.map(m => {
    const p = profiles.find(x => x.user_id === m.user_id) || {};
    return { ...m, full_name: p.full_name, phone: p.phone };
  });
  loadingMembers.value = false;
}

const roleFilter = ref('All');
const searchFilter = ref('');

const filteredContacts = computed(() => {
  let filtered = contacts.value;
  
  // Apply search filter
  if (searchFilter.value.trim()) {
    const searchTerm = searchFilter.value.toLowerCase().trim();
    filtered = filtered.filter(contact => 
      (contact.name && contact.name.toLowerCase().includes(searchTerm)) ||
      (contact.email && contact.email.toLowerCase().includes(searchTerm))
    );
  }
  
  // Apply role filter
  if (roleFilter.value !== 'All') {
    filtered = filtered.filter(c =>
      roleFilter.value === 'Other/Custom'
        ? !PRESET_ROLES.includes(c.role)
        : c.role === roleFilter.value
    );
  }
  
  // Apply stage location filter
  if (stageLocationFilter.value === 'No Location') {
    filtered = filtered.filter(c => !c.stage_location);
  } else if (stageLocationFilter.value !== 'All') {
    filtered = filtered.filter(c => c.stage_location === stageLocationFilter.value);
  }
  
  return filtered;
});

const showAddContact = ref(false);
const toggleAddContact = () => (showAddContact.value = !showAddContact.value);

const selectedUserId = ref('');
const newContactName = ref('');
const newContactEmail = ref('');
const newContactPhone = ref('');
const newContactRoleSelect = ref('');
const newContactRoleCustom = ref('');
const newContactComments = ref('');
const newContactStageIds = ref([]);
const newContactStageLocation = ref('');
const addingContact = ref(false);

const resolveRole = (sel, custom) =>
  sel === '__custom__' ? custom.trim() || 'Other' : sel;

function prefillFromProfile() {
  const u = memberProfiles.value.find(x => x.user_id === selectedUserId.value);
  if (!u) {
    newContactName.value = '';
    newContactEmail.value = '';
    newContactPhone.value = '';
    newContactRoleSelect.value = '';
    newContactRoleCustom.value = '';
    newContactStageIds.value = [];
    newContactStageLocation.value = '';
    return;
  }
  newContactName.value = u.full_name ?? '';
  newContactEmail.value = u.user_email ?? '';
  newContactPhone.value = u.phone ?? '';
  if (PRESET_ROLES.includes(u.role)) {
    newContactRoleSelect.value = u.role;
    newContactRoleCustom.value = '';
  } else {
    newContactRoleSelect.value = '__custom__';
    newContactRoleCustom.value = u.role;
  }
  if (PRESET_ROLES.includes(u.role)) {
    newContactStageIds.value = [u.role];
  }
  newContactStageLocation.value = '';
}

async function addContact() {
  if (!currentProject.value?.id) {
    return alert('Project is required.');
  }
  
  // Require at least name or email for contact identification
  if (!newContactName.value.trim() && !newContactEmail.value.trim()) {
    return alert('Please provide at least a name or email address.');
  }
  addingContact.value = true;
  try {
    const payload = {
      project_id: currentProject.value.id,
      name: newContactName.value.trim() || null,
      email: newContactEmail.value.trim() || null,
      phone: newContactPhone.value.trim() || null,
      role: resolveRole(newContactRoleSelect.value, newContactRoleCustom.value),
      comments: newContactComments.value.trim() || null,
      stage_ids: newContactStageIds.value.length ? newContactStageIds.value : null,
    };
    await supabase.from('project_contacts').insert(payload).throwOnError();
    await fetchContacts();
    selectedUserId.value =
      newContactName.value =
      newContactEmail.value =
      newContactPhone.value =
      newContactRoleSelect.value =
      newContactRoleCustom.value =
      newContactComments.value = '';
    newContactStageIds.value = [];
    toggleAddContact();
  } finally {
    addingContact.value = false;
  }
}

const editingContactId = ref(null);
const editingFields = ref({
  name: '',
  role_select: '',
  role_custom_hint: '',
  email: '',
  phone: '',
  comments: '',
  stage_ids: [],
});
const saving = ref(false);

function startEdit(contact) {
  const preset = PRESET_ROLES.includes(contact.role);
  editingContactId.value = contact.id;
  editingFields.value = {
    name: contact.name || '',
    role_select: preset ? contact.role : '__custom__',
    role_custom_hint: preset ? '' : contact.role,
    email: contact.email || '',
    phone: contact.phone || '',
    comments: contact.comments || '',
    stage_ids: contact.stage_ids || [],
  };
  showEditModal.value = true;
}

const closeEditModal = () => {
  showEditModal.value = false;
  editingContactId.value = null;
};

async function saveContact() {
  if (!editingContactId.value) return;
  saving.value = true;
  try {
    const f = editingFields.value;
    const upd = {
      name: f.name.trim() || null,
      role: resolveRole(f.role_select, f.role_custom_hint),
      email: f.email.trim() || null,
      phone: f.phone.trim() || null,
      comments: f.comments.trim() || null,
      stage_ids: f.stage_ids,
    };
    await supabase.from('project_contacts').update(upd).eq('id', editingContactId.value).throwOnError();
    
    // Refresh contacts to update stage_location display
    await fetchContacts();
    closeEditModal();
  } finally {
    saving.value = false;
  }
}

const showEditModal = ref(false);

const displayRole = r => (PRESET_ROLES.includes(r) ? r : r || 'N/A');
const goBackToDashboard = () => router.back();

async function removeContact(id) {
  if (!confirm('Remove this contact?')) return;
  await supabase.from('project_contacts').delete().eq('id', id);
  contacts.value = contacts.value.filter(c => c.id !== id);
  // If the deleted contact is being edited, close the modal
  if (editingContactId.value === id) {
    closeEditModal();
  }
}

const showContactInfoModal = ref(false);
const selectedContact = ref(null);

function openContactInfo(contact) {
  selectedContact.value = contact;
  showContactInfoModal.value = true;
}

function closeContactInfo() {
  showContactInfoModal.value = false;
  selectedContact.value = null;
}

// Copy to clipboard functionality
async function copyToClipboard(text, type) {
  try {
    await navigator.clipboard.writeText(text);
    // You could add a toast notification here if you have a toast system
    console.log(`${type} copied to clipboard: ${text}`);
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
}

async function fetchProjectStageLocations() {
  if (!currentProject.value?.id) return;
  const { data } = await supabase
    .from('locations')
    .select('id, stage_name')
    .eq('project_id', currentProject.value.id);
  projectStageLocations.value = data || [];
}

async function boot() {
  if (!currentProject.value?.id) {
    const pid = route.params.id;
    if (pid) await store.fetchProjectById(pid);
  }
  if (currentProject.value?.id) {
    // Fetch stage locations first, then contacts (which depends on stage locations)
    await fetchProjectStageLocations();
    await Promise.all([
      fetchContacts(),
      fetchMemberProfiles(),
      checkUserRole()
    ]);
  }
}
onMounted(() => {
  boot();
  if (route.query.stage) {
    stageLocationFilter.value = route.query.stage;
  }
});
watch(() => currentProject.value?.id, (n, o) => {
  if (n && n !== o) {
    boot();
    fetchProjectStageLocations();
  }
});
// Add watcher for route.query.stage
watch(
  () => route.query.stage,
  (newStage) => {
    if (newStage) {
      stageLocationFilter.value = newStage;
    }
  }
);

return {
  PRESET_ROLES,
  roleFilter,
  searchFilter,
  stageLocationFilter,
  filteredContacts,
  loadingContacts,

  memberProfiles,
  showAddContact,
  toggleAddContact,

  selectedUserId,
  newContactName,
  newContactEmail,
  newContactPhone,
  newContactRoleSelect,
  newContactRoleCustom,
  newContactComments,
  newContactStageIds,
  newContactStageLocation,
  addingContact,
  addContact,
  prefillFromProfile,

  editingContactId,
  editingFields,
  saving,
  startEdit,
  closeEditModal,
  saveContact,

  canManageProject,
  removeContact,
  displayRole,
  goBackToDashboard,

  showEditModal,
  showContactInfoModal,
  selectedContact,
  openContactInfo,
  closeContactInfo,
  copyToClipboard,

  projectStageLocations,
};
}
};
</script>

<style scoped>
.project-contacts-container {
max-width: 1200px;
margin: 0 auto;
padding: 24px;
background-color: #fafafa;
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
min-height: 100vh;
}

/* Header */
.header-bar {
margin-bottom: 24px;
}

.back-button {
display: inline-flex;
align-items: center;
justify-content: center;
min-height: 44px;
padding: 12px 20px;
font-size: 1rem;
border-radius: 8px;
background-color: #fff;
color: #374151;
border: 1px solid #e5e7eb;
cursor: pointer;
transition: all 0.2s ease;
font-weight: 500;
box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.back-button:hover {
background-color: #f9fafb;
border-color: #d1d5db;
transform: translateY(-1px);
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.back-icon {
width: 20px;
height: 20px;
margin-right: 8px;
}

/* Main Content */
.main-content {
background: #fff;
border-radius: 12px;
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
overflow: hidden;
}

/* Header Section */
.page-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px 24px;
  background: #fff;
  border-bottom: 1px solid #f3f4f6;
  min-height: 64px;
}

.header-content {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.add-contact-fab {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background-color: #22c55e;
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
}

.add-contact-fab:hover {
  background-color: #16a34a;
  box-shadow: 0 4px 16px rgba(34,197,94,0.18);
}

.add-contact-fab .add-icon {
  width: 30px !important;
  height: 30px !important;
  stroke: currentColor;
}

/* Filter Section */
.filter-section {
 display: flex;
 flex-wrap: wrap;
 align-items: center;
 justify-content: space-between;
 gap: 0.6rem 1rem;
 padding: 12px 16px; /* tighter like calendar header */
 background: #f9fafb;
 border-bottom: 1px solid #e5e7eb;
}

.filter-controls {
 display: flex;
 align-items: center;
 gap: 14px;
}

.search-control {
display: flex;
align-items: center;
gap: 12px;
}

.search-input-wrapper {
position: relative;
display: flex;
align-items: center;
}

.search-icon {
position: absolute;
left: 12px;
width: 18px;
height: 18px;
color: #9ca3af;
pointer-events: none;
}

.search-input {
 width: 260px;
 padding: 9px 10px 9px 38px;
 border: 1px solid #d1d5db;
 border-radius: 8px;
 background: #fff;
 font-size: 0.95rem;
 color: #374151;
 transition: all 0.2s ease;
}

.search-input:focus {
border-color: #3b82f6;
outline: none;
box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.filter-row {
display: flex;
gap: 12px;
width: 100%;
}

.filter-row .filter-control {
flex: 1 1 0;
min-width: 0;
}

.filter-control {
display: flex;
align-items: center;
gap: 12px;
}

.filter-label {
font-weight: 600;
color: #374151;
font-size: 0.9rem;
}

.filter-select {
 min-width: 160px;
 padding: 9px 10px;
 border: 1px solid #d1d5db;
 border-radius: 8px;
 background: #fff;
 font-size: 0.95rem;
 color: #374151;
 transition: all 0.2s ease;
}

.filter-select:focus {
border-color: #3b82f6;
outline: none;
box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.contact-count-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 0.5rem;
  padding-right: 12px;
}

.contact-count {
  font-size: 0.9rem;
  color: #000000 !important; /* Black text */
  font-weight: 600; /* Bolder text */
  background-color: #374151; /* Dark gray background */
  padding: 6px 12px; /* Add padding for better appearance */
  border-radius: 6px; /* Rounded corners */
  border: 1px solid #4b5563; /* Subtle border */
}

.add-contact-square {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background-color: #1e40af; /* Dark blue for better contrast */
  color: #ffffff !important; /* Force white text for high contrast */
  border: 2px solid #1d4ed8; /* Add border for better definition */
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(30, 64, 175, 0.2);
  font-size: 1.4rem; /* Larger + symbol */
  font-weight: 700; /* Bolder text */
}

.add-contact-square:hover {
  background-color: #1d4ed8; /* Slightly lighter blue on hover */
  color: #ffffff !important; /* Ensure white text on hover */
  border-color: #1e40af;
  box-shadow: 0 4px 16px rgba(30, 64, 175, 0.3);
  transform: translateY(-1px);
}

.add-contact-square .add-icon {
  width: 30px !important;
  height: 30px !important;
  stroke: currentColor;
}

/* Fallback text icons to guarantee visibility even if SVGs are blocked */
.icon-text {
  font-weight: 800;
  font-size: 22px;
  line-height: 1;
  display: inline-block;
  color: #ffffff !important; /* Ensure white text for + symbol */
}
.action-btn.view-btn .icon-text {
  font-size: 18px;
}

/* Contact Cards */
.contacts-section {
padding: 32px;
}

/* Loading State */
.loading-state {
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
padding: 64px 24px;
color: #6b7280;
}

.loading-spinner {
width: 40px;
height: 40px;
border: 3px solid #e5e7eb;
border-top: 3px solid #3b82f6;
border-radius: 50%;
animation: spin 1s linear infinite;
margin-bottom: 16px;
}

@keyframes spin {
0% { transform: rotate(0deg); }
100% { transform: rotate(360deg); }
}

/* Empty State */
.empty-state {
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
padding: 64px 24px;
text-align: center;
color: #6b7280;
}

.empty-icon {
width: 64px;
height: 64px;
margin-bottom: 24px;
color: #d1d5db;
}

.empty-state h3 {
margin: 0 0 8px 0;
font-size: 1.5rem;
font-weight: 600;
color: #374151;
}

.empty-state p {
margin: 0 0 24px 0;
font-size: 1rem;
line-height: 1.5;
}

.empty-state-btn {
  padding: 12px 24px;
  font-size: 1rem;
  border-radius: 8px;
  background-color: #1e40af; /* Darker blue for better contrast */
  color: #ffffff !important; /* Force white text for high contrast */
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(30, 64, 175, 0.2);
}

.empty-state-btn:hover {
  background-color: #1d4ed8; /* Even darker on hover */
  color: #ffffff !important; /* Ensure white text on hover */
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(30, 64, 175, 0.3);
}

/* Contacts List (Grid Layout) */
.contacts-list-container {
  width: 100%;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr; /* Single column on mobile */
  gap: 12px;
  padding: 16px;
}

/* Desktop layout - 3 columns */
@media (min-width: 769px) {
  .contacts-list-container {
    grid-template-columns: repeat(3, 1fr); /* 3 columns on desktop */
    max-width: 1200px;
    gap: 16px;
  }
}

.contact-list-row {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 16px;
  border: 2px solid #000000; /* Complete black border around contact */
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.contact-list-row:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

/* Remove the last-child border rule since we're using grid now */

.contact-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #3b82f6;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  font-weight: 700;
  flex-shrink: 0;
  margin: 0 auto 12px auto; /* Center avatar and add bottom margin */
}

.contact-list-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: center; /* Center the text content */
}

.contact-name {
  font-weight: 600;
  color: #000000 !important; /* Black text */
  line-height: 1.3;
  white-space: normal;
  word-break: break-word;
  font-size: 1rem;
}

.contact-role {
  font-size: 0.85rem;
  color: #000000 !important; /* Black text */
  font-weight: 500;
  white-space: normal;
  word-break: break-word;
}

.contact-location {
  font-size: 0.8rem;
  color: #000000 !important; /* Black text */
  margin-top: 2px;
  white-space: normal;
  word-break: break-word;
}

.contact-actions-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}

.action-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
}

/* Edit button styling - dark background with white text */
.edit-btn {
  background-color: #374151 !important; /* Dark gray background */
  color: #ffffff !important; /* White text for contrast */
  border: 1px solid #374151 !important;
  transition: all 0.2s ease;
}

.edit-btn:hover {
  background-color: #1f2937 !important; /* Darker on hover */
  color: #ffffff !important; /* Keep white text */
  border-color: #1f2937 !important;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.edit-btn {
  font-size: 16px !important;
  line-height: 1 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

/* Info button styling */
.view-btn {
  background-color: #3b82f6 !important; /* Blue background */
  color: #ffffff !important; /* White icon */
  border: 1px solid #2563eb !important;
  transition: all 0.2s ease;
}

.view-btn:hover {
  background-color: #2563eb !important;
  color: #ffffff !important;
  border-color: #1d4ed8 !important;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}

.view-btn {
  font-size: 16px !important;
  line-height: 1 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

/* Desktop-only contact details */
.desktop-only {
  display: none; /* Hidden by default on mobile */
}

@media (min-width: 769px) {
  .desktop-only {
    display: block; /* Show on desktop */
    color: #d1d5db !important; /* Light gray text for desktop details */
    font-size: 0.9rem; /* Slightly larger for desktop */
    margin-top: 3px;
  }
  
  .contact-email {
    color: #9ca3af !important; /* Slightly different color for email */
    font-weight: 500; /* Medium weight for better readability */
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .contact-phone {
    color: #9ca3af !important; /* Slightly different color for phone */
    font-weight: 500; /* Medium weight for better readability */
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .copy-btn {
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 4px 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    color: #6b7280;
    min-width: 28px;
    height: 28px;
  }
  
  .copy-btn:hover {
    background: #e5e7eb;
    border-color: #9ca3af;
    color: #374151;
    transform: translateY(-1px);
  }
  
  .copy-btn svg {
    width: 14px;
    height: 14px;
  }
  
  .contact-role {
    font-size: 0.9rem; /* Larger role text on desktop */
    font-weight: 600; /* Bolder role text */
  }
  
  .contact-location {
    font-size: 0.85rem; /* Slightly larger location text */
  }
}

/* Edit Contact Modal */
.modal-overlay {
position: fixed;
top: 0;
left: 0;
width: 100%;
height: 100%;
background: rgba(0, 0, 0, 0.5);
display: flex;
align-items: center;
justify-content: center;
padding: 16px;
z-index: 1000;
backdrop-filter: blur(4px);
}

.modal-content {
background: #fff;
border-radius: 16px;
width: 100%;
max-width: 480px;
max-height: 90vh;
overflow: hidden;
box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
display: flex;
flex-direction: column;
}

.modal-header {
display: flex;
align-items: center;
justify-content: space-between;
padding: 24px 32px;
border-bottom: 1px solid #e5e7eb;
}

.modal-title {
margin: 0;
font-size: 1.5rem;
font-weight: 700;
color: #111827;
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: #f3f4f6; /* Light gray background for better visibility */
  border: 1px solid #d1d5db; /* Add border for definition */
  border-radius: 8px;
  cursor: pointer;
  color: #374151 !important; /* Darker color for better contrast */
  transition: all 0.2s ease;
}

.modal-close:hover {
  background-color: #e5e7eb; /* Darker gray on hover */
  color: #1f2937 !important; /* Even darker text on hover */
  border-color: #9ca3af;
  transform: scale(1.05); /* Slight scale effect */
}

.modal-close svg {
  width: 18px;
  height: 18px;
  stroke-width: 2.5; /* Thicker stroke for better visibility */
}

.modal-body {
padding: 32px;
overflow-y: auto;
flex: 1;
}

.modal-footer {
display: flex;
align-items: center;
justify-content: flex-end;
gap: 12px;
padding: 24px 32px;
border-top: 1px solid #e5e7eb;
background: #f9fafb;
}

/* Form Styling */
.form-group {
margin-bottom: 20px;
}

.form-label {
display: block;
margin-bottom: 8px;
font-weight: 600;
color: #374151;
font-size: 0.9rem;
}

.form-input,
.form-select,
.form-textarea {
width: 100%;
padding: 12px 16px;
border: 1px solid #d1d5db;
border-radius: 8px;
background: #fff;
font-size: 0.95rem;
color: #374151;
transition: all 0.2s ease;
box-sizing: border-box;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
border-color: #3b82f6;
outline: none;
box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
resize: vertical;
min-height: 80px;
}

.btn {
display: inline-flex;
align-items: center;
justify-content: center;
padding: 10px 20px;
font-size: 0.95rem;
font-weight: 600;
border-radius: 8px;
border: none;
cursor: pointer;
transition: all 0.2s ease;
min-height: 44px;
}

/* High contrast button base class */
.btn-positive {
  background-color: #1e40af; /* Dark blue for high contrast */
  color: #ffffff !important; /* Force white text */
  border: 1px solid #1e40af;
  font-weight: 600;
}

.btn-positive:hover:not(:disabled) {
  background-color: #1d4ed8;
  color: #ffffff !important;
  border-color: #1d4ed8;
  transform: translateY(-1px);
}

.btn-warning {
  background-color: #dc2626; /* Dark red for high contrast */
  color: #ffffff !important; /* Force white text */
  border: 1px solid #dc2626;
  font-weight: 600;
}

.btn-warning:hover:not(:disabled) {
  background-color: #b91c1c;
  color: #ffffff !important;
  border-color: #b91c1c;
  transform: translateY(-1px);
}

.btn:disabled {
opacity: 0.6;
cursor: not-allowed;
}

.btn-primary {
  background-color: #1e40af; /* Darker blue for better contrast */
  color: #ffffff !important; /* Force white text for high contrast */
  border: 1px solid #1e40af;
}

.btn-primary:hover:not(:disabled) {
  background-color: #1d4ed8; /* Even darker on hover */
  color: #ffffff !important; /* Ensure white text on hover */
  border-color: #1d4ed8;
  transform: translateY(-1px);
}

.btn-secondary {
  background-color: #1f2937; /* Darker gray for better contrast */
  color: #ffffff !important; /* Force white text for high contrast */
  border: 1px solid #1f2937;
}

.btn-secondary:hover {
  background-color: #374151; /* Slightly lighter on hover */
  color: #ffffff !important; /* Ensure white text on hover */
  border-color: #374151;
  transform: translateY(-1px);
}

.spinner {
width: 20px;
height: 20px;
margin-right: 8px;
color: currentColor;
}

/* Responsive Design */
@media (max-width: 768px) {
.project-contacts-container {
  padding: 16px;
}

.page-header {
  padding: 24px;
  flex-direction: column;
  align-items: stretch;
  text-align: center;
}

.page-title-small {
  font-size: 1.75rem;
}

.add-contact-fab {
  width: 100%;
}

  .filter-section {
    padding: 12px 16px;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

.filter-controls {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
}

.search-control,
.filter-control {
  flex-direction: column;
  align-items: stretch;
}

.search-input,
.filter-select {
  width: 100%;
}

  .contacts-section {
    padding: 16px;
  }

.contacts-list-container {
  max-width: 98vw;
  grid-template-columns: 1fr; /* Single column on mobile */
  gap: 8px;
}

.contact-list-row {
  padding: 12px;
}

.contact-avatar {
  width: 40px;
  height: 40px;
  font-size: 1rem;
}

.contact-name {
  font-size: 0.9rem;
}

.contact-role {
  font-size: 0.8rem;
}

.info-content {
  gap: 4px;
}

.info-item {
  font-size: 0.85rem;
  gap: 4px;
}

.info-icon {
  width: 14px;
  height: 14px;
}

.contact-link {
  font-size: 0.85rem;
}

.contact-comments {
  font-size: 0.8rem;
}

.no-info {
  font-size: 0.8rem;
}

.action-btn {
  width: 28px;
  height: 28px;
}

.action-btn svg {
  width: 14px;
  height: 14px;
}

.edit-fields {
  grid-template-columns: 1fr;
  gap: 16px;
  padding: 20px;
}

.modal-content {
  margin: 16px;
  max-height: calc(100vh - 32px);
}

.modal-header,
.modal-body,
.modal-footer {
  padding: 20px 24px;
}
}

@media (max-width: 480px) {
.page-header {
  padding: 20px;
}

.page-title-small {
  font-size: 1.5rem;
}

.contacts-section {
  padding: 16px;
}

.contacts-list-container {
  max-width: 98vw;
  grid-template-columns: 1fr; /* Single column on small mobile */
  gap: 6px;
}

.contact-list-row {
  padding: 8px;
}

.contact-avatar {
  width: 36px;
  height: 36px;
  font-size: 0.9rem;
}

.contact-name {
  font-size: 0.85rem;
}

.contact-role {
  font-size: 0.75rem;
}

.info-content {
  gap: 3px;
}

.info-item {
  font-size: 0.8rem;
  gap: 3px;
}

.info-icon {
  width: 12px;
  height: 12px;
}

.contact-link {
  font-size: 0.8rem;
}

.contact-comments {
  font-size: 0.75rem;
}

.no-info {
  font-size: 0.75rem;
}

.action-btn {
  width: 24px;
  height: 24px;
}

.action-btn svg {
  width: 12px;
  height: 12px;
}

.edit-fields {
  padding: 16px;
  gap: 12px;
}

.edit-header {
  padding: 16px 20px;
}

.edit-actions {
  padding: 16px 20px;
}
}

.contact-location {
  font-size: 0.8rem;
  color: #000000;
  margin-top: 2px;
}

@media (max-width: 600px) {
  .contacts-list-container {
    font-size: 0.95rem;
  }
  .contact-name {
    max-width: 60vw;
  }
  .action-btn {
    width: 28px;
    height: 28px;
  }
}

/* Contact Info Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-content {
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 380px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}
.modal-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: #111827;
}
.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: #f3f4f6; /* Light gray background for better visibility */
  border: 1px solid #d1d5db; /* Add border for definition */
  border-radius: 8px;
  cursor: pointer;
  color: #374151 !important; /* Darker color for better contrast */
  transition: all 0.2s ease;
}
.modal-close:hover {
  background-color: #e5e7eb; /* Darker gray on hover */
  color: #1f2937 !important; /* Even darker text on hover */
  border-color: #9ca3af;
  transform: scale(1.05); /* Slight scale effect */
}
.modal-close svg {
  width: 18px;
  height: 18px;
  stroke-width: 2.5; /* Thicker stroke for better visibility */
}
.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}
.contact-info-display {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.contact-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
}
.contact-avatar-large {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #3b82f6;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: 700;
  flex-shrink: 0;
}
.contact-details-large {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.contact-name-large {
  margin: 0 0 2px 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #111827;
  line-height: 1.3;
}
.contact-role-large {
  font-size: 0.95rem;
  color: #6b7280;
  font-weight: 500;
}
.contact-location-large {
  font-size: 0.85rem;
  color: #000000;
}
.contact-info-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}
.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.97rem;
}
.info-label {
  font-weight: 600;
  color: #374151;
  min-width: 70px;
}
.info-value {
  color: #111827;
  word-break: break-word;
}
.info-value.link {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
}
.info-value.link:hover {
  text-decoration: underline;
}
.no-info-display {
  text-align: center;
  color: #9ca3af;
  font-style: italic;
  padding: 10px;
}
.info-value.muted {
  color: #9ca3af;
  font-style: italic;
}

/* Copy button styling */
.info-value-with-copy {
  display: flex;
  align-items: center;
  gap: 8px;
}

.copy-btn {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 4px 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  color: #6b7280;
  min-width: 28px;
  height: 28px;
}

.copy-btn:hover {
  background: #e5e7eb;
  border-color: #9ca3af;
  color: #374151;
  transform: translateY(-1px);
}

.copy-btn svg {
  width: 14px;
  height: 14px;
}
</style>