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
</script>
