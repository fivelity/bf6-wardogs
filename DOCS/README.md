# BF6 Portal SDK — Mod Development Guide

> **Quick start:** Follow the **11-Phase Checklist** (`PROJECT_CHECKLIST.md`) → Use **`LLM_TEMPLATE.ts`** as your code skeleton → Reference **`BF6_API_SUMMARY.md`** for SDK functions.

---

## 🏗 Project Structure

```
mods/YOUR_MOD/
├── YOUR_MOD.ts           # Main game mode script (copy from LLM_TEMPLATE.ts)
├── ts-bf6-portal.config.json   # Experience config (maps, teams, restrictions)
├── DOCS/
│   ├── PROJECT_CHECKLIST.md     # Phase-by-phase task tracker
│   ├── LLM_WORKFLOW.md          # Prompts for LLM-assisted development
│   ├── LLM_TEMPLATE.ts          # Complete TypeScript code skeleton
│   ├── BF6_API_SUMMARY.md      # SDK function cheat-sheet
│   └── GODOT_SETUP.md            # Godot editor setup instructions
├── src/                       # TypeScript source files
└── .llm/                      # LLM working files
    ├── brief.md               # Your game mode design document
    ├── todo.md                # Progress tracker (synced to checklist)
    ├── memory.md              # Persistent notes, decisions, findings
    └── prompts.md             # Custom prompt overrides
```

---

## 📝 The 11-Phase Checklist

See **`PROJECT_CHECKLIST.md`** for the complete phase-by-phase task tracker.

---

## 🧠 LLM-Assisted Development Workflow

See **`LLM_WORKFLOW.md`** for the exact prompts to use at each stage.

---

## 🛠 Template Code

See **`LLM_TEMPLATE.ts`** — the full TypeScript skeleton with:
- Event handlers (all SDK lifecycle hooks)
- `JsPlayer` tracking class
- `LobbyUI` / `MessageUI` classes
- Helper functions (Lerp, distance, message builder, etc.)
- Tick/Throttled update loops
- Victory condition placeholder

---

## 📖 Quick-Reference: SDK Cheat Sheet

See **`BF6_API_SUMMARY.md`** — 12 tables covering all SDK types, events, player management, vectors, UI, combat, spawning, and VFX/SFX.

---

## 🎮 Godot Setup & Editing

See **`GODOT_SETUP.md`** — step-by-step guide to:
1. Importing the Portal project into Godot
2. Setting up the Portal SDK
3. Editing levels in the spatial editor
4. Creating custom scenes for your mod

---

## ⚠️ Top 10 Gotchas (Common Pitfalls)

| # | Pitfall | Fix |
|---|---------|-----|
| 1 | **Object ID reuse** when a player leaves/joins | Always call `JsPlayer.removeInvalidJSPlayers()` on `OnPlayerLeaveGame` |
| 2 | **Team comparisons** fail | Use `mod.GetObjId(team)` for all comparisons — never compare objects directly |
| 3 | **UI persistence** after player leaves | Call `destroyUI()` and `close()` all UI elements in `OnPlayerLeaveGame` |
| 4 | **Async timing issues** | Don't `await` inside loops — batch updates, then `await mod.Wait()` once |
| 5 | **Equipment removal** errors | Empty slots throw — check `HasEquipment()` or wrap in `try/catch` |
| 6 | **Team assignments** on late joins | Handle `OnPlayerSwitchTeam` and reassign if needed |
| 7 | **Game end** doesn't trigger | Check victory conditions in both `TickUpdate()` (fast) AND `ThrottledUpdate()` (slow) |
| 8 | **AI handling** skips logic | Always check `mod.GetSoldierState(player, IsAISoldier)` and handle differently |
| 9 | **Message timing** — messages stay forever | Track with a countdown; hide after `messageDisplayTime` seconds |
|10 | **Magic numbers** everywhere | Define every ID, timing, and color as a named constant at file top |

---

## 📋 Development Checklist

See **`PROJECT_CHECKLIST.md`** (11 phases, 220+ items)

---

## 🤖 LLM Prompts

See **`LLM_WORKFLOW.md`** — copy-paste prompts for:
- Initial documentation generation
- TODO list creation
- Phase-by-phase development
- Documentation cleanup (keep under 500 lines)

---

> **Pro tip:** Use the **11-Phase Checklist** as your primary tracker. Use `memory.md` to log decisions, `todo.md` to track progress, and `brief.md` to document your game mode design. Update all three as you go.
