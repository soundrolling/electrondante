<template>
<div v-if="show" class="modal-overlay" @click.self="$emit('close')">
  <div class="modal">
    <template v-if="mode==='view'">
      <h3>{{ isStageHourEvent ? 'Stage Hours' : 'Event Details' }}</h3>
      <div class="event-category-display">
        <span class="category-badge" :style="{ backgroundColor: getCategoryColor(localEvent.category) }">
          {{ getCategoryLabel(localEvent.category) }}
        </span>
        <span v-if="isStageHourEvent" class="stage-hour-badge">Stage Hours</span>
      </div>
      <p><strong>Title:</strong> <span v-html="localEvent.title"></span></p>
      <p><strong>Start Date:</strong> {{ formatDate(localEvent.event_date) }}</p>
      <p><strong>Start Time:</strong> {{ formatTime(localEvent.start_time) }}</p>
      <p v-if="localEvent.end_date && localEvent.end_date !== localEvent.event_date"><strong>End Date:</strong> {{ formatDate(localEvent.end_date) }}</p>
      <p><strong>End Time:</strong> {{ formatTime(localEvent.end_time) }}</p>
      <p><strong>Location:</strong> {{ getLocationName(localEvent.location_id) }}</p>
      <p v-if="localEvent.notes"><strong>Notes:</strong> {{ localEvent.notes }}</p>
      
      <!-- Assigned Contacts Section -->
      <div v-if="isContactAssignable && localEvent.assigned_contacts && localEvent.assigned_contacts.length > 0" class="assigned-contacts">
        <h4>Assigned Contacts</h4>
        <div class="contact-list">
          <div v-for="contactId in localEvent.assigned_contacts" :key="contactId" class="contact-item">
            <div class="contact-avatar">
              {{ getContactInitial(contactId) }}
            </div>
            <div class="contact-info">
              <div class="contact-name">{{ getContactName(contactId) }}</div>
              <div class="contact-role">{{ getContactRole(contactId) }}</div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="modal-actions">
        <button v-if="!isStageHourEvent" class="btn btn-warning edit-button" @click="$emit('edit')">Edit</button>
        <button v-if="!isStageHourEvent" class="btn btn-danger delete-button" @click="$emit('delete')">Delete</button>
        <button class="btn btn-warning close-button" @click="$emit('save', localEvent)">Save</button>
      </div>
    </template>
    <template v-else>
      <h3>Edit Event</h3>
      <div class="form-field">
        <label>Category</label>
        <select v-model="localEvent.category">
          <option v-for="category in categories" :key="category.id" :value="category.id">
            {{ category.label }}
          </option>
        </select>
      </div>
      <div class="form-field">
        <label>Title</label>
        <input v-model="localEvent.title" type="text" />
      </div>
      <div class="form-field">
        <label>Start Date</label>
        <input v-model="localEvent.event_date" type="date" />
      </div>
      <div class="form-field">
        <label>Start Time</label>
        <input v-model="localEvent.start_time" type="time" />
      </div>
      <div class="form-field">
        <label>End Date</label>
        <input v-model="localEvent.end_date" type="date" />
      </div>
      <div class="form-field">
        <label>End Time</label>
        <input v-model="localEvent.end_time" type="time" />
      </div>
      <div class="form-field">
        <label>Location</label>
        <select v-model="localEvent.location_id">
          <option :value="null">— None —</option>
          <option v-for="loc in locations" :key="loc.id" :value="loc.id">
            {{ getStageLabel(loc) }}
          </option>
        </select>
      </div>
      
      <!-- Contact Assignment Section -->
      <div v-if="isContactAssignable" class="form-field">
        <label>Assign Contacts</label>
        <div class="contact-selection">
          <div v-for="contact in contacts" :key="contact.id" class="contact-option">
            <label class="checkbox-label">
              <input 
                type="checkbox" 
                :value="contact.id" 
                v-model="localEvent.assigned_contacts"
                class="contact-checkbox"
              />
              <div class="contact-option-content">
                <div class="contact-avatar-small">
                  {{ getContactInitial(contact.id) }}
                </div>
                <div class="contact-details">
                  <div class="contact-name">{{ contact.name || 'Unnamed Contact' }}</div>
                  <div class="contact-role">{{ contact.role }}</div>
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>
      
      <div class="form-field">
        <label>Notes</label>
        <textarea v-model="localEvent.notes" rows="2"></textarea>
      </div>
      <div class="modal-actions">
        <button class="btn btn-positive save-button" @click="$emit('save', localEvent)">Save</button>
        <button class="btn btn-warning close-button" @click="$emit('save', localEvent)">Close</button>
      </div>
    </template>
  </div>
</div>
</template>

