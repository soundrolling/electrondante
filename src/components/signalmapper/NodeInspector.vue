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
      <button :class="{ active: tab==='map' }" @click="tab='map'">Map</button>
      <button v-if="type==='recorder'" :class="{ active: tab==='tracks' }" @click="tab='tracks'">Tracks</button>
    </div>

      <div class="panel" v-if="tab==='map'">
        <!-- Venue Sources: Show feeds in Map tab -->
        <div v-if="type==='venue_sources'">
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
        <!-- Other nodes: Show editable connections -->
        <div v-else>
          <div class="map-unified">
            <!-- Upstream (Inputs) Section -->
            <div class="map-section">
              <h4>Inputs</h4>
              <div class="map-inputs">
                <div v-for="n in inputCount" :key="`in-${n}`" class="map-io-row">
                  <div class="map-io-label">Input {{ n }}</div>
                  <select v-model="upstreamMap[n]" class="select" @change="onUpstreamChange(n)">
                    <option :value="null">— Select source —</option>
                    <option v-for="src in availableUpstreamSources" :key="src.feedKey" :value="src.feedKey">{{ src.label }}</option>
                  </select>
                  <div v-if="upstreamMap[n]" class="map-io-display">{{ getUpstreamLabel(n) }}</div>
                  <button v-if="upstreamMap[n]" class="btn-danger-small" @click="clearUpstreamConnection(n)">Clear</button>
                </div>
                <div v-if="!inputCount" class="muted">No inputs</div>
              </div>
            </div>

            <!-- Current Node (Center) -->
            <div class="map-center">
              <div class="map-node-badge">{{ type }}</div>
              <div class="map-node-name">{{ node.track_name || node.label }}</div>
              <div class="map-node-hint" style="margin-top: 8px; font-size: 11px; color: var(--text-muted); text-align: center;">
                To route outputs, configure the receiving node's inputs
              </div>
            </div>
          </div>
          <div class="actions">
            <button class="btn" @click="saveMap" :disabled="saving">Save Map</button>
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
import { useToast } from 'vue-toastification'
import { supabase } from '@/supabase'
import { buildGraph } from '@/services/signalGraph'
import { hydrateVenueLabels, getOutputLabel, resolveTransformerInputLabel } from '@/services/portLabelService'
import { getCompleteSignalPath } from '@/services/signalMapperService'

const toast = useToast()

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
const tab = ref('map')
const fromNodeRef = computed(() => props.fromNode)
const isIncomingMap = computed(() => !!fromNodeRef.value)

const graph = ref(null)
const upstream = ref([])
const downstream = ref([])
const inputLabels = ref({})
const inputCount = computed(() => inputs.value || 0)
const outputCount = computed(() => outputs.value || 0)

// Unified map state
const upstreamMap = ref({}) // { inputNum: sourceNodeId }
const downstreamMap = ref({}) // { outputNum: targetNodeId }
const downstreamPortMap = ref({}) // { outputNum: targetPortNum }
const upstreamConnections = ref({}) // { inputNum: connectionId }
const downstreamConnections = ref({}) // { outputNum: connectionId }

const availableUpstreamSources = ref([]) // [{ id: nodeId, port: portNum (for venue), label: string, feedKey: 'nodeId:port' }]

