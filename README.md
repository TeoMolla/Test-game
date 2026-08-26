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
- **Dungeons** — repeatable gear runs, on their own tab, deliberately outside
  the story. The Z Dungeon holds one arc per saga; the Saiyan Saga is built and
  Namek is a greyed-out signpost for what comes next. Four difficulties —
  Easy (Raditz), Normal (Nappa), Hard (Vegeta) and the bonus Extreme (all
  three at once) — each opened by clearing the one below it, and each rolling
  gear in its own level band.
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
- **Hero** — Goku is the protagonist: he leads every team, cannot be benched,
  and is the only character who wears gear. His tab is deliberately quiet: team
  power, his own card, and the two companions currently fighting beside him.
  Nothing to manage, nothing to buy — it answers "how strong am I right now"
  and gets out of the way.
- **Companions** — a separate tab holding everything you *do* to the
  collection: the two slot levels, recruiting, and the owned-only grid you tap
  into to star someone up. Splitting it this way keeps the roster's growing
  management surface off the screen you check between fights. Companions you
  have not met are not shown at all — the Bag tracks shard progress toward
  them, and a Recruit button appears here once you can afford one.
- **Two equipped slots** fight beside your hero; the rest of the collection
  stays home. Companions are recruited with shards, starred up with shards, and
  wear no gear and earn no XP.
- **Companion slots carry the level, not the companions.** Each of the two
  slots has its own level bought with senzu beans and zeni, and every companion
  you own fights at the level of the *lowest* slot. Running one slot ahead buys
  nothing, so the investment has to be spread — and a companion recruited today
  arrives already useful instead of starting at level 1. Capped at your hero's
  level, strictly.
- **Bonds** — every companion you own lends your hero stats whether or not it
  is fielded: the two equipped lend in full, the rest a quarter. The amount
  scales with rarity and star rank, so starring up a companion you never field
  is still worth doing. Currently 5–11% of the hero's power.
- **Hero detail** — Stats (level and XP bar, ATK/HP/DEF/SPD, power, 4 gear
  slots), Stars (0–5★ promotion with a stat preview and skill-slot unlocks),
  Skills.
- **Levelling** — the two tracks are deliberately different. Your hero is
  *blooded*: battle XP is his alone, and his level is derived from lifetime XP
  rather than stored. Companions are *trained*, through the slots above.
- **Gear** — weapon/chest/gloves/boots, equip/unequip. Every piece drops with a
  **level** beside its rarity and keeps it forever; there is no upgrading. A
  level is worth +8% of the item's own base stats, so a Lv.40 piece is 4.1x its
  Lv.1 self — which makes level, not rarity, the thing you farm.
- **Slot levels** — each of the four slots carries its own bought level, shown
  as a `+N` on the slot. Scrap gear you will not use for **iron** in the Bag,
  spend iron raising a slot, and the slot multiplies whatever is in it.
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
| `src/progression/` | Stages, dungeons, enemy units, gating and reward payout |
| `src/inventory/` | Zeni, shards, gear ownership — the only place resources move |
| `src/save/` | The player-state object and its localStorage persistence |
| `src/ui/` | Screens, the sprite layer, and the placeholder avatar renderer |

`src/battle/engine.js` never touches the DOM and never imports the save layer —
it emits events, and `src/ui/screens/battle.js` draws them. That's what lets the
same simulation run headless in `tools/simulate.mjs`.

The battle and results screens do not know whether a fight came from the story
or a dungeon. Both are handed an *encounter reference* — `{kind:'stage',...}`
or `{kind:'dungeon',...}` — which `progression/` resolves into a name, a
lineup, a recommended power and something to call on victory. That is why
adding dungeons touched neither screen's logic, and why a third source of
fights would touch neither either.

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

Five resources, five jobs. The first three all come from story stages:

| | earned from | spent on | role |
| --- | --- | --- | --- |
| **XP** | every stage clear, hero only | your hero's levels | the campaign's own reward |
| **Zeni** | every stage | companion slot levels | plentiful — the volume knob |
| **Senzu** | stage 2 onward, more the deeper you go | companion slot levels | the real throttle |
| **Shards** | per-hero, from stages | recruiting and star-ups | the collection loop, and bonds |
| **Iron** | scrapping surplus gear | gear slot levels | the sink that makes duplicates worth having |

Senzu is what ties the two tracks together. Stage 6 pays four beans a run
against stage 2's one, so how fast your companions grow is set by how deep *you*
can farm — which means pushing your hero forward is always the way to raise the
team. Two slots means paying the bean cost twice per effective companion level.
Zeni is deliberately easy: it is rarely the thing stopping you, it just has to
be spent.

Shards do double duty now. They recruit a companion, and every star after that
raises what its bond lends your hero — so shards for a companion you will never
field are still worth collecting.

