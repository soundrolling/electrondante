<!-- ───────────────────────────────────────────────────────────
     src/components/Projects.vue
──────────────────────────────────────────────────────────────-->
<template>
<div class="projects">
  <!-- ─── PAGE TITLE ROW ───────────────────────────────────── -->
  <header class="page-head">
    <div class="page-head-inner">
      <div class="page-title-group">
        <h1 class="page-title">Projects</h1>
        <p v-if="!loading" class="page-subtitle">
          {{ displayedProjects.length }} {{ selectedStatus === 'archived' ? 'archived' : 'active' }}
          {{ displayedProjects.length === 1 ? 'project' : 'projects' }}
        </p>
      </div>
      <div class="page-head-actions">
        <button
          class="btn-primary new-project-btn"
          @click="toggleNewProjectForm"
          :aria-expanded="showNewProjectForm"
        >
          <X v-if="showNewProjectForm" :size="18" :stroke-width="2" />
          <Plus v-else :size="18" :stroke-width="2" />
          <span class="btn-text">{{ showNewProjectForm ? 'Close' : 'New Project' }}</span>
        </button>
      </div>
    </div>
  </header>

  <!-- ─── FILTER RAIL ──────────────────────────────────────── -->
  <div class="filter-rail">
    <div class="filter-rail-inner">
      <div class="search-field">
        <Search :size="16" :stroke-width="2" class="search-field-icon" />
        <input
          v-model="searchQuery"
          placeholder="Search projects…"
          class="search-field-input"
          type="search"
        />
      </div>

      <div class="status-segmented" role="tablist" aria-label="Filter by status">
        <button
          type="button"
          role="tab"
          :aria-selected="selectedStatus === 'active'"
          :class="['segmented-option', { active: selectedStatus === 'active' }]"
          @click="selectedStatus = 'active'"
        >
          Active
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="selectedStatus === 'archived'"
          :class="['segmented-option', { active: selectedStatus === 'archived' }]"
          @click="selectedStatus = 'archived'"
        >
          Archived
        </button>
      </div>

      <div class="filter-right">
        <div class="sort-control">
          <ArrowUpDown :size="16" :stroke-width="2" class="sort-control-icon" />
          <select
            id="sort"
            v-model="selectedSortOption"
            @change="sortProjects"
            class="sort-control-select"
            aria-label="Sort projects"
          >
            <option value="newest">Newest → Oldest</option>
            <option value="oldest">Oldest → Newest</option>
            <option value="az">A → Z</option>
            <option value="za">Z → A</option>
          </select>
        </div>
        <button
          @click="refreshProjects"
          class="icon-only-btn"
          :class="{ spinning: isRefreshing }"
          title="Refresh projects"
          aria-label="Refresh projects"
        >
          <RefreshCw :size="16" :stroke-width="2" />
        </button>
        <button
          class="icon-only-btn mobile-filter-toggle"
          @click="showMobileOptions = !showMobileOptions"
          :aria-expanded="showMobileOptions"
          aria-label="More filters"
          title="More filters"
        >
          <SlidersHorizontal :size="16" :stroke-width="2" />
        </button>
      </div>
    </div>

    <!-- Mobile-only expanded filter drawer -->
    <div v-if="showMobileOptions" class="filter-drawer">
      <label class="drawer-label">Sort</label>
      <select
        id="sort_m"
        v-model="selectedSortOption"
        @change="sortProjects"
        class="sort-control-select"
      >
        <option value="newest">Newest → Oldest</option>
        <option value="oldest">Oldest → Newest</option>
        <option value="az">A → Z</option>
        <option value="za">Z → A</option>
      </select>
      <button @click="refreshProjects" class="btn-ghost drawer-refresh">
        <RefreshCw :size="16" :stroke-width="2" />
        <span>Refresh</span>
      </button>
    </div>
  </div>

  <!-- ─── LOADING ──────────────────────────────────────────── -->
  <div v-if="loading" class="loading-skeleton">
    <div class="skeleton-header"></div>
    <div class="skeleton-toolbar"></div>
    <div class="skeleton-tabs"></div>
    <div class="skeleton-projects">
      <div class="skeleton-project"></div>
      <div class="skeleton-project"></div>
      <div class="skeleton-project"></div>
    </div>
  </div>

  <!-- ─── MAIN CONTENT ─────────────────────────────────────── -->
  <div v-else>
    <!-- new‑project form -->
    <form
      v-if="userStore.isAuthenticated && showNewProjectForm"
      class="new-project-form"
      @submit.prevent="addProject"
    >
      <h2 class="form-title">Create a New Project</h2>
      <div class="form-grid">
        <div class="form-group">
          <label for="newProjectName" class="form-label">Project Name</label>
          <input
            id="newProjectName"
            v-model="newProjectName"
            placeholder="Project name…"
            class="form-input"
            required
          />
        </div>
        <div class="form-group">
          <label for="newProjectLocation" class="form-label">Location</label>
          <input
            id="newProjectLocation"
            v-model="newProjectLocation"
            placeholder="e.g. London, UK"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="newProjectWebsite" class="form-label">Official Website</label>
          <input
            id="newProjectWebsite"
            v-model="newProjectWebsite"
            placeholder="https://..."
            class="form-input"
            type="url"
          />
        </div>
        <div class="form-group">
          <label for="newProjectShowDays" class="form-label">Show Days</label>
          <div class="multi-date-picker">
            <div class="multi-date-add-row">
              <input
                v-model="newShowNewDate"
                type="date"
                class="form-input"
                @keydown.enter.prevent="addNewShowDay"
              />
              <button type="button" class="btn btn-positive btn-sm" @click="addNewShowDay">Add</button>
            </div>
            <div v-if="newShowDaysList.length" class="multi-date-tags">
              <span v-for="(day, idx) in newShowDaysList" :key="day" class="date-tag show">
                {{ formatSingleDate(day) }}
                <button type="button" class="date-tag-remove" @click="newShowDaysList.splice(idx, 1)">✕</button>
              </span>
            </div>
            <div v-else class="multi-date-empty">No show days added</div>
          </div>
        </div>
        <div class="form-group">
          <label for="newProjectBuildDays" class="form-label">Build Days</label>
          <div class="multi-date-picker">
            <div class="multi-date-add-row">
              <input
                v-model="newBuildNewDate"
                type="date"
                class="form-input"
                @keydown.enter.prevent="addNewBuildDay"
              />
              <button type="button" class="btn btn-positive btn-sm" @click="addNewBuildDay">Add</button>
            </div>
            <div v-if="newBuildDaysList.length" class="multi-date-tags">
              <span v-for="(day, idx) in newBuildDaysList" :key="day" class="date-tag">
                {{ formatSingleDate(day) }}
                <button type="button" class="date-tag-remove" @click="newBuildDaysList.splice(idx, 1)">✕</button>
              </span>
            </div>
            <div v-else class="multi-date-empty">No build days added</div>
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-positive">Create Project</button>
        <button type="button" @click="cancelNewProject" class="btn btn-warning">
          Cancel
        </button>
      </div>
    </form>

    <!-- toolbar removed; controls are now in header -->

    <div v-if="!displayedProjects.length" class="empty-state">
      <div class="empty-state-icon">
        <LayoutGrid :size="28" :stroke-width="1.5" />
      </div>
      <h3 class="empty-state-title">
        {{ searchQuery ? 'No projects match your search' : selectedStatus === 'archived' ? 'No archived projects' : 'No active projects yet' }}
      </h3>
      <p class="empty-state-text">
        {{ searchQuery ? 'Try a different search term or clear the search.' : selectedStatus === 'archived' ? 'Archived projects will appear here.' : 'Create your first project to get started.' }}
      </p>
      <button
        v-if="!searchQuery && selectedStatus !== 'archived' && !showNewProjectForm"
        class="btn-primary"
        @click="toggleNewProjectForm"
      >
        <Plus :size="16" :stroke-width="2" />
        <span>New Project</span>
      </button>
    </div>

    <div v-else class="projects-section">
      <div class="projects-grid">
        <article
          v-for="p in displayedProjects"
          :key="p.id"
          :class="['project-card', { archived: p.archived }]"
        >
          <!-- Tier 1: primary, scannable row -->
          <div class="card-primary">
            <div class="card-top">
              <h3 class="card-title">{{ p.project_name }}</h3>
              <span v-if="p.archived" class="card-badge archived">Archived</span>
              <span v-else-if="p.role === 'owner'" class="card-badge owner">Owner</span>
            </div>

            <div class="card-meta-row">
              <span v-if="p.location" class="meta-inline">
                <MapPin :size="14" :stroke-width="2" />
                <span>{{ p.location }}</span>
              </span>
              <a
                v-if="p.official_website"
                :href="p.official_website"
                target="_blank"
                rel="noopener"
                class="meta-inline meta-link"
              >
                <Globe :size="14" :stroke-width="2" />
                <span>Official site</span>
              </a>
            </div>

            <div v-if="nextKeyDate(p)" class="card-next-date">
              <span :class="['next-date-kind', nextKeyDate(p).kind]">
                <Drama v-if="nextKeyDate(p).kind === 'show'" :size="14" :stroke-width="2" />
                <Hammer v-else :size="14" :stroke-width="2" />
                {{ nextKeyDate(p).kind === 'show' ? 'Show' : 'Build' }}
              </span>
              <span class="next-date-value">{{ nextKeyDate(p).label }}</span>
            </div>

            <button
              @click="openProject(p)"
              class="btn-primary card-open-btn"
            >
              <span>Open project</span>
              <ArrowRight :size="16" :stroke-width="2" />
            </button>
          </div>

          <!-- Tier 2: secondary, detail panel -->
          <div class="card-secondary">
            <div
              v-if="timelines.get(p.id)"
              class="date-strip"
              role="group"
              :aria-label="`Build and show days for ${p.project_name}`"
            >
              <div class="date-strip-header">
                <span class="legend-item">
                  <span class="legend-dot build"></span>
                  <Hammer :size="12" :stroke-width="2" />
                  <span>{{ (p.build_days || []).length }}</span>
                </span>
                <span class="legend-item">
                  <span class="legend-dot show"></span>
                  <Drama :size="12" :stroke-width="2" />
                  <span>{{ (p.main_show_days || []).length }}</span>
                </span>
              </div>
              <div class="date-strip-months">
                <div
                  v-for="m in timelines.get(p.id).months"
                  :key="m.key"
                  class="date-strip-month"
                  :style="{ flex: m.count }"
                >
                  <span class="month-label">{{ m.label }}</span>
                </div>
              </div>
              <div class="date-strip-numbers">
                <span
                  v-for="(d, di) in timelines.get(p.id).days"
                  :key="'n'+di"
                  class="day-number"
                  :class="{ visible: d.isBuild || d.isShow }"
                >{{ d.day }}</span>
              </div>
              <div class="date-strip-track">
                <button
                  v-for="(d, di) in timelines.get(p.id).days"
                  :key="di"
                  type="button"
                  :class="[
                    'date-strip-cell',
                    {
                      build: d.isBuild,
                      show: d.isShow,
                      today: d.isToday,
                      'month-start': d.isMonthStart,
                      active: isDateCellActive(p.id, di),
                      interactive: d.isBuild || d.isShow,
                    }
                  ]"
                  :aria-label="(d.isBuild || d.isShow ? ((d.isBuild && d.isShow ? 'Build and show day · ' : d.isBuild ? 'Build day · ' : 'Show day · ')) : '') + d.label"
                  :tabindex="(d.isBuild || d.isShow) ? 0 : -1"
                  @click.stop="openDateCell(p.id, di, d.isBuild || d.isShow)"
                ></button>
              </div>
              <div
                v-if="activeDateCell && activeDateCell.projectId === p.id"
                class="date-strip-detail"
                role="status"
                @click.stop
              >
                <div class="date-strip-detail-kind">
                  <template v-if="timelines.get(p.id).days[activeDateCell.dayIdx].isBuild && timelines.get(p.id).days[activeDateCell.dayIdx].isShow">
                    <span class="legend-dot build"></span>
                    <Hammer :size="12" :stroke-width="2" /> Build
                    <span class="legend-dot show" style="margin-left:8px;"></span>
                    <Drama :size="12" :stroke-width="2" /> Show
                  </template>
                  <template v-else-if="timelines.get(p.id).days[activeDateCell.dayIdx].isBuild">
                    <span class="legend-dot build"></span>
                    <Hammer :size="12" :stroke-width="2" /> Build Day
                  </template>
                  <template v-else>
                    <span class="legend-dot show"></span>
                    <Drama :size="12" :stroke-width="2" /> Show Day
                  </template>
                </div>
                <div class="date-strip-detail-label">
                  {{ timelines.get(p.id).days[activeDateCell.dayIdx].label }}
                </div>
              </div>
            </div>

            <button
              v-if="p.spatialCrew && p.spatialCrew.length"
              class="crew-toggle-btn"
              @click.stop="toggleCrewPopup(p.id)"
              :aria-expanded="crewPopupId === p.id"
            >
              <Headphones :size="14" :stroke-width="2" />
              <span>{{ p.spatialCrew.length }} Spatial Crew</span>
              <ChevronDown
                :size="14"
                :stroke-width="2"
                :class="['crew-chevron', { open: crewPopupId === p.id }]"
              />
            </button>
            <ul v-if="crewPopupId === p.id && p.spatialCrew && p.spatialCrew.length" class="crew-list" @click.stop>
              <li v-for="c in p.spatialCrew" :key="c.id" class="crew-member">
                <span v-if="c.is_lead_engineer" class="crew-member-badge">Lead</span>
                <span class="crew-member-name">{{ c.name || c.email || 'Unnamed' }}</span>
              </li>
            </ul>

            <div class="card-footer-actions">
              <template v-if="!p.archived">
                <div v-if="p.role === 'owner'" class="owner-overflow" ref="ownerMenuRefs">
                  <button
                    class="icon-only-btn"
                    :aria-expanded="ownerMenuId === p.id"
                    aria-label="More actions"
                    title="More actions"
                    @click.stop="toggleOwnerMenu(p.id)"
                  >
                    <MoreHorizontal :size="16" :stroke-width="2" />
                  </button>
                  <div v-if="ownerMenuId === p.id" class="owner-overflow-menu" @click.stop>
                    <button class="owner-overflow-item" @click="openEditModal(p); ownerMenuId = null">
                      <Pencil :size="15" :stroke-width="2" />
                      <span>Edit</span>
                    </button>
                    <button class="owner-overflow-item" @click="duplicateProject(p); ownerMenuId = null">
                      <Copy :size="15" :stroke-width="2" />
                      <span>Duplicate</span>
                    </button>
                    <button class="owner-overflow-item" @click="archiveProject(p); ownerMenuId = null">
                      <Archive :size="15" :stroke-width="2" />
                      <span>Archive</span>
                    </button>
                    <div class="owner-overflow-divider" role="separator"></div>
                    <button class="owner-overflow-item danger" @click="confirmDeleteProject(p.id); ownerMenuId = null">
                      <Trash2 :size="15" :stroke-width="2" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
                <button
                  v-else
                  @click="leaveProject(p)"
                  class="btn-ghost leave-btn"
                >
                  <LogOut :size="14" :stroke-width="2" />
                  <span>Leave</span>
                </button>
              </template>
              <template v-else>
                <button
                  v-if="p.role === 'owner'"
                  @click="unarchiveProject(p)"
                  class="btn-ghost"
                  title="Restore project"
                >
                  <ArchiveRestore :size="14" :stroke-width="2" />
                  <span>Restore</span>
                </button>
              </template>
            </div>
          </div>
        </article>
      </div>
    </div>
  </div>

  <!-- Edit Project Modal -->
  <div v-if="showEditModal" class="modal-overlay" @click="closeEditModal">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h2 class="modal-title">Edit Project</h2>
        <button class="modal-close" @click="closeEditModal">✕</button>
      </div>
      <div class="modal-content">
        <div class="form-grid">
          <div class="form-group">
            <label for="editProjectName" class="form-label">Project Name</label>
            <input
              id="editProjectName"
              v-model="editProjectName"
              type="text"
              class="form-input"
              placeholder="Project name"
              required
            />
          </div>
          <div class="form-group">
            <label for="editProjectLocation" class="form-label">Location</label>
            <input
              id="editProjectLocation"
              v-model="editProjectLocation"
              type="text"
              class="form-input"
              placeholder="e.g. London, UK"
            />
          </div>
          <div class="form-group">
            <label for="editProjectWebsite" class="form-label">Official Website</label>
            <input
              id="editProjectWebsite"
              v-model="editProjectWebsite"
              type="url"
              class="form-input"
              placeholder="https://..."
            />
          </div>
          <div class="form-group">
            <label class="form-label">Show Days</label>
            <div class="multi-date-picker">
              <div class="multi-date-add-row">
                <input
                  v-model="editShowNewDate"
                  type="date"
                  class="form-input"
                  @keydown.enter.prevent="addEditShowDay"
                />
                <button type="button" class="btn btn-positive btn-sm" @click="addEditShowDay">Add</button>
              </div>
              <div v-if="editShowDays.length" class="multi-date-tags">
                <span v-for="(day, idx) in editShowDays" :key="day" class="date-tag show">
                  {{ formatSingleDate(day) }}
                  <button type="button" class="date-tag-remove" @click="editShowDays.splice(idx, 1)">✕</button>
                </span>
              </div>
              <div v-else class="multi-date-empty">No show days added</div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Build Days</label>
            <div class="multi-date-picker">
              <div class="multi-date-add-row">
                <input
                  v-model="editBuildNewDate"
                  type="date"
                  class="form-input"
                  @keydown.enter.prevent="addEditBuildDay"
                />
                <button type="button" class="btn btn-positive btn-sm" @click="addEditBuildDay">Add</button>
              </div>
              <div v-if="editBuildDays.length" class="multi-date-tags">
                <span v-for="(day, idx) in editBuildDays" :key="day" class="date-tag">
                  {{ formatSingleDate(day) }}
                  <button type="button" class="date-tag-remove" @click="editBuildDays.splice(idx, 1)">✕</button>
                </span>
              </div>
              <div v-else class="multi-date-empty">No build days added</div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button @click="saveEditProject" class="btn btn-positive">Save Changes</button>
        <button @click="closeEditModal" class="btn btn-warning">Cancel</button>
      </div>
    </div>
  </div>
