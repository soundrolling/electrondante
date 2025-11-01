<template>
<div class="offline-page">
  <h1>You're Offline</h1>
  <p>
    It appears that you are not connected to the internet. You can still use the app offline—your data is available locally. Some features may be limited.
  </p>
  <button @click="returnToPrevious">Return to App</button>
</div>
</template>

<script>
export default {
name: 'OfflinePage',
methods: {
  returnToPrevious() {
    // Check if there's a previous history entry; if so, go back.
    if (window.history.length > 1) {
      this.$router.back();
    } else {
      // If no history exists, fallback to the home route.
      this.$router.push('/');
    }
  }
}
}
</script>

<style scoped>
.offline-page {
text-align: center;
padding: 20px;
background: var(--bg-primary);
border: 1px solid #ddd;
border-radius: 8px;
max-width: 500px;
margin: 50px auto;
}
h1 {
color: #333;
}
p {
color: #666;
margin-bottom: 20px;
}
button {
background-color: #007bff;
color: white;
border: none;
padding: 10px 20px;
border-radius: 5px;
cursor: pointer;
}
button:hover {
background-color: #0056b3;
}
</style>
