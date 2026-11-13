import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformLifecycle } from '../../src/platform/lifecycle';

describe('Platform Lifecycle', () => {
  beforeEach(() => {
    // Reset any state if needed
  });

  it('allows registering and unregistering lifecycle listeners', () => {
    const onPause = vi.fn();
    const onResume = vi.fn();

    const unsubscribe = PlatformLifecycle.addListener({
      onPause,
      onResume
    });

    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });

  it('exposes initial paused state as false', () => {
    expect(PlatformLifecycle.getIsPaused()).toBe(false);
  });
});
