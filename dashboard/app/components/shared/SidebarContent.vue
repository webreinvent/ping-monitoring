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
      <button
        class="all-monitors-delete-btn"
        @click.stop="openDeleteAll"
        aria-label="Delete all monitors"
        title="Delete all monitors"
        data-testid="all-monitors-delete-btn"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
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
      @delete="handleRequestDelete"
      @delete-client="handleRequestDeleteClient"
    />
  </template>
  <EmptyState v-else />
  <DeleteMonitorModal
    v-if="pendingDelete"
    :monitor="pendingDelete"
    @cancel="pendingDelete = null"
    @confirm="confirmDelete"
  />
  <DeleteClientModal
    v-if="pendingDeleteClient"
    :client-name="pendingDeleteClient.clientName"
    :client-slug="pendingDeleteClient.clientSlug"
    :monitor-count="pendingDeleteClient.monitorCount"
    @cancel="pendingDeleteClient = null"
    @confirm="confirmDeleteClient"
  />
  <DeleteAllMonitorsModal
    v-if="pendingDeleteAll"
    :monitor-count="monitors.length"
    :client-count="groupedByClient.length"
    @cancel="pendingDeleteAll = false"
    @confirm="confirmDeleteAll"
  />
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { MonitorListItem } from "#shared/types";

const { monitors, groupedByClient, isVisible, toggleMonitor } = useMonitors();

// Listen for client name updates via WebSocket
const { onClientNameUpdated } = useWebSocket();
onClientNameUpdated((clientSlug: string, newName: string) => {
  const groups = groupedByClient.value;
  const group = groups.find((g) => g.clientSlug === clientSlug);
  if (group) {
    group.clientName = newName;
  }
});

const route = useRoute();
const selectedMonitorId = computed(() => {
  const match = route.path.match(/^\/monitors\/(\d+)$/);
  return match ? Number(match[1]) : null;
});

// Holds the monitor that the user has clicked "delete" on, while the
// confirmation modal is open. `null` means no modal should be shown.
const pendingDelete = ref<MonitorListItem | null>(null);

// Holds the client that the user has clicked "delete client" on, while the
// confirmation modal is open.
interface PendingClient {
  clientSlug: string;
  clientName: string;
  monitorCount: number;
}
const pendingDeleteClient = ref<PendingClient | null>(null);

// Drives the delete-all-monitors confirmation modal.
const pendingDeleteAll = ref<boolean>(false);

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

/**
 * Open the delete confirmation modal for the given monitor.
 * Triggered by the trash button emitted from ClientGroup → MonitorRow.
 */
function handleRequestDelete(monitor: MonitorListItem): void {
  pendingDelete.value = monitor;
}

/**
 * Open the delete-client confirmation modal for the given client group.
 * Triggered by the trash button emitted from ClientGroup.
 */
function handleRequestDeleteClient(slug: string, name: string, monitorCount: number): void {
  pendingDeleteClient.value = {
    clientSlug: slug,
    clientName: name,
    monitorCount,
  };
}

/**
 * Open the delete-all-monitors confirmation modal.
 * Triggered by the trash button on the "All Monitors" row.
 */
function openDeleteAll(): void {
  pendingDeleteAll.value = true;
}

/**
 * Confirm and execute a monitor deletion:
 *   1. Optimistically remove the row from the local grouped state.
 *   2. Close the modal.
 *   3. Redirect to `/` if the user was viewing `/monitors/[id]`.
 *   4. Send the DELETE; on failure, re-fetch the canonical list to
 *      restore accurate state.
 */
