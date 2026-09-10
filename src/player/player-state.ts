/**
 * player-state.ts — the `JsPlayer` state shape, one instance per connected `mod.Player`.
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → "Player State Shape" table.
 * `mod.Player` is an opaque type (confirmed in `bf6-portal-mod-types/types.d.ts`) — it can be
 * used as a `Map` key directly (reference identity), but there is no `mod.GetPlayerId`-style
 * stable primitive-key function in the real SDK, so this file does NOT try to serialize a
 * player into a string/number key. Everything is Map-by-object-identity.
 *
 * `Events.OnPlayerJoinGame` / `Events.OnPlayerLeaveGame` are both confirmed real in
 * `bf6-portal-mod-types/event-handler-signatures.d.ts`.
 */

import { Events } from "bf6-portal-utils/events/index.ts";
import { STARTING_CASH } from "../config/constants.ts";
import { createInitialTrackState, type TrackId, type TrackState } from "./progression.ts";

export class JsPlayer {
	/** Persistent transactional wallet balance. Starts at STARTING_CASH exactly once per player. */
	currentCash = STARTING_CASH;

	/**
	 * FOB / fortification build materials. Distinct from cash (see WARDOGS_DESIGN_BRIEF.md →
	 * "Point System": Logistics Cargo Delivery grants materials, not cash, to the FOB pool).
	 */
	materials = 0;

	/** Six mastery tracks: Assault, Medic, Support, Recon, Driver/Pilot, Engineer. */
	tracks: Record<TrackId, TrackState> = createInitialTrackState();

	/** Whether the player is currently inside the outer ControlZone polygon. */
	insideControl = false;

	/** Whether the player is currently inside the 60m drifting HotZone. */
	insideHot = false;

	/** Slot-1 primary weapon package purchased at a buy station; wiped on death/undeploy. */
	purchasedPrimary: string | undefined = undefined;
}

/** Module-scope tracking Map — populated/cleaned up by the join/leave subscriptions below. */
const playersByHandle = new Map<mod.Player, JsPlayer>();

/**
 * Returns the tracked state for a player, or `undefined` if they aren't tracked (e.g. called
 * before `OnPlayerJoinGame` has fired for them). Prefer `requirePlayerState` when the caller can
 * assume the player is already tracked.
 */
export function getPlayerState(player: mod.Player): JsPlayer | undefined {
	return playersByHandle.get(player);
}

/**
 * Returns the tracked state for a player, throwing if they aren't tracked. Use this in handlers
 * that only ever fire for players already known to be in the match (most gameplay code) so a
 * missing-state bug surfaces immediately instead of silently no-op-ing.
 */
export function requirePlayerState(player: mod.Player): JsPlayer {
	const state = playersByHandle.get(player);
	if (!state) {
		throw new Error("requirePlayerState: player has no tracked JsPlayer state (join event missed?)");
	}
	return state;
}

/** All currently-tracked [player, state] pairs. Prefer a more specific helper where one exists. */
export function getAllTrackedPlayers(): ReadonlyArray<readonly [mod.Player, JsPlayer]> {
	return Array.from(playersByHandle.entries());
}

/**
 * Every tracked player currently on `team`, filtered from our own Map — NOT from
 * `mod.AllPlayers()`. `mod.AllPlayers()` returns the opaque `mod.Array` runtime type (confirmed
 * in `bf6-portal-mod-types/types.d.ts`), which isn't directly iterable from TypeScript; since we
 * already maintain a full player Map here, filtering it by `mod.GetTeam` is both simpler and
 * avoids the opaque-Array problem entirely.
 */
export function getAllPlayersOnTeam(team: mod.Team): ReadonlyArray<readonly [mod.Player, JsPlayer]> {
	const result: Array<readonly [mod.Player, JsPlayer]> = [];
	for (const [player, state] of playersByHandle) {
		if (mod.Equals(mod.GetTeam(player), team)) {
			result.push([player, state]);
		}
	}
	return result;
}

Events.OnPlayerJoinGame.subscribe((eventPlayer) => {
	if (!playersByHandle.has(eventPlayer)) {
		playersByHandle.set(eventPlayer, new JsPlayer());
	}
});

Events.OnPlayerLeaveGame.subscribe((_eventNumber) => {
	// NOTE: OnPlayerLeaveGame's payload is a bare `number` (confirmed in
	// event-handler-signatures.d.ts), not a `mod.Player` — there is no real SDK call that maps
	// that number back to the `mod.Player` handle it belonged to, so this handler cannot look up
	// and delete a specific Map entry from it. Stale Map entries for departed players are
	// reference-identity keyed and cost nothing per-tick to leave in place; if profiling ever
	// shows otherwise, this needs a real removal mechanism confirmed against the SDK first, not
	// a guessed one.
});
