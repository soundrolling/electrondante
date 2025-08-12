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
          class="back-btn"
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
          <span>Projects</span>
        </router-link>
      </nav>

      <!-- Right side: User actions -->
      <div class="header-right">
        <button
          v-if="isAuthenticated"
          @click="handleSignOut"
          class="sign-out-btn"
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

  <!-- Project Home Button Bar -->
  <div
    v-if="showProjectHomeButton"
    class="project-home-bar"
  >
    <div class="project-home-container">
      <button
        @click="goToProjectHome"
        class="project-home-btn"
      >
        <svg class="home-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          <polyline points="9,22 9,12 15,12 15,22"/>
        </svg>
        <span>Project Home</span>
      </button>
    </div>
  </div>
</div>
</template>

<script>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useUserStore } from '../stores/userStore';

export default {
setup() {
  const userStore = useUserStore();
  const router = useRouter();
  const route = useRoute();

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

    onlineStatusText,
    onlineStatusClass,

    isLoggingOut,
    handleSignOut,
    goToProjectHome,
    goBack,
    isActiveRoute,
  };
},
};
</script>

<style scoped>
/* Main header styling */
.header {
background-color: #f8f9fa;
border-bottom: 1px solid #e5e7eb;
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
padding: 0;
position: sticky;
top: 0;
z-index: 100;
}

.header-content {
max-width: 1400px;
margin: 0 auto;
display: flex;
justify-content: space-between;
align-items: center;
padding: 16px 24px;
min-height: 64px;
}

/* Header sections */
.header-left,
.header-right {
display: flex;
align-items: center;
gap: 16px;
}

/* Online/offline status indicator */
.status-indicator {
display: flex;
align-items: center;
gap: 8px;
padding: 6px 12px;
border-radius: 16px;
font-size: 0.875rem;
font-weight: 500;
color: #6b7280;
background-color: #f9fafb;
border: 1px solid #e5e7eb;
transition: all 0.2s ease;
}

.status-indicator:hover {
background-color: #f3f4f6;
}

.status-dot {
width: 8px;
height: 8px;
border-radius: 50%;
}

.online .status-dot {
background-color: #10b981;
}

.offline .status-dot {
background-color: #ef4444;
}

.status-text {
font-weight: 500;
}

/* Navigation */
.navigation {
display: flex;
gap: 8px;
align-items: center;
}

.nav-link {
display: flex;
align-items: center;
gap: 8px;
text-decoration: none;
color: #374151;
font-weight: 500;
padding: 8px 16px;
border-radius: 8px;
transition: all 0.2s ease;
background-color: transparent;
border: 1px solid transparent;
font-size: 0.9rem;
}

.nav-link:hover {
background-color: #f1f5f9;
color: #1f2937;
}

.nav-link.active {
background-color: #e2e8f0;
color: #1f2937;
border-color: #cbd5e1;
}

.nav-icon {
width: 18px;
height: 18px;
flex-shrink: 0;
}

/* Back button */
.back-btn {
display: flex;
align-items: center;
gap: 8px;
background-color: #f1f5f9;
color: #374151;
border: 1px solid #e5e7eb;
padding: 8px 16px;
border-radius: 8px;
font-weight: 500;
cursor: pointer;
transition: all 0.2s ease;
font-size: 0.9rem;
}

.back-btn:hover {
background-color: #e2e8f0;
border-color: #cbd5e1;
color: #1f2937;
}

/* Sign out button */
.sign-out-btn {
display: flex;
align-items: center;
gap: 8px;
background-color: #fef2f2;
color: #dc2626;
border: 1px solid #fecaca;
padding: 8px 16px;
border-radius: 8px;
font-weight: 500;
cursor: pointer;
transition: all 0.2s ease;
font-size: 0.9rem;
}

.sign-out-btn:hover {
background-color: #fee2e2;
border-color: #fca5a5;
}

.btn-icon {
width: 18px;
height: 18px;
flex-shrink: 0;
}

.btn-text {
font-weight: 500;
}

/* Project home bar */
.project-home-bar {
background-color: #f9fafb;
border-bottom: 1px solid #e5e7eb;
padding: 12px 0;
}

.project-home-container {
max-width: 1400px;
margin: 0 auto;
display: flex;
justify-content: center;
padding: 0 24px;
}

.project-home-btn {
display: flex;
align-items: center;
gap: 10px;
background-color: #3b82f6;
color: white;
border: none;
padding: 10px 20px;
border-radius: 8px;
font-size: 0.9rem;
font-weight: 500;
cursor: pointer;
transition: all 0.2s ease;
}

.project-home-btn:hover {
background-color: #2563eb;
}

.home-icon {
width: 18px;
height: 18px;
flex-shrink: 0;
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
z-index: 1000;
}

.spinner-container {
display: flex;
flex-direction: column;
align-items: center;
gap: 16px;
background: white;
padding: 24px;
border-radius: 12px;
box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.spinner {
border: 3px solid #f3f4f6;
border-top: 3px solid #3b82f6;
border-radius: 50%;
width: 32px;
height: 32px;
animation: spin 1s linear infinite;
}

.spinner-text {
color: #374151;
font-weight: 500;
margin: 0;
font-size: 0.875rem;
}

@keyframes spin {
0% { transform: rotate(0deg); }
100% { transform: rotate(360deg); }
}

/* Responsive design */
@media (max-width: 768px) {
.header-content {
  padding: 12px 16px;
  min-height: 56px;
}

.navigation {
  gap: 4px;
}

.nav-link {
  padding: 6px 12px;
  font-size: 0.85rem;
}

.back-btn {
  padding: 6px 12px;
  font-size: 0.85rem;
}

.sign-out-btn {
  padding: 6px 12px;
  font-size: 0.85rem;
}

.project-home-btn {
  padding: 8px 16px;
  font-size: 0.85rem;
}

.status-indicator {
  padding: 4px 8px;
  font-size: 0.8rem;
}

.btn-text {
  display: none;
}
}

@media (max-width: 480px) {
.header-content {
  padding: 8px 12px;
}

.project-home-container {
  padding: 0 12px;
}
}
</style>