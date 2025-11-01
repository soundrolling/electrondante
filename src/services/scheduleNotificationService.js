// src/services/scheduleNotificationService.js
import { useUserStore } from '@/stores/userStore'
import { fetchTableData } from '@/services/dataService'
import { getSetting, saveSetting } from '@/utils/indexedDB'
import { toDateTime, t5 } from '@/utils/scheduleHelpers'

// Track notifications that have been shown to prevent duplicates
// Key: `${scheduleId}_${recordingDate}_${startTime}`
const notifiedSchedules = new Set()

// Global state
let intervalId = null
let lastCheckedDay = null
let currentProjectId = null

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
 * Get notification key for tracking
 */
function getNotificationKey(schedule) {
  return `${schedule.id}_${schedule.recording_date}_${schedule.start_time}`
}

/**
 * Check if notification should be shown for a schedule
 */
function shouldShowNotification(schedule, warningMinutes, deviceSecondsUntil) {
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
  const key = getNotificationKey(schedule)
  if (notifiedSchedules.has(key)) {
    return false
  }
  
  return true
}

/**
 * Show changeover notification modal
 */
function showChangeoverNotification(schedule, warningMinutes) {
  // Calculate remaining minutes (round up to show at least 1 minute if less than a minute remains)
  const secondsUntil = getSecondsUntilStart(schedule.recording_date, schedule.start_time)
  const minutesRemaining = secondsUntil ? Math.max(1, Math.ceil(secondsUntil / 60)) : warningMinutes
  
  // Update modal state
  if (setModalCallback) {
    setModalCallback({
      visible: true,
      artistName: schedule.artist_name,
      minutesRemaining: minutesRemaining,
      startTime: t5(schedule.start_time),
      locationId: schedule.location_id,
      projectId: currentProjectId
    })
  }
  
  // Show modal
  if (showModalCallback) {
    showModalCallback()
  }
  
  // Mark as notified
  const key = getNotificationKey(schedule)
  notifiedSchedules.add(key)
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
  // Get userStore - this needs to be called from setup context
  // We'll pass the projectId from App.vue instead
  if (!currentProjectId) {
    return
  }
  
  const projectId = currentProjectId
  
  // Check if notifications are enabled
  const notificationsEnabled = await getSetting('schedule_notifications_enabled', true)
  if (notificationsEnabled === false) {
    return // Notifications disabled, don't check
  }
  
  // Clear old notifications if it's a new day
  checkAndClearNotificationsIfNewDay()
  
  // Re-initialize if project changed
  if (currentProjectId !== projectId) {
    currentProjectId = projectId
    notifiedSchedules.clear()
  }
  
  try {
    // Get default warning minutes (default 2 minutes)
    const defaultWarningMinutes = await getSetting('schedule_warning_minutes', 2)
    const warningMinutes = parseInt(defaultWarningMinutes, 10) || 2
    
    // Fetch all schedules for all locations in the current project
    const schedules = await fetchTableData('schedules', {
      eq: { project_id: projectId },
      order: [
        { column: 'recording_date', ascending: true },
        { column: 'start_time', ascending: true }
      ]
    })
    
    // Get per-schedule warning minutes if available, otherwise use default
    // For now, using global setting (Option B). Can be enhanced for per-schedule later.
    
    // Check each schedule
    for (const schedule of schedules) {
      // Get warning minutes - check schedule-specific first, then default
      const scheduleWarningMinutes = schedule.warning_bell_minutes 
        ? parseInt(schedule.warning_bell_minutes, 10) 
        : warningMinutes
      
      // Calculate seconds until this schedule starts (for accurate timing)
      const secondsUntil = getSecondsUntilStart(schedule.recording_date, schedule.start_time)
      
      // Check if we should show notification
      if (shouldShowNotification(schedule, scheduleWarningMinutes, secondsUntil)) {
        showChangeoverNotification(schedule, scheduleWarningMinutes)
      }
    }
  } catch (error) {
    console.error('Error checking schedules for notifications:', error)
  }
}

/**
 * Start monitoring schedules
 * @param {string|null} projectId - The current project ID (optional, will use global currentProjectId if not provided)
 * @param {number} intervalSeconds - How often to check (default 15 seconds)
 */
export function startScheduleNotifications(projectId = null, intervalSeconds = 15) {
  // Clear any existing interval
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
  
  if (!currentProjectId) {
    console.warn('[ScheduleNotifications] No project ID available, not starting monitoring')
    return
  }
  
  // Do an initial check
  checkSchedulesForNotifications()
  
  // Set up interval to check periodically
  intervalId = setInterval(() => {
    checkSchedulesForNotifications()
  }, intervalSeconds * 1000)
  
  console.log(`[ScheduleNotifications] Started monitoring project ${currentProjectId} (checking every ${intervalSeconds}s)`)
}

/**
 * Stop monitoring schedules
 */
export function stopScheduleNotifications() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    console.log('[ScheduleNotifications] Stopped monitoring')
  }
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
