<template>
<div class="expenses">
  <div class="header-section">
    <h1>Expenses</h1>
    <p>Manage your travel expenses</p>
    <!-- The fixed back button -->
    <button class="back-button" @click="goBackToDashboard">Back to Dashboard</button>
  </div>

  <div class="trip-selector">
    <label for="trip-select">Select Trip:</label>
    <select id="trip-select" v-model="selectedTripId" @change="loadExpenses">
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

  <div v-if="isLoading" class="loading-spinner">
    <div class="spinner"></div>
    <p>Loading expenses...</p>
  </div>

  <div v-else-if="!selectedTripId" class="empty-state">
    <p>Please select a trip to view expenses</p>
  </div>

  <div v-else class="content-container">
    <div class="section-header">
      <h2>Expenses</h2>
      <button @click="openModal" class="add-button">
        <span class="icon">+</span> Add Expense
      </button>
    </div>

    <div v-if="expenses.length === 0" class="empty-state">
      <p>No expenses recorded yet. Add your first expense to get started!</p>
    </div>

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
          <p class="expense-description" v-if="expense.description">{{ expense.description }}</p>

          <!-- If we have a localUrl and it's an image, show inline preview -->
          <div v-if="expense.localUrl && isImageFile(expense.file_path)">
            <img
              :src="expense.localUrl"
              alt="Expense Receipt"
              style="max-width: 200px; margin: 0.5rem 0; border: 1px solid #ccc;"
            />
          </div>
        </div>

        <div class="expense-actions">
          <button @click="editExpense(expense)" class="edit-button">Edit</button>
          <button @click="deleteExpense(expense)" class="delete-button">Delete</button>

          <!-- If there's a file_path, show action buttons -->
          <button
            v-if="expense.file_path"
            @click="viewStorageFile(expense.file_path)"
            class="view-button"
          >
            Open Link
          </button>

          <!-- Download or load offline, same logic as Documents.vue -->
          <button
            v-if="expense.file_path"
            @click="downloadForOffline(expense)"
            class="view-button"
          >
            Load Offline
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Add/Edit Expense Modal -->
  <div v-if="showModal" class="modal">
    <div class="modal-overlay" @click="closeModal"></div>
    <div class="modal-container">
      <div class="modal-header">
        <h2>{{ editingExpense ? 'Edit Expense' : 'Add New Expense' }}</h2>
        <button @click="closeModal" class="close-button">×</button>
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
            />
          </div>
          <div class="form-group">
            <label for="expenseCategory">Category</label>
            <select id="expenseCategory" v-model="expenseForm.category" required>
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
            />
          </div>
          <div class="form-group">
            <label for="expenseDate">Date</label>
            <input
              type="date"
              id="expenseDate"
              v-model="expenseForm.date"
              required
            />
          </div>
          <div class="form-group">
            <label for="expenseDescription">Description (Optional)</label>
            <textarea
              id="expenseDescription"
              v-model="expenseForm.description"
              rows="3"
              placeholder="Additional details"
            ></textarea>
          </div>

          <!-- File upload input for receipt or invoice -->
          <div class="form-group">
            <label for="expenseReceipt">Receipt (Optional, max 5MB)</label>
            <input
              type="file"
              id="expenseReceipt"
              ref="fileInput"
              @change="handleFileChange"
            />
            <p v-if="selectedFileName" class="file-name">
              Selected: {{ selectedFileName }}
            </p>
          </div>

          <div class="form-actions">
            <button type="button" @click="closeModal" class="cancel-button">
              Cancel
            </button>
            <button type="submit" class="save-button" :disabled="isSaving">
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

  // Expense form
  const expenseForm = ref({
    title: "",
    category: "",
    amount: 0,
    date: "",
    description: "",
    file_path: "",
    url: ""
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

      // Initialize localUrl
      expenses.value = (data || []).map(item => ({ ...item, localUrl: null }));
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
      url: ""
    };
  };

  onMounted(() => {
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

    // Computeds & Methods
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
    isImageFile
  };
}
};
</script>


