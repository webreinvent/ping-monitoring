<template>
  <!-- Mobile overlay -->
  <div v-if="isMobile && isOpen" class="sidebar-overlay" @click="close" />

  <!-- Desktop sidebar -->
  <div v-show="!isMobile" class="sidebar-panel" data-testid="dashboard-sidebar">
    <SidebarContent />
  </div>

  <!-- Mobile sidebar (fixed overlay) -->
  <div v-if="isMobile" class="sidebar-mobile" :class="{ open: isOpen }" data-testid="dashboard-sidebar">
    <button class="sidebar-mobile-close" @click="close" aria-label="Close sidebar">
      &times;
    </button>
    <div class="sidebar-panel" style="padding-top: 48px;">
      <SidebarContent />
    </div>
  </div>
</template>

<script setup lang="ts">
const { isMobile, isOpen, close } = useResponsiveSidebar();
</script>
