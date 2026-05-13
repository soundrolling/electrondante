<template>
<div>
  <!-- Spinner Overlay -->
  <div v-if="isLoggingOut" class="spinner-overlay">
    <div class="spinner-container">
      <div class="spinner"></div>
      <p class="spinner-text">Signing out...</p>
    </div>
  </div>

  <!-- Main Header -->
  <header v-if="!isHiddenRoute" class="header">
    <div class="header-content">
      <!-- Left: back/mobile menu + status -->
      <div class="header-left">
        <button
          class="icon-btn mobile-menu-btn"
          @click="showMobileMenu = true"
          aria-label="Open menu"
        >
          <Menu :size="20" :stroke-width="2" />
        </button>

        <button
          v-if="showBackButton"
          @click="goBack"
          class="ghost-btn back-btn"
          title="Go back"
        >
          <ArrowLeft :size="18" :stroke-width="2" />
          <span class="btn-text">Back</span>
        </button>

        <button
          v-if="showProjectHomeButton"
          @click="goToProjectHome"
          class="icon-btn home-btn mobile-only"
          title="Project Home"
          aria-label="Project Home"
        >
          <Home :size="20" :stroke-width="2" />
        </button>

        <!-- Status cluster (dots, not colored pills) -->
        <div class="status-cluster">
          <span
            :class="['status-chip', onlineStatusClass]"
            :title="onlineStatusText"
            role="status"
          >
            <span class="status-dot"></span>
            <span class="status-label">{{ onlineStatusText }}</span>
          </span>
          <span
            :class="['status-chip', hasPendingSync ? 'pending' : 'synced']"
            :title="syncStatusText"
            role="status"
          >
            <span class="status-dot"></span>
            <span class="status-label">{{ hasPendingSync ? `${pendingCount} pending` : 'Synced' }}</span>
          </span>
        </div>
      </div>

      <!-- Center: page title / primary nav -->
      <nav class="navigation">
        <router-link
          v-if="isAuthenticated"
          to="/projects"
          class="nav-link"
          :class="{ active: isActiveRoute('/projects') }"
        >
          <LayoutGrid :size="18" :stroke-width="2" />
          <span class="nav-text">All Projects</span>
        </router-link>

        <router-link
          v-if="showProjectHomeButton"
          :to="{ name: 'ProjectDetail', params: { id: currentProject.id } }"
          class="nav-link"
          :class="{ active: isActiveRoute(`/projects/${currentProject.id}`) }"
        >
          <Home :size="18" :stroke-width="2" />
          <span class="nav-text">Project Home</span>
        </router-link>
      </nav>

      <!-- Right: condensed online dot (mobile) + user menu -->
      <div class="header-right">
        <span
          class="online-dot"
          :class="isOnline ? 'online' : 'offline'"
          :title="onlineStatusText"
          aria-hidden="true"
        ></span>

        <!-- Mobile compact actions (keep bug + sign-out close at hand on small screens) -->
        <button
          v-if="isAuthenticated"
          @click="showBugReportModal = true"
          class="icon-btn mobile-only bug-btn-mobile"
          title="Report a bug or suggestion"
          aria-label="Report a bug"
        >
          <Bug :size="20" :stroke-width="2" />
          <span v-if="openReportsCount > 0" class="icon-badge">{{ openReportsCount }}</span>
        </button>

        <!-- User menu (desktop + tablet) -->
        <div
          v-if="isAuthenticated"
          class="user-menu"
          ref="userMenuRef"
        >
          <button
            class="user-menu-trigger"
            :class="{ open: showUserMenu }"
            @click="toggleUserMenu"
            aria-haspopup="menu"
            :aria-expanded="showUserMenu"
            title="Account"
          >
            <span class="avatar" aria-hidden="true">{{ userInitial }}</span>
            <span class="user-menu-caret" aria-hidden="true">
              <ChevronDown :size="16" :stroke-width="2" />
            </span>
            <span v-if="openReportsCount > 0" class="icon-badge">{{ openReportsCount }}</span>
          </button>

          <div v-if="showUserMenu" class="user-menu-panel" role="menu">
            <div class="user-menu-header">
              <div class="avatar avatar-lg" aria-hidden="true">{{ userInitial }}</div>
              <div class="user-menu-identity">
                <div class="user-menu-name">{{ userDisplayName }}</div>
                <div class="user-menu-email">{{ userEmail }}</div>
              </div>
            </div>

            <router-link
              to="/projects"
              class="user-menu-item"
              role="menuitem"
              @click="closeUserMenu"
            >
              <LayoutGrid :size="18" :stroke-width="2" />
              <span>All Projects</span>
            </router-link>

            <router-link
              :to="{ name: 'UserProfile', params: { tab: 'profile' } }"
              class="user-menu-item"
              role="menuitem"
              @click="closeUserMenu"
            >
              <User :size="18" :stroke-width="2" />
              <span>My Profile</span>
            </router-link>

            <button
              class="user-menu-item"
              role="menuitem"
              @click="openBugReport"
            >
              <Bug :size="18" :stroke-width="2" />
              <span>Report a Bug</span>
              <span v-if="openReportsCount > 0" class="menu-item-badge">{{ openReportsCount }}</span>
            </button>

            <button
              class="user-menu-item"
              role="menuitem"
              @click="toggleTheme"
            >
              <Sun v-if="themeStore.isDark" :size="18" :stroke-width="2" />
              <Moon v-else :size="18" :stroke-width="2" />
              <span>{{ themeStore.isDark ? 'Light mode' : 'Dark mode' }}</span>
            </button>

            <div class="user-menu-divider" role="separator"></div>

            <button
              class="user-menu-item danger"
              role="menuitem"
              @click="handleSignOut"
            >
              <LogOut :size="18" :stroke-width="2" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>

  <!-- Bug Report Modal -->
  <BugReportModal
    :is-open="showBugReportModal"
    @close="showBugReportModal = false"
    @submit="handleBugReportSubmit"
  />

  <!-- Mobile Menu Sheet -->
  <div v-if="showMobileMenu" class="mobile-menu-backdrop" @click.self="showMobileMenu = false">
    <div class="mobile-menu-sheet" role="dialog" aria-modal="true">
      <div class="mobile-menu-header">
        <span class="menu-title">Menu</span>
        <button class="icon-btn close-btn" @click="showMobileMenu = false" aria-label="Close menu">
          <X :size="20" :stroke-width="2" />
        </button>
      </div>

      <div class="menu-section status-section">
        <span :class="['status-chip', onlineStatusClass]">
          <span class="status-dot"></span>
          <span class="status-label">{{ onlineStatusText }}</span>
        </span>
        <span :class="['status-chip', hasPendingSync ? 'pending' : 'synced']">
          <span class="status-dot"></span>
          <span class="status-label">{{ hasPendingSync ? `${pendingCount} pending` : 'Synced' }}</span>
        </span>
      </div>

      <div class="menu-section nav-section">
        <router-link v-if="showProjectHomeButton" :to="{ name: 'ProjectDetail', params: { id: currentProject.id } }" class="sheet-link" @click="showMobileMenu = false">
          <Home :size="18" :stroke-width="2" /> <span>Project Home</span>
        </router-link>
        <router-link v-if="isAuthenticated" to="/projects" class="sheet-link" @click="showMobileMenu = false">
          <LayoutGrid :size="18" :stroke-width="2" /> <span>All Projects</span>
        </router-link>
        <router-link v-if="isAuthenticated" :to="{ name: 'UserProfile', params: { tab: 'profile' } }" class="sheet-link" @click="showMobileMenu = false">
          <User :size="18" :stroke-width="2" /> <span>My Profile</span>
        </router-link>
      </div>

      <div class="menu-section actions-section">
        <button class="sheet-link" @click="toggleTheme(); showMobileMenu = false">
          <Sun v-if="themeStore.isDark" :size="18" :stroke-width="2" />
          <Moon v-else :size="18" :stroke-width="2" />
          <span>{{ themeStore.isDark ? 'Light mode' : 'Dark mode' }}</span>
        </button>
        <button v-if="isAuthenticated" class="sheet-link" @click="showBugReportModal = true; showMobileMenu = false">
          <Bug :size="18" :stroke-width="2" /> <span>Report a Bug</span>
        </button>
        <button v-if="isAuthenticated" class="sheet-link danger" @click="handleSignOut">
          <LogOut :size="18" :stroke-width="2" /> <span>Sign Out</span>
        </button>
      </div>
    </div>
  </div>
