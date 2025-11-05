<template>
  <!-- copied from components/signalmapper/NodeInspector.vue (consolidated under src/components) -->
  <div class="inspector-overlay" @click="emit('close')">
    <div class="inspector" @click.stop>
      <div class="inspector-header">
        <div class="title">
          <span class="badge">{{ type }}</span>
          <h3>{{ node.track_name || node.label }}</h3>
        </div>
        <button class="close-btn" @click="emit('close')">×</button>
      </div>
      <div class="meta">
        <span>{{ inputs }} in</span>
        <span>{{ outputs }} out</span>
        <span v-if="tracks">{{ tracks }} tracks</span>
      </div>

      <div class="tabs">
        <button :class="{ active: tab==='connections' }" @click="tab='connections'">Connections</button>
        <button v-if="type==='transformer'" :class="{ active: tab==='map' }" @click="tab='map'">Map</button>
        <button v-if="type==='venue_sources'" :class="{ active: tab==='feeds' }" @click="tab='feeds'">Feeds</button>
        <button v-if="type==='recorder'" :class="{ active: tab==='tracks' }" @click="tab='tracks'">Tracks</button>
      </div>

      <div class="panel" v-if="tab==='connections'">
        <h4>Upstream</h4>
        <ul class="list">
          <li v-for="u in upstream" :key="u.key">
            <span class="k">Input {{ u.input }}</span>
            <span class="arrow">←</span>
            <span class="v">{{ u.label }}</span>
          </li>
          <li v-if="!upstream.length" class="muted">No upstream connections</li>
        </ul>
        <h4>Downstream</h4>
        <ul class="list">
          <li v-for="d in downstream" :key="d.key">
            <span class="k">{{ d.kind }} {{ d.port }}</span>
            <span class="arrow">→</span>
            <span class="v">{{ d.toLabel }}</span>
          </li>
          <li v-if="!downstream.length" class="muted">No downstream connections</li>
        </ul>
      </div>

      <div class="panel" v-else-if="tab==='map'">
        <div v-if="type!=='transformer'" class="muted">Mapping is only for transformers</div>
        <div v-else>
          <div class="map-target">
            <label>Map to:</label>
            <select v-model="selectedToNodeId" class="select">
              <option v-for="t in downstreamTargets" :key="t.id" :value="t.id">{{ t.label }}</option>
            </select>
          </div>
          <div class="map-row" v-for="n in inputCount" :key="n">
            <div class="map-left">Input {{ n }}</div>
            <div class="map-mid">{{ inputLabels[n] || '—' }}</div>
            <div class="map-right">
              <select v-model.number="draftMappings[n]" class="select">
                <option :value="null">To Port</option>
                <option v-for="opt in toPortOptions" :key="opt" :value="opt">{{ opt }}</option>
              </select>
            </div>
          </div>
          <div class="actions">
            <button class="btn" @click="saveMappings" :disabled="saving">Save Mappings</button>
          </div>
        </div>
      </div>

      <div class="panel" v-else-if="tab==='feeds'">
        <div v-if="type!=='venue_sources'" class="muted">Feeds only apply to Venue Sources</div>
        <div v-else>
          <div class="feeds-toolbar">
            <button class="btn-secondary" @click="addFeed">Add Feed</button>
          </div>
          <div class="feed-row" v-for="row in feeds" :key="row.port">
            <div class="feed-left">Output {{ row.port }}</div>
            <input class="input" :placeholder="`Label for ${row.port}`" v-model="row.label" />
            <button class="btn-danger" @click="removeFeed(row.port)">Remove</button>
          </div>
          <div v-if="!feeds.length" class="muted">No feeds yet. Click "Add Feed" to create one.</div>
          <div class="actions">
            <button class="btn" @click="saveFeeds" :disabled="saving">Save Feeds</button>
          </div>
        </div>
      </div>

      <div class="panel" v-else-if="tab==='tracks'">
        <div v-if="type!=='recorder'" class="muted">Tracks only apply to Recorders</div>
        <ul v-else class="list">
          <li v-for="row in trackList" :key="row.key">
            <span class="k">Track {{ row.track }}</span>
            <span class="arrow">←</span>
            <span class="v">{{ row.source }}</span>
          </li>
          <li v-if="!trackList.length" class="muted">No tracks</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/supabase'
import { buildGraph } from '@/services/signalGraph'
import { hydrateVenueLabels, getOutputLabel, resolveTransformerInputLabel } from '@/services/portLabelService'
import { getCompleteSignalPath } from '@/services/signalMapperService'

