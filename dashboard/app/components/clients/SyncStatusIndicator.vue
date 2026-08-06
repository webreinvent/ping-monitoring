<template>
  <div class="sync-status" :class="statusClass" data-testid="sync-status">
    <span class="sync-dot" :class="{ pulsing: status === 'syncing' }" />
    <span>{{ statusText }}</span>
  </div>
</template>

<script setup lang="ts">
type SyncStatus =
  | "connected"
  | "disconnected"
  | "syncing"
  | "disabled"
  | "not_configured";

const props = defineProps<{
  status: SyncStatus;
}>();

const statusClass = computed(() => props.status);

const statusText = computed(() => {
  const map: Record<SyncStatus, string> = {
    connected: "Connected",
    disconnected: "Disconnected",
    syncing: "Syncing...",
    disabled: "Disabled",
    not_configured: "Not configured",
  };
  return map[props.status];
});
</script>