</div>
</template>

<script>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useUserStore } from '../stores/userStore';
import { useThemeStore } from '../stores/themeStore';
import { useBugReportStore } from '../stores/bugReportStore';
import BugReportModal from './BugReportModal.vue';
import {
  Menu,
  X,
  ArrowLeft,
  Home,
  LayoutGrid,
  User,
  Bug,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
} from 'lucide-vue-next';

export default {
  components: {
    BugReportModal,
    Menu,
    X,
    ArrowLeft,
    Home,
    LayoutGrid,
    User,
    Bug,
    Sun,
    Moon,
    LogOut,
    ChevronDown,
  },
  setup() {
    const userStore = useUserStore();
    const themeStore = useThemeStore();
    const bugReportStore = useBugReportStore();
    const router = useRouter();
    const route = useRoute();
    const currentRouteName = computed(() => (route && route.name) ? route.name : '');
    const routeMeta = computed(() => (route && route.meta) ? route.meta : {});

    const isAuthenticated = computed(() => userStore.isAuthenticated);
    const currentProject = computed(() => userStore.getCurrentProject);

    const isHiddenRoute = computed(() => {
      const hiddenRoutes = ['/login', '/auth/reset-password', '/auth/set-password'];
      return hiddenRoutes.includes(route.path);
    });

    const isProjectsRoute = computed(() => route.path === '/projects');
    const showBackButton = computed(() => route.path !== '/projects');

    const goBack = () => {
      if (window.history.length > 1) {
        router.go(-1);
      } else {
        router.push('/projects');
      }
    };

    // Online / sync
    const isOnline = ref(navigator.onLine);
    const onlineStatusText = computed(() => (isOnline.value ? 'Online' : 'Offline'));
    const onlineStatusClass = computed(() => (isOnline.value ? 'online' : 'offline'));

    const hasPendingSync = ref(false);
    const pendingCount = ref(0);
    const syncStatusText = computed(() => hasPendingSync.value ? 'There are changes waiting to sync' : 'All changes synced');

    // Logout
    const isLoggingOut = ref(false);
    const handleSignOut = async () => {
      isLoggingOut.value = true;
      showUserMenu.value = false;
      showMobileMenu.value = false;
      try {
        await userStore.signOut();
        window.location.href = '/login';
      } catch (error) {
        console.error('Error during sign out:', error.message);
        isLoggingOut.value = false;
      }
    };

    // Bug report
    const showBugReportModal = ref(false);
    const openReportsCount = computed(() => bugReportStore.openReportsCount);
    const showMobileMenu = ref(false);
    const handleBugReportSubmit = async (reportData) => {
      try {
        await bugReportStore.submitReport(reportData);
      } catch (error) {
        console.error('Error submitting bug report:', error);
      }
    };

    // User menu popover
    const showUserMenu = ref(false);
    const userMenuRef = ref(null);
    const toggleUserMenu = () => {
      showUserMenu.value = !showUserMenu.value;
    };
    const closeUserMenu = () => {
      showUserMenu.value = false;
    };
    const openBugReport = () => {
      showUserMenu.value = false;
      showBugReportModal.value = true;
    };
    const toggleTheme = () => {
      themeStore.toggleTheme();
      showUserMenu.value = false;
    };
    const handleDocClick = (e) => {
      if (!showUserMenu.value) return;
      const el = userMenuRef.value;
      if (el && !el.contains(e.target)) {
        showUserMenu.value = false;
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') showUserMenu.value = false;
    };

    // User identity for avatar
    const userEmail = computed(() => userStore.getUserEmail || '');
    const userDisplayName = computed(() => {
      const profileName = userStore.getUserProfile?.full_name?.trim();
      if (profileName) return profileName;
      const email = userStore.getUserEmail || '';
      if (email.includes('@')) return email.split('@')[0];
      return email || 'Account';
    });
    const userInitial = computed(() => {
      const s = (userDisplayName.value || '').trim();
      if (!s) return '?';
      return s.charAt(0).toUpperCase();
    });

    const isProjectDetailRoute = computed(() => route.name === 'ProjectDetail');

    const showProjectHomeButton = computed(() => {
      return (
        isAuthenticated.value &&
        currentProject.value &&
        !isProjectDetailRoute.value
        && !isProjectsRoute.value
      );
    });

    const goToProjectHome = () => {
      if (currentProject.value?.id) {
        router.push({
          name: 'ProjectDetail',
          params: { id: currentProject.value.id },
        });
      }
    };

    const goHome = () => {
      if (isAuthenticated.value) {
        if (currentProject.value?.id) {
          router.push({ name: 'ProjectDetail', params: { id: currentProject.value.id } });
        } else {
          router.push('/projects');
        }
      } else {
        router.push('/');
      }
    };

    const isActiveRoute = (path) => route.path.startsWith(path);

    const updateOnlineStatus = () => {
      isOnline.value = navigator.onLine;
    };

    onMounted(() => {
      window.addEventListener('online', updateOnlineStatus);
      window.addEventListener('offline', updateOnlineStatus);
      document.addEventListener('click', handleDocClick);
      document.addEventListener('keydown', handleEsc);

      const startSyncPolling = async () => {
        try {
          const mod = await import('@/services/dataService');
          const poll = async () => {
            try {
              const count = await mod.getPendingChangesCount?.() ?? 0;
              pendingCount.value = count;
              hasPendingSync.value = count > 0;
            } catch {}
          };
          poll();
          const id = setInterval(poll, 7000);
          onUnmounted(() => clearInterval(id));
        } catch {}
      };
      startSyncPolling();

      try { bugReportStore.fetchReports(); } catch {}
    });

    onUnmounted(() => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      document.removeEventListener('click', handleDocClick);
      document.removeEventListener('keydown', handleEsc);
    });

    return {
      isOnline,
      isAuthenticated,
      currentProject,
      isHiddenRoute,
      isProjectsRoute,
      isProjectDetailRoute,
      showProjectHomeButton,
      showBackButton,
      routeMeta,
      currentRouteName,

      onlineStatusText,
      onlineStatusClass,
      hasPendingSync,
      pendingCount,
      syncStatusText,

      isLoggingOut,
      handleSignOut,
      goToProjectHome,
      goHome,
      goBack,
      isActiveRoute,

      showBugReportModal,
      handleBugReportSubmit,
      showMobileMenu,
      openReportsCount,
      themeStore,

      showUserMenu,
      userMenuRef,
      toggleUserMenu,
      closeUserMenu,
      openBugReport,
      toggleTheme,
      userEmail,
      userDisplayName,
      userInitial,
    };
  },
};
</script>

