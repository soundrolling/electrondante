<template>
  <div class="documents">
  <!-- Consolidated Header Section -->
  <div class="consolidated-header">
    <!-- Row 1: Back Button, Title, and Subtitle -->
    <div class="header-row-1">
      <button class="back-button" @click="goBackToDashboard" aria-label="Back to dashboard">
        <span class="back-icon">←</span>
        <span class="back-text">Back to Dashboard</span>
      </button>
      
      <div class="title-section">
        <h1>Documents</h1>
        <p>Manage your travel documents</p>
      </div>
    </div>
    
    <!-- Row 2: Trip Selector -->
    <div class="header-row-2">
      <div class="trip-selector">
        <label for="trip-select">Select Trip:</label>
        <select 
          id="trip-select" 
          v-model="selectedTripId" 
          @change="loadDocuments"
          class="trip-select-input"
          aria-label="Select a trip to view documents"
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
    <div class="empty-icon">📄</div>
    <h3>Select a trip</h3>
    <p>Please select a trip to view and manage documents</p>
  </div>

  <!-- Content Container -->
  <div v-else class="content-container">
    <div class="section-header">
      <h2>Documents</h2>
      <button v-if="canManageProject" @click="openModal" class="add-button" aria-label="Add new document">
        <span class="icon">+</span>
        <span class="button-text">Add Document</span>
      </button>
    </div>

    <!-- Empty Documents State -->
    <div v-if="documents.length === 0" class="empty-documents">
      <div class="empty-icon">📁</div>
      <h3>No documents yet</h3>
      <p>Add your first document to get started!</p>
    </div>

    <!-- Documents List -->
    <div v-else class="documents-list">
      <div
        v-for="doc in documents"
        :key="doc.id"
        class="document-card"
      >
        <div class="document-preview">
          <template v-if="doc.localUrl && isImageFile(doc.file_path)">
            <img :src="doc.localUrl" alt="Document preview" class="doc-thumb" />
          </template>
          <template v-else-if="isImageFile(doc.file_path)">
            <img :src="getPreviewUrl(doc.file_path)" alt="Document preview" class="doc-thumb" />
          </template>
          <template v-else-if="isPdfFile(doc.file_path)">
            <span class="doc-icon pdf-icon">📄</span>
          </template>
          <template v-else-if="doc.file_path">
            <span class="doc-icon file-icon">📎</span>
          </template>
        </div>
        
        <div class="document-info">
          <h3>{{ doc.title }}</h3>
          <p class="document-description">{{ doc.description }}</p>
          <p class="document-date">{{ formatDate(doc.date) }}</p>
          <p v-if="doc.type" class="document-type">
            <span class="type-label">Type:</span> {{ doc.type }}
          </p>
        </div>
        
        <div class="document-actions">
          <button 
            v-if="canManageProject"
            @click="editDocument(doc)" 
            class="action-button edit-button"
            aria-label="Edit document"
          >
            <span class="action-icon">✏️</span>
            <span class="action-text">Edit</span>
          </button>
          
          <button 
            v-if="canManageProject"
            @click="deleteDocument(doc)" 
            class="action-button delete-button"
            aria-label="Delete document"
          >
            <span class="action-icon">🗑️</span>
            <span class="action-text">Delete</span>
          </button>
          
          <button
            v-if="doc.file_path"
            @click="viewStorageFile(doc.file_path)"
            class="action-button view-button"
            aria-label="View document"
          >
            <span class="action-icon">👁️</span>
            <span class="action-text">View</span>
          </button>
          
          <button
            v-if="doc.file_path"
            @click="downloadDocument(doc)"
            class="action-button download-button"
            aria-label="Download document"
          >
            <span class="action-icon">⬇️</span>
            <span class="action-text">Download</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Add/Edit Document Modal -->
  <div v-if="showModal" class="modal" role="dialog" aria-labelledby="modal-title">
    <div class="modal-overlay" @click="closeModal"></div>
    <div class="modal-container">
      <div class="modal-header">
        <h2 id="modal-title">{{ editingDocument ? 'Edit Document' : 'Add New Document' }}</h2>
        <button @click="closeModal" class="close-button" aria-label="Close modal">×</button>
      </div>
      
      <div class="modal-body">
        <form @submit.prevent="saveDocument">
          <div class="form-group">
            <label for="docTitle">Title</label>
            <input
              type="text"
              id="docTitle"
              v-model="documentForm.title"
              required
              placeholder="Document title"
              class="form-input"
            />
          </div>
          
          <div class="form-group">
            <label for="docType">Type</label>
            <select id="docType" v-model="documentForm.type" required class="form-select">
              <option value="">-- Select Type --</option>
              <option value="Passport">Passport</option>
              <option value="Visa">Visa</option>
              <option value="Insurance">Insurance</option>
              <option value="Itinerary">Itinerary</option>
              <option value="Other">Other</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="docDescription">Description</label>
            <textarea
              id="docDescription"
              v-model="documentForm.description"
              rows="3"
              placeholder="Additional details"
              class="form-textarea"
            ></textarea>
          </div>

          <!-- External URL field (Optional) -->
          <div class="form-group">
            <label for="docUrl">External Link (Optional)</label>
            <input
              type="url"
              id="docUrl"
              v-model="documentForm.url"
              placeholder="Link to document (if available)"
              class="form-input"
            />
          </div>

          <!-- File upload input -->
          <div class="form-group">
            <label for="docFile">Upload File (Optional, max 5MB)</label>
            <input
              type="file"
              id="docFile"
              ref="fileInput"
              @change="handleFileChange"
              class="form-file-input"
              accept="image/*,.pdf,.doc,.docx,.txt"
            />
            <p v-if="selectedFileName" class="file-name">
              Selected: {{ selectedFileName }}
            </p>
          </div>

          <div class="form-group">
            <label for="docDate">Date</label>
            <input
              type="date"
              id="docDate"
              v-model="documentForm.date"
              required
              class="form-input"
            />
          </div>

          <div class="form-actions">
            <button type="button" @click="closeModal" class="secondary-button">
              Cancel
            </button>
            <button type="submit" class="primary-button" :disabled="isSaving">
              <span v-if="isSaving" class="loading-spinner-small"></span>
              {{ isSaving ? 'Saving...' : (editingDocument ? 'Update Document' : 'Add Document') }}
            </button>
          </div>
        </form>
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
import { useRouter } from 'vue-router';
import { storeDocumentFile, getDocumentFile } from '@/utils/indexedDB';