async function loadAvailableUpstreamSources() {
  if (!graph.value) {
    availableUpstreamSources.value = []
    return
  }
  // Only show nodes that are actually connected TO this node's inputs (upstream sources)
  const parents = (graph.value.parentsByToNode || {})[props.node.id] || []
  const connectedIds = new Set(parents.map(p => p.from_node_id).filter(Boolean))
  const sources = []
  
  for (const e of props.elements) {
    if (e.id === props.node.id) continue
    if (!connectedIds.has(e.id)) continue // Only nodes that have connections TO this node
    const eType = (e.gear_type || e.node_type || e.type || '').toLowerCase()
    
    // Only show actual sources (gear sources and venue sources) - not transformers or recorders
    if (eType === 'venue_sources') {
      // Expand venue_sources into individual feeds
      try {
        const { data: feeds } = await supabase
          .from('venue_source_feeds')
          .select('port_number, output_port_label')
          .eq('node_id', e.id)
          .order('port_number')
        if (feeds && feeds.length) {
          for (const feed of feeds) {
            sources.push({
              id: e.id,
              port: feed.port_number,
              label: feed.output_port_label || `Output ${feed.port_number}`,
              feedKey: `${e.id}:${feed.port_number}`
            })
          }
        } else {
          // Fallback: use output_port_labels if feeds table is empty
          const labels = e.output_port_labels || {}
          const numOutputs = e.num_outputs || 0
          for (let port = 1; port <= numOutputs; port++) {
            const label = labels[port] || `Output ${port}`
            sources.push({
              id: e.id,
              port,
              label,
              feedKey: `${e.id}:${port}`
            })
          }
          if (numOutputs === 0) {
            // No feeds found, show node as single option
            sources.push({
              id: e.id,
              port: null,
              label: e.track_name || e.label || 'Venue Sources',
              feedKey: e.id
            })
          }
        }
      } catch (err) {
        console.error('[Inspector] failed to load venue feeds', err)
        sources.push({
          id: e.id,
          port: null,
          label: e.track_name || e.label || 'Venue Sources',
          feedKey: e.id
        })
      }
    } else if (eType === 'source') {
      // Only show gear sources, not transformers or recorders
      sources.push({
        id: e.id,
        port: null,
        label: e.track_name || e.label,
        feedKey: e.id
      })
    }
    // Explicitly exclude transformers and recorders from upstream sources
  }
  
  availableUpstreamSources.value = sources
}

