<template>
<div class="login-container">
  <div class="login-card">
    <!-- Header Section -->
    <div class="login-header">
      <div class="logo-container">
        <div class="logo-icon">🎵</div>
        <h1 class="login-title">Spatial Notes</h1>
      </div>
      <p class="login-subtitle">Audio Production Management</p>
      
      <button class="version-badge" @click="showChangelog = true" aria-label="View changelog for version 21.51">
        <span class="version-text">v21.51</span>
        <span class="version-date">October 5</span>
      </button>
    </div>

    <!-- Changelog Modal -->
    <div v-if="showChangelog" class="modal-overlay" @click="showChangelog = false">
      <div class="modal changelog-modal" @click.stop role="dialog" aria-labelledby="changelog-title">
        <div class="modal-header">
          <h2 id="changelog-title">What's New in 21.51</h2>
          <button class="modal-close" @click="showChangelog = false" aria-label="Close changelog">×</button>
        </div>
        
        <div class="changelog-content">
          <div class="changelog-section">
            <h3>📅 Schedule Controls Consolidated</h3>
            <p>Three separate schedule control rows are now combined into two: a single top row for sorting, adding, and date range; and a second row for date navigation.</p>
          </div>
          
          <div class="changelog-section">
            <h3>🔘 Larger, Clearer Action Buttons</h3>
            <p>Note/Edit/Delete buttons in Schedule now use larger icons with lighter backgrounds for improved legibility and accessibility.</p>
          </div>
          
          <div class="changelog-section">
            <h3>🧹 Misc Fixes & Polish</h3>
            <p>Minor visual tweaks and consistency improvements across Location Notes and Schedule.</p>
          </div>
        </div>
        
        <button class="btn-primary" @click="showChangelog = false">Got it!</button>
      </div>
    </div>

    <!-- Messages -->
    <div v-if="errorMessage" class="message error-message" role="alert" aria-live="polite">
      <div class="message-icon" aria-hidden="true">⚠️</div>
      <div class="message-content">{{ errorMessage }}</div>
    </div>

    <div v-if="successMessage" class="message success-message" role="alert" aria-live="polite">
      <div class="message-icon" aria-hidden="true">✅</div>
      <div class="message-content">{{ successMessage }}</div>
    </div>

    <!-- Login Form -->
    <form @submit.prevent="handleSubmit" class="login-form">
      <div class="form-group">
        <label for="email" class="form-label">Email Address</label>
        <div class="input-wrapper">
          <div class="input-icon" aria-hidden="true">📧</div>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="Enter your email address"
            required
            class="form-input"
            :class="{ 'input-error': errorMessage }"
            aria-describedby="email-error"
            autocomplete="email"
          />
        </div>
      </div>

      <div class="form-group">
        <label for="password" class="form-label">Password</label>
        <div class="input-wrapper">
          <div class="input-icon" aria-hidden="true">🔒</div>
          <input
            id="password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Enter your password"
            required
            class="form-input"
            :class="{ 'input-error': errorMessage }"
            aria-describedby="password-error"
            autocomplete="current-password"
          />
          <button 
            type="button" 
            @click="togglePasswordVisibility" 
            class="toggle-password-btn"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
            :aria-pressed="showPassword"
          >
            <span class="toggle-icon" aria-hidden="true">{{ showPassword ? '👁️' : '👁️‍🗨️' }}</span>
          </button>
        </div>
      </div>

      <button type="submit" :disabled="loading" class="btn-primary login-btn">
        <span v-if="loading" class="loading-spinner" aria-hidden="true"></span>
        <span v-else>Sign In to Spatial Notes</span>
      </button>
    </form>

    <!-- Alternative Login Options -->
    <div class="login-divider">
      <span class="divider-text">or</span>
    </div>

    <router-link to="/magic-link" class="btn-secondary magic-link-btn">
      <span class="btn-icon" aria-hidden="true">🔗</span>
      <span>Magic Link Login</span>
    </router-link>

    <!-- Footer -->
    <div class="login-footer">
      <p class="footer-text">Powered by Supabase</p>
    </div>
  </div>
</div>
</template>

<script>
import { ref } from 'vue';
import { supabase } from '../supabase';
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/userStore';
import { useToast } from 'vue-toastification';

