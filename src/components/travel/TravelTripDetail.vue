<template>
<div class="trip-detail-container">
  <!-- Consolidated Header Section -->
  <div class="consolidated-header">
    <!-- Row 1: Back Button and Title -->
    <div class="header-row-1">
      <router-link
        :to="{ name: 'TravelDashboard', params: { id: projectId } }"
        class="back-link"
        aria-label="Back to trips dashboard"
      >
        <span class="arrow">←</span>
        <span class="back-text">Back to Trips</span>
      </router-link>
      
      <div class="trip-title">
        <h1>{{ tripName || 'Trip Details' }}</h1>
        <p class="trip-dates">{{ tripDates }}</p>
        <p v-if="tripDestination" class="trip-destination">
          <span class="destination-label">Destination:</span> {{ tripDestination }}
        </p>
      </div>
    </div>
    
    <!-- Row 2: Tab Navigation -->
    <div class="header-row-2">
      <div class="tabs" role="tablist">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="['tab-btn', { active: activeTab === tab.key }]"
          @click="activeTab = tab.key"
          :aria-selected="activeTab === tab.key"
          :aria-controls="`${tab.key}-panel`"
          role="tab"
        >
          <span class="tab-icon">{{ getTabIcon(tab.key) }}</span>
          <span class="tab-label">{{ tab.label }}</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Tab Content -->
  <div class="tab-content" role="tabpanel" :id="`${activeTab}-panel`">
    <div v-if="activeTab === 'packing'" class="packing-link-section">
      <div class="packing-link-card">
        <div class="packing-link-icon">🎒</div>
        <h2>Packing & Repacking</h2>
        <p class="packing-link-description">
          Manage your packing bags and repacking checklist in the Project Gear section.
        </p>
        <router-link
          :to="{ name: 'ProjectPacking', params: { id: projectId } }"
          class="packing-link-button"
        >
          <span class="button-icon">🎒</span>
          <span class="button-text">Go to Packing</span>
        </router-link>
        <router-link
          :to="{ name: 'ProjectRepacking', params: { id: projectId } }"
          class="packing-link-button secondary"
        >
          <span class="button-icon">📋</span>
          <span class="button-text">Go to Repacking</span>
        </router-link>
      </div>
    </div>
    <component
      v-else
      :is="activeTabComponent"
      :trip-id="tripId"
      :id="projectId"
    />
  </div>
</div>
</template>

<script>
import Accommodations from './Accommodations.vue'
import FlightDetails from './FlightDetails.vue'
import Documents from './Documents.vue'
import Expenses from './Expenses.vue'
import Parking from './Parking.vue'

export default {
name: 'TravelTripDetail',
props: {
  projectId: { type: [String, Number], required: true },
  tripId: { type: [String, Number], required: true },
  tripName: { type: String, default: '' },
  tripDates: { type: String, default: '' },
  tripDestination: { type: String, default: '' }
},
components: {
  Accommodations,
  FlightDetails,
  Documents,
  Expenses,
  Parking
},
data() {
  return {
    tabs: [
      { key: 'accommodations', label: 'Accommodations', component: 'Accommodations' },
      { key: 'flights', label: 'Flights', component: 'FlightDetails' },
      { key: 'documents', label: 'Documents', component: 'Documents' },
      { key: 'expenses', label: 'Expenses', component: 'Expenses' },
      { key: 'parking', label: 'Parking', component: 'Parking' },
      { key: 'packing', label: 'Packing', component: 'Packing' }
    ],
    activeTab: 'accommodations'
  }
},
computed: {
  activeTabComponent() {
    const tab = this.tabs.find(t => t.key === this.activeTab)
    return tab ? tab.component : 'Accommodations'
  }
},
methods: {
  getTabIcon(key) {
    const icons = {
      accommodations: '🏨',
      flights: '✈️',
      documents: '📄',
      expenses: '💰',
      parking: '🅿️',
      packing: '🎒'
    }
    return icons[key] || '📋'
  }
}
}
</script>

<style scoped>
/* Mobile-first base styles */
.trip-detail-container {
  width: 100%;
  padding: 16px;
  margin: 0 auto;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: var(--text-primary);
  line-height: 1.5;
  background: var(--bg-secondary);
  min-height: 100vh;
}

/* Safe area margins for mobile devices */
@supports (padding: max(0px)) {
  .trip-detail-container {
    padding-left: max(16px, env(safe-area-inset-left));
    padding-right: max(16px, env(safe-area-inset-right));
    padding-top: max(16px, env(safe-area-inset-top));
    padding-bottom: max(16px, env(safe-area-inset-bottom));
  }
}

/* Consolidated Header Section */
.consolidated-header {
  background: var(--bg-primary);
  padding: 16px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-light);
  margin-bottom: 16px;
}

.header-row-1 {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.header-row-2 {
  width: 100%;
}

.trip-title {
  flex: 1;
  min-width: 0;
}

.trip-title h1 {
  font-size: 20px;
  color: var(--text-heading);
  font-weight: 700;
  margin: 0 0 4px 0;
  line-height: 1.3;
}

.trip-title .trip-dates {
  color: var(--text-secondary);
  margin: 0 0 4px 0;
  font-size: 14px;
  line-height: 1.4;
}

.trip-title .trip-destination {
  font-size: 14px;
  color: var(--color-primary-500);
  margin: 0;
  line-height: 1.4;
}

.trip-title .destination-label {
  font-weight: 500;
  color: var(--text-secondary);
}

/* Back Link */
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--color-primary-500);
  text-decoration: none;
  font-weight: 500;
  padding: 8px 12px;
  border-radius: 8px;
  transition: all 0.2s ease;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid var(--border-light);
  flex-shrink: 0;
  white-space: nowrap;
}

