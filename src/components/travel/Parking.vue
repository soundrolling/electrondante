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
          <label for="carImage">Car Photo (Optional)</label>
          <div class="image-upload-container">
            <input 
              type="file" 
              id="carImage" 
              ref="carImageInput"
              accept="image/*" 
              @change="(e) => handleImageSelect(e, 'car')"
              class="image-input"
              :disabled="isUploading"
            />
            <div v-if="carImagePreview" class="image-preview">
              <img :src="carImagePreview" alt="Car preview" />
              <button 
                v-if="!isUploading"
                type="button" 
                @click="removeImage('car')" 
                class="remove-image-button" 
                aria-label="Remove car image"
              >
                ×
              </button>
              <!-- Upload Progress Overlay -->
              <div v-if="isUploading && uploadingType === 'car'" class="upload-progress-overlay">
                <div class="upload-progress-content">
                  <div class="progress-bar">
                    <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
                  </div>
                  <p class="progress-text">{{ uploadProgress }}%</p>
                </div>
              </div>
            </div>
            <div v-else-if="parkingForm.car_image_url" class="image-preview">
              <img :src="parkingForm.car_image_url" alt="Car photo" />
              <button 
                v-if="!isUploading"
                type="button" 
                @click="removeImage('car')" 
                class="remove-image-button" 
                aria-label="Remove car image"
              >
                ×
              </button>
            </div>
            <button 
              v-else
              type="button" 
              @click="$refs.carImageInput?.click()" 
              class="image-upload-button"
              :disabled="isUploading"
            >
              <span class="upload-icon">🚗</span>
              <span>{{ isUploading && uploadingType === 'car' ? 'Uploading...' : 'Upload Car Photo' }}</span>
            </button>
            <!-- Upload Progress Bar (when no preview yet) -->
            <div v-if="isUploading && uploadingType === 'car' && !carImagePreview" class="upload-progress-standalone">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
              </div>
              <p class="progress-text">Uploading car photo... {{ uploadProgress }}%</p>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label for="receiptImage">Receipt Photo (Optional)</label>
          <div class="image-upload-container">
            <input 
              type="file" 
              id="receiptImage" 
              ref="receiptImageInput"
              accept="image/*" 
              @change="(e) => handleImageSelect(e, 'receipt')"
              class="image-input"
              :disabled="isUploading"
            />
            <div v-if="receiptImagePreview" class="image-preview">
              <img :src="receiptImagePreview" alt="Receipt preview" />
              <button 
                v-if="!isUploading"
                type="button" 
                @click="removeImage('receipt')" 
                class="remove-image-button" 
                aria-label="Remove receipt image"
              >
                ×
              </button>
              <!-- Upload Progress Overlay -->
              <div v-if="isUploading && uploadingType === 'receipt'" class="upload-progress-overlay">
                <div class="upload-progress-content">
                  <div class="progress-bar">
                    <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
                  </div>
                  <p class="progress-text">{{ uploadProgress }}%</p>
                </div>
              </div>
            </div>
            <div v-else-if="parkingForm.receipt_image_url" class="image-preview">
              <img :src="parkingForm.receipt_image_url" alt="Receipt photo" />
              <button 
                v-if="!isUploading"
                type="button" 
                @click="removeImage('receipt')" 
                class="remove-image-button" 
                aria-label="Remove receipt image"
              >
                ×
              </button>
            </div>
            <button 
              v-else
              type="button" 
              @click="$refs.receiptImageInput?.click()" 
              class="image-upload-button"
              :disabled="isUploading"
            >
              <span class="upload-icon">🧾</span>
              <span>{{ isUploading && uploadingType === 'receipt' ? 'Uploading...' : 'Upload Receipt Photo' }}</span>
            </button>
            <!-- Upload Progress Bar (when no preview yet) -->
            <div v-if="isUploading && uploadingType === 'receipt' && !receiptImagePreview" class="upload-progress-standalone">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
              </div>
              <p class="progress-text">Uploading receipt photo... {{ uploadProgress }}%</p>
            </div>
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
          <div v-if="entry.car_image_url || entry.receipt_image_url" class="parking-images-container">
            <div v-if="entry.car_image_url" class="parking-image-container">
              <div class="image-label">Car Photo</div>
              <img :src="entry.car_image_url" alt="Car photo" class="parking-image" />
            </div>
            <div v-if="entry.receipt_image_url" class="parking-image-container">
              <div class="image-label">Receipt</div>
              <img :src="entry.receipt_image_url" alt="Receipt photo" class="parking-image" />
            </div>
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
import { ref, computed, onMounted } from 'vue';
import { supabase } from '../../supabase';
import { useToast } from 'vue-toastification';
import { useUserStore } from '../../stores/userStore';
import { format, parseISO } from 'date-fns';

