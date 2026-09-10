/**
 * WARDOGS entrypoint (bf6.config.ts → entrypoint: "src/index.ts").
 *
 * Per AGENTS.md §4: this file NEVER exports raw Portal event handlers
 * (no `export function OnPlayerDied`, `export function OngoingGlobal`, etc.).
 * `bf6-portal-utils/events`'s `Events` module owns every handler once,
 * project-wide, and `bf6-portal-utils/ui` depends on that ownership for
 * `OnPlayerUIButtonEvent`. A raw export here would silently break it.
 *
 * Instead, every game/UI module below subscribes to what it needs via
 * `Events.OnX.subscribe(...)` at its own top level. Importing each module
 * here is what causes those subscriptions to register when the mod loads —
 * so this file's only job is to be the complete, ordered import list.
 */

// Config (data only — no side effects, safe to import first)
import "./config/ids.ts";
import "./config/constants.ts";
import "./config/teams.ts";
import "./config/economy.ts";

// Player state
import "./player/player-state.ts";
import "./player/wallet.ts";
import "./player/progression.ts";

// NOTE: game/core exports only plain classes (TransitionState) with zero Events.*.subscribe()
// calls, so it is intentionally not imported here — it has nothing to register at load time. Any
// file that needs it (fob.ts, and future core primitives) imports it directly.

// WARDOGS mode-specific rules (FOB, ControlZone, HotZone, Towers, Salvage, Chaos AI). Order
// matters here: hotzone.ts and chaos-ai.ts both import controlzone.ts's isPhase3(), and
// towers.ts imports hotzone.ts's lockDriftTarget() — game/mode/index.ts's own import order
// already respects this, so a single barrel import is sufficient and correct.
import "./game/mode/index.ts";

// UI (SolidUI-composed: scoreboard, HUD, buy menu)
import "./ui/scoreboard.ts";
import "./ui/hud.ts";
import "./ui/buy-menu.ts";


