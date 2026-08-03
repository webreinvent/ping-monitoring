const MOBILE_BREAKPOINT = 980;

export function useResponsiveSidebar() {
  // Whether we're on mobile (matches CSS breakpoint at 980px)
  const isMobile = ref(
    typeof window !== "undefined" && window.innerWidth <= MOBILE_BREAKPOINT,
  );

  // Listen for resize events
  if (import.meta.client) {
    let rafId: number | null = null;
    window.addEventListener(
      "resize",
      () => {
        if (rafId !== null) return; // Throttle with rAF
        rafId = requestAnimationFrame(() => {
          isMobile.value = window.innerWidth <= MOBILE_BREAKPOINT;
          rafId = null;
        });
      },
      { passive: true },
    );
  }

  // Sidebar open state (mobile only; desktop always visible)
  const isOpen = ref(false);

  // Close sidebar on navigation (mobile)
  if (import.meta.client) {
    const router = useRouter();
    router.afterEach(() => {
      if (isMobile.value) {
        isOpen.value = false;
      }
    });
  }

  function toggle(): void {
    isOpen.value = !isOpen.value;
  }

  function open(): void {
    isOpen.value = true;
  }

  function close(): void {
    isOpen.value = false;
  }

  return { isMobile, isOpen, toggle, open, close };
}
