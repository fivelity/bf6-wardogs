/**
 * teams.ts — faction identity for WARDOGS's three playable PMCs, plus a Team4 bucket for Chaos
 * Squads AI.
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → "Players & Teams" table.
 * `mod.Team` is an opaque type (confirmed in `bf6-portal-mod-types/types.d.ts`) — the only legal
 * way to get a stable numeric key from one is `mod.GetObjId(team)` (`Team` is part of the real
 * `mod.Object` union, confirmed in `types.d.ts`). This file owns that one conversion point; every
 * other file imports `getFactionId` instead of calling `mod.GetObjId` on a team ad hoc.
 *
 * ── Team colors (per current direction) ──
 * Lonestar = BLUE · Manticore = GREEN · Valkyra = RED. `ui/hud.ts` and `ui/scoreboard.ts` both
 * source their per-faction bar/text color from `FACTION_COLORS` below rather than hard-coding
 * their own tables, so this is the single place color assignment lives.
 *
 * ── IMPORTANT — Chaos Squads (Team4) is NOT a team ──
 * Per clarified design direction: Chaos Squads are AI-only HotZone pressure, not a fourth
 * competitive faction. They:
 *   - never appear in the 3-faction scoreboard or the Team Score HUD panel,
 *   - never accrue Control Zone / HotZone tickets,
 *   - never factor into majority-hold presence counting (`controlzone.ts`'s
 *     `computeWeightedPresence` explicitly skips non-scoring factions).
 * However, killing (or assisting on a kill against) a Chaos Squads bot is still a normal combat
 * kill from the human player's perspective — `wallet.ts`'s `addCash`/`addXp` reward path does not
 * care which team the victim belonged to, only that a kill/assist occurred, so Chaos kills pay
 * out identically to human kills (see `game/mode/chaos-ai.ts`'s death-reward wiring). `FACTIONS[4]`
 * exists here purely because Portal's `mod.SpawnAIFromAISpawner` requires some `mod.Team` bucket
 * for AI to belong to — a technical necessity, not a design statement. `isScoring: false` and
 * `SCORING_FACTION_IDS` excluding `4` are what keep Chaos out of the competitive team systems;
 * `TEAM_FACTION_IDS` (all 4, including Chaos) exists separately for code paths — like combat
 * reward payout — that need to reason about "every team that can appear as a kill's victim,"
 * as opposed to "every team competing for tickets."
 */

export type FactionId = 1 | 2 | 3 | 4;

export interface FactionDefinition {
	id: FactionId;
	name: string;
	shortName: string;
	/** Whether this faction participates in scoring/economy (ticket) tracking at all. */
	isScoring: boolean;
}

export const FACTIONS: Record<FactionId, FactionDefinition> = {
	1: { id: 1, name: "Lonestar", shortName: "LSR", isScoring: true },
	2: { id: 2, name: "Manticore", shortName: "MTC", isScoring: true },
	3: { id: 3, name: "Valkyra", shortName: "VLK", isScoring: true },
	// Not a competitive team — see IMPORTANT note above. Kept in this table only so
	// `getFactionId`/`isScoringFaction` have a definition to resolve against for AI-owned teams.
	4: { id: 4, name: "Chaos Squads", shortName: "CHS", isScoring: false },
} as const;

/** The three human, scoring factions — the order the 3-faction scoreboard/UI should render in. */
export const SCORING_FACTION_IDS: readonly FactionId[] = [1, 2, 3];

/** All four team buckets, including the non-scoring Chaos Squads bucket. */
export const TEAM_FACTION_IDS: readonly FactionId[] = [1, 2, 3, 4];

/**
 * Per-faction display color. Lonestar = BLUE, Manticore = GREEN, Valkyra = RED (per current
 * direction — supersedes any earlier Cyan/Orange/Silver mapping). `mod.CreateVector(r,g,b)`
 * synthesizes any color not present in `UI.COLORS` (confirmed real, used elsewhere in this
 * codebase for Manticore's prior orange); pure primaries are available directly on `UI.COLORS`.
 * This table is intentionally `mod.Vector`-free at the type level to avoid a circular import
 * with `bf6-portal-utils/ui` from a pure data file — callers construct the actual `mod.Vector`
 * from these RGB triples via `mod.CreateVector(...)`.
 */
export const FACTION_COLOR_RGB: Record<Extract<FactionId, 1 | 2 | 3>, readonly [number, number, number]> = {
	1: [0.15, 0.45, 1.0], // Lonestar — Blue
	2: [0.15, 0.85, 0.25], // Manticore — Green
	3: [0.9, 0.15, 0.15], // Valkyra — Red
};

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

/** True only for Team4 (Chaos Squads) — the AI-only, non-competitive bucket. */
export function isChaosFaction(team: mod.Team): boolean {
	return getFactionId(team) === 4;
}
