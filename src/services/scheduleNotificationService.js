// src/services/scheduleNotificationService.js
import { useUserStore } from '@/stores/userStore'
import { fetchTableData } from '@/services/dataService'
import { getSetting, saveSetting } from '@/utils/indexedDB'
import { toDateTime, t5 } from '@/utils/scheduleHelpers'
import { supabase } from '@/supabase'

// Track notifications that have been shown to prevent duplicates
// Key: `${projectId}_${scheduleId}_${recordingDate}_${startTime}_${warningMinutes}`
const notifiedSchedules = new Set()

// Global state
let intervalId = null
let lastCheckedDay = null
let currentProjectId = null
let activeSubscriptions = [] // Array of subscription objects to clean up
let subscriptionChannels = new Map() // Map of projectId -> channel for broadcasting

// Callbacks for updating modal
let setModalCallback = null
let showModalCallback = null

/**
 * Set the callback function to update modal state
 */
export function setChangeoverModalCallbacks(setModal, showModal) {
  setModalCallback = setModal
  showModalCallback = showModal
}

/**
 * Calculate seconds until a scheduled start time
 * @param {string} recordingDate - Date string YYYY-MM-DD
 * @param {string} startTime - Time string HH:MM:SS
 * @returns {number} Seconds until start, or null if in past
 */
function getSecondsUntilStart(recordingDate, startTime) {
  if (!recordingDate || !startTime) return null
  
  const scheduleDateTime = toDateTime(recordingDate, startTime)
  if (!scheduleDateTime) return null
  
  const now = new Date()
  const diffMs = scheduleDateTime.getTime() - now.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  
  // Return null if the schedule is in the past
  if (diffSeconds < 0) return null
  
  return diffSeconds
}

/**
 * Get notification key for tracking (enhanced to include project and warning minutes)
 */
function getNotificationKey(schedule, projectId, warningMinutes) {
  return `${projectId}_${schedule.id}_${schedule.recording_date}_${schedule.start_time}_${warningMinutes}`
}

/**
 * Check if notification should be shown for a schedule
 */
function shouldShowNotification(schedule, warningMinutes, deviceSecondsUntil, projectId) {
  if (!schedule || !warningMinutes || deviceSecondsUntil === null) return false
  
  // Convert warning minutes to seconds (e.g., 2 minutes = 120 seconds)
  const warningSeconds = warningMinutes * 60
  
  // Check if we're within the warning window (with ±5 second tolerance)
  const tolerance = 5 // 5 seconds tolerance
  const lowerBound = warningSeconds - tolerance
  const upperBound = warningSeconds + tolerance
  
  if (deviceSecondsUntil < lowerBound || deviceSecondsUntil > upperBound) {
    return false
  }
  
  // Check if we've already shown this notification
  const key = getNotificationKey(schedule, projectId, warningMinutes)
  if (notifiedSchedules.has(key)) {
    return false
  }
  
  return true
}

/**
 * Check if user's alert preference allows showing notification for this project
 */
async function shouldShowNotificationForUser(projectId) {
  try {
    // Check if notifications are enabled
    const notificationsEnabled = await getSetting('schedule_notifications_enabled', true)
    if (notificationsEnabled === false) {
      return false // User has "No Alert" preference
    }
    
    // Get user's notification scope preference
    const notificationScope = await getSetting('schedule_notification_scope', 'current_project')
    
    // Normalize project IDs to strings for comparison
    const normalizedProjectId = String(projectId)
    const normalizedCurrentProjectId = currentProjectId ? String(currentProjectId) : null
    
    if (notificationScope === 'current_project') {
      // Only show if this is the current project
      return normalizedProjectId === normalizedCurrentProjectId
    } else if (notificationScope === 'all_projects') {
      // Show for all projects user is a member of
      try {
        const userStore = useUserStore()
        const userId = userStore.user?.id
        const userEmail = userStore.userEmail || userStore.user?.email
        
        if (userId && userEmail) {
          const userProjects = await getUserProjects(userId, userEmail)
          // Normalize all project IDs to strings for comparison
          const normalizedUserProjects = userProjects.map(p => String(p))
          return normalizedUserProjects.includes(normalizedProjectId)
        }
      } catch (e) {
        console.warn('[ScheduleNotifications] Could not check user projects:', e)
      }
      // Fallback: only show for current project if we can't determine user projects
      return normalizedProjectId === normalizedCurrentProjectId
    }
    
    // Default: only current project
    return normalizedProjectId === normalizedCurrentProjectId
  } catch (error) {
    console.error('[ScheduleNotifications] Error checking user preference:', error)
    // Fallback: only show for current project
    const normalizedProjectId = String(projectId)
    const normalizedCurrentProjectId = currentProjectId ? String(currentProjectId) : null
    return normalizedProjectId === normalizedCurrentProjectId
  }
}

