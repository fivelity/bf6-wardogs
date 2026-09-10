/**
 * constants.ts — pure tuning data. No `mod.*` calls, no logic, no side effects.
 * Every value below traces to a specific section of WARDOGS_DESIGN_BRIEF.md (noted inline).
 */

/** WARDOGS_DESIGN_BRIEF.md → "Core Rules" #1: every player is issued exactly this once. */
export const STARTING_CASH = 10_000;

/** WARDOGS_DESIGN_BRIEF.md → "Point System": Control Zone majority-hold tick cadence. */
export const CONTROL_ZONE_TICK_SECONDS = 4.0;

/** WARDOGS_DESIGN_BRIEF.md → "Point System": +1 ticket per faction per tick while holding majority. */
export const CONTROL_ZONE_TICKET_REWARD = 1;

/**
 * WARDOGS_DESIGN_BRIEF.md → "HotZone Contestation": presence inside the HotZone counts as this
 * multiplier toward a faction's majority-hold occupant count (2x, i.e. one HotZone occupant
 * counts the same as two ControlZone-only occupants).
 */
export const HOTZONE_PRESENCE_WEIGHT = 2;

/** WARDOGS_DESIGN_BRIEF.md → "Gameplay Phases", Phase 3 trigger threshold. */
export const PHASE_3_TICKET_THRESHOLD = 75;

/** WARDOGS_DESIGN_BRIEF.md → "Gameplay Phases", Phase 3: HotZone drift speed multiplier. */
export const PHASE_3_HOTZONE_DRIFT_SPEED_MULTIPLIER = 1.5;

/** WARDOGS_DESIGN_BRIEF.md → "Gameplay Phases", Phase 1 duration. */
export const STAGING_DURATION_SECONDS = 60;

/** WARDOGS_DESIGN_BRIEF.md → "Death & Respawning": respawn delay before deploy becomes available. */
export const RESPAWN_DELAY_SECONDS = 10;

/** WARDOGS_DESIGN_BRIEF.md → "Win Conditions": first faction to this many tickets wins. */
export const VICTORY_TICKET_TARGET = 100;

/** WARDOGS_DESIGN_BRIEF.md → "Death & Respawning": ticket penalty on absolute undeploy. */
export const UNDEPLOY_TICKET_PENALTY = 1;

/**
 * WARDOGS_DESIGN_BRIEF.md → "Match Duration". Not currently enforced in code (no timer-expiry
 * handler wired yet) — kept here so the value exists in one place once that handler is built.
 */
export const MATCH_DURATION_SECONDS = 30 * 60;

// ── HotZone drift tuning (game/mode/hotzone.ts) ──
/** Radius (meters) the drifting HotZone flag may wander from the last drift target per hop. */
export const HOTZONE_DRIFT_STEP_RADIUS = 25;
/** Seconds `mod.MoveObjectOverTime` takes to glide the flag to its next drift target. */
export const HOTZONE_DRIFT_DURATION_SECONDS = 20;
/** Seconds between picking a new drift target once the previous glide completes. */
export const HOTZONE_DRIFT_INTERVAL_SECONDS = 25;

// ── Control Tower tuning (game/mode/towers.ts) ──
/** Decryption segments required, per tower, before HotZone drift-lock unlocks for that team. */
export const TOWER_DECRYPTION_SEGMENTS_REQUIRED = 1;

// ── Salvage Pack tuning (game/mode/salvage.ts) ──
/** Cash contained in a Salvage Pack dropped on undeploy. */
export const SALVAGE_PACK_CASH = 250;
/** Radius (meters) of the pickup trigger spawned around a Salvage Pack. */
export const SALVAGE_PACK_PICKUP_RADIUS = 2;
/** Seconds a Salvage Pack remains lootable before it despawns. */
export const SALVAGE_PACK_LIFETIME_SECONDS = 90;

// ── Chaos Squads tuning (game/mode/chaos-ai.ts) ──
/** Total Chaos Squads AI bots maintained at any time (4 squads of 3). */
export const CHAOS_AI_TOTAL_BOTS = 12;
/** Seconds between Chaos AI respawn-check ticks outside Phase 3. */
export const CHAOS_AI_RESPAWN_INTERVAL_SECONDS = 30;
/** Phase 3 multiplier applied to Chaos AI respawn cadence (smaller = faster). */
export const CHAOS_AI_PHASE_3_RESPAWN_MULTIPLIER = 0.5;
