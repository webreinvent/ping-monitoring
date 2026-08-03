import { ref, computed, watch } from "vue";

/**
 * Time window preset definitions.
 */
const TIME_WINDOW_PRESETS: Record<string, number> = {
  "1h": 3_600_000,
  "6h": 21_600_000,
  "24h": 86_400_000,
  "7d": 604_800_000,
};

/**
 * Composable for managing the selected time window preset.
 * Persists selection to localStorage so it survives page navigation.
 */
export function useTimeWindow() {
  const STORAGE_KEY = "lnpm-chart-time-window";

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

  return {
    selectedPreset,
    fromMs,
    toMs,
    selectPreset,
  };
}