</div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter }                from 'vue-router';
import { supabase }                 from '@/supabase';
import { useUserStore }             from '@/stores/userStore';
import { useToast }                 from 'vue-toastification';
import { mutateTableData }          from '@/services/dataService';
import {
  Plus,
  X,
  Search,
  ArrowUpDown,
  RefreshCw,
  SlidersHorizontal,
  MapPin,
  Globe,
  Hammer,
  Drama,
  Headphones,
  ArrowRight,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Copy,
  Archive,
  ArchiveRestore,
  Trash2,
  LogOut,
  LayoutGrid,
} from 'lucide-vue-next';

// Cache key will be generated dynamically with user ID for security
const getCacheKey = (userId) => `userProjects_v2_${userId}`;

export default {
components: {
  Plus,
  X,
  Search,
  ArrowUpDown,
  RefreshCw,
  SlidersHorizontal,
  MapPin,
  Globe,
  Hammer,
  Drama,
  Headphones,
  ArrowRight,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Copy,
  Archive,
  ArchiveRestore,
  Trash2,
  LogOut,
  LayoutGrid,
},
setup() {
  /* ───────── REACTIVE STATE ───────── */
  const projects           = ref([]);
  const newProjectName     = ref('');
  const loading            = ref(true);
  const showNewProjectForm = ref(false);
  const selectedSortOption = ref(
    localStorage.getItem('selectedSortOption') || 'newest'
  );
  const searchQuery        = ref('');
  const newProjectLocation = ref('');
  const newProjectShowDays = ref('');
  const newShowDaysList    = ref([]);
  const newShowNewDate     = ref('');
  const newProjectBuildDays = ref('');
  const newBuildDaysList    = ref([]);
  const newBuildNewDate     = ref('');
  const newProjectWebsite  = ref('');
  const showEditModal      = ref(false);
  const editProjectId      = ref(null);
  const editProjectName    = ref('');
  const editProjectLocation = ref('');
  const editShowDays       = ref([]);
  const editShowNewDate    = ref('');
  const editBuildDays      = ref([]);
  const editBuildNewDate   = ref('');
  const editProjectWebsite = ref('');
  const activeTab          = ref('active');
  const selectedStatus     = ref('active');
  const showMobileOptions  = ref(false);
  const crewPopupId        = ref(null);
  const ownerMenuId        = ref(null);
  const isRefreshing       = ref(false);
  const activeDateCell     = ref(null); // { projectId, dayIdx } | null

  const openDateCell = (projectId, dayIdx, hasMark) => {
    if (!hasMark) {
      activeDateCell.value = null;
      return;
    }
    const key = `${projectId}:${dayIdx}`;
    const cur = activeDateCell.value;
    activeDateCell.value = cur && cur.key === key ? null : { key, projectId, dayIdx };
  };

  const isDateCellActive = (projectId, dayIdx) => {
    const cur = activeDateCell.value;
    return !!cur && cur.projectId === projectId && cur.dayIdx === dayIdx;
  };

  const toggleOwnerMenu = (projectId) => {
    ownerMenuId.value = ownerMenuId.value === projectId ? null : projectId;
    if (ownerMenuId.value) crewPopupId.value = null;
  };

  const handleDocClickForMenus = (e) => {
    if (!e.target.closest('.owner-overflow') && !e.target.closest('.crew-toggle-btn') && !e.target.closest('.crew-list')) {
      ownerMenuId.value = null;
    }
    if (!e.target.closest('.date-strip')) {
      activeDateCell.value = null;
    }
  };
  const handleEscForMenus = (e) => {
    if (e.key === 'Escape') {
      ownerMenuId.value = null;
      crewPopupId.value = null;
      showMobileOptions.value = false;
      activeDateCell.value = null;
    }
  };

  /* ───────── HELPERS ───────── */
  const userStore = useUserStore();
  const toast     = useToast();
  const router    = useRouter();

  /* ───────── DISPLAYED LIST (search filter) ───────── */
  const filteredProjects = computed(() =>
    projects.value.filter(p =>
      p.project_name.toLowerCase().includes(searchQuery.value.trim().toLowerCase())
    )
  );

  const activeProjects = computed(() =>
    filteredProjects.value.filter(p => !p.archived)
  );
  const archivedProjects = computed(() =>
    filteredProjects.value.filter(p => p.archived)
  );

  const displayedProjects = computed(() =>
    selectedStatus.value === 'archived' ? archivedProjects.value : activeProjects.value
  );

  /* ───────── UI ACTIONS ───────── */
  const toggleNewProjectForm = () =>
    (showNewProjectForm.value = !showNewProjectForm.value);

  const cancelNewProject = () => {
    newProjectName.value = '';
    newProjectLocation.value = '';
    newProjectShowDays.value = '';
    newProjectBuildDays.value = '';
    newProjectWebsite.value = '';
    showNewProjectForm.value = false;
  };

  /* ─────────────────────────────────────────────
     1. FETCH PROJECTS
  ───────────────────────────────────────────── */
  const fetchUserProjects = async (force = false) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const uid   = session?.session?.user?.id || '';
      const email = session?.session?.user?.email?.toLowerCase() || '';
      
      // Security check: ensure we have a valid user session
      if (!uid) {
        console.warn('No valid user session found, clearing projects');
        projects.value = [];
        return;
      }

      // Use user-specific cache key for security
      const cacheKey = getCacheKey(uid);
      
      if (!force) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const cachedProjects = JSON.parse(cached);
            // Additional security: validate cached projects belong to current user
            const validProjects = cachedProjects.filter(p => 
              p.user_id === uid || 
              (p.role && ['owner', 'member', 'viewer'].includes(p.role))
            );
            if (validProjects.length === cachedProjects.length) {
              projects.value = validProjects;
              sortProjects();
              return;
            } else {
              console.warn('Cached projects contain invalid data, fetching fresh data');
              localStorage.removeItem(cacheKey);
            }
          } catch (e) {
            console.warn('Invalid cached projects data, fetching fresh data');
            localStorage.removeItem(cacheKey);
          }
        }
      }
      
      loading.value = true;

      /* owned */
      const { data: owned } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', uid);

      /* member */
      const { data: memberRows } = await supabase
        .from('project_members')
        .select(`
          role,
          projects:project_id ( 
            id, 
            project_name, 
            created_at, 
            user_id, 
            location, 
            official_website, 
            main_show_days, 
            build_days,
            archived
          )
        `)
        .or(`user_id.eq.${uid},user_email.eq.${email}`);

      const memberProjects = (memberRows || [])
        .filter(r => r.projects)
        .map(r => ({ ...r.projects, role: r.role }));

      /* merge */
      const map = new Map();
      (owned || []).forEach(p => map.set(p.id, { ...p, role: 'owner' }));
      memberProjects.forEach(p => { if (!map.has(p.id)) map.set(p.id, p); });

      projects.value = Array.from(map.values());
      sortProjects();

      // Fetch Spatial Crew contacts for all projects
      const projectIds = projects.value.map(p => p.id);
      if (projectIds.length) {
        const { data: crewContacts } = await supabase
          .from('project_contacts')
          .select('id, project_id, name, email, phone, role, is_lead_engineer')
          .eq('role', 'Spatial Crew')
          .in('project_id', projectIds);
        if (crewContacts) {
          const byProject = {};
          crewContacts.forEach(c => {
            if (!byProject[c.project_id]) byProject[c.project_id] = [];
            byProject[c.project_id].push(c);
          });
          projects.value.forEach(p => {
            // Sort: lead engineer first, then alphabetical
            p.spatialCrew = (byProject[p.id] || []).sort((a, b) => {
              if (a.is_lead_engineer && !b.is_lead_engineer) return -1;
              if (!a.is_lead_engineer && b.is_lead_engineer) return 1;
              return (a.name || '').localeCompare(b.name || '');
            });
          });
        }
      }

      localStorage.setItem(cacheKey, JSON.stringify(projects.value));
    } catch (e) {
      console.error('Error loading projects:', e.message);
      toast.error(`Error loading projects: ${e.message}`);
      projects.value = [];
    } finally { loading.value = false; }
  };

  /* ───────── SORTING ───────── */
  const sortProjects = () => {
    const p = projects.value;
    switch (selectedSortOption.value) {
      case 'az':      p.sort((a,b)=>a.project_name.localeCompare(b.project_name)); break;
      case 'za':      p.sort((a,b)=>b.project_name.localeCompare(a.project_name)); break;
      case 'oldest':  p.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)); break;
      default:        p.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    }
    localStorage.setItem('selectedSortOption', selectedSortOption.value);
  };

  function toggleCrewPopup(projectId) {
    crewPopupId.value = crewPopupId.value === projectId ? null : projectId;
  }

  const refreshProjects = async () => {
    if (!navigator.onLine) {
      toast.error('Refresh is only available when online.');
      return;
    }
    isRefreshing.value = true;
    try {
      const { data: session } = await supabase.auth.getSession();
      const uid = session?.session?.user?.id;
      if (uid) {
        localStorage.removeItem(getCacheKey(uid));
      }
      await fetchUserProjects(true);
    } finally {
      setTimeout(() => { isRefreshing.value = false; }, 400);
    }
  };

  /* ───────── TIMELINE STRIPS ─────────
     Per-project mini-calendar: month labels + per-day cells colored by
     build/show. Computed once for the displayed set so cards stay cheap. */
  // Parse date strings as LOCAL midnight to avoid UTC-to-local shift for date-only strings
  const startOfDay = (ds) => {
    if (!ds) return NaN;
    if (typeof ds === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ds)) {
      const [y, m, d] = ds.split('-').map(Number);
      return new Date(y, m - 1, d).getTime();
    }
    const d = new Date(ds);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };

  const buildTimeline = (p) => {
    const build = (p.build_days || []).filter(Boolean);
    const show = (p.main_show_days || []).filter(Boolean);
    if (!build.length && !show.length) return null;
    const buildSet = new Set(build.map(startOfDay).filter(t => !Number.isNaN(t)));
    const showSet = new Set(show.map(startOfDay).filter(t => !Number.isNaN(t)));
    const all = [...buildSet, ...showSet];
    if (!all.length) return null;
    const min = Math.min(...all);
    const max = Math.max(...all);
    const startDate = new Date(min);
    const endDate = new Date(max);
    // Start strip at the Monday on or before the 1st of the first event month
    const monthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const dow = monthStart.getDay(); // 0=Sun
    const daysBack = dow === 0 ? 6 : dow - 1;
    const stripStart = new Date(monthStart);
    stripStart.setDate(stripStart.getDate() - daysBack - 2);
    const stripEnd = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
    stripEnd.setDate(stripEnd.getDate() + 2);
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
      const iso = d.toISOString().slice(0, 10);
      days.push({
        date: iso,
        day: d.getDate(),
        isBuild: buildSet.has(dayTime),
        isShow: showSet.has(dayTime),
        isToday: dayTime === today,
        isMonthStart: d.getDate() === 1 && days.length > 0,
        label: formatSingleDate(iso),
      });
    }
    return { months, days };
  };

  const timelines = computed(() => {
    const map = new Map();
    for (const p of projects.value) {
      const t = buildTimeline(p);
      if (t) map.set(p.id, t);
    }
    return map;
  });

  /* ───────── NEXT KEY DATE ─────────
     Picks the soonest upcoming show or build day; falls back to the most
     recent past one so the card always has context. Used by Tier 1 chip. */
  const nextKeyDate = (p) => {
    const now = Date.now();
    const items = [];
    (p.main_show_days || []).forEach(d => items.push({ kind: 'show', date: d }));
    (p.build_days || []).forEach(d => items.push({ kind: 'build', date: d }));
    if (!items.length) return null;
    const parsed = items
      .map(i => ({ ...i, t: new Date(i.date).getTime() }))
      .filter(i => !Number.isNaN(i.t));
    if (!parsed.length) return null;
    const upcoming = parsed
      .filter(i => i.t >= now - 24 * 60 * 60 * 1000)
      .sort((a, b) => a.t - b.t)[0];
    const chosen = upcoming || parsed.sort((a, b) => b.t - a.t)[0];
    return chosen ? { kind: chosen.kind, label: formatSingleDate(chosen.date) } : null;
  };

  /* ─────────────────────────────────────────────
     2. CRUD HELPERS
  ───────────────────────────────────────────── */
  const addProject = async () => {
    if (!newProjectName.value.trim()) {
      toast.error('Project name cannot be empty.');
      return;
    }
    if (!userStore.isAuthenticated) {
      toast.error('You must be logged in to create a project.');
      return;
    }
    try {
      const { data: s } = await supabase.auth.getSession();
      const uid = s?.session?.user?.id;
      if (!uid) { toast.error('No valid user session.'); return; }

      // Parse show/build days
      const showDaysArr = [...newShowDaysList.value].sort();
      const buildDaysArr = [...newBuildDaysList.value].sort();

      const projectRow = await mutateTableData('projects','insert',{
        project_name : newProjectName.value.trim(),
        owner_email  : userStore.getUserEmail,
        user_id      : uid,
        created_at   : new Date().toISOString(),
        location     : newProjectLocation.value.trim(),
        official_website: newProjectWebsite.value.trim() || null,
        main_show_days: showDaysArr.length ? showDaysArr : null,
        build_days   : buildDaysArr.length ? buildDaysArr : null
      });
      if (!projectRow?.id) { toast.error('Failed to create project.'); return; }

      await mutateTableData('project_members','insert',{
        project_id : projectRow.id,
        user_id    : uid,
        user_email : userStore.getUserEmail,
        role       : 'owner'
      });

      projectRow.role='owner';
      projects.value.push(projectRow);
      const cacheKey = getCacheKey(uid);
      localStorage.setItem(cacheKey, JSON.stringify(projects.value));
      toast.success('Project created.');
      newProjectName.value='';
      newProjectLocation.value='';
      newProjectShowDays.value='';
      newShowDaysList.value=[];
      newShowNewDate.value='';
      newProjectBuildDays.value='';
      newBuildDaysList.value=[];
      newBuildNewDate.value='';
      newProjectWebsite.value='';
      showNewProjectForm.value=false;
      sortProjects();
    } catch(e){ toast.error(e.message); }
  };

  const renameProject = async id => {
    const newName = prompt('Enter new project name:');
    if (!newName?.trim()) return;
    try {
      await mutateTableData('projects','update',{ id, project_name:newName.trim() });
      const p = projects.value.find(p=>p.id===id);
      if (p) p.project_name = newName.trim();
      const { data: session } = await supabase.auth.getSession();
      const uid = session?.session?.user?.id;
      if (uid) {
        const cacheKey = getCacheKey(uid);
        localStorage.setItem(cacheKey, JSON.stringify(projects.value));
      }
      toast.success('Project renamed.');
    } catch(e){ toast.error(e.message); }
  };

  const confirmDeleteProject = async id => {
    const project = projects.value.find(p => p.id === id);
    if (!confirm(`You are about to permanently delete the project "${project?.project_name || 'this project'}". This action cannot be undone. Continue?`)) return;
    try {
      await mutateTableData('projects','delete',{ id });
      projects.value = projects.value.filter(p=>p.id!==id);
      const { data: session } = await supabase.auth.getSession();
      const uid = session?.session?.user?.id;
      if (uid) {
        const cacheKey = getCacheKey(uid);
        localStorage.setItem(cacheKey, JSON.stringify(projects.value));
      }
      toast.success('Project deleted.');
    } catch(e){ toast.error(e.message); }
  };

  const duplicateProject = async src => {
    if (!confirm(`You are about to duplicate the whole project "${src.project_name}". This is useful for doing another record at the same project location. Continue?`)) return;
    try {
      const { data:s } = await supabase.auth.getSession();
      const uid = s?.session?.user?.id;
      if (!uid) { toast.error('No valid user session.'); return; }

      const dup = await mutateTableData('projects','insert',{
        project_name : `${src.project_name} (Copy)`,
        owner_email  : userStore.getUserEmail,
        user_id      : uid,
        created_at   : new Date().toISOString()
      });
      if (!dup?.id){ toast.error('Could not duplicate project.'); return; }

      await mutateTableData('project_members','insert',{
        project_id : dup.id,
        user_id    : uid,
        user_email : userStore.getUserEmail,
        role       : 'owner'
      });

      dup.role='owner';
      projects.value.push(dup);
      const cacheKey = getCacheKey(uid);
      localStorage.setItem(cacheKey, JSON.stringify(projects.value));
      sortProjects();
      toast.success('Project duplicated.');
    } catch(e){ toast.error(e.message); }
  };

  const leaveProject = async p => {
    if (!confirm('Leave this project?')) return;
    try {
      const { data:s } = await supabase.auth.getSession();
      const uid = s?.session?.user?.id;
      if (!uid) { toast.error('No valid user session.'); return; }

      await mutateTableData('project_members','delete',{
        project_id:p.id, user_id:uid
      });
      projects.value = projects.value.filter(x=>x.id!==p.id);
      const cacheKey = getCacheKey(uid);
      localStorage.setItem(cacheKey, JSON.stringify(projects.value));
      toast.success('Left project.');
    } catch(e){ toast.error(e.message); }
  };

  const openProject = p => {
    userStore.setCurrentProject?.(p);
    router.push({ name:'ProjectDetail', params:{ id:p.id } });
  };

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

  function getDateRange(from, to) {
    if (!from || !to) return [];
    const start = new Date(from);
    const end = new Date(to);
    if (isNaN(start) || isNaN(end) || start > end) return [];
    const arr = [];
    let d = new Date(start);
    while (d <= end) {
      arr.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    return arr;
  }

  function addEditBuildDay() {
    const val = editBuildNewDate.value;
    if (!val) return;
    if (editBuildDays.value.includes(val)) {
      toast.warning('Date already added.');
      return;
    }
    editBuildDays.value.push(val);
    editBuildDays.value.sort();
    editBuildNewDate.value = '';
  }

  function addNewBuildDay() {
    const val = newBuildNewDate.value;
    if (!val) return;
    if (newBuildDaysList.value.includes(val)) {
      toast.warning('Date already added.');
      return;
    }
    newBuildDaysList.value.push(val);
    newBuildDaysList.value.sort();
    newBuildNewDate.value = '';
  }

  function addEditShowDay() {
    const val = editShowNewDate.value;
    if (!val) return;
    if (editShowDays.value.includes(val)) {
      toast.warning('Date already added.');
      return;
    }
    editShowDays.value.push(val);
    editShowDays.value.sort();
    editShowNewDate.value = '';
  }

  function addNewShowDay() {
    const val = newShowNewDate.value;
    if (!val) return;
    if (newShowDaysList.value.includes(val)) {
      toast.warning('Date already added.');
      return;
    }
    newShowDaysList.value.push(val);
    newShowDaysList.value.sort();
    newShowNewDate.value = '';
  }

  function openEditModal(project) {
    editProjectId.value = project.id;
    editProjectName.value = project.project_name || '';
    editProjectLocation.value = project.location || '';
    editProjectWebsite.value = project.official_website || '';
    // Show days
    if (Array.isArray(project.main_show_days) && project.main_show_days.length) {
      editShowDays.value = [...project.main_show_days].sort();
    } else {
      editShowDays.value = [];
    }
    editShowNewDate.value = '';
    // Build days
    if (Array.isArray(project.build_days) && project.build_days.length) {
      editBuildDays.value = [...project.build_days].sort();
    } else {
      editBuildDays.value = [];
    }
    editBuildNewDate.value = '';
    showEditModal.value = true;
  }

  function closeEditModal() {
    showEditModal.value = false;
    editProjectId.value = null;
    editProjectName.value = '';
    editProjectLocation.value = '';
    editProjectWebsite.value = '';
    editShowDays.value = [];
    editShowNewDate.value = '';
    editBuildDays.value = [];
    editBuildNewDate.value = '';
  }

  async function saveEditProject() {
    const showDaysArr = [...editShowDays.value].sort();
    const buildDaysArr = [...editBuildDays.value].sort();
    try {
      await mutateTableData('projects', 'update', {
        id: editProjectId.value,
        project_name: editProjectName.value.trim(),
        location: editProjectLocation.value.trim(),
        official_website: editProjectWebsite.value.trim() || null,
        main_show_days: showDaysArr.length ? showDaysArr : null,
        build_days: buildDaysArr.length ? buildDaysArr : null
      });
      // Update local state
      const p = projects.value.find(p => p.id === editProjectId.value);
      if (p) {
        p.project_name = editProjectName.value.trim();
        p.location = editProjectLocation.value.trim();
        p.official_website = editProjectWebsite.value.trim() || null;
        p.main_show_days = showDaysArr.length ? showDaysArr : null;
        p.build_days = buildDaysArr.length ? buildDaysArr : null;
      }
      const { data: session } = await supabase.auth.getSession();
      const uid = session?.session?.user?.id;
      if (uid) {
        const cacheKey = getCacheKey(uid);
        localStorage.setItem(cacheKey, JSON.stringify(projects.value));
      }
      toast.success('Project updated.');
      closeEditModal();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function archiveProject(p) {
    if (!confirm(`You are about to archive the project "${p.project_name}". Archived projects are hidden from the main view but can be restored later. Continue?`)) return;
    try {
      await mutateTableData('projects', 'update', { id: p.id, archived: true });
      p.archived = true;
      const { data: session } = await supabase.auth.getSession();
      const uid = session?.session?.user?.id;
      if (uid) {
        const cacheKey = getCacheKey(uid);
        localStorage.setItem(cacheKey, JSON.stringify(projects.value));
      }
      toast.success('Project archived.');
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function unarchiveProject(p) {
    try {
      await mutateTableData('projects', 'update', { id: p.id, archived: false });
      p.archived = false;
      const { data: session } = await supabase.auth.getSession();
      const uid = session?.session?.user?.id;
      if (uid) {
        const cacheKey = getCacheKey(uid);
        localStorage.setItem(cacheKey, JSON.stringify(projects.value));
      }
      toast.success('Project unarchived.');
    } catch (e) {
      toast.error(e.message);
    }
  }

  /* ───────── LIFECYCLE ───────── */
  onMounted(async () => {
    document.addEventListener('click', handleDocClickForMenus);
    document.addEventListener('keydown', handleEscForMenus);

    // Security check: validate current user session before loading projects
    const { data: session } = await supabase.auth.getSession();
    const uid = session?.session?.user?.id;

    if (!uid) {
      console.warn('No valid user session on mount, clearing all project caches');
      // Clear any existing project caches for security
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('userProjects_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      projects.value = [];
      return;
    }

    fetchUserProjects(false);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleDocClickForMenus);
    document.removeEventListener('keydown', handleEscForMenus);
  });

  /* ───────── EXPOSE ───────── */
  return {
    projects, loading, showNewProjectForm,
    newProjectName, selectedSortOption, searchQuery,
    filteredProjects, userStore,

    toggleNewProjectForm, cancelNewProject,
    refreshProjects, sortProjects,

    addProject, renameProject, confirmDeleteProject,
    duplicateProject, leaveProject, openProject,
    newProjectLocation,
    newProjectShowDays,
    newShowDaysList,
    newShowNewDate,
    addNewShowDay,
    newProjectBuildDays,
    newBuildDaysList,
    newBuildNewDate,
    addNewBuildDay,
    newProjectWebsite,
    formatSingleDate,
    groupConsecutiveDates,
    showEditModal,
    editProjectId,
    editProjectName,
    editProjectLocation,
    editShowDays,
    editShowNewDate,
    addEditShowDay,
    editBuildDays,
    editBuildNewDate,
    addEditBuildDay,
    editProjectWebsite,
    openEditModal,
    closeEditModal,
    saveEditProject,
    activeProjects,
    archivedProjects,
    archiveProject,
    unarchiveProject,
    activeTab,
    selectedStatus,
    displayedProjects,
    showMobileOptions,
    crewPopupId,
    toggleCrewPopup,
    ownerMenuId,
    toggleOwnerMenu,
    isRefreshing,
    nextKeyDate,
    timelines,
    activeDateCell,
    openDateCell,
    isDateCellActive,
  };
},
};
</script>

<style scoped>
/* ── CSS Variables for pill-style buttons (light/dark mode) ── */
:deep(:root) {
  --pill-warning-bg: #fef3c7;
  --pill-warning-text: #92400e;
  --pill-warning-border: #f59e0b;
  --pill-warning-hover-bg: #fde68a;
  --pill-positive-bg: #d1fae5;
  --pill-positive-text: #065f46;
  --pill-positive-border: #10b981;
  --pill-positive-hover-bg: #a7f3d0;
  --pill-danger-bg: #fee2e2;
  --pill-danger-text: #991b1b;
  --pill-danger-border: #ef4444;
  --pill-danger-hover-bg: #fecaca;
  --pill-primary-bg: #dbeafe;
  --pill-primary-text: #1e40af;
  --pill-primary-border: #2563eb;
  --pill-primary-hover-bg: #bfdbfe;
  --pill-badge-owner-bg: var(--color-primary-100);
  --pill-badge-owner-text: var(--color-primary-700);
}

:deep(.dark) {
  --pill-warning-bg: var(--color-warning-700);
  --pill-warning-text: var(--text-inverse);
  --pill-warning-border: var(--color-warning-600);
  --pill-warning-hover-bg: var(--color-warning-600);
  --pill-positive-bg: var(--color-success-700);
  --pill-positive-text: var(--text-inverse);
  --pill-positive-border: var(--color-success-600);
  --pill-positive-hover-bg: var(--color-success-600);
  --pill-danger-bg: var(--color-error-600);
  --pill-danger-text: var(--text-inverse);
  --pill-danger-border: var(--color-error-700);
  --pill-danger-hover-bg: var(--color-error-700);
  --pill-primary-bg: var(--color-primary-700);
  --pill-primary-text: var(--text-inverse);
  --pill-primary-border: var(--color-primary-600);
  --pill-primary-hover-bg: var(--color-primary-600);
  --pill-badge-owner-bg: var(--color-primary-700);
  --pill-badge-owner-text: var(--text-inverse);
}

/* ─── Base container ───────────────────────────────────── */
.projects {
  min-height: 100vh;
  background: var(--bg-primary);
  padding: var(--space-4);
  padding-top: env(safe-area-inset-top, var(--space-4));
  padding-bottom: env(safe-area-inset-bottom, var(--space-4));
  font-family: var(--font-family-sans);
  line-height: var(--leading-normal);
  color: var(--text-primary);
  max-width: 1280px;
  margin: 0 auto;
}

/* ─── Page head ────────────────────────────────────────── */
.page-head {
  margin-bottom: var(--space-4);
}
.page-head-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}
.page-title-group { min-width: 0; }
.page-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  letter-spacing: -0.02em;
  color: var(--text-heading);
  margin: 0;
  line-height: 1.1;
}
.page-subtitle {
  margin: 4px 0 0 0;
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.form-title,
.modal-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  line-height: var(--leading-snug);
  margin: 0 0 var(--space-4) 0;
  color: var(--text-heading);
}

/* ─── Primary / ghost buttons ─────────────────────────── */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 0 var(--space-4);
  height: 40px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-primary-600);
  background: var(--color-primary-500);
  color: #ffffff;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: background var(--transition-normal), box-shadow var(--transition-normal), transform var(--transition-fast);
  white-space: nowrap;
}
.btn-primary:hover {
  background: var(--color-primary-600);
  border-color: var(--color-primary-700);
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.25);
}
.btn-primary:active { transform: scale(0.98); }
.btn-primary:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 var(--space-3);
  height: 32px;
  border-radius: var(--radius-md);
  border: 1px solid var(--surface-border);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: background var(--transition-normal), border-color var(--transition-normal), color var(--transition-normal);
}
.btn-ghost:hover {
  background: var(--surface-hover);
  border-color: var(--surface-border-strong);
  color: var(--text-primary);
}
.btn-ghost:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.btn-ghost.leave-btn {
  color: var(--color-error-600);
  border-color: var(--color-error-200);
}
.btn-ghost.leave-btn:hover {
  background: var(--color-error-50);
  border-color: var(--color-error-300);
  color: var(--color-error-700);
}

