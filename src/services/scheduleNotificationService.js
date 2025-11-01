// src/services/scheduleNotificationService.js
import { useToast } from 'vue-toastification'
import { useUserStore } from '@/stores/userStore'
import { fetchTableData } from '@/services/dataService'
import { getSetting, saveSetting } from '@/utils/indexedDB'
import { toDateTime, t5 } from '@/utils/scheduleHelpers'

const toast = useToast()

// Track notifications that have been shown to prevent duplicates
// Key: `${scheduleId}_${recordingDate}_${startTime}`
const notifiedSchedules = new Set()

// Global state
let intervalId = null
let lastCheckedDay = null
let currentProjectId = null

/**
 * Calculate minutes until a scheduled start time
 * @param {string} recordingDate - Date string YYYY-MM-DD
 * @param {string} startTime - Time string HH:MM:SS
 * @returns {number} Minutes until start, or null if in past
 */
function getMinutesUntilStart(recordingDate, startTime) {
  if (!recordingDate || !startTime) return null
  
  const scheduleDateTime = toDateTime(recordingDate, startTime)
  if (!scheduleDateTime) return null
  
  const now = new Date()
  const diffMs = scheduleDateTime.getTime() - now.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  
  // Return null if the schedule is in the past
  if (diffMinutes < 0) return null
  
  return diffMinutes
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
function shouldShowNotification(schedule, warningMinutes, deviceMinutesUntil) {
  if (!schedule || !warningMinutes || deviceMinutesUntil === null) return false
  
  // Check if we're within the warning window (with ±5 second tolerance = ±0.08 minutes)
  const tolerance = 0.08
  const lowerBound = warningMinutes - tolerance
  const upperBound = warningMinutes + tolerance
  
  if (deviceMinutesUntil < lowerBound || deviceMinutesUntil > upperBound) {
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
 * Show changeover notification toast
 */
function showChangeoverNotification(schedule) {
  const startTime = t5(schedule.start_time)
  const message = `Changeover: ${schedule.artist_name} starting at ${startTime}`
  
  // Custom icon component for changeover (circular arrows - two arrows in a circle)
  const changeoverIcon = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 10L10 12L8 14" stroke-width="2.5"/>
      <path d="M16 10L14 12L16 14" stroke-width="2.5"/>
      <path d="M10 12H14" stroke-width="2.5"/>
    </svg>
  `
  
  toast.info(message, {
    timeout: 5000,
    icon: changeoverIcon,
    closeOnClick: true,
    pauseOnFocusLoss: true,
    pauseOnHover: true,
    draggable: true,
  })
  
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
      
      // Calculate minutes until this schedule starts
      const minutesUntil = getMinutesUntilStart(schedule.recording_date, schedule.start_time)
      
      // Check if we should show notification
      if (shouldShowNotification(schedule, scheduleWarningMinutes, minutesUntil)) {
        showChangeoverNotification(schedule)
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
