/**
 * buy-validator.ts — pure affordability/eligibility checks for the MCOM buy-station shop.
 *
 * Design: BUILD_GUIDE.md §5. This file must stay importable and unit-testable with zero Portal
 * runtime — every function here takes plain data and returns a plain boolean/result object. If a
 * function needs `mod.*` or `SolidUI.*`, that logic belongs in `buy-menu.ts` instead.
 *
 * FIXED IN THIS PASS: `PurchaseCheckResult` previously carried a pre-formatted `reason` string
 * (e.g. `` `Insufficient funds: need $${price}, have $${currentCash}.` ``) that `buy-menu.ts`
 * then passed straight into `mod.Message()`. That's the exact "unavailable" bug —
 * `mod.Message()` requires every displayed string to be a `strings.json`-registered
 * `mod.stringkeys.*` reference (confirmed, `index.d.ts`'s own doc comment on `Message()`), not an
 * arbitrary string built in application code. This file has no business building display text at
 * all — it stays pure data, and `currentCash` is now echoed back on the result so the caller
 * (`buy-menu.ts`) has both numbers needed to build
 * `mod.Message(mod.stringkeys.shop_insufficient_funds, price, currentCash)` without recomputing
 * anything or needing a `reason` string in the first place.
 */

import { getSurchargedPrice } from "../player/wallet.ts";
import type { TrackId, TrackState } from "../player/progression.ts";

export interface ShopItem {
	id: string;
	label: string;
	basePrice: number;
	/** Which mastery track gates this item's baseline pricing. */
	gatingTrack: TrackId;
	/** Track level required to unlock baseline (no-surcharge) pricing on this item. */
	requiredTier: number;
}

export interface PurchaseCheckResult {
	canAfford: boolean;
	price: number;
	currentCash: number;
	surchargeApplied: boolean;
}

/**
 * Computes the surcharged price for `item` given the player's current level in the item's gating
 * track, and whether `currentCash` covers it. Pure — no side effects, no player mutation, no
 * display-text construction.
 */
export function checkPurchase(
	item: ShopItem,
	currentCash: number,
	trackStates: Record<TrackId, TrackState>
): PurchaseCheckResult {
	const playerTrackLevel = trackStates[item.gatingTrack].level;
	const price = getSurchargedPrice(item.basePrice, playerTrackLevel, item.requiredTier);
	const surchargeApplied = playerTrackLevel < item.requiredTier;

	return { canAfford: currentCash >= price, price, currentCash, surchargeApplied };
}

/** Whether a player's current track level meets an item's hard eligibility gate (e.g. weapon tier locks). */
export function meetsEligibility(trackStates: Record<TrackId, TrackState>, item: ShopItem, hardGateTier: number): boolean {
	return trackStates[item.gatingTrack].level >= hardGateTier;
}
