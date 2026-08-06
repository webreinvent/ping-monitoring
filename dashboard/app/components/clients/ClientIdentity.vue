<template>
  <div class="client-info-card" data-testid="client-identity">
    <div class="client-info-field">
      <span class="field-label">SLUG</span>
      <span class="field-value">{{ client.slug }}</span>
    </div>
    <div class="client-info-field">
      <span class="field-label">NAME</span>
      <span class="field-value">{{ client.name }}</span>
    </div>
    <div class="client-info-field">
      <span class="field-label">USERNAME</span>
      <span class="field-value">{{ client.username }}</span>
    </div>
    <div class="client-info-field">
      <span class="field-label">HOSTNAME</span>
      <span class="field-value">{{ client.hostname }}</span>
    </div>
    <div class="client-info-field">
      <span class="field-label">MAC ADDRESS</span>
      <span class="field-value">{{ client.mac_address }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  client: {
    slug: string;
    name: string;
    username: string;
    hostname: string;
    mac_address: string;
  };
}

defineProps<Props>();
</script>
