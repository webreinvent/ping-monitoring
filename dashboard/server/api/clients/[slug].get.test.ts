import { describe, it, expect } from "vitest";
import { generateSlug, toClientResponse } from "../../utils/client";

describe("GET /api/clients/:slug", () => {
  it("generates correct slug for client lookup", () => {
    const slug = generateSlug("alice", "desktop", "aa:00:bb:11:cc:22");
    expect(slug).toBe("alice-desktop-00bb11cc22");
  });

  it("toClientResponse returns correct API shape", () => {
    const now = Date.now();
    const row = {
      id: 1,
      slug: "alice-desktop-00bb11cc22",
      name: "alice@desktop",
      username: "alice",
      hostname: "desktop",
      mac_address: "aa:00:bb:11:cc:22",
      sync_enabled: 1,
      sync_interval_min: 5,
      backend_url: "",
      last_synced_at_ms: null,
      created_at: now,
      updated_at: now,
    };

    const response = toClientResponse(row);

    // Verify shape matches F2 API contract
    expect(response).toEqual({
      id: 1,
      slug: "alice-desktop-00bb11cc22",
      name: "alice@desktop",
      username: "alice",
      hostname: "desktop",
      mac_address: "aa:00:bb:11:cc:22",
      created_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    });

    // Verify response does not include database-only fields
    expect(response).not.toHaveProperty("sync_enabled");
    expect(response).not.toHaveProperty("last_synced_at_ms");
  });
});
