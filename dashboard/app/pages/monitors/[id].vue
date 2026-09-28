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
        ref="chartRef"
        :data="chartData"
        mode="bars"
        :height="320"
        :window-sec="liveWindowSec"
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
const { selectedPreset: timeWindow, currentWindow } = useTimeWindow();

// Redirect to / if monitor ID is invalid
if (monitorId.value <= 0) {
  navigateTo("/");
}

// Fetch history data — reactive to time window changes via key
// Use preset as the key (not fromMs/toMs which use Date.now() and would change constantly)
// Async-data key — stable (preset-identity based, never Date.now()-based).
const asyncKey = computed(() => `monitor-detail-${monitorId.value}-${timeWindow.value}`);

const { data: historyData, status, refresh: refreshHistory } = useAsyncData<HistoryResponse>(
  asyncKey,
  async () => {
    // Window resolved at fetch time (never a value cached at mount).
    const w = currentWindow();
    return await $fetch<HistoryResponse>(`/api/monitors/${monitorId.value}`, {
      query: {
        fromMs: w.fromMs,
        toMs: w.toMs,
        maxPoints: 2000,
      },
    });
  },
);

// Skeleton only on initial loads (no data yet) — during any refresh,
// previously fetched data stays visible and swaps in atomically.
const loading = computed(() => status.value === "pending" && !historyData.value);
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

// Trailing-window slice over ascending live timestamps: scan backward from
// the newest point until the window start is crossed — O(window), not
// O(retention). Returns the original arrays when everything is in-window.
function sliceTrailingWindow(
  ts: Float64Array,
  vals: Float64Array,
  fromMs: number,
): [Float64Array, Float64Array] {
  let start = ts.length;
  for (let i = ts.length - 1; i >= 0; i--) {
    if (ts[i]! * 1000 >= fromMs) {
      start = i;
    } else {
      break;
    }
  }
  if (start === 0) return [ts, vals];
  return [ts.slice(start), vals.slice(start)];
}

// Chart data — live client stream first, HTTP history as fallback/context.
// Real-time: retained live points are sliced to the active preset's trailing
// window (single-sourced via the time-window composable — `live` ⇒ trailing
// 60 s) before bucket aggregation, and every incoming sample re-renders via
// the rAF-debounced update cycle below. Without a client stream there is no
// real-time data to show; the last received frame holds until the stream
// reconnects (the WebSocket client auto-reconnects with backoff).
// Trailing-window anchor: the newest received sample when live, else null.
// There is always a few seconds of lag between a ping being sent and its
// sample arriving over the wire (the client syncs in batches); anchoring the
// window to wall-clock now would leave a blank right-edge band exactly as
// wide as that lag. Anchoring to the newest sample keeps bars flush against
// the right edge — matching the desktop app. Non-live presets keep the
// wall-clock window; at their span the lag is visually negligible.
const liveAnchorMs = computed<number | null>(() => {
  if (timeWindow.value !== "live") return null;
  const live = liveData.value.get(monitorId.value);
  if (!live || live.timestamps.length === 0) return null;
  return live.timestamps[live.timestamps.length - 1]! * 1000;
});

const chartData = computed(() => {
  const live = liveData.value.get(monitorId.value);
  if (live && live.timestamps.length > 0) {
    const { fromMs, toMs } = currentWindow();
    const anchor = liveAnchorMs.value;
    const sliceFromMs = anchor != null ? anchor - (toMs - fromMs) : fromMs;
    return aggregateLiveSamples(...sliceTrailingWindow(live.timestamps, live.values, sliceFromMs));
  }
  // Fall back to HTTP-fetched data (server-side buckets). Latency column
  // only — bars mode renders no secondary axes.
  if (!historyData.value) return [new Float64Array(0)];
  const columns = transformToUPlotData(historyData.value);
  return [columns[0]!, columns[1]!];
});

// Live-mode x-window bounds in seconds [min, max]: the trailing 60s window
// anchored at the newest received sample (see `liveAnchorMs`), so the right
// edge tracks incoming data instead of wall-clock now. Other presets leave
// `windowSec` undefined so the X-axis spans the actual data bounds
// (HTTP-fetched history).
const liveWindowSec = computed<[number, number] | undefined>(() => {
  const anchor = liveAnchorMs.value;
  if (anchor == null) return undefined;
  const { fromMs, toMs } = currentWindow();
  const widthMs = toMs - fromMs;
  return [(anchor - widthMs) / 1000, anchor / 1000];
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
