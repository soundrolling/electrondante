<template>
<div class="reset-password-container">
  <h1>Reset Your Password</h1>
  <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
  <div v-if="successMessage" class="success-message">{{ successMessage }}</div>
  
  <input
    v-model="email"
    type="email"
    placeholder="Enter your email"
    class="input-field"
    required
  />
  
  <button @click="requestPasswordReset" :disabled="loading" class="btn btn-positive reset-button">
    {{ loading ? 'Sending...' : 'Send Reset Link' }}
  </button>
  
  <div class="back-to-login">
    <router-link to="/">Back to Login</router-link>
  </div>
</div>
</template>

<script>
import { ref } from 'vue';
import { supabase } from '../supabase';
import { useToast } from 'vue-toastification';

export default {
  setup() {
    const email = ref('');
    const errorMessage = ref('');
    const successMessage = ref('');
    const loading = ref(false);
    const toast = useToast();

    const requestPasswordReset = async () => {
      if (!email.value || !email.value.trim()) {
        errorMessage.value = 'Please enter your email address.';
        return;
      }

      loading.value = true;
      errorMessage.value = '';
      successMessage.value = '';

      try {
        // Get the current origin for the redirect URL
        const redirectTo = `${window.location.origin}/auth/set-password`;
        
        const { error } = await supabase.auth.resetPasswordForEmail(email.value, {
          redirectTo
        });

        if (error) {
          throw error;
        }

        successMessage.value = 'Password reset link has been sent to your email. Please check your inbox.';
        toast.success('Password reset email sent successfully!');
        email.value = ''; // Clear the email field
      } catch (error) {
        console.error('Error requesting password reset:', error);
        errorMessage.value = error.message || 'Failed to send password reset email. Please try again.';
        toast.error(errorMessage.value);
      } finally {
        loading.value = false;
      }
    };

    return {
      email,
      errorMessage,
      successMessage,
      loading,
      requestPasswordReset
    };
  }
};
</script>

<style scoped>
.reset-password-container {
  max-width: 400px;
  margin: 100px auto;
  padding: 20px;
  background-color: var(--bg-secondary);
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  text-align: center;
}

h1 {
  color: var(--text-primary);
  margin-bottom: 20px;
}

.input-field {
  width: 100%;
  padding: 10px;
  margin-bottom: 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.reset-button {
  width: 100%;
  padding: 10px;
  background-color: var(--color-primary-500);
  color: var(--text-inverse);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s;
}

.reset-button:hover {
  background-color: var(--color-primary-600);
}

.reset-button:disabled {
  background-color: var(--color-secondary-400);
  cursor: not-allowed;
}

.error-message {
  color: var(--color-error-600);
  margin-bottom: 15px;
  padding: 10px;
  background-color: rgba(239, 68, 68, 0.1);
  border-radius: 4px;
}

.success-message {
  color: var(--color-success-500);
  margin-bottom: 15px;
  padding: 10px;
  background-color: rgba(34, 197, 94, 0.15);
  border-radius: 4px;
}

.back-to-login {
  margin-top: 20px;
}

.back-to-login a {
  color: var(--color-primary-500);
  text-decoration: none;
}

.back-to-login a:hover {
  text-decoration: underline;
}
</style>