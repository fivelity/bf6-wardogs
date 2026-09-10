/**
 * hotzone.ts — the drifting 60m HotZone (`AT_HOTZONE` / `CP_HOTZONE`).
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → "HotZone Contestation" / Secondary Objective 1.
 * The 2x presence-weight scoring rule itself is implemented in `controlzone.ts` (per that file's
 * header comment — HotZone presence is a multiplier on the SAME majority tally, not a second
 * ticket track). This file owns only the flag's physical drift: picking a new random target
 * inside a bounded radius, gliding the `CapturePoint` object there with `mod.MoveObjectOverTime`,
 * accelerating that cadence once Phase 3 triggers (`controlzone.ts`'s `isPhase3()`), and exposing
 * `lockDriftTarget()` so `towers.ts` can freeze the flag once a team fully decrypts a tower.
 *
 * Symbol verification note: `mod.MoveObjectOverTime` is confirmed real (BUILD_GUIDE.md §4,
 * `index.d.ts:1204`), but this codebase has not independently re-confirmed its exact parameter
 * order for this file — per AGENTS.md §2, re-check the signature in
 * `node_modules/bf6-portal-mod-types/index.d.ts` before this file ships, and adjust the single
 * call site in `driftStep()` below if the real signature differs from the
 * `(object, targetPosition, durationSeconds)` shape assumed here.
 *
 * The live `CapturePoint` object reference for `CP_HOTZONE` is not obtained from any invented
 * "get object by id" global (no such getter exists in the confirmed API surface) — it is captured
 * the first time a real Portal event hands it to us as a payload (`OnCapturePointCapturing` /
 * `OnCapturePointCaptured` / `OnCapturePointLost`, all confirmed real in
 * `event-handler-signatures.d.ts`), then cached for every subsequent drift step.
 */

/**
 * hotzone.ts — the drifting 60m HotZone.
 */

import { Events } from "../../../node_modules/bf6-portal-utils/events/index.ts";
import { OBJECT_ID } from "../../config/ids.ts";
import {
  HOTZONE_DRIFT_STEP_RADIUS,
  HOTZONE_DRIFT_DURATION_SECONDS,
  HOTZONE_DRIFT_INTERVAL_SECONDS,
  PHASE_3_HOTZONE_DRIFT_SPEED_MULTIPLIER,
} from "../../config/constants.ts";
import { isPhase3 } from "./controlzone.ts";

let hotZoneCapturePoint: mod.CapturePoint | undefined;
let lastDriftTarget: mod.Vector | undefined;
let lockedTarget: mod.Vector | undefined;

function cacheHotZoneCapturePoint(eventCapturePoint: mod.CapturePoint): void {
  if (hotZoneCapturePoint) {
    return;
  }
  if (mod.GetObjId(eventCapturePoint) === OBJECT_ID.CP_HOTZONE) {
    hotZoneCapturePoint = eventCapturePoint;
  }
}

Events.OnCapturePointCapturing.subscribe((eventCapturePoint) => {
  cacheHotZoneCapturePoint(eventCapturePoint);
});
Events.OnCapturePointCaptured.subscribe((eventCapturePoint) => {
  cacheHotZoneCapturePoint(eventCapturePoint);
});
Events.OnCapturePointLost.subscribe((eventCapturePoint) => {
  cacheHotZoneCapturePoint(eventCapturePoint);
});

export function lockDriftTarget(position: mod.Vector | null): void {
  lockedTarget = position ?? undefined;
  if (lockedTarget && hotZoneCapturePoint) {
    const currentPos = mod.GetObjectPosition(hotZoneCapturePoint);
    const delta = mod.CreateVector(
      mod.XComponentOf(lockedTarget) - mod.XComponentOf(currentPos),
      mod.YComponentOf(lockedTarget) - mod.YComponentOf(currentPos),
      mod.ZComponentOf(lockedTarget) - mod.ZComponentOf(currentPos),
    );
    mod.MoveObjectOverTime(
      hotZoneCapturePoint as unknown as mod.SpatialObject,
      delta,
      mod.CreateVector(0, 0, 0),
      HOTZONE_DRIFT_DURATION_SECONDS,
      false,
      false,
    );
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
  if (!hotZoneCapturePoint || lockedTarget) {
    return;
  }
  const origin = lastDriftTarget ?? mod.GetObjectPosition(hotZoneCapturePoint);
  const target = randomDriftTarget(origin);
  lastDriftTarget = target;
  const delta = mod.CreateVector(
    mod.XComponentOf(target) - mod.XComponentOf(origin),
    mod.YComponentOf(target) - mod.YComponentOf(origin),
    mod.ZComponentOf(target) - mod.ZComponentOf(origin),
  );
  mod.MoveObjectOverTime(
    hotZoneCapturePoint as unknown as mod.SpatialObject,
    delta,
    mod.CreateVector(0, 0, 0),
    HOTZONE_DRIFT_DURATION_SECONDS,
    false,
    false,
  );
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
