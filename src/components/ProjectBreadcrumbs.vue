<template>
<nav class="breadcrumbs">
  <div class="bc-left">
    <slot name="left"></slot>
  </div>
  <div class="bc-center">
    <router-link class="btn btn-primary link" :to="{ name: 'Projects' }">All Projects</router-link>
    <router-link
      v-if="currentProjectId"
      class="btn btn-primary link"
      :to="{ name: 'ProjectDetail', params: { id: currentProjectId } }"
    >Project Home</router-link>
  </div>
  <div class="bc-right">
    <slot name="right"></slot>
  </div>
</nav>
</template>

<script setup>
import { computed } from 'vue'
import { useUserStore } from '@/stores/userStore'

const store = useUserStore()
const currentProjectId = computed(() => store.getCurrentProject?.id || store.getCurrentProject?.project_id || null)
</script>

<style scoped>
.breadcrumbs {
display: flex;
align-items: center;
gap: 12px;
justify-content: space-between;
padding: 12px 16px;
margin: 12px 16px 0 16px;
background: rgba(255,255,255,0.9);
border: 1px solid rgba(255,255,255,0.3);
border-radius: 12px;
box-shadow: 0 2px 12px rgba(0,0,0,0.05);
backdrop-filter: blur(10px);
}
.bc-left, .bc-right {
display: flex;
align-items: center;
gap: 8px;
}
.bc-center {
display: flex;
align-items: center;
gap: 10px;
}
.link { text-decoration: none; font-weight: 700; border: 2px solid #1e40af !important; }

.icon-btn {
  background-color: #1d4ed8 !important;
  color: #ffffff !important;
  border: 2px solid #1e40af !important;
  width: 44px; height: 44px; display: inline-flex; align-items:center; justify-content:center; border-radius: 6px;
}
.icon-btn:hover { background-color: #1e40af !important; }
.icon-svg { width: 20px; height: 20px; color: #fff; }

@media (max-width: 640px) {
  .breadcrumbs {
    flex-wrap: wrap;
    gap: 10px;
  }
  .bc-center {
    width: 100%;
    order: 2;
    justify-content: center;
  }
  .bc-left { order: 1; }
  .bc-right { order: 3; margin-left: auto; }
}
</style>


