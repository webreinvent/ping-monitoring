<template>
  <div class="client-group" data-testid="client-group">
    <div class="client-group-header" @click="handleHeaderClick">
      <div class="client-name-area">
        <template v-if="isEditing">
          <div class="inline-edit">
            <input
              ref="editInputRef"
              v-model="editName"
              @keyup.enter="saveName"
              @keyup.escape="cancelEdit"
              aria-label="Edit client name"
              maxlength="100"
            />
            <div class="edit-actions">
              <button class="edit-btn save" @click="saveName" aria-label="Save name">
                ✓
              </button>
              <button class="edit-btn" @click="cancelEdit" aria-label="Cancel edit">
                ✕
              </button>
            </div>
          </div>
        </template>
        <template v-else>
          <span class="eyebrow">{{ displayName }}</span>
          <button
            class="edit-client-name-btn"
            @click.stop="startEdit"
            aria-label="Edit client name"
            title="Edit client name"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 3a2.828 2.828 0 0 1 4 4L7 21H3v-4L17 3z" />
            </svg>
          </button>
        </template>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <span class="client-count-badge">{{ monitors.length }}</span>
        <button
          class="client-delete-btn"
          @click.stop="handleDeleteClient"
          aria-label="Delete client"
          title="Delete client and all its monitors"
          data-testid="client-delete-btn"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
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
      <MonitorRow
        v-for="monitor in monitors"
        :key="monitor.id"
        :monitor="monitor"
        :visible="isVisible(monitor.id)"
        @toggle="handleToggle(monitor.id)"
        @delete="handleDelete(monitor)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MonitorListItem } from "#shared/types";

interface Props {
  clientName: string;
  clientSlug: string;
  monitors: MonitorListItem[];
  /** Function to check if a monitor is visible */
  isVisible: (id: number) => boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "toggle", monitorId: number): void;
  (e: "rename", slug: string, newName: string): void;
  (e: "delete", monitor: MonitorListItem): void;
  (
    e: "delete-client",
    slug: string,
    name: string,
    monitorCount: number,
  ): void;
}>();

const isExpanded = ref(true);
const isEditing = ref(false);
const editName = ref(props.clientName);
const editInputRef = ref<HTMLInputElement>();

// Optimistic display name
const displayName = computed(() => {
  if (isEditing.value) return editName.value;
  return props.clientName;
});

function handleHeaderClick(): void {
  if (isEditing.value) return;
  isExpanded.value = !isExpanded.value;
}

function startEdit(): void {
  isEditing.value = true;
  editName.value = props.clientName;
  // Focus input after next tick (DOM update)
  nextTick(() => {
    editInputRef.value?.focus();
    editInputRef.value?.select();
  });
}

function cancelEdit(): void {
  isEditing.value = false;
  editName.value = props.clientName;
}

async function saveName(): Promise<void> {
  const trimmed = editName.value.trim();
  if (!trimmed || trimmed.length > 100) {
    cancelEdit();
    return;
  }

  // Optimistic update: emit rename event for parent to handle
  emit("rename", props.clientSlug, trimmed);
  isEditing.value = false;
}

function handleToggle(monitorId: number): void {
  emit("toggle", monitorId);
}

function handleDelete(monitor: MonitorListItem): void {
  emit("delete", monitor);
}

function handleDeleteClient(): void {
  emit("delete-client", props.clientSlug, props.clientName, props.monitors.length);
}
</script>

<style scoped>
.client-delete-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 140ms ease, color 140ms ease, background 140ms ease;
}

.client-group-header:hover .client-delete-btn,
.client-delete-btn:focus-visible {
  opacity: 1;
}

.client-delete-btn:hover,
.client-delete-btn:focus-visible {
  color: var(--danger);
  background: var(--danger-soft);
  outline: none;
}
</style>
