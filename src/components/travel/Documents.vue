<template>
<div class="documents">
  <div class="header-section">
    <h1>Documents</h1>
    <p>Manage your travel documents</p>
    <!-- Fixed back button -->
    <button class="back-button" @click="goBackToDashboard">Back to Dashboard</button>
  </div>

  <div class="trip-selector">
    <label for="trip-select">Select Trip:</label>
    <select id="trip-select" v-model="selectedTripId" @change="loadDocuments">
      <option value="">-- Select a Trip --</option>
      <option v-for="trip in trips" :key="trip.id" :value="trip.id">
        {{ trip.name }} ({{ formatDateRange(trip.start_date, trip.end_date) }})
      </option>
    </select>
  </div>

  <div v-if="isLoading" class="loading-spinner">
    <div class="spinner"></div>
    <p>Loading documents...</p>
  </div>

  <div v-else-if="!selectedTripId" class="empty-state">
    <p>Please select a trip to view documents</p>
  </div>

  <div v-else class="content-container">
    <div class="section-header">
      <h2>Documents</h2>
      <button @click="openModal" class="add-button">
        <span class="icon">+</span> Add Document
      </button>
    </div>

    <div v-if="documents.length === 0" class="empty-state">
      <p>No documents added yet. Add your first document to get started!</p>
    </div>

    <div v-else class="documents-list">
      <div
        v-for="doc in documents"
        :key="doc.id"
        class="document-card"
      >
        <div class="document-preview">
          <template v-if="doc.localUrl && isImageFile(doc.file_path)">
            <img :src="doc.localUrl" alt="Preview" class="doc-thumb" />
          </template>
          <template v-else-if="isImageFile(doc.file_path)">
            <img :src="getPreviewUrl(doc.file_path)" alt="Preview" class="doc-thumb" />
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
          <p>{{ doc.description }}</p>
          <p class="document-date">{{ formatDate(doc.date) }}</p>
          <p v-if="doc.type"><strong>Type:</strong> {{ doc.type }}</p>
        </div>
        <div class="document-actions">
          <button @click="editDocument(doc)" class="icon-button edit-button" title="Edit">
            <svg xmlns="http://www.w3.org/2000/svg" class="action-icon" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
            </svg>
          </button>
          <button @click="deleteDocument(doc)" class="icon-button delete-button" title="Delete">
            <svg xmlns="http://www.w3.org/2000/svg" class="action-icon" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
          </button>
          <button
            v-if="doc.file_path"
            @click="viewStorageFile(doc.file_path)"
            class="icon-button view-button"
            title="View Document"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="action-icon" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
              <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
            </svg>
          </button>
          <button
            v-if="doc.file_path"
            @click="downloadDocument(doc)"
            class="icon-button download-button"
            title="Download Document"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="action-icon" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Add/Edit Document Modal -->
  <div v-if="showModal" class="modal">
    <div class="modal-overlay" @click="closeModal"></div>
    <div class="modal-container">
      <div class="modal-header">
        <h2>{{ editingDocument ? 'Edit Document' : 'Add New Document' }}</h2>
        <button @click="closeModal" class="close-button">×</button>
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
            />
          </div>
          <div class="form-group">
            <label for="docType">Type</label>
            <select id="docType" v-model="documentForm.type" required>
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
            />
          </div>

          <div class="form-actions">
            <button type="button" @click="closeModal" class="cancel-button">
              Cancel
            </button>
            <button type="submit" class="save-button" :disabled="isSaving">
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

// For navigation
import { useRouter } from 'vue-router';

// Offline file storage
import { storeDocumentFile, getDocumentFile } from '@/utils/indexedDB';

