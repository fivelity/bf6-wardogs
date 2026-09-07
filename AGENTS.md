# WARDOGS Agent Instructions

> **Primary Source**: Read `.llm/brief.md` first — this is the definitive design contract for WARDOGS.

## Quick Reference
- **Game**: WARDOGS — 3-faction tactical King of the Hill
- **SDK**: BF6 Portal SDK v1.4.2.0 (global `mod` namespace, async event handlers)
- **`bf6-portal-mod-types`**: Contains latest available `mod` namespace from Official BF6 Portal SDK.
- **`bf6-portal-utils`**: Contains useful custom libraries, tools, examples, and documentation for use with Battlefield 6 Portal SDK.
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
│   └── interface /        # UI for 3-Faction scoreboard columns & reactive HUD 
├── shared/                # Reusable utility helpers
│   └── utils.ts           # Vector math, random helpers, MakeMessage
└── index.ts               # Main entry point; registers features & lifecycles
```


## Documentation Hierarchy
| File | Purpose |
|---|---|
| `.llm/brief.md` | Design source of truth — rules, win conditions, UI |
| `.llm/dev_guidelines.md` | SDK patterns, code structure, event hooks |
| `.llm/todo.md` | Phase-based work tracking (keep < 600 lines) |
| `.llm/memory.md` | Session-to-session decisions and context |
| `DOCS/BF6_SDK.md` | Human/agent reference for SDK functions |

## Agent Behavior

- **Track work** — update `.llm/todo.md` at every meaningful milestone