const availableDownstreamTargets = computed(() => {
  if (!graph.value) return []
  // Only show nodes that are actually connected from this node's outputs
  const children = (graph.value.connections || []).filter(c => c.from_node_id === props.node.id)
  const connectedIds = new Set(children.map(c => c.to_node_id).filter(Boolean))
  return props.elements.filter(e => {
    if (e.id === props.node.id) return false
    if (!connectedIds.has(e.id)) return false
    const eType = (e.gear_type || e.node_type || e.type || '').toLowerCase()
    return (eType === 'transformer' || eType === 'recorder')
  }).map(e => ({ id: e.id, label: e.track_name || e.label }))
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
  await loadAvailableUpstreamSources()
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
  upstreamMap.value = {}
  downstreamMap.value = {}
  downstreamPortMap.value = {}
  upstreamConnections.value = {}
  downstreamConnections.value = {}
  
  // Load upstream connections
  const parents = (graph.value.parentsByToNode || {})[props.node.id] || []
  for (const p of parents) {
    const inputNum = p.input_number || 1
    upstreamConnections.value[inputNum] = p.id
    
    // Check for port map to get specific feed port
    let feedPort = null
    try {
      const { data: portMap } = await supabase
        .from('connection_port_map')
        .select('from_port')
        .eq('connection_id', p.id)
        .maybeSingle()
      if (portMap) feedPort = portMap.from_port
    } catch {}
    
    // Build feedKey: if venue source with port map, use nodeId:port; otherwise just nodeId
    const src = props.elements.find(e => e.id === p.from_node_id)
    const srcType = src ? (src.gear_type || src.node_type || src.type || '').toLowerCase() : ''
    const feedKey = (srcType === 'venue_sources' && feedPort) ? `${p.from_node_id}:${feedPort}` : p.from_node_id
    
    upstreamMap.value[inputNum] = feedKey
    const label = src ? (await getOutputLabel(src, feedPort || inputNum, graph.value)) : 'Unknown'
    upstream.value.push({ key: p.id, input: inputNum, label })
  }
  
  // Load downstream connections
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
        const outPort = m.from_port
        downstreamMap.value[outPort] = c.to_node_id
        downstreamPortMap.value[outPort] = m.to_port
        downstreamConnections.value[outPort] = c.id
        downstream.value.push({ key: `${c.id}:${m.to_port}`, kind: 'Input', port: m.to_port, toLabel: getNodeLabel(c.to_node_id), toNodeId: c.to_node_id })
      })
    } else {
      const outPort = 1 // For non-port-mapped, assume output 1
      downstreamMap.value[outPort] = c.to_node_id
      downstreamPortMap.value[outPort] = c.input_number || 1
      downstreamConnections.value[outPort] = c.id
      downstream.value.push({ key: c.id, kind: 'Input', port: c.input_number || 1, toLabel: getNodeLabel(c.to_node_id), toNodeId: c.to_node_id })
    }
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
      .map((f, idx) => {
        const label = (f.label || '').trim()
        if (!label) return null
        // Extract source type and identifier from label
        // For gear sources (any label that doesn't match standard patterns), use "gear" as type
        let sourceType = 'gear'
        let feedIdentifier = String(f.port)
        const m = label.match(/^([A-Z]+)\s+([A-Z0-9]+)/i)
        if (m) {
          const type = m[1].toLowerCase()
          if (['dj', 'program', 'handheld'].includes(type)) {
            sourceType = type === 'handheld' ? 'handheld_mic' : type
            feedIdentifier = m[2]
          } else {
            // Gear source - use first word or full label as identifier
            sourceType = 'gear'
            feedIdentifier = m[2] || label.substring(0, 10).replace(/\s/g, '_')
          }
        } else {
          // No pattern match - assume gear source, use label as identifier (truncated)
          sourceType = 'gear'
          feedIdentifier = label.substring(0, 10).replace(/\s/g, '_') || String(f.port)
        }
        return {
          project_id: props.projectId,
          node_id: props.node.id,
          source_type: sourceType,
          feed_identifier: feedIdentifier,
          port_number: Number(f.port),
          channel: 1,
          numbering_style: 'numbers',
          output_port_label: label
        }
      })
      .filter(r => r !== null && r.output_port_label && r.output_port_label.length > 0)
    
    // Delete existing feeds
    const { error: deleteError } = await supabase.from('venue_source_feeds').delete().eq('node_id', props.node.id)
    if (deleteError) throw deleteError
    
    // Insert new feeds
    if (rows.length) {
      const { error: insertError } = await supabase.from('venue_source_feeds').insert(rows)
      if (insertError) throw insertError
    }
    
    // Update node num_outputs (optional, don't fail if it errors)
    try { 
      await supabase.from('nodes').update({ num_outputs: rows.length }).eq('id', props.node.id) 
    } catch (err) {
      console.warn('[Inspector][Feeds] failed to update num_outputs', err)
    }
    
    await hydrateVenueLabels(props.node)
    await refresh()
    console.log('[Inspector][Feeds] save:done', { count: rows.length })
    
    toast.success(`Saved ${rows.length} feed(s)`)
  } catch (err) {
    console.error('[Inspector][Feeds] save failed', err)
    toast.error('Failed to save feeds: ' + (err.message || 'Unknown error'))
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
    // Auto-generate feeds from connected gear source nodes
    await autoGenerateFeedsFromGearSources()
  } catch {}
}

