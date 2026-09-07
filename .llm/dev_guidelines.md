# WARDOGS — Dev Guidelines

Extended coding standards. Read `AGENTS.md` first; this file adds detail.

---

## Import discipline

### Rule 1 — `mod` is always global

`bf6-portal-mod-types` injects the `mod` namespace globally via `tsconfig.json`.
No import is ever needed or valid.

```ts
// ✅
mod.print("hello");
const p: mod.Player = ...;

// ❌
import { Player } from "bf6-portal-mod-types";
```

### Rule 2 — `bf6-portal-utils` subpath imports only

Every utility lives at a specific subpath. The package root is not a valid entrypoint.

```ts
// ✅
import { Events }       from "bf6-portal-utils/events";
import { UI }           from "bf6-portal-utils/ui";
import { UIContainer }  from "bf6-portal-utils/ui/components/container";
import { UITextButton } from "bf6-portal-utils/ui/components/text-button";
import { PortalGadget } from "bf6-portal-utils/portal-gadget";
import { Timers }       from "bf6-portal-utils/timers";
import { Vectors }      from "bf6-portal-utils/vectors";

// ❌
import { Events, UI, Timers } from "bf6-portal-utils";
```

---

## Events — ownership model

The `Events` module **owns** all Portal lifecycle hooks. No source file may implement
or export a raw Portal event handler.

```ts
// ✅ — subscribe and store the cleanup handle
const unsub = Events.OnPlayerDeployed.subscribe((player: mod.Player) => {
  initPlayerUI(player);
});
Events.OnGameModeEnded.subscribe(() => unsub());

// ❌ — never export these
export function OnPlayerDeployed(...) {}
export function OnGameModeEnded(...) {}
```

---

## `mod.Vector` — opaque type

`mod.Vector` cannot be destructured or have its components read via property access.
Always use the component extractor functions.

```ts
// ✅
const x = mod.XComponentOf(vec);
const y = mod.YComponentOf(vec);
const z = mod.ZComponentOf(vec);

// ✅ — create from plain object via Vectors util
import { Vectors } from "bf6-portal-utils/vectors";
const vec = Vectors.toVector({ x: 0, y: 5, z: 0 });

// ❌
vec.x; vec.y; vec.z;
Vectors.toModVector({ x: 0, y: 5, z: 0 }); // wrong name
```

---

## `createStore` setter pattern

Setters must use producer functions, not direct assignment:

```ts
// ✅
const [state, setState] = createStore({ health: 100 });
setState("health", (prev) => prev - 10);

// ❌
setState({ health: 90 });
setState("health", 90);
```

---

## `mod-extended.d.ts` — declaration merging

For any `mod.*` function not in `bf6-portal-mod-types/index.d.ts`, declare it here:

```ts
// src/types/mod-extended.d.ts
declare namespace mod {
  function ParseUI(player: mod.Player, template: string): void;
  function SpawnWorldIcon(params: {
    player: mod.Player;
    image: mod.WorldIconImages;
    position: mod.Vector;
    visible: boolean;
  }): mod.WorldIcon;
  function DestroyWorldIcon(icon: mod.WorldIcon): void;
  function GetPlayerName(player: mod.Player): string;
  function SetObjectPosition(entity: mod.Entity, pos: mod.Vector): void;
  function SetMaxHealth(entity: mod.Entity, hp: number): void;
  function SetHealth(entity: mod.Entity, hp: number): void;
  function GetPlayerYaw(player: mod.Player): number;
  function GetInventoryEquipment(player: mod.Player, slot: number): mod.Entity | null;
  function SetCapturePointPosition(cp: mod.Entity, pos: mod.Vector): void;
  function VehicleStateBool(vehicle: mod.Entity, state: string, value: boolean): void;
}
```

Add new entries as undocumented functions are discovered during development.

---

## `tsconfig.json` — canonical settings

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "lib": ["ES2017", "DOM"],
    "types": ["bf6-portal-mod-types"],
    "moduleResolution": "bundler",
    "target": "ES2017"
  },
  "include": ["src"]
}
```

`"ES2015"` is forbidden — it lacks `Object.entries` and `Object.values`.

---

## Source file responsibilities

| File / dir        | Owns                                                      |
|-------------------|-----------------------------------------------------------|
| `src/index.ts`    | Imports + `Events.*.subscribe()` calls + module init only |
| `src/config/`     | Constants, tuning values, faction/class/weapon tables     |
| `src/player/`     | `JsPlayer` class, per-player state, death/respawn logic   |
| `src/game/`       | Round FSM, objective logic, win conditions, scoring       |
| `src/ui/`         | All `UIContainer` trees, menus, HUD components            |
| `src/modlib/`     | Typed wrappers for undocumented `mod.*` runtime APIs      |
| `src/types/`      | `mod-extended.d.ts` only                                  |

---

## Enum usage

Always verify enum member names in `node_modules/bf6-portal-mod-types/index.d.ts`
before using them. Commonly wrong:

- `Gadgets.*`
- `Weapons.*`
- `WeaponAttachments.*`
- `SpawnModes.*`
- `WorldIconImages.*`
- `RestrictedInputs.*`
- `RuntimeSpawn_Common.*`

---

## Naming conventions

- Files: `kebab-case.ts`
- Classes: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Types/interfaces: `PascalCase`

---

*Last updated: 2026-09-06*
