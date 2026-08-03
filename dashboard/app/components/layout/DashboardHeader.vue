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
    <div class="connection-status" :class="wsStateClass">
      <span class="connection-dot" :class="wsDotClass" />
      <span>{{ wsStateText }}</span>
    </div>
  </header>
</template>

<script setup lang="ts">
const { toggle } = useResponsiveSidebar();
const { connectionState } = useWebSocket();

const wsStateClass = computed(() => {
  switch (connectionState.value) {
    case "connected": return "ws-connected";
    case "reconnecting": return "ws-reconnecting";
    default: return "ws-disconnected";
  }
});

const wsDotClass = computed(() => {
  switch (connectionState.value) {
    case "connected": return "ws-dot connected";
    case "reconnecting": return "ws-dot reconnecting";
    default: return "ws-dot disconnected";
  }
});

const wsStateText = computed(() => {
  switch (connectionState.value) {
    case "connected": return "Live";
    case "reconnecting": return "Reconnecting...";
    case "connecting": return "Connecting...";
    default: return "Disconnected";
  }
});
</script>
