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
      <ClientOnly>
        <button
          class="monitor-toggle"
          :class="{ checked: visible }"
          @click.stop.prevent="emitToggle"
          :aria-label="visible ? 'Hide in chart' : 'Show in chart'"
          :aria-pressed="visible"
        />
        <template #fallback>
          <button
            class="monitor-toggle"
            aria-label="Show in chart"
            aria-pressed="true"
          />
        </template>
      </ClientOnly>
      <StatusDot :quality-state="monitor.qualityState" />
      <div class="target-copy">
        <strong>{{ monitor.targetName }}</strong>
        <small>{{ monitor.targetHost }}</small>
      </div>
      <span v-if="monitor.latencyMs != null" class="target-latency">
        {{ monitor.latencyMs }} ms
      </span>
      <button
        class="monitor-delete-btn"
        @click.stop.prevent="emitDelete"
        aria-label="Delete monitor"
        title="Delete monitor"
        data-testid="monitor-delete-btn"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
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
  (e: "delete"): void;
}>();

const route = useRoute();
const selected = computed(() => route.path.startsWith(`/monitors/${props.monitor.id}`));

function emitToggle(): void {
  emit("toggle");
}

function emitDelete(): void {
  emit("delete");
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
  grid-template-columns: 16px 12px minmax(0, 1fr) auto auto;
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

/* Delete (trash) button — hidden until row hover or focus-within,
   to keep the sidebar visually clean. Mirrors the pencil-button pattern
   on ClientGroup.vue. */
.monitor-delete-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 140ms ease, color 140ms ease, background 140ms ease;
}

.monitor-row:hover .monitor-delete-btn,
.monitor-row:focus-within .monitor-delete-btn {
  opacity: 1;
}

.monitor-delete-btn:hover,
.monitor-delete-btn:focus-visible {
  color: var(--danger);
  background: var(--danger-soft);
  outline: none;
}
</style>
