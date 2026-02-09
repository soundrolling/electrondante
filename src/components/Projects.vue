<!-- ───────────────────────────────────────────────────────────
     src/components/Projects.vue
──────────────────────────────────────────────────────────────-->
<template>
<div class="projects">
  <!-- ─── PAGE‑TITLE & TOP‑BAR ─────────────────────────────── -->
  <header class="page-header ui-page-header">
    <div class="page-actions">
      <!-- Left group: filters and utilities -->
      <div class="actions-left">
        <button @click="refreshProjects" class="btn btn-warning action-btn refresh-btn">
          <span class="btn-icon">🔄</span>
          <span class="btn-text">Refresh</span>
        </button>
        <div class="sorter">
          <label for="sort" class="sorter-label">Sort by:</label>
          <div class="select-wrapper">
            <select
              id="sort"
              v-model="selectedSortOption"
              @change="sortProjects"
              class="form-select"
            >
              <option value="newest">Newest → Oldest</option>
              <option value="oldest">Oldest → Newest</option>
              <option value="az">A → Z</option>
              <option value="za">Z → A</option>
            </select>
            <span class="select-arrow">▼</span>
          </div>
        </div>
        <!-- Status filter dropdown (replaces tabs) -->
        <div class="sorter">
          <label for="status" class="sorter-label">Status:</label>
          <div class="select-wrapper">
            <select
              id="status"
              v-model="selectedStatus"
              class="form-select"
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
            <span class="select-arrow">▼</span>
          </div>
        </div>
        <div class="search-wrapper">
          <span class="search-icon">🔍</span>
          <input
            v-model="searchQuery"
            placeholder="Search projects…"
            class="search-input"
          />
        </div>
      </div>

      <!-- Right group: primary action(s) -->
      <div class="actions-right">
        <button @click="toggleNewProjectForm" class="btn btn-positive action-btn new-project-btn">
          <span class="btn-icon">{{ showNewProjectForm ? '✕' : '➕' }}</span>
          <span class="btn-text">{{ showNewProjectForm ? 'Close' : 'New Project' }}</span>
        </button>
        <button class="btn action-btn options-btn" @click="showMobileOptions = !showMobileOptions">
          <span class="btn-icon">⋯</span>
          <span class="btn-text">Options</span>
        </button>
      </div>
    </div>
  </header>

  <!-- Mobile collapsible options -->
  <div class="mobile-options" :class="{ open: showMobileOptions }">
    <div class="mobile-options-inner">
      <button @click="refreshProjects" class="btn btn-warning action-btn refresh-btn">
        <span class="btn-icon">🔄</span>
        <span class="btn-text">Refresh</span>
      </button>
      <div class="sorter">
        <label for="sort_m" class="sorter-label">Sort by:</label>
        <div class="select-wrapper">
          <select
            id="sort_m"
            v-model="selectedSortOption"
            @change="sortProjects"
            class="form-select"
          >
            <option value="newest">Newest → Oldest</option>
            <option value="oldest">Oldest → Newest</option>
            <option value="az">A → Z</option>
            <option value="za">Z → A</option>
          </select>
          <span class="select-arrow">▼</span>
        </div>
      </div>
      <!-- Status dropdown for mobile options -->
      <div class="sorter">
        <label for="status_m" class="sorter-label">Status:</label>
        <div class="select-wrapper">
          <select
            id="status_m"
            v-model="selectedStatus"
            class="form-select"
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
          <span class="select-arrow">▼</span>
        </div>
      </div>
      <div class="search-wrapper">
        <span class="search-icon">🔍</span>
        <input
          v-model="searchQuery"
          placeholder="Search projects…"
          class="search-input"
        />
      </div>
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
          <textarea
            id="newProjectShowDays"
            v-model="newProjectShowDays"
            placeholder="Comma-separated dates: 2024-07-01,2024-07-02"
            class="form-input"
            rows="2"
          ></textarea>
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

    <div class="projects-section">
      <div class="projects-grid">
        <div v-for="p in displayedProjects" :key="p.id" :class="['project-card', { archived: p.archived } ]">
          <div v-if="p.archived" class="archived-badge">Archived</div>
          <div class="project-header">
            <h3 class="project-title">{{ p.project_name }}</h3>
            <div v-if="p.role === 'owner'" class="project-badge owner">Owner</div>
          </div>
          
          <div class="project-meta">
            <div v-if="p.location" class="meta-item">
              <span class="meta-icon">📍</span>
              <span class="meta-text">{{ p.location }}</span>
            </div>
            <div v-if="p.official_website" class="meta-item">
              <span class="meta-icon">🌐</span>
              <a :href="p.official_website" target="_blank" rel="noopener" class="meta-link">
                Official Website
              </a>
            </div>
          </div>

          <div v-if="(p.main_show_days && p.main_show_days.length) || (p.build_days && p.build_days.length)" class="project-timeline">
            <div v-if="p.build_days && p.build_days.length" class="timeline-item">
              <div class="timeline-icon build">🔨</div>
              <div class="timeline-content">
                <div class="timeline-label">Build Days</div>
                <div class="timeline-dates">
                  <span v-for="(group, gi) in groupConsecutiveDates(p.build_days)" :key="gi">
                    <span v-if="gi > 0" class="date-group-separator"> · </span>
                    <span v-if="group.length === 1">{{ formatSingleDate(group[0]) }}</span>
                    <span v-else>{{ formatSingleDate(group[0]) }} – {{ formatSingleDate(group[group.length - 1]) }}</span>
                  </span>
                </div>
              </div>
            </div>
            <div v-if="p.main_show_days && p.main_show_days.length" class="timeline-item">
              <div class="timeline-icon show">🎭</div>
              <div class="timeline-content">
                <div class="timeline-label">Show Period</div>
                <div class="timeline-dates">
                  {{ formatSingleDate(p.main_show_days[0]) }} - {{ formatSingleDate(p.main_show_days[p.main_show_days.length-1]) }}
                </div>
              </div>
            </div>
          </div>

          <div class="project-actions">
            <button @click="openProject(p)" class="btn btn-positive open-btn">
              <span class="btn-icon">🚀</span>
              <span class="btn-text">Open Project</span>
            </button>
            
            <template v-if="!p.archived">
              <div v-if="p.role === 'owner'" class="owner-actions">
                <button @click="openEditModal(p)" class="btn btn-warning icon-only" title="Edit Project">
                  <span class="btn-icon">✏️</span>
                  <span class="icon-label">Edit</span>
                </button>
                <button @click="duplicateProject(p)" class="btn btn-warning icon-only" title="Duplicate Project">
                  <span class="btn-icon">📋</span>
                  <span class="icon-label">Duplicate</span>
                </button>
                <button @click="archiveProject(p)" class="btn btn-danger icon-only" title="Archive Project">
                  <span class="btn-icon">📦</span>
                  <span class="icon-label">Archive</span>
                </button>
                <button @click="confirmDeleteProject(p.id)" class="btn btn-danger icon-only" title="Delete Project">
                  <span class="btn-icon">🗑️</span>
                  <span class="icon-label">Delete</span>
                </button>
              </div>
              <button
                v-if="p.role !== 'owner'"
                @click="leaveProject(p)"
                class="btn btn-danger leave-btn"
              >
                <span class="btn-icon">👋</span>
                <span class="btn-text">Leave Project</span>
              </button>
            </template>
            <template v-else>
              <div v-if="p.role === 'owner'" class="owner-actions">
                <button @click="unarchiveProject(p)" class="btn btn-positive icon-only" title="Unarchive Project">
                  <span class="btn-icon">📤</span>
                  <span class="icon-label">Restore</span>
                </button>
              </div>
            </template>
          </div>
        </div>
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
            <div class="date-range-row">
              <input
                v-model="editShowFrom"
                type="date"
                class="form-input"
                placeholder="From"
              />
              <span class="date-separator">to</span>
              <input
                v-model="editShowTo"
                type="date"
                class="form-input"
                placeholder="To"
              />
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
import { ref, computed, onMounted } from 'vue';
import { useRouter }                from 'vue-router';
import { supabase }                 from '@/supabase';
import { useUserStore }             from '@/stores/userStore';
import { useToast }                 from 'vue-toastification';
import { mutateTableData }          from '@/services/dataService';

