<template>
  <form class="settings-form" @submit.prevent="handleSubmit" data-testid="settings-form">
    <div class="form-group">
      <label for="sync-enabled">Enable Sync</label>
      <select id="sync-enabled" v-model="form.sync_enabled">
        <option :value="true">Enabled</option>
        <option :value="false">Disabled</option>
      </select>
    </div>

    <div v-if="form.sync_enabled" class="form-group">
      <label for="sync-interval">Sync Interval</label>
      <select id="sync-interval" v-model="form.sync_interval_min">
        <option v-for="interval in allowedIntervals" :key="interval" :value="interval">
          {{ interval }} minute{{ interval > 1 ? 's' : '' }}
        </option>
      </select>
    </div>

    <div v-if="form.sync_enabled" class="form-group">
      <label for="backend-url">Backend URL</label>
      <input
        id="backend-url"
        v-model="form.backend_url"
        type="url"
        placeholder="https://example.com/api"
        :class="{ error: urlError }"
      />
      <span v-if="urlError" class="form-error">{{ urlError }}</span>
    </div>

    <div class="form-actions">
      <button type="submit" class="btn-primary" :disabled="saving">
        {{ saving ? 'Saving...' : 'Save' }}
      </button>
      <button type="button" class="btn-secondary" @click="handleCancel" :disabled="saving">
        Cancel
      </button>
    </div>

    <div v-if="success" class="form-success">
      Settings saved successfully.
    </div>
    <div v-if="error" class="form-error">
      {{ error }}
    </div>
  </form>
</template>

<script setup lang="ts">
interface Props {
  /** Client slug to identify the client */
  clientSlug: string;
  /** Current sync settings */
  initialSettings: {
    sync_enabled: boolean;
    sync_interval_min: number;
    backend_url: string;
  };
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "saved"): void;
}>();

/** Allowed sync intervals in minutes (per F9 spec) */
const allowedIntervals = [1, 5, 10, 15, 30, 60];

// Form state
const form = ref({ ...props.initialSettings });
const saving = ref(false);
const success = ref(false);
const error = ref<string | null>(null);

/** Validate the backend URL — allows HTTPS or HTTP for localhost */
const urlError = computed(() => {
  const url = form.value.backend_url.trim();
  if (!form.value.sync_enabled) return null;
  if (!url) return "Backend URL is required";
  try {
    const parsed = new URL(url);
    const isHttp = parsed.protocol === "http:";
    const isLocalhost =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1" ||
      parsed.hostname === "[::1]";
    if (parsed.protocol !== "https:" && !(isHttp && isLocalhost)) {
      return "Backend URL must use HTTPS";
    }
  } catch {
    return "Invalid URL format";
  }
  return null;
});

async function handleSubmit(): Promise<void> {
  if (urlError.value) return;

  saving.value = true;
  error.value = null;
  success.value = false;

  try {
    await $fetch(`/api/clients/${props.clientSlug}/settings`, {
      method: "PUT",
      body: {
        sync_enabled: form.value.sync_enabled,
        sync_interval_min: form.value.sync_interval_min,
        backend_url: form.value.backend_url,
      },
    });
    success.value = true;
    emit("saved");
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to save settings";
  } finally {
    saving.value = false;
  }
}

function handleCancel(): void {
  form.value = { ...props.initialSettings };
  error.value = null;
  success.value = false;
}
</script>
