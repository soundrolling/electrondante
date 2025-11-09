// src/services/exportService.js
import JSZip from 'jszip';
import { supabase } from '../supabase';
import { fetchTableData } from './dataService';
import { useToast } from 'vue-toastification';

const toast = useToast();

/**
 * Export project data as ZIP archive
 * @param {number|string} projectId - Project ID
 * @param {Object} selections - Selected data types to export
 * @param {Object} options - Export options { onProgress }
 * @returns {Promise<Blob>} ZIP file blob
 */
export async function exportProjectData(projectId, selections, options = {}) {
  const zip = new JSZip();
  const { onProgress } = options;
  let totalSteps = 0;
  let currentStep = 0;

  try {
    // Calculate total steps for progress
    totalSteps = Object.values(selections).filter(Boolean).length;
    if (selections.documents) totalSteps += 1; // Files download
    if (selections.pictures) totalSteps += 1; // Files download
    if (selections.rushes) totalSteps += 1; // Files download

    // Create metadata folder
    const metadataFolder = zip.folder('metadata');

    // Export project info
    if (onProgress) {
      onProgress({ current: ++currentStep, total: totalSteps, message: 'Exporting project info...' });
    }
    await exportProjectInfo(projectId, metadataFolder);

    // Export stages/locations
    if (selections.stages) {
      if (onProgress) {
        onProgress({ current: ++currentStep, total: totalSteps, message: 'Exporting stages...' });
      }
      await exportStages(projectId, metadataFolder);
    }

    // Export documents
    if (selections.documents) {
      if (onProgress) {
        onProgress({ current: ++currentStep, total: totalSteps, message: 'Exporting documents metadata...' });
      }
      const docsData = await exportDocuments(projectId, metadataFolder, zip, selections);
      if (onProgress && docsData.filesCount > 0) {
        onProgress({ current: ++currentStep, total: totalSteps, message: `Downloading ${docsData.filesCount} document files...` });
      }
    }

    // Export pictures
    if (selections.pictures) {
      if (onProgress) {
        onProgress({ current: ++currentStep, total: totalSteps, message: 'Exporting pictures metadata...' });
      }
      const picsData = await exportPictures(projectId, metadataFolder, zip, selections);
      if (onProgress && picsData.filesCount > 0) {
        onProgress({ current: ++currentStep, total: totalSteps, message: `Downloading ${picsData.filesCount} picture files...` });
      }
    }

    // Export gear
    if (selections.gear) {
      if (onProgress) {
        onProgress({ current: ++currentStep, total: totalSteps, message: 'Exporting gear...' });
      }
      await exportGear(projectId, metadataFolder);
    }

    // Export contacts
    if (selections.contacts) {
      if (onProgress) {
        onProgress({ current: ++currentStep, total: totalSteps, message: 'Exporting contacts...' });
      }
      await exportContacts(projectId, metadataFolder);
    }

    // Export travel
    if (selections.travel) {
      if (onProgress) {
        onProgress({ current: ++currentStep, total: totalSteps, message: 'Exporting travel data...' });
      }
      await exportTravel(projectId, metadataFolder);
    }

    // Export calendar events
    if (selections.calendar) {
      if (onProgress) {
        onProgress({ current: ++currentStep, total: totalSteps, message: 'Exporting calendar events...' });
      }
      await exportCalendar(projectId, metadataFolder);
    }

    // Export notes
    if (selections.notes) {
      if (onProgress) {
        onProgress({ current: ++currentStep, total: totalSteps, message: 'Exporting notes...' });
      }
      await exportNotes(projectId, metadataFolder);
    }

    // Export rushes
    if (selections.rushes) {
      if (onProgress) {
        onProgress({ current: ++currentStep, total: totalSteps, message: 'Exporting rushes metadata...' });
      }
      const rushesData = await exportRushes(projectId, metadataFolder, zip, selections);
      if (onProgress && rushesData.filesCount > 0) {
        onProgress({ current: ++currentStep, total: totalSteps, message: `Downloading ${rushesData.filesCount} rushes files...` });
      }
    }

    // Generate ZIP file
    if (onProgress) {
      onProgress({ current: totalSteps, total: totalSteps, message: 'Generating ZIP archive...' });
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    return blob;
  } catch (error) {
    console.error('Error exporting project data:', error);
    toast.error('Failed to export project data');
    throw error;
  }
}

/**
 * Export project basic info
 */
async function exportProjectInfo(projectId, metadataFolder) {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) throw error;
    metadataFolder.file('project-info.json', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error exporting project info:', error);
  }
}

