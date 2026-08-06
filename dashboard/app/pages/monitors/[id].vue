<template>
  <div data-testid="monitor-detail-page">
    <NavigationBreadcrumb label="All Monitors" to="/" />

    <div v-if="loading" class="detail-loading">
      <span>Loading monitor data...</span>
    </div>

    <template v-else-if="historyData">
      <MonitorHeader
        :target-name="targetName"
        :target-host="targetHost"
        :quality-state="qualityState"
        :latest-latency="latestLatency"
        :last-seen-ms="lastSeenMs"
      />

      <div class="page-heading">
        <h3>Latency Over Time</h3>
        <TimeRangeSelector
          v-model="timeWindow"
          data-testid="time-range-selector"
        />
      </div>

      <LatencyChart
        :data="chartData"
        :series-config="[
          {
            label: targetName,
            stroke: '#3b82f6',
            width: 1.5,
            points: { show: false },
          },
        ]"
        :quality-bands="qualityBands"
        :threshold-value="thresholdMs"
        :height="320"
      />

      <MonitorSummary :summary="summary" />
    </template>

    <EmptyState v-else message="No data available for this monitor" />
  </div>
</template>

<script setup lang="ts">
import type { HistoryResponse, QualityState, RangeSummary } from "#shared/types";
import { transformToUPlotData } from "~/composables/useChartSeries";
import { getQualityBandPaths } from "~/utils/quality-bands";
import { onBeforeUnmount } from "vue";

const route = useRoute();
const monitorId = computed(() => Number(route.params.id));
const { selectedPreset: timeWindow, fromMs, toMs } = useTimeWindow();

// Redirect to / if monitor ID is invalid
if (monitorId.value <= 0) {
  navigateTo("/");
}

// Fetch history data — reactive to time window changes via key
// Use preset as the key (not fromMs/toMs which use Date.now() and would change constantly)
const { data: historyData, status } = useAsyncData<HistoryResponse>(
  () => `monitor-detail-${monitorId.value}-${timeWindow.value}`,
  async () => {
    return await $fetch<HistoryResponse>(`/api/monitors/${monitorId.value}`, {
      query: {
        fromMs: fromMs.value,
        toMs: toMs.value,
        maxPoints: 2000,
      },
    });
  },
);

const loading = computed(() => status.value === "pending");

// Extract data from history response
const targetName = computed(() => {
  const seriesArr = historyData.value?.series ?? [];
  return seriesArr[0]?.target?.name ?? "Unknown";
});

const targetHost = computed(() => {
  const seriesArr = historyData.value?.series ?? [];
  return seriesArr[0]?.target?.host ?? "";
});

const qualityState = computed<QualityState>(() => {
  const seriesArr = historyData.value?.series ?? [];
  return (seriesArr[0]?.target?.qualityState ?? "warmingUp") as QualityState;
});

const defaultSummary: RangeSummary = {
  sampleCount: 0,
  successCount: 0,
  failureCount: 0,
  packetLossPercent: 0,
  averageLatencyMs: null,
  minimumLatencyMs: null,
  maximumLatencyMs: null,
  p95LatencyMs: null,
  stableMs: 0,
  unstableMs: 0,
  disconnectedMs: 0,
  stablePercent: 0,
  unstablePercent: 0,
  disconnectedPercent: 0,
};

const summary = computed<RangeSummary>(() => {
  const seriesArr = historyData.value?.series ?? [];
  return seriesArr[0]?.summary ?? defaultSummary;
});

const latestLatency = computed<number | null>(() => {
  const seriesArr = historyData.value?.series ?? [];
  const points = seriesArr[0]?.points ?? [];
  if (points.length === 0) return null;
  const lastPoint = points[points.length - 1];
  return lastPoint?.averageLatencyMs ?? null;
});

const lastSeenMs = computed<number | null>(() => {
  const seriesArr = historyData.value?.series ?? [];
  const points = seriesArr[0]?.points ?? [];
  if (points.length === 0) return null;
  return points[points.length - 1]?.timestampMs ?? null;
});

const thresholdMs = computed<number | null>(() => {
  const seriesArr = historyData.value?.series ?? [];
  return seriesArr[0]?.target?.thresholds?.p95LatencyMs ?? null;
});

const qualityBands = computed(() => {
  const seriesArr = historyData.value?.series ?? [];
  const intervals = seriesArr[0]?.intervals ?? [];
  return getQualityBandPaths(intervals);
});

// Chart data — merge HTTP history with live WebSocket data
const chartData = computed(() => {
  // If live data is available for this monitor, use it
  const live = liveData.value.get(monitorId.value);
  if (live && live.timestamps.length > 0) {
    // uPlot format: [timeColumn, valueColumn]
    return [live.timestamps, live.values];
  }
  // Fall back to HTTP-fetched data
  if (!historyData.value) return [new Float64Array(0)];
  return transformToUPlotData(historyData.value);
});

// Live chart integration
const { subscribe, liveData, onUpdate } = useLiveChart();

// Subscribe to this monitor's live feed
watch(monitorId, (id) => {
  if (id > 0) {
    subscribe(id);
  }
}, { immediate: true });

const chartRef = ref<{ updateChart: () => void } | null>(null);

function triggerChartUpdate(): void {
  if (chartRef.value) {
    chartRef.value.updateChart();
  }
}

onUpdate(triggerChartUpdate);

onBeforeUnmount(() => {
  // Cleanup handled by useLiveChart's onScopeDispose
});

useHead({
  title: computed(() => `Monitor — ${targetName.value}`),
});
</script>
