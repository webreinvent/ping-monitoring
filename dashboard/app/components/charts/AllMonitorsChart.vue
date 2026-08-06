<template>
  <div class="chart-container" data-testid="all-monitors-chart">
    <EmptyState v-if="hasNoData" message="No data to display" />
    <LatencyChart
      v-else
      :data="chartData"
      :series-config="seriesConfig"
      :threshold-values="[50, 100, 150, 200]"
      :height="320"
      ref="chartRef"
    />
    <div v-if="monitorLabels.length > 0" class="chart-legend">
      <div
        v-for="item in monitorLabels"
        :key="item.id"
        class="chart-legend-item"
        :class="{ 'chart-legend-item--hidden': !isVisible(item.id) }"
        role="button"
        tabindex="0"
        :aria-pressed="isVisible(item.id) ? 'true' : 'false'"
        :aria-label="'Toggle ' + item.name"
        @click="toggleMonitor(item.id)"
        @keydown.enter.prevent="toggleMonitor(item.id)"
        @keydown.space.prevent="toggleMonitor(item.id)"
      >
        <span class="legend-color" :style="{ background: item.color }" />
        <span>{{ item.name }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MonitorListItem, HistoryResponse } from "#shared/types";
import { getPaletteColor } from "~/composables/useDashboardPalette";
import { transformPointsToUPlotSeries } from "~/composables/useChartSeries";
import { onBeforeUnmount } from "vue";

interface Props {
  /** Monitors to display on the chart */
  monitors: MonitorListItem[];
}

const props = defineProps<Props>();

// Monitor visibility toggle state
const { toggleMonitor, isVisible } = useMonitors();

// Live chart integration
const { subscribe, unsubscribe, isSubscribed, liveData, onUpdate, offUpdate } = useLiveChart();

// Fetch history for each monitor
const monitorData = ref<Map<number, { timestamps: Float64Array; values: Float64Array }>>(new Map());
const monitorLabels = ref<{ id: number; name: string; color: string }[]>([]);
const hasNoData = ref(true);

// Build series config from palette — only include visible monitors
// Use original index for stable color assignment (colors don't shift when toggling)
const seriesConfig = computed(() => {
  return props.monitors
    .filter((m) => isVisible(m.id))
    .map((m) => {
      const originalIndex = props.monitors.indexOf(m);
      return {
        label: m.targetName,
        stroke: getPaletteColor(originalIndex),
        width: 1.5,
        points: {
          show: false,
        },
      };
    });
});

// Fetch history for all monitors
async function fetchAllHistory(): Promise<void> {
  if (props.monitors.length === 0) {
    hasNoData.value = true;
    monitorData.value = new Map();
    monitorLabels.value = [];
    return;
  }

  const windowFromMs = fromMs.value;
  const windowToMs = toMs.value;
  const data = new Map<number, { timestamps: Float64Array; values: Float64Array }>();

  const promises = props.monitors.map(async (m) => {
    try {
      const history = await $fetch<HistoryResponse>(
        `/api/monitors/${m.id}`,
        {
          query: { fromMs: windowFromMs, toMs: windowToMs, maxPoints: 2000 },
        },
      );

      const seriesArr = history.series ?? [];
      const series = seriesArr[0];
      if (series && series.points.length > 0) {
        const [timestamps, values] = transformPointsToUPlotSeries(series.points);
        if (timestamps.length > 0) {
          data.set(m.id, { timestamps, values });
        }
      }
    } catch {
      // Skip monitors with fetch errors
    }
  });

  await Promise.allSettled(promises);
  monitorData.value = data;
  hasNoData.value = data.size === 0;

  // Build labels — preserve original palette index
  monitorLabels.value = props.monitors.map((m, i) => ({
    id: m.id,
    name: m.targetName,
    color: getPaletteColor(i),
  }));
}

const { fromMs, toMs, selectedPreset } = useTimeWindow();

// Combine all monitor data into uPlot format — one column per visible monitor.
// Column count MUST match `seriesConfig.length`; monitors with no data get a
// NaN-filled column. NaN values are ignored by uPlot's auto-scaler and the
// series is still drawn (a flat invisible line, which is fine).
const chartData = computed(() => {
  const visible = props.monitors.filter((m) => isVisible(m.id));
  if (visible.length === 0) return [new Float64Array(0)];

  type Entry = { timestamps: Float64Array; values: Float64Array };
  const dataByMonitor = new Map<number, Entry>();
  for (const m of visible) {
    const entry = liveData.value.get(m.id) ?? monitorData.value.get(m.id);
    if (entry) dataByMonitor.set(m.id, entry);
  }

  // Merge all timestamps into a single time axis
  const allTimestampsSet = new Set<number>();
  for (const entry of dataByMonitor.values()) {
    for (let i = 0; i < entry.timestamps.length; i++) {
      allTimestampsSet.add(entry.timestamps[i] as number);
    }
  }

  if (allTimestampsSet.size === 0) return [new Float64Array(0)];

  const sortedTimestamps = [...allTimestampsSet].sort((a, b) => a - b);
  const len = sortedTimestamps.length;

  const mergedTime = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    mergedTime[i] = sortedTimestamps[i] as number;
  }

  // Build one column per visible monitor — always aligned with seriesConfig
  const seriesColumns: Float64Array[] = [];
  for (const m of visible) {
    const entry = dataByMonitor.get(m.id);
    if (!entry) {
      seriesColumns.push(new Float64Array(len).fill(NaN));
      continue;
    }
    const timeIndex = new Map<number, number>();
    for (let i = 0; i < entry.timestamps.length; i++) {
      timeIndex.set(entry.timestamps[i] as number, i);
    }
    const col = new Float64Array(len);
    for (let i = 0; i < len; i++) {
      const ts = sortedTimestamps[i] as number;
      const idx = timeIndex.get(ts);
      col[i] = idx !== undefined ? (entry.values[idx] as number) : NaN;
    }
    seriesColumns.push(col);
  }

  return [mergedTime, ...seriesColumns];
});

// Fetch on mount and when monitors or time window change
watch(
  () => [props.monitors.map((m) => m.id).join(","), selectedPreset.value],
  async () => {
    await fetchAllHistory();
  },
  { immediate: true },
);

// Auto-subscribe to visible monitors when monitor list changes
watch(
  () => props.monitors.map((m) => m.id).join(","),
  (newIds) => {
    const ids = newIds.split(",").map(Number);
    for (const id of ids) {
      if (isVisible(id) && !isSubscribed(id)) {
        subscribe(id);
      }
    }
  },
  { immediate: true },
);

// Register the update callback to push live data into the chart
const chartRef = ref<{ updateChart: () => void } | null>(null);

function triggerChartUpdate(): void {
  if (chartRef.value) {
    chartRef.value.updateChart();
  }
}

onUpdate(triggerChartUpdate);

// Also push chart updates whenever computed data changes — covers the case
// where HTTP history loads asynchronously after the chart was first created.
watch(chartData, () => {
  triggerChartUpdate();
}, { flush: "post" });

// Cleanup on unmount
onBeforeUnmount(() => {
  offUpdate(triggerChartUpdate);
});
</script>
