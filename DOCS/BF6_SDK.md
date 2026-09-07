# BF6 Portal SDK — WARDOGS Reference

This document is the canonical SDK usage guide for the WARDOGS mod.
All agents and contributors must follow these patterns exactly.

---

## Package overview

| Package                  | Role                                               | Import style          |
|--------------------------|----------------------------------------------------|-----------------------|
| `bf6-portal-mod-types`   | Global `mod` namespace types                       | **None** (global)     |
| `bf6-portal-utils`       | Utilities: Events, UI, Timers, Vectors, etc.       | Subpath imports only  |
| `ts-bf6-portal`          | Bundler — do not import, use as build CLI          | —                     |

---

## `bf6-portal-mod-types` — global `mod`

Wired via `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "lib": ["ES2017", "DOM"],
    "types": ["bf6-portal-mod-types"]
  },
  "include": ["src"]
}
```

- `mod` is available as a **global** in every source file.
- **Never** write `import ... from "bf6-portal-mod-types"`.
- Use `mod.Player`, `mod.UIAnchor`, `mod.print()`, etc. directly.

---

## `bf6-portal-utils` — subpath imports

Always import from a specific subpath. The package root is not a valid entrypoint.

### Events

```ts
import { Events } from "bf6-portal-utils/events";

// All Portal lifecycle hooks go through Events
const unsub = Events.OnPlayerDeployed.subscribe((player: mod.Player) => {
  // ...
});

Events.OnGameModeEnded.subscribe(() => {
  unsub(); // always clean up
});
```

**Available event hooks (non-exhaustive):**
- `Events.OnPlayerDeployed`
- `Events.OnPlayerKilled`
- `Events.OnGameModeStarted`
- `Events.OnGameModeEnded`
- `Events.OnPlayerUIButtonEvent`
- `Events.OnObjectDestroyed`

### UI

```ts
import { UI }           from "bf6-portal-utils/ui";
import { UIContainer }  from "bf6-portal-utils/ui/components/container";
import { UITextButton } from "bf6-portal-utils/ui/components/text-button";

Events.OnPlayerDeployed.subscribe((player: mod.Player) => {
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
        onClickUp: (p: mod.Player) => mod.print(`${p.name} clicked`),
      } as UIContainer.ChildParams<UITextButton.Params>,
    ],
  });
});
```

**`UI.COLORS` reference (common values):**
- `UI.COLORS.WHITE`
- `UI.COLORS.BLACK`
- `UI.COLORS.GREY_25`
- `UI.COLORS.GREY_50`
- `UI.COLORS.GREY_75`

### Timers

```ts
import { Timers } from "bf6-portal-utils/timers";

const timer = Timers.addTimer({
  duration: 30,
  onTick: (remaining) => mod.print(`Time left: ${remaining}`),
  onComplete: () => mod.print("Timer done"),
});

// Cancel if needed
timer.cancel();
```

### Vectors

```ts
import { Vectors } from "bf6-portal-utils/vectors";

// Convert a { x, y, z } object to the opaque mod.Vector type
const vec = Vectors.toVector({ x: 0, y: 10, z: 0 });

// Read components from mod.Vector
const x = mod.XComponentOf(vec);
const y = mod.YComponentOf(vec);
const z = mod.ZComponentOf(vec);
```

> **Note:** `mod.Vector` is an opaque type — never access `.x`, `.y`, `.z` directly.
> Always use `mod.XComponentOf()`, `mod.YComponentOf()`, `mod.ZComponentOf()`.

### Portal Gadget

```ts
import { PortalGadget } from "bf6-portal-utils/portal-gadget";
import { Events }       from "bf6-portal-utils/events";

PortalGadget.setLogging((text) => mod.print(text), PortalGadget.LogLevel.Warning);

const unsubStart = PortalGadget.onFireStart(async (player, isZooming, getTarget) => {
  const target = await getTarget();
  if (!target) return;
  mod.print(`Fire at ${mod.XComponentOf(target)}, ${mod.YComponentOf(target)}`);
});

const unsubStop = PortalGadget.onFireStop(async (player, isZooming, getTarget) => {
  const target = await getTarget();
  if (!target) return;
});

Events.OnGameModeEnded.subscribe(() => {
  unsubStart();
  unsubStop();
});
```

---

## Known API name corrections

The following names differ from intuitive guesses. Always use the right column.

| Wrong                              | Correct                                   |
|------------------------------------|-------------------------------------------|
| `mod.EnableSFX()`                  | `mod.EnableVFX()`                         |
| `mod.SetPlayerSpeedMultiplier()`   | `mod.SetPlayerMovementSpeedMultiplier()`  |
| `mod.GetPlayerState()`             | `mod.GetSoldierState()`                   |
| `Vectors.toModVector()`            | `Vectors.toVector()`                      |
| `SolidUI.render()`                 | Use `UIContainer` constructor             |
| `SolidUI.For()` / `SolidUI.Index()`| Use `UIContainer` `childrenParams`        |
| `createStore` setter direct call   | Must use producer function pattern        |

---

## Undocumented runtime functions

Some `mod.*` functions exist at runtime but are absent from `bf6-portal-mod-types`.
Declare them in `src/types/mod-extended.d.ts`:

```ts
// src/types/mod-extended.d.ts
declare namespace mod {
  function ParseUI(player: mod.Player, ui: string): void;
  function SpawnWorldIcon(params: SpawnWorldIconParams): mod.WorldIcon;
  function DestroyWorldIcon(icon: mod.WorldIcon): void;
  function GetPlayerName(player: mod.Player): string;
  function SetObjectPosition(obj: mod.Entity, pos: mod.Vector): void;
  function SetMaxHealth(entity: mod.Entity, hp: number): void;
  function SetHealth(entity: mod.Entity, hp: number): void;
  function GetPlayerYaw(player: mod.Player): number;
  function GetInventoryEquipment(player: mod.Player, slot: number): mod.Entity | null;
  function SetCapturePointPosition(cp: mod.Entity, pos: mod.Vector): void;
  function VehicleStateBool(vehicle: mod.Entity, state: string, value: boolean): void;
}
```

Add new entries here as they are discovered. Never add them to the package itself.

---

## Enum verification

Before using any enum member, verify it in:
```
node_modules/bf6-portal-mod-types/index.d.ts
```

Known gotchas — enum members that differ from what you might expect:
- `Gadgets.*` — member names are SDK-specific
- `Weapons.*` — member names are SDK-specific
- `WeaponAttachments.*`
- `SpawnModes.*`
- `WorldIconImages.*`
- `RestrictedInputs.*`
- `RuntimeSpawn_Common.*`

When in doubt: look it up, don't guess.

---

## Build commands

```bash
pnpm bundle    # compile + bundle (ts-bf6-portal)
pnpm validate  # tsc --noEmit type check only
```

---

*Last updated: 2026-09-06*
