/**
 * chaos-ai.ts — Team 4 (Chaos Squads), the unlisted, unjoinable, non-scoring AI-only faction.
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → "Players & Teams" table / "Terminate Rogue AI Elements".
 * Respawn cadence accelerates in Phase 3 (`controlzone.ts`'s `isPhase3()`), per
 * `CHAOS_AI_PHASE_3_RESPAWN_MULTIPLIER`.
 *
 * FIXED IN THIS PASS — two independent bugs found by direct inspection of the live behavior:
 *
 * 1. **Wrong team.** The previous version called
 *    `mod.SpawnAIFromAISpawner(chaosSpawner, mod.GetTeam(1))` — Team1 is Lonestar (per
 *    `config/teams.ts`'s `FACTIONS` table), not Chaos Squads. Every AI bot was spawning as a
 *    Lonestar teammate instead of a hostile neutral faction. Fixed to `mod.GetTeam(4)`.
 *
 * 2. **Bot count never tracked.** The previous `topUpBots()` looped
 *    `while (liveBots.size < CHAOS_AI_TOTAL_BOTS)`, but nothing ever called `liveBots.add(...)` —
 *    `mod.SpawnAIFromAISpawner` returns `void` (confirmed, all seven overloads,
 *    `bf6-portal-mod-types@4.2.0/index.d.ts`), so the previous code had no handle to track. The
 *    loop's own `if (liveBots.size === 0) break;` guard fired immediately after the very first
 *    spawn every time, so across a whole match exactly one bot ever existed instead of the 12
 *    (4 squads of 3) the brief specifies.
 *
 *    Fixed via `Events.OnSpawnerSpawned(eventPlayer, eventSpawner)` — confirmed real,
 *    `event-handler-signatures.d.ts`, doc comment: "This will trigger when an AISpawner spawns an
 *    AI Soldier." This is the only real hook that hands back the spawned bot's `mod.Player`;
 *    filtered to `chaosSpawner` via `mod.Equals` (confirmed real, index.d.ts:2394) in case other
 *    AI spawners exist elsewhere on the map. `topUpBots()` now requests the full remaining
 *    deficit up front (each `spawnOneBot()` call is fire-and-forget) rather than spawning
 *    one-at-a-time and re-checking `liveBots.size` mid-loop, since that size cannot change
 *    synchronously within this function — it only grows once `OnSpawnerSpawned` confirms a bot
 *    actually came into existence.
 *
 * Symbols verified against `bf6-portal-mod-types@4.2.0`:
 *   - `mod.SpawnAIFromAISpawner` — heavily overloaded for class/name/team; the `(spawner, team)`
 *     overload used below is one of the seven.
 *   - `mod.GetSpawner`, `mod.Equals` — index.d.ts:2303/2394.
 *   - `Events.OnSpawnerSpawned`, `Events.OnPlayerDied` — event-handler-signatures.d.ts.
 *
 * Team 4 must never appear in `controlzone.ts`'s majority-hold tallying (already enforced there
 * via `isScoringFaction`) or `ui/scoreboard.ts`'s ticket display (enforced by that file only
 * iterating `SCORING_FACTION_IDS`).
 */

import { Events } from "../../../node_modules/bf6-portal-utils/events/index.ts";
import { OBJECT_ID } from "../../config/ids.ts";
import {
  CHAOS_AI_TOTAL_BOTS,
  CHAOS_AI_RESPAWN_INTERVAL_SECONDS,
  CHAOS_AI_PHASE_3_RESPAWN_MULTIPLIER,
} from "../../config/constants.ts";
import { isPhase3 } from "./controlzone.ts";

let chaosSpawner: mod.Spawner | undefined;
const liveBots = new Set<mod.Player>();

Events.OnGameModeStarted.subscribe(() => {
  chaosSpawner = mod.GetSpawner(OBJECT_ID.AI_SPAWNER_CHAOS);
});

function spawnOneBot(): void {
  if (!chaosSpawner) {
    return;
  }
  // Team4 = Chaos Squads (config/teams.ts's FACTIONS table). liveBots is populated by
  // Events.OnSpawnerSpawned below once the engine confirms the spawn, not here — this call
  // itself returns void.
  mod.SpawnAIFromAISpawner(chaosSpawner, mod.GetTeam(4));
}

/**
 * Requests up to `CHAOS_AI_TOTAL_BOTS` worth of spawns. Each call to `spawnOneBot()` is a
 * fire-and-forget request; `liveBots` only grows once `Events.OnSpawnerSpawned` confirms a bot
 * actually came into existence, so this loop intentionally requests the full remaining deficit
 * up front rather than spawning one-at-a-time and re-checking `liveBots.size` mid-loop (that
 * size won't change synchronously within this function).
 */
function topUpBots(): void {
  if (!chaosSpawner) {
    return;
  }
  const deficit = CHAOS_AI_TOTAL_BOTS - liveBots.size;
  for (let i = 0; i < deficit; i++) {
    spawnOneBot();
  }
}

Events.OnSpawnerSpawned.subscribe((eventPlayer: mod.Player, eventSpawner: mod.Spawner) => {
  if (!chaosSpawner || !mod.Equals(eventSpawner, chaosSpawner)) {
    return; // Not our Chaos spawner — ignore (defense in depth if other AI spawners exist).
  }
  liveBots.add(eventPlayer);
});

Events.OnPlayerDied.subscribe((eventPlayer: mod.Player) => {
  if (liveBots.has(eventPlayer)) {
    liveBots.delete(eventPlayer);
  }
});

let chaosAccumulatedSeconds = 0;
const CHAOS_ASSUMED_SERVER_TICK_SECONDS = 1 / 30;

Events.OngoingGlobal.subscribe(() => {
  chaosAccumulatedSeconds += CHAOS_ASSUMED_SERVER_TICK_SECONDS;
  const interval = isPhase3()
    ? CHAOS_AI_RESPAWN_INTERVAL_SECONDS * CHAOS_AI_PHASE_3_RESPAWN_MULTIPLIER
    : CHAOS_AI_RESPAWN_INTERVAL_SECONDS;

  if (chaosAccumulatedSeconds < interval) {
    return;
  }

  chaosAccumulatedSeconds = 0;
  topUpBots();
});

/** Live Chaos Squads bot count, for HUD/objective display. */
export function getChaosLiveBotCount(): number {
  return liveBots.size;
}