// Cache key will be generated dynamically with user ID for security
const getCacheKey = (userId) => `userProjects_${userId}`;

export default {
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
  const newProjectBuildDays = ref('');
  const newBuildDaysList    = ref([]);
  const newBuildNewDate     = ref('');
  const newProjectWebsite  = ref('');
  const showEditModal      = ref(false);
  const editProjectId      = ref(null);
  const editProjectName    = ref('');
  const editProjectLocation = ref('');
  const editShowFrom       = ref('');
  const editShowTo         = ref('');
  const editBuildDays      = ref([]);
  const editBuildNewDate   = ref('');
  const editProjectWebsite = ref('');
  const activeTab          = ref('active');
  const selectedStatus     = ref('active');
  const showMobileOptions  = ref(false);

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
      localStorage.setItem(cacheKey, JSON.stringify(projects.value));
      sortProjects();
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

  const refreshProjects = async () => {
    if (!navigator.onLine) {
      toast.error('Refresh is only available when online.');
      return;
    }
    // Clear user-specific cache
    const { data: session } = await supabase.auth.getSession();
    const uid = session?.session?.user?.id;
    if (uid) {
      localStorage.removeItem(getCacheKey(uid));
    }
    fetchUserProjects(true);
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
      const showDaysArr = newProjectShowDays.value
        .split(',')
        .map(d => d.trim())
        .filter(Boolean);
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
    return `${weekday} ${day} ${month}`;
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

  function openEditModal(project) {
    editProjectId.value = project.id;
    editProjectName.value = project.project_name || '';
    editProjectLocation.value = project.location || '';
    editProjectWebsite.value = project.official_website || '';
    // Show days range
    if (Array.isArray(project.main_show_days) && project.main_show_days.length) {
      editShowFrom.value = project.main_show_days[0];
      editShowTo.value = project.main_show_days[project.main_show_days.length - 1];
    } else {
      editShowFrom.value = '';
      editShowTo.value = '';
    }
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
    editShowFrom.value = '';
    editShowTo.value = '';
    editBuildDays.value = [];
    editBuildNewDate.value = '';
  }

  async function saveEditProject() {
    const showDaysArr = getDateRange(editShowFrom.value, editShowTo.value);
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
    editShowFrom,
    editShowTo,
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

/* Base Styles - Mobile First */
.projects {
  min-height: 100vh;
  background: var(--bg-primary);
  padding: var(--space-4);
  padding-top: env(safe-area-inset-top, var(--space-4));
  padding-bottom: env(safe-area-inset-bottom, var(--space-4));
  font-family: var(--font-family-sans);
  line-height: var(--leading-normal);
  color: var(--text-primary);
}

/* Typography Scale */
.page-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  line-height: var(--leading-tight);
  margin: 0 0 var(--space-4) 0;
  color: var(--text-heading);
}

.form-title,
.modal-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  line-height: var(--leading-snug);
  margin: 0 0 var(--space-4) 0;
  color: var(--text-heading);
}

/* Page Header */
.page-header {
  margin-bottom: var(--space-6);
  padding: var(--space-4);
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-light);
}

