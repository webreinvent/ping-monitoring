# Composable: useResponsiveSidebar

**File:** `app/composables/useResponsiveSidebar.ts`
**Feature:** M2-T1 (Dashboard shell)

## Purpose

Manages the responsive sidebar state for the dashboard. Tracks whether the viewport is in mobile mode (≤980px) and controls the mobile overlay sidebar's open/close state. Auto-closes the sidebar on route navigation.

## API

### `useResponsiveSidebar()`

```typescript
import { useResponsiveSidebar } from "~/app/composables/useResponsiveSidebar";

const { isMobile, isOpen, toggle, open, close } = useResponsiveSidebar();
```

No parameters.

### Return Values

| Property | Type | Description |
|----------|------|-------------|
| `isMobile` | `Ref<boolean>` | `true` when viewport width ≤ 980px (matches CSS breakpoint) |
| `isOpen` | `Ref<boolean>` | `true` when the mobile sidebar overlay is open |
| `toggle` | `() => void` | Toggle sidebar open state (mobile only) |
| `open` | `() => void` | Open the mobile sidebar |
| `close` | `() => void` | Close the mobile sidebar |

## Usage

### Header Hamburger Button

```vue
<template>
  <button class="hamburger-btn" @click="toggle" aria-label="Toggle sidebar">
    <!-- hamburger icon -->
  </button>
</template>

<script setup>
const { toggle } = useResponsiveSidebar();
</script>
```

### Conditional Desktop Layout

```vue
<template>
  <!-- Only shown on desktop -->
  <div class="sidebar-resizer" v-if="!isMobile" />
</template>

<script setup>
const { isMobile } = useResponsiveSidebar();
</script>
```

### Close on Navigation

The composable auto-closes the sidebar on navigation — no manual handling needed. This is implemented via `router.afterEach()`:

```typescript
// Inside useResponsiveSidebar — auto-executed on client
router.afterEach(() => {
  if (isMobile.value) {
    isOpen.value = false;
  }
});
```

## Implementation Details

### Mobile Detection

- **Breakpoint:** 980px (matches the CSS `@media (max-width: 980px)` breakpoint)
- **Initial value:** Checked on component mount via `window.innerWidth`
- **Updates:** Throttled via `requestAnimationFrame` to avoid layout thrashing during resize

### Resize Listener

```typescript
// Throttled with requestAnimationFrame
window.addEventListener(
  "resize",
  () => {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      isMobile.value = window.innerWidth <= MOBILE_BREAKPOINT;
      rafId = null;
    });
  },
  { passive: true },
);
```

- Only runs on client (`import.meta.client` guard)
- Uses `requestAnimationFrame` to throttle rapid resize events
- `passive: true` for better scroll performance

### Auto-Close on Navigation

The sidebar closes automatically when navigating to a new route on mobile. Desktop is unaffected (sidebar is always visible).

## Edge Cases

- **SSR initial render:** `isMobile` defaults to `false` on the server (`typeof window !== "undefined"` check). The client-side hydration updates it to the correct value. This causes a brief flash where the desktop layout renders before the mobile state is applied — acceptable for this pattern as it resolves within the first paint.
- **Window exactly at 980px:** The condition is `window.innerWidth <= 980`, so at exactly 980px, the layout is considered mobile.
- **Rapid resize:** Handled by `requestAnimationFrame` throttling — only one `isMobile` update per frame.
- **Orientation change:** Treated as a resize event — correctly triggers mobile/desktop re-evaluation.

## Related

- [Default Layout](../layout/default.md) — Uses `isMobile` to conditionally render sidebar
- [DashboardSidebar](../components/DashboardSidebar.md) — Uses `isOpen`, `isMobile`, and `close`
- [DashboardHeader](../components/DashboardHeader.md) — Uses `toggle` for hamburger button
- [CSS Design System](../css-design.md) — 980px breakpoint definition
- [Frontend Architecture](../architecture.md) — Responsive design overview