const props = defineProps({
  projectId: { type: [String, Number], required: true },
  node: { type: Object, required: true },
  elements: { type: Array, default: () => [] },
  fromNode: { type: Object, default: null }
})
const emit = defineEmits(['close'])

const type = computed(() => (props.node.gear_type || props.node.node_type || props.node.type || '').toLowerCase())
const inputs = computed(() => props.node.num_inputs || props.node.inputs || 0)
const outputs = computed(() => props.node.num_outputs || props.node.outputs || 0)
const tracks = computed(() => props.node.num_tracks || props.node.tracks || props.node.num_records || props.node.numrecord || 0)
const tab = ref('connections')
const fromNodeRef = computed(() => props.fromNode)
const isIncomingMap = computed(() => !!fromNodeRef.value)

const graph = ref(null)
const upstream = ref([])
const downstream = ref([])
const inputLabels = ref({})
const inputCount = computed(() => inputs.value || 0)
const draftMappings = ref({})
const selectedToNodeId = ref(null)
const downstreamTargets = computed(() => {
  const ids = Array.from(new Set(downstream.value.map(d => d.toNodeId).filter(Boolean)))
  return ids.map(id => ({ id, label: getNodeLabel(id) }))
})
const toPortOptions = computed(() => {
  const n = props.elements.find(e => e.id === selectedToNodeId.value)
  if (!n) return []
  const isRecorder = ((n.gear_type || n.node_type || n.type || '').toLowerCase()) === 'recorder'
  const count = isRecorder
    ? (n.num_tracks || n.tracks || n.num_records || n.numrecord || n.num_inputs || n.inputs || 0)
    : (n.num_inputs || n.inputs || 0)
  return Array.from({ length: Math.max(0, count) }, (_, i) => i + 1)
})
const saving = ref(false)

// Venue sources feeds editor (independent from node.num_outputs)
const feeds = ref([]) // [{ port: number, label: string }]
const nextFeedPort = ref(1)
const trackList = ref([])

async function refresh() {
  graph.value = await buildGraph(props.projectId)
  if (type.value === 'venue_sources') {
    await hydrateVenueLabels(props.node)
  }
  await loadConnections()
  await loadLabels()
  if (type.value === 'recorder') {
    await loadTracks()
  }
  if (isIncomingMap.value) tab.value = 'map'
  if (type.value === 'venue_sources') await loadFeeds()
}

async function loadConnections() {
  upstream.value = []
  downstream.value = []
  const parents = (graph.value.parentsByToNode || {})[props.node.id] || []
  for (const p of parents) {
    const src = props.elements.find(e => e.id === p.from_node_id)
    const label = src ? (await getOutputLabel(src, p.input_number || 1, graph.value)) : 'Unknown'
    upstream.value.push({ key: p.id, input: p.input_number || 1, label })
  }
  const children = (graph.value.connections || []).filter(c => c.from_node_id === props.node.id)
  for (const c of children) {
    let maps = []
    try {
      const { data } = await supabase
        .from('connection_port_map')
        .select('from_port, to_port')
        .eq('connection_id', c.id)
      maps = data || []
    } catch {}
    if (maps.length) {
      maps.forEach(m => {
        downstream.value.push({ key: `${c.id}:${m.to_port}`, kind: 'Input', port: m.to_port, toLabel: getNodeLabel(c.to_node_id), toNodeId: c.to_node_id })
      })
    } else {
      downstream.value.push({ key: c.id, kind: 'Input', port: c.input_number || 1, toLabel: getNodeLabel(c.to_node_id), toNodeId: c.to_node_id })
    }
  }
  if (!selectedToNodeId.value && downstreamTargets.value.length) {
    selectedToNodeId.value = downstreamTargets.value[0].id
  }
}

function getNodeLabel(id) {
  const n = props.elements.find(e => e.id === id)
  return n?.track_name || n?.label || 'Unknown'
}

async function loadLabels() {
  inputLabels.value = {}
  if (type.value !== 'transformer') return
  const count = inputCount.value
  for (let i = 1; i <= count; i++) {
    const lbl = await resolveTransformerInputLabel(props.node, i, graph.value)
    inputLabels.value[i] = lbl
  }
}

