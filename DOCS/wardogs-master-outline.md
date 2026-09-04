# WARDOGS Custom Experience: Master Project Blueprint & Document Outline (v2)
**Standard**: BF6 Portal SDK v1.4.2.0 Integration Spec  
**Mod Directory**: `PortalSDK/GodotProject/mods/wardogs/`  
**Architecture Pattern**: Option 1 (Feature-Slice Architecture)

This document serves as the **Master Blueprint and Technical Outline** for the custom WARDOGS experience. It compiles verified gameplay systems, programmatic SDK loops, and folder mappings, serving as an actionable development template.

---

## 1. GameMode Structure, Objectives & Win Conditions

### 1.1 Faction Configuration
*   **Three-Faction Setup**: 36-player maximum human lobby [238, 248].
    *   **Lonestar (Blue)**: Gritty private contractors [246]. Assigned Team ID: `1`.
    *   **Manticore (Green)**: High-risk Persian "shadow army" [247]. Assigned Team ID: `2`.
    *   **Valkyra (Red)**: Restorationist Soviet-faithful forces [247]. Assigned Team ID: `3`.
*   **Player Distribution**: Strictly capped at **12 players per team** to encourage highly focused tactical squad play and maintain matchmaking efficiency [248].
*   **The Programmatic 4th AI Faction (Chaos Squads)**:
    *   **Lobby Isolation**: Team ID `4` is completely omitted from the Portal editor's `teamComposition` list. This prevents human lobby leakage (players cannot join Team 4 or switch to it) and bypasses native team-balancing rules [20, 27].
    *   **Roster & Composition**: Functional, permanent unjoinable enemy faction consisting of **12 bots total**, organized into **4 squads of 3** (1 Leader, 2 Members per squad).
    *   **Spawn Vector**: AI bots spawn programmatically from the Godot pre-placed `AI_Spawner` nodes at the Central Control Zone.
    *   **Non-Economic Role**: Bots do not receive player profiles, Cash/XP wallets, or team scoring tickets. They exist purely as a tactical resource/attention sink to apply nonstop pressure inside the zone and prevent passive camping.
*   **Team Switcher Mechanics**: Human team-swaps allowed via base mannequins matching `InteractPoint` ObjIds `998` and `999` with balance safety caps [84, 85].

### 1.2 Win Conditions & Match Scoring
*   **Score Objective**: The first team to reach **100 points** wins the match [238, 248].
*   **Score Ticking Mechanic**: A team scores points by holding the **majority player count** within the main Control Zone at the end of each tick interval (monitored via progress bars on player HUDs) [250].
*   **The Ticket Bleed Fallback**: Ticket deduction systems triggered when a teammate undeploys without being revived, subtracting 1 point from their team's score [66].
*   **SDK Workaround (End Game Block)**: Direct scoring in Portal is bugged (the native end game block fails) [42]. Scoreboard tracking is handled via custom global variables, forcing target score to `1` when a victory condition is verified to let native mechanics close the lobby [42, 70, 71].

### 1.3 SDK Event Bindings & Godot Mappings
*   **Godot Nodes**:
    *   `TEAM_1_HQ`, `TEAM_2_HQ`, `TEAM_3_HQ` (`HQ_PlayerSpawner` nodes, ObjIds `100`, `2`, `3`) [94, 100, 106].
*   **TS Event Hooks**:
    *   `OnGameModeStarted()`: Centralized target score overriding, clock setup [41, 42].
    *   `OnPlayerJoinGame(player: mod.Player)`: Tracks team limits, sets initial parameters [55].

---

## 2. Player Roles & Progression Tracks

### 2.1 The Six Progression Tracks
No hardcoded classes; roles are defined dynamically by the specialized gear, tools, and weapons purchased at HQ/FOB Buy Stations [259, 260].
1.  **Assault**: Advanced front-line combatants utilizing customized Assault Rifles [259].
2.  **Medic**: Combat life support, using bandages, medical boxes, and defibrillator revives [259, 260].
3.  **Recon**: Target spotting, sniper oversight, and laser radar spotting [259].
4.  **Support**: Fortifications construction, stationary AA/AT operators, and demolition engineers [259, 260]. Equipped with **Build Tools / Entrenching Tool (Shovel)**.
5.  **Driver**: Ground logistics, armored ATV/APC drivers, and spawn vehicle operators [259, 260].
6.  **Pilot**: Air logistics, transport helicopters, and airborne insertion supply drops [259, 260].

