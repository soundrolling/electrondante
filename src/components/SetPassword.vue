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
        class="toggle-password-btn"
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

  // 2) onMounted, parse all tokens from the hash
  onMounted(() => {
    const params = parseHashParams();
    // Example keys: access_token, refresh_token, token_type, expires_at, expires_in, ...
    sessionParams.value.accessToken = params.access_token || null;
    sessionParams.value.refreshToken = params.refresh_token || null;
    sessionParams.value.tokenType = params.token_type || null;
    sessionParams.value.expiresIn = params.expires_in || null;
    sessionParams.value.expiresAt = params.expires_at || null;

    if (!sessionParams.value.accessToken) {
      errorMessage.value =
        'No access token found in the URL. Please use the link from your invite email.';
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

    if (!sessionParams.value.accessToken) {
      errorMessage.value = 'No valid session token available.';
      return;
    }

    loading.value = true;
    errorMessage.value = '';

    try {
      // 4.1) Set the session with the token (and optionally refresh token)
      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token: sessionParams.value.accessToken,
        refresh_token: sessionParams.value.refreshToken ?? null,
      });
      if (sessionError) {
        throw new Error(`Failed to authenticate: ${sessionError.message}`);
      }

      // 4.2) Update the user's password
      const { error } = await supabase.auth.updateUser({
        password: password.value,
      });
      if (error) {
        throw new Error(`Failed to reset password: ${error.message}`);
      }

      // 4.3) Success
      message.value = 'Password successfully reset! You can now log in.';
      toast.success('Password reset successful!');

      // Optionally redirect after a short delay
      setTimeout(() => {
        router.push('/');
      }, 3000);
    } catch (err) {
      console.error('Password reset error:', err);
      errorMessage.value = err.message;
      toast.error(`Password reset failed: ${err.message}`);
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
background-color: #f9f9f9;
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
background: #e0e0e0;
border: none;
border-radius: 4px;
cursor: pointer;
font-size: 14px;
}

.toggle-password-btn:hover {
background: #cfcfcf;
}

button {
width: 100%;
padding: 10px;
background-color: #007bff;
color: white;
border: none;
border-radius: 4px;
cursor: pointer;
font-size: 15px;
}

button:hover {
background-color: #0056b3;
}

button:disabled {
background-color: #ccc;
cursor: not-allowed;
}
</style>