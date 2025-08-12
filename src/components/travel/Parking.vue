<template>
<div class="parking-section">
  <div class="header-section">
    <h1>Parking</h1>
    <p>Log where you parked for this trip</p>
  </div>
  <div v-if="isLoading" class="loading-spinner">
    <div class="spinner"></div>
    <p>Loading parking entries...</p>
  </div>
  <div v-else>
    <div class="section-header">
      <h2>Parking Entries</h2>
      <button @click="openForm" class="add-button">
        <span class="icon">+</span> Add Parking
      </button>
    </div>
    <div v-if="showForm" class="parking-form-container">
      <h3>{{ editingParking ? 'Edit Parking' : 'Add New Parking' }}</h3>
      <form @submit.prevent="saveParking">
        <div class="form-group">
          <label for="airport">Airport</label>
          <input type="text" id="airport" v-model="parkingForm.airport" required placeholder="e.g., John F. Kennedy International Airport" />
        </div>
        <div class="form-group">
          <label for="parking_provider">Parking Provider</label>
          <input type="text" id="parking_provider" v-model="parkingForm.parking_provider" required placeholder="e.g., Main Street Garage" />
        </div>
        <div class="form-group">
          <label for="start_datetime">Start Date and Time</label>
          <input type="datetime-local" id="start_datetime" v-model="parkingForm.start_datetime" required />
        </div>
        <div class="form-group">
          <label for="end_datetime">End Date and Time</label>
          <input type="datetime-local" id="end_datetime" v-model="parkingForm.end_datetime" required />
        </div>
        <div class="form-group">
          <label for="cost">Cost</label>
          <input type="text" id="cost" v-model="parkingForm.cost" required placeholder="e.g., $10" />
        </div>
        <div class="form-group">
          <label for="notes">Notes</label>
          <textarea id="notes" v-model="parkingForm.notes" rows="2" placeholder="Details, level, spot, etc."></textarea>
        </div>
        <div class="form-actions">
          <button type="button" @click="closeForm" class="cancel-button">Cancel</button>
          <button type="submit" class="save-button" :disabled="isSaving">
            {{ isSaving ? 'Saving...' : (editingParking ? 'Update Parking' : 'Add Parking') }}
          </button>
        </div>
      </form>
    </div>
    <div v-if="parkingEntries.length === 0" class="empty-state">
      <p>No parking entries yet. Add your first parking spot!</p>
    </div>
    <div v-else class="parking-list">
      <div v-for="entry in parkingEntries" :key="entry.id" class="parking-card">
        <div class="parking-card-header">
          <h3>{{ entry.airport }}</h3>
        </div>
        <div class="parking-card-body">
          <p>{{ entry.parking_provider }}</p>
        </div>
        <div class="parking-card-footer">
          <button @click="editParking(entry)" class="edit-button">Edit</button>
          <button @click="deleteParking(entry.id)" class="delete-button">Delete</button>
        </div>
      </div>
    </div>
  </div>
</div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { supabase } from '../../supabase';
import { useToast } from 'vue-toastification';

export default {
name: 'Parking',
props: {
  projectId: { type: [String, Number], required: true },
  tripId: { type: [String, Number], required: true }
},
setup(props) {
  const toast = useToast();
  const isLoading = ref(false);
  const isSaving = ref(false);
  const showForm = ref(false);
  const editingParking = ref(null);
  const parkingEntries = ref([]);
  const parkingForm = ref({
    airport: '',
    parking_provider: '',
    start_datetime: '',
    end_datetime: '',
    cost: '',
    notes: ''
  });

  const loadParking = async () => {
    isLoading.value = true;
    try {
      const { data, error } = await supabase
        .from('travel_parking')
        .select('*')
        .eq('trip_id', props.tripId)
        .order('start_datetime', { ascending: true });
      if (error) throw error;
      parkingEntries.value = data || [];
    } catch (err) {
      toast.error('Failed to load parking entries');
    } finally {
      isLoading.value = false;
    }
  };

  const openForm = () => {
    editingParking.value = null;
    parkingForm.value = { airport: '', parking_provider: '', start_datetime: '', end_datetime: '', cost: '', notes: '' };
    showForm.value = true;
  };
  const editParking = (entry) => {
    editingParking.value = entry;
    parkingForm.value = { ...entry };
    showForm.value = true;
  };
  const closeForm = () => {
    showForm.value = false;
    editingParking.value = null;
    parkingForm.value = { airport: '', parking_provider: '', start_datetime: '', end_datetime: '', cost: '', notes: '' };
  };
  const saveParking = async () => {
    isSaving.value = true;
    try {
      if (editingParking.value) {
        const { error } = await supabase
          .from('travel_parking')
          .update({ ...parkingForm.value })
          .eq('id', editingParking.value.id);
        if (error) throw error;
        toast.success('Parking updated');
      } else {
        const { error } = await supabase
          .from('travel_parking')
          .insert({ ...parkingForm.value, trip_id: props.tripId });
        if (error) throw error;
        toast.success('Parking added');
      }
      await loadParking();
      closeForm();
    } catch (err) {
      toast.error('Failed to save parking');
    } finally {
      isSaving.value = false;
    }
  };
  const deleteParking = async (id) => {
    if (!confirm('Delete this parking entry?')) return;
    try {
      const { error } = await supabase
        .from('travel_parking')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Parking deleted');
      await loadParking();
    } catch (err) {
      toast.error('Failed to delete parking');
    }
  };

  onMounted(loadParking);

  return {
    isLoading,
    isSaving,
    showForm,
    editingParking,
    parkingEntries,
    parkingForm,
    openForm,
    editParking,
    closeForm,
    saveParking,
    deleteParking
  };
}
};
</script>