/**
 * Export stages/locations
 */
async function exportStages(projectId, metadataFolder) {
  try {
    const stages = await fetchTableData('locations', {
      eq: { project_id: projectId },
      order: [{ column: 'order', ascending: true }],
    });
    metadataFolder.file('stages.json', JSON.stringify(stages, null, 2));
  } catch (error) {
    console.error('Error exporting stages:', error);
  }
}

/**
 * Export documents with files
 */
async function exportDocuments(projectId, metadataFolder, zip, selections) {
  try {
    let query = supabase
      .from('stage_docs')
      .select('*')
      .eq('project_id', projectId);

    // Apply filters if specified
    if (selections.venueFilter) {
      query = query.eq('venue_id', selections.venueFilter);
    }
    if (selections.stageFilter) {
      query = query.eq('stage_id', selections.stageFilter);
    }

    const { data: docs, error } = await query.order('order', { ascending: true });

    if (error) throw error;

    metadataFolder.file('documents-metadata.json', JSON.stringify(docs || [], null, 2));

    // Download files
    const documentsFolder = zip.folder('documents');
    let filesCount = 0;

    if (docs && docs.length > 0) {
      for (const doc of docs) {
        if (doc.file_path) {
          try {
            const { data: fileBlob, error: downloadError } = await supabase.storage
              .from('stage-docs')
              .download(doc.file_path);

            if (!downloadError && fileBlob) {
              const stageFolder = documentsFolder.folder(`stage-${doc.stage_id || 'unknown'}`);
              stageFolder.file(doc.file_name || doc.file_path.split('/').pop(), fileBlob);
              filesCount++;
            }
          } catch (err) {
            console.warn('Error downloading document:', doc.file_path, err);
          }
        }
      }
    }

    return { filesCount };
  } catch (error) {
    console.error('Error exporting documents:', error);
    return { filesCount: 0 };
  }
}

/**
 * Export pictures with files
 */
async function exportPictures(projectId, metadataFolder, zip, selections) {
  try {
    let query = supabase
      .from('stage_pictures')
      .select('*')
      .eq('project_id', projectId);

    // Apply filters if specified
    if (selections.venueFilter) {
      query = query.eq('venue_id', selections.venueFilter);
    }
    if (selections.stageFilter) {
      query = query.eq('stage_id', selections.stageFilter);
    }

    const { data: pictures, error } = await query.order('order', { ascending: true });

    if (error) throw error;

    metadataFolder.file('pictures-metadata.json', JSON.stringify(pictures || [], null, 2));

    // Download files
    const picturesFolder = zip.folder('pictures');
    let filesCount = 0;

    if (pictures && pictures.length > 0) {
      for (const pic of pictures) {
        if (pic.file_path) {
          try {
            const { data: fileBlob, error: downloadError } = await supabase.storage
              .from('stage-pictures')
              .download(pic.file_path);

            if (!downloadError && fileBlob) {
              const stageFolder = picturesFolder.folder(`stage-${pic.stage_id || 'unknown'}`);
              stageFolder.file(pic.name || pic.file_path.split('/').pop(), fileBlob);
              filesCount++;
            }
          } catch (err) {
            console.warn('Error downloading picture:', pic.file_path, err);
          }
        }
      }
    }

    return { filesCount };
  } catch (error) {
    console.error('Error exporting pictures:', error);
    return { filesCount: 0 };
  }
}

/**
 * Export gear
 */
