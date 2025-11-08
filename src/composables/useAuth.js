// src/composables/useAuth.js
import { computed } from 'vue'
import { useUserStore } from '@/stores/userStore'

export function useAuth() {
  const userStore = useUserStore()
  
  const isAuthenticated = computed(() => userStore.isAuthenticated)
  const user = computed(() => userStore.user)
  
  return {
    isAuthenticated,
    user
  }
}