/* ─── Filter rail ──────────────────────────────────────── */
.filter-rail {
  position: sticky;
  top: 56px;
  z-index: 10;
  background: var(--surface-filter-rail);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  padding: 10px;
  margin-bottom: var(--space-4);
  backdrop-filter: saturate(140%) blur(6px);
}
.filter-rail-inner {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.search-field {
  position: relative;
  flex: 1 1 240px;
  min-width: 200px;
}
.search-field-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  pointer-events: none;
}
.search-field-input {
  width: 100%;
  height: 36px;
  padding: 0 12px 0 36px;
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--surface-card-muted);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  transition: background var(--transition-normal), border-color var(--transition-normal), box-shadow var(--transition-normal);
  -webkit-appearance: none;
  appearance: none;
}
.search-field-input::placeholder { color: var(--text-tertiary); }
.search-field-input:focus {
  outline: none;
  background: var(--surface-card);
  border-color: var(--color-primary-300);
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.status-segmented {
  display: inline-flex;
  padding: 3px;
  background: var(--chip-bg);
  border-radius: var(--radius-md);
  gap: 2px;
}
.segmented-option {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  padding: 6px 14px;
  border-radius: calc(var(--radius-md) - 2px);
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal);
  min-height: 30px;
}
.segmented-option:hover { color: var(--text-primary); }
.segmented-option.active {
  background: var(--surface-card);
  color: var(--text-primary);
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}

