# Z-Fighters — Dragon Ball Turn-Based RPG Prototype

A mobile-first, browser-based **turn-based RPG** set in the Saiyan Saga.
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
- **Battle** — turn-based, side-view lanes. You choose the action for each of
  your three heroes when their turn comes: Attack, Technique, Ultimate or
  Guard. Tap an enemy first to override who it hits.
- **Turn order** — an action-value queue, shown as a strip along the top. Every
  unit carries a distance to its next turn and acting resets it to
  `1000 / speed`, so a faster unit simply comes round again sooner. SPEED buys
  turns, and the order is knowable ahead of time — which is what lets a
  charging attack say which turn it lands on.
- **Charged attacks** — a boss announces its heavy hit on one turn and lands it
  at the start of its next. Both the caster and everyone in the blast are
  marked, and you get real turns to answer: guard, heal, or kill the caster and
  cancel it outright.
- **Guard** — every unit always has it. Halves incoming damage until that
  unit's next turn and builds ki. It is the answer to a telegraph, and the
  reason a charged attack is a decision rather than an announcement.
- **Boss phases** — crossing an HP threshold transforms a boss once: it takes a
  buff, may swap a skill for a harder one, and the fight visibly escalates.
  Vegeta turns twice.
- **Auto-battle** — on by default for anything already cleared, off for a fight
  you have never won. The AI takes your turns; you can flip it either way
  mid-fight and take over.
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
- **Bag** — three tabs. *Items* holds currency, senzu, iron, shards and the
  record; *Gear* is everything you own, best first, each row opening its item
  card; *Dismantle* is a selectable grid for clearing surplus in bulk.
- **Locking** — any piece can be locked from its item card. Locked gear is
  never offered for scrapping by either path.

## Module map

Each directory is independently swappable and exposes a small interface; the
systems talk through those interfaces only.

| Module | Responsibility |
| --- | --- |
| `src/config.js` | All balance knobs and the rarity/star/skill-slot rules |
| `src/hero/` | Hero definitions; stat/power derivation, promotion, levelling |
| `src/skills/` | Skill definitions; which slots a hero has unlocked |
| `src/battle/` | Headless turn-based combat, turn order, targeting, damage |
| `src/gear/` | Equipment definitions, bonus totals, drop rolls |
| `src/progression/` | Stages, dungeons, enemy units, gating and reward payout |
| `src/inventory/` | Zeni, shards, gear ownership — the only place resources move |
| `src/save/` | The player-state object and its localStorage persistence |
| `src/ui/` | Screens, the sprite layer, and the placeholder avatar renderer |

`src/ui/dom.js`'s `onAction` keeps its handlers in a map owned by the node, and
`clear()` empties that map. One listener per node, and a screen the player has
left stops answering clicks — before that every navigation stacked another live
listener on `#screen`, so two screens sharing an action name would both fire.

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
exactly: a longer fight means more turns, and more turns means more techniques
and ultimates, which quietly favours whoever has the deeper kit. That is usually
the player's three full loadouts, not a mob with two skills, so raising it
softens the difficulty walls. Re-run the harness after changing it.

It dropped from 2.0 to 0.8 when combat went turn-based. A unit that used to
swing thirty-odd times across a fight now takes six or eight turns, so the old
pools turned every boss into a stalemate against the turn cap.

Balance values are deliberately unbalanced first-pass numbers and are marked
`PLACEHOLDER` in comments. The main dials live in `src/config.js`
(rarity multipliers, star rungs, skill-slot thresholds, damage formula, ultimate
charge rate), with per-hero, per-skill, per-enemy and per-stage numbers in their
own data files.

Several rules are written as switches rather than hard-coded:

- `TARGETING_MODE` — how strictly the back row is protected.
- `AUTO_BATTLE_ON_CLEARED` — whether a fight you have already won starts on
  auto-battle.
- `FOCUS_FIRE` — whether a unit picking a new target prefers the one its allies
  are already on.
- `COMBAT.guardDamageMult` — what guarding is worth. This is the dial that
  decides whether answering a charged attack is worth a turn.
- `COMBAT.maxTurns` — the stalemate cap. A fight that reaches it is a loss; the
  harness reports how many runs hit it, and that number should stay at zero.

### How a turn works

The engine hands the UI one turn at a time. `battle.advance()` opens the next
turn — rolling the action-value queue forward, ticking that unit's cooldowns
and buffs, and resolving anything it was charging. Then either the player
chooses (`battle.actions()` lists exactly what is legal, `battle.act()` takes
it) or the AI does (`battle.takeAiTurn()`). Nothing runs on a frame loop, so
the presentation cannot drift out of step with the simulation, and the same
code runs a thousand fights in the harness.

`battle.preview(n)` returns the next n units to act. It clones the queue and
rolls it forward rather than mutating anything, so the turn-order strip and the
"lands on his next turn" reading of a charged attack come from the same source
of truth as the fight itself.

The AI drives the enemy team *and* the player's under auto-battle, so it has to
be good enough that farming on auto is not worse than playing. It is a priority
list rather than a score: ultimate if charged, guard if a charged hit is aimed
here and health is low enough to care, technique if off cooldown, otherwise
attack — finishing anything already in range of dying.

### Balance harness

```bash
node tools/simulate.mjs 40            # 40 runs per campaign stage
node tools/simulate-dungeons.mjs 40   # same, per dungeon difficulty
```

Runs every fight headless with the AI on both sides — which is exactly what
auto-battle does, so these numbers describe a real farming run rather than a
model of one — against a starting, early-mid, mid and late-game team. It prints
win rate, average turns, how many runs hit the stalemate cap, and average
survivors. The `requiredPower` gates are derived from its output rather than
guessed, so that "you are underpowered" honestly predicts a loss.

**Stalls should stay at zero.** A run that reaches `COMBAT.maxTurns` is a fight
neither side could finish, which means HP and damage have drifted apart.

Current shape: the starting team walls at stage 4, mid walls at stage 6,
late-mid clears the campaign. Boss fights run 24-43 turns, early stages 3-9.
The dungeon ladder reads Easy 100% / Normal 0% at early-mid, Hard 0% at mid,
Hard 100% and Extreme 60% at late-mid, and everything at late — so each tier
wants a team one step stronger than the last.

## Reference material

`reference/afk-arena/` holds the four AFK Arena screenshots used as **structural**
references for the battle, roster and hero-detail screens. Nothing from them is
reproduced — the layouts are reskinned, and all art here is placeholder.

## Not in this pass

Transformations / power-up forms (the data model reserves a fifth skill slot for
them but nothing is built), faction or elemental advantages, a large gear pool,
PvP or endless modes, sound, and real art.
