/**
 * buy-menu.ts — the MCOM buy-station shop UI (weapons, attachments, armor, gadgets).
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → "Staging & Buy Phase" / "Core Rules" #4.
 * Triggers on `OnPlayerInteract` at a faction's `IP_BUY_MENU_*` ObjId, subscribed via `Events`,
 * filtered by `mod.GetObjId(eventInteractPoint)`.
 *
 * Every purchase button's handler calls `buy-validator.ts`'s `checkPurchase` AND `wallet.ts`'s
 * `spendCash` inside ONE function (`attemptPurchase` below) so a failed grant can never leave a
 * player charged without receiving the item.
 *
 * FIXED IN THIS PASS — this file previously had two independent, mod-wide-visible bugs:
 *
 * 1. **Every displayed string was a raw literal.** `mod.Message("HQ ACQUISITIONS")`,
 *    `` mod.Message(`${item.label} — $${BASE_PRICES[item.id] ?? item.basePrice}`) ``, etc.
 *    `mod.Message()`'s own doc comment (`index.d.ts`) is explicit: "All strings passed as
 *    arguments must be found in the `strings.json` which is injected as `mod.stringkeys`." A raw
 *    string literal isn't a `stringkeys` reference, so the engine can't resolve it and falls back
 *    to an "unavailable"-style placeholder — this was the root cause of the whole buy menu (and
 *    every other UI surface) reading as broken. Every label below now goes through
 *    `mod.Message(mod.stringkeys.<key>, ...)`, with every key registered in `src/strings.json`.
 *    `msgArg0`/`msgArg1`/`msgArg2` accept `string | number | Player` directly (confirmed, same
 *    doc block, max 3 placeholder args across all 4 overloads) — so item names are passed as
 *    `mod.stringkeys[item.labelKey]` (itself a valid `msgArg`), not wrapped in a nested
 *    `Message()` call, and numbers are passed as raw numbers, not `String(...)`-ified first.
 *
 * 2. **No reactivity, and no re-entry guard.** The whole tree was built via
 *    `new UIContainer({ childrenParams: [...] })`. `UIContainer.ChildParams<T>`
 *    (`ui/components/container/index.d.ts`) constructs children via their raw
 *    `new (params: T) => UI.Element` constructor — that path has no reactivity mechanism at all,
 *    so if this menu ever needed a live-updating field (e.g. a wallet balance shown inside the
 *    menu) it would silently never update. Rewritten to build every element via
 *    `SolidUI.h(Component, props)` with `parent:`-based composition (the confirmed real pattern,
 *    `solid-ui/README.md`), matching `hud.ts`/`scoreboard.ts`. Purchase rows use
 *    `UIContainerButton` (confirmed real, `ui/components/container-button/index.d.ts`) so each
 *    row can show an item name AND its price as two independently-styled text children inside one
 *    clickable surface, via its `innerContainer` attach point.
 *    Separately: `Events.OnPlayerInteract` previously called `openBuyMenu` unconditionally on
 *    every interact event, with no check for "menu already open" — if the engine re-fires
 *    interact while the player is still standing on the point (or on held input), this can make
 *    the Close button appear to do nothing, since the very next interact tick reopens the menu
 *    right after a close. Fixed with an explicit open-state guard below.
 */

import { Events } from "../../node_modules/bf6-portal-utils/events/index.ts";
import { SolidUI } from "../../node_modules/bf6-portal-utils/solid-ui/index.ts";
import { UI } from "../../node_modules/bf6-portal-utils/ui/index.ts";
import { UIContainer } from "../../node_modules/bf6-portal-utils/ui/components/container/index.ts";
import { UIText } from "../../node_modules/bf6-portal-utils/ui/components/text/index.ts";
import { UITextButton } from "../../node_modules/bf6-portal-utils/ui/components/text-button/index.ts";
import { UIContainerButton } from "../../node_modules/bf6-portal-utils/ui/components/container-button/index.ts";
import { OBJECT_ID } from "../config/ids.ts";
import { BASE_PRICES } from "../config/economy.ts";
import { spendCash, getCash, onCashChange } from "../player/wallet.ts";
import { requirePlayerState } from "../player/player-state.ts";
import { checkPurchase, type ShopItem } from "./buy-validator.ts";

