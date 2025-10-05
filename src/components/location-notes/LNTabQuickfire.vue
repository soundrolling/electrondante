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
  <table v-if="buttons.length" class="table">
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
/* component‐scoped palette */
.pane {
--bg-light: #f8fafc;
--text-med: #64748b;
--border:   #e2e8f0;
--accent:   #3b82f6;
background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
padding: 32px;
border-radius: 16px;
box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
border: 1px solid rgba(255, 255, 255, 0.2);
max-width: 1200px;
margin: 0 auto;
}
.info {
font-size: 0.9rem;
color: var(--text-med);
margin-bottom: 12px;
}
.grid {
display: grid;
grid-template-columns: repeat(auto-fill, minmax(140px,1fr));
gap: 20px;
margin-bottom: 24px;
padding: 20px;
background: rgba(255, 255, 255, 0.6);
border-radius: 12px;
border: 1px solid rgba(255, 255, 255, 0.3);
backdrop-filter: blur(10px);
}
/* quickfire buttons */
.qf {
--bg: #ccc; /* overridden inline */
--fg: #000;
background: var(--bg);
color: var(--fg);
  border: 2px solid rgba(0, 0, 0, 0.25);
border-radius: 16px;
padding: 24px 16px;
font-weight: 700;
font-size: 1rem;
text-align: center;
cursor: pointer;
box-shadow: 0 4px 12px rgba(0,0,0,0.1);
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
backdrop-filter: blur(10px);
}
.qf:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  filter: saturate(1.05);
}
.qf:active {
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
color: var(--accent);
font-size: 0.85rem;
cursor: pointer;
}
.mini.primary {
background: #059669;
color: #ffffff;
border-radius: 6px;
padding: 6px 14px;
transition: background .2s;
}
.mini.primary:hover:not(:disabled) {
background: #047857;
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
background: #fff;
border-radius: 12px;
box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
max-width: 500px;
width: 90%;
max-height: 90vh;
overflow-y: auto;
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
color: #111827;
}
.modal-close {
background: #d97706;
color: #ffffff;
border: 1px solid #b45309;
font-size: 1.5rem;
cursor: pointer;
padding: 4px;
border-radius: 4px;
transition: background .2s;
}
.modal-close:hover {
background: #b45309;
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
color: #374151;
}
.form-field input,
.form-field select {
border: 1px solid var(--border);
border-radius: 6px;
padding: 8px;
font-size: 0.95rem;
max-width: 300px;
}
.error-text {
color: #ff7070;
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
background: #d97706;
color: #ffffff;
border: 1px solid #b45309;
}
.save-btn {
background: #059669;
color: #ffffff;
transition: background .2s;
}
.save-btn:hover:not(:disabled) {
background: #047857;
}
.save-btn:disabled {
opacity: 0.6;
cursor: default;
}
/* table */
.table {
width: 100%;
border-collapse: collapse;
background: rgba(255, 255, 255, 0.9);
border-radius: 12px;
overflow: hidden;
box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
border: 1px solid rgba(255, 255, 255, 0.3);
backdrop-filter: blur(10px);
}
.table th,
.table td {
border-bottom: 1px solid var(--border);
padding: 12px;
font-size: 0.85rem;
}
.table th {
background: #f4f5f7;
font-weight: 600;
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
background: #d97706;
color: #ffffff;
}
.icon.edit:hover {
background: #b45309;
}
.icon.delete {
background: #dc2626;
color: #ffffff;
}
.icon.delete:hover {
background: #b91c1c;
}
/* inline SVG */
.icon-svg {
width: 16px;
height: 16px;
color: #fff;
}
.pill {
display: inline-block;
padding: 4px 12px;
border-radius: 14px;
font-size: 0.75rem;
font-weight: 600;
}
</style>