import { ref, computed, watch } from "vue";

/**
 * Time window preset definitions.
 */
const TIME_WINDOW_PRESETS: Record<string, number> = {
  "live": 60_000,
  "5m": 300_000,
  "10m": 600_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  "6h": 21_600_000,
  "12h": 43_200_000,
  "24h": 86_400_000,
  "7d": 604_800_000,
  "30d": 2_592_000_000,
};

/**
 * Composable for managing the selected time window preset.
 * Persists selection to localStorage so it survives page navigation.
 */
export function useTimeWindow() {
  const STORAGE_KEY = "lnpm-chart-time-window-v2";

  const selectedPreset = ref<string>("1h");

  // Restore from localStorage on init (client-side only)
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored in TIME_WINDOW_PRESETS) {
        selectedPreset.value = stored;
      }
    } catch {
      // localStorage unavailable — ignore
    }
  }

  // Watch for changes and persist
  watch(selectedPreset, (preset: string) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, preset);
      } catch {
        // localStorage unavailable — ignore
      }
    }
  });

  /** Epoch ms of the window start */
  const fromMs = computed(() => {
    const duration = TIME_WINDOW_PRESETS[selectedPreset.value] ?? 3_600_000;
    return Date.now() - duration;
  });

  /** Epoch ms of the window end (now) */
  const toMs = computed(() => Date.now());

  /** Change the time window preset */
  function selectPreset(preset: string): void {
    if (preset in TIME_WINDOW_PRESETS) {
      selectedPreset.value = preset;
    }
  }

  /**
   * Compute the currently selected window (epoch ms) fresh on each call.
   * Sliding consumers (live-window re-resolution) call this at fetch time so
   * the window tracks "now"; duration resolution stays single-sourced in
   * TIME_WINDOW_PRESETS.
   */
  function currentWindow(): { fromMs: number; toMs: number } {
    const now = Date.now();
    const duration = TIME_WINDOW_PRESETS[selectedPreset.value] ?? 3_600_000;
    return { fromMs: now - duration, toMs: now };
  }

  return {
    selectedPreset,
    fromMs,
    toMs,
    selectPreset,
    currentWindow,
  };
}
