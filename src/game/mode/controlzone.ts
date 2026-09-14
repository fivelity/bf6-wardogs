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
 * ── Ticket rule (current direction) ──
 * Every `CONTROL_ZONE_TICK_SECONDS` (10s), tally each scoring faction's *weighted player count*
 * across both zones: a player standing in the Control Zone only counts as 1; a player standing in
 * the HotZone counts as `HOTZONE_PRESENCE_WEIGHT` (2), matching the brief's "double-scoring
 * HotZone" intent. Whichever scoring faction has the single highest weighted count for that tick
 * earns `CONTROL_ZONE_TICKET_REWARD` (1) ticket. First scoring faction to `VICTORY_TICKET_TARGET`
 * (100) tickets wins (`win-condition.ts`). Chaos Squads (Team4) never participates in this tally
 * — see `config/teams.ts`'s header note.
 *
 * Symbols verified against `bf6-portal-mod-types@4.2.0`:
 *   - `Events.OnPlayerEnterAreaTrigger` / `OnPlayerExitAreaTrigger` — event-handler-signatures.d.ts
 *   - `Events.OngoingGlobal` — event-handler-signatures.d.ts (fires every server tick)
 *   - `mod.SetGameModeScore` / `SetGameModeInitialScore` / `SetGameModeCriteria` — index.d.ts,
 *     grepped: only setters exist, no `AddGameModeScore` getter/adder (see AGENTS.md §2).
 */

import { Events } from "../../../node_modules/bf6-portal-utils/events/index.ts";
import { OBJECT_ID } from "../../config/ids.ts";
import {
	requirePlayerState,
	getAllTrackedPlayers,
} from "../../player/player-state.ts";
import {
	getFactionId,
	isScoringFaction,
	SCORING_FACTION_IDS,
	type FactionId,
} from "../../config/teams.ts";
import {
	CONTROL_ZONE_TICK_SECONDS,
	CONTROL_ZONE_TICKET_REWARD,
	HOTZONE_PRESENCE_WEIGHT,
	PHASE_3_TICKET_THRESHOLD,
} from "../../config/constants.ts";
import { evaluateWinCondition, startMatchTimer } from "./win-condition.ts";

/** Faction → tracked ticket total. This module owns the only writes to it; win-condition.ts reads it. */
const ticketsByFaction: Record<FactionId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

/** Faction → weighted player count from the most recently completed 10s tally window. */
const lastWeightedPresence: Record<FactionId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

/** Faction → raw (unweighted) player headcount across both zones, for the Team Score HUD panel. */
const lastPlayerCount: Record<FactionId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

export function getTickets(faction: FactionId): number {
	return ticketsByFaction[faction];
}

export function getAllTickets(): Readonly<Record<FactionId, number>> {
	return ticketsByFaction;
}

/**
 * The raw number of tracked players a scoring faction currently has inside the Control Zone
 * and/or HotZone (each player counted once, regardless of zone) — this is the number the Team
 * Score HUD panel displays, distinct from the *weighted* count used to decide who earns the
 * tick's ticket.
 */
export function getPlayerCount(faction: FactionId): number {
	return lastPlayerCount[faction];
}

export function getAllPlayerCounts(): Readonly<Record<FactionId, number>> {
	return lastPlayerCount;
}

/**
 * True once ANY scoring faction has crossed `PHASE_3_TICKET_THRESHOLD`. `hotzone.ts` and
 * `chaos-ai.ts` both gate their Phase-3 acceleration behavior on this.
 */