### 2.2 Experience (XP) Scoring Triggers
*   XP points are rewarded in real-time to specific tracks based on in-game actions:
    *   *Assault*: Rifle kills (+150 XP) [260].
    *   *Medic*: Healing ticks and teammate revives (+200 XP) [260].
    *   *Recon*: Active spotting pings via Range Finders or Binoculars, sniper assists (+100 XP) [260, 261].
    *   *Support*: Constructing and repairing FOB sockets (+120 XP) [260].
    *   *Driver/Pilot*: Transporting teammates and ferrying Logistics Supply Crates (+250/+300 XP) [260].

### 2.3 TS API Bindings
*   `mod.GetSoldierState(player, mod.SoldierStateBool.IsAI)`: Separates human progression from bot states [55].
*   `OnPlayerDied(player, killer, deathType, weaponUnlock)`: Awards combat experience to the killer's current active track [180].

---

## 3. Cash Economy & Persistent Wallet

### 3.1 Initial Cash & Persistence
*   **Starting Cash**: Every player starts their match with **$10,000** [239, 254].
*   **Strict Wallet Lifecycle**: Starting cash is credited **exactly once per match session** upon initially joining the server (constructed profile constructor). Wallet cash persists through subsequent respawns—suicide respawn farming to reset cash balances is programmatically blocked.
*   **Display**: Persistent wallet status displayed dynamically on the player HUD (top-right corner) using reactive signals [258].

### 3.2 Income Generators (Teamplay Triggers)
Cash is earned dynamically through standard battlefield actions, heavily incentivizing team-first actions:
*   Kills: +$500 [257].
*   Revives: +$300 (awarded to the medic performing the defibrillator revive) [54, 257].
*   FOB Building / Repairing: +$100 per shovel construction hit [257, 262].
*   Spotting: +$50 (assisting teammates with spotting gear) [257, 263].
*   Logistics Supply Delivery: +$800 cash awarded for transporting heavy Supply Crates from HQ to FOB.
*   Objective Tick: +$100 for every tick spent inside the Control Zone [257] (+$200 if inside the Hot Zone [251, 257, 263]).

### 3.3 Wallet Mechanics & Kit Penalty
*   Wallet balance modifications are processed synchronously through a central transaction handler to ensure transactional safety [258].
*   **Death Kit Penalty**: When a player dies or undeploys, any expensive primary firearms purchased from the Buy Station (T3/T5 custom weapon packages) are lost.
*   **Baseline Spawn Kit**: Players respawn with a cost-effective, baseline combat loadout (AK-205 Primary, P18 Select Sidearm, Mini Frag Grenade).
*   **Role Specialty Preservation**: Active, role-defining specialty gadgets (such as a Medic Defibrillator, Medic Crate, Spawn Beacon, TUGS, Shovel/Entrenching Tool, or Portal Gadget) bypass the inventory wipe on spawn. This ensures players retain their functional squad role across deaths.

### 3.4 Helper Library Integration
*   **`bf6-portal-utils/solid-ui`**: Stores the player's cash state as a reactive Signal [165]. Text displays update only when cash balances change, eliminating expensive per-tick updates [165].

---

## 4. Drifting HotZone Mechanics (Mathematical Moving Objectives)

### 4.1 Concept & Movement Vector
*   **Double Multiplier Zone**: The "Hot Zone" is a smaller, moving circular sector (represented by a 3D flagpole node in-game) positioned inside the larger polygonal **Control Zone** trigger [251].
*   **Multiplier Value**: Every player inside the Hot Zone counts as **TWO** players for match scoring and cash ticking [251, 263].
*   **Drift Vector**: Recalculated dynamically every second [41]. The zone drifts continuously along randomized vectors within the Control Zone polygon boundaries [251].

### 4.2 Polygon Containment Math
To prevent the Hot Zone from drifting outside the map boundaries, containment logic must restrict the center coordinates to the vertices of the `PolygonVolume_ControlZone_1_1` [117].
*   **Ray-Casting Algorithm**: The script performs a 2D point-in-polygon check on the future target position. If the calculation fails, the drift vector is inverted back toward the geometric center of the Control Zone.

### 4.3 Godot Mappings & TS Bindings
*   **Godot Nodes**:
    *   `AreaTrigger_ControlZone_1_1` (ObjId `900`) [115].
    *   `CapturePoint_ControlZone_1_1` (ObjId `9000`) [115, 116].
    *   `AreaTrigger_HotZone_1_1` (ObjId `901`) [119].
    *   `CapturePoint_HotZone_1_1` (ObjId `9001`) [120].
