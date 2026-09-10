/**
 * controlzone.ts — majority-hold tick logic for the static Control Zone, folding in HotZone's
 * 2x presence weight per WARDOGS_DESIGN_BRIEF.md → "Point System".
 *
 * Occupancy for BOTH `AT_CONTROLZONE` and `AT_HOTZONE` is tracked here (not split into a
 * separate hotzone.ts occupancy tracker) because the HotZone's contribution is defined in the
 * brief purely as a presence-weight multiplier feeding ControlZone's majority calculation, not a
 * separate ticket track. `game/mode/hotzone.ts` owns the flag's drift movement; it imports
 * `getAllTickets`/`isPhase3` from here rather than re-subscribing to the same AreaTrigger events,
 * per AGENTS.md §8's guidance on not duplicating zone-occupancy bookkeeping.
 *
 * Symbols verified against `bf6-portal-mod-types@4.2.0`:
 *   - `Events.OnPlayerEnterAreaTrigger` / `OnPlayerExitAreaTrigger` — event-handler-signatures.d.ts
 *   - `Events.OngoingGlobal` — event-handler-signatures.d.ts (fires every server tick)
 *   - `mod.SetGameModeScore` / `SetGameModeInitialScore` / `SetGameModeCriteria` — index.d.ts,
 *     grepped: only setters exist, no `AddGameModeScore` getter/adder (see AGENTS.md §2).
 */

import { Events } from "../../../node_modules/bf6-portal-utils/events/index.ts";
import { OBJECT_ID } from "../../config/ids.ts";
import { requirePlayerState, getAllTrackedPlayers } from "../../player/player-state.ts";
import { getFactionId, isScoringFaction, SCORING_FACTION_IDS, type FactionId } from "../../config/teams.ts";
import {
	CONTROL_ZONE_TICK_SECONDS,
	CONTROL_ZONE_TICKET_REWARD,
	HOTZONE_PRESENCE_WEIGHT,
	PHASE_3_TICKET_THRESHOLD,
} from "../../config/constants.ts";
import { evaluateWinCondition } from "./win-condition.ts";

/** Faction → tracked ticket total. This module owns the only writes to it; win-condition.ts reads it. */
const ticketsByFaction: Record<FactionId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

export function getTickets(faction: FactionId): number {
	return ticketsByFaction[faction];
}

export function getAllTickets(): Readonly<Record<FactionId, number>> {
	return ticketsByFaction;
}

/**
 * True once ANY scoring faction has crossed `PHASE_3_TICKET_THRESHOLD`. `hotzone.ts` and
 * `chaos-ai.ts` both gate their Phase-3 acceleration behavior on this.
 */
export function isPhase3(): boolean {
	return SCORING_FACTION_IDS.some((faction) => ticketsByFaction[faction] >= PHASE_3_TICKET_THRESHOLD);
}

/** Applies `newTicketTotal` for `faction` to both our tracked state and the native score. */
function setTickets(faction: FactionId, newTicketTotal: number): void {
	ticketsByFaction[faction] = newTicketTotal;
	mod.SetGameModeScore(mod.GetTeam(faction), newTicketTotal);
}

Events.OnPlayerEnterAreaTrigger.subscribe((eventPlayer, eventAreaTrigger) => {
	const areaTriggerId = mod.GetObjId(eventAreaTrigger);
	const state = requirePlayerState(eventPlayer);
	if (areaTriggerId === OBJECT_ID.AT_CONTROLZONE) {
		state.insideControl = true;
	} else if (areaTriggerId === OBJECT_ID.AT_HOTZONE) {
		state.insideHot = true;
	}
});

Events.OnPlayerExitAreaTrigger.subscribe((eventPlayer, eventAreaTrigger) => {
	const areaTriggerId = mod.GetObjId(eventAreaTrigger);
	const state = requirePlayerState(eventPlayer);
	if (areaTriggerId === OBJECT_ID.AT_CONTROLZONE) {
		state.insideControl = false;
	} else if (areaTriggerId === OBJECT_ID.AT_HOTZONE) {
		state.insideHot = false;
	}
});

/**
 * Weighted majority-hold tally, computed fresh each tick from `player-state.ts`'s tracked Map
 * (not from `mod.AllPlayers()` — see that file's header comment on the opaque `mod.Array` type).
 * A ControlZone-only occupant contributes 1; a HotZone occupant contributes
 * `HOTZONE_PRESENCE_WEIGHT` (2) instead of stacking both, since the brief defines HotZone
 * presence as a multiplier on the SAME majority count, not an additional track.
 */
function computeWeightedPresence(): Record<FactionId, number> {
	const presence: Record<FactionId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

	for (const [player, state] of getAllTrackedPlayers()) {
		if (!state.insideControl && !state.insideHot) {
			continue;
		}
		const team = mod.GetTeam(player);
		const faction = getFactionId(team);
		if (!isScoringFaction(team)) {
			continue; // Chaos Squads (Team4) never contribute to majority-hold, per the brief.
		}
		presence[faction] += state.insideHot ? HOTZONE_PRESENCE_WEIGHT : 1;
	}

	return presence;
}

let accumulatedSeconds = 0;
/** Portal's OngoingGlobal fires roughly every server tick (~30Hz per AGENTS.md's own note). */
const ASSUMED_SERVER_TICK_SECONDS = 1 / 30;

Events.OngoingGlobal.subscribe(() => {
	accumulatedSeconds += ASSUMED_SERVER_TICK_SECONDS;
	if (accumulatedSeconds < CONTROL_ZONE_TICK_SECONDS) {
		return;
	}
	accumulatedSeconds = 0;

	const presence = computeWeightedPresence();

	// Majority-hold: whichever scoring faction has the single highest weighted presence, with no
	// tie for first place, holds the zone this tick.
	let leader: FactionId | undefined;
	let leaderWeight = 0;
	let tied = false;
	for (const faction of SCORING_FACTION_IDS) {
		const weight = presence[faction];
		if (weight > leaderWeight) {
			leader = faction;
			leaderWeight = weight;
			tied = false;
		} else if (weight === leaderWeight && weight > 0) {
			tied = true;
		}
	}

	if (leader !== undefined && !tied && leaderWeight > 0) {
		setTickets(leader, ticketsByFaction[leader] + CONTROL_ZONE_TICKET_REWARD);
	}

	evaluateWinCondition(ticketsByFaction);
});


	// Force the native win-target to 1 so Portal's own win-detection never fires prematurely;
	// win-condition.ts's explicit EndGameMode call is the real win trigger. `SetGameModeCriteria`
	// only sets which direction of score change counts as "winning" (HighestProgress here) — the
	// actual target number is `SetGameModeTargetScore`, confirmed real at index.d.ts:816 (with a
	// matching `GetTargetScore` getter at index.d.ts:2276). Both are needed; conflating them was
	// an earlier draft mistake in this file. See AGENTS.md §2 and WARDOGS_DESIGN_BRIEF.md →
	// "Win Conditions" for why this workaround exists at all.
Events.OnGameModeStarted.subscribe(() => {
    mod.SetGameModeCriteria(mod.ScoreCriteria.HighestProgress);
    mod.SetGameModeTargetScore(1);
    
    for (const faction of SCORING_FACTION_IDS) {
        mod.SetGameModeInitialScore(mod.GetTeam(faction), 0);
    }
});

export { setTickets };
