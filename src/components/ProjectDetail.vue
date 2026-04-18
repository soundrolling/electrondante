<template>
<div class="project-detail">
  <!-- Loading State -->
  <div v-if="isLoading" class="loading-skeleton">
    <div class="skeleton-header"></div>
    <div class="skeleton-meta"></div>
    <div class="skeleton-stages">
      <div class="skeleton-stage"></div>
      <div class="skeleton-stage"></div>
      <div class="skeleton-stage"></div>
    </div>
    <div class="skeleton-actions">
      <div class="skeleton-action"></div>
      <div class="skeleton-action"></div>
      <div class="skeleton-action"></div>
      <div class="skeleton-action"></div>
    </div>
  </div>

  <!-- Project Content -->
  <div v-else-if="currentProject" class="project-content">
    <!-- Status Hero -->
    <section class="status-hero">
      <div class="hero-top">
        <h1 class="hero-title">{{ currentProject.project_name }}</h1>
        <span v-if="nextKeyDate" :class="['hero-next', nextKeyDate.kind]">
          <Drama v-if="nextKeyDate.kind === 'show'" :size="14" :stroke-width="2" />
          <Hammer v-else :size="14" :stroke-width="2" />
          <span class="hero-next-label">
            {{ nextKeyDate.relative }} {{ nextKeyDate.kind === 'show' ? 'show' : 'build' }}
          </span>
          <span class="hero-next-date">· {{ nextKeyDate.short }}</span>
        </span>
      </div>
      <div class="hero-meta">
        <span v-if="currentProject.location" class="meta-inline">
          <MapPin :size="14" :stroke-width="2" />
          <span>{{ currentProject.location }}</span>
        </span>
        <a
          v-if="currentProject.official_website"
          :href="currentProject.official_website"
          target="_blank"
          rel="noopener"
          class="meta-inline meta-link"
        >
          <Globe :size="14" :stroke-width="2" />
          <span>Official site</span>
        </a>
      </div>

      <!-- Mini calendar strip -->
      <div
        v-if="timeline"
        class="date-strip"
        role="group"
        aria-label="Build and show days"
      >
        <div class="date-strip-header">
          <span class="legend-item">
            <span class="legend-dot build"></span>
            <Hammer :size="12" :stroke-width="2" />
            <span>{{ (currentProject.build_days || []).length }} build</span>
          </span>
          <span class="legend-item">
            <span class="legend-dot show"></span>
            <Drama :size="12" :stroke-width="2" />
            <span>{{ (currentProject.main_show_days || []).length }} show</span>
          </span>
        </div>
        <div class="date-strip-months">
          <div
            v-for="m in stripMonths"
            :key="m.key"
            class="date-strip-month"
            :style="{ flex: m.count }"
          >
            <span class="month-label">{{ m.label }}</span>
          </div>
        </div>
        <div class="date-strip-numbers">
          <span
            v-for="(d, di) in stripDays"
            :key="'n'+di"
            class="day-number"
            :class="{ visible: d.isBuild || d.isShow }"
          >{{ d.day }}</span>
        </div>
        <div class="date-strip-track">
          <button
            v-for="(d, di) in stripDays"
            :key="di"
            type="button"
            :class="[
              'date-strip-cell',
              {
                build: d.isBuild,
                show: d.isShow,
                today: d.isToday,
                weekend: d.isWeekend,
                'month-start': d.isMonthStart,
                active: activeDayIdx === di,
                interactive: d.isBuild || d.isShow,
              }
            ]"
            :aria-label="(d.isBuild || d.isShow ? ((d.isBuild && d.isShow ? 'Build and show day · ' : d.isBuild ? 'Build day · ' : 'Show day · ')) : '') + d.label"
            :tabindex="(d.isBuild || d.isShow) ? 0 : -1"
            @click.stop="openDayDetail(di, d.isBuild || d.isShow)"
          ></button>
        </div>
        <div
          v-if="activeDayIdx !== null && stripDays[activeDayIdx]"
          class="date-strip-detail"
          role="status"
          @click.stop
        >
          <div class="date-strip-detail-kind">
            <template v-if="stripDays[activeDayIdx].isBuild && stripDays[activeDayIdx].isShow">
              <span class="legend-dot build"></span>
              <Hammer :size="12" :stroke-width="2" /> Build
              <span class="legend-dot show" style="margin-left:8px;"></span>
              <Drama :size="12" :stroke-width="2" /> Show
            </template>
            <template v-else-if="stripDays[activeDayIdx].isBuild">
              <span class="legend-dot build"></span>
              <Hammer :size="12" :stroke-width="2" /> Build Day
            </template>
            <template v-else>
              <span class="legend-dot show"></span>
              <Drama :size="12" :stroke-width="2" /> Show Day
            </template>
          </div>
          <div class="date-strip-detail-label">
            {{ stripDays[activeDayIdx].label }}
          </div>
        </div>
      </div>
    </section>

    <!-- Stages Rail -->
    <section v-if="stages.length" class="stages-rail-section" aria-label="Stages">
      <div class="rail-head">
        <h2 class="section-title">Stages</h2>
        <button class="rail-see-all" @click="goToLocations">
          <span>View all</span>
          <ArrowRight :size="14" :stroke-width="2" />
        </button>
      </div>
      <div class="stages-rail">
        <button
          v-for="stage in stages"
          :key="stage.id"
          class="stage-chip"
          @click="openStageModal(stage)"
          @touchstart="handleTouchStart"
          @touchend="handleTouchEnd"
        >
          <div class="stage-chip-icon">
            <LayoutGrid :size="18" :stroke-width="2" />
          </div>
          <div class="stage-chip-info">
            <div class="stage-chip-name">{{ stage.stage_name }}</div>
            <div v-if="stage.venue_name" class="stage-chip-venue">{{ stage.venue_name }}</div>
          </div>
        </button>
      </div>
    </section>

    <!-- Empty stages state -->
    <section v-else class="startup-section">
      <div class="startup-content">
        <div class="startup-icon">
          <LayoutGrid :size="28" :stroke-width="1.5" />
        </div>
        <h2 class="startup-title">Add your first stage</h2>
        <p class="startup-description">Organize recording locations and equipment by stage to get going.</p>
        <button class="btn btn-positive" @click="goToLocations">
          <Plus :size="16" :stroke-width="2" />
          <span>Add a stage</span>
        </button>
      </div>
    </section>

    <!-- Tool dock -->
    <section class="tool-dock-section" aria-label="Project tools">
      <h2 class="section-title">Project tools</h2>
      <div class="tool-dock">
        <button
          v-for="t in toolDock"
          :key="t.key"
          class="tool-tile"
          :class="{ active: t.key === 'tools' && showToolsSection }"
          @click="t.action"
          @touchstart="handleTouchStart"
          @touchend="handleTouchEnd"
        >
          <div class="tool-tile-icon">
            <component :is="t.icon" :size="22" :stroke-width="1.75" />
          </div>
          <div class="tool-tile-label">{{ t.label }}</div>
        </button>
      </div>
    </section>

    <!-- Expandable utilities -->
    <section v-if="showToolsSection" class="utilities-section">
      <h2 class="section-title">Utilities</h2>
      <div class="utility-list">
        <button class="utility-row" @click="openTool('ltc')">
          <div class="utility-icon"><Clock :size="20" :stroke-width="2" /></div>
          <div class="utility-info">
            <div class="utility-name">LTC Timecode Generator</div>
            <div class="utility-desc">Generate Linear Timecode audio signal</div>
          </div>
          <ChevronRight :size="16" :stroke-width="2" class="utility-chevron" />
        </button>
        <button class="utility-row" @click="openTool('audio-signal')">
          <div class="utility-icon"><AudioWaveform :size="20" :stroke-width="2" /></div>
          <div class="utility-info">
            <div class="utility-name">Audio Signal Generator</div>
            <div class="utility-desc">Sine waves, noise, and sweeps</div>
          </div>
          <ChevronRight :size="16" :stroke-width="2" class="utility-chevron" />
        </button>
        <button class="utility-row" @click="goToDanteMixer">
          <div class="utility-icon"><Sliders :size="20" :stroke-width="2" /></div>
          <div class="utility-info">
            <div class="utility-name">Dante Monitor Mixer</div>
            <div class="utility-desc">Personal monitor mixing for live performance</div>
          </div>
          <ChevronRight :size="16" :stroke-width="2" class="utility-chevron" />
        </button>
      </div>
    </section>
    </div>

  <!-- Error State -->
  <div v-else class="error-state">
    <div class="error-icon">
      <AlertCircle :size="32" :stroke-width="1.5" />
    </div>
    <h2 class="error-title">Unable to load project</h2>
    <p class="error-message">Please check your connection and try again.</p>
    <button class="btn btn-primary" @click="loadProject">
      <RefreshCw :size="16" :stroke-width="2" />
      <span>Retry</span>
    </button>
  </div>

  <!-- Stage Modal -->
  <StageQuickAccessMenu
    v-if="showStageModal && selectedStage"
    :stage="selectedStage"
    :project-id="currentProject?.id"
    :stages="stages"
    :visible="showStageModal"
    @close="closeStageModal"
    @stage-change="handleStageChange"
  />

  <!-- Tool Modal -->
  <div v-if="showToolModal && selectedTool" class="tool-modal-backdrop" @click.self="closeToolModal">
    <div class="tool-modal">
      <div class="tool-modal-header">
        <h2 class="tool-modal-title">{{ toolTitle }}</h2>
        <button class="tool-modal-close" @click="closeToolModal">×</button>
      </div>
      <div class="tool-modal-body">
        <LTCTimecodeGenerator v-if="selectedTool === 'ltc'" />
        <AudioSignalGenerator v-if="selectedTool === 'audio-signal'" />
      </div>
    </div>
  </div>

