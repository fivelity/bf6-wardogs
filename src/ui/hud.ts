/**
 * hud.ts — wallet flash (`+$X` fade-in), active-track progress bar, FOB status overlays.
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → "UI Elements" → In-game HUD.
 * Same SolidUI pattern as `scoreboard.ts` (AGENTS.md §5). The wallet flash needs a *transient*
 * signal — set true, then auto-reset after N ticks — rather than a persistent one; `onRankUp`'s
 * spark uses the identical transient-then-reset pattern via the same helper, per BUILD_GUIDE.md §5
 * ("model it as its own small reusable helper ... rather than duplicating the timer logic twice").
 *
 * IMPORTANT (fixed — see WARDOGS_COMPLETION_REPORT.md §2.1/§3.2): two bugs fixed together here,
 * same root cause as scoreboard.ts's rewrite:
 *   1. `mod.Message()` requires `mod.stringkeys.*` references, not raw strings — this file
 *      previously stored pre-formatted display strings ("+$500", "ASSAULT — Tier 3") in signals
 *      and passed them straight to `mod.Message()`, which is exactly the "unavailable" bug.
 *      Signals now hold the raw numeric/key components (sign, amount, track key, level) instead,
 *      and `mod.Message(mod.stringkeys.hud_cash_flash, sign, amount)` builds the parameterized
 *      message reactively.
 *   2. Elements were built via `new UIContainer({ childrenParams: [...] })`, whose children are
 *      constructed via their raw constructor — no reactive-prop support. Rewritten to use
 *      `SolidUI.h(Component, props)` with `parent:`-based composition, the real mechanism
 *      (confirmed, solid-ui/README.md) for accessor-valued props to actually re-evaluate on
 *      signal change.
 */

import { Events } from "../../node_modules/bf6-portal-utils/events/index.ts";
import { SolidUI } from "../../node_modules/bf6-portal-utils/solid-ui/index.ts";
import { UI } from "../../node_modules/bf6-portal-utils/ui/index.ts";
import { UIContainer } from "../../node_modules/bf6-portal-utils/ui/components/container/index.ts";
import { UIText } from "../../node_modules/bf6-portal-utils/ui/components/text/index.ts";
import { onCashChange } from "../player/wallet.ts";
import { onRankUp, type TrackId } from "../player/progression.ts";

const TRANSIENT_FLASH_TICKS = 60;

/** `mod.stringkeys.*` property name per mastery track — see strings.json. */
const TRACK_NAME_KEY: Record<TrackId, string> = {
	assault: "track_assault",
	medic: "track_medic",
	support: "track_support",
	recon: "track_recon",
	driverPilot: "track_driverPilot",
	engineer: "track_engineer",
};

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
	setCashFlash: (sign: string, amount: number) => void;
	cashFlash: ReturnType<typeof createTransientFlag>;
	rankUpFlash: ReturnType<typeof createTransientFlag>;
	setRankUp: (trackKey: string, level: number) => void;
}

const hudsByPlayer = new Map<mod.Player, PlayerHud>();

function buildHud(player: mod.Player): PlayerHud {
	// Raw components, not pre-formatted strings — mod.Message() needs the stringkeys reference
	// plus its numeric/string args separately, not a string that's already been built.
	const [cashSign, setCashSign] = SolidUI.createSignal("+");
	const [cashAmount, setCashAmount] = SolidUI.createSignal(0);
	const [rankUpTrackKey, setRankUpTrackKey] = SolidUI.createSignal("track_assault");
	const [rankUpLevel, setRankUpLevel] = SolidUI.createSignal(1);
	const cashFlash = createTransientFlag();
	const rankUpFlash = createTransientFlag();

	const container = SolidUI.h(UIContainer, {
		position: { x: -20, y: 20 },
		size: { width: 200, height: 80 },
		anchor: mod.UIAnchor.TopRight,
		receiver: player,
		visible: true,
		uiInputModeWhenVisible: false,
	});

	SolidUI.h(UIText, {
		parent: container,
		position: { x: 0, y: 0 },
		size: { width: 200, height: 30 },
		anchor: mod.UIAnchor.TopRight,
		textColor: UI.COLORS.GREEN,
		textSize: 24,
		visible: () => cashFlash.signal(),
		message: () => mod.Message(mod.stringkeys.hud_cash_flash, cashSign(), cashAmount()),
	});

	SolidUI.h(UIText, {
		parent: container,
		position: { x: 0, y: 34 },
		size: { width: 200, height: 30 },
		anchor: mod.UIAnchor.TopRight,
		textColor: UI.COLORS.YELLOW,
		textSize: 22,
		visible: () => rankUpFlash.signal(),
		message: () => mod.Message(mod.stringkeys.hud_rank_up, mod.stringkeys[rankUpTrackKey()], rankUpLevel()),
	});

	return {
		container,
		setCashFlash: (sign, amount) => {
			setCashSign(sign);
			setCashAmount(amount);
		},
		cashFlash,
		rankUpFlash,
		setRankUp: (trackKey, level) => {
			setRankUpTrackKey(trackKey);
			setRankUpLevel(level);
		},
	};
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
	hud.setCashFlash(delta >= 0 ? "+" : "-", Math.abs(delta));
	hud.cashFlash.trigger();
});

onRankUp((player, track, newLevel) => {
	const hud = requireHud(player);
	hud.setRankUp(TRACK_NAME_KEY[track], newLevel);
	hud.rankUpFlash.trigger();
});

Events.OnPlayerJoinGame.subscribe((eventPlayer) => {
	requireHud(eventPlayer);
});

Events.OnPlayerLeaveGame.subscribe((_eventNumber) => {});
