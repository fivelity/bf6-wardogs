Master Workspace Directory Layout (`/src`)

The codebase is organized using a **Feature-Slice Architecture (Option 1)**. This structure groups files based on what the player experiences on the battlefield, placing related UI layouts, mathematical handlers, and event listeners within a single, self-contained directory. This avoids the over-nesting common in traditional Domain-Driven Design (DDD):

```
PortalSDK/GodotProject/mods/wardogs/
├── package.json                       # Dependency declarations and compilation scripts
├── tsconfig.json                      # Global type references (bf6-portal-mod-types)
├── ts-bf6-portal.config.json          # Experience configurations, team sizes, and spatial map
├── wardogs.strings.json               # Localization database for 3D world overlays
├── buy-menu.strings.json              # Localization database for shop overlays
└── src/
    ├── index.ts                       # Main bootstrapper; hooks native event lifecycles
    │
    ├── core/                          # Global engine staging and event systems
    │   ├── config.ts                  # Hardcoded game thresholds and initial values
    │   └── events.ts                  # Centralized event subscription broker
    │
    ├── features/                      # Autonomous vertical gameplay feature slices
    │   ├── hotzone/                   # Dynamic zone movement algorithms
    │   │   ├── zone-math.ts           # Inward polygon buffering and raycasting checks
    │   │   └── zone-state.ts          # Main scoring loop & ticket bleed
    │   │
    │   ├── shop/                      # Buy stations, weapons config, and wallets
    │   │   ├── buy-menu.ts            # Screen-space Buy Menu UI using ParseUI
    │   │   ├── buy-validator.ts       # Surcharge calculations & co-op FOB funding
    │   │   └── weapon-packages.ts     # Programmatic Gunsmith compilations & attachments
    │   │
    │   ├── construction/              # Base building and fortification sockets
    │   │   ├── excavation.ts          # Sledgehammer hit detection & Y-axis vertical lift
    │   │   ├── pda-scanner.ts         # Portal Gadget PDA target raycasting
    │   │   └── fob-stockpile.ts       # Supply cargo unloading and materials management
    │   │
    │   ├── scavenger/                 # High-stakes drop-on-death systems
    │   │   └── scavenger-drop.ts      # OnPlayerUndeploy backpack spawn and loot interaction
    │   │
    │   ├── scoreboard/                # Global UI metrics
    │   │   └── score-updater.ts       # 3-Faction reactive SolidUI scoreboard overlay
    │   │
    │   ├── ai/                        # Environmental AI disruptor logic
    │   │   └── chaos-ai.ts            # Programmatic Team 4 spawning and swarming logic
    │   │
    │   └── progression/               # Persistent wallets and character stats
    │       └── profile.ts             # In-memory PlayerProfile dictionary
    │
    └── shared/                        # Shared utility modules
        └── utils.ts                   # Fast conversion vectors and coordinate truncation
```

---

Exhaustive Core File Inventory

To complete the **WARDOGS** custom experience, you must populate **16 script files** within the `/src` folder, in addition to the master configuration and localization JSON files at your root directory:

1. Configuration & Orchestration Files
- **src/index.ts** (Main Entry Bootstrapper)
  
  - _Responsibility_: Imports all feature-slice managers, registers engine lifecycle events, and establishes the 60-second staging hold at match startup.- _SDK Hooks_: Native hooks for `OnGameModeStarted`, `OnPlayerJoinGameHook`, `OnPlayerLeaveGameHook`, and `OnPlayerDeployed`.- **src/core/config.ts** (Global Variables & Balancing Values)
  - _Responsibility_: Maintains central constants, such as starting balance ($10,000), maximum lobby size (36 humans, 12 bots), victory thresholds (100 tickets), and target score bypass limits (forcing target score to `1` to bypass native ending bugs).- **src/core/events.ts** (Centralized Event Broker)
  - _Responsibility_: Uses the `Events` module from `bf6-portal-utils` to multiplex single-firing Frostbite engine events across several modular subscribers.
