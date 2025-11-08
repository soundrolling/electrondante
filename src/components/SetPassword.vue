<template>
<div class="password-container">
  <h1>Set a New Password</h1>

  <!-- Success & Error Messages -->
  <div v-if="message" class="success-message">{{ message }}</div>
  <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

  <!-- Password Fields -->
  <div class="input-group">
    <label>New Password</label>
    <div class="input-row">
      <input
        v-model="password"
        :type="showPassword ? 'text' : 'password'"
        placeholder="Enter new password"
      />
      <button
        type="button"
        class="btn btn-warning toggle-password-btn"
        @click="togglePasswordVisibility"
      >
        {{ showPassword ? 'Hide' : 'Show' }}
      </button>
    </div>
  </div>

  <div class="input-group">
    <label>Confirm Password</label>
    <div class="input-row">
      <input
        v-model="confirmPassword"
        :type="showPassword ? 'text' : 'password'"
        placeholder="Confirm new password"
      />
    </div>
  </div>

  <!-- Submit Button -->
  <button
    @click="handleSetPassword"
    :disabled="loading || !password || !confirmPassword"
    class="btn btn-positive"
  >
    Set Password
  </button>
</div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { supabase } from '../supabase';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useUserStore } from '../stores/userStore';

export default {
setup() {
  // Form state
  const password = ref('');
  const confirmPassword = ref('');
  const message = ref('');
  const errorMessage = ref('');
  const loading = ref(false);
  const showPassword = ref(false);

  const router = useRouter();
  const toast = useToast();
  const userStore = useUserStore();

  // We'll parse session values from the URL hash: access_token, refresh_token, etc.
  const sessionParams = ref({
    accessToken: null,
    refreshToken: null,
    tokenType: null,
    expiresIn: null,
    expiresAt: null,
  });

  // 1) Helper to parse the hash (#...) into a dictionary of keys
  function parseHashParams() {
    const { hash } = window.location;
    if (!hash?.startsWith('#')) return {};
    const hashString = hash.substring(1); // remove leading '#'
    const urlParams = new URLSearchParams(hashString);

    // Build an object from the hash key-value pairs
    const result = {};
    for (const [key, value] of urlParams.entries()) {
      result[key] = value;
    }
    return result;
  }

  // 2) onMounted, parse all tokens from the hash or query params
  onMounted(async () => {
    loading.value = true;
    
    try {
      // First, check if we already have a valid session (from restoreSessionFromUrl)
      const { data: existingSession, error: sessionErr } = await supabase.auth.getSession();
      if (!sessionErr && existingSession?.session) {
        console.log('✅ Found existing session');
        sessionParams.value.accessToken = existingSession.session.access_token;
        sessionParams.value.refreshToken = existingSession.session.refresh_token;
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
        loading.value = false;
        return;
      }
      
      // If no session, check for token_hash in query params (Supabase invite/recovery flow)
      const queryParams = new URLSearchParams(window.location.search);
      const tokenHash = queryParams.get('token_hash');
      const tokenType = queryParams.get('type'); // 'invite' or 'recovery'
      
      if (tokenHash && (tokenType === 'invite' || tokenType === 'recovery')) {
        // This is a Supabase invite/recovery flow with token_hash
        console.log('🔍 Found token_hash in query params, verifying OTP...');
        
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: tokenType === 'invite' ? 'invite' : 'recovery',
        });
        
        if (error) {
          throw new Error(`Failed to verify token: ${error.message}`);
        }
        
        // After verification, we should have a session
        const { data: sessionData, error: sessionErr2 } = await supabase.auth.getSession();
        if (sessionErr2 || !sessionData?.session) {
          throw new Error('Session not established after token verification');
        }
        
        // Extract tokens from the session
        sessionParams.value.accessToken = sessionData.session.access_token;
        sessionParams.value.refreshToken = sessionData.session.refresh_token;
        sessionParams.value.tokenType = tokenType;
        
        console.log('✅ Token verified and session established');
        
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      } else {
        // Try to parse from hash (standard flow from ConfirmEmail redirect)
        const params = parseHashParams();
        // Example keys: access_token, refresh_token, token_type, expires_at, expires_in, ...
        sessionParams.value.accessToken = params.access_token || null;
        sessionParams.value.refreshToken = params.refresh_token || null;
        sessionParams.value.tokenType = params.type || params.token_type || null;
        sessionParams.value.expiresIn = params.expires_in || null;
        sessionParams.value.expiresAt = params.expires_at || null;

        if (!sessionParams.value.accessToken) {
          // Give restoreSessionFromUrl a moment to establish session
          // Sometimes there's a timing issue where the component mounts before session is ready
          await new Promise(resolve => setTimeout(resolve, 500));
          const { data: delayedSession } = await supabase.auth.getSession();
          if (delayedSession?.session) {
            sessionParams.value.accessToken = delayedSession.session.access_token;
            sessionParams.value.refreshToken = delayedSession.session.refresh_token;
          } else {
            errorMessage.value =
              'No access token found in the URL. Please use the link from your password reset email.';
          }
        }
      }
    } catch (err) {
      console.error('❌ Token verification/session check failed:', err);
      errorMessage.value = err.message || 'Failed to verify token. Please use the link from your password reset email.';
    } finally {
      loading.value = false;
    }
  });

  // 3) Toggle password visibility
  function togglePasswordVisibility() {
    showPassword.value = !showPassword.value;
  }

  // 4) Handle setting the new password
  async function handleSetPassword() {
    // Check for matching passwords
    if (password.value !== confirmPassword.value) {
      errorMessage.value = 'Passwords do not match.';
      return;
    }

    loading.value = true;
    errorMessage.value = '';

    try {
      // 4.1) Ensure we have a valid session
      // First check if we already have a session (from restoreSessionFromUrl or verifyOtp)
      let { data: currentSession, error: sessionError } = await supabase.auth.getSession();
      
      if (!currentSession?.session) {
        // No existing session, try to set it from sessionParams (from hash or token_hash)
        if (sessionParams.value.accessToken) {
          const { data, error: setSessionError } = await supabase.auth.setSession({
            access_token: sessionParams.value.accessToken,
            refresh_token: sessionParams.value.refreshToken ?? null,
          });
          if (setSessionError) {
            throw new Error(`Failed to authenticate: ${setSessionError.message}`);
          }
          // Re-fetch session after setting it
          const { data: newSession } = await supabase.auth.getSession();
          currentSession = newSession;
        } else {
          throw new Error('No valid session token available. Please use the link from your password reset email.');
        }
      }
      
      // Verify we have a valid session before proceeding
      if (!currentSession?.session) {
        throw new Error('Session expired. Please use the link from your invite email again.');
      }

      // 4.2) Update the user's password
      const { error } = await supabase.auth.updateUser({
        password: password.value,
      });
      if (error) {
        throw new Error(`Failed to set password: ${error.message}`);
      }

      // 4.3) Initialize user store (like Login does)
      await userStore.fetchUserSession();
      await userStore.initDB();
      await userStore.loadProjectFromLocalStorage();

      // 4.4) Success
      message.value = 'Password successfully set! Redirecting...';
      toast.success('Password set successfully! Welcome!');

      // Redirect to projects page
      setTimeout(() => {
        router.push('/projects');
      }, 1500);
    } catch (err) {
      console.error('Password set error:', err);
      errorMessage.value = err.message;
      toast.error(`Password setup failed: ${err.message}`);
    } finally {
      loading.value = false;
    }
  }

  return {
    password,
    confirmPassword,
    message,
    errorMessage,
    loading,
    showPassword,
    togglePasswordVisibility,
    handleSetPassword,
    sessionParams,
  };
},
};
</script>