/**
 * `labelKey` is a `mod.stringkeys.*` property name (must exist in `strings.json`), not display
 * text itself — `mod.Message()` can only display registered string keys. `label` is kept as
 * plain internal data for contexts that don't touch `mod.Message` (e.g. future logging).
 */
type CatalogItem = ShopItem & { labelKey: string };

const SHOP_CATALOG: CatalogItem[] = [
	{ id: "armor_plate_carrier", label: "Plate Carrier", labelKey: "item_armor_plate_carrier", basePrice: 1_200, gatingTrack: "support", requiredTier: 2 },
	{ id: "attachment_suppressor", label: "AK-205 Suppressor", labelKey: "item_attachment_suppressor", basePrice: 350, gatingTrack: "assault", requiredTier: 1 },
	{ id: "gadget_ammo_crate", label: "Ammo Crate", labelKey: "item_gadget_ammo_crate", basePrice: 200, gatingTrack: "support", requiredTier: 1 },
];

const BUY_MENU_INTERACT_IDS: readonly number[] = [
	OBJECT_ID.IP_BUY_MENU_LONESTAR,
	OBJECT_ID.IP_BUY_MENU_MANTICORE,
	OBJECT_ID.IP_BUY_MENU_VALKYRA,
];

function attemptPurchase(player: mod.Player, item: CatalogItem): boolean {
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
		// Defensive fallback — checkPurchase() already gated on the same balance, so this should
		// be unreachable, but spendCash() is the single source of truth for the deduction and
		// must still be branched on per wallet.ts's own contract.
		mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.shop_cannot_afford_generic), player);
		return false;
	}

	// A nested Message() object is not a legal msgArg (msgArg0/1/2 are typed
	// string | number | Player, index.d.ts:2835) — the item name has to be a stringkeys
	// reference passed directly, not wrapped in its own Message() call first.
	mod.DisplayNotificationMessage(
		mod.Message(mod.stringkeys.shop_purchase_confirm, mod.stringkeys[item.labelKey]),
		player
	);
	return true;
}

interface PlayerBuyMenu {
	container: UIContainer;
	visible: () => boolean;
	setVisible: (value: boolean) => void;
}

const menusByPlayer = new Map<mod.Player, PlayerBuyMenu>();

function buildShopRow(parent: UIContainer, player: mod.Player, item: CatalogItem, index: number): void {
	const price = BASE_PRICES[item.id] ?? item.basePrice;
	const rowY = 56 + index * 52;

	const row = SolidUI.h<UIContainerButton.Params, UIContainerButton>(UIContainerButton, {
		parent,
		position: { x: 0, y: rowY },
		size: { width: 380, height: 44 },
		anchor: mod.UIAnchor.TopCenter,
		bgColor: UI.COLORS.GREY_25,
		bgFill: mod.UIBgFill.Solid,
		baseColor: UI.COLORS.BLACK,
		pressedColor: UI.COLORS.GREY_50,
		focusedColor: UI.COLORS.GREY_75,
		onClickUp: () => {
			attemptPurchase(player, item);
		},
	});

	SolidUI.h(UIText, {
		parent: row.innerContainer,
		position: { x: 14, y: 0 },
		size: { width: 240, height: 44 },
		anchor: mod.UIAnchor.CenterLeft,
		textAnchor: mod.UIAnchor.CenterLeft,
		textColor: UI.COLORS.WHITE,
		textSize: 20,
		message: mod.Message(mod.stringkeys[item.labelKey]),
	});

	SolidUI.h(UIText, {
		parent: row.innerContainer,
		position: { x: -14, y: 0 },
		size: { width: 120, height: 44 },
		anchor: mod.UIAnchor.CenterRight,
		textAnchor: mod.UIAnchor.CenterRight,
		textColor: UI.COLORS.GREEN,
		textSize: 20,
		message: mod.Message(mod.stringkeys.shop_item_price, mod.stringkeys[item.labelKey], price),
	});
}

