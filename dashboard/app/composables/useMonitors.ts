import type { MonitorListItem, MonitorsListResponse } from "#shared/types";

interface MonitorGroup {
  clientSlug: string;
  clientName: string;
  monitors: MonitorListItem[];
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

  return {
    monitors: computed<MonitorListItem[]>(() => monitorsResponse.value?.monitors ?? []),
    groupedByClient,
    loading: computed(() => status.value === "pending"),
    hasError: computed(() => status.value === "error"),
    error,
    refresh,
  };
}
