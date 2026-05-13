<template>
  <div class="project-search">
    <!-- Inline trigger: clicking opens the chat palette -->
    <button
      type="button"
      class="psb-trigger"
      :aria-label="effectivePlaceholder"
      @click="openPalette"
    >
      <Sparkles v-if="isGlobal" :size="16" :stroke-width="2" class="psb-icon psb-icon-accent" />
      <Search v-else :size="16" :stroke-width="2" class="psb-icon" />
      <span class="psb-trigger-text">{{ effectivePlaceholder }}</span>
      <kbd class="psb-kbd">{{ shortcutLabel }}</kbd>
    </button>

    <!-- Chat-style palette -->
    <Transition name="psb-fade">
      <div
        v-if="paletteOpen"
        class="psb-overlay"
        @click.self="closePalette"
      >
        <div
          class="psb-palette"
          role="dialog"
          :aria-label="effectivePaletteTitle"
          @keydown.esc="closePalette"
        >
          <div class="psb-palette-head">
            <div class="psb-palette-title">
              <Sparkles :size="16" :stroke-width="2" class="psb-palette-title-icon" />
              <span>{{ effectivePaletteTitle }}</span>
            </div>
            <button
              type="button"
              class="psb-palette-close"
              aria-label="Close"
              @click="closePalette"
            >
              <X :size="16" :stroke-width="2" />
            </button>
          </div>

          <div ref="bodyRef" class="psb-palette-body">
            <!-- Empty / idle state -->
            <div v-if="!query && !loading" class="psb-idle">
              <p class="psb-idle-lead">
                {{ isGlobal
                  ? 'Ask anything across your projects — notes, contacts, schedules, gear, travel, docs.'
                  : 'Ask anything about this project — notes, contacts, stages, schedule, gear, docs, travel.' }}
              </p>
              <div class="psb-examples">
                <button
                  v-for="ex in examples"
                  :key="ex"
                  class="psb-example"
                  @click="runExample(ex)"
                >
                  {{ ex }}
                </button>
              </div>
            </div>

            <!-- Submitted Q & A -->
            <template v-if="query">
              <div class="psb-bubble psb-bubble-user">
                <div class="psb-bubble-body">{{ query }}</div>
              </div>

              <div v-if="loading" class="psb-bubble psb-bubble-assistant psb-bubble-loading">
                <Loader2 :size="16" :stroke-width="2" class="psb-bubble-icon spin" />
                <div class="psb-bubble-body psb-bubble-thinking">Thinking…</div>
              </div>

              <template v-else>
                <div v-if="answer" class="psb-bubble psb-bubble-assistant">
                  <Sparkles :size="16" :stroke-width="2" class="psb-bubble-icon" />
                  <div class="psb-bubble-body">{{ answer }}</div>
                </div>

                <!-- Proposed write awaiting confirmation -->
                <div v-if="proposal" class="psb-proposal">
                  <div class="psb-proposal-head">
                    <component :is="proposalIcon" :size="16" :stroke-width="2" class="psb-proposal-icon" />
                    <span class="psb-proposal-title">{{ proposalTitle }}</span>
                  </div>
                  <dl class="psb-proposal-fields">
                    <template v-for="row in proposalFields" :key="row.label">
                      <dt>{{ row.label }}</dt>
                      <dd>{{ row.value }}</dd>
                    </template>
                  </dl>
                  <div class="psb-proposal-actions">
                    <button
                      type="button"
                      class="psb-btn psb-btn-ghost"
                      :disabled="acting"
                      @click="cancelProposal"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      class="psb-btn psb-btn-primary"
                      :disabled="acting"
                      @click="confirmProposal"
                    >
                      <Loader2 v-if="acting" :size="14" :stroke-width="2" class="spin" />
                      <Check v-else :size="14" :stroke-width="2.5" />
                      <span>{{ acting ? 'Saving…' : 'Confirm' }}</span>
                    </button>
                  </div>
                </div>

                <!-- Post-action confirmation -->
                <div
                  v-if="actionResult"
                  class="psb-bubble psb-bubble-assistant"
                  :class="{ 'psb-bubble-success': actionResult.ok, 'psb-bubble-error': !actionResult.ok }"
                >
                  <Check v-if="actionResult.ok" :size="16" :stroke-width="2.5" class="psb-bubble-icon" />
                  <X v-else :size="16" :stroke-width="2.5" class="psb-bubble-icon" />
                  <div class="psb-bubble-body">
                    {{ actionResult.ok ? actionResult.summary : actionResult.error }}
                  </div>
                </div>

                <div
                  v-if="!answer && !proposal && !actionResult && !results.length"
                  class="psb-bubble psb-bubble-assistant"
                >
                  <Sparkles :size="16" :stroke-width="2" class="psb-bubble-icon" />
                  <div class="psb-bubble-body">
                    Nothing matched. Try rephrasing, or use a name, place, or topic.
                  </div>
                </div>

                <div v-if="results.length" class="psb-results-block">
                  <div class="psb-results-label">
                    {{ results.length === 1 ? '1 related item' : `${results.length} related items` }}
                  </div>
                  <ul class="psb-results">
                    <li
                      v-for="(r, i) in results"
                      :key="r.id"
                      class="psb-result"
                      :class="{ selected: i === selected }"
                      @mouseenter="selected = i"
                      @click="goToResult(r)"
                    >
                      <component :is="iconFor(r)" :size="18" :stroke-width="2" class="psb-result-icon" />
                      <div class="psb-result-body">
                        <div class="psb-result-title">{{ r.title || labelForResult(r) }}</div>
                        <div class="psb-result-meta">
                          <span v-if="isGlobal && r.project_name" class="psb-result-project">
                            <Folder :size="11" :stroke-width="2" />
                            {{ r.project_name }}
                          </span>
                          <span class="psb-result-snippet">{{ snippet(r) }}</span>
                        </div>
                      </div>
                      <span class="psb-result-kind">{{ labelForResult(r) }}</span>
                    </li>
                  </ul>
                </div>
              </template>
            </template>
          </div>

          <!-- Composer -->
          <form class="psb-composer" @submit.prevent="onSubmit">
            <input
              ref="paletteInputRef"
              v-model="draft"
              type="text"
              :placeholder="composerPlaceholder"
              class="psb-composer-input"
              autocomplete="off"
              spellcheck="false"
              @keydown.down.prevent="moveSelection(1)"
              @keydown.up.prevent="moveSelection(-1)"
            />
            <button
              type="submit"
              class="psb-composer-send"
              :disabled="!canSubmit"
              :aria-label="loading ? 'Cancel' : 'Ask'"
            >
              <Loader2 v-if="loading" :size="16" :stroke-width="2" class="spin" />
              <ArrowUp v-else :size="16" :stroke-width="2.5" />
            </button>
          </form>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script>
