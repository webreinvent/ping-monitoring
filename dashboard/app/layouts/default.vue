<template>
  <div class="dashboard-shell">
    <DashboardHeader />
    <div class="workspace">
      <DashboardSidebar />
      <div class="sidebar-resizer" v-if="!isMobile" />
      <main class="main-content">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
const { isMobile } = useResponsiveSidebar();
</script>