2. HotZone & Team Scoring Files
- **src/features/hotzone/zone-math.ts** (Buffer Geometry Core)
  
  - _Responsibility_: Contains the Ray-Casting Point-in-Polygon (PIP) intersection calculations and the winding-order corner-bisector normal math to shrink the outer `AreaTrigger_ControlZone_1_1` inward by exactly 60 meters.- **src/features/hotzone/zone-state.ts** (Tick Point Allocation Engine)
  - _Responsibility_: Caches the buffered inner ControlZone at startup. Runs a 1Hz random walk drift calculation, moves the physical flag `CapturePoint_HotZone_1_1`, awards cash/XP ticks to active zone players, and ticks scores on a 4-second majority-rule cycle.
3. Progression, Cash, & Weapon Customization Files
- **src/features/progression/profile.ts** (In-Memory Wallet Ledger)
  
  - _Responsibility_: Operates the transactional dictionary map `mercenaryRegistry`. Restricts starting wallets to a single $10,000 issue upon initial connection and prevents players from suicide respawning to reset or farm cash reserves.- **src/features/shop/weapon-packages.ts** (Gunsmith Dynamic Compilation)
  - _Responsibility_: Houses attachments definition arrays and compiles custom weapon configurations (e.g., Elite M4A1 with suppressors, scopes, fast magazines, and tungsten core AP ammunition) using native package vectors.- **src/features/shop/buy-menu.ts** (ParseUI Screen Overlay)
  - _Responsibility_: Renders the fullscreen and tabbed buy station overlays (Weapon Gunsmith, Class Specialties, Vehicle Spawns, and FOB Co-op Deposits) using hierarchical `ParseUI` arrays.- **src/features/shop/buy-validator.ts** (Economic Transaction Guard)
  - _Responsibility_: Validates client transaction requests, processes pro-rated level-deficit markups up to 200% (2.0 multiplier) for locked gear, and manages pooled funds for expensive base installations.
4. Construction & Logistics Files
- **src/features/construction/excavation.ts** (Melee Mechanical Lift)
  
  - _Responsibility_: Detects when Support players swing the Sledgehammer (`mod.Weapons.Melee_Sledgehammer`) inside active blueprints. Subtracts local FOB materials and calls `mod.MoveObjectOverTime` to slide hidden pre-placed Godot scene entities vertically through the terrain. Handles spawning Stationary AA weapons pit triggers.- **src/features/construction/pda-scanner.ts** (Portal Gadget Target Scanner)
  - _Responsibility_: Initiates a 5Hz raycast target scanner when zooming with the Portal Gadget (`mod.Gadgets.Misc_PortalGadget`). Spawns ground particle spark indicators and world locator beacons over unbuilt Godot sockets.- **src/features/construction/fob-stockpile.ts** (FOB Supply Chain Logistics)
  - _Responsibility_: Manages material stockpile reserves (capped at 2,000 units) for captured outposts. Intercepts Logistics Cargo Pack deliveries, granting transporters **$800 Cash** and **+300 Driver/Pilot XP**.
5. Death Recovery, Scoreboard, & AI Files
- **src/features/scavenger/scavenger-drop.ts** (Salvage Pack Collector)
  
  - _Responsibility_: Spawns physical supplies backpacks (`SuppliesPack_01`) at a player's coordinates on absolute undeploy events (resolving ragdoll limbo bugs). Binds a native `InteractPoint` so players can easily salvage ammunition, cash, and XP using their native interaction buttons.- **src/features/scoreboard/score-updater.ts** (Reactive 3-Faction Overlay)
  - _Responsibility_: Implements a custom full-screen score sheet utilizing `solid-ui` reactive signals. Columns live metrics (Cash, Terminations, Casualties, and FOB construction hits) side-by-side for Lonestar, Manticore, and Valkyra while hiding unlisted Team 4 data.- **src/features/ai/chaos-ai.ts** (Team 4 Swarm Controller)
  - _Responsibility_: Programmatically spawns and tracks a permanent 12-bot AI threat on Team ID 4 using low-level index routing. Bundles the bots into 4 squads of 3, applies a 250 HP modifier, and forces a tight 30-meter leader cohesion swarming pattern towards the active HotZone center.
6. Cross-Cutting Shared Helpers
- **src/shared/utils.ts** (Performance-Safe Vector Helpers)
  - _Responsibility_: Provides fast conversion types between standard TypeScript objects `{ x, y, z }` and opaque `mod.Vector` spaces to prevent index heap overflow on high-frequency loops.