<style scoped>
.expenses {
  width: 100%;
  padding: 32px;
  margin: 0 auto;
  box-sizing: border-box;
  font-family: 'Segoe UI', Arial, sans-serif;
  color: #222;
  line-height: 1.5;
  background: #f8f9fa;
}
@media (min-width: 768px) {
  .expenses {
    max-width: 900px;
    padding: 48px;
  }
}

.header-section {
  text-align: center;
  margin-bottom: 2rem;
  background: #fff;
  padding: 2rem 1rem 1.5rem 1rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  border: 1.5px solid #e5e7eb;
}
.header-section h1 {
  font-size: 2rem;
  margin: 0 0 0.5rem;
  color: #1f2937;
  font-weight: 700;
}
.header-section p {
  margin: 0;
  color: #64748b;
  font-size: 1.1rem;
}
.back-button {
  background: #f1f5f9;
  color: #2563eb;
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  padding: 0.5rem 1.2rem;
  font-size: 1rem;
  font-weight: 500;
  margin-top: 1rem;
  transition: background 0.2s, color 0.2s, border 0.2s;
  cursor: pointer;
}
.back-button:hover {
  background: #e0e7ef;
  color: #1d4ed8;
  border-color: #3b82f6;
}

.trip-selector {
  display: flex;
  flex-direction: column;
  margin-bottom: 1.5rem;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  border: 1.5px solid #e5e7eb;
  padding: 1.2rem 1rem 1rem 1rem;
}
.trip-selector label {
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: #222;
}
.trip-selector select {
  padding: 0.6rem;
  font-size: 1rem;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  max-width: 100%;
  background: #f8fafc;
  color: #222;
}
@media (min-width: 768px) {
  .trip-selector {
    flex-direction: row;
    align-items: center;
    gap: 1rem;
  }
  .trip-selector label {
    margin-bottom: 0;
  }
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 0;
}
.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3b82f6;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.content-container {
  margin-top: 1rem;
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
  margin: 0;
  font-size: 1.4rem;
  color: #1f2937;
  font-weight: 600;
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
.view-button {
  background: #3b82f6;
  color: #fff;
}
.view-button:hover {
  background: #2563eb;
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

.expenses-list {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}
.expense-card {
  background-color: #fff;
  border: 1.5px solid #e5e7eb;
  padding: 1.1rem 1rem 0.8rem 1rem;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  transition: background 0.2s, box-shadow 0.2s;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.expense-card:hover {
  background: #f1f5f9;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.expense-info h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #1f2937;
  font-weight: 600;
}
.expense-category,
.expense-amount,
.expense-date,
.expense-description {
  font-size: 0.95rem;
  color: #64748b;
}
.expense-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 999;
  display: flex;
  justify-content: center;
  align-items: center;
}
.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
}
.modal-container {
  position: relative;
  width: 90%;
  max-width: 500px;
  background: #fff;
  padding: 2rem 1.5rem 1.5rem 1.5rem;
  border-radius: 12px;
  z-index: 1000;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.18);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
  margin-bottom: 1rem;
}
.modal-header h2 {
  margin: 0;
  font-size: 1.3rem;
  color: #1f2937;
  font-weight: 600;
}
.close-button {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #64748b;
  border-radius: 6px;
  transition: background 0.2s;
  padding: 2px 8px;
}
.close-button:hover {
  background: #f1f5f9;
  color: #1d4ed8;
}
.modal-body {
  max-height: 70vh;
  overflow-y: auto;
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
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.6rem;
  font-size: 1rem;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  box-sizing: border-box;
  background: #fff;
  color: #222;
}
.file-name {
  font-size: 0.9rem;
  color: #555;
  margin-top: 0.25rem;
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
@media (max-width: 700px) {
  .expenses {
    padding: 10px;
  }
  .modal-container {
    padding: 1.2rem 0.5rem 1rem 0.5rem;
  }
}
</style>