.filter-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
}

.sort-control {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.sort-control-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  pointer-events: none;
}
.sort-control-select {
  appearance: none;
  -webkit-appearance: none;
  background: var(--surface-card-muted);
  border: 1px solid var(--surface-border);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  padding: 0 28px 0 32px;
  height: 36px;
  border-radius: var(--radius-md);
  cursor: pointer;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
  background-repeat: no-repeat;
  background-position: right 10px center;
  transition: background-color var(--transition-normal), border-color var(--transition-normal);
}
.sort-control-select:hover {
  background-color: var(--surface-hover);
  border-color: var(--surface-border-strong);
}
.sort-control-select:focus {
  outline: none;
  border-color: var(--color-primary-300);
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.icon-only-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  border: 1px solid var(--surface-border);
  background: var(--surface-card-muted);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
}
.icon-only-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
  border-color: var(--surface-border-strong);
}
.icon-only-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.icon-only-btn.spinning svg {
  animation: spinIcon 0.9s linear infinite;
}
@keyframes spinIcon {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.mobile-filter-toggle { display: none; }

.filter-drawer {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-top: var(--space-3);
  margin-top: var(--space-3);
  border-top: 1px solid var(--surface-border);
}
.drawer-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.drawer-refresh {
  align-self: flex-start;
}

/* ─── Empty state ──────────────────────────────────────── */
.empty-state {
  text-align: center;
  padding: var(--space-12) var(--space-4);
  background: var(--surface-card);
  border: 1px dashed var(--surface-border-strong);
  border-radius: var(--radius-lg);
}
.empty-state-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  background: var(--chip-bg);
  color: var(--text-tertiary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-4);
}
.empty-state-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  margin: 0 0 6px 0;
}
.empty-state-text {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin: 0 0 var(--space-5) 0;
  max-width: 36ch;
  margin-left: auto;
  margin-right: auto;
}
.empty-state .btn-primary {
  display: inline-flex;
}