function buildBuyMenu(player: mod.Player): PlayerBuyMenu {
	const [visible, setVisible] = SolidUI.createSignal(false);
	const [wallet, setWallet] = SolidUI.createSignal(getCash(player));

	// onCashChange is a global listener list (wallet.ts), so every registration here must filter
	// to this specific player — otherwise player A's purchases would update player B's menu.
	onCashChange((changedPlayer, _delta, _reason, newBalance) => {
		if (mod.Equals(changedPlayer, player)) {
			setWallet(newBalance);
		}
	});

	const menuHeight = 100 + SHOP_CATALOG.length * 52 + 60;

	const container = SolidUI.h(UIContainer, {
		position: { x: 0, y: 0 },
		size: { width: 420, height: menuHeight },
		anchor: mod.UIAnchor.Center,
		receiver: player,
		visible,
		uiInputModeWhenVisible: true,
		bgColor: UI.COLORS.BLACK,
		bgAlpha: 0.85,
		bgFill: mod.UIBgFill.Solid,
	});

	SolidUI.h(UIText, {
		parent: container,
		position: { x: 0, y: 12 },
		size: { width: 420, height: 30 },
		anchor: mod.UIAnchor.TopCenter,
		textColor: UI.COLORS.WHITE,
		textSize: 26,
		message: mod.Message(mod.stringkeys.shop_header_title),
	});

	SolidUI.h(UIText, {
		parent: container,
		position: { x: 0, y: 42 },
		size: { width: 420, height: 20 },
		anchor: mod.UIAnchor.TopCenter,
		textColor: UI.COLORS.GREY_75,
		textSize: 14,
		message: mod.Message(mod.stringkeys.shop_header_subtitle),
	});

	// Live wallet balance shown inside the menu — reactive, kept in sync by onCashChange below.
	// This is exactly the kind of field the previous plain-constructor version could never have
	// supported correctly (see header comment).
	SolidUI.h(UIText, {
		parent: container,
		position: { x: 0, y: 30 },
		size: { width: 420, height: 18 },
		anchor: mod.UIAnchor.TopRight,
		textAnchor: mod.UIAnchor.TopRight,
		textColor: UI.COLORS.GREEN,
		textSize: 16,
		message: () => mod.Message(mod.stringkeys.shop_wallet_balance, wallet()),
	});

	SHOP_CATALOG.forEach((item, index) => buildShopRow(container, player, item, index));

	SolidUI.h(UITextButton, {
		parent: container,
		position: { x: 0, y: -16 },
		size: { width: 220, height: 40 },
		anchor: mod.UIAnchor.BottomCenter,
		bgColor: UI.COLORS.GREY_25,
		baseColor: UI.COLORS.BLACK,
		pressedColor: UI.COLORS.GREY_50,
		textColor: UI.COLORS.WHITE,
		textSize: 18,
		message: mod.Message(mod.stringkeys.shop_close_label),
		onClickUp: () => setVisible(false),
	});

	return { container, visible, setVisible };
}

function requireBuyMenu(player: mod.Player): PlayerBuyMenu {
	let menu = menusByPlayer.get(player);
	if (!menu) {
		menu = buildBuyMenu(player);
		menusByPlayer.set(player, menu);
	}
	return menu;
}

/**
 * Re-entry guard: without this, repeated `OnPlayerInteract` events while the menu is already
 * open (e.g. the player still standing on the interact point, or the engine re-firing interact
 * on held input) call `openBuyMenu` again on every event with no check for "already open" — which
 * can make Close appear to do nothing if an interact tick re-opens the menu immediately after a
 * close.
 */
Events.OnPlayerInteract.subscribe((eventPlayer, eventInteractPoint) => {
	const interactId = mod.GetObjId(eventInteractPoint);
	if (!BUY_MENU_INTERACT_IDS.includes(interactId)) {
		return;
	}
	const menu = requireBuyMenu(eventPlayer);
	if (menu.visible()) {
		return;
	}
	menu.setVisible(true);
});

Events.OnPlayerLeaveGame.subscribe((_eventNumber) => {});

export { attemptPurchase, SHOP_CATALOG };
