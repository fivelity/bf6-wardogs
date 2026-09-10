/**
 * buy-validator.ts — pure affordability/eligibility checks for the MCOM buy-station shop.
 *
 * Design: BUILD_GUIDE.md §5. This file must stay importable and unit-testable with zero Portal
 * runtime — every function here takes plain data and returns a plain boolean/result object. If a
 * function needs `mod.*` or `SolidUI.*`, that logic belongs in `buy-menu.ts` instead.
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
	surchargeApplied: boolean;
	reason?: string;
}

/**
 * Computes the surcharged price for `item` given the player's current level in the item's gating
 * track, and whether `currentCash` covers it. Pure — no side effects, no player mutation.
 */
export function checkPurchase(
	item: ShopItem,
	currentCash: number,
	trackStates: Record<TrackId, TrackState>
): PurchaseCheckResult {
	const playerTrackLevel = trackStates[item.gatingTrack].level;
	const price = getSurchargedPrice(item.basePrice, playerTrackLevel, item.requiredTier);
	const surchargeApplied = playerTrackLevel < item.requiredTier;

	if (currentCash < price) {
		return {
			canAfford: false,
			price,
			surchargeApplied,
			reason: `Insufficient funds: need $${price}, have $${currentCash}.`,
		};
	}

	return { canAfford: true, price, surchargeApplied };
}

/** Whether a player's current track level meets an item's hard eligibility gate (e.g. weapon tier locks). */
export function meetsEligibility(trackStates: Record<TrackId, TrackState>, item: ShopItem, hardGateTier: number): boolean {
	return trackStates[item.gatingTrack].level >= hardGateTier;
}