/* ─── Loading skeleton ─────────────────────────────────── */
.loading-skeleton { padding: var(--space-4) 0; }
.skeleton-header,
.skeleton-toolbar,
.skeleton-tabs,
.skeleton-projects {
  background: linear-gradient(90deg, var(--surface-card-muted) 25%, var(--surface-hover) 50%, var(--surface-card-muted) 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
}
.skeleton-header { height: 56px; }
.skeleton-toolbar { height: 44px; }
.skeleton-tabs { height: 36px; }
.skeleton-projects {
  height: 300px;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.skeleton-project {
  flex: 1;
  background: inherit;
  border-radius: var(--radius-md);
}
@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ─── New project form (kept, slightly refreshed) ──────── */
.new-project-form {
  margin-bottom: var(--space-4);
  padding: var(--space-5);
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--surface-border);
  box-shadow: var(--shadow-sm);
}
.form-grid {
  display: grid;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}
.form-group { display: flex; flex-direction: column; }
.form-label {
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
  font-size: var(--text-sm);
}
.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  background: var(--surface-card);
  color: var(--text-primary);
  transition: border-color var(--transition-normal), box-shadow var(--transition-normal);
  min-height: 40px;
  box-sizing: border-box;
}
.form-input:focus {
  outline: none;
  border-color: var(--color-primary-400);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.form-input::placeholder { color: var(--text-tertiary); }
.form-actions {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

/* ─── Projects grid ────────────────────────────────────── */
.projects-section { padding: 0; }
.projects-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
}

/* ─── Project card (two-tier) ──────────────────────────── */
.project-card {
  display: flex;
  flex-direction: column;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-normal), border-color var(--transition-normal), transform var(--transition-fast);
}
.project-card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--surface-border-strong);
}
.project-card.archived { opacity: 0.82; }

