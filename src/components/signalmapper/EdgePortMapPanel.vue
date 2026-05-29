<!--
  Per-feed → input mapping for a single connection, shown in the Signal Flow
  edge inspector. For a multi-feed source (venue source, or any multi-output
  node) feeding a stagebox/recorder, it lists every feed (incl. stereo L and R
  as separate rows) and lets you assign each to a destination input. Writes the
  same connection_port_map rows the node Map tab uses.
-->
<template>
  <div v-if="feeds.length && inputCount" class="epm">
    <label class="epm-title">Feeds → {{ targetLabel }} inputs</label>
    <div v-for="f in feeds" :key="f.port" class="epm-row">
      <span class="epm-feed" :title="f.label">{{ f.label }}</span>
      <select class="epm-select" :value="maps[f.port] || 0" @change="onChange(f.port, $event.target.value)">
        <option :value="0">— none —</option>
        <option v-for="i in inputCount" :key="i" :value="i" :disabled="isInputTaken(i, f.port)">
          Input {{ i }}
        </option>
      </select>
    </div>
    <p class="epm-hint">{{ assignedCount }}/{{ feeds.length }} feeds mapped<span v-if="saving"> · saving…</span></p>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { supabase } from '@/supabase'
import { getConnectionPortMaps, saveConnectionPortMaps } from '@/services/signalMapperService'

const props = defineProps({
  connection: { type: Object, required: true }, // raw connection row { id, project_id, ... }
  sourceNode: { type: Object, default: null },
  targetNode: { type: Object, default: null },
  projectId: { type: [String, Number], default: null },
})
const emit = defineEmits(['changed'])

const feeds = ref([])  // [{ port, label }]
const maps = ref({})   // { fromPort: toPort }
const saving = ref(false)

const targetLabel = computed(() => props.targetNode?.label || props.targetNode?.track_name || 'destination')
const inputCount = computed(() =>
  Number(props.targetNode?.num_inputs || props.targetNode?.inputs || props.targetNode?.num_tracks || 0),
)
const assignedCount = computed(() => Object.values(maps.value).filter(v => Number(v) > 0).length)

function isInputTaken(i, exceptPort) {
  return Object.entries(maps.value).some(
    ([p, to]) => Number(p) !== Number(exceptPort) && Number(to) === Number(i),
  )
}

async function load() {
  feeds.value = []
  maps.value = {}
  const src = props.sourceNode
  if (!src || !props.connection?.id) return
  const srcType = (src.gear_type || src.node_type || src.type || '').toLowerCase()

  if (srcType === 'venue_sources') {
    const { data } = await supabase
      .from('venue_source_feeds')
      .select('port_number, output_port_label')
      .eq('node_id', src.id)
      .order('port_number')
    feeds.value = (data || []).map(r => ({
      port: Number(r.port_number),
      label: r.output_port_label || `Output ${r.port_number}`,
    }))
  } else {
    const n = Number(src.num_outputs || src.outputs || 0)
    const labels = src.output_port_labels || {}
    feeds.value = Array.from({ length: n }, (_, i) => ({
      port: i + 1,
      label: labels[i + 1] || labels[String(i + 1)] || `Output ${i + 1}`,
    }))
  }

  const existing = await getConnectionPortMaps(props.connection.id)
  const m = {}
  for (const row of existing) m[Number(row.from_port)] = Number(row.to_port)
  maps.value = m
}

async function onChange(fromPort, value) {
  const to = Number(value) || 0
  const next = { ...maps.value }
  if (to > 0) next[fromPort] = to
  else delete next[fromPort]
  maps.value = next
  saving.value = true
  try {
    const entries = Object.entries(maps.value).map(([from, t]) => ({ from_port: Number(from), to_port: Number(t) }))
    await saveConnectionPortMaps(props.projectId || props.connection.project_id, props.connection.id, entries)
    emit('changed')
  } finally {
    saving.value = false
  }
}

watch(() => props.connection?.id, load, { immediate: true })
</script>

<style scoped>
.epm { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-light); display: flex; flex-direction: column; gap: 6px; }
.epm-title { font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
.epm-row { display: flex; align-items: center; gap: 8px; }
.epm-feed { flex: 1; min-width: 0; font-size: 13px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.epm-select {
  flex: 0 0 110px; padding: 5px 8px; font-size: 12px;
  border: 1px solid var(--surface-border); border-radius: var(--radius-md);
  background: var(--surface-card); color: var(--text-primary);
}
.epm-hint { font-size: 11px; color: var(--text-tertiary); margin: 2px 0 0 0; }
</style>
