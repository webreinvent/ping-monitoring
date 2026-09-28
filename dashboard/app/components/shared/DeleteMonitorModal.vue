<template>
  <Teleport to="body">
    <div
      class="modal-backdrop"
      role="presentation"
      @click.self="cancel"
      @keyup.esc="cancel"
    >
      <div
        class="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="del-title"
        data-testid="delete-monitor-modal"
      >
        <h3 id="del-title" class="modal-title">Delete this monitor?</h3>
        <p class="modal-body">
          You're about to delete
          <strong>{{ monitor.targetName }}</strong>
          (<code>{{ monitor.targetHost }}</code>).
        </p>
        <p class="modal-warning">
          This will permanently remove all ping history, samples, and
          rollups for this monitor. This cannot be undone.
        </p>
        <div class="modal-actions">
          <button
            type="button"
            class="btn-secondary"
            @click="cancel"
            data-testid="delete-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn-danger"
            @click="confirm"
            :disabled="deleting"
            data-testid="delete-confirm"
          >
            {{ deleting ? "Deleting…" : "Delete monitor" }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import type { MonitorListItem } from "#shared/types";

const props = defineProps<{
  monitor: MonitorListItem;
}>();

const emit = defineEmits<{
  (e: "cancel"): void;
  (e: "confirm", monitor: MonitorListItem): void;
}>();

// Local "deleting" state — drives the disabled state on the confirm
// button. The parent owns the actual $fetch so the modal stays
// stateless about transport details.
const deleting = ref(false);

function cancel(): void {
  if (deleting.value) return;
  emit("cancel");
}

function confirm(): void {
  if (deleting.value) return;
  deleting.value = true;
  emit("confirm", props.monitor);
}

// Manage body scroll lock while the modal is open — prevents the page
// underneath from scrolling when the user is interacting with the dialog.
function onKeydown(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    cancel();
  }
}

onMounted(() => {
  if (typeof document !== "undefined") {
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeydown);
  }
});

onBeforeUnmount(() => {
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
    window.removeEventListener("keydown", onKeydown);
  }
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  display: grid;
  place-items: center;
  z-index: 9999;
  animation: fade-in 140ms ease;
}

.modal-panel {
  background: var(--panel);
  border: 1px solid var(--line-strong);
  border-radius: 14px;
  padding: 24px;
  max-width: 460px;
  width: calc(100vw - 32px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  color: var(--text);
  animation: pop-in 160ms ease;
}

.modal-title {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.modal-body {
  margin: 0 0 12px;
  color: var(--muted-strong);
  line-height: 1.5;
}

.modal-body code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.06);
  padding: 1px 6px;
  border-radius: 4px;
  color: var(--text);
}

.modal-warning {
  margin: 0 0 20px;
  padding: 10px 12px;
  border-left: 3px solid var(--danger);
  background: var(--danger-soft);
  border-radius: 4px;
  color: var(--danger);
  font-size: 13px;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-secondary,
.btn-danger {
  appearance: none;
  border: 1px solid var(--line-strong);
  background: transparent;
  color: var(--text);
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
}

.btn-secondary:hover,
.btn-secondary:focus-visible {
  background: rgba(255, 255, 255, 0.04);
  border-color: var(--muted);
  outline: none;
}

.btn-danger {
  background: var(--danger);
  color: #071016;
  border-color: var(--danger);
}

.btn-danger:hover:not(:disabled),
.btn-danger:focus-visible:not(:disabled) {
  background: #ff8590;
  border-color: #ff8590;
  outline: none;
}

.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes pop-in {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
</style>
