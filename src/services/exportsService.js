// src/services/exportsService.js
import { supabase } from '../supabase';

/**
 * Save an export to storage and track it in the database
 * @param {Blob} fileBlob - The file blob
 * @param {string} filename - The filename
 * @param {string} exportType - Type of export ('full_export', 'signal_mapper', 'pdf', etc.)
 * @param {string|number} projectId - Project ID
 * @param {Object} options - Additional options
 * @param {string} options.mimeType - MIME type (default: 'application/zip')
 * @param {string} options.description - Description of the export
 * @param {Object} options.exportSelections - What was included (for full exports)
 * @param {string|number|null} options.venueId - Venue ID
 * @param {string|number|null} options.locationId - Location/Stage ID
 * @param {Object} options.metadata - Additional metadata
 * @returns {Promise<{success: boolean, exportId?: string, error?: string}>}
 */
export async function saveExport(
  fileBlob,
  filename,
  exportType,
  projectId,
  options = {}
) {
  try {
    const {
      mimeType = 'application/zip',
      description = '',
      exportSelections = null,
      venueId = null,
      locationId = null,
      metadata = null,
    } = options;

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Determine storage bucket based on export type
    // For ZIP files (full exports), use a dedicated exports bucket or stage-docs
    // For other types, use appropriate buckets
    let bucketName = 'stage-docs'; // Default bucket
    if (exportType === 'full_export') {
      // Full exports are large ZIP files - use stage-docs bucket with exports folder
      bucketName = 'stage-docs';
    }

    // Create storage path
    const timestamp = Date.now();
    const storagePath = `${projectId}/exports/${timestamp}_${filename}`;

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
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

    // Get file size
    const fileSize = fileBlob.size;

    // Get version number (count existing exports of same type for this project/location)
    let version = 1;
    try {
      let versionQuery = supabase
        .from('project_exports')
        .select('version')
        .eq('project_id', projectId)
        .eq('export_type', exportType);
      
      if (locationId) {
        versionQuery = versionQuery.eq('location_id', locationId);
      }

      const { data: existingExports } = await versionQuery;

      if (existingExports && existingExports.length > 0) {
        const maxVersion = Math.max(...existingExports.map(e => e.version || 1));
        version = maxVersion + 1;
      }
    } catch (err) {
      console.warn('Error fetching version:', err);
    }

    // Create database entry
    const { data: exportData, error: dbError } = await supabase
      .from('project_exports')
      .insert({
        project_id: projectId,
        export_type: exportType,
        file_name: filename,
        file_path: uploadData.path,
        file_size: fileSize,
        mime_type: mimeType,
        description: description || getDefaultDescription(exportType),
        export_selections: exportSelections,
        venue_id: venueId || null,
        location_id: locationId || null,
        created_by: user.id,
        version: version,
        metadata: metadata,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      // Try to clean up the uploaded file
      await supabase.storage.from(bucketName).remove([uploadData.path]);
      return { success: false, error: dbError.message };
    }

    return { success: true, exportId: exportData.id };
  } catch (error) {
    console.error('Error saving export:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Get all exports for a project
 * @param {string|number} projectId - Project ID
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} Array of export records
 */
export async function getProjectExports(projectId, filters = {}) {
  try {
    let query = supabase
      .from('project_exports')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters.exportType) {
      query = query.eq('export_type', filters.exportType);
    }
    if (filters.locationId) {
      query = query.eq('location_id', filters.locationId);
    }
    if (filters.venueId) {
      query = query.eq('venue_id', filters.venueId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching exports:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting project exports:', error);
    return [];
  }
}

/**
 * Download an export file
 * @param {string} exportId - Export ID
 * @returns {Promise<{success: boolean, blob?: Blob, filename?: string, error?: string}>}
 */
export async function downloadExport(exportId) {
  try {
    // Get export record
    const { data: exportRecord, error: fetchError } = await supabase
      .from('project_exports')
      .select('*')
      .eq('id', exportId)
      .single();

    if (fetchError || !exportRecord) {
      return { success: false, error: 'Export not found' };
    }

    // Determine bucket based on file path or export type
    let bucketName = 'stage-docs'; // Default
    if (exportRecord.export_type === 'full_export') {
      bucketName = 'stage-docs';
    }

    // Download file from storage
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from(bucketName)
      .download(exportRecord.file_path);

    if (downloadError || !fileBlob) {
      return { success: false, error: downloadError?.message || 'Failed to download file' };
    }

    return {
      success: true,
      blob: fileBlob,
      filename: exportRecord.file_name,
      mimeType: exportRecord.mime_type,
    };
  } catch (error) {
    console.error('Error downloading export:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Delete an export
 * @param {string} exportId - Export ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteExport(exportId) {
  try {
    // Get export record
    const { data: exportRecord, error: fetchError } = await supabase
      .from('project_exports')
      .select('*')
      .eq('id', exportId)
      .single();

    if (fetchError || !exportRecord) {
      return { success: false, error: 'Export not found' };
    }

    // Determine bucket
    let bucketName = 'stage-docs';

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(bucketName)
      .remove([exportRecord.file_path]);

    if (storageError) {
      console.warn('Error deleting file from storage:', storageError);
      // Continue with database deletion even if storage deletion fails
    }

    // Delete database record
    const { error: dbError } = await supabase
      .from('project_exports')
      .delete()
      .eq('id', exportId);

    if (dbError) {
      return { success: false, error: dbError.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting export:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Get default description for export type
 */
function getDefaultDescription(exportType) {
  const descriptions = {
    full_export: 'Full project data export',
    signal_mapper: 'Signal mapper export',
    pdf: 'PDF export',
    csv: 'CSV export',
    json: 'JSON export',
    xml: 'XML export',
    png: 'PNG image export',
    other: 'Export',
  };
  return descriptions[exportType] || 'Export';
}