.page-actions {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-3);
  align-items: center;
}

/* Normalize control sizing in header row */
.page-actions .btn,
.page-actions .form-select,
.page-actions .search-input,
.page-actions .tab-btn {
  min-height: 44px;
  height: 44px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-normal);
  min-height: 44px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

/* Header action groups */
.actions-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: nowrap;
}
.actions-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.options-btn {
  display: none; /* hidden on desktop */
  background: var(--bg-tertiary);
}

.action-btn:hover {
  border-color: var(--color-primary-500);
  box-shadow: var(--shadow-md);
}

.action-btn:active {
  transform: scale(0.98);
}

/* Pill-style action buttons using CSS variables for dark mode */
.refresh-btn {
  background: var(--pill-warning-bg);
  color: var(--pill-warning-text);
  border: 2px solid var(--pill-warning-border);
}
.refresh-btn:hover {
  background: var(--pill-warning-hover-bg);
}

.new-project-btn {
  background: var(--pill-primary-bg);
  color: var(--pill-primary-text);
  border: 2px solid var(--pill-primary-border);
}
.new-project-btn:hover {
  background: var(--pill-primary-hover-bg);
}

.btn-icon {
  font-size: var(--text-lg);
}

.btn-text {
  font-size: var(--text-base);
}

/* Loading Skeleton */
.loading-skeleton {
  padding: var(--space-4);
}