import { computed, onMounted, onUnmounted, ref, nextTick, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  Search, X, Loader2, Sparkles, ArrowUp, Check,
  StickyNote, User, MapPin, Building2, Calendar, FileText, File,
  Plane, BedDouble, Package, Folder,
} from 'lucide-vue-next';

const PROPOSAL_LABELS = {
  add_note: 'Add note',
  add_contact: 'Add contact',
  add_calendar_event: 'Add calendar event',
};
const PROPOSAL_ICONS = {
  add_note: StickyNote,
  add_contact: User,
  add_calendar_event: Calendar,
};
const PROPOSAL_FIELDS = {
  add_note: [
    { key: 'note', label: 'Note' },
    { key: 'location_hint', label: 'Location' },
  ],
  add_contact: [
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'comments', label: 'Notes' },
  ],
  add_calendar_event: [
    { key: 'title', label: 'Title' },
    { key: 'event_date', label: 'Date' },
    { key: 'start_time', label: 'Start' },
    { key: 'end_time', label: 'End' },
    { key: 'category', label: 'Category' },
    { key: 'notes', label: 'Notes' },
  ],
};
import { useProjectSearch, routeForResult, labelForResult } from '../composables/useProjectSearch';

const ICONS = {
  projects: Folder,
  notes: StickyNote,
  project_contacts: User,
  locations: MapPin,
  venues: Building2,
  schedules: Calendar,
  calendar_events: Calendar,
  stage_docs: FileText,
  project_docs: FileText,
  travel_trips: Plane,
  travel_accommodations: BedDouble,
  travel_documents: File,
  travel_flights: Plane,
  gear_table: Package,
};