</div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, markRaw } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '../stores/userStore';
import { supabase } from '../supabase';
import { fetchTableData } from '../services/dataService';
import { cachedFetch } from '@/services/queryCache';
import StageQuickAccessMenu from './stage/StageQuickAccessMenu.vue';
import LTCTimecodeGenerator from './tools/LTCTimecodeGenerator.vue';
import AudioSignalGenerator from './tools/AudioSignalGenerator.vue';
import {
  MapPin,
  Globe,
  Hammer,
  Drama,
  ArrowRight,
  Plus,
  LayoutGrid,
  Calendar,
  Plane,
  Users,
  Settings,
  Wrench,
  FileText,
  Database,
  SlidersHorizontal,
  Clock,
  AudioWaveform,
  Sliders,
  ChevronRight,
  AlertCircle,
  RefreshCw,
} from 'lucide-vue-next';

export default {
  name: 'ProjectDetail',
  components: {
    StageQuickAccessMenu,
    LTCTimecodeGenerator,
    AudioSignalGenerator,
    MapPin,
    Globe,
    Hammer,
    Drama,
    ArrowRight,
    Plus,
    LayoutGrid,
    Calendar,
    Plane,
    Users,
    Settings,
    Wrench,
    FileText,
    Database,
    SlidersHorizontal,
    Clock,
    AudioWaveform,
    Sliders,
    ChevronRight,
    AlertCircle,
    RefreshCw,
  },
  setup() {
    const route      = useRoute();
    const router     = useRouter();
    const userStore  = useUserStore();

    const isLoading       = ref(true);
    const currentProject  = computed(() => userStore.getCurrentProject);
    const stages          = ref([]);
    const showStageModal  = ref(false);
    const selectedStage   = ref(null);
    const showToolsSection = ref(false);
    const buildDaysOpen    = ref(false);
    const showDaysOpen     = ref(false);
    const showToolModal   = ref(false);
    const selectedTool    = ref(null);
    const activeDayIdx    = ref(null);
    const isMobileStrip   = ref(window.innerWidth < 640);

    const openDayDetail = (idx, hasMark) => {
      if (!hasMark) { activeDayIdx.value = null; return; }
      activeDayIdx.value = activeDayIdx.value === idx ? null : idx;
    };

    const handleDocClick = (e) => {
      if (activeDayIdx.value !== null && !e.target.closest('.date-strip')) {
        activeDayIdx.value = null;
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') activeDayIdx.value = null;
    };
    const handleResize = () => { isMobileStrip.value = window.innerWidth < 640; };

    onMounted(() => {
      loadProject();
      document.addEventListener('click', handleDocClick);
      document.addEventListener('keydown', handleEsc);
      window.addEventListener('resize', handleResize, { passive: true });
    });
    onUnmounted(() => {
      document.removeEventListener('click', handleDocClick);
      document.removeEventListener('keydown', handleEsc);
      window.removeEventListener('resize', handleResize);
    });

    /* ---------------- Project loading ---------------- */
    async function loadProject() {
      try {
        const projectId = route.params.id;
        if (!projectId) { isLoading.value = false; return; }

        const { data } = await cachedFetch(
          `project:detail:${projectId}`,
          async () => {
            const { data: row, error } = await supabase
              .from('projects').select('*').eq('id', projectId).single();
            if (error) throw error;
            return row;
          },
          {
            ttl: 5 * 60 * 1000,
            onUpdate: (fresh) => { if (fresh) userStore.setCurrentProject(fresh); }
          }
        );

        if (data) userStore.setCurrentProject(data);

        // Load stages for this project
        await loadStages();
      } catch (err) {
        console.error('Unexpected error fetching project:', err.message);
      } finally {
        isLoading.value = false;
      }
    }

    /* ---------------- Stages loading ---------------- */
    async function loadStages() {
      try {
        const projectId = route.params.id;
        const { data } = await cachedFetch(
          `project:stages:${projectId}`,
          () => fetchTableData('locations', {
            eq: { project_id: projectId },
            order: [{ column: 'order', ascending: true }],
          }),
          {
            ttl: 5 * 60 * 1000,
            onUpdate: (fresh) => { stages.value = fresh ?? []; }
          }
        );
        stages.value = data ?? [];
      } catch (err) {
        console.error('Error loading stages:', err.message);
        stages.value = [];
      }
    }

    /* ---------------- Navigation helpers ---------------- */
    function goToLocations() {
      router.push({ name: 'ProjectLocations', params: { id: currentProject.value.id } });
    }
    function goToCalendar() {
      router.push({ name: 'Calendar', params: { id: currentProject.value.id } });
    }
    function goToTravelHub() {
      router.push({ name: 'TravelDashboard', params: { id: currentProject.value.id } });
    }
    function goToContacts() {
      router.push({ name: 'ProjectContacts', params: { id: currentProject.value.id } });
    }
    function goToSettings() {
      router.push({ name: 'ProjectSettings', params: { id: currentProject.value.id } });
    }
    function goToGear() {
      router.push({ name: 'ProjectGear', params: { id: currentProject.value.id } });
    }
    function goToDocuments() {
      router.push({ name: 'ProjectDocs', params: { id: currentProject.value.id } });
    }
    function goToDataManagement() {
      router.push({ name: 'DataManagement', params: { id: currentProject.value.id } });
    }
    function goToDanteMixer() {
      router.push({ name: 'DanteMonitorMixer', params: { id: currentProject.value.id } });
    }

    /* ---------------- Touch feedback ---------------- */
    function handleTouchStart(event) {
      event.currentTarget.classList.add('touch-active');
    }
    function handleTouchEnd(event) {
      event.currentTarget.classList.remove('touch-active');
    }

    /* ---------------- Stage navigation helpers ---------------- */
    function openStageModal(stage) {
      selectedStage.value = stage;
      showStageModal.value = true;
    }
    function closeStageModal() {
      showStageModal.value = false;
      selectedStage.value = null;
    }
    function handleStageChange(stageId) {
      const newStage = stages.value.find(s => s.id === stageId);
      if (newStage) {
        selectedStage.value = newStage;
      }
    }

    /* ---------------- Tool navigation helpers ---------------- */
    function openTool(toolName) {
      selectedTool.value = toolName;
      showToolModal.value = true;
    }
    function closeToolModal() {
      showToolModal.value = false;
      selectedTool.value = null;
    }

    const toolTitle = computed(() => {
      if (selectedTool.value === 'ltc') return 'LTC Timecode Generator';
      if (selectedTool.value === 'audio-signal') return 'Audio Signal Generator';
      return 'Tool';
    });

    function ordinal(n) {
      const s = ["th", "st", "nd", "rd"], v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }
    function formatSingleDate(dStr) {
      if (!dStr) return '';
      const d = new Date(dStr);
      const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
      const day = ordinal(d.getDate());
      const month = d.toLocaleDateString(undefined, { month: 'long' });
      const year = d.getFullYear();
      return `${weekday} ${day} ${month} ${year}`;
    }
    function formatDateRange(dateArray) {
      if (!dateArray || dateArray.length === 0) return '';
      if (dateArray.length === 1) {
        return formatSingleDate(dateArray[0]);
      }
      const start = formatSingleDate(dateArray[0]);
      const end = formatSingleDate(dateArray[dateArray.length - 1]);
      if (start === end) {
        return start;
      }
      return `${start} - ${end}`;
    }

    /* ---------------- Timeline ---------------- */
    const startOfDay = (ds) => {
      const d = new Date(ds);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    };

    const timeline = computed(() => {
      const p = currentProject.value;
      if (!p) return null;
      const build = (p.build_days || []).filter(Boolean);
      const show = (p.main_show_days || []).filter(Boolean);
      if (!build.length && !show.length) return null;
      const buildSet = new Set(build.map(startOfDay).filter(t => !Number.isNaN(t)));
      const showSet = new Set(show.map(startOfDay).filter(t => !Number.isNaN(t)));
      const all = [...buildSet, ...showSet];
      if (!all.length) return null;
      const minT = Math.min(...all);
      const maxT = Math.max(...all);
      const startDate = new Date(minT);
      const endDate = new Date(maxT);
      const stripStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const stripEnd = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
      const today = startOfDay(new Date());
      const oneDay = 86400000;
      const days = [];
      const months = [];
      for (let t = stripStart.getTime(); t <= stripEnd.getTime(); t += oneDay) {
        const d = new Date(t);
        const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
        const dayTime = startOfDay(d);
        if (!months.length || months[months.length - 1].key !== monthKey) {
          months.push({
            key: monthKey,
            label: d.toLocaleDateString('en-US', { month: 'short' }),
            count: 1,
          });
        } else {
          months[months.length - 1].count += 1;
        }
        const weekDay = d.getDay();
        const iso = d.toISOString().slice(0, 10);
        days.push({
          date: iso,
          day: d.getDate(),
          isBuild: buildSet.has(dayTime),
          isShow: showSet.has(dayTime),
          isToday: dayTime === today,
          isWeekend: weekDay === 0 || weekDay === 6,
          isMonthStart: d.getDate() === 1 && days.length > 0,
          label: formatSingleDate(iso),
        });
      }
      const firstSchedIdx = days.findIndex(d => d.isBuild || d.isShow);
      const lastSchedIdx  = days.length - 1 - [...days].reverse().findIndex(d => d.isBuild || d.isShow);
      let trimmedDays = days;
      let trimmedMonths = months;
      if (firstSchedIdx >= 0) {
        trimmedDays = days.slice(firstSchedIdx, lastSchedIdx + 1);
        trimmedMonths = [];
        for (const d of trimmedDays) {
          const [yr, mo] = d.date.split('-').map(Number);
          const monthKey = `${yr}-${mo - 1}`;
          const label = new Date(yr, mo - 1, 1).toLocaleDateString('en-US', { month: 'short' });
          if (!trimmedMonths.length || trimmedMonths[trimmedMonths.length - 1].key !== monthKey) {
            trimmedMonths.push({ key: monthKey, label, count: 1 });
          } else {
            trimmedMonths[trimmedMonths.length - 1].count++;
          }
        }
      }
      return { months, days, trimmedMonths, trimmedDays };
    });

    const stripDays   = computed(() => timeline.value
      ? (isMobileStrip.value ? timeline.value.trimmedDays : timeline.value.days) : []);
    const stripMonths = computed(() => timeline.value
      ? (isMobileStrip.value ? timeline.value.trimmedMonths : timeline.value.months) : []);

    /* ---------------- Next key date ---------------- */
    const formatRelative = (targetMs) => {
      const today = startOfDay(new Date());
      const diffDays = Math.round((targetMs - today) / 86400000);
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Tomorrow';
      if (diffDays === -1) return 'Yesterday';
      if (diffDays > 1 && diffDays < 14) return `In ${diffDays} days`;
      if (diffDays < -1 && diffDays > -14) return `${Math.abs(diffDays)} days ago`;
      const d = new Date(targetMs);
      return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    };
    const formatShort = (targetMs) => {
      const d = new Date(targetMs);
      return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    };

    const nextKeyDate = computed(() => {
      const p = currentProject.value;
      if (!p) return null;
      const items = [];
      (p.main_show_days || []).forEach(d => items.push({ kind: 'show', t: startOfDay(d) }));
      (p.build_days || []).forEach(d => items.push({ kind: 'build', t: startOfDay(d) }));
      const valid = items.filter(i => !Number.isNaN(i.t));
      if (!valid.length) return null;
      const today = startOfDay(new Date());
      const future = valid.filter(i => i.t >= today).sort((a, b) => a.t - b.t);
      const past = valid.sort((a, b) => b.t - a.t);
      const chosen = future[0] || past[0];
      if (!chosen) return null;
      return {
        kind: chosen.kind,
        relative: formatRelative(chosen.t),
        short: formatShort(chosen.t),
      };
    });

    /* ---------------- Tool dock ---------------- */
    const toolDock = computed(() => [
      { key: 'stages', label: 'All Stages', icon: markRaw(LayoutGrid), action: goToLocations },
      { key: 'calendar', label: 'Calendar', icon: markRaw(Calendar), action: goToCalendar },
      { key: 'travel', label: 'Travel + Accommodation', icon: markRaw(Plane), action: goToTravelHub },
      { key: 'contacts', label: 'Contacts', icon: markRaw(Users), action: goToContacts },
      { key: 'gear', label: 'Gear', icon: markRaw(Wrench), action: goToGear },
      { key: 'documents', label: 'Docs', icon: markRaw(FileText), action: goToDocuments },
      { key: 'data', label: 'Data', icon: markRaw(Database), action: goToDataManagement },
      { key: 'settings', label: 'Settings', icon: markRaw(Settings), action: goToSettings },
      { key: 'tools', label: 'Utilities', icon: markRaw(SlidersHorizontal), action: () => { showToolsSection.value = !showToolsSection.value; } },
    ]);

    function groupConsecutiveDates(dates) {
      if (!dates || !dates.length) return [];
      const sorted = [...dates].sort();
      const groups = [[sorted[0]]];
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1]);
        const curr = new Date(sorted[i]);
        prev.setDate(prev.getDate() + 1);
        if (prev.toISOString().slice(0, 10) === curr.toISOString().slice(0, 10)) {
          groups[groups.length - 1].push(sorted[i]);
        } else {
          groups.push([sorted[i]]);
        }
      }
      return groups;
    }

    function formatBuildDays(dateArray) {
      if (!dateArray || dateArray.length === 0) return '';
      const groups = groupConsecutiveDates(dateArray);
      return groups.map(group => {
        if (group.length === 1) return formatSingleDate(group[0]);
        return `${formatSingleDate(group[0])} – ${formatSingleDate(group[group.length - 1])}`;
      }).join(' · ');
    }

    return {
      isLoading,
      currentProject,
      stages,
      /* navigation */
      goToLocations,
      goToCalendar,
      goToTravelHub,
      goToContacts,
      goToSettings,
      goToGear,
      goToDocuments,
      goToDataManagement,
      goToDanteMixer,
      /* stage navigation */
      openStageModal,
      closeStageModal,
      handleStageChange,
      formatSingleDate,
      formatDateRange,
      formatBuildDays,
      groupConsecutiveDates,
      buildDaysOpen,
      showDaysOpen,
      showStageModal,
      selectedStage,
      /* touch feedback */
      handleTouchStart,
      handleTouchEnd,
      loadProject,
      /* tools */
      showToolsSection,
      showToolModal,
      selectedTool,
      openTool,
      closeToolModal,
      toolTitle,
      /* new UI */
      timeline,
      stripDays,
      stripMonths,
      nextKeyDate,
      toolDock,
      activeDayIdx,
      openDayDetail,
    };
  },
};
</script>

