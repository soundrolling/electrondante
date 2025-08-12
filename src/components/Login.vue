<template>
<div class="login-container modern-login">
  <h1 class="login-title">Spatial Notes Login</h1>
  <p class="login-version">
    <small>
      <span class="version-link" @click="showChangelog = true">What's New in 21.49 (July 8th)</span>
    </small>
  </p>

  <div v-if="showChangelog" class="modal-overlay">
    <div class="modal changelog-modal">
      <h2>What's New in 21.49 (July 8th)</h2>
      <table class="changelog-table">
        <thead>
          <tr>
            <th>Feature/Change</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Contacts Table Redesign</td>
            <td>
              - Simplified table: only Name (with Role and optional Stage Location), and Actions.<br/>
              - Info column and details modal removed.<br/>
              - Compact, mobile-friendly, minimal design.<br/>
              - Actions column is now as narrow as possible.<br/>
              - Table width constrained for no horizontal scroll.
            </td>
          </tr>
          <tr>
            <td>Stage Location Assignment</td>
            <td>
              - Assign contacts to one or more stage locations (checkboxes, not dropdowns).<br/>
              - Stage list pulled from Supabase locations.<br/>
              - Database updated for multi-stage assignment.<br/>
              - Add/Edit modal is mobile-friendly.
            </td>
          </tr>
          <tr>
            <td>Filtering & Quick Access</td>
            <td>
              - Stage location dropdown in main filter (stage names only).<br/>
              - Filter logic updated for stage.<br/>
              - Can open contacts page filtered by stage from stage modal.
            </td>
          </tr>
          <tr>
            <td>Calendar Week/Grid View</td>
            <td>
              - Grid now shows a vertical week view only (no month grid).<br/>
              - Week always starts on Monday, correct across months/years.<br/>
              - Navigation arrows move by 7 days; "Today" jumps to current week.<br/>
              - Current week and today are highlighted.<br/>
              - Events shown in a two-column layout: times (12-hour), event name/location.<br/>
              - Compact, mobile-first layout with reduced spacing.<br/>
            </td>
          </tr>
          <tr>
            <td>Legend Improvements</td>
            <td>
              - Collapsible legend, closed by default.<br/>
              - Stage hours now shown under "Recording" in the legend.<br/>
              - Modern, standout styling, visually aligned with controls.
            </td>
          </tr>
          <tr>
            <td>Calendar Event & Stage Hour Integration</td>
            <td>
              - Stage hours now auto-sync to calendar events as "recording".<br/>
              - All calendar views use only calendar_events table.<br/>
              - No more frontend event synthesis.
            </td>
          </tr>
          <tr>
            <td>Calendar View UI/UX</td>
            <td>
              - Default view order: Grid View → Timeline View → List View.<br/>
              - Tab selector restyled as modern tabs (not buttons).<br/>
              - Tab names: Grid View, Timeline View, List View.<br/>
              - Responsive and accessible.
            </td>
          </tr>
          <tr>
            <td>Filter Controls</td>
            <td>
              - Date filter (from/to) only shown in List View.<br/>
              - Location picker shows only stage names.
            </td>
          </tr>
          <tr>
            <td>General UI/UX</td>
            <td>
              - Minimal, modern, and accessible design throughout.<br/>
              - Consistent spacing and responsiveness across all views.<br/>
              - Mobile-friendly, vertical-first design for week view.
            </td>
          </tr>
        </tbody>
      </table>
      <button class="btn close-btn" @click="showChangelog = false">Close</button>
    </div>
  </div>

  <div v-if="errorMessage" class="error-message" role="alert">
    {{ errorMessage }}
  </div>

  <div v-if="successMessage" class="success-message" role="alert">
    {{ successMessage }}
  </div>

  <form @submit.prevent="handleSubmit" class="login-form modern-form">
    <input
      v-model="email"
      type="email"
      placeholder="Email"
      required
      class="input-field modern-input"
    />

    <!-- Password field -->
    <div class="password-row">
      <input
        v-model="password"
        :type="showPassword ? 'text' : 'password'"
        placeholder="Password"
        required
        class="input-field password-field modern-input"
      />
      <button 
        type="button" 
        @click="togglePasswordVisibility" 
        class="toggle-password-btn icon-btn"
        :aria-label="showPassword ? 'Hide password' : 'Show password'"
      >
        {{ showPassword ? '🔐' : '👁' }}
      </button>
    </div>

    <button type="submit" :disabled="loading" class="login-button modern-btn">
      {{ loading ? 'Signing In...' : 'Sign In' }}
    </button>
  </form>

  <!-- Magic Link option -->
  <div class="magic-link-option">
    <router-link to="/magic-link" class="magic-link-button modern-secondary-btn">
      Use Magic Link Login Instead
    </router-link>
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
.login-container.modern-login {
  max-width: 400px;
  margin: 80px auto 0 auto;
  padding: 32px 28px 28px 28px;
  background-color: #f8f9fa;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.07);
  border: 1.5px solid #e5e7eb;
}
.login-title {
  text-align: center;
  color: #1f2937;
  margin-bottom: 8px;
  font-size: 2rem;
  font-weight: 700;
}
.login-version {
  text-align: center;
  color: #64748b;
  margin-bottom: 18px;
}
.error-message {
  color: #ef4444;
  margin-bottom: 15px;
  text-align: center;
  padding: 10px;
  background-color: #fef2f2;
  border-radius: 6px;
  border: 1px solid #fecaca;
}
.success-message {
  color: #10b981;
  margin-bottom: 15px;
  text-align: center;
  padding: 10px;
  background-color: #ecfdf5;
  border-radius: 6px;
  border: 1px solid #bbf7d0;
}
.login-form.modern-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.input-field.modern-input {
  margin-bottom: 0;
  padding: 12px 14px;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  width: 100%;
  font-size: 1rem;
  background: #fff;
  color: #222;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}
.input-field.modern-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px #dbeafe;
  outline: none;
}
.password-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 0;
}
.password-row .password-field {
  flex: 1 1 auto;
  margin-bottom: 0;
}
.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.5rem;
  color: #64748b;
  padding: 0 8px;
  transition: color 0.2s;
  border-radius: 6px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.icon-btn:hover {
  color: #2563eb;
  background: #f1f5f9;
}
.toggle-password-btn {
  position: static;
  right: auto;
  top: auto;
  transform: none;
  font-size: 1.5rem;
  color: inherit;
  padding: 0;
  margin: 0;
}
.login-button.modern-btn {
  padding: 12px;
  background-color: #10b981;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-top: 8px;
}
.login-button.modern-btn:hover {
  background-color: #059669;
}
.login-button.modern-btn:disabled {
  background-color: #6ee7b7;
  cursor: not-allowed;
}
.magic-link-option {
  text-align: center;
  margin: 18px 0 0 0;
}
.magic-link-button.modern-secondary-btn {
  display: inline-block;
  background: #f1f5f9;
  color: #2563eb;
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  padding: 10px 18px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
}
.magic-link-button.modern-secondary-btn:hover {
  background: #e0e7ef;
  color: #1d4ed8;
  border-color: #3b82f6;
}
.version-link {
  color: #2563eb;
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.2s;
}
.version-link:hover {
  color: #1d4ed8;
}
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}
.changelog-modal {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  padding: 32px 24px 24px 24px;
  min-width: 320px;
  max-width: 95vw;
  max-height: 80vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: flex-start;
}
.changelog-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 16px;
  font-size: 1rem;
}
.changelog-table th, .changelog-table td {
  border: 1px solid #e5e7eb;
  padding: 8px 12px;
  text-align: left;
}
.changelog-table th {
  background: #f1f5f9;
  color: #222;
  font-weight: 600;
}
.changelog-table tr:nth-child(even) td {
  background: #f8fafc;
}
.close-btn {
  background: #f1f5f9;
  color: #222;
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 18px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  margin-top: 8px;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
}
.close-btn:hover {
  background: #e0e7ef;
  color: #1d4ed8;
  border-color: #3b82f6;
}
</style>