/**
 * Show changeover notification modal
 */
async function showChangeoverNotification(schedule, warningMinutes, projectId = null) {
  // Use the configured warning minutes for the display (not calculated remaining time)
  // This shows the warning time the user configured (e.g., "2 minutes")
  
  const targetProjectId = projectId || currentProjectId
  
  // Check if user's alert preference allows showing this notification
  const shouldShow = await shouldShowNotificationForUser(targetProjectId)
  if (!shouldShow) {
    return // User preference doesn't allow this notification
  }
  
  // Update modal state
  if (setModalCallback) {
    setModalCallback({
      visible: true,
      artistName: schedule.artist_name,
      minutesRemaining: warningMinutes, // Show the configured warning time
      startTime: t5(schedule.start_time),
      locationId: schedule.location_id,
      projectId: targetProjectId
    })
  }
  
  // Show modal
  if (showModalCallback) {
    showModalCallback()
  }
  
  // Mark as notified
  const key = getNotificationKey(schedule, targetProjectId, warningMinutes)
  notifiedSchedules.add(key)
}

/**
 * Broadcast schedule notification to all connected users via Supabase real-time
 */
async function broadcastScheduleNotification(projectId, schedule, warningMinutes) {
  try {
    // Get the existing channel for this project
    const channel = subscriptionChannels.get(projectId)
    
    if (!channel) {
      console.warn(`[ScheduleNotifications] No channel found for project ${projectId}, skipping broadcast`)
      return
    }
    
    const notificationPayload = {
      schedule_id: schedule.id,
      artist_name: schedule.artist_name,
      start_time: schedule.start_time,
      recording_date: schedule.recording_date,
      location_id: schedule.location_id,
      project_id: projectId,
      warning_minutes: warningMinutes,
      timestamp: new Date().toISOString()
    }
    
    const result = await channel.send({
      type: 'broadcast',
      event: 'schedule_notification',
      payload: notificationPayload
    })
    
    if (result === 'ok') {
      console.log(`[ScheduleNotifications] Broadcasted notification for ${schedule.artist_name} in project ${projectId}`)
    } else {
      console.warn(`[ScheduleNotifications] Broadcast result: ${result}`)
    }
  } catch (error) {
    console.error('[ScheduleNotifications] Error broadcasting notification:', error)
  }
}

/**
 * Get all projects the user is a member of
 */
async function getUserProjects(userId, userEmail) {
  try {
    // Get owned projects
    const { data: owned, error: ownedError } = await supabase
      .from('projects')
      .select('id')
      .eq('user_id', userId)
    
    if (ownedError) {
      console.error('[ScheduleNotifications] Error fetching owned projects:', ownedError)
    }
    
    // Get projects where user is a member
    const { data: memberRows, error: memberError } = await supabase
      .from('project_members')
      .select('project_id')
      .or(`user_id.eq.${userId},user_email.eq.${userEmail}`)
    
    if (memberError) {
      console.error('[ScheduleNotifications] Error fetching member projects:', memberError)
    }
    
    // Combine and deduplicate project IDs
    const projectIds = new Set()
    if (owned) {
      owned.forEach(p => projectIds.add(p.id))
    }
    if (memberRows) {
      memberRows.forEach(m => projectIds.add(m.project_id))
    }
    
    return Array.from(projectIds)
  } catch (error) {
    console.error('[ScheduleNotifications] Error getting user projects:', error)
    return []
  }
}

/**
 * Clear notification history when day changes
 */
