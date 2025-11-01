<template>
<div class="confirm-container">
  <h1>Email Confirmation</h1>
  <div v-if="message" class="message-box success">{{ message }}</div>
  <div v-if="errorMessage" class="message-box error">{{ errorMessage }}</div>
  <div v-if="loading" class="loading-spinner">
    <div class="spinner"></div>
    <p>Verifying your email...</p>
  </div>
</div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { supabase } from '../supabase';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';

export default {
setup() {
  const message = ref('');
  const errorMessage = ref('');
  const loading = ref(true);
  const router = useRouter();
  const toast = useToast();

  const confirmEmail = async () => {
    try {
      // Get the hash fragment from the URL
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      
      // Get the access token and type from the URL
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const tokenType = params.get('type');
      
      console.log('🔍 Parsing URL tokens:', { 
        hasAccessToken: !!accessToken, 
        hasRefreshToken: !!refreshToken, 
        tokenType 
      });
      
      if (!accessToken) {
        // Try to get token from query parameters instead (for compatibility)
        const queryParams = new URLSearchParams(window.location.search);
        const queryToken = queryParams.get('token');
        const queryCode = queryParams.get('code');
        
        if (queryToken || queryCode) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: queryToken || queryCode,
            type: 'email',
          });
          
          if (error) throw error;
          
          message.value = 'Email successfully confirmed! You can now log in.';
          toast.success('Email confirmed successfully!');
          
          setTimeout(() => {
            router.push('/');
          }, 3000);
          return;
        } else {
          throw new Error('No confirmation token found in URL.');
        }
      }
      
      // Handle different token types
      if (tokenType === 'invite') {
        // This is an invitation flow - redirect to set password with tokens in hash
        console.log('📧 Invite flow detected, redirecting to set-password');
        const hashParams = new URLSearchParams();
        hashParams.set('access_token', accessToken);
        if (refreshToken) hashParams.set('refresh_token', refreshToken);
        hashParams.set('type', 'invite');
        
        router.push({
          path: '/auth/set-password',
          hash: `#${hashParams.toString()}`
        });
        return;
      } else if (tokenType === 'recovery') {
        // This is a password reset flow
        console.log('🔑 Recovery flow detected, redirecting to set-password');
        const hashParams = new URLSearchParams();
        hashParams.set('access_token', accessToken);
        if (refreshToken) hashParams.set('refresh_token', refreshToken);
        hashParams.set('type', 'recovery');
        
        router.push({
          path: '/auth/set-password',
          hash: `#${hashParams.toString()}`
        });
        return;
      } else {
        // This is an email verification flow (signup confirmation)
        console.log('✅ Email verification flow');
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        
        if (error) throw error;
      }

      message.value = 'Email successfully confirmed! You can now log in.';
      toast.success('Email confirmed successfully!');
      
      setTimeout(() => {
        router.push('/');
      }, 3000); // Redirect to login after 3 seconds
    } catch (error) {
      console.error('Email confirmation error:', error);
      errorMessage.value = error.message || 'Failed to confirm email. Please try again.';
      toast.error(errorMessage.value);
    } finally {
      loading.value = false;
    }
  };

  onMounted(() => {
    confirmEmail();
  });

  return {
    message,
    errorMessage,
    loading
  };
},
};
</script>

<style scoped>
.confirm-container {
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

.message-box {
  padding: 15px;
  margin: 15px 0;
  border-radius: 4px;
}

.success {
  background-color: rgba(34, 197, 94, 0.15);
  color: var(--color-success-700);
  border: 1px solid #c3e6cb;
}

.error {
  background-color: rgba(239, 68, 68, 0.1);
  color: var(--color-error-700);
  border: 1px solid #f5c6cb;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 20px;
}

.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>