<style scoped>
/* ─── Base container ───────────────────────────────────── */
.project-detail {
  min-height: 100vh;
  background: var(--bg-primary);
  padding: var(--space-4);
  padding-top: env(safe-area-inset-top, var(--space-4));
  padding-bottom: env(safe-area-inset-bottom, var(--space-4));
  font-family: var(--font-family-sans);
  line-height: var(--leading-normal);
  color: var(--text-primary);
  max-width: 960px;
  margin: 0 auto;
}

.project-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.section-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  margin: 0;
  letter-spacing: -0.01em;
}

/* ─── Status hero ──────────────────────────────────────── */
.status-hero {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
.hero-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.hero-title {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  letter-spacing: -0.02em;
  color: var(--text-heading);
  margin: 0;
  line-height: 1.15;
  text-transform: uppercase;
  word-break: break-word;
  min-width: 0;
  flex: 1 1 auto;
}
.hero-next {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  flex-shrink: 0;
  line-height: 1.2;
  white-space: nowrap;
}
.hero-next.show {
  background: rgba(217, 119, 6, 0.1);
  color: var(--color-warning-700);
}
.hero-next.build {
  background: rgba(14, 165, 233, 0.1);
  color: var(--color-primary-700);
}
.hero-next svg { flex-shrink: 0; }
.hero-next-label { font-weight: var(--font-semibold); }
.hero-next-date { color: inherit; opacity: 0.85; }

.hero-meta {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
.meta-inline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
}
.meta-inline svg { color: var(--text-tertiary); flex-shrink: 0; }
.meta-link {
  color: var(--color-primary-600);
  text-decoration: none;
}
.meta-link svg { color: var(--color-primary-500); }
.meta-link:hover { color: var(--color-primary-700); text-decoration: underline; }

/* ─── Date strip (shared visual language) ──────────────── */
.date-strip {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: var(--surface-card-muted);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
}
.date-strip-header {
  display: flex;
  gap: var(--space-3);
  font-size: 11px;
  color: var(--text-tertiary);
  font-weight: var(--font-medium);
  padding-bottom: 2px;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-secondary);
}
.legend-item svg { color: var(--text-tertiary); }
.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
}
.legend-dot.build { background: var(--color-primary-500); }
.legend-dot.show { background: var(--color-warning-500); }

