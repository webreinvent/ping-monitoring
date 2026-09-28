# Composable: useClientSettings

**File:** `app/composables/useClientSettings.ts`
**Feature:** M2-T6 (Client settings page) / F9

## Purpose

Centralized composable for fetching and updating client settings via the API. Provides reactive state (`settings`, `loading`, `error`) and handles optimistic updates with rollback on failure.

## API

```typescript
const {
  settings,        // Ref<ClientSettings | null> — current settings or null
  loading,         // Ref<boolean> — true during fetch/update
  error,           // Ref<string | null> — error message or null
  fetchSettings(slug),   // Fetch settings via GET
  updateSettings(slug, data), // Update settings via PUT with optimistic UI
} = useClientSettings();
```

## Methods

### `fetchSettings(slug: string): Promise<ClientSettings | null>`

Fetches the current settings for a client via `GET /api/clients/:slug/settings`.

- Sets `loading` to `true` during the request
- Sets `error` to `null` before the request
- On success: stores the response in `settings` and returns it
- On error: stores the error message in `error` and returns `null`

**Example:**
```typescript
const { fetchSettings } = useClientSettings();
await fetchSettings("alice-desktop-00bb11cc22");
// settings.value now contains the ClientSettings object
```

### `updateSettings(slug: string, data): Promise<boolean>`

Updates client settings via `PUT /api/clients/:slug/settings` with optimistic update and rollback.

**Parameters:**
```typescript
interface UpdateData {
  sync_enabled: boolean;
  sync_interval_min: number;
  backend_url: string;
}
```

**Behavior:**
1. Validates that `settings` is loaded (returns `false` with error if not)
2. Saves current state for rollback
3. **Optimistic update**: Immediately applies changes and sets `sync_status` to `"syncing"`
4. Sends PUT request
5. On success: Merges server response, then resets `sync_status` to `"connected"`/`"disabled"` after 2s delay
6. On error: Rolls back to previous state, stores error message

**Returns:** `true` on success, `false` on failure

**Example:**
```typescript
const { updateSettings } = useClientSettings();
const success = await updateSettings("alice-desktop-00bb11cc22", {
  sync_enabled: true,
  sync_interval_min: 10,
  backend_url: "https://dashboard.example.com/api",
});
```

## Reactive State

| State | Type | Description |
|-------|------|-------------|
| `settings` | `Ref<ClientSettings \| null>` | Current settings object, or null if not loaded |
| `loading` | `Ref<boolean>` | `true` during `fetchSettings` or `updateSettings` calls |
| `error` | `Ref<string \| null>` | Error message string, or null if no error |

## Design Decisions

- **Optimistic updates**: Changes are applied immediately for perceived responsiveness; rollback on failure ensures data consistency
- **Transient "syncing" state**: After a successful update, `sync_status` is set to `"syncing"` briefly, then reset to the appropriate state after 2 seconds — provides visual feedback without requiring a server round-trip
- **Error-first pattern**: If `settings` is not loaded (null), `updateSettings` fails early with a descriptive error — no silent failures
- **No WebSocket listener**: This composable doesn't listen for `client_settings_updated` WebSocket messages — it's focused on API interaction. Parent components can wire WebSocket listeners separately.

## Edge Cases

- **Settings not loaded**: `updateSettings` returns `false` and sets error message "Settings not loaded. Call fetchSettings first."
- **Network error**: Rollback restores previous settings; error message is stored in `error` ref
- **Concurrent updates**: Not handled — if two updates are in flight, the second may rollback to a stale state. In practice, this is mitigated by the `loading` state (UI should disable the form during update).

## Related

- [Client Settings API](../../api/clients-settings.md) — `GET` and `PUT` endpoints
- [ClientSettings Type](../../shared/types.md) — `ClientSettings` interface definition
- [Client Settings Page](../pages/clients-slug-settings.md) — Primary consumer
