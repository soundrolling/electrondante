<template>
  <div class="project-search">
    <!-- Inline trigger: clicking opens the chat palette -->
    <button
      type="button"
      class="psb-trigger"
      :aria-label="placeholder"
      @click="openPalette"
    >
      <Search :size="16" :stroke-width="2" class="psb-icon" />
      <span class="psb-trigger-text">{{ placeholder }}</span>
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
          :aria-label="paletteplaceholder"
          @keydown.esc="closePalette"
        >
          <div class="psb-palette-head">
            <div class="psb-palette-title">
              <Sparkles :size="16" :stroke-width="2" class="psb-palette-title-icon" />
              <span>Project assistant</span>
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
                Ask anything about this project — notes, contacts, stages, schedule, gear, docs, travel.
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

                <div v-if="!answer && !results.length" class="psb-bubble psb-bubble-assistant">
                  <Sparkles :size="16" :stroke-width="2" class="psb-bubble-icon" />
                  <div class="psb-bubble-body">
                    Nothing in this project matched. Try rephrasing, or use a name, place, or topic.
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
                        <div class="psb-result-snippet">{{ snippet(r) }}</div>
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
  Search, X, Loader2, Sparkles, ArrowUp,
  StickyNote, User, MapPin, Building2, Calendar, FileText, File,
  Plane, BedDouble, Package, Folder,
} from 'lucide-vue-next';
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

const EXAMPLES = [
  'who is the FOH engineer?',
  'where are we staying?',
  'what time does load-in start on the show day?',
  'show me notes about stage right',
  'which flights leave London?',
  'what gear is rented?',
];

export default {
  name: 'ProjectSearchBar',
  components: { Search, X, Loader2, Sparkles, ArrowUp },
  props: {
    projectId: { type: String, required: true },
    placeholder: { type: String, default: 'Ask anything about this project…' },
    paletteplaceholder: { type: String, default: 'Project assistant' },
  },
  setup(props) {
    const router = useRouter();
    const { query, results, answer, loading, submit, reset } =
      useProjectSearch(() => props.projectId);

    const paletteOpen = ref(false);
    const selected = ref(0);
    const paletteInputRef = ref(null);
    const bodyRef = ref(null);
    const draft = ref('');

    const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform || '');
    const shortcutLabel = computed(() => (isMac ? '⌘K' : 'Ctrl K'));
    const examples = EXAMPLES;

    const canSubmit = computed(() => !loading.value && draft.value.trim().length >= 2);
    const composerPlaceholder = computed(() => (query.value ? 'Ask a follow-up…' : 'Ask anything…'));

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
      paletteOpen, selected, paletteInputRef, bodyRef,
      draft, canSubmit, composerPlaceholder,
      shortcutLabel, examples,
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
.psb-result-snippet {
  margin-top: 2px;
  font-size: 12.5px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
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
