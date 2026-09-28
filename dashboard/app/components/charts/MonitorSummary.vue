<template>
  <div class="monitor-summary" data-testid="monitor-summary">
    <div class="summary-card">
      <span class="label">PACKET LOSS</span>
      <span class="value" :class="packetLossColor">{{ formatPercent(summary.packetLossPercent) }}%</span>
    </div>
    <div class="summary-card">
      <span class="label">AVG LATENCY</span>
      <span class="value">{{ formatMs(summary.averageLatencyMs) }} ms</span>
    </div>
    <div class="summary-card">
      <span class="label">MIN LATENCY</span>
      <span class="value">{{ formatMs(summary.minimumLatencyMs) }} ms</span>
    </div>
    <div class="summary-card">
      <span class="label">MAX LATENCY</span>
      <span class="value" :class="summary.maximumLatencyMs != null && summary.maximumLatencyMs > 300 ? 'danger' : ''">
        {{ formatMs(summary.maximumLatencyMs) }} ms
      </span>
    </div>
    <div class="summary-card">
      <span class="label">P95 LATENCY</span>
      <span class="value" :class="p95Color">
        {{ formatMs(summary.p95LatencyMs) }} ms
      </span>
    </div>
    <div class="summary-card">
      <span class="label">SAMPLES</span>
      <span class="value">{{ summary.sampleCount }}</span>
    </div>
    <div class="summary-card">
      <span class="label">STABLE</span>
      <span class="value accent">{{ formatPercent(summary.stablePercent) }}%</span>
    </div>
    <div class="summary-card">
      <span class="label">UNSTABLE</span>
      <span class="value" :class="summary.unstablePercent > 0 ? 'warning' : ''">
        {{ formatPercent(summary.unstablePercent) }}%
      </span>
    </div>
    <div class="summary-card">
      <span class="label">DISCONNECTED</span>
      <span class="value" :class="summary.disconnectedPercent > 0 ? 'danger' : ''">
        {{ formatPercent(summary.disconnectedPercent) }}%
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RangeSummary } from "#shared/types";
import { formatMs, formatPercent } from "~/utils/format";

const props = defineProps<{
  summary: RangeSummary;
}>();

const packetLossColor = computed(() => {
  if (props.summary.packetLossPercent === 0) return "accent";
  if (props.summary.packetLossPercent <= 5) return "warning";
  return "danger";
});

const p95Color = computed(() => {
  if (props.summary.p95LatencyMs == null) return "";
  if (props.summary.p95LatencyMs < 150) return "accent";
  if (props.summary.p95LatencyMs < 300) return "warning";
  return "danger";
});
</script>