export default {
setup() {
  const email = ref('');
  const password = ref('');
  const errorMessage = ref('');
  const successMessage = ref('');
  const loading = ref(false);
  const showPassword = ref(false);
  const showChangelog = ref(false);

  const router = useRouter();
  const userStore = useUserStore();
  const toast = useToast();

  const togglePasswordVisibility = () => {
    showPassword.value = !showPassword.value;
  };

  const clearCookies = () => {
    // ... your cookie/localStorage/sessionStorage clearing code ...
  };

  // Standard admin login
  const signInWithPassword = async () => {
    if (!email.value || !password.value) {
      errorMessage.value = 'Please fill in both email and password.';
      return;
    }
    try {
      loading.value = true;
      errorMessage.value = '';
      successMessage.value = '';

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.value,
        password: password.value,
      });
      
      if (error) throw new Error(`Login failed: ${error.message}`);
      if (!data?.session) throw new Error('No session returned from authentication');

      // Update user store
      await userStore.fetchUserSession();
      await userStore.initDB();
      await userStore.loadProjectFromLocalStorage();

      toast.success('Logged in successfully!');
      router.push('/projects');
    } catch (error) {
      errorMessage.value = error.message || 'An unexpected error occurred.';
      toast.error(errorMessage.value);
    } finally {
      loading.value = false;
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Admin login only
    await signInWithPassword();
  };

  return {
    email,
    password,
    errorMessage,
    successMessage,
    loading,
    showPassword,
    togglePasswordVisibility,
    handleSubmit,
    clearCookies,
    showChangelog,
  };
},
};
</script>

<style scoped>
/* Container and Layout - Mobile First */
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px; /* 4-point spacing system */
  background: linear-gradient(180deg, #fbfbfd 0%, #f5f5f7 100%);
  position: relative;
  /* Safe area support */
  padding-top: max(16px, env(safe-area-inset-top));
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  padding-left: max(16px, env(safe-area-inset-left));
  padding-right: max(16px, env(safe-area-inset-right));
}

.login-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.02) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(255, 149, 0, 0.02) 0%, transparent 50%);
  pointer-events: none;
}

.login-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px; /* 8-point spacing */
  box-shadow: 
    0 0 0 1px rgba(255, 255, 255, 0.1),
    0 4px 16px rgba(0, 0, 0, 0.08),
    0 16px 32px rgba(0, 0, 0, 0.06);
  padding: 24px 20px; /* 8-point spacing system */
  width: 100%;
  max-width: 400px; /* Mobile content width limit */
  position: relative;
  z-index: 1;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Header Section */
.login-header {
  text-align: center;
  margin-bottom: 32px; /* 8-point spacing */
}

.logo-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px; /* 4-point spacing */
  margin-bottom: 16px; /* 4-point spacing */
}

.logo-icon {
  font-size: 2rem; /* 32px - appropriate for mobile */
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.06));
  background: linear-gradient(135deg, #0066cc 0%, #5856D6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.login-title {
  font-size: 24px; /* H1: 24px (600 weight) - mobile first */
  font-weight: 600;
  color: #000000 !important;
  margin: 0;
  letter-spacing: -0.01em;
  line-height: 1.4; /* 1.4 for readability */
}

.login-subtitle {
  color: #86868b;
  font-size: 16px; /* Body: 16px (400 weight) */
  margin: 0 0 24px 0; /* 8-point spacing */
  font-weight: 400;
  line-height: 1.5;
}

.version-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px; /* 4-point spacing */
  background: rgba(248, 249, 250, 0.8);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(233, 236, 239, 0.8);
  border-radius: 8px; /* 4-point spacing */
  padding: 12px 16px; /* 4-point spacing */
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px; /* Caption: 14px */
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  /* Minimum touch size: 44×44px */
  min-height: 44px;
  min-width: 44px;
}

.version-badge:hover {
  background: rgba(233, 236, 239, 0.9);
  border-color: rgba(222, 226, 230, 0.9);
  transform: translateY(-1px);
}

.version-text {
  font-weight: 600;
  color: #1d1d1f;
}

.version-date {
  color: #86868b;
}

/* Messages */
.message {
  display: flex;
  align-items: flex-start;
  gap: 12px; /* 4-point spacing */
  padding: 16px; /* 4-point spacing */
  border-radius: 8px; /* 4-point spacing */
  margin-bottom: 24px; /* 8-point spacing */
  border: 1px solid;
  backdrop-filter: blur(16px);
}

