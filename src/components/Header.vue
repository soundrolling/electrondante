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
      <!-- Left side: Back button and Status -->
      <div class="header-left">
        <!-- Mobile menu button -->
        <button
          class="btn mobile-menu-btn light-btn"
          @click="showMobileMenu = true"
          aria-label="Open menu"
        >
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <!-- Back Button -->
        <button
          v-if="showBackButton"
          @click="goBack"
          class="btn btn-warning back-btn light-btn"
          title="Go back"
        >
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5"/>
            <path d="M12 19l-7-7 7-7"/>
          </svg>
          <span class="btn-text">Back</span>
        </button>
        
        <!-- Mobile Home Button -->
        <button
          v-if="showProjectHomeButton"
          @click="goToProjectHome"
          class="btn home-btn light-btn mobile-only"
          title="Project Home"
        >
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7"/>
            <path d="M9 22V12h6v10"/>
          </svg>
        </button>
        <!-- Status Pills: stacked vertically even on desktop -->
        <div class="status-group">
          <!-- Online/Offline Status (background color conveys status; white text) -->
          <div :class="['status-indicator', onlineStatusClass]" :title="onlineStatusText">
            <span class="status-text">{{ onlineStatusText }}</span>
          </div>

          <!-- Sync Status (background color conveys status; white text) -->
          <div :class="['sync-indicator', hasPendingSync ? 'pending' : 'synced']" :title="syncStatusText">
            <span class="sync-text">{{ hasPendingSync ? 'Pending' : 'Synced' }}</span>
          </div>
        </div>
      </div>

      <!-- Center: Navigation / Page Title -->
      <nav class="navigation">
        <!-- Page title for Projects route -->
        <span v-if="isProjectsRoute" class="route-title">All Projects</span>
        <!-- Project Home Button -->
        <router-link
          v-if="showProjectHomeButton"
          :to="{ name: 'ProjectDetail', params: { id: currentProject.id } }"
          class="nav-link light-btn"
          :class="{ active: isActiveRoute(`/projects/${currentProject.id}`) }"
        >
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7"/>
            <path d="M9 22V12h6v10"/>
          </svg>
          <span class="nav-text">Project Home</span>
        </router-link>
        
        <!-- All Projects Button -->
        <router-link
          v-if="isAuthenticated && !isProjectsRoute"
          to="/projects"
          class="nav-link light-btn"
          :class="{ active: isActiveRoute('/projects') }"
        >
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"/>
            <path d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z"/>
          </svg>
          <span class="nav-text">All Projects</span>
        </router-link>
        
      </nav>

      <!-- Right side: User actions -->
      <div class="header-right">
        <!-- Mobile online/offline dot indicator -->
        <span
          class="online-dot"
          :class="isOnline ? 'online' : 'offline'"
          :title="onlineStatusText"
          aria-hidden="false"
          role="img"
        >        </span>

        <!-- Mobile Globe Button (All Projects) -->
        <router-link
          v-if="isAuthenticated && !isProjectsRoute"
          to="/projects"
          class="btn light-btn world-btn mobile-only"
          title="All Projects"
          aria-label="All Projects"
        >
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M2 12h20"/>
            <path d="M12 2a15.3 15.3 0 010 20"/>
            <path d="M12 2a15.3 15.3 0 000 20"/>
          </svg>
        </router-link>

        <!-- Mobile Clock/History Button -->
        <button
          v-if="isAuthenticated"
          @click="showBugReportModal = true"
          class="btn light-btn clock-btn mobile-only"
          title="Report a bug or suggestion"
        >
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12,6 12,12 16,14"/>
          </svg>
        </button>

        <!-- Mobile Sign Out Button -->
        <button
          v-if="isAuthenticated"
          @click="handleSignOut"
          class="btn btn-danger-light sign-out-btn mobile-only"
          title="Sign out"
        >
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16,17 21,12 16,7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>

        <button
          v-if="isAuthenticated"
          @click="showBugReportModal = true"
          class="btn btn-positive bug-report-btn"
          title="Report a bug or suggestion"
        >
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 12l2 2 4-4"/>
            <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"/>
            <path d="M12 7v6"/>
            <path d="M12 17h.01"/>
          </svg>
          <span class="btn-text">Report</span>
          <span v-if="openReportsCount > 0" class="badge badge-danger" :title="openReportsCount + ' open reports'">{{ openReportsCount }}</span>
        </button>
        
        <button
          v-if="isAuthenticated"
          @click="handleSignOut"
          class="btn btn-danger-light sign-out-btn"
          title="Sign out"
        >
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16,17 21,12 16,7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span class="btn-text">Sign Out</span>
        </button>
      </div>
    </div>
  </header>

  <!-- Project Home Button Bar removed to avoid duplication -->

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
        <button class="btn close-btn" @click="showMobileMenu = false" aria-label="Close menu">
          ✕
        </button>
      </div>
      <div class="menu-section">
        <div :class="['status-indicator', onlineStatusClass]">
          <div class="status-dot"></div>
          <span class="status-text">{{ onlineStatusText }}</span>
        </div>
        <div :class="['sync-indicator', hasPendingSync ? 'pending' : 'synced']" :title="syncStatusText">
          <div class="sync-dot"></div>
          <span class="sync-text">{{ hasPendingSync ? 'Pending' : 'Synced' }}</span>
        </div>
      </div>
      <div class="menu-section">
        <router-link v-if="showProjectHomeButton" :to="{ name: 'ProjectDetail', params: { id: currentProject.id } }" class="nav-link light-btn" @click="showMobileMenu = false">Project Home</router-link>
        <router-link v-if="isAuthenticated && !isProjectsRoute" to="/projects" class="nav-link light-btn" @click="showMobileMenu = false">All Projects</router-link>
      </div>
      <div class="menu-section actions">
        <button v-if="isAuthenticated" class="btn btn-positive" @click="showBugReportModal = true; showMobileMenu = false">Report</button>
        <button v-if="isAuthenticated" class="btn btn-danger" @click="handleSignOut">Sign Out</button>
      </div>
    </div>
  </div>
