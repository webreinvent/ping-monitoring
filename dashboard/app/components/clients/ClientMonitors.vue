<template>
  <div class="client-monitors-list" data-testid="client-monitors-list">
    <EmptyState v-if="monitors.length === 0" message="No monitors for this client" />
    <template v-else>
      <MonitorRow
        v-for="monitor in monitors"
        :key="monitor.id"
        :monitor="monitor"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { MonitorListItem } from "#shared/types";

defineProps<{
  monitors: MonitorListItem[];
}>();
</script>