### Gear levels

Gear has two axes and they move at deliberately different speeds.

**Rarity** climbs slowly and chunkily. The entire Saiyan Saga runs common,
common, uncommon, uncommon, with rare appearing only as a 12% bonus on Extreme.
Rare becoming routine is Namek's job.

**Level** climbs every tier, and is what you are actually farming. It is set at
drop time and never changes — no upgrading, no re-rolling. There is no level
cap and no tie to the hero's level; the only limit is content, because every
drop source declares the band it rolls in:

| source | rarity | level |
| --- | --- | --- |
| Story stages 1–6 | common only | 1–6, rising with the arc |
| Boss stages (3, 5, 6) | common, **guaranteed** | 5 / 8 / 12 |
| Easy dungeon — Raditz | common | 5–10 |
| Normal dungeon — Nappa | common | 10–18 |
| Hard dungeon — Vegeta | uncommon | 18–28 |
| Extreme — all three | uncommon, 12% rare | 28–40 |

Two consequences worth stating. The story is a poor gear source on purpose —
its job is XP, beans and shards — but each boss hands over one guaranteed piece
above anything that stage rolls, so clearing a boss is never a dry run and
always moves your gear floor up. And Easy and Normal drop the *same rarity*:
the only reason to run the harder one is level, which is exactly the point of
making level the main axis.

Adding a saga raises the ceiling with no code change — a new tier just declares
a higher band. `GEAR_LEVEL_STEP` in `src/gear/gear.js` is the knob if late-game
gear ever starts dwarfing the other power tracks.

### Iron and slot levels

Fixed-level drops mean the bag fills with near-identical pieces, so surplus
gear needs somewhere to go. Scrapping a piece yields **iron**, scaled by both
its rarity and its level, so the surplus a late dungeon produces is worth more
than the surplus an early one does. Equipped gear is never offered for
scrapping — the safest way to stop someone destroying what they are wearing is
not to show the button.

Iron buys slot levels. Each of the four slots has its own, and a slot level
multiplies whatever item is sitting in it: an empty slot's level is worth
nothing, and a slot level is worth more once you have something good there. The
step is deliberately tiny — **one slot level is 1/20th of one gear level** — so
slot levels are a sink for surplus, not a substitute for finding better gear.
The cost curve compounds at 3.5%, which is what lets the numbers climb into the
hundreds over a long game the way the reference screens do.

The hero screen shows exactly one number per slot — the slot's own level, as a
`+N`. Everything about the item in it lives one tap away, in an item card:
what it is, its rarity, its level, what it is actually worth in power, its
stats already multiplied by the slot level, and the two things you can do about
it (Replace, Enhance). Keeping the hero screen to one number per slot is what
lets it stay a glanceable summary instead of four stat sheets crammed around a
portrait.

The card is centred rather than a bottom sheet, and the picker behind Replace
is a bottom sheet — a single object you are inspecting and a list you scroll
should not feel alike. The power figure on the card is exact: the hero's power
now, minus his power with that slot emptied.

### Where the payouts split

Gear is the exception, and that is the point of dungeons. A dungeon pays gear
and zeni and **nothing else** — no XP, no beans, no shards. Keeping the payout
tables disjoint is what lets a dungeon be farmed freely without inflating the
companion economy above, and it gives the gear track a source the player
controls rather than arriving as a side effect of pushing the story. There are
no run limits yet; keys or daily attempts are the obvious next layer.

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
about **28-38% level, 38-51% stars, 15-27% gear, 5-11% bonds**. If one track ever starts to
dominate that line, the curve needs rebalancing, not the gates.

### Balance harness

```bash
node tools/simulate.mjs 40            # 40 runs per campaign stage
node tools/simulate-dungeons.mjs 40   # same, per dungeon difficulty
```

Runs every fight headless against a starting, early-mid, mid and late-game team
and prints win rate, average duration and average survivors. The
`requiredPower` gates are derived from its output rather than guessed, so that
"you are underpowered" honestly predicts a loss.

The dungeon harness answers one narrow question: does the difficulty ladder
behave like a ladder? It currently reads Easy 100% / Normal 0% at early-mid,
Hard 40% at mid, Extreme 63% at late-mid and 100% at late — so each tier is
clearable by a team one step stronger than the one below, and Extreme stays a
wall until well after the story is finished.

## Reference material

`reference/afk-arena/` holds the four AFK Arena screenshots used as **structural**
references for the battle, roster and hero-detail screens. Nothing from them is
reproduced — the layouts are reskinned, and all art here is placeholder.

## Not in this pass

Transformations / power-up forms (the data model reserves a fifth skill slot for
them but nothing is built), faction or elemental advantages, a large gear pool,
PvP or endless modes, sound, and real art.
