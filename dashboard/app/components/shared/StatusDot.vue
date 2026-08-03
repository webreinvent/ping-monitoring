<template>
  <span class="status-dot" :class="stateClass" data-testid="status-dot" />
</template>

<script setup lang="ts">
import type { QualityState } from "#shared/types";

interface Props {
  qualityState?: QualityState | null;
}

const props = defineProps<Props>();

const stateClass = computed(() => {
  const state = props.qualityState;
  if (!state) return "";
  return `state-${state}`;
});
</script>