export function isPhase3(): boolean {
	return SCORING_FACTION_IDS.some(
		(faction) => ticketsByFaction[faction] >= PHASE_3_TICKET_THRESHOLD
	);
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
 * A ControlZone-only occupant contributes 1 to both the weighted and raw counts; a HotZone
 * occupant contributes `HOTZONE_PRESENCE_WEIGHT` (2) to the weighted count but still only 1 to
 * the raw headcount, since the brief defines HotZone presence as a scoring multiplier on the
 * SAME majority count, not an additional player.
 */
function computeZonePresence(): { weighted: Record<FactionId, number>; raw: Record<FactionId, number> } {
	const weighted: Record<FactionId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
	const raw: Record<FactionId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

	for (const [player, state] of getAllTrackedPlayers()) {
		if (!state.insideControl && !state.insideHot) {
			continue;
		}
		const team = mod.GetTeam(player);
		if (!isScoringFaction(team)) {
			continue; // Chaos Squads (Team4) never contribute to majority-hold, per the brief.
		}
		const faction = getFactionId(team);
		raw[faction] += 1;
		weighted[faction] += state.insideHot ? HOTZONE_PRESENCE_WEIGHT : 1;
	}

	return { weighted, raw };
}

let controlZoneAccumulatedSeconds = 0;
const CONTROL_ZONE_ASSUMED_SERVER_TICK_SECONDS = 1 / 30;

Events.OngoingGlobal.subscribe(() => {
	controlZoneAccumulatedSeconds += CONTROL_ZONE_ASSUMED_SERVER_TICK_SECONDS;
	if (controlZoneAccumulatedSeconds < CONTROL_ZONE_TICK_SECONDS) {
		return;
	}
	controlZoneAccumulatedSeconds = 0;

	const { weighted, raw } = computeZonePresence();
	lastPlayerCount[1] = raw[1];
	lastPlayerCount[2] = raw[2];
	lastPlayerCount[3] = raw[3];
	lastWeightedPresence[1] = weighted[1];
	lastWeightedPresence[2] = weighted[2];
	lastWeightedPresence[3] = weighted[3];

	// Majority-hold: whichever scoring faction has the single highest weighted presence, with no
	// tie for first place, earns this tick's ticket.
	let leader: FactionId | undefined;
	let leaderWeight = 0;
	let tied = false;
	for (const faction of SCORING_FACTION_IDS) {
		const weight = weighted[faction];
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

	// Objectives (CapturePoint/Sector) and AreaTriggers are inert — no capture ring, no
	// minimap/bigmap icon — until explicitly enabled. HQs are enabled by default in Portal's base
	// template, which is why only the HQs render without this; the custom WARDOGS objectives below
	// need it done manually. Confirmed real: `EnableGameModeObjective`/`SetObjectiveUIEnabled`
	// (index.d.ts:1006/1358), `EnableAreaTrigger` (index.d.ts:857).
	//
	// ObjIds reconciled against the current scene (mp_granite_military_storage_portal.spatial.json):
	// only ONE tower exists (CP_TOWER_A / ObjId 76) — no Tower B. `SECTOR_HOTZONE`'s ObjId (333)
	// no longer collides with anything in this scene revision (previously flagged against
	// IP_BUY_MENU_VALKYRA — that collision is resolved, see config/ids.ts's audit note), so it is
	// safely enabled here alongside the Control Zone and Tower sectors.
	const controlZoneSector = mod.GetSector(OBJECT_ID.SECTOR_CONTROLZONE);
	const hotZoneSector = mod.GetSector(OBJECT_ID.SECTOR_HOTZONE);
	const towerASector = mod.GetSector(OBJECT_ID.SECTOR_TOWER_A);
	const controlZoneCp = mod.GetCapturePoint(OBJECT_ID.CP_CONTROLZONE);
	const hotZoneCp = mod.GetCapturePoint(OBJECT_ID.CP_HOTZONE);
	const towerACp = mod.GetCapturePoint(OBJECT_ID.CP_TOWER_A);

	for (const objective of [controlZoneSector, hotZoneSector, towerASector, controlZoneCp, hotZoneCp, towerACp]) {
		mod.EnableGameModeObjective(objective, true);
		mod.SetObjectiveUIEnabled(objective, true);
	}

	mod.EnableAreaTrigger(mod.GetAreaTrigger(OBJECT_ID.AT_CONTROLZONE), true);
	mod.EnableAreaTrigger(mod.GetAreaTrigger(OBJECT_ID.AT_HOTZONE), true);

	// Enforces WARDOGS_DESIGN_BRIEF.md → "Match Duration" (30-minute limit). Invoked here rather
	// than from win-condition.ts subscribing to OnGameModeStarted itself, since this file already
	// owns that Portal hook (AGENTS.md §4 — single-owner raw event hooks).
	startMatchTimer(getAllTickets);
});

export { setTickets };
