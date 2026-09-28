<template>
  <div data-testid="client-settings-page">
    <NavigationBreadcrumb :label="clientData?.name ?? 'Client'" :to="`/clients/${slug}`" />

    <div v-if="loading" class="detail-loading">
      <span>Loading settings...</span>
    </div>

    <template v-else-if="clientData">
      <div class="page-heading">
        <h2>Settings</h2>
      </div>

      <!-- Sync Status Indicator -->
      <SyncStatusIndicator :status="syncStatus" />

      <!-- Client Identity (read-only) -->
      <div class="page-heading" style="margin-top: 20px;">
        <h3>Client Identity</h3>
      </div>

      <ClientIdentity :client="identityData" />

      <!-- Sync Configuration -->
      <div class="page-heading" style="margin-top: 20px;">
        <h3>Sync Configuration</h3>
      </div>

      <SyncSettingsForm
        :client-slug="slug"
        :initial-settings="initialSettings"
        @saved="handleSettingsSaved"
      />
    </template>

    <EmptyState v-else message="Client not found" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const slug = computed(() => String(route.params.slug));

// Fetch client data to get current settings
const { data: clientData, status } = useAsyncData(
  () => `client-settings-${slug.value}`,
  async () => {
    return await $fetch<{
      slug: string;
      name: string;
      username: string;
      hostname: string;
      mac_address: string;
      sync_enabled: number;
      sync_interval_min: number;
      backend_url: string;
      last_synced_at_ms: number | null;
    }>(`/api/clients/${slug.value}`);
  },
);

const loading = computed(() => status.value === "pending");

/** Computed sync status based on last_synced_at_ms and sync_interval_min */
const syncStatus = computed(() => {
  const d = clientData.value;
  if (!d) return "not_configured";

  if (!d.sync_enabled) {
    return "disabled";
  }

  if (d.last_synced_at_ms == null) {
    return "not_configured";
  }

  const now = Date.now();
  const threshold = 2 * d.sync_interval_min * 60000;
  if (now - d.last_synced_at_ms > threshold) {
    return "disconnected";
  }

  return "connected";
});

/** Read-only identity data extracted from client data */
const identityData = computed(() => {
  const d = clientData.value;
  if (!d) {
    return {
      slug: "",
      name: "",
      username: "",
      hostname: "",
      mac_address: "",
    };
  }
  return {
    slug: d.slug,
    name: d.name,
    username: d.username,
    hostname: d.hostname,
    mac_address: d.mac_address,
  };
});

/** Initial settings for the form */
const initialSettings = computed(() => {
  const d = clientData.value;
  return {
    sync_enabled: d ? !!d.sync_enabled : false,
    sync_interval_min: d ? d.sync_interval_min : 5,
    backend_url: d ? d.backend_url : "",
  };
});

/** Handle form saved event — refresh data */
async function handleSettingsSaved(): Promise<void> {
  // Re-fetch to get updated data
  await refreshNuxtData(`client-settings-${slug.value}`);
}

useHead({
  title: computed(() => `Settings — ${clientData.value?.name ?? slug.value}`),
});
</script>
