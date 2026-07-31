<template>
  <div class="dashboard-shell">
    <header class="header">
      <h1>LNPM Cloud Dashboard</h1>
    </header>
    <main class="main">
      <p>Dashboard loading...</p>
    </main>
  </div>
</template>

<script setup lang="ts">
// Minimal app shell — will be replaced with full dashboard UI in M2-T1
</script>

<style scoped>
.dashboard-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: #1a1a2e;
  color: #e0e0e0;
  padding: 1rem 2rem;
  border-bottom: 1px solid #2a2a4a;
}

.header h1 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.main {
  flex: 1;
  padding: 2rem;
  color: #888;
}
</style>
