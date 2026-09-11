/**
 * hotzone.ts — the HotZone (`AT_HOTZONE` / `CP_HOTZONE` / `ICON_HOTZONE`).
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → "HotZone Contestation" / Secondary Objective 1.
 * The 2x presence-weight scoring rule itself is implemented in `controlzone.ts` (per that file's
 * header comment — HotZone presence is a multiplier on the SAME majority tally, not a second
 * ticket track). This file owns the HotZone's "drift" behavior and exposes `lockDriftTarget()` so
 * `towers.ts` can freeze it once Tower A is held.
 *
 * REDESIGNED IN THIS PASS (see WARDOGS_COMPLETION_REPORT.md §3.1 and its addendum): the previous
 * version of this file tried to move the pre-placed `CapturePoint_HotZone_1_1` itself via
 * `mod.MoveObjectOverTime(hotZoneCapturePoint as unknown as mod.SpatialObject, ...)` — a type
 * violation papered over with a cast. Checked exhaustively against the real SDK:
 *   - `MoveObjectOverTime` / `MoveObject` (both confirmed real, index.d.ts) both take a parameter
 *     union of `Bomb | EmplacementSpawner | FixedCamera | InteractPoint | LootSpawner | MCOM |
 *     SFX | SpatialObject | Spawner | VehicleSpawner | VL7Cloud | VO | WorldIcon` — CapturePoint
 *     and AreaTrigger are excluded from BOTH movement functions, deliberately.
 *   - There is no `SetObjectPosition`/`SetCapturePointPosition`-style setter anywhere in the API
 *     surface; `GetObjectPosition` is read-only.
 *   - `CapturePoint` IS a `RuntimeSpawn_Common` prefab (confirmed,
 *     `node_modules/bf6-portal-mod-types/runtime-spawn-enums/common.d.ts`), so a *freshly spawned*
 *     CapturePoint is possible via `mod.SpawnObject`/`mod.UnspawnObject` — but redefining the
 *     HotZone as "unspawn the pre-placed one, spawn a fresh one at each drift step" would mean
 *     abandoning the scene's own pre-placed `CapturePoint_HotZone_1_1` (ObjId 9001, with its own
 *     authored `CaptureArea`/`OutlineShape`/`CameraFOV` fields already tuned in the Godot scene)
 *     in favor of an unauthored runtime clone — a bigger design change than "make the flag drift"
 *     should require, and not attempted here without that being an explicit decision.
 *
 * Resolution actually implemented: the pre-placed `CapturePoint_HotZone_1_1` stays fixed at its
 * authored scene position (this is also just correct — the SDK will not let it move). What
 * "drifts" is `WorldIcon_HotZone_1_1` (ObjId 902, confirmed a real, already-placed WorldIcon in
 * the scene) — `WorldIcon` IS in `MoveObjectOverTime`'s accepted union, so it can actually be
 * relocated over time via `mod.SetWorldIconPosition`, giving players a moving minimap/bigmap
 * indicator that roams within a bounded radius of the fixed CapturePoint, signaling "the
 * high-value area is roughly here right now" without violating any confirmed SDK constraint. This
 * does not reproduce the brief's original "the capturable flag itself physically relocates"
 * intent — that specific mechanic isn't achievable with any function this SDK actually exposes,
 * per the exhaustive check above — but it's the closest faithful approximation available, and the
 * flag's own 2x-presence scoring (in controlzone.ts) is unaffected either way since that logic
 * keys off the fixed `AT_HOTZONE` AreaTrigger, not the icon's position.
 *
 * `lockDriftTarget()` now simply stops/starts the WorldIcon's roam rather than gliding a fixed
 * point toward a lock position — when locked, the icon snaps to and holds the given position;
 * when unlocked, normal roam resumes on the next scheduled step.
 */

import { Events } from "../../../node_modules/bf6-portal-utils/events/index.ts";
import { OBJECT_ID } from "../../config/ids.ts";
import {
  HOTZONE_DRIFT_STEP_RADIUS,
  HOTZONE_DRIFT_INTERVAL_SECONDS,
  PHASE_3_HOTZONE_DRIFT_SPEED_MULTIPLIER,
} from "../../config/constants.ts";
import { isPhase3 } from "./controlzone.ts";

// Fixed scene position of CapturePoint_HotZone_1_1 — the capture point itself never moves (see
// header comment); this is the roam's anchor/origin.
const HOTZONE_ANCHOR_POSITION = mod.CreateVector(926.3205, 227.51173, 236.55618);

let hotZoneIcon: mod.WorldIcon | undefined;
let lastRoamTarget: mod.Vector | undefined;
let lockedTarget: mod.Vector | undefined;

Events.OnGameModeStarted.subscribe(() => {
  hotZoneIcon = mod.GetWorldIcon(OBJECT_ID.ICON_HOTZONE);
});

export function lockDriftTarget(position: mod.Vector | null): void {
  lockedTarget = position ?? undefined;
  if (lockedTarget && hotZoneIcon) {
    mod.SetWorldIconPosition(hotZoneIcon, lockedTarget);
  }
}

function randomDriftTarget(origin: mod.Vector): mod.Vector {
  const angle = Math.random() * mod.Pi() * 2;
  const distance = Math.random() * HOTZONE_DRIFT_STEP_RADIUS;
  return mod.CreateVector(
    mod.XComponentOf(origin) + distance * Math.cos(angle),
    mod.YComponentOf(origin),
    mod.ZComponentOf(origin) + distance * Math.sin(angle),
  );
}

function driftStep(): void {
  if (!hotZoneIcon || lockedTarget) {
    return;
  }
  const origin = lastRoamTarget ?? HOTZONE_ANCHOR_POSITION;
  const target = randomDriftTarget(origin);
  lastRoamTarget = target;
  mod.SetWorldIconPosition(hotZoneIcon, target);
}

let hotZoneAccumulatedSeconds = 0;
const HOTZONE_ASSUMED_SERVER_TICK_SECONDS = 1 / 30;

Events.OngoingGlobal.subscribe(() => {
  hotZoneAccumulatedSeconds += HOTZONE_ASSUMED_SERVER_TICK_SECONDS;
  const interval = isPhase3()
    ? HOTZONE_DRIFT_INTERVAL_SECONDS / PHASE_3_HOTZONE_DRIFT_SPEED_MULTIPLIER
    : HOTZONE_DRIFT_INTERVAL_SECONDS;
  if (hotZoneAccumulatedSeconds < interval) {
    return;
  }
  hotZoneAccumulatedSeconds = 0;
  driftStep();
});