.back-link:hover {
  color: var(--color-primary-700);
  background: rgba(59, 130, 246, 0.15);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.back-link:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
}

.arrow {
  font-size: 16px;
  font-weight: bold;
}

.back-text {
  display: none;
}

/* Tab Navigation */
.tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  background: var(--bg-secondary);
  border-radius: 10px;
  padding: 6px;
  border: 1px solid var(--border-light);
}

.tab-btn {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-height: 44px;
  min-width: 44px;
  flex: 1;
}

.tab-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.tab-btn:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
}

.tab-btn.active {
  background: var(--color-primary-500);
  color: white;
  border-color: var(--color-primary-500);
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(59, 130, 246, 0.2);
}

.tab-icon {
  font-size: 18px;
}

.tab-label {
  font-size: 11px;
  line-height: 1.2;
}

/* Tab Content */
.tab-content {
  background: var(--bg-primary);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-light);
  padding: 16px;
  min-height: 200px;
}

/* Tablet Breakpoint (601px - 1024px) */
@media (min-width: 601px) {
  .trip-detail-container {
    padding: 20px;
  }

  .consolidated-header {
    padding: 16px 20px;
  }

  .trip-title h1 {
    font-size: 22px;
  }

  .trip-title .trip-dates,
  .trip-title .trip-destination {
    font-size: 15px;
  }

  .tabs {
    padding: 8px;
    gap: 6px;
    flex-wrap: nowrap;
  }

  .tab-btn {
    flex-direction: row;
    gap: 6px;
    padding: 10px 14px;
    flex: 1;
  }

  .tab-label {
    font-size: 13px;
  }

  .tab-content {
    padding: 20px;
  }

  .back-text {
    display: inline;
  }
}

/* Desktop Breakpoint (1025px+) */
@media (min-width: 1025px) {
  .trip-detail-container {
    max-width: 1400px;
    padding: 24px;
  }

  .consolidated-header {
    padding: 16px 24px;
    margin-bottom: 20px;
  }

  .header-row-1 {
    margin-bottom: 12px;
  }

  .trip-title h1 {
    font-size: 24px;
  }

  .trip-title .trip-dates,
  .trip-title .trip-destination {
    font-size: 15px;
  }

  .tabs {
    padding: 8px;
    gap: 8px;
    flex-wrap: nowrap;
  }

  .tab-btn {
    flex-direction: row;
    gap: 8px;
    padding: 10px 20px;
    flex: 1;
    justify-content: center;
  }

  .tab-icon {
    font-size: 18px;
  }

  .tab-label {
    font-size: 14px;
  }

  .tab-content {
    padding: 24px;
  }
}

/* Large Desktop Breakpoint (1440px+) */
@media (min-width: 1440px) {
  .trip-detail-container {
    max-width: 1600px;
    padding: 24px 32px;
  }
}

/* Mobile-specific adjustments */
@media (max-width: 600px) {
  .trip-detail-container {
    padding: 12px;
  }

  .consolidated-header {
    padding: 12px;
    margin-bottom: 12px;
  }

  .header-row-1 {
    gap: 10px;
    margin-bottom: 10px;
  }

  .trip-title h1 {
    font-size: 18px;
  }

  .trip-title .trip-dates,
  .trip-title .trip-destination {
    font-size: 13px;
  }

  .tabs {
    gap: 4px;
    padding: 4px;
  }

  .tab-btn {
    padding: 8px 6px;
    min-width: 0;
  }

  .tab-icon {
    font-size: 16px;
  }

  .tab-label {
    font-size: 10px;
  }

  .tab-content {
    padding: 12px;
    border-radius: 10px;
  }
}

/* Packing Link Section */
.packing-link-section {
  padding: 32px 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}

.packing-link-card {
  background: var(--bg-primary);
  border-radius: 16px;
  padding: 40px 28px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-light);
  text-align: center;
  max-width: 440px;
  width: 100%;
}

.packing-link-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.packing-link-card h2 {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: var(--text-primary);
}

.packing-link-description {
  font-size: 15px;
  color: var(--text-secondary);
  margin: 0 0 24px 0;
  line-height: 1.5;
}

.packing-link-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s ease;
  min-height: 44px;
  width: 100%;
  margin-bottom: 10px;
  box-sizing: border-box;
}

.packing-link-button:not(.secondary) {
  background-color: #047857;
  color: #ffffff !important;
  border: 2px solid #065f46;
}

.packing-link-button:not(.secondary):hover {
  background-color: #065f46;
  border-color: #065f46;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(4, 120, 87, 0.3);
}

.packing-link-button.secondary {
  background-color: #1e40af;
  color: #ffffff !important;
  border: 2px solid #1e3a8a;
}

.packing-link-button.secondary:hover {
  background-color: #1e3a8a;
  border-color: #1e3a8a;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(29, 78, 216, 0.3);
}

.packing-link-button .button-icon,
.packing-link-button .button-text {
  color: inherit;
}

.button-icon {
  font-size: 18px;
}

@media (min-width: 601px) {
  .packing-link-button {
    width: auto;
    min-width: 200px;
    margin-left: 6px;
    margin-right: 6px;
  }
}
</style> 