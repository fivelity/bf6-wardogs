/**
 * progression.ts — XP/level logic for the six mastery tracks.
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → "Player State Shape" (`tracks: Record<TrackId, {level, xp}>`).
 * Pure logic only: reads the XP-table data from `economy.ts`, mutates `player-state.ts`'s
 * per-player track state, and exposes a level-up callback list that `ui/hud.ts` and future
 * VFX/SFX code can subscribe to, without those consumers needing to import `player-state.ts`
 * directly for this concern.
 */

import { TRACK_XP_THRESHOLDS, MAX_TRACK_LEVEL } from "../config/economy.ts";
import { requirePlayerState } from "./player-state.ts";

export type TrackId = "assault" | "medic" | "support" | "recon" | "driverPilot" | "engineer";

export const TRACK_IDS: readonly TrackId[] = [
	"assault",
	"medic",
	"support",
	"recon",
	"driverPilot",
	"engineer",
];

export interface TrackState {
	level: number;
	xp: number;
}

export function createInitialTrackState(): Record<TrackId, TrackState> {
	const tracks = {} as Record<TrackId, TrackState>;
	for (const trackId of TRACK_IDS) {
		tracks[trackId] = { level: 1, xp: 0 };
	}
	return tracks;
}

/**
 * Given a track's current XP, returns the level that XP total qualifies for (1-5), based on
 * `economy.ts`'s `TRACK_XP_THRESHOLDS`. Pure function — no Portal runtime dependency, safe to
 * unit test.
 */
export function levelForXp(xp: number): number {
	let level = 1;
	for (let candidate = 2; candidate <= MAX_TRACK_LEVEL; candidate++) {
		const threshold = TRACK_XP_THRESHOLDS[candidate];
		if (threshold !== undefined && xp >= threshold) {
			level = candidate;
		}
	}
	return level;
}

type RankUpListener = (player: mod.Player, track: TrackId, newLevel: number) => void;
const rankUpListeners: RankUpListener[] = [];

/** Subscribe to rank-up events (level increases). Returns an unsubscribe function. */
export function onRankUp(listener: RankUpListener): () => void {
	rankUpListeners.push(listener);
	return () => {
		const index = rankUpListeners.indexOf(listener);
		if (index !== -1) {
			rankUpListeners.splice(index, 1);
		}
	};
}

/**
 * Adds XP to one of a player's mastery tracks and fires `onRankUp` listeners if the addition
 * crosses a level threshold. Caller is responsible for deciding how much XP a given action is
 * worth (see `economy.ts`'s `XP_REWARDS` / `XP_REWARD_TRACK`).
 */
export function addXp(player: mod.Player, track: TrackId, amount: number): void {
	if (amount <= 0) {
		return;
	}

	const state = requirePlayerState(player);
	const trackState = state.tracks[track];
	const previousLevel = trackState.level;

	trackState.xp += amount;
	trackState.level = levelForXp(trackState.xp);

	if (trackState.level > previousLevel) {
		for (const listener of rankUpListeners) {
			listener(player, track, trackState.level);
		}
	}
}

export function getTrackState(player: mod.Player, track: TrackId): TrackState {
	return requirePlayerState(player).tracks[track];
}
