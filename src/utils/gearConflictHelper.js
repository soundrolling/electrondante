/**
 * Utility functions for checking gear assignment conflicts based on project dates
 */

/**
 * Check if two date ranges overlap
 * @param {string[]} days1 - Array of date strings (YYYY-MM-DD)
 * @param {string[]} days2 - Array of date strings (YYYY-MM-DD)
 * @returns {boolean} - True if any dates overlap
 */
export function datesOverlap(days1, days2) {
  if (!days1 || !days2 || days1.length === 0 || days2.length === 0) {
    return false;
  }
  
  const set1 = new Set(days1);
  const set2 = new Set(days2);
  
  for (const date of set1) {
    if (set2.has(date)) {
      return true;
    }
  }
  return false;
}

/**
 * Get all dates from build_days and main_show_days combined
 * @param {Object} project - Project object with build_days and main_show_days
 * @returns {string[]} - Array of all date strings
 */
export function getAllProjectDates(project) {
  const dates = [];
  
  if (Array.isArray(project.build_days) && project.build_days.length > 0) {
    dates.push(...project.build_days);
  }
  
  if (Array.isArray(project.main_show_days) && project.main_show_days.length > 0) {
    dates.push(...project.main_show_days);
  }
  
  return [...new Set(dates)]; // Remove duplicates
}

/**
 * Check if a project's dates overlap with another project's dates
 * @param {Object} project1 - First project
 * @param {Object} project2 - Second project
 * @returns {boolean} - True if dates overlap
 */
export function projectsDateOverlap(project1, project2) {
  const dates1 = getAllProjectDates(project1);
  const dates2 = getAllProjectDates(project2);
  return datesOverlap(dates1, dates2);
}

/**
 * Check for conflicts when assigning user gear to a project
 * Finds all other projects using the same user gear and checks for date overlaps
 * @param {string} userGearId - The user gear ID
 * @param {string} currentProjectId - The project we're adding gear to
 * @param {Object} currentProject - Current project object with dates
 * @param {Object} supabase - Supabase client instance
 * @returns {Promise<Array>} - Array of conflict objects: { project_name, project_id, conflict_type: 'date_overlap' }
 */
export async function checkGearAssignmentConflicts(userGearId, currentProjectId, currentProject, supabase) {
  if (!userGearId || !currentProjectId || !currentProject) {
    return [];
  }
  
  try {
    // Find all project gear entries that use this user gear (excluding current project)
    const { data: projectGearEntries, error: gearError } = await supabase
      .from('gear_table')
      .select('id, project_id')
      .eq('user_gear_id', userGearId)
      .neq('project_id', currentProjectId);
    
    if (gearError) {
      console.error('Error checking gear conflicts:', gearError);
      return [];
    }
    
    if (!projectGearEntries || projectGearEntries.length === 0) {
      return []; // No other projects using this gear
    }
    
    // Get unique project IDs
    const otherProjectIds = [...new Set(projectGearEntries.map(g => g.project_id))];
    
    // Fetch those projects to get their dates
    const { data: otherProjects, error: projectsError } = await supabase
      .from('projects')
      .select('id, project_name, build_days, main_show_days')
      .in('id', otherProjectIds);
    
    if (projectsError) {
      console.error('Error fetching projects for conflict check:', projectsError);
      return [];
    }
    
    // Check for date overlaps
    const conflicts = [];
    const currentDates = getAllProjectDates(currentProject);
    
    if (currentDates.length === 0) {
      // Current project has no dates, so no conflicts possible
      return [];
    }
    
    for (const otherProject of otherProjects || []) {
      const otherDates = getAllProjectDates(otherProject);
      if (otherDates.length > 0 && datesOverlap(currentDates, otherDates)) {
        conflicts.push({
          project_name: otherProject.project_name || 'Unknown Project',
          project_id: otherProject.id,
          conflict_type: 'date_overlap',
          conflict_dates: {
            current: currentDates,
            other: otherDates,
            overlapping: currentDates.filter(d => otherDates.includes(d))
          }
        });
      }
    }
    
    return conflicts;
  } catch (error) {
    console.error('Error in checkGearAssignmentConflicts:', error);
    return [];
  }
}

/**
 * Format conflict message for display
 * @param {Array} conflicts - Array of conflict objects
 * @param {string} gearName - Name of the gear item
 * @returns {string} - Formatted conflict message
 */
export function formatConflictMessage(conflicts, gearName) {
  if (!conflicts || conflicts.length === 0) {
    return null;
  }
  
  if (conflicts.length === 1) {
    return `⚠️ ${gearName} is already assigned to "${conflicts[0].project_name}" with overlapping dates. This may cause availability issues.`;
  } else {
    const projectNames = conflicts.map(c => `"${c.project_name}"`).join(', ');
    return `⚠️ ${gearName} is already assigned to ${conflicts.length} other projects with overlapping dates: ${projectNames}. This may cause availability issues.`;
  }
}

