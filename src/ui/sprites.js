/**
 * ui/sprites.js — Hand-drawn sprite sets, and the fallback rule.
 *
 * A hero either has a sprite set here or it doesn't. Heroes that don't fall
 * back to the CSS/SVG placeholder in ui/avatar.js, so the roster can mix drawn
 * characters with placeholder ones while art is still being made — nothing
 * outside this module needs to know which is which.
 *
 * Frames were sliced from the source sheet by tools/ (see assets/sprites/).
 * Every battle frame shares one canvas height and one drawing scale, and is
 * bottom-aligned on that canvas, so the character never changes size or jumps
 * off the ground between poses. `cx` is the character's torso centre as a
 * fraction of the frame's width: the renderer pins that point to the unit's
 * centre, which is what stops a wide pose (a high kick, a knockback) from
 * sliding the character sideways.
 *
 * PLACEHOLDER: frame durations below are feel, not measurement — tune freely.
 */

/* Paths are written out in full rather than assembled from a prefix: the
   single-file build finds every asset by scanning for literal 'assets/...'
   strings and swaps them for data URIs. */
/** w/h/cx come from the slicing step; see assets/sprites/goku/frames.json. */
const GOKU_FRAMES = {
  idle:          { src: 'assets/sprites/goku/idle.png',          w: 111, h: 182, cx: 0.5 },
  windup:        { src: 'assets/sprites/goku/windup.png',        w: 129, h: 182, cx: 0.5116 },
  punch:         { src: 'assets/sprites/goku/punch.png',         w: 139, h: 182, cx: 0.4424 },
  kick:          { src: 'assets/sprites/goku/kick.png',          w: 156, h: 182, cx: 0.4936 },
  charge_a:      { src: 'assets/sprites/goku/charge_a.png',      w: 126, h: 182, cx: 0.5119 },
  charge_b:      { src: 'assets/sprites/goku/charge_b.png',      w: 127, h: 182, cx: 0.5236 },
  release:       { src: 'assets/sprites/goku/release.png',       w: 121, h: 182, cx: 0.5537 },
  stagger:       { src: 'assets/sprites/goku/stagger.png',       w: 100, h: 182, cx: 0.47 },
  knockback:     { src: 'assets/sprites/goku/knockback.png',     w: 168, h: 182, cx: 0.4524 },
  ground_impact: { src: 'assets/sprites/goku/ground_impact.png', w: 110, h: 182, cx: 0.4091 },
  heavy_stun:    { src: 'assets/sprites/goku/heavy_stun.png',    w: 97,  h: 182, cx: 0.4691 },
  falling:       { src: 'assets/sprites/goku/falling.png',       w: 133, h: 182, cx: 0.5113 },
  crumpled:      { src: 'assets/sprites/goku/crumpled.png',      w: 104, h: 182, cx: 0.4856 },
  ko:            { src: 'assets/sprites/goku/ko.png',            w: 202, h: 182, cx: 0.4554 },
};

/**
 * Clips are [frameName, milliseconds] pairs.
 *
 * `hold: true` means the last frame stays up instead of returning to idle —
 * used for defeat, where the unit is done acting.
 *
 * `priority` decides what may interrupt what:
 *   - getting hit interrupts a basic swing, which reads as the hit landing
 *   - but a technique or ultimate plays through hits. A front-row hero takes
 *     chip damage almost continuously, so letting hits interrupt these cancels
 *     the release frame — and the payoff of a Kamehameha is the release frame.
 *     The hit flash still fires, so being hit is never silent.
 *   - death outranks everything, so a unit that dies mid-swing stops swinging.
 */
const SPRITE_ANIMS = {
  idle:      { priority: 0, loop: true,  clip: [['idle', 1000]] },
  attack:    { priority: 1, clip: [['windup', 110], ['punch', 170]] },
  attack_alt:{ priority: 1, clip: [['windup', 110], ['kick', 190]] },
  hit:       { priority: 2, clip: [['stagger', 260]] },
  hit_heavy: { priority: 2, clip: [['knockback', 230], ['ground_impact', 260]] },
  technique: { priority: 3, clip: [['charge_a', 170], ['charge_b', 190], ['release', 430]] },
  ultimate:  { priority: 4, clip: [['charge_a', 200], ['charge_b', 240], ['release', 520]] },
  defeat:    { priority: 9, hold: true, clip: [['falling', 210], ['crumpled', 260], ['ko', 380]] },
};

/**
 * Frame index at which a beam effect should fire, per animation. The release
 * frame draws Goku's hands thrust forward but no beam — the beam is a DOM
 * effect so it can stretch to reach whatever it is aimed at.
 */
const BEAM_ON_FRAME = { technique: 2, ultimate: 2 };

const SETS = {
  goku: {
    heroId: 'goku',
    frames: GOKU_FRAMES,
    anims: SPRITE_ANIMS,
    beamOnFrame: BEAM_ON_FRAME,
    portrait: { src: 'assets/sprites/goku/portrait.png', w: 437, h: 700 },
    bust: { src: 'assets/sprites/goku/bust.png', w: 437, h: 437 },
  },
};

/** The sprite set for a hero, or null when it should use the placeholder. */
export function spriteSet(heroId) {
  return (heroId && SETS[heroId]) || null;
}

export function hasSprites(heroId) {
  return !!spriteSet(heroId);
}

/** Every image URL a sprite set references — used by the single-file build. */
export function spriteUrls() {
  const urls = [];
  for (const set of Object.values(SETS)) {
    for (const f of Object.values(set.frames)) urls.push(f.src);
    urls.push(set.portrait.src, set.bust.src);
  }
  return urls;
}

/**
 * Bust markup for cards, portraits and the battle dock: the drawn art when a
 * hero has it, otherwise the CSS/SVG placeholder.
 * `art` is the placeholder descriptor from the hero definition.
 */
export function bustHTML(heroId, art, bustSVG) {
  const set = spriteSet(heroId);
  if (!set) return bustSVG(art);
  return `<img class="art-img bust" src="${set.bust.src}" alt="" decoding="async">`;
}

/** Full-body markup for the hero-detail portrait stage. */
export function portraitHTML(heroId, art, bustSVG) {
  const set = spriteSet(heroId);
  if (!set) return bustSVG(art);
  return `<img class="art-img portrait" src="${set.portrait.src}" alt="" decoding="async">`;
}
