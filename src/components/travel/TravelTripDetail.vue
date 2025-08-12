<template>
<div class="trip-detail-container">
  <router-link
    :to="{ name: 'TravelDashboard', params: { id: projectId } }"
    class="back-link"
  >
    <span class="arrow">←</span> Back to Trips
  </router-link>
  <div class="trip-header">
    <h1>{{ tripName || 'Trip Details' }}</h1>
    <p>{{ tripDates }}</p>
    <p v-if="tripDestination" class="trip-destination">Destination: {{ tripDestination }}</p>
  </div>
  <div class="tabs">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      :class="['tab-btn', { active: activeTab === tab.key }]"
      @click="activeTab = tab.key"
    >
      {{ tab.label }}
    </button>
  </div>
  <div class="tab-content">
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
}
}
</script>

<style scoped>
.trip-detail-container {
max-width: 900px;
margin: 32px auto;
background: #f8f9fa;
border-radius: 12px;
box-shadow: 0 2px 12px rgba(0,0,0,0.07);
border: 1.5px solid #e5e7eb;
padding: 32px 20px 24px 20px;
}
.trip-header {
text-align: center;
margin-bottom: 24px;
}
.trip-header h1 {
font-size: 2rem;
color: #1f2937;
font-weight: 700;
margin-bottom: 0.25em;
}
.trip-header p {
color: #64748b;
margin: 0.2em 0;
}
.trip-destination {
font-size: 1.1em;
color: #2563eb;
}
.tabs {
display: flex;
justify-content: center;
gap: 0.5rem;
margin-bottom: 24px;
flex-wrap: wrap;
}
.tab-btn {
background: #f1f5f9;
border: 1.5px solid #e5e7eb;
border-radius: 8px 8px 0 0;
padding: 10px 22px;
font-size: 1rem;
color: #222;
font-weight: 500;
cursor: pointer;
transition: background 0.2s, color 0.2s, border 0.2s;
outline: none;
}
.tab-btn.active {
background: #fff;
color: #2563eb;
border-bottom: 2.5px solid #2563eb;
font-weight: 700;
z-index: 2;
}
.tab-btn:not(.active):hover {
background: #e0e7ef;
color: #2563eb;
}
.tab-content {
background: #fff;
border-radius: 0 0 12px 12px;
box-shadow: 0 1px 4px rgba(0,0,0,0.04);
border: 1.5px solid #e5e7eb;
border-top: none;
padding: 24px 12px 12px 12px;
min-height: 200px;
}
@media (max-width: 700px) {
.trip-detail-container {
  padding: 10px 2px 12px 2px;
}
.tab-content {
  padding: 12px 2px 8px 2px;
}
}
.back-link {
display: inline-flex;
align-items: center;
gap: 0.4em;
font-size: 1rem;
color: #2563eb;
text-decoration: none;
font-weight: 500;
margin-bottom: 0.5em;
background: none;
border: none;
cursor: pointer;
transition: color 0.2s;
}
.back-link:hover {
color: #1d4ed8;
text-decoration: underline;
}
.arrow {
font-size: 1.2em;
margin-right: 0.2em;
}
</style> 