<template>
  <NuxtLink
    :to="`/monitors/${monitor.id}`"
    class="monitor-row"
    :class="{ selected }"
    data-testid="monitor-row"
  >
    <StatusDot :quality-state="monitor.qualityState" />
    <div class="target-copy">
      <strong>{{ monitor.targetName }}</strong>
      <small>{{ monitor.targetHost }}</small>
    </div>
    <span v-if="monitor.latencyMs != null" class="target-latency">
      {{ monitor.latencyMs }} ms
    </span>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { MonitorListItem } from "#shared/types";

interface Props {
  monitor: MonitorListItem;
}

const props = defineProps<Props>();

const route = useRoute();
const selected = computed(() => route.path.startsWith(`/monitors/${props.monitor.id}`));
</script>
