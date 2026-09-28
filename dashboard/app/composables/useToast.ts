/**
 * Singleton toast composable for transient user feedback.
 *
 * Mirrors the Tauri app's `showToast()` API so the dashboard's UX
 * matches the desktop app: 4.5s auto-dismiss, slide-up fade-in, success
 * and error variants.
 *
 * Mount a `<div id="toast-stack">` once at the layout root
 * (see `app/layouts/default.vue`) — `showToast()` appends children into
 * that container.
 */

export type ToastKind = "success" | "error";

/**
 * Append a toast to the global toast stack.
 *
 * @param message — Human-readable text to display
 * @param kind    — `success` or `error` (controls border accent)
 */
export function showToast(message: string, kind: ToastKind = "success"): void {
  // Guarded for SSR — the toast stack only exists in the browser.
  if (typeof document === "undefined") return;

  const stack = document.querySelector<HTMLDivElement>("#toast-stack");
  if (!stack) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${kind}`;
  toast.textContent = message;
  toast.setAttribute("role", kind === "error" ? "alert" : "status");
  stack.append(toast);

  // Trigger the slide-in/fade-in transition on the next frame so the
  // initial `opacity: 0` + `translateY(7px)` baseline is observable.
  window.setTimeout(() => toast.classList.add("visible"), 10);

  // Auto-dismiss after 4.5s; the visible-class removal triggers the
  // fade-out animation, then the element is removed from the DOM.
  window.setTimeout(() => {
    toast.classList.remove("visible");
    window.setTimeout(() => toast.remove(), 240);
  }, 4_500);
}

/**
 * Format a fetch/Error/H3 error into a human-readable message.
 *
 * Pulls the most informative string out of: `data.message`,
 * `statusMessage`, `message`, then falls back to `String(err)`.
 */
export function formatFetchError(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === "object") {
    const e = err as {
      data?: { message?: string; statusMessage?: string };
      statusMessage?: string;
      message?: string;
    };
    if (e.data?.message) return e.data.message;
    if (e.data?.statusMessage) return e.data.statusMessage;
    if (e.statusMessage) return e.statusMessage;
    if (e.message) return e.message;
  }
  return String(err);
}
