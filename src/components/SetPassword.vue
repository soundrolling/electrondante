<template>
<div class="password-container">
  <h1>Set a New Password</h1>

  <!-- Success & Error Messages -->
  <div v-if="message" class="success-message">{{ message }}</div>
  <div v-if="errorMessage" class="error-message">
    <div>{{ errorMessage }}</div>
    <div v-if="isLinkExpired" class="expired-link-actions">
      <router-link to="/auth/reset-password" class="request-new-link-btn">
        Request a New Password Reset Link
      </router-link>
    </div>
    <button 
      v-if="debugInfo" 
      @click="showDebugInfo = !showDebugInfo" 
      class="debug-toggle-btn"
    >
      {{ showDebugInfo ? 'Hide' : 'Show' }} Debug Information
    </button>
    <div v-if="showDebugInfo && debugInfo" class="debug-info">
      <h3>Debug Information (Please share this with support)</h3>
      <button @click="copyDebugInfo" class="copy-debug-btn">Copy Debug Info</button>
      <pre>{{ debugInfo }}</pre>
    </div>
  </div>

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
  const showDebugInfo = ref(false);
  const debugInfo = ref(null);
  const isLinkExpired = ref(false);

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
    
    console.log('🔍 SetPassword.vue mounted, checking for session/tokens...');
    console.log('📍 Current URL:', window.location.href);
    console.log('📍 Pathname:', window.location.pathname);
    console.log('📍 Search:', window.location.search);
    console.log('📍 Hash:', window.location.hash);
    
    try {
      // First, check if we already have a valid session (from restoreSessionFromUrl)
      // Give restoreSessionFromUrl a moment to complete if it's still running
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const { data: existingSession, error: sessionErr } = await supabase.auth.getSession();
      console.log('🔍 Session check result:', { 
        hasSession: !!existingSession?.session, 
        error: sessionErr?.message,
        sessionUser: existingSession?.session?.user?.email 
      });
      
      if (!sessionErr && existingSession?.session) {
        console.log('✅ Found existing session (from restoreSessionFromUrl)');
        sessionParams.value.accessToken = existingSession.session.access_token;
        sessionParams.value.refreshToken = existingSession.session.refresh_token;
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
        loading.value = false;
        return;
      }

      // Build initial debug info (will be updated if errors occur)
      const initialDebugObj = JSON.parse(buildDebugInfo('Component mounted - checking for session'));
      initialDebugObj.session.hasSession = !!existingSession?.session;
      initialDebugObj.session.userEmail = existingSession?.session?.user?.email || null;
      // Don't set debugInfo yet - only show on errors
      
      // If no session, check for token_hash in query params (Supabase invite/recovery flow)
      const queryParams = new URLSearchParams(window.location.search);
      const tokenHash = queryParams.get('token_hash');
      const tokenType = queryParams.get('type'); // 'invite' or 'recovery'
      
      console.log('🔍 Checking query params:', { tokenHash: !!tokenHash, tokenType });
      
      if (tokenHash && (tokenType === 'invite' || tokenType === 'recovery')) {
        // This is a Supabase invite/recovery flow with token_hash
        // Note: restoreSessionFromUrl() may have already tried to verify this token
        // If it failed, the token might be expired or already consumed
        console.log('🔍 Found token_hash in query params, verifying OTP...', { type: tokenType });
        
        // Double-check session wasn't established by restoreSessionFromUrl() in the meantime
        const { data: recheckSession } = await supabase.auth.getSession();
        if (recheckSession?.session) {
          console.log('✅ Session was established by restoreSessionFromUrl()');
          sessionParams.value.accessToken = recheckSession.session.access_token;
          sessionParams.value.refreshToken = recheckSession.session.refresh_token;
          sessionParams.value.tokenType = tokenType;
          window.history.replaceState({}, '', window.location.pathname);
          loading.value = false;
          return;
        }
        
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: tokenType === 'invite' ? 'invite' : 'recovery',
        });
        
        if (error) {
          // Check if it's an expired/invalid token error
          const isExpiredError = error.message?.toLowerCase().includes('expired') || 
                                 error.message?.toLowerCase().includes('invalid') ||
                                 error.message?.toLowerCase().includes('has expired');
          
          const debugErr = buildDebugInfo('OTP verification failed', error);
          debugInfo.value = debugErr;
          
          if (isExpiredError) {
            isLinkExpired.value = true;
            throw new Error('This password reset link has expired. Please request a new password reset link.');
          }
          
          throw new Error(`Failed to verify token: ${error.message}`);
        }
        
        // After verification, we should have a session
        const { data: sessionData, error: sessionErr2 } = await supabase.auth.getSession();
        if (sessionErr2 || !sessionData?.session) {
          const debugErr = buildDebugInfo('Session not established after OTP verification', sessionErr2 || new Error('No session after verification'));
          debugInfo.value = debugErr;
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
        
        // Check for Supabase error parameters in hash
        if (params.error || params.error_code) {
          const errorCode = params.error_code || params.error;
          const errorDesc = params.error_description || params.error_description || 'Unknown error';
          
          let userFriendlyMessage = 'The password reset link is invalid or has expired.';
          if (errorCode === 'otp_expired') {
            userFriendlyMessage = 'This password reset link has expired. Please request a new password reset link.';
            isLinkExpired.value = true;
          } else if (errorCode === 'access_denied') {
            userFriendlyMessage = 'This password reset link is no longer valid. Please request a new password reset link.';
            isLinkExpired.value = true;
          }
          
          const debugErr = buildDebugInfo('Supabase error in URL hash', new Error(`${errorCode}: ${errorDesc}`));
          debugInfo.value = debugErr;
          errorMessage.value = userFriendlyMessage;
          showDebugInfo.value = true;
          return;
        }
        
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
            const debugErr = buildDebugInfo('No access token found after delay check');
            debugInfo.value = debugErr;
            errorMessage.value =
              'No access token found in the URL. Please use the link from your password reset email.';
          }
        }
      }
    } catch (err) {
      console.error('❌ Token verification/session check failed:', err);
      if (!debugInfo.value) {
        const debugErr = buildDebugInfo('Token verification/session check failed', err);
        debugInfo.value = debugErr;
      }
      errorMessage.value = err.message || 'Failed to verify token. Please use the link from your password reset email.';
      showDebugInfo.value = true; // Auto-show debug info on error
    } finally {
      loading.value = false;
    }
  });

  // 3) Toggle password visibility
  function togglePasswordVisibility() {
    showPassword.value = !showPassword.value;
  }

  // 5) Copy debug info to clipboard
  async function copyDebugInfo() {
    try {
      await navigator.clipboard.writeText(debugInfo.value);
      toast.success('Debug information copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy debug info:', err);
      toast.error('Failed to copy debug info');
    }
  }

  // 6) Build debug information object
  function buildDebugInfo(context, error = null) {
    const url = new URL(window.location.href);
    const queryParams = Object.fromEntries(new URLSearchParams(url.search));
    const hashParams = url.hash ? Object.fromEntries(new URLSearchParams(url.hash.substring(1))) : {};
    
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      context: context,
      error: error ? {
        message: error.message,
        name: error.name,
        stack: error.stack
      } : null,
      url: {
        full: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        queryParams: queryParams,
        hashParams: hashParams
      },
      sessionParams: {
        hasAccessToken: !!sessionParams.value.accessToken,
        hasRefreshToken: !!sessionParams.value.refreshToken,
        tokenType: sessionParams.value.tokenType
      },
      session: {
        hasSession: null, // Will be populated
        userEmail: null // Will be populated
      }
    }, null, 2);
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
          const debugErr = buildDebugInfo('No session token available when setting password');
          debugInfo.value = debugErr;
          throw new Error('No valid session token available. Please use the link from your password reset email.');
        }
      }
      
      // Verify we have a valid session before proceeding
      if (!currentSession?.session) {
        const debugErr = buildDebugInfo('Session expired or invalid when setting password');
        debugInfo.value = debugErr;
        throw new Error('Session expired. Please use the link from your password reset email again.');
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
      if (!debugInfo.value) {
        const debugErr = buildDebugInfo('Password set failed', err);
        // Add current session state to debug info
        const { data: currentSessionCheck } = await supabase.auth.getSession();
        const debugObj = JSON.parse(debugErr);
        debugObj.session.hasSession = !!currentSessionCheck?.session;
        debugObj.session.userEmail = currentSessionCheck?.session?.user?.email || null;
        debugInfo.value = JSON.stringify(debugObj, null, 2);
      }
      errorMessage.value = err.message;
      showDebugInfo.value = true; // Auto-show debug info on error
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
    showDebugInfo,
    debugInfo,
    copyDebugInfo,
    isLinkExpired,
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
padding: 15px;
background-color: rgba(239, 68, 68, 0.1);
border: 1px solid rgba(239, 68, 68, 0.3);
border-radius: 4px;
}

