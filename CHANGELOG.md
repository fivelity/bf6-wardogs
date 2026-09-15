# CHANGELOG — Construction System / FOBs

## `src/game/mode/fob.ts`

- Added per-FOB construction progress tracking (0–100%, +5% per build hit per the design brief's
  Point System table, 20 hits to fully construct).
- Wired `CASH_REWARDS.buildHit` (+$100) and `XP_REWARDS.buildHit` (+120 support XP) — these were
  already defined in `config/economy.ts` but nothing previously consumed them.
- Added a build-hit socket per FOB: a runtime-spawned `AreaTrigger` (same confirmed pattern
  `salvage.ts` already uses) driven by `Events.OnPlayerInteract` (same confirmed pattern
  `buy-menu.ts` already uses). No dedicated melee/tool-swing event exists anywhere in the real SDK
  surface checked this pass — see `WARDOGS_TODO_SDK_GAPS.md`.
- Added a per-team FOB cap (`FOB_MAX_PER_TEAM = 3`) with a rejection message — judgment call, not
  a brief-specified number; flagged in `WARDOGS_TODO_SDK_GAPS.md`.
- Added a real "Squad-style" continuous deployment wave (spawn queue) per FOB: a second, distinct
  interact socket lets players queue for deployment; every `FOB_DEPLOYMENT_WAVE_SECONDS` (15s) the
  queue deploys as a batch. Built entirely on symbols confirmed against
  `https://fivelity.github.io/unofficial-bf6-portal-sdk-docs/`'s cited `sdk.d.ts` line numbers:
  `mod.Wait`, `mod.SpawnPlayerFromSpawnPoint`, `mod.DisplayCustomNotificationMessage`,
  `mod.CustomNotificationSlots`. This supersedes an earlier in-session draft of the same feature
  that used unverified non-`mod`-namespace APIs (`player.GetPosition()`,
  `Network.OnReceiveFromClient`, `Input.OnActionPressed`, `new mod.Vector(...)`) — none of those
  are used in the delivered code.
- Added real teardown wiring: FOBs now sweep-teardown once `win-condition.ts`'s `hasGameEnded()`
  flips true (via a new, separate `Events.OngoingGlobal` subscription in this file, respecting
  `AGENTS.md` §4's single-owner event rule rather than editing `win-condition.ts`'s existing
  hook). The deployment-wave loop also exits cleanly on teardown (`fob.active = false`).
- `PortalGadget.onFireStart` placement handler now also checks `hasGameEnded()` so FOBs can't be
  placed after a match has already concluded.
- Exported `teardownAllFobs`, `FOB_MAX_PER_TEAM`, and `FOB_DEPLOYMENT_WAVE_SECONDS`.

## `src/strings.json`

- Added `fob_max_per_team_reached`, `fob_build_hit_progress`, and `fob_deploy_queue_joined` —
  every new displayed string goes through `mod.Message(mod.stringkeys.*, ...)` per this project's
  own strings-only rule; no raw literals introduced.

## Not changed

- `game/mode/fob.ts`'s original placement logic (Portal Gadget PDA aim → `SpawnObject` for deploy
  point / emplacement / sandbag ring) is unchanged — it was already correct and verified.
- `win-condition.ts` was not edited — `hasGameEnded()` was already exported and sufficient.

## Verification note

This pass fetched `https://fivelity.github.io/unofficial-bf6-portal-sdk-docs/` and cross-checked
every new `mod.*` symbol against its full A–Z function index (each entry cites an exact `sdk.d.ts`
line). See `WARDOGS_TODO_SDK_GAPS.md` for the complete list of what's newly confirmed vs. what
remains genuinely unconfirmed (the build-hit trigger's `Events.OnPlayerInteract` substitution is
still the right call — no dedicated melee/tool-swing event exists anywhere in that index either).
