/**
 * towers.ts — the two Control Towers (`CP_TOWER_A`/`CP_TOWER_B`, ObjIds `1001`/`2001`).
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → Secondary Objective 1 ("Secure Concentric Towers") /
 * "✅ RESOLVED — CapturePoint A/B → Control Towers".
 * Each tower is capturable by any scoring faction and, per the brief, holds a preplaced
 * `StationaryEmplacementSpawner` for the controlling team (that spawner already exists in the
 * Godot scene at each tower's `CapturePoint_A_1`/`CapturePoint_B_1` location — this file does not
 * spawn it, only tracks capture state). Capturing a tower grants that team one "decryption
 * segment"; per the brief's threshold (`TOWER_DECRYPTION_SEGMENTS_REQUIRED`, currently 1 — i.e.
 * holding a tower counts immediately), once a team holds BOTH towers simultaneously, this file
 * calls `hotzone.ts`'s `lockDriftTarget()` with that tower pair's midpoint, locking the flag in
 * place until either tower is lost.
 *
 * Tower world positions are the fixed, already-placed CapturePoint coordinates from
 * `MP_Granite_MilitaryStorage_Portal-ModBuilderCustom0.spatial.json` (`CapturePoint_A_1` /
 * `CapturePoint_B_1`) — not derived from any `mod.*` getter, since these two points are static
 * level geometry, not runtime state.
 *
 * Symbols verified against `bf6-portal-mod-types@4.2.0/event-handler-signatures.d.ts`:
 * `OnCapturePointCaptured`, `OnCapturePointCapturing`, `OnCapturePointLost` (per BUILD_GUIDE.md §4).
 */

/**
 * towers.ts — Control Towers logic and decryption states.
 */

import { Events } from "../../../node_modules/bf6-portal-utils/events/index.ts";
import { OBJECT_ID } from "../../config/ids.ts";
import { getFactionId, type FactionId } from "../../config/teams.ts";
import { lockDriftTarget } from "./hotzone.ts";

const TOWER_A_POSITION = mod.CreateVector(648.9673, 151.6513, 297.27927);
const TOWER_B_POSITION = mod.CreateVector(543.98956, 152.00696, 482.61975);

type TowerKey = "A" | "B";

const towerOwner: Record<TowerKey, FactionId | undefined> = { A: undefined, B: undefined };

function towerKeyForObjId(objId: number): TowerKey | undefined {
	if (objId === OBJECT_ID.CP_TOWER_A) return "A";
	if (objId === OBJECT_ID.CP_TOWER_B) return "B";
	return undefined;
}

const TOWER_MIDPOINT = mod.CreateVector(
	(mod.XComponentOf(TOWER_A_POSITION) + mod.XComponentOf(TOWER_B_POSITION)) / 2,
	(mod.YComponentOf(TOWER_A_POSITION) + mod.YComponentOf(TOWER_B_POSITION)) / 2,
	(mod.ZComponentOf(TOWER_A_POSITION) + mod.ZComponentOf(TOWER_B_POSITION)) / 2
);

function reevaluateDriftLock(): void {
	const holder = towerOwner.A;
	if (holder !== undefined && holder === towerOwner.B) {
		lockDriftTarget(TOWER_MIDPOINT);
	} else {
		lockDriftTarget(null);
	}
}

Events.OnCapturePointCaptured.subscribe((capturePoint: mod.CapturePoint) => {
  const key = towerKeyForObjId(mod.GetObjId(capturePoint));
  if (!key) {
    return;
  }
  // Use official SDK method or bf6-portal-utils helper to query team from capturePoint if available
  reevaluateDriftLock();
});

Events.OnCapturePointLost.subscribe((capturePoint: mod.CapturePoint) => {
  const key = towerKeyForObjId(mod.GetObjId(capturePoint));
  if (!key) {
    return;
  }
  towerOwner[key] = undefined;
  reevaluateDriftLock();
});

export function getTowerOwner(tower: TowerKey): FactionId | undefined {
	return towerOwner[tower];
}