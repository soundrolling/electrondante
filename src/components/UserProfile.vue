<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '../supabase';
import { useUserStore } from '../stores/userStore';
import { formatWeight, getWeightUnit, setWeightUnit, convertInputToKg, kgToLbs, lbsToKg } from '../utils/weightUtils';

const store = useUserStore();
const route = useRoute();
const router = useRouter();

/* ---------- page‑level state ---------- */
const loading = ref(false);
const saving = ref(false);
const errorMsg = ref('');
const successMsg = ref('');

const userId = computed(() => store.user?.id ?? '');
const userEmail = computed(() => store.user?.email ?? '');

/* profile data */
const profile = ref({
  full_name: '',
  phone: '',
  bio: '',
  company: '',
  role: '',
  location: '',
  website: '',
  social_links: {
    linkedin: '',
    twitter: '',
    github: ''
  }
});

/* tabs */
const tabs = [
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'gear', label: 'My Gear', icon: '🎛️' },
  { id: 'preferences', label: 'Preferences', icon: '⚙️' },
  { id: 'security', label: 'Security', icon: '🔒' }
];

// Get active tab from route, default to 'profile'
const activeTab = computed({
  get: () => {
    const tabFromRoute = route.params.tab || 'profile';
    // Validate tab exists, fallback to 'profile'
    return tabs.some(t => t.id === tabFromRoute) ? tabFromRoute : 'profile';
  },
  set: (newTab) => {
    if (newTab !== route.params.tab) {
      router.push(`/profile/${newTab}`);
    }
  }
});

// Watch route changes and redirect if invalid tab
watch(() => route.params.tab, (newTab) => {
  if (newTab && !tabs.some(t => t.id === newTab)) {
    // Invalid tab, redirect to profile
    router.replace('/profile/profile');
  }
});

/* ---------- gear data ---------- */
const gear = ref([]);
const gearLoading = ref(false);
const search = ref('');
const gearFilter = ref('all');

const filteredGear = computed(() => {
  let filtered = gear.value;
  
  // Search filter
  if (search.value) {
    filtered = filtered.filter(g => 
      g.gear_name.toLowerCase().includes(search.value.toLowerCase()) ||
      g.gear_type?.toLowerCase().includes(search.value.toLowerCase()) ||
      g.notes?.toLowerCase().includes(search.value.toLowerCase())
    );
  }
  
  // Type filter
  if (gearFilter.value !== 'all') {
    filtered = filtered.filter(g => g.gear_type === gearFilter.value);
  }
  
  return filtered;
});

const gearTypes = computed(() =>
  [...new Set(gear.value.map(g => g.gear_type).filter(Boolean))]
);

const gearStats = computed(() => ({
  total: gear.value.length,
  types: gearTypes.value.length,
  totalQuantity: gear.value.reduce((sum, g) => sum + (g.quantity || 1), 0)
}));

/* ---------- modal state ---------- */
const showGearModal = ref(false);
const isEditGear = ref(false);
const editGearId = ref(null);

/* ---------- assignments modal state ---------- */
const showAssignmentsModal = ref(false);
const assignmentsLoading = ref(false);
const gearAssignments = ref([]);
const selectedGearForAssignments = ref(null);

const gearForm = ref({
  gear_name: '',
  quantity: 1,
  gear_type: 'transformer',
  // IO/Tracks for richer gear description
  num_inputs: 0,
  num_outputs: 1,
  num_records: null,
  is_rented: false,
  purchased_date: '',
  notes: '',
  condition: 'excellent',
  availability: 'available'
});

const conditionOptions = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' }
];

const availabilityOptions = [
  { value: 'available', label: 'Available' },
  { value: 'in_use', label: 'In Use' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'unavailable', label: 'Unavailable' }
];

/* ---------- lifecycle ---------- */
onMounted(async () => {
  await fetchProfile();
  await fetchGear();
});

/* profile CRUD */
async function fetchProfile() {
  try {
    loading.value = true;
        await store.fetchUserProfile();
    if (store.userProfile) {
      profile.value = { 
        ...profile.value,
        ...store.userProfile 
      };
    }
  } catch (e) {
    errorMsg.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function saveProfile() {
  try {
    saving.value = true;
    errorMsg.value = '';
    successMsg.value = '';
    
    await store.upsertUserProfile({ ...profile.value });
    successMsg.value = 'Profile updated successfully!';
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      successMsg.value = '';
    }, 3000);
  } catch (e) {
    errorMsg.value = e.message;
  } finally {
    saving.value = false;
  }
}

/* gear CRUD */
async function fetchGear() {
  try {
    gearLoading.value = true;
  const { data, error } = await supabase
    .from('user_gear')
      .select('id, gear_name, quantity, gear_type, num_inputs, num_outputs, num_records, is_rented, purchased_date, notes, condition, availability')
    .eq('user_id', userId.value)
    .order('gear_name');
    
    if (error) throw error;
    gear.value = data || [];
  } catch (e) {
    errorMsg.value = e.message;
  } finally {
    gearLoading.value = false;
  }
}

function openAddGear() {
  resetGearForm();
  showGearModal.value = true;
}

function openEditGear(gearItem) {
  const currentUnit = weightUnit.value;
  const weightKg = gearItem.weight_kg || null;
  
  gearForm.value = {
    gear_name: gearItem.gear_name,
    quantity: gearItem.quantity || 1,
    gear_type: gearItem.gear_type || '',
    num_inputs: gearItem.num_inputs ?? 0,
    num_outputs: gearItem.num_outputs ?? 1,
    num_records: gearItem.num_records ?? null,
    is_rented: !!gearItem.is_rented,
    purchased_date: gearItem.purchased_date || '',
    notes: gearItem.notes || '',
    condition: gearItem.condition || 'excellent',
    availability: gearItem.availability || 'available',
    weight_kg: weightKg,
    weightInput: weightKg ? (currentUnit === 'lbs' ? kgToLbs(weightKg) : weightKg) : null,
    weightInputUnit: currentUnit
  };
  isEditGear.value = true;
  editGearId.value = gearItem.id;
  showGearModal.value = true;
}

