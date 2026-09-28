# Component: NavigationBreadcrumb

**File:** `app/components/shared/NavigationBreadcrumb.vue`
**Feature:** M2-T1 (Dashboard shell)

## Purpose

Back navigation breadcrumb link. Renders a clickable link with a left arrow icon, used in sub-pages to navigate back to the main dashboard.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `label` | `string` | Yes | — | Display text (e.g., "All Monitors") |
| `to` | `string` | No | `"/"` | Destination route |

## Events

None.

## Slots

None.

## Usage

```vue
<!-- Default: back to home -->
<NavigationBreadcrumb label="All Monitors" />

<!-- Custom destination -->
<NavigationBreadcrumb label="Dashboard" to="/dashboard" />
```

## Implementation

Renders as a `<NuxtLink>` with an inline SVG back arrow icon:

```html
<NuxtLink :to="to" class="breadcrumb" data-testid="breadcrumb">
  <svg class="breadcrumb-icon">...</svg>
  {{ label }}
</NuxtLink>
```

## Visual Details

- **Layout:** Inline-flex with icon + text (6px gap)
- **Background:** Subtle light background (`rgba(255, 255, 255, 0.018)`)
- **Hover:** Brighter text + slightly brighter background
- **Icon:** 15×15px left arrow (chevron + line)
- **Font:** 12px, 600 weight, muted color

## Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="breadcrumb"` | `.breadcrumb` link | E2E test selector |

## Related

- [Monitors [id] Page](../pages/monitors-id.md) — Uses breadcrumb to navigate back to home
- [Clients [slug] Page](../pages/clients-slug.md) — Uses breadcrumb to navigate back to home
- [CSS Design System](../css-design.md) — `.breadcrumb` styling
