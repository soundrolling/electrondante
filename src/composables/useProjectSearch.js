import { ref, computed, shallowRef } from 'vue';
import { supabase } from '../supabase';

// Map a search_index row to a route + label hint the UI can navigate to.
// Falls back to the project detail page if a kind isn't mapped.
export function routeForResult(projectId, row) {
  const m = row?.metadata || {};
  const t = row?.source_table;
  switch (t) {
    case 'projects':
      return { path: `/projects/${projectId}` };
    case 'notes':
      return {
        path: `/projects/${projectId}/notes`,
        query: m.location_id ? { locationId: m.location_id } : {},
      };
    case 'project_contacts':
      return { path: `/projects/${projectId}/contacts` };
    case 'locations':
      return { path: `/projects/${projectId}/locations` };
    case 'venues':
      return { path: `/projects/${projectId}/locations` };
    case 'schedules':
      return {
        path: `/projects/${projectId}/schedule`,
        query: m.location_id ? { locationId: m.location_id } : {},
      };
    case 'calendar_events':
      return { path: `/projects/${projectId}/calendar` };
    case 'stage_docs':
      return { path: `/projects/${projectId}/stage-docs` };
    case 'project_docs':
      return { path: `/projects/${projectId}/docs` };
    case 'travel_trips':
      return { path: `/projects/${projectId}/travel-dashboard` };
    case 'travel_accommodations':
      return m.trip_id
        ? { path: `/projects/${projectId}/accommodations/${m.trip_id}` }
        : { path: `/projects/${projectId}/travel-dashboard` };
    case 'travel_documents':
      return m.trip_id
        ? { path: `/projects/${projectId}/documents/${m.trip_id}` }
        : { path: `/projects/${projectId}/travel-dashboard` };
    case 'travel_flights':
      return m.trip_id
        ? { path: `/projects/${projectId}/flightdetails/${m.trip_id}` }
        : { path: `/projects/${projectId}/travel-dashboard` };
    case 'gear_table':
      return {
        path: `/projects/${projectId}/gear`,
        query: m.location_id ? { locationId: m.location_id } : {},
      };
    default:
      return { path: `/projects/${projectId}` };
  }
}

const LABELS = {
  projects: 'Project',
  notes: 'Note',
  project_contacts: 'Contact',
  locations: 'Stage',
  venues: 'Venue',
  schedules: 'Schedule',
  calendar_events: 'Event',
  stage_docs: 'Stage doc',
  project_docs: 'Document',
  travel_trips: 'Trip',
  travel_accommodations: 'Accommodation',
  travel_documents: 'Travel doc',
  travel_flights: 'Flight',
  gear_table: 'Gear',
};

export function labelForResult(row) {
  return LABELS[row?.source_table] || row?.source_table || '';
}

export function useProjectSearch(projectIdRef) {
  // The query is the *submitted* question — what Haiku saw and answered.
  // Free-typing in the input is component-local state, kept out of this composable.
  const query = ref('');
  const results = shallowRef([]);
  const answer = ref(null);
  const loading = ref(false);
  const error = ref(null);

  let token = 0;

  async function submit(q) {
    const trimmed = (q ?? '').trim();
    if (trimmed.length < 2) return;
    const myToken = ++token;
    const projectId = typeof projectIdRef === 'function' ? projectIdRef() : projectIdRef?.value;
    if (!projectId) return;

    query.value = trimmed;
    loading.value = true;
    error.value = null;
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('search', {
        body: { projectId, query: trimmed, limit: 20 },
      });
      if (myToken !== token) return;
      if (fnErr) throw fnErr;
      results.value = (data?.results || []);
      answer.value = data?.answer || null;
    } catch (e) {
      if (myToken !== token) return;
      error.value = e?.message || String(e);
      results.value = [];
      answer.value = null;
    } finally {
      if (myToken === token) loading.value = false;
    }
  }

  function reset() {
    token++;
    query.value = '';
    results.value = [];
    answer.value = null;
    loading.value = false;
    error.value = null;
  }

  async function rebuildIndex() {
    const projectId = typeof projectIdRef === 'function' ? projectIdRef() : projectIdRef?.value;
    if (!projectId) return null;
    const { data, error: fnErr } = await supabase.functions.invoke('embed-index', {
      body: { projectId, limit: 500 },
    });
    if (fnErr) throw fnErr;
    return data;
  }

  return {
    query,
    results: computed(() => results.value),
    answer,
    loading,
    error,
    submit,
    reset,
    rebuildIndex,
  };
}
