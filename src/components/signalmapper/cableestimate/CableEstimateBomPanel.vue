<!--
  Read-only bill-of-materials for the cable estimate. Driven entirely by the
  computed estimate from useCableEstimate — no logic here beyond formatting.
-->
<template>
  <div class="bom-panel">
    <div v-if="!estimate.calibrated" class="bom-hint">
      <strong>Not calibrated.</strong> Counts and multicore sizes are shown below;
      <em>set a scale</em> to get cable lengths.
    </div>

    <!-- Headline totals -->
    <div class="bom-totals">
      <div class="stat">
        <span class="stat-value">{{ estimate.calibrated ? fmt(estimate.totals.totalLength) : '—' }}</span>
        <span class="stat-label">Total cable</span>
      </div>
      <div class="stat">
        <span class="stat-value">{{ estimate.calibrated ? fmt(estimate.totals.longestRun) : '—' }}</span>
        <span class="stat-label">Longest run</span>
      </div>
      <div class="stat">
        <span class="stat-value">{{ estimate.totals.totalRuns }}</span>
        <span class="stat-label">Cable runs</span>
      </div>
      <div class="stat">
        <span class="stat-value">{{ estimate.totals.xlrTails }}</span>
        <span class="stat-label">Mic tails</span>
      </div>
    </div>

    <p v-if="estimate.calibrated && estimate.totals.totalVertical > 0" class="bom-vertical-note">
      ▲ Includes ~{{ fmt(estimate.totals.totalVertical) }} of vertical run for
      {{ estimate.totals.elevatedNodeCount }} elevated node{{ estimate.totals.elevatedNodeCount === 1 ? '' : 's' }}.
    </p>

    <!-- Multicore combinations -->
    <section v-if="multicoreChips.length" class="bom-section">
      <h4>Multicore combinations</h4>
      <div class="chip-row">
        <span v-for="c in multicoreChips" :key="c.size" class="chip">
          {{ c.count }} × {{ c.size }}-way
        </span>
      </div>
    </section>

    <!-- Per-stagebox breakdown -->
    <section v-if="estimate.stageboxes.length" class="bom-section">
      <h4>Stageboxes</h4>
      <table class="bom-table">
        <thead>
          <tr><th>Stagebox</th><th>Mics</th><th>Multicore</th><th>Trunk</th></tr>
        </thead>
        <tbody>
          <tr v-for="sb in estimate.stageboxes" :key="sb.id">
            <td>
              {{ sb.label }}
              <span v-if="!sb.hasPosition" class="warn-tag" title="Place this stagebox on the plan to measure its runs">no position</span>
            </td>
            <td>{{ sb.micCount }}</td>
            <td>{{ sb.suggestedMulticore ? `${sb.suggestedMulticore}-way` : '—' }}</td>
            <td>{{ sb.trunkLength != null ? fmt(sb.trunkLength) : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- By cable type (assigned per run) -->
    <section v-if="cableTypeRows.length" class="bom-section">
      <h4>By cable type</h4>
      <table class="bom-table">
        <thead>
          <tr><th>Cable</th><th>Runs</th><th>Length</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in cableTypeRows" :key="row.type">
            <td>{{ row.type }}</td>
            <td>{{ row.count }}</td>
            <td>{{ estimate.calibrated ? fmt(row.length) : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- By run type -->
    <section v-if="categoryRows.length" class="bom-section">
      <h4>By run type</h4>
      <table class="bom-table">
        <thead>
          <tr><th>Type</th><th>Runs</th><th>Length</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in categoryRows" :key="row.key">
            <td>{{ row.label }}</td>
            <td>{{ row.count }}</td>
            <td>{{ estimate.calibrated ? fmt(row.length) : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Warnings -->
    <section v-if="estimate.totals.unmeasuredCount || estimate.totals.unroutedMicCount" class="bom-section bom-warnings">
      <h4>Needs attention</h4>
      <p v-if="estimate.totals.unmeasuredCount" class="warn-line">
        ⚠ {{ estimate.totals.unmeasuredCount }} run{{ estimate.totals.unmeasuredCount === 1 ? '' : 's' }}
        not measured — an endpoint isn't placed on the floor plan.
      </p>
      <ul v-if="estimate.unmeasured.length" class="warn-detail">
        <li v-for="u in estimate.unmeasured" :key="u.connectionId">
          {{ u.fromLabel }} → {{ u.toLabel }}
        </li>
      </ul>
      <p v-if="estimate.totals.unroutedMicCount" class="warn-line">
        ⚠ {{ estimate.totals.unroutedMicCount }} mic{{ estimate.totals.unroutedMicCount === 1 ? '' : 's' }}
        placed but not wired in Signal Flow:
        <span class="muted">{{ estimate.unroutedMics.map(m => m.label).join(', ') }}</span>
      </p>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  estimate: { type: Object, required: true },
})

const CATEGORY_LABELS = {
  tail: 'Mic → stagebox',
  trunk: 'Stagebox → recorder',
  direct: 'Mic → recorder',
  link: 'Stagebox → stagebox',
  other: 'Other',
}

function fmt(value) {
  if (value == null) return '—'
  const n = value.toLocaleString(undefined, { maximumFractionDigits: 1 })
  return `${n} ${props.estimate.unit}`
}

const multicoreChips = computed(() =>
  Object.entries(props.estimate.totals.multicoreSummary || {})
    .map(([size, count]) => ({ size: Number(size), count }))
    .sort((a, b) => b.size - a.size),
)

const categoryRows = computed(() =>
  Object.entries(props.estimate.totals.byCategory || {})
    .map(([key, v]) => ({ key, label: CATEGORY_LABELS[key] || key, count: v.count, length: v.length }))
    .sort((a, b) => b.count - a.count),
)

const cableTypeRows = computed(() =>
  Object.entries(props.estimate.totals.byCableType || {})
    .map(([type, v]) => ({ type, count: v.count, length: v.length }))
    .sort((a, b) => b.length - a.length),
)
</script>

<style scoped>
.bom-panel { display: flex; flex-direction: column; gap: 16px; }
.bom-hint {
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px dashed var(--surface-border);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  line-height: 1.4;
}
.bom-totals {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 10px;
}
.stat {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-value { font-size: 20px; font-weight: 700; color: var(--text-primary); }
.stat-label { font-size: 12px; color: var(--text-secondary); }
.bom-vertical-note { font-size: 12px; color: var(--color-warning-700, #b45309); margin: -4px 0 0 0; }
.bom-section h4 {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  background: var(--color-primary-500);
  color: #fff;
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 13px;
  font-weight: 600;
}
.bom-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.bom-table th, .bom-table td {
  text-align: left;
  padding: 7px 8px;
  border-bottom: 1px solid var(--border-light);
  color: var(--text-primary);
}
.bom-table th { color: var(--text-secondary); font-weight: 600; font-size: 12px; }
.bom-table td:nth-child(2), .bom-table th:nth-child(2),
.bom-table td:nth-child(3), .bom-table th:nth-child(3),
.bom-table td:nth-child(4), .bom-table th:nth-child(4) { text-align: right; white-space: nowrap; }
.warn-tag {
  display: inline-block;
  margin-left: 6px;
  font-size: 10px;
  color: var(--color-warning-600, #b45309);
  background: var(--color-warning-100, #fef3c7);
  border-radius: 4px;
  padding: 1px 5px;
}
.bom-warnings h4 { color: var(--color-warning-600, #b45309); }
.warn-line { font-size: 13px; color: var(--text-primary); margin: 6px 0; line-height: 1.4; }
.warn-detail { margin: 0 0 6px 0; padding-left: 20px; font-size: 12px; color: var(--text-secondary); }
.muted { color: var(--text-secondary); }
</style>
