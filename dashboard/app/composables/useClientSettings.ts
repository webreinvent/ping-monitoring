import type { ClientSettings, SyncStatus } from "#shared/types";

/**
 * Composable for fetching and updating client settings via the API.
 *
 * - fetchSettings(slug): GET /api/clients/:slug/settings
 * - updateSettings(slug, data): PUT with optimistic update + rollback on error
 * - Reactive settings, loading, error state
 * - Brief "syncing..." transient after update
 */
export function useClientSettings() {
  const settings = ref<ClientSettings | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  /**
   * Fetch settings for a client by slug.
   */
  async function fetchSettings(slug: string): Promise<ClientSettings | null> {
    loading.value = true;
    error.value = null;

    try {
      const data = await $fetch<ClientSettings>(`/api/clients/${slug}/settings`);
      settings.value = data;
      return data;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch settings";
      error.value = message;
      return null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Update settings with optimistic update and rollback on error.
   * Sets sync_status to "syncing" briefly after successful update.
   */
  async function updateSettings(
    slug: string,
    data: {
      sync_enabled: boolean;
      sync_interval_min: number;
      backend_url: string;
    },
  ): Promise<boolean> {
    if (!settings.value) {
      error.value = "Settings not loaded. Call fetchSettings first.";
      return false;
    }

    // Save current state for rollback
    const previousSettings = { ...settings.value };

    // Optimistic update
    settings.value = {
      ...settings.value,
      sync_enabled: data.sync_enabled,
      sync_interval_min: data.sync_interval_min,
      backend_url: data.backend_url,
      sync_status: "syncing" as SyncStatus,
    };

    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{
        sync_enabled: boolean;
        sync_interval_min: number;
        backend_url: string;
        last_synced_at_ms: number | null;
        updated_at: string;
      }>(`/api/clients/${slug}/settings`, {
        method: "PUT",
        body: data,
      });

      // Update with server response
      settings.value = {
        ...settings.value,
        sync_enabled: response.sync_enabled,
        sync_interval_min: response.sync_interval_min,
        backend_url: response.backend_url,
        last_synced_at_ms: response.last_synced_at_ms,
        updated_at: response.updated_at,
        sync_status: data.sync_enabled
          ? ("connected" as SyncStatus)
          : ("disabled" as SyncStatus),
      };

      // Reset syncing state after a brief delay
      setTimeout(() => {
        if (settings.value) {
          settings.value.sync_status = data.sync_enabled
            ? ("connected" as SyncStatus)
            : ("disabled" as SyncStatus);
        }
      }, 2000);

      return true;
    } catch (err) {
      // Rollback on error
      settings.value = previousSettings;
      const message =
        err instanceof Error ? err.message : "Failed to update settings";
      error.value = message;
      return false;
    } finally {
      loading.value = false;
    }
  }

  return {
    settings,
    loading,
    error,
    fetchSettings,
    updateSettings,
  };
}
