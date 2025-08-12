<!-- ───────────────────────────────────────────────────────────
     src/components/Projects.vue
──────────────────────────────────────────────────────────────-->
<template>
<div class="projects">
  <!-- ─── PAGE‑TITLE & TOP‑BAR ─────────────────────────────── -->
  <header class="page-bar compact-bar">
    <h1 class="page-title compact-title">Your Projects</h1>
    <div class="page-actions compact-actions">
      <button @click="refreshProjects" class="btn btn-blue compact-btn">
        <i class="fas fa-sync-alt" /> Refresh
      </button>
      <button @click="toggleNewProjectForm" class="btn btn-green compact-btn">
        <i class="fas fa-plus" />
        {{ showNewProjectForm ? 'Close' : 'New Project' }}
      </button>
    </div>
  </header>

  <!-- ─── LOADING ──────────────────────────────────────────── -->
  <div v-if="loading" class="loading">
    <div class="spinner" /><span>Loading projects…</span>
  </div>

  <!-- ─── MAIN CONTENT ─────────────────────────────────────── -->
  <div v-else>
    <!-- new‑project form -->
    <form
      v-if="userStore.isAuthenticated && showNewProjectForm"
      class="new-form"
      @submit.prevent="addProject"
    >
      <h2>Create a New Project</h2>
      <input
        v-model="newProjectName"
        placeholder="Project name…"
        class="input"
      />
      <input
        v-model="newProjectLocation"
        placeholder="Location (e.g. London, UK)"
        class="input"
        style="margin-top: 10px;"
      />
      <input
        v-model="newProjectWebsite"
        placeholder="Official festival website (https://...)"
        class="input"
        style="margin-top: 10px;"
        type="url"
      />
      <textarea
        v-model="newProjectShowDays"
        placeholder="Show days (comma-separated, e.g. 2024-07-01,2024-07-02)"
        class="input"
        style="margin-top: 10px;"
        rows="2"
      ></textarea>
      <textarea
        v-model="newProjectBuildDays"
        placeholder="Build days (comma-separated, e.g. 2024-06-29,2024-06-30)"
        class="input"
        style="margin-top: 10px;"
        rows="2"
      ></textarea>
      <div class="new-form__actions">
        <button type="submit" class="btn btn-green">Add</button>
        <button type="button" @click="cancelNewProject" class="btn btn-red">
          Cancel
        </button>
      </div>
    </form>

    <!-- sorter + search -->
    <div class="toolbar compact-toolbar">
      <div class="sorter compact-sorter">
        <label for="sort">Sort by:</label>
        <div class="select-wrapper">
          <select
            id="sort"
            v-model="selectedSortOption"
            @change="sortProjects"
            class="input select compact-input styled-select"
          >
            <option value="newest">Newest → Oldest</option>
            <option value="oldest">Oldest → Newest</option>
            <option value="az">A → Z</option>
            <option value="za">Z → A</option>
          </select>
          <span class="select-arrow">▼</span>
        </div>
      </div>
      <input
        v-model="searchQuery"
        placeholder="Search projects…"
        class="input search-input compact-input"
      />
    </div>

    <div class="project-tabs">
      <button
        :class="['tab-btn', { active: activeTab === 'active' }]"
        @click="activeTab = 'active'"
      >Active Projects</button>
      <button
        :class="['tab-btn', { active: activeTab === 'archived' }]"
        @click="activeTab = 'archived'"
      >Archived Projects</button>
    </div>

    <div v-if="activeTab === 'active'">
      <ul class="cards">
        <li v-for="p in activeProjects" :key="p.id" class="card">
          <div class="card__main">
            <h3 class="card__title">{{ p.project_name }}</h3>
            <div class="project-meta">
              <div v-if="p.location"><strong>Location:</strong> {{ p.location }}</div>
              <div v-if="p.official_website" class="project-website">
                <a :href="p.official_website" target="_blank" rel="noopener" class="website-link">
                  <strong>Website</strong>
                </a>
              </div>
              <table v-if="(p.main_show_days && p.main_show_days.length) || (p.build_days && p.build_days.length)" class="date-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Start</th>
                    <th>End</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="p.build_days && p.build_days.length">
                    <td><strong>Build</strong></td>
                    <td>{{ formatSingleDate(p.build_days[0]) }}</td>
                    <td>{{ formatSingleDate(p.build_days[p.build_days.length-1]) }}</td>
                  </tr>
                  <tr v-if="p.main_show_days && p.main_show_days.length">
                    <td><strong>Show</strong></td>
                    <td>{{ formatSingleDate(p.main_show_days[0]) }}</td>
                    <td>{{ formatSingleDate(p.main_show_days[p.main_show_days.length-1]) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="p.role === 'owner'" class="owner-tools-row always-row">
              <button @click="openEditModal(p)" class="btn btn-ghost">
                <i class="fas fa-pencil-alt" /> Edit
              </button>
              <button @click="confirmDeleteProject(p.id)" class="btn btn-red">
                <i class="fas fa-trash-alt" /> Delete
              </button>
              <button @click="duplicateProject(p)" class="btn btn-ghost">
                <i class="fas fa-copy" /> Duplicate
              </button>
              <button @click="archiveProject(p)" class="btn btn-ghost archive-btn">
                <i class="fas fa-archive" /> Archive
              </button>
            </div>
          </div>
          <div class="card__actions" :class="{ 'card__actions--owner': p.role === 'owner' }">
            <button class="btn btn-green" @click="openProject(p)">Open</button>
            <button
              v-if="p.role !== 'owner'"
              @click="leaveProject(p)"
              class="btn btn-red leave-btn"
            >
              Leave
            </button>
          </div>
        </li>
      </ul>
    </div>

    <div v-if="activeTab === 'archived'">
      <ul class="cards">
        <li v-for="p in archivedProjects" :key="p.id" class="card archived-card">
          <div class="archived-badge">Archived</div>
          <div class="card__main">
            <h3 class="card__title">{{ p.project_name }}</h3>
            <div class="project-meta">
              <div v-if="p.location"><strong>Location:</strong> {{ p.location }}</div>
              <div v-if="p.official_website" class="project-website">
                <a :href="p.official_website" target="_blank" rel="noopener" class="website-link">
                  <strong>Website</strong>
                </a>
              </div>
              <table v-if="(p.main_show_days && p.main_show_days.length) || (p.build_days && p.build_days.length)" class="date-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Start</th>
                    <th>End</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="p.build_days && p.build_days.length">
                    <td><strong>Build</strong></td>
                    <td>{{ formatSingleDate(p.build_days[0]) }}</td>
                    <td>{{ formatSingleDate(p.build_days[p.build_days.length-1]) }}</td>
                  </tr>
                  <tr v-if="p.main_show_days && p.main_show_days.length">
                    <td><strong>Show</strong></td>
                    <td>{{ formatSingleDate(p.main_show_days[0]) }}</td>
                    <td>{{ formatSingleDate(p.main_show_days[p.main_show_days.length-1]) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="p.role === 'owner'" class="owner-tools-row always-row">
              <button @click="openEditModal(p)" class="btn btn-ghost">
                <i class="fas fa-pencil-alt" /> Edit
              </button>
              <button @click="confirmDeleteProject(p.id)" class="btn btn-red">
                <i class="fas fa-trash-alt" /> Delete
              </button>
              <button @click="duplicateProject(p)" class="btn btn-ghost">
                <i class="fas fa-copy" /> Duplicate
              </button>
              <button @click="unarchiveProject(p)" class="btn btn-ghost archive-btn">
                <i class="fas fa-undo" /> Unarchive
              </button>
            </div>
          </div>
          <div class="card__actions" :class="{ 'card__actions--owner': p.role === 'owner' }">
            <button class="btn btn-green" @click="openProject(p)">Open</button>
          </div>
        </li>
      </ul>
    </div>
  </div>

  <!-- Edit Project Modal -->
  <div v-if="showEditModal" class="modal-overlay" @click="closeEditModal">
    <div class="modal" @click.stop>
      <h2>Edit Project</h2>
      <div class="modal-content">
        <div class="form-group">
          <label for="editProjectName">Project Name:</label>
          <input
            id="editProjectName"
            v-model="editProjectName"
            type="text"
            class="input"
            placeholder="Project name"
          />
        </div>
        <div class="form-group">
          <label for="editProjectLocation">Location:</label>
          <input
            id="editProjectLocation"
            v-model="editProjectLocation"
            type="text"
            class="input"
            placeholder="Location (e.g. London, UK)"
          />
        </div>
        <div class="form-group">
          <label for="editProjectWebsite">Official Website:</label>
          <input
            id="editProjectWebsite"
            v-model="editProjectWebsite"
            type="url"
            class="input"
            placeholder="https://..."
          />
        </div>
        <div class="date-range-group">
          <label>Show Days:</label>
          <div class="date-range-row">
            <input
              v-model="editShowFrom"
              type="date"
              class="input"
              placeholder="From"
            />
            <span>to</span>
            <input
              v-model="editShowTo"
              type="date"
              class="input"
              placeholder="To"
            />
          </div>
        </div>
        <div class="date-range-group">
          <label>Build Days:</label>
          <div class="date-range-row">
            <input
              v-model="editBuildFrom"
              type="date"
              class="input"
              placeholder="From"
            />
            <span>to</span>
            <input
              v-model="editBuildTo"
              type="date"
              class="input"
              placeholder="To"
            />
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button @click="closeEditModal" class="btn btn-ghost">Cancel</button>
        <button @click="saveEditProject" class="btn btn-green">Save Changes</button>
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

const LS_KEY = 'userProjects';

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
  const newProjectWebsite  = ref('');
  const showEditModal      = ref(false);
  const editProjectId      = ref(null);
  const editProjectName    = ref('');
  const editProjectLocation = ref('');
  const editShowFrom       = ref('');
  const editShowTo         = ref('');
  const editBuildFrom      = ref('');
  const editBuildTo        = ref('');
  const editProjectWebsite = ref('');
  const activeTab          = ref('active');

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
      if (!force) {
        const cached = localStorage.getItem(LS_KEY);
        if (cached) {
          projects.value = JSON.parse(cached);
          sortProjects();
          return;
        }
      }
      loading.value = true;

      const { data: session } = await supabase.auth.getSession();
      const uid   = session?.session?.user?.id || '';
      const email = session?.session?.user?.email?.toLowerCase() || '';

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
          projects:project_id ( id, project_name, created_at, user_id )
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
      localStorage.setItem(LS_KEY, JSON.stringify(projects.value));
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

  const refreshProjects = () => {
    if (!navigator.onLine) {
      toast.error('Refresh is only available when online.');
      return;
    }
    localStorage.removeItem(LS_KEY);
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
      const buildDaysArr = newProjectBuildDays.value
        .split(',')
        .map(d => d.trim())
        .filter(Boolean);

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
      localStorage.setItem(LS_KEY, JSON.stringify(projects.value));
      toast.success('Project created.');
      newProjectName.value='';
      newProjectLocation.value='';
      newProjectShowDays.value='';
      newProjectBuildDays.value='';
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
      localStorage.setItem(LS_KEY, JSON.stringify(projects.value));
      toast.success('Project renamed.');
    } catch(e){ toast.error(e.message); }
  };

  const confirmDeleteProject = async id => {
    if (!confirm('Delete this project permanently?')) return;
    try {
      await mutateTableData('projects','delete',{ id });
      projects.value = projects.value.filter(p=>p.id!==id);
      localStorage.setItem(LS_KEY, JSON.stringify(projects.value));
      toast.success('Project deleted.');
    } catch(e){ toast.error(e.message); }
  };

  const duplicateProject = async src => {
    if (!confirm('Duplicate this project?')) return;
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
      localStorage.setItem(LS_KEY, JSON.stringify(projects.value));
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
      localStorage.setItem(LS_KEY, JSON.stringify(projects.value));
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
    // Build days range
    if (Array.isArray(project.build_days) && project.build_days.length) {
      editBuildFrom.value = project.build_days[0];
      editBuildTo.value = project.build_days[project.build_days.length - 1];
    } else {
      editBuildFrom.value = '';
      editBuildTo.value = '';
    }
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
    editBuildFrom.value = '';
    editBuildTo.value = '';
  }

  async function saveEditProject() {
    const showDaysArr = getDateRange(editShowFrom.value, editShowTo.value);
    const buildDaysArr = getDateRange(editBuildFrom.value, editBuildTo.value);
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
      localStorage.setItem(LS_KEY, JSON.stringify(projects.value));
      toast.success('Project updated.');
      closeEditModal();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function archiveProject(p) {
    try {
      await mutateTableData('projects', 'update', { id: p.id, archived: true });
      p.archived = true;
      localStorage.setItem(LS_KEY, JSON.stringify(projects.value));
      toast.success('Project archived.');
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function unarchiveProject(p) {
    try {
      await mutateTableData('projects', 'update', { id: p.id, archived: false });
      p.archived = false;
      localStorage.setItem(LS_KEY, JSON.stringify(projects.value));
      toast.success('Project unarchived.');
    } catch (e) {
      toast.error(e.message);
    }
  }

  /* ───────── LIFECYCLE ───────── */
  onMounted(()=>fetchUserProjects(false));

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
    newProjectWebsite,
    formatSingleDate,
    showEditModal,
    editProjectId,
    editProjectName,
    editProjectLocation,
    editShowFrom,
    editShowTo,
    editBuildFrom,
    editBuildTo,
    editProjectWebsite,
    openEditModal,
    closeEditModal,
    saveEditProject,
    activeProjects,
    archivedProjects,
    archiveProject,
    unarchiveProject,
    activeTab,
  };
},
};
</script>

<style scoped>
/* ---------- CONTAINER ---------- */
.projects {
  max-width: 900px;
  margin: 32px auto;
  padding: 32px;
  background: #f8f9fa;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  font-family: 'Segoe UI', Arial, sans-serif;
  border: 1px solid #e5e7eb;
}

/* ---------- BUTTONS ---------- */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  font-size: 0.95rem;
  padding: 10px 18px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s, box-shadow 0.2s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}
.btn-blue {
  background: #3b82f6;
  color: #fff;
}
.btn-blue:hover {
  background: #2563eb;
}
.btn-green {
  background: #10b981;
  color: #fff;
}
.btn-green:hover {
  background: #059669;
}
.btn-red {
  background: #ef4444;
  color: #fff;
}
.btn-red:hover {
  background: #dc2626;
}
.btn-ghost {
  background: #f9fafb;
  color: #374151;
  border: 1px solid #e5e7eb;
}
.btn-ghost:hover {
  background: #f3f4f6;
}

/* ---------- INPUTS ---------- */
.input {
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  background: #fff;
  transition: border-color 0.2s, box-shadow 0.2s;
  outline: none;
}
.input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px #dbeafe;
}
.select {
  min-width: 160px;
}
.search-input {
  flex: 1;
  min-width: 200px;
}

/* ---------- HEADER BAR ---------- */
.page-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 28px;
}
.page-title {
  margin: 0;
  font-size: 2.1rem;
  color: #222;
  font-weight: 600;
}
.page-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

