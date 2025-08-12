<template>
<div class="magic-link-container">
  <h1>Magic Link Login</h1>
  <p>Enter your email address to receive a magic link for passwordless login.</p>
  
  <div v-if="errorMessage" class="error-message" role="alert">
    {{ errorMessage }}
  </div>
  
  <div v-if="successMessage" class="success-message" role="alert">
    {{ successMessage }}
  </div>
  
  <form @submit.prevent="sendMagicLink" class="magic-link-form">
    <input
      v-model="email"
      type="email"
      placeholder="Enter your email"
      required
      class="input-field"
    />
    
    <button type="submit" :disabled="loading" class="magic-link-button">
      {{ loading ? 'Sending...' : 'Send Magic Link' }}
    </button>
  </form>
  
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
  name: 'MagicLink',
  setup() {
    const email = ref('');
    const errorMessage = ref('');
    const successMessage = ref('');
    const loading = ref(false);
    const toast = useToast();
    
    const sendMagicLink = async () => {
      if (!email.value) {
        errorMessage.value = 'Please enter your email address.';
        return;
      }
      
      try {
        loading.value = true;
        errorMessage.value = '';
        successMessage.value = '';
        
        // Get the current origin for the redirect URL
        const redirectTo = `${window.location.origin}/auth/confirm`;
        
        const { error } = await supabase.auth.signInWithOtp({
          email: email.value,
          options: {
            emailRedirectTo: redirectTo
          }
        });
        
        if (error) throw error;
        
        successMessage.value = 'Magic link sent! Please check your email inbox.';
        toast.success('Magic link sent to your email!');
        email.value = ''; // Clear the email field
      } catch (error) {
        console.error('Error sending magic link:', error);
        errorMessage.value = error.message || 'Failed to send magic link. Please try again.';
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
      sendMagicLink
    };
  }
};
</script>

<style scoped>
.magic-link-container {
  max-width: 400px;
  margin: 100px auto;
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  text-align: center;
}

h1 {
  color: #333;
  margin-bottom: 15px;
}

p {
  color: #666;
  margin-bottom: 20px;
  font-size: 0.95rem;
  line-height: 1.5;
}

.error-message {
  color: #d9534f;
  margin-bottom: 15px;
  text-align: center;
  padding: 10px;
  background-color: #f2dede;
  border-radius: 4px;
}

.success-message {
  color: #28a745;
  margin-bottom: 15px;
  text-align: center;
  padding: 10px;
  background-color: #d4edda;
  border-radius: 4px;
}

.magic-link-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.input-field {
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.magic-link-button {
  padding: 12px;
  background-color: #5bc0de;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s;
}

.magic-link-button:hover {
  background-color: #46b8da;
}

.magic-link-button:disabled {
  background-color: #a8d8e6;
  cursor: not-allowed;
}

.back-to-login {
  margin-top: 20px;
}

.back-to-login a {
  color: #5bc0de;
  text-decoration: none;
}

.back-to-login a:hover {
  text-decoration: underline;
}
</style>