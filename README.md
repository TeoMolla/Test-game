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
- **Sprites** — Goku is drawn art: 16 frames driving idle, a wind-up /
  contact / recoil punch, a kick, a three-stage Kamehameha, stagger and
  knockback, a hurt resting pose below 25% HP, and a three-frame defeat. Every
  other hero still uses the CSS placeholder, and the two mix freely on the
  same screen.
- **Engagement** — melee front-liners run in and square up on the enemy they
  are actually fighting; ranged and back-row units hold and support. Attackers
  sharing a target fan out around it, so a group visibly closes in on one
  defender. Nobody acts until they have arrived.
- **Ultimates** — firing one stops time: everything else holds while the cast
  plays out alone. A unit never fires a technique and an ultimate together.
- **Battle** — real-time, side-view lanes. Every unit runs its own timers:
  auto-attack on its attack interval, auto-technique the moment it leaves
  cooldown, ultimate the instant its meter fills. Floating damage numbers, per-unit
  HP bars, and a bottom portrait row showing each hero's technique countdown and
  ultimate-ready state.
- **Your hero** — Goku is the protagonist: he leads every team, cannot be
  benched, and is the only character who wears gear. He sits in his own panel
  above the collection rather than as one card among six.
- **Allies** — the other 5 are support. Recruited with shards, promoted with
  stars, brought two at a time — but no gear and no deep progression, so the
  attention stays on your hero. Unowned allies are greyed out with a shard
  fraction toward recruiting them.
- **Hero detail** — Stats (level and XP bar, ATK/HP/DEF/SPD, power, 4 gear
  slots), Stars (0–5★ promotion with a stat preview and skill-slot unlocks),
  Skills.
- **Levelling** — the two tracks are deliberately different. Your hero is
  *blooded*: battle XP is his alone, and his level is derived from lifetime XP
  rather than stored. Allies are *trained*: senzu beans plus zeni, and they
  cannot get more than a few levels ahead of him.
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

Frames do not all have to be the same pixel size. The renderer sizes them by CSS
height and anchors them by `cx`, so only the character's share of the canvas has
to match — which means a redraw can be stored at higher density than the frames
around it. The punch and Kamehameha sequences came from larger separate drawings
and are kept at 2x for that reason; the rest are 182px tall and render at ~104
CSS px, so on a 3x phone screen they are upscaled and read a little soft.
Redrawing any of them bigger needs no code change, just a higher `density`.

Redraws are handled by the `overrides` block in `tools/slice-sprites.py`: point
it at another image, name the pose in it that matches a frame on the main sheet,
and one scale derived from that pair is applied to every frame in the image.
Deriving the scale per image rather than per frame is the important part — poses
in a sequence are not all the same height, so scaling each to a fixed height
would quietly resize the character between frames of one animation.

### Tuning

**Fight length is one knob**: `HP_SCALE` in `src/config.js` multiplies the HP of
everyone on the field. Raise it for longer fights, lower it for shorter. It is
close to neutral on who wins — both sides gain the same survivability — but not
exactly: auto-attacks scale with the clock while techniques run on fixed
cooldowns and ultimates on a charge meter, so a longer fight means more casts
and quietly favours whoever has the deeper kit. That is usually the player's
three full loadouts, not a mob with two skills, so raising it softens the
difficulty walls. Re-run the harness after changing it.

Balance values are deliberately unbalanced first-pass numbers and are marked
`PLACEHOLDER` in comments. The main dials live in `src/config.js`
(rarity multipliers, star rungs, skill-slot thresholds, damage formula, ultimate
charge rate), with per-hero, per-skill, per-enemy and per-stage numbers in their
own data files.

Four rules are written as switches rather than hard-coded:

- `TARGETING_MODE` — how strictly the back row is protected.
- `ULTIMATE_MODE` — `'auto'` fires ultimates the moment they charge (current
  behaviour); `'tap'` makes the battle-dock portraits the activation control.
- `FOCUS_FIRE` — whether a unit picking a new target prefers the one its allies
  are already on. This is what makes a group gang up rather than spread damage,
  and it is a real difficulty lever in both directions: concentrated damage
  removes attackers sooner, so fights resolve faster than with damage spread.
- `engagesInMelee(row, attackSkill)` — who runs in. Front row with a
  non-`ranged` auto-attack, currently; it is what gives the formation choice
  its teeth, since the back row trades safety for holding position.

`COMBAT.ultimateFreezeSeconds` holds the whole world when an ultimate fires —
timers, cooldowns, the battle clock, every other unit. The cast's own animation
runs off the wall clock, so it plays straight through the hold and has the
screen to itself. The dim-and-desaturate staging in `battle.css` is a
placeholder for the real cut-in. `COMBAT.castRecoverySeconds` is the companion
rule: after any technique or ultimate that unit does nothing at all for a beat,
which is what stops a hero firing its technique on the tick after its ultimate
and reading as both at once.

`COMBAT.approachSeconds` sets how long closing takes. The engine gates every
unit's first action on the same value the run-in animates over, so the
simulation and what is on screen never disagree.

### The economy

Three resources, three jobs, all fed by the same stages:

| | earned from | spent on | role |
| --- | --- | --- | --- |
| **XP** | every stage clear, hero only | your hero's levels | the campaign's own reward |
| **Zeni** | every stage | ally training | plentiful — the volume knob |
| **Senzu** | stage 2 onward, more the deeper you go | ally training | the real throttle |
| **Shards** | per-hero, from stages | recruiting and star-ups | the collection loop |

Senzu is what ties the two tracks together. Stage 6 pays four beans a run
against stage 2's one, so how fast your allies grow is set by how deep *you*
can farm — which means pushing your hero forward is always the way to raise the
team. Zeni is deliberately easy: it is rarely the thing stopping you, it just
has to be spent.

`tools/economy.mjs` prints both curves side by side and, most usefully, which
resource is actually binding as the hero climbs. Beans should be the constraint
across the range the campaign covers; if the ally cap starts binding instead,
beans have gone too cheap and the resource has stopped meaning anything.

```bash
node tools/economy.mjs
```

### Where power comes from

Power is meant to read as a sum of several tracks rather than a proxy for any
one of them. `tools/simulate.mjs` prints the split for each profile — currently
about **31-42% level, 44-58% stars, 18-25% gear**. If one track ever starts to
dominate that line, the curve needs rebalancing, not the gates.

### Balance harness

```bash
node tools/simulate.mjs 40     # 40 runs per stage
```

Runs every stage headless against a starting, early-mid, mid and late-game team
and prints win rate, average duration and average survivors. The campaign's
`requiredPower` gates are derived from its output rather than guessed, so that
"you are underpowered" honestly predicts a loss at every stage.

## Reference material

`reference/afk-arena/` holds the four AFK Arena screenshots used as **structural**
references for the battle, roster and hero-detail screens. Nothing from them is
reproduced — the layouts are reskinned, and all art here is placeholder.

## Not in this pass

Transformations / power-up forms (the data model reserves a fifth skill slot for
them but nothing is built), faction or elemental advantages, a large gear pool,
PvP or endless modes, sound, and real art.
