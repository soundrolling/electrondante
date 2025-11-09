<template>
<div class="parking-section">
  <!-- Header Section -->
  <div class="header-section">
    <h1>Parking</h1>
    <p>Log where you parked for this trip</p>
  </div>

  <!-- Loading State -->
  <div v-if="isLoading" class="loading-state">
    <div class="skeleton-loader">
      <div class="skeleton-item"></div>
      <div class="skeleton-item"></div>
      <div class="skeleton-item"></div>
    </div>
  </div>

  <!-- Content Container -->
  <div v-else class="content-container">
    <div class="section-header">
      <h2>Parking Entries</h2>
      <button v-if="canManageProject" @click="openForm" class="add-button" aria-label="Add new parking entry">
        <span class="icon">+</span>
        <span class="button-text">Add Parking</span>
      </button>
    </div>

    <!-- Add/Edit Form -->
    <div v-if="showForm" class="parking-form-container">
      <h3>{{ editingParking ? 'Edit Parking' : 'Add New Parking' }}</h3>
      <form @submit.prevent="saveParking">
        <div class="form-group">
          <label for="airport">Airport</label>
          <input 
            type="text" 
            id="airport" 
            v-model="parkingForm.airport" 
            required 
            placeholder="e.g., John F. Kennedy International Airport"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="parking_provider">Parking Provider</label>
          <input 
            type="text" 
            id="parking_provider" 
            v-model="parkingForm.parking_provider" 
            required 
            placeholder="e.g., Main Street Garage"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="start_datetime">Start Date and Time</label>
          <input 
            type="datetime-local" 
            id="start_datetime" 
            v-model="parkingForm.start_datetime" 
            required
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="end_datetime">End Date and Time</label>
          <input 
            type="datetime-local" 
            id="end_datetime" 
            v-model="parkingForm.end_datetime" 
            required
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="cost">Cost</label>
          <input 
            type="text" 
            id="cost" 
            v-model="parkingForm.cost" 
            required 
            placeholder="e.g., $10"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="notes">Notes</label>
          <textarea 
            id="notes" 
            v-model="parkingForm.notes" 
            rows="2" 
            placeholder="Details, level, spot, etc."
            class="form-textarea"
          ></textarea>
        </div>
        <div class="form-group">
          <label for="parkingMember">Who is this parking for?</label>
          <select id="parkingMember" v-model="parkingForm.member_email" class="form-select">
            <option value="">-- Select Member --</option>
            <option v-for="member in projectMembers" :key="member.user_email" :value="member.user_email">
              {{ member.display_name }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label for="parkingImage">Parking Photo (Optional)</label>
          <div class="image-upload-container">
            <input 
              type="file" 
              id="parkingImage" 
              ref="imageInput"
              accept="image/*" 
              @change="handleImageSelect"
              class="image-input"
            />
            <div v-if="imagePreview" class="image-preview">
              <img :src="imagePreview" alt="Parking preview" />
              <button type="button" @click="removeImage" class="remove-image-button" aria-label="Remove image">
                ×
              </button>
            </div>
            <div v-else-if="parkingForm.image_url" class="image-preview">
              <img :src="parkingForm.image_url" alt="Parking photo" />
              <button type="button" @click="removeImage" class="remove-image-button" aria-label="Remove image">
                ×
              </button>
            </div>
            <button 
              v-else
              type="button" 
              @click="$refs.imageInput?.click()" 
              class="image-upload-button"
            >
              <span class="upload-icon">📷</span>
              <span>Upload Photo</span>
            </button>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" @click="closeForm" class="secondary-button">
            Cancel
          </button>
          <button type="submit" class="primary-button" :disabled="isSaving">
            <span v-if="isSaving" class="loading-spinner-small"></span>
            {{ isSaving ? 'Saving...' : (editingParking ? 'Update Parking' : 'Add Parking') }}
          </button>
        </div>
      </form>
    </div>

    <!-- Empty State -->
    <div v-if="parkingEntries.length === 0" class="empty-state">
      <div class="empty-icon">🅿️</div>
      <h3>No parking entries yet</h3>
      <p>Add your first parking spot to get started!</p>
    </div>

    <!-- Parking List -->
    <div v-else class="parking-list">
      <div v-for="entry in parkingEntries" :key="entry.id" class="parking-card">
        <div class="parking-card-header">
          <h3>{{ entry.airport }}</h3>
          <span class="parking-provider">{{ entry.parking_provider }}</span>
        </div>
        <div class="parking-card-body">
          <div v-if="entry.image_url" class="parking-image-container">
            <img :src="entry.image_url" alt="Parking photo" class="parking-image" />
          </div>
          <div class="parking-details">
            <div class="detail-item">
              <span class="detail-label">Start:</span>
              <span class="detail-value">{{ formatDateTime(entry.start_datetime) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">End:</span>
              <span class="detail-value">{{ formatDateTime(entry.end_datetime) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Cost:</span>
              <span class="detail-value cost">{{ entry.cost }}</span>
            </div>
            <div v-if="entry.notes" class="detail-item">
              <span class="detail-label">Notes:</span>
              <span class="detail-value">{{ entry.notes }}</span>
            </div>
            <div v-if="entry.member_name" class="detail-item">
              <span class="detail-label">For:</span>
              <span class="detail-value">{{ entry.member_name }}</span>
            </div>
          </div>
        </div>
        <div v-if="canManageProject" class="parking-card-footer">
          <button @click="editParking(entry)" class="action-button edit-button" aria-label="Edit parking entry">
            <span class="action-icon">✏️</span>
            <span class="action-text">Edit</span>
          </button>
          <button @click="deleteParking(entry.id)" class="action-button delete-button" aria-label="Delete parking entry">
            <span class="action-icon">🗑️</span>
            <span class="action-text">Delete</span>
          </button>
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
import { useUserStore } from '../../stores/userStore';
import { format, parseISO } from 'date-fns';

export default {
name: 'Parking',
props: {
  projectId: { type: [String, Number], required: true },
  tripId: { type: [String, Number], required: true }
},
setup(props) {
  const toast = useToast();
  const userStore = useUserStore();
  const isLoading = ref(false);
  const isSaving = ref(false);
  const showForm = ref(false);
  const editingParking = ref(null);
  const parkingEntries = ref([]);
  const imagePreview = ref(null);
  const selectedImageFile = ref(null);
  const parkingForm = ref({
    airport: '',
    parking_provider: '',
    start_datetime: '',
    end_datetime: '',
    cost: '',
    notes: '',
    member_email: '', // Will be set to current user when opening form
    image_path: null,
    image_url: null
  });
  
  // Permission check
  const canManageProject = ref(false);
  
  // Project members
  const projectMembers = ref([]);
  const currentUserEmail = ref('');
  
  async function checkUserRole() {
    const { data: sess } = await supabase.auth.getSession();
    const email = sess?.session?.user?.email?.toLowerCase();
    if (!email || !userStore.currentProject?.id) return;
    try {
      const { data } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', userStore.currentProject.id)
        .eq('user_email', email)
        .single();
      canManageProject.value = ['owner', 'admin', 'contributor'].includes(data?.role);
    } catch (err) {
      console.error('Error checking user role:', err);
      canManageProject.value = false;
    }
  }
  
  // Fetch project members
  async function fetchProjectMembers() {
    if (!userStore.currentProject?.id) return;
    try {
      const { data: sess } = await supabase.auth.getSession();
      currentUserEmail.value = sess?.session?.user?.email?.toLowerCase() || '';
      
      const { data: memberRows, error } = await supabase
        .from('project_members')
        .select('user_id, user_email, role')
        .eq('project_id', userStore.currentProject.id)
      
      if (error) throw error
      
      const members = memberRows || []
      const userIds = members.map(m => m.user_id).filter(Boolean)
      
      let profiles = []
      if (userIds.length) {
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('user_id, full_name')
          .in('user_id', userIds)
        profiles = profileData || []
      }
      
      projectMembers.value = members.map(m => {
        const profile = profiles.find(p => p.user_id === m.user_id) || {}
        return {
          ...m,
          display_name: profile.full_name || m.user_email || 'Unknown'
        }
      })
    } catch (err) {
      console.error('Failed to fetch project members:', err)
    }
  }
  
  // Get member name by email
  function getMemberName(email) {
    if (!email || !projectMembers.value.length) return email || 'Unknown'
    const member = projectMembers.value.find(m => m.user_email === email)
    return member ? member.display_name : email
  }

  const loadParking = async () => {
    isLoading.value = true;
    try {
      const { data, error } = await supabase
        .from('travel_parking')
        .select('*')
        .eq('trip_id', props.tripId)
        .order('start_datetime', { ascending: true });
      if (error) throw error;
      // Enrich with member names and image URLs
      parkingEntries.value = await Promise.all((data || []).map(async entry => {
        let imageUrl = null;
        if (entry.image_path) {
          try {
            const { data: signed } = await supabase.storage
              .from('parking-images')
              .createSignedUrl(entry.image_path, 3600);
            imageUrl = signed?.signedUrl || null;
          } catch (err) {
            console.warn('Could not get signed URL for parking image:', err);
          }
        }
        return {
          ...entry,
          member_name: entry.member_email ? getMemberName(entry.member_email) : null,
          image_url: imageUrl
        };
      }));
    } catch (err) {
      toast.error('Failed to load parking entries');
    } finally {
      isLoading.value = false;
    }
  };

  const openForm = () => {
    editingParking.value = null;
    imagePreview.value = null;
    selectedImageFile.value = null;
    parkingForm.value = { 
      airport: '', 
      parking_provider: '', 
      start_datetime: '', 
      end_datetime: '', 
      cost: '', 
      notes: '',
      member_email: currentUserEmail.value, // Default to current user
      image_path: null,
      image_url: null
    };
    showForm.value = true;
  };
  const editParking = async (entry) => {
    editingParking.value = entry;
    parkingForm.value = { ...entry };
    imagePreview.value = null;
    selectedImageFile.value = null;
    // Load existing image URL if available
    if (entry.image_path) {
      try {
        const { data: signed } = await supabase.storage
          .from('parking-images')
          .createSignedUrl(entry.image_path, 3600);
        parkingForm.value.image_url = signed?.signedUrl || null;
      } catch (err) {
        console.warn('Could not get signed URL for parking image:', err);
        parkingForm.value.image_url = null;
      }
    }
    showForm.value = true;
  };
  const closeForm = () => {
    showForm.value = false;
    editingParking.value = null;
    imagePreview.value = null;
    selectedImageFile.value = null;
    parkingForm.value = { 
      airport: '', 
      parking_provider: '', 
      start_datetime: '', 
      end_datetime: '', 
      cost: '', 
      notes: '',
      member_email: '',
      image_path: null,
      image_url: null
    };
    if (document.getElementById('parkingImage')) {
      document.getElementById('parkingImage').value = '';
    }
  };
  const handleImageSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }
    
    selectedImageFile.value = file;
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.value = e.target.result;
    };
    reader.readAsDataURL(file);
  };
  
  const removeImage = () => {
    imagePreview.value = null;
    selectedImageFile.value = null;
    parkingForm.value.image_path = null;
    parkingForm.value.image_url = null;
    if (document.getElementById('parkingImage')) {
      document.getElementById('parkingImage').value = '';
    }
  };
  
  const uploadImage = async (file) => {
    if (!file) return null;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${props.projectId}/${props.tripId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('parking-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (uploadError) throw uploadError;
    return uploadData.path;
  };
  
  const saveParking = async () => {
    isSaving.value = true;
    try {
      let imagePath = parkingForm.value.image_path;
      
      // Upload new image if one was selected
      if (selectedImageFile.value) {
        // Delete old image if editing and replacing
        if (editingParking.value?.image_path) {
          try {
            await supabase.storage
              .from('parking-images')
              .remove([editingParking.value.image_path]);
          } catch (err) {
            console.warn('Could not delete old image:', err);
          }
        }
        
        imagePath = await uploadImage(selectedImageFile.value);
      } else if (editingParking.value && editingParking.value.image_path && !parkingForm.value.image_path) {
        // Image was removed: editing entry that had an image, but image_path is now null
        try {
          await supabase.storage
            .from('parking-images')
            .remove([editingParking.value.image_path]);
        } catch (err) {
          console.warn('Could not delete image:', err);
        }
        imagePath = null;
      }
      
      const formData = {
        airport: parkingForm.value.airport,
        parking_provider: parkingForm.value.parking_provider,
        start_datetime: parkingForm.value.start_datetime,
        end_datetime: parkingForm.value.end_datetime,
        cost: parkingForm.value.cost,
        notes: parkingForm.value.notes,
        member_email: parkingForm.value.member_email,
        image_path: imagePath
      };
      
      if (editingParking.value) {
        const { error } = await supabase
          .from('travel_parking')
          .update(formData)
          .eq('id', editingParking.value.id);
        if (error) throw error;
        toast.success('Parking updated');
      } else {
        const { error } = await supabase
          .from('travel_parking')
          .insert({ ...formData, trip_id: props.tripId });
        if (error) throw error;
        toast.success('Parking added');
      }
      await loadParking();
      closeForm();
    } catch (err) {
      console.error('Error saving parking:', err);
      toast.error('Failed to save parking');
    } finally {
      isSaving.value = false;
    }
  };
  const deleteParking = async (id) => {
    if (!confirm('Delete this parking entry?')) return;
    try {
      // Get the entry to find image path
      const entry = parkingEntries.value.find(e => e.id === id);
      
      // Delete image from storage if it exists
      if (entry?.image_path) {
        try {
          await supabase.storage
            .from('parking-images')
            .remove([entry.image_path]);
        } catch (err) {
          console.warn('Could not delete parking image:', err);
        }
      }
      
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
  
  const formatDateTime = (dtString) => {
    if (!dtString) return '';
    try {
      const dt = parseISO(dtString);
      return format(dt, 'MMM d, yyyy – HH:mm');
    } catch (err) {
      return dtString;
    }
  };

  onMounted(async () => {
    await checkUserRole();
    await fetchProjectMembers();
    loadParking();
  });

  return {
    isLoading,
    isSaving,
    showForm,
    editingParking,
    parkingEntries,
    parkingForm,
    imagePreview,
    openForm,
    editParking,
    closeForm,
    saveParking,
    deleteParking,
    canManageProject,
    projectMembers,
    formatDateTime,
    handleImageSelect,
    removeImage
  };
}
};
</script>

<style scoped>
/* Mobile-first base styles */
.parking-section {
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
  .parking-section {
    padding-left: max(16px, env(safe-area-inset-left));
    padding-right: max(16px, env(safe-area-inset-right));
    padding-top: max(16px, env(safe-area-inset-top));
    padding-bottom: max(16px, env(safe-area-inset-bottom));
  }
}

/* Header Section */
.header-section {
  text-align: center;
  margin-bottom: 24px;
  background: var(--bg-primary);
  padding: 24px 16px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
}

.header-section h1 {
  font-size: 24px;
  margin: 0 0 8px 0;
  color: var(--text-heading);
  font-weight: 700;
  line-height: 1.4;
}

.header-section p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 16px;
  line-height: 1.5;
}

/* Content Container */
.content-container {
  background: var(--bg-primary);
  border-radius: 12px;
  padding: 24px 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.section-header h2 {
  font-size: 20px;
  margin: 0;
  color: var(--text-heading);
  font-weight: 600;
  line-height: 1.4;
}

/* Add Button */
.add-button {
  background: #3b82f6;
  color: var(--text-inverse);
  border: none;
  border-radius: 8px;
  padding: 12px 16px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  min-width: 44px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.add-button:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.add-button:active {
  transform: translateY(0);
}

.add-button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
}

.icon {
  font-size: 18px;
  font-weight: bold;
}

.button-text {
  display: none;
}

/* Loading State */
.loading-state {
  display: flex;
  justify-content: center;
  padding: 32px 0;
}

.skeleton-loader {
  width: 100%;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-item {
  height: 100px;
  background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 8px;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 32px 16px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px dashed #e5e7eb;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 20px;
  margin: 0 0 8px 0;
  color: var(--text-secondary);
  font-weight: 600;
}

.empty-state p {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
}

/* Parking Form Container */
.parking-form-container {
  background: var(--bg-secondary);
  border: 1px solid #e5e7eb;
  padding: 24px 20px;
  border-radius: 12px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.parking-form-container h3 {
  margin: 0 0 20px 0;
  color: var(--text-heading);
  font-weight: 600;
  font-size: 18px;
  line-height: 1.4;
}

/* Form Styles */
.form-group {
  margin-bottom: 24px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-secondary);
  font-size: 16px;
  line-height: 1.4;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 14px 18px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 16px;
  line-height: 1.5;
  box-sizing: border-box;
  background: var(--bg-primary);
  color: var(--text-heading);
  transition: all 0.2s ease;
  min-height: 48px;
}

.form-textarea {
  min-height: 80px;
  resize: vertical;
}

.form-select {
  width: 100%;
  padding: 14px 18px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 16px;
  line-height: 1.5;
  box-sizing: border-box;
  background: var(--bg-primary);
  color: var(--text-heading);
  transition: all 0.2s ease;
  min-height: 48px;
}

.form-select:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Image Upload Styles */
.image-upload-container {
  width: 100%;
}

.image-input {
  display: none;
}

.image-upload-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 16px;
  width: 100%;
  justify-content: center;
  min-height: 48px;
}

.image-upload-button:hover {
  border-color: var(--color-primary-500);
  background: var(--bg-primary);
  color: var(--text-heading);
}

.upload-icon {
  font-size: 20px;
}

.image-preview {
  position: relative;
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
}

.image-preview img {
  width: 100%;
  height: auto;
  display: block;
  max-height: 300px;
  object-fit: contain;
  background: var(--bg-secondary);
}

.remove-image-button {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(220, 38, 38, 0.9);
  color: white;
  border: none;
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.remove-image-button:hover {
  background: rgba(185, 28, 28, 1);
  transform: scale(1.1);
}

.remove-image-button:active {
  transform: scale(0.95);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  flex-wrap: wrap;
}

/* Button Styles */
.primary-button {
  background: var(--color-success-500);
  color: var(--text-inverse);
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.2s ease;
  min-height: 44px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  gap: 8px;
}

.primary-button:hover {
  background: var(--color-success-600);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.primary-button:active {
  transform: translateY(0);
}

.primary-button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.3);
}

.primary-button:disabled {
  background: var(--color-secondary-400);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.secondary-button {
  background: var(--color-secondary-500);
  color: var(--text-inverse);
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.2s ease;
  min-height: 44px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.secondary-button:hover {
  background: #4b5563;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.secondary-button:active {
  transform: translateY(0);
}

.secondary-button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(107, 114, 128, 0.3);
}

.loading-spinner-small {
  border: 2px solid #f3f4f6;
  border-top: 2px solid #10b981;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Parking List */
.parking-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.parking-card {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 20px 16px;
  border: 1px solid #e5e7eb;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.parking-card:hover {
  background: #f3f4f6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.parking-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.parking-card-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-heading);
  font-weight: 600;
  line-height: 1.4;
}

.parking-provider {
  font-size: 14px;
  color: var(--text-secondary);
  background: #e5e7eb;
  padding: 4px 8px;
  border-radius: 6px;
  font-weight: 500;
}

.parking-card-body {
  margin-bottom: 16px;
}

.parking-image-container {
  width: 100%;
  margin-bottom: 16px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
}

.parking-image {
  width: 100%;
  height: auto;
  display: block;
  max-height: 400px;
  object-fit: contain;
  background: var(--bg-secondary);
}

.parking-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-label {
  font-weight: 500;
  color: var(--text-secondary);
  font-size: 14px;
}

.detail-value {
  color: var(--text-heading);
  font-size: 14px;
  text-align: right;
}

.detail-value.cost {
  font-weight: 600;
  color: #059669;
}

.parking-card-footer {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.action-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  border: 1px solid #e5e7eb;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  min-height: 44px;
  min-width: 44px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.action-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.action-button:active {
  transform: translateY(0);
}

.action-button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
}

.action-button.edit-button {
  background: #3b82f6;
  color: var(--text-inverse);
  border-color: #2563eb;
}

.action-button.edit-button:hover {
  background: #2563eb;
  border-color: #1d4ed8;
}

.action-button.delete-button {
  background: #dc2626;
  color: var(--text-inverse);
  border-color: #b91c1c;
}

.action-button.delete-button:hover {
  background: #b91c1c;
  border-color: #991b1b;
}

.action-icon {
  font-size: 16px;
}

.action-text {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.2;
}

/* Tablet Breakpoint (601px - 1024px) */
@media (min-width: 601px) {
  .parking-section {
    padding: 24px;
  }
  
  .header-section {
    padding: 32px 24px;
    margin-bottom: 32px;
  }
  
  .header-section h1 {
    font-size: 28px;
  }
  
  .content-container {
    padding: 24px 20px;
  }
  
  .parking-form-container {
    padding: 24px 20px;
  }
  
  .parking-card {
    padding: 24px 20px;
  }
  
  .parking-card-header {
    flex-direction: row;
    align-items: center;
  }
  
  .action-button {
    flex-direction: row;
    gap: 6px;
    padding: 10px 12px;
  }
  
  .action-text {
    display: inline;
    font-size: 14px;
  }
  
  .button-text {
    display: inline;
  }
}

/* Desktop Breakpoint (1025px+) */
@media (min-width: 1025px) {
  .parking-section {
    max-width: 1200px;
    padding: 32px;
  }
  
  .header-section {
    padding: 40px 32px;
    margin-bottom: 40px;
  }
  
  .header-section h1 {
    font-size: 32px;
  }
  
  .content-container {
    padding: 32px 28px;
  }
  
  .parking-form-container {
    padding: 32px 28px;
  }
  
  .parking-card {
    padding: 32px 28px;
  }
}

/* Mobile-specific adjustments */
@media (max-width: 600px) {
  .parking-section {
    padding: 12px;
  }
  
  .header-section {
    padding: 20px 16px;
    margin-bottom: 20px;
  }
  
  .header-section h1 {
    font-size: 22px;
  }
  
  .content-container {
    padding: 16px 12px;
  }
  
  .section-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .add-button {
    width: 100%;
    justify-content: center;
  }
  
  .parking-form-container {
    padding: 16px 12px;
  }
  
  .parking-card {
    padding: 16px 12px;
  }
  
  .parking-card-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .parking-card-footer {
    flex-direction: column;
    width: 100%;
  }
  
  .action-button {
    width: 100%;
    justify-content: center;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .form-actions button {
    width: 100%;
  }
}
</style> 