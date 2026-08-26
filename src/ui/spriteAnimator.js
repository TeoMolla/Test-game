/**
 * ui/spriteAnimator.js — Plays a sprite clip on one unit's <img>.
 *
 * Clips are declared in ui/sprites.js. This only sequences frames and enforces
 * the interruption rules: a higher-priority clip cuts off a lower one (getting
 * hit interrupts a swing; dying interrupts everything), while an equal or lower
 * one is ignored until the current clip finishes.
 *
 * Timings are divided by the battle's speed multiplier so animations stay in
 * step with the simulation at x2 and x3.
 */

export function createAnimator(set, img, { speed = () => 1, onBeam = null } = {}) {
  let timer = null;
  let current = null;       // name of the clip playing, null when idle
  let priority = -1;
  let idleFrame = 'idle';
  let alive = true;

  function show(name) {
    const frame = set.frames[name];
    if (!frame) return;
    img.src = frame.src;
    img.style.setProperty('--cx', frame.cx);
  }

  function toIdle() {
    current = null;
    priority = -1;
    show(idleFrame);
  }

  /** Swap the resting pose — used to show a badly hurt unit reeling. */
  function setIdleFrame(name) {
    if (!set.frames[name] || idleFrame === name) return;
    idleFrame = name;
    if (!current) show(name);
  }

  /**
   * Start a clip. Returns how long it will run in ms (0 if it was ignored),
   * so the caller can schedule what happens afterwards.
   */
  function play(name) {
    if (!alive) return 0;
    const anim = set.anims[name];
    if (!anim) return 0;
    if (current && anim.priority <= priority) return 0;

    clearTimeout(timer);
    current = name;
    priority = anim.priority;

    const div = Math.max(0.25, speed());
    let total = 0;
    let i = 0;

    const step = () => {
      if (i >= anim.clip.length) {
        // A held clip stays "current" so nothing — not the resting-pose swap,
        // not a later hit — can put a downed unit back on its feet.
        if (!anim.hold) toIdle();
        return;
      }
      const [frameName, ms] = anim.clip[i];
      show(frameName);
      if (onBeam && set.beamOnFrame && set.beamOnFrame[name] === i) {
        onBeam(ms / div);
      }
      i += 1;
      timer = setTimeout(step, ms / div);
    };

    for (const [, ms] of anim.clip) total += ms / div;
    step();
    return total;
  }

  function stop() {
    alive = false;
    clearTimeout(timer);
  }

  show(idleFrame);
  return { play, stop, setIdleFrame, playing: () => current };
}
