import { ref, computed } from 'vue'

export function useCalendarNavigation(initialDate = null) {
  const currentDate = ref(initialDate || new Date())
  const activeDayIndex = ref(-1)

  const currentDateString = computed(() => 
    currentDate.value.toISOString().split("T")[0]
  )

  // Calculate week days (Monday to Sunday)
  function makeWeekDays() {
    const dow = currentDate.value.getDay()
    // JS: 0=Sun, 1=Mon, ..., 6=Sat. We want Monday=0, Sunday=6
    const monday = new Date(currentDate.value)
    monday.setDate(monday.getDate() - ((dow === 0 ? 7 : dow) - 1))
    
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return { 
        date: d.toISOString().split("T")[0], 
        currentMonth: d.getMonth() === currentDate.value.getMonth() 
      }
    })
  }

  const weekDaysData = computed(makeWeekDays)
  const displayCalendarDays = weekDaysData

  // Week range header
  const weekRangeHeader = computed(() => {
    const week = weekDaysData.value
    if (!week.length) return ''
    
    const start = new Date(week[0].date)
    const end = new Date(week[6].date)
    const startMonth = start.toLocaleString('default', { month: 'long' })
    const endMonth = end.toLocaleString('default', { month: 'long' })
    const startDay = start.getDate()
    const endDay = end.getDate()
    const year = end.getFullYear()
    
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay}–${endDay}, ${year}`
    } else {
      return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`
    }
  })

  // Current week dates
  const currentWeekDates = computed(() => 
    weekDaysData.value.map(d => d.date)
  )

  const todayDate = new Date().toISOString().split('T')[0]
  const isCurrentWeek = computed(() => 
    currentWeekDates.value.includes(todayDate)
  )

  // Navigation functions
  function jumpToToday() {
    currentDate.value = new Date()
  }

  function previousDay() {
    const d = new Date(currentDate.value)
    d.setDate(d.getDate() - 1)
    currentDate.value = d
  }

  function nextDay() {
    const d = new Date(currentDate.value)
    d.setDate(d.getDate() + 1)
    currentDate.value = d
  }

  function previousPeriod() {
    const d = new Date(currentDate.value)
    d.setDate(d.getDate() - 7)
    currentDate.value = d
  }

  function nextPeriod() {
    const d = new Date(currentDate.value)
    d.setDate(d.getDate() + 7)
    currentDate.value = d
  }

  // Navigate to a specific date
  function goToDate(date) {
    currentDate.value = new Date(date)
  }

  // Set active day index (for timeline view)
  function setActiveDayIndex(index) {
    activeDayIndex.value = index
  }

  // Navigate to day by index (for timeline view)
  function navigateToDayIndex(index, daysWithEvents) {
    if (index >= 0 && index < daysWithEvents.length) {
      activeDayIndex.value = index
      currentDate.value = new Date(daysWithEvents[index])
    }
  }

  return {
    // State
    currentDate,
    currentDateString,
    activeDayIndex,
    
    // Computed
    weekDaysData,
    displayCalendarDays,
    weekRangeHeader,
    currentWeekDates,
    todayDate,
    isCurrentWeek,
    
    // Methods
    jumpToToday,
    previousDay,
    nextDay,
    previousPeriod,
    nextPeriod,
    goToDate,
    setActiveDayIndex,
    navigateToDayIndex
  }
}