</div>
</template>

<script>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useUserStore } from '../stores/userStore';
import { useBugReportStore } from '../stores/bugReportStore';
import BugReportModal from './BugReportModal.vue';

export default {
  components: {
    BugReportModal
  },
  setup() {
    const userStore = useUserStore();
    const bugReportStore = useBugReportStore();
    const router = useRouter();
    const route = useRoute();
    const currentRouteName = computed(() => (route && route.name) ? route.name : '');
  // Safe access to route.meta for template usage
  const routeMeta = computed(() => (route && route.meta) ? route.meta : {});

  const isAuthenticated = computed(() => userStore.isAuthenticated);
  const currentProject = computed(() => userStore.getCurrentProject);

  // Hide header if we are on certain auth routes
  const isHiddenRoute = computed(() => {
    const hiddenRoutes = ['/login', '/auth/reset-password', '/auth/set-password'];
    return hiddenRoutes.includes(route.path);
  });

  // Check if on "/projects"
  const isProjectsRoute = computed(() => route.path === '/projects');

  // Back button logic: hide on main projects list
  const showBackButton = computed(() => route.path !== '/projects');

  const goBack = () => {
    if (window.history.length > 1) {
      router.go(-1);
    } else {
      // Fallback to projects page if no history
      router.push('/projects');
    }
  };

  // Online/offline
  const isOnline = ref(navigator.onLine);
  const onlineStatusText = computed(() => (isOnline.value ? 'Online' : 'Offline'));
  const onlineStatusClass = computed(() => (isOnline.value ? 'online' : 'offline'));

  // Sync status (background queue)
  const hasPendingSync = ref(false);
  const syncStatusText = computed(() => hasPendingSync.value ? 'There are changes waiting to sync' : 'All changes synced');

  // Logging out overlay
  const isLoggingOut = ref(false);
  const handleSignOut = async () => {
    isLoggingOut.value = true;
    try {
      await userStore.signOut();
      window.location.href = '/login';
    } catch (error) {
      console.error('Error during sign out:', error.message);
      isLoggingOut.value = false;
    }
  };

  // Bug report modal
  const showBugReportModal = ref(false);
  // Badge count for open reports
  const openReportsCount = computed(() => bugReportStore.openReportsCount);
  // Mobile menu state
  const showMobileMenu = ref(false);
  const handleBugReportSubmit = async (reportData) => {
    try {
      await bugReportStore.submitReport(reportData);
    } catch (error) {
      console.error('Error submitting bug report:', error);
    }
  };

  // If route.name === 'ProjectDetail', we don't show the "Project Home" button
  const isProjectDetailRoute = computed(() => route.name === 'ProjectDetail');

  // Only show if user is authenticated, has a current project, 
  // and is not already on the "home" page
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

  // For highlighting links
  const isActiveRoute = (path) => route.path.startsWith(path);

  // Track online/offline events
  const updateOnlineStatus = () => {
    isOnline.value = navigator.onLine;
  };
  onMounted(() => {
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Lazy-load to avoid bundling cost on initial paint
    const startSyncPolling = async () => {
      try {
        const mod = await import('@/services/dataService');
        const poll = async () => {
          try {
            const res = await mod.hasPendingChanges?.();
            if (typeof res === 'boolean') hasPendingSync.value = res;
          } catch {}
        };
        // initial + poll
        poll();
        const id = setInterval(poll, 7000);
        onUnmounted(() => clearInterval(id));
      } catch {}
    };
    startSyncPolling();

    // Ensure we have latest reports for badge
    try { bugReportStore.fetchReports(); } catch {}
  });
  onUnmounted(() => {
    window.removeEventListener('online', updateOnlineStatus);
    window.removeEventListener('offline', updateOnlineStatus);
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
  };
},
};
</script>

<style scoped>
/* Base Styles - Mobile First */
.header {
  background-color: var(--bg-primary);
  border-bottom: 1px solid var(--border-light);
  box-shadow: var(--shadow-sm);
  padding: 0;
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  padding-top: env(safe-area-inset-top, 0);
}

/* Force text visibility */
.header * {
  color: #000000 !important;
}

.header .nav-link,
.header .btn-text,
.header .nav-text,
.header .home-text {
  color: #000000 !important;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4);
  min-height: 64px;
}

/* Header sections */
.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

/* Stack status pills vertically and make them compact */
.status-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Online/offline status indicator */
.status-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 4px 8px; /* more compact */
  border-radius: var(--radius-full);
  font-size: 0.8rem; /* smaller */
  font-weight: var(--font-semibold);
  color: #ffffff !important;
  background-color: #047857; /* darker green */
  border: 1px solid rgba(0,0,0,0.05);
  transition: all var(--transition-normal);
  min-height: 0;
}