<style scoped>
.password-container {
max-width: 400px;
margin: 100px auto;
padding: 20px;
background-color: var(--bg-secondary);
border-radius: 8px;
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
text-align: left;
}

h1 {
text-align: center;
}

.success-message {
color: green;
margin-bottom: 10px;
}

.error-message {
color: red;
margin-bottom: 10px;
}

.input-group {
margin-bottom: 15px;
}

.input-group label {
display: block;
font-weight: 600;
margin-bottom: 5px;
}

.input-row {
display: flex;
align-items: center;
}

.input-row input {
flex: 1;
padding: 10px;
border: 1px solid #ddd;
border-radius: 4px;
box-sizing: border-box;
font-size: 14px;
}

.toggle-password-btn {
margin-left: 8px;
padding: 8px 12px;
background: var(--bg-tertiary);
border: none;
border-radius: 4px;
cursor: pointer;
font-size: 14px;
}

.toggle-password-btn:hover {
background: var(--color-secondary-400);
}

button {
width: 100%;
padding: 10px;
background-color: var(--color-primary-500);
color: var(--text-inverse);
border: none;
border-radius: 4px;
cursor: pointer;
font-size: 15px;
}

button:hover {
background-color: var(--color-primary-600);
}

button:disabled {
background-color: var(--color-secondary-400);
cursor: not-allowed;
}
</style>