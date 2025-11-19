<!-- src/App.vue - SIMPLIFIED FOR STANDALONE DANTE CLIENT -->
<template>
  <div id="app" :class="{ 'dark-mode': isDarkMode }">
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

      <!-- Header (hidden on auth pages) -->
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

      <!-- Footer (hidden on auth pages) -->
      <Footer
        v-if="!isHiddenRoute"
        :userEmail="userEmail"
        @clearCache="clearCache"
        @signOut="signOut"
      />
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from './stores/userStore'
import { useThemeStore } from './stores/themeStore'
import Header from './components/Header.vue'
import Footer from './components/Footer.vue'
import { useToast } from 'vue-toastification'
import { syncOfflineChanges } from '@/services/dataService'

export default {
  name: 'App',
  components: { Header, Footer },
  setup() {
    const userStore = useUserStore()
    const themeStore = useThemeStore()
    const route = useRoute()
    const router = useRouter()
    const toast = useToast()

    const initializationError = ref(null)
    const onlineStatus = ref(navigator.onLine)

    const userEmail = computed(() => userStore.getUserEmail)
    const isDarkMode = computed(() => themeStore.isDarkMode)

    const isHiddenRoute = computed(() => {
      const hidden = ['/', '/login', '/auth/reset-password', '/auth/set-password', '/auth/confirm']
      return hidden.includes(route.path)
    })

    const clearCache = () => {
      localStorage.clear()
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

    // Update online status flag
    const updateOnlineStatus = () => {
      onlineStatus.value = navigator.onLine
    }

    // Handle going back online: sync offline changes
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

    onMounted(async () => {
      try {
        // Initialize theme first
        themeStore.initialize()

        await userStore.initializeStore()

        // Watch for connectivity changes
        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', updateOnlineStatus)
      } catch (err) {
        initializationError.value = `Failed to initialize the app: ${err.message}`
      }
    })

    onBeforeUnmount(() => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', updateOnlineStatus)
    })

    return {
      initializationError,
      onlineStatus,
      userEmail,
      isDarkMode,
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
  margin: 20px;
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
}

.main-content {
  min-height: calc(100vh - 120px);
  padding: 20px;
}

.loading-fallback {
  text-align: center;
  padding: 40px 0;
  font-size: 1.2rem;
  color: #666;
}

/* Dark mode support */
.dark-mode {
  background-color: #1a1a1a;
  color: #e0e0e0;
}

.dark-mode .error-message {
  background-color: #4a1f1f;
  color: #ffb3b3;
  border-color: #6b2c2c;
}

.dark-mode .loading-fallback {
  color: #999;
}
</style>