*   **TS Event Hooks**:
    *   `OnPlayerEnterAreaTrigger(player, trigger)`: Sets the player's presence state [188].
    *   `OnPlayerExitAreaTrigger(player, trigger)`: Removes presence state [188].
*   **`bf6-portal-utils/vectors`**: Handles standard vector transformations, vector additions, and translation to opaque coordinate spaces [165].

---

## 5. F.O.B Logistics, Capture Points & Construction

### 5.1 F.O.B Materials & Sockets
*   **Material Pools**: Each captured FOB has a shared team-wide Building Materials pool stored in the scene Sector [262].
*   **Materials Logistics**: Transported from HQ spawning hubs to FOB points via heavy Supplies Packs ferried by Drivers and Pilots [257, 260].
*   **Socket-Based Sockets**: Pre-placed construction socket models mapped in Godot inside a parent `Sector` node [222].

### 5.2 Build Execution Mechanics
*   **Equipping the Shovel**: Support players purchase shovel Build Tools at Buy Stations, unlocking the radial building menu [261, 262].
*   **Shovel Construction / Repair Loop**: Hitting pre-placed socket nodes with the shovel consumes local materials and progresses construction.
*   **Yellow Critical Hits**: Scoring a strike on the yellow "X" UI node spawned relative to the structure increases construction rates by 300% [262].
*   **Structures Available**:
    *   `SandBags_01_256x120` (ObjId `3`): Light infantry cover [123].
    *   `SandBagsPlatform_01_320x60` (ObjId `2`): Elevated firing platforms [128].
    *   `SandBagsPileStraight_01_128` (ObjId `9`): Reinforcements [126].

### 5.3 Repair & Welding Mechanics
*   Pre-placed defenses can be damaged by enemy explosives [242, 260].
*   **Shovel/Build Tool Welding**: Operating Shovel tools on damaged friendly structures triggers a repetitive weld/repair cycle [31].
*   **TS Performance Note**: Handled via asynchronous clock timers (`Timers.setInterval` at `100ms`) to update structure health without blocking server operations [31].

### 5.4 Godot Mappings & TS Bindings
*   **Godot Nodes**:
    *   `TowerSector_1_1` (ObjId `3001`): Parent Sector container [122].
    *   `PolygonVolume_Tower_1_1`: Defensible boundary volume [128].
    *   Underlying socket children: `SandBags_01_256x120` (ObjId `3`), `SandBagsPlatform_01_320x60` (ObjId `2`) [123, 128].
*   **TS Bindings**:
    *   `OnPlayerInteract(player, interactPoint)`: Triggers repair calculations [180].

---

## 6. Towers & Zone Vector Redirection

### 6.1 Securing Towers
*   **Interactive Pillars**: Concentric Capture Point towers are pre-placed in Godot around the 2x2km battlefield [238, 252].
*   **Code Collection**: Capturing and holding a tower uploads localized "decryption segments" to the team's HUD [252].
*   **Decryption Threshold**: Once all tower segments are decoded, the commanding Support player gains access to the redirection tool [252].

### 6.2 Drifting HotZone Redirection
*   **Tactical Redirection**: Using the decrypted code, the capturing team can force the Hot Zone's movement vector to lock onto their heavily fortified Tower location [252].
*   **Tactical Advantage**: Moves double-scoring multipliers into pre-built choke points, enabling effective hold-outs [251, 252].

### 6.3 Godot Mappings & TS Event Hooks
*   **Godot Nodes**:
    *   `CapturePoint_A_1` (ObjId `1001`): Concentric capture pole [129].
    *   `PolygonVolume_CapturePoint_A_1`: Capture boundary vertices [130].
*   **TS Event Hooks**:
    *   `OnCapturePointCaptured(point, team)`: Triggers decoder state and grants team-wide cash rewards [66, 67].

---

## 7. Buy Stations, Spawners & Terminology

### 7.1 HQ Shops & Buy Stations
*   **MCOM BuyStations**: Pre-placed Buy Stations reside securely inside each faction's HQ Area [94, 100, 106].
*   **Interaction Hook**: Pressing the interact key near the Buy Station triggers a custom buy-phase overlay [230].
*   **The 60-Second Hold**: When a match begins, spawners lock players inside the base for 60 seconds to purchase equipment, attachments, and loadouts [248, 253].