<script>
export default {
name: 'EventDetailsModal',
props: {
  show: {
    type: Boolean,
    required: true
  },
  mode: {
    type: String,
    default: 'view'
  },
  event: {
    type: Object,
    required: true
  },
  locations: {
    type: Array,
    required: true
  },
  categories: {
    type: Array,
    required: true
  },
  contacts: {
    type: Array,
    default: () => []
  }
},
emits: ['close', 'edit', 'delete', 'save', 'cancel-edit'],
computed: {
  isStageHourEvent() {
    return this.event && this.event.isStageHour;
  },
  isContactAssignable() {
    return this.event && (this.event.category === 'calltimes' || this.event.category === 'wraptimes');
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
  getStageLabel(loc) {
    return loc ? `${loc.venue_name} - ${loc.stage_name}` : "Unknown";
  },
  getCategoryLabel(categoryId) {
    const category = this.categories.find(c => c.id === categoryId);
    return category ? category.label : categoryId;
  },
  getCategoryColor(categoryId) {
    const category = this.categories.find(c => c.id === categoryId);
    return category ? category.color : "#bdc3c7";
  },
  getContactName(contactId) {
    const contact = this.contacts.find(c => c.id === contactId);
    return contact ? (contact.name || 'Unnamed Contact') : 'Unknown Contact';
  },
  getContactRole(contactId) {
    const contact = this.contacts.find(c => c.id === contactId);
    return contact ? contact.role : '';
  },
  getContactInitial(contactId) {
    const contact = this.contacts.find(c => c.id === contactId);
    if (!contact) return '?';
    const name = contact.name || contact.email || '?';
    return name.charAt(0).toUpperCase();
  }
},
watch: {
  event: {
    handler(newVal) {
      this.localEvent = { ...newVal };
    },
    immediate: true,
    deep: true
  },
  show(newVal) {
    if (newVal && this.localEvent && !this.localEvent.assigned_contacts) {
      this.localEvent.assigned_contacts = [];
    }
  }
}
}
</script>

<style scoped>
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
background: #fff;
padding: 1.25rem;
border-radius: 6px;
width: 100%;
max-width: 500px;
max-height: 90vh;
overflow-y: auto;
box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.modal h3 {
margin: 0 0 1rem;
font-size: 1.25rem;
}
.event-category-display {
margin-bottom: 1rem;
display: flex;
gap: 0.5rem;
align-items: center;
}
.category-badge {
padding: 0.5rem 1rem;
border-radius: 20px;
color: #fff;
font-size: 0.875rem;
font-weight: 600;
text-transform: uppercase;
letter-spacing: 0.5px;
display: inline-block;
}
.stage-hour-badge {
padding: 0.25rem 0.5rem;
border-radius: 12px;
background: #6c757d;
color: #fff;
font-size: 0.75rem;
font-weight: 500;
text-transform: uppercase;
letter-spacing: 0.5px;
}

/* Assigned Contacts Styles */
.assigned-contacts {
margin: 1rem 0;
padding: 1rem;
background: #f8f9fa;
border-radius: 6px;
border: 1px solid #e9ecef;
}

.assigned-contacts h4 {
margin: 0 0 0.75rem 0;
font-size: 1rem;
color: #495057;
}

.contact-list {
display: flex;
flex-direction: column;
gap: 0.5rem;
}

.contact-item {
display: flex;
align-items: center;
gap: 0.75rem;
padding: 0.5rem;
background: #fff;
border-radius: 4px;
border: 1px solid #dee2e6;
}

.contact-avatar {
width: 32px;
height: 32px;
border-radius: 50%;
background: #3b82f6;
color: #fff;
display: flex;
align-items: center;
justify-content: center;
font-size: 0.875rem;
font-weight: 700;
flex-shrink: 0;
}

.contact-info {
flex: 1;
min-width: 0;
}

.contact-name {
font-weight: 600;
color: #212529;
margin-bottom: 0.125rem;
font-size: 0.9rem;
}

.contact-role {
font-size: 0.8rem;
color: #6c757d;
}

/* Contact Selection Styles */
.contact-selection {
max-height: 200px;
overflow-y: auto;
border: 1px solid #dee2e6;
border-radius: 4px;
padding: 0.5rem;
background: #fff;
}

.contact-option {
margin-bottom: 0.5rem;
}

.contact-option:last-child {
margin-bottom: 0;
}

.checkbox-label {
display: flex;
align-items: center;
gap: 0.75rem;
padding: 0.5rem;
border-radius: 4px;
cursor: pointer;
transition: background-color 0.2s;
}

.checkbox-label:hover {
background: #f8f9fa;
}

.contact-checkbox {
margin: 0;
width: 16px;
height: 16px;
accent-color: #3b82f6;
}

.contact-option-content {
display: flex;
align-items: center;
gap: 0.75rem;
flex: 1;
}

.contact-avatar-small {
width: 28px;
height: 28px;
border-radius: 50%;
background: #3b82f6;
color: #fff;
display: flex;
align-items: center;
justify-content: center;
font-size: 0.75rem;
font-weight: 700;
flex-shrink: 0;
}

.contact-details {
flex: 1;
min-width: 0;
}

.contact-details .contact-name {
font-weight: 600;
color: #212529;
margin-bottom: 0.125rem;
font-size: 0.875rem;
}

.contact-details .contact-role {
font-size: 0.75rem;
color: #6c757d;
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
border: 1px solid #ccd0d5;
border-radius: 4px;
font-size: 0.95rem;
}
.modal-actions {
display: flex;
justify-content: flex-end;
gap: 0.5rem;
margin-top: 1rem;
}
.modal-actions button {
color: #fff !important;
}
.button {
background: #27ae60;
color: #fff;
border: none;
padding: 0.6rem 1rem;
border-radius: 4px;
cursor: pointer;
transition: background 0.2s;
}
.button:hover {
background: #219150;
}
.edit-button {
background: #3498db;
color: #fff !important;
}
.edit-button:hover {
background: #2980b9;
color: #fff !important;
}
.delete-button {
background: #e74c3c;
color: #fff !important;
}
.delete-button:hover {
background: #c0392b;
color: #fff !important;
}
.save-button {
background: #27ae60;
color: #fff !important;
}
.save-button:hover {
background: #219150;
color: #fff !important;
}
.cancel-button {
background: #bdc3c7;
color: #fff !important;
}
.cancel-button:hover {
background: #a6a6a6;
color: #fff !important;
}
.close-button {
background: #27ae60;
color: #fff !important;
}
.close-button:hover {
background: #219150;
color: #fff !important;
}
</style> 