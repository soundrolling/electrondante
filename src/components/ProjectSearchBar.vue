<template>
  <div class="project-search">
    <!-- Inline search bar -->
    <div class="psb-inline" :class="{ 'psb-inline-open': inlineOpen }">
      <Search :size="16" :stroke-width="2" class="psb-icon" />
      <input
        ref="inlineInputRef"
        v-model="query"
        type="search"
        :placeholder="placeholder"
        class="psb-input"
        autocomplete="off"
        spellcheck="false"
        @input="onQueryInput($event.target.value)"
        @focus="inlineOpen = true"
        @blur="onInlineBlur"
        @keydown.down.prevent="moveSelection(1, 'inline')"
        @keydown.up.prevent="moveSelection(-1, 'inline')"
        @keydown.enter.prevent="onEnter('inline')"
        @keydown.esc="onInlineEsc"
      />
      <kbd v-if="!inlineOpen" class="psb-kbd">{{ shortcutLabel }}</kbd>
      <button
        v-if="query"
        type="button"
        class="psb-clear"
        aria-label="Clear search"
        @mousedown.prevent
        @click="clearQuery('inline')"
      >
        <X :size="14" :stroke-width="2" />
      </button>

      <!-- Inline dropdown -->
      <div
        v-if="inlineOpen && (query.length >= 2 || results.length)"
        class="psb-dropdown"
        @mousedown.prevent
      >
        <div v-if="loading && !results.length" class="psb-empty">
          <Loader2 :size="14" class="spin" /> Searching…
        </div>
        <div v-else-if="!loading && query.length >= 2 && !results.length" class="psb-empty">
          No matches in this project.
        </div>
        <ul v-else class="psb-results">
          <li
            v-for="(r, i) in results"
            :key="r.id"
            class="psb-result"
            :class="{ selected: i === selected }"
            @mouseenter="selected = i"
            @click="goToResult(r)"
          >
            <component :is="iconFor(r)" :size="16" :stroke-width="2" class="psb-result-icon" />
            <div class="psb-result-body">
              <div class="psb-result-title">{{ r.title || labelForResult(r) }}</div>
              <div class="psb-result-snippet">{{ snippet(r) }}</div>
            </div>
            <span class="psb-result-kind">{{ labelForResult(r) }}</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- Cmd-K palette overlay -->
    <Transition name="psb-fade">
      <div v-if="paletteOpen" class="psb-overlay" @click.self="closePalette" @keydown.esc="closePalette">
        <div class="psb-palette" role="dialog" aria-label="Project search">
          <div class="psb-palette-input-wrap">
            <Search :size="18" :stroke-width="2" class="psb-icon" />
            <input
              ref="paletteInputRef"
              v-model="query"
              type="search"
              :placeholder="paletteplaceholder"
              class="psb-palette-input"
              autocomplete="off"
              spellcheck="false"
              @input="onQueryInput($event.target.value)"
              @keydown.down.prevent="moveSelection(1, 'palette')"
              @keydown.up.prevent="moveSelection(-1, 'palette')"
              @keydown.enter.prevent="onEnter('palette')"
              @keydown.esc="closePalette"
            />
            <kbd class="psb-kbd">esc</kbd>
          </div>
          <div class="psb-palette-body">
            <div v-if="loading && !results.length" class="psb-empty">
              <Loader2 :size="14" class="spin" /> Searching…
            </div>
            <div v-else-if="!loading && query.length >= 2 && !results.length" class="psb-empty">
              No matches in this project.
            </div>
            <div v-else-if="!query" class="psb-empty psb-hint">
              Type to search across notes, contacts, stages, schedules, gear, docs, travel…
            </div>
            <ul v-else class="psb-results">
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
        </div>
      </div>
    </Transition>
  </div>
</template>

