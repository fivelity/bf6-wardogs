/**
 * hotzone.ts — the HotZone (`AT_HOTZONE` / `CP_HOTZONE` / `ICON_HOTZONE`).
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → "HotZone Contestation" / Secondary Objective 1.
 * The 2x presence-weight scoring rule itself is implemented in `controlzone.ts` (per that file's
 * header comment — HotZone presence is a multiplier on the SAME majority tally, not a second
 * ticket track). This file owns the HotZone's "drift" behavior and exposes `lockDriftTarget()` so
 * `towers.ts` can freeze it once the tower is held.
 *
 * REDESIGNED IN THIS PASS: the previous version of this file moved the pre-placed
 * `CapturePoint_HotZone_1_1` itself via
 * `mod.MoveObjectOverTime(hotZoneCapturePoint as unknown as mod.SpatialObject, ...)` — a type
 * violation papered over with a cast. Checked directly against the installed
 * `bf6-portal-mod-types@4.2.0/index.d.ts`:
 *   - `MoveObjectOverTime` / `MoveObject` (both confirmed real) take a parameter union of
 *     `Bomb | EmplacementSpawner | FixedCamera | InteractPoint | LootSpawner | MCOM | SFX |
 *     SpatialObject | Spawner | VehicleSpawner | VL7Cloud | VO | WorldIcon` — `CapturePoint` and
 *     `AreaTrigger` are excluded from this union, deliberately.
 *   - There is no `SetObjectPosition`/`SetCapturePointPosition`-style setter anywhere in the API
 *     surface; `GetObjectPosition` is read-only.
 *   - `WorldIcon` IS in the accepted union, AND has its own direct absolute-position setter,
 *     `mod.SetWorldIconPosition(worldIcon, newPosition: Vector)` (confirmed real,
 *     index.d.ts:1410) — simpler than `MoveObjectOverTime`'s delta-based API and requires no cast.
 *
 * Resolution implemented: the pre-placed `CapturePoint_HotZone_1_1` stays fixed at its authored
 * scene position (this is also just correct — the SDK will not let it move). What "drifts" is
 * `WorldIcon_HotZone_1_1` (ObjId 902, a real, already-placed WorldIcon in the scene) — relocated
 * over time via `mod.SetWorldIconPosition`, giving players a moving minimap/bigmap indicator that
 * roams within a bounded radius of the fixed CapturePoint, signaling "the high-value area is
 * roughly here right now" without violating any confirmed SDK constraint. This does not
 * reproduce the brief's original "the capturable flag itself physically relocates" intent — that
 * specific mechanic isn't achievable with any function this SDK actually exposes — but it's the
 * closest faithful approximation available. The flag's own 2x-presence scoring (in
 * controlzone.ts) is unaffected either way since that logic keys off the fixed `AT_HOTZONE`
 * AreaTrigger, not the icon's position.
 *
 * `lockDriftTarget()` stops/starts the WorldIcon's roam rather than gliding a fixed point toward
 * a lock position — when locked, the icon snaps to and holds the given position; when unlocked,
 * normal roam resumes on the next scheduled step.
 *
 * `getHotZoneStatus()` is new — exposes current roam/lock state and the CapturePoint's live
 * ownership (via `mod.GetCurrentOwnerTeam`, confirmed real, index.d.ts:2608) and capture progress
 * (`mod.GetCaptureProgress`, confirmed real, index.d.ts:2605) so `ui/hud.ts` can render a real
 * objective panel instead of a static label.
 */

import { Events } from "../../../node_modules/bf6-portal-utils/events/index.ts";
import { OBJECT_ID } from "../../config/ids.ts";
import {
  HOTZONE_DRIFT_STEP_RADIUS,
  HOTZONE_DRIFT_INTERVAL_SECONDS,
  PHASE_3_HOTZONE_DRIFT_SPEED_MULTIPLIER,
} from "../../config/constants.ts";
import { isPhase3 } from "./controlzone.ts";
import { getFactionId, type FactionId } from "../../config/teams.ts";

// Fixed scene position of CapturePoint_HotZone_1_1 — the capture point itself never moves (see
// header comment); this is the roam's anchor/origin.
const HOTZONE_ANCHOR_POSITION = mod.CreateVector(926.3205, 227.51173, 236.55618);

let hotZoneIcon: mod.WorldIcon | undefined;
let hotZoneCapturePoint: mod.CapturePoint | undefined;
let lastRoamTarget: mod.Vector | undefined;
let lockedTarget: mod.Vector | undefined;
let hotZoneContested = false;
let hotZoneCapturingFaction: FactionId | undefined;

Events.OnGameModeStarted.subscribe(() => {
  hotZoneIcon = mod.GetWorldIcon(OBJECT_ID.ICON_HOTZONE);
});

function isHotZoneCapturePoint(capturePoint: mod.CapturePoint): boolean {
  return mod.GetObjId(capturePoint) === OBJECT_ID.CP_HOTZONE;
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

Events.OnCapturePointCapturing.subscribe((capturePoint: mod.CapturePoint) => {
  if (!isHotZoneCapturePoint(capturePoint)) {
    return;
  }
  hotZoneCapturePoint = capturePoint;
  hotZoneContested = true;
  hotZoneCapturingFaction = tryGetFactionId(mod.GetOwnerProgressTeam(capturePoint));
});

Events.OnCapturePointCaptured.subscribe((capturePoint: mod.CapturePoint) => {
  if (!isHotZoneCapturePoint(capturePoint)) {
    return;
  }
  hotZoneCapturePoint = capturePoint;
  hotZoneContested = false;
  hotZoneCapturingFaction = undefined;
});

Events.OnCapturePointLost.subscribe((capturePoint: mod.CapturePoint) => {
  if (!isHotZoneCapturePoint(capturePoint)) {
    return;
  }
  hotZoneCapturePoint = capturePoint;
  hotZoneContested = false;
  hotZoneCapturingFaction = undefined;
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

export interface HotZoneStatus {
  /** Faction that currently owns the HotZone capture point, if any. */
  owner: FactionId | undefined;
  /** Faction currently making capture progress, if any. */
  capturingFaction: FactionId | undefined;
  /** Whether the point is actively being contested right now. */
  contested: boolean;
  /** 0..1 raw capture progress from the SDK, or 0 if the capture point hasn't been observed yet. */
  progress: number;
  /** Whether the drift target is currently locked (tower held) rather than roaming. */
  locked: boolean;
}

/**
 * Reads the HotZone CapturePoint's current owner, if any. `getFactionId` throws on an
 * out-of-range team ObjId (see `config/teams.ts`) — an uncaptured/neutral point can legitimately
 * report a team outside 1-4, so this is deliberately defensive rather than letting a HUD read
 * crash the whole reactive effect it's called from.
 */
function readHotZoneOwner(): FactionId | undefined {
  if (!hotZoneCapturePoint) {
    return undefined;
  }
  return tryGetFactionId(mod.GetCurrentOwnerTeam(hotZoneCapturePoint));
}

/** Live HotZone status for HUD/objective display. Safe to call every tick — cheap reads only. */
export function getHotZoneStatus(): HotZoneStatus {
  return {
    owner: readHotZoneOwner(),
    capturingFaction: hotZoneCapturingFaction,
    contested: hotZoneContested,
    progress: hotZoneCapturePoint ? mod.GetCaptureProgress(hotZoneCapturePoint) : 0,
    locked: lockedTarget !== undefined,
  };
}
