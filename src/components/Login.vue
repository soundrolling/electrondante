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
      
      <div class="version-badge" @click="showChangelog = true">
        <span class="version-text">v21.49</span>
        <span class="version-date">July 8th</span>
      </div>
    </div>

    <!-- Changelog Modal -->
    <div v-if="showChangelog" class="modal-overlay" @click="showChangelog = false">
      <div class="modal changelog-modal" @click.stop>
        <div class="modal-header">
          <h2>What's New in 21.49</h2>
          <button class="modal-close" @click="showChangelog = false">×</button>
        </div>
        
        <div class="changelog-content">
          <div class="changelog-section">
            <h3>🎯 Contacts Table Redesign</h3>
            <p>Simplified table with compact, mobile-friendly design.</p>
          </div>
          
          <div class="changelog-section">
            <h3>📅 Calendar Week/Grid View</h3>
            <p>Vertical week view with Monday start and integrated stage hours.</p>
          </div>
          
          <div class="changelog-section">
            <h3>🎨 UI/UX Improvements</h3>
            <p>Modern tab design and consistent mobile-first responsive design.</p>
          </div>
        </div>
        
        <button class="btn-primary" @click="showChangelog = false">Got it!</button>
      </div>
    </div>

    <!-- Messages -->
    <div v-if="errorMessage" class="message error-message" role="alert">
      <div class="message-icon">⚠️</div>
      <div class="message-content">{{ errorMessage }}</div>
    </div>

    <div v-if="successMessage" class="message success-message" role="alert">
      <div class="message-icon">✅</div>
      <div class="message-content">{{ successMessage }}</div>
    </div>

    <!-- Login Form -->
    <form @submit.prevent="handleSubmit" class="login-form">
      <div class="form-group">
        <label for="email" class="form-label">Email</label>
        <div class="input-wrapper">
          <div class="input-icon">📧</div>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="Enter email"
            required
            class="form-input"
            :class="{ 'input-error': errorMessage }"
          />
        </div>
      </div>

      <div class="form-group">
        <label for="password" class="form-label">Password</label>
        <div class="input-wrapper">
          <div class="input-icon">🔒</div>
          <input
            id="password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Enter password"
            required
            class="form-input"
            :class="{ 'input-error': errorMessage }"
          />
          <button 
            type="button" 
            @click="togglePasswordVisibility" 
            class="toggle-password-btn"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
          >
            <span class="toggle-icon">{{ showPassword ? '👁️' : '👁️‍🗨️' }}</span>
          </button>
        </div>
      </div>

      <button type="submit" :disabled="loading" class="btn-primary login-btn">
        <span v-if="loading" class="loading-spinner"></span>
        <span v-else>Sign In</span>
      </button>
    </form>

    <!-- Alternative Login Options -->
    <div class="login-divider">
      <span class="divider-text">or</span>
    </div>

    <router-link to="/magic-link" class="btn-secondary magic-link-btn">
      <span class="btn-icon">🔗</span>
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
/* Container and Layout */
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background: linear-gradient(180deg, #fbfbfd 0%, #f5f5f7 100%);
  position: relative;
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
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  box-shadow: 
    0 0 0 1px rgba(255, 255, 255, 0.1),
    0 2px 8px rgba(0, 0, 0, 0.06),
    0 8px 16px rgba(0, 0, 0, 0.04);
  padding: 24px 20px;
  width: 100%;
  max-width: 360px;
  position: relative;
  z-index: 1;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Header Section */
.login-header {
  text-align: center;
  margin-bottom: 24px;
}

.logo-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 12px;
}

.logo-icon {
  font-size: 1.75rem;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.06));
  background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.login-title {
  font-size: 1.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #1d1d1f 0%, #424245 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
  letter-spacing: -0.01em;
  line-height: 1.1;
}

.login-subtitle {
  color: #86868b;
  font-size: 0.9rem;
  margin: 0 0 16px 0;
  font-weight: 400;
}

