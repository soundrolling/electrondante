<template>
  <div class="gear-library">
    <!-- Top stats / status summary -->
    <div v-if="showStats" class="library-stats">
      <div class="stat">
        <span class="stat-num">{{ stats.total }}</span>
        <span class="stat-lbl">Items</span>
      </div>
      <div class="stat">
        <span class="stat-num">{{ stats.totalQuantity }}</span>
        <span class="stat-lbl">Units owned</span>
      </div>
      <div class="stat">
        <span class="stat-num">{{ stats.inUse }}</span>
        <span class="stat-lbl">In use today</span>
      </div>
      <div class="stat" :class="{ 'stat-danger': stats.conflicts > 0 }">
        <span class="stat-num">{{ stats.conflicts }}</span>
        <span class="stat-lbl">Conflicts</span>
      </div>
    </div>

    <!-- Controls -->
    <div class="library-controls">
      <div class="search-wrap">
        <span class="search-ico">🔍</span>
        <input
          v-model="search"
          type="search"
          class="search-field"
          placeholder="Search by name, type, owner, or notes…"
        />
      </div>
      <select v-model="statusFilter" class="filter-pick">
        <option value="all">All statuses</option>
        <option value="available">Available</option>
        <option value="in_use">In use</option>
        <option value="reserved">Reserved</option>
        <option value="conflict">Conflicts only</option>
        <option value="maintenance">Maintenance</option>
        <option v-if="mode === 'manage' && (showArchived || archivedCount > 0)" value="archived">Archived</option>
      </select>
      <select v-model="typeFilter" class="filter-pick">
        <option value="all">All types</option>
        <option v-for="t in availableTypes" :key="t" :value="t">{{ typeLabel(t) }}</option>
      </select>
      <select v-if="showOwnerFilter" v-model="ownerFilter" class="filter-pick">
        <option value="all">All owners</option>
        <option v-for="o in availableOwners" :key="o.user_id" :value="o.user_id">{{ o.name }}</option>
      </select>
      <select
        v-if="mode === 'manage' && (heldForNames.length || heldForFilter !== 'all')"
        v-model="heldForFilter"
        class="filter-pick"
        title="Filter by whether the gear is yours or you're holding it for someone"
      >
        <option value="all">Mine + held</option>
        <option value="mine">Mine only</option>
        <option value="others">Held for others</option>
        <option v-for="name in heldForNames" :key="name" :value="`name:${name}`">Held for {{ name }}</option>
      </select>
      <label
        v-if="mode === 'manage' && archivedCount > 0"
        class="show-archived"
        :title="`${archivedCount} archived item${archivedCount === 1 ? '' : 's'} hidden from the active library`"
      >
        <input type="checkbox" v-model="showArchived" />
        <span>Show archived ({{ archivedCount }})</span>
      </label>
      <button
        v-if="mode === 'manage'"
        type="button"
        class="add-btn"
        @click="$emit('add-gear')"
      >
        <span class="add-ico">+</span>
        Add gear
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="state-block">
      <div class="state-spinner"></div>
      <p>Loading gear…</p>
    </div>

    <!-- Empty -->
    <div v-else-if="!filteredGear.length" class="state-block empty">
      <div class="state-icon">🎛️</div>
      <h3 class="state-title">{{ search || typeFilter !== 'all' || statusFilter !== 'all' ? 'No gear matches your filters' : (mode === 'select' ? 'No team gear available' : 'No gear yet') }}</h3>
      <p class="state-sub">
        {{ search || typeFilter !== 'all' || statusFilter !== 'all'
            ? 'Try adjusting your search or filters.'
            : (mode === 'select'
                ? 'Add team members to this project, or have them list gear in their profile.'
                : 'Add your first piece of gear to start tracking it across projects.')
        }}
      </p>
      <button v-if="mode === 'manage' && !search && typeFilter === 'all' && statusFilter === 'all'" class="add-btn add-btn-hero" @click="$emit('add-gear')">
        <span class="add-ico">+</span>
        Add your first gear
      </button>
    </div>

    <!-- Conflict warning vs current project (select mode) -->
    <div v-if="mode === 'select' && conflictCount > 0" class="conflict-banner">
      <span class="conflict-ico">⚠️</span>
      <div>
        <strong>{{ conflictCount }} {{ conflictCount === 1 ? 'item is' : 'items are' }} already booked during this project's dates.</strong>
        Items flagged below conflict with another project on overlapping days. You can still add them, but the owner may need to resolve the clash.
      </div>
    </div>

    <!-- Grouped gear -->
    <div v-if="!loading && filteredGear.length" class="group-list">
      <section v-for="group in groupedGear" :key="group.key" class="gear-group">
        <header class="group-head" @click="toggleGroup(group.key)">
          <span class="group-chevron" :class="{ open: !collapsed[group.key] }">▾</span>
          <span class="group-icon" :style="{ background: typeColor(group.key) }">{{ typeIcon(group.key) }}</span>
          <h3 class="group-title">{{ typeLabel(group.key) }}</h3>
          <span class="group-count">{{ group.items.length }}</span>
        </header>

        <div v-if="!collapsed[group.key]" class="group-grid">
          <article
            v-for="item in group.items"
            :key="item.id"
            class="gear-tile"
            :class="[
              `status-${(statusByGear[item.id]?.status) || 'available'}`,
              { selected: isSelected(item.id), 'mode-select': mode === 'select' }
            ]"
            @click="onTileClick(item)"
          >
            <!-- Top row: name + status -->
            <header class="tile-head">
              <div class="tile-name-wrap">
                <h4 class="tile-name">{{ item.gear_name }}</h4>
                <span v-if="showOwner(item)" class="tile-owner">
                  {{ ownerNameFor(item) }}
                </span>
                <span
                  v-if="item.held_for && String(item.held_for).trim()"
                  class="tile-held-for"
                  :title="`This item is being held for ${item.held_for}`"
                >
                  👤 Held for {{ item.held_for }}
                </span>
              </div>
              <span class="status-badge" :class="`badge-${badgeFor(item).tone}`">
                <span class="badge-ico">{{ badgeFor(item).icon }}</span>
                {{ badgeFor(item).label }}
              </span>
            </header>

            <!-- Quick facts -->
            <div class="tile-facts">
              <div class="fact">
                <span class="fact-lbl">Total</span>
                <span class="fact-val">{{ statusByGear[item.id]?.total_quantity ?? item.quantity ?? 1 }}</span>
              </div>
              <div class="fact">
                <span class="fact-lbl">Available</span>
                <span class="fact-val" :class="{ 'fact-zero': (statusByGear[item.id]?.available_now ?? 0) === 0 }">
                  {{ statusByGear[item.id]?.available_now ?? item.quantity ?? 0 }}
                </span>
              </div>
              <div class="fact" v-if="item.condition">
                <span class="fact-lbl">Condition</span>
                <span class="fact-val condition" :class="`cond-${item.condition}`">{{ item.condition }}</span>
              </div>
              <div class="fact" v-if="ioSummary(item)">
                <span class="fact-lbl">I/O</span>
                <span class="fact-val">{{ ioSummary(item) }}</span>
              </div>
            </div>

            <!-- Current usage -->
            <div v-if="(statusByGear[item.id]?.current_usages?.length)" class="tile-usage">
              <div
                v-for="u in statusByGear[item.id].current_usages"
                :key="u.project_id"
                class="usage-row"
              >
                <span class="usage-tag" :class="{ 'usage-conflict': (statusByGear[item.id]?.conflicts?.length) }">
                  In use
                </span>
                <div class="usage-detail">
                  <strong>{{ u.project_name }}</strong>
                  <span class="usage-dates">
                    Until {{ formatDate(u.last_date) }} · auto-releases {{ formatDate(u.auto_release_date) }}
                  </span>
                </div>
              </div>
            </div>

            <div v-else-if="(statusByGear[item.id]?.upcoming_usages?.length)" class="tile-usage">
              <div class="usage-row upcoming">
                <span class="usage-tag usage-upcoming">Reserved</span>
                <div class="usage-detail">
                  <strong>{{ statusByGear[item.id].upcoming_usages[0].project_name }}</strong>
                  <span class="usage-dates">
                    From {{ formatDate(statusByGear[item.id].upcoming_usages[0].first_date) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Conflict vs current project (select mode) -->
            <div v-if="statusByGear[item.id]?.conflict_with_current?.length" class="tile-conflicts">
              <div class="conflict-line">
                <span class="conflict-ico">⚠️</span>
                <span>
                  Overlaps with
                  <strong>{{ statusByGear[item.id].conflict_with_current.map(c => c.project_name).join(', ') }}</strong>
                  on {{ statusByGear[item.id].conflict_with_current[0].overlapping_dates.length }}
                  day{{ statusByGear[item.id].conflict_with_current[0].overlapping_dates.length === 1 ? '' : 's' }}
                </span>
              </div>
            </div>

            <!-- Generic conflict (manage mode) -->
            <div v-else-if="(statusByGear[item.id]?.conflicts?.length) && mode === 'manage'" class="tile-conflicts">
              <div
                v-for="(c, idx) in statusByGear[item.id].conflicts"
                :key="idx"
                class="conflict-line"
              >
                <span class="conflict-ico">⚠️</span>
                <span>
                  <strong>{{ c.project_a.name }}</strong>
                  &amp;
                  <strong>{{ c.project_b.name }}</strong>
                  overlap on
                  {{ c.overlapping_dates.length }} day{{ c.overlapping_dates.length === 1 ? '' : 's' }}
                </span>
              </div>
            </div>

            <p v-if="item.notes && mode === 'manage'" class="tile-notes">{{ item.notes }}</p>

            <!-- Footer actions -->
            <footer class="tile-foot">
              <template v-if="mode === 'manage'">
                <button
                  type="button"
                  class="tile-btn"
                  @click.stop="$emit('view-assignments', item)"
                  v-if="(statusByGear[item.id]?.usages?.length)"
                >
                  📋 {{ statusByGear[item.id].usages.length }} project{{ statusByGear[item.id].usages.length === 1 ? '' : 's' }}
                </button>
                <button
                  v-if="!item.archived_at"
                  type="button"
                  class="tile-btn"
                  @click.stop="$emit('edit-gear', item)"
                >
                  ✏️ Edit
                </button>
                <button
                  v-if="!item.archived_at"
                  type="button"
                  class="tile-btn"
                  @click.stop="$emit('archive-gear', item)"
                  title="Remove from your active gear library. Past projects keep their reference."
                >
                  📦 Archive
                </button>
                <button
                  v-else
                  type="button"
                  class="tile-btn"
                  @click.stop="$emit('unarchive-gear', item)"
                  title="Restore this item to your active gear library."
                >
                  ↩️ Unarchive
                </button>
                <button
                  type="button"
                  class="tile-btn tile-btn-danger"
                  @click.stop="$emit('delete-gear', item)"
                  title="Permanently delete. Only works if no project still references this item."
                >
                  🗑️ Delete
                </button>
              </template>
              <template v-else>
                <label class="tile-select" @click.stop>
                  <input
                    type="checkbox"
                    :checked="isSelected(item.id)"
                    @change="onToggleSelect(item, $event.target.checked)"
                  />
                  <span>{{ isSelected(item.id) ? 'Selected' : 'Add to project' }}</span>
                </label>
                <div v-if="isSelected(item.id)" class="qty-wrap" @click.stop>
                  <label class="qty-lbl">Qty</label>
                  <input
                    type="number"
                    class="qty-input"
                    :value="selectionMap[item.id]?.quantity ?? 1"
                    :min="1"
                    :max="item.quantity || 1"
                    @input="onQuantityChange(item, $event.target.value)"
                  />
                  <span class="qty-of">of {{ item.quantity || 1 }}</span>
                </div>
              </template>
            </footer>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { supabase } from '../supabase'
import {
  computeUserGearStatus,
  statusBadgeForGear,
  formatHumanDate
} from '../utils/gearStatusHelper'

const props = defineProps({
  /** 'manage' (full CRUD) | 'select' (used inside Add Team Gear modal) */
  mode: { type: String, default: 'manage' },
  /** Owner user-id for manage mode (defaults to logged-in user) */
  userId: { type: String, default: null },
  /** When set, gear status is computed against this project's dates. */
  projectId: { type: String, default: null },
  /** For 'select' mode: include gear from these user ids (project members + owner). */
  teamUserIds: { type: Array, default: () => [] },
  /** Pre-loaded gear (skip fetch). */
  initialGear: { type: Array, default: null },
  /** Show the top stat strip. */
  showStats: { type: Boolean, default: true },
  /** Show owner filter dropdown (only useful with multi-user gear). */
  showOwnerFilter: { type: Boolean, default: false },
  /** Force display of owner names even in single-user mode. */
  showOwnerAlways: { type: Boolean, default: false }
})

const emit = defineEmits([
  'add-gear',
  'edit-gear',
  'delete-gear',
  'archive-gear',
  'unarchive-gear',
  'view-assignments',
  'selection-change',
  'gear-loaded'
])

const loading = ref(false)
const gear = ref([])
const statusByGear = ref({})
const currentProject = ref(null)

const search = ref('')
const statusFilter = ref('all')
const typeFilter = ref('all')
const ownerFilter = ref('all')
const heldForFilter = ref('all') // 'all' | 'mine' | 'others' | 'name:<owner>'
const showArchived = ref(false)
const collapsed = ref({})

// Selection state for 'select' mode: { [gearId]: { quantity } }
const selectionMap = ref({})

const TYPE_META = {
  source: { label: 'Microphones & Sources', icon: '🎙️', color: 'rgba(14,165,233,0.12)' },
  transformer: { label: 'Transformers & I/O', icon: '🔀', color: 'rgba(139,92,246,0.12)' },
  recorder: { label: 'Recorders', icon: '⏺️', color: 'rgba(244,114,182,0.12)' },
  accessories_cables: { label: 'Accessories & Cables', icon: '🔌', color: 'rgba(34,197,94,0.12)' },
  other: { label: 'Other gear', icon: '🎛️', color: 'rgba(148,163,184,0.12)' }
}

function typeLabel(t) { return TYPE_META[t]?.label || (t ? (t[0].toUpperCase() + t.slice(1)) : 'Other gear') }
function typeIcon(t) { return TYPE_META[t]?.icon || '🎛️' }
function typeColor(t) { return TYPE_META[t]?.color || TYPE_META.other.color }
function badgeFor(item) { return statusBadgeForGear(statusByGear.value[item.id]) }
function formatDate(d) { return formatHumanDate(d) }
function ioSummary(item) {
  if (item.gear_type === 'recorder' && item.num_records) return `${item.num_records} track${item.num_records === 1 ? '' : 's'}`
  if (item.gear_type === 'source' || item.gear_type === 'accessories_cables') return ''
  if (item.num_inputs != null || item.num_outputs != null) return `${item.num_inputs ?? 0} in / ${item.num_outputs ?? 0} out`
  return ''
}

const availableTypes = computed(() => {
  const set = new Set(gear.value.map(g => g.gear_type).filter(Boolean))
  return [...set].sort()
})

const availableOwners = computed(() => {
  const map = new Map()
  for (const g of gear.value) {
    if (!g.user_id) continue
    if (!map.has(g.user_id)) {
      map.set(g.user_id, {
        user_id: g.user_id,
        name: g.owner_name || g.listed_by_name || 'Team member'
      })
    }
  }
  return [...map.values()]
})

// Distinct "held_for" names from the loaded gear, alphabetised. Drives
// both the held_for filter dropdown and the manage-mode badge surfacing.
const heldForNames = computed(() => {
  const set = new Set()
  for (const g of gear.value) {
    const n = (g.held_for || '').trim()
    if (n) set.add(n)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
})

// Count of archived items (used for the "Show archived (N)" toggle label)
const archivedCount = computed(() =>
  gear.value.reduce((n, g) => n + (g.archived_at ? 1 : 0), 0)
)

const filteredGear = computed(() => {
  const term = search.value.trim().toLowerCase()
  return gear.value.filter(item => {
    // Hide archived by default; reveal when the user toggles "Show archived"
    // or picks the Archived status filter. (Manage mode only — select mode
    // never shows archived gear.)
    const archivedExposed = showArchived.value || statusFilter.value === 'archived'
    if (item.archived_at && (props.mode !== 'manage' || !archivedExposed)) return false

    if (term) {
      const hay = [
        item.gear_name,
        item.gear_type,
        item.notes,
        item.owner_name,
        item.listed_by_name,
        item.held_for
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!hay.includes(term)) return false
    }
    if (typeFilter.value !== 'all' && item.gear_type !== typeFilter.value) return false
    if (props.showOwnerFilter && ownerFilter.value !== 'all' && item.user_id !== ownerFilter.value) return false

    // Manage mode: filter by who the gear is being held for.
    if (props.mode === 'manage' && heldForFilter.value !== 'all') {
      const heldFor = (item.held_for || '').trim()
      if (heldForFilter.value === 'mine' && heldFor) return false
      if (heldForFilter.value === 'others' && !heldFor) return false
      if (heldForFilter.value.startsWith('name:')) {
        const target = heldForFilter.value.slice(5)
        if (heldFor !== target) return false
      }
    }

    if (statusFilter.value !== 'all') {
      const st = statusByGear.value[item.id]?.status || 'available'
      if (statusFilter.value === 'in_use' && !['in_use', 'partial'].includes(st)) return false
      if (statusFilter.value !== 'in_use' && st !== statusFilter.value) return false
    }
    return true
  })
})

const groupedGear = computed(() => {
  const buckets = {}
  for (const item of filteredGear.value) {
    const key = item.gear_type || 'other'
    if (!buckets[key]) buckets[key] = { key, items: [] }
    buckets[key].items.push(item)
  }
  const ordered = ['source', 'transformer', 'recorder', 'accessories_cables']
  return [
    ...ordered.filter(k => buckets[k]).map(k => buckets[k]),
    ...Object.values(buckets).filter(b => !ordered.includes(b.key))
  ]
})

const stats = computed(() => {
  let inUse = 0
  let conflicts = 0
  let totalQty = 0
  for (const item of gear.value) {
    totalQty += item.quantity || 0
    const s = statusByGear.value[item.id]
    if (!s) continue
    if (['in_use', 'partial', 'conflict'].includes(s.status)) inUse += 1
    if (s.conflicts?.length) conflicts += 1
  }
  return { total: gear.value.length, totalQuantity: totalQty, inUse, conflicts }
})

const conflictCount = computed(() => {
  let count = 0
  for (const item of filteredGear.value) {
    const s = statusByGear.value[item.id]
    if (s?.conflict_with_current?.length) count += 1
  }
  return count
})

function toggleGroup(key) { collapsed.value[key] = !collapsed.value[key] }
function isSelected(id) { return Object.prototype.hasOwnProperty.call(selectionMap.value, id) }

function showOwner(item) {
  if (props.showOwnerAlways) return true
  if (props.mode === 'select') return true
  return false
}
function ownerNameFor(item) {
  return item.listed_by_name || item.owner_name || 'Team member'
}

function onTileClick(item) {
  if (props.mode === 'select') {
    onToggleSelect(item, !isSelected(item.id))
  } else {
    emit('view-assignments', item)
  }
}

function onToggleSelect(item, shouldSelect) {
  if (shouldSelect) {
    if (!selectionMap.value[item.id]) {
      selectionMap.value[item.id] = { quantity: 1 }
    }
  } else {
    delete selectionMap.value[item.id]
  }
  emitSelection()
}

function onQuantityChange(item, value) {
  const max = item.quantity || 1
  const num = Math.max(1, Math.min(max, Number(value) || 1))
  if (selectionMap.value[item.id]) {
    selectionMap.value[item.id].quantity = num
    emitSelection()
  }
}

function emitSelection() {
  const payload = Object.keys(selectionMap.value).map(id => {
    const item = gear.value.find(g => g.id === id)
    return { gear: item, quantity: selectionMap.value[id].quantity }
  }).filter(p => p.gear)
  emit('selection-change', payload)
}

async function loadGear() {
  loading.value = true
  try {
    let rows = props.initialGear
    if (!rows) {
      const queryUserIds = props.mode === 'select'
        ? (props.teamUserIds && props.teamUserIds.length ? props.teamUserIds : null)
        : (props.userId ? [props.userId] : null)

      if (!queryUserIds || queryUserIds.length === 0) {
        gear.value = []
        statusByGear.value = {}
        emit('gear-loaded', [])
        return
      }

      const { data, error } = await supabase
        .from('user_gear')
        .select('*')
        .in('user_id', queryUserIds)
        .order('gear_name')

      if (error) throw error
      rows = data || []
    }

    // Enrich with owner names (used in select mode)
    if (props.mode === 'select' && rows.length) {
      const ids = [...new Set(rows.map(r => r.user_id).filter(Boolean))]
      if (ids.length) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('user_id, full_name, company')
          .in('user_id', ids)
        const byId = {}
        for (const p of profiles || []) byId[p.user_id] = p
        rows = rows.map(r => ({
          ...r,
          listed_by_name: byId[r.user_id]?.full_name || r.owner_name || null,
          owner_company: byId[r.user_id]?.company || r.owner_company || null
        }))
      }
    }

    gear.value = rows
    emit('gear-loaded', rows)
    await refreshStatus()
  } catch (err) {
    console.error('[UserGearLibrary] Failed to load gear', err)
  } finally {
    loading.value = false
  }
}

async function refreshStatus() {
  if (!gear.value.length) {
    statusByGear.value = {}
    return
  }
  try {
    if (props.projectId && !currentProject.value) {
      const { data } = await supabase
        .from('projects')
        .select('id, project_name, build_days, main_show_days')
        .eq('id', props.projectId)
        .single()
      currentProject.value = data || null
    }
    const map = await computeUserGearStatus(gear.value, {
      supabase,
      currentProject: currentProject.value,
      today: new Date()
    })
    statusByGear.value = map
  } catch (err) {
    console.warn('[UserGearLibrary] Status computation failed', err)
  }
}

defineExpose({ reload: loadGear, refreshStatus })

watch(() => props.userId, () => loadGear())
watch(() => props.projectId, async () => {
  currentProject.value = null
  await refreshStatus()
})
watch(() => props.initialGear, () => loadGear())
watch(() => props.teamUserIds, () => {
  if (props.mode === 'select') loadGear()
}, { deep: true })

onMounted(() => loadGear())
</script>

<style scoped>
.gear-library {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ===== Stats strip ===== */
.library-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 0.75rem;
  padding: 0.75rem;
}
.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem 0.25rem;
  border-radius: 0.5rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
}
.stat-num {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text-heading);
}
.stat-lbl {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.15rem;
  text-align: center;
}
.stat-danger .stat-num { color: #dc2626; }

/* ===== Controls ===== */
.library-controls {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}
.search-wrap {
  flex: 1 1 220px;
  position: relative;
  min-width: 200px;
}
.search-ico {
  position: absolute;
  left: 0.7rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-secondary);
  font-size: 0.85rem;
}
.search-field {
  width: 100%;
  padding: 0.55rem 0.6rem 0.55rem 2rem;
  border: 1px solid var(--border-medium);
  border-radius: 0.5rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.9rem;
}
.search-field:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(14,165,233,0.15);
}
.filter-pick {
  padding: 0.55rem 0.6rem;
  border: 1px solid var(--border-medium);
  border-radius: 0.5rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.9rem;
  min-width: 130px;
}
.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.85rem;
  border-radius: 0.5rem;
  background: var(--color-primary-500);
  color: #fff;
  border: none;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.9rem;
}
.add-btn:hover { background: var(--color-primary-600); }
.add-ico { font-size: 1.1rem; line-height: 1; }
.add-btn-hero { margin-top: 0.5rem; padding: 0.7rem 1.2rem; }