<style scoped>
/* ─── App bar ────────────────────────────────────────────── */
.header {
  background-color: var(--surface-app-bar);
  border-bottom: 1px solid var(--surface-border);
  box-shadow: none;
  padding: 0;
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  padding-top: env(safe-area-inset-top, 0);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  min-height: 56px;
  gap: var(--space-3);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  justify-self: start;
  min-width: 0;
}
.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  justify-self: end;
}

/* Generic icon buttons / ghost buttons */
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid transparent;
  cursor: pointer;
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
  position: relative;
}
.icon-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}
.icon-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.ghost-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 10px;
  height: 36px;
  background: transparent;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-weight: var(--font-medium);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: background var(--transition-normal), border-color var(--transition-normal);
}
.ghost-btn:hover {
  background: var(--surface-hover);
  border-color: var(--surface-border-strong);
}
.ghost-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring);
}

/* Status cluster */
.status-cluster {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 4px;
  border-radius: var(--radius-full);
  background: var(--surface-card-muted);
  border: 1px solid var(--surface-border);
}
.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  line-height: 1;
  white-space: nowrap;
}
.status-chip .status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-neutral-400);
  flex-shrink: 0;
}
.status-chip.online .status-dot { background: var(--color-success-500); }
.status-chip.offline .status-dot { background: var(--color-error-500); }
.status-chip.synced .status-dot { background: var(--color-success-500); }
.status-chip.pending .status-dot {
  background: var(--color-warning-500);
  animation: pulseDot 1.6s ease-in-out infinite;
}
.status-chip.online .status-label,
.status-chip.synced .status-label { color: var(--text-secondary); }
.status-chip.offline .status-label,
.status-chip.pending .status-label { color: var(--text-primary); }

