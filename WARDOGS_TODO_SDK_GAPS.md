# WARDOGS — Open SDK Verification Gaps

## Update: unofficial TypeDoc reference checked this pass

`https://fivelity.github.io/unofficial-bf6-portal-sdk-docs/` was fetched and its full `mod`
namespace A–Z function/enum/type index was pulled directly (each entry links to a page citing an
exact `sdk.d.ts` line number, e.g. `mod.Wait` → `sdk.d.ts:29662`). This is a materially better
source than anything available earlier in this session (no `node_modules` present to grep
directly), and it changes the verdict on some symbols from the previous pass:

**Newly confirmed real** (cited `sdk.d.ts` line, used in `fob.ts` this pass):
- `mod.Wait(n: number): Promise<void>` — `sdk.d.ts:29662`
- `mod.SpawnPlayerFromSpawnPoint(player, spawnPoint)` — `sdk.d.ts:30268`
- `mod.DisplayCustomNotificationMessage(msg: mod.Message, slot, duration, target?)` —
  `sdk.d.ts:30614/30621/30629` (three overloads; takes a `mod.Message`, not a raw string — still
  consistent with this project's `stringkeys`-only rule)
- `mod.CustomNotificationSlots` enum (`HeaderText`/`MessageText1-4`) — `sdk.d.ts:273`
- `mod.DistanceBetween(vector0, vector1): number` — `sdk.d.ts:31661` (not yet consumed, but
  available if a future proximity-gated build feature needs it)
- `mod.Teleport(player, destination, orientation)` — `sdk.d.ts:30274` (not used; `SpawnPlayerFromSpawnPoint` is the better fit for FOB deploy and was used instead)

These were previously (incorrectly, in `mod.Wait`'s case) grouped in with a set of APIs this
session flagged as unverified. Correcting that: `fob.ts`'s deployment-wave/spawn-queue system now
uses `mod.Wait` + `mod.SpawnPlayerFromSpawnPoint` + `mod.DisplayCustomNotificationMessage`, all
now cited against a real `sdk.d.ts` line number.

**Still NOT found anywhere in the full A–Z `mod` namespace index** (confirms the earlier caution
on these was correct):
- `player.GetPosition()` / `player.GetForwardVector()` — method-on-object style calls don't appear
  anywhere; the real API is always namespaced functions on `mod` (e.g. `GetObjectPosition`,
  `GetSoldierState`).
- `mod.RayCast` — this one DOES exist in the index (`functions/sdk.mod.RayCast.html`), so raycasting
  itself is real; however, its exact return shape (the `hitResult.isValid`/`.position` fields the
  earlier attached tutorial assumed) was not indexed/checked this pass — treat the return shape as
  still unconfirmed even though the function name itself is real.
- `mod.getPlayerId` / `mod.getTeamId` — these exist only as `modlib` helper-shorthand functions per
  the site's front page ("A shorthand for `mod.GetObjId(player)`"), not as `mod` namespace members
  — this project's own `config/teams.ts` already reimplements the same shorthand as `getFactionId`
  by calling `mod.GetObjId` directly, so no change needed there.
- `Network.OnReceiveFromClient`, `Input.OnActionPressed`, `new mod.Vector(...)` — none of these
  appear anywhere in the real `mod` namespace index. Still not used anywhere in this codebase.
- No dedicated melee/tool-swing/"build hit" event exists in the confirmed `EventHandlerSignatures`
  list surfaced by this site either — `fob.ts`'s construction-progress trigger still uses
  `Events.OnPlayerInteract` against a runtime-spawned `AreaTrigger` socket (the same verified
  pattern `buy-menu.ts` already uses), not a fabricated melee event.

**Action still needed before this ships as final:** this TypeDoc site is itself marked
"UNOFFICIAL" by its own author and was generated from a `sdk.d.ts` this session did not have local
access to — treat its line citations as strong evidence, not a substitute for `AGENTS.md` §2's own
discipline of grepping the actual installed `node_modules/bf6-portal-mod-types/*.d.ts` once that's
available again. If any cited signature above turns out to differ from the real installed package,
trust the installed package.

## Per-team FOB cap (`FOB_MAX_PER_TEAM = 3`)

Not sourced from an explicit number in `WARDOGS_DESIGN_BRIEF.md` — the brief describes cooperative
construction without specifying a hard cap. Judgment call; confirm with design before treating it
as final, and move it to `config/constants.ts` alongside the mod's other tuning values if kept.

## Deployment wave cadence (`FOB_DEPLOYMENT_WAVE_SECONDS = 15`)

Also a judgment call — the brief describes squad-cooperative FOB deployment but gives no exact
wave interval. 15s matches the "Squad-style" reference pattern commonly used for this kind of
mechanic, not a brief-specified number.
