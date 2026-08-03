import { describe, it, expect } from "vitest";
import { generateSlug, toClientResponse } from "./client";

/* ------------------------------------------------------------------ */
/*  generateSlug — edge cases not covered by main tests                */
/* ------------------------------------------------------------------ */

describe("generateSlug — edge cases", () => {
  it("handles MAC address with only 2 hex chars", () => {
    const slug = generateSlug("user", "host", "1a");
    expect(slug).toBe("user-host-1a");
  });

  it("handles MAC address with all zeros", () => {
    const slug = generateSlug("user", "host", "00:00:00:00:00:00");
    // 000000000000 → last 10 → 0000000000
    expect(slug).toBe("user-host-0000000000");
  });

  it("handles username with dots and underscores", () => {
    // john.doe_work → john-doe-work (dots and underscores → hyphens)
    // aa:bb:cc:dd:ee:ff → aabbccddeeff → last 10 → bbccddeeff
    const slug = generateSlug("john.doe_work", "host", "aa:bb:cc:dd:ee:ff");
    expect(slug).toBe("john-doe-work-host-bbccddeeff");
  });

  it("handles hostname with IP-like format", () => {
    // user-192-168-1-1-bbccddeeff (hyphens in hostname preserved)
    const slug = generateSlug("user", "192-168-1-1", "aa:bb:cc:dd:ee:ff");
    expect(slug).toBe("user-192-168-1-1-bbccddeeff");
  });

  it("handles MAC with mixed separators (colons and hyphens)", () => {
    // aa:bb-cc:dd:ee:ff → aabbccddeeff → last 10 → bbccddeeff
    const slug = generateSlug("user", "host", "aa:bb-cc:dd:ee:ff");
    expect(slug).toBe("user-host-bbccddeeff");
  });

  it("handles MAC with spaces", () => {
    // aa bb cc dd ee ff → aabbccddeeff → last 10 → bbccddeeff
    const slug = generateSlug("user", "host", "aa bb cc dd ee ff");
    expect(slug).toBe("user-host-bbccddeeff");
  });

  it("handles very long username", () => {
    const slug = generateSlug("a".repeat(50), "host", "aa:bb:cc:dd:ee:ff");
    expect(slug).toMatch(/-bbccddeeff$/);
    expect(slug.length).toBeGreaterThan(10);
  });

  it("handles username with unicode characters", () => {
    // Unicode é is a single non-alphanumeric char → replaced with hyphen
    // "usér" → "us-er" becomes "us-r" because é is one char → one hyphen
    // Actually: "usér" → "us" + "é" + "r" → "us-r" after replace+collapse
    const slug = generateSlug("usér", "host", "aa:bb:cc:dd:ee:ff");
    expect(slug).toBe("us-r-host-bbccddeeff");
  });

  it("handles all-hyphen username after replacement", () => {
    // "..." → "---" → "-" after collapse, then "-host-..." → trimmed
    const slug = generateSlug("...", "host", "aa:bb:cc:dd:ee:ff");
    // raw: "...-host-bbccddeeff" → replace non-alnum: "---host-bbccddeeff"
    // collapse hyphens: "-host-bbccddeeff" → trim: "host-bbccddeeff"
    expect(slug).toBe("host-bbccddeeff");
  });

  it("handles hostname that is all special chars", () => {
    // "user-...-bbccddeeff" → "user---bbccddeeff" → "user-bbccddeeff"
    const slug = generateSlug("user", "...", "aa:bb:cc:dd:ee:ff");
    expect(slug).toBe("user-bbccddeeff");
  });

  it("preserves case in username and hostname", () => {
    const slug = generateSlug("Alice", "Desktop", "aa:bb:cc:dd:ee:ff");
    expect(slug).toBe("Alice-Desktop-bbccddeeff");
  });

  it("handles MAC with non-hex alphanumeric chars", () => {
    // "gg" is not hex, so it gets stripped
    const slug = generateSlug("user", "host", "aa:gg:bb:cc:dd:ee");
    // a a (g stripped) (g stripped) b b c c d d e e → aabbccddee → last 10 → aabbccddee
    expect(slug).toMatch(/^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*$/);
    expect(slug).toBe("user-host-aabbccddee");
  });

  it("handles single-character username and hostname", () => {
    const slug = generateSlug("a", "b", "aa:bb:cc:dd:ee:ff");
    expect(slug).toBe("a-b-bbccddeeff");
  });

  it("MAC with only non-hex content produces empty truncated MAC", () => {
    // gghhiijj has no hex chars → cleanMac is "" → truncatedMac is ""
    // raw = "user-host-" → replace: "user-host-" → trim: "user-host"
    const slug = generateSlug("user", "host", "gghhiijj");
    expect(slug).toBe("user-host");
  });

  it("whitespace-only in a single field throws", () => {
    expect(() => generateSlug("  ", "host", "aa:bb:cc")).toThrow();
    expect(() => generateSlug("user", "  ", "aa:bb:cc")).toThrow();
    expect(() => generateSlug("user", "host", "  ")).toThrow();
  });

  it("MAC address with only one valid hex char", () => {
    const slug = generateSlug("user", "host", "a");
    // cleanMac = "a", truncatedMac = "a"
    expect(slug).toBe("user-host-a");
  });
});

