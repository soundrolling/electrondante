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
      
      <button class="version-badge" @click="showChangelog = true" aria-label="View changelog for version 21.127">
        <span class="version-text">v21.127</span>
        <span class="version-date">November 9th 2025</span>
      </button>
    </div>

    <!-- Changelog Modal -->
    <div v-if="showChangelog" class="modal-overlay" @click="showChangelog = false">
      <div class="modal changelog-modal" @click.stop role="dialog" aria-labelledby="changelog-title">
        <div class="modal-header">
          <h2 id="changelog-title">What's New in 21.127</h2>
          <button class="modal-close" @click="showChangelog = false" aria-label="Close changelog">×</button>
        </div>
        
        <div class="changelog-content">
          <div class="changelog-section">
            <h3>🔄 Version Update</h3>
            <p>General improvements and bug fixes.</p>
          </div>
          
          <div class="changelog-section">
            <h3>📤 Enhanced Location Notes Export</h3>
            <p>Location Notes export now supports exporting by Recording Day in addition to date ranges. Choose between "Recording Day" or "Date Range" export modes. Export all notes from a specific recording day, unassigned notes, or use the traditional date range filter. This makes it easier to export notes organized by your production schedule.</p>
          </div>
          
          <div class="changelog-section">
            <h3>🔗 Signal Mapper Stage Boundary Validation</h3>
            <p>Added validation to prevent cross-stage connections in the Signal Mapper. Connections can only be created between nodes within the same stage/location, ensuring proper signal routing organization. The system now automatically validates and maintains location consistency for all signal mapper connections.</p>
          </div>
          
          <div class="changelog-section">
            <h3>📊 Improved Track List Functionality</h3>
            <p>Enhanced the Track List view in Signal Mapper with better organization and display. Track lists now properly group by recorder and maintain consistent location filtering throughout the signal mapper interface.</p>
          </div>
          
          <div class="changelog-section">
            <h3>🌙 Complete Dark Mode Support</h3>
            <p>Added comprehensive dark mode theme throughout the entire application. Toggle between light and dark modes from the header or footer. All components now properly support dark backgrounds with white text for better visibility in low-light conditions.</p>
          </div>
          
          <div class="changelog-section">
            <h3>🎨 Enhanced Component Styling</h3>
            <p>Updated all components to use theme variables instead of hardcoded colors. Stage Pictures, Stage Documents, Project Tools, Location Notes, and all modals now properly adapt to dark mode with darker backgrounds and improved contrast.</p>
          </div>
          
          <div class="changelog-section">
            <h3>🎯 Improved Status Indicators</h3>
            <p>Status pills and indicators throughout the app now use dark backgrounds with white text in dark mode. Repacking tab status badges, managing hours LIVE indicators, and all button states have been updated for better visibility.</p>
          </div>
          
          <div class="changelog-section">
            <h3>📦 Enhanced Modals & Forms</h3>
            <p>Create Bag modal, User Gear Selector, and all form elements now have proper dark mode styling. Input fields, dropdowns, and interactive elements use theme-aware colors for consistent appearance across both light and dark modes.</p>
          </div>
          
          <div class="changelog-section">
            <h3>📷 Stage Pictures & Documents Dark Mode</h3>
            <p>Completely redesigned Stage Pictures and Stage Documents pages for dark mode compatibility. All white backgrounds replaced with theme-aware dark backgrounds. Upload areas, file lists, image cards, and document previews now seamlessly adapt to dark mode with proper contrast.</p>
          </div>
          
          <div class="changelog-section">
            <h3>🛠️ Project Tools & UI Improvements</h3>
            <p>Project Tools buttons now feature dark backgrounds with white text in dark mode. Theme toggle button redesigned as a proper toggle switch with consistent sizing. Sign Out and Clear Cache buttons use dark red styling for better visual hierarchy.</p>
          </div>
          
          <div class="changelog-section">
            <h3>🔧 Login & Authentication</h3>
            <p>Login page background now uses theme variables for consistent dark mode appearance. All authentication-related components properly support both light and dark themes.</p>
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

    <!-- Forgot Password Link -->
    <div class="forgot-password-container">
      <router-link to="/auth/reset-password" class="forgot-password-link">
        Forgot your password?
      </router-link>
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
  background: var(--bg-primary);
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
  background: var(--bg-primary);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  box-shadow: var(--shadow-lg);
  padding: 24px 20px;
  width: 100%;
  max-width: 400px;
  position: relative;
  z-index: 1;
  border: 1px solid var(--border-light);
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
  font-size: 24px;
  font-weight: 600;
  color: var(--text-heading) !important;
  margin: 0;
  letter-spacing: -0.01em;
  line-height: 1.4;
}

