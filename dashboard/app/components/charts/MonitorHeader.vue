<template>
  <div class="monitor-header">
    <div class="monitor-title">
      <h3>{{ targetName }}</h3>
      <span class="monitor-target">{{ targetHost }}</span>
    </div>
    <div class="monitor-meta">
      <div class="meta-item">
        <span class="meta-label">STATUS</span>
        <span class="meta-value">
          <StatusDot :quality-state="qualityState" />
          {{ qualityStateLabel }}
        </span>
      </div>
      <div v-if="latestLatency != null" class="meta-item">
        <span class="meta-label">LATEST</span>
        <span class="meta-value" :class="latencyColor">{{ latestLatency }} ms</span>
      </div>
      <div v-if="lastSeenMs != null" class="meta-item">
        <span class="meta-label">LAST SEEN</span>
        <span class="meta-value">{{ lastSeenRelative }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { QualityState } from "#shared/types";

interface Props {
  targetName: string;
  targetHost: string;
  qualityState: QualityState;
  latestLatency: number | null;
  lastSeenMs: number | null;
}

const props = defineProps<Props>();

const qualityStateLabel = computed(() => {
  const map: Record<QualityState, string> = {
    veryHigh: "Very High",
    high: "High",
    medium: "Medium",
    low: "Low",
    unstable: "Unstable",
    disconnected: "Disconnected",
    warmingUp: "Warming Up",
  };
  return map[props.qualityState] ?? "Unknown";
});

const latencyColor = computed(() => {
  if (props.latestLatency == null) return "";
  if (props.latestLatency < 50) return "accent";
  if (props.latestLatency < 150) return "warning";
  return "danger";
});

const lastSeenRelative = computed(() => {
  if (props.lastSeenMs == null) return "—";
  const diff = Date.now() - props.lastSeenMs;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
});
</script>
