// src/router/index.js - SIMPLIFIED FOR STANDALONE DANTE CLIENT
import { createRouter, createWebHistory } from 'vue-router';
import { defineAsyncComponent } from 'vue';
import { useUserStore } from '../stores/userStore';

// Auth components
const Login = defineAsyncComponent(() => import('../components/Login.vue'));
const ConfirmEmail = defineAsyncComponent(() => import('../components/ConfirmEmail.vue'));
const SetPassword = defineAsyncComponent(() => import('../components/SetPassword.vue'));
const ResetPassword = defineAsyncComponent(() => import('../components/ResetPassword.vue'));
const OfflinePage = defineAsyncComponent(() => import('../components/OfflinePage.vue'));

// Main app component
const DanteMonitorMixer = defineAsyncComponent(() => import('../components/tools/DanteMonitorMixer.vue'));

// User profile
const UserProfile = defineAsyncComponent(() => import('../components/UserProfile.vue'));

const routes = [
  // Auth routes
  { path: '/', name: 'Login', component: Login },
  { path: '/auth/confirm', name: 'ConfirmEmail', component: ConfirmEmail },
  { path: '/auth/set-password', name: 'SetPassword', component: SetPassword },
  { path: '/auth/reset-password', name: 'ResetPassword', component: ResetPassword },
  { path: '/offline', name: 'Offline', component: OfflinePage },

  // Main app - Dante Monitor Mixer
  { path: '/mixer', name: 'DanteMonitorMixer', component: DanteMonitorMixer },

  // User profile (basic settings)
  { path: '/profile/:tab?', name: 'UserProfile', component: UserProfile, props: true },

  // 404 fallback
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: OfflinePage }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore();
  const publicPages = ['Login', 'ConfirmEmail', 'SetPassword', 'ResetPassword', 'Offline'];
  const isPublicPage = publicPages.includes(to.name);

  if (!userStore.isAuthenticated) {
    await userStore.fetchUserSession();
  }

  if (!userStore.isAuthenticated && !isPublicPage) {
    return next({ name: 'Login' });
  }

  // Handle password reset flow
  const isSettingPassword = to.name === 'SetPassword' && (
    to.query.token_hash ||
    to.query.type === 'recovery' ||
    to.query.type === 'invite' ||
    to.hash.includes('token_hash') ||
    to.hash.includes('type=recovery') ||
    to.hash.includes('type=invite')
  );

  if (userStore.isAuthenticated && isPublicPage && !isSettingPassword) {
    return next({ name: 'DanteMonitorMixer' });
  }

  next();
});

export default router;