### 7.2 Dynamic Pro-Rated Pricing Model
*   **Role Surcharges**: Players can buy progression-locked items from different tracks, but at a massive premium if their level is deficient.
*   **Pro-rated Cost Formula**: `Cost = BaseCost * (1 + 2.0 * (Deficit / RequiredTier))`. Deficit is calculated as `RequiredTier - CurrentTier` [256]. Pay standard BaseCost once the required Tier level is achieved [256].
*   **Cooperative Base Upgrade Funding**: Expensive stationary emplacements (such as the GDF009 Stationary AA) support pooled funding. Teammates contribute loose cash directly at FOB consoles until the upgrade is fully funded and spawned in-world.

### 7.3 Spawning Vehicles & Equipment
*   **Vehicle Spawners**: Mapped to Godot `VehicleSpawner` nodes [98, 104, 110].
*   **Spawning Flow**: Interacting with `InteractPoint_Vehicle_Menu_1_1` deducts cash from the driver's wallet and forces vehicle assembly on the launch pad [99, 100].

### 7.4 Godot Mappings & TS Bindings
*   **Godot Nodes**:
    *   `BuyStation_1_1` (ObjId `111`): Faction 1 purchase console [98].
    *   `VehicleSpawner_1_1` (ObjId `110`, Vehicle Type: `AH64`): Faction 1 air assembly pad [98].
    *   `InteractPoint_Vehicle_Menu_1_1` (ObjId `112`): Vehicle selection terminal [99].
*   **TS Event Hooks**:
    *   `OnPlayerInteract(player, interactPoint)`: Accesses the shop terminal and unlocks UI overlay controls [180].

---

## 8. Salvage Pack System (Gamer-Friendly Drops)

### 8.1 Backpack Physics & Spawning
*   **Terminology Rebrand**: Clinically dry developer labels like "Scavenger Kits" are replaced with highly immersive, gamer-friendly terms: **Salvage Pack** or **Merc Cache**.
*   **Undeploy Spawning**: When a player is absolutely eliminated (undeploys, bypassing revive limbo bugs), they drop a physical **Supplies Backpack** (`SuppliesPack_01`) at their ragdoll position [165].
*   **Native Interact Node**: Bypasses expensive and performance-heavy proximity checking loops entirely. The system spawns an interactive `InteractPoint` node directly on the pack's coordinates, natively catching player interacts (`Events.OnPlayerInteract` holding [E]) [180].

### 8.2 Loot & GC Lifecycle
*   **Tactical Payouts**: Interacting with a Salvage Pack instantly restocks Slot 1 primary ammunition, awards a randomized loose cash payload ($150 to $350), and grants **+100 Assault XP** progression.
*   **WorldIcon Localized Text**: WorldIcon text bugs are bypassed by routing floating 3D text layers through localized keys. A floating icon appears above the backpack with the label:  
    `"SALVAGE PACK\nHold [E] to Salvage Equipment"`
*   **Active Garbage Collection**: Dropped packs automatically despawn and release engine entities after a configurable **60-second default timer** to protect server memory.

---

## 9. AI Behaviors & Wave Logic

### 9.1 Automated Code-Driven Spawning
*   **Programmatic 4th Faction**: Spawning code uses low-level index routing (`mod.GetTeam(4)`) to spawn Team 4 bots programmatically without declaring active composition slots in the Portal editor.
*   **Fixed Spawning Waves**: Programmed to maintain **12 active bots** inside the Control Zone. Spawns are dynamically routed to the pre-placed `AI_Spawner` nodes near the center.