export default {
  name: 'ProjectSearchBar',
  components: { Search, X, Loader2, Sparkles, ArrowUp, Check, Folder },
  props: {
    // null/empty = global mode (search every project the user belongs to)
    projectId: { type: String, default: null },
    placeholder: { type: String, default: '' },
    paletteplaceholder: { type: String, default: '' },
  },
  setup(props) {
    const router = useRouter();
    const {
      query, results, answer, proposal, actionResult,
      loading, acting,
      submit, confirmProposal, cancelProposal, reset,
    } = useProjectSearch(() => props.projectId);

    const paletteOpen = ref(false);
    const selected = ref(0);
    const paletteInputRef = ref(null);
    const bodyRef = ref(null);
    const draft = ref('');

    const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform || '');
    const shortcutLabel = computed(() => (isMac ? '⌘K' : 'Ctrl K'));
    const isGlobal = computed(() => !props.projectId);
    const effectivePlaceholder = computed(() =>
      props.placeholder || (isGlobal.value
        ? 'Ask anything across your projects…'
        : 'Ask anything about this project…'));
    const effectivePaletteTitle = computed(() =>
      props.paletteplaceholder || (isGlobal.value ? 'Workspace assistant' : 'Project assistant'));
    const examples = computed(() => (isGlobal.value
      ? [
          'which projects start in November?',
          'where am I staying for the malta trip?',
          'what gear do I have rented across projects?',
          'show me upcoming build days',
          'who is the FOH engineer on WHP 2025?',
          'next flight I have booked',
        ]
      : [
          'who is the FOH engineer?',
          'where are we staying?',
          'what time does load-in start on the show day?',
          'show me notes about stage right',
          'which flights leave London?',
          'what gear is rented?',
        ]));

    const canSubmit = computed(() => !loading.value && !acting.value && draft.value.trim().length >= 2);
    const composerPlaceholder = computed(() => (query.value ? 'Ask a follow-up…' : 'Ask anything…'));

    const proposalIcon = computed(() => (proposal.value ? PROPOSAL_ICONS[proposal.value.kind] || StickyNote : StickyNote));
    const proposalTitle = computed(() => (proposal.value ? PROPOSAL_LABELS[proposal.value.kind] || 'Proposed change' : ''));
    const proposalFields = computed(() => {
      if (!proposal.value) return [];
      const spec = PROPOSAL_FIELDS[proposal.value.kind] || [];
      const payload = proposal.value.payload || {};
      return spec
        .map(({ key, label }) => ({ label, value: payload[key] }))
        .filter((r) => r.value != null && String(r.value).trim() !== '');
    });

    function openPalette() {
      paletteOpen.value = true;
      selected.value = 0;
      nextTick(() => paletteInputRef.value?.focus());
    }
    function closePalette() {
      paletteOpen.value = false;
      draft.value = '';
      reset();
    }

    async function onSubmit() {
      if (!canSubmit.value) return;
      const q = draft.value.trim();
      draft.value = '';
      await submit(q);
      selected.value = 0;
      // Scroll the conversation to the latest exchange
      nextTick(() => {
        if (bodyRef.value) bodyRef.value.scrollTop = bodyRef.value.scrollHeight;
        paletteInputRef.value?.focus();
      });
    }

    function runExample(ex) {
      draft.value = ex;
      onSubmit();
    }

    function moveSelection(delta) {
      if (!results.value.length) return;
      const n = results.value.length;
      selected.value = ((selected.value + delta) % n + n) % n;
    }

    function goToResult(r) {
      const target = routeForResult(props.projectId, r);
      closePalette();
      router.push(target).catch(() => {});
    }

    function iconFor(r) { return ICONS[r?.source_table] || Folder; }
    function snippet(r) {
      const c = r?.content || '';
      return c.length > 160 ? c.slice(0, 160) + '…' : c;
    }

    function onKeydown(e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (paletteOpen.value) closePalette(); else openPalette();
      }
    }

    onMounted(() => { document.addEventListener('keydown', onKeydown); });
    onUnmounted(() => { document.removeEventListener('keydown', onKeydown); });

    watch(results, () => {
      selected.value = 0;
      nextTick(() => {
        if (bodyRef.value) bodyRef.value.scrollTop = bodyRef.value.scrollHeight;
      });
    });

    return {
      query, results, answer, loading,
      proposal, actionResult, acting,
      proposalIcon, proposalTitle, proposalFields,
      confirmProposal, cancelProposal,
      paletteOpen, selected, paletteInputRef, bodyRef,
      draft, canSubmit, composerPlaceholder,
      shortcutLabel, examples,
      isGlobal, effectivePlaceholder, effectivePaletteTitle,
      openPalette, closePalette, onSubmit, runExample,
      moveSelection, goToResult,
      iconFor, snippet, labelForResult,
    };
  },
};
</script>

