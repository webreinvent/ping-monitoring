# Component: EmptyState

**File:** `app/components/shared/EmptyState.vue`
**Feature:** M2-T2 (Monitors list composable and sidebar components)

## Purpose

Placeholder component shown when no monitors are configured. Displays a radar animation with "No monitors configured" message and "Start by registering a client" call-to-action text.

## Props

None.

## Events

None.

## Slots

None.

## Usage

```vue
<template>
  <!-- Shown when no monitors exist -->
  <EmptyState v-if="!monitors.length" />
</template>
```

## Visual Elements

### Radar Animation

- 72×72px circle with concentric radar-like styling
- Gradient crosshairs (teal, semi-transparent)
- Spinning sweep line (2.8s linear infinite animation)
- Uses CSS `@keyframes radar-spin` for the sweep animation

### Text

- **Heading:** "No monitors configured" (14px, bold, text color)
- **Body:** "Start by registering a client." (11px, muted, line-height 1.6)

## Implementation

This is a **presentational component** — no script setup, no interactivity. Pure HTML + CSS.

```html
<div class="empty-state" data-testid="empty-state">
  <div class="empty-radar" />
  <strong>No monitors configured</strong>
  <p>Start by registering a client.</p>
</div>
```

## Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="empty-state"` | `.empty-state` container | E2E test selector |

## Edge Cases

- **Reduced motion:** The `prefers-reduced-motion: reduce` media query disables the radar animation (transitions set to 0.01ms).
- **Accessibility:** The radar is decorative (pure CSS animation). Screen readers will read the text content ("No monitors configured" + "Start by registering a client.").

## Related

- [DashboardSidebar](./DashboardSidebar.md) — Primary consumer (shown when no monitors in sidebar)
- [CSS Design System](../css-design.md) — `.empty-state`, `.empty-radar` styling, `@keyframes radar-spin`