function checkAndClearNotificationsIfNewDay() {
  const today = new Date().toISOString().slice(0, 10)
  if (lastCheckedDay !== today) {
    notifiedSchedules.clear()
    lastCheckedDay = today
  }
}

/**
 * Main check function - evaluates all schedules and triggers notifications
 */
async function checkSchedulesForNotifications() {
  // Check if notifications are enabled
  const notificationsEnabled = await getSetting('schedule_notifications_enabled', true)
  if (notificationsEnabled === false) {
    return // Notifications disabled, don't check
  }
  
  // Clear old notifications if it's a new day
  checkAndClearNotificationsIfNewDay()
  
  try {
    // Get user's notification scope preference
    const notificationScope = await getSetting('schedule_notification_scope', 'current_project')
    
    // Get user info for fetching projects
    let userStore
    let userId = null
    let userEmail = null
    
    try {
      userStore = useUserStore()
      userId = userStore.user?.id
      userEmail = userStore.userEmail || userStore.user?.email
    } catch (e) {
      console.warn('[ScheduleNotifications] Could not get user store:', e)
    }
    
    // Determine which projects to check
    let projectIdsToCheck = []
    
    if (notificationScope === 'all_projects' && userId && userEmail) {
      // Get all projects user is a member of
      projectIdsToCheck = await getUserProjects(userId, userEmail)
      if (projectIdsToCheck.length === 0) {
        console.warn('[ScheduleNotifications] User has no projects, skipping check')
        return
      }
    } else {
      // Only check current project
      if (!currentProjectId) {
        return
      }
      projectIdsToCheck = [currentProjectId]
    }
    
    // Get default warning minutes (default 2 minutes)
    const defaultWarningMinutes = await getSetting('schedule_warning_minutes', 2)
    const warningMinutes = parseInt(defaultWarningMinutes, 10) || 2
    
    // Check schedules for each project
    for (const projectId of projectIdsToCheck) {
      try {
        // Fetch all schedules for all locations in this project
        const schedules = await fetchTableData('schedules', {
          eq: { project_id: projectId },
          order: [
            { column: 'recording_date', ascending: true },
            { column: 'start_time', ascending: true }
          ]
        })
        
        // Check each schedule
        for (const schedule of schedules) {
          // Get warning minutes - check schedule-specific first, then default
          const scheduleWarningMinutes = schedule.warning_bell_minutes 
            ? parseInt(schedule.warning_bell_minutes, 10) 
            : warningMinutes
          
          // Calculate seconds until this schedule starts (for accurate timing)
          const secondsUntil = getSecondsUntilStart(schedule.recording_date, schedule.start_time)
          
          // Check if we should show notification
          if (shouldShowNotification(schedule, scheduleWarningMinutes, secondsUntil, projectId)) {
            // Broadcast to all connected users via real-time
            await broadcastScheduleNotification(projectId, schedule, scheduleWarningMinutes)
            
            // Also show locally (in case real-time fails or user is first to detect)
            // This will check user preference internally
            await showChangeoverNotification(schedule, scheduleWarningMinutes, projectId)
          }
        }
      } catch (error) {
        console.error(`[ScheduleNotifications] Error checking schedules for project ${projectId}:`, error)
      }
    }
  } catch (error) {
    console.error('[ScheduleNotifications] Error checking schedules for notifications:', error)
  }
}

/**
 * Subscribe to real-time schedule notifications for a project
 */
function subscribeToScheduleNotifications(projectId, callback) {
  try {
    const channel = supabase.channel(`schedule_notifications_${projectId}`)
      .on('broadcast', { event: 'schedule_notification' }, (payload) => {
        console.log(`[ScheduleNotifications] Received broadcast for project ${projectId}:`, payload.payload)
        callback(payload.payload)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[ScheduleNotifications] Subscribed to notifications for project ${projectId}`)
          // Store channel for broadcasting
          subscriptionChannels.set(projectId, channel)
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[ScheduleNotifications] Error subscribing to project ${projectId}`)
        }
      })
    
    return channel
  } catch (error) {
    console.error(`[ScheduleNotifications] Error setting up subscription for project ${projectId}:`, error)
    return null
  }
}

