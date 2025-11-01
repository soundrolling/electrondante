<template>
<div class="list-view">
  <h2>Project Events</h2>
  
  <!-- Stage Hours Section -->
  <div v-if="stageHours && Object.keys(stageHours).length" class="stage-hours-section">
    <div class="stage-hours-header">
      <h3>Stage Hours Today</h3>
      <button class="btn btn-warning edit-stage-hours-btn" @click="editStageHours">
        ✏️ Edit Hours
      </button>
    </div>
    <div class="stage-hours-list">
      <div v-for="(hours, stageName) in stageHours" :key="stageName" class="stage-hour-card">
        <div class="stage-name">{{ stageName }}</div>
        <div class="hours-list">
          <div v-for="(hour, index) in hours" :key="index" class="hour-item">
            <span class="time-range">{{ hour.start_time }}–{{ hour.end_time }}</span>
            <span v-if="hour.notes" class="notes">{{ hour.notes.startsWith('Day') ? hour.notes : 'Day ' + hour.notes }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Events List -->
  <div class="events-section">
    <h3>Events</h3>
    <div class="schedule-list">
      <div
        v-for="evt in sortedEvents"
        :key="evt.category+'-'+evt.id"
        :class="['schedule-item', { 'recording-event': evt.category === 'recording', 'stage-hour-event': evt.isStageHour }]"
        :style="evt.category === 'recording' ? { borderLeft: '5px solid #ef4444', border: '1.5px solid #ef4444' } : { borderLeft: '5px solid '+getEventColor(evt) }"
      >
        <div class="event-badges-row">
          <span class="category-badge">
            <span class="category-icon">{{ getCategoryIcon(evt.category) }}</span>
            {{ getCategoryLabel(evt.category) }}
          </span>
          <button v-if="evt.isStageHour" class="btn btn-primary info-btn" @click="openInfoModal(evt)">ℹ️</button>
          <div class="cog-menu-wrapper">
            <button class="btn btn-warning cog-btn" @click="toggleCogMenu(evt)">⚙️</button>
            <div v-if="showCogMenuFor === evt.id" class="cog-menu" @mouseleave="closeCogMenu">
              <template v-if="!evt.isStageHour">
                <button class="btn btn-warning cog-menu-item" @click="openEditModal(evt)">Edit</button>
                <button class="btn btn-danger cog-menu-item delete" @click="deleteEvent(evt)">Delete</button>
              </template>
              <template v-else>
                <button class="btn btn-warning cog-menu-item" @click="goToProjectLocations(evt)">Edit in Project Locations</button>
              </template>
            </div>
          </div>
        </div>
        <div class="event-main-row">
          <div class="event-date-time">
            <div class="event-date">{{ formatDate(evt.event_date) }}</div>
            <div v-if="evt.end_date && evt.end_date !== evt.event_date" class="event-end-date">{{ formatDate(evt.end_date) }}</div>
            <div class="event-time">{{ formatTime(evt.start_time) }} – {{ formatTime(evt.end_time) }}</div>
            <div v-if="evt.end_date && evt.end_date !== evt.event_date" class="multi-day-badge">Multi-day</div>
          </div>
          <div class="event-info">
            <div class="event-title">
              <span v-html="evt.title"></span>
            </div>
            <div class="event-location">{{ getLocationName(evt.location_id) }}</div>
          </div>
        </div>
        
        <!-- Assigned Contacts Section -->
        <div v-if="isContactAssignable(evt) && evt.assigned_contacts && evt.assigned_contacts.length > 0" class="assigned-contacts-row">
          <div class="contacts-label">Assigned:</div>
          <div class="contacts-list">
            <div v-for="contactId in evt.assigned_contacts" :key="contactId" class="contact-chip">
              <div class="contact-avatar-small">
                {{ getContactInitial(contactId) }}
              </div>
              <span class="contact-name">{{ getContactName(contactId) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Info Modal for Stage Hour Events -->
  <div v-if="showInfoModal" class="modal-overlay" @click.self="closeInfoModal">
    <div class="modal">
      <h3>Stage Hour Details</h3>
      <div v-if="infoEvent">
        <p><strong>Stage:</strong> {{ getLocationName(infoEvent.location_id) }}</p>
        <p><strong>Date:</strong> {{ formatDate(infoEvent.event_date) }}</p>
        <p><strong>Time:</strong> {{ formatTime(infoEvent.start_time) }} – {{ formatTime(infoEvent.end_time) }}</p>
        <p v-if="infoEvent.notes"><strong>Notes:</strong> {{ infoEvent.notes }}</p>
      </div>
      <div class="modal-actions">
        <button class="btn btn-warning close-button" @click="closeInfoModal">Close</button>
      </div>
    </div>
  </div>

  <!-- Edit Modal for Regular Events -->
  <div v-if="showEditModal" class="modal-overlay" @click.self="closeEditModal">
    <div class="modal">
      <h3>Edit Event</h3>
      <form @submit.prevent="saveEdit">
        <div class="form-field">
          <label>Title</label>
          <input v-model="editEventData.title" type="text" required />
        </div>
        <div class="form-field">
          <label>Start Date</label>
          <input v-model="editEventData.event_date" type="date" required />
        </div>
        <div class="form-field">
          <label>Start Time</label>
          <input v-model="editEventData.start_time" type="time" required />
        </div>
        <div class="form-field">
          <label>End Date</label>
          <input v-model="editEventData.end_date" type="date" />
        </div>
        <div class="form-field">
          <label>End Time</label>
          <input v-model="editEventData.end_time" type="time" required />
        </div>
        <div class="form-field">
          <label>Category</label>
          <select v-model="editEventData.category" required>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.label }}</option>
          </select>
        </div>
        <div class="form-field">
          <label>Location</label>
          <select v-model="editEventData.location_id">
            <option :value="null">— None —</option>
            <option v-for="loc in locations" :key="loc.id" :value="loc.id">
              {{ getLocationName(loc.id) }}
            </option>
          </select>
        </div>
        <div class="form-field">
          <label>Notes</label>
          <textarea v-model="editEventData.notes" rows="2"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-positive save-button" type="submit">Save</button>
          <button class="btn btn-warning close-button" type="button" @click="closeEditModal">Cancel</button>
        </div>
      </form>
    </div>
  </div>
</div>
</template>

<script>
export default {
name: 'CalendarListView',
props: {
  sortedEvents: {
    type: Array,
    required: true
  },
  locations: {
    type: Array,
    required: true
  },
  stageHours: {
    type: Object,
    default: () => ({})
  },
  categories: {
    type: Array,
    required: true
  },
  getEventColor: {
    type: Function,
    required: true
  },
  contacts: {
    type: Array,
    default: () => []
  }
},
emits: ['event-click', 'edit', 'delete', 'edit-save', 'edit-stage-hours'],
data() {
  return {
    showInfoModal: false,
    infoEvent: null,
    showCogMenuFor: null,
    showEditModal: false,
    editEventData: null
  }
},
methods: {
  formatDate(ds) {
    if (!ds) return "";
    return new Date(ds).toLocaleDateString("en-US", {
      weekday:"short", month:"short", day:"numeric", year:"numeric"
    });
  },
  formatTime(ts) {
    return ts ? ts.slice(0,5) : "";
  },
  getLocationName(id) {
    const l = this.locations.find(x => x.id === id);
    return l ? `${l.venue_name} - ${l.stage_name}` : "—";
  },
  getCategoryLabel(categoryId) {
    const category = this.categories.find(c => c.id === categoryId);
    return category ? category.label : categoryId;
  },
  getCategoryIcon(categoryId) {
    const category = this.categories.find(c => c.id === categoryId);
    return category && category.icon ? category.icon : '';
  },
  openInfoModal(evt) {
    this.infoEvent = evt;
    this.showInfoModal = true;
  },
  closeInfoModal() {
    this.showInfoModal = false;
    this.infoEvent = null;
  },
  toggleCogMenu(evt) {
    this.showCogMenuFor = this.showCogMenuFor === evt.id ? null : evt.id;
  },
  closeCogMenu() {
    this.showCogMenuFor = null;
  },
  openEditModal(evt) {
    this.closeCogMenu();
    // Deep clone to avoid mutating the original event until save
    this.editEventData = JSON.parse(JSON.stringify(evt));
    this.showEditModal = true;
  },
  closeEditModal() {
    this.showEditModal = false;
    this.editEventData = null;
  },
  saveEdit() {
    this.$emit('edit-save', { ...this.editEventData });
    this.closeEditModal();
  },
  deleteEvent(evt) {
    this.closeCogMenu();
    this.$emit('delete', evt);
  },
  goToProjectLocations(evt) {
    this.closeCogMenu();
    // Assumes you have access to $router and projectId is available globally or via event
    const projectId = this.$route.params.id || (evt.project_id || evt.originalStageHour?.project_id);
    const stageId = evt.location_id || evt.originalStageHour?.stage_id;
    this.$router.push({
      name: 'ProjectLocations',
      params: { id: projectId },
      query: { stageId }
    });
  },
  isContactAssignable(evt) {
    return evt && (evt.category === 'calltimes' || evt.category === 'wraptimes');
  },
  getContactInitial(contactId) {
    const contact = this.contacts.find(c => c.id === contactId);
    if (!contact) return '?';
    const name = contact.name || contact.email || '?';
    return name.charAt(0).toUpperCase();
  },
  getContactName(contactId) {
    const contact = this.contacts.find(c => c.id === contactId);
    return contact ? (contact.name || 'Unnamed Contact') : 'Unknown Contact';
  },
  editStageHours() {
    this.$emit('edit-stage-hours');
  }
}
}
</script>

<style scoped>
.list-view {
padding: 10px;
box-sizing: border-box;
}

.stage-hours-section {
margin-bottom: 2rem;
padding: 1rem;
background: var(--bg-secondary);
border-radius: 8px;
border: 1px solid var(--border-light);
}

.stage-hours-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.stage-hours-header h3 {
margin: 0;
color: var(--text-secondary);
}

.edit-stage-hours-btn {
  font-size: 0.8rem;
  padding: 0.4rem 0.8rem;
}

.stage-hours-list {
display: flex;
flex-direction: column;
gap: 0.75rem;
}

.stage-hour-card {
background: var(--bg-primary);
padding: 0.75rem;
border-radius: 6px;
border: 1px solid var(--border-light);
}

.stage-name {
font-weight: 600;
margin-bottom: 0.5rem;
color: var(--text-secondary);
}

.hours-list {
display: flex;
flex-direction: column;
gap: 0.25rem;
}

.hour-item {
display: flex;
align-items: center;
gap: 0.5rem;
font-size: 0.9rem;
}

.time-range {
font-weight: 500;
color: var(--color-success-500);
}

.notes {
color: var(--text-secondary);
font-style: italic;
}

.events-section h3 {
margin: 0 0 1rem 0;
color: var(--text-secondary);
}

.schedule-list {
display: flex;
flex-direction: column;
gap: 0.75rem;
}

.schedule-item {
background: var(--bg-primary);
border: 1px solid var(--border-light);
border-radius: 4px;
padding: 14px 16px;
margin-bottom: 0.5rem;
transition: background 0.2s;
display: flex;
flex-direction: column;
gap: 0.5rem;
}

.schedule-item:hover {
background: var(--bg-secondary);
}

.event-badges-row {
display: flex;
align-items: center;
gap: 0.5rem;
margin-bottom: 0.25rem;
}

.category-badge {
display: inline-block;
padding: 0.2em 0.9em 0.2em 0.7em;
border-radius: 1.2em;
font-size: 0.97em;
font-weight: 600;
margin-right: 0.7em;
color: var(--text-heading) !important;
letter-spacing: 0.02em;
vertical-align: middle;
background: var(--bg-tertiary) !important;
transition: background 0.2s, color 0.2s;
}

.info-btn {
background: none;
border: none;
font-size: 1.1rem;
cursor: pointer;
margin-left: 0.25rem;
color: var(--color-success-500);
padding: 0 0.2rem;
}

.info-btn:hover {
color: var(--color-success-700);
}

.event-main-row {
display: flex;
flex-direction: row;
gap: 1.5rem;
align-items: flex-start;
}

.event-date-time {
min-width: 120px;
display: flex;
flex-direction: column;
align-items: flex-start;
gap: 0.2rem;
}

.event-date {
  font-weight: 700;
  font-size: 1rem;
}

.event-end-date {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-top: 0.1rem;
}

.multi-day-badge {
  font-size: 0.75rem;
  color: var(--color-warning-600);
  font-weight: 600;
  background: rgba(251, 191, 36, 0.15);
  padding: 0.2rem 0.5rem;
  border-radius: 3px;
  margin-top: 0.3rem;
  display: inline-block;
}

.event-time {
color: var(--text-secondary);
font-size: 0.95rem;
}

.event-info {
flex: 1;
display: flex;
flex-direction: column;
gap: 0.2rem;
}

.event-title {
font-size: 1.05rem;
font-weight: 600;
color: var(--text-primary);
word-break: break-word;
}

.event-location {
font-size: 0.95rem;
color: var(--text-secondary);
}

.stage-hour-event {
background-color: var(--bg-secondary);
}

/* Modal styles */
.modal-overlay {
position: fixed;
inset: 0;
background: rgba(0,0,0,0.5);
display: flex;
align-items: center;
justify-content: center;
z-index: 2000;
}

.modal {
background: var(--bg-primary);
padding: 1.25rem;
border-radius: 6px;
width: 100%;
max-width: 350px;
max-height: 90vh;
overflow-y: auto;
box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.modal h3 {
margin: 0 0 1rem;
font-size: 1.15rem;
}

.modal-actions {
display: flex;
justify-content: flex-end;
gap: 0.5rem;
margin-top: 1rem;
}

.button.close-button {
background: #bdc3c7;
color: #fff;
border: none;
padding: 0.5rem 1rem;
border-radius: 4px;
cursor: pointer;
transition: background 0.2s;
}

.button.close-button:hover {
background: #888;
}

.cog-menu-wrapper {
position: relative;
display: inline-block;
}
.cog-btn {
background: none;
border: none;
font-size: 1.1rem;
cursor: pointer;
margin-left: 0.25rem;
color: var(--text-secondary);
padding: 0 0.2rem;
}
.cog-btn:hover {
color: var(--text-primary);
}
.cog-menu {
position: absolute;
top: 1.5rem;
right: 0;
background: var(--bg-primary);
border: 1px solid var(--border-medium);
border-radius: 6px;
box-shadow: 0 2px 8px rgba(0,0,0,0.12);
min-width: 120px;
z-index: 10;
display: flex;
flex-direction: column;
}
.cog-menu-item {
padding: 0.5rem 1rem;
background: none;
border: none;
text-align: left;
font-size: 0.95rem;
cursor: pointer;
color: var(--text-primary);
transition: background 0.2s;
}
.cog-menu-item:hover {
background: var(--bg-secondary);
}
.cog-menu-item.delete {
color: var(--color-error-600);
}
.cog-menu-item.disabled {
color: var(--text-tertiary);
cursor: not-allowed;
}

.form-field {
margin-bottom: 0.75rem;
display: flex;
flex-direction: column;
}
.form-field label {
font-weight: 600;
margin-bottom: 0.3rem;
}
.form-field input,
.form-field textarea,
.form-field select {
padding: 0.45rem;
border: 1px solid var(--border-medium);
border-radius: 4px;
font-size: 0.95rem;
background: var(--bg-primary);
color: var(--text-primary);
}
.button.save-button {
background: #27ae60;
color: #fff;
border: none;
padding: 0.6rem 1rem;
border-radius: 4px;
cursor: pointer;
transition: background 0.2s;
}
.button.save-button:hover {
background: #219150;
}

.assigned-contacts-row {
margin-top: 0.5rem;
display: flex;
align-items: center;
gap: 0.5rem;
}

.contacts-label {
font-weight: 600;
color: var(--text-secondary);
}

.contacts-list {
display: flex;
align-items: center;
gap: 0.5rem;
}

.contact-chip {
display: flex;
align-items: center;
gap: 0.25rem;
}

.contact-avatar-small {
width: 20px;
height: 20px;
border-radius: 50%;
background-color: var(--color-secondary-500);
display: flex;
align-items: center;
justify-content: center;
font-size: 0.8rem;
font-weight: 600;
color: var(--text-inverse);
}

.contact-name {
font-size: 0.95rem;
color: var(--text-secondary);
}

.category-icon {
font-size: 1.1em;
margin-right: 0.3em;
vertical-align: middle;
}

.recording-event {
border: 1.5px solid #ef4444 !important;
border-left: 5px solid #ef4444 !important;
}
</style> 