.version-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(245, 245, 247, 0.8);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 10px;
  padding: 6px 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.75rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.version-badge:hover {
  background: rgba(235, 235, 237, 0.9);
  border-color: rgba(0, 0, 0, 0.1);
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
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  margin-bottom: 20px;
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
  font-size: 1rem;
  flex-shrink: 0;
}

.message-content {
  font-weight: 500;
  line-height: 1.4;
  font-size: 0.85rem;
}

/* Form */
.login-form {
  margin-bottom: 24px;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-weight: 600;
  color: #1d1d1f;
  margin-bottom: 6px;
  font-size: 0.85rem;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 14px;
  font-size: 0.9rem;
  color: #86868b;
  z-index: 2;
  opacity: 0.8;
}

.form-input {
  width: 100%;
  padding: 12px 12px 12px 38px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  font-size: 0.9rem;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(16px);
  color: #1d1d1f;
  transition: all 0.2s ease;
  box-sizing: border-box;
  font-weight: 400;
}

.form-input:focus {
  outline: none;
  border-color: #007AFF;
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
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
  right: 14px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  transition: all 0.2s ease;
  color: #86868b;
}

.toggle-password-btn:hover {
  background: rgba(0, 0, 0, 0.04);
  color: #1d1d1f;
}

.toggle-icon {
  font-size: 0.9rem;
}

/* Buttons */
.btn-primary {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0, 122, 255, 0.2);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(0, 122, 255, 0.3);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.login-btn {
  margin-top: 6px;
}

.loading-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
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
  margin: 20px 0;
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
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(16px);
  padding: 0 12px;
  color: #86868b;
  font-size: 0.75rem;
  font-weight: 500;
  position: relative;
  z-index: 1;
}

/* Secondary Button */
.btn-secondary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(16px);
  color: #1d1d1f;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.btn-secondary:hover {
  background: rgba(245, 245, 247, 0.9);
  border-color: rgba(0, 0, 0, 0.12);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.btn-icon {
  font-size: 0.9rem;
}

/* Footer */
.login-footer {
  text-align: center;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.footer-text {
  color: #86868b;
  font-size: 0.75rem;
  margin: 0;
  font-weight: 400;
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
  padding: 12px;
}

.changelog-modal {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.15);
  max-width: 420px;
  width: 100%;
  max-height: 65vh;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 12px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.modal-header h2 {
  margin: 0;
  color: #1d1d1f;
  font-size: 1.3rem;
  font-weight: 700;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.3rem;
  color: #86868b;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  transition: all 0.2s ease;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  background: rgba(0, 0, 0, 0.04);
  color: #1d1d1f;
}

.changelog-content {
  padding: 16px 20px;
}

.changelog-section {
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(245, 245, 247, 0.5);
  backdrop-filter: blur(16px);
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.changelog-section:last-child {
  margin-bottom: 0;
}

.changelog-section h3 {
  margin: 0 0 6px 0;
  color: #1d1d1f;
  font-size: 0.9rem;
  font-weight: 600;
}

.changelog-section p {
  margin: 0;
  color: #424245;
  line-height: 1.4;
  font-size: 0.8rem;
  font-weight: 400;
}

.changelog-modal .btn-primary {
  margin: 0 20px 20px 20px;
}

/* Mobile-First Responsive Design */
@media (min-width: 480px) {
  .login-card {
    padding: 32px 28px;
    max-width: 400px;
  }
  
  .login-title {
    font-size: 1.75rem;
  }
  
  .form-input {
    padding: 14px 14px 14px 42px;
  }
  
  .btn-primary,
  .btn-secondary {
    padding: 14px;
  }
}

@media (min-width: 640px) {
  .login-container {
    padding: 20px;
  }
  
  .login-card {
    padding: 40px 36px;
    max-width: 440px;
  }
  
  .login-title {
    font-size: 2rem;
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
</style>