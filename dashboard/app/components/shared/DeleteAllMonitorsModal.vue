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
        aria-labelledby="del-all-title"
        data-testid="delete-all-monitors-modal"
      >
        <h3 id="del-all-title" class="modal-title">Delete all monitors?</h3>
        <p class="modal-body">
          You're about to delete <strong>all {{ monitorCount }}</strong>
          {{ monitorCount === 1 ? "monitor" : "monitors" }} across
          <strong>{{ clientCount }}</strong>
          {{ clientCount === 1 ? "client" : "clients" }}.
        </p>
        <p class="modal-warning">
          This will permanently remove every monitor, all ping history,
          samples, and rollups. This cannot be undone.
        </p>
        <div class="modal-actions">
          <button
            type="button"
            class="btn-secondary"
            @click="cancel"
            data-testid="delete-all-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn-danger"
            @click="confirm"
            :disabled="deleting"
            data-testid="delete-all-confirm"
          >
            {{ deleting ? "Deleting…" : "Delete all monitors" }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";

defineProps<{
  monitorCount: number;
  clientCount: number;
}>();

const emit = defineEmits<{
  (e: "cancel"): void;
  (e: "confirm"): void;
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
  emit("confirm");
}

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