.debug-toggle-btn {
margin-top: 10px;
padding: 8px 16px;
background-color: var(--bg-tertiary);
color: var(--text-primary);
border: 1px solid var(--border-light);
border-radius: 4px;
cursor: pointer;
font-size: 14px;
}

.debug-toggle-btn:hover {
background-color: var(--bg-secondary);
}

.debug-info {
margin-top: 15px;
padding: 15px;
background-color: var(--bg-primary);
border: 1px solid var(--border-light);
border-radius: 4px;
max-height: 400px;
overflow-y: auto;
}

.debug-info h3 {
margin: 0 0 10px 0;
color: var(--text-heading);
font-size: 16px;
}

.copy-debug-btn {
margin-bottom: 10px;
padding: 8px 16px;
background-color: var(--color-primary-500);
color: var(--text-inverse);
border: none;
border-radius: 4px;
cursor: pointer;
font-size: 14px;
}

.copy-debug-btn:hover {
background-color: var(--color-primary-600);
}

.debug-info pre {
  margin: 0;
  padding: 10px;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-x: auto;
}

.expired-link-actions {
  margin-top: 15px;
}

.request-new-link-btn {
  display: inline-block;
  padding: 10px 20px;
  background-color: var(--color-primary-500);
  color: var(--text-inverse);
  text-decoration: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.request-new-link-btn:hover {
  background-color: var(--color-primary-600);
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