.status-indicator:hover { filter: brightness(0.92); color: #ffffff !important; }

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.online.status-indicator { background-color: #065f46; } /* green-800 */
.offline.status-indicator { background-color: #7f1d1d; } /* red-900 */

.status-text {
  font-weight: var(--font-semibold);
  color: #ffffff !important;
}

/* Sync indicator */
.sync-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 4px 8px; /* more compact */
  border-radius: var(--radius-full);
  font-size: 0.8rem; /* smaller */
  font-weight: var(--font-semibold);
  color: #ffffff !important;
  background-color: #047857; /* darker synced */
  border: 1px solid rgba(0,0,0,0.05);
  transition: all var(--transition-normal);
  min-height: 0;
}
.sync-indicator.synced { background-color: #065f46; } /* green-800 */
.sync-indicator.pending { background-color: #78350f; } /* amber-900 */
.sync-text { font-weight: var(--font-semibold); color: #ffffff !important; }

/* Navigation */
.navigation {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  text-decoration: none;
  color: var(--text-primary);
  font-weight: var(--font-medium);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  transition: all var(--transition-normal);
  background-color: transparent;
  border: 1px solid transparent;
  font-size: var(--text-base);
  min-height: 44px;
}

.nav-link:hover {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

.nav-link.active {
  background-color: var(--color-primary-100);
  color: var(--color-primary-700);
  border-color: var(--color-primary-200);
}

.nav-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.nav-text {
  font-size: var(--text-base);
  color: #000000 !important;
}

/* Route title shown in header center when on a top-level page like Projects */
.route-title {
  font-weight: var(--font-bold);
  font-size: var(--text-xl);
  color: #000000 !important;
  padding: var(--space-3) var(--space-4);
}

/* Back button */
.back-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-light);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-normal);
  font-size: var(--text-base);
  min-height: 44px;
}

.back-btn:hover {
  background-color: var(--color-secondary-200);
  border-color: var(--border-medium);
  color: var(--text-primary);
}

.back-btn:active {
  transform: scale(0.98);
}

/* Bug report button */
.bug-report-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background-color: var(--color-primary-50);
  color: var(--color-primary-600);
  border: 1px solid var(--color-primary-200);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-normal);
  font-size: var(--text-base);
  min-height: 44px;
}

.bug-report-btn:hover {
  background-color: var(--color-primary-100);
  border-color: var(--color-primary-300);
}

.bug-report-btn:active {
  transform: scale(0.98);
}

/* Sign out button */
.sign-out-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background-color: var(--color-error-500);
  color: #ffffff !important;
  border: 1px solid var(--color-error-500);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-normal);
  font-size: var(--text-base);
  min-height: 44px;
}

