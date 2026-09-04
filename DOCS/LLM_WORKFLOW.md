# BF6 Mod SDK — LLM-Assisted Development Guide

---

## 📂 File Map

| File                   | Purpose                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| `LLM_TEMPLATE.ts`      | Complete TypeScript skeleton with event handlers, classes, loops |
| `PROJECT_CHECKLIST.md` | 11-phase task tracker                                            |
| `BF6_API_SUMMARY.md`   | SDK function cheat-sheet                                         |
| `GODOT_SETUP.md`       | Godot editor setup instructions                                  |
| `brief.md`             | Your game mode design document                                   |
| `todo.md`              | Progress tracker (synced to checklist)                           |
| `memory.md`            | Persistent notes, decisions, findings                            |

---

## 🚀 Phase 1: Initial Documentation Generation

> **Use when:** The SDK changes and you need to update your template repo.

> **Prompt:**
> 
> "Based on the official BF6 Portal SDK (index.ts, index.d.ts) and the example mods (Vertigo.ts, BombSquad.ts, AcePursuit.ts, Exfil.ts), create/update:
> 
> 1. A comprehensive dev guidelines markdown file covering best practices derived from official mods
> 2. A TypeScript skeleton file with all essential functions and event handlers
> 3. A high-level 11-phase checklist for mod development
> 
> Base everything on actual SDK patterns, not assumptions. Generate code that works with BF6 Portal SDK version 1.4.2.0."

---

## 📋 Phase 2: TODO Generation

> **Use when:** You've filled out `brief.md` and need a granular task list.

> **Prompt:**
> 
> "Based on the following game mode brief, generate a detailed, phased TODO list in checklist format (with checkboxes). Each item should be specific and actionable. Reference the BF6 Mod Development Checklist structure.
> 
> [.llm/brief.md]"

---

## 💻 Phase 3: Phase-by-Phase Development

> **Use when:** Starting a specific phase. Tailor to the phase.

> **General prompt:**
> 
> "I'm working on a BF6 Portal SDK mod. Here's my game mode brief:
> 
> [PASTE BRIEF]
> 
> Now implement Phase [X]: [PHASE NAME]
> 
> Follow these rules:
> 
> 1. Use the JsPlayer tracking pattern from LLM_TEMPLATE.ts
> 2. Define all magic numbers as named constants
> 3. Use async/await properly with mod.Wait()
> 4. Cache GetObjId results, don't call repeatedly
> 5. Add clear comments explaining complex logic
> 6. Keep debug flags enabled for now
> 7. Handle AI players separately from human players
> 8. Include cleanup logic for player leave events
> 9. Write helper functions, don't duplicate logic
> 10. Return type annotations where helpful"

> **Examples per phase:**

> **Phase 3.1 — Game State Management:**
> "Implement the GameState enum and state transition logic. Add a game state variable that tracks Lobby → Countdown → InProgress → Ended transitions. Create helper functions to check/set state. Use async/await where needed."

> **Phase 3.2 — Player Management:**
> "Implement the JsPlayer class with:
> 
> - Static get() method that creates/returns JsPlayer instances
> - Static removeInvalidJSPlayers() that cleans up dictionary AND array
> - Custom properties for score, deaths, etc.
> - UI references (lobbyUI, messageUI)
> - destroyUI() method for cleanup"

> **Phase 3.3 — Core Game Loop:**
> "Implement TickUpdate() (60fps, 16ms) and ThrottledUpdate() (1-second) loops. Both should check gameOver first. TickUpdate handles fast updates (proximity, progress). ThrottledUpdate handles slower updates (UI refresh, victory checks, timers). Don't await inside the loops — do work, then await mod.Wait()."

---

## 🧹 Phase 4: Cleanup Documentation

> **Use when:** `todo.md` or `memory.md` exceed ~500 lines.

> **Prompt:**
> 
> "My todo/memory docs are getting long. Summarize them concisely. Keep critical decisions, pending items, and key findings. Discard redundant or completed items. Preserve any technical details that would be useful for someone continuing the project."

---

## 💡 LLM Tips for BF6 Mod Development

1. **Always reference `index.d.ts`** for exact type signatures before calling SDK functions
2. **Use the `ParseUI` pattern** from official mods — don't reinvent UI creation
3. **Never skip `OnPlayerLeaveGame`** cleanup — UI memory leaks are the #1 complaint
4. **Cache `GetObjId()` results** — calling it repeatedly is a common performance killer
5. **Test with 2 players first** — then scale up to 32
6. **Use `debugJSPlayer = true`** during development, `false` before sharing
7. **Check `IsAISoldier`** before running human-specific logic on every player
8. **Always verify async timing** — nested `await` inside loops causes race conditions
9. **Handle `Redeploy` death type** as a non-kill in your logic
10. **Use `modlib/index.ts` helpers** — the official modlib has utilities for UI, arrays, and conditions

---

## 📌 Prompt Shortcuts

Copy-paste these for common tasks:

**Generate event handler:**

```
Generate an event handler for OnPlayer[Event] following the JsPlayer pattern. The handler should: 1) Get or create JsPlayer instance, 2) Skip invalid players, 3) Handle the event logic, 4) Update UI if needed, 5) Handle edge cases. Include full TypeScript types.
```

**Generate a UI class:**

```
Create a [UIType] class for a [describe UI] that: 1) Has open()/close()/refresh()/isOpen() methods, 2) Uses ParseUI or manual AddUIContainer/AddUIText, 3) Stores a reference in JsPlayer, 4) Handles cleanup in destroyUI(). Write complete TypeScript with types.
```