.skeleton-header,
.skeleton-toolbar,
.skeleton-tabs,
.skeleton-projects {
  background: linear-gradient(90deg, var(--color-secondary-100) 25%, var(--color-secondary-200) 50%, var(--color-secondary-100) 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
}

.skeleton-header { height: 80px; }
.skeleton-toolbar { height: 60px; }
.skeleton-tabs { height: 50px; }

.skeleton-projects {
  height: 300px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
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

/* New Project Form */
.new-project-form {
  margin-bottom: var(--space-6);
  padding: var(--space-5);
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-light);
}

.form-grid {
  display: grid;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-label {
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
  font-size: var(--text-base);
  line-height: var(--leading-snug);
}

.form-input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 2px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: all var(--transition-normal);
  min-height: 44px;
  box-sizing: border-box;
  box-shadow: var(--shadow-sm);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
}

.form-input::placeholder {
  color: var(--text-tertiary);
}

.form-actions {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

/* Toolbar */
.toolbar {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
  padding: var(--space-4);
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-light);
}

/* Mobile collapsible options */
.mobile-options {
  display: none;
}
.mobile-options.open {
  display: block;
}
.mobile-options-inner {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  margin-top: var(--space-3);
}

.toolbar-left,
.toolbar-right {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.sorter {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.sorter-label {
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  font-size: var(--text-base);
}

.select-wrapper {
  position: relative;
  min-width: 260px;
}

.form-select {
  width: 100%;
  padding: var(--space-3) 48px var(--space-3) var(--space-4);
  border: 2px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 44px;
  appearance: none;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
}

.select-arrow {
  position: absolute;
  right: var(--space-4);
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-secondary);
  pointer-events: none;
}

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: var(--space-4);
  font-size: var(--text-lg);
  color: var(--text-tertiary);
  z-index: 2;
}

.search-input {
  width: 100%;
  padding: var(--space-3) var(--space-4) var(--space-3) 48px;
  border: 2px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 44px;
  box-shadow: var(--shadow-sm);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
}

/* Project Tabs */
.project-tabs {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
  overflow-x: auto;
  padding-bottom: var(--space-2);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border: 2px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-normal);
  min-height: 44px;
  white-space: nowrap;
}

.tab-btn:hover {
  border-color: var(--color-primary-500);
  color: var(--color-primary-700);
}

.tab-btn.active {
  background: var(--color-primary-500);
  color: var(--text-inverse);
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.tab-icon {
  font-size: var(--text-lg);
}

.tab-text {
  font-size: var(--text-base);
}

/* Projects Grid */
.projects-section {
  margin-bottom: var(--space-6);
}

.projects-grid {
  display: flex;
  flex-direction: column;
  gap: 0;
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--space-1);
}

.project-card {
  background: var(--bg-primary);
  border: none;
  border-bottom: 1px solid var(--border-light);
  border-radius: 0;
  padding: var(--space-4);
  transition: background var(--transition-fast);
  position: relative;
}

.project-card:last-child {
  border-bottom: none;
}

.project-card:hover {
  background: var(--bg-tertiary);
}

.project-card.archived {
  opacity: 0.7;
  background: var(--bg-secondary);
}

.archived-badge {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  background: var(--color-secondary-500);
  color: var(--text-inverse);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-3);
}

.project-title {
  font-size: var(--text-base);
  font-weight: var(--font-bold);
  color: var(--text-heading);
  margin: 0;
  line-height: var(--leading-snug);
  letter-spacing: -0.01em;
}

.project-badge {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
}

.project-badge.owner {
  background: var(--pill-badge-owner-bg);
  color: var(--pill-badge-owner-text);
}

/* Project Meta */
.project-meta {
  margin-bottom: var(--space-3);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  font-size: var(--text-sm);
}

.meta-icon {
  font-size: var(--text-base);
  width: 20px;
  text-align: center;
  opacity: 0.7;
}

.meta-text {
  color: var(--text-secondary);
}

.meta-link {
  color: var(--color-primary-500);
  text-decoration: none;
  font-weight: var(--font-medium);
}

.meta-link:hover {
  text-decoration: underline;
}

/* Project Timeline */
.project-timeline {
  margin-bottom: var(--space-3);
}

.timeline-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  background: transparent;
  border-radius: 0;
  margin-bottom: var(--space-1);
  border: none;
}

.timeline-item:last-child {
  margin-bottom: 0;
}

.timeline-icon {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  flex-shrink: 0;
}

.timeline-icon.build {
  background: var(--color-primary-100);
  color: var(--color-primary-700);
}

.timeline-icon.show {
  background: var(--color-warning-100);
  color: var(--color-warning-700);
}

.timeline-content {
  flex: 1;
}

.timeline-label {
  font-weight: var(--font-semibold);
  font-size: var(--text-xs);
  margin-bottom: 2px;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.timeline-dates {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

/* Project Actions */
.project-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.open-btn {
  width: 100%;
}

.owner-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: center;
}

/* Icon-only buttons */
.owner-actions .btn.icon-only {
  padding: var(--space-2);
  min-width: 44px;
  min-height: 44px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-radius: var(--radius-md);
  background: transparent;
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
  box-shadow: none;
}

.owner-actions .btn.icon-only:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-medium);
}

.owner-actions .btn.icon-only .btn-icon {
  font-size: var(--text-lg);
  margin: 0;
}

.owner-actions .btn.icon-only .btn-text {
  display: none;
}

.icon-label {
  font-size: 10px;
  line-height: 1;
  opacity: 0.85;
  font-weight: var(--font-medium);
  letter-spacing: 0.01em;
}