.error-message {
  background: rgba(255, 59, 48, 0.08);
  border-color: rgba(255, 59, 48, 0.2);
  color: #d70015;
}

.success-message {
  background: rgba(52, 199, 89, 0.08);
  border-color: rgba(52, 199, 89, 0.2);
  color: #007a3e;
}

.message-icon {
  font-size: 1.25rem; /* 20px */
  flex-shrink: 0;
}

.message-content {
  font-weight: 500;
  line-height: 1.5;
  font-size: 14px; /* Caption: 14px */
}

/* Form */
.login-form {
  margin-bottom: 32px; /* 8-point spacing */
}

.form-group {
  margin-bottom: 24px; /* 8-point spacing */
}

.form-label {
  display: block;
  font-weight: 600;
  color: #1d1d1f;
  margin-bottom: 8px; /* 4-point spacing */
  font-size: 16px; /* Body: 16px */
  line-height: 1.4;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 16px; /* 4-point spacing */
  font-size: 1.1rem;
  color: #86868b;
  z-index: 2;
  opacity: 0.8;
}

.form-input {
  width: 100%;
  padding: 16px 16px 16px 48px; /* 4-point spacing, 48px min height */
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px; /* 4-point spacing */
  font-size: 16px; /* Body: 16px */
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(16px);
  color: #1d1d1f;
  transition: all 0.2s ease;
  box-sizing: border-box;
  font-weight: 400;
  line-height: 1.4;
  /* Minimum touch size: 44×48px */
  min-height: 48px;
}

.form-input:focus {
  outline: none;
  border-color: #0066cc;
  box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
  background: rgba(255, 255, 255, 0.95);
}

.form-input::placeholder {
  color: #86868b;
  font-weight: 400;
}

.input-error {
  border-color: #ff3b30;
}

.input-error:focus {
  border-color: #ff3b30;
  box-shadow: 0 0 0 3px rgba(255, 59, 48, 0.1);
}

