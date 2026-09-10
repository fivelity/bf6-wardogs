/**
 * buy-menu.ts — the MCOM buy-station shop UI (weapons, attachments, armor, gadgets).
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → "Staging & Buy Phase" / "Core Rules" #4.
 * Triggers on `OnPlayerInteract` at a faction's `IP_BUY_MENU_*` ObjId, subscribed via `Events`,
 * filtered by `mod.GetObjId(eventInteractPoint)` (BUILD_GUIDE.md §5).
 *
 * Every purchase button's `onClick` calls `buy-validator.ts`'s `checkPurchase` AND
 * `wallet.ts`'s `spendCash` inside ONE function (`attemptPurchase` below) so a failed grant can
 * never leave a player charged without receiving the item.
 */

// src/ui/buy-menu.ts
import { Events } from "bf6-portal-utils/events/index.ts";
import { UI } from "bf6-portal-utils/ui/index.ts";
import { UIContainer } from "bf6-portal-utils/ui/components/container/index.ts";
import { UIText } from "bf6-portal-utils/ui/components/text/index.ts";
import { UITextButton } from "bf6-portal-utils/ui/components/text-button/index.ts";
import { OBJECT_ID } from "../config/ids.ts";
import { BASE_PRICES } from "../config/economy.ts";
import { spendCash } from "../player/wallet.ts";
import { requirePlayerState } from "../player/player-state.ts";
import { checkPurchase, type ShopItem } from "./buy-validator.ts";

const SHOP_CATALOG: ShopItem[] = [
	{ id: "armor_plate_carrier", label: "Plate Carrier", basePrice: 1_200, gatingTrack: "support", requiredTier: 2 },
	{ id: "attachment_suppressor", label: "AK-205 Suppressor", basePrice: 350, gatingTrack: "assault", requiredTier: 1 },
	{ id: "gadget_ammo_crate", label: "Ammo Crate", basePrice: 200, gatingTrack: "support", requiredTier: 1 },
];

const BUY_MENU_INTERACT_IDS: readonly number[] = [
	OBJECT_ID.IP_BUY_MENU_LONESTAR,
	OBJECT_ID.IP_BUY_MENU_MANTICORE,
	OBJECT_ID.IP_BUY_MENU_VALKYRA,
];

function attemptPurchase(player: mod.Player, item: ShopItem): boolean {
	const state = requirePlayerState(player);
	const result = checkPurchase(item, state.currentCash, state.tracks);
	if (!result.canAfford) {
		mod.DisplayNotificationMessage(mod.Message(result.reason ?? "Cannot afford this item."), player);
		return false;
	}

	const deducted = spendCash(player, result.price, "purchase");
	if (!deducted) {
		return false;
	}

	void state;
	mod.DisplayNotificationMessage(mod.Message(`Purchased: ${item.label}`), player);
	return true;
}

const menusByPlayer = new Map<mod.Player, UIContainer>();

function buildBuyMenu(player: mod.Player): UIContainer {
	return new UIContainer({
		position: { x: 0, y: 0 },
		size: { width: 420, height: 60 + SHOP_CATALOG.length * 50 },
		anchor: mod.UIAnchor.Center,
		receiver: player,
		visible: false,
		uiInputModeWhenVisible: true,
		childrenParams: [
			{
				type: UIText,
				position: { x: 0, y: 10 },
				size: { width: 420, height: 30 },
				anchor: mod.UIAnchor.TopCenter,
				textColor: UI.COLORS.WHITE,
				textSize: 26,
				message: mod.Message("HQ ACQUISITIONS"),
			},
			...SHOP_CATALOG.map((item, index) => ({
				type: UITextButton,
				position: { x: 0, y: 50 + index * 50 },
				size: { width: 380, height: 40 },
				anchor: mod.UIAnchor.TopCenter,
				bgColor: UI.COLORS.GREY_25,
				baseColor: UI.COLORS.BLACK,
				textColor: UI.COLORS.WHITE,
				textSize: 20,
				message: mod.Message(`${item.label} — $${BASE_PRICES[item.id] ?? item.basePrice}`),
				onClickUp: (p: mod.Player) => attemptPurchase(p, item),
			})),
			{
				type: UITextButton,
				position: { x: 0, y: 60 + SHOP_CATALOG.length * 50 - 10 },
				size: { width: 200, height: 36 },
				anchor: mod.UIAnchor.BottomCenter,
				bgColor: UI.COLORS.GREY_25,
				baseColor: UI.COLORS.BLACK,
				textColor: UI.COLORS.WHITE,
				textSize: 18,
				message: mod.Message("CLOSE PROTOCOL [ESC]"),
				onClickUp: (p: mod.Player) => closeBuyMenu(p),
			},
		] as UIContainer.ChildParams<any>[],
	});
}

function requireBuyMenu(player: mod.Player): UIContainer {
	let menu = menusByPlayer.get(player);
	if (!menu) {
		menu = buildBuyMenu(player);
		menusByPlayer.set(player, menu);
	}
	return menu;
}

function openBuyMenu(player: mod.Player): void {
	const menu = requireBuyMenu(player);
	menu.visible = true;
}

function closeBuyMenu(player: mod.Player): void {
	const menu = menusByPlayer.get(player);
	if (menu) {
		menu.visible = false;
	}
}

Events.OnPlayerInteract.subscribe((eventPlayer, eventInteractPoint) => {
	const interactId = mod.GetObjId(eventInteractPoint);
	if (BUY_MENU_INTERACT_IDS.includes(interactId)) {
		openBuyMenu(eventPlayer);
	}
});

Events.OnPlayerLeaveGame.subscribe((_eventNumber) => {});

export { attemptPurchase, SHOP_CATALOG };