<template>
  <div class="client-group" data-testid="client-group">
    <div class="client-group-header" @click="toggle">
      <div>
        <span class="eyebrow">{{ clientName }}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <span class="client-count-badge">{{ monitors.length }}</span>
        <svg
          class="chevron-icon"
          :class="{ collapsed: !isExpanded }"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>
    <div v-if="isExpanded" class="target-list">
      <MonitorRow v-for="monitor in monitors" :key="monitor.id" :monitor="monitor" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MonitorListItem } from "#shared/types";

interface Props {
  clientName: string;
  monitors: MonitorListItem[];
}

defineProps<Props>();

const isExpanded = ref(true);

function toggle(): void {
  isExpanded.value = !isExpanded.value;
}
</script>
