<template>
<div class="accommodations">
  <!-- Consolidated Header Section -->
  <div class="consolidated-header">
    <!-- Row 1: Back Button, Title, and Subtitle -->
    <div class="header-row-1">
      <button class="back-button" @click="goBackToDashboard" aria-label="Back to dashboard">
        <span class="back-icon">←</span>
        <span class="back-text">Back to Dashboard</span>
      </button>
      
      <div class="title-section">
        <h1>Accommodations</h1>
        <p>Manage your hotel and lodging information</p>
      </div>
    </div>
    
    <!-- Row 2: Trip Selector -->
    <div class="header-row-2">
      <div class="trip-selector">
        <label for="trip-select">Select Trip:</label>
        <select
          id="trip-select"
          v-model="selectedTripId"
          @change="loadAccommodations"
          class="trip-select-input"
          aria-label="Select a trip to view accommodations"
        >
          <option value="">-- Select a Trip --</option>
          <option v-for="trip in trips" :key="trip.id" :value="trip.id">
            {{ trip.name }} ({{ formatDateRange(trip.start_date, trip.end_date) }})
          </option>
        </select>
      </div>
    </div>
  </div>

  <!-- Loading State -->
  <div v-if="isLoading" class="loading-state">
    <div class="skeleton-loader">
      <div class="skeleton-item"></div>
      <div class="skeleton-item"></div>
      <div class="skeleton-item"></div>
    </div>
  </div>

  <!-- Empty State -->
  <div v-else-if="!selectedTripId" class="empty-state">
    <div class="empty-icon">🏨</div>
    <h3>Select a trip</h3>
    <p>Please select a trip to view and manage accommodations</p>
  </div>

  <!-- Content Container -->
  <div v-else class="content-container">
    <div class="section-header">
      <h2>Accommodations</h2>
      <button v-if="canManageProject" @click="openAddForm" class="add-button" aria-label="Add new accommodation">
        <span class="icon">+</span>
        <span class="button-text">Add Accommodation</span>
      </button>
    </div>

    <!-- Inline Add/Edit Form -->
    <div v-if="showAccommodationForm" class="accommodation-form-container">
      <h3>{{ editingAccommodation ? 'Edit Accommodation' : 'Add New Accommodation' }}</h3>
      <form @submit.prevent="saveAccommodation">
        <div class="form-group">
          <label for="accommodationName">Accommodation Name</label>
          <input
            type="text"
            id="accommodationName"
            v-model="accommodationForm.name"
            required
            placeholder="e.g., Hilton Downtown"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label for="accommodationType">Accommodation Type</label>
          <select id="accommodationType" v-model="accommodationForm.type" required class="form-select">
            <option value="">-- Select Type --</option>
            <option value="Hotel">Hotel</option>
            <option value="Airbnb">Airbnb</option>
            <option value="Hostel">Hostel</option>
            <option value="Resort">Resort</option>
            <option value="Apartment">Apartment</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div class="form-group">
          <label for="accommodationAddress">Google Maps Link</label>
          <input
            type="url"
            id="accommodationAddress"
            v-model="accommodationForm.address"
            required
            placeholder="https://maps.google.com/..."
            class="form-input"
          />
          <p class="form-help-text">Paste the Google Maps link for this location</p>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="checkInDate">Check-in Date</label>
            <input
              type="date"
              id="checkInDate"
              v-model="accommodationForm.check_in_date"
              required
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="checkOutDate">Check-out Date</label>
            <input
              type="date"
              id="checkOutDate"
              v-model="accommodationForm.check_out_date"
              required
              class="form-input"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="confirmationNumber">Confirmation Number</label>
            <input
              type="text"
              id="confirmationNumber"
              v-model="accommodationForm.confirmation_number"
              placeholder="Optional"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="phoneNumber">Phone Number</label>
            <input
              type="tel"
              id="phoneNumber"
              v-model="accommodationForm.phone_number"
              placeholder="Optional"
              class="form-input"
            />
          </div>
        </div>

        <div class="form-group">
          <label for="notes">Notes</label>
          <textarea
            id="notes"
            v-model="accommodationForm.notes"
            rows="3"
            placeholder="Any additional notes about this accommodation"
            class="form-textarea"
          ></textarea>
        </div>

        <div class="form-group">
          <label for="accommodationMembers">Who is Staying Here?</label>
          <p class="form-help-text">Select team members staying at this accommodation. You can select multiple members.</p>
          <div v-if="projectMembers.length === 0" class="member-selector-empty">
            <p class="form-help-text">No project members found. Please add members to the project first.</p>
          </div>
          <div v-else class="member-selector">
            <label 
              v-for="member in projectMembers" 
              :key="member.user_email"
              class="member-checkbox-label"
            >
              <input
                type="checkbox"
                :value="member.user_email"
                v-model="accommodationForm.member_emails"
                class="member-checkbox"
              />
              <span>{{ member.display_name }}</span>
            </label>
          </div>
        </div>

        <div class="form-actions">
          <button
            type="button"
            @click="cancelForm"
            class="secondary-button"
          >
            Cancel
          </button>
          <button type="submit" class="primary-button">
            {{ editingAccommodation ? 'Update' : 'Add' }} Accommodation
          </button>
        </div>
      </form>
    </div>

    <!-- Accommodations List -->
    <div v-if="accommodations.length === 0" class="empty-accommodations">
      <div class="empty-icon">🏠</div>
      <h3>No accommodations yet</h3>
      <p>Add your first accommodation to get started</p>
    </div>

    <div v-else class="accommodations-list">
      <div
        v-for="accommodation in accommodations"
        :key="accommodation.id"
        class="accommodation-card"
      >
        <div class="accommodation-card-header">
          <h3>{{ accommodation.name }}</h3>
          <span class="accommodation-dates">
            {{ formatDateRange(accommodation.check_in_date, accommodation.check_out_date) }}
          </span>
        </div>
        
        <div class="accommodation-card-body">
          <div class="accommodation-address" v-if="accommodation.address">
            <span class="address-icon">📍</span>
            <a 
              :href="accommodation.address" 
              target="_blank" 
              rel="noopener noreferrer"
              class="address-link"
            >
              View on Google Maps
            </a>
          </div>
          
          <div class="accommodation-details">
            <div class="detail-item">
              <span class="detail-label">Type:</span>
              <span>{{ accommodation.type }}</span>
            </div>
            <div v-if="accommodation.confirmation_number" class="detail-item">
              <span class="detail-label">Confirmation:</span>
              <span>{{ accommodation.confirmation_number }}</span>
            </div>
            <div v-if="accommodation.phone_number" class="detail-item">
              <span class="detail-label">Phone:</span>
              <span>{{ accommodation.phone_number }}</span>
            </div>
            <div v-if="accommodation.member_names && accommodation.member_names.length > 0" class="detail-item">
              <span class="detail-label">Staying:</span>
              <span>{{ accommodation.member_names.join(', ') }}</span>
            </div>
          </div>
          
          <div v-if="accommodation.notes" class="accommodation-notes">
            <span class="detail-label">Notes:</span>
            <span>{{ accommodation.notes }}</span>
          </div>
        </div>
        
        <div v-if="canManageProject" class="accommodation-card-footer">
          <button
            @click="editAccommodation(accommodation)"
            class="action-button edit-button"
            aria-label="Edit accommodation"
          >
            <span class="action-icon">✏️</span>
            <span class="action-text">Edit</span>
          </button>
          
          <button
            @click="deleteAccommodation(accommodation)"
            class="action-button delete-button"
            aria-label="Delete accommodation"
          >
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
import { format, parseISO } from 'date-fns';

