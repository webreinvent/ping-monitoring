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

      <SyncStatusIndicator :status="syncStatus" />

      <div class="page-heading" style="margin-top: 20px;">
        <h3>Sync Configuration</h3>
      </div>

      <SyncSettingsForm
        :client-slug="slug"
        :initial-settings="initialSettings"
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
      sync_enabled: number;
      sync_interval_min: number;
      backend_url: string;
    }>(`/api/clients/${slug.value}`);
  },
);

const loading = computed(() => status.value === "pending");

const syncStatus = computed<"connected" | "syncing" | "error" | "disabled">(
  () => {
    const d = clientData.value;
    if (!d) return "disabled";
    if (!d.sync_enabled) return "disabled";
    return "connected";
  },
);

const initialSettings = computed(() => {
  const d = clientData.value;
  return {
    sync_enabled: d ? !!d.sync_enabled : false,
    sync_interval_min: d ? d.sync_interval_min : 5,
    backend_url: d ? d.backend_url : "",
  };
});

useHead({
  title: computed(() => `Settings — ${clientData.value?.name ?? slug.value}`),
});
</script>
