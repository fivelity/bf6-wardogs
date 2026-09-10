/**
 * win-condition.ts — the 100-ticket win check and the `EndGameMode` workaround.
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → "Win Conditions" / "Tiebreaker".
 * Called from `controlzone.ts` after every ticket update with the SAME tracked score object that
 * module writes via `mod.SetGameModeScore` — never re-derived from `mod.*`, since there is no
 * `GetGameModeScore` getter in the confirmed API surface (grepped `index.d.ts`; only the setters
 * `SetGameModeScore`/`SetGameModeInitialScore`/`SetGameModeCriteria`/`SetGameModeTargetScore`
 * exist). `mod.EndGameMode(team: Team)` is confirmed real and overloaded for both `Player` and
 * `Team` (`index.d.ts:783/786`).
 */

import { VICTORY_TICKET_TARGET } from "../../config/constants.ts";
import { SCORING_FACTION_IDS, type FactionId } from "../../config/teams.ts";
import { getAllPlayersOnTeam } from "../../player/player-state.ts";
import { getCash } from "../../player/wallet.ts";

/** Set once `mod.EndGameMode` has been called, so a late tick can't call it a second time. */
let gameHasEnded = false;

/** Sum of `currentCash` across every tracked player currently on `faction`'s team. */
function cumulativeWalletTotal(faction: FactionId): number {
	const team = mod.GetTeam(faction);
	let total = 0;
	for (const [player] of getAllPlayersOnTeam(team)) {
		total += getCash(player);
	}
	return total;
}

/**
 * Checks the current ticket totals for a winner. If exactly one faction is at or above
 * `VICTORY_TICKET_TARGET`, ends the match for that faction immediately. If two or more factions
 * cross the target on the same tick, the brief's tiebreaker (highest cumulative wallet total
 * across all active squad profiles) decides which one wins.
 */
export function evaluateWinCondition(ticketsByFaction: Readonly<Record<FactionId, number>>): void {
	if (gameHasEnded) {
		return;
	}

	const qualifying = SCORING_FACTION_IDS.filter((faction) => ticketsByFaction[faction] >= VICTORY_TICKET_TARGET);
	if (qualifying.length === 0) {
		return;
	}

	let winner: FactionId;
	if (qualifying.length === 1) {
		winner = qualifying[0]!;
	} else {
		// Simultaneous 100+ for two or more factions: highest cumulative wallet total wins.
		winner = qualifying.reduce((best, candidate) =>
			cumulativeWalletTotal(candidate) > cumulativeWalletTotal(best) ? candidate : best
		);
	}

	gameHasEnded = true;
	mod.EndGameMode(mod.GetTeam(winner));
}

/** True once a winner has been declared — other systems (Chaos AI, buy menus) can gate on this. */
export function hasGameEnded(): boolean {
	return gameHasEnded;
}