/* ===== States ===== */
.state-block {
  padding: 2rem 1rem;
  text-align: center;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-medium);
  border-radius: 0.75rem;
}
.state-block.empty .state-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}
.state-title {
  margin: 0 0 0.25rem;
  font-size: 1.05rem;
  color: var(--text-heading);
}
.state-sub {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
}
.state-spinner {
  width: 1.5rem;
  height: 1.5rem;
  border: 2.5px solid var(--border-medium);
  border-top-color: var(--color-primary-500);
  border-radius: 50%;
  margin: 0 auto 0.5rem;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ===== Conflict banner ===== */
.conflict-banner {
  display: flex;
  gap: 0.6rem;
  background: rgba(220,38,38,0.08);
  border: 1px solid rgba(220,38,38,0.25);
  color: #b91c1c;
  border-radius: 0.6rem;
  padding: 0.7rem 0.85rem;
  font-size: 0.9rem;
}
.conflict-banner .conflict-ico { font-size: 1.1rem; }

/* ===== Groups ===== */
.group-list { display: flex; flex-direction: column; gap: 1rem; }
.gear-group {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 0.75rem;
  overflow: hidden;
}
.group-head {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.7rem 0.85rem;
  cursor: pointer;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
  user-select: none;
}
.group-head:hover { background: var(--bg-tertiary); }
.group-chevron {
  display: inline-block;
  transition: transform 0.15s ease;
  color: var(--text-secondary);
  font-size: 0.8rem;
}
.group-chevron.open { transform: rotate(0deg); }
.group-chevron:not(.open) { transform: rotate(-90deg); }
.group-icon {
  width: 1.8rem;
  height: 1.8rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.45rem;
  font-size: 1rem;
}
.group-title {
  flex: 1;
  margin: 0;
  font-size: 0.98rem;
  color: var(--text-heading);
  font-weight: 600;
}
.group-count {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 1rem;
  padding: 0.1rem 0.55rem;
}

.group-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.75rem;
  padding: 0.85rem;
}

