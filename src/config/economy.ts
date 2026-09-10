/**
 * economy.ts — pure data tables for the match economy. No logic, no `mod.*` calls.
 *
 * Confirmed by direct grep of `bf6-portal-mod-types@4.2.0/index.d.ts`: there is no native
 * currency API (no `AddPlayerCurrency`/`GetPlayerCurrency`/equivalent). Every number below is
 * consumed entirely by `wallet.ts`'s own logic — never passed to a `mod.*` currency call, because
 * there isn't one (see AGENTS.md §2).
 */

import type { TrackId } from "../player/progression.ts";

/** WARDOGS_DESIGN_BRIEF.md → "Point System": cash + XP rewards per action. */
export const CASH_REWARDS = {
	kill: 500,
	revive: 300,
	cargoDelivery: 800,
	buildHit: 100,
} as const;

export const XP_REWARDS = {
	kill: 150,
	revive: 200,
	cargoDelivery: 300,
	buildHit: 120,
} as const;

/** WARDOGS_DESIGN_BRIEF.md → "Point System": materials granted per logistics cargo delivery. */
export const CARGO_DELIVERY_MATERIALS = 500;

/**
 * BUILD_GUIDE.md → `game/mode/fob.ts` "still missing" note: materials required to place one FOB.
 * Previously a local constant inside fob.ts — moved here per AGENTS.md §6 (economy data lives in
 * `economy.ts`, not scattered across mode files).
 */
export const FOB_MATERIAL_COST = 500;

/**
 * WARDOGS_DESIGN_BRIEF.md → "Player State Shape": mastery tracks run levels 1-5. XP required to
 * reach each level, indexed by level number (level 1 is the starting level, requires 0 XP).
 */
export const TRACK_XP_THRESHOLDS: Readonly<Record<number, number>> = {
	1: 0,
	2: 1_000,
	3: 2_500,
	4: 4_500,
	5: 7_000,
} as const;

export const MAX_TRACK_LEVEL = 5;

/**
 * WARDOGS_DESIGN_BRIEF.md → "Core Rules" #4, "Pro-Rated Shop Surcharges": items from other
 * progression tracks incur up to this markup (200%) if the player's track level is deficient,
 * scaling down to 0% once the track's required tier unlocks. See `wallet.ts`'s `getSurcharge`
 * for the actual scaling function that consumes these two bounds.
 */
export const SURCHARGE_MAX_MULTIPLIER = 2.0; // +200%
export const SURCHARGE_MIN_MULTIPLIER = 0; // +0%

/** Base (no-surcharge) price table stub — populate as buy-menu.ts items are finalized. */
export const BASE_PRICES: Readonly<Record<string, number>> = {
	// e.g. AK205_Suppressor: 350,
} as const;

export type TrackXpRewardKey = keyof typeof XP_REWARDS;

/** Placeholder mapping from a reward action to which mastery track earns the XP for it. */
export const XP_REWARD_TRACK: Readonly<Record<TrackXpRewardKey, TrackId>> = {
	kill: "assault",
	revive: "medic",
	cargoDelivery: "driverPilot",
	buildHit: "support",
} as const;