.sign-out-btn:hover {
  background-color: var(--color-error-600);
  border-color: var(--color-error-600);
}

.sign-out-btn:active {
  transform: scale(0.98);
}

.btn-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.btn-text {
  font-weight: var(--font-medium);
  font-size: var(--text-base);
  color: #000000 !important;
}

/* Sign out button text should be white */
.sign-out-btn .btn-text {
  color: #ffffff !important;
}

/* Numeric badge styling */
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  min-width: 20px;
  padding: 0 6px;
  margin-left: 8px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: var(--font-bold);
  line-height: 1;
}
.badge-danger {
  background-color: #ef4444; /* red-500 */
  color: #ffffff !important;
  border: 1px solid #dc2626; /* red-600 */
}

/* Light pill buttons with DARK text for contrast */
.light-btn {
  background-color: #e0f2fe; /* sky-100 */
  color: #0c4a6e !important; /* cyan-900 */
  border: 1px solid #7dd3fc; /* sky-300 */
}
.light-btn:hover {
  background-color: #bae6fd; /* sky-200 */
  color: #0c4a6e !important;
  border-color: #38bdf8; /* sky-400 */
}
.light-btn .nav-text,
.light-btn .btn-text {
  color: #0c4a6e !important;
}

/* Project home bar */
.project-home-bar {
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
  padding: var(--space-4) 0;
}

.project-home-container {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  justify-content: center;
  padding: 0 var(--space-4);
}

.project-home-btn {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background-color: var(--color-primary-500);
  color: var(--text-inverse);
  border: none;
  padding: var(--space-4) var(--space-6);
  border-radius: var(--radius-lg);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--transition-normal);
  min-height: 52px;
  box-shadow: var(--shadow-md);
}

.project-home-btn:hover {
  background-color: var(--color-primary-600);
  box-shadow: var(--shadow-lg);
}

.project-home-btn:active {
  transform: scale(0.98);
}

.home-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.home-text {
  font-size: var(--text-base);
}

/* Spinner overlay */
.spinner-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
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
  background: var(--bg-primary);
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
}

