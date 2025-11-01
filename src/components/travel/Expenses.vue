<template>
<div class="expenses">
  <!-- Consolidated Header Section -->
  <div class="consolidated-header">
    <!-- Row 1: Back Button, Title, and Subtitle -->
    <div class="header-row-1">
      <button class="back-button" @click="goBackToDashboard" aria-label="Back to dashboard">
        <span class="back-icon">←</span>
        <span class="back-text">Back to Dashboard</span>
      </button>
      
      <div class="title-section">
        <h1>Expenses</h1>
        <p>Manage your travel expenses</p>
      </div>
    </div>
    
    <!-- Row 2: Trip Selector -->
    <div class="header-row-2">
      <div class="trip-selector">
        <label for="trip-select">Select Trip:</label>
        <select 
          id="trip-select" 
          v-model="selectedTripId" 
          @change="loadExpenses"
          class="trip-select-input"
          aria-label="Select a trip to view expenses"
        >
          <option value="">-- Select a Trip --</option>
          <option
            v-for="trip in trips"
            :key="trip.id"
            :value="trip.id"
          >
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
    <div class="empty-icon">💰</div>
    <h3>Select a trip</h3>
    <p>Please select a trip to view and manage expenses</p>
  </div>

  <!-- Content Container -->
  <div v-else class="content-container">
    <div class="section-header">
      <h2>Expenses</h2>
      <button v-if="canManageProject" @click="openModal" class="add-button" aria-label="Add new expense">
        <span class="icon">+</span>
        <span class="button-text">Add Expense</span>
      </button>
    </div>

    <!-- Empty Expenses State -->
    <div v-if="expenses.length === 0" class="empty-expenses">
      <div class="empty-icon">💳</div>
      <h3>No expenses yet</h3>
      <p>Add your first expense to get started!</p>
    </div>

    <!-- Expenses List -->
    <div v-else class="expenses-list">
      <div
        v-for="expense in sortedExpenses"
        :key="expense.id"
        class="expense-card"
      >
        <div class="expense-info">
          <h3>{{ expense.title }}</h3>
          <p class="expense-category">{{ expense.category }}</p>
          <p class="expense-amount">${{ Number(expense.amount).toFixed(2) }}</p>
          <p class="expense-date">{{ formatDate(expense.date) }}</p>
          <p v-if="expense.member_name" class="expense-member">For: {{ expense.member_name }}</p>
          <p v-if="expense.description" class="expense-description">{{ expense.description }}</p>

          <!-- Receipt preview if available -->
          <div v-if="expense.localUrl && isImageFile(expense.file_path)" class="receipt-preview">
            <img
              :src="expense.localUrl"
              alt="Expense receipt"
              class="receipt-image"
            />
          </div>
        </div>

        <div class="expense-actions">
          <button v-if="canManageProject" @click="editExpense(expense)" class="action-button edit-button" aria-label="Edit expense">
            <span class="action-icon">✏️</span>
            <span class="action-text">Edit</span>
          </button>
          
          <button v-if="canManageProject" @click="deleteExpense(expense)" class="action-button delete-button" aria-label="Delete expense">
            <span class="action-icon">🗑️</span>
            <span class="action-text">Delete</span>
          </button>

          <!-- File actions if available -->
          <button
            v-if="expense.file_path"
            @click="viewStorageFile(expense.file_path)"
            class="action-button view-button"
            aria-label="View receipt"
          >
            <span class="action-icon">👁️</span>
            <span class="action-text">View</span>
          </button>

          <button
            v-if="expense.file_path"
            @click="downloadForOffline(expense)"
            class="action-button download-button"
            aria-label="Load receipt offline"
          >
            <span class="action-icon">⬇️</span>
            <span class="action-text">Download</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Add/Edit Expense Modal -->
  <div v-if="showModal" class="modal" role="dialog" aria-labelledby="modal-title">
    <div class="modal-overlay" @click="closeModal"></div>
    <div class="modal-container">
      <div class="modal-header">
        <h2 id="modal-title">{{ editingExpense ? 'Edit Expense' : 'Add New Expense' }}</h2>
        <button @click="closeModal" class="close-button" aria-label="Close modal">×</button>
      </div>
      
      <div class="modal-body">
        <form @submit.prevent="saveExpense">
          <div class="form-group">
            <label for="expenseTitle">Title</label>
            <input
              type="text"
              id="expenseTitle"
              v-model="expenseForm.title"
              required
              placeholder="Expense title"
              class="form-input"
            />
          </div>
          
          <div class="form-group">
            <label for="expenseCategory">Category</label>
            <select id="expenseCategory" v-model="expenseForm.category" required class="form-select">
              <option value="">-- Select Category --</option>
              <option value="Food">Food</option>
              <option value="Transport">Transport</option>
              <option value="Lodging">Lodging</option>
              <option value="Entertainment">Entertainment</option>
              <option value="Other">Other</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="expenseAmount">Amount</label>
            <input
              type="number"
              id="expenseAmount"
              v-model.number="expenseForm.amount"
              required
              placeholder="Amount"
              min="0"
              step="0.01"
              class="form-input"
            />
          </div>
          
          <div class="form-group">
            <label for="expenseDate">Date</label>
            <input
              type="date"
              id="expenseDate"
              v-model="expenseForm.date"
              required
              class="form-input"
            />
          </div>
          
          <div class="form-group">
            <label for="expenseDescription">Description (Optional)</label>
            <textarea
              id="expenseDescription"
              v-model="expenseForm.description"
              rows="3"
              placeholder="Additional details"
              class="form-textarea"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="expenseMember">Who is this expense for?</label>
            <select id="expenseMember" v-model="expenseForm.member_email" class="form-select">
              <option value="">-- Select Member --</option>
              <option v-for="member in projectMembers" :key="member.user_email" :value="member.user_email">
                {{ member.display_name }}
              </option>
            </select>
          </div>

          <!-- File upload input for receipt or invoice -->
          <div class="form-group">
            <label for="expenseReceipt">Receipt (Optional, max 5MB)</label>
            <input
              type="file"
              id="expenseReceipt"
              ref="fileInput"
              @change="handleFileChange"
              class="form-file-input"
              accept="image/*,.pdf,.doc,.docx"
            />
            <p v-if="selectedFileName" class="file-name">
              Selected: {{ selectedFileName }}
            </p>
          </div>

          <div class="form-actions">
            <button type="button" @click="closeModal" class="secondary-button">
              Cancel
            </button>
            <button type="submit" class="primary-button" :disabled="isSaving">
              <span v-if="isSaving" class="loading-spinner-small"></span>
              {{ isSaving ? 'Saving...' : (editingExpense ? 'Update Expense' : 'Add Expense') }}
            </button>
          </div>
        </form>
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
import { useRouter } from 'vue-router';

