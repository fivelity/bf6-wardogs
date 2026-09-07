# AGENTS.md — WARDOGS · BF6 Portal Mod

> **Read this file first.** Every LLM agent, agentic tool, or AI assistant working on this
> repository must follow these rules before writing or modifying any code.

---

## 1. Project identity

| Field        | Value                                         |
|--------------|-----------------------------------------------|
| Mod name     | **WARDOGS**                                   |
| Game         | Battlefield 6 – Portal                        |
| Repository   | `fivelity/bf6-wardogs`                        |
| Active branch| `feat/mod-impl`                               |
| Language     | TypeScript (strict)                           |
| Bundler      | `ts-bf6-portal`                               |
| Package mgr  | pnpm                                          |

---

## 2. Package roles — read carefully

### `bf6-portal-mod-types` → **global `mod` namespace**

- Provides the global `mod` object and all SDK types (Player, Weapon, Vehicle, UIAnchor, etc.).
- Wired via `tsconfig.json` `"types": ["bf6-portal-mod-types"]` — **no import statement needed or allowed**.
- Never write `import ... from "bf6-portal-mod-types"`.
- Just use `mod.SomeType` / `mod.someFunction()` directly anywhere in source.

```jsonc
// tsconfig.json (canonical — do not deviate)
{
  "compilerOptions": {
    "strict": true,
    "types": ["bf6-portal-mod-types"]
  },
  "include": ["src"]
}
```

### `bf6-portal-utils` → **modular subpath imports**

- Split into named submodules. Always import from the specific subpath, never from the
  package root.

| Subpath                                      | Exports                              |
|----------------------------------------------|--------------------------------------|
| `bf6-portal-utils/events`                    | `Events`                             |
| `bf6-portal-utils/ui`                        | `UI`, `UI.COLORS`                    |
| `bf6-portal-utils/ui/components/container`   | `UIContainer`                        |
| `bf6-portal-utils/ui/components/text-button` | `UITextButton`                       |
| `bf6-portal-utils/portal-gadget`             | `PortalGadget`                       |
| `bf6-portal-utils/timers`                    | `Timers`                             |
| `bf6-portal-utils/vectors`                   | `Vectors`                            |

**Never** import from the bare `"bf6-portal-utils"` root — it is not a valid entrypoint.

---

## 3. Events — the only correct pattern

`bf6-portal-utils/events` **owns** all Portal lifecycle hooks. Do **not** implement or
export raw Portal event handlers yourself.

```ts
// ✅ CORRECT
import { Events } from "bf6-portal-utils/events";

Events.OnPlayerDeployed.subscribe((player: mod.Player) => {
  // your logic
});

Events.OnGameModeEnded.subscribe(() => {
  // cleanup
});
```

```ts
// ❌ WRONG — never do this
export function OnPlayerDeployed(player: mod.Player) { ... }
```

Always store the returned unsubscribe handle when you need to clean up:

```ts
const unsub = Events.OnPlayerDeployed.subscribe(handler);
Events.OnGameModeEnded.subscribe(() => unsub());
```

---

## 4. UI — correct API

```ts
import { UI } from "bf6-portal-utils/ui";
import { UIContainer } from "bf6-portal-utils/ui/components/container";
import { UITextButton } from "bf6-portal-utils/ui/components/text-button";

const menu = new UIContainer({
  position: { x: 0, y: 0 },
  size: { width: 200, height: 300 },
  anchor: mod.UIAnchor.Center,
  receiver: player,
  visible: true,
  uiInputModeWhenVisible: true,
  childrenParams: [
    {
      type: UITextButton,
      position: { x: 0, y: 0 },
      size: { width: 200, height: 50 },
      anchor: mod.UIAnchor.TopCenter,
      bgColor: UI.COLORS.GREY_25,
      baseColor: UI.COLORS.BLACK,
      textColor: UI.COLORS.WHITE,
      textSize: 36,
      message: mod.Message(mod.stringkeys.ui.buttons.option1),
      onClickUp: (p: mod.Player) => { mod.print(`${p.name} clicked`); },
    } as UIContainer.ChildParams<UITextButton.Params>,
  ],
});
```

- **Do not** use `SolidUI.render()` — the correct UI API is via `UIContainer` / `UITextButton`
  and other components from `bf6-portal-utils/ui/components/*`.
- Color values come from `UI.COLORS.*`, not raw hex strings in most cases.

---

## 5. Portal Gadget