.date-strip-months {
  display: flex;
  gap: 1px;
  height: 14px;
}
.date-strip-month {
  min-width: 0;
  position: relative;
  border-left: 1px solid var(--surface-border);
  padding-left: 4px;
  display: flex;
  align-items: center;
  overflow: hidden;
}
.date-strip-month:first-child { border-left: none; padding-left: 0; }
.month-label {
  font-size: 10px;
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.date-strip-numbers {
  display: flex;
  gap: 1px;
  height: 12px;
  align-items: flex-end;
}
.day-number {
  flex: 1 1 0;
  min-width: 2px;
  font-size: 9px;
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  text-align: center;
  line-height: 1;
  letter-spacing: -0.02em;
  visibility: hidden;
  white-space: nowrap;
}
.day-number.visible { visibility: visible; }

.date-strip-track {
  display: flex;
  gap: 1px;
  height: 20px;
  align-items: stretch;
}
.date-strip-cell {
  flex: 1 1 0;
  min-width: 2px;
  background: var(--chip-bg);
  border-radius: 2px;
  transition: transform 120ms ease, background 120ms ease, box-shadow 120ms ease;
  position: relative;
  cursor: default;
  padding: 0;
  border: none;
  appearance: none;
}
.date-strip-cell.interactive { cursor: pointer; }
.date-strip-cell.interactive:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--focus-ring);
  z-index: 3;
}
.date-strip-cell.weekend {
  background: color-mix(in srgb, var(--chip-bg) 70%, var(--surface-border));
}
.date-strip-cell.build {
  background: var(--color-primary-500);
  box-shadow: inset 0 0 0 1px var(--color-primary-600);
}
.date-strip-cell.show {
  background: var(--color-warning-500);
  box-shadow: inset 0 0 0 1px var(--color-warning-600);
}
.date-strip-cell.build.show {
  background: linear-gradient(180deg, var(--color-primary-500) 0%, var(--color-primary-500) 50%, var(--color-warning-500) 50%, var(--color-warning-500) 100%);
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08);
}
.date-strip-cell.today {
  box-shadow: 0 0 0 1px var(--color-primary-600), inset 0 0 0 1px #ffffff;
}
.date-strip-cell:hover { transform: scaleY(1.2); z-index: 2; }
.date-strip-cell.active {
  transform: scaleY(1.35);
  z-index: 3;
  box-shadow: 0 0 0 2px var(--color-primary-600);
}
@media (hover: none) {
  .date-strip-cell:hover { transform: none; }
}