/* Tier 1 — primary */
.card-primary {
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}
.card-title {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--text-heading);
  letter-spacing: -0.01em;
  line-height: 1.2;
  margin: 0;
  word-break: break-word;
  min-width: 0;
  text-transform: uppercase;
}
.card-badge {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: var(--font-semibold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: var(--radius-full);
  line-height: 1;
}
.card-badge.owner {
  background: var(--color-primary-50);
  color: var(--color-primary-700);
  border: 1px solid var(--color-primary-100);
}
.card-badge.archived {
  background: var(--color-neutral-100);
  color: var(--color-neutral-600);
  border: 1px solid var(--color-neutral-200);
}

.card-meta-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  min-height: 20px;
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

.card-next-date {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 10px;
  background: var(--surface-card-muted);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  align-self: flex-start;
}
.next-date-kind {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1;
}
.next-date-kind.show {
  background: rgba(217, 119, 6, 0.12);
  color: var(--color-warning-700);
}
.next-date-kind.build {
  background: rgba(14, 165, 233, 0.12);
  color: var(--color-primary-700);
}
.next-date-kind svg { width: 12px; height: 12px; }
.next-date-value {
  color: var(--text-primary);
  font-weight: var(--font-medium);
}

.card-open-btn {
  width: 100%;
  margin-top: 2px;
}

/* Tier 2 — secondary */
.card-secondary {
  padding: var(--space-4) var(--space-5);
  background: var(--surface-card-muted);
  border-top: 1px solid var(--surface-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
/* Mini calendar strip */
.date-strip {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: var(--surface-card);
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
.date-strip-month:first-child {
  border-left: none;
  padding-left: 0;
}
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
  overflow: visible;
}
.day-number.visible { visibility: visible; }

.date-strip-track {
  display: flex;
  gap: 1px;
  height: 18px;
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
.date-strip-cell.active {
  transform: scaleY(1.35);
  z-index: 3;
  box-shadow: 0 0 0 2px var(--color-primary-600);
}
.date-strip-cell.build {
  background: var(--color-primary-500);
  box-shadow: inset 0 0 0 1px var(--color-primary-600);
}
.date-strip-cell.show {
  background: var(--color-success-500, hsl(142 60% 42%));
  box-shadow: inset 0 0 0 1px var(--color-success-600, hsl(142 60% 35%));
}
.date-strip-cell.build.show {
  background: linear-gradient(180deg, var(--color-primary-500) 0%, var(--color-primary-500) 50%, var(--color-success-500, hsl(142 60% 42%)) 50%, var(--color-success-500, hsl(142 60% 42%)) 100%);
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08);
}
.date-strip-cell.today {
  box-shadow: 0 0 0 1px var(--color-primary-600), inset 0 0 0 1px #ffffff;
}
.date-strip-cell:hover {
  transform: scaleY(1.25);
  z-index: 2;
}

@media (hover: none) {
  .date-strip-cell:hover { transform: none; }
}

.date-strip-detail {
  margin-top: 6px;
  padding: 8px 10px;
  background: var(--surface-card-muted);
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

/* Spatial Crew */
.crew-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: transparent;
  border: 1px dashed var(--surface-border-strong);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal);
  align-self: flex-start;
}
.crew-toggle-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}
.crew-chevron {
  transition: transform var(--transition-normal);
  color: var(--text-tertiary);
}
.crew-chevron.open { transform: rotate(180deg); }

.crew-list {
  list-style: none;
  padding: var(--space-2) var(--space-3);
  margin: 0;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.crew-member {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
}
.crew-member-badge {
  font-size: 10px;
  font-weight: var(--font-semibold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: var(--radius-full);
  background: var(--color-warning-100);
  color: var(--color-warning-700);
}
.crew-member-name { color: var(--text-primary); }

/* Card footer */
.card-footer-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--space-2);
  margin-top: auto;
  padding-top: var(--space-2);
  border-top: 1px solid var(--surface-border);
}

/* Owner overflow menu */
.owner-overflow { position: relative; }
.owner-overflow-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 6px);
  min-width: 180px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 4px;
  z-index: var(--z-popover);
  display: flex;
  flex-direction: column;
  gap: 2px;
  animation: menuIn 120ms ease-out;
}
@keyframes menuIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.owner-overflow-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 8px 10px;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  border-radius: var(--radius-sm);
  text-align: left;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.owner-overflow-item:hover {
  background: var(--surface-hover);
}
.owner-overflow-item svg { color: var(--text-tertiary); }
.owner-overflow-item:hover svg { color: var(--color-primary-500); }
.owner-overflow-item.danger { color: var(--color-error-600); }
.owner-overflow-item.danger svg { color: var(--color-error-500); }
.owner-overflow-item.danger:hover {
  background: var(--color-error-50);
  color: var(--color-error-700);
}
.owner-overflow-divider {
  height: 1px;
  background: var(--surface-border);
  margin: 2px 4px;
}

