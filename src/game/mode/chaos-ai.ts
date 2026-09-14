/**
 * chaos-ai.ts — Team 4 (Chaos Squads), the unlisted, unjoinable, non-scoring AI-only faction.
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → "Players & Teams" table / "Terminate Rogue AI Elements".
 * Respawn cadence accelerates in Phase 3 (`controlzone.ts`'s `isPhase3()`), per
 * `CHAOS_AI_PHASE_3_RESPAWN_MULTIPLIER`.
 *
 * ── Chaos Squads is not a team, but kills/assists against it still pay out (current direction) ──
 * Per `config/teams.ts`'s header note: Chaos Squads never appears in the scoreboard, never earns
 * tickets, and never factors into majority-hold presence. However, a human player who kills (or
 * assists on a kill against) a Chaos bot is still making a combat kill/assist from their own
 * perspective, so this file grants cash+XP rewards via `wallet.ts`'s `addKillReward` — see
 * `config/constants.ts`'s `CHAOS_KILL_CASH_REWARD`/`CHAOS_KILL_XP_REWARD` and
 * `CHAOS_ASSIST_CASH_REWARD`/`CHAOS_ASSIST_XP_REWARD` for the (smaller, since Chaos bots are map
 * pressure rather than an equally-valuable target) payout amounts.
 *
 * ── Real SDK events used (confirmed against
 * https://fivelity.github.io/unofficial-bf6-portal-sdk-docs/) ──
 * `Events.OnPlayerEarnedKill(eventPlayer, eventOtherPlayer, ...)` and
 * `Events.OnPlayerEarnedKillAssist(eventPlayer, eventOtherPlayer)` both fire with `eventPlayer`
 * as the human earning credit and `eventOtherPlayer` as the victim — checking
 * `liveBots.has(eventOtherPlayer)` on the victim side is the precise way to detect "this kill/
 * assist credit was earned against a Chaos bot," which is more reliable than deriving the same
 * fact from `OnPlayerDied` (which fires from the victim's own perspective and doesn't by itself
 * distinguish a credited kill from an uncredited/environmental death).
 *
 * ── Two independent bugs fixed against the live SDK (kept from the prior audit pass) ──
 *
 * 1. **Wrong team.** `mod.SpawnAIFromAISpawner(chaosSpawner, mod.GetTeam(1))` would spawn every
 *    bot onto Team1 (Lonestar) instead of Chaos Squads. Fixed to `mod.GetTeam(4)`.
 *
 * 2. **Bot count never tracked.** `mod.SpawnAIFromAISpawner` returns `void` (all overloads), so
 *    there is no handle to track from the spawn call itself. Tracking instead goes through
 *    `Events.OnSpawnerSpawned(eventPlayer, eventSpawner)` — confirmed real, doc comment: "This
 *    will trigger when an AISpawner spawns an AI Soldier." — filtered to `chaosSpawner` via
 *    `mod.Equals` in case other AI spawners exist elsewhere on the map. `topUpBots()` requests
 *    the full remaining deficit up front (each `spawnOneBot()` call is fire-and-forget) rather
 *    than spawning one-at-a-time and re-checking `liveBots.size` mid-loop, since that size cannot
 *    change synchronously within this function — it only grows once `OnSpawnerSpawned` confirms
 *    a bot actually came into existence.
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
	CHAOS_KILL_CASH_REWARD,
	CHAOS_KILL_XP_REWARD,
	CHAOS_ASSIST_CASH_REWARD,
	CHAOS_ASSIST_XP_REWARD,
} from "../../config/constants.ts";
import { isPhase3 } from "./controlzone.ts";
import { getPlayerState } from "../../player/player-state.ts";
import { addKillReward } from "../../player/wallet.ts";

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

Events.OnPlayerDied.subscribe((eventPlayer) => {
	// Bot-death bookkeeping only — reward crediting happens in the OnPlayerEarnedKill/
	// OnPlayerEarnedKillAssist handlers below, which fire specifically for the human player
	// earning credit rather than for the victim.
	liveBots.delete(eventPlayer);
});

Events.OnPlayerEarnedKill.subscribe((eventPlayer, eventOtherPlayer) => {
	if (!liveBots.has(eventOtherPlayer)) {
		return; // Victim wasn't a tracked Chaos bot — combat-rewards.ts handles the human-kill case.
	}
	const killerState = getPlayerState(eventPlayer);
	if (!killerState) {
		return; // Killer isn't a tracked human player.
	}
	addKillReward(eventPlayer, CHAOS_KILL_CASH_REWARD, CHAOS_KILL_XP_REWARD, "assault", "chaosKill");
});

Events.OnPlayerEarnedKillAssist.subscribe((eventPlayer, eventOtherPlayer) => {
	if (!liveBots.has(eventOtherPlayer)) {
		return;
	}
	const assisterState = getPlayerState(eventPlayer);
	if (!assisterState) {
		return;
	}
	addKillReward(eventPlayer, CHAOS_ASSIST_CASH_REWARD, CHAOS_ASSIST_XP_REWARD, "assault", "chaosAssist");
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
