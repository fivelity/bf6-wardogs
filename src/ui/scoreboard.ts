/**
 * scoreboard.ts — the custom 3-faction scoreboard overlay.
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → "UI Elements" (native BF6 overlays only support 2 teams —
 * Known Issue #3). Built with `SolidUI.h(UI.X, {...})` trees per AGENTS.md §5, driven by
 * `SolidUI.createSignal()` state that's coalesced from `controlzone.ts`'s tracked ticket totals
 * on a throttled cadence (`deferTicks`) rather than repainting 30x/second.
 *
 * This file only *displays* state — it never subscribes to `OnPlayerUIButtonEvent` itself, since
 * the `UI` module already owns that hook internally (AGENTS.md §4).
 *
 * IMPORTANT (fixed — see WARDOGS_COMPLETION_REPORT.md §3.2/§3.3): the previous version of this
 * file built its element tree via plain `new UIContainer({ childrenParams: [...] })` calls.
 * `UIContainer.ChildParams<T>` (ui/components/container/index.d.ts) constructs children via their
 * raw `new (params: T) => UI.Element` constructor — it has NO reactivity mechanism, so
 * function-valued props passed through `childrenParams` were never evaluated as accessors and
 * never updated after first paint. The real reactive-composition pattern (confirmed,
 * solid-ui/README.md "Quick Start" + `h()` docs) is: every element — container or leaf — is
 * created via its own `SolidUI.h(Component, props, options)` call, and a child is attached to a
 * parent via the `parent:` prop (real property on every `UI.Element`, ui/index.d.ts:45), not by
 * nesting descriptor objects. Only `SolidUI.h()` reads function-valued props as accessors, sets
 * up the initial value, and creates an effect that re-runs on signal change. Rewritten below to
 * match that pattern exactly. Ticket-repaint throttling now uses `{ deferTicks: 20 }` on the
 * `h()` call instead of a hand-rolled tick accumulator — `deferTicks` is a per-call/per-effect
 * options property (not a standalone function), and once bindings go through `h()`, the library's
 * own logical-tick coalescing replaces the manual `Events.OngoingGlobal` counter entirely.
 */

import { Events } from "../../node_modules/bf6-portal-utils/events/index.ts";
import { SolidUI } from "../../node_modules/bf6-portal-utils/solid-ui/index.ts";
import { UI } from "../../node_modules/bf6-portal-utils/ui/index.ts";
import { UIContainer } from "../../node_modules/bf6-portal-utils/ui/components/container/index.ts";
import { UIText } from "../../node_modules/bf6-portal-utils/ui/components/text/index.ts";
import { getAllTickets } from "../game/mode/controlzone.ts";
import { SCORING_FACTION_IDS, type FactionId } from "../config/teams.ts";

const [tickets1, setTickets1] = SolidUI.createSignal(0);
const [tickets2, setTickets2] = SolidUI.createSignal(0);
const [tickets3, setTickets3] = SolidUI.createSignal(0);

const ticketSetters: Record<FactionId, (value: number) => void> = {
	1: setTickets1,
	2: setTickets2,
	3: setTickets3,
	4: () => {},
};
const ticketSignals: Record<FactionId, () => number> = {
	1: tickets1,
	2: tickets2,
	3: tickets3,
	4: () => 0,
};

const FACTION_COLORS: Record<FactionId, mod.Vector> = {
	1: UI.COLORS.CYAN,
	2: UI.COLORS.RED,
	3: UI.COLORS.WHITE,
	4: UI.COLORS.WHITE,
};

/** `mod.stringkeys.*` property name per scoring faction's short name — see strings.json. */
const FACTION_SHORT_NAME_KEY: Record<FactionId, string> = {
	1: "faction_lonestar_short",
	2: "faction_manticore_short",
	3: "faction_valkyra_short",
	4: "faction_lonestar_short", // unused — Chaos Squads never appear on this scoreboard
};

function refreshTicketSignals(): void {
	const tickets = getAllTickets();
	for (const faction of SCORING_FACTION_IDS) {
		ticketSetters[faction](tickets[faction]);
	}
}

Events.OngoingGlobal.subscribe(() => {
	refreshTicketSignals();
});

/** Builds one faction's row (short-name label + live ticket count) as children of `parent`. */
function buildFactionRow(parent: UIContainer, faction: FactionId, index: number): void {
	const row = SolidUI.h(UIContainer, {
		parent,
		position: { x: 0, y: index * 44 },
		size: { width: 240, height: 40 },
		anchor: mod.UIAnchor.TopCenter,
	});

	SolidUI.h(UIText, {
		parent: row,
		position: { x: 10, y: 0 },
		size: { width: 100, height: 40 },
		anchor: mod.UIAnchor.TopLeft,
		textColor: FACTION_COLORS[faction],
		textSize: 22,
		message: mod.Message(mod.stringkeys[FACTION_SHORT_NAME_KEY[faction]]),
	});

	// Reactive: message re-evaluates whenever this faction's ticket signal changes. Coalesced to
	// once every 20 logical ticks (~20 Events.OngoingGlobal callbacks) rather than every change,
	// matching the previous hand-rolled accumulator's cadence but via the library's own mechanism.
	SolidUI.h(
		UIText,
		{
			parent: row,
			position: { x: 0, y: 0 },
			size: { width: 100, height: 40 },
			anchor: mod.UIAnchor.TopRight,
			textColor: UI.COLORS.WHITE,
			textSize: 22,
			message: () => mod.Message(mod.stringkeys.scoreboard_ticket_count, ticketSignals[faction]()),
		},
		{ deferTicks: 20 }
	);
}

function buildScoreboard(player: mod.Player): UIContainer {
	const container = SolidUI.h(UIContainer, {
		position: { x: 0, y: 20 },
		size: { width: 240, height: 140 },
		anchor: mod.UIAnchor.TopCenter,
		receiver: player,
		visible: true,
		uiInputModeWhenVisible: false,
	});

	SCORING_FACTION_IDS.forEach((faction, index) => buildFactionRow(container, faction, index));

	return container;
}

const scoreboardsByPlayer = new Map<mod.Player, UIContainer>();

Events.OnPlayerDeployed.subscribe((eventPlayer) => {
	if (!scoreboardsByPlayer.has(eventPlayer)) {
		scoreboardsByPlayer.set(eventPlayer, buildScoreboard(eventPlayer));
	}
});

Events.OnPlayerLeaveGame.subscribe((_eventNumber) => {});

export { buildFactionRow };