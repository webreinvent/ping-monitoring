import { describe, expect, it } from "vitest";

const SYNC_STATE_ICONS: Record<string, string> = {
  off: "⊘",
  paused: "⏸",
  idle: "☁",
  syncing: "↻",
  success: "✓",
  error: "✗",
};

/** Returns the correct icon character for a sync status. */
function syncStateIcon(status: string): string {
  return SYNC_STATE_ICONS[status] ?? "⊘";
}

describe("syncStateIcon", () => {
  it("returns correct icon for each status", () => {
    expect(syncStateIcon("off")).toBe("⊘");
    expect(syncStateIcon("paused")).toBe("⏸");
    expect(syncStateIcon("idle")).toBe("☁");
    expect(syncStateIcon("syncing")).toBe("↻");
    expect(syncStateIcon("success")).toBe("✓");
    expect(syncStateIcon("error")).toBe("✗");
  });

  it("returns default icon for unknown status", () => {
    expect(syncStateIcon("unknown")).toBe("⊘");
    expect(syncStateIcon("")).toBe("⊘");
  });
});
