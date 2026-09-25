<template>
  <div data-testid="monitor-detail-page">
    <NavigationBreadcrumb label="All Monitors" to="/" />

    <div v-if="loading" class="detail-loading" aria-busy="true" aria-label="Loading monitor data">
      <div class="skeleton-header">
        <div class="skeleton-line skeleton-line--title" />
        <div class="skeleton-meta">
          <div class="skeleton-pill" />
          <div class="skeleton-line skeleton-line--short" />
        </div>
      </div>
      <div class="skeleton-chart" />
      <div class="skeleton-cards">
        <div v-for="i in 9" :key="i" class="skeleton-card" />
      </div>
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
        mode="bars"
        :height="320"
      />

      <MonitorSummary :summary="summary" />
    </template>

    <div v-else-if="hasError" class="detail-error" role="alert">
      <p>Failed to load monitor data.</p>
      <button type="button" class="retry-btn" @click="() => refreshHistory()">Try again</button>
    </div>
    <EmptyState v-else message="No data available for this monitor" />
  </div>
</template>

<script setup lang="ts">
import type { HistoryResponse, QualityState, RangeSummary } from "#shared/types";
import { transformToUPlotData } from "~/composables/useChartSeries";
import { aggregateLiveSamples } from "~/utils/live-aggregation";
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
const { data: historyData, status, refresh: refreshHistory } = useAsyncData<HistoryResponse>(
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
const hasError = computed(() => status.value === "error");

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

// Chart data — merge HTTP history with live WebSocket data
const chartData = computed(() => {
  // If live data is available for this monitor, use it — aggregated into
  // time-bucketed bars (mirrors the desktop chart's bar density).
  const live = liveData.value.get(monitorId.value);
  if (live && live.timestamps.length > 0) {
    return aggregateLiveSamples(live.timestamps, live.values);
  }
  // Fall back to HTTP-fetched data (server-side buckets). Latency column
  // only — bars mode renders no secondary axes.
  if (!historyData.value) return [new Float64Array(0)];
  const columns = transformToUPlotData(historyData.value);
  return [columns[0]!, columns[1]!];
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
