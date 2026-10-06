import { describe, expect, it, vi } from 'vitest';
import { createNavigationObserver } from '../../src/content/navigation';

function makeHarness(leaseMs = 1_000) {
  const listeners = new Map<string, Set<() => void>>();
  const invalidated = vi.fn();
  const clearedTimers: number[] = [];
  let timerCallback: (() => void) | null = null;
  let timerMsValue = 0;
  let nextTimerId = 1;

  const observer = createNavigationObserver(
    {
      addListener: (eventName, handler) => {
        const set = listeners.get(eventName) ?? new Set();
        set.add(handler);
        listeners.set(eventName, set);
      },
      removeListener: (eventName, handler) => {
        listeners.get(eventName)?.delete(handler);
      },
      onInvalidated: invalidated,
      setTimer: (callback, ms) => {
        timerCallback = callback;
        timerMsValue = ms;
        return nextTimerId++;
      },
      clearTimer: (timer) => {
        clearedTimers.push(timer);
        timerCallback = null;
      },
    },
    leaseMs,
  );

  return {
    observer,
    invalidated,
    clearedTimers,
    listenerCount: () =>
      Array.from(listeners.values()).reduce((total, set) => total + set.size, 0),
    emit: (eventName: string) => {
      for (const handler of listeners.get(eventName) ?? []) handler();
    },
    fireLease: () => {
      if (timerCallback) timerCallback();
    },
    timerMs: () => timerMsValue,
  };
}

describe('createNavigationObserver', () => {
  it('installs one listener per navigation signal and ignores events before start', () => {
    const harness = makeHarness();
    harness.emit('yt-navigate-finish');
    expect(harness.invalidated).not.toHaveBeenCalled();

    harness.observer.start();
    expect(harness.listenerCount()).toBe(3);
    harness.observer.start();
    expect(harness.listenerCount()).toBe(3);
    expect(harness.observer.isActive()).toBe(true);
  });

  it('reports each navigation while active and renews the lease on start', () => {
    const harness = makeHarness(1_500);
    harness.observer.start();
    expect(harness.timerMs()).toBe(1_500);
    harness.observer.start();
    expect(harness.clearedTimers.length).toBe(1);

    harness.emit('yt-navigate-finish');
    harness.emit('hashchange');
    expect(harness.invalidated).toHaveBeenCalledTimes(2);
  });

  it('stops on the bounded lease and after a manual stop, without duplicate listeners', () => {
    const harness = makeHarness(500);
    harness.observer.start();
    harness.fireLease();
    expect(harness.observer.isActive()).toBe(false);
    expect(harness.listenerCount()).toBe(0);
    harness.emit('yt-navigate-finish');
    expect(harness.invalidated).not.toHaveBeenCalled();

    harness.observer.start();
    harness.observer.stop();
    harness.observer.stop();
    expect(harness.listenerCount()).toBe(0);
    expect(harness.observer.isActive()).toBe(false);
  });
});
