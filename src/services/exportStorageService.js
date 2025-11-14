// src/services/exportStorageService.js
import { supabase } from '../supabase';
import { useToast } from 'vue-toastification';

const toast = useToast();

/**
 * Save a PDF or PNG export to storage and create database entry
 * @param {Blob} fileBlob - The file blob (PDF or PNG)
 * @param {string} filename - The filename
 * @param {string} mimeType - MIME type ('application/pdf' or 'image/png')
 * @param {string|number} projectId - Project ID
 * @param {string|number|null} venueId - Venue ID (optional)
 * @param {string|number|null} stageId - Stage ID (optional)
 * @param {string} description - Optional description
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function saveExportToStorage(
  fileBlob,
  filename,
  mimeType,
  projectId,
  venueId = null,
  stageId = null,
  description = ''
) {
  try {
    // Determine storage path
    // If venue/stage are provided, use the same structure as regular docs
    // Otherwise, save to project-level exports folder
    let storagePath;
    if (venueId && stageId) {
      storagePath = `${projectId}/${venueId}/${stageId}/${Date.now()}_${filename}`;
    } else {
      // Project-level exports - save to exports folder
      storagePath = `${projectId}/exports/${Date.now()}_${filename}`;
    }

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('stage-docs')
      .upload(storagePath, fileBlob, {
        cacheControl: '3600',
        upsert: false,
        contentType: mimeType,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return { success: false, error: uploadError.message };
    }

    if (!uploadData?.path) {
      return { success: false, error: 'Upload succeeded but no path returned' };
    }

    // Get current max order for this project/venue/stage
    let maxOrder = 0;
    try {
      let orderQuery = supabase
        .from('stage_docs')
        .select('order')
        .eq('project_id', projectId);

      if (venueId) {
        orderQuery = orderQuery.eq('venue_id', venueId);
      }
      if (stageId) {
        orderQuery = orderQuery.eq('stage_id', stageId);
      }

      const { data: existingDocs } = await orderQuery.order('order', { ascending: false }).limit(1);
      if (existingDocs && existingDocs.length > 0) {
        maxOrder = existingDocs[0].order || 0;
      }
    } catch (err) {
      console.warn('Error fetching max order:', err);
    }

    // Create database entry
    const { data: docData, error: dbError } = await supabase
      .from('stage_docs')
      .insert({
        project_id: projectId,
        venue_id: venueId || null,
        stage_id: stageId || null,
        file_path: uploadData.path,
        file_name: filename,
        mime_type: mimeType,
        description: description || `Exported ${mimeType === 'application/pdf' ? 'PDF' : 'PNG'}`,
        order: maxOrder + 1,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      // Try to clean up the uploaded file
      await supabase.storage.from('stage-docs').remove([uploadData.path]);
      return { success: false, error: dbError.message };
    }

    return { 
      success: true, 
      docId: docData?.id,
      venueId: venueId,
      stageId: stageId,
      fileBlob: fileBlob, // Return blob for immediate download option
      filename: filename
    };
  } catch (error) {
    console.error('Error saving export to storage:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Save PDF export to storage
 * @param {jsPDF} pdfDoc - The jsPDF instance
 * @param {string} filename - The filename
 * @param {string|number} projectId - Project ID
 * @param {string|number|null} venueId - Venue ID (optional)
 * @param {string|number|null} stageId - Stage ID (optional)
 * @param {string} description - Optional description
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function savePDFToStorage(
  pdfDoc,
  filename,
  projectId,
  venueId = null,
  stageId = null,
  description = ''
) {
  try {
    // Generate PDF blob
    const pdfBlob = pdfDoc.output('blob');
    
    // Ensure filename has .pdf extension
    const finalFileName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

    const result = await saveExportToStorage(
      pdfBlob,
      finalFileName,
      'application/pdf',
      projectId,
      venueId,
      stageId,
      description
    );
    
    // Also return the pdfDoc for download capability
    if (result.success) {
      result.pdfDoc = pdfDoc;
    }
    
    return result;
  } catch (error) {
    console.error('Error generating PDF blob:', error);
    return { success: false, error: error.message || 'Failed to generate PDF' };
  }
}

/**
 * Save PNG export to storage
 * @param {string} dataURL - The PNG data URL
 * @param {string} filename - The filename
 * @param {string|number} projectId - Project ID
 * @param {string|number|null} venueId - Venue ID (optional)
 * @param {string|number|null} stageId - Stage ID (optional)
 * @param {string} description - Optional description
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function savePNGToStorage(
  dataURL,
  filename,
  projectId,
  venueId = null,
  stageId = null,
  description = ''
) {
  try {
    // Convert data URL to blob
    const response = await fetch(dataURL);
    const pngBlob = await response.blob();

    // Ensure filename has .png extension
    const finalFileName = filename.endsWith('.png') ? filename : `${filename}.png`;

    const result = await saveExportToStorage(
      pngBlob,
      finalFileName,
      'image/png',
      projectId,
      venueId,
      stageId,
      description
    );
    
    // Also return the dataURL for download capability
    if (result.success) {
      result.dataURL = dataURL;
    }
    
    return result;
  } catch (error) {
    console.error('Error converting PNG data URL to blob:', error);
    return { success: false, error: error.message || 'Failed to convert PNG' };
  }
}

// Global modal state for export success
let exportSuccessModalState = {
  show: false,
  filename: '',
  result: null,
  onDownload: null,
  onNavigate: null,
  onClose: null
};

/**
 * Show export success modal
 * @param {Object} result - Result from savePDFToStorage or savePNGToStorage
 * @param {string} filename - Filename for download
 * @param {Object} options - Options object with projectId, venueId, stageId, mimeType
 */
