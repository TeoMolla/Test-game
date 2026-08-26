# Z-Fighters — Dragon Ball Auto-Battle RPG Prototype

A mobile-first, browser-based **real-time auto-battle RPG** set in the Saiyan Saga.
Plain HTML/CSS/JavaScript — no framework, no build step, no dependencies.

Personal, non-commercial fan prototype. All character art is a clearly-labelled
CSS/SVG placeholder (`src/ui/avatar.js`), not real artwork.

## Running it

ES modules need an HTTP origin, so serve the folder rather than opening
`index.html` from disk:

```bash
python3 -m http.server 8000     # or: npx serve
```

Then open `http://localhost:8000` on your machine, or
`http://<your-LAN-ip>:8000` in iPhone Safari/Chrome on the same Wi-Fi.
Progress saves to `localStorage`, so it survives closing the tab.

## What's playable

- **Campaign** — 6 story stages, Saibamen → Raditz → Nappa → Vegeta, each with a
  recommended team power and its own enemy team.
- **Formation** — pick up to 3 heroes and assign each to the front or back row
  before the fight.
- **Sprites** — Goku is drawn art: 14 frames driving idle, punch/kick, the
  Kamehameha charge-and-release, stagger/knockback, a hurt resting pose below
  25% HP, and a three-frame defeat. Every other hero still uses the CSS
  placeholder, and the two mix freely on the same screen.
- **Battle** — real-time, side-view lanes. Every unit runs its own timers:
  auto-attack on its attack interval, auto-technique the moment it leaves
  cooldown, ultimate the instant its meter fills. Floating damage numbers, per-unit
  HP bars, and a bottom portrait row showing each hero's technique countdown and
  ultimate-ready state.
- **Roster** — 6 heroes (3 Rare, 3 Uncommon). Unowned heroes are greyed out with a
  shard-collection fraction toward unlocking them.
- **Hero detail** — Stats (level, ATK/HP/DEF/SPD, power, 4 gear slots), Stars
  (0–5★ promotion with a stat preview and skill-slot unlocks), Skills.
- **Gear** — weapon/chest/gloves/boots, dropped from stages, equip/unequip.
- **Bag** — zeni, shards, gear, record, reset.

## Module map

Each directory is independently swappable and exposes a small interface; the
systems talk through those interfaces only.

| Module | Responsibility |
| --- | --- |
| `src/config.js` | All balance knobs and the rarity/star/skill-slot rules |
| `src/hero/` | Hero definitions; stat/power derivation, promotion, levelling |
| `src/skills/` | Skill definitions; which slots a hero has unlocked |
| `src/battle/` | Headless real-time combat loop, targeting, damage |
| `src/gear/` | Equipment definitions, bonus totals, drop rolls |
| `src/progression/` | Stages, enemy units, stage gating and reward payout |
| `src/inventory/` | Zeni, shards, gear ownership — the only place resources move |
| `src/save/` | The player-state object and its localStorage persistence |
| `src/ui/` | Screens, the sprite layer, and the placeholder avatar renderer |

`src/battle/engine.js` never touches the DOM and never imports the save layer —
it emits events, and `src/ui/screens/battle.js` draws them. That's what lets the
same simulation run headless in `tools/simulate.mjs`.

### Sprites

`src/ui/sprites.js` is the whole contract: a hero either has a sprite set there
or it doesn't, and one without falls back to the CSS/SVG placeholder in
`src/ui/avatar.js`. Nothing else in the game knows which is which, so characters
can be drawn one at a time without a flag day.

Frames come from a flat sheet of poses on white paper. `tools/slice-sprites.py`
cuts it up — keying the paper, dropping the sheet's own captions and rule lines,
putting every pose on one canvas height and one ground line, and recording each
pose's torso centre (`cx`) so a wide pose like a high kick doesn't slide the
character sideways. Adding a character is an entry in that script's `SHEETS`
table plus the frame block it prints:

```bash
python3 tools/slice-sprites.py          # reads art/, writes assets/sprites/
```

Clip timings and the interruption rules live in `SPRITE_ANIMS`. Priority is the
part worth understanding: a hit interrupts a basic swing, but *not* a technique
or ultimate — a front-row hero takes chip damage almost continuously, and
letting hits interrupt those cancels the release frame, which is the whole
payoff of a Kamehameha.

Source frames are 182px tall and render at ~104 CSS px, so on a 3x phone screen
they are upscaled and read a little soft. Redrawing at ~320px tall would make
them crisp; nothing in the code needs to change if the art gets bigger.

### Tuning

Balance values are deliberately unbalanced first-pass numbers and are marked
`PLACEHOLDER` in comments. The main dials live in `src/config.js`
(rarity multipliers, star rungs, skill-slot thresholds, damage formula, ultimate
charge rate), with per-hero, per-skill, per-enemy and per-stage numbers in their
own data files.

Two rules are written as switches rather than hard-coded:

- `TARGETING_MODE` — how strictly the back row is protected.
- `ULTIMATE_MODE` — `'auto'` fires ultimates the moment they charge (current
  behaviour); `'tap'` makes the battle-dock portraits the activation control.

### Balance harness

```bash
node tools/simulate.mjs 40     # 40 runs per stage
```

Runs every stage headless against a starting, early-mid, mid and late-game team
and prints win rate, average duration and average survivors.

## Reference material

`reference/afk-arena/` holds the four AFK Arena screenshots used as **structural**
references for the battle, roster and hero-detail screens. Nothing from them is
reproduced — the layouts are reskinned, and all art here is placeholder.

## Not in this pass

Transformations / power-up forms (the data model reserves a fifth skill slot for
them but nothing is built), faction or elemental advantages, a large gear pool,
PvP or endless modes, sound, and real art.
