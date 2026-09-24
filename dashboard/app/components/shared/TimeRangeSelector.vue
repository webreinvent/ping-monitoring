<template>
  <div class="time-range-selector" data-testid="time-range-selector">
    <button
      v-for="preset in presets"
      :key="preset"
      class="time-range-btn"
      :class="{ active: modelValue === preset }"
      @click="$emit('update:modelValue', preset)"
      :data-testid="`time-range-${preset}`"
    >
      {{ preset }}
    </button>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  modelValue: string;
  presets?: string[];
}>(), {
  presets: () => ["5m", "10m", "30m", "1h", "6h", "12h", "24h", "7d", "30d"],
});

defineEmits<{
  (e: "update:modelValue", preset: string): void;
}>();
</script>
