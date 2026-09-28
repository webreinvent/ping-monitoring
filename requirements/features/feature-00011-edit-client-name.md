---
id: F11
name: Dashboard Client Name Editing
phase: Enhancement
priority: Medium
effort: Small
dependencies: [F2, F8]
---

# F11: Dashboard Client Name Editing

## Description

Allow a dashboard user to edit the display name of a client from the web UI. The client's slug remains immutable and is not exposed to editing. After the name change, the sidebar and all views referencing that client update in real-time via WebSocket broadcast so every connected viewer sees the new name without refreshing the page.

## Acceptance Criteria

- **Given** a dashboard user is viewing the sidebar with clients and monitors, **when** they click the edit button next to a client name, **then** an inline editable text field appears with the current name pre-populated.
- **Given** the edit field is open, **when** the user types a new name and confirms (Enter key or clicks Save), **then** the server updates the client name and returns the updated client record.
- **Given** the name update succeeds, **when** the response is received, **then** the sidebar immediately reflects the new name without a page reload.
- **Given** another browser tab or device is connected to the WebSocket with the same sidebar visible, **when** a client name is changed by any user, **then** that viewer's sidebar updates automatically via a WebSocket message.
- **Given** the edit field is open, **when** the user presses Escape or clicks Cancel, **then** the edit field closes and the name reverts to the original value with no server request sent.
- **Given** the user submits an empty or whitespace-only name, **when** the form is validated, **then** the request is rejected with a 400 Bad Request and an error message is shown inline.
- **Given** the user submits a name exceeding the maximum length (100 characters), **when** the form is validated, **then** the request is rejected with a 400 Bad Request.
- **Given** the client slug does not exist, **when** the name update request is sent, **then** the server responds with 404 Not Found.
- **Given** a client name is changed, **when** any monitor list or history view references that client, **then** the client name displayed in those views uses the new name.

## Implementation Notes

- **Inline editing**: The sidebar client group header renders an edit icon button. Clicking it replaces the static name with a text input and Save/Cancel buttons. The input focuses automatically.
- **Immutable slug**: The edit endpoint only accepts `name` in the request body. The slug is never written to. The database unique constraint on `slug` guarantees immutability.
- **Real-time update**: After the name change, the server broadcasts a `client_name_updated` event over the WebSocket with the client's slug and new name. All connected clients listening to the sidebar channel patch their local state.
- **Optimistic UI**: The sidebar can optimistically show the new name while the request is in flight. On failure, revert to the old name and show a toast error.
- **Authentication**: The endpoint requires an authenticated dashboard session (see F1 — backend setup auth configuration). Unauthenticated requests receive 401.
- **Files to create/modify**:
  - `server/routes/api/clients/[slug].name.ts` — `PUT` handler for name update
  - `server/utils/client.ts` — add `updateClientName(slug, name)` database function
  - `server/utils/ws.ts` — add `client_name_updated` event broadcast
  - `app/components/sidebar/ClientGroup.vue` — inline edit UI in the client header
  - `app/composables/useClientEdit.ts` — edit state management, API call, WS subscription

## Data Model Changes

No schema changes. The `name` column on the `clients` table already exists (defined in F2). This feature only modifies its value.

## API Contract

### PUT /api/clients/:slug/name

Update the display name of a client. The slug path parameter identifies the client.

**Request:**
```json
{
  "name": "Alice's Workstation"
}
```

**Response (200 OK):**
```json
{
  "id": 1,
  "slug": "alice-desktop-aa00bb11cc22",
  "name": "Alice's Workstation",
  "username": "alice",
  "hostname": "desktop",
  "mac_address": "aa:00:bb:11:cc:22",
  "created_at": "2026-07-31T10:00:00Z",
  "updated_at": "2026-07-31T14:22:00Z"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Name is required and must be between 1 and 100 characters"
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Authentication required"
}
```

**Response (404 Not Found):**
```json
{
  "error": "Client not found"
}
```

### WebSocket Event: client_name_updated

Broadcast to all connected WebSocket clients after a successful name change.

**Payload:**
```json
{
  "type": "client_name_updated",
  "client_slug": "alice-desktop-aa00bb11cc22",
  "client_name": "Alice's Workstation"
}
```

Clients receiving this event should patch their sidebar client list and any cached client name references.
