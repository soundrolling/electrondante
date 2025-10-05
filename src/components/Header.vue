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
        <!-- Back Button -->
        <button
          v-if="showBackButton"
          @click="goBack"
          class="btn btn-warning back-btn"
          title="Go back"
        >
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5"/>
            <path d="M12 19l-7-7 7-7"/>
          </svg>
          <span class="btn-text">Back</span>
        </button>
        
        <!-- Online/Offline Status -->
        <div :class="['status-indicator', onlineStatusClass]">
          <div class="status-dot"></div>
          <span class="status-text">{{ onlineStatusText }}</span>
        </div>
      </div>

      <!-- Center: Navigation -->
      <nav class="navigation">
        <router-link
          v-if="isAuthenticated && !isProjectsRoute"
          to="/projects"
          class="nav-link"
          :class="{ active: isActiveRoute('/projects') }"
        >
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"/>
            <path d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z"/>
          </svg>
          <span class="nav-text">All Projects</span>
        </router-link>
        <router-link
          v-if="isAuthenticated && currentProject && !isProjectDetailRoute && !isProjectsRoute && !routeMeta.hideHeaderProjectHome"
          :to="{ name: 'ProjectDetail', params: { id: currentProject.id } }"
          class="nav-link"
          :class="{ active: route.name === 'ProjectDetail' }"
        >
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9,22 9,12 15,12 15,22"/>
          </svg>
          <span class="nav-text">Project Home</span>
        </router-link>
      </nav>

      <!-- Right side: User actions -->
      <div class="header-right">
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
        </button>
        
        <button
          v-if="isAuthenticated"
          @click="handleSignOut"
          class="btn btn-danger sign-out-btn"
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

  // Back button logic
  const showBackButton = computed(() => {
    // Don't show on main pages
    const mainPages = ['/projects', '/login', '/auth/reset-password', '/auth/set-password'];
    if (mainPages.includes(route.path)) return false;
    
    // Don't show if we're at the root
    if (route.path === '/') return false;
    
    // Show on all other pages
    return true;
  });

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

  // For highlighting links
  const isActiveRoute = (path) => route.path.startsWith(path);

  // Track online/offline events
  const updateOnlineStatus = () => {
    isOnline.value = navigator.onLine;
  };
  onMounted(() => {
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
  });
  onUnmounted(() => {
    window.removeEventListener('online', updateOnlineStatus);
    window.removeEventListener('offline', updateOnlineStatus);
  });

  return {
    isAuthenticated,
    currentProject,
    isHiddenRoute,
    isProjectsRoute,
    isProjectDetailRoute,
    showProjectHomeButton,
    showBackButton,
    routeMeta,

    onlineStatusText,
    onlineStatusClass,

    isLoggingOut,
    handleSignOut,
    goToProjectHome,
    goBack,
    isActiveRoute,

    showBugReportModal,
    handleBugReportSubmit,
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
.header .home-text,
.header .status-text {
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

/* Online/offline status indicator */
.status-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-light);
  transition: all var(--transition-normal);
  min-height: 44px;
}

.status-indicator:hover {
  background-color: var(--color-secondary-200);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.online .status-dot {
  background-color: var(--color-success-500);
}

.offline .status-dot {
  background-color: var(--color-error-500);
}

.status-text {
  font-weight: var(--font-medium);
}

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
  border-radius: var(--radius-md);
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

/* Back button */
.back-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-light);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
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
  background-color: var(--color-error-50);
  color: var(--color-error-600);
  border: 1px solid var(--color-error-200);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-normal);
  font-size: var(--text-base);
  min-height: 44px;
}

.sign-out-btn:hover {
  background-color: var(--color-error-100);
  border-color: var(--color-error-300);
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

/* Mobile-specific adjustments */
@media (max-width: 600px) {
  .btn-text,
  .nav-text,
  .home-text {
    display: none;
  }

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
}

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