export default {
name: "Documents",
props: ["id", "tripId"],
setup(props) {
  const toast = useToast();
  const userStore = useUserStore();
  const router = useRouter();  // <<-- create the router instance

  // For RLS
  const userId = ref(userStore.user?.id || null);

  // Determine project & trip from props
  const projectId = ref(userStore.currentProject?.id || props.id);
  const selectedTripId = ref(props.tripId || "");

  const trips = ref([]);
  const documents = ref([]);
  const isLoading = ref(false);

  const showModal = ref(false);
  const editingDocument = ref(null);
  const isSaving = ref(false);

  // For file uploads
  const fileInput = ref(null);
  const selectedFile = ref(null);
  const selectedFileName = ref("");

  const documentForm = ref({
    title: "",
    type: "",
    description: "",
    url: "",
    file_path: "",
    date: ""
  });

  // Go back to dashboard
  const goBackToDashboard = () => {
    router.push({
      name: 'TravelDashboard',
      params: {
        id: userStore.currentProject?.id || projectId.value
      }
    });
  };

  // Date helpers
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

  // Check if file is image or PDF
  const isImageFile = (filePath = "") => {
    const ext = filePath.split(".").pop().toLowerCase();
    return ["jpg","jpeg","png","gif","webp","bmp"].includes(ext);
  };
  const isPdfFile = (filePath = "") => {
    const ext = filePath.split(".").pop().toLowerCase();
    return ext === "pdf";
  };

  // Load all trips for the select
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

  // Load documents for the selected trip
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

      // Start each doc with localUrl = null for offline embedding
      documents.value = (data || []).map(doc => ({ ...doc, localUrl: null }));
    } catch (err) {
      console.error("Error loading documents:", err);
      toast.error("Failed to load documents");
    } finally {
      isLoading.value = false;
    }
  };

  // Modal controls
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

  // Editing / Deleting
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
      // Remove old file from bucket if exists
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

  // File handling
  const handleFileChange = (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (!file) return;

    // 5MB check
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large (max 5MB).");
      e.target.value = "";
      return;
    }
    selectedFile.value = file;
    selectedFileName.value = file.name;
  };

  // Upload to the "travel-documents" bucket
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

  // Remove from bucket
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

  // Signed URL for online viewing
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

  // Direct download function
  const downloadDocument = async (doc) => {
    if (!doc.file_path) {
      toast.error("No file to download");
      return;
    }
    
    try {
      if (!navigator.onLine) {
        // Try to get cached file
        const cachedBlob = await getDocumentFile(doc.file_path);
        if (cachedBlob) {
          downloadBlob(cachedBlob, doc.title || 'document');
          return;
        } else {
          toast.error("Offline - no cached file found");
          return;
        }
      }

      // Download from Supabase
      const { data: fileBlob, error } = await supabase.storage
        .from("travel-documents")
        .download(doc.file_path);
      
      if (error) {
        console.error("Download error:", error);
        toast.error(`Failed to download file: ${error.message}`);
        return;
      }
      
      if (fileBlob) {
        // Store for offline use
        await storeDocumentFile(doc.file_path, fileBlob);
        
        // Trigger download
        const fileName = doc.title || doc.file_path.split('/').pop() || 'document';
        downloadBlob(fileBlob, fileName);
        
        toast.success("Document downloaded successfully");
      }
    } catch (err) {
      console.error("downloadDocument error:", err);
      toast.error("Failed to download document");
    }
  };

  // Helper function to trigger download
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

  // Offline caching approach (kept for backward compatibility)
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

      // Download from Supabase if online
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

  // Insert or Update a Document
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
        // If editing, remove old file
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
        // Update existing
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

        // Reflect changes in local array
        const idx = documents.value.findIndex(d => d.id === editingDocument.value.id);
        if (idx !== -1) {
          documents.value[idx] = { ...documents.value[idx], ...payload };
        }
        toast.success("Document updated successfully");
      } else {
        // Insert new
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

  // Reset form
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

  // Add a helper to get a preview URL for images from Supabase
  const getPreviewUrl = (filePath) => {
    if (!filePath) return '';
    // For public buckets, you could construct the URL directly. For private, you may need a signed URL.
    // Here, we assume public for preview. Adjust as needed for your setup.
    return `https://YOUR_SUPABASE_PROJECT.supabase.co/storage/v1/object/public/travel-documents/${filePath}`;
  };

  // On mount
  onMounted(() => {
    loadTrips();
    if (selectedTripId.value) {
      loadDocuments();
    }
  });

  return {
    // Reactive Refs
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

    // Methods
    goBackToDashboard,  // <--- the "Back to Dashboard" button
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
    getPreviewUrl
  };
}
};
</script>


<style scoped>
.documents {
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
  .documents {
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

.documents-list {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}
.document-card {
  background-color: #fff;
  border: 1.5px solid #e5e7eb;
  padding: 1rem 0.8rem 0.8rem 0.8rem;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  transition: background 0.2s, box-shadow 0.2s;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 1rem;
}
.document-card:hover {
  background: #f1f5f9;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.document-preview {
  width: 56px;
  min-width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}
.doc-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
}
.doc-icon {
  font-size: 2rem;
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
  flex: 1 1 0;
  min-width: 0;
}
.document-info h3 {
  margin: 0 0 0.25rem;
  color: #1f2937;
  font-weight: 600;
  font-size: 1.1rem;
}
.document-date {
  font-size: 0.95rem;
  color: #64748b;
}
.document-actions {
  display: flex;
  flex-direction: column;
  gap: 0.4em;
  align-items: flex-end;
  justify-content: flex-start;
  margin-left: 0.5em;
}
.icon-button {
  background: none;
  border: none;
  padding: 0.5em;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.2s, color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
}

.action-icon {
  width: 18px;
  height: 18px;
}

.icon-button.edit-button {
  color: #2563eb;
}
.icon-button.edit-button:hover {
  background: #e0e7ef;
  color: #1d4ed8;
}

.icon-button.delete-button {
  color: #ef4444;
}
.icon-button.delete-button:hover {
  background: #fee2e2;
  color: #dc2626;
}

.icon-button.view-button {
  color: #10b981;
}
.icon-button.view-button:hover {
  background: #d1fae5;
  color: #059669;
}

.icon-button.download-button {
  color: #f59e0b;
}
.icon-button.download-button:hover {
  background: #fef3c7;
  color: #d97706;
}
@media (max-width: 700px) {
  .document-card {
    flex-direction: column;
    align-items: stretch;
    gap: 0.7rem;
    padding: 0.8rem 0.5rem 0.7rem 0.5rem;
  }
  .document-actions {
    flex-direction: row;
    gap: 0.5em;
    margin-left: 0;
    justify-content: flex-end;
  }
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
  background: rgba(0, 0, 0, 0.5);
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
  .documents {
    padding: 10px;
  }
  .modal-container {
    padding: 1.2rem 0.5rem 1rem 0.5rem;
  }
}
</style>