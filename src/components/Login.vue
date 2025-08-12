<template>
<div class="login-container">
  <div class="login-card">
    <!-- Header Section -->
    <div class="login-header">
      <div class="logo-container">
        <div class="logo-icon">🎵</div>
        <h1 class="login-title">Spatial Notes</h1>
      </div>
      <p class="login-subtitle">Professional Audio Production Management</p>
      
      <div class="version-badge" @click="showChangelog = true">
        <span class="version-text">v21.49</span>
        <span class="version-date">July 8th</span>
        <span class="version-arrow">→</span>
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
            <p>Simplified table with compact, mobile-friendly design. Stage location assignment with multi-stage support.</p>
          </div>
          
          <div class="changelog-section">
            <h3>📅 Calendar Week/Grid View</h3>
            <p>Vertical week view with Monday start, proper navigation, and integrated stage hours.</p>
          </div>
          
          <div class="changelog-section">
            <h3>🎨 UI/UX Improvements</h3>
            <p>Modern tab design, collapsible legend, and consistent mobile-first responsive design.</p>
          </div>
          
          <div class="changelog-section">
            <h3>🔗 Enhanced Integration</h3>
            <p>Stage hours auto-sync to calendar events, unified event management system.</p>
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
        <label for="email" class="form-label">Email Address</label>
        <div class="input-wrapper">
          <div class="input-icon">📧</div>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="Enter your email"
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
            placeholder="Enter your password"
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
        <span v-else>Sign In to Spatial Notes</span>
      </button>
    </form>

    <!-- Alternative Login Options -->
    <div class="login-divider">
      <span class="divider-text">or</span>
    </div>

    <router-link to="/magic-link" class="btn-secondary magic-link-btn">
      <span class="btn-icon">🔗</span>
      <span>Use Magic Link Login</span>
    </router-link>

    <!-- Footer -->
    <div class="login-footer">
      <p class="footer-text">Secure authentication powered by Supabase</p>
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
  padding: 20px;
  background: linear-gradient(180deg, #fbfbfd 0%, #f5f5f7 100%);
  position: relative;
  overflow: hidden;
}

.login-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.03) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(255, 149, 0, 0.03) 0%, transparent 50%),
    radial-gradient(circle at 40% 40%, rgba(88, 86, 214, 0.02) 0%, transparent 50%);
  pointer-events: none;
}

.login-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  border-radius: 28px;
  box-shadow: 
    0 0 0 1px rgba(255, 255, 255, 0.1),
    0 1px 3px 0 rgba(0, 0, 0, 0.1),
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  padding: 56px 48px;
  width: 100%;
  max-width: 520px;
  position: relative;
  z-index: 1;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Header Section */
.login-header {
  text-align: center;
  margin-bottom: 48px;
}

.logo-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-bottom: 20px;
}

.logo-icon {
  font-size: 3rem;
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.08));
  background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.login-title {
  font-size: 2.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #1d1d1f 0%, #424245 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.login-subtitle {
  color: #86868b;
  font-size: 1.125rem;
  margin: 0 0 32px 0;
  font-weight: 400;
  letter-spacing: -0.01em;
}

.version-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: rgba(245, 245, 247, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 16px;
  padding: 10px 20px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 0.875rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

.version-badge:hover {
  background: rgba(235, 235, 237, 0.9);
  border-color: rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.version-text {
  font-weight: 600;
  color: #1d1d1f;
}

.version-date {
  color: #86868b;
}

.version-arrow {
  color: #007AFF;
  font-weight: 600;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.version-badge:hover .version-arrow {
  transform: translateX(3px);
}

/* Messages */
.message {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 18px 20px;
  border-radius: 16px;
  margin-bottom: 28px;
  border: 1px solid;
  backdrop-filter: blur(20px);
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
  font-size: 1.25rem;
  flex-shrink: 0;
}

.message-content {
  font-weight: 500;
  line-height: 1.5;
  font-size: 0.95rem;
}

/* Form */
.login-form {
  margin-bottom: 36px;
}

.form-group {
  margin-bottom: 28px;
}

.form-label {
  display: block;
  font-weight: 600;
  color: #1d1d1f;
  margin-bottom: 10px;
  font-size: 0.95rem;
  letter-spacing: -0.01em;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 18px;
  font-size: 1.1rem;
  color: #86868b;
  z-index: 2;
  opacity: 0.8;
}

.form-input {
  width: 100%;
  padding: 18px 18px 18px 52px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 16px;
  font-size: 1rem;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  color: #1d1d1f;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-sizing: border-box;
  font-weight: 400;
  letter-spacing: -0.01em;
}

.form-input:focus {
  outline: none;
  border-color: #007AFF;
  box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.1);
  background: rgba(255, 255, 255, 0.95);
  transform: translateY(-1px);
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
  box-shadow: 0 0 0 4px rgba(255, 59, 48, 0.1);
}

.toggle-password-btn {
  position: absolute;
  right: 18px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 10px;
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  color: #86868b;
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
  padding: 18px;
  background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%);
  color: white;
  border: none;
  border-radius: 16px;
  font-size: 1.125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  letter-spacing: -0.01em;
  box-shadow: 
    0 1px 3px 0 rgba(0, 0, 0, 0.1),
    0 1px 2px 0 rgba(0, 0, 0, 0.06);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06),
    0 10px 15px -3px rgba(0, 122, 255, 0.3);
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
  margin-top: 12px;
}