async function autoGenerateFeedsFromGearSources() {
  try {
    if (!graph.value) return
    // Find all gear source nodes connected to this venue_sources node
    const parents = (graph.value?.parentsByToNode || {})[props.node.id] || []
    const gearSources = []
    for (const p of parents) {
      const src = props.elements.find(e => e.id === p.from_node_id)
      if (src && (src.gear_type || src.node_type || src.type) === 'source' && src.gear_id) {
        gearSources.push({ conn: p, node: src })
      }
    }
    if (!gearSources.length) return
    // For each gear source, create/update a feed if not already present
    for (const { conn, node } of gearSources) {
      const port = conn.input_number || 1
      const existing = feeds.value.find(f => f.port === port)
      if (!existing) {
        const gearName = node.label || node.track_name || 'Gear Source'
        feeds.value.push({ port, label: gearName })
        const used = new Set(feeds.value.map(f => f.port))
        nextFeedPort.value = 1
        while (used.has(nextFeedPort.value)) nextFeedPort.value++
      } else if (!existing.label) {
        // Update existing feed with gear name if label is empty
        const gearName = node.label || node.track_name || 'Gear Source'
        existing.label = gearName
      }
    }
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

// Unified map functions
function getUpstreamLabel(inputNum) {
  const feedKey = upstreamMap.value[inputNum]
  if (!feedKey) return '—'
  // Find matching source in availableUpstreamSources
  const src = availableUpstreamSources.value.find(s => s.feedKey === feedKey)
  return src ? src.label : 'Unknown'
}

function onUpstreamChange(inputNum) {
  // Will be handled in saveMap
}

function onDownstreamChange(outputNum) {
  // Clear port mapping when target changes
  downstreamPortMap.value[outputNum] = null
}

function getDownstreamPortOptions(targetNodeId) {
  if (!targetNodeId) return []
  const n = props.elements.find(e => e.id === targetNodeId)
  if (!n) return []
  const isRecorder = ((n.gear_type || n.node_type || n.type || '').toLowerCase()) === 'recorder'
  const count = isRecorder
    ? (n.num_tracks || n.tracks || n.num_records || n.numrecord || n.num_inputs || n.inputs || 0)
    : (n.num_inputs || n.inputs || 0)
  return Array.from({ length: Math.max(0, count) }, (_, i) => i + 1)
}

function clearUpstreamConnection(inputNum) {
  upstreamMap.value[inputNum] = null
  delete upstreamConnections.value[inputNum]
}

function clearDownstreamConnection(outputNum) {
  downstreamMap.value[outputNum] = null
  downstreamPortMap.value[outputNum] = null
  delete downstreamConnections.value[outputNum]
}

async function saveMap() {
  saving.value = true
  try {
    console.log('[Inspector][Map] save:start', { node_id: props.node.id })
    
    let savedCount = 0
    let errorCount = 0
    
    // Save upstream connections
    for (const inputNum in upstreamMap.value) {
      const feedKey = upstreamMap.value[inputNum] // Can be nodeId or nodeId:port
      const existingConnId = upstreamConnections.value[inputNum]
      
      try {
        if (feedKey) {
          // Parse feedKey: nodeId:port or just nodeId
          const parts = feedKey.toString().split(':')
          const nodeId = parts[0]
          const feedPort = parts.length > 1 ? Number(parts[1]) : null
          
          if (existingConnId) {
            // Update existing connection if source changed
            const { data: existing, error: fetchError } = await supabase
              .from('connections')
              .select('from_node_id')
              .eq('id', existingConnId)
              .single()
            
            if (fetchError) throw fetchError
            
            if (existing && existing.from_node_id !== nodeId) {
              const { error: updateError } = await supabase.from('connections').update({ from_node_id: nodeId }).eq('id', existingConnId)
              if (updateError) throw updateError
            }
            
            // Update port map if feed port is specified
            if (feedPort !== null) {
              const { error: deleteError } = await supabase.from('connection_port_map').delete().eq('connection_id', existingConnId)
              if (deleteError) throw deleteError
              
              const { error: insertError } = await supabase.from('connection_port_map').insert([{
                project_id: props.projectId,
                connection_id: existingConnId,
                from_port: feedPort,
                to_port: Number(inputNum)
              }])
              if (insertError) throw insertError
            } else {
              // Remove port map if no feed port
              const { error: deleteError } = await supabase.from('connection_port_map').delete().eq('connection_id', existingConnId)
              if (deleteError) throw deleteError
            }
            savedCount++
          } else {
            // Check if connection already exists (might not be in our cache)
            const { data: existingConn, error: checkError } = await supabase
              .from('connections')
              .select('id')
              .eq('project_id', props.projectId)
              .eq('from_node_id', nodeId)
              .eq('to_node_id', props.node.id)
              .eq('input_number', Number(inputNum))
              .maybeSingle()
            
            let connId = null
            
            if (existingConn) {
              // Use existing connection
              connId = existingConn.id
              upstreamConnections.value[inputNum] = connId
            } else {
              // Create new connection
              const { data: newConn, error: insertError } = await supabase
                .from('connections')
                .insert([{
                  project_id: props.projectId,
                  from_node_id: nodeId,
                  to_node_id: props.node.id,
                  input_number: Number(inputNum)
                }])
                .select()
                .single()
              
              if (insertError) {
                // If it's a duplicate key error, try to fetch the existing connection
                if (insertError.code === '23505') {
                  const { data: existing } = await supabase
                    .from('connections')
                    .select('id')
                    .eq('project_id', props.projectId)
                    .eq('from_node_id', nodeId)
                    .eq('to_node_id', props.node.id)
                    .eq('input_number', Number(inputNum))
                    .single()
                  if (existing) {
                    connId = existing.id
                    upstreamConnections.value[inputNum] = connId
                  } else {
                    throw insertError
                  }
                } else {
                  throw insertError
                }
              } else if (newConn) {
                connId = newConn.id
                upstreamConnections.value[inputNum] = connId
              }
            }
            
            // Create/update port map if feed port is specified
            if (connId) {
              if (feedPort !== null) {
                // Delete existing port map first
                await supabase.from('connection_port_map').delete().eq('connection_id', connId)
                // Insert new port map
                const { error: portMapError } = await supabase.from('connection_port_map').insert([{
                  project_id: props.projectId,
                  connection_id: connId,
                  from_port: feedPort,
                  to_port: Number(inputNum)
                }])
                if (portMapError) throw portMapError
              } else {
                // Remove port map if no feed port
                await supabase.from('connection_port_map').delete().eq('connection_id', connId)
              }
              savedCount++
            }
          }
        } else if (existingConnId) {
          // Remove connection if source cleared
          const { error: portMapError } = await supabase.from('connection_port_map').delete().eq('connection_id', existingConnId)
          if (portMapError) throw portMapError
          
          const { error: deleteError } = await supabase.from('connections').delete().eq('id', existingConnId)
          if (deleteError) throw deleteError
          
          delete upstreamConnections.value[inputNum]
          savedCount++
        }
      } catch (err) {
        console.error('[Inspector][Map] error saving upstream connection', inputNum, err)
        errorCount++
      }
    }
    
    // Note: Downstream connections are managed by configuring the receiving node's inputs
    // No need to save them from this node
    
    await refresh()
    console.log('[Inspector][Map] save:done', { savedCount, errorCount })
    
    if (errorCount > 0) {
      toast.error(`Failed to save ${errorCount} input connection(s)`)
    } else if (savedCount > 0) {
      toast.success(`Saved ${savedCount} input mapping(s)`)
    } else {
      toast.info('No changes to save')
    }
  } catch (err) {
    console.error('[Inspector][Map] save failed', err)
    toast.error('Failed to save map: ' + (err.message || 'Unknown error'))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.inspector-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1100; }
.inspector { background: var(--bg-primary); color: var(--text-primary); width: 720px; max-width: 95vw; max-height: 85vh; overflow: auto; border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.35); }
.inspector-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 18px; border-bottom: 1px solid var(--border-separator); }
.title { display: flex; gap: 10px; align-items: center; }
.badge { background: var(--bg-elevated); border: 1px solid var(--border-medium); padding: 2px 8px; border-radius: 999px; font-size: 12px; color: var(--text-secondary); }
h3 { margin: 0; font-size: 18px; color: var(--text-primary); }
.close-btn { background: transparent; border: none; color: var(--text-secondary); font-size: 22px; cursor: pointer; }
.meta { display: flex; gap: 12px; padding: 10px 18px; color: var(--text-secondary); font-size: 12px; }
.tabs { display: flex; gap: 6px; padding: 0 18px 8px 18px; border-bottom: 1px solid var(--border-separator); }
.tabs button { background: var(--bg-elevated); color: var(--text-primary); border: 1px solid var(--border-medium); padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.tabs button.active { background: var(--bg-secondary); border-color: var(--border-dark); }
.panel { padding: 14px 18px 18px; }
.list { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
.list li { display: flex; align-items: center; gap: 8px; background: var(--bg-elevated); border: 1px solid var(--border-separator); border-radius: 6px; padding: 8px 10px; }
.muted { color: var(--text-muted); font-size: 12px; padding: 8px 0; }
.k { color: var(--text-secondary); }
.v { color: var(--text-primary); font-weight: 600; }
.arrow { color: var(--text-link); font-weight: 700; }
.map-unified { display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: start; }
.map-section { display: flex; flex-direction: column; }
.map-section h4 { margin: 0 0 12px 0; color: var(--text-primary); font-size: 14px; }
.map-inputs, .map-outputs { display: flex; flex-direction: column; gap: 8px; }
.map-io-row { display: flex; flex-direction: column; gap: 4px; background: var(--bg-elevated); border: 1px solid var(--border-separator); padding: 8px 10px; border-radius: 6px; position: relative; }
.map-io-label { color: var(--text-secondary); font-size: 12px; font-weight: 600; }
.map-io-display { color: var(--text-primary); font-size: 12px; margin-top: 4px; flex: 1; }
.btn-danger-small { background: var(--btn-danger-bg); color: var(--btn-danger-text); border: 1px solid var(--btn-danger-border); border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 11px; margin-top: 4px; }
.btn-danger-small:hover { background: var(--btn-danger-hover-bg); border-color: var(--btn-danger-hover-border); }
.map-center { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; background: var(--bg-elevated); border: 2px solid var(--border-dark); border-radius: 8px; min-width: 150px; }
.map-node-badge { background: var(--bg-primary); border: 1px solid var(--border-medium); padding: 4px 12px; border-radius: 999px; font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; }
.map-node-name { color: var(--text-primary); font-weight: 600; font-size: 14px; text-align: center; }
.map-row, .feed-row { display: grid; grid-template-columns: 100px 1fr 120px; gap: 8px; align-items: center; background: var(--bg-elevated); border: 1px solid var(--border-separator); padding: 8px 10px; border-radius: 6px; margin-bottom: 6px; }
.map-left, .feed-left { color: var(--text-secondary); }
.map-mid { color: var(--text-primary); font-weight: 600; }
.select, .input { background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-medium); border-radius: 6px; padding: 6px 8px; }
.actions { display: flex; justify-content: flex-end; margin-top: 8px; }
.btn { background: var(--btn-positive-bg); color: var(--btn-positive-text); border: 1px solid var(--btn-positive-border); border-radius: 6px; padding: 8px 12px; cursor: pointer; }
.btn:hover { background: var(--btn-positive-hover-bg); border-color: var(--btn-positive-hover-border); }
.btn:disabled { background: var(--bg-tertiary); color: var(--text-tertiary); cursor: not-allowed; }
.feeds-toolbar { display: flex; justify-content: flex-end; margin-bottom: 8px; }
.btn-secondary { background: transparent; color: var(--text-link); border: 1px solid var(--text-link); border-radius: 6px; padding: 6px 10px; cursor: pointer; }
.btn-danger { background: var(--btn-danger-bg); color: var(--btn-danger-text); border: 1px solid var(--btn-danger-border); border-radius: 6px; padding: 6px 8px; cursor: pointer; }
.btn-danger:hover { background: var(--btn-danger-hover-bg); border-color: var(--btn-danger-hover-border); }
</style>


