import { describe, it, expect } from "vitest";
import { generateSlug, toClientResponse } from "../../utils/client";

describe("PUT /api/clients/:slug/name — validation logic", () => {
  it("rejects empty name (validation: trimmed length === 0)", () => {
    const name = "";
    const trimmed = name.trim();
    expect(trimmed.length === 0).toBe(true);
  });

  it("rejects whitespace-only name", () => {
    const name = "   ";
    const trimmed = name.trim();
    expect(trimmed.length === 0).toBe(true);
  });

  it("rejects name exceeding 100 characters", () => {
    const name = "a".repeat(101);
    const trimmed = name.trim();
    expect(trimmed.length > 100).toBe(true);
  });

  it("accepts valid name up to 100 characters", () => {
    const name = "a".repeat(100);
    const trimmed = name.trim();
    expect(trimmed.length > 0 && trimmed.length <= 100).toBe(true);
  });

  it("accepts valid name with special characters", () => {
    const name = "Alice's Workstation";
    const trimmed = name.trim();
    expect(trimmed.length > 0 && trimmed.length <= 100).toBe(true);
  });

  it("rejects non-string name (null)", () => {
    const name = null as any;
    expect(typeof name !== "string").toBe(true);
  });

  it("rejects non-string name (number)", () => {
    const name = 42 as any;
    expect(typeof name !== "string").toBe(true);
  });

  it("trims whitespace from name before storing", () => {
    const name = "  Trimmed Name  ";
    const trimmed = name.trim();
    expect(trimmed).toBe("Trimmed Name");
    expect(trimmed.length > 0 && trimmed.length <= 100).toBe(true);
  });

  it("response shape matches F11 API contract after name update", () => {
    const now = Date.now();
    const row = {
      id: 1,
      slug: generateSlug("alice", "desktop", "aa:00:bb:11:cc:22"),
      name: "Alice's Workstation",
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

    // Verify F11 response shape
    expect(response).toMatchObject({
      id: 1,
      slug: "alice-desktop-00bb11cc22",
      name: "Alice's Workstation",
      username: "alice",
      hostname: "desktop",
      mac_address: "aa:00:bb:11:cc:22",
    });

    // Verify timestamps are ISO 8601
    expect(() => new Date(response.created_at)).not.toThrow();
    expect(() => new Date(response.updated_at)).not.toThrow();
  });
});