.date-strip-detail {
  margin-top: 6px;
  padding: 8px 10px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: 4px;
  animation: detailIn 140ms ease-out;
}
.date-strip-detail-kind {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.date-strip-detail-kind svg { color: var(--text-tertiary); }
.date-strip-detail-label {
  font-size: var(--text-sm);
  color: var(--text-primary);
  font-weight: var(--font-medium);
}
@keyframes detailIn {
  from { opacity: 0; transform: translateY(-2px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ─── Stages rail ──────────────────────────────────────── */
.stages-rail-section { display: flex; flex-direction: column; gap: var(--space-2); }
.rail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.rail-see-all {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  color: var(--color-primary-600);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: var(--radius-sm);
}
.rail-see-all:hover {
  background: var(--surface-hover);
  color: var(--color-primary-700);
}
.stages-rail {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  padding-bottom: 4px;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}
.stages-rail::-webkit-scrollbar { height: 6px; }
.stages-rail::-webkit-scrollbar-thumb {
  background: var(--surface-border-strong);
  border-radius: 999px;
}
.stage-chip {
  flex-shrink: 0;
  min-width: 180px;
  scroll-snap-align: start;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: border-color var(--transition-normal), box-shadow var(--transition-normal), transform var(--transition-fast);
  text-align: left;
}
.stage-chip:hover {
  border-color: var(--surface-border-strong);
  box-shadow: var(--shadow-sm);
}
.stage-chip.touch-active { transform: scale(0.98); }
.stage-chip-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: var(--color-primary-50);
  color: var(--color-primary-600);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stage-chip-info { min-width: 0; }
.stage-chip-name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stage-chip-venue {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ─── Empty stages (startup) ───────────────────────────── */
.startup-section {
  background: var(--surface-card);
  border: 1px dashed var(--surface-border-strong);
  border-radius: var(--radius-lg);
  padding: var(--space-8) var(--space-4);
}
.startup-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-3);
}
.startup-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  background: var(--chip-bg);
  color: var(--text-tertiary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.startup-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  margin: 0;
}
.startup-description {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin: 0 0 var(--space-2) 0;
  max-width: 38ch;
}

/* ─── Tool dock ────────────────────────────────────────── */
.tool-dock-section { display: flex; flex-direction: column; gap: var(--space-2); }
.tool-dock {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
}
.tool-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: var(--space-3) var(--space-2);
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  cursor: pointer;
  transition: background var(--transition-normal), border-color var(--transition-normal), transform var(--transition-fast), box-shadow var(--transition-normal);
  min-height: 84px;
  text-align: center;
}
.tool-tile:hover {
  border-color: var(--surface-border-strong);
  box-shadow: var(--shadow-sm);
}
.tool-tile:active,
.tool-tile.touch-active {
  transform: scale(0.97);
  background: var(--surface-hover);
}
.tool-tile.active {
  background: var(--color-primary-50);
  border-color: var(--color-primary-200);
}
.tool-tile-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: var(--surface-card-muted);
  color: var(--color-primary-600);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.tool-tile.active .tool-tile-icon {
  background: var(--color-primary-100);
  color: var(--color-primary-700);
}
.tool-tile-label {
  font-size: 12px;
  font-weight: var(--font-medium);
  color: var(--text-primary);
  line-height: 1.2;
}

/* ─── Utilities list (collapsible) ─────────────────────── */
.utilities-section { display: flex; flex-direction: column; gap: var(--space-2); }
.utility-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.utility-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3);
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  text-align: left;
  transition: background var(--transition-normal), border-color var(--transition-normal), transform var(--transition-fast);
}
.utility-row:hover {
  background: var(--surface-hover);
  border-color: var(--surface-border-strong);
}
.utility-row:active { transform: scale(0.99); }
.utility-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: var(--surface-card-muted);
  color: var(--color-primary-600);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.utility-info { min-width: 0; flex: 1; }