// NEW: import the router & user store
import { useRouter } from 'vue-router';
import { useUserStore } from '../../stores/userStore';

export default {
name: 'Accommodations',
props: ['id', 'tripId'],
setup(props) {
  const toast = useToast();
  // We create the router instance
  const router = useRouter();
  // We also get the userStore
  const userStore = useUserStore();

  const projectId = ref(userStore.currentProject?.id || props.id || '');
  const selectedTripId = ref(props.tripId || '');
  const isLoading = ref(false);

  const trips = ref([]);
  const accommodations = ref([]);

  const showAccommodationForm = ref(false);
  const editingAccommodation = ref(null);
  const isSaving = ref(false);
  
  // Permission check
  const canManageProject = ref(false);
  
  // Project members
  const projectMembers = ref([]);
  
  // Fetch project members
  async function fetchProjectMembers() {
    if (!userStore.currentProject?.id) return;
    try {
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

  const accommodationForm = ref({
    name: '',
    type: '',
    address: '',
    check_in_date: '',
    check_out_date: '',
    check_in_time: '15:00',
    check_out_time: '12:00',
    confirmation_number: '',
    room_type: '',
    map_link: '',
    amenities: '',
    notes: '',
    phone_number: '',
    member_emails: [] // Array for multiple members
  });

  const sortedAccommodations = computed(() => {
    return [...accommodations.value].sort((a, b) => {
      return new Date(a.check_in_date) - new Date(b.check_in_date);
    });
  });

  const loadTrips = async () => {
    try {
      const currentProjectId = userStore.currentProject?.id || projectId.value;
      if (!currentProjectId) {
        console.error('No project ID available');
        return;
      }
      const { data, error } = await supabase
        .from('travel_trips')
        .select('*')
        .eq('project_id', currentProjectId)
        .order('start_date', { ascending: true });
      if (error) throw error;
      trips.value = data || [];
    } catch (err) {
      console.error('Error loading trips:', err);
      toast.error('Failed to load trips');
    }
  };

  const loadAccommodations = async () => {
    if (!selectedTripId.value) return;
    isLoading.value = true;
    try {
      const { data, error } = await supabase
        .from('travel_accommodations')
        .select('*')
        .eq('trip_id', selectedTripId.value)
        .order('check_in_date', { ascending: true });
      if (error) throw error;
      
      // Enrich with member information
      const enriched = await Promise.all(
        (data || []).map(async (acc) => {
          const { data: accMembers } = await supabase
            .from('travel_accommodation_members')
            .select('user_email')
            .eq('accommodation_id', acc.id)
          
          const memberEmails = (accMembers || []).map(am => am.user_email)
          const memberNames = memberEmails.map(email => getMemberName(email))
          
          return {
            ...acc,
            member_emails: memberEmails,
            member_names: memberNames
          }
        })
      )
      
      accommodations.value = enriched;
    } catch (err) {
      console.error('Error loading accommodations:', err);
      toast.error('Failed to load accommodations');
    } finally {
      isLoading.value = false;
    }
  };

  // Fix the "Back to Dashboard" button
  const goBackToDashboard = () => {
    // For example, if your main route is 'TravelDashboard' by name:
    router.push({
      name: 'TravelDashboard',
      params: {
        id: userStore.currentProject?.id || projectId.value
      }
    });
  };

  const openAddForm = async () => {
    // Ensure project members are loaded before showing form
    if (projectMembers.value.length === 0) {
      await fetchProjectMembers();
    }
    resetAccommodationForm();
    editingAccommodation.value = null;
    showAccommodationForm.value = true;
  };

  const editAccommodation = async (acc) => {
    editingAccommodation.value = acc;
    accommodationForm.value = { 
      ...acc,
      member_emails: acc.member_emails || []
    };
    showAccommodationForm.value = true;
  };

  const deleteAccommodation = async (accommodation) => {
    if (!confirm('Are you sure you want to delete this accommodation?')) return;
    try {
      const accommodationId = accommodation?.id || accommodation;
      const { error } = await supabase
        .from('travel_accommodations')
        .delete()
        .eq('id', accommodationId)
        .select();
      if (error) {
        console.error('Error deleting accommodation:', error);
        toast.error(`Failed to delete: ${error.message ?? ''}`);
        return;
      }
      accommodations.value = accommodations.value.filter(a => a.id !== accommodationId);
      toast.success('Accommodation deleted');
    } catch (err) {
      console.error('Error deleting accommodation:', err);
      toast.error('Failed to delete accommodation');
    }
  };

  const saveAccommodation = async () => {
    if (!selectedTripId.value) {
      toast.error('No trip selected');
      return;
    }
    isSaving.value = true;
    try {
      // Build payload and remove empty optional fields
      const formData = { ...accommodationForm.value };
      const payload = {
        name: formData.name,
        type: formData.type,
        address: formData.address,
        check_in_date: formData.check_in_date,
        check_out_date: formData.check_out_date,
        check_in_time: formData.check_in_time || '15:00',
        check_out_time: formData.check_out_time || '12:00',
        room_type: formData.room_type || null,
        map_link: formData.map_link || null,
        amenities: formData.amenities || null,
        notes: formData.notes || null,
        // Only include optional fields if they have values
        ...(formData.confirmation_number ? { confirmation_number: formData.confirmation_number } : {}),
        ...(formData.phone_number ? { phone_number: formData.phone_number } : {}),
        trip_id: selectedTripId.value,
        project_id: projectId.value
      };

      let accommodationId;
      if (editingAccommodation.value) {
        // update
        const { data: updated, error } = await supabase
          .from('travel_accommodations')
          .update(payload)
          .eq('id', editingAccommodation.value.id)
          .select()
          .single();
        if (error) {
          console.error('Error updating accommodation:', error);
          toast.error(`Failed to update: ${error.message ?? ''}`);
          isSaving.value = false;
          return;
        }
        accommodationId = updated.id;
      } else {
        // insert
        const { data: inserted, error } = await supabase
          .from('travel_accommodations')
          .insert(payload)
          .select()
          .single();
        if (error) {
          console.error('Error inserting accommodation:', error);
          toast.error(`Failed to add: ${error.message ?? ''}`);
          isSaving.value = false;
          return;
        }
        accommodationId = inserted.id;
      }
      
      // Handle member associations
      const memberEmails = formData.member_emails || [];
      
      // Delete existing members for this accommodation
      await supabase
        .from('travel_accommodation_members')
        .delete()
        .eq('accommodation_id', accommodationId);
      
      // Insert new members
      if (memberEmails.length > 0) {
        const memberRecords = memberEmails.map(email => ({
          accommodation_id: accommodationId,
          user_email: email
        }));
        
        const { error: membersError } = await supabase
          .from('travel_accommodation_members')
          .insert(memberRecords);
        
        if (membersError) {
          console.error('Error saving accommodation members:', membersError);
          toast.error('Accommodation saved but failed to update members');
        }
      }
      
      if (editingAccommodation.value) {
        toast.success('Accommodation updated');
      } else {
        toast.success('Accommodation added');
      }
      
      await loadAccommodations();
      showAccommodationForm.value = false;
      editingAccommodation.value = null;
    } catch (err) {
      console.error('Exception while saving accommodation:', err);
      toast.error('Unexpected error while saving accommodation');
    } finally {
      isSaving.value = false;
    }
  };

  const resetAccommodationForm = () => {
    accommodationForm.value = {
      name: '',
      type: '',
      address: '',
      check_in_date: '',
      check_out_date: '',
      check_in_time: '15:00',
      check_out_time: '12:00',
      confirmation_number: '',
      room_type: '',
      map_link: '',
      amenities: '',
      notes: '',
      phone_number: '',
      member_emails: []
    };
  };

  const cancelForm = () => {
    showAccommodationForm.value = false;
    resetAccommodationForm();
    editingAccommodation.value = null;
  };

  const openMapLink = (link) => {
    window.open(link, '_blank');
  };

  const formatDateRange = (start, end) => {
    if (!start || !end) return '';
    const s = parseISO(start);
    const e = parseISO(end);
    return `${format(s, 'MMM d, yyyy')} - ${format(e, 'MMM d, yyyy')}`;
  };

  const formatTime = (time) => {
    if (!time) return '';
    const [hour, minute] = time.split(':');
    if (!hour || !minute) return '';
    const date = new Date();
    date.setHours(hour, minute);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const parseAmenities = (amenities) => {
    if (!amenities) return [];
    return amenities.split(',').map(item => item.trim());
  };

  onMounted(async () => {
    await checkUserRole();
    await fetchProjectMembers();
    loadTrips();
    if (selectedTripId.value) {
      loadAccommodations();
    }
  });

  return {
    projectId,
    trips,
    accommodations,
    selectedTripId,
    isLoading,
    showAccommodationForm,
    editingAccommodation,
    isSaving,
    accommodationForm,
    sortedAccommodations,
    projectMembers,

    loadAccommodations,
    openAddForm,
    editAccommodation,
    deleteAccommodation,
    openMapLink,
    saveAccommodation,
    cancelForm, // Changed from closeForm

    // The fixed method
    goBackToDashboard,
    
    // Permissions
    canManageProject,

    // Helpers
    formatDateRange,
    formatTime,
    parseAmenities
  };
}
};
</script>


<style scoped>
/* Mobile-first base styles */
.accommodations {
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
  .accommodations {
    padding-left: max(16px, env(safe-area-inset-left));
    padding-right: max(16px, env(safe-area-inset-right));
    padding-top: max(16px, env(safe-area-inset-top));
    padding-bottom: max(16px, env(safe-area-inset-bottom));
  }
}

/* Consolidated Header Section */
.consolidated-header {
  background: #ffffff;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
  margin-bottom: 24px;
}

.header-row-1 {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 16px;
}

.header-row-2 {
  width: 100%;
}

.title-section {
  flex: 1;
  text-align: center;
}

.title-section h1 {
  font-size: 24px;
  margin: 0 0 8px 0;
  color: #111827;
  font-weight: 700;
  line-height: 1.4;
}

.title-section p {
  margin: 0;
  color: #6b7280;
  font-size: 16px;
  line-height: 1.5;
}

.trip-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.trip-selector label {
  font-weight: 500;
  color: #374151;
  font-size: 16px;
  white-space: nowrap;
}

.trip-select-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 16px;
  background: #ffffff;
  color: #1f2937;
  min-width: 0;
}

.trip-select-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Header Section */

.back-button {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
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

.back-button:hover {
  background: #e5e7eb;
  border-color: #9ca3af;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.back-button:active {
  transform: translateY(0);
}

.back-button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
}

.back-icon {
  font-size: 18px;
  font-weight: bold;
}

.back-text {
  display: none;
}

/* Trip Selector */

/* Loading State */
.loading-state {
  display: flex;
  justify-content: center;
  padding: 32px 0;
}

.skeleton-loader {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 600px;
}

.skeleton-item {
  height: 80px;
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
  color: #6b7280;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 20px;
  margin: 0 0 8px 0;
  color: #374151;
  font-weight: 600;
}

.empty-state p {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
}

/* Content Container */
.content-container {
  background: #ffffff;
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
  color: #111827;
  font-weight: 600;
  line-height: 1.4;
}

/* Add Button */
.add-button {
  background: #3b82f6;
  color: #ffffff;
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

/* Form Container */
.accommodation-form-container {
  background: #f9fafb;
  border-radius: 12px;
  padding: 28px 24px;
  margin-bottom: 24px;
  border: 1px solid #e5e7eb;
}

.accommodation-form-container h3 {
  font-size: 18px;
  margin: 0 0 20px 0;
  color: #111827;
  font-weight: 600;
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
  color: #374151;
  font-size: 16px;
  line-height: 1.4;
}

.form-help-text {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.4;
}

.member-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  max-height: 200px;
  overflow-y: auto;
}

.member-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.member-checkbox-label:hover {
  background-color: #f3f4f6;
}

.member-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #3b82f6;
}

.member-checkbox-label span {
  font-size: 14px;
  color: #374151;
  user-select: none;
}

.member-selector-empty {
  padding: 12px;
  background: #fef3c7;
  border-radius: 8px;
  border: 1px solid #fcd34d;
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 14px 18px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 16px;
  line-height: 1.5;
  box-sizing: border-box;
  background: #ffffff;
  color: #111827;
  transition: all 0.2s ease;
  min-height: 48px;
}

.form-textarea {
  min-height: 80px;
  resize: vertical;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  background: #10b981;
  color: #ffffff;
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

.primary-button:hover {
  background: #059669;
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
  background: #9ca3af;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.secondary-button {
  background: #6b7280;
  color: #ffffff;
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

/* Empty Accommodations */
.empty-accommodations {
  text-align: center;
  padding: 32px 16px;
  color: #6b7280;
}

.empty-accommodations .empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-accommodations h3 {
  font-size: 20px;
  margin: 0 0 8px 0;
  color: #374151;
  font-weight: 600;
}

.empty-accommodations p {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
}

/* Accommodations List */
.accommodations-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.accommodation-card {
  background: #f9fafb;
  border-radius: 12px;
  padding: 20px 16px;
  border: 1px solid #e5e7eb;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.accommodation-card:hover {
  background: #f3f4f6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.accommodation-card-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.accommodation-card-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  line-height: 1.4;
}

.accommodation-dates {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.4;
}

.accommodation-card-body {
  margin-bottom: 20px;
}

.accommodation-address {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  gap: 8px;
}

.address-icon {
  font-size: 16px;
  color: #6b7280;
}

.address-link {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s ease;
}

.address-link:hover {
  color: #2563eb;
  text-decoration: underline;
}

.accommodation-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.detail-item {
  font-size: 14px;
  color: #374151;
  line-height: 1.4;
}

.detail-label {
  font-weight: 600;
  margin-right: 8px;
}

.accommodation-notes {
  font-size: 14px;
  color: #374151;
  line-height: 1.4;
  padding: 12px;
  background: #f3f4f6;
  border-radius: 8px;
  border-left: 3px solid #3b82f6;
}

.accommodation-card-footer {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  border: 1px solid #e5e7eb;
  color: #374151;
  background: #f9fafb;
  min-height: 44px;
  min-width: 44px;
  flex: 1;
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
  color: #ffffff;
  border-color: #2563eb;
}

.action-button.edit-button:hover {
  background: #2563eb;
  border-color: #1d4ed8;
}

.action-button.delete-button {
  background: #dc2626;
  color: #ffffff;
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
  display: none;
}

/* Tablet Breakpoint (601px - 1024px) */
@media (min-width: 601px) {
  .accommodations {
    padding: 24px;
  }
  
  .header-section {
    padding: 32px 24px;
    margin-bottom: 32px;
  }
  
  .header-section h1 {
    font-size: 28px;
  }
  
  .trip-selector {
    padding: 24px 20px;
    margin-bottom: 32px;
  }
  
  .content-container {
    padding: 24px 20px;
  }
  
  .accommodation-form-container {
    padding: 28px 24px;
  }
  
  .accommodation-card {
    padding: 24px 20px;
  }
  
  .accommodation-card-header {
    flex-direction: row;
    justify-content: space-between;
    align-items: baseline;
  }
  
  .accommodation-details {
    flex-direction: row;
    flex-wrap: wrap;
  }
  
  .detail-item {
    flex: 1 1 45%;
  }
  
  .action-text {
    display: inline;
  }
  
  .button-text {
    display: inline;
  }
  
  .back-text {
    display: inline;
  }
  
  .form-row {
    flex-direction: row;
  }
  
  .form-row .form-group {
    flex: 1;
  }
}

/* Desktop Breakpoint (1025px+) */
@media (min-width: 1025px) {
  .accommodations {
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
  
  .trip-selector {
    padding: 32px 28px;
    margin-bottom: 40px;
  }
  
  .content-container {
    padding: 32px 28px;
  }
  
  .accommodation-form-container {
    padding: 32px 28px;
  }
  
  .accommodation-card {
    padding: 28px 24px;
  }
}

/* Mobile-specific adjustments */
@media (max-width: 600px) {
  .accommodations {
    padding: 12px;
  }
  
  .consolidated-header {
    padding: 16px;
    margin-bottom: 20px;
  }
  
  .header-row-1 {
    flex-direction: column;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }
  
  .title-section h1 {
    font-size: 22px;
  }
  
  .trip-selector {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  
  .trip-selector label {
    text-align: center;
  }
  
  .back-text {
    display: inline;
  }
  
  .content-container {
    padding: 16px 12px;
  }
  
  .accommodation-form-container {
    padding: 20px 16px;
  }
  
  .accommodation-card {
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
  
  .accommodation-card-footer {
    flex-direction: column;
  }
  
  .action-button {
    width: 100%;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .form-actions button {
    width: 100%;
  }
}
</style>