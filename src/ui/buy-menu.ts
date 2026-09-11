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
 *
 * All display text goes through `mod.Message(mod.stringkeys.<key>, ...)` — `mod.Message()`
 * rejects raw string literals at runtime (confirmed, index.d.ts's own doc comment: "All strings
 * passed as arguments must be found in the `strings.json` which is injected as `mod.stringkeys`."),
 * which was the root cause of every UI label rendering as "unavailable". Every key referenced
 * below is registered in `src/strings.json`. See WARDOGS_COMPLETION_REPORT.md §2.1.
 */

// src/ui/buy-menu.ts
import { Events } from "../../node_modules/bf6-portal-utils/events/index.ts";
import { UI } from "../../node_modules/bf6-portal-utils/ui/index.ts";
import { UIContainer } from "../../node_modules/bf6-portal-utils/ui/components/container/index.ts";
import { UIText } from "../../node_modules/bf6-portal-utils/ui/components/text/index.ts";
import { UITextButton } from "../../node_modules/bf6-portal-utils/ui/components/text-button/index.ts";
import { OBJECT_ID } from "../config/ids.ts";
import { BASE_PRICES } from "../config/economy.ts";
import { spendCash } from "../player/wallet.ts";
import { requirePlayerState } from "../player/player-state.ts";
import { checkPurchase, type ShopItem } from "./buy-validator.ts";

/**
 * `labelKey` is a `mod.stringkeys.*` property name (must exist in `strings.json`), not display
 * text itself — `mod.Message()` can only display registered string keys. `label` is kept as
 * plain internal data for use in contexts that don't touch `mod.Message` (e.g. future logging).
 */
const SHOP_CATALOG: (ShopItem & { labelKey: string })[] = [
	{ id: "armor_plate_carrier", label: "Plate Carrier", labelKey: "item_armor_plate_carrier", basePrice: 1_200, gatingTrack: "support", requiredTier: 2 },
	{ id: "attachment_suppressor", label: "AK-205 Suppressor", labelKey: "item_attachment_suppressor", basePrice: 350, gatingTrack: "assault", requiredTier: 1 },
	{ id: "gadget_ammo_crate", label: "Ammo Crate", labelKey: "item_gadget_ammo_crate", basePrice: 200, gatingTrack: "support", requiredTier: 1 },
];

const BUY_MENU_INTERACT_IDS: readonly number[] = [
	OBJECT_ID.IP_BUY_MENU_LONESTAR,
	OBJECT_ID.IP_BUY_MENU_MANTICORE,
	OBJECT_ID.IP_BUY_MENU_VALKYRA,
];

function attemptPurchase(player: mod.Player, item: ShopItem & { labelKey: string }): boolean {
	const state = requirePlayerState(player);
	const result = checkPurchase(item, state.currentCash, state.tracks);
	if (!result.canAfford) {
		mod.DisplayNotificationMessage(
			mod.Message(mod.stringkeys.shop_insufficient_funds, result.price, result.currentCash),
			player
		);
		return false;
	}

	const deducted = spendCash(player, result.price, "purchase");
	if (!deducted) {
		mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.shop_cannot_afford_generic), player);
		return false;
	}

	void state;
	// msgArg0/1/2 are typed string | number | Player (index.d.ts:2835) — a nested Message object
	// is not a legal arg, so the item name has to be a stringkeys reference passed directly, not
	// wrapped in its own Message() call first.
	mod.DisplayNotificationMessage(
		mod.Message(mod.stringkeys.shop_purchase_confirm, mod.stringkeys[item.labelKey]),
		player
	);
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
				message: mod.Message(mod.stringkeys.shop_header_title),
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
				message: mod.Message(
					mod.stringkeys.shop_item_price,
					mod.stringkeys[item.labelKey],
					BASE_PRICES[item.id] ?? item.basePrice
				),
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
				message: mod.Message(mod.stringkeys.shop_close_label),
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

/**
 * Re-entry guard: without this, repeated `OnPlayerInteract` events while the menu is already
 * open (e.g. the player still standing on the interact point, or the engine re-firing interact
 * on held-input) call `openBuyMenu` again on every event with no check for "already open" — which
 * can make Close appear to do nothing if an interact tick re-opens the menu immediately after a
 * close. See WARDOGS_COMPLETION_REPORT.md §2.2.
 */
Events.OnPlayerInteract.subscribe((eventPlayer, eventInteractPoint) => {
	const interactId = mod.GetObjId(eventInteractPoint);
	if (!BUY_MENU_INTERACT_IDS.includes(interactId)) {
		return;
	}
	const menu = menusByPlayer.get(eventPlayer);
	if (menu?.visible) {
		return;
	}
	openBuyMenu(eventPlayer);
});

Events.OnPlayerLeaveGame.subscribe((_eventNumber) => {});

export { attemptPurchase, SHOP_CATALOG };