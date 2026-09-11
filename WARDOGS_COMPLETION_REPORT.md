# WARDOGS — feat/mod-impl Completion & Tech-Debt Report

**Scope:** Full audit of `fivelity/bf6-wardogs` @ `feat/mod-impl`, cross-checked against the real
`bf6-portal-utils@9.4.0` and `bf6-portal-mod-types@4.2.0` packages (installed and inspected
directly — not recalled from training data), plus the actual toolchain in `package.json`.

**Method:** Every SDK claim below cites the exact `.d.ts` file/line or README section that was
read to confirm it. Where the repo's own docs (`AGENTS.md`, `BUILD_GUIDE.md`,
`WARDOGS_DESIGN_BRIEF.md`) disagree with what's actually in the repo or the real SDK, that's
called out explicitly — several of your own project docs are now stale relative to the code.

**How to use this doc:** Section 1 is the toolchain/doc reconciliation you need before anyone
touches code again. Section 2 is the three reported gameplay bugs, root-caused. Section 3 is
everything else found during the audit, organized by file. Section 4 is a prioritized backlog.
Section 5 is recommendations for process going forward.

---

## 0. Top-line summary

The mod **compiles, deploys, and the core scoring/economy logic is sound** — `wallet.ts`,
`win-condition.ts`, `player-state.ts`, and `salvage.ts` are well-built and correctly verified
against the real SDK. The problems are concentrated in exactly the three areas you flagged, plus
one you hadn't: **the UI layer never uses the reactive pattern the SDK's `UI`/`SolidUI` modules
are designed around**, so every dynamic bit of UI (ticket counts, wallet flash, rank-up flash) is
built on props the underlying widgets have no mechanism to evaluate. Fixing that is the same root
fix as the "unavailable" text bug, so it's cheaper to fix in one pass than the three separate
bugs it looks like from playtesting.

Also found: two silent gameplay-breaking bugs unrelated to what you reported — Chaos Squads spawn
onto **Team1 (Lonestar)** instead of Team4, and only ever spawn **once**, not the 12 bots the
design brief specifies. Tower capture never actually records which faction owns a tower, so the
Secondary Objective 1 HotZone-lock can never trigger. These would have surfaced as "the game feels
wrong" bugs during a longer playtest even after the UI issues are fixed.

---

## 1. Toolchain & documentation reconciliation (do this first)

Your `AGENTS.md` and `BUILD_GUIDE.md` describe a project that doesn't match what's actually
checked in. This isn't cosmetic — an agent (human or LLM) reading `AGENTS.md` today will reach for
tools that don't exist in this repo and skip real ones that do.

### 1.1 Package manager

- **`AGENTS.md` §3 and §6 say "npm only," `package-lock.json` committed.**
- **Reality:** the repo has `pnpm-lock.yaml` and `pnpm-workspace.yaml`; `package.json` has no npm
  lockfile at all.
- **Fix:** pick one and make the docs match. Given you've told me you standardize on **pnpm** for
  your own projects, the pragmatic move is to update `AGENTS.md` §3/§6/§11 to say pnpm, not
  regenerate an npm lockfile — the current repo state is already pnpm-only in practice.

### 1.2 Bundler / build tooling