/**
 * Start monitoring schedules
 * @param {string|null} projectId - The current project ID (optional, will use global currentProjectId if not provided)
 * @param {number} intervalSeconds - How often to check (default 15 seconds)
 */
export async function startScheduleNotifications(projectId = null, intervalSeconds = 15) {
  // Clear any existing interval and subscriptions
  stopScheduleNotifications()
  
  // Set the current project ID if provided
  if (projectId) {
    currentProjectId = projectId
    notifiedSchedules.clear()
  } else {
    // Try to get from userStore if available
    try {
      const userStore = useUserStore()
      if (userStore.isAuthenticated && userStore.getCurrentProject) {
        currentProjectId = userStore.getCurrentProject.id
        notifiedSchedules.clear()
      }
    } catch (e) {
      // userStore might not be available yet
      console.warn('[ScheduleNotifications] Could not get project from store:', e)
    }
  }
  
  // Get notification scope to determine which projects to monitor
  const notificationScope = await getSetting('schedule_notification_scope', 'current_project')
  
  let projectIdsToMonitor = []
  
  if (notificationScope === 'all_projects') {
    // Get all projects user is a member of
    try {
      const userStore = useUserStore()
      const userId = userStore.user?.id
      const userEmail = userStore.userEmail || userStore.user?.email
      
      if (userId && userEmail) {
        projectIdsToMonitor = await getUserProjects(userId, userEmail)
      } else {
        console.warn('[ScheduleNotifications] Cannot get user info for all_projects scope')
        if (currentProjectId) {
          projectIdsToMonitor = [currentProjectId]
        }
      }
    } catch (e) {
      console.error('[ScheduleNotifications] Error getting user projects:', e)
      if (currentProjectId) {
        projectIdsToMonitor = [currentProjectId]
      }
    }
  } else {
    // Only monitor current project
    if (!currentProjectId) {
      console.warn('[ScheduleNotifications] No project ID available, not starting monitoring')
      return
    }
    projectIdsToMonitor = [currentProjectId]
  }
  
  if (projectIdsToMonitor.length === 0) {
    console.warn('[ScheduleNotifications] No projects to monitor')
    return
  }
  
  // Subscribe to real-time notifications for all relevant projects
  activeSubscriptions = []
  for (const projId of projectIdsToMonitor) {
    const subscription = subscribeToScheduleNotifications(projId, async (notificationData) => {
      // Handle received notification
      const schedule = {
        id: notificationData.schedule_id,
        artist_name: notificationData.artist_name,
        start_time: notificationData.start_time,
        recording_date: notificationData.recording_date,
        location_id: notificationData.location_id
      }
      
      const key = getNotificationKey(schedule, notificationData.project_id, notificationData.warning_minutes)
      if (!notifiedSchedules.has(key)) {
        await showChangeoverNotification(schedule, notificationData.warning_minutes, notificationData.project_id)
      }
    })
    
    if (subscription) {
      activeSubscriptions.push(subscription)
    }
  }
  
  // Do an initial check
  await checkSchedulesForNotifications()
  
  // Set up interval to check periodically
  intervalId = setInterval(() => {
    checkSchedulesForNotifications()
  }, intervalSeconds * 1000)
  
  console.log(`[ScheduleNotifications] Started monitoring ${projectIdsToMonitor.length} project(s) (checking every ${intervalSeconds}s)`)
}

/**
 * Stop monitoring schedules
 */
export function stopScheduleNotifications() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  
  // Unsubscribe from all real-time channels
  for (const subscription of activeSubscriptions) {
    try {
      supabase.removeChannel(subscription)
    } catch (error) {
      console.error('[ScheduleNotifications] Error removing subscription:', error)
    }
  }
  activeSubscriptions = []
  subscriptionChannels.clear()
  
  console.log('[ScheduleNotifications] Stopped monitoring')
}

/**
 * Get or set the default warning minutes
 */
export async function getDefaultWarningMinutes() {
  return await getSetting('schedule_warning_minutes', 2)
}

export async function setDefaultWarningMinutes(minutes) {
  await saveSetting('schedule_warning_minutes', minutes)
}
