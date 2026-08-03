<template>
  <header class="dashboard-header" data-testid="dashboard-header">
    <div class="brand-block">
      <button class="hamburger-btn" @click="toggle" aria-label="Toggle sidebar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12h18" />
          <path d="M3 6h18" />
          <path d="M3 18h18" />
        </svg>
      </button>
      <div class="brand-mark">
        <svg class="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
          <path d="M12 6v6l4 2" />
        </svg>
      </div>
      <div>
        <h1>LNPM</h1>
        <p>Cloud Dashboard</p>
      </div>
    </div>
    <div class="connection-status">
      <span class="connection-dot" />
      <span>Live</span>
    </div>
  </header>
</template>

<script setup lang="ts">
const { toggle } = useResponsiveSidebar();
</script>