// Offline file caching, same as in Documents
import { storeDocumentFile, getDocumentFile } from '@/utils/indexedDB';

export default {
name: "Expenses",
props: ['id', 'tripId'],
setup(props) {
  const toast = useToast();
  const userStore = useUserStore();
  const router = useRouter(); // <--- create the router instance

  // For RLS, ensure we have userId
  const userId = ref(userStore.user?.id || null);

  // Project ID from store or prop
  const projectId = ref(userStore.currentProject?.id || props.id);
  // The selected trip from prop
  const selectedTripId = ref(props.tripId || '');

  const trips = ref([]);
  const expenses = ref([]);
  const isLoading = ref(false);

  // Modal
  const showModal = ref(false);
  const editingExpense = ref(null);
  const isSaving = ref(false);

  // File input
  const fileInput = ref(null);
  const selectedFile = ref(null);
  const selectedFileName = ref("");
  
  // Permission check
  const canManageProject = ref(false);
  
  // Project members
  const projectMembers = ref([]);
  const currentUserEmail = ref('');
  
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

  // Expense form
  const expenseForm = ref({
    title: "",
    category: "",
    amount: 0,
    date: "",
    description: "",
    file_path: "",
    url: "",
    member_email: "" // Will be set to current user when opening modal
  });

  // "Back to Dashboard" button
  const goBackToDashboard = () => {
    router.push({
      name: 'TravelDashboard',
      params: {
        id: userStore.currentProject?.id || projectId.value
      }
    });
  };

  // Sort by date ascending
  const sortedExpenses = computed(() => {
    return expenses.value.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = parseISO(dateStr);
    return format(d, "MMM d, yyyy");
  };

  const formatDateRange = (start, end) => {
    if (!start || !end) return "";
    const s = parseISO(start);
    const e = parseISO(end);
    return `${format(s, "MMM d, yyyy")} - ${format(e, "MMM d, yyyy")}`;
  };

  const isImageFile = (filePath = "") => {
    const ext = filePath.split(".").pop().toLowerCase();
    return ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext);
  };

  // Load trips
  const loadTrips = async () => {
    try {
      if (!projectId.value) return;
      const { data, error } = await supabase
        .from('travel_trips')
        .select('*')
        .eq('project_id', projectId.value)
        .order('start_date', { ascending: true });
      if (error) throw error;
      trips.value = data || [];
    } catch (err) {
      console.error("Error loading trips:", err);
      toast.error("Failed to load trips");
    }
  };

  // Load expenses
  const loadExpenses = async () => {
    if (!selectedTripId.value) return;
    isLoading.value = true;
    try {
      const { data, error } = await supabase
        .from('travel_expenses')
        .select('*')
        .eq('trip_id', selectedTripId.value)
        .order('date', { ascending: true });
      if (error) throw error;

      // Initialize localUrl and enrich with member names
      expenses.value = (data || []).map(item => ({ 
        ...item, 
        localUrl: null,
        member_name: item.member_email ? getMemberName(item.member_email) : null
      }));
    } catch (err) {
      console.error("Error loading expenses:", err);
      toast.error("Failed to load expenses");
    } finally {
      isLoading.value = false;
    }
  };

  // Open & Close Modal
  const openModal = () => {
    editingExpense.value = null;
    resetForm();
    expenseForm.value.member_email = currentUserEmail.value; // Default to current user
    showModal.value = true;
  };
  const closeModal = () => {
    showModal.value = false;
    selectedFile.value = null;
    selectedFileName.value = "";
    if (fileInput.value) {
      fileInput.value.value = "";
    }
  };

  // File input changes
  const handleFileChange = (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (!file) return;

    // Check size <= 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large (max 5MB).");
      e.target.value = "";
      return;
    }
    selectedFile.value = file;
    selectedFileName.value = file.name;
  };

  // Edit expense
  const editExpense = (expense) => {
    editingExpense.value = expense;
    expenseForm.value = { ...expense };
    showModal.value = true;
  };

  // Delete expense
  const deleteExpense = async (expense) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    try {
      // Remove file from bucket if it exists
      if (expense.file_path) {
        await removeStorageFile(expense.file_path);
      }
      const { error } = await supabase
        .from('travel_expenses')
        .delete()
        .eq('id', expense.id);
      if (error) throw error;

      expenses.value = expenses.value.filter(e => e.id !== expense.id);
      toast.success("Expense deleted successfully");
    } catch (err) {
      console.error("Failed to delete expense:", err);
      toast.error("Error deleting expense");
    }
  };

  // Remove file from "travel-expenses" bucket
  const removeStorageFile = async (path) => {
    if (!path) return;
    try {
      const { error } = await supabase.storage
        .from("travel-expenses")
        .remove([path]);
      if (error) {
        console.error("Error removing file:", error);
      }
    } catch (err) {
      console.error("Unexpected error removing file:", err);
    }
  };

  // Upload to "travel-expenses" bucket
  const uploadStorageFile = async () => {
    if (!selectedFile.value) return null;
    try {
      const uid = userId.value || "anon";
      const filePath = `user_${uid}/${Date.now()}_${selectedFile.value.name}`;

      const { data, error } = await supabase.storage
        .from("travel-expenses")
        .upload(filePath, selectedFile.value);
      if (error) {
        console.error("Upload error:", error);
        toast.error(`Upload failed: ${error.message}`);
        return null;
      }
      return data.path; 
    } catch (err) {
      console.error("Unexpected error uploading file:", err);
      toast.error("Unexpected error uploading file");
      return null;
    }
  };

  // Generate a signed URL for the file
  const viewStorageFile = async (filePath) => {
    try {
      const { data, error } = await supabase.storage
        .from("travel-expenses")
        .createSignedUrl(filePath, 60);
      if (error || !data?.signedUrl) {
        console.error("Signed URL error:", error);
        toast.error("Unable to generate signed URL");
        return;
      }
      window.open(data.signedUrl, "_blank");
    } catch (err) {
      console.error("Error generating signed URL:", err);
      toast.error("Error opening file");
    }
  };

  // Download & store offline
  const downloadForOffline = async (expense) => {
    if (!expense.file_path) return;
    try {
      if (!navigator.onLine) {
        const cachedBlob = await getDocumentFile(expense.file_path);
        if (!cachedBlob) {
          toast.error("Offline - no cached file found.");
          return;
        }
        // If image, embed inline
        if (isImageFile(expense.file_path)) {
          expense.localUrl = URL.createObjectURL(cachedBlob);
        } else {
          const objectURL = URL.createObjectURL(cachedBlob);
          window.open(objectURL, "_blank");
        }
        return;
      }

      // If online
      const { data: fileBlob, error } = await supabase.storage
        .from("travel-expenses")
        .download(expense.file_path);
      if (error) {
        console.error("Download error:", error);
        toast.error(`Failed to download file: ${error.message}`);
        return;
      }
      if (fileBlob) {
        await storeDocumentFile(expense.file_path, fileBlob);
        if (isImageFile(expense.file_path)) {
          expense.localUrl = URL.createObjectURL(fileBlob);
        } else {
          const objectURL = URL.createObjectURL(fileBlob);
          window.open(objectURL, "_blank");
        }
      }
    } catch (err) {
      console.error("downloadForOffline error:", err);
      toast.error("Failed to load file offline");
    }
  };

  // Insert/Update expense
  const saveExpense = async () => {
    if (!selectedTripId.value) {
      toast.error("No trip selected");
      return;
    }
    if (!userId.value) {
      toast.error("No user is logged in. Cannot save with RLS.");
      return;
    }

    isSaving.value = true;
    try {
      let newFilePath = null;
      if (selectedFile.value) {
        // If editing, remove old
        if (editingExpense.value?.file_path) {
          await removeStorageFile(editingExpense.value.file_path);
        }
        newFilePath = await uploadStorageFile();
        if (!newFilePath) {
          isSaving.value = false;
          return;
        }
      }

      if (editingExpense.value) {
        // Update
        const payload = {
          title: expenseForm.value.title,
          category: expenseForm.value.category,
          amount: expenseForm.value.amount,
          date: expenseForm.value.date,
          description: expenseForm.value.description,
          user_id: userId.value
        };
        if (newFilePath) {
          payload.file_path = newFilePath;
          payload.url = newFilePath;
        }

        const { error } = await supabase
          .from('travel_expenses')
          .update(payload)
          .eq('id', editingExpense.value.id)
          .select();
        if (error) throw error;

        // Reflect changes
        const idx = expenses.value.findIndex(e => e.id === editingExpense.value.id);
        if (idx !== -1) {
          expenses.value[idx] = { ...expenses.value[idx], ...payload };
        }
        toast.success("Expense updated successfully");
      } else {
        // Insert
        const payload = {
          ...expenseForm.value,
          trip_id: selectedTripId.value,
          project_id: projectId.value,
          user_id: userId.value
        };
        if (newFilePath) {
          payload.file_path = newFilePath;
          payload.url = newFilePath;
        }

        const { data, error } = await supabase
          .from('travel_expenses')
          .insert(payload)
          .select();
        if (error) throw error;

        if (data && data.length > 0) {
          expenses.value.push({ ...data[0], localUrl: null });
        }
        toast.success("Expense added successfully");
      }

      closeModal();
    } catch (err) {
      console.error("Failed to save expense:", err);
      toast.error("Error saving expense");
    } finally {
      isSaving.value = false;
    }
  };

  // Reset form
  const resetForm = () => {
    expenseForm.value = {
      title: "",
      category: "",
      amount: 0,
      date: "",
      description: "",
      file_path: "",
      url: "",
      member_email: ""
    };
  };

  onMounted(async () => {
    await checkUserRole();
    await fetchProjectMembers();
    loadTrips();
    if (selectedTripId.value) {
      loadExpenses();
    }
  });

  return {
    // Data
    trips,
    expenses,
    selectedTripId,
    isLoading,
    showModal,
    editingExpense,
    isSaving,
    expenseForm,
    fileInput,
    selectedFile,
    selectedFileName,

    // The fixed back button
    goBackToDashboard,
    
    // Permissions
    canManageProject,

    // Computed & Methods
    sortedExpenses,
    formatDate,
    formatDateRange,
    loadExpenses,
    openModal,
    closeModal,
    editExpense,
    deleteExpense,
    saveExpense,
    resetForm,

    // File handling
    handleFileChange,
    removeStorageFile,
    viewStorageFile,
    downloadForOffline,
    isImageFile,
    projectMembers
  };
}
};
</script>


