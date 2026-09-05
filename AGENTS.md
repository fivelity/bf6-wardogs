# WARDOGS Agent Instructions

> **Primary Source**: Read `.llm/brief.md` first — this is the definitive design contract for WARDOGS.

## Quick Reference
- **Game**: WARDOGS — 3-faction tactical King of the Hill
- **SDK**: BF6 Portal SDK v1.4.2.0 (global `mod` namespace, async event handlers)
- **SDK Types**: `bf6-portal-mod-types` package contains all available `mod` typings. 
- **Build**: `pnpm bundle` → flat single-file `dist/portal-bundle.ts`
- **Validate**: `pnpm validate` before every commit
- **Deploy**: `pnpm deploy` (requires `.env` present)

## Code Structure
```
src/
├── core/                  # Experience-wide engine bootstrap
│   ├── config.ts          # Constants: IDs, timings, colors
│   └── events.ts           # Centralized events broker
├── features/              # Autonomous vertical gameplay feature slices
│   ├── hotzone/           # Drifting HotZone / ControlZone math
│   ├── shop/              # Buy station interaction, wallets, loadouts
│   ├── construction/      # Shovel construction, socket triggers
│   ├── scavenger/         # Salvage Pack carrier & death drop systems
│   ├── ai/                # Rogue AI Threat Faction (Team 4)
│   └── scoreboard/        # 3-Faction scoreboard columns
├── shared/                # Reusable utility helpers
│   └── utils.ts           # Vector math, random helpers, MakeMessage
└── index.ts               # Main entry point; registers features & lifecycles
```

## SDK Patterns to Follow
- **Always use a `JsPlayer` class** for player tracking with static `get()` and cleanup on leave
- **Separate update loops**: `TickUpdate()` at 16ms for game logic, `ThrottledUpdate()` at 1s for UI/timers
- **Use `ParseUI()` from `modlib/index.ts`** for UI widget creation (never raw mod.CreateWidget)
- **Name events**: PascalCase prefixed with "On": `OnPlayerJoinGame`, `OnPlayerDeployed`, etc.
- **Constants over magic numbers**: All IDs, timings, RGB values defined at file scope
- **Validate before operation**: Check `mod.GetObjId(player) > -1` and `!gameOver` guards

## Documentation Hierarchy
| File | Purpose |
|---|---|
| `.llm/brief.md` | Design source of truth — rules, win conditions, UI |
| `.llm/dev_guidelines.md` | SDK patterns, code structure, event hooks |
| `.llm/todo.md` | Phase-based work tracking (keep < 600 lines) |
| `.llm/memory.md` | Session-to-session decisions and context |
| `DOCS/BF6_SDK.md` | Human/agent reference for SDK functions |

## Agent Behavior
- **No speculation** — query `node_modules/ts-bf6-portal/*/index.d.ts` for undocumented APIs
- **Incremental edits** — preserve existing structures unless explicitly instructed to refactor
- **Self-validate** — run `pnpm bundle` and `pnpm validate` before proposing completion
- **Track work** — update `.llm/todo.md` at every meaningful milestone