@keyframes pulseDot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}

/* Navigation */
.navigation {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-self: center;
  min-width: 0;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  text-decoration: none;
  color: var(--text-secondary);
  font-weight: var(--font-medium);
  padding: 6px 12px;
  border-radius: var(--radius-md);
  transition: color var(--transition-normal), background var(--transition-normal);
  background-color: transparent;
  border: 1px solid transparent;
  font-size: var(--text-sm);
  min-height: 36px;
}
.nav-link:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
  text-decoration: none;
}
.nav-link.active {
  color: var(--color-primary-700);
  background-color: var(--color-primary-50);
  border-color: transparent;
}
.nav-link svg { color: inherit; }

.route-title {
  font-weight: var(--font-semibold);
  font-size: var(--text-base);
  color: var(--text-heading);
  padding: 0 var(--space-2);
  letter-spacing: -0.01em;
}

/* Online dot (mobile) */
.online-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-neutral-400);
  display: none;
}
.online-dot.online { background: var(--color-success-500); }
.online-dot.offline { background: var(--color-error-500); }

/* Icon-sized badge (used on bug/avatar) */
.icon-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 9999px;
  background: var(--color-error-500);
  color: #ffffff;
  font-size: 10px;
  font-weight: var(--font-bold);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--surface-app-bar);
  line-height: 1;
}

