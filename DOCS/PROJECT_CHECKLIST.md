# BF6 Portal Mod Development Checklist

Phase-by-phase task tracker. [x] = Done | [ ] = Pending | [ ] = Blocked

---

## Phase 1 — Planning & Design

### Game Mode Concept
- [ ] Define core gameplay loop (what players do repeatedly)
- [ ] Identify win/loss conditions
- [ ] Determine player count (min / max / recommended)
- [ ] Choose team configuration (1v1, 2v2, FFA, Co-op, etc.)
- [ ] Define round/match structure
- [ ] Plan respawn behavior (one-life, auto-respawn, delay, etc.)
- [ ] Create `brief.md` (see template in `.llm/brief.md`)

### Technical Requirements
- [ ] List required game objects (HQs, capture points, interact points, area triggers)
- [ ] Identify supported maps (from `Available Levels` table)
- [ ] Plan UI elements (lobby HUD, in-game HUD, messages, end-game UI)
- [ ] Define player variables to track (score, cash, custom stats)
- [ ] List special equipment / weapons needed
- [ ] Identify VFX / SFX requirements

---

## Phase 2 — Project Setup

### File Structure
- [ ] Copy `LLM_TEMPLATE.ts` → `YOUR_MOD.ts`
- [ ] Create `brief.md` with your game mode design
- [ ] Update `VERSION` constant in mod file
- [ ] Enable debug flags for development
- [ ] Create `src/` folder for helper modules (optional)

### Initial Configuration
- [ ] Set minimum player count
- [ ] Configure combat start delay
- [ ] Set spawn mode (`AutoSpawn` / `ManualSpawn`)
- [ ] Configure friendly fire
- [ ] Define default team assignments
- [ ] Verify `ts-bf6-portal.config.json` maps and restrictions

---

## Phase 3 — Core Implementation

### Game State Management
- [ ] Define `GameState` enum (Lobby, Countdown, InProgress, Ended)
- [ ] Implement state transition logic
- [ ] Add victory condition check function
- [ ] Handle game-over cleanup
- [ ] Implement countdown / lobby phase
- [ ] Start TickUpdate() and ThrottledUpdate() loops

### Player Management (JsPlayer Pattern)
- [ ] Extend `JsPlayer` class with custom properties
- [ ] Implement `OnPlayerJoinGame` → create JsPlayer, show lobby UI
- [ ] Implement `OnPlayerLeaveGame` → `JsPlayer.removeInvalidJSPlayers()`, cleanup UI
- [ ] Track player statistics (score, kills, deaths, custom)
- [ ] Implement team assignment logic
- [ ] Add `destroyUI()` method to JsPlayer

### Core Game Loop
- [ ] `TickUpdate()` — 60fps logic (proximity checks, input handling, progress bars)
- [ ] `ThrottledUpdate()` — 1-second logic (UI refreshes, victory checks, timers)
- [ ] Victory condition checking (score / time / objectives / elimination)
- [ ] Round / match progression logic
- [ ] Respawn / redeploy logic

### Event Handlers
- [ ] `OnGameModeStarted` — init settings, wait for players, start countdown
- [ ] `OnPlayerJoinGame` — create JsPlayer, show UI
- [ ] `OnPlayerLeaveGame` — cleanup
- [ ] `OnPlayerDeployed` — spawn placement, loadout setup
- [ ] `OnPlayerDied` — death handling, score update
- [ ] `OnPlayerEarnedKill` — kill tracking, point awards
- [ ] `OnPlayerInteract` — switch on ObjId for different behaviors
- [ ] `OnPlayerEnterAreaTrigger` / `OnPlayerExitAreaTrigger`
- [ ] `OnCapturePointCapturing` / `OnCapturePointCaptured`
- [ ] `OnVehicleSpawned` / `OnVehicleDestroyed`
- [ ] `OnPlayerUIButtonEvent` — menu navigation, store, etc.

---

## Phase 4 — Game Objects

### HQ / Spawn Setup
- [ ] Assign ObjIds to HQs in Godot
- [ ] Enable/disable HQs via `mod.EnableHQ()`
- [ ] Configure spawn points
- [ ] Set team spawns
- [ ] Test spawn locations with real players

### Capture Points
- [ ] Add CapturePoint objects in Godot
- [ ] Record ObjIds
- [ ] Implement capture logic (team count, time, progress)
- [ ] Add capture progress UI (progress bars, icons)
- [ ] Handle team ownership changes

### Interact Points
- [ ] Add InteractPoint objects in Godot
- [ ] Record ObjIds
- [ ] Implement switch-case in `OnPlayerInteract`
- [ ] Add interaction prompts / world icons
- [ ] Handle cooldowns and restrictions

### Area Triggers
- [ ] Add AreaTrigger objects with PolygonVolume in Godot
- [ ] Record ObjIds
- [ ] Implement enter/exit logic
- [ ] Add boundary warnings or effects
- [ ] Test trigger volume accuracy

---

## Phase 5 — UI Implementation

### Lobby / Waiting UI
- [ ] Design layout (center, top-left, etc.)
- [ ] Display player count (current / min)
- [ ] Show countdown timer
- [ ] Add match info / rules
- [ ] Test with `ParseUI` or manual `AddUIContainer` / `AddUIText`

### In-Game HUD
- [ ] Display scores / objectives
- [ ] Show player stats
- [ ] Add timer displays
- [ ] Implement progress bars
- [ ] Add team indicators
- [ ] Add minimap markers (custom world icons)

### Messages & Notifications
- [ ] Implement `MessageUI` class per player
- [ ] Add kill feed messages
- [ ] Add objective notifications
- [ ] Add round start / end messages
- [ ] Configure message duration and auto-dismiss