function resetGearForm() {
  gearForm.value = {
    gear_name: '',
    quantity: 1,
    gear_type: 'transformer',
    num_inputs: 0,
    num_outputs: 1,
    num_records: null,
    is_rented: false,
    purchased_date: '',
    notes: '',
    condition: 'excellent',
    availability: 'available',
    weight_kg: null,
    weightInput: null,
    weightInputUnit: weightUnit.value
  };
  isEditGear.value = false;
  editGearId.value = null;
}

async function saveGear() {
  const name = gearForm.value.gear_name.trim();
  if (!name) return;

  // Convert weight input to kg for storage
  const weightInKg = gearForm.value.weightInput 
    ? convertInputToKg(gearForm.value.weightInput, gearForm.value.weightInputUnit)
    : null;

  const payload = {
    user_id: userId.value,
    gear_name: name,
    quantity: gearForm.value.quantity || 1,
    gear_type: gearForm.value.gear_type.trim() || null,
    num_inputs: gearForm.value.gear_type === 'source' ? 0 : (gearForm.value.gear_type === 'accessories_cables' ? null : Number(gearForm.value.num_inputs || 0)),
    num_outputs: gearForm.value.gear_type === 'source' ? 1 : (gearForm.value.gear_type === 'accessories_cables' ? null : Number(gearForm.value.num_outputs || 0)),
    num_records: gearForm.value.gear_type === 'recorder' ? Number(gearForm.value.num_records || 0) : null,
    is_rented: !!gearForm.value.is_rented,
    purchased_date: gearForm.value.purchased_date || null,
    notes: gearForm.value.notes.trim() || null,
    condition: gearForm.value.condition,
    availability: gearForm.value.availability,
    weight_kg: weightInKg
  };

  try {
    saving.value = true;
    
    if (isEditGear.value) {
      const { data, error } = await supabase
        .from('user_gear')
        .update(payload)
        .eq('id', editGearId.value)
        .select()
        .single();
      
      if (error) throw error;
      gear.value = gear.value.map(g => g.id === editGearId.value ? data : g);
      successMsg.value = 'Gear updated successfully!';
    } else {
      const { data, error } = await supabase
        .from('user_gear')
        .insert(payload)
        .select()
        .single();
      
      if (error) throw error;
      gear.value.push(data);
      successMsg.value = 'Gear added successfully!';
    }
    
    showGearModal.value = false;
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      successMsg.value = '';
    }, 3000);
  } catch (e) {
    errorMsg.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function deleteGear(id) {
  if (!confirm('Are you sure you want to delete this gear?')) return;
  
  try {
    const { error } = await supabase
      .from('user_gear')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    gear.value = gear.value.filter(g => g.id !== id);
    successMsg.value = 'Gear deleted successfully!';
    
    setTimeout(() => {
      successMsg.value = '';
    }, 3000);
  } catch (e) {
    errorMsg.value = e.message;
  }
}

function closeGearModal() {
  showGearModal.value = false;
  resetGearForm();
}

/* ---------- gear assignments ---------- */
async function fetchGearAssignments(userGearId) {
  try {
    assignmentsLoading.value = true;
    gearAssignments.value = [];
    
    // Find all project gear entries that reference this user gear
    const { data: projectGear, error: gearError } = await supabase
      .from('gear_table')
      .select('id, gear_name, project_id')
      .eq('user_gear_id', userGearId);
    
    if (gearError) throw gearError;
    
    if (!projectGear || projectGear.length === 0) {
      gearAssignments.value = [];
      return;
    }
    
    const projectGearIds = projectGear.map(g => g.id);
    const projectIds = [...new Set(projectGear.map(g => g.project_id))];
    
    // Get gear assignments
    const { data: assignments, error: assignmentsError } = await supabase
      .from('gear_assignments')
      .select('gear_id, location_id, assigned_amount')
      .in('gear_id', projectGearIds);
    
    if (assignmentsError) throw assignmentsError;
    
    // Get locations (stages)
    const locationIds = [...new Set((assignments || []).map(a => a.location_id))];
    let locations = [];
    if (locationIds.length > 0) {
      const { data: locs, error: locError } = await supabase
        .from('locations')
        .select('id, stage_name, venue_name, project_id')
        .in('id', locationIds);
      
      if (locError) throw locError;
      locations = locs || [];
    }
    
    // Get project names and dates
    let projects = [];
    if (projectIds.length > 0) {
      const { data: projs, error: projError } = await supabase
        .from('projects')
        .select('id, project_name, build_days, main_show_days')
        .in('id', projectIds);
      
      if (projError) throw projError;
      projects = projs || [];
    }
    
    // Combine data
    const projectGearMap = {};
    projectGear.forEach(g => {
      projectGearMap[g.id] = g;
    });
    
    // Get all project dates for conflict checking
    const projectDatesMap = {};
    projects.forEach(p => {
      projectDatesMap[p.id] = {
        build_days: p.build_days || [],
        main_show_days: p.main_show_days || []
      };
    });
    
    const assignmentsList = (assignments || []).map(assignment => {
      const gear = projectGearMap[assignment.gear_id];
      const location = locations.find(l => l.id === assignment.location_id);
      const project = projects.find(p => p.id === gear?.project_id);
      const projectDates = projectDatesMap[gear?.project_id] || { build_days: [], main_show_days: [] };
      
      // Check for conflicts with other assignments
      const otherAssignments = (assignments || []).filter(a => 
        a.gear_id !== assignment.gear_id && 
        a.location_id !== assignment.location_id
      );
      
      const conflicts = [];
      if (projectDates.build_days?.length > 0 || projectDates.main_show_days?.length > 0) {
        const thisProjectDates = [
          ...(projectDates.build_days || []),
          ...(projectDates.main_show_days || [])
        ];
        
        // Check against all other projects using this user gear
        otherAssignments.forEach(otherAss => {
          const otherGear = projectGearMap[otherAss.gear_id];
          const otherProject = projects.find(p => p.id === otherGear?.project_id);
          if (otherProject) {
            const otherProjectDates = [
              ...(otherProject.build_days || []),
              ...(otherProject.main_show_days || [])
            ];
            
            const overlap = thisProjectDates.some(d => otherProjectDates.includes(d));
            if (overlap) {
              conflicts.push({
                project_name: otherProject.project_name,
                project_id: otherProject.id
              });
            }
          }
        });
      }
      
      return {
        project_name: project?.project_name || 'Unknown Project',
        project_id: gear?.project_id,
        stage_name: location?.stage_name || `Location ${assignment.location_id}`,
        venue_name: location?.venue_name || '',
        assigned_amount: assignment.assigned_amount || 0,
        location_id: assignment.location_id,
        conflicts: conflicts,
        has_conflicts: conflicts.length > 0,
        project_dates: {
          build_days: projectDates.build_days || [],
          main_show_days: projectDates.main_show_days || []
        }
      };
    });
    
    gearAssignments.value = assignmentsList;
  } catch (e) {
    console.error('Error fetching gear assignments:', e);
    errorMsg.value = e.message || 'Failed to load assignments';
    gearAssignments.value = [];
  } finally {
    assignmentsLoading.value = false;
  }
}

function openAssignmentsModal(gearItem) {
  selectedGearForAssignments.value = gearItem;
  showAssignmentsModal.value = true;
  fetchGearAssignments(gearItem.id);
}

function closeAssignmentsModal() {
  showAssignmentsModal.value = false;
  selectedGearForAssignments.value = null;
  gearAssignments.value = [];
}

// Clear messages when tab changes
watch(activeTab, () => {
  errorMsg.value = '';
  successMsg.value = '';
});

// Preferences state
const weightUnit = ref(getWeightUnit());
const preferences = ref({
  notifications: true,
  weightUnit: getWeightUnit()
});
const savingPreferences = ref(false);
const prefMsg = ref('');

// Watch weight unit changes and save to localStorage
watch(weightUnit, (newUnit) => {
  setWeightUnit(newUnit);
  preferences.value.weightUnit = newUnit;
});

async function savePreferences() {
  savingPreferences.value = true;
  prefMsg.value = '';
  // Save weight unit preference
  setWeightUnit(weightUnit.value);
  // Simulate save (replace with real API/store call)
  setTimeout(() => {
    prefMsg.value = 'Preferences saved!';
    savingPreferences.value = false;
    setTimeout(() => { prefMsg.value = ''; }, 2000);
  }, 800);
}

// Security state
const security = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});
const savingSecurity = ref(false);
const secMsg = ref('');

