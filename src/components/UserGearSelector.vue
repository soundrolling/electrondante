<template>
<div class="user-gear-selector">
  <!-- Header -->
  <div class="selector-header">
    <h3 class="selector-title">Add Team Gear</h3>
    <p class="selector-subtitle">Adding Team Gear shows a list of all gear associated with project members that have gear in their profiles as their own gear</p>
  </div>

  <!-- Search and Filters -->
  <div class="search-filters">
    <div class="search-container">
      <input 
        v-model="searchTerm" 
        class="search-input"
        placeholder="Search gear by name, type, or notes..."
        @input="debouncedSearch"
      />
      <span class="search-icon">🔍</span>
    </div>

    <div class="filter-group">
      <select v-model="selectedType" class="filter-select">
        <option value="">All Types</option>
        <option v-for="type in availableTypes" :key="type" :value="type">
          {{ type }}
        </option>
      </select>

      <select v-model="selectedCondition" class="filter-select">
        <option value="">All Conditions</option>
        <option value="excellent">Excellent</option>
        <option value="good">Good</option>
        <option value="fair">Fair</option>
        <option value="poor">Poor</option>
      </select>

      <select v-model="selectedTeamMember" class="filter-select">
        <option value="">All Team Members</option>
        <option v-for="member in availableTeamMembers" :key="member.user_id" :value="member.user_id">
          {{ member.full_name || member.email || 'Unknown' }}
        </option>
      </select>
    </div>
  </div>

  <!-- Loading State -->
  <div v-if="loading" class="loading-state">
    <div class="spinner"></div>
    <p>Loading gear from project users...</p>
  </div>

  <!-- Results -->
  <div v-else-if="searchResults.length > 0" class="results-container">
    <div class="results-header">
      <span class="results-count">{{ searchResults.length }} {{ searchResults.length === 1 ? 'item' : 'items' }} found</span>
    </div>

    <div class="gear-results">
      <div 
        v-for="item in searchResults" 
        :key="item.id"
        class="gear-result-item"
        :class="{ selected: selectedItems.includes(item.id) }"
      >
        <div class="gear-info">
          <div class="gear-main">
            <h4 class="gear-name">{{ item.gear_name }}</h4>
            <div class="gear-meta">
              <span class="gear-type">{{ item.gear_type || 'No type' }}</span>
              <span class="gear-quantity">Qty: {{ item.quantity }}</span>
              <span class="gear-condition" :class="item.condition">
                {{ item.condition }}
              </span>
            </div>
          </div>

          <div class="gear-owner">
            <div class="owner-label">Listed By:</div>
            <span class="owner-name">{{ item.listed_by_name || item.owner_name || 'Unknown' }}</span>
            <span v-if="item.listed_by_company" class="owner-company">
              {{ item.listed_by_company }}
            </span>
          </div>
        </div>

        <div class="gear-actions">
          <label class="checkbox-label">
            <input 
              type="checkbox" 
              :value="item.id"
              v-model="selectedItems"
              @change="updateSelection"
            />
            <span class="checkmark"></span>
          </label>
        </div>
      </div>
    </div>
  </div>

  <!-- Empty State -->
  <div v-else class="empty-state">
    <div class="empty-icon">🎛️</div>
    <h4>{{ allUserGear.length === 0 ? 'No gear found' : 'No gear found' }}</h4>
    <p>{{ allUserGear.length === 0 ? 'No users in this project have gear in their profiles' : 'Try adjusting your search terms or filters' }}</p>
  </div>

  <!-- Selected Items Summary -->
  <div v-if="selectedItems.length > 0" class="selected-summary">
    <div class="summary-header">
      <h4>Selected Items ({{ selectedItems.length }})</h4>
      <button class="btn btn-warning btn-sm" @click="clearSelection">
        Clear All
      </button>
    </div>
    
    <!-- Stage Assignment (Optional) -->
    <div v-if="locationsList && locationsList.length > 0" class="stage-assignment-section">
      <label class="stage-assignment-label">Assign to Stage (Optional):</label>
      <select v-model="selectedStageId" class="stage-select">
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
    
    <div class="selected-items">
      <div 
        v-for="item in selectedItemsData" 
        :key="item.id"
        class="selected-item"
      >
        <div class="selected-item-content">
          <span class="item-name">{{ item.gear_name }}</span>
          <span class="item-owner">{{ item.listed_by_name || item.owner_name }}</span>
        </div>
        <div class="selected-item-controls">
          <label class="quantity-label">
            <span>Qty:</span>
            <input
              type="number"
              class="quantity-input"
              v-model.number="selectedQuantities[item.id]"
              :min="1"
              :max="item.quantity || 0"
            />
            <span class="quantity-max">/ {{ item.quantity || 0 }} total</span>
          </label>
          <label v-if="selectedStageId" class="assign-label">
            <span>Assign:</span>
            <input
              type="number"
              class="assign-input"
              v-model.number="selectedAssignedAmounts[item.id]"
              :min="0"
              :max="selectedQuantities[item.id] || (item.quantity || 0)"
              placeholder="0"
            />
          </label>
          <button 
            class="remove-btn"
            @click="removeFromSelection(item.id)"
            title="Remove"
          >
            ×
          </button>
        </div>
      </div>
    </div>
    
    <!-- Add to Project Button at Bottom -->
    <div class="add-to-project-actions">
      <button 
        class="btn btn-positive"
        @click="addSelectedToProject"
      >
        Add {{ selectedItems.length }} {{ selectedItems.length === 1 ? 'Item' : 'Items' }} to Project
      </button>
    </div>
  </div>