### End Game UI
- [ ] Display final scores
- [ ] Winner announcement
- [ ] Individual statistics
- [ ] Team statistics
- [ ] MVP / highlights (optional)

---

## Phase 6 — Combat & Equipment

### Loadouts
- [ ] Define allowed weapons / gadgets
- [ ] Configure default loadout
- [ ] Implement custom equipment (if needed)
- [ ] Add equipment restrictions
- [ ] Test weapon balance

### Damage & Health
- [ ] Configure damage modifiers (if needed)
- [ ] Implement custom health system (if needed)
- [ ] Handle death logic (score, effects, UI)
- [ ] Add respawn delays / penalties
- [ ] Test damage feedback

### Inventory Management (if applicable)
- [ ] Implement item pickup
- [ ] Add inventory tracking
- [ ] Handle item drops on death
- [ ] Add inventory UI
- [ ] Test item persistence

---

## Phase 7 — Teams & Scoring

### Team Configuration
- [ ] Set up team structure (2 teams, 4 teams, etc.)
- [ ] Assign team colors / names
- [ ] Implement team balancing
- [ ] Handle team switching
- [ ] Test team assignments

### Scoring System
- [ ] Define point values (kills, objectives, etc.)
- [ ] Implement score tracking
- [ ] Update scores in real-time
- [ ] Display scores in UI
- [ ] Test score accuracy

### Victory Conditions
- [ ] Score-based victory
- [ ] Time-based victory
- [ ] Objective-based victory
- [ ] Elimination victory (if applicable)
- [ ] Test ALL win conditions

---

## Phase 8 — Polish & Features

### Visual Effects
- [ ] Add VFX for key events (captures, kills, deaths)
- [ ] Implement screen effects (if needed)
- [ ] Add world icons / markers
- [ ] Configure particle effects
- [ ] Test VFX performance (no frame drops)

### Sound Effects
- [ ] Add SFX for key events
- [ ] Implement ambient sounds
- [ ] Add UI sounds
- [ ] Configure audio settings
- [ ] Test audio mixing

### Quality of Life
- [ ] Add helpful messages
- [ ] Implement auto-balance
- [ ] Add spectator mode (if needed)
- [ ] Implement pause / resume (if applicable)
- [ ] Add admin commands (if needed)

---

## Phase 9 — Testing & Debugging

### Functionality Testing
- [ ] Test with minimum players
- [ ] Test with maximum players
- [ ] Test all game states (lobby, countdown, combat, end)
- [ ] Test all event handlers
- [ ] Test victory conditions
- [ ] Test edge cases (player leave mid-game, late joins)

### Performance Testing
- [ ] Check for frame drops
- [ ] Monitor console for errors
- [ ] Test with long play sessions
- [ ] Verify memory usage
- [ ] Test on all supported maps

### Balance Testing
- [ ] Test gameplay pacing
- [ ] Verify spawn locations
- [ ] Check weapon / equipment balance
- [ ] Test round durations
- [ ] Gather player feedback

### Bug Fixes
- [ ] Fix critical bugs
- [ ] Address gameplay issues
- [ ] Resolve UI glitches
- [ ] Fix score / stat tracking bugs
- [ ] Clean up console errors

---

## Phase 10 — Finalization

### Code Cleanup
- [ ] Remove debug code
- [ ] Disable debug flags
- [ ] Add comprehensive comments
- [ ] Format code consistently
- [ ] Remove unused functions

### Documentation
- [ ] Update `brief.md` with final details
- [ ] Document known issues
- [ ] Add setup instructions
- [ ] Create changelog
- [ ] Write player guide (optional)

### Final Testing
- [ ] Full playthrough with real players
- [ ] Verify all features work
- [ ] Check for last-minute bugs
- [ ] Test on all supported maps
- [ ] Get final approval

### Release Preparation
- [ ] Update VERSION number
- [ ] Package mod files
- [ ] Create thumbnail / preview
- [ ] Write description
- [ ] Prepare for distribution

---

## Phase 11 — Post-Release

### Monitoring
- [ ] Gather player feedback
- [ ] Monitor for bugs
- [ ] Track performance issues
- [ ] Note balance concerns

### Updates
- [ ] Address critical bugs
- [ ] Implement balance changes
- [ ] Add requested features
- [ ] Release patches
- [ ] Update documentation

---

## ⚠️ Top 10 Gotchas (Quick Reference)

| # | Issue | Fix |
|---|-------|-----|
| 1 | Object ID reuse on player join/leave | Call `JsPlayer.removeInvalidJSPlayers()` |
| 2 | Team comparisons fail | Use `mod.GetObjId(team)` for all comparisons |
| 3 | UI persists after player leaves | Call `destroyUI()` in `OnPlayerLeaveGame` |
| 4 | Async timing issues | Don't `await` inside loops — batch, then `await mod.Wait()` |
| 5 | Equipment removal errors | Check `HasEquipment()` or use `try/catch` |
| 6 | Late join team assignment | Handle `OnPlayerSwitchTeam` |
| 7 | Victory condition misses | Check in BOTH `TickUpdate()` AND `ThrottledUpdate()` |
| 8 | AI logic skips | Check `mod.GetSoldierState(player, IsAISoldier)` |
| 9 | Messages stay forever | Track with countdown; hide after `messageDisplayTime` |
|10 | Magic numbers everywhere | Define every ID, timing, and color as a named constant |

---

## 📌 Notes

- Check off items as you complete them
- Not all items apply to every game mode — skip what doesn't apply
- Refer to `BF6_API_SUMMARY.md` for SDK functions
- Use `LLM_TEMPLATE.ts` as your starting point
- Keep `memory.md` and `todo.md` updated during development

---

> **Good luck with your mod!** 🎮