async function exportGear(projectId, metadataFolder) {
  try {
    const gear = await fetchTableData('gear_table', {
      eq: { project_id: projectId },
    });
    const assignments = await fetchTableData('gear_assignments', {
      eq: { project_id: projectId },
    });

    metadataFolder.file('gear.json', JSON.stringify({ gear, assignments }, null, 2));
  } catch (error) {
    console.error('Error exporting gear:', error);
  }
}

/**
 * Export contacts
 */
async function exportContacts(projectId, metadataFolder) {
  try {
    const contacts = await fetchTableData('project_contacts', {
      eq: { project_id: projectId },
    });
    metadataFolder.file('contacts.json', JSON.stringify(contacts, null, 2));
  } catch (error) {
    console.error('Error exporting contacts:', error);
  }
}

/**
 * Export travel data
 */
async function exportTravel(projectId, metadataFolder) {
  try {
    const trips = await fetchTableData('travel_trips', {
      eq: { project_id: projectId },
    });
    const flights = await fetchTableData('travel_flights', {
      eq: { project_id: projectId },
    });
    const accommodations = await fetchTableData('travel_accommodations', {
      eq: { project_id: projectId },
    });
    const expenses = await fetchTableData('travel_expenses', {
      eq: { project_id: projectId },
    });
    const documents = await fetchTableData('travel_documents', {
      eq: { project_id: projectId },
    });

    metadataFolder.file('travel.json', JSON.stringify({
      trips,
      flights,
      accommodations,
      expenses,
      documents,
    }, null, 2));
  } catch (error) {
    console.error('Error exporting travel:', error);
  }
}

/**
 * Export calendar events
 */
async function exportCalendar(projectId, metadataFolder) {
  try {
    const events = await fetchTableData('calendar_events', {
      eq: { project_id: projectId },
    });
    metadataFolder.file('calendar-events.json', JSON.stringify(events, null, 2));
  } catch (error) {
    console.error('Error exporting calendar:', error);
  }
}

/**
 * Export notes
 */
async function exportNotes(projectId, metadataFolder) {
  try {
    // Notes might be in different tables depending on implementation
    // Adjust based on your actual notes table structure
    const { data: notes, error } = await supabase
      .from('notes')
      .select('*')
      .eq('project_id', projectId);

    if (!error && notes) {
      metadataFolder.file('notes.json', JSON.stringify(notes, null, 2));
    }
  } catch (error) {
    console.error('Error exporting notes:', error);
  }
}

/**
 * Export rushes with files
 */
async function exportRushes(projectId, metadataFolder, zip, selections) {
  try {
    let query = supabase
      .from('rushes_uploads')
      .select('*')
      .eq('project_id', projectId);

    // Apply filters if specified
    if (selections.venueFilter) {
      query = query.eq('venue_id', selections.venueFilter);
    }
    if (selections.stageFilter) {
      query = query.eq('location_id', selections.stageFilter);
    }

    const { data: rushes, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    metadataFolder.file('rushes-metadata.json', JSON.stringify(rushes || [], null, 2));

    // Download files
    const rushesFolder = zip.folder('rushes');
    let filesCount = 0;

    if (rushes && rushes.length > 0) {
      for (const rush of rushes) {
        if (rush.file_path) {
          try {
            // Try to determine bucket from file path or use default
            const bucket = 'stage-docs'; // Default bucket, adjust as needed
            const { data: fileBlob, error: downloadError } = await supabase.storage
              .from(bucket)
              .download(rush.file_path);

            if (!downloadError && fileBlob) {
              const stageFolder = rushesFolder.folder(`stage-${rush.location_id || 'unknown'}`);
              stageFolder.file(rush.file_name || rush.file_path.split('/').pop(), fileBlob);
              filesCount++;
            }
          } catch (err) {
            console.warn('Error downloading rushes file:', rush.file_path, err);
          }
        }
      }
    }

    return { filesCount };
  } catch (error) {
    console.error('Error exporting rushes:', error);
    return { filesCount: 0 };
  }
}

/**
 * Download ZIP file
 * @param {Blob} blob - ZIP file blob
 * @param {string} filename - Filename for download
 */
export function downloadZip(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `project-export-${Date.now()}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

