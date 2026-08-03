<template>
  <div data-testid="monitor-detail-page">
    <NavigationBreadcrumb label="All Monitors" to="/" />
    <div class="page-heading">
      <h2>Monitor — {{ monitorId }}</h2>
    </div>
    <div class="chart-placeholder">
      <span>Monitor detail — coming soon</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const monitorId = computed(() => String(route.params.id));

useHead({ title: `Monitor — ${monitorId.value}` });
</script>