.toggle-password-btn {
  position: absolute;
  right: 16px; /* 4-point spacing */
  background: none;
  border: none;
  cursor: pointer;
  padding: 12px; /* 4-point spacing */
  border-radius: 6px; /* 4-point spacing */
  transition: all 0.2s ease;
  color: #86868b;
  /* Minimum touch size: 44×44px */
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-password-btn:hover {
  background: rgba(0, 0, 0, 0.04);
  color: #1d1d1f;
}

.toggle-icon {
  font-size: 1.1rem;
}

/* Buttons */
.btn-primary {
  width: 100%;
  padding: 16px; /* 4-point spacing */
  background: linear-gradient(135deg, #0066cc 0%, #5856D6 100%);
  color: #ffffff !important;
  border: none;
  border-radius: 8px; /* 4-point spacing */
  font-size: 16px; /* Body: 16px */
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 102, 204, 0.2);
  /* Minimum touch size: 44×52px */
  min-height: 52px;
  line-height: 1.4;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 102, 204, 0.3);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.login-btn {
  margin-top: 8px; /* 4-point spacing */
  color: #ffffff !important;
}

.login-btn span {
  color: #ffffff !important;
}

.loading-spinner {
  display: inline-block;
  width: 20px; /* 4-point spacing */
  height: 20px; /* 4-point spacing */
  border: 2px solid rgba(255,255,255,0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Divider */
.login-divider {
  text-align: center;
  margin: 32px 0; /* 8-point spacing */
  position: relative;
}

.login-divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: rgba(0, 0, 0, 0.06);
}

.divider-text {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(16px);
  padding: 0 16px; /* 4-point spacing */
  color: #86868b;
  font-size: 14px; /* Caption: 14px */
  font-weight: 500;
  position: relative;
  z-index: 1;
}

/* Secondary Button */
.btn-secondary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px; /* 4-point spacing */
  width: 100%;
  padding: 16px; /* 4-point spacing */
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(16px);
  color: #1d1d1f;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px; /* 4-point spacing */
  font-size: 16px; /* Body: 16px */
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  /* Minimum touch size: 44×52px */
  min-height: 52px;
  line-height: 1.4;
}

.btn-secondary:hover {
  background: rgba(245, 245, 247, 0.9);
  border-color: rgba(0, 0, 0, 0.12);
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
}

.btn-icon {
  font-size: 1.1rem;
}

/* Footer */
.login-footer {
  text-align: center;
  margin-top: 32px; /* 8-point spacing */
  padding-top: 24px; /* 8-point spacing */
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.footer-text {
  color: #86868b;
  font-size: 14px; /* Caption: 14px */
  margin: 0;
  font-weight: 400;
  line-height: 1.4;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(16px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 16px; /* 4-point spacing */
  /* Safe area support */
  padding-top: max(16px, env(safe-area-inset-top));
  padding-bottom: max(16px, env(safe-area-inset-bottom));
}

.changelog-modal {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px; /* 8-point spacing */
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  max-width: 400px; /* Mobile content width limit */
  width: 100%;
  max-height: 70vh;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 16px 24px; /* 8-point spacing */
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.modal-header h2 {
  margin: 0;
  color: #1d1d1f;
  font-size: 20px; /* H2: 20px (600 weight) */
  font-weight: 600;
  line-height: 1.4;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #86868b;
  cursor: pointer;
  padding: 12px; /* 4-point spacing */
  border-radius: 8px; /* 4-point spacing */
  transition: all 0.2s ease;
  /* Minimum touch size: 44×44px */
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  background: rgba(0, 0, 0, 0.04);
  color: #1d1d1f;
}

.changelog-content {
  padding: 20px 24px; /* 8-point spacing */
}

.changelog-section {
  margin-bottom: 20px; /* 8-point spacing */
  padding: 16px; /* 4-point spacing */
  background: rgba(245, 245, 247, 0.5);
  backdrop-filter: blur(16px);
  border-radius: 8px; /* 4-point spacing */
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.changelog-section:last-child {
  margin-bottom: 0;
}

.changelog-section h3 {
  margin: 0 0 8px 0; /* 4-point spacing */
  color: #1d1d1f;
  font-size: 16px; /* Body: 16px */
  font-weight: 600;
  line-height: 1.4;
}

.changelog-section p {
  margin: 0;
  color: #424245;
  line-height: 1.5;
  font-size: 14px; /* Caption: 14px */
  font-weight: 400;
}

.changelog-modal .btn-primary {
  margin: 0 24px 24px 24px; /* 8-point spacing */
}

/* Mobile-First Responsive Design */
/* Mobile: 0–600px (default) */
/* Tablet: 601–1024px */
@media (min-width: 601px) {
  .login-container {
    padding: 24px; /* 8-point spacing */
  }
  
  .login-card {
    padding: 32px 28px; /* 8-point spacing */
    max-width: 480px;
  }
  
  .login-title {
    font-size: 28px; /* H1: 28px for tablet */
  }
  
  .form-input {
    padding: 18px 18px 18px 52px; /* 4-point spacing */
    min-height: 52px;
  }
  
  .btn-primary,
  .btn-secondary {
    padding: 18px; /* 4-point spacing */
    min-height: 56px;
  }
}

/* Desktop: 1025px+ */
@media (min-width: 1025px) {
  .login-container {
    padding: 32px; /* 8-point spacing */
  }
  
  .login-card {
    padding: 40px 36px; /* 8-point spacing */
    max-width: 520px;
  }
  
  .login-title {
    font-size: 32px; /* H1: 32px for desktop */
  }
  
  .changelog-modal {
    max-width: 480px;
  }
}

/* High DPI displays */
@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
  .login-card {
    border: 0.5px solid rgba(255, 255, 255, 0.2);
  }
  
  .form-input {
    border-width: 0.5px;
  }
  
  .btn-primary,
  .btn-secondary {
    border-width: 0.5px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .btn-primary,
  .btn-secondary,
  .version-badge,
  .toggle-password-btn {
    transition: none;
  }
  
  .btn-primary:hover:not(:disabled),
  .btn-secondary:hover,
  .version-badge:hover {
    transform: none;
  }
}

/* Focus States for Accessibility */
.btn-primary:focus,
.btn-secondary:focus,
.version-badge:focus,
.toggle-password-btn:focus,
.modal-close:focus {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}

/* High Contrast Mode Support */
@media (prefers-contrast: high) {
  .login-card {
    border-width: 2px;
  }
  
  .form-input,
  .btn-primary,
  .btn-secondary {
    border-width: 2px;
  }
}
</style>