/* ─── Modal (preserved, lightly refreshed) ─────────────── */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-4);
  padding-top: env(safe-area-inset-top, var(--space-4));
  padding-bottom: env(safe-area-inset-bottom, var(--space-4));
}
.modal {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-xl);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--surface-border);
}
.modal-close {
  background: none;
  border: none;
  font-size: var(--text-xl);
  color: var(--text-secondary);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  transition: background var(--transition-normal);
  min-height: 36px;
  min-width: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-close:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}
.modal-content { padding: var(--space-5); }
.modal-actions {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--surface-border);
  flex-wrap: wrap;
}
.modal .form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
}

/* ─── Multi-date picker (preserved) ────────────────────── */
.date-range-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.date-range-row .form-input { flex: 1; min-width: 120px; }
.date-separator {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  white-space: nowrap;
}

.multi-date-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.multi-date-add-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.multi-date-add-row .form-input { flex: 1; min-width: 140px; }

.btn-sm {
  padding: 6px 10px;
  font-size: var(--text-xs);
  white-space: nowrap;
  flex-shrink: 0;
}

.multi-date-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.date-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  background: var(--color-primary-50);
  color: var(--color-primary-700);
  padding: 4px 8px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  line-height: 1.4;
}
.date-tag.show {
  background: var(--color-warning-50);
  color: var(--color-warning-700);
}
.date-tag.show .date-tag-remove { color: var(--color-warning-500); }
.date-tag.show .date-tag-remove:hover {
  background: var(--color-warning-100);
  color: var(--color-warning-800);
}
.date-tag-remove {
  background: none;
  border: none;
  color: var(--color-primary-500);
  cursor: pointer;
  padding: 0;
  margin-left: var(--space-1);
  font-size: var(--text-xs);
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.date-tag-remove:hover {
  background: var(--color-primary-100);
  color: var(--color-primary-800);
}
.multi-date-empty {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  font-style: italic;
}
.date-group-separator {
  color: var(--text-tertiary);
  margin: 0 var(--space-1);
}

/* ─── Tablet ───────────────────────────────────────────── */
@media (min-width: 601px) {
  .projects { padding: var(--space-6); }
  .page-title { font-size: var(--text-3xl); }
  .page-subtitle { font-size: var(--text-base); }
  .form-grid { grid-template-columns: 1fr 1fr; }
  .modal .form-grid { grid-template-columns: 1fr 1fr; }
  .projects-grid { grid-template-columns: repeat(2, 1fr); }
}

/* ─── Desktop ──────────────────────────────────────────── */
@media (min-width: 1025px) {
  .projects {
    padding: var(--space-8);
  }
  .form-grid { grid-template-columns: repeat(3, 1fr); }
  .projects-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-4);
  }
  .modal { max-width: 700px; }
  .modal .form-grid { grid-template-columns: 1fr 1fr; }
}