/* ------------------------------------------------------------------ */
/*  toClientResponse — edge cases                                      */
/* ------------------------------------------------------------------ */

describe("toClientResponse — edge cases", () => {
  it("handles timestamp 0 (Unix epoch)", () => {
    const row = {
      id: 1,
      slug: "test",
      name: "Test",
      username: "u",
      hostname: "h",
      mac_address: "m",
      sync_enabled: 0,
      sync_interval_min: 0,
      backend_url: "",
      last_synced_at_ms: null,
      created_at: 0,
      updated_at: 0,
    };

    const response = toClientResponse(row);
    expect(response.created_at).toBe("1970-01-01T00:00:00.000Z");
    expect(response.updated_at).toBe("1970-01-01T00:00:00.000Z");
  });

  it("handles very large timestamp values", () => {
    // Very far future — JavaScript Date can handle this
    const futureTimestamp = 99999999999999;
    const row = {
      id: 1,
      slug: "test",
      name: "Test",
      username: "u",
      hostname: "h",
      mac_address: "m",
      sync_enabled: 0,
      sync_interval_min: 0,
      backend_url: "",
      last_synced_at_ms: null,
      created_at: futureTimestamp,
      updated_at: futureTimestamp,
    };

    const response = toClientResponse(row);
    // Should produce a valid ISO date string
    expect(() => new Date(response.created_at)).not.toThrow();
    expect(response.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("handles negative timestamp values", () => {
    const row = {
      id: 1,
      slug: "test",
      name: "Test",
      username: "u",
      hostname: "h",
      mac_address: "m",
      sync_enabled: 0,
      sync_interval_min: 0,
      backend_url: "",
      last_synced_at_ms: null,
      created_at: -1000,
      updated_at: -1000,
    };

    const response = toClientResponse(row);
    expect(response.created_at).toBe("1969-12-31T23:59:59.000Z");
    expect(response.updated_at).toBe("1969-12-31T23:59:59.000Z");
  });

  it("handles different created_at and updated_at values", () => {
    const created = new Date("2025-01-01T00:00:00.000Z").getTime();
    const updated = new Date("2026-01-01T00:00:00.000Z").getTime();

    const row = {
      id: 1,
      slug: "test",
      name: "Test",
      username: "u",
      hostname: "h",
      mac_address: "m",
      sync_enabled: 0,
      sync_interval_min: 0,
      backend_url: "",
      last_synced_at_ms: null,
      created_at: created,
      updated_at: updated,
    };

    const response = toClientResponse(row);
    expect(response.created_at).toBe("2025-01-01T00:00:00.000Z");
    expect(response.updated_at).toBe("2026-01-01T00:00:00.000Z");
    expect(response.created_at).not.toBe(response.updated_at);
  });

  it("includes trailing Z in ISO timestamp", () => {
    const row = {
      id: 1,
      slug: "test",
      name: "Test",
      username: "u",
      hostname: "h",
      mac_address: "m",
      sync_enabled: 0,
      sync_interval_min: 0,
      backend_url: "",
      last_synced_at_ms: null,
      created_at: 1700000000000,
      updated_at: 1700000000000,
    };

    const response = toClientResponse(row);
    expect(response.created_at).toMatch(/Z$/);
    expect(response.updated_at).toMatch(/Z$/);
  });

  it("response has exactly 8 fields", () => {
    const row = {
      id: 1,
      slug: "test",
      name: "Test",
      username: "u",
      hostname: "h",
      mac_address: "m",
      sync_enabled: 0,
      sync_interval_min: 0,
      backend_url: "",
      last_synced_at_ms: null,
      created_at: 1700000000000,
      updated_at: 1700000000000,
    };

    const response = toClientResponse(row);
    const keys = Object.keys(response);
    expect(keys).toHaveLength(8);
    expect(keys).toEqual([
      "id", "slug", "name", "username", "hostname",
      "mac_address", "created_at", "updated_at",
    ]);
  });

  it("handles client with numeric id of 0", () => {
    const row = {
      id: 0,
      slug: "test",
      name: "Test",
      username: "u",
      hostname: "h",
      mac_address: "m",
      sync_enabled: 0,
      sync_interval_min: 0,
      backend_url: "",
      last_synced_at_ms: null,
      created_at: 1700000000000,
      updated_at: 1700000000000,
    };

    const response = toClientResponse(row);
    expect(response.id).toBe(0);
  });

  it("handles client with very large id", () => {
    const row = {
      id: 999999999999,
      slug: "test",
      name: "Test",
      username: "u",
      hostname: "h",
      mac_address: "m",
      sync_enabled: 0,
      sync_interval_min: 0,
      backend_url: "",
      last_synced_at_ms: null,
      created_at: 1700000000000,
      updated_at: 1700000000000,
    };

    const response = toClientResponse(row);
    expect(response.id).toBe(999999999999);
  });
});