<style scoped>
.project-search { position: relative; width: 100%; }

/* Trigger button */
.psb-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px 14px;
  cursor: text;
  text-align: left;
  font: inherit;
  color: #94a3b8;
  transition: border-color 120ms ease, background 120ms ease, box-shadow 120ms ease;
}
.psb-trigger:hover {
  background: #fff;
  border-color: #cbd5e1;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.psb-trigger:focus-visible {
  outline: 2px solid #0ea5e9;
  outline-offset: 2px;
}
.psb-trigger-text { flex: 1; }
.psb-icon { color: #64748b; flex-shrink: 0; }
.psb-kbd {
  font: 11px ui-monospace, Menlo, monospace;
  color: #64748b;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 5px;
  padding: 1px 5px;
  flex-shrink: 0;
}

/* Overlay */
.psb-overlay {
  position: fixed; inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 10vh;
  z-index: 200;
}
.psb-fade-enter-active, .psb-fade-leave-active { transition: opacity 120ms ease; }
.psb-fade-enter-from, .psb-fade-leave-to { opacity: 0; }

/* Palette */
.psb-palette {
  width: min(640px, calc(100vw - 32px));
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 30px 80px -20px rgba(2, 6, 23, 0.45);
  display: flex;
  flex-direction: column;
  max-height: 80vh;
}
.psb-palette-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f1f5f9;
}
.psb-palette-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}
.psb-palette-title-icon { color: #0ea5e9; }
.psb-palette-close {
  border: 0;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}
.psb-palette-close:hover { background: #f1f5f9; color: #0f172a; }

.psb-palette-body {
  overflow: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 120px;
}

/* Idle / empty state */
.psb-idle {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.psb-idle-lead {
  font-size: 13.5px;
  color: #475569;
  margin: 0;
  line-height: 1.5;
}
.psb-examples {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.psb-example {
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #0f172a;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12.5px;
  cursor: pointer;
  transition: border-color 120ms ease, background 120ms ease;
}
.psb-example:hover { border-color: #cbd5e1; background: #fff; }

/* Chat bubbles */
.psb-bubble {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 13.5px;
  line-height: 1.5;
}
.psb-bubble-user {
  align-self: flex-end;
  background: #0ea5e9;
  color: #fff;
  max-width: 85%;
  border-bottom-right-radius: 4px;
}
.psb-bubble-assistant {
  align-self: flex-start;
  background: #f1f5f9;
  color: #0f172a;
  max-width: 95%;
  border-bottom-left-radius: 4px;
}
.psb-bubble-loading { color: #475569; }
.psb-bubble-thinking { font-style: italic; }
.psb-bubble-icon {
  color: #0ea5e9;
  flex-shrink: 0;
  margin-top: 2px;
}
.psb-bubble-user .psb-bubble-icon { color: #fff; }
.psb-bubble-body { flex: 1; }

/* Results block */
.psb-results-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}
.psb-results-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #94a3b8;
  padding-left: 4px;
}
.psb-results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.psb-result {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  color: #0f172a;
  border: 1px solid transparent;
}
.psb-result.selected,
.psb-result:hover {
  background: #f8fafc;
  border-color: #e2e8f0;
}
.psb-result-icon { color: #64748b; flex-shrink: 0; }
.psb-result-body { flex: 1; min-width: 0; }
.psb-result-title {
  font-weight: 600;
  font-size: 14px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.psb-result-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 3px;
  min-width: 0;
}
.psb-result-project {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 600;
  color: #0369a1;
  background: #e0f2fe;
  padding: 1px 7px;
  border-radius: 999px;
  white-space: nowrap;
  flex-shrink: 0;
}
.psb-result-snippet {
  font-size: 12.5px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.psb-icon-accent { color: #0ea5e9; }

/* Proposal confirmation card */
.psb-proposal {
  align-self: stretch;
  border: 1px solid #bae6fd;
  background: linear-gradient(180deg, #f0f9ff 0%, #ffffff 100%);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.psb-proposal-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 13px;
  color: #0c4a6e;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.psb-proposal-icon { color: #0ea5e9; }
.psb-proposal-fields {
  margin: 0;
  display: grid;
  grid-template-columns: 110px 1fr;
  row-gap: 6px;
  column-gap: 12px;
  font-size: 13.5px;
  line-height: 1.4;
}
.psb-proposal-fields dt {
  font-weight: 500;
  color: #64748b;
  text-transform: capitalize;
}
.psb-proposal-fields dd {
  margin: 0;
  color: #0f172a;
  white-space: pre-wrap;
  word-break: break-word;
}
.psb-proposal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
.psb-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 8px;
  border: 0;
  padding: 7px 14px;
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}
.psb-btn:disabled { cursor: not-allowed; opacity: 0.7; }
.psb-btn-ghost {
  background: transparent;
  color: #475569;
  border: 1px solid #e2e8f0;
}
.psb-btn-ghost:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #cbd5e1;
}
.psb-btn-primary {
  background: #0ea5e9;
  color: #fff;
}
.psb-btn-primary:hover:not(:disabled) { background: #0284c7; }

/* Status bubbles */
.psb-bubble-success {
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}
.psb-bubble-success .psb-bubble-icon { color: #059669; }
.psb-bubble-error {
  background: #fef2f2;
  color: #7f1d1d;
  border: 1px solid #fecaca;
}
.psb-bubble-error .psb-bubble-icon { color: #dc2626; }
.psb-result-kind {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 999px;
  white-space: nowrap;
  flex-shrink: 0;
}

/* Composer */
.psb-composer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid #f1f5f9;
  background: #fff;
}
.psb-composer-input {
  flex: 1;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px 14px;
  font: inherit;
  font-size: 14.5px;
  background: #f8fafc;
  outline: 0;
  color: #0f172a;
  transition: border-color 120ms ease, background 120ms ease;
}
.psb-composer-input:focus {
  border-color: #0ea5e9;
  background: #fff;
}
.psb-composer-input::placeholder { color: #94a3b8; }
.psb-composer-send {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0ea5e9;
  color: #fff;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 120ms ease;
}
.psb-composer-send:hover:not(:disabled) { background: #0284c7; }
.psb-composer-send:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}

.spin { animation: psb-spin 0.9s linear infinite; }
@keyframes psb-spin { to { transform: rotate(360deg); } }

@media (max-width: 640px) {
  .psb-overlay { padding-top: 6vh; align-items: stretch; }
  .psb-palette {
    width: calc(100vw - 16px);
    max-height: 90vh;
  }
}
</style>
