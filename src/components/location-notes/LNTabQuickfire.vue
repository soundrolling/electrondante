<!-- src/components/location-notes/LNTabQuickfire.vue -->
<template>
<section class="pane">
  <p class="info">
    Create coloured “quick” note buttons for this stage.  
    Tap a button and a new note opens with the preset text + current timestamp.
  </p>

  <!-- button grid -->
  <div class="grid">
    <button
      v-for="b in buttons"
      :key="b.id"
      class="qf"
      :style="{ '--bg': b.color, '--fg': contrast(b.color) }"
      @click="$emit('quick', b.note)"
    >
      {{ b.name }}
    </button>
  </div>

  <!-- add-toggle -->
  <button class="btn btn-positive mini primary add" @click="open = !open">
    Add button
  </button>

  <!-- Modal overlay -->
  <div v-if="open" class="modal-overlay" @click="resetForm">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h4>{{ editIdx !== null ? 'Edit' : 'Add' }} Quickfire Button</h4>
        <button class="btn btn-warning modal-close" @click="resetForm">×</button>
      </div>
      <form @submit.prevent="save" class="modal-body">
        <div class="form-field">
          <label>Name*</label>
          <input v-model="form.name" placeholder="Enter button name" required />
        </div>
        <div class="form-field">
          <label>Colour*</label>
          <select v-model="form.color" required>
            <option disabled value="">Select a colour</option>
            <option v-for="c in colours" :key="c.value" :value="c.value">
              {{ c.name }}
            </option>
          </select>
        </div>
        <div class="form-field">
          <label>Note text*</label>
          <input v-model="form.note" placeholder="Enter note text" required />
        </div>
        <p v-if="err" class="error-text">{{ err }}</p>
      </form>
      <div class="modal-footer">
        <button class="btn btn-warning cancel-btn" type="button" @click="resetForm">Cancel</button>
        <button class="btn btn-positive save-btn" @click="save" :disabled="busy">
          {{ busy ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </div>
  </div>

  <!-- table -->
  <div class="table-scroll" v-if="buttons.length">
  <table class="table">
    <thead>
      <tr>
        <th>Name</th>
        <th>Note</th>
        <th>Colour</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(b,i) in buttons" :key="b.id">
        <td>{{ b.name }}</td>
        <td>{{ b.note }}</td>
        <td>
          <span
            class="pill"
            :style="{ background: b.color, color: contrast(b.color) }"
          >
            {{ colourName(b.color) }}
          </span>
        </td>
        <td class="actions">
          <!-- EDIT -->
          <button
            class="btn btn-warning icon edit"
            @click="edit(i)"
            title="Edit"
          >
            <svg xmlns="http://www.w3.org/2000/svg"
                 class="icon-svg"
                 viewBox="0 0 20 20"
                 fill="currentColor">
              <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"/>
              <path fill-rule="evenodd"
                    d="M2 15.5A1.5 1.5 0 013.5 14H5v1.5a.5.5 0 01-.5.5H2.5a.5.5 0 01-.5-.5zm11.293-9.793L10.5 2.914A1 1 0 009.793 2.207l-7 7V11h1.879l7-7a1 1 0 00-.379-1.293z"
                    clip-rule="evenodd"/>
            </svg>
          </button>

          <!-- DELETE -->
          <button
            class="btn btn-danger icon delete"
            @click="remove(b.id,i)"
            title="Delete"
          >
            <svg xmlns="http://www.w3.org/2000/svg"
                 class="icon-svg"
                 viewBox="0 0 20 20"
                 fill="currentColor">
              <path fill-rule="evenodd"
                    d="M6 2a1 1 0 00-1 1v1H3.5a.5.5 0 000 1H4v10.5a1.5 1.5 0 001.5 1.5h9a1.5 1.5 0 001.5-1.5V5h.5a.5.5 0 000-1H15V3a1 1 0 00-1-1H6zm3 4a.5.5 0 011 0v8a.5.5 0 01-1 0V6zm3 0a.5.5 0 011 0v8a.5.5 0 01-1 0V6z"
                    clip-rule="evenodd"/>
            </svg>
          </button>
        </td>
      </tr>
    </tbody>
  </table>
  </div>
</section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Swal            from 'sweetalert2'
import { useToast }    from 'vue-toastification'
import { useUserStore }from '@/stores/userStore'
import {
fetchTableData,
mutateTableData
} from '@/services/dataService'

const props = defineProps({ locationId: String })
const store = useUserStore()
const toast = useToast()

/* state */
const buttons = ref([])
const open    = ref(false)
const editIdx = ref(null)
const form    = ref({ name:'', color:'', note:'' })
const busy    = ref(false)
const err     = ref(null)

const colours = [
{ name:'Red',    value:'#ff4d4f' },
{ name:'Orange', value:'#fa8c16' },
{ name:'Yellow', value:'#fadb14' },
{ name:'Green',  value:'#52c41a' },
{ name:'Blue',   value:'#1890ff' },
{ name:'Purple', value:'#722ed1' }
]
const contrast = c => {
const [r,g,b] = c.replace('#','').match(/.{2}/g).map(h=>parseInt(h,16))
return (r*299 + g*587 + b*114)/1000 < 128 ? '#fff' : '#000'
}
const colourName = v =>
colours.find(c => c.value === v)?.name || v

async function fetchAll(){
buttons.value = await fetchTableData(
  'quickfire_buttons',
  { eq:{ location_id: props.locationId }}
)
}
function resetForm(){
form.value = { name:'', color:'', note:'' }
editIdx.value = null
open.value = false
err.value = null
}
async function save(){
if (!form.value.name || !form.value.color || !form.value.note) {
  err.value = 'All fields are required'
  return
}
err.value = null
busy.value = true
try {
  if (editIdx.value !== null) {
    await mutateTableData(
      'quickfire_buttons','update',
      { id: buttons.value[editIdx.value].id, ...form.value }
    )
  } else {
    await mutateTableData(
      'quickfire_buttons','insert',
      { ...form.value,
        location_id: props.locationId,
        project_id: store.getCurrentProject?.id
      }
    )
  }
  await fetchAll()
  resetForm()
  toast.success('Saved')
} catch(e) {
  err.value = e.message
} finally {
  busy.value = false
}
}
function edit(i){
editIdx.value = i
form.value = { ...buttons.value[i] }
open.value = true
}
async function remove(id,i){
const ok = (
  await Swal.fire({
    title: 'Delete?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33'
  })
).isConfirmed
if (!ok) return
await mutateTableData('quickfire_buttons','delete',{ id })
buttons.value.splice(i,1)
toast.success('Deleted')
}
onMounted(fetchAll)
</script>

<style scoped>
/* Using global CSS variables from index.css - these respond to dark mode */
.pane {
background: var(--bg-primary);
padding: 32px;
border-radius: 16px;
box-shadow: var(--shadow-md);
border: 1px solid var(--border-light);
max-width: 1200px;
margin: 0 auto;
}
.info {
font-size: 0.9rem;
color: var(--text-secondary);
margin-bottom: 12px;
}
.grid {
display: grid;
grid-template-columns: repeat(auto-fill, minmax(140px,1fr));
gap: 20px;
margin-bottom: 24px;
padding: 20px;
background: var(--bg-secondary);
border-radius: 12px;
border: 1px solid var(--border-light);
backdrop-filter: blur(10px);
}
@media (max-width: 480px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
/* quickfire buttons */
.qf {
--bg: var(--bg-secondary); /* Uses theme background */
--fg: var(--text-primary); /* Uses theme text color */
background: var(--bg) !important;
color: var(--fg) !important;
border: 2px solid var(--border-medium);
border-radius: 16px;
padding: 24px 16px;
font-weight: 700;
font-size: 1rem;
text-align: center;
cursor: pointer;
box-shadow: var(--shadow-sm);
transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), filter 0.3s cubic-bezier(0.4, 0, 0.2, 1);
backdrop-filter: blur(10px);
}
.qf:hover {
  background: var(--bg-tertiary) !important;
  color: var(--fg) !important;
  border-color: var(--border-dark) !important;
  transform: translateY(-4px) scale(1.02);
  box-shadow: var(--shadow-md);
  filter: saturate(1.05);
}
.qf:active {
  background: var(--bg) !important;
  color: var(--fg) !important;
  transform: translateY(-2px) scale(0.98);
}
/* add-toggle */
.add {
display: block;
margin-bottom: 12px;
}
.mini {
background: none;
border: none;
color: var(--color-primary-500);
font-size: 0.85rem;
cursor: pointer;
}
.mini.primary {
background: var(--color-success-500);
color: var(--text-inverse);
border-radius: 6px;
padding: 6px 14px;
transition: background .2s;
}
.mini.primary:hover:not(:disabled) {
background: var(--color-success-600);
}

/* High-contrast base button classes for consistency within location-notes */
.btn.btn-positive {
  background-color: var(--color-success-600) !important;
  color: var(--text-inverse) !important;
  border: 2px solid var(--color-success-700) !important;
  font-weight: 700;
}
.btn.btn-positive svg,
.btn.btn-positive .icon-svg {
  color: var(--text-inverse) !important;
  fill: var(--text-inverse) !important;
  stroke: var(--text-inverse) !important;
}
.btn.btn-warning {
  background-color: var(--color-warning-500) !important;
  color: var(--text-inverse) !important;
  border: 2px solid var(--color-warning-600) !important;
  font-weight: 700;
}
.btn.btn-warning svg,
.btn.btn-warning .icon-svg {
  color: var(--text-inverse) !important;
  fill: var(--text-inverse) !important;
  stroke: var(--text-inverse) !important;
}
.btn.btn-danger {
  background-color: var(--color-error-500) !important;
  color: var(--text-inverse) !important;
  border: 2px solid var(--color-error-600) !important;
  font-weight: 700;
}
.btn.btn-danger svg,
.btn.btn-danger .icon-svg {
  color: var(--text-inverse) !important;
  fill: var(--text-inverse) !important;
  stroke: var(--text-inverse) !important;
}
/* modal */
.modal-overlay {
position: fixed;
top: 0;
left: 0;
right: 0;
bottom: 0;
background: rgba(0, 0, 0, 0.5);
display: flex;
align-items: center;
justify-content: center;
z-index: 1000;
}
.modal-content {
background: var(--bg-primary);
border-radius: 12px;
box-shadow: var(--shadow-lg);
max-width: 500px;
width: 90%;
max-height: 90vh;
overflow-y: auto;
border: 1px solid var(--border-light);
}
.modal-header {
display: flex;
justify-content: space-between;
align-items: center;
padding: 20px 24px 0;
}
.modal-header h4 {
margin: 0;
font-size: 1.25rem;
font-weight: 600;
color: var(--text-heading);
}
.modal-close {
background: var(--color-warning-500);
color: var(--text-inverse);
border: 1px solid var(--color-warning-600);
font-size: 1.5rem;
cursor: pointer;
padding: 4px;
border-radius: 4px;
transition: background .2s;
}
.modal-close:hover {
background: var(--color-warning-600);
}
.modal-body {
padding: 20px 24px;
}
.modal-footer {
display: flex;
justify-content: flex-end;
gap: 12px;
padding: 0 24px 20px;
}
.form-field {
display: flex;
flex-direction: column;
gap: 6px;
margin-bottom: 16px;
}
.form-field label {
font-size: 0.9rem;
font-weight: 600;
color: var(--text-secondary);
}
.form-field input,
.form-field select {
border: 1px solid var(--border-medium);
border-radius: 6px;
padding: 8px;
font-size: 0.95rem;
max-width: 300px;
background: var(--bg-primary);
color: var(--text-primary);
}
.error-text {
color: var(--color-error-500);
font-size: 0.85rem;
margin-bottom: 12px;
}
.btn {
padding: 8px 16px;
border: none;
border-radius: 6px;
cursor: pointer;
font-size: 0.95rem;
}
.cancel-btn {
background: var(--color-warning-500);
color: var(--text-inverse);
border: 1px solid var(--color-warning-600);
}
.save-btn {
background: var(--color-success-500);
color: var(--text-inverse);
transition: background .2s;
}
.save-btn:hover:not(:disabled) {
background: var(--color-success-600);
}
.save-btn:disabled {
opacity: 0.6;
cursor: default;
}
/* table */
.table {
width: 100%;
border-collapse: collapse;
background: var(--bg-primary);
border-radius: 12px;
overflow: hidden;
box-shadow: var(--shadow-md);
border: 1px solid var(--border-light);
backdrop-filter: blur(10px);
}
.table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
@media (max-width: 768px) {
  .table { min-width: 640px; }
}
.table th,
.table td {
  border-bottom: 1px solid var(--border-light);
padding: 12px;
font-size: 0.85rem;
}
.table th {
background: var(--bg-secondary);
font-weight: 600;
color: var(--text-heading);
}
.actions {
display: flex;
gap: 8px;
justify-content: center;
}
/* edit/delete icons */
.icon {
border: none;
width: 32px;
height: 32px;
border-radius: 6px;
display: inline-flex;
align-items: center;
justify-content: center;
cursor: pointer;
transition: background .2s;
}
.icon.edit {
background: var(--color-warning-500);
color: var(--text-inverse);
}
.icon.edit:hover {
background: var(--color-warning-600);
}
.icon.delete {
background: var(--color-error-500);
color: var(--text-inverse);
}
.icon.delete:hover {
background: var(--color-error-600);
}
/* inline SVG */
.icon-svg {
width: 16px;
height: 16px;
color: var(--text-inverse);
}
.pill {
display: inline-block;
padding: 4px 12px;
border-radius: 14px;
font-size: 0.75rem;
font-weight: 600;
}
</style>