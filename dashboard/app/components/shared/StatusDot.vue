<template>
  <span class="status-dot" :class="stateClass" data-testid="status-dot" />
</template>

<script setup lang="ts">
import type { QualityState } from "#shared/types";

interface Props {
  qualityState?: QualityState | null;
  /**
   * No ping data received in the last 10s — overrides the quality-state
   * color with the stale (red) color, matching the Tauri app's
   * disconnected indicator.
   */
  stale?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  stale: false,
});

const stateClass = computed(() => {
  if (props.stale) return "state-stale";
  const state = props.qualityState;
  if (!state) return "";
  return `state-${state}`;
});
</script>
