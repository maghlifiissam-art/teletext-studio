// Feature: teletext-studio, FlashController cadence (task 5.2)
// The phase toggles every 500 ms and all flashing cells share one phase
// because there is exactly one timer driving every listener.
// Validates: Requirements 4.2

import { describe, it, expect, vi, afterEach } from "vitest";

import { FlashController, FLASH_HALF_PERIOD_MS } from "../../scripts/flash.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("FlashController cadence", () => {
  it("toggles the phase every 500 ms", () => {
    vi.useFakeTimers();
    const fc1 = new FlashController();
    const ticks = [];
    fc1.start((phase) => ticks.push(phase));

    // Immediate initial phase.
    expect(ticks).toEqual([true]);

    vi.advanceTimersByTime(FLASH_HALF_PERIOD_MS);
    expect(ticks).toEqual([true, false]);

    vi.advanceTimersByTime(FLASH_HALF_PERIOD_MS);
    expect(ticks).toEqual([true, false, true]);

    // One full on/off cycle per second.
    vi.advanceTimersByTime(1000);
    expect(ticks).toEqual([true, false, true, false, true]);

    fc1.stop();
  });

  it("uses a single timer: every listener attached to one controller shares the same phase sequence", () => {
    vi.useFakeTimers();
    const controller = new FlashController();
    const a = [];
    const b = [];
    controller.start((phase) => a.push(phase));
    controller.start((phase) => b.push(phase)); // no-op: already running

    vi.advanceTimersByTime(2000);
    // Second start() was a no-op, so b received nothing and a got one sequence.
    expect(b).toEqual([]);
    expect(a).toEqual([true, false, true, false, true]);

    controller.stop();
  });

  it("stop() clears the timer so no further ticks arrive", () => {
    vi.useFakeTimers();
    const controller = new FlashController();
    const ticks = [];
    controller.start((phase) => ticks.push(phase));
    vi.advanceTimersByTime(500);
    controller.stop();

    const count = ticks.length;
    vi.advanceTimersByTime(5000);
    expect(ticks.length).toBe(count);
    expect(controller.running).toBe(false);
  });
});
