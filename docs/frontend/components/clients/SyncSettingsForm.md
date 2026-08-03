# Component: SyncSettingsForm

**File:** `app/components/clients/SyncSettingsForm.vue`
**Feature:** M2-T6 (Client settings page)

## Purpose

Form for editing a client's sync configuration: enable/disable sync, select sync interval, and set the backend URL. Submits changes via `PUT /api/clients/:slug/settings` with client-side validation.

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `clientSlug` | `string` | Yes | Client slug to identify the client for API calls |
| `initialSettings` | `object` | Yes | Current sync settings |

### initialSettings Shape

```typescript
interface InitialSettings {
  sync_enabled: boolean;        // Whether sync is enabled
  sync_interval_min: number;    // Sync interval in minutes
  backend_url: string;          // Backend URL (HTTPS)
}
```

## Events

None.

## Slots

None.

## Usage

```vue
<template>
  <SyncSettingsForm
    :client-slug="slug"
    :initial-settings="initialSettings"
  />
</template>

<script setup lang="ts">
const initialSettings = computed(() => ({
  sync_enabled: clientData.value?.sync_enabled ? true : false,
  sync_interval_min: clientData.value?.sync_interval_min ?? 5,
  backend_url: clientData.value?.backend_url ?? "",
}));
</script>
```

## Form Fields

| Field | Type | Options | Validation |
|-------|------|---------|------------|
| **Enable Sync** | Select | "Enabled" / "Disabled" | Required |
| **Sync Interval** | Select | 1, 2, 5, 10, 15, 30, 60 minutes | Required when sync enabled |
| **Backend URL** | URL input | Free-form | Must be valid HTTPS URL when sync enabled |

### Allowed Sync Intervals

The form accepts only these predefined intervals (in minutes): `[1, 2, 5, 10, 15, 30, 60]`.

## Validation

### Backend URL Validation

| Condition | Error Message |
|-----------|---------------|
| Empty when sync is enabled | "Backend URL is required" |
| Not a valid URL | "Invalid URL format" |
| Not HTTPS | "Backend URL must use HTTPS" |
| Sync is disabled | No validation (field is hidden) |

## API Submission

On submit:
1. Client-side validation is checked (`urlError` must be `null`)
2. A `PUT` request is sent to `/api/clients/:slug/settings` with the form body
3. On success, a "Settings saved successfully" message is displayed
4. On error, the error message is displayed
5. The submit button is disabled during the request (`saving` state)

### Request Body

```json
{
  "sync_enabled": true,
  "sync_interval_min": 5,
  "backend_url": "https://example.com/api"
}
```

### Response

```json
{
  "success": true,
  "sync_enabled": true,
  "sync_interval_min": 5,
  "backend_url": "https://example.com/api"
}
```

## Cancel Behavior

The "Cancel" button resets the form to the `initialSettings` values, clearing any error or success messages. No API call is made.

## Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="settings-form"` | `form` | E2E test selector |

## Edge Cases

- **Sync disabled:** Interval and URL fields are hidden. The form only submits `sync_enabled: false`.
- **Backend URL unchanged:** If the URL field is empty and sync is enabled, it is rejected by validation. The user must provide a URL.
- **Concurrent edits:** The form does not guard against stale data — if another request updates the client between load and submit, the PUT overwrites. This is acceptable for the current no-auth design.

## Related

- [Client Settings Page](../pages/clients-slug-settings.md) — Primary consumer
- [Client Settings API](../../../api/clients-settings.md) — `PUT /api/clients/:slug/settings` endpoint
- [SyncStatusIndicator](./SyncStatusIndicator.md) — Visual status indicator (displayed above the form)
- [Client Utility](../../../utils/client.md) — Server-side client management