.loading-spinner {
  display: inline-block;
  width: 22px;
  height: 22px;
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
  margin: 36px 0;
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
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  padding: 0 20px;
  color: #86868b;
  font-size: 0.875rem;
  font-weight: 500;
  position: relative;
  z-index: 1;
  letter-spacing: -0.01em;
}

/* Secondary Button */
.btn-secondary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  width: 100%;
  padding: 18px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  color: #1d1d1f;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 16px;
  font-size: 1rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  letter-spacing: -0.01em;
  box-shadow: 
    0 1px 3px 0 rgba(0, 0, 0, 0.1),
    0 1px 2px 0 rgba(0, 0, 0, 0.06);
}

.btn-secondary:hover {
  background: rgba(245, 245, 247, 0.9);
  border-color: rgba(0, 0, 0, 0.12);
  transform: translateY(-1px);
  box-shadow: 
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.btn-icon {
  font-size: 1.1rem;
}

/* Footer */
.login-footer {
  text-align: center;
  margin-top: 36px;
  padding-top: 28px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.footer-text {
  color: #86868b;
  font-size: 0.875rem;
  margin: 0;
  font-weight: 400;
  letter-spacing: -0.01em;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(20px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}

.changelog-modal {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  border-radius: 24px;
  box-shadow: 
    0 0 0 1px rgba(255, 255, 255, 0.1),
    0 25px 50px -12px rgba(0, 0, 0, 0.25);
  max-width: 640px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28px 32px 20px 32px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.modal-header h2 {
  margin: 0;
  color: #1d1d1f;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.75rem;
  color: #86868b;
  cursor: pointer;
  padding: 10px;
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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
  padding: 28px 32px;
}

.changelog-section {
  margin-bottom: 28px;
  padding: 24px;
  background: rgba(245, 245, 247, 0.5);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.changelog-section:last-child {
  margin-bottom: 0;
}

.changelog-section h3 {
  margin: 0 0 14px 0;
  color: #1d1d1f;
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.changelog-section p {
  margin: 0;
  color: #424245;
  line-height: 1.6;
  font-size: 0.95rem;
  font-weight: 400;
}

.changelog-modal .btn-primary {
  margin: 0 32px 32px 32px;
}

/* Responsive Design */
@media (max-width: 640px) {
  .login-card {
    padding: 40px 28px;
    margin: 16px;
    border-radius: 24px;
  }
  
  .login-title {
    font-size: 2.25rem;
  }
  
  .changelog-modal {
    margin: 16px;
    border-radius: 20px;
  }
  
  .modal-header,
  .changelog-content {
    padding-left: 24px;
    padding-right: 24px;
  }
  
  .changelog-modal .btn-primary {
    margin-left: 24px;
    margin-right: 24px;
  }
}

@media (max-width: 480px) {
  .login-container {
    padding: 16px;
  }
  
  .login-card {
    padding: 32px 24px;
    border-radius: 20px;
  }
  
  .logo-container {
    flex-direction: column;
    gap: 16px;
  }
  
  .login-title {
    font-size: 2rem;
  }
  
  .form-input {
    padding: 16px 16px 16px 48px;
  }
  
  .btn-primary,
  .btn-secondary {
    padding: 16px;
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