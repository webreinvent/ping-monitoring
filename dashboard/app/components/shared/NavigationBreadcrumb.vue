<template>
  <NuxtLink :to="to" class="breadcrumb" data-testid="breadcrumb">
    <svg class="breadcrumb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
    {{ label }}
  </NuxtLink>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    to?: string;
  }>(),
  {
    to: "/",
  },
);
</script>
