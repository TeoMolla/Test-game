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
  guard:         { src: 'assets/sprites/goku/guard.png',         w: 129, h: 182, cx: 0.5116 },
  kick:          { src: 'assets/sprites/goku/kick.png',          w: 156, h: 182, cx: 0.4936 },

  // Redrawn from separate, larger sources and stored at 2x. Frames may differ
  // in pixel size: they are sized on screen by CSS height and anchored by cx,
  // so only the character's share of the canvas has to match.
  windup:        { src: 'assets/sprites/goku/windup.png',        w: 238, h: 364, cx: 0.4125 },
  punch:         { src: 'assets/sprites/goku/punch.png',         w: 284, h: 364, cx: 0.461 },
  recoil:        { src: 'assets/sprites/goku/recoil.png',        w: 217, h: 364, cx: 0.4478 },
  charge_start:  { src: 'assets/sprites/goku/charge_start.png',  w: 274, h: 364, cx: 0.4647 },
  charge_build:  { src: 'assets/sprites/goku/charge_build.png',  w: 251, h: 364, cx: 0.4682 },
  release:       { src: 'assets/sprites/goku/release.png',       w: 261, h: 364, cx: 0.4943 },
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
  // The punch runs wind-up -> contact -> recoil; the kick leads on the sheet's
  // neutral guard instead, because the punch wind-up telegraphs a right cross
  // and reads wrong in front of a high kick. Both settle on the same recoil.
  attack:    { priority: 1, clip: [['windup', 110], ['punch', 160], ['recoil', 150]] },
  attack_alt:{ priority: 1, clip: [['guard', 100], ['kick', 180], ['recoil', 140]] },
  hit:       { priority: 2, clip: [['stagger', 260]] },
  hit_heavy: { priority: 2, clip: [['knockback', 230], ['ground_impact', 260]] },
  technique: { priority: 3, clip: [['charge_start', 200], ['charge_build', 250], ['release', 430]] },
  ultimate:  { priority: 4, clip: [['charge_start', 250], ['charge_build', 310], ['release', 520]] },
  defeat:    { priority: 9, hold: true, clip: [['falling', 210], ['crumpled', 260], ['ko', 380]] },
};

/**
 * Frame index at which a beam effect should fire, per animation — the release
 * frame. It draws Goku's hands thrust forward but no beam; the beam is a DOM
 * effect so it can stretch to reach whatever it is aimed at.
 */
const BEAM_ON_FRAME = { technique: 2, ultimate: 2 };

/* ---------------- Saibaman (enemy) ----------------
   Sliced from a checkerboard sheet laid out in labelled bands; see the
   `checker` path in tools/slice-sprites.py. Every frame shares one canvas and
   is aligned to its band's ground line, so the airborne poses stay in the air.
   The sheet's WALK band is on disk but not referenced here — nothing in a
   turn-based fight walks, and an unused frame is dead weight in the bundle. */
const SAIBAMAN_FRAMES = {
  idle:   { src: 'assets/sprites/saibaman/idle.png',   w: 98,  h: 153, cx: 0.4796 },
  idle_b: { src: 'assets/sprites/saibaman/idle_b.png', w: 98,  h: 153, cx: 0.4694 },
  idle_c: { src: 'assets/sprites/saibaman/idle_c.png', w: 99,  h: 153, cx: 0.4798 },
  idle_d: { src: 'assets/sprites/saibaman/idle_d.png', w: 99,  h: 153, cx: 0.4747 },
  atk_a:  { src: 'assets/sprites/saibaman/atk_a.png',  w: 106, h: 153, cx: 0.6368 },
  atk_b:  { src: 'assets/sprites/saibaman/atk_b.png',  w: 118, h: 153, cx: 0.6441 },
  atk_c:  { src: 'assets/sprites/saibaman/atk_c.png',  w: 126, h: 153, cx: 0.6071 },
  atk_d:  { src: 'assets/sprites/saibaman/atk_d.png',  w: 129, h: 153, cx: 0.6783 },
  atk_e:  { src: 'assets/sprites/saibaman/atk_e.png',  w: 115, h: 153, cx: 0.6913 },
  atk_f:  { src: 'assets/sprites/saibaman/atk_f.png',  w: 116, h: 153, cx: 0.6724 },
  jump_a: { src: 'assets/sprites/saibaman/jump_a.png', w: 81,  h: 153, cx: 0.5123 },
  jump_b: { src: 'assets/sprites/saibaman/jump_b.png', w: 90,  h: 153, cx: 0.4778 },
  jump_c: { src: 'assets/sprites/saibaman/jump_c.png', w: 106, h: 153, cx: 0.4481 },
  jump_d: { src: 'assets/sprites/saibaman/jump_d.png', w: 110, h: 153, cx: 0.4818 },
  jump_e: { src: 'assets/sprites/saibaman/jump_e.png', w: 92,  h: 153, cx: 0.5326 },
  hurt_a: { src: 'assets/sprites/saibaman/hurt_a.png', w: 95,  h: 153, cx: 0.4211 },
  hurt_b: { src: 'assets/sprites/saibaman/hurt_b.png', w: 91,  h: 153, cx: 0.4011 },
  hurt_c: { src: 'assets/sprites/saibaman/hurt_c.png', w: 101, h: 153, cx: 0.3861 },
  hurt_d: { src: 'assets/sprites/saibaman/hurt_d.png', w: 112, h: 153, cx: 0.6429 },
};

