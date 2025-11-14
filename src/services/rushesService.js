// src/services/rushesService.js
import { supabase } from '../supabase';
import { useToast } from 'vue-toastification';

const toast = useToast();

/**
 * Fetch all rushes uploads for a project with optional filters
 * @param {number|string} projectId - Project ID
 * @param {Object} filters - Optional filters { locationId, venueId, uploadStatus }
 * @returns {Promise<Array>} Array of rushes upload records
 */
export async function fetchRushesFiles(projectId, filters = {}) {
  try {
    let query = supabase
      .from('rushes_uploads')
      .select('*')
      .eq('project_id', projectId);

    if (filters.locationId) {
      query = query.eq('location_id', filters.locationId);
    }
    if (filters.venueId) {
      query = query.eq('venue_id', filters.venueId);
    }
    if (filters.uploadStatus) {
      query = query.eq('upload_status', filters.uploadStatus);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching rushes files:', error);
    toast.error('Failed to load rushes files');
    return [];
  }
}

/**
 * Update upload status for a rushes file
 * @param {number|string} uploadId - Rushes upload record ID
 * @param {string} status - Upload status: 'not_uploaded', 'uploaded', 'failed'
 * @param {string} frameIoUrl - Optional Frame.io URL
 * @param {string} uploadedBy - User email/name
 * @param {string} notes - Optional notes
 * @returns {Promise<Object>} Updated record
 */
export async function updateUploadStatus(uploadId, status, frameIoUrl = null, uploadedBy = null, notes = null) {
  try {
    const updateData = {
      upload_status: status,
      updated_at: new Date().toISOString(),
    };

    if (frameIoUrl) {
      updateData.frame_io_url = frameIoUrl;
    }
    if (uploadedBy) {
      updateData.uploaded_by = uploadedBy;
    }
    if (status === 'uploaded') {
      updateData.uploaded_at = new Date().toISOString();
    }
    if (notes !== null) {
      updateData.notes = notes;
    }

    const { data, error } = await supabase
      .from('rushes_uploads')
      .update(updateData)
      .eq('id', uploadId)
      .select()
      .single();

    if (error) throw error;
    toast.success('Upload status updated');
    return data;
  } catch (error) {
    console.error('Error updating upload status:', error);
    toast.error('Failed to update upload status');
    throw error;
  }
}

/**
 * Update or create upload status for a recorder on a recording day
 * @param {number|string} projectId - Project ID
 * @param {number|string} locationId - Stage/location ID
 * @param {number|string} stageHourId - Recording day (stage hour) ID
 * @param {string} recorderType - 'main' or 'backup'
 * @param {string} status - Upload status: 'not_uploaded', 'uploaded', 'failed'
 * @param {string} uploadedBy - User email/name
 * @returns {Promise<Object>} Updated or created record
 */
export async function updateRecorderStatus(projectId, locationId, stageHourId, recorderType, status, uploadedBy = null) {
  try {
    // Find existing record
    const { data: existing, error: findError } = await supabase
      .from('rushes_uploads')
      .select('*')
      .eq('project_id', projectId)
      .eq('location_id', locationId)
      .eq('stage_hour_id', stageHourId)
      .eq('recorder_type', recorderType)
      .maybeSingle();

    if (findError && findError.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw findError;
    }

    const updateData = {
      upload_status: status,
      updated_at: new Date().toISOString(),
    };

    if (uploadedBy) {
      updateData.uploaded_by = uploadedBy;
    }
    if (status === 'uploaded') {
      updateData.uploaded_at = new Date().toISOString();
    }

    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('rushes_uploads')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Create new record
      const insertData = {
        project_id: projectId,
        location_id: locationId,
        stage_hour_id: stageHourId,
        recorder_type: recorderType,
        file_path: `manual/${locationId}/${stageHourId}/${recorderType}`,
        file_name: `${recorderType}_recorder.bwf`,
        upload_status: status,
        ...updateData,
      };

      const { data, error } = await supabase
        .from('rushes_uploads')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  } catch (error) {
    console.error('Error updating recorder status:', error);
    toast.error('Failed to update recorder status');
    throw error;
  }
}

/**
 * Create a new rushes upload record
 * @param {Object} rushesData - Rushes file data
 * @returns {Promise<Object>} Created record
 */
export async function createRushesUpload(rushesData) {
  try {
    const { data, error } = await supabase
      .from('rushes_uploads')
      .insert([rushesData])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating rushes upload:', error);
    toast.error('Failed to create rushes upload record');
    throw error;
  }
}

/**
 * Delete a rushes upload record
 * @param {number|string} uploadId - Rushes upload record ID
 * @returns {Promise<void>}
 */
export async function deleteRushesUpload(uploadId) {
  try {
    const { error } = await supabase
      .from('rushes_uploads')
      .delete()
      .eq('id', uploadId);

    if (error) throw error;
    toast.success('Rushes upload record deleted');
  } catch (error) {
    console.error('Error deleting rushes upload:', error);
    toast.error('Failed to delete rushes upload record');
    throw error;
  }
}

/**
 * Detect BWF files in storage buckets for a project
 * Scans common storage buckets for .bwf files
 * @param {number|string} projectId - Project ID
 * @returns {Promise<Array>} Array of detected BWF files
 */
export async function detectBWFiles(projectId) {
  try {
    const buckets = ['stage-docs', 'stage-pictures']; // Add other buckets as needed
    const detectedFiles = [];

    for (const bucketName of buckets) {
      try {
        // List files in the project directory
        const { data: files, error } = await supabase.storage
          .from(bucketName)
          .list(String(projectId), {
            limit: 1000,
            offset: 0,
            sortBy: { column: 'name', order: 'asc' }
          });

        if (error) {
          console.warn(`Error listing files in ${bucketName}:`, error);
          continue;
        }

        // Recursively search for BWF files
        const findBWFFiles = async (path, items) => {
          for (const item of items || []) {
            if (!item.name) continue;
            
            // Check if it's a BWF file
            if (item.name.toLowerCase().endsWith('.bwf')) {
              const fullPath = path ? `${path}/${item.name}` : item.name;
              detectedFiles.push({
                bucket: bucketName,
                file_path: fullPath,
                file_name: item.name,
                file_size: item.metadata?.size || item.size || null,
                detected_at: new Date().toISOString(),
              });
            } else if (!item.metadata || !item.metadata.size) {
              // Likely a folder (no size metadata), recurse into it
              const folderPath = path ? `${path}/${item.name}` : item.name;
              try {
                const { data: folderItems } = await supabase.storage
                  .from(bucketName)
                  .list(folderPath, { limit: 1000 });
                if (folderItems && folderItems.length > 0) {
                  await findBWFFiles(folderPath, folderItems);
                }
              } catch (err) {
                // Skip if folder listing fails
                console.warn(`Error listing folder ${folderPath}:`, err);
              }
            }
          }
        };

        await findBWFFiles(String(projectId), files);
      } catch (err) {
        console.warn(`Error scanning bucket ${bucketName}:`, err);
      }
    }

    return detectedFiles;
  } catch (error) {
    console.error('Error detecting BWF files:', error);
    toast.error('Failed to detect BWF files');
    return [];
  }
}

/**
 * Sync detected BWF files with rushes_uploads table
 * Creates records for new files, skips existing ones
 * @param {number|string} projectId - Project ID
 * @param {Array} detectedFiles - Array of detected file info
 * @returns {Promise<Object>} Sync results
 */
export async function syncDetectedFiles(projectId, detectedFiles) {
  try {
    // Get existing records
    const existing = await fetchRushesFiles(projectId);
    const existingPaths = new Set(existing.map(r => r.file_path));

    const newFiles = detectedFiles.filter(f => !existingPaths.has(f.file_path));
    let created = 0;
    let skipped = 0;

    for (const file of newFiles) {
      try {
        // Try to extract location_id and venue_id from path if possible
        // Path format might be: projectId/venueId/stageId/filename.bwf
        const pathParts = file.file_path.split('/');
        let locationId = null;
        let venueId = null;

        if (pathParts.length >= 3) {
          // Try to find venue_id and location_id from path structure
          // This is project-specific, adjust based on your storage structure
          const stageIdMatch = pathParts.find(p => p && !isNaN(p));
          if (stageIdMatch) {
            locationId = parseInt(stageIdMatch);
          }
        }

        await createRushesUpload({
          project_id: projectId,
          location_id: locationId,
          venue_id: venueId,
          file_path: file.file_path,
          file_name: file.file_name,
          file_size: file.file_size,
          upload_status: 'not_uploaded',
        });
        created++;
      } catch (err) {
        console.warn('Error creating record for file:', file.file_path, err);
        skipped++;
      }
    }

    skipped += existing.length;

    return {
      created,
      skipped,
      total: detectedFiles.length,
    };
  } catch (error) {
    console.error('Error syncing detected files:', error);
    toast.error('Failed to sync detected files');
    throw error;
  }
}