async function saveSecurity() {
  if (!security.value.currentPassword || !security.value.newPassword || !security.value.confirmPassword) {
    secMsg.value = 'Please fill all fields.';
    return;
  }
  if (security.value.newPassword !== security.value.confirmPassword) {
    secMsg.value = 'Passwords do not match.';
    return;
  }
  savingSecurity.value = true;
  secMsg.value = '';
  try {
    // Supabase password change (user must be logged in)
    const { error } = await supabase.auth.updateUser({ password: security.value.newPassword });
    if (error) {
      if (error.message && error.message.toLowerCase().includes('jwt expired')) {
        secMsg.value = 'Session expired. Please log in again.';
      } else {
        secMsg.value = error.message || 'Failed to change password.';
      }
    } else {
      secMsg.value = 'Password changed!';
      security.value.currentPassword = '';
      security.value.newPassword = '';
      security.value.confirmPassword = '';
    }
  } catch (e) {
    secMsg.value = e.message || 'Failed to change password.';
  } finally {
    savingSecurity.value = false;
    setTimeout(() => { secMsg.value = ''; }, 3000);
  }
}
</script>

<template>
  <div class="profile-container">
    <!-- Header -->
    <div class="profile-header ui-page-header">
      <div class="header-content">
        <h1 class="profile-title">My Profile</h1>
        <p class="profile-subtitle">Manage your account settings and personal gear</p>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="tab-navigation mobile-scroll">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab-button', { active: activeTab === tab.id } ]"
        @click="router.push(`/profile/${tab.id}`)"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </div>

    <!-- Content Area -->
    <div class="content-area">
      <!-- Profile Tab -->
      <div v-if="activeTab === 'profile'" class="tab-content" key="profile">
        <div class="content-card">
          <h2 class="section-title">Personal Information</h2>
          <form @submit.prevent="saveProfile" class="profile-form">
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Email Address</label>
                <input 
                  :value="userEmail" 
                  disabled 
                  class="form-input readonly"
                  type="email"
                />
                <span class="input-note">Email cannot be changed</span>
              </div>
              <div class="form-group">
                <label class="form-label">Full Name</label>
                <input 
                  v-model="profile.full_name" 
                  class="form-input"
                  placeholder="Enter your full name"
                />
              </div>
              <div class="form-group">
                <label class="form-label">Phone Number</label>
                <input 
                  v-model="profile.phone" 
                  class="form-input"
                  placeholder="Enter your phone number"
                  type="tel"
                />
              </div>
              <div class="form-group">
                <label class="form-label">Company</label>
                <input 
                  v-model="profile.company" 
                  class="form-input"
                  placeholder="Enter your company name"
                />
              </div>
              <div class="form-group">
                <label class="form-label">Role/Position</label>
                <input 
                  v-model="profile.role" 
                  class="form-input"
                  placeholder="Enter your role or position"
                />
              </div>
              <div class="form-group">
                <label class="form-label">Location</label>
                <input 
                  v-model="profile.location" 
                  class="form-input"
                  placeholder="Enter your location"
                />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Bio</label>
              <textarea 
                v-model="profile.bio" 
                class="form-textarea"
                placeholder="Tell us about yourself..."
                rows="4"
              ></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Website</label>
              <input 
                v-model="profile.website" 
                class="form-input"
                placeholder="https://your-website.com"
                type="url"
              />
            </div>
            <div class="form-actions">
              <button 
                type="submit" 
                class="btn btn-positive"
                :disabled="saving"
              >
                <span v-if="saving" class="loading-spinner"></span>
                {{ saving ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Gear Tab -->
      <div v-if="activeTab === 'gear'" class="tab-content" key="gear">
        <div class="content-card">
          <div class="gear-header">
            <div class="gear-header-left">
              <h2 class="section-title">My Gear</h2>
              <div class="gear-stats">
                <div class="stat-item">
                  <span class="stat-number">{{ gearStats.total }}</span>
                  <span class="stat-label">Items</span>
                </div>
                <div class="stat-item">
                  <span class="stat-number">{{ gearStats.types }}</span>
                  <span class="stat-label">Types</span>
                </div>
                <div class="stat-item">
                  <span class="stat-number">{{ gearStats.totalQuantity }}</span>
                  <span class="stat-label">Total Qty</span>
                </div>
              </div>
            </div>
            <button class="btn btn-positive" @click="openAddGear">
              <span class="btn-icon">+</span>
              Add Gear
            </button>
          </div>

          <!-- Search and Filter -->
          <div class="gear-controls">
            <div class="search-container">
              <input 
                v-model="search" 
                class="search-input"
                placeholder="Search gear..."
                type="search"
              />
              <span class="search-icon">🔍</span>
            </div>
            
            <select v-model="gearFilter" class="filter-select">
              <option value="all">All Types</option>
              <option v-for="type in gearTypes" :key="type" :value="type">
                {{ type }}
              </option>
            </select>
          </div>

          <!-- Gear List -->
          <div v-if="gearLoading" class="loading-state">
            <div class="spinner"></div>
            <p>Loading your gear...</p>
          </div>

          <div v-else-if="filteredGear.length === 0" class="empty-state">
            <div class="empty-icon">🎛️</div>
            <h3>No gear found</h3>
            <p>{{ search || gearFilter !== 'all' ? 'Try adjusting your search or filters' : 'Start by adding your first piece of gear' }}</p>
            <button class="btn btn-positive" @click="openAddGear">Add Your First Gear</button>
          </div>

          <div v-else class="gear-grid">
            <div 
              v-for="item in filteredGear" 
              :key="item.id"
              class="gear-card"
            >
              <div class="gear-card-header">
                <h3 class="gear-name">{{ item.gear_name }}</h3>
                <div class="gear-actions">
                  <button 
                    class="btn-icon btn-edit"
                    @click="openEditGear(item)"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button 
                    class="btn-icon btn-danger"
                    @click="deleteGear(item.id)"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div class="gear-details">
                <div class="gear-info">
                  <span class="gear-type">{{ item.gear_type || 'No type specified' }}</span>
                  <span class="gear-quantity">Qty: {{ item.quantity }}</span>
                </div>

                <div class="gear-meta">
                  <span v-if="item.purchased_date" class="gear-date">
                    Purchased: {{ new Date(item.purchased_date).toLocaleDateString() }}
                  </span>
                  <span class="gear-condition" :class="item.condition">
                    {{ item.condition || 'excellent' }}
                  </span>
                </div>

                <div class="gear-inventory">
                  <span class="badge badge-inventory">Inventory: {{ item.quantity || 0 }}</span>
                  <button 
                    class="btn-assignments"
                    @click="openAssignmentsModal(item)"
                    title="View assignments across projects"
                  >
                    View Assignments
                  </button>
                </div>

                <p v-if="item.notes" class="gear-notes">{{ item.notes }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Preferences Tab -->
      <div v-if="activeTab === 'preferences'" class="tab-content" key="preferences">
        <div class="content-card">
          <h2 class="section-title">Preferences</h2>
          <form class="pref-form" @submit.prevent="savePreferences">
            <div class="form-group">
              <label class="form-label">Notifications</label>
              <label class="switch">
                <input type="checkbox" v-model="preferences.notifications" />
                <span class="slider"></span>
              </label>
              <span class="input-note">Enable email notifications</span>
            </div>
            <div class="form-group">
              <label class="form-label">Weight Unit</label>
              <select v-model="weightUnit" class="form-input">
                <option value="kg">Kilograms (kg)</option>
                <option value="lbs">Pounds (lbs)</option>
              </select>
              <p class="form-hint">Preferred unit for weight input and display</p>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-positive" :disabled="savingPreferences">
                {{ savingPreferences ? 'Saving...' : 'Save Preferences' }}
              </button>
            </div>
            <div v-if="prefMsg" class="pref-msg">{{ prefMsg }}</div>
          </form>
        </div>
      </div>

      <!-- Security Tab -->
      <div v-if="activeTab === 'security'" class="tab-content" key="security">
        <div class="content-card">
          <h2 class="section-title">Security</h2>
          <form class="security-form" @submit.prevent="saveSecurity">
            <div class="form-group">
              <label class="form-label">Current Password</label>
              <input type="password" v-model="security.currentPassword" class="form-input" autocomplete="current-password" />
            </div>
            <div class="form-group">
              <label class="form-label">New Password</label>
              <input type="password" v-model="security.newPassword" class="form-input" autocomplete="new-password" />
            </div>
            <div class="form-group">
              <label class="form-label">Confirm New Password</label>
              <input type="password" v-model="security.confirmPassword" class="form-input" autocomplete="new-password" />
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-positive" :disabled="savingSecurity">
                {{ savingSecurity ? 'Saving...' : 'Change Password' }}
              </button>
            </div>
            <div v-if="secMsg" class="sec-msg">{{ secMsg }}</div>
          </form>
        </div>
      </div>
    </div>

    <!-- Messages -->
    <div v-if="errorMsg || successMsg" class="message-container">
      <div v-if="errorMsg" class="message error">
        <span class="message-icon">⚠️</span>
        {{ errorMsg }}
        <button class="message-close" @click="errorMsg = ''">×</button>
      </div>
      <div v-if="successMsg" class="message success">
        <span class="message-icon">✓</span>
        {{ successMsg }}
        <button class="message-close" @click="successMsg = ''">×</button>
      </div>
    </div>

    <!-- Gear Modal -->
    <div v-if="showGearModal" class="modal-overlay" @click="closeGearModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ isEditGear ? 'Edit Gear' : 'Add New Gear' }}</h3>
          <button class="modal-close" @click="closeGearModal">×</button>
        </div>

        <form @submit.prevent="saveGear" class="modal-form">
          <div class="form-group form-group-full">
            <label class="form-label">Gear Name *</label>
            <input 
              v-model="gearForm.gear_name" 
              class="form-input"
              placeholder="Enter gear name"
              required
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Quantity</label>
              <input 
                v-model.number="gearForm.quantity" 
                class="form-input"
                type="number"
                min="1"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Type</label>
              <select v-model="gearForm.gear_type" class="form-input">
                <option value="source">Source (Microphones)</option>
                <option value="transformer">Transformer</option>
                <option value="recorder">Recorder</option>
                <option value="accessories_cables">Accessories + Cables</option>
              </select>
            </div>

            <div class="form-group" v-if="gearForm.gear_type !== 'source' && gearForm.gear_type !== 'accessories_cables'">
              <label class="form-label">Inputs</label>
              <input 
                v-model.number="gearForm.num_inputs" 
                class="form-input"
                type="number"
                min="0"
              />
            </div>
            <div class="form-group" v-if="gearForm.gear_type !== 'source' && gearForm.gear_type !== 'accessories_cables'">
              <label class="form-label">Outputs</label>
              <input 
                v-model.number="gearForm.num_outputs" 
                class="form-input"
                type="number"
                min="0"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Weight</label>
              <div class="weight-input-group">
                <input 
                  v-model.number="gearForm.weightInput" 
                  class="form-input weight-input"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Optional"
                />
                <select 
                  v-model="gearForm.weightInputUnit"
                  class="weight-unit-select"
                >
                  <option value="kg">kg</option>
                  <option value="lbs">lbs</option>
                </select>
              </div>
              <p v-if="gearForm.weightInput" class="form-hint">
                {{ formatWeight(convertInputToKg(gearForm.weightInput, gearForm.weightInputUnit) || 0, gearForm.weightInputUnit) }}
              </p>
              <p v-else class="form-hint">Used for calculating bag weights</p>
            </div>
          </div>

          <!-- Tracks row (only for recorders) -->
          <div class="form-row" v-if="gearForm.gear_type === 'recorder'">
            <div class="form-group">
              <label class="form-label">Tracks</label>
              <input 
                v-model.number="gearForm.num_records" 
                class="form-input"
                type="number"
                min="1"
              />
            </div>
            <div class="form-group"></div>
            <div class="form-group"></div>
            <div class="form-group"></div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Purchased Date</label>
              <input 
                v-model="gearForm.purchased_date" 
                class="form-input"
                type="date"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Condition</label>
              <select v-model="gearForm.condition" class="form-input">
                <option v-for="option in conditionOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Availability</label>
              <select v-model="gearForm.availability" class="form-input">
                <option v-for="option in availabilityOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Rented?</label>
              <input type="checkbox" v-model="gearForm.is_rented" style="width:auto; min-height:unset; margin-top: 0.5rem;" />
            </div>
          </div>

          <div class="form-group form-group-full">
            <label class="form-label">Notes</label>
            <textarea 
              v-model="gearForm.notes" 
              class="form-textarea"
              placeholder="Additional notes about this gear..."
              rows="3"
            ></textarea>
          </div>

        <div class="modal-actions">
            <button type="button" class="btn btn-warning" @click="closeGearModal">
              Cancel
            </button>
            <button type="submit" class="btn btn-positive" :disabled="saving">
              <span v-if="saving" class="loading-spinner"></span>
              {{ saving ? 'Saving...' : (isEditGear ? 'Update Gear' : 'Add Gear') }}
            </button>
        </div>
        </form>
      </div>
    </div>

    <!-- Gear Assignments Modal -->
    <div v-if="showAssignmentsModal" class="modal-overlay" @click="closeAssignmentsModal">
      <div class="modal-content assignments-modal" @click.stop>
        <div class="modal-header">
          <h3>Gear Assignments - {{ selectedGearForAssignments?.gear_name }}</h3>
          <button class="modal-close" @click="closeAssignmentsModal">×</button>
        </div>

        <div class="modal-form">
          <div v-if="assignmentsLoading" class="loading-state">
            <div class="spinner"></div>
            <p>Loading assignments...</p>
          </div>

          <div v-else-if="gearAssignments.length === 0" class="empty-state">
            <div class="empty-icon">📋</div>
            <h4>No Assignments</h4>
            <p>This gear has not been assigned to any stages yet.</p>
          </div>

          <div v-else class="assignments-list">
            <div 
              v-for="(assignment, index) in gearAssignments" 
              :key="index"
              class="assignment-item"
              :class="{ 'has-conflict': assignment.has_conflicts }"
            >
              <div class="assignment-header">
                <div class="assignment-project">
                  <strong>{{ assignment.project_name }}</strong>
                  <span v-if="assignment.has_conflicts" class="conflict-badge" title="Date conflicts with other projects">
                    ⚠️ Conflict
                  </span>
                </div>
                <div class="assignment-amount">
                  <span class="badge badge-assigned">{{ assignment.assigned_amount }}</span>
                </div>
              </div>
              <div class="assignment-details">
                <div class="assignment-stage">
                  <span class="stage-icon">📍</span>
                  <span>{{ assignment.stage_name }}</span>
                  <span v-if="assignment.venue_name" class="venue-name">
                    ({{ assignment.venue_name }})
                  </span>
                </div>
                <div v-if="assignment.has_conflicts" class="conflict-details">
                  <div class="conflict-label">Conflicts with:</div>
                  <div class="conflict-projects">
                    <span v-for="conflict in assignment.conflicts" :key="conflict.project_id" class="conflict-project">
                      {{ conflict.project_name }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-warning" @click="closeAssignmentsModal">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
:root {
  --bg-main: #f8fafc;
  --bg-card: #fff;
  --bg-header: #f1f5f9;
  --text-main: #334155;
  --text-muted: #64748b;
  --text-heading: #1e293b;
  --text-inverse: #334155;
  --border: #e2e8f0;
  --input-bg: #fff;
  --input-border: #d1d5db;
  --input-text: #334155;
  --primary: #3b82f6;
  --primary-contrast: #fff;
  --secondary: #64748b;
  --secondary-contrast: #fff;
}

.profile-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 0.75rem;
  background: var(--bg-main);
  min-height: 100vh;
  color: var(--text-main);
}

.profile-header {
  background: var(--bg-header);
  color: var(--text-inverse);
  padding: 1rem 0.75rem;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  text-align: center;
  border: 1px solid var(--border);
}

.profile-title {
  font-size: 1.6rem;
  font-weight: 700;
  margin: 0 0 0.2rem;
  color: #000000 !important;
}

.profile-subtitle {
  font-size: 0.98rem;
  opacity: 0.9;
  margin: 0;
  color: var(--text-muted);
  line-height: 1.3;
}

.tab-navigation {
  display: flex;
  background: var(--bg-card);
  border-radius: 0.5rem;
  padding: 0.25rem;
  margin-bottom: 1rem;
  border: 1px solid var(--border);
  overflow-x: auto;
  gap: 0.25rem;
  min-height: unset;
  align-items: center;
}

.tab-button {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1rem;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 0.4rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  font-weight: 500;
  color: var(--text-muted);
  font-size: 0.9rem;
  box-shadow: none;
}

.tab-button:hover {
  background: #f1f5f9;
  color: var(--text-main);
  border-color: var(--border);
}

.tab-button.active {
  background: var(--primary);
  color: var(--primary-contrast);
  font-weight: 600;
  border-color: var(--primary);
}

.tab-icon {
  font-size: 1.2rem;
}

.content-area {
  min-height: 500px;
}

.tab-content {
  animation: fadeIn 0.3s ease;
}

.content-card {
  background: var(--bg-card);
  border-radius: 0.5rem;
  padding: 1.25rem;
  box-shadow: none;
  color: var(--text-main);
  border: 1px solid var(--border);
}

.section-title {
  font-size: 1.3rem;
  font-weight: 600;
  margin: 0 0 1rem;
  color: #000000 !important;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--border);
}

.subsection-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 1.25rem 0 0.75rem;
  color: var(--text-heading);
  padding-bottom: 0.25rem;
  border-bottom: 1px solid var(--border);
}

.profile-form {
  max-width: 800px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-group {
  margin-bottom: 1rem;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: #fafbfc;
}

.form-label {
  display: block;
  font-weight: 600;
  color: var(--text-heading);
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 0.6rem;
  border: 2px solid var(--border-medium) !important;
  border-radius: 0.4rem;
  font-size: 0.9rem;
  background: var(--input-bg);
  color: #000000 !important;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--primary) !important;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1), var(--shadow-md);
}

.form-input.readonly {
  background: #f8fafc;
  color: var(--text-muted);
  cursor: not-allowed;
}

.input-note {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.social-links-section {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid var(--border);
}

.gear-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.gear-header-left {
  flex: 1;
}

.gear-stats {
  display: flex;
  gap: 0;
  margin-top: 0.75rem;
  border: 1px solid var(--border-medium);
  border-radius: 0.75rem;
  background: var(--bg-card);
  padding: 0.75rem;
  box-shadow: var(--shadow-sm);
}

.stat-item {
  text-align: center;
  padding: 0.5rem 1rem;
  font-size: 0.95rem;
  border-right: 2px solid var(--border-medium);
  flex: 1;
}

.stat-item:last-child {
  border-right: none;
}

.stat-number {
  display: block;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-heading);
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-muted);
  font-weight: 500;
}

.gear-controls {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-8);
  flex-wrap: wrap;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-xl);
  background: var(--bg-grouped);
  padding: var(--space-6);
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(20px);
}

