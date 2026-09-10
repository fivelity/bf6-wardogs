/**
 * hud.ts — wallet flash (`+$X` fade-in), active-track progress bar, FOB status overlays.
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → "UI Elements" → In-game HUD.
 * Same SolidUI pattern as `scoreboard.ts` (AGENTS.md §5). The wallet flash needs a *transient*
 * signal — set true, then auto-reset after N ticks — rather than a persistent one; `onRankUp`'s
 * spark uses the identical transient-then-reset pattern via the same helper, per BUILD_GUIDE.md §5
 * ("model it as its own small reusable helper ... rather than duplicating the timer logic twice").
 */

// src/ui/hud.ts
import { Events } from "../../node_modules/bf6-portal-utils/events/index.ts";
import { SolidUI } from "../../node_modules/bf6-portal-utils/solid-ui/index.ts";
import { UI } from "../../node_modules/bf6-portal-utils/ui/index.ts";
import { UIContainer } from "../../node_modules/bf6-portal-utils/ui/components/container/index.ts";
import { UIText } from "../../node_modules/bf6-portal-utils/ui/components/text/index.ts";
import { onCashChange } from "../player/wallet.ts";
import { onRankUp } from "../player/progression.ts";

const TRANSIENT_FLASH_TICKS = 60;

function createTransientFlag(): { signal: () => boolean; trigger: () => void } {
	const [flag, setFlag] = SolidUI.createSignal(false);
	let ticksRemaining = 0;

	Events.OngoingGlobal.subscribe(() => {
		if (ticksRemaining <= 0) {
			return;
		}
		ticksRemaining -= 1;
		if (ticksRemaining === 0) {
			setFlag(false);
		}
	});

	return {
		signal: flag,
		trigger: () => {
			setFlag(true);
			ticksRemaining = TRANSIENT_FLASH_TICKS;
		},
	};
}

interface PlayerHud {
	container: UIContainer;
	cashFlashText: () => string;
	setCashFlashText: (value: string) => void;
	cashFlash: ReturnType<typeof createTransientFlag>;
	rankUpFlash: ReturnType<typeof createTransientFlag>;
	rankUpText: () => string;
	setRankUpText: (value: string) => void;
}

const hudsByPlayer = new Map<mod.Player, PlayerHud>();

function buildHud(player: mod.Player): PlayerHud {
	const [cashFlashText, setCashFlashText] = SolidUI.createSignal("");
	const [rankUpText, setRankUpText] = SolidUI.createSignal("");
	const cashFlash = createTransientFlag();
	const rankUpFlash = createTransientFlag();

	const container = new UIContainer({
		position: { x: -20, y: 20 },
		size: { width: 200, height: 80 },
		anchor: mod.UIAnchor.TopRight,
		receiver: player,
		visible: true,
		uiInputModeWhenVisible: false,
		childrenParams: [
			{
				type: UIText,
				position: { x: 0, y: 0 },
				size: { width: 200, height: 30 },
				anchor: mod.UIAnchor.TopRight,
				textColor: UI.COLORS.GREEN,
				textSize: 24,
				visible: () => cashFlash.signal(),
				message: () => mod.Message(cashFlashText()),
			},
			{
				type: UIText,
				position: { x: 0, y: 34 },
				size: { width: 200, height: 30 },
				anchor: mod.UIAnchor.TopRight,
				textColor: UI.COLORS.YELLOW,
				textSize: 22,
				visible: () => rankUpFlash.signal(),
				message: () => mod.Message(rankUpText()),
			},
		] as UIContainer.ChildParams<any>[],
	});

	return { container, cashFlashText, setCashFlashText, cashFlash, rankUpFlash, rankUpText, setRankUpText };
}

function requireHud(player: mod.Player): PlayerHud {
	let hud = hudsByPlayer.get(player);
	if (!hud) {
		hud = buildHud(player);
		hudsByPlayer.set(player, hud);
	}
	return hud;
}

onCashChange((player, delta, _reason, _newBalance) => {
	const hud = requireHud(player);
	const sign = delta >= 0 ? "+" : "-";
	hud.setCashFlashText(`${sign}$${Math.abs(delta)}`);
	hud.cashFlash.trigger();
});

onRankUp((player, track, newLevel) => {
	const hud = requireHud(player);
	hud.setRankUpText(`${track.toUpperCase()} — Tier ${newLevel}`);
	hud.rankUpFlash.trigger();
});

Events.OnPlayerJoinGame.subscribe((eventPlayer) => {
	requireHud(eventPlayer);
});

Events.OnPlayerLeaveGame.subscribe((_eventNumber) => {});