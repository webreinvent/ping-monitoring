import type { MonitorListItem, MonitorsListResponse } from "#shared/types";

interface MonitorGroup {
  clientSlug: string;
  clientName: string;
  monitors: MonitorListItem[];
}

/** localStorage key for visible monitors set */
const VISIBLE_MONITORS_KEY = "lnpm-visible-monitors";

/**
 * Restore the visible monitors set from localStorage.
 */
function loadVisibleMonitors(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = localStorage.getItem(VISIBLE_MONITORS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as number[];
      return new Set(parsed);
    }
  } catch {
    // Ignore parse errors
  }
  return new Set();
}

/**
 * Persist the visible monitors set to localStorage.
 */
function saveVisibleMonitors(monitors: Set<number>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VISIBLE_MONITORS_KEY, JSON.stringify([...monitors]));
  } catch {
    // Ignore write errors
  }
}

export function useMonitors() {
  const { data: monitorsResponse, status, error, refresh } = useAsyncData(
    "monitors-list",
    async () => {
      const response = await $fetch<MonitorsListResponse>("/api/monitors");
      return response;
    },
  );

  // Group by client
  const groupedByClient = computed<MonitorGroup[]>(() => {
    const monitors = monitorsResponse.value?.monitors ?? [];
    const map = new Map<string, MonitorListItem[]>();

    for (const m of monitors) {
      if (!map.has(m.clientSlug)) {
        map.set(m.clientSlug, []);
      }
      map.get(m.clientSlug)!.push(m);
    }

    const groups: MonitorGroup[] = [];
    for (const [slug, items] of map) {
      groups.push({
        clientSlug: slug,
        clientName: items[0]!.clientName,
        monitors: items,
      });
    }

    return groups;
  });

  // Visible monitors toggle state
  const visibleMonitors = ref<Set<number>>(loadVisibleMonitors());

  /** Toggle visibility of a monitor in the chart */
  function toggleMonitor(id: number): void {
    if (visibleMonitors.value.has(id)) {
      visibleMonitors.value.delete(id);
    } else {
      const newSet = new Set(visibleMonitors.value);
      newSet.add(id);
      visibleMonitors.value = newSet;
    }
    saveVisibleMonitors(visibleMonitors.value);
  }

  /** Check if a monitor is visible in the chart */
  function isVisible(id: number): boolean {
    return visibleMonitors.value.has(id);
  }

  /** Set a monitor as visible */
  function showMonitor(id: number): void {
    const newSet = new Set(visibleMonitors.value);
    newSet.add(id);
    visibleMonitors.value = newSet;
    saveVisibleMonitors(visibleMonitors.value);
  }

  /** Set a monitor as hidden */
  function hideMonitor(id: number): void {
    const newSet = new Set(visibleMonitors.value);
    newSet.delete(id);
    visibleMonitors.value = newSet;
    saveVisibleMonitors(visibleMonitors.value);
  }

  // Initialize: show all monitors on first load if set is empty
  watch(
    () => monitorsResponse.value?.monitors,
    (monitors) => {
      if (monitors && monitors.length > 0 && visibleMonitors.value.size === 0) {
        const allIds = new Set(monitors.map((m) => m.id));
        visibleMonitors.value = allIds;
        saveVisibleMonitors(visibleMonitors.value);
      }
    },
    { immediate: true },
  );

  return {
    monitors: computed<MonitorListItem[]>(() => monitorsResponse.value?.monitors ?? []),
    groupedByClient,
    loading: computed(() => status.value === "pending"),
    hasError: computed(() => status.value === "error"),
    error,
    refresh,
    // Toggle state
    visibleMonitors,
    toggleMonitor,
    isVisible,
    showMonitor,
    hideMonitor,
  };
}