<script>
import { computed, onMounted, onUnmounted, ref, nextTick, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  Search, X, Loader2,
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

export default {
  name: 'ProjectSearchBar',
  components: { Search, X, Loader2 },
  props: {
    projectId: { type: String, required: true },
    placeholder: { type: String, default: 'Search this project…' },
    paletteplaceholder: { type: String, default: 'Search notes, contacts, gear, schedule…' },
  },
  setup(props) {
    const router = useRouter();
    const { query, results, loading, search, reset, rebuildIndex } =
      useProjectSearch(() => props.projectId);

    const inlineOpen = ref(false);
    const paletteOpen = ref(false);
    const selected = ref(0);
    const inlineInputRef = ref(null);
    const paletteInputRef = ref(null);

    const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform || '');
    const shortcutLabel = computed(() => (isMac ? '⌘K' : 'Ctrl K'));

    function onQueryInput(v) {
      selected.value = 0;
      search(v);
    }
    function clearQuery(mode) {
      reset();
      nextTick(() => {
        if (mode === 'palette') paletteInputRef.value?.focus();
        else inlineInputRef.value?.focus();
      });
    }
    function moveSelection(delta) {
      if (!results.value.length) return;
      const n = results.value.length;
      selected.value = ((selected.value + delta) % n + n) % n;
    }
    function onEnter(mode) {
      const r = results.value[selected.value];
      if (r) goToResult(r);
      else if (mode === 'palette') closePalette();
    }
    function onInlineEsc() {
      if (query.value) {
        clearQuery('inline');
      } else {
        inlineOpen.value = false;
        inlineInputRef.value?.blur();
      }
    }
    function onInlineBlur() {
      // Slight delay so result clicks register before we collapse the dropdown
      setTimeout(() => { inlineOpen.value = false; }, 120);
    }

    function goToResult(r) {
      const target = routeForResult(props.projectId, r);
      const wasPalette = paletteOpen.value;
      closePalette();
      inlineOpen.value = false;
      reset();
      router.push(target).catch(() => {});
      if (wasPalette) inlineInputRef.value?.blur();
    }

    function openPalette() {
      paletteOpen.value = true;
      selected.value = 0;
      nextTick(() => paletteInputRef.value?.focus());
    }
    function closePalette() {
      paletteOpen.value = false;
    }

    async function reindex() {
      try {
        await rebuildIndex();
        // Re-run the query so the new embeddings are picked up
        if (query.value) search(query.value);
      } catch (e) {
        console.error('embed-index failed', e);
      }
    }

    function iconFor(r) { return ICONS[r?.source_table] || Folder; }
    function snippet(r) {
      const c = r?.content || '';
      return c.length > 140 ? c.slice(0, 140) + '…' : c;
    }

    function onKeydown(e) {
      // Cmd/Ctrl + K toggles the palette
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (paletteOpen.value) closePalette(); else openPalette();
      } else if (paletteOpen.value && e.key === 'Escape') {
        e.preventDefault();
        closePalette();
      }
    }

    onMounted(() => { document.addEventListener('keydown', onKeydown); });
    onUnmounted(() => { document.removeEventListener('keydown', onKeydown); });

    // Reset selection any time results swap
    watch(results, () => { selected.value = 0; });

    return {
      query, results, loading,
      inlineOpen, paletteOpen, selected,
      inlineInputRef, paletteInputRef,
      shortcutLabel,
      onQueryInput, clearQuery, moveSelection, onEnter,
      onInlineEsc, onInlineBlur,
      openPalette, closePalette,
      goToResult, reindex,
      iconFor, snippet, labelForResult,
    };
  },
};
</script>

<style scoped>
.project-search { position: relative; width: 100%; }

/* Inline bar */
.psb-inline {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 8px 12px;
  transition: border-color 120ms ease, background 120ms ease, box-shadow 120ms ease;
}
.psb-inline:focus-within,
.psb-inline-open {
  background: #fff;
  border-color: #cbd5e1;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.psb-icon { color: #64748b; flex-shrink: 0; }
.psb-input {
  flex: 1;
  background: transparent;
  border: 0;
  outline: 0;
  font: inherit;
  color: #0f172a;
  padding: 0;
  min-width: 0;
}
.psb-input::placeholder { color: #94a3b8; }
.psb-kbd {
  font: 11px ui-monospace, Menlo, monospace;
  color: #64748b;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 5px;
  padding: 1px 5px;
}
.psb-clear {
  border: 0; background: transparent; color: #64748b; cursor: pointer;
  padding: 2px; border-radius: 6px;
}
.psb-clear:hover { background: #f1f5f9; color: #0f172a; }

/* Dropdown */
.psb-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  max-height: 50vh;
  overflow: auto;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 16px 40px -10px rgba(15, 23, 42, 0.18), 0 2px 4px rgba(15, 23, 42, 0.05);
  z-index: 90;
}

/* Results list (shared with palette) */
.psb-results { list-style: none; margin: 0; padding: 6px; }
.psb-result {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  color: #0f172a;
}
.psb-result.selected,
.psb-result:hover { background: #f1f5f9; }
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
.psb-empty {
  padding: 18px 16px;
  color: #64748b;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.psb-hint { padding: 16px; }
.psb-link {
  border: 0; background: transparent; padding: 0;
  color: #0ea5e9; cursor: pointer; font: inherit;
  text-decoration: underline;
}

/* Palette overlay */
.psb-overlay {
  position: fixed; inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
  z-index: 200;
}
.psb-palette {
  width: min(640px, calc(100vw - 32px));
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 30px 80px -20px rgba(2, 6, 23, 0.45);
  display: flex;
  flex-direction: column;
  max-height: 70vh;
}
.psb-palette-input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid #f1f5f9;
}
.psb-palette-input {
  flex: 1;
  border: 0;
  outline: 0;
  font-size: 16px;
  background: transparent;
  color: #0f172a;
}
.psb-palette-body { overflow: auto; padding: 4px 0; }

.psb-fade-enter-active, .psb-fade-leave-active { transition: opacity 120ms ease; }
.psb-fade-enter-from, .psb-fade-leave-to { opacity: 0; }

.spin { animation: psb-spin 0.9s linear infinite; }
@keyframes psb-spin { to { transform: rotate(360deg); } }

@media (max-width: 640px) {
  .psb-overlay { padding-top: 8vh; }
  .psb-palette { width: calc(100vw - 16px); }
}
</style>