/* Pill-style card action buttons using CSS variables */
.project-actions .open-btn {
  background: var(--pill-positive-bg);
  color: var(--pill-positive-text);
  border: 1px solid var(--pill-positive-border);
  box-shadow: none;
}
.project-actions .open-btn:hover {
  background: var(--pill-positive-hover-bg);
}

.project-actions .leave-btn {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-medium);
  box-shadow: none;
}
.project-actions .leave-btn:hover {
  background: var(--bg-tertiary);
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-4);
  padding-top: env(safe-area-inset-top, var(--space-4));
  padding-bottom: env(safe-area-inset-bottom, var(--space-4));
}

.modal {
  background: var(--bg-primary);
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
  padding: var(--space-5) var(--space-5) var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-light);
}

.modal-close {
  background: none;
  border: none;
  font-size: var(--text-2xl);
  color: var(--text-secondary);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  transition: all var(--transition-normal);
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.modal-content {
  padding: var(--space-5);
}

.modal-actions {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5) var(--space-5) var(--space-5);
  border-top: 1px solid var(--border-light);
  flex-wrap: wrap;
}

/* Modal Form Grid */
.modal .form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
}

/* Date Range */
.date-range-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.date-range-row .form-input {
  flex: 1;
  min-width: 120px;
}

.date-separator {
  color: var(--text-secondary);
  font-size: var(--text-base);
  white-space: nowrap;
  flex-shrink: 0;
}

/* Multi-Date Picker */
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

.multi-date-add-row .form-input {
  flex: 1;
  min-width: 140px;
}

.btn-sm {
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
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
  background: var(--color-primary-100);
  color: var(--color-primary-700);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full, 9999px);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  line-height: 1.4;
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
  transition: background 0.15s, color 0.15s;
}

.date-tag-remove:hover {
  background: var(--color-primary-200);
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

/* Focus States for Accessibility */
.action-btn:focus,
.tab-btn:focus,
.btn:focus,
.form-input:focus,
.form-select:focus,
.search-input:focus,
.modal-close:focus {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

/* Tablet Breakpoint (601px - 1024px) */
@media (min-width: 601px) {
  .projects {
    padding: var(--space-6);
  }

  .page-title {
    font-size: var(--text-3xl);
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .page-actions { grid-template-columns: auto auto; }

  .toolbar {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .toolbar-left,
  .toolbar-right {
    flex-direction: row;
    align-items: center;
  }

  .sorter {
    flex-direction: row;
    align-items: center;
    gap: var(--space-3);
  }

  .form-grid {
    grid-template-columns: 1fr 1fr;
  }

  .modal .form-grid {
    grid-template-columns: 1fr 1fr;
  }

  .owner-actions {
    justify-content: center;
    gap: var(--space-3);
  }

  .owner-actions .btn.icon-only {
    padding: var(--space-3);
    min-width: 48px;
    min-height: 48px;
  }

  .projects-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-4);
  }

  .project-card {
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    border-bottom: 1px solid var(--border-light);
  }

  .project-card:last-child {
    border-bottom: 1px solid var(--border-light);
  }
}

/* Desktop Breakpoint (1025px+) */
@media (min-width: 1025px) {
  .projects {
    padding: var(--space-8);
    max-width: 1400px;
    margin: 0 auto;
  }

  .page-title {
    font-size: var(--text-4xl);
  }

  .form-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .projects-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-4);
  }

  .modal {
    max-width: 700px;
  }

  .modal .form-grid {
    grid-template-columns: 1fr 1fr;
  }

  .toolbar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: var(--space-4);
  }
  .toolbar-left { justify-self: start; }
  .toolbar-center { justify-self: center; }
  .toolbar-right { justify-self: end; width: 100%; max-width: 520px; }

  .toolbar .project-tabs {
    margin-bottom: 0;
    padding-bottom: 0;
  }
}

/* Mobile behaviors */
@media (max-width: 768px) {
  .actions-left { display: none; }
  .options-btn { display: inline-flex; }
}

/* Ensure options never show on desktop */
@media (min-width: 769px) {
  .options-btn { display: none; }
  .mobile-options { display: none; }
}

/* High Contrast Mode Support */
@media (prefers-contrast: high) {
  .project-card,
  .form-input,
  .form-select,
  .search-input {
    border-width: 2px;
  }
}

/* Reduced Motion Support */
@media (prefers-reduced-motion: reduce) {
  .action-btn,
  .btn,
  .tab-btn {
    transition: none;
  }

  .action-btn:hover,
  .btn:hover,
  .tab-btn:hover {
    transform: none;
  }

  .action-btn:active,
  .btn:active,
  .tab-btn:active {
    transform: none;
  }
}
</style>