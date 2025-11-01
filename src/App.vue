<!-- src/App.vue -->
<template>
<div id="app">
  <!-- Display initialization errors with a retry option -->
  <div v-if="initializationError" class="error-message">
    {{ initializationError }}
    <button @click="retryInitialization" class="retry-button">
      Retry
    </button>
  </div>

  <div v-else>
    <!-- Offline Banner -->
    <div v-if="!onlineStatus" class="offline-banner">
      You are currently offline.
    </div>

    <!-- Toggle Header/Footer on certain routes -->
    <Header v-if="!isHiddenRoute" />

    <main class="main-content">
      <Suspense>
        <template #default>
          <router-view />
        </template>
        <template #fallback>
          <div class="loading-fallback">Loading…</div>
        </template>
      </Suspense>
    </main>

    <Footer
      v-if="!isHiddenRoute"
      :liveTimecode="liveTimecode"
      :currentTimeSourceLabel="currentTimeSourceLabel"
      :localStorageUsage="localStorageUsage"
      :userEmail="userEmail"
      :isAdmin="isAdmin"
      @clearCache="clearCache"
      @signOut="signOut"
    />
  </div>
</div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from './stores/userStore'
import Header from './components/Header.vue'
import Footer from './components/Footer.vue'
import { useToast } from 'vue-toastification'
import { syncOfflineChanges } from '@/services/dataService'
import { startScheduleNotifications, stopScheduleNotifications } from '@/services/scheduleNotificationService'

export default {
components: { Header, Footer },
setup() {
  const userStore = useUserStore()
  const route     = useRoute()
  const router    = useRouter()
  const toast     = useToast()

  const initializationError = ref(null)
  const onlineStatus        = ref(navigator.onLine)
  const localStorageUsage   = ref({ used: 0, max: 5120 })

  const userEmail              = computed(() => userStore.getUserEmail)
  const isAdmin                = computed(() => userStore.isAdmin)
  const liveTimecode           = computed(() => userStore.getLiveTimecode)
  const currentTimeSourceLabel = computed(() => userStore.getCurrentTimeSourceLabel)

  const isHiddenRoute = computed(() => {
    const hidden = ['/', '/login', '/auth/reset-password', '/auth/set-password']
    return hidden.includes(route.path)
  })

  const calculateLocalStorageUsage = () => {
    let total = 0
    for (const key in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
        const val = localStorage.getItem(key) || ''
        total += key.length + val.length
      }
    }
    localStorageUsage.value.used = (total / 1024).toFixed(2)
  }

  const clearCache = () => {
    localStorage.clear()
    calculateLocalStorageUsage()
    toast.success('Cache cleared successfully!')
  }

  const signOut = async () => {
    try {
      await userStore.signOut()
      router.push('/')
    } catch (err) {
      console.error(err)
      toast.error('Error during sign-out. Please try again.')
    }
  }

  const retryInitialization = async () => {
    initializationError.value = null
    try {
      await userStore.initializeStore()
    } catch (err) {
      initializationError.value = `Failed to initialize the app: ${err.message}`
    }
  }

  // update only the onlineStatus flag
  const updateOnlineStatus = () => {
    onlineStatus.value = navigator.onLine
  }

  // handle going back online: update flag and sync offline queue once
  const handleOnline = async () => {
    updateOnlineStatus()
    try {
      await syncOfflineChanges()
      toast.success('Offline changes synced successfully!')
    } catch (err) {
      console.error('Error syncing offline changes:', err)
      toast.error('Failed to sync offline changes.')
    }
  }

  // Watch for project changes to restart notification service
  watch(() => userStore.getCurrentProject, (newProject) => {
    if (newProject && userStore.isAuthenticated) {
      // Restart notifications when project changes
      stopScheduleNotifications()
      startScheduleNotifications(newProject.id)
    } else {
      stopScheduleNotifications()
    }
  }, { immediate: false })

  onMounted(async () => {
    try {
      await userStore.initializeStore()
      calculateLocalStorageUsage()
      // watch for connectivity changes
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', updateOnlineStatus)
      
      // Start schedule notifications if authenticated and have a project
      if (userStore.isAuthenticated && userStore.getCurrentProject) {
        startScheduleNotifications(userStore.getCurrentProject.id)
      }
    } catch (err) {
      initializationError.value = `Failed to initialize the app: ${err.message}`
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', updateOnlineStatus)
    stopScheduleNotifications()
  })

  return {
    initializationError,
    onlineStatus,
    userEmail,
    isAdmin,
    liveTimecode,
    currentTimeSourceLabel,
    localStorageUsage,
    isHiddenRoute,
    clearCache,
    signOut,
    retryInitialization
  }
}
}
</script>

<style scoped>
.error-message {
background-color: #f8d7da;
color: #721c24;
padding: 15px;
margin-bottom: 20px;
border: 1px solid #f5c6cb;
border-radius: 4px;
}
.retry-button {
margin-top: 10px;
padding: 8px 16px;
border: none;
border-radius: 4px;
cursor: pointer;
background-color: #007bff;
color: white;
}
.retry-button:hover {
background-color: #0056b3;
}
.offline-banner {
background-color: #ffcc00;
color: #333;
padding: 10px;
text-align: center;
font-weight: bold;
margin-bottom: 10px;
}
.main-content {
padding: 20px;
}
.loading-fallback {
text-align: center;
padding: 40px 0;
font-size: 1.2rem;
color: #666;
}
</style>