.utility-name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  line-height: 1.2;
}
.utility-desc {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin-top: 2px;
}
.utility-chevron { color: var(--text-tertiary); flex-shrink: 0; }

/* ─── Loading skeleton ─────────────────────────────────── */
.loading-skeleton { display: flex; flex-direction: column; gap: var(--space-3); }
.skeleton-header,
.skeleton-meta,
.skeleton-stages,
.skeleton-actions,
.skeleton-stage,
.skeleton-action {
  background: linear-gradient(90deg, var(--surface-card-muted) 25%, var(--surface-hover) 50%, var(--surface-card-muted) 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: var(--radius-md);
}
.skeleton-header { height: 56px; }
.skeleton-meta { height: 32px; }
.skeleton-stages {
  height: 72px;
  display: flex;
  gap: var(--space-2);
}
.skeleton-stage { flex: 1; background: inherit; border-radius: var(--radius-md); }
.skeleton-actions {
  height: 200px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  background: transparent;
  animation: none;
}
.skeleton-action {
  background: linear-gradient(90deg, var(--surface-card-muted) 25%, var(--surface-hover) 50%, var(--surface-card-muted) 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: var(--radius-md);
}
@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ─── Error state ──────────────────────────────────────── */
.error-state {
  text-align: center;
  padding: var(--space-12) var(--space-4);
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}
.error-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  background: var(--color-error-50);
  color: var(--color-error-600);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.error-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  margin: 0;
}
.error-message {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin: 0 0 var(--space-3) 0;
}

/* ─── Tool modal (utility opens) ───────────────────────── */
.tool-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal-backdrop);
  padding: var(--space-4);
}
.tool-modal {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-xl);
  z-index: var(--z-modal);
}
.tool-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--surface-border);
}
.tool-modal-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  margin: 0;
}
.tool-modal-close {
  background: none;
  border: none;
  font-size: var(--text-xl);
  color: var(--text-secondary);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  min-width: 36px;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tool-modal-close:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}
