/**
 * win-condition.ts — the 100-ticket win check, the match-duration timer, and the `EndGameMode`
 * workaround.
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → "Win Conditions" / "Tiebreaker" / "Match Duration".
 * Called from `controlzone.ts` after every ticket update with the SAME tracked score object that
 * module writes via `mod.SetGameModeScore` — never re-derived from `mod.*` score getters, to
 * keep a single source of truth for "what did WARDOGS itself last set this to," even though a
 * real `mod.GetGameModeScore` getter does exist (confirmed against the SDK reference docs) — see
 * `controlzone.ts`'s own header note. `mod.EndGameMode(team: Team)` is confirmed real and
 * overloaded for both `Player` and `Team`.
 *
 * ── Match timer (real native timer functions, confirmed against
 * https://fivelity.github.io/unofficial-bf6-portal-sdk-docs/) ──
 * `startMatchTimer` calls `mod.SetGameModeTimeLimit(MATCH_DURATION_SECONDS)` once at
 * `OnGameModeStarted` and subscribes to `Events.OnTimeLimitReached` (confirmed real,
 * `EventHandlerSignatures.OnTimeLimitReached(): void`) — this uses Portal's own authoritative,
 * driftless time-limit system rather than a hand-rolled `Events.OngoingGlobal`
 * assumed-tick-rate accumulator. `mod.GetMatchTimeRemaining()` (confirmed real, no-argument,
 * returns `number`) backs the HUD's live countdown display in `ui/hud.ts` instead of a second,
 * parallel HUD-side counter.
 */

import { VICTORY_TICKET_TARGET, MATCH_DURATION_SECONDS } from "../../config/constants.ts";
import { SCORING_FACTION_IDS, type FactionId } from "../../config/teams.ts";
import { getAllPlayersOnTeam } from "../../player/player-state.ts";
import { getCash } from "../../player/wallet.ts";
import { Events } from "../../../node_modules/bf6-portal-utils/events/index.ts";

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

/** Picks a single winner from `candidates`, breaking ties by highest cumulative wallet total. */
function resolveTiebreak(candidates: readonly FactionId[]): FactionId {
	return candidates.reduce((best, candidate) =>
		cumulativeWalletTotal(candidate) > cumulativeWalletTotal(best) ? candidate : best
	);
}

function declareWinner(faction: FactionId): void {
	if (gameHasEnded) {
		return;
	}
	gameHasEnded = true;
	mod.EndGameMode(mod.GetTeam(faction));
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

	const winner = qualifying.length === 1 ? qualifying[0]! : resolveTiebreak(qualifying);
	declareWinner(winner);
}

/**
 * Declares whichever scoring faction currently has the highest ticket count the winner, applying
 * the same wallet tiebreaker as a simultaneous 100-ticket race. Called from
 * `Events.OnTimeLimitReached`.
 */
function evaluateTimeExpiredWinner(ticketsByFaction: Readonly<Record<FactionId, number>>): void {
	if (gameHasEnded) {
		return;
	}

	let highestTickets = -1;
	for (const faction of SCORING_FACTION_IDS) {
		if (ticketsByFaction[faction] > highestTickets) {
			highestTickets = ticketsByFaction[faction];
		}
	}

	const leaders = SCORING_FACTION_IDS.filter((faction) => ticketsByFaction[faction] === highestTickets);
	const winner = leaders.length === 1 ? leaders[0]! : resolveTiebreak(leaders);
	declareWinner(winner);
}

/**
 * Starts the 30-minute match-duration countdown using Portal's native time-limit system. Call
 * once, at `Events.OnGameModeStarted` (wired in `controlzone.ts`, which already owns that hook —
 * this function is invoked from there rather than subscribing to `OnGameModeStarted` a second
 * time, since Portal event hooks are single-owner per AGENTS.md §4's `Events` discipline;
 * `Events.OnTimeLimitReached.subscribe` here is a separate, additional hook and does not
 * conflict with that rule).
 */
export function startMatchTimer(getCurrentTickets: () => Readonly<Record<FactionId, number>>): void {
	mod.SetGameModeTimeLimit(MATCH_DURATION_SECONDS);

	Events.OnTimeLimitReached.subscribe(() => {
		evaluateTimeExpiredWinner(getCurrentTickets());
	});
}

/** True once a winner has been declared — other systems (Chaos AI, buy menus) can gate on this. */
export function hasGameEnded(): boolean {
	return gameHasEnded;
}
