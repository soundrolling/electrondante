<template>
<div v-if="show" class="modal-overlay" @click.self="$emit('close')">
  <div class="modal">
    <h3>New Event</h3>
    <div class="form-field">
      <label>Category</label>
      <select v-model="newEvent.category">
        <option v-for="category in categories" :key="category.id" :value="category.id">
          {{ category.label }}
        </option>
      </select>
    </div>
    <div class="form-field">
      <label>Title</label>
      <input v-model="newEvent.title" type="text" />
    </div>
    <div class="form-field">
      <label>Start Date</label>
      <input v-model="newEvent.event_date" type="date" />
    </div>
    <div class="form-field">
      <label>Start Time</label>
      <input v-model="newEvent.start_time" type="time" />
    </div>
    <div class="form-field">
      <label>End Date</label>
      <input v-model="newEvent.end_date" type="date" />
    </div>
    <div class="form-field">
      <label>End Time</label>
      <input v-model="newEvent.end_time" type="time" />
    </div>
    <div class="form-field">
      <label>Location</label>
      <select v-model="newEvent.location_id">
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
              v-model="newEvent.assigned_contacts"
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
      <textarea v-model="newEvent.notes" rows="2"></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn btn-positive save-button" @click="handleCreate">Save</button>
      <button class="btn btn-warning cancel-button" @click="$emit('close')">Cancel</button>
    </div>
  </div>
</div>
</template>

<script>
export default {
name: 'NewEventModal',
props: {
  show: {
    type: Boolean,
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
emits: ['close', 'create'],
data() {
  return {
    newEvent: {
      category: "calltimes",
      event_date: "",
      start_time: "",
      end_date: "",
      end_time: "",
      title: "",
      location_id: null,
      notes: "",
      assigned_contacts: []
    }
  }
},
computed: {
  isContactAssignable() {
    return this.newEvent && (this.newEvent.category === 'calltimes' || this.newEvent.category === 'wraptimes');
  }
},
methods: {
  getStageLabel(loc) {
    return loc ? `${loc.venue_name} - ${loc.stage_name}` : "Unknown";
  },
  getContactInitial(contactId) {
    const contact = this.contacts.find(c => c.id === contactId);
    if (!contact) return '?';
    const name = contact.name || contact.email || '?';
    return name.charAt(0).toUpperCase();
  },
  handleCreate() {
    console.log('[NewEventModal] Creating event with data:', this.newEvent);
    this.$emit('create', this.newEvent);
  }
},
watch: {
  show(newVal) {
    if (newVal) {
      // Reset form when modal opens
      this.newEvent = {
        category: "calltimes",
        event_date: "",
        start_time: "",
        end_date: "",
        end_time: "",
        title: "",
        location_id: null,
        notes: "",
        assigned_contacts: []
      };
      console.log('[NewEventModal] Modal opened, form reset');
    }
  }
},
mounted() {
  console.log('[NewEventModal] Component mounted');
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
background: var(--bg-primary);
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
color: var(--text-heading);
}

/* Contact Selection Styles */
.contact-selection {
max-height: 200px;
overflow-y: auto;
border: 1px solid var(--border-light);
border-radius: 4px;
padding: 0.5rem;
background: var(--bg-primary);
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
background: var(--bg-secondary);
}

.contact-checkbox {
margin: 0;
width: 16px;
height: 16px;
accent-color: var(--color-primary-500);
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
background: var(--color-primary-500);
  color: var(--text-inverse);
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
color: var(--text-primary);
margin-bottom: 0.125rem;
font-size: 0.875rem;
}

.contact-details .contact-role {
font-size: 0.75rem;
color: var(--text-secondary);
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
.modal-actions {
display: flex;
justify-content: flex-end;
gap: 0.5rem;
margin-top: 1rem;
}
.button {
background: var(--color-success-500);
  color: var(--text-inverse);
border: none;
padding: 0.6rem 1rem;
border-radius: 4px;
cursor: pointer;
transition: background 0.2s;
}
.button:hover {
background: var(--color-success-600);
}
.save-button {
background: var(--color-success-500);
}
.cancel-button {
background: var(--color-secondary-400);
}
</style> 