<style scoped>
.parking-section {
max-width: 900px;
margin: 32px auto;
background: #f8f9fa;
border-radius: 12px;
box-shadow: 0 2px 12px rgba(0,0,0,0.07);
border: 1.5px solid #e5e7eb;
padding: 32px 20px 24px 20px;
}
.header-section {
text-align: center;
margin-bottom: 24px;
background: #fff;
padding: 2rem 1rem 1.5rem 1rem;
border-radius: 12px;
box-shadow: 0 2px 8px rgba(0,0,0,0.04);
border: 1.5px solid #e5e7eb;
}
.header-section h1 {
font-size: 2rem;
color: #1f2937;
font-weight: 700;
margin-bottom: 0.25em;
}
.header-section p {
color: #64748b;
margin: 0.2em 0;
font-size: 1.1rem;
}
.section-header {
display: flex;
flex-direction: column;
gap: 1rem;
margin-bottom: 1.5rem;
}
@media (min-width: 480px) {
.section-header {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}
}
.section-header h2 {
font-size: 1.4rem;
color: #1f2937;
font-weight: 600;
margin: 0;
}
button {
border: none;
border-radius: 8px;
padding: 10px 18px;
font-size: 1rem;
font-weight: 500;
cursor: pointer;
transition: background 0.2s, color 0.2s, box-shadow 0.2s;
box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}
button:focus {
outline: none;
box-shadow: 0 0 0 2px #dbeafe;
}
.add-button {
background: #10b981;
color: #fff;
}
.add-button:hover {
background: #059669;
}
.edit-button {
background: #f1f5f9;
color: #2563eb;
border: 1.5px solid #cbd5e1;
}
.edit-button:hover {
background: #e0e7ef;
color: #1d4ed8;
border-color: #3b82f6;
}
.delete-button {
background: #ef4444;
color: #fff;
}
.delete-button:hover {
background: #dc2626;
}
.parking-form-container {
background-color: #fff;
border: 1.5px solid #e5e7eb;
padding: 1.2rem 1rem 1rem 1rem;
border-radius: 12px;
margin-bottom: 1.5rem;
box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.parking-form-container h3 {
margin-top: 0;
margin-bottom: 1rem;
color: #1f2937;
font-weight: 600;
}
.form-group {
margin-bottom: 1.25rem;
}
.form-group label {
display: block;
font-weight: 500;
margin-bottom: 0.5rem;
color: #222;
}
.form-group input,
.form-group textarea {
width: 100%;
padding: 0.6rem;
border: 1.5px solid #e5e7eb;
border-radius: 8px;
font-size: 1rem;
box-sizing: border-box;
background: #fff;
color: #222;
}
.form-actions {
display: flex;
justify-content: flex-end;
gap: 1rem;
}
.cancel-button {
background-color: #6c757d;
color: #fff;
}
.cancel-button:hover {
background-color: #5a6268;
}
.save-button {
background-color: #10b981;
color: #fff;
}
.save-button:hover {
background-color: #059669;
}
.save-button:disabled {
background-color: #a7f3d0;
cursor: not-allowed;
}
.empty-state {
text-align: center;
padding: 1rem;
background-color: #fefefe;
border: 1.5px dashed #cbd5e1;
border-radius: 10px;
font-style: italic;
color: #64748b;
}
.parking-list {
display: flex;
flex-direction: column;
gap: 1.2rem;
}
.parking-card {
background-color: #fff;
border: 1.5px solid #e5e7eb;
padding: 1.1rem 1rem 0.8rem 1rem;
border-radius: 10px;
box-shadow: 0 1px 4px rgba(0,0,0,0.04);
transition: background 0.2s, box-shadow 0.2s;
}
.parking-card:hover {
background: #f1f5f9;
box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.parking-card-header {
display: flex;
justify-content: space-between;
align-items: center;
}
.parking-card-header h3 {
margin: 0;
font-size: 1.1rem;
color: #1f2937;
}
.parking-card-body {
margin-top: 0.5rem;
color: #555;
}
.parking-card-footer {
margin-top: 1rem;
display: flex;
flex-wrap: wrap;
gap: 0.5rem;
}
@media (max-width: 700px) {
.parking-section {
  padding: 10px 2px 12px 2px;
}
.parking-form-container {
  padding: 1.2rem 0.5rem 1rem 0.5rem;
}
}
</style> 