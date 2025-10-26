<template>
<div class="trip-detail-container">
  <!-- Back Navigation -->
  <router-link
    :to="{ name: 'TravelDashboard', params: { id: projectId } }"
    class="back-link"
    aria-label="Back to trips dashboard"
  >
    <span class="arrow">←</span>
    <span class="back-text">Back to Trips</span>
  </router-link>

  <!-- Trip Header -->
  <div class="trip-header">
    <h1>{{ tripName || 'Trip Details' }}</h1>
    <p class="trip-dates">{{ tripDates }}</p>
    <p v-if="tripDestination" class="trip-destination">
      <span class="destination-label">Destination:</span> {{ tripDestination }}
    </p>
  </div>

  <!-- Tab Navigation -->
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

  <!-- Tab Content -->
  <div class="tab-content" role="tabpanel" :id="`${activeTab}-panel`">
    <component
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
      { key: 'parking', label: 'Parking', component: 'Parking' }
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
      parking: '🅿️'
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
  color: #1f2937;
  line-height: 1.5;
  background: #f8fafc;
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

/* Back Link */
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
  margin-bottom: 20px;
  padding: 8px 12px;
  border-radius: 8px;
  transition: all 0.2s ease;
  background: #eff6ff;
  border: 1px solid #dbeafe;
}

.back-link:hover {
  color: #1d4ed8;
  background: #dbeafe;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.back-link:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
}

.arrow {
  font-size: 18px;
  font-weight: bold;
}

.back-text {
  display: none;
}

/* Trip Header */
.trip-header {
  text-align: center;
  margin-bottom: 24px;
  background: #ffffff;
  padding: 24px 16px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
}

.trip-header h1 {
  font-size: 24px;
  color: #111827;
  font-weight: 700;
  margin: 0 0 8px 0;
  line-height: 1.4;
}

.trip-dates {
  color: #6b7280;
  margin: 0 0 8px 0;
  font-size: 16px;
  line-height: 1.5;
}

.trip-destination {
  font-size: 16px;
  color: #3b82f6;
  margin: 0;
  line-height: 1.5;
}

.destination-label {
  font-weight: 500;
  color: #6b7280;
}

/* Tab Navigation */
.tabs {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 24px;
  flex-wrap: wrap;
  background: #f1f5f9;
  border-radius: 12px;
  padding: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
}

.tab-btn {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  min-width: 44px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.tab-btn:hover {
  background: #f3f4f6;
  color: #374151;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.tab-btn:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
}

.tab-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
}

.tab-icon {
  font-size: 20px;
}

.tab-label {
  font-size: 12px;
  line-height: 1.2;
}

/* Tab Content */
.tab-content {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
  padding: 24px 20px;
  min-height: 200px;
}

/* Tablet Breakpoint (601px - 1024px) */
@media (min-width: 601px) {
  .trip-detail-container {
    padding: 24px;
  }
  
  .trip-header {
    padding: 32px 24px;
    margin-bottom: 32px;
  }
  
  .trip-header h1 {
    font-size: 28px;
  }
  
  .tabs {
    padding: 12px;
    margin-bottom: 32px;
  }
  
  .tab-btn {
    flex-direction: row;
    gap: 8px;
    padding: 12px 20px;
    font-size: 16px;
  }
  
  .tab-label {
    font-size: 14px;
  }
  
  .tab-content {
    padding: 24px 20px;
  }
  
  .back-text {
    display: inline;
  }
}

/* Desktop Breakpoint (1025px+) */
@media (min-width: 1025px) {
  .trip-detail-container {
    max-width: 1200px;
    padding: 32px;
  }
  
  .trip-header {
    padding: 40px 32px;
    margin-bottom: 40px;
  }
  
  .trip-header h1 {
    font-size: 32px;
  }
  
  .tabs {
    padding: 16px;
    margin-bottom: 40px;
  }
  
  .tab-btn {
    padding: 16px 24px;
    font-size: 16px;
  }
  
  .tab-content {
    padding: 32px 28px;
  }
}

/* Mobile-specific adjustments */
@media (max-width: 600px) {
  .trip-detail-container {
    padding: 12px;
  }
  
  .trip-header {
    padding: 20px 16px;
    margin-bottom: 20px;
  }
  
  .trip-header h1 {
    font-size: 22px;
  }
  
  .tabs {
    gap: 4px;
    padding: 6px;
    margin-bottom: 20px;
  }
  
  .tab-btn {
    padding: 10px 12px;
    font-size: 12px;
  }
  
  .tab-icon {
    font-size: 18px;
  }
  
  .tab-label {
    font-size: 10px;
  }
  
  .tab-content {
    padding: 16px 12px;
  }
  
  .back-link {
    width: 100%;
    justify-content: center;
    margin-bottom: 16px;
  }
}
</style> 