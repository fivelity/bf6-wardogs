/**
 * teams.ts — faction identity for the four WARDOGS teams.
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → "Players & Teams" table.
 * `mod.Team` is an opaque type (confirmed in `bf6-portal-mod-types/types.d.ts`) — the only legal
 * way to get a stable numeric key from one is `mod.GetObjId(team)` (`Team` is part of the real
 * `mod.Object` union, confirmed in `types.d.ts`). This file owns that one conversion point; every
 * other file imports `getFactionId` instead of calling `mod.GetObjId` on a team ad hoc.
 */

export type FactionId = 1 | 2 | 3 | 4;

export interface FactionDefinition {
	id: FactionId;
	name: string;
	shortName: string;
	/** Whether this faction participates in scoring/economy at all (Chaos Squads never does). */
	isScoring: boolean;
}

export const FACTIONS: Record<FactionId, FactionDefinition> = {
	1: { id: 1, name: "Lonestar", shortName: "LSR", isScoring: true },
	2: { id: 2, name: "Manticore", shortName: "MTC", isScoring: true },
	3: { id: 3, name: "Valkyra", shortName: "VLK", isScoring: true },
	4: { id: 4, name: "Chaos Squads", shortName: "CHS", isScoring: false },
} as const;

/** The three human, scoring factions — the order the 3-faction scoreboard/UI should render in. */
export const SCORING_FACTION_IDS: readonly FactionId[] = [1, 2, 3];

/**
 * Converts a `mod.Team` to a stable numeric faction key. This is the ONE place in the codebase
 * allowed to call `mod.GetObjId` on a team — every other file imports this function instead.
 */
export function getFactionId(team: mod.Team): FactionId {
	const id = mod.GetObjId(team);
	if (id !== 1 && id !== 2 && id !== 3 && id !== 4) {
		// A team ObjId outside 1-4 means either a scene misconfiguration or a Portal-side team we
		// don't model (e.g. the neutral/spectator team). Callers should treat this defensively
		// rather than crash; surface it loudly during development instead of silently miscounting
		// a faction's tickets.
		throw new Error(`getFactionId: unexpected team ObjId ${id} — expected 1, 2, 3, or 4`);
	}
	return id;
}

export function getFactionDefinition(team: mod.Team): FactionDefinition {
	return FACTIONS[getFactionId(team)];
}

/** True for Team1/Team2/Team3 (Lonestar/Manticore/Valkyra); false for Team4 (Chaos Squads). */
export function isScoringFaction(team: mod.Team): boolean {
	return FACTIONS[getFactionId(team)].isScoring;
}