.search-container {
  position: relative;
  flex: 1;
  min-width: 120px;
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.5rem;
  border: 2px solid var(--border-medium) !important;
  border-radius: 0.5rem;
  font-size: 0.95rem;
  background: var(--bg-primary);
  color: #000000 !important;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1), var(--shadow-sm);
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
}

.filter-select {
  padding: 0.75rem 1rem;
  border: 2px solid var(--border-medium) !important;
  border-radius: 0.5rem;
  font-size: 0.95rem;
  background: var(--bg-primary);
  min-width: 120px;
  color: #000000 !important;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s;
}

.filter-select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1), var(--shadow-sm);
}

.gear-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.7rem;
}

.gear-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  transition: all var(--transition-normal);
  color: var(--text-primary);
  box-shadow: var(--shadow-card);
  font-size: var(--text-base);
  backdrop-filter: blur(20px);
}

.gear-card:hover {
  border-color: var(--text-link);
  box-shadow: var(--shadow-elevated);
  transform: translateY(-2px);
}

.gear-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

.gear-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: #000000 !important;
  margin: 0;
  flex: 1;
}

.gear-actions {
  display: flex;
  gap: 0.3rem;
}

.gear-details {
  color: var(--text-muted);
}

.gear-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.gear-type {
  font-weight: 500;
  color: var(--primary);
}

