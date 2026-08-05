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

interface Props {
  /** Monitors to display on the chart */
  monitors: MonitorListItem[];
}

const props = defineProps<Props>();

// Monitor visibility toggle state
const { toggleMonitor, isVisible } = useMonitors();

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

// Combine all monitor data into uPlot format — only include visible monitors
const chartData = computed(() => {
  const entries = [...monitorData.value.entries()].filter(([id]) => isVisible(id));
  if (entries.length === 0) return [new Float64Array(0)];

  // Merge all timestamps into a single time axis
  const allTimestampsSet = new Set<number>();
  for (const [, { timestamps }] of entries) {
    for (let i = 0; i < timestamps.length; i++) {
      allTimestampsSet.add(timestamps[i] as number);
    }
  }

  // Sort timestamps
  const sortedTimestamps = [...allTimestampsSet].sort((a, b) => a - b);
  const len = sortedTimestamps.length;

  // Build merged time column
  const mergedTime = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    mergedTime[i] = sortedTimestamps[i] as number;
  }

  // Build series columns — order must match seriesConfig
  const seriesColumns: Float64Array[] = [];
  for (const [id, { timestamps, values }] of entries) {
    // Build lookup: timestamp -> index in original arrays
    const timeIndex = new Map<number, number>();
    for (let i = 0; i < timestamps.length; i++) {
      timeIndex.set(timestamps[i] as number, i);
    }

    const col = new Float64Array(len);
    for (let i = 0; i < len; i++) {
      const ts = sortedTimestamps[i] as number;
      const idx = timeIndex.get(ts);
      col[i] = idx !== undefined ? (values[idx] as number) : NaN;
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

const chartRef = ref<null | unknown>(null);
</script>
