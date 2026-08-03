import { describe, it, expect } from "vitest";
import { getPaletteColor, useDashboardPalette } from "./useDashboardPalette";

describe("useDashboardPalette", () => {
  it("returns a non-empty array of colors", () => {
    const palette = useDashboardPalette();
    expect(palette.length).toBeGreaterThan(0);
    expect(palette.length).toBe(12);
  });

  it("all colors are valid hex strings", () => {
    const palette = useDashboardPalette();
    for (const color of palette) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("returns consistent colors across calls", () => {
    const palette1 = useDashboardPalette();
    const palette2 = useDashboardPalette();
    expect(palette1).toEqual(palette2);
  });
});

describe("getPaletteColor", () => {
  it("returns the correct color for index 0", () => {
    expect(getPaletteColor(0)).toBe("#3b82f6");
  });

  it("returns the correct color for index 11 (last in palette)", () => {
    expect(getPaletteColor(11)).toBe("#e11d48");
  });

  it("wraps around for index beyond palette length", () => {
    expect(getPaletteColor(12)).toBe("#3b82f6");
    expect(getPaletteColor(13)).toBe("#ef4444");
    expect(getPaletteColor(23)).toBe("#e11d48");
    expect(getPaletteColor(24)).toBe("#3b82f6");
  });

  it("handles large indices correctly", () => {
    expect(getPaletteColor(100)).toBe(getPaletteColor(100 % 12));
    expect(getPaletteColor(999)).toBe(getPaletteColor(999 % 12));
  });

  it("returns colors that are valid hex strings", () => {
    for (let i = 0; i < 20; i++) {
      expect(getPaletteColor(i)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("returns different colors for adjacent indices within palette", () => {
    for (let i = 0; i < 11; i++) {
      expect(getPaletteColor(i)).not.toBe(getPaletteColor(i + 1));
    }
  });
});
