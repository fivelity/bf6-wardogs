/**
 * towers.ts — the single Control Tower (`CP_TOWER_A`, ObjId 76).
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → Secondary Objective 1 ("Secure Concentric Towers") /
 * "✅ RESOLVED — CapturePoint A/B → Control Towers".
 *
 * REDESIGNED IN THIS PASS: the scene's real spatial data
 * (`levels/mp_granite_military_storage_portal.spatial.json`) has exactly ONE placed tower —
 * `Sector_Tower_A` / `CapturePoint_Tower_A` (ObjId 76) / `WorldIcon_Tower_A`. There is no Tower B
 * anywhere in the level; the previous version of this file's `CP_TOWER_A: 1001` /
 * `CP_TOWER_B: 2001` ObjIds were actually the pre-placed "FOB Alpha"/"FOB Bravo" capture points
 * (a different, unrelated pair of objects — see `config/ids.ts`'s CORRECTIONS note), not towers
 * at all.
 *
 * Per direction: the two-tower drift-lock condition is dropped. The single real tower now grants
 * the HotZone-lock on its own — holding `CP_TOWER_A` alone locks the HotZone's drift target at
 * the tower's own position for as long as the tower is held; losing the tower resumes normal
 * drift. This preserves the brief's "control ground gives you a stake in the HotZone" intent
 * with the objective that's actually in the level.
 *
 * Also fixed here: the previous version never actually recorded which faction captured the
 * tower — `OnCapturePointCaptured` only hands back the `CapturePoint`, not the capturing team, so
 * a real `mod.GetCurrentOwnerTeam(capturePoint)` call (confirmed real, index.d.ts:2608) is
 * required inside the handler to learn who owns it. Without that call the drift-lock condition
 * could never fire regardless of play.
 *
 * `getTowerStatus()` is new — exposes live faction ownership AND capture progress
 * (`mod.GetCaptureProgress`, confirmed real, index.d.ts:2605, returns 0..1) so `ui/hud.ts` can
 * render a real objective progress bar instead of a static label.
 *
 * Symbols verified against `bf6-portal-mod-types@4.2.0`:
 *   - `OnCapturePointCaptured`, `OnCapturePointCapturing`, `OnCapturePointLost` —
 *     event-handler-signatures.d.ts.
 *   - `mod.GetCapturePoint`, `mod.GetCurrentOwnerTeam`, `mod.GetCaptureProgress`,
 *     `mod.GetOwnerProgressTeam` — index.d.ts:2602/2608/2605/2611.
 */

import { Events } from "../../../node_modules/bf6-portal-utils/events/index.ts";
import { OBJECT_ID } from "../../config/ids.ts";
import { getFactionId, type FactionId } from "../../config/teams.ts";
import { lockDriftTarget } from "./hotzone.ts";

// CapturePoint_Tower_A's own placed position, per the scene's Portal_Dynamic entry — used as the
// HotZone lock target while the tower is held.
const TOWER_A_POSITION = mod.CreateVector(835.29894928, 202.2173031, 253.2495747);

let towerOwner: FactionId | undefined;
let towerCapturePoint: mod.CapturePoint | undefined;
/** True while any team is actively contesting/capturing (not yet resolved to an owner). */
let towerContested = false;
/** Faction currently making capture progress, if any (from `OnCapturePointCapturing`). */
let towerCapturingFaction: FactionId | undefined;

function isTowerCapturePoint(capturePoint: mod.CapturePoint): boolean {
	return mod.GetObjId(capturePoint) === OBJECT_ID.CP_TOWER_A;
}

/**
 * `getFactionId` throws on an out-of-range team ObjId (see `config/teams.ts`) — a
 * neutral/contested point can legitimately report a team outside 1-4 mid-capture, so every read
 * here is deliberately defensive rather than letting it crash the handler.
 */
function tryGetFactionId(team: mod.Team): FactionId | undefined {
	try {
		return getFactionId(team);
	} catch {
		return undefined;
	}
}

function reevaluateDriftLock(): void {
	if (towerOwner !== undefined) {
		lockDriftTarget(TOWER_A_POSITION);
	} else {
		lockDriftTarget(null);
	}
}

Events.OnCapturePointCapturing.subscribe((capturePoint: mod.CapturePoint) => {
	if (!isTowerCapturePoint(capturePoint)) {
		return;
	}
	towerCapturePoint = capturePoint;
	towerContested = true;
	towerCapturingFaction = tryGetFactionId(mod.GetOwnerProgressTeam(capturePoint));
});

Events.OnCapturePointCaptured.subscribe((capturePoint: mod.CapturePoint) => {
	if (!isTowerCapturePoint(capturePoint)) {
		return;
	}
	towerCapturePoint = capturePoint;
	towerContested = false;
	towerCapturingFaction = undefined;
	towerOwner = tryGetFactionId(mod.GetCurrentOwnerTeam(capturePoint));
	reevaluateDriftLock();
});

Events.OnCapturePointLost.subscribe((capturePoint: mod.CapturePoint) => {
	if (!isTowerCapturePoint(capturePoint)) {
		return;
	}
	towerCapturePoint = capturePoint;
	towerOwner = undefined;
	towerContested = false;
	towerCapturingFaction = undefined;
	reevaluateDriftLock();
});

export interface TowerStatus {
	/** Faction that currently owns (has fully captured) the tower, if any. */
	owner: FactionId | undefined;
	/** Faction currently making capture progress toward ownership, if any (may equal owner while re-securing). */
	capturingFaction: FactionId | undefined;
	/** Whether the point is actively being contested right now. */
	contested: boolean;
	/** 0..1 raw capture progress from the SDK, or 0 if the capture point hasn't been observed yet. */
	progress: number;
}

/** Live tower status for HUD/objective display. Safe to call every tick — cheap reads only. */
export function getTowerStatus(): TowerStatus {
	return {
		owner: towerOwner,
		capturingFaction: towerCapturingFaction,
		contested: towerContested,
		progress: towerCapturePoint ? mod.GetCaptureProgress(towerCapturePoint) : 0,
	};
}

export function getTowerOwner(): FactionId | undefined {
	return towerOwner;
}