/* ─── Mobile-specific adjustments ──────────────────────── */
@media (max-width: 768px) {
  .page-head-inner { align-items: flex-start; }
  .page-head-actions .btn-primary .btn-text { display: none; }
  .page-head-actions .btn-primary {
    padding: 0;
    width: 40px;
  }
  .filter-right { margin-left: 0; }
  .search-field { flex: 1 1 100%; }
  .status-segmented { flex: 1 1 auto; }
  .sort-control { display: none; }
  .mobile-filter-toggle { display: inline-flex; }
  .filter-rail { top: 52px; }
  .date-strip { gap: 6px; }
  .date-strip-numbers { display: none; }
  .date-strip-track { height: 28px; min-height: 28px; }
  .date-strip-cell { height: 100%; min-height: 28px; border-radius: 3px; }
  .date-strip-months { height: 14px; }
  .month-label { font-size: 9px; }
  .card-meta-row { gap: var(--space-3); }
}

/* ─── Accessibility ────────────────────────────────────── */
@media (prefers-contrast: high) {
  .project-card,
  .filter-rail,
  .form-input,
  .sort-control-select,
  .search-field-input {
    border-width: 2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .btn-primary,
  .btn-ghost,
  .icon-only-btn,
  .segmented-option,
  .project-card,
  .crew-chevron,
  .sort-control-select,
  .search-field-input {
    transition: none;
  }
  .icon-only-btn.spinning svg { animation: none; }
  .owner-overflow-menu { animation: none; }
  .loading-skeleton .skeleton-header,
  .loading-skeleton .skeleton-toolbar,
  .loading-skeleton .skeleton-tabs,
  .loading-skeleton .skeleton-projects { animation-duration: 3s; }
}

</style>