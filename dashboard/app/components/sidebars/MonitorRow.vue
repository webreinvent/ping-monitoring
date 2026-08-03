<template>
  <div
    class="monitor-row-wrapper"
    :class="{ dimmed: !visible }"
    data-testid="monitor-row-wrapper"
  >
    <NuxtLink
      :to="`/monitors/${monitor.id}`"
      class="monitor-row"
      :class="{ selected }"
      data-testid="monitor-row"
      @click.prevent="handleClick"
    >
      <button
        class="monitor-toggle"
        :class="{ checked: visible }"
        @click.stop="emitToggle"
        :aria-label="visible ? 'Hide in chart' : 'Show in chart'"
        :aria-pressed="visible"
      />
      <StatusDot :quality-state="monitor.qualityState" />
      <div class="target-copy">
        <strong>{{ monitor.targetName }}</strong>
        <small>{{ monitor.targetHost }}</small>
      </div>
      <span v-if="monitor.latencyMs != null" class="target-latency">
        {{ monitor.latencyMs }} ms
      </span>
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import type { MonitorListItem } from "#shared/types";

interface Props {
  monitor: MonitorListItem;
  /** Whether this monitor is visible in the chart */
  visible?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  visible: true,
});

const emit = defineEmits<{
  (e: "toggle"): void;
}>();

const route = useRoute();
const selected = computed(() => route.path.startsWith(`/monitors/${props.monitor.id}`));

function emitToggle(): void {
  emit("toggle");
}

function handleClick(): void {
  navigateTo(`/monitors/${props.monitor.id}`);
}
</script>

<style scoped>
.monitor-row-wrapper {
  display: flex;
}

.monitor-row-wrapper.dimmed {
  opacity: 0.35;
}

.monitor-row {
  display: grid;
  width: 100%;
  min-width: 0;
  min-height: 54px;
  align-items: center;
  margin: 2px 0;
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 8px 10px;
  grid-template-columns: 16px 12px minmax(0, 1fr) auto;
  gap: 8px;
  color: var(--text);
  background: transparent;
  cursor: pointer;
  transition: 140ms ease;
  text-decoration: none;
}

.monitor-row:focus-visible {
  outline: 2px solid rgba(69, 223, 194, 0.55);
  outline-offset: -2px;
}

.monitor-row:hover {
  border-color: var(--line);
  background: rgba(255, 255, 255, 0.025);
}

.monitor-row.selected {
  border-color: rgba(69, 223, 194, 0.18);
  background: linear-gradient(90deg, rgba(69, 223, 194, 0.12), rgba(69, 223, 194, 0.025));
}
</style>