**Generate helper function:**

```
Create a [name] helper function that [what it does]. It should be type-safe, handle edge cases, and follow the mod's naming conventions. Include a clear comment explaining usage.
```

**Debug an issue:**

```
I'm seeing [describe issue]. The relevant code is: [PASTE CODE]. The event handler is [handler name]. Check for: 1) Valid player/object references, 2) Proper async timing, 3) State checks, 4) AI player handling, 5) Object ID comparisons. Suggest a fix.
```

---

## 🔑 Common SDK Functions (Quick Lookup)

| Function                                             | Returns                | Use                          |
| ---------------------------------------------------- | ---------------------- | ---------------------------- |
| `mod.GetObjId(object)`                               | `number`               | Get ID of any game object    |
| `mod.GetTeam(player\|id)`                            | `mod.Team`             | Get team from player or ID   |
| `mod.GetHQ(id)`                                      | `mod.HQ`               | Get HQ by ID                 |
| `mod.GetCapturePoint(id)`                            | `mod.CapturePoint`     | Get capture point by ID      |
| `mod.GetInteractPoint(id)`                           | `mod.InteractPoint`    | Get interact point by ID     |
| `mod.GetPlayer(id)`                                  | `mod.Player`           | Get player by ID             |
| `mod.AllPlayers()`                                   | `mod.Array`            | All players                  |
| `mod.NumberOfPlayers()`                              | `number`               | Player count                 |
| `mod.ClosestPlayerTo(vector)`                        | `mod.Player`           | Nearest player               |
| `mod.CreateVector(x, y, z)`                          | `mod.Vector`           | Create position/color vector |
| `mod.Wait(seconds)`                                  | `Promise<void>`        | Async delay                  |
| `mod.Message(key, args)`                             | `mod.Message`          | Localized message            |
| `mod.Message(key)`                                   | `mod.Message`          | Localized message            |
| `mod.DisplayNotificationMessage(msg)`                | `void`                 | Show notification            |
| `mod.GetSoldierState(player, stateType)`             | `bool\|number\|Vector` | Query player state           |
| `mod.IsPlayerValid(player)`                          | `boolean`              | Check player validity        |
| `mod.GetSoldierStateVector.GetPosition`              | `Vector`               | Player position              |
| `mod.GetSoldierStateVector.EyePosition`              | `Vector`               | Player eye position          |
| `mod.GetSoldierStateVector.GetFacingDirection`       | `Vector`               | Player facing                |
| `mod.GetSoldierStateNumber.CurrentHealth`            | `number`               | Player health                |
| `mod.GetSoldierStateBool.IsAlive`                    | `boolean`              | Player alive                 |
| `mod.GetSoldierStateBool.IsAISoldier`                | `boolean`              | Player is AI                 |
| `mod.GetSoldierStateBool.IsInVehicle`                | `boolean`              | Player in vehicle            |
| `mod.GetSoldierStateBool.IsManDown`                  | `boolean`              | Player downed                |
| `mod.EnableInputRestriction(player, input, enabled)` | `void`                 | Restrict input               |
| `mod.EnableGameModeObjective(obj, enabled)`          | `void`                 | Enable/disable objective     |
| `mod.EnableHQ(hq, enabled)`                          | `void`                 | Enable/disable HQ            |
| `mod.EnableVFX(vfx, enabled)`                        | `void`                 | Enable/disable VFX           |
| `mod.EnableSFX(sfx, enabled)`                        | `void`                 | Enable/disable SFX           |
| `mod.PlaySound(sfx, volume, target?)`                | `void`                 | Play sound                   |
| `mod.Teleport(player, position, angle)`              | `void`                 | Move player                  |
| `mod.SetTeam(player, team)`                          | `void`                 | Set player team              |
| `mod.SetTeamScore(team, score)`                      | `void`                 | Set team score               |
| `mod.SetFriendlyFire(enabled)`                       | `void`                 | Enable/disable friendly fire |
| `mod.EndGameMode(team)`                              | `void`                 | End game                     |
| `mod.Kill(player)`                                   | `void`                 | Kill player                  |
| `mod.DealDamage(player, amount)`                     | `void`                 | Deal damage                  |
| `mod.Heal(player, amount)`                           | `void`                 | Heal player                  |
| `mod.GetMatchTimeElapsed()`                          | `number`               | Match time (s)               |
| `mod.GetMatchTimeRemaining()`                        | `number`               | Match time left (s)          |
| `mod.GetRoundTime()`                                 | `number`               | Round time (s)               |
| `mod.SetRoundTimeRemaining(s)`                       | `void`                 | Set round time               |

---

## 📚 External Resources

| Resource            | Link                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| BF6 Portal SDK      | https://portal.battlefield.com/bf6/experiences                                                        |
| Portal 101 Intro    | https://www.ea.com/games/battlefield/battlefield-6/news/portal-101-introduction-to-battlefield-portal |
| Portal 101 Advanced | https://www.ea.com/games/battlefield/battlefield-6/news/portal-101-advanced-creations                 |
| BF6 Creator Program | https://www.ea.com/games/battlefield/battlefield-6/news/introducing-the-battlefield-creator-program   |
| Portal Hub          | https://www.ea.com/games/battlefield/battlefield-6/portal                                             |
| Community Mods      | https://www.ea.com/games/battlefield/battlefield-6/portal/browse                                      |

---
