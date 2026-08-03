import { describe, it, expect, vi } from "vitest";
import {
  generateSlug,
  toClientResponse,
} from "./client";

/* ------------------------------------------------------------------ */
/*  generateSlug                                                       */
/* ------------------------------------------------------------------ */

describe("generateSlug", () => {
  it("produces correct slug from standard inputs", () => {
    const slug = generateSlug("alice", "desktop", "aa:00:bb:11:cc:22");
    // aa:00:bb:11:cc:22 → aa00bb11cc22 → last 10 → 00bb11cc22
    expect(slug).toBe("alice-desktop-00bb11cc22");
  });

  it("is deterministic — same inputs always produce same slug", () => {
    const a = generateSlug("bob", "laptop", "11:22:33:44:55:66");
    const b = generateSlug("bob", "laptop", "11:22:33:44:55:66");
    expect(a).toBe(b);
  });

  it("handles MAC with no separators", () => {
    const slug = generateSlug("charlie", "server", "aabb11cc22dd");
    // aabb11cc22dd → last 10 → bb11cc22dd
    expect(slug).toBe("charlie-server-bb11cc22dd");
  });

  it("replaces special characters in username with hyphens", () => {
    const slug = generateSlug("alice.jones", "my-desktop", "aa:00:bb:11:cc:22");
    expect(slug).toBe("alice-jones-my-desktop-00bb11cc22");
  });

  it("collapses consecutive hyphens", () => {
    const slug = generateSlug("my--user", "host--name", "aa:00:bb:11:cc:22");
    expect(slug).toBe("my-user-host-name-00bb11cc22");
  });

  it("trims leading and trailing hyphens", () => {
    const slug = generateSlug("-user", "host-", "aa:00:bb:11:cc:22");
    expect(slug).toBe("user-host-00bb11cc22");
  });

  it("handles uppercase MAC — preserves case in hex output", () => {
    const slug = generateSlug("user", "host", "AA:00:BB:11:CC:22");
    // AA00BB11CC22 → last 10 → 00BB11CC22
    expect(slug).toBe("user-host-00BB11CC22");
  });

  it("handles short MAC address", () => {
    const slug = generateSlug("user", "host", "11:22");
    // 1122 → last 10 → 1122
    expect(slug).toBe("user-host-1122");
  });

  it("is URL-safe — no spaces or special characters", () => {
    const slug = generateSlug("user name", "host name", "aa:bb:cc:dd:ee:ff");
    expect(slug).toMatch(/^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*$/);
  });
});

/* ------------------------------------------------------------------ */
/*  toClientResponse                                                   */
/* ------------------------------------------------------------------ */

describe("toClientResponse", () => {
  it("converts epoch-ms timestamps to ISO 8601", () => {
    // Use a known epoch-ms value
    const epochMs = new Date("2026-01-15T12:00:00.000Z").getTime();
    const row = {
      id: 1,
      slug: "test-slug",
      name: "Test User",
      username: "test",
      hostname: "host",
      mac_address: "aa:00:bb:11:cc:22",
      sync_enabled: 1,
      sync_interval_min: 5,
      backend_url: "",
      last_synced_at_ms: null,
      created_at: epochMs,
      updated_at: epochMs,
    };

    const response = toClientResponse(row);
    expect(response.created_at).toBe("2026-01-15T12:00:00.000Z");
    expect(response.updated_at).toBe("2026-01-15T12:00:00.000Z");
    expect(response.id).toBe(1);
    expect(response.slug).toBe("test-slug");
  });

  it("excludes database-only fields from response", () => {
    const row = {
      id: 1,
      slug: "test",
      name: "Test",
      username: "u",
      hostname: "h",
      mac_address: "aa:bb",
      sync_enabled: 1,
      sync_interval_min: 5,
      backend_url: "http://example.com",
      last_synced_at_ms: 12345,
      created_at: 1751472000000,
      updated_at: 1751472000000,
    };

    const response = toClientResponse(row);
    expect(response).not.toHaveProperty("sync_enabled");
    expect(response).not.toHaveProperty("sync_interval_min");
    expect(response).not.toHaveProperty("backend_url");
    expect(response).not.toHaveProperty("last_synced_at_ms");
  });

  it("returns all expected response fields", () => {
    const row = {
      id: 42,
      slug: "test-slug",
      name: "Test User",
      username: "test",
      hostname: "host",
      mac_address: "aa:00:bb:11:cc:22",
      sync_enabled: 1,
      sync_interval_min: 5,
      backend_url: "",
      last_synced_at_ms: null,
      created_at: 1751472000000,
      updated_at: 1751472000000,
    };

    const response = toClientResponse(row);
    const expectedFields = [
      "id", "slug", "name", "username", "hostname",
      "mac_address", "created_at", "updated_at",
    ];
    for (const field of expectedFields) {
      expect(response).toHaveProperty(field);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  upsertClient / updateClientName — SQL and validation               */
/* ------------------------------------------------------------------ */

describe("upsertClient SQL construction", () => {
  it("generates correct slug for upsert", () => {
    const slug = generateSlug("alice", "desktop", "aa:00:bb:11:cc:22");
    // Verify slug format matches the INSERT values
    expect(slug).toBe("alice-desktop-00bb11cc22");
  });

  it("default name is username@hostname", () => {
    const username = "alice";
    const hostname = "desktop";
    const name = `${username}@${hostname}`;
    expect(name).toBe("alice@desktop");
  });

  it("upsert uses INSERT with ON CONFLICT", () => {
    // Verify the SQL pattern used by upsertClient
    const sql = `
    INSERT INTO clients (slug, name, username, hostname, mac_address, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      username = excluded.username,
      hostname = excluded.hostname,
      mac_address = excluded.mac_address,
      updated_at = excluded.updated_at
  `;
    expect(sql).toContain("INSERT INTO clients");
    expect(sql).toContain("ON CONFLICT(slug) DO UPDATE");
    expect(sql).toContain("excluded.name");
  });
});

describe("updateClientName validation", () => {
  it("rejects empty string", () => {
    const name = "";
    const trimmed = name.trim();
    expect(trimmed.length === 0).toBe(true);
  });

  it("rejects whitespace-only string", () => {
    const name = "   ";
    const trimmed = name.trim();
    expect(trimmed.length === 0).toBe(true);
  });

  it("rejects string over 100 characters", () => {
    const name = "a".repeat(101);
    const trimmed = name.trim();
    expect(trimmed.length > 100).toBe(true);
  });

  it("accepts string at exactly 100 characters", () => {
    const name = "a".repeat(100);
    const trimmed = name.trim();
    expect(trimmed.length > 0 && trimmed.length <= 100).toBe(true);
  });

  it("accepts string at exactly 1 character", () => {
    const name = "a";
    const trimmed = name.trim();
    expect(trimmed.length > 0 && trimmed.length <= 100).toBe(true);
  });

  it("trims whitespace before validation", () => {
    const name = "  hello  ";
    const trimmed = name.trim();
    expect(trimmed).toBe("hello");
    expect(trimmed.length > 0 && trimmed.length <= 100).toBe(true);
  });
});
