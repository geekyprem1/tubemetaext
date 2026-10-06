export interface NavigationObserverHooks {
  addListener: (eventName: string, handler: () => void) => void;
  removeListener: (eventName: string, handler: () => void) => void;
  onInvalidated: () => void;
  setTimer: (callback: () => void, ms: number) => number;
  clearTimer: (timer: number) => void;
}

export interface NavigationObserver {
  start: () => void;
  stop: () => void;
  isActive: () => boolean;
}

const NAVIGATION_EVENTS = ['yt-navigate-finish', 'popstate', 'hashchange'];

export const OBSERVER_LEASE_MS = 120_000;

export function createNavigationObserver(
  hooks: NavigationObserverHooks,
  leaseMs: number = OBSERVER_LEASE_MS,
): NavigationObserver {
  let active = false;
  let timer: number | null = null;

  function handleNavigation(): void {
    if (active) hooks.onInvalidated();
  }

  function stop(): void {
    if (timer !== null) {
      hooks.clearTimer(timer);
      timer = null;
    }
    if (!active) return;
    active = false;
    for (const eventName of NAVIGATION_EVENTS) {
      hooks.removeListener(eventName, handleNavigation);
    }
  }

  function start(): void {
    if (!active) {
      active = true;
      for (const eventName of NAVIGATION_EVENTS) {
        hooks.addListener(eventName, handleNavigation);
      }
    }
    if (timer !== null) hooks.clearTimer(timer);
    timer = hooks.setTimer(stop, leaseMs);
  }

  return { start, stop, isActive: () => active };
}