async function confirmDelete(monitor: MonitorListItem): Promise<void> {
  // 1. Optimistic local removal — drop the monitor from its client group.
  const groups = groupedByClient.value;
  const group = groups.find((g) => g.clientSlug === monitor.clientSlug);
  if (group) {
    group.monitors = group.monitors.filter((m) => m.id !== monitor.id);
    // Drop empty groups so the sidebar stays clean.
    if (group.monitors.length === 0) {
      groupedByClient.value = groups.filter((g) => g.clientSlug !== monitor.clientSlug);
    }
  }

  // 2. Close the modal immediately so the UI feels snappy.
  pendingDelete.value = null;

  // 3. If we're currently on the deleted monitor's detail page,
  // navigate away before the route's data fetch can 404.
  if (route.path === `/monitors/${monitor.id}`) {
    await navigateTo("/");
  }

  // 4. Fire the DELETE. On failure, re-pull the canonical list so the
  // sidebar reflects the truth rather than the (now stale) optimistic
  // state we just set.
  try {
    await $fetch(`/api/monitors/${monitor.id}`, { method: "DELETE" });
  } catch {
    await refreshNuxtData("monitors-list");
  }
}

/**
 * Confirm and execute a client deletion:
 *   1. Optimistically remove every monitor belonging to that client.
 *   2. Drop the client group itself.
 *   3. Close the modal.
 *   4. Redirect to `/` if the user was viewing one of the deleted monitors.
 *   5. Send the DELETE; on failure, re-fetch the canonical list.
 */
async function confirmDeleteClient(slug: string): Promise<void> {
  const groups = groupedByClient.value;
  const group = groups.find((g) => g.clientSlug === slug);

  // Capture the deleted monitor IDs so we can check the active route below.
  const deletedIds = new Set<number>(group?.monitors.map((m) => m.id) ?? []);

  // 1+2. Optimistic local removal — drop the entire client group.
  if (group) {
    groupedByClient.value = groups.filter((g) => g.clientSlug !== slug);
  }

  // 3. Close the modal immediately so the UI feels snappy.
  pendingDeleteClient.value = null;

  // 4. If we're currently viewing one of the deleted monitor's detail
  // page, navigate away before the route's data fetch can 404.
  if (selectedMonitorId.value !== null && deletedIds.has(selectedMonitorId.value)) {
    await navigateTo("/");
  }

  // 5. Fire the DELETE. On failure, re-pull the canonical list so the
  // sidebar reflects the truth rather than the (now stale) optimistic
  // state we just set.
  try {
    await $fetch(`/api/clients/${slug}`, { method: "DELETE" });
  } catch {
    await refreshNuxtData("monitors-list");
  }
}

/**
 * Confirm and execute a delete-all-monitors action:
 *   1. Optimistically empty every client group.
 *   2. Close the modal.
 *   3. Redirect to `/` if the user was viewing any monitor.
 *   4. Send the DELETE; on failure, re-fetch the canonical list.
 */
async function confirmDeleteAll(): Promise<void> {
  // Capture the deleted monitor IDs so we can check the active route below.
  const deletedIds = new Set<number>();
  for (const group of groupedByClient.value) {
    for (const m of group.monitors) {
      deletedIds.add(m.id);
    }
  }

  // 1. Optimistic local removal — clear every group.
  groupedByClient.value = [];

  // 2. Close the modal immediately.
  pendingDeleteAll.value = false;

  // 3. If we're viewing any monitor's detail page, navigate away.
  if (selectedMonitorId.value !== null && deletedIds.has(selectedMonitorId.value)) {
    await navigateTo("/");
  }

  // 4. Fire the DELETE.
  try {
    await $fetch(`/api/monitors`, { method: "DELETE" });
  } catch {
    await refreshNuxtData("monitors-list");
  }
}
</script>

<style scoped>
.all-monitors-delete-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 140ms ease, color 140ms ease, background 140ms ease;
}

.all-monitors-row:hover .all-monitors-delete-btn,
.all-monitors-delete-btn:focus-visible {
  opacity: 1;
}

.all-monitors-delete-btn:hover,
.all-monitors-delete-btn:focus-visible {
  color: var(--danger);
  background: var(--danger-soft);
  outline: none;
}
</style>