export function showExportSuccessModal(result, filename, options = {}) {
  if (!result.success) {
    toast.error(`Failed to save export: ${result.error || 'Unknown error'}`);
    return;
  }

  // Create download function
  const downloadFile = () => {
    try {
      if (result.pdfDoc) {
        // For PDFs, use jsPDF's save method
        result.pdfDoc.save(filename);
      } else if (result.fileBlob) {
        // For blobs, create download link
        const url = URL.createObjectURL(result.fileBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (result.dataURL) {
        // For PNG data URLs
        const link = document.createElement('a');
        link.href = result.dataURL;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      toast.success('File downloaded');
      closeExportSuccessModal();
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file');
    }
  };

  // Navigation will be handled by the modal component
  const navigateToDataManagement = () => {
    // This will be handled by ExportSuccessModal component
  };

  // Set modal state
  exportSuccessModalState = {
    show: true,
    filename,
    result: {
      ...result,
      projectId: options.projectId || result.projectId,
      venueId: options.venueId || result.venueId,
      stageId: options.stageId || result.stageId,
      mimeType: options.mimeType || (filename.endsWith('.pdf') ? 'application/pdf' : 'image/png')
    },
    onDownload: downloadFile,
    onNavigate: navigateToDataManagement,
    onClose: closeExportSuccessModal
  };

  // Trigger custom event to show modal
  window.dispatchEvent(new CustomEvent('show-export-success-modal', {
    detail: exportSuccessModalState
  }));
}

/**
 * Close export success modal
 */
export function closeExportSuccessModal() {
  exportSuccessModalState.show = false;
  window.dispatchEvent(new CustomEvent('close-export-success-modal'));
}

/**
 * Get current export success modal state
 */
export function getExportSuccessModalState() {
  return exportSuccessModalState;
}

/**
 * Helper function to show export success toast with download option (deprecated - use showExportSuccessModal)
 * @deprecated Use showExportSuccessModal instead
 * @param {Object} toast - Toast instance (unused, kept for compatibility)
 * @param {Object} result - Result from savePDFToStorage or savePNGToStorage
 * @param {string} filename - Filename for download
 * @param {Object} options - Optional navigation options (projectId, venueId, stageId, mimeType)
 */
export function showExportSuccessToast(toast, result, filename, options = {}) {
  // For backward compatibility, show modal instead
  showExportSuccessModal(result, filename, options);
}

