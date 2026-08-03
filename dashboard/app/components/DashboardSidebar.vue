<template>
  <!-- Mobile overlay -->
  <div v-if="isMobile && isOpen" class="sidebar-overlay" @click="close" />

  <!-- Desktop sidebar -->
  <div v-show="!isMobile" class="sidebar-panel" data-testid="dashboard-sidebar">
    <template v-if="monitors.length">
      <div
        class="all-monitors-row"
        :class="{ selected: selectedMonitorId === null }"
        @click="navigateTo('/')"
      >
        <div class="all-target-icon">
          <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
        </div>
        <strong>All Monitors</strong>
        <span class="client-count-badge">{{ monitors.length }}</span>
      </div>
      <ClientGroup
        v-for="group in groupedByClient"
        :key="group.clientSlug"
        :client-name="group.clientName"
        :monitors="group.monitors"
      />
    </template>
    <EmptyState v-else />
  </div>

  <!-- Mobile sidebar (fixed overlay) -->
  <div v-if="isMobile" class="sidebar-mobile" :class="{ open: isOpen }" data-testid="dashboard-sidebar">
    <button class="sidebar-mobile-close" @click="close" aria-label="Close sidebar">
      &times;
    </button>
    <div class="sidebar-panel" style="padding-top: 48px;">
      <template v-if="monitors.length">
        <div
          class="all-monitors-row"
          :class="{ selected: selectedMonitorId === null }"
          @click="navigateTo('/') ; close()"
        >
          <div class="all-target-icon">
            <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </div>
          <strong>All Monitors</strong>
          <span class="client-count-badge">{{ monitors.length }}</span>
        </div>
        <ClientGroup
          v-for="group in groupedByClient"
          :key="group.clientSlug"
          :client-name="group.clientName"
          :monitors="group.monitors"
        />
      </template>
      <EmptyState v-else />
    </div>
  </div>
</template>

<script setup lang="ts">
const { monitors, groupedByClient } = useMonitors();
const { isMobile, isOpen, close } = useResponsiveSidebar();

const route = useRoute();
const selectedMonitorId = computed(() => {
  const match = route.path.match(/^\/monitors\/(\d+)$/);
  return match ? Number(match[1]) : null;
});
</script>
