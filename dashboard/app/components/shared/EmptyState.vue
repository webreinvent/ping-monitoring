<template>
  <div class="empty-state" data-testid="empty-state">
    <div class="empty-radar" />
    <strong>{{ message }}</strong>
    <p v-if="hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
/**
 * Presentational empty-state block (radar animation + title + optional hint).
 *
 * `message` is the headline; `hint` is an optional second line. The defaults
 * target the most common case (no monitors at all). Callers that have a more
 * specific reason (e.g. "no data in this time range", "client not found")
 * pass their own `message` and omit `hint`.
 */
withDefaults(defineProps<{ message?: string; hint?: string }>(), {
  message: "No monitors configured",
  hint: "",
});
</script>