/* Avatar */
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-primary-500);
  color: #ffffff;
  font-weight: var(--font-semibold);
  font-size: var(--text-sm);
  line-height: 1;
  flex-shrink: 0;
  letter-spacing: 0;
}
.avatar-lg {
  width: 40px;
  height: 40px;
  font-size: var(--text-lg);
}

/* User menu trigger + panel */
.user-menu {
  position: relative;
}
.user-menu-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px 3px 3px;
  border-radius: 9999px;
  background: var(--surface-card-muted);
  border: 1px solid var(--surface-border);
  cursor: pointer;
  color: var(--text-secondary);
  transition: background var(--transition-normal), border-color var(--transition-normal);
  position: relative;
}
.user-menu-trigger:hover,
.user-menu-trigger.open {
  background: var(--surface-hover);
  border-color: var(--surface-border-strong);
  color: var(--text-primary);
}
.user-menu-trigger:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.user-menu-caret {
  display: inline-flex;
  align-items: center;
  color: var(--text-tertiary);
  transition: transform var(--transition-normal);
}
.user-menu-trigger.open .user-menu-caret { transform: rotate(180deg); }

.user-menu-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 260px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 6px;
  z-index: var(--z-popover);
  animation: menuIn 120ms ease-out;
}

@keyframes menuIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.user-menu-header {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--surface-card-muted);
  margin-bottom: 6px;
}
.user-menu-identity {
  min-width: 0;
}
.user-menu-name {
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  font-size: var(--text-sm);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}
.user-menu-email {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
  margin-top: 2px;
}

.user-menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
  text-decoration: none;
}
.user-menu-item:hover {
  background: var(--surface-hover);
  color: var(--text-heading);
  text-decoration: none;
}
.user-menu-item svg {
  color: var(--text-tertiary);
  flex-shrink: 0;
}
.user-menu-item:hover svg { color: var(--color-primary-500); }
.user-menu-item.danger { color: var(--color-error-600); }
.user-menu-item.danger:hover {
  background: var(--color-error-50);
  color: var(--color-error-700);
}
.user-menu-item.danger:hover svg { color: var(--color-error-600); }
.user-menu-item.danger svg { color: var(--color-error-500); }