export default {
name: 'Parking',
props: {
  projectId: { type: [String, Number], required: false },
  id: { type: [String, Number], required: false }, // For route params
  tripId: { type: [String, Number], required: true }
},
setup(props) {
  const toast = useToast();
  const userStore = useUserStore();
  
  // Normalize projectId - use projectId prop if available, otherwise use id prop
  const normalizedProjectId = computed(() => {
    return props.projectId || props.id || userStore.currentProject?.id;
  });
  
  // Normalize tripId - use tripId prop if available
  const normalizedTripId = computed(() => {
    return props.tripId;
  });
  const isLoading = ref(false);
  const isSaving = ref(false);
  const isUploading = ref(false);
  const uploadProgress = ref(0);
  const uploadingType = ref(null); // 'car' or 'receipt'
  const showForm = ref(false);
  const editingParking = ref(null);
  const parkingEntries = ref([]);
  const carImagePreview = ref(null);
  const receiptImagePreview = ref(null);
  const selectedCarImageFile = ref(null);
  const selectedReceiptImageFile = ref(null);
  const parkingForm = ref({
    airport: '',
    parking_provider: '',
    start_datetime: '',
    end_datetime: '',
    cost: '',
    notes: '',
    member_email: '', // Will be set to current user when opening form
    image_path: null, // Car image path
    receipt_image_path: null, // Receipt image path
    car_image_url: null,
    receipt_image_url: null
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
        .eq('trip_id', normalizedTripId.value)
        .order('start_datetime', { ascending: true });
      if (error) throw error;
      // Enrich with member names and image URLs
      parkingEntries.value = await Promise.all((data || []).map(async entry => {
        let carImageUrl = null;
        let receiptImageUrl = null;
        
        // Get car image URL
        if (entry.image_path) {
          try {
            const { data: signed } = await supabase.storage
              .from('parking-images')
              .createSignedUrl(entry.image_path, 3600);
            carImageUrl = signed?.signedUrl || null;
          } catch (err) {
            console.warn('Could not get signed URL for car image:', err);
          }
        }
        
        // Get receipt image URL
        if (entry.receipt_image_path) {
          try {
            const { data: signed } = await supabase.storage
              .from('parking-images')
              .createSignedUrl(entry.receipt_image_path, 3600);
            receiptImageUrl = signed?.signedUrl || null;
          } catch (err) {
            console.warn('Could not get signed URL for receipt image:', err);
          }
        }
        
        return {
          ...entry,
          member_name: entry.member_email ? getMemberName(entry.member_email) : null,
          car_image_url: carImageUrl,
          receipt_image_url: receiptImageUrl
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
    carImagePreview.value = null;
    receiptImagePreview.value = null;
    selectedCarImageFile.value = null;
    selectedReceiptImageFile.value = null;
    parkingForm.value = { 
      airport: '', 
      parking_provider: '', 
      start_datetime: '', 
      end_datetime: '', 
      cost: '', 
      notes: '',
      member_email: currentUserEmail.value, // Default to current user
      image_path: null,
      receipt_image_path: null,
      car_image_url: null,
      receipt_image_url: null
    };
    showForm.value = true;
  };
  const editParking = async (entry) => {
    editingParking.value = entry;
    parkingForm.value = { ...entry };
    carImagePreview.value = null;
    receiptImagePreview.value = null;
    selectedCarImageFile.value = null;
    selectedReceiptImageFile.value = null;
    
    // Load existing car image URL if available
    if (entry.image_path) {
      try {
        const { data: signed } = await supabase.storage
          .from('parking-images')
          .createSignedUrl(entry.image_path, 3600);
        parkingForm.value.car_image_url = signed?.signedUrl || null;
      } catch (err) {
        console.warn('Could not get signed URL for car image:', err);
        parkingForm.value.car_image_url = null;
      }
    }
    
    // Load existing receipt image URL if available
    if (entry.receipt_image_path) {
      try {
        const { data: signed } = await supabase.storage
          .from('parking-images')
          .createSignedUrl(entry.receipt_image_path, 3600);
        parkingForm.value.receipt_image_url = signed?.signedUrl || null;
      } catch (err) {
        console.warn('Could not get signed URL for receipt image:', err);
        parkingForm.value.receipt_image_url = null;
      }
    }
    
    showForm.value = true;
  };
  const closeForm = () => {
    showForm.value = false;
    editingParking.value = null;
    carImagePreview.value = null;
    receiptImagePreview.value = null;
    selectedCarImageFile.value = null;
    selectedReceiptImageFile.value = null;
    parkingForm.value = { 
      airport: '', 
      parking_provider: '', 
      start_datetime: '', 
      end_datetime: '', 
      cost: '', 
      notes: '',
      member_email: '',
      image_path: null,
      receipt_image_path: null,
      car_image_url: null,
      receipt_image_url: null
    };
    if (document.getElementById('carImage')) {
      document.getElementById('carImage').value = '';
    }
    if (document.getElementById('receiptImage')) {
      document.getElementById('receiptImage').value = '';
    }
  };
  const handleImageSelect = (event, type) => {
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
    
    if (type === 'car') {
      selectedCarImageFile.value = file;
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        carImagePreview.value = e.target.result;
      };
      reader.readAsDataURL(file);
    } else if (type === 'receipt') {
      selectedReceiptImageFile.value = file;
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        receiptImagePreview.value = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  };
  
  const removeImage = (type) => {
    if (type === 'car') {
      carImagePreview.value = null;
      selectedCarImageFile.value = null;
      parkingForm.value.image_path = null;
      parkingForm.value.car_image_url = null;
      if (document.getElementById('carImage')) {
        document.getElementById('carImage').value = '';
      }
    } else if (type === 'receipt') {
      receiptImagePreview.value = null;
      selectedReceiptImageFile.value = null;
      parkingForm.value.receipt_image_path = null;
      parkingForm.value.receipt_image_url = null;
      if (document.getElementById('receiptImage')) {
        document.getElementById('receiptImage').value = '';
      }
    }
  };
  
  const uploadImage = async (file, type) => {
    if (!file) return null;
    
    // Validate required props
    if (!normalizedProjectId.value) {
      throw new Error('Project ID is required to upload images. Please ensure you are accessing parking from within a project.');
    }
    if (!normalizedTripId.value) {
      throw new Error('Trip ID is required to upload images. Please ensure you are accessing parking from within a trip.');
    }
    
    isUploading.value = true;
    uploadingType.value = type;
    uploadProgress.value = 0;
    
    try {
      // Simulate progress since Supabase doesn't provide real-time progress callbacks
      // We'll show progress in stages
      const progressInterval = setInterval(() => {
        if (uploadProgress.value < 90) {
          uploadProgress.value += 10;
        }
      }, 200);
      
      const fileExt = file.name.split('.').pop();
      const prefix = type === 'car' ? 'car' : 'receipt';
      const fileName = `${normalizedProjectId.value}/${normalizedTripId.value}/${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      uploadProgress.value = 20; // Start upload
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('parking-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      clearInterval(progressInterval);
      uploadProgress.value = 100;
      
      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        // Provide helpful error message for missing bucket
        if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
          throw new Error('The parking-images storage bucket does not exist. Please create it in your Supabase dashboard under Storage.');
        }
        throw uploadError;
      }
      
      if (!uploadData?.path) {
        throw new Error('Upload succeeded but no path returned');
      }
      
      // Small delay to show 100% before completing
      await new Promise(resolve => setTimeout(resolve, 300));
      
      return uploadData.path;
    } finally {
      isUploading.value = false;
      uploadingType.value = null;
      uploadProgress.value = 0;
    }
  };
  
  const saveParking = async () => {
    isSaving.value = true;
    try {
      let carImagePath = parkingForm.value.image_path;
      let receiptImagePath = parkingForm.value.receipt_image_path;
      
      // Upload car image if one was selected
      if (selectedCarImageFile.value) {
        try {
          // Delete old car image if editing and replacing
          if (editingParking.value?.image_path) {
            try {
              await supabase.storage
                .from('parking-images')
                .remove([editingParking.value.image_path]);
            } catch (err) {
              console.warn('Could not delete old car image:', err);
            }
          }
          
          carImagePath = await uploadImage(selectedCarImageFile.value, 'car');
        } catch (uploadErr) {
          console.error('Error uploading car image:', uploadErr);
          const errorMessage = uploadErr?.message || 'Failed to upload car image';
          toast.error(`Car image upload failed: ${errorMessage}`);
          throw uploadErr; // Re-throw to prevent saving without image
        }
      } else if (editingParking.value && editingParking.value.image_path && !parkingForm.value.image_path) {
        // Car image was removed: editing entry that had an image, but image_path is now null
        try {
          await supabase.storage
            .from('parking-images')
            .remove([editingParking.value.image_path]);
        } catch (err) {
          console.warn('Could not delete car image:', err);
        }
        carImagePath = null;
      }
      
      // Upload receipt image if one was selected
      if (selectedReceiptImageFile.value) {
        try {
          // Delete old receipt image if editing and replacing
          if (editingParking.value?.receipt_image_path) {
            try {
              await supabase.storage
                .from('parking-images')
                .remove([editingParking.value.receipt_image_path]);
            } catch (err) {
              console.warn('Could not delete old receipt image:', err);
            }
          }
          
          receiptImagePath = await uploadImage(selectedReceiptImageFile.value, 'receipt');
        } catch (uploadErr) {
          console.error('Error uploading receipt image:', uploadErr);
          const errorMessage = uploadErr?.message || 'Failed to upload receipt image';
          toast.error(`Receipt image upload failed: ${errorMessage}`);
          throw uploadErr; // Re-throw to prevent saving without image
        }
      } else if (editingParking.value && editingParking.value.receipt_image_path && !parkingForm.value.receipt_image_path) {
        // Receipt image was removed: editing entry that had an image, but receipt_image_path is now null
        try {
          await supabase.storage
            .from('parking-images')
            .remove([editingParking.value.receipt_image_path]);
        } catch (err) {
          console.warn('Could not delete receipt image:', err);
        }
        receiptImagePath = null;
      }
      
      const formData = {
        airport: parkingForm.value.airport,
        parking_provider: parkingForm.value.parking_provider,
        start_datetime: parkingForm.value.start_datetime,
        end_datetime: parkingForm.value.end_datetime,
        cost: parkingForm.value.cost,
        notes: parkingForm.value.notes,
        member_email: parkingForm.value.member_email,
        image_path: carImagePath,
        receipt_image_path: receiptImagePath
      };
      
      if (editingParking.value) {
        const { error } = await supabase
          .from('travel_parking')
          .update(formData)
          .eq('id', editingParking.value.id);
        if (error) {
          console.error('Error updating parking:', error);
          throw error;
        }
        toast.success('Parking updated');
      } else {
        const { error } = await supabase
          .from('travel_parking')
          .insert({ ...formData, trip_id: normalizedTripId.value });
        if (error) {
          console.error('Error inserting parking:', error);
          throw error;
        }
        toast.success('Parking added');
      }
      await loadParking();
      closeForm();
    } catch (err) {
      console.error('Error saving parking:', err);
      // Show more specific error message
      const errorMessage = err?.message || 'Failed to save parking';
      if (errorMessage.includes('upload') || errorMessage.includes('storage') || errorMessage.includes('image')) {
        toast.error(`Image error: ${errorMessage}`);
      } else {
        toast.error(`Failed to save parking: ${errorMessage}`);
      }
    } finally {
      isSaving.value = false;
    }
  };
  const deleteParking = async (id) => {
    if (!confirm('Delete this parking entry?')) return;
    try {
      // Get the entry to find image paths
      const entry = parkingEntries.value.find(e => e.id === id);
      
      // Delete car image from storage if it exists
      if (entry?.image_path) {
        try {
          await supabase.storage
            .from('parking-images')
            .remove([entry.image_path]);
        } catch (err) {
          console.warn('Could not delete car image:', err);
        }
      }
      
      // Delete receipt image from storage if it exists
      if (entry?.receipt_image_path) {
        try {
          await supabase.storage
            .from('parking-images')
            .remove([entry.receipt_image_path]);
        } catch (err) {
          console.warn('Could not delete receipt image:', err);
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
    carImagePreview,
    receiptImagePreview,
    isUploading,
    uploadProgress,
    uploadingType,
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

/* Upload Progress Styles */
.upload-progress-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.upload-progress-content {
  background: var(--bg-primary);
  padding: 20px;
  border-radius: 8px;
  min-width: 200px;
  text-align: center;
}

.upload-progress-standalone {
  margin-top: 16px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #059669);
  transition: width 0.3s ease;
  border-radius: 4px;
}

.progress-text {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
  font-weight: 500;
}

.upload-progress-content .progress-text {
  color: var(--text-heading);
  font-size: 16px;
}

.image-upload-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.parking-images-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 16px;
}

.parking-image-container {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
}

.image-label {
  background: var(--bg-secondary);
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #e5e7eb;
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