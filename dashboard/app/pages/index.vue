<template>
  <div class="dashboard-page" data-testid="dashboard-page">
    <section class="monitor-section" data-testid="monitor-section">
      <h2 data-testid="monitors-heading">Monitors</h2>
      <div class="monitor-placeholder" data-testid="monitors-placeholder">
        <p>Monitors will appear here once data is ingested.</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
useHead({ title: "LNPM Cloud Dashboard" });
</script>

<style scoped>
.dashboard-page {
  padding: 2rem;
}

.monitor-section {
  text-align: center;
}

.monitor-section h2 {
  color: #333;
  margin-bottom: 1rem;
}

.monitor-placeholder {
  padding: 2rem;
  color: #888;
}
</style>