### 9.2 AI Behavior Trees
Bots operate on an event-driven system to simulate tactical human decisions [29, 30]:
*   **Deployment state**: AI is deployed with boosted health pools (2.5x modifier to offset bot navigation limits) [76].
*   **Combat Scouting Loop**: AI checks for available HQ vehicles. If empty, the bot teleports to seat `0` (driver's seat) and navigates to the zone [77, 78].
*   **Sprinting State Check**: AI sprints toward captured flags. If hit, the sprinting behavior halts to prioritize return fire using defensive, alerted stances [81, 82].

### 9.3 Godot Mappings & TS Bindings
*   **Godot Nodes**:
    *   `AI_Spawner` (ObjId `401`): AI spawning point [143].
*   **TS API Bindings**:
    *   `mod.SpawnAIFromAISpawner(spawner, team)`: Spawns AI actors [188, 218].
    *   `mod.AIEnableShooting(ai, enable)`: Unlocks combat triggers [220].

---

## 10. Map Flow & Encounter Design

### 10.1 Encounter Mapping: MP_Granite_MilitaryStorage
The map layout utilizes designated physical sectors to create clear, balance-tested lanes of travel:
*   **Faction 1 Spawn Hub (Lonestar)**: North-West quadrant coordinates [94, 98]:
    *   Spawn Center: `x: 414.67, y: 151.46, z: 81.49` [94].
    *   Buy station terminal: `x: 387.45, y: 151.00, z: 93.70` [99].
*   **Faction 2 Spawn Hub (Manticore)**: South-East quadrant coordinates [100, 105]:
    *   Spawn Center: `x: 822.82, y: 143.76, z: 714.70` [101].
    *   Buy station terminal: `x: 849.01, y: 143.67, z: 693.41` [105].
*   **Faction 3 Spawn Hub (Valkyra)**: South-West quadrant coordinates [106, 111]:
    *   Spawn Center: `x: 285.91, y: 128.14, z: 513.31` [107].
    *   Buy station terminal: `x: 267.47, y: 128.19, z: 523.16` [111].
*   **Central Control Zone (Encounter Core)**: Located within the polygon volume `AreaTrigger_ControlZone_1_1` [115, 117].
    *   Geometric Center: `x: 903.11, y: 228.33, z: 203.79` [115].

### 10.2 Godot Object Library Placement
*   **Terrain Alignment**: Duplicated meshes are aligned using the Godot terrain static collision shape parent tool to prevent physical anomalies [195].
*   **Snapping Shortcuts**: Key combinations (`Shift + G` to place relative to mouse cursor; `Ctrl + D` to duplicate coordinates) optimize level assembly pipelines [195].

---

## 11. Technical Implementation Notes (SDK + Godot + TS)

### 11.1 Modular Project File Structure
The codebase follows **Option 1: Feature-Slice Architecture** directly inside the Godot project root folder:
```text
PortalSDK/GodotProject/mods/wardogs/
├── package.json                    # Node scripts, compiler/deploy dependencies
├── tsconfig.json                   # TS compilation targeting bf6-portal-mod-types
├── ts-bf6-portal.config.json       # Master bundler configuration file
├── .env                            # GIT-IGNORED EA Portal session keys
├── godot/
│   ├── Level_Setup.tscn            # Godot level spatial file with ObjId nodes
│   └── level.spatial.json          # gdconverter-compiled level assets map
└── src/
    ├── index.ts                    # Entry-point bootstrap mapping events
    ├── core/                       # Core experience variables
    │   ├── config.ts               # Hardcoded settings
    │   └── events.ts               # Centralized events broker
    ├── features/                   # Autonomous vertical gameplay feature slices
    │   ├── hotzone/                # Recalculating containment vectors
    │   ├── shop/                   # Buy station interaction, wallets, & validation
    │   ├── construction/           # Shovel construction, socket triggers & repairs
    │   ├── scavenger/              # Salvage Pack carrier & absolute death drop systems
    │   └── scoreboard/             # Format scoring tickers
    └── shared/                     # Reusable cross-cutting helpers
        └── utils.ts                # Short-hand vector conversion utilities
```

### 11.2 Compiler & Bundling Tools
*   **Single-File Bundling Requirement**: EA Battlefield Portal accepts only a single flat `.ts` file [91]. Imports are flattened natively:
    ```bash
    npx ts-portal-bundle --entry src/index.ts --out dist/portal-bundle.ts
    ```
*   **Type Registrations**: TypeScript registers the global `mod` namespace directly through dev-dependency declarations:
    ```json
    "types": ["bf6-portal-mod-types"]
    ```
*   **Cloud Deployment**: Automatic uploads are managed with deployment modules pointing to local `.env` session keys:
    ```bash\n    npx ts-bf6-deploy --config ts-bf6-portal.config.json --strings dist/strings.json
    ```

### 11.3 Spatial Data Compiler (`gdconverter`)
The scene modifications are compiled into the central experience using Python scripts:
```bash
python deps/gdconverter/convert.py --input mods/wardogs/godot/Level_Setup.tscn --output mods/wardogs/godot/level.spatial.json
```

---

## 12. Agent and Assistant Development Guidelines

### 12.1 Context Management & Reading Protocols
*   **No Speculation**: When generating or editing logic inside the `/src` folder, do not fill missing SDK functions from generic training data. If an API is undocumented, query the official `index.d.ts` file.
*   **Incremental Edits**: Preserve existing structures in `src/features/` unless explicitly instructed to refactor.

### 12.2 Verification Pipeline
*   **Lint Check**: Run compiler validations (`npx tsc --noEmit`) before proposing changes.
*   **Size Constraints**: Avoid excessively large UI templates in single modules; utilize the `ParseUI` wrapper functions to create clean node hierarchies [185, 205].