/* ---------- TOOLBAR (sort + search) ---------- */
.toolbar {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
  margin: 24px 0 20px 0;
}
.sorter {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* ---------- NEW PROJECT FORM ---------- */
.new-form {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 28px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  border: 1px solid #e5e7eb;
}
.new-form h2 {
  margin: 0 0 16px;
  font-size: 1.2rem;
  color: #222;
  font-weight: 600;
}
.new-form__actions {
  display: flex;
  gap: 12px;
  margin-top: 14px;
  flex-wrap: wrap;
}

/* ---------- CARD LIST ---------- */
.cards {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.card {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 18px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 22px;
  align-items: center;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
}
.card__title {
  margin: 0 0 10px;
  font-size: 1.15rem;
  color: #1f2937;
  font-weight: 600;
}
.card__actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.card__actions--owner {
  justify-content: flex-end;
  gap: 0;
}
.leave-btn {
  margin-left: auto;
}
.owner-tools-row {
  display: flex;
  flex-direction: row;
  gap: 12px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.card__main {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ---------- LOADING ---------- */
.loading {
  display: flex;
  align-items: center;
  gap: 14px;
  justify-content: center;
  height: 120px;
  color: #555;
}
.spinner {
  border: 4px solid #f3f4f6;
  border-top: 4px solid #3b82f6;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* ---------- MISC ---------- */
.section-title {
  margin: 0 0 16px;
  font-size: 1.3rem;
  color: #222;
  font-weight: 600;
}
.no-projects {
  color: #666;
  text-align: center;
  margin: 28px 0;
}

/* ---------- RESPONSIVE ---------- */
@media (max-width: 700px) {
  .projects {
    padding: 16px;
  }
  .card {
    padding: 14px;
    grid-template-columns: 1fr;
  }
  .page-bar {
    flex-direction: column;
    align-items: flex-start;
  }
  .page-actions {
    justify-content: flex-start;
  }
  .toolbar {
    flex-direction: column;
    align-items: flex-start;
  }
  .card__actions {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .owner-tools-row {
    flex-direction: row;
    gap: 8px;
  }
}

.project-meta {
  margin-bottom: 10px;
  font-size: 0.97rem;
  color: #374151;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}
.modal {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  padding: 32px 24px 24px 24px;
  min-width: 320px;
  max-width: 95vw;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.modal h2 {
  margin: 0 0 16px;
  font-size: 1.2rem;
  color: #222;
  font-weight: 600;
}
.modal-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-group label {
  font-weight: 500;
  color: #374151;
  font-size: 0.95rem;
}
.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 18px;
  justify-content: flex-end;
}
.date-range-group {
  margin-top: 10px;
}
.date-range-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.date-lines {
  margin-left: 12px;
  margin-bottom: 4px;
  font-size: 0.97rem;
  color: #374151;
}
.date-label {
  font-weight: 500;
  margin-right: 4px;
}
.date-table {
  border-collapse: collapse;
  margin-top: 4px;
  margin-bottom: 4px;
  font-size: 0.97rem;
}
.date-table th, .date-table td {
  border: 1px solid #e5e7eb;
  padding: 4px 8px;
  text-align: left;
}

.compact-bar {
  margin-bottom: 10px;
  padding-bottom: 0;
  align-items: center;
}
.compact-title {
  font-size: 1.6rem;
  margin-bottom: 0;
  margin-right: 18px;
}
.compact-actions {
  gap: 8px;
}
.compact-btn {
  padding: 7px 16px;
  font-size: 1rem;
  border-radius: 6px;
  min-width: 0;
}
.compact-toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 0 0 10px 0;
  flex-wrap: wrap;
}
.compact-sorter {
  gap: 6px;
}
.compact-input {
  padding: 7px 10px;
  font-size: 1rem;
  border-radius: 6px;
}
@media (max-width: 700px) {
  .compact-toolbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .compact-title {
    font-size: 1.2rem;
  }
}

.select-wrapper {
  position: relative;
  display: inline-block;
}
.styled-select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background: #fff;
  border: 1.5px solid #cbd5e1;
  padding-right: 2em;
  min-width: 160px;
  cursor: pointer;
  font-size: 1rem;
  color: #222;
  transition: border-color 0.2s;
}
.styled-select:focus {
  border-color: #3b82f6;
  outline: none;
}
.select-arrow {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: #64748b;
  font-size: 1em;
}

.archived-badge {
  position: absolute;
  top: 12px;
  right: 18px;
  background: #64748b;
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 8px;
  z-index: 2;
  letter-spacing: 0.5px;
}
.archived-card {
  position: relative;
  opacity: 0.85;
  background: #f3f4f6;
}
.archive-btn {
  color: #64748b;
}
.project-section {
  margin-bottom: 32px;
}

.project-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 18px;
  border-bottom: 2px solid #e5e7eb;
}
.tab-btn {
  background: none;
  border: none;
  font-size: 1.1rem;
  font-weight: 600;
  color: #64748b;
  padding: 10px 28px 8px 28px;
  cursor: pointer;
  border-bottom: 2.5px solid transparent;
  transition: color 0.2s, border-color 0.2s;
}
.tab-btn.active {
  color: #222;
  border-bottom: 2.5px solid #3b82f6;
  background: #f8fafc;
}

.project-website {
  margin-bottom: 10px;
  font-size: 0.97rem;
  color: #374151;
}
.website-link {
  color: #3b82f6;
  text-decoration: none;
}
</style>