<template>
  <div data-testid="dashboard-page">
    <div class="page-heading" data-testid="monitor-section">
      <h2 data-testid="monitors-heading">All Monitors</h2>
      <TimeRangeSelector
        v-model="timeWindow"
        data-testid="time-range-selector"
      />
    </div>
    <AllMonitorsChart
      :monitors="monitorList"
      data-testid="all-monitors-chart"
    />
  </div>
</template>

<script setup lang="ts">
const { monitors } = useMonitors();
const { selectedPreset: timeWindow } = useTimeWindow();

const monitorList = computed(() => monitors.value);

useHead({ title: "LNPM Cloud Dashboard — All Monitors" });
</script>