/* ===== Tile ===== */
.gear-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.85rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 0.6rem;
  transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
}
.gear-tile.mode-select { cursor: pointer; }
.gear-tile:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.gear-tile.selected {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 2px rgba(14,165,233,0.15);
}
.gear-tile.status-conflict { border-color: rgba(220,38,38,0.45); }
.gear-tile.status-in_use   { border-color: rgba(14,165,233,0.4); }
.gear-tile.status-partial  { border-color: rgba(14,165,233,0.3); }
.gear-tile.status-reserved { border-color: rgba(139,92,246,0.35); }
.gear-tile.status-archived {
  border-style: dashed;
  border-color: var(--border-medium);
  background: var(--bg-secondary);
  opacity: 0.78;
}
.gear-tile.status-archived .tile-name { color: var(--text-secondary); }

.show-archived {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  user-select: none;
  cursor: pointer;
}
.show-archived input { margin: 0; }

.tile-head { display: flex; gap: 0.5rem; align-items: flex-start; justify-content: space-between; }
.tile-name-wrap { min-width: 0; flex: 1; }
.tile-name {
  margin: 0;
  font-size: 0.98rem;
  font-weight: 600;
  color: var(--text-heading);
  word-wrap: break-word;
}
.tile-owner {
  display: inline-block;
  margin-top: 0.15rem;
  font-size: 0.78rem;
  color: var(--text-secondary);
}
.tile-held-for {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  margin-top: 0.3rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
}