.login-subtitle {
  color: var(--text-secondary);
  font-size: 16px;
  margin: 0 0 24px 0;
  font-weight: 400;
  line-height: 1.5;
}

.version-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-secondary);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
  box-shadow: var(--shadow-sm);
  min-height: 44px;
  min-width: 44px;
}

.version-badge:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-medium);
  transform: translateY(-1px);
}

.version-text {
  font-weight: 600;
  color: var(--text-heading);
}

.version-date {
  color: var(--text-secondary);
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
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: var(--color-error-600);
}

.success-message {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
  color: var(--color-success-600);
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
  color: var(--text-heading);
  margin-bottom: 8px;
  font-size: 16px;
  line-height: 1.4;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 16px;
  font-size: 1.1rem;
  color: var(--icon-secondary);
  z-index: 2;
  opacity: 0.8;
}

.form-input {
  width: 100%;
  padding: 16px 16px 16px 48px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  font-size: 16px;
  background: var(--bg-primary);
  backdrop-filter: blur(16px);
  color: var(--text-primary);
  transition: all 0.2s ease;
  box-sizing: border-box;
  font-weight: 400;
  line-height: 1.4;
  min-height: 48px;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
  background: var(--bg-primary);
}

.form-input::placeholder {
  color: var(--text-secondary);
  font-weight: 400;
}

.input-error {
  border-color: var(--color-error-500);
}

.input-error:focus {
  border-color: var(--color-error-500);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.toggle-password-btn {
  position: absolute;
  right: 16px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 12px;
  border-radius: 6px;
  transition: all 0.2s ease;
  color: var(--icon-secondary);
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-password-btn:hover {
  background: var(--bg-secondary);
  color: var(--icon-primary);
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

/* Forgot Password */
.forgot-password-container {
  text-align: center;
  margin-top: 24px; /* 8-point spacing */
}

.forgot-password-link {
  color: var(--text-link);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s ease;
  display: inline-block;
  padding: 8px 12px;
  border-radius: 6px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.forgot-password-link:hover {
  color: var(--color-primary-600);
  background: var(--bg-secondary);
  text-decoration: underline;
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
  background: var(--bg-primary);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  box-shadow: var(--shadow-xl);
  max-width: 400px;
  width: 100%;
  max-height: 70vh;
  overflow-y: auto;
  border: 1px solid var(--border-light);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 16px 24px;
  border-bottom: 1px solid var(--border-light);
}

.modal-header h2 {
  margin: 0;
  color: var(--text-heading);
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--icon-secondary);
  cursor: pointer;
  padding: 12px;
  border-radius: 8px;
  transition: all 0.2s ease;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  background: var(--bg-secondary);
  color: var(--icon-primary);
}

.changelog-content {
  padding: 20px 24px; /* 8-point spacing */
}

.changelog-section {
  margin-bottom: 20px;
  padding: 16px;
  background: var(--bg-secondary);
  backdrop-filter: blur(16px);
  border-radius: 8px;
  border: 1px solid var(--border-light);
}

.changelog-section:last-child {
  margin-bottom: 0;
}

.changelog-section h3 {
  margin: 0 0 8px 0;
  color: var(--text-heading);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
}

.changelog-section p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.5;
  font-size: 14px;
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