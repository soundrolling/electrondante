<template>
<div class="user-gear-selector">
  <!-- Header -->
  <div class="selector-header">
    <h3 class="selector-title">Add User Gear to Project</h3>
    <p class="selector-subtitle">Search and add available gear from team members</p>
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
      <select v-model="selectedType" class="filter-select" @change="searchGear">
        <option value="">All Types</option>
        <option v-for="type in availableTypes" :key="type" :value="type">
          {{ type }}
        </option>
      </select>

      <select v-model="selectedCondition" class="filter-select" @change="searchGear">
        <option value="">All Conditions</option>
        <option value="excellent">Excellent</option>
        <option value="good">Good</option>
        <option value="fair">Fair</option>
        <option value="poor">Poor</option>
      </select>
    </div>
  </div>

  <!-- Loading State -->
  <div v-if="loading" class="loading-state">
    <div class="spinner"></div>
    <p>Searching available gear...</p>
  </div>

  <!-- Results -->
  <div v-else-if="searchResults.length > 0" class="results-container">
    <div class="results-header">
      <span class="results-count">{{ searchResults.length }} items found</span>
      <button 
        v-if="selectedItems.length > 0"
        class="btn btn-primary btn-sm"
        @click="addSelectedToProject"
      >
        Add {{ selectedItems.length }} to Project
      </button>
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
            <span class="owner-name">{{ item.owner_name || 'Unknown' }}</span>
            <span v-if="item.owner_company" class="owner-company">
              {{ item.owner_company }}
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
  <div v-else-if="hasSearched" class="empty-state">
    <div class="empty-icon">🎛️</div>
    <h4>No gear found</h4>
    <p>Try adjusting your search terms or filters</p>
  </div>

  <!-- Initial State -->
  <div v-else class="initial-state">
    <div class="initial-icon">🔍</div>
    <h4>Search for available gear</h4>
    <p>Enter a search term to find gear from team members</p>
  </div>

  <!-- Selected Items Summary -->
  <div v-if="selectedItems.length > 0" class="selected-summary">
    <div class="summary-header">
      <h4>Selected Items ({{ selectedItems.length }})</h4>
      <button class="btn btn-secondary btn-sm" @click="clearSelection">
        Clear All
      </button>
    </div>
    
    <div class="selected-items">
      <div 
        v-for="item in selectedItemsData" 
        :key="item.id"
        class="selected-item"
      >
        <span class="item-name">{{ item.gear_name }}</span>
        <span class="item-owner">{{ item.owner_name }}</span>
        <input
          type="number"
          class="quantity-input"
          v-model.number="selectedQuantities[item.id]"
          :min="1"
          :max="item.quantity"
          style="width: 60px; margin: 0 0.5rem;"
        />
        <span style="font-size:0.8em; color:#64748b;">/ {{ item.quantity }} available</span>
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
</div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { UserGearService } from '../services/userGearService';

// Props
const props = defineProps({
projectId: {
  type: String,
  required: true
}
});

// Emits
const emit = defineEmits(['gear-selected', 'gear-added']);

// State
const loading = ref(false);
const searchTerm = ref('');
const selectedType = ref('');
const selectedCondition = ref('');
const searchResults = ref([]);
const selectedItems = ref([]);
const availableTypes = ref([]);
const hasSearched = ref(false);

// Add a map to track selected quantities by item id
const selectedQuantities = ref({});

// Debounced search
let searchTimeout = null;
const debouncedSearch = () => {
clearTimeout(searchTimeout);
searchTimeout = setTimeout(() => {
  searchGear();
}, 300);
};

// Computed
const selectedItemsData = computed(() => {
return searchResults.value.filter(item => selectedItems.value.includes(item.id));
});

// When an item is selected, initialize its quantity to 1 if not set
watch(selectedItems, (newVal, oldVal) => {
for (const id of newVal) {
  if (!selectedQuantities.value[id]) {
    const item = searchResults.value.find(i => i.id === id);
    selectedQuantities.value[id] = item ? Math.min(1, item.quantity) : 1;
  }
}
// Remove deselected items from the map
for (const id in selectedQuantities.value) {
  if (!newVal.includes(id)) delete selectedQuantities.value[id];
}
});

// Methods
async function searchGear() {
if (!searchTerm.value && !selectedType.value && !selectedCondition.value) {
  searchResults.value = [];
  hasSearched.value = false;
  return;
}

try {
  loading.value = true;
  hasSearched.value = true;
  
  const results = await UserGearService.searchAvailableGear(
    searchTerm.value,
    selectedType.value,
    selectedCondition.value
  );
  
  searchResults.value = results;
} catch (error) {
  console.error('Error searching gear:', error);
  searchResults.value = [];
} finally {
  loading.value = false;
}
}

async function loadAvailableTypes() {
try {
  availableTypes.value = await UserGearService.getAvailableGearTypes();
} catch (error) {
  console.error('Error loading gear types:', error);
}
}

function updateSelection() {
emit('gear-selected', selectedItemsData.value.map(item => ({ ...item, selectedQuantity: selectedQuantities.value[item.id] || 1 })));
}

function addSelectedToProject() {
if (selectedItemsData.value.length === 0) return;
// Emit array of { userGear, quantity }
const payload = selectedItemsData.value.map(item => ({ userGear: item, quantity: selectedQuantities.value[item.id] || 1 }));
emit('gear-added', payload);
clearSelection();
}

function clearSelection() {
selectedItems.value = [];
selectedQuantities.value = {};
updateSelection();
}

function removeFromSelection(itemId) {
selectedItems.value = selectedItems.value.filter(id => id !== itemId);
delete selectedQuantities.value[itemId];
updateSelection();
}

// Lifecycle
onMounted(() => {
loadAvailableTypes();
});

// Watch for prop changes
watch(() => props.projectId, () => {
clearSelection();
searchResults.value = [];
hasSearched.value = false;
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
gap: 1rem;
margin-bottom: 1.5rem;
flex-wrap: wrap;
}

.search-container {
position: relative;
flex: 1;
min-width: 250px;
}

.search-input {
width: 100%;
padding: 0.75rem 1rem 0.75rem 2.5rem;
border: 2px solid #e2e8f0;
border-radius: 0.5rem;
font-size: 1rem;
transition: border-color 0.2s ease;
}

.search-input:focus {
outline: none;
border-color: #3b82f6;
box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
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
border: 2px solid #e2e8f0;
border-radius: 0.5rem;
font-size: 1rem;
background: white;
min-width: 120px;
}

.filter-select:focus {
outline: none;
border-color: #3b82f6;
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
gap: 1rem;
padding: 1rem;
border: 2px solid #e2e8f0;
border-radius: 0.5rem;
transition: all 0.2s ease;
background: white;
}

.gear-result-item:hover {
border-color: #3b82f6;
box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
}

.gear-result-item.selected {
border-color: #3b82f6;
background: #eff6ff;
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
}

.owner-name {
display: block;
font-weight: 500;
color: #374151;
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
align-items: center;
gap: 0.75rem;
padding: 0.75rem;
background: #f8fafc;
border-radius: 0.5rem;
font-size: 0.875rem;
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

.quantity-input {
border: 1px solid #e2e8f0;
border-radius: 0.25rem;
padding: 0.25rem 0.5rem;
font-size: 0.9em;
width: 60px;
text-align: center;
}
</style> 