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
| `src/ui/` | Screens and the placeholder avatar renderer |

`src/battle/engine.js` never touches the DOM and never imports the save layer —
it emits events, and `src/ui/screens/battle.js` draws them. That's what lets the
same simulation run headless in `tools/simulate.mjs`.

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
