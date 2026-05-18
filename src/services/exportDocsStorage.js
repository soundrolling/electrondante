// src/services/exportDocsStorage.js
//
// Saves PDF/PNG exports as entries in the stage_docs table (the project
// document library) — so an exported PDF instantly shows up alongside
// stage documents. Also surfaces the export-success modal via the
// exportUiStore Pinia store.
//
// Distinct from exportHistory.js, which targets the project_exports
// history table.
import { supabase } from '../supabase';
import { useToast } from 'vue-toastification';
import { useExportUiStore } from '@/stores/exportUiStore';
import { createLogger } from '@/utils/log';

const log = createLogger('exportDocsStorage');

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
      log.error('Storage upload error:', uploadError);
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
      log.warn('Error fetching max order:', err);
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
      log.error('Database insert error:', dbError);
      // Try to clean up the uploaded file
      await supabase.storage.from('stage-docs').remove([uploadData.path]);
      return { success: false, error: dbError.message };
    }

    return { 
      success: true, 
      docId: docData?.id,
      projectId: projectId,
      venueId: venueId,
      stageId: stageId,
      fileBlob: fileBlob, // Return blob for immediate download option
      filename: filename
    };
  } catch (error) {
    log.error('Error saving export to storage:', error);
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
    log.error('Error generating PDF blob:', error);
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
    log.error('Error converting PNG data URL to blob:', error);
    return { success: false, error: error.message || 'Failed to convert PNG' };
  }
}

/**
 * Show export success modal via the exportUiStore Pinia store.
 *
 * Builds a payload describing the export plus the action callbacks
 * (download, navigate) so the global ExportSuccessModal mounted in
 * App.vue can render reactively.
 *
 * @param {Object} result - Result from savePDFToStorage or savePNGToStorage
 * @param {string} filename - Filename for download
 * @param {Object} options - Options object with projectId, venueId, stageId, mimeType
 */
export function showExportSuccessModal(result, filename, options = {}) {
  if (!result.success) {
    toast.error(`Failed to save export: ${result.error || 'Unknown error'}`);
    return;
  }

  const uiStore = useExportUiStore();

  // Create download function — captures `result` and `filename` in closure
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
      uiStore.closeSuccess();
    } catch (error) {
      log.error('Download error:', error);
      toast.error('Failed to download file');
    }
  };

  // Navigation is finalised inside the modal (it has access to vue-router)
  const navigateToDataManagement = () => {
    // No-op here; the modal handles routing.
  };

  uiStore.showSuccess({
    filename,
    result: {
      ...result,
      projectId: options.projectId || result.projectId,
      venueId: options.venueId || result.venueId,
      stageId: options.stageId || result.stageId,
      mimeType: options.mimeType || (filename.endsWith('.pdf') ? 'application/pdf' : 'image/png'),
    },
    onDownload: downloadFile,
    onNavigate: navigateToDataManagement,
  });
}

/**
 * Close export success modal.
 */
export function closeExportSuccessModal() {
  useExportUiStore().closeSuccess();
}

/**
 * Helper function to show export success toast with download option.
 * @deprecated Use showExportSuccessModal directly; kept for legacy call sites.
 * @param {Object} _toast - Toast instance (unused, kept for compatibility)
 * @param {Object} result - Result from savePDFToStorage or savePNGToStorage
 * @param {string} filename - Filename for download
 * @param {Object} options - Optional navigation options (projectId, venueId, stageId, mimeType)
 */
// eslint-disable-next-line no-unused-vars
export function showExportSuccessToast(_toast, result, filename, options = {}) {
  showExportSuccessModal(result, filename, options);
}