export default {
  name: "Documents",
  props: ["id", "tripId"],
  setup(props) {
    const toast = useToast();
    const userStore = useUserStore();
    const router = useRouter();

    const userId = ref(userStore.user?.id || null);
    const projectId = ref(userStore.currentProject?.id || props.id);
    const selectedTripId = ref(props.tripId || "");

    const trips = ref([]);
    const documents = ref([]);
    const isLoading = ref(false);
    const showModal = ref(false);
    const editingDocument = ref(null);
    const isSaving = ref(false);
    const fileInput = ref(null);
    const selectedFile = ref(null);
    const selectedFileName = ref("");
    
    // Permission check
    const canManageProject = ref(false);
    
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

    const documentForm = ref({
      title: "",
      type: "",
      description: "",
      url: "",
      file_path: "",
      date: ""
    });

    const goBackToDashboard = () => {
      router.push({
        name: 'TravelDashboard',
        params: {
          id: userStore.currentProject?.id || projectId.value
        }
      });
    };

    const formatDate = (dateStr) => {
      if (!dateStr) return "";
      const d = parseISO(dateStr);
      const dayOfWeek = format(d, "EEEE");
      const day = format(d, "d");
      const month = format(d, "MMMM");
      
      const ordinalSuffix = (day) => {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
          case 1: return 'st';
          case 2: return 'nd';
          case 3: return 'rd';
          default: return 'th';
        }
      };
      
      return `${dayOfWeek} ${day}${ordinalSuffix(day)} ${month}`;
    };
    
    const formatDateRange = (start, end) => {
      if (!start || !end) return "";
      const s = parseISO(start);
      const e = parseISO(end);
      
      if (format(s, "MMMM yyyy") === format(e, "MMMM yyyy")) {
        const startDay = format(s, "EEEE");
        const startDate = format(s, "d");
        const endDay = format(e, "EEEE");
        const endDate = format(e, "d");
        const month = format(s, "MMMM");
        
        const startOrdinal = (startDate) => {
          if (startDate > 3 && startDate < 21) return 'th';
          switch (startDate % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
          }
        };
        
        const endOrdinal = (endDate) => {
          if (endDate > 3 && endDate < 21) return 'th';
          switch (endDate % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
          }
        };
        
        return `${startDay} ${startDate}${startOrdinal(startDate)} - ${endDay} ${endDate}${endOrdinal(endDate)} ${month}`;
      }
      
      return `${formatDate(start)} - ${formatDate(end)}`;
    };

    const isImageFile = (filePath = "") => {
      const ext = filePath.split(".").pop().toLowerCase();
      return ["jpg","jpeg","png","gif","webp","bmp"].includes(ext);
    };
    
    const isPdfFile = (filePath = "") => {
      const ext = filePath.split(".").pop().toLowerCase();
      return ext === "pdf";
    };

    const loadTrips = async () => {
      try {
        if (!projectId.value) return;
        const { data, error } = await supabase
          .from("travel_trips")
          .select("*")
          .eq("project_id", projectId.value)
          .order("start_date", { ascending: true });
        if (error) throw error;
        trips.value = data || [];
      } catch (err) {
        console.error("Error loading trips:", err);
        toast.error("Failed to load trips");
      }
    };

    const loadDocuments = async () => {
      if (!selectedTripId.value) return;
      isLoading.value = true;
      try {
        const { data, error } = await supabase
          .from("travel_documents")
          .select("*")
          .eq("trip_id", selectedTripId.value)
          .order("date", { ascending: true });
        if (error) throw error;
        documents.value = (data || []).map(doc => ({ ...doc, localUrl: null }));
      } catch (err) {
        console.error("Error loading documents:", err);
        toast.error("Failed to load documents");
      } finally {
        isLoading.value = false;
      }
    };

    const openModal = () => {
      editingDocument.value = null;
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

    const editDocument = (doc) => {
      editingDocument.value = doc;
      documentForm.value = { ...doc };
      selectedFile.value = null;
      selectedFileName.value = "";
      if (fileInput.value) {
        fileInput.value.value = "";
      }
      showModal.value = true;
    };

    const deleteDocument = async (doc) => {
      if (!confirm("Are you sure you want to delete this document?")) return;
      try {
        if (doc.file_path) {
          await removeStorageFile(doc.file_path);
        }
        const { error } = await supabase
          .from("travel_documents")
          .delete()
          .eq("id", doc.id);
        if (error) throw error;
        documents.value = documents.value.filter(d => d.id !== doc.id);
        toast.success("Document deleted successfully");
      } catch (err) {
        console.error("Error deleting document:", err);
        toast.error("Failed to delete document");
      }
    };

    const handleFileChange = (e) => {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File is too large (max 5MB).");
        e.target.value = "";
        return;
      }
      selectedFile.value = file;
      selectedFileName.value = file.name;
    };

    const uploadStorageFile = async () => {
      if (!selectedFile.value) return null;
      try {
        const uid = userId.value || "anon";
        const filePath = `user_${uid}/${Date.now()}_${selectedFile.value.name}`;
        const { data, error } = await supabase.storage
          .from("travel-documents")
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

    const removeStorageFile = async (path) => {
      if (!path) return;
      try {
        const { error } = await supabase.storage
          .from("travel-documents")
          .remove([path]);
        if (error) {
          console.error("Error removing file:", error);
        }
      } catch (err) {
        console.error("Unexpected error removing file:", err);
      }
    };

    const viewStorageFile = async (filePath) => {
      try {
        const { data, error } = await supabase.storage
          .from("travel-documents")
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

    const downloadDocument = async (doc) => {
      if (!doc.file_path) {
        toast.error("No file to download");
        return;
      }
      
      try {
        if (!navigator.onLine) {
          const cachedBlob = await getDocumentFile(doc.file_path);
          if (cachedBlob) {
            downloadBlob(cachedBlob, doc.title || 'document');
            return;
          } else {
            toast.error("Offline - no cached file found");
            return;
          }
        }

        const { data: fileBlob, error } = await supabase.storage
          .from("travel-documents")
          .download(doc.file_path);
        
        if (error) {
          console.error("Download error:", error);
          toast.error(`Failed to download file: ${error.message}`);
          return;
        }
        
        if (fileBlob) {
          await storeDocumentFile(doc.file_path, fileBlob);
          const fileName = doc.title || doc.file_path.split('/').pop() || 'document';
          downloadBlob(fileBlob, fileName);
          toast.success("Document downloaded successfully");
        }
      } catch (err) {
        console.error("downloadDocument error:", err);
        toast.error("Failed to download document");
      }
    };

    const downloadBlob = (blob, fileName) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    const downloadForOffline = async (doc) => {
      if (!doc.file_path) return;
      try {
        if (!navigator.onLine) {
          const cachedBlob = await getDocumentFile(doc.file_path);
          if (!cachedBlob) {
            toast.error("Offline - no cached file found.");
            return;
          }
          if (isImageFile(doc.file_path)) {
            doc.localUrl = URL.createObjectURL(cachedBlob);
          } else {
            const objectURL = URL.createObjectURL(cachedBlob);
            window.open(objectURL, "_blank");
          }
          return;
        }

        const { data: fileBlob, error } = await supabase.storage
          .from("travel-documents")
          .download(doc.file_path);
        if (error) {
          console.error("Download error:", error);
          toast.error(`Failed to download file: ${error.message}`);
          return;
        }
        if (fileBlob) {
          await storeDocumentFile(doc.file_path, fileBlob);
          if (isImageFile(doc.file_path)) {
            doc.localUrl = URL.createObjectURL(fileBlob);
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

    const saveDocument = async () => {
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
          if (editingDocument.value?.file_path) {
            await removeStorageFile(editingDocument.value.file_path);
          }
          newFilePath = await uploadStorageFile();
          if (!newFilePath) {
            isSaving.value = false;
            return;
          }
        }

        if (editingDocument.value) {
          const payload = {
            title: documentForm.value.title,
            type: documentForm.value.type,
            description: documentForm.value.description,
            url: documentForm.value.url,
            date: documentForm.value.date,
            user_id: userId.value
          };
          if (newFilePath) {
            payload.file_path = newFilePath;
            payload.url = newFilePath;
          }

          const { error } = await supabase
            .from("travel_documents")
            .update(payload)
            .eq("id", editingDocument.value.id)
            .select();
          if (error) throw error;

          const idx = documents.value.findIndex(d => d.id === editingDocument.value.id);
          if (idx !== -1) {
            documents.value[idx] = { ...documents.value[idx], ...payload };
          }
          toast.success("Document updated successfully");
        } else {
          const payload = {
            ...documentForm.value,
            trip_id: selectedTripId.value,
            project_id: projectId.value,
            user_id: userId.value
          };
          if (newFilePath) {
            payload.file_path = newFilePath;
            payload.url = newFilePath;
          }

          const { data, error } = await supabase
            .from("travel_documents")
            .insert(payload)
            .select();
          if (error) throw error;

          if (data && data.length > 0) {
            documents.value.push({ ...data[0], localUrl: null });
          }
          toast.success("Document added successfully");
        }

        closeModal();
      } catch (err) {
        console.error("Error saving document:", err);
        toast.error("Failed to save document: " + err.message);
      } finally {
        isSaving.value = false;
      }
    };

    const resetForm = () => {
      documentForm.value = {
        title: "",
        type: "",
        description: "",
        url: "",
        file_path: "",
        date: ""
      };
    };

    const getPreviewUrl = (filePath) => {
      if (!filePath) return '';
      const supabaseUrl = process.env.VUE_APP_SUPABASE_URL;
      if (supabaseUrl) {
        return `${supabaseUrl}/storage/v1/object/public/travel-documents/${filePath}`;
      }
      return '';
    };

    onMounted(async () => {
      await checkUserRole();
      loadTrips();
      if (selectedTripId.value) {
        loadDocuments();
      }
    });

    return {
      trips,
      documents,
      selectedTripId,
      isLoading,
      showModal,
      editingDocument,
      isSaving,
      documentForm,
      fileInput,
      selectedFile,
      selectedFileName,
      goBackToDashboard,
      formatDate,
      formatDateRange,
      loadDocuments,
      openModal,
      closeModal,
      editDocument,
      deleteDocument,
      handleFileChange,
      saveDocument,
      resetForm,
      removeStorageFile,
      viewStorageFile,
      downloadForOffline,
      downloadDocument,
      isImageFile,
      isPdfFile,
      getPreviewUrl,
      canManageProject,
    };
  }
};
</script>

<style scoped>
/* Mobile-first base styles */
.documents {
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
  .documents {
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

.header-section h1 {
  font-size: 24px;
  margin: 0 0 8px 0;
  color: #111827;
  font-weight: 700;
  line-height: 1.4;
}

.header-section p {
  margin: 0 0 20px 0;
  color: #6b7280;
  font-size: 16px;
  line-height: 1.5;
}

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
  color: #6b7280;
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

/* Empty Documents */
.empty-documents {
  text-align: center;
  padding: 32px 16px;
  color: #6b7280;
}

.empty-documents .empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-documents h3 {
  font-size: 20px;
  margin: 0 0 8px 0;
  color: #374151;
  font-weight: 600;
}

.empty-documents p {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
}

/* Documents List */
.documents-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.document-card {
  background: #f9fafb;
  border-radius: 12px;
  padding: 20px 16px;
  border: 1px solid #e5e7eb;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.document-card:hover {
  background: #f3f4f6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.document-preview {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
  align-self: center;
}

.doc-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
}

.doc-icon {
  font-size: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pdf-icon {
  color: #ef4444;
}

.file-icon {
  color: #64748b;
}

.document-info {
  text-align: center;
}

.document-info h3 {
  margin: 0 0 8px 0;
  color: #111827;
  font-weight: 600;
  font-size: 18px;
  line-height: 1.4;
}

.document-description {
  font-size: 14px;
  color: #4b5563;
  margin-bottom: 8px;
  line-height: 1.4;
}

.document-date {
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 8px;
  line-height: 1.4;
}

.document-type {
  font-size: 14px;
  color: #4b5563;
  line-height: 1.4;
}

.type-label {
  font-weight: 500;
  color: #374151;
}

.document-actions {
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
  border: 1px solid #e5e7eb;
  color: #374151;
  background: #f9fafb;
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

.action-button.view-button {
  background: #059669;
  color: #ffffff;
  border-color: #047857;
}

.action-button.view-button:hover {
  background: #047857;
  border-color: #065f46;
}

.action-button.download-button {
  background: #7c3aed;
  color: #ffffff;
  border-color: #6d28d9;
}

.action-button.download-button:hover {
  background: #6d28d9;
  border-color: #5b21b6;
}

.action-icon {
  font-size: 16px;
}

.action-text {
  font-size: 12px;
  color: #6b7280;
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
  background: #ffffff;
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
  color: #111827;
  font-weight: 600;
  line-height: 1.4;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6b7280;
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
  background: #f3f4f6;
  color: #374151;
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
  color: #374151;
  font-size: 16px;
  line-height: 1.4;
}

.form-input,
.form-select,
.form-textarea,
.form-file-input {
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
.form-textarea:focus,
.form-file-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.file-name {
  font-size: 14px;
  color: #6b7280;
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
  display: flex;
  align-items: center;
  gap: 8px;
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

/* Tablet Breakpoint (601px - 1024px) */
@media (min-width: 601px) {
  .documents {
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
  
  .document-card {
    flex-direction: row;
    align-items: flex-start;
    gap: 20px;
  }
  
  .document-preview {
    width: 64px;
    height: 64px;
    align-self: flex-start;
  }
  
  .document-info {
    text-align: left;
    flex: 1;
  }
  
  .document-actions {
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
  .documents {
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
  .documents {
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
  
  .section-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .add-button {
    width: 100%;
    justify-content: center;
  }
  
  .document-actions {
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
