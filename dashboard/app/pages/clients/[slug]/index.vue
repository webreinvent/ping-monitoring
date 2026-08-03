<template>
  <div data-testid="client-overview-page">
    <NavigationBreadcrumb label="All Monitors" to="/" />
    <div class="page-heading">
      <h2>Client — {{ slug }}</h2>
    </div>
    <div class="chart-placeholder">
      <span>Client overview — coming soon</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const slug = computed(() => String(route.params.slug));

useHead({ title: `Client — ${slug.value}` });
</script>
