# Component: ClientIdentity

**File:** `app/components/clients/ClientIdentity.vue`
**Feature:** M2-T6 (Client settings page) / F9

## Purpose

Read-only display of client identity information. Shows slug, name, username, hostname, and MAC address in a structured card layout using existing `.client-info-card` CSS classes.

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `client` | `Object` | Yes | Client identity data |

### Client Prop Shape

```typescript
interface Props {
  client: {
    slug: string;
    name: string;
    username: string;
    hostname: string;
    mac_address: string;
  };
}
```

## Events

None.

## Slots

None.

## Usage

```vue
<template>
  <ClientIdentity :client="identityData" />
</template>

<script setup lang="ts">
const identityData = computed(() => ({
  slug: clientData.value?.slug ?? "",
  name: clientData.value?.name ?? "",
  username: clientData.value?.username ?? "",
  hostname: clientData.value?.hostname ?? "",
  mac_address: clientData.value?.mac_address ?? "",
}));
</script>
```

## CSS Classes

Uses existing CSS classes from `dashboard.css`:
- `.client-info-card` — Card container
- `.client-info-field` — Individual field row with label/value layout
- `.field-label` — Uppercase label text
- `.field-value` — Value text

## Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="client-identity"` | `.client-info-card` | E2E test selector |

## Design Decisions

- **No interactivity**: Pure presentational component — no events, no slots, no edit capability
- **Reuses existing CSS**: Leverages `.client-info-card` and `.client-info-field` classes already used by `ClientInfo` component
- **Field order**: SLUG, NAME, USERNAME, HOSTNAME, MAC ADDRESS — matches the order of fields in the `clients` table

## Edge Cases

- **Empty values:** If `client` prop has empty strings, the component displays empty fields (parent should provide defaults)
- **No error handling:** The component assumes valid input — the parent is responsible for data validation

## Related

- [Client Settings Page](../pages/clients-slug-settings.md) — Primary consumer
- [ClientInfo Component](./ClientInfo.md) — Similar read-only display (different context)
- [Client Identity API](../../../api/clients.md) — `GET /api/clients/:slug` data source
- [Client Settings API](../../../api/clients-settings.md) — `GET /api/clients/:slug/settings` data source