async function saveMappings() {
  saving.value = true
  try {
    if (isIncomingMap.value) {
      const upstream = fromNodeRef.value
      const upstreamType = (upstream.gear_type || upstream.node_type || upstream.type || '').toLowerCase()
      const toNodeId = props.node.id
      const upstreamOutputs = upstream.num_outputs || upstream.outputs || 0
      if (upstreamType === 'source' || upstreamType === 'venue_sources') {
        if (upstreamOutputs <= 1) {
          const chosen = draftMappings.value[1] || draftMappings.value['1']
          if (!chosen) return
          await supabase.from('connections').insert([{ project_id: props.projectId, from_node_id: upstream.id, to_node_id: toNodeId, input_number: Number(chosen) }])
          await refresh()
          return
        }
      }
      let parentId
      const { data: existing } = await supabase
        .from('connections')
        .select('id')
        .eq('project_id', props.projectId)
        .eq('from_node_id', upstream.id)
        .eq('to_node_id', toNodeId)
        .maybeSingle()
      if (existing) parentId = existing.id
      else {
        const { data: saved } = await supabase
          .from('connections')
          .insert([{ project_id: props.projectId, from_node_id: upstream.id, to_node_id: toNodeId }])
          .select()
          .single()
        parentId = saved.id
      }
      await supabase.from('connection_port_map').delete().eq('connection_id', parentId)
      const inserts = Object.entries(draftMappings.value)
        .filter(([from, to]) => Number(to) > 0)
        .map(([from, to]) => ({ project_id: props.projectId, connection_id: parentId, from_port: Number(from), to_port: Number(to) }))
      if (inserts.length) {
        await supabase.from('connection_port_map').insert(inserts)
      }
      await refresh()
    } else {
      const toNodeId = selectedToNodeId.value
      if (!toNodeId) return
      let parentId
      const { data: existing } = await supabase
        .from('connections')
        .select('id')
        .eq('project_id', props.projectId)
        .eq('from_node_id', props.node.id)
        .eq('to_node_id', toNodeId)
        .maybeSingle()
      if (existing) parentId = existing.id
      else {
        const { data: saved } = await supabase
          .from('connections')
          .insert([{ project_id: props.projectId, from_node_id: props.node.id, to_node_id: toNodeId }])
          .select()
          .single()
        parentId = saved.id
      }
      await supabase.from('connection_port_map').delete().eq('connection_id', parentId)
      const inserts = Object.entries(draftMappings.value)
        .filter(([from, to]) => Number(to) > 0)
        .map(([from, to]) => ({ project_id: props.projectId, connection_id: parentId, from_port: Number(from), to_port: Number(to) }))
      if (inserts.length) {
        await supabase.from('connection_port_map').insert(inserts)
      }
      await refresh()
    }
  } finally {
    saving.value = false
  }
}

async function saveFeeds() {
  saving.value = true
  try {
    console.log('[Inspector][Feeds] save:start', { node_id: props.node.id })
    const rows = feeds.value
      .map(f => ({ project_id: props.projectId, node_id: props.node.id, port_number: Number(f.port), output_port_label: (f.label || '').trim() }))
      .filter(r => r.output_port_label.length > 0)
    await supabase.from('venue_source_feeds').delete().eq('node_id', props.node.id)
    if (rows.length) await supabase.from('venue_source_feeds').insert(rows)
    // reflect count on node (optional)
    try { await supabase.from('nodes').update({ num_outputs: rows.length }).eq('id', props.node.id) } catch {}
    await hydrateVenueLabels(props.node)
    await refresh()
    console.log('[Inspector][Feeds] save:done', { count: rows.length })
  } finally {
    saving.value = false
  }
}

async function loadTracks() {
  console.log('[Inspector][Tracks] load:start', { project_id: props.projectId })
  const all = await getCompleteSignalPath(props.projectId)
  const here = all.filter(p => p.recorderId === props.node.id)
  trackList.value = here.map(p => ({ key: `${p.recorderId}:${p.track}`, track: p.track, source: p.sourceLabel }))
  console.log('[Inspector][Tracks] load:done', { count: trackList.value.length })
}

onMounted(async () => {
  console.log('[Inspector] open', { node_id: props.node.id, type: type.value })
  await refresh()
  console.log('[Inspector] ready')
})

async function loadFeeds() {
  try {
    const { data } = await supabase
      .from('venue_source_feeds')
      .select('port_number, output_port_label')
      .eq('node_id', props.node.id)
      .order('port_number')
    const list = (data || []).map(r => ({ port: Number(r.port_number), label: r.output_port_label || '' }))
    feeds.value = list
    const used = new Set(list.map(f => f.port))
    nextFeedPort.value = 1
    while (used.has(nextFeedPort.value)) nextFeedPort.value++
  } catch {}
}

function addFeed() {
  const port = nextFeedPort.value
  feeds.value.push({ port, label: '' })
  const used = new Set(feeds.value.map(f => f.port))
  nextFeedPort.value = 1
  while (used.has(nextFeedPort.value)) nextFeedPort.value++
}