/**
 * The Saibaman gets a four-frame idle rather than a held pose — it is the
 * enemy on screen most often, and a monster that never twitches reads as a
 * cardboard cut-out next to a hero that does.
 *
 * Its two attacks come from different bands: the claw slash for a swing, and
 * the leap for its technique, which is what makes Acid Spit look like a
 * different move rather than the same one at a different range.
 */
const SAIBAMAN_ANIMS = {
  idle:      { priority: 0, loop: true,
               clip: [['idle', 420], ['idle_b', 380], ['idle_c', 420], ['idle_d', 380]] },
  attack:    { priority: 1, clip: [['atk_a', 70], ['atk_b', 70], ['atk_c', 90],
                                   ['atk_d', 120], ['atk_e', 90], ['atk_f', 110]] },
  attack_alt:{ priority: 1, clip: [['jump_a', 80], ['jump_b', 90], ['jump_e', 110],
                                   ['atk_e', 100], ['atk_f', 110]] },
  hit:       { priority: 2, clip: [['hurt_a', 150], ['hurt_b', 170]] },
  hit_heavy: { priority: 2, clip: [['hurt_b', 140], ['hurt_c', 180], ['hurt_a', 160]] },
  technique: { priority: 3, clip: [['jump_c', 160], ['jump_d', 220], ['jump_e', 180]] },
  ultimate:  { priority: 4, clip: [['jump_c', 190], ['jump_d', 260], ['atk_d', 200]] },
  defeat:    { priority: 9, hold: true,
               clip: [['hurt_b', 150], ['hurt_c', 200], ['hurt_d', 420]] },
};

const SAIBAMAN_ART = {
  frames: SAIBAMAN_FRAMES,
  anims: SAIBAMAN_ANIMS,
  /* Frames are sized on screen by CSS height, so a set whose character fills
     more of its canvas than another's renders larger for free. `scale` is the
     correction, and it also does the storytelling: a Saibaman should stand a
     head shorter than Goku, not eye to eye with him. */
  scale: 0.84,
  portrait: { src: 'assets/sprites/saibaman/portrait.png', w: 782, h: 737 },
  bust: { src: 'assets/sprites/saibaman/bust.png', w: 470, h: 470 },
};

const SETS = {
  goku: {
    heroId: 'goku',
    frames: GOKU_FRAMES,
    anims: SPRITE_ANIMS,
    beamOnFrame: BEAM_ON_FRAME,
    portrait: { src: 'assets/sprites/goku/portrait.png', w: 437, h: 700 },
    bust: { src: 'assets/sprites/goku/bust.png', w: 437, h: 437 },
  },
  // Enemies are keyed by their enemy-definition id, which is why lookups take
  // whichever of heroId / defId a unit carries.
  saibaman: { ...SAIBAMAN_ART, id: 'saibaman' },
  // Same drawing, pushed darker and colder so the elite reads as a tougher
  // version of the thing you already know rather than a new monster.
  saibaman_elite: {
    ...SAIBAMAN_ART,
    id: 'saibaman_elite',
    filter: 'saturate(1.35) hue-rotate(-14deg) brightness(0.82) contrast(1.12)',
  },
};

/** The sprite set for a hero or enemy, or null when it uses the placeholder. */
export function spriteSet(id) {
  return (id && SETS[id]) || null;
}

export function hasSprites(id) {
  return !!spriteSet(id);
}

/** Every image URL a sprite set references — used by the single-file build. */
export function spriteUrls() {
  const urls = new Set();
  for (const set of Object.values(SETS)) {
    for (const f of Object.values(set.frames)) urls.add(f.src);
    urls.add(set.portrait.src);
    urls.add(set.bust.src);
  }
  // Deduped: two sets can share one drawing (the elite Saibaman is the plain
  // one under a filter), and the bundler would otherwise inline it twice.
  return [...urls];
}

/**
 * Bust markup for cards, portraits and the battle dock: the drawn art when a
 * hero has it, otherwise the CSS/SVG placeholder.
 * `art` is the placeholder descriptor from the hero definition.
 */
export function bustHTML(id, art, bustSVG) {
  const set = spriteSet(id);
  if (!set) return bustSVG(art);
  const f = set.filter ? ` style="filter:${set.filter}"` : '';
  return `<img class="art-img bust" src="${set.bust.src}"${f} alt="" decoding="async">`;
}

/** Full-body markup for the hero-detail portrait stage. */
export function portraitHTML(id, art, bustSVG) {
  const set = spriteSet(id);
  if (!set) return bustSVG(art);
  const f = set.filter ? ` style="filter:${set.filter}"` : '';
  return `<img class="art-img portrait" src="${set.portrait.src}"${f} alt="" decoding="async">`;
}
