/**
 * chaos-ai.ts — Team 4 (Chaos Squads), the unlisted, unjoinable, non-scoring AI-only faction.
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → "Players & Teams" table / "Terminate Rogue AI Elements".
 * (`controlzone.ts`'s `isPhase3()`), per `CHAOS_AI_PHASE_3_RESPAWN_MULTIPLIER`.
 *
 * Symbols verified against `bf6-portal-mod-types@4.2.0` per BUILD_GUIDE.md §4:
 *   - `mod.SpawnAIFromAISpawner` — index.d.ts:151-205, heavily overloaded for class/name/team.
 *   - AI behavior events — `OnAIMoveToFailed/Running/Succeeded`,
 *     `OnAIWaypointIdleFailed/Running/Succeeded`, `OnAIParachuteRunning/Succeeded` — all confirmed
 *     real in `event-handler-signatures.d.ts`.
 *
 * `(spawner, team: Team)` overload confirmed real against index.d.ts (one of seven overloads);
 * spawns onto `mod.GetTeam(4)` (Chaos Squads per config/teams.ts's FACTIONS table — NOT
 * `GetTeam(1)`, which was an earlier draft bug that put Chaos bots on Team1/Lonestar).
 *
 * Bot-count tracking uses `Events.OnSpawnerSpawned(eventPlayer, eventSpawner)` — confirmed real,
 * event-handler-signatures.d.ts, doc comment: "This will trigger when an AISpawner spawns an AI
 * Soldier." `SpawnAIFromAISpawner` itself returns `void` (no direct handle), so this event is the
 * only real hook that hands back the spawned bot's `mod.Player`; filtered to `chaosSpawner` via
 * `mod.Equals` in case other AI spawners exist elsewhere on the map. See
 * WARDOGS_COMPLETION_REPORT.md §3.4.
 *
 * Team 4 must never appear in `controlzone.ts`'s majority-hold tallying (already enforced there
 * via `isScoringFaction`) or `ui/scoreboard.ts`'s ticket display (enforced by that file only
 * iterating `SCORING_FACTION_IDS`).
 */

/**
 * chaos-ai.ts — Team 4 (Chaos Squads), the unlisted, unjoinable, non-scoring AI-only faction.
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
  chaosSpawner = mod.GetSpawner(
    OBJECT_ID.AI_SPAWNER_CHAOS,
  ) as unknown as mod.Spawner;
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