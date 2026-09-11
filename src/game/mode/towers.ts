/**
 * towers.ts — the single Control Tower (`CP_TOWER_A`, ObjId 76).
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → Secondary Objective 1 ("Secure Concentric Towers") /
 * "✅ RESOLVED — CapturePoint A/B → Control Towers".
 *
 * REDESIGNED IN THIS PASS (see WARDOGS_COMPLETION_REPORT.md addendum): the scene's real spatial
 * data (`mp_granite_military_storage_portal_spatial.json`) has exactly ONE placed tower —
 * `Sector_Tower_A` / `CapturePoint_Tower_A` (ObjId 76) / `WorldIcon_Tower_A`. There is no Tower B
 * anywhere in the level; the previous version of this file's `TOWER_A_POSITION`/
 * `TOWER_B_POSITION` constants and `CP_TOWER_A`/`CP_TOWER_B` ObjIds were actually the pre-placed
 * "FOB Alpha"/"FOB Bravo" capture points (a different, unrelated pair of objects — see
 * `config/ids.ts`'s CORRECTIONS note), not towers at all.
 *
 * Per direction: the two-tower drift-lock condition is dropped. The single real tower now grants
 * the HotZone-lock on its own — holding `CP_TOWER_A` alone locks the HotZone's drift target at
 * the tower's own position for as long as the tower is held, and losing the tower resumes normal
 * drift. This preserves the brief's "control ground gives you a stake in the HotZone" intent
 * with the objective that's actually in the level, rather than a two-tower majority condition
 * the level doesn't support.
 *
 * `CapturePoint_Tower_A`'s own `AdditionalCaptureArea` (per the scene data) is
 * `CollisionShape3D_HotZone_1_1` — the same capture-area geometry the HotZone's `CapturePoint`
 * uses — meaning the scene's own design already links Tower A's capture area to the HotZone
 * volume. That's scene-level geometry, not something this file needs to duplicate in code.
 *
 * Symbols verified against `bf6-portal-mod-types@4.2.0/event-handler-signatures.d.ts`:
 * `OnCapturePointCaptured`, `OnCapturePointLost` (per BUILD_GUIDE.md §4).
 * `OnCapturePointCaptured` only hands back the `CapturePoint`, not the capturing team, so the
 * owning faction is read via `mod.GetCurrentOwnerTeam(capturePoint)` (confirmed real,
 * index.d.ts:2608) inside the handler. See WARDOGS_COMPLETION_REPORT.md §3.5.
 */

import { Events } from "../../../node_modules/bf6-portal-utils/events/index.ts";
import { OBJECT_ID } from "../../config/ids.ts";
import { getFactionId, type FactionId } from "../../config/teams.ts";
import { lockDriftTarget } from "./hotzone.ts";

// CapturePoint_Tower_A's own placed position, per the scene's Portal_Dynamic entry — used as the
// HotZone lock target while the tower is held (matches the tower's real map location, not the
// old FOB coordinates the previous version of this file mistakenly used).
const TOWER_A_POSITION = mod.CreateVector(835.29894928, 202.2173031, 253.2495747);

let towerOwner: FactionId | undefined;

function reevaluateDriftLock(): void {
	if (towerOwner !== undefined) {
		lockDriftTarget(TOWER_A_POSITION);
	} else {
		lockDriftTarget(null);
	}
}

Events.OnCapturePointCaptured.subscribe((capturePoint: mod.CapturePoint) => {
	if (mod.GetObjId(capturePoint) !== OBJECT_ID.CP_TOWER_A) {
		return;
	}
	const owningTeam = mod.GetCurrentOwnerTeam(capturePoint);
	towerOwner = getFactionId(owningTeam);
	reevaluateDriftLock();
});

Events.OnCapturePointLost.subscribe((capturePoint: mod.CapturePoint) => {
	if (mod.GetObjId(capturePoint) !== OBJECT_ID.CP_TOWER_A) {
		return;
	}
	towerOwner = undefined;
	reevaluateDriftLock();
});

export function getTowerOwner(): FactionId | undefined {
	return towerOwner;
}
