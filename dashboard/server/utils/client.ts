import { getDb } from "./db";

/**
 * Raw row shape from the `clients` table.
 */
interface ClientRow {
  id: number;
  slug: string;
  name: string;
  username: string;
  hostname: string;
  mac_address: string;
  sync_enabled: number;
  sync_interval_min: number;
  backend_url: string;
  last_synced_at_ms: number | null;
  created_at: number;
  updated_at: number;
}

/**
 * API response shape — created_at and updated_at are ISO 8601 strings.
 */
export interface ClientResponse {
  id: number;
  slug: string;
  name: string;
  username: string;
  hostname: string;
  mac_address: string;
  created_at: string;
  updated_at: string;
}

/**
 * Generate a deterministic, URL-safe client slug from identity fields.
 *
 * Format: `<username>-<hostname>-<truncated-mac>`
 * where truncated-mac is the last 10 hex characters of the MAC address.
 *
 * Steps:
 * 1. Strip non-hex characters from the MAC and take the last 10 hex chars.
 * 2. Build `username-hostname-truncatedMac`.
 * 3. Replace non-alphanumeric characters with hyphens.
 * 4. Collapse consecutive hyphens into one.
 * 5. Trim leading and trailing hyphens.
 *
 * Example: `alice`, `desktop`, `aa:00:bb:11:cc:22` → `alice-desktop-00bb11cc22`
 *
 * @param username - The system username of the client
 * @param hostname - The hostname of the client machine
 * @param macAddress - The MAC address of the network interface
 * @returns A URL-safe, deterministic slug string
 */
export function generateSlug(
  username: string,
  hostname: string,
  macAddress: string,
): string {
  // Validate inputs are non-empty
  if (!username.trim() || !hostname.trim() || !macAddress.trim()) {
    throw new Error(
      "Username, hostname, and macAddress must all be non-empty strings",
    );
  }

  // Strip non-hex characters from MAC and take last 10 hex chars
  const cleanMac = macAddress.replace(/[^a-f0-9]/gi, "");
  const truncatedMac = cleanMac.slice(-10);

  // Build raw slug
  const raw = `${username}-${hostname}-${truncatedMac}`;

  // Replace non-alphanumeric with hyphens
  let result = raw.replace(/[^a-zA-Z0-9]/g, "-");

  // Collapse consecutive hyphens
  result = result.replace(/-+/g, "-");

  // Trim leading and trailing hyphens
  result = result.replace(/^-+|-+$/g, "");

  return result;
}

/**
 * Convert a database row to the API response shape.
 * Converts epoch-ms timestamps to ISO 8601 strings.
 *
 * @param row - Raw client row from the database
 * @returns Formatted client response
 */
export function toClientResponse(row: ClientRow): ClientResponse {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    username: row.username,
    hostname: row.hostname,
    mac_address: row.mac_address,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

/**
 * Upsert a client record. Creates a new record on first call,
 * updates existing record on subsequent calls with the same slug.
 *
 * Default name is `username@hostname`.
 *
 * @param username - The system username of the client
 * @param hostname - The hostname of the client machine
 * @param macAddress - The MAC address of the network interface
 * @returns The upserted client row
 */
export function upsertClient(
  username: string,
  hostname: string,
  macAddress: string,
): ClientRow {
  const db = getDb();
  const now = Date.now();
  const slug = generateSlug(
    username.trim(),
    hostname.trim(),
    macAddress.trim(),
  );
  const name = `${username.trim()}@${hostname.trim()}`;

  const stmt = db.prepare(`
    INSERT INTO clients (slug, name, username, hostname, mac_address, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      username = excluded.username,
      hostname = excluded.hostname,
      mac_address = excluded.mac_address,
      updated_at = excluded.updated_at
  `);

  stmt.run(slug, name, username, hostname, macAddress, now, now);

  // Return the (possibly newly created) row
  return getClientBySlug(slug) as ClientRow;
}

/**
 * Get a client record by slug.
 *
 * @param slug - The unique client slug
 * @returns The client row, or null if not found
 */
export function getClientBySlug(slug: string): ClientRow | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM clients WHERE slug = ?")
    .get(slug) as ClientRow | undefined;

  return row ?? null;
}

/**
 * Update the display name of a client.
 *
 * @param slug - The unique client slug
 * @param name - The new display name
 * @returns The updated client row, or null if the client was not found
 */
export function updateClientName(slug: string, name: string): ClientRow | null {
  const db = getDb();
  const now = Date.now();

  const stmt = db.prepare(
    "UPDATE clients SET name = ?, updated_at = ? WHERE slug = ?",
  );
  const result = stmt.run(name, now, slug) as { changes: number };

  if (result.changes === 0) {
    return null;
  }

  return getClientBySlug(slug);
}
