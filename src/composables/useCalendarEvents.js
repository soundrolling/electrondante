import { ref, computed } from 'vue'
import { useToast } from 'vue-toastification'
import { fetchTableData } from '@/services/dataService'
import { supabase } from '@/supabase'

export function useCalendarEvents(projectId, userStore) {
  const toast = useToast()
  const loading = ref(false)
  const error = ref('')
  const events = ref([])
  const travelTrips = ref([])

  // Fetch calendar events from Supabase
  async function fetchEvents() {
    if (!projectId.value) {
      error.value = "No project selected."
      return
    }

    loading.value = true
    error.value = ""

    try {
      console.log('[useCalendarEvents] Fetching calendar events for project:', projectId.value)
      const rawCal = await fetchTableData("calendar_events", { eq: { project_id: projectId.value } })
      console.log('[useCalendarEvents] Fetched calendar events:', rawCal.length)
      
      const calData = rawCal.map(c => ({
        id: c.id,
        category: c.category || "calltimes",
        title: c.title,
        event_date: c.event_date,
        start_time: c.start_time,
        end_date: c.end_date || c.event_date,
        end_time: c.end_time,
        location_id: c.location_id,
        notes: c.notes || "",
        assigned_contacts: c.assigned_contacts || []
      }))

      events.value = calData
    } catch (e) {
      console.error('[useCalendarEvents] Calendar events error:', e)
      error.value = "Failed to load calendar events: " + e.message
    } finally {
      loading.value = false
    }
  }

  // Fetch travel trips for synthetic events
  async function fetchTravelTrips() {
    if (!projectId.value) return

    try {
      const { data: trips, error: tripsError } = await supabase
        .from('travel_trips')
        .select('*')
        .eq('project_id', projectId.value)
      
      if (tripsError) throw tripsError
      travelTrips.value = trips || []
    } catch (e) {
      console.error('Failed to load travel trips:', e.message)
      travelTrips.value = []
    }
  }

  // Create synthetic events from build days and travel trips
  const syntheticEvents = computed(() => {
    const project = userStore.getCurrentProject
    let synthetic = []

    // Build day events
    if (project && Array.isArray(project.build_days)) {
      synthetic = synthetic.concat(
        project.build_days.map(date => ({
          id: `build_${date}`,
          category: 'setup',
          title: 'Build Day',
          event_date: date,
          start_time: '00:00',
          end_time: '23:59',
          end_date: date,
          location_id: null,
          notes: 'Build day (auto-added)',
          isSynthetic: true
        }))
      )
    }

    // Travel events
    if (Array.isArray(travelTrips.value)) {
      travelTrips.value.forEach(trip => {
        const start = new Date(trip.start_date)
        const end = new Date(trip.end_date)
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().slice(0, 10)
          synthetic.push({
            id: `travel_${trip.id}_${dateStr}`,
            category: 'travel',
            title: `Travel: ${trip.name}${trip.destination ? ' - ' + trip.destination : ''}`,
            event_date: dateStr,
            start_time: '00:00',
            end_time: '23:59',
            end_date: dateStr,
            location_id: null,
            notes: trip.description || 'Travel event (auto-added)',
            isSynthetic: true
          })
        }
      })
    }

    return synthetic
  })

  // Combine regular events with synthetic events
  const allEvents = computed(() => {
    return [...events.value, ...syntheticEvents.value]
  })

  // Create a new event
  async function createEvent(eventData) {
    if (!projectId.value) {
      toast.error("No project selected")
      return null
    }

    try {
      const eventPayload = {
        project_id: projectId.value,
        category: eventData.category,
        event_date: eventData.event_date,
        start_time: eventData.start_time,
        end_date: eventData.end_date || eventData.event_date,
        end_time: eventData.end_time,
        title: eventData.title,
        location_id: eventData.location_id,
        notes: eventData.notes,
        assigned_contacts: eventData.assigned_contacts || []
      }

      const { data, error: insertError } = await supabase
        .from("calendar_events")
        .insert([eventPayload])
        .select()
        .single()

      if (insertError) throw insertError

      // Add to local state
      events.value.push({
        id: data.id,
        ...eventPayload
      })

      toast.success("Event created successfully!")
      return data
    } catch (err) {
      console.error('Calendar event creation error:', err)
      toast.error("Failed to create event: " + err.message)
      return null
    }
  }

  // Update an existing event
  async function updateEvent(eventId, eventData) {
    if (!eventId) {
      toast.error("Missing event ID")
      return false
    }

    try {
      const { error: updateError } = await supabase
        .from("calendar_events")
        .update({
          category: eventData.category,
          event_date: eventData.event_date,
          start_time: eventData.start_time,
          end_date: eventData.end_date || eventData.event_date,
          end_time: eventData.end_time,
          title: eventData.title,
          location_id: eventData.location_id,
          notes: eventData.notes,
          assigned_contacts: eventData.assigned_contacts || []
        })
        .eq("id", eventId)

      if (updateError) throw updateError

      // Update local state
      const index = events.value.findIndex(e => e.id === eventId)
      if (index > -1) {
        events.value[index] = {
          ...events.value[index],
          ...eventData
        }
      }

      toast.success("Event updated successfully!")
      return true
    } catch (err) {
      console.error('Calendar event update error:', err)
      toast.error("Failed to update event: " + err.message)
      return false
    }
  }

  // Delete an event
  async function deleteEvent(eventId) {
    if (!eventId) {
      toast.error("Missing event ID")
      return false
    }

    try {
      const { error: deleteError } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", eventId)

      if (deleteError) throw deleteError

      // Remove from local state
      const index = events.value.findIndex(e => e.id === eventId)
      if (index > -1) {
        events.value.splice(index, 1)
      }

      toast.success("Event deleted successfully")
      return true
    } catch (err) {
      console.error('Calendar event deletion error:', err)
      toast.error("Failed to delete event: " + err.message)
      return false
    }
  }

  return {
    // State
    loading,
    error,
    events,
    travelTrips,
    
    // Computed
    syntheticEvents,
    allEvents,
    
    // Methods
    fetchEvents,
    fetchTravelTrips,
    createEvent,
    updateEvent,
    deleteEvent
  }
}

