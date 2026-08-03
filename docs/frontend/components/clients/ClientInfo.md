# Component: ClientInfo

**File:** `app/components/clients/ClientInfo.vue`
**Feature:** M2-T6 (Client overview page)

## Purpose

Card component displaying a client's identity fields. Purely presentational — accepts a client object and renders the fields in a label-value grid.

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `client` | `object` | Yes | Client identity object |

### Client Object Shape

```typescript
interface Client {
  name: string;          // Human-readable display name
  slug: string;          // Unique slug (derived from username + hostname + MAC)
  username: string;      // System username
  hostname: string;      // Machine hostname
  mac_address: string;   // Network interface MAC address
}
```

## Events

None.

## Slots

None.

## Usage

```vue
<template>
  <ClientInfo :client="clientData" />
</template>

<script setup lang="ts">
const { data: clientData } = useAsyncData(
  `client-${slug.value}`,
  async () => await $fetch(`/api/clients/${slug.value}`)
);
</script>
```

## Fields Displayed

| Field | Label | Description |
|-------|-------|-------------|
| `client.name` | "NAME" | Human-readable display name |
| `client.slug` | "SLUG" | Unique client identifier |
| `client.username` | "USERNAME" | System username |
| `client.hostname` | "HOSTNAME" | Machine hostname |
| `client.mac_address` | "MAC ADDRESS" | Network interface MAC address |

## Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="client-info-card"` | `.client-info-card` | E2E test selector |

## Edge Cases

- **Empty values:** If any field is empty or `null`, it renders as-is. The component does not provide fallback values.
- **Long values:** No truncation — long slug/MAC values may overflow. The parent layout should handle overflow.

## Related

- [Client Overview Page](../pages/clients-slug.md) — Primary consumer
- [Client Identity API](../../../api/clients.md) — Data source
- [Shared Types](../../../shared/types.md) — `ClientIdentity` type
