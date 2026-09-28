import type { HistoryResponse } from "#shared/types";

/**
 * Fetch history data for a single monitor over a given time range.
 *
 * @param monitorId - The monitor ID
 * @param fromMs - Start of the time range in epoch ms (exclusive)
 * @param toMs - End of the time range in epoch ms (inclusive)
 * @param maxPoints - Maximum number of data points to return (default 2000)
 * @returns Composable result with data, status, error, and refresh
 */
export function useMonitorHistory(
  monitorId: number,
  fromMs: number,
  toMs: number,
  maxPoints: number = 2000,
) {
  const key = `monitor-history-${monitorId}-${fromMs}-${toMs}`;

  const { data, status, error, refresh } = useAsyncData<HistoryResponse>(
    key,
    async () => {
      const response = await $fetch<HistoryResponse>(`/api/monitors/${monitorId}`, {
        query: {
          fromMs,
          toMs,
          maxPoints: Math.min(maxPoints, 5000),
        },
      });
      return response;
    },
  );

  return {
    data,
    loading: computed(() => status.value === "pending"),
    hasError: computed(() => status.value === "error"),
    error,
    refresh,
  };
}
