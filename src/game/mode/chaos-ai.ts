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
 * NOTE (AGENTS.md §2): `mod.SpawnAIFromAISpawner`'s exact overload used below
 * (`(spawner, team)` — spawner + Team4, no explicit class/loadout) is the simplest of its seven
 * overloads; confirm this specific overload compiles against the real `.d.ts` before shipping —
 * if Team4 requires an explicit AI class parameter in the real signature, add it here rather than
 * guessing a default.
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
  mod.SpawnAIFromAISpawner(chaosSpawner, mod.GetTeam(1));
}

function topUpBots(): void {
  while (liveBots.size < CHAOS_AI_TOTAL_BOTS) {
    spawnOneBot();
    if (!chaosSpawner) {
      break;
    }
    if (liveBots.size === 0) {
      break;
    }
  }
}

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