- **`AGENTS.md` §1 and `README.md` say tooling is `@bf6mods/cli`.**
- **Reality:** `package.json` devDependencies pull `ts-bf6-portal` from
  `github:The-Sir-Community/ts-bf6-portal` — a different, community-maintained toolchain with its
  own bundler (`ts-portal-bundle`), deploy CLI (`ts-bf6-deploy`), and strings extractor
  (`ts-bf6-strings`, backed by `dist/bundler/strings-bundler.js` in that package — **not
  documented in that package's own README**, but present and working as a `bin` entry).
- This isn't just a naming mismatch — `@bf6mods/cli` and `ts-bf6-portal` are different projects
  with different config shapes (`bf6.config.ts` vs. `ts-bf6-portal.config.json`, both of which
  exist in different docs/repo state, which is its own red flag).
- **Fix:** `AGENTS.md` §1 and `README.md`'s tooling section need a full rewrite to describe
  `ts-bf6-portal`, its actual config file (`ts-bf6-portal.config.json`, which **is** present in
  the repo and correctly structured per that package's README), and its actual `strings`/`bundle`/
  `deploy` scripts (which **do** match what's in `package.json`).

### 1.3 `@bf6mods/sdk` reference

- **`WARDOGS_DESIGN_BRIEF.md` §6 ("Types") mentions `@bf6mods/sdk` covering the type surface
  alongside `bf6-portal-mod-types`.**
- **Reality:** `package.json` has no such dependency. Only `bf6-portal-mod-types` and
  `bf6-portal-utils` are installed, and they cover the entire surface actually used in `src/`.
- **Fix:** delete the `@bf6mods/sdk` reference from the brief; it's describing a package this repo
  doesn't use.

### 1.4 Two undocumented `bf6-portal-utils` modules you should be using

`AGENTS.md` §5's table of canonical `bf6-portal-utils` submodules is missing two that are directly
relevant to WARDOGS and already installed as a transitive part of the package:

| Module | What it does | Why WARDOGS needs it |
|---|---|---|
| `bf6-portal-utils/player-undeploy-fixer` | Auto-subscribes to `OnPlayerDied`/`OnPlayerUndeploy`/`OnPlayerLeaveGame`; if a player doesn't fire a real `OnPlayerUndeploy` within 30s of death, it manually triggers one via `Events.OnPlayerUndeploy.trigger(player)`. | This **is** a maintained, ready-made fix for the exact "ragdoll limbo bug" `WARDOGS_DESIGN_BRIEF.md` Known Issue #1 describes and `salvage.ts` currently works around by design (subscribing to `OnPlayerUndeploy` instead of `OnPlayerDied`). Importing this module for its side effect (`import "bf6-portal-utils/player-undeploy-fixer";` in `src/index.ts`) closes a gap your own workaround doesn't fully cover — the workaround only helps if `OnPlayerUndeploy` fires at all; this module is what makes sure it does. |
| `bf6-portal-utils/mod-extensions` | Typed wrappers for undocumented runtime `mod` APIs: `isDeathType`, `isDamageType`, `isGadget`, `isWeapon` event-type comparisons, and `getString(key)` for reading raw `mod.strings` values (distinct from `mod.stringkeys`/`mod.Message` — see §2.1). | Directly useful for `chaos-ai.ts`'s AI-vs-player death handling (§3.6) and any future death-type-gated logic (e.g. distinguishing a Chaos AI kill from a player kill for the XP table). |

Add both to `AGENTS.md` §5's table now that they're confirmed real and relevant.

### 1.5 Terminology: "PolygonVolume" isn't a real SDK type

Your bug report and (in places) the design brief use "PolygonVolume" for the capture-zone shapes.
**Grepped the full `bf6-portal-mod-types` type surface — no `PolygonVolume` type exists.** The
real primitive is `AreaTrigger` (confirmed, `types.d.ts:14`), which is what `config/ids.ts` and
the game-mode files already correctly use (`AT_CONTROLZONE`, `AT_HOTZONE`). Purely a terminology
correction — worth fixing in the brief so future contributors don't go looking for an SDK type
that isn't there.

---

## 2. Your three reported bugs — root-caused

### 2.1 "All UI text reads as `unavailable`"

**Root cause, confirmed against the real SDK (`bf6-portal-mod-types/index.d.ts:2820-2881`):**
`mod.Message()` does **not** accept arbitrary string literals as display text. Per its own doc
comment: *"All strings passed as arguments must be found in the `strings.json` which is injected
as `mod.stringkeys`."* Every string passed to `mod.Message()` must be a reference from the
`mod.stringkeys.*` dictionary (an opaque key into your `strings.json`), not a raw string.

Your code does this everywhere:

```ts
// src/ui/buy-menu.ts:73
message: mod.Message("HQ ACQUISITIONS"),
```

This is exactly the shape that produces `unavailable`-style placeholder text at runtime — the
engine looks up `"HQ ACQUISITIONS"` as if it were a `stringkeys` reference, fails to resolve it,
and falls back to a placeholder.

**This is not a buy-menu-only bug.** Grepped every `mod.Message(` call site in `src/`:

| File | Line(s) | Pattern |
|---|---|---|
| `ui/buy-menu.ts` | 41, 51, 73, 84, 96 | Raw string / template literal passed directly |
| `ui/hud.ts` | 79, 89 | `mod.Message(cashFlashText())` / `mod.Message(rankUpText())` — signal returns a plain built string |
| `ui/scoreboard.ts` | 95, 104 | `mod.Message(definition.shortName)` and `mod.Message(String(ticketSignals[faction]()))` |
| `game/mode/fob.ts` | 92 | Raw string |

**Every UI surface in the mod has this bug**, which matches exactly what you saw in-game (buy
menu, HUD, scoreboard all reading as unavailable).

**Your `src/strings.json` already has the right shape** — it defines 5 keys
(`shop_header_title`, `shop_close_label`, etc.) — **but nothing in `src/` actually references
`mod.stringkeys.shop_header_title`, etc.** The file exists but is completely disconnected from the
code that should consume it.

**The fix, mechanically:**
1. For every static UI label (headers, button labels, close-button text): add a `strings.json`
   entry if one doesn't exist, then reference it as `mod.Message(mod.stringkeys.<key>)`.
2. For **dynamic** text (ticket counts, cash amounts, item prices) — this is the part that needs a
   parameterized string, not a new key per value. Per the real `Message()` overloads
   (`index.d.ts:2820-2881`), the pattern is a `strings.json` entry with `{}` placeholders and the
   dynamic value passed as an additional argument:
   ```json
   // strings.json
   { "wallet_flash": "{}{}", "purchase_confirm": "Purchased: {}" }
   ```
   ```ts
   // instead of mod.Message(`Purchased: ${item.label}`)
   mod.Message(mod.stringkeys.purchase_confirm, item.label)
   ```
   **Important:** `msgArg0`/`msgArg1`/`msgArg2` accept `string | number | Player` directly
   (confirmed, same doc block) — so `scoreboard.ts`'s ticket count doesn't need
   `String(ticketSignals[faction]())` at all; passing the raw `number` through
   `mod.Message(mod.stringkeys.ticket_count, ticketSignals[faction]())` is both correct and
   simpler than the current code.
3. **Free tooling you're not using yet:** `ts-bf6-portal`'s `strings-bundler.js` (backing your
   `pnpm strings` script) has a **candidate-detection pass** that scans every `.ts`/`.tsx` file for
   string literals not already in `strings.json` and prints ready-to-paste JSON suggestions with
   file:line provenance. Run `pnpm strings` right now (or `node
   node_modules/ts-bf6-portal/dist/bundler/strings-bundler.js`) — its console output will hand you
   nearly the entire punch list of missing keys, generated automatically from the exact literals
   above. This should become a required pre-deploy step (see §5.2).
4. Separately: `bf6-portal-utils/mod-extensions`'s `getString(key)` (§1.4) reads `mod.strings`
   (the **raw string value**, for comparisons/logging) — this is a different object from
   `mod.stringkeys` (**opaque display keys**, for `Message()` only) and the two are not
   interchangeable. Don't reach for `getString` when you need `Message()` output.

### 2.2 "Buy-menu Close button does nothing; forces respawn to regain movement"

Two independent issues layer here. I could not 100% pin down which one is the dominant cause
without deploying and testing live (search/read access alone can't fire a Portal runtime), but both
are confirmed real bugs against the SDK and should both be fixed regardless.

**Confirmed bug — button handler naming is actually correct, ruling that out:** `onClickUp` is the
right handler name (confirmed, `bf6-portal-utils/ui/components/button/index.d.ts`), and
`buy-menu.ts` uses it correctly on both the purchase buttons and the close button. This is not a
misuse of `onClickDown` vs `onClickUp`.

**Confirmed architectural risk — `uiInputModeWhenVisible` placement:** The real UI module's README
(`bf6-portal-utils/ui/README.md`, "When to Use" section) is explicit:

> Enable `uiInputModeWhenVisible` only on elements that you actually intend to toggle between
> visible and not visible... if you have a container with 4 buttons and only the container's
> visibility will change, set `uiInputModeWhenVisible: true` only on the container, not on the
> individual buttons.

`buy-menu.ts`'s `buildBuyMenu()` does set this correctly — only on the outer `UIContainer`, not on
individual `UITextButton`s — so this specific misuse pattern is *not* present. However:

> The system may not work correctly if you try to manually enable or disable UI input mode with
> `mod.EnableUIInputMode` in any scope, since there is no way to query the runtime to determine the
> current UI input mode state.

Grepped `src/` for `EnableUIInputMode` — **zero hits**, so nothing is fighting the automatic
system. Ruled out.

**The most likely actual cause, given everything else confirmed in this audit:** §2.1's bug means
the "CLOSE PROTOCOL [ESC]" button's **label text itself is broken** (`unavailable`), but the
`onClickUp` handler wiring on that button (`closeBuyMenu`) is unaffected by that — text rendering
and click handling are independent systems. `closeBuyMenu()`'s logic itself is simple and correct:

```ts
function closeBuyMenu(player: mod.Player): void {
  const menu = menusByPlayer.get(player);
  if (menu) {
    menu.visible = false;
  }
}
```

Setting `menu.visible = false` on a container with `uiInputModeWhenVisible: true` **should**
automatically release the input-mode request per the README's documented request-based system
("Requests are automatically released when elements are hidden"). This code is correct as
written.

**What I could not verify without a live deploy:** whether `OnPlayerInteract` is re-firing while
the menu is open and silently reopening it (there's no debounce/re-entry guard in
`Events.OnPlayerInteract.subscribe` at the bottom of `buy-menu.ts` — it calls `openBuyMenu` on
every interact event with no check for "is the menu already open"), which would make Close appear
to do nothing because the very next interact tick reopens it. **Recommend adding an early-return
guard** (`if (menu.visible) return;` inside the interact handler, or track open/closed state
explicitly) as a defensive fix regardless of whether it's the root cause — it's a real gap in the
current logic either way.

**Also recommend:** wire actual `mod.EnableUIInputMode`/soldier-movement diagnostics via
`PortalGadget`/`Events.OngoingPlayer` logging during your next playtest session specifically around
the Close-button press, since this is the one bug in this report I could not fully root-cause from
static analysis alone — live logging (`UI.setLogging(console.log, UI.LogLevel.Debug, true)`, per
the UI module's own debug facility) will show exactly what the input-mode system did on that click.

### 2.3 "Only TeamHQ spawn bases are visible; no ControlPoints/ControlZone/HotZone/Towers, no capture outlines, nothing on minimap/bigmap"

**Root cause, confirmed by full-repo grep:** the real SDK requires objectives to be explicitly
enabled before they render — this is standard Portal behavior, not a WARDOGS-specific bug, but
nothing in the codebase does it.

Two real, confirmed SDK calls exist specifically for this and are **never called anywhere in
`src/`**:

```ts
// bf6-portal-mod-types/index.d.ts:1006
// "Enables or disables the provided objective." — CapturePoint | HQ | Sector | MCOM
export function EnableGameModeObjective(objective: CapturePoint | HQ | Sector | MCOM, enable: boolean): void;

// bf6-portal-mod-types/index.d.ts:1358
// "Enables the HUD UI for an objective (Capture Points and MCOMs)."
export function SetObjectiveUIEnabled(objective: CapturePoint | HQ | Sector | MCOM, enabled: boolean): void;
```

There's also a bulk convenience version:

```ts
// bf6-portal-mod-types/index.d.ts:1354
// "Enables the HUD UI for all objectives (Capture Points and MCOMs)."
export function SetAllObjectivesUIEnabled(enabled: boolean): void;
```

And separately, `AreaTrigger`s themselves have their own enable call:

```ts
// bf6-portal-mod-types/index.d.ts:857
export function EnableAreaTrigger(areaTrigger: AreaTrigger, enable: boolean): void;
```

**Why only the HQs are visible:** HQs default to enabled in Portal's base template; custom
`CapturePoint`s spawned/placed for a mod do not. That's exactly consistent with what you saw —
`HQ_LONESTAR`/`HQ_MANTICORE`/`HQ_VALKYRA` render because HQs are on by default, while
`CP_CONTROLZONE`, `CP_HOTZONE`, `CP_TOWER_A`, `CP_TOWER_B` never got an explicit enable call and so
stay inert — no capture ring, no minimap icon, no bigmap icon.

**Corroborating evidence from your own config file:** `config/ids.ts` already defines
`ICON_CONTROLZONE: 903` and `ICON_HOTZONE: 902` — these ObjIds correspond to `WorldIcon` objects
that exist in the Godot scene, presumably placed exactly for this purpose — but grepping all of
`src/` shows **these two constants are referenced nowhere except their own definition.** No
`GetWorldIcon(903)`, no `SetWorldIconText`, no `EnableWorldIconImage`. They're dead config.

**The fix, mechanically — add to `game/mode/controlzone.ts`'s existing `OnGameModeStarted`
handler** (it already runs once at match start and does related one-time setup):

```ts
Events.OnGameModeStarted.subscribe(() => {
  mod.SetGameModeCriteria(mod.ScoreCriteria.HighestProgress);
  mod.SetGameModeTargetScore(1);

  for (const faction of SCORING_FACTION_IDS) {
    mod.SetGameModeInitialScore(mod.GetTeam(faction), 0);
  }

  // NEW — make objectives and their AreaTriggers visible:
  const controlZoneCp = mod.GetCapturePoint(OBJECT_ID.CP_CONTROLZONE);
  const hotZoneCp = mod.GetCapturePoint(OBJECT_ID.CP_HOTZONE);
  const towerA = mod.GetCapturePoint(OBJECT_ID.CP_TOWER_A);
  const towerB = mod.GetCapturePoint(OBJECT_ID.CP_TOWER_B);

  for (const cp of [controlZoneCp, hotZoneCp, towerA, towerB]) {
    mod.EnableGameModeObjective(cp, true);
    mod.SetObjectiveUIEnabled(cp, true);
  }

  mod.EnableAreaTrigger(mod.GetAreaTrigger(OBJECT_ID.AT_CONTROLZONE), true);
  mod.EnableAreaTrigger(mod.GetAreaTrigger(OBJECT_ID.AT_HOTZONE), true);
});
```

`mod.GetCapturePoint(objId)` and `mod.GetAreaTrigger(objId)` are both confirmed real
(`index.d.ts:2602`, `index.d.ts:2282`). This is a small, self-contained, high-confidence fix — it
should resolve the entire "invisible objectives" complaint in one pass.

**Separately, the two dead `ICON_*` ObjIds** should be wired up too, since the HotZone's flag
position moves every drift step (`hotzone.ts`'s `driftStep()`) and a static world icon won't track
that unless it's explicitly re-positioned each drift:

```ts
// in hotzone.ts's driftStep(), after the MoveObjectOverTime call:
const hotZoneIcon = mod.GetWorldIcon(OBJECT_ID.ICON_HOTZONE);
mod.SetWorldIconPosition(hotZoneIcon, target);
```

(`GetWorldIcon`/`SetWorldIconPosition` both confirmed real, `index.d.ts:2818` / `index.d.ts:1410`.)

---

## 3. Additional bugs and gaps found during the audit (not in your original report)

### 3.1 `hotzone.ts` — `CapturePoint` forced through a type it can't legally be

```ts
mod.MoveObjectOverTime(
  hotZoneCapturePoint as unknown as mod.SpatialObject,  // ← type-system lie
  delta, mod.CreateVector(0, 0, 0), HOTZONE_DRIFT_DURATION_SECONDS, false, false,
);
```

`MoveObjectOverTime`'s real parameter type (`index.d.ts:1204-1224`) is a union of
`Bomb | EmplacementSpawner | FixedCamera | InteractPoint | LootSpawner | MCOM | SFX |
SpatialObject | Spawner | VehicleSpawner | VL7Cloud | VO | WorldIcon` — **`CapturePoint` is not
in that list.** The `as unknown as mod.SpatialObject` cast silences TypeScript but doesn't change
what the value actually is at runtime; if `CapturePoint` isn't a movable object type in the real
engine, this call likely no-ops or throws at runtime, which is a second, independent reason the
HotZone flag may not visibly move even after §2.3's visibility fix is applied.

**Needs a design decision, not a guess:** either (a) confirm empirically (deploy + log the return/
error from this call) that `CapturePoint` objects genuinely can be moved this way despite the
type signature (some Portal APIs are under-typed), or (b) if not, the drifting flag likely needs
to be modeled as a separately-spawned `WorldIcon`/marker object that's moved, with the
`CapturePoint`'s actual capture-trigger geometry following it via a different mechanism (possibly
re-parenting an `AreaTrigger`, which needs its own signature check). This is a design-brief-level
question per `AGENTS.md` §1 — resolve it there before writing more `hotzone.ts` code on top of an
unconfirmed assumption.

### 3.2 UI reactivity is not actually reactive anywhere — a systemic pattern bug, not a typo

This is the most consequential finding in the audit outside of your three reported bugs, because
it explains *why* the "unavailable" symptom is total rather than partial, and it will keep causing
silent UI bugs even after §2.1's string-key fix.

**What the SDK's reactive pattern actually requires:** per `AGENTS.md` §5 itself ("`SolidUI.h(UI.X,
{...})` trees... driven by `SolidUI.createSignal()` state") and the real `solid-ui/index.d.ts`,
reactive (accessor-valued) props are **only evaluated when the element is constructed through
`SolidUI.h(component, props, options)`** (confirmed signature, `solid-ui/index.d.ts:174-178`,
*"Values can be static OR reactive (Signals/Accessors)"* — that reactive-prop support is
documented as a property of `h()`, not of the underlying `UI` component classes themselves).

**What the codebase actually does in `scoreboard.ts` and `hud.ts`:** neither file calls
`SolidUI.h()` anywhere. Both build `UIContainer`/`UIText` instances directly via their plain
constructors (`new UIContainer({ ..., childrenParams: [...] })`), and pass function-valued props
like this straight into that plain constructor:

```ts
// hud.ts — buildHud()
{
  type: UIText,
  visible: () => cashFlash.signal(),
  message: () => mod.Message(cashFlashText()),
}
```

`UIContainer.ChildParams<T>` (`ui/components/container/index.d.ts:34`) types this as
`T & { ... }` — a **plain, non-reactive** parameter bag. There's no code path in the raw `UI`
component classes that knows to call a function-valued `visible`/`message` prop and re-run it when
a dependency signal changes; that evaluation logic lives entirely inside `SolidUI.h()`, which
these two files never invoke. The practical effect: these function values are either stored
as-is (and the widget shows something like the function's string representation, or the
constructor errors/ignores an unexpected type — behavior TypeScript's structural typing won't
catch since functions are assignable to `unknown`-typed reactive-hint fields in the raw component
signatures) or, best case, evaluated exactly once at construction time and never again — meaning
even after you fix §2.1's string-key bug, ticket counts and wallet flashes still won't visually
update as game state changes.

`buy-menu.ts` doesn't have this specific problem (none of its props are function-valued — it
rebuilds nothing reactively, which is fine for a menu that's just shown/hidden), but `scoreboard.ts`
and `hud.ts` both need every dynamic child rewritten through `SolidUI.h()`. Concretely, in
`scoreboard.ts`:

```ts
// current — plain constructor call, function props inert
function buildScoreboard(player: mod.Player): UIContainer {
  return new UIContainer({ /* ... */ childrenParams: [...] });
}

// correct — goes through SolidUI.h so reactive props are actually wired up
function buildScoreboard(player: mod.Player): UIContainer {
  return SolidUI.h(UIContainer, {
    position: { x: 0, y: 20 },
    size: { width: 240, height: 140 },
    anchor: mod.UIAnchor.TopCenter,
    receiver: player,
    visible: true,
    uiInputModeWhenVisible: false,
    childrenParams: SCORING_FACTION_IDS.map((faction, index) =>
      SolidUI.h(UIContainer, { /* ... */ childrenParams: factionRowChildren(faction) })
    ),
  });
}
```

Re-read the `solid-ui/README.md` Quick Start example verbatim (as `AGENTS.md` §5 itself already
instructs) before rewriting these two files — the nesting pattern for `h()` calls inside
`childrenParams` needs to match its documented shape exactly, and I have not independently
verified whether `h()`'s children need to be pre-constructed instances or can stay as
`childrenParams`-style descriptors when nested. **This is a "re-read the README line by line, then
rewrite" task, not a guess-and-check one** — get it right in one pass rather than iterating live
against a Portal deploy.

### 3.3 `scoreboard.ts` / `controlzone.ts` / `hotzone.ts` / `chaos-ai.ts` hand-roll tick accumulation instead of using `deferTicks`

`BUILD_GUIDE.md` §5 explicitly told the original implementer to use `deferTicks` for coalescing
scoreboard repaints ("re-read the SolidUI README's own example for exactly this kind of use
case"). The actual code in all four files instead reimplements tick-counting by hand:

```ts
// scoreboard.ts
let scoreboardTicketAccumulator = 0;
Events.OngoingGlobal.subscribe(() => {
  scoreboardTicketAccumulator++;
  if (scoreboardTicketAccumulator >= 20) { /* ... */ }
});
```

**Confirmed against `solid-ui/README.md` and `.d.ts`:** `deferTicks` is not a standalone
function — it's an **options property** (`{ deferTicks: number }`) accepted by `createEffect`,
`createMemo`, `SolidUI.h(..., options)`, and `SolidUI.Index(..., options)`. It coalesces reactive
re-evaluations to a future *logical tick* that the library itself advances once per
`Events.OngoingGlobal` callback internally — you're not meant to track ticks yourself at all once
you're inside the `SolidUI` reactive system. Once §3.2's fix routes these files through
`SolidUI.h()`, the hand-rolled accumulators in `scoreboard.ts` become entirely unnecessary — a
`{ deferTicks: 20 }` option on the reactive binding does the same coalescing for free, correctly,
and it composes with the rest of the reactive graph instead of running as a parallel, disconnected
polling loop.

This doesn't necessarily need to be fixed everywhere (`controlzone.ts`'s 4-second scoring tick and
`chaos-ai.ts`'s respawn interval are gameplay-timing logic, not UI-repaint coalescing — hand-rolled
accumulation there is a reasonable, independent design choice, not a misuse of `deferTicks`).
It's specifically the **UI-repaint-throttling use** in `scoreboard.ts` that should switch to the
library-native mechanism once §3.2 is fixed.

### 3.4 `chaos-ai.ts` — Chaos Squads spawn onto the wrong team, and only once

Two separate, both confirmed, both severe:

**Wrong team.** `config/teams.ts` defines Team4 = Chaos Squads (`isScoring: false`), matching the
design brief's own table. But `chaos-ai.ts`'s only spawn call does this:

```ts
function spawnOneBot(): void {
  if (!chaosSpawner) return;
  mod.SpawnAIFromAISpawner(chaosSpawner, mod.GetTeam(1));  // ← Team1 = Lonestar, not Chaos
}
```

`mod.GetTeam(1)` resolves to Team1/Lonestar per the codebase's own `FACTIONS` table. As written,
every Chaos AI bot spawns as a Lonestar teammate — they'd fight *for* Lonestar, not as a hostile
neutral faction. This should be `mod.GetTeam(4)`. The `(spawner, team: Team)` overload used here
is confirmed real (`index.d.ts`, one of `SpawnAIFromAISpawner`'s seven overloads) — only the
literal team-index argument is wrong.

**Only spawns once, ever.** `topUpBots()`'s loop:

```ts
function topUpBots(): void {
  while (liveBots.size < CHAOS_AI_TOTAL_BOTS) {
    spawnOneBot();
    if (!chaosSpawner) break;
    if (liveBots.size === 0) break;   // ← always true; nothing ever adds to liveBots
  }
}
```

Nowhere in this file does anything call `liveBots.add(...)`. `spawnOneBot()` returns `void` and
discards the AI player handle `SpawnAIFromAISpawner` would need to hand back for tracking.
`liveBots.size` is permanently `0`, so the loop's own `if (liveBots.size === 0) break;` guard fires
immediately after the very first spawn, every time `topUpBots()` runs — meaning across the whole
match, **exactly one Chaos bot ever spawns**, not the 12 (4 squads of 3) the design brief specifies
(`WARDOGS_DESIGN_BRIEF.md` → "Players & Teams"). The `OnPlayerDied` handler that's supposed to
`liveBots.delete(eventPlayer)` on bot death is correspondingly dead code too, since the set it
removes from is always empty.

**Fix requires knowing what `SpawnAIFromAISpawner` actually returns.** The current `.d.ts` types
every overload as returning `void` — if that's accurate, there's no direct handle to add to
`liveBots` from the spawn call itself, and bot tracking needs to come from a different real event
(check `OnPlayerJoinGame`/`OnPlayerDeployed` filtered by `mod.GetTeam(player)` equal to Team4, or
whatever AI-specific spawn-confirmation event exists — re-grep
`event-handler-signatures.d.ts` for `AI`-prefixed events beyond the movement ones already cited in
this file's header comment; `OnAIMoveToSucceeded` et al. take a player argument that might serve as
the "a bot now exists" signal). This is a real gap that needs its own SDK-verification pass before
the fix is written, per `AGENTS.md` §2 — don't guess a `liveBots.add()` call site without
confirming what payload is actually available where.

### 3.5 `towers.ts` — capture never actually records ownership

```ts
Events.OnCapturePointCaptured.subscribe((capturePoint: mod.CapturePoint) => {
  const key = towerKeyForObjId(mod.GetObjId(capturePoint));
  if (!key) return;
  // Use official SDK method or bf6-portal-utils helper to query team from capturePoint if available
  reevaluateDriftLock();   // ← towerOwner[key] is never assigned before this call
});
```

The comment is a leftover TODO — `towerOwner[key]` is never set to the capturing faction, so
`reevaluateDriftLock()`'s check (`towerOwner.A === towerOwner.B && both defined`) can never be
true, and the entire Secondary Objective 1 (locking the HotZone's drift by holding both towers)
is permanently unreachable regardless of in-game play.

**The exact missing call was already flagged as a candidate in `towers.ts`'s own comment ("query
team from capturePoint") and is confirmed real:**

```ts
// index.d.ts:2608 — "Returns the current owner team corresponding to the provided capture point."
export function GetCurrentOwnerTeam(capturePoint: CapturePoint): Team;
```

Fix:

```ts
Events.OnCapturePointCaptured.subscribe((capturePoint: mod.CapturePoint) => {
  const key = towerKeyForObjId(mod.GetObjId(capturePoint));
  if (!key) return;
  const owningTeam = mod.GetCurrentOwnerTeam(capturePoint);
  towerOwner[key] = getFactionId(owningTeam);   // getFactionId already imported in this file
  reevaluateDriftLock();
});
```

### 3.6 `chaos-ai.ts` — `OnPlayerDied` fires for human players too, with no Team4 filter

```ts
Events.OnPlayerDied.subscribe((eventPlayer: mod.Player) => {
  if (liveBots.has(eventPlayer)) {
    liveBots.delete(eventPlayer);
  }
});
```

This subscription fires for **every** player death in the match, human or bot — the
`liveBots.has()` check is the only filter, and per §3.4 that Set is always empty anyway so this is
currently inert. Once §3.4's fix makes `liveBots` populate correctly, this handler is *correct as
written* (the `.has()` check already scopes it properly), but it's worth explicitly filtering by
`mod.GetTeam(eventPlayer)` equal to Team4 as a second, defense-in-depth check once the fix lands,
given how easy it was for the empty-Set bug to hide a filtering gap here for this long. This is
also exactly the kind of place `bf6-portal-utils/mod-extensions`'s `isDeathType`/team-comparison
helpers (§1.4) are useful — worth using them here rather than a second hand-rolled comparison.

### 3.7 `economy.ts` — `BASE_PRICES` is a dead, empty stub

```ts
export const BASE_PRICES: Readonly<Record<string, number>> = {
  // e.g. AK205_Suppressor: 350,
} as const;
```

`buy-menu.ts` reads `BASE_PRICES[item.id] ?? item.basePrice`, so this currently always falls
through to each `ShopItem`'s own `basePrice` field and functions correctly — but it means the
`economy.ts` "single source of truth for price tables" the design brief and `AGENTS.md` describe
doesn't actually exist yet; prices currently live scattered inline in `buy-menu.ts`'s
`SHOP_CATALOG` array instead. Not a bug, but flagged as scope debt: either populate `BASE_PRICES`
and make `buy-menu.ts`'s catalog reference it (matching the documented architecture), or update the
docs to reflect that per-item pricing lives with the item definition instead. Pick one; right now
the code and the docs disagree about where prices are supposed to live.

### 3.8 `salvage.ts` — stray copy-paste artifact in a doc comment

```ts
/**
 * salvage.ts — Salvage Pack drop-on-undeploy.
[cite: 10] */
```

Line 27 has a leftover `[cite: 10]` fragment — looks like an artifact from a previous LLM-assisted
edit pass that didn't get cleaned up. Harmless (it's inside a comment) but worth a pass across the
whole `src/` tree grepping for `[cite:` to catch any other instances before they confuse a future
reader.

### 3.9 `BUILD_GUIDE.md` status table is stale in multiple places

Cross-checking `BUILD_GUIDE.md`'s ✅/🚧/⬜ status legend against the actual repo state on
`feat/mod-impl`:

| File | `BUILD_GUIDE.md` says | Actual repo state |
|---|---|---|
| `player/wallet.ts` | 🚧 started (depends on player-state.ts) | Fully implemented, correct, and already consumed by `fob.ts`/`buy-menu.ts` |
| `player/progression.ts` | 🚧 started | Present and exports `onRankUp` (consumed correctly by `hud.ts`) — appears complete |
| `game/mode/fob.ts` | "Still missing... the material-cost deduction" | Already implemented via `spendMaterials()` gate — this note is outdated |
| `game/mode/controlzone.ts` | ⬜ started | Fully implemented |
| `game/mode/hotzone.ts` | ⬜ not started | Implemented (though see §3.1's bug) |
| `game/mode/towers.ts` | ⬜ not started | Implemented (though see §3.5's bug) |
| `game/mode/salvage.ts` | ⬜ not started | Implemented and correct |
| `game/mode/chaos-ai.ts` | ⬜ not started | Implemented (though see §3.4/§3.6's bugs) |
| `game/mode/win-condition.ts` | ⬜ started | Fully implemented and correct |
| `ui/scoreboard.ts` | ⬜ not started | Implemented (though see §3.2/§3.3's bugs) |
| `ui/hud.ts` | ⬜ not started | Implemented (though see §3.2's bug) |
| `ui/buy-menu.ts` | ⬜ not started | Implemented (though see §2.1/§2.2's bugs) |
| `ui/buy-validator.ts` | ⬜ not started | Implemented and correct |
| `.github/workflows/ci.yml` | ⬜ not started | *(not checked in this audit — verify separately)* |

The repo is meaningfully further along than `BUILD_GUIDE.md` currently indicates — every file it
lists as not-started is actually present. This matters because if this doc drives task
prioritization or gets fed to another agent as ground truth, it will cause redundant "build this
from scratch" work on files that already exist and mostly work, while the doc has near-zero detail
on the *actual* remaining gaps (the bugs in this report). **Recommend a full rewrite of the status
table against this report** rather than a line-by-line patch — see §5.1.

---

## 4. Prioritized backlog

Scored per the standard tech-debt framework: **Priority = (Impact + Risk) × (6 − Effort)**, each
1–5. Higher score = do first.

| # | Item | Impact | Risk | Effort | Priority | Section |
|---|---|---|---|---|---|---|
| 1 | Enable objectives/AreaTriggers at match start (`EnableGameModeObjective`, `SetObjectiveUIEnabled`, `EnableAreaTrigger`) | 5 | 4 | 1 | 45 | §2.3 |
| 2 | Route every `mod.Message()` call through `mod.stringkeys.*`; wire `strings.json` keys for all UI text | 5 | 4 | 2 | 36 | §2.1 |
| 3 | Fix Chaos AI spawning wrong team (`GetTeam(1)` → `GetTeam(4)`) | 5 | 5 | 1 | 50 | §3.4 |
| 4 | Fix tower-capture ownership tracking (`GetCurrentOwnerTeam` call) | 4 | 3 | 1 | 35 | §3.5 |
| 5 | Rewrite `scoreboard.ts`/`hud.ts` to actually use `SolidUI.h()` for reactive props | 5 | 4 | 3 | 27 | §3.2 |
| 6 | Fix Chaos AI bot-count tracking (only 1 of 12 ever spawns) | 4 | 3 | 3 | 21 | §3.4 |
| 7 | Resolve `hotzone.ts`'s `CapturePoint`-as-`SpatialObject` type violation | 4 | 4 | 3 | 24 | §3.1 |
| 8 | Add re-entry guard to buy-menu `OnPlayerInteract` handler | 3 | 3 | 1 | 30 | §2.2 |
| 9 | Reconcile `AGENTS.md`/`README.md` with actual toolchain (pnpm, `ts-bf6-portal`) | 3 | 2 | 2 | 20 | §1.1–1.3 |
| 10 | Wire `ICON_CONTROLZONE`/`ICON_HOTZONE` world icons, incl. drift-following for HotZone | 3 | 2 | 2 | 20 | §2.3 |
| 11 | Import `player-undeploy-fixer` for defense-in-depth on the ragdoll-limbo bug | 3 | 2 | 1 | 25 | §1.4 |
| 12 | Switch UI-repaint throttling to `deferTicks` options once #5 lands | 2 | 1 | 2 | 12 | §3.3 |
| 13 | Rewrite `BUILD_GUIDE.md` status table against this report | 2 | 1 | 2 | 12 | §3.9 |
| 14 | Populate `economy.ts`'s `BASE_PRICES` or update docs to match actual architecture | 2 | 1 | 2 | 12 | §3.7 |
| 15 | Clean up stray `[cite: 10]` artifact and sweep for others | 1 | 1 | 1 | 10 | §3.8 |
| 16 | Add Team4 filter defense-in-depth to `chaos-ai.ts`'s death handler | 1 | 1 | 1 | 10 | §3.6 |

**Suggested execution order for a single work session:** #1 → #3 → #4 (three independent,
high-value, low-effort fixes that don't touch each other) → #2 (bigger but mechanical, unblocks
real playtesting of text) → #5 (the one that needs the README re-read, do it once, carefully) → #6
→ #7 (needs a design decision first, per §3.1) → everything else as time allows.

---

## 5. Process recommendations

### 5.1 Treat `BUILD_GUIDE.md`'s status column as generated, not hand-maintained

Given how quickly it drifted from reality (§3.9), consider replacing the manual ✅/🚧/⬜ column
with a short script that greps `src/` for each listed file's existence and a rough "has
`Events.*.subscribe` calls" check, run as part of `pnpm strings` or a new `pnpm status` script.
Doesn't need to be sophisticated — even a coarse "file exists and is non-trivial" signal beats a
status table that's been stale enough to say seven implemented files are "not started."

### 5.2 Make the strings-bundler candidate-detection a required pre-deploy gate

§2.1 found that `ts-bf6-strings`'s existing candidate-detection output would have caught nearly
every instance of this bug automatically, for free, using tooling already in `package.json`. Add
`pnpm strings` (or a CI step wrapping it) as a blocking check — fail the build if the candidate
list is non-empty, or at minimum treat a non-empty candidate list as a required manual review
before `pnpm deploy-all`. This is the single highest-leverage process change available, since it
converts an entire class of bug (every future raw-string-in-`Message()` mistake) from a
silent-until-playtest failure into a build-time one.

### 5.3 `AGENTS.md` §2's "grep the real `.d.ts`" discipline is working — keep it, but close the loop

The parts of this codebase that most rigorously followed `AGENTS.md` §2 (cite the exact `.d.ts`
line, don't invent symbols) are also the parts with the fewest bugs — `wallet.ts`,
`win-condition.ts`, `player-state.ts`, `salvage.ts` are all clean. The bugs found in this audit
cluster specifically in files whose own header comments **flag their own uncertainty**
(`hotzone.ts`: *"this codebase has not independently re-confirmed [MoveObjectOverTime's] exact
parameter order"*; `salvage.ts`: *"has not been independently re-confirmed"* on the AreaTrigger
prefab name; `chaos-ai.ts`: *"confirm this specific overload compiles... before shipping"*) —
i.e., the discipline correctly identified what needed verification, but the verification step
itself never happened before the code shipped. **Recommend**: treat any file with a
"NOTE (AGENTS.md §2): ... has not been independently re-confirmed" comment as inherently
`🚧`/blocking status, not `✅`, until that specific verification is actually done and the comment
is removed — right now those comments read as already-resolved documentation when they're
actually open TODOs.

### 5.4 Consider a smoke-test harness for the reactive UI layer specifically

§3.2's bug (raw constructors instead of `SolidUI.h()`) is exactly the kind of mistake that's
invisible in a TypeScript compile (both shapes type-check, since `ChildParams<T>` doesn't
distinguish "was this value constructed via `h()` or not") and only surfaces as "the UI doesn't
update" during a live playtest. Since `buy-validator.ts` is already deliberately kept
Portal-runtime-independent and unit-testable (per its own header comment), the same pattern could
extend to a lightweight check that every `ui/*.ts` file's top-level element-construction calls go
through `SolidUI.h` rather than a raw `new UIContainer(...)`/`new UIText(...)` — even a simple
lint rule or grep-based CI check ("no `new UI[A-Z]\w+\(` outside `solid-ui`-adjacent files") would
have caught §3.2 before it shipped.

---

## Appendix: SDK symbols verified during this audit

For traceability — every symbol below was read directly from the installed package source, not
recalled from training data.

**Confirmed real and used correctly:**
`mod.Message` (all 4 overloads, `index.d.ts:2820-2881`) · `mod.stringkeys` / `mod.strings`
(`index.d.ts:39-48`) · `Events.OnPlayerEnterAreaTrigger`/`OnPlayerExitAreaTrigger`/`OngoingGlobal`/
`OnGameModeStarted`/`OnPlayerJoinGame`/`OnPlayerLeaveGame`/`OnPlayerUndeploy`/`OnPlayerDied`
(`event-handler-signatures.d.ts`) · `mod.SetGameModeScore`/`SetGameModeInitialScore`/
`SetGameModeCriteria`/`SetGameModeTargetScore`/`GetTargetScore` (`index.d.ts:810-816, 2276`) ·
`mod.EndGameMode` (both overloads, `index.d.ts:783/786`) · `mod.SpawnObject`/`UnspawnObject`
(`index.d.ts:2320/2353`) · `mod.SpawnLoot` (all 4 overloads, `index.d.ts:897-906`) ·
`mod.RuntimeSpawn_Common.AreaTrigger` (`runtime-spawn-enums/common.d.ts:9`) ·
`mod.Gadgets.Misc_Supply_Pouch` (`enums.d.ts:140`) · `PortalGadget.onFireStart`/`getLaserTarget`
(`bf6-portal-utils/portal-gadget/index.d.ts`) · `UI.Button`'s `onClickDown`/`onClickUp`/
`onFocusIn`/`onFocusOut` (`bf6-portal-utils/ui/index.d.ts`) · `SolidUI.createSignal`/`createEffect`
(`solid-ui/index.d.ts`) · `mod.GetTeam` (both overloads, `index.d.ts:2702/2710`) ·
`mod.SpawnAIFromAISpawner` (all 7 overloads).

**Confirmed real but not yet used — recommended additions:**
`mod.EnableGameModeObjective` / `SetObjectiveUIEnabled` / `SetAllObjectivesUIEnabled`
(`index.d.ts:1006, 1358, 1354`) · `mod.EnableAreaTrigger` (`index.d.ts:857`) ·
`mod.GetCurrentOwnerTeam` (`index.d.ts:2608`) · `mod.GetWorldIcon`/`SetWorldIconPosition`/
`SetWorldIconText` (`index.d.ts:2818, 1410, 1413`) · `bf6-portal-utils/player-undeploy-fixer` ·
`bf6-portal-utils/mod-extensions`.

**Confirmed NOT to exist — do not use:**
`PolygonVolume` (no such type anywhere in `bf6-portal-mod-types`) · `@bf6mods/sdk` (not a
dependency of this repo) · `AddGameModeScore`/`GetGameModeScore` (no getter/adder exists, only
setters) · `mod.GetPlayerCurrency`/`AddPlayerCurrency` (no native currency API, confirmed by full
grep) · `@bf6mods/cli` as this repo's actual bundler (repo uses `ts-bf6-portal` instead — see §1.2).

**Flagged as unverified — needs a follow-up SDK check before shipping more code on top:**
Whether `mod.CapturePoint` is legally movable via `MoveObjectOverTime` despite the type signature
excluding it (§3.1) · the actual return type/tracking mechanism for `SpawnAIFromAISpawner` needed
to fix Chaos AI bot-count tracking (§3.4).
