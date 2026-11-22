/*
 * scripts/flash.js — FlashController.
 *
 * One shared clock for every flashing cell on the page (Req. 4.2): a single
 * interval toggles the flash phase every 500 ms, so all flashing cells show
 * and hide in perfect sync (0.5 s visible / 0.5 s hidden = one full cycle per
 * second, matching classic teletext).
 *
 * The controller owns no rendering state: on each toggle it calls onTick with
 * the new phase, and the UI applies it (the DOM backend flips one container
 * attribute and CSS hides the affected cells synchronously).
 */

export const FLASH_HALF_PERIOD_MS = 500;

export class FlashController {
  constructor() {
    this.flashOn = true;
    this._timer = null;
  }

  /**
   * Start the shared clock. Calls onTick(flashOn) immediately with the
   * current phase, then on every 500 ms toggle. Starting an already-running
   * controller is a no-op, so there is never more than one timer.
   *
   * @param {(flashOn: boolean) => void} onTick
   */
  start(onTick) {
    if (this._timer !== null) {
      return;
    }
    onTick(this.flashOn);
    this._timer = setInterval(() => {
      this.flashOn = !this.flashOn;
      onTick(this.flashOn);
    }, FLASH_HALF_PERIOD_MS);
  }

  /** Stop the clock and clear the single timer. */
  stop() {
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  /** True while the shared clock is running. */
  get running() {
    return this._timer !== null;
  }
}
