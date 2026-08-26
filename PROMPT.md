# Claude Code Prompt — Dragon Ball Auto-Battle RPG Prototype

Copy everything below into Claude Code.

---

Build a browser-based real-time auto-battle RPG prototype set in the Dragon Ball Z Saiyan Saga, targeting iPhone Safari/Chrome (mobile-first, portrait orientation, touch controls). This is a personal, non-commercial fan prototype — using real character names/likeness is fine for this build. Use plain HTML/CSS/JavaScript, no build step or framework — a single index.html plus modular JS files — so it can be opened directly or served via a simple local server and tested instantly on an iPhone browser over LAN.

Before writing any code, ask me clarifying questions about anything below that's ambiguous.

## Reference material
I'm providing screenshots from AFK Arena in /reference/afk-arena/ — our battle screen, hero roster, and hero progression screens are inspired by its structure (reskin everything with Dragon Ball characters/theme, don't copy AFK Arena's art or IP). Look at these directly for layout/UI reference:
- Battle screen: real-time simultaneous combat (not turn-based), multiple heroes auto-fighting at once, floating damage numbers, HP bars per unit, a bottom row of hero portraits each showing an individual skill cooldown countdown timer
- Hero roster screen: grid of hero cards color-coded by rarity, locked/unowned heroes shown grayed out with a shard-collection fraction (e.g. "5/10") tracking progress toward unlocking them
- Hero detail — Stars tab: star rating (0-5★), a "Promote" action that costs shards and raises stats to the next star's value, and skill slots where higher star ranks unlock additional skill slots (shown locked/greyed until reached)
- Hero detail — Stats tab: rarity tag, level, ATK/HP/DEF/power-contributing stat, a leveling upgrade cost, and 4 equipment slots (weapon, chest, gloves, boots) around the portrait

## Architecture requirement (critical)
Structure the code into clearly separated, swappable modules from the start, since every system will be iterated on heavily:
- `/hero` — hero definitions, base stats, rarity tier, star-rank data, skill loadout, shard/unlock requirements
- `/skills` — the skill system: auto-attack (always active), one auto-technique (on cooldown), one ultimate (charges up, fires when ready, shown as a distinct ready-state icon on the hero's battle portrait), and for higher rarities only, one passive
- `/battle` — real-time combat loop, team of 3 vs enemy team, front/back row formation and targeting rules, damage calculation, victory/defeat conditions
- `/gear` — 4 equipment slots per hero (weapon/chest/gloves/boots), gear stat bonuses, gear acquired as battle drops
- `/progression` — story stage structure (linear campaign, stage 1, 2, 3...), stage requirements/rewards, enemy team definitions per stage
- `/inventory` — shards, gear, currency shared across systems
- `/save` — persistence layer (localStorage for now)

Each module should expose a clean interface so systems can be reworked independently. Add short comments marking clearly-temporary/placeholder logic (numeric balance values, drop rates, etc.) so they're easy to find and tune later. Note for later (not this pass): a transformation/power-up system (e.g. base form → powered-up form) will be added on top of this once the core loop is solid — don't build it now, but don't design anything that would block adding it later.

## Prototype scope (small vertical slice, not the full game)

### Roster
- 3-5 heroes total for this prototype, spanning the 4 rarity tiers: Common, Rare, Epic, SSR.
- Base stats: ATK, HP, DEF at minimum. A single aggregate "Power Level" number is calculated from stats + star rank + equipped gear and displayed on the hero card/roster.
- Set the initial roster in the Saiyan Saga (e.g. Goku, Piccolo, Gohan, Krillin — your call on which fit the rarity spread, or ask me).

### Skills
- Every hero has exactly: 1 auto-attack (always fires, no cooldown, baseline damage), 1 auto-technique (fires automatically whenever off cooldown), and 1 ultimate (charges over time or via a meter, and once ready shows a distinct "ready" indicator on the hero's battle portrait — fires automatically once ready, or optionally requires a tap to unleash — pick the simpler auto-fire version for the prototype and note the option to make it tap-activated later).
- Epic and SSR rarity heroes additionally have 1 passive skill (always-on, define a simple trigger like on-hit or on-turn-start for the prototype).
- Higher star ranks unlock these skill slots progressively (mirroring the reference screenshot's locked slot icons) — a 0★ hero might only have the auto-attack, with the technique and ultimate unlocking at specific star thresholds. Keep exact thresholds as clearly-marked placeholders.

### Battle system
- Team of 3 player heroes vs. an enemy team (enemy team size/composition varies per stage — can be a single strong enemy or a small group).
- Front/back row formation: player assigns heroes to front or back row before battle; front row heroes are the primary target for basic attacks, back row heroes are protected until front row heroes are defeated (or take reduced targeting priority — pick the simpler rule and note it as adjustable).
- Combat resolves in real time (not turn-based): all heroes and enemies act simultaneously based on their own attack/cooldown timers, matching the reference screenshot's simultaneous auto-battle feel.
- No elemental/type triangle for this prototype — damage comes from stats, rarity, and star rank. (A Saiyan/Human/Namekian faction advantage system can be added later if wanted.)
- Victory/defeat is determined by team wipe (all player heroes down = defeat, all enemies down = victory). Include a simple pre-battle screen to confirm team/formation before the auto-battle plays out.

### Progression
- A linear story campaign of stages (stage 1, 2, 3...), each with a fixed enemy team and a difficulty roughly following the actual Saiyan Saga arc (e.g. earlier stages are easier scaled fights, then a tougher fight later in the arc reflecting the saga's escalation — you don't need exact plot accuracy, just a sense of rising difficulty and a couple of narrative beats).
- Clearing a stage grants rewards: currency, hero shards, and/or gear drops.
- Stage requirements are gated by team power level for this prototype — no resource-gated obstacles yet.

### Gear
- 4 equipment slots per hero: weapon, chest, gloves, boots.
- Gear drops from battle stages (not crafted or bought for this prototype) and provides flat/percent stat bonuses when equipped.
- Keep the gear pool small for the prototype (a handful of items) but structure it so more can be added easily.

### Hero unlocking & star-up
- Heroes not yet owned appear in the roster grayed out, showing a shard-collection fraction toward unlocking them (matching the reference screenshot).
- Shards are earned from stage rewards (and/or a currency-shop stand-in — your call, note as placeholder).
- Star-ranking a hero (0★–5★, matching the reference) costs shards and raises stats to the next tier's fixed value, and unlocks new skill slots at specific star thresholds as described above.

### Persistence
- Save player progress (owned heroes, star ranks, gear, inventory, stage progress) to localStorage so progress survives closing the browser tab on iPhone.

## Explicitly out of scope for this pass
- Transformations/power-up forms (planned for later, don't build the system yet — just don't block it)
- Elemental/faction type advantages
- More than a handful of gear items
- PvP or endless/survival modes
- Sound/music
- Real art (use clearly-labeled placeholders)

## Deliverable
A working prototype I can open in iPhone Safari (via local server on my LAN) and: view my hero roster (owned + locked-with-shard-progress), check a hero's stats/stars/skills/gear, set a 3-hero team with front/back row formation, fight through a few story stages with real-time auto-battle (auto-attack + auto-technique + ultimate-when-ready, passives for higher rarities), collect gear/shard/currency rewards, equip gear, and star-up a hero. Prioritize getting the battle system (real-time combat loop + skill auto-firing + formation targeting) and the story stage progression fully working first — gear and star-up can be minimal/stubbed as long as the underlying data model supports extending them later without a rewrite.

Ask me clarifying questions if any part of this is ambiguous before you start building.