function removeFeed(port) {
  feeds.value = feeds.value.filter(f => f.port !== port)
}
</script>

<style scoped>
.inspector-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1100; }
.inspector { background: var(--bg-primary, #111); color: var(--text-primary, #fff); width: 720px; max-width: 95vw; max-height: 85vh; overflow: auto; border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.35); }
.inspector-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 18px; border-bottom: 1px solid var(--border-color, #222); }
.title { display: flex; gap: 10px; align-items: center; }
.badge { background: var(--bg-elevated, #222); border: 1px solid var(--border-color, #333); padding: 2px 8px; border-radius: 999px; font-size: 12px; color: var(--text-secondary, #bbb); }
h3 { margin: 0; font-size: 18px; color: var(--text-primary, #fff); }
.close-btn { background: transparent; border: none; color: var(--text-secondary, #bbb); font-size: 22px; cursor: pointer; }
.meta { display: flex; gap: 12px; padding: 10px 18px; color: var(--text-secondary, #bbb); font-size: 12px; }
.tabs { display: flex; gap: 6px; padding: 0 18px 8px 18px; border-bottom: 1px solid var(--border-color, #222); }
.tabs button { background: var(--bg-elevated, #181818); color: var(--text-primary, #fff); border: 1px solid var(--border-color, #333); padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.tabs button.active { background: var(--bg-active, #2a2a2a); border-color: var(--border-strong, #555); }
.panel { padding: 14px 18px 18px; }
.list { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
.list li { display: flex; align-items: center; gap: 8px; background: var(--bg-elevated, #171717); border: 1px solid var(--border-color, #262626); border-radius: 6px; padding: 8px 10px; }
.muted { color: var(--text-secondary, #bbb); font-size: 12px; padding: 8px 0; }
.k { color: var(--text-secondary, #bbb); }
.v { color: var(--text-primary, #fff); font-weight: 600; }
.arrow { color: var(--accent, #4ea7ff); font-weight: 700; }
.map-row, .feed-row { display: grid; grid-template-columns: 100px 1fr 120px; gap: 8px; align-items: center; background: var(--bg-elevated, #171717); border: 1px solid var(--border-color, #262626); padding: 8px 10px; border-radius: 6px; margin-bottom: 6px; }
.map-left, .feed-left { color: var(--text-secondary, #bbb); }
.map-mid { color: var(--text-primary, #fff); font-weight: 600; }
.select, .input { background: var(--bg-input, #111); color: var(--text-primary, #fff); border: 1px solid var(--border-color, #333); border-radius: 6px; padding: 6px 8px; }
.actions { display: flex; justify-content: flex-end; margin-top: 8px; }
.btn { background: #16a34a; color: #fff; border: none; border-radius: 6px; padding: 8px 12px; cursor: pointer; }
.btn:disabled { background: #444; cursor: not-allowed; }
.feeds-toolbar { display: flex; justify-content: flex-end; margin-bottom: 8px; }
.btn-secondary { background: transparent; color: var(--accent, #4ea7ff); border: 1px solid var(--accent, #4ea7ff); border-radius: 6px; padding: 6px 10px; cursor: pointer; }
.btn-danger { background: #b91c1c; color: #fff; border: none; border-radius: 6px; padding: 6px 8px; cursor: pointer; }

/* Light theme fallbacks */
@media (prefers-color-scheme: light) {
  .inspector { background: var(--bg-primary, #fff); color: var(--text-primary, #111); }
  .badge { background: var(--bg-elevated, #f7f7f7); border-color: var(--border-color, #e5e7eb); color: var(--text-secondary, #666); }
  .close-btn { color: var(--text-secondary, #666); }
  .meta { color: var(--text-secondary, #666); }
  .tabs { border-color: var(--border-color, #e5e7eb); }
  .tabs button { background: var(--bg-elevated, #f7f7f7); color: var(--text-primary, #111); border-color: var(--border-color, #e5e7eb); }
  .tabs button.active { background: var(--bg-active, #e5e7eb); border-color: var(--border-strong, #cbd5e1); }
  .list li, .map-row, .feed-row { background: var(--bg-elevated, #f9fafb); border-color: var(--border-color, #e5e7eb); }
  .k, .muted { color: var(--text-secondary, #666); }
  .v { color: var(--text-primary, #111); }
  .select, .input { background: var(--bg-input, #fff); color: var(--text-primary, #111); border-color: var(--border-color, #e5e7eb); }
}
</style>