<style scoped>
/* Mobile-first base styles */
.expenses {
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
  .expenses {
    padding-left: max(16px, env(safe-area-inset-left));
    padding-right: max(16px, env(safe-area-inset-right));
    padding-top: max(16px, env(safe-area-inset-top));
    padding-bottom: max(16px, env(safe-area-inset-bottom));
  }
}

/* Consolidated Header Section */
.consolidated-header {
  background: var(--bg-primary);
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-light);
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
  color: var(--text-heading);
  font-weight: 700;
  line-height: 1.4;
}

.title-section p {
  margin: 0;
  color: var(--text-secondary);
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
  color: var(--text-secondary);
  font-size: 16px;
  white-space: nowrap;
}

.trip-select-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  font-size: 16px;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-width: 0;
}

.trip-select-input:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Header Section */

.header-section h1 {
  font-size: 24px;
  margin: 0 0 8px 0;
  color: var(--text-heading);
  font-weight: 700;
  line-height: 1.4;
}

.header-section p {
  margin: 0 0 20px 0;
  color: var(--text-secondary);
  font-size: 16px;
  line-height: 1.5;
}

.back-button {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-medium);
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
  background: var(--bg-tertiary);
  border-color: var(--border-medium);
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
.trip-selector {
  margin-bottom: 24px;
  background: var(--bg-primary);
  padding: 20px 16px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-light);
}