.menu-item-badge {
  margin-left: auto;
  background: var(--color-error-500);
  color: #ffffff;
  font-size: 10px;
  font-weight: var(--font-bold);
  padding: 2px 6px;
  border-radius: 9999px;
  line-height: 1;
}

.user-menu-divider {
  height: 1px;
  background: var(--surface-border);
  margin: 6px 4px;
}

/* Focus ring for interactive pieces */
.nav-link:focus-visible,
.user-menu-item:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring);
}

/* Spinner overlay */
.spinner-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding-top: env(safe-area-inset-top, 0);
  padding-bottom: env(safe-area-inset-bottom, 0);
}
.spinner-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  background: var(--surface-card);
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--surface-border);
}
.spinner {
  border: 3px solid var(--surface-border);
  border-top: 3px solid var(--color-primary-500);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  animation: spin 1s linear infinite;
}
.spinner-text {
  color: var(--text-primary);
  font-weight: var(--font-medium);
  margin: 0;
  font-size: var(--text-base);
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* ─── Responsive ─────────────────────────────────────────── */
.mobile-only { display: none; }
.bug-btn-mobile { display: none; }

@media (min-width: 601px) {
  .header-content {
    padding: var(--space-3) var(--space-6);
    min-height: 60px;
  }
  .header-left,
  .header-right { gap: var(--space-3); }
}

@media (min-width: 1025px) {
  .header-content {
    padding: var(--space-3) var(--space-8);
    min-height: 64px;
  }
}

@media (max-width: 768px) {
  .nav-text,
  .btn-text { display: none; }

  .header-content {
    grid-template-columns: auto 1fr auto;
    padding: var(--space-2) var(--space-3);
    min-height: 52px;
  }

  .mobile-only { display: inline-flex; }
  .bug-btn-mobile { display: inline-flex; }

  .mobile-menu-btn { display: inline-flex; }
  .navigation { display: none; }
  .status-cluster { display: none; }
  .online-dot { display: inline-block; margin-right: 4px; }
}

@media (min-width: 769px) {
  .mobile-menu-btn { display: none; }
}

/* ─── Mobile menu sheet ──────────────────────────────────── */
.mobile-menu-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  z-index: var(--z-modal);
  display: flex;
  justify-content: center;
  align-items: flex-end;
  padding-bottom: env(safe-area-inset-bottom, 0);
}
.mobile-menu-sheet {
  width: 100%;
  max-width: 520px;
  background: var(--surface-card);
  border-top-left-radius: var(--radius-xl);
  border-top-right-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  padding: var(--space-4);
  border: 1px solid var(--surface-border);
  border-bottom: none;
}
.mobile-menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}
.menu-title {
  font-weight: var(--font-semibold);
  color: var(--text-heading);
  font-size: var(--text-base);
}
.menu-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: var(--space-3);
}
.menu-section.status-section {
  flex-direction: row;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.sheet-link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-primary);
  font-weight: var(--font-medium);
  font-size: var(--text-sm);
  text-decoration: none;
  border: 1px solid transparent;
  cursor: pointer;
  width: 100%;
  text-align: left;
}
.sheet-link:hover {
  background: var(--surface-hover);
  text-decoration: none;
}
.sheet-link.danger { color: var(--color-error-600); }
.sheet-link.danger svg { color: var(--color-error-500); }
.sheet-link.danger:hover {
  background: var(--color-error-50);
  color: var(--color-error-700);
}

/* High contrast / reduced motion */
@media (prefers-contrast: high) {
  .header { border-bottom-width: 2px; }
  .ghost-btn,
  .user-menu-trigger,
  .status-cluster { border-width: 2px; }
}
@media (prefers-reduced-motion: reduce) {
  .user-menu-panel { animation: none; }
  .status-chip.pending .status-dot { animation: none; }
  .user-menu-caret { transition: none; }
  .spinner { animation-duration: 2.5s; }
}
</style>
