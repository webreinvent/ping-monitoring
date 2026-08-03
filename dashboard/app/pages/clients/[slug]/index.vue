<template>
  <div data-testid="client-overview-page">
    <NavigationBreadcrumb label="All Monitors" to="/" />

    <div v-if="loading" class="detail-loading">
      <span>Loading client data...</span>
    </div>

    <template v-else-if="clientData">
      <div class="page-heading">
        <h2>{{ clientData.name }}</h2>
      </div>

      <ClientInfo :client="clientData" />

      <div class="page-heading">
        <h3>Monitors</h3>
      </div>

      <ClientMonitors :monitors="clientMonitors" />
    </template>

    <EmptyState v-else message="Client not found" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const slug = computed(() => String(route.params.slug));

// Fetch client data
const { data: clientData, status } = useAsyncData(
  () => `client-${slug.value}`,
  async () => {
    return await $fetch<{
      name: string;
      slug: string;
      username: string;
      hostname: string;
      mac_address: string;
    }>(`/api/clients/${slug.value}`);
  },
);

const loading = computed(() => status.value === "pending");

// Get monitors for this client
const { monitors } = useMonitors();
const clientMonitors = computed(() => {
  return monitors.value.filter((m) => m.clientSlug === slug.value);
});

useHead({
  title: computed(() => `Client — ${clientData.value?.name ?? slug.value}`),
});
</script>