/* badges */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
}
.badge-success { background: rgba(34,197,94,0.12); color: #15803d; }
.badge-info    { background: rgba(14,165,233,0.12); color: #0369a1; }
.badge-accent  { background: rgba(139,92,246,0.12); color: #6d28d9; }
.badge-warning { background: rgba(245,158,11,0.18); color: #b45309; }
.badge-danger  { background: rgba(220,38,38,0.13); color: #b91c1c; }
.badge-muted   { background: rgba(100,116,139,0.15); color: #475569; }
.badge-ico { font-size: 0.7rem; }

/* facts */
.tile-facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(70px, 1fr));
  gap: 0.4rem;
  padding: 0.45rem 0.55rem;
  background: var(--bg-secondary);
  border-radius: 0.45rem;
}
.fact { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; }
.fact-lbl { font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
.fact-val { font-size: 0.9rem; font-weight: 600; color: var(--text-heading); }
.fact-zero { color: #b91c1c; }
.condition { text-transform: capitalize; font-weight: 500; }
.cond-excellent { color: #15803d; }
.cond-good      { color: #0369a1; }
.cond-fair      { color: #b45309; }
.cond-poor      { color: #b91c1c; }

/* usage */
.tile-usage {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.usage-row {
  display: flex;
  gap: 0.4rem;
  align-items: flex-start;
  padding: 0.4rem 0.5rem;
  background: rgba(14,165,233,0.07);
  border: 1px solid rgba(14,165,233,0.2);
  border-radius: 0.4rem;
}
.usage-row.upcoming {
  background: rgba(139,92,246,0.07);
  border-color: rgba(139,92,246,0.2);
}
.usage-tag {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: 0.3rem;
  color: #fff;
  background: #0ea5e9;
  flex-shrink: 0;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.usage-tag.usage-upcoming { background: #8b5cf6; }
.usage-tag.usage-conflict { background: #dc2626; }
.usage-detail { min-width: 0; font-size: 0.8rem; color: var(--text-primary); display: flex; flex-direction: column; gap: 0.1rem; }
.usage-dates { font-size: 0.72rem; color: var(--text-secondary); }

/* conflicts */
.tile-conflicts {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.conflict-line {
  display: flex;
  gap: 0.4rem;
  align-items: flex-start;
  background: rgba(220,38,38,0.07);
  border: 1px solid rgba(220,38,38,0.22);
  padding: 0.35rem 0.5rem;
  border-radius: 0.4rem;
  color: #b91c1c;
  font-size: 0.78rem;
}

.tile-notes {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
  padding: 0.35rem 0.5rem;
  background: var(--bg-secondary);
  border-radius: 0.35rem;
  border-left: 3px solid var(--border-medium);
}

/* foot */
.tile-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  align-items: center;
  justify-content: flex-end;
  margin-top: auto;
  padding-top: 0.4rem;
  border-top: 1px dashed var(--border-light);
}
.tile-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.35rem 0.6rem;
  border-radius: 0.4rem;
  font-size: 0.78rem;
  font-weight: 500;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-light);
  cursor: pointer;
}
.tile-btn:hover { background: var(--bg-tertiary); }
.tile-btn-danger:hover {
  background: rgba(220,38,38,0.12);
  color: #b91c1c;
  border-color: rgba(220,38,38,0.4);
}

/* select-mode footer */
.tile-select {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: var(--text-primary);
  cursor: pointer;
}
.tile-select input { width: 1rem; height: 1rem; }
.qty-wrap {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: var(--bg-secondary);
  padding: 0.25rem 0.45rem;
  border-radius: 0.4rem;
  border: 1px solid var(--border-light);
}
.qty-lbl { font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; }
.qty-input {
  width: 3.5rem;
  padding: 0.2rem 0.3rem;
  border: 1px solid var(--border-medium);
  border-radius: 0.3rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.82rem;
  text-align: center;
}
.qty-of { font-size: 0.72rem; color: var(--text-secondary); }

@media (max-width: 540px) {
  .group-grid { grid-template-columns: 1fr; padding: 0.6rem; }
  .filter-pick { flex: 1 1 calc(50% - 0.3rem); min-width: 0; }
  .tile-facts { grid-template-columns: repeat(2, 1fr); }
}
</style>
