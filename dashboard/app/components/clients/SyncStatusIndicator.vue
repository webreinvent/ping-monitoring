<template>
  <div class="sync-status" :class="statusClass" data-testid="sync-status">
    <span class="sync-dot" :class="{ pulsing: status === 'syncing' }" />
    <span>{{ statusText }}</span>
  </div>
</template>

<script setup lang="ts">
type SyncStatus = "connected" | "syncing" | "error" | "disabled";

const props = defineProps<{
  status: SyncStatus;
}>();

const statusClass = computed(() => props.status);

const statusText = computed(() => {
  const map: Record<SyncStatus, string> = {
    connected: "Synced",
    syncing: "Syncing...",
    error: "Sync Error",
    disabled: "Sync Disabled",
  };
  return map[props.status];
});
</script>