.tool-modal-body { padding: var(--space-5); }

/* ─── Tablet ───────────────────────────────────────────── */
@media (min-width: 601px) {
  .project-detail { padding: var(--space-6); }
  .hero-title { font-size: var(--text-2xl); }
  .tool-dock { grid-template-columns: repeat(4, 1fr); gap: var(--space-3); }
  .tool-tile { min-height: 92px; }
  .tool-tile-label { font-size: var(--text-sm); }
  .stage-chip { min-width: 220px; }
}

/* ─── Desktop ──────────────────────────────────────────── */
@media (min-width: 1025px) {
  .project-detail { padding: var(--space-8); }
  .tool-dock { grid-template-columns: repeat(5, 1fr); }
  .status-hero { padding: var(--space-5); }
  .hero-title { font-size: var(--text-2xl); }
}

/* ─── Accessibility ────────────────────────────────────── */
@media (prefers-contrast: high) {
  .status-hero,
  .stage-chip,
  .tool-tile,
  .utility-row,
  .date-strip { border-width: 2px; }
}
@media (prefers-reduced-motion: reduce) {
  .stage-chip,
  .tool-tile,
  .utility-row,
  .date-strip-cell { transition: none; }
  .tool-tile:active,
  .stage-chip.touch-active,
  .utility-row:active { transform: none; }
  .date-strip-detail { animation: none; }
  .skeleton-header,
  .skeleton-meta,
  .skeleton-stages,
  .skeleton-stage,
  .skeleton-action { animation-duration: 3s; }
}
</style>

