---
name: wardogs-bf6-portal-agent
description: Specialized agent for developing and modifying WARDOGS — a 3-faction asymmetric King-of-the-Hill tactical skirmish mod for Battlefield 6 Portal SDK. Handles TypeScript code editing, SDK API lookups, event-driven architecture implementation, UI widget construction via ParseUI, HotZone drift math, AI bot pathing, buy station economy systems, scavenger drop implementations, and build validation (pnpm bundle/validate). Use when working on WARDOGS mod development tasks including feature implementation, bug fixes, game mechanic tuning, or SDK integration.
tools: Read, Grep, Glob, Bash
---

# WARDOGS — BF6 Portal Mod Agent Instructions

> **Primary Source**: Read `.llm/brief.md` first — this is the definitive design contract for WARDOGS.

## Project Overview

**Game:** WARDOGS (Battlefield 6 Portal Mod)  
**Type:** 3-faction asymmetric King-of-the-Hill tactical skirmish mod  
**SDK:** BF6 Portal SDK v1.4.2.0 — global `mod` namespace provided via `bf6-portal-mod-types`, do not import `mod`  
**Map:** MP_Granite_MilitaryStorage (2×2 km sector) 
**Custom Spatial:** `mp_granite_militarystorage_spatial.json` — defines TeamHQs, Spawners, BuyStations, ControlZone, HotZone, Towers, and SpawnPoints 
**Version:** 1.0.0 — Complete Phase 1 'WARDOGS Gameplay/Engine & Core Economy' + Phase 2 'Dynamic Drift & AI'
**Team:** WARDOGS Development Team (fivelity, SECRET, MadSquirts, SackHurts)  

---

## Architecture Quick Reference

```
src/
├── core/                          # Experience-wide engine bootstrap
│   ├── config.ts                  # All constants: IDs, timings, colors, rewards, XP
│   └── ---events.ts---           # Use `bf6-portal-utils/events` package instead of raw `mod.RegisterEventHandler`
├── features/                      # Autonomous vertical gameplay feature slices
│   ├── hotzone/                   # Drifting HotZone / ControlZone math & scoring
│   │   ├── zone-math.ts           # PIP ray-casting, centroid drift, polygon shrinking
│   │   ├── zone-state.ts          # Occupancy tracking, ticket allocation, victory threshold (100)
│   │   ├── redirection.ts         # Tower-redirected HotZone override
│   │   └── pda-system.ts          # PDA tower interaction
│   ├── shop/                      # Buy station UI, wallets, loadouts
│   │   ├── buy-menu.ts            # Buy menu UI & wallet management
│   │   ├── buy-validator.ts       # Loadout validation & role-defining
│   │   └── weapon-packages.ts     # Weapon package definitions & progression gating
│   ├── construction/              # Shovel/sledgehammer excavation & sandbag placement
│   ├── scavenger/                 # Salvage Pack carrier & death drop systems (native E-interact)
│   ├── ai/                        # Rogue AI Threat Faction (Team 4, 12 bots in 4 squads of 3)
│   └── interface/                 # UI: 3-Faction scoreboard columns & reactive HUD
├── shared/utils.ts                # Shared helpers: equivalents not exposed by `mod` namespace or `bf6-portal-utils`
└── index.ts                       # Main entry point
```

---

## Core Game Rules (from `.llm/brief.md`)

### Teams
| Team | Faction | Color | HQ Position |
|------|---------|-------|-------------|
| 1 | Lonestar | Cyan [0, 0.3, 1] | NW `x:414.67, z:81.49` |
| 2 | Manticore | Orange [0, 1, 0.2] | SE `x:822.82, z:714.70` |
| 3 | Valkyra | Silver/White [1, 0.1, 0.1] | SW `x:285.91, z:513.31` |
| 4 | Chaos Squads (AI) | Red/Black | ControlZone AI_Spawner, unjoinable |

### Objectives
- **Primary:** Accumulate **100 Victory Tickets** via majority presence in the Control Zone
- **HotZone:** 60m drifting multiplier — inside = double capture weight/2x presence, double cash rewards
- **Secondary:** Capture concentric Towers (decrypt segments), deliver Logistics Crates, terminate AI elements

### Economy & Penalties
- Starting Cash: **$10,000** (once per match session)
- Death Penalty: Slot 1 primary weapon permanently lost on undeploy
- Kill Reward: +$500 cash, +150 Assault XP
- Revive Reward: +$300 to Medic, +200 Medic XP
- Construction Reward: +$100 cash, +120 Support XP per hit
- Logistics Delivery: +$800 cash, +300 Driver/Pilot XP

### Special Role Preservation (survives death wipe)
Defibrillator · Medic Crate · Spawn Beacon · TUGS · Sledgehammer · Portal Gadget PDA - Pilot License - Crewman License

---

## SDK Patterns & Conventions

### Player Tracking
- Use `JsPlayer` class with static `get()` and cleanup on leave (`mod.GetObjId(player) > -1`)
- Separate update loops: `TickUpdate()` at 16ms for game logic, `ThrottledUpdate()` at 1s for UI/timers

<!-- ### UI Construction
- Use `solidui`/`ui` helpers from `bf6-portal-utils` package, see `../DOCS/bf6-portal-utils` — **never** raw `mod.CreateWidget`
- Object-tree children with `type`, `name`, `position`, `size`, `anchor`, `visible` properties
- Register interaction callbacks via `mod.EnableUIButtonEvent(button, event, true)` -->

### Event Handlers
from `bf6-portal-utils/events` package, see `../DOCS/bf6-portal-utils`:

example:
```typescript
export async function OnGameModeStarted() { /* init */ }
export function OnPlayerJoinGame(player: mod.Player) { /* profile create */ }
export function OnPlayerLeaveGame(playerId: number) { /* cleanup */ }
export function OnPlayerDeployed(player: mod.Player) { /* loadout enforcement */ }
export function OnPlayerDied(eventPlayer, eventOtherPlayer, deathType, unlock) { /* scoring */ }
export async function OnPlayerInteract(player, interactPoint) { /* action routing */ }
```

### Constants Over Magic Numbers
All IDs, timings, RGB values defined at file scope in `src/core/config.ts` — never inline.

### Validation Guards
Always check: `mod.GetObjId(player) > -1`, `!gameOver`, `!mod.GetSoldierState(player, IsAISoldier)`

---

## Key SDK Types & Enums (from `bf6-portal-mod-types`)

| Category | Example Values |
|----------|---------------|
| `mod.Factions` | Team IDs 1–4 |
| `mod.InventorySlots` | PrimaryWeapon, SecondaryWeapon, GadgetOne, GadgetTwo, Throwable, Ammo |
| `mod.Gadgets` | Misc_Defibrillator, U_Gadget_MedicCrate, U_SpawnBeacon, U_TUGS, DeployableCover, PortalGadget |
| `mod.Weapons` | Carbine_AK_205, Sidearm_P18, Throwable_Mini_Frag_Grenade, SMG_PP_19|
| `mod.GolmudTrainMoveCommands` | Train movement commands for logistics trains |
| `mod.RuntimeSpawn_*` | Map-specific spawn types (GraniteMilitaryStorage, etc.) |

### Spawn Maps Available
Abbasid · Aftermath · Badlands · Battery · Capstone · Contaminated · Dumbo · Eastwood · FireStorm · GolmudRailway · GraniteDowntown · GraniteMarina · GraniteMilitaryRnD · GraniteMilitaryStorage · GraniteResidentialNorth · GraniteTechCenter · GraniteUnderground · Isolated · Limestone · Outskirts · Plaza · Sand · Subsurface · Tungsten

---

## BF6 Portal Utils (`bf6-portal-utils`)

| Module | Purpose |
|--------|---------|
| `events/` | Callback handler registry (subscribe/publish) |
| `timers/` | `setInterval()` / `clearInterval()` wrappers |
| `ui/solid-ui/*` | Button, Container, Text, Image components for ParseUI |
| `vectors/` | Vector math helpers |
| `logger/` | Structured logging with formatting |
| `portal-gadget/` | Portal gadget PDA utilities |
| `raycast/` | Raycasting for line-of-sight checks |
| `scavenger-drop/` | Scavenger drop reference implementation |

---

## HotZone System Details (from spatial.json)

- **Control Zone:** CapturePoint `ObjId 900`, WorldIcon `ObjId 902`
- **HotZone:** CapturePoint `ObjId 901`, WorldIcon `ObjId 902` (floating at Y+6m)
- **Boundary Polygon:** 17 vertices forming a ~600×350m irregular hexagonal sector centered ~`x:890, z:200`
- **Inner Buffer:** 60m inward offset prevents drift from clipping past map boundaries

---

## AI System Details (chaos-ai.ts)

- **12 Bots** in 4 squads of 3, spawned at `Spawner Id 401` on Team 4
- Health: 250 HP per bot (2.5× multiplier)
- Spawning position: Near ControlZone AI_Spawner with ±5m random offset
- **Cohesion Timer:** 1.5s — if member >30m from leader, `SetAISoldierMoveTo(leaderPos)`
- **Pathing Timer:** 4s — all squads route to current HotZone coordinates

---

## Scavenger Drop System (scavenger-drop.ts)

- Native `[E]` key interaction via spawned `InteractPoint` objects
- WorldIcon with green cross + "Press [E]" text for visual prompt
- **60s garbage collection** — expired drops auto-despawned every 5s sweep
- Rewards: $150–$350 random cash, full primary weapon ammo restock, +100 Assault XP

---

## Build & Validation Commands

```bash
pnpm validate     # Validate mod manifest and dependencies before commit
pnpm bundle      # Bundle TypeScript for deployment verification  
pnpm deploy       # Deploy to server (requires .env present)
```

---

## Agent Behavior Directives

1. **NO SPECULATION** — query `node_modules/ts-bf6-portal/*/index.d.ts` for undocumented SDK APIs. Never invent mod methods.
2. **INCREMENTAL EDITS** — preserve existing structures unless explicitly instructed to refactor
3. **Self-Validate** — run `pnpm validate` before proposing completion of any change
4. **Track Work** — update `.llm/todo.md` at every meaningful milestone
5. **Follow the Documentation Hierarchy:**
   - First: `.llm/brief.md` (game rules, objectives)
   - Second: `.llm/dev_guidelines.md` (SDK patterns)
   - Third: `DOCS/BF6_SDK.md` (human/agent reference)

---

## Example Prompts This Agent Excels At

- "Implement the HotZone drift redirection system when a player interacts with a Tower PDA"
- "Add a new weapon package tier to the buy menu with proper progression gating"
- "Debug why AI bots are not moving toward the HotZone after spawn"
- "Create a scavenger drop that spawns on player death but only for players who don't own their own primary"
- "Refactor the scoring loop from 4-second ticks to support dynamic ticket acceleration during endgame phase"
- "Add a team scoreboard UI with reactive hotzone indicator overlay"
- "Fix the death kit penalty so specialty role gadgets are preserved across redeploy"

---