.spinner {
  border: 3px solid var(--color-secondary-200);
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

/* Focus States for Accessibility */
.back-btn:focus,
.bug-report-btn:focus,
.sign-out-btn:focus,
.project-home-btn:focus,
.nav-link:focus {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

/* Tablet Breakpoint (601px - 1024px) */
@media (min-width: 601px) {
  .header-content {
    padding: var(--space-5) var(--space-6);
    min-height: 72px;
  }

  .header-left,
  .header-right {
    gap: var(--space-4);
  }

  .nav-link {
    padding: var(--space-3) var(--space-5);
    font-size: var(--text-base);
  }

  .back-btn {
    padding: var(--space-3) var(--space-5);
    font-size: var(--text-base);
  }

  .sign-out-btn {
    padding: var(--space-3) var(--space-5);
    font-size: var(--text-base);
  }

  .project-home-container {
    padding: 0 var(--space-6);
  }

  .project-home-btn {
    padding: var(--space-4) var(--space-7);
    font-size: var(--text-base);
  }
}

/* Desktop Breakpoint (1025px+) */
@media (min-width: 1025px) {
  .header-content {
    padding: var(--space-6) var(--space-8);
    min-height: 80px;
  }

  .header-left,
  .header-right {
    gap: var(--space-5);
  }

  .nav-link {
    padding: var(--space-4) var(--space-6);
    font-size: var(--text-base);
  }

  .back-btn {
    padding: var(--space-4) var(--space-6);
    font-size: var(--text-base);
  }

  .sign-out-btn {
    padding: var(--space-4) var(--space-6);
    font-size: var(--text-base);
  }

  .project-home-container {
    padding: 0 var(--space-8);
  }

  .project-home-btn {
    padding: var(--space-5) var(--space-8);
    font-size: var(--text-base);
  }
}

/* Mobile-only buttons - hidden on desktop */
.mobile-only {
  display: none;
}

/* Mobile-specific adjustments */
@media (max-width: 768px) {
  .btn-text,
  .nav-text,
  .home-text { display: none; }

  .header-content {
    padding: var(--space-3) var(--space-4);
    min-height: 56px;
  }

  .header-left,
  .header-right {
    gap: var(--space-2);
  }

  .nav-link {
    padding: var(--space-3);
    min-height: 44px;
  }

  .back-btn {
    padding: var(--space-3);
    min-height: 44px;
  }

  .sign-out-btn {
    padding: var(--space-3);
    min-height: 44px;
  }

  .project-home-btn {
    padding: var(--space-4) var(--space-5);
    min-height: 52px;
  }

  .status-indicator {
    padding: var(--space-2);
    min-height: 44px;
  }

  /* Show mobile-only buttons on mobile */
  .mobile-only {
    display: inline-flex;
    padding: var(--space-2);
    min-height: 40px;
  }

  .mobile-only .btn-icon {
    width: 22px;
    height: 22px;
  }

  /* Icon-only mobile header */
  .navigation,
  .status-indicator,
  .sync-indicator { display: none; }
  .mobile-menu-btn { display: none; }
  /* Hide desktop buttons on mobile - use mobile versions instead */
  .bug-report-btn,
  .sign-out-btn { display: none; }
  /* Online dot */
  .online-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: var(--space-2); }
  .online-dot.online { background-color: #10b981; }
  .online-dot.offline { background-color: #ef4444; }
}

/* Mobile menu sheet */
@media (min-width: 769px) {
  .mobile-menu-btn { display: none; }
}
.mobile-menu-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: var(--z-modal);
  display: flex;
  justify-content: center;
  align-items: flex-end;
  padding-bottom: env(safe-area-inset-bottom, 0);
}
.mobile-menu-sheet {
  width: 100%;
  max-width: 480px;
  background: var(--bg-primary);
  border-top-left-radius: var(--radius-xl);
  border-top-right-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  padding: var(--space-4);
}
.mobile-menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}
.menu-title { font-weight: var(--font-semibold); }
.close-btn { background: var(--bg-secondary); }
.menu-section { display: flex; gap: var(--space-2); flex-wrap: wrap; margin-bottom: var(--space-3); }
.menu-section.actions { justify-content: flex-end; }

/* High Contrast Mode Support */
@media (prefers-contrast: high) {
  .header {
    border-bottom-width: 2px;
  }
  
  .back-btn,
  .bug-report-btn,
  .sign-out-btn,
  .nav-link,
  .status-indicator,
  .project-home-btn {
    border-width: 2px;
  }
}

/* Reduced Motion Support */
@media (prefers-reduced-motion: reduce) {
  .back-btn,
  .bug-report-btn,
  .sign-out-btn,
  .project-home-btn {
    transition: none;
  }
  
  .back-btn:active,
  .bug-report-btn:active,
  .sign-out-btn:active,
  .project-home-btn:active {
    transform: none;
  }
}
</style>