</div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { UserGearService } from '../services/userGearService';
import { useUserStore } from '../stores/userStore';
import { useToast } from 'vue-toastification';
import { supabase } from '../supabase';

// Props
const props = defineProps({
projectId: {
  type: String,
  required: false,
  default: ''
},
locationsList: {
  type: Array,
  required: false,
  default: () => []
}
});

// Emits
const emit = defineEmits(['gear-selected', 'gear-added']);

// User Store
const userStore = useUserStore();
const toast = useToast();

// State
const loading = ref(false);
const searchTerm = ref('');
const selectedType = ref('');
const selectedCondition = ref('');
const selectedTeamMember = ref('');
const allUserGear = ref([]); // Store all user gear
const filteredGear = ref([]); // Filtered results to display
const selectedItems = ref([]);
const availableTypes = ref([]);
const availableTeamMembers = ref([]); // Store team members for filtering

// Add a map to track selected quantities by item id
const selectedQuantities = ref({});
// Track assigned amounts per item when stage is selected
const selectedAssignedAmounts = ref({});
// Selected stage for assignment
const selectedStageId = ref('');

// Computed - Filter gear based on search and filters
const searchResults = computed(() => {
  return filteredGear.value;
});

// Debounced search - now filters locally instead of querying
let searchTimeout = null;
const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    filterGear();
  }, 300);
};

// Computed
const selectedItemsData = computed(() => {
  return filteredGear.value.filter(item => selectedItems.value.includes(item.id));
});

// When an item is selected, initialize its quantity to 1 if not set
watch(selectedItems, (newVal, oldVal) => {
  for (const id of newVal) {
    if (!selectedQuantities.value[id]) {
      const item = filteredGear.value.find(i => i.id === id);
      if (item) {
        const totalQty = item.quantity || 0;
        selectedQuantities.value[id] = Math.min(1, Math.max(0, totalQty));
      } else {
        selectedQuantities.value[id] = 1;
      }
    }
    // Initialize assigned amount to 0 if stage is selected
    if (selectedStageId.value && !selectedAssignedAmounts.value[id]) {
      selectedAssignedAmounts.value[id] = 0;
    }
  }
  // Remove deselected items from the maps
  for (const id in selectedQuantities.value) {
    if (!newVal.includes(id)) {
      delete selectedQuantities.value[id];
      delete selectedAssignedAmounts.value[id];
    }
  }
});

// When stage is cleared, clear assigned amounts
watch(selectedStageId, (newVal) => {
  if (!newVal) {
    selectedAssignedAmounts.value = {};
  } else {
    // Initialize assigned amounts for all selected items
    selectedItems.value.forEach(id => {
      if (!selectedAssignedAmounts.value[id]) {
        selectedAssignedAmounts.value[id] = 0;
      }
    });
  }
});

