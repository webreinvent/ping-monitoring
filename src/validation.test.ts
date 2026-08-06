import { describe, expect, it } from "vitest";

/** Validates a dashboard ingest URL. Returns { ok: true, url } or { ok: false, reason }. */
function validateIngestUrl(raw: string): { ok: true; url: string } | { ok: false; reason: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, url: "" };
  if (trimmed.length > 2048) return { ok: false, reason: "URL is too long" };
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, reason: "URL must use http:// or https://" };
    }
    return { ok: true, url: trimmed };
  } catch {
    return { ok: false, reason: "Enter a valid URL" };
  }
}

describe("validateIngestUrl", () => {
  it("accepts empty string as disabled", () => {
    const result = validateIngestUrl("");
    expect(result).toEqual({ ok: true, url: "" });
  });

  it("accepts whitespace-only as disabled", () => {
    const result = validateIngestUrl("   ");
    expect(result).toEqual({ ok: true, url: "" });
  });

  it("accepts valid http URL", () => {
    const result = validateIngestUrl("http://localhost:3000/api/ping/ingest");
    expect(result).toEqual({ ok: true, url: "http://localhost:3000/api/ping/ingest" });
  });

  it("accepts valid https URL", () => {
    const result = validateIngestUrl("https://dashboard.example.com/api/ping/ingest");
    expect(result.ok).toBe(true);
  });

  it("rejects ftp scheme", () => {
    const result = validateIngestUrl("ftp://example.com");
    expect(result.ok).toBe(false);
  });

  it("rejects malformed URL", () => {
    const result = validateIngestUrl("not-a-url");
    expect(result.ok).toBe(false);
  });

  it("rejects URL that is too long", () => {
    const long = "http://" + "a".repeat(2050);
    const result = validateIngestUrl(long);
    expect(result.ok).toBe(false);
  });

  it("accepts URL at exactly 2048 chars", () => {
    const exact = "http://" + "a".repeat(2038);
    const result = validateIngestUrl(exact);
    expect(result.ok).toBe(true);
  });
});