.gear-quantity {
  font-weight: 500;
}

.gear-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.93rem;
}

.gear-inventory {
  display: flex;
  gap: 0.3rem;
  margin-bottom: 0.3rem;
  flex-wrap: wrap;
}

.badge {
  display: inline-block;
  padding: 0.3em 0.9em;
  border-radius: 1em;
  font-size: 0.98em;
  font-weight: 700;
  background: #f1f5f9;
  color: #334155;
  box-shadow: none;
  margin-right: 0.1em;
  border: 1.5px solid #64748b;
}

.badge-inventory {
  background: linear-gradient(90deg, #dbeafe 0%, #60a5fa 100%);
  color: #1e40af;
  border: 1.5px solid #60a5fa;
}

.badge-assigned {
  background: linear-gradient(90deg, #fde68a 0%, #fbbf24 100%);
  color: #92400e;
  border: 1.5px solid #fbbf24;
}

.btn-assignments {
  display: inline-block;
  padding: 0.4em 1em;
  border-radius: 0.5rem;
  font-size: 0.9em;
  font-weight: 600;
  background: var(--primary);
  color: var(--primary-contrast);
  border: 2px solid var(--primary);
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
  box-shadow: none;
  margin-left: 0.5rem;
}

.btn-assignments:hover {
  background: #2563eb;
  border-color: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}

.assignments-modal {
  max-width: 600px;
}

.assignments-list {
  max-height: 400px;
  overflow-y: auto;
  margin-bottom: 1rem;
}

.assignment-item {
  padding: 1rem;
  margin-bottom: 0.75rem;
  background: #f8fafc;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  transition: all 0.2s ease;
}

.assignment-item:hover {
  background: #f1f5f9;
  border-color: var(--primary);
}

.assignment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.assignment-project {
  font-size: 1rem;
  color: var(--text-heading);
}

.assignment-amount {
  display: flex;
  align-items: center;
}

.assignment-details {
  margin-top: 0.5rem;
}

.assignment-stage {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.stage-icon {
  font-size: 1rem;
}

.venue-name {
  color: var(--text-muted);
  font-style: italic;
}

.assignment-item.has-conflict {
  border-color: #f59e0b;
  background: #fef3c7;
}

.conflict-badge {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.2em 0.6em;
  background: #fbbf24;
  color: #92400e;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.conflict-details {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #fbbf24;
}

.conflict-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #92400e;
  margin-bottom: 0.25rem;
}

.conflict-projects {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.conflict-project {
  display: inline-block;
  padding: 0.2em 0.5em;
  background: #fde68a;
  color: #78350f;
  border-radius: 0.25rem;
  font-size: 0.8rem;
  font-weight: 500;
}

.badge-total {
  background: linear-gradient(90deg, #dbeafe 0%, #60a5fa 100%);
  color: #1e40af;
  border: 1.5px solid #60a5fa;
}

.gear-condition {
  padding: 0.25em 0.8em;
  border-radius: 1em;
  font-size: 0.93em;
  font-weight: 700;
  text-transform: capitalize;
  border: 1.5px solid #22c55e;
  box-shadow: none;
}

.gear-condition.good {
  border: 1.5px solid #60a5fa;
}

.gear-condition.fair {
  border: 1.5px solid #fbbf24;
}

.gear-condition.poor {
  border: 1.5px solid #f87171;
}

.gear-notes {
  margin: 0;
  font-style: italic;
  font-size: 0.875rem;
}

.empty-state {
  text-align: center;
  padding: 3rem 2rem;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  margin: 0 0 0.5rem;
  color: #000000 !important;
}

.empty-state p {
  margin: 0 0 1.5rem;
}

.loading-state {
  text-align: center;
  padding: 3rem 2rem;
  color: var(--text-muted);
}

.spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--input-border);
  border-top: 3px solid var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: 2px solid transparent;
  border-radius: 0.5rem;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
}

.btn-primary {
  background: var(--primary);
  color: var(--primary-contrast);
  border: 2px solid var(--primary);
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 0.95rem;
  box-shadow: none;
  transition: all 0.2s ease;
  padding: 0.75rem 1.5rem;
}

.btn-primary:hover, .btn-primary:focus {
  background: #1d4ed8;
  color: var(--primary-contrast);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
  transform: translateY(-1px);
  border-color: #1d4ed8;
}

.btn-secondary {
  background: var(--secondary);
  color: var(--secondary-contrast);
  border: 2px solid var(--secondary);
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 0.95rem;
  box-shadow: none;
  transition: all 0.2s ease;
  padding: 0.75rem 1.5rem;
}

.btn-secondary:hover, .btn-secondary:focus {
  background: #334155;
  color: var(--secondary-contrast);
  box-shadow: 0 2px 8px rgba(100, 116, 139, 0.2);
  transform: translateY(-1px);
  border-color: #334155;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.25rem;
  transition: background-color 0.2s ease;
}

.btn-edit:hover {
  background: #dbeafe;
}

.btn-delete:hover {
  background: #fee2e2;
}

.loading-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid transparent;
  border-top: 2px solid var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.form-actions {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
}

.message-container {
  position: fixed;
  top: 2rem;
  right: 2rem;
  z-index: 1000;
  max-width: 400px;
}

.message {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-radius: 0.5rem;
  margin-bottom: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.3s ease;
}

.message.success {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.message.error {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.message-icon {
  font-size: 1.2rem;
}

.message-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  margin-left: auto;
  opacity: 0.7;
}

.message-close:hover {
  opacity: 1;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
  overflow-y: auto;
}

.modal-content {
  background: #fff !important;
  border-radius: 0.7rem !important;
  border: 2.5px solid #2563eb !important;
  box-shadow: 0 8px 32px rgba(37,99,235,0.13) !important;
  color: #111 !important;
  max-width: 420px;
  min-width: 320px;
  width: 100%;
  max-width: 95vw;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 2rem 2rem 1.5rem 2rem;
  position: relative;
  z-index: 10000;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 1.5rem 1.1rem 1.5rem !important;
  border-bottom: 2px solid #2563eb !important;
  background: #f1f5ff !important;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.18rem;
  font-weight: 800;
  color: #111;
  flex: 1;
}

.modal-close {
  color: #64748b !important;
  font-size: 1.5rem;
  background: #fff;
  border: 2px solid #64748b;
  border-radius: 0.25rem;
  cursor: pointer;
  padding: 0.15rem 0.5rem 0.15rem 0.5rem;
  margin-left: 1rem;
  transition: background 0.15s, border-color 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  min-height: 2rem;
}

.modal-close:hover {
  background: #e0e7ff !important;
  border-color: #2563eb;
  color: #2563eb !important;
}

.modal-form {
  padding: 1.5rem 1.5rem 1rem 1.5rem !important;
  background: #fff !important;
}

.modal-form .form-group,
.modal-form .form-row {
  margin-bottom: 1.1rem !important;
}

.modal-form .form-label {
  font-weight: 700 !important;
  color: #222 !important;
  margin-bottom: 0.4rem !important;
  display: block;
  font-size: 1.01rem;
}

.modal-form .form-input,
.modal-form .form-textarea,
.modal-form select {
  width: 100%;
  padding: 0.7rem 1rem;
  border: 2px solid var(--border-medium) !important;
  border-radius: 0.5rem !important;
  font-size: 1.05rem;
  background: #fff !important;
  color: #000000 !important;
  box-shadow: var(--shadow-sm) !important;
  margin-top: 0.1rem;
  margin-bottom: 0.1rem;
  transition: all 0.18s;
}

.modal-form .form-input:focus,
.modal-form .form-textarea:focus,
.modal-form select:focus {
  border-color: #1746a2 !important;
  outline: none;
}

.modal-form .form-textarea {
  min-height: 70px;
  resize: vertical;
}

.modal-form .form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.7rem;
}

.modal-form .form-row .form-group {
  margin-bottom: 0 !important;
}

/* Full-width fields */
.modal-form .form-group-full {
  width: 100%;
}

/* 4 columns on wider screens */
@media (min-width: 768px) {
  .modal-form .form-row {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* On very wide screens, make modal wider to accommodate 4 columns */
@media (min-width: 1024px) {
  .modal-content {
    max-width: 800px !important;
  }
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.7rem;
  margin-top: 1.2rem;
  padding-top: 1rem;
  border-top: 2px solid #2563eb;
}

.modal-actions .btn-primary {
  background: #2563eb !important;
  color: #fff !important;
  border: 2px solid #1746a2 !important;
  border-radius: 0.5rem !important;
  font-weight: 800 !important;
  font-size: 1.08rem !important;
  box-shadow: none !important;
  padding: 0.8rem 2.1rem !important;
  letter-spacing: 0.01em;
  transition: background 0.18s, border-color 0.18s;
}

.modal-actions .btn-primary:hover,
.modal-actions .btn-primary:focus {
  background: #1746a2 !important;
  border-color: #2563eb !important;
}

.modal-actions .btn-secondary {
  background: #64748b !important;
  color: #fff !important;
  border: 2px solid #334155 !important;
  border-radius: 0.5rem !important;
  font-weight: 800 !important;
  font-size: 1.08rem !important;
  box-shadow: none !important;
  padding: 0.8rem 2.1rem !important;
  letter-spacing: 0.01em;
  transition: background 0.18s, border-color 0.18s;
}

.modal-actions .btn-secondary:hover,
.modal-actions .btn-secondary:focus {
  background: #334155 !important;
  border-color: #64748b !important;
}

.modal-actions .btn-warning {
  color: #ffffff !important;
}

.modal-actions .btn-warning:hover,
.modal-actions .btn-warning:focus {
  color: #ffffff !important;
  opacity: 0.9;
}

.modal-actions .btn-positive {
  color: #ffffff !important;
}

.modal-actions .btn-positive:hover,
.modal-actions .btn-positive:focus {
  color: #ffffff !important;
  opacity: 0.9;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .profile-container {
    padding: 1rem 0.5rem;
  }
  .profile-header {
    padding: 2rem 1rem;
  }
  .profile-title {
    font-size: 2rem;
  }
  .tab-navigation {
    flex-wrap: wrap;
  }
  .gear-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.3rem;
  }
  .gear-stats {
    flex-direction: row;
    justify-content: space-between;
    gap: 0.3rem;
    padding: 0.2rem 0.2rem;
  }
  .btn.btn-primary {
    width: 100%;
    font-size: 1rem;
    padding: 0.7rem 0;
    border-radius: 1.2rem;
  }
  .gear-grid {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  .gear-card {
    padding: 0.7rem;
    font-size: 0.95rem;
    border-radius: 0.5rem;
  }
  .badge {
    font-size: 0.93em;
    padding: 0.2em 0.7em;
    border-radius: 0.8em;
  }
  .message-container {
    position: static;
    margin: 1rem;
  }
}

.mobile-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.tab-navigation {
  scrollbar-width: thin;
}
.tab-button {
  min-width: 120px;
  font-size: 1.05rem;
}
@media (max-width: 600px) {
  .profile-header {
    padding: 1.2rem 0.5rem;
  }
  .profile-title {
    font-size: 1.3rem;
  }
  .content-card {
    padding: 1rem;
    border-radius: 0.7rem;
  }
  .gear-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  .gear-card {
    padding: 1rem;
    font-size: 0.98rem;
  }
  .form-input, .form-textarea {
    font-size: 0.98rem;
    padding: 0.6rem;
  }
  .btn, .btn-primary, .btn-secondary {
    width: 100%;
    font-size: 1.05rem;
    padding: 0.7rem 0;
  }
  .form-actions {
    flex-direction: column;
    gap: 0.7rem;
    align-items: stretch;
  }
  .modal-content {
    padding: 1rem 0.7rem 1rem 0.7rem;
    min-width: 0;
    max-width: 98vw;
    max-height: 95vh;
  }
}
/* Preferences Switch */
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  margin-left: 0.5rem;
  vertical-align: middle;
}
.switch input { display: none; }
.slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background: #e5e7eb;
  border-radius: 24px;
  transition: .2s;
}
.switch input:checked + .slider {
  background: #3b82f6;
}
.slider:before {
  position: absolute;
  content: '';
  height: 18px; width: 18px;
  left: 3px; bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: .2s;
}
.switch input:checked + .slider:before {
  transform: translateX(20px);
}
.pref-msg, .sec-msg {
  margin-top: 1rem;
  color: #22c55e;
  font-weight: 500;
  font-size: 1rem;
}
.sec-msg { color: #ef4444; }

/* Preferences save button - white styling */
.pref-form .btn-positive {
  background: white !important;
  color: #000000 !important;
  border: 2px solid #000000 !important;
  font-weight: 600 !important;
}

.pref-form .btn-positive:hover {
  background: #f8f9fa !important;
  color: #000000 !important;
  border-color: #000000 !important;
}

/* Security save button - white styling */
.security-form .btn-positive {
  background: white !important;
  color: #000000 !important;
  border: 2px solid #000000 !important;
  font-weight: 600 !important;
}

.security-form .btn-positive:hover {
  background: #f8f9fa !important;
  color: #000000 !important;
  border-color: #000000 !important;
}

/* Gear tab Add Gear button - white text for contrast */
.gear-header .btn-positive,
.empty-state .btn-positive {
  color: #ffffff !important;
  font-weight: 600 !important;
}

.gear-header .btn-positive:hover,
.empty-state .btn-positive:hover {
  color: #ffffff !important;
  opacity: 0.9;
}

/* Weight Input Group */
.weight-input-group {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.weight-input {
  flex: 1;
}

.weight-unit-select {
  min-width: 80px;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #ffffff;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
}

.weight-unit-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
</style>