// Methods
async function loadUserGear() {
  try {
    loading.value = true;
    
    // Get project ID from props or store
    const projectId = props.projectId || userStore.getCurrentProject?.id || null;
    
    if (!projectId) {
      console.error('Project ID not found. Props:', props.projectId, 'Store:', userStore.getCurrentProject);
      allUserGear.value = [];
      filteredGear.value = [];
      return;
    }
    
    console.log('Using project ID:', projectId);

    // Get project owner
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', projectId)
      .single();
    
    if (projectError) {
      console.error('Error fetching project:', projectError);
    }

    // Get all project members
    const { data: projectMembers, error: membersError } = await supabase
      .from('project_members')
      .select('user_id, user_email')
      .eq('project_id', projectId);
    
    if (membersError) {
      console.error('Error fetching project members:', membersError);
    }

    // Collect all user IDs: project owner + project members + current user
    const userIds = new Set();
    const currentUserId = userStore.user?.id;
    const currentUserEmail = userStore.userEmail || userStore.user?.email;
    
    console.log('Current user ID:', currentUserId);
    console.log('Current user email:', currentUserEmail);
    console.log('Project:', project);
    console.log('Project members:', projectMembers);
    
    // Always add current user if they're logged in
    if (currentUserId) {
      userIds.add(currentUserId);
      console.log('Added current user ID to list');
    }
    
    // Add project owner if exists
    if (project?.user_id) {
      userIds.add(project.user_id);
      console.log('Added project owner ID:', project.user_id);
    }
    
    // Add all project members with user_id
    if (projectMembers && projectMembers.length > 0) {
      projectMembers.forEach(m => {
        if (m.user_id) {
          userIds.add(m.user_id);
          console.log('Added project member ID:', m.user_id, 'email:', m.user_email);
        } else if (m.user_email && m.user_email.toLowerCase() === currentUserEmail?.toLowerCase()) {
          // If this member entry matches current user by email but has no user_id, 
          // we've already added currentUserId above, so we can skip
          console.log('Found matching project member by email:', m.user_email);
        }
      });
    }
    
    const userIdArray = Array.from(userIds);
    
    if (userIdArray.length === 0) {
      console.log('No valid user IDs found - showing empty state');
      allUserGear.value = [];
      filteredGear.value = [];
      filterGear();
      return;
    }
    
    console.log('Loading gear for user IDs:', userIdArray);

    // Try to use user_gear_view first (includes owner info)
    let gear = [];
    try {
      console.log('Attempting to query user_gear_view with user IDs:', userIdArray);
      const { data: gearData, error: viewError } = await supabase
        .from('user_gear_view')
        .select('*')
        .in('user_id', userIdArray)
        .order('gear_name');

      if (viewError) {
        console.error('Error querying user_gear_view:', viewError);
        throw viewError;
      }
      
      // If using view, we need to fetch profiles separately to get the listed_by_name
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, full_name, company')
        .in('user_id', userIdArray);

      const profileMap = {};
      if (profiles) {
        profiles.forEach(p => {
          profileMap[p.user_id] = {
            name: p.full_name || null,
            company: p.company || null
          };
        });
      }

      // Build email map from project members
      const emailMap = {};
      if (projectMembers) {
        projectMembers.forEach(m => {
          if (m.user_id) {
            emailMap[m.user_id] = m.user_email;
          }
        });
      }

      // Build team members list for filter dropdown
      const teamMembersList = [];
      userIdArray.forEach(userId => {
        const profile = profileMap[userId];
        const email = emailMap[userId];
        const memberEntry = projectMembers?.find(m => m.user_id === userId);
        
        if (profile || email || memberEntry) {
          teamMembersList.push({
            user_id: userId,
            full_name: profile?.name || null,
            email: email || memberEntry?.user_email || null
          });
        }
      });
      availableTeamMembers.value = teamMembersList.sort((a, b) => {
        const nameA = (a.full_name || a.email || '').toLowerCase();
        const nameB = (b.full_name || b.email || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      gear = (gearData || []).map(item => {
        const profile = profileMap[item.user_id];
        const email = emailMap[item.user_id];
        
        return {
          ...item,
          listed_by_name: profile?.name || email || item.owner_name || 'Unknown',
          listed_by_company: profile?.company || item.owner_company || null,
          // Keep owner_name from view for backwards compatibility
          owner_name: profile?.name || email || item.owner_name || 'Unknown',
          owner_company: profile?.company || item.owner_company || null
        };
      });
      
      console.log('Loaded gear from view:', gear.length, 'items');
      
      if (gear.length === 0) {
        console.warn('No gear found in user_gear_view, trying direct query as fallback');
        throw new Error('No results from view');
      }
    } catch (viewErr) {
      console.warn('user_gear_view not available or returned no results, using direct query:', viewErr);
      
      // Fallback: Get gear directly and fetch owner info separately
      console.log('Querying user_gear table directly for user IDs:', userIdArray);
      const { data: gearData, error: gearError } = await supabase
        .from('user_gear')
        .select('*')
        .in('user_id', userIdArray)
        .order('gear_name');

      if (gearError) {
        console.error('Error fetching gear from user_gear table:', gearError);
        throw gearError;
      }

      console.log('Loaded gear from direct query:', gearData?.length || 0, 'items');
      
      if (gearData && gearData.length > 0) {
        console.log('Sample gear item:', gearData[0]);
      } else {
        console.warn('No gear found in user_gear table for user IDs:', userIdArray);
      }

      // Fetch profiles to get listed by names for all users
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, full_name, company')
        .in('user_id', userIdArray);

      const profileMap = {};
      if (profiles) {
        profiles.forEach(p => {
          profileMap[p.user_id] = {
            name: p.full_name || null,
            company: p.company || null
          };
        });
      }

      // Build email map from project members
      const emailMap = {};
      if (projectMembers) {
        projectMembers.forEach(m => {
          if (m.user_id) {
            emailMap[m.user_id] = m.user_email;
          }
        });
      }
      
      // Also try to get emails from auth.users for project owner
      if (project?.user_id && !emailMap[project.user_id]) {
        // If we have the current user and it matches project owner, use their email
        if (currentUserId === project.user_id && userStore.userEmail) {
          emailMap[project.user_id] = userStore.userEmail;
        }
      }

      // Build team members list for filter dropdown
      const teamMembersList = [];
      userIdArray.forEach(userId => {
        const profile = profileMap[userId];
        const email = emailMap[userId];
        const memberEntry = projectMembers?.find(m => m.user_id === userId);
        
        if (profile || email || memberEntry) {
          teamMembersList.push({
            user_id: userId,
            full_name: profile?.name || null,
            email: email || memberEntry?.user_email || null
          });
        }
      });
      availableTeamMembers.value = teamMembersList.sort((a, b) => {
        const nameA = (a.full_name || a.email || '').toLowerCase();
        const nameB = (b.full_name || b.email || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      // Add "listed by" information to each gear item (the person who listed it in their profile)
      gear = (gearData || []).map(item => {
        const profile = profileMap[item.user_id];
        const email = emailMap[item.user_id];
        
        return {
          ...item,
          listed_by_name: profile?.name || email || 'Unknown',
          listed_by_company: profile?.company || null,
          // Keep owner_name for backwards compatibility/search
          owner_name: profile?.name || email || 'Unknown',
          owner_company: profile?.company || null
        };
      });
    }
    
    allUserGear.value = gear;
    
    // Initial filter (shows all gear)
    filterGear();
    
    // Load available types from all gear
    availableTypes.value = [...new Set(gear.map(g => g.gear_type).filter(Boolean))].sort();
  } catch (error) {
    console.error('Error loading user gear:', error);
    allUserGear.value = [];
    filteredGear.value = [];
  } finally {
    loading.value = false;
  }
}

// Filter gear locally based on search and filters
function filterGear() {
  let filtered = [...allUserGear.value];
  
  // Apply search filter
  if (searchTerm.value) {
    const search = searchTerm.value.toLowerCase();
    filtered = filtered.filter(item => 
      item.gear_name?.toLowerCase().includes(search) ||
      item.gear_type?.toLowerCase().includes(search) ||
      item.notes?.toLowerCase().includes(search) ||
      item.listed_by_name?.toLowerCase().includes(search) ||
      item.owner_name?.toLowerCase().includes(search)
    );
  }
  
  // Apply type filter
  if (selectedType.value) {
    filtered = filtered.filter(item => item.gear_type === selectedType.value);
  }
  
  // Apply condition filter
  if (selectedCondition.value) {
    filtered = filtered.filter(item => item.condition === selectedCondition.value);
  }
  
  // Apply team member filter
  if (selectedTeamMember.value) {
    filtered = filtered.filter(item => item.user_id === selectedTeamMember.value);
  }
  
  filteredGear.value = filtered;
}

// Watch filters to update results
watch([searchTerm, selectedType, selectedCondition, selectedTeamMember], () => {
  filterGear();
});

function updateSelection() {
  emit('gear-selected', selectedItemsData.value.map(item => ({ ...item, selectedQuantity: selectedQuantities.value[item.id] || 1 })));
}

async function addSelectedToProject() {
  if (selectedItemsData.value.length === 0) return;
  
  // Validate quantities don't exceed total quantity (but allow assignment to multiple projects)
  for (const item of selectedItemsData.value) {
    const selectedQty = selectedQuantities.value[item.id] || 1;
    const totalQuantity = item.quantity || 0;
    
    if (selectedQty > totalQuantity) {
      toast.error(`Cannot add ${selectedQty} of ${item.gear_name}. Total quantity is ${totalQuantity}.`)
      return; // Don't add if exceeds total owned
    }
  }
  
  // Check for date conflicts (warn but don't block)
  if (props.projectId && navigator.onLine) {
    try {
      // Get current project dates
      const { data: currentProject, error: projectError } = await supabase
        .from('projects')
        .select('id, project_name, build_days, main_show_days')
        .eq('id', props.projectId)
        .single();
      
      if (!projectError && currentProject) {
        const { checkGearAssignmentConflicts, formatConflictMessage } = await import('../utils/gearConflictHelper');
        
        for (const item of selectedItemsData.value) {
          const conflicts = await checkGearAssignmentConflicts(
            item.id,
            props.projectId,
            currentProject,
            supabase
          );
          
          if (conflicts.length > 0) {
            const conflictMsg = formatConflictMessage(conflicts, item.gear_name);
            toast.warning(conflictMsg, { timeout: 8000 });
          }
        }
      }
    } catch (err) {
      console.warn('Could not check for date conflicts:', err);
      // Don't block on conflict check errors
    }
  }
  
  // Emit array of { userGear, quantity, locationId, assignedAmount }
  const payload = selectedItemsData.value.map(item => {
    const quantity = selectedQuantities.value[item.id] || 1;
    const assignedAmount = selectedStageId.value ? (selectedAssignedAmounts.value[item.id] || 0) : 0;
    return {
      userGear: item,
      quantity: quantity,
      locationId: selectedStageId.value || null,
      assignedAmount: assignedAmount
    };
  });
  emit('gear-added', payload);
  clearSelection();
}

function clearSelection() {
  selectedItems.value = [];
  selectedQuantities.value = {};
  selectedAssignedAmounts.value = {};
  selectedStageId.value = '';
  updateSelection();
}

function removeFromSelection(itemId) {
  selectedItems.value = selectedItems.value.filter(id => id !== itemId);
  delete selectedQuantities.value[itemId];
  delete selectedAssignedAmounts.value[itemId];
  updateSelection();
}

// Lifecycle
onMounted(async () => {
  await loadUserGear();
});

// Watch for prop changes
watch(() => props.projectId, async () => {
  clearSelection();
  await loadUserGear();
});
</script>

<style scoped>
.user-gear-selector {
background: white;
border-radius: 0.75rem;
padding: 1.5rem;
box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.selector-header {
margin-bottom: 1.5rem;
}

.selector-title {
font-size: 1.25rem;
font-weight: 600;
color: #1e293b;
margin: 0 0 0.5rem;
}

.selector-subtitle {
color: #64748b;
margin: 0;
font-size: 0.875rem;
}

.search-filters {
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
min-width: 250px;
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.5rem;
  border: 1px solid var(--border-medium);
  border-radius: 0.5rem;
  font-size: 1rem;
  background: var(--bg-primary);
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
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
color: #64748b;
}

.filter-group {
display: flex;
gap: 0.5rem;
}

.filter-select {
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-medium);
  border-radius: 0.5rem;
  font-size: 1rem;
  background: var(--bg-primary);
  min-width: 120px;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
}

.filter-select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1), var(--shadow-sm);
}

.loading-state {
text-align: center;
padding: 2rem;
color: #64748b;
}

.spinner {
width: 2rem;
height: 2rem;
border: 3px solid #e2e8f0;
border-top: 3px solid #3b82f6;
border-radius: 50%;
animation: spin 1s linear infinite;
margin: 0 auto 1rem;
}

.results-container {
margin-bottom: 1.5rem;
}

.results-header {
display: flex;
justify-content: space-between;
align-items: center;
margin-bottom: 1rem;
}

.results-count {
font-size: 0.875rem;
color: #64748b;
}

.gear-results {
display: flex;
flex-direction: column;
gap: 0.75rem;
}

.gear-result-item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-6);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-xl);
  transition: all var(--transition-normal);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(20px);
}

.gear-result-item:hover {
  border-color: var(--text-link);
  box-shadow: var(--shadow-elevated);
  transform: translateY(-2px);
}

.gear-result-item.selected {
  border-color: var(--primary);
  background: var(--color-primary-50);
  box-shadow: var(--shadow-md);
}

.gear-info {
flex: 1;
display: flex;
justify-content: space-between;
align-items: flex-start;
}

.gear-main {
flex: 1;
}

.gear-name {
font-size: 1rem;
font-weight: 600;
color: #1e293b;
margin: 0 0 0.5rem;
}

.gear-meta {
display: flex;
gap: 1rem;
align-items: center;
font-size: 0.875rem;
color: #64748b;
}

.gear-type {
color: #3b82f6;
font-weight: 500;
}

.gear-quantity {
font-weight: 500;
}

.gear-condition {
padding: 0.25rem 0.5rem;
border-radius: 0.25rem;
font-size: 0.75rem;
font-weight: 500;
text-transform: capitalize;
}

.gear-condition.excellent {
background: #dcfce7;
color: #166534;
}

.gear-condition.good {
background: #dbeafe;
color: #1e40af;
}

.gear-condition.fair {
background: #fef3c7;
color: #92400e;
}

.gear-condition.poor {
background: #fee2e2;
color: #991b1b;
}

.gear-owner {
text-align: right;
font-size: 0.875rem;
display: flex;
flex-direction: column;
gap: 0.25rem;
}

.owner-label {
font-size: 0.75rem;
color: #64748b;
font-weight: 500;
text-transform: uppercase;
letter-spacing: 0.5px;
}

.owner-name {
display: block;
font-weight: 600;
color: #1e293b;
font-size: 0.9rem;
}

.owner-company {
display: block;
color: #64748b;
font-size: 0.75rem;
}

.gear-actions {
display: flex;
align-items: center;
}

.checkbox-label {
display: flex;
align-items: center;
cursor: pointer;
position: relative;
}

.checkbox-label input {
position: absolute;
opacity: 0;
cursor: pointer;
height: 0;
width: 0;
}

.checkmark {
height: 1.5rem;
width: 1.5rem;
background-color: white;
border: 2px solid #d1d5db;
border-radius: 0.25rem;
position: relative;
transition: all 0.2s ease;
}

.checkbox-label:hover input ~ .checkmark {
border-color: #3b82f6;
}

.checkbox-label input:checked ~ .checkmark {
background-color: #3b82f6;
border-color: #3b82f6;
}

.checkmark:after {
content: "";
position: absolute;
display: none;
left: 0.4rem;
top: 0.1rem;
width: 0.4rem;
height: 0.7rem;
border: solid white;
border-width: 0 2px 2px 0;
transform: rotate(45deg);
}

.checkbox-label input:checked ~ .checkmark:after {
display: block;
}

.empty-state,
.initial-state {
text-align: center;
padding: 2rem;
color: #64748b;
}

.empty-icon,
.initial-icon {
font-size: 3rem;
margin-bottom: 1rem;
}

.empty-state h4,
.initial-state h4 {
margin: 0 0 0.5rem;
color: #374151;
}

.empty-state p,
.initial-state p {
margin: 0;
font-size: 0.875rem;
}

.selected-summary {
margin-top: 1.5rem;
padding-top: 1.5rem;
border-top: 1px solid #e2e8f0;
}

.stage-assignment-section {
margin-bottom: 1rem;
padding: 0.75rem;
background: #f8fafc;
border-radius: 0.5rem;
border: 1px solid #e2e8f0;
}

.stage-assignment-label {
display: block;
font-weight: 500;
color: #1e293b;
margin-bottom: 0.5rem;
font-size: 0.875rem;
}

.stage-select {
width: 100%;
padding: 0.75rem 1rem;
border: 1px solid #e2e8f0;
border-radius: 0.5rem;
font-size: 0.875rem;
background: white;
cursor: pointer;
transition: all 0.2s ease;
}

.stage-select:focus {
outline: none;
border-color: #3b82f6;
box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.summary-header {
display: flex;
justify-content: space-between;
align-items: center;
margin-bottom: 1rem;
}

.summary-header h4 {
margin: 0;
font-size: 1rem;
color: #1e293b;
}

.selected-items {
display: flex;
flex-direction: column;
gap: 0.5rem;
}

.selected-item {
display: flex;
flex-direction: column;
gap: 0.75rem;
padding: 0.75rem;
background: #f8fafc;
border-radius: 0.5rem;
font-size: 0.875rem;
}

.selected-item-content {
display: flex;
align-items: center;
gap: 0.75rem;
flex: 1;
}

.selected-item-controls {
display: flex;
align-items: center;
gap: 0.75rem;
flex-wrap: wrap;
}

.item-name {
flex: 1;
font-weight: 500;
color: #1e293b;
}

.item-owner {
color: #64748b;
font-size: 0.75rem;
}

.remove-btn {
background: none;
border: none;
color: #ef4444;
cursor: pointer;
font-size: 1.2rem;
padding: 0.25rem;
border-radius: 0.25rem;
transition: background-color 0.2s ease;
}

.remove-btn:hover {
background: #fee2e2;
}

/* Buttons */
.btn {
display: inline-flex;
align-items: center;
gap: 0.5rem;
padding: 0.5rem 1rem;
border: none;
border-radius: 0.375rem;
font-size: 0.875rem;
font-weight: 500;
cursor: pointer;
transition: all 0.2s ease;
}

.btn-sm {
padding: 0.375rem 0.75rem;
font-size: 0.75rem;
}

.btn-primary {
background: #3b82f6;
color: white;
}

.btn-primary:hover {
background: #2563eb;
}

.btn-secondary {
background: #6b7280;
color: white;
}

.btn-secondary:hover {
background: #4b5563;
}

.btn-positive {
background: #047857;
color: white !important;
border-color: #065f46;
}

.btn-positive:hover {
background: #065f46;
border-color: #047857;
color: white !important;
box-shadow: 0 2px 8px rgba(4, 120, 87, 0.3);
}

/* Animations */
@keyframes spin {
to {
  transform: rotate(360deg);
}
}

/* Responsive Design */
@media (max-width: 768px) {
.search-filters {
  flex-direction: column;
}

.search-container {
  min-width: auto;
}

.filter-group {
  flex-direction: column;
}

.gear-info {
  flex-direction: column;
  gap: 0.5rem;
}

.gear-owner {
  text-align: left;
}

.gear-meta {
  flex-wrap: wrap;
  gap: 0.5rem;
}
}

.quantity-label {
display: flex;
align-items: center;
gap: 0.5rem;
font-size: 0.875rem;
}

.quantity-input {
border: 1px solid #e2e8f0;
border-radius: 0.25rem;
padding: 0.25rem 0.5rem;
font-size: 0.9em;
width: 60px;
text-align: center;
}

.quantity-max {
font-size: 0.75rem;
color: #64748b;
}

.assign-label {
display: flex;
align-items: center;
gap: 0.5rem;
font-size: 0.875rem;
}

.assign-input {
border: 1px solid #e2e8f0;
border-radius: 0.25rem;
padding: 0.25rem 0.5rem;
font-size: 0.9em;
width: 60px;
text-align: center;
}

.add-to-project-actions {
margin-top: 1rem;
padding-top: 1rem;
border-top: 1px solid #e2e8f0;
display: flex;
justify-content: center;
}

.add-to-project-actions .btn {
padding: 0.75rem 1.5rem;
font-size: 1rem;
min-width: 200px;
}
</style> 