```ts
import { PortalGadget } from "bf6-portal-utils/portal-gadget";
import { Events } from "bf6-portal-utils/events";

PortalGadget.setLogging((text) => mod.print(text), PortalGadget.LogLevel.Warning);

const unsubFireStart = PortalGadget.onFireStart(async (player, isZooming, getTarget) => {
  const target = await getTarget();
  if (!target) return;
  mod.print(`Fire start at ${mod.XComponentOf(target)}, ${mod.YComponentOf(target)}, ${mod.ZComponentOf(target)}`);
});

Events.OnGameModeEnded.subscribe(() => {
  unsubFireStart();
});
```

---

## 6. TypeScript rules

- **`strict: true`** — no exceptions, no `any`.
- All mod runtime functions that are undocumented must be declared in
  `src/types/mod-extended.d.ts` using declaration merging on the `mod` namespace.
- `tsconfig.json` lib target must support `Object.entries` / `Object.values`
  (use `"lib": ["ES2017", "DOM"]` or later, not `"ES2015"`).
- No barrel imports from `bf6-portal-utils` root.
- Enum member names must match the SDK exactly — always verify against
  `node_modules/bf6-portal-mod-types/index.d.ts` before using an enum value.

---

## 7. Source structure

```
src/
  index.ts          ← mod entry point; wires Events subscriptions only
  config/           ← constants, tuning values, faction/weapon tables
  player/           ← JsPlayer class, player state management
  game/             ← round logic, win conditions, phase state machine
  ui/               ← all UIContainer/UITextButton components
  modlib/           ← wrappers for undocumented mod.* runtime functions
  types/
    mod-extended.d.ts  ← declaration-merging for undocumented runtime APIs
```

`src/index.ts` must only contain:
1. Import statements
2. `Events.*.subscribe(...)` calls
3. Initialization calls to modules defined elsewhere

No game logic lives in `index.ts`.

---

## 8. Undocumented runtime functions

Declare these in `src/types/mod-extended.d.ts` via `declare namespace mod { }` merging.
Do **not** add them to `bf6-portal-mod-types` directly.

Examples of functions that need declarations:
`ParseUI`, `SpawnWorldIcon`, `DestroyWorldIcon`, `GetPlayerName`,
`SetObjectPosition`, `SetMaxHealth`, `SetHealth`, `GetPlayerYaw`,
`GetInventoryEquipment`, `SetCapturePointPosition`, `VehicleStateBool`.

---

## 9. Build & CI

```bash
pnpm bundle    # compile + bundle via ts-bf6-portal
pnpm validate  # type-check only (tsc --noEmit)
```

CI runs both on every push to `feat/mod-impl` via GitHub Actions.

---

## 10. LLM workflow conventions

- **`brief.md`** (`.llm/brief.md`) is the **design contract** for WARDOGS. It must be
  populated with game rules, win conditions, and mechanic definitions before any game-logic
  code is written. Treat its contents as authoritative.
- **`todo.md`** (`.llm/todo.md`) tracks outstanding work items. Update it after every
  code-generating session.
- **`memory.md`** (`.llm/memory.md`) stores durable cross-session facts. Append, never
  overwrite.
- Do not consolidate `.llm/` and `DOCS/` — they serve different audiences
  (`.llm/` = agent-facing, `DOCS/` = human-facing).
- Raw TypeDoc HTML files in `docs/enums/` are deprecated. Do not read or generate them;
  use the generated `DOCS/ENUMS.md` markdown summary instead.

---

## 11. What NOT to do

| ❌ Don't                                              | ✅ Do instead                                    |
|------------------------------------------------------|--------------------------------------------------|
| `import mod from "bf6-portal-mod-types"`             | Use `mod.*` globally — no import needed          |
| `import { Events } from "bf6-portal-utils"`          | `import { Events } from "bf6-portal-utils/events"` |
| Implement raw Portal event exports yourself           | Subscribe via `Events.*.subscribe()`             |
| Use `SolidUI.render()` or `SolidUI.For()`            | Use `UIContainer` / component classes            |
| Use `SolidUI.Index()` directly                       | Use `UIContainer` child composition              |
| Use `"ES2015"` lib target                            | Use `"ES2017"` or later                          |
| Put game logic in `src/index.ts`                     | Organize into `src/game/`, `src/player/`, etc.   |
| Guess enum member names                              | Verify in `bf6-portal-mod-types/index.d.ts`      |
| Import from `"bf6-portal-utils"` root               | Import from specific subpaths                    |
| Call `mod.EnableSFX()`                               | Call `mod.EnableVFX()`                           |
| Call `mod.SetPlayerSpeedMultiplier()`                | Call `mod.SetPlayerMovementSpeedMultiplier()`    |
| Call `mod.GetPlayerState()`                          | Call `mod.GetSoldierState()`                     |
| Call `mod.Vectors.toModVector()`                     | Call `Vectors.toVector()` from utils             |

---

*Last updated: 2026-09-06*
