<template>
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
      :client-slug="group.clientSlug"
      :monitors="group.monitors"
      :is-visible="isVisible"
      @toggle="handleToggle"
      @rename="handleRename"
    />
  </template>
  <EmptyState v-else />
</template>

<script setup lang="ts">
const { monitors, groupedByClient, isVisible, toggleMonitor } = useMonitors();

const route = useRoute();
const selectedMonitorId = computed(() => {
  const match = route.path.match(/^\/monitors\/(\d+)$/);
  return match ? Number(match[1]) : null;
});

function handleToggle(monitorId: number): void {
  toggleMonitor(monitorId);
}

async function handleRename(slug: string, newName: string): Promise<void> {
  try {
    await $fetch(`/api/clients/${slug}/name`, {
      method: "PUT",
      body: { name: newName },
    });
    // Optimistically update local state
    const groups = groupedByClient.value;
    const group = groups.find((g) => g.clientSlug === slug);
    if (group) {
      group.clientName = newName;
    }
  } catch {
    // Revert on error — the component will re-render from the stored name
    // The optimistic update in ClientGroup is already handled by cancelEdit
  }
}
</script>