.trip-selector label {
  display: block;
  margin-bottom: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 16px;
  line-height: 1.4;
}

.trip-select-input {
  width: 100%;
  padding: 12px 16px;
  font-size: 16px;
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: all 0.2s ease;
  min-height: 48px;
  box-sizing: border-box;
}

.trip-select-input:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
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
  background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-tertiary) 50%, var(--bg-secondary) 75%);
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
  background: var(--bg-primary);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-light);
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
  border: 1px solid var(--border-light);
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
  background: var(--color-primary-500);
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

/* Empty Expenses */
.empty-expenses {
  text-align: center;
  padding: 32px 16px;
  color: var(--text-secondary);
}

.empty-expenses .empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-expenses h3 {
  font-size: 20px;
  margin: 0 0 8px 0;
  color: var(--text-secondary);
  font-weight: 600;
}

.empty-expenses p {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
}

/* Expenses List */
.expenses-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.expense-card {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 20px 16px;
  border: 1px solid var(--border-light);
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.expense-card:hover {
  background: var(--bg-tertiary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.expense-info h3 {
  margin: 0 0 8px 0;
  color: var(--text-heading);
  font-weight: 600;
  font-size: 18px;
  line-height: 1.4;
}

.expense-category,
.expense-amount,
.expense-date,
.expense-description {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  line-height: 1.4;
}

.expense-amount {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-success-600);
  margin-bottom: 8px;
}

.expense-category {
  color: var(--text-secondary);
  font-weight: 500;
}

.expense-description {
  color: var(--text-secondary);
  font-style: italic;
}

/* Receipt Preview */
.receipt-preview {
  margin-top: 12px;
}

.receipt-image {
  max-width: 200px;
  max-height: 150px;
  border-radius: 8px;
  border: 1px solid var(--border-light);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.expense-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
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
  border: 1px solid var(--border-light);
  color: var(--text-primary);
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
  background: var(--color-primary-500);
  color: var(--text-inverse);
  border-color: var(--color-primary-600);
}

.action-button.edit-button:hover {
  background: var(--color-primary-600);
  border-color: var(--color-primary-700);
}

.action-button.delete-button {
  background: var(--color-error-600);
  color: var(--text-inverse);
  border-color: var(--color-error-700);
}

.action-button.delete-button:hover {
  background: var(--color-error-700);
  border-color: var(--color-error-800);
}

.action-button.view-button {
  background: var(--color-success-500);
  color: var(--text-inverse);
  border-color: var(--color-success-600);
}

.action-button.view-button:hover {
  background: var(--color-success-600);
  border-color: var(--color-success-700);
}

.action-button.download-button {
  background: var(--color-purple-500);
  color: var(--text-inverse);
  border-color: var(--color-purple-600);
}

.action-button.download-button:hover {
  background: var(--color-purple-600);
  border-color: var(--color-purple-700);
}

.action-icon {
  font-size: 16px;
}

.action-text {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.2;
}

/* Modal Styles */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
  box-sizing: border-box;
}

.modal-overlay {
  position: absolute;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal-container {
  position: relative;
  background: var(--bg-primary);
  border-radius: 16px;
  padding: 28px 24px;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  z-index: 1001;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.modal-header h2 {
  margin: 0;
  font-size: 22px;
  color: var(--text-heading);
  font-weight: 600;
  line-height: 1.4;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary);
  border-radius: 8px;
  transition: all 0.2s ease;
  padding: 8px;
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.close-button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
}

.modal-body {
  max-height: calc(90vh - 120px);
  overflow-y: auto;
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
.form-select,
.form-textarea,
.form-file-input {
  width: 100%;
  padding: 14px 18px;
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  font-size: 16px;
  line-height: 1.5;
  box-sizing: border-box;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: all 0.2s ease;
  min-height: 48px;
}

.form-textarea {
  min-height: 80px;
  resize: vertical;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus,
.form-file-input:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.file-name {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: 8px;
  line-height: 1.4;
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
  background: var(--color-secondary-600);
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
  border: 2px solid var(--bg-tertiary);
  border-top: 2px solid var(--color-success-500);
  border-radius: 50%;
  width: 16px;
  height: 16px;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Tablet Breakpoint (601px - 1024px) */
@media (min-width: 601px) {
  .expenses {
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
  
  .expense-card {
    flex-direction: row;
    align-items: flex-start;
    gap: 20px;
  }
  
  .expense-info {
    flex: 1;
  }
  
  .expense-actions {
    justify-content: flex-end;
    align-self: flex-start;
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
  
  .back-text {
    display: inline;
  }
}

/* Desktop Breakpoint (1025px+) */
@media (min-width: 1025px) {
  .expenses {
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
  
  .modal-container {
    padding: 32px 28px;
    max-width: 560px;
  }
}

/* Mobile-specific adjustments */
@media (max-width: 600px) {
  .expenses {
    padding: 12px;
  }
  
  .header-section {
    padding: 20px 16px;
    margin-bottom: 20px;
  }
  
  .header-section h1 {
    font-size: 22px;
  }
  
  .trip-selector {
    padding: 16px 12px;
    margin-bottom: 20px;
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
  
  .expense-actions {
    flex-direction: column;
    width: 100%;
  }
  
  .action-button {
    width: 100%;
    justify-content: center;
  }
  
  .modal-container {
    padding: 20px 16px;
    margin: 16px;
    max-height: calc(100vh - 32px);
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .form-actions button {
    width: 100%;
  }
}
</style>