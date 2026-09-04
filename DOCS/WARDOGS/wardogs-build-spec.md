# WARDOGS Custom Experience: Feature-Slice Project Build Specification & Setup Guide (v3)

**Standard**: BF6 Portal SDK v1.4.2.0 Modern Build Pipelines  
**Mod Path**: `PortalSDK/GodotProject/mods/{YourMod}`  
**Core Toolchain**: `ts-bf6-portal` (Compiler/Deployer) + `bf6-portal-utils` (Runtime Utilities) + `bf6-portal-mod-types` (Global TypeScript Typings)

---

## 1. Directory Architecture & Environment Mapping

### 1.1 Local SDK Mod Folder Path

The official Battlefield 6 Portal SDK structures Godot-based spatial modifications and assets within a unified Godot project. All custom mods must reside in the dedicated mods folder inside the Godot project root:

```
PortalSDK/GodotProject/mods/wardogs/
```

Working within `/GodotProject/mods/` ensures that your Godot scene files (`.tscn`), spatial layouts, scripts, and TypeScript files are properly tracked, enabling the SDK's bundled tools and automation servers to easily compile, convert, and test your maps natively [13, 21].

### 1.2 Modular Project File Structure (Feature-Slice Architecture)

This architecture organizes the codebase by **what the player actually experiences on the battlefield**. Related logics (UI, math, systems, and listeners) live grouped together in high-level feature directories under `src/features/`, completely avoiding the over-nesting of typical enterprise Domain-Driven Design (DDD) folders.

```text
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

## 2. Developer Toolchain & Configuration Specs

### 2.1 package.json Configuration

Create a `package.json` in your mod's directory to manage Node dependencies and define scripts to automate compiling, bundling, and deployment:

```json
{
  "name": "wardogs-portal-mod",
  "version": "1.0.0",
  "description": "WARDOGS custom tactical King of the Hill experience on Battlefield 6 Portal",
  "main": "src/index.ts",
  "scripts": {
    "bundle": "ts-portal-bundle --entry src/index.ts --out dist/portal-bundle.ts",
    "deploy": "ts-bf6-deploy --config ts-bf6-portal.config.json",
    "deploy-all": "ts-bf6-deploy --config ts-bf6-portal.config.json --strings dist/strings.json",
    "list-mutators": "ts-bf6-list-mutators",
    "list-assets": "ts-bf6-list-asset-categories"
  },
  "devDependencies": {
    "bf6-portal-mod-types": "^4.2.0",
    "ts-bf6-portal": "^1.1.1"
  },
  "dependencies": {
    "bf6-portal-utils": "^7.1.0"
  }
}
```

### 2.2 tsconfig.json Configuration

The Portal API is exposed at runtime via a global `mod` namespace rather than being imported. Set up your `tsconfig.json` so the TypeScript compiler registers the global types correctly:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["bf6-portal-mod-types"]
  },
  "include": ["src/**/*.ts"]
}
```

*Note: Ensure `types` lists `bf6-portal-mod-types` to expose autocomplete (IntelliSense) and type checking globally inside your editor without requiring manual imports.*

### 2.3 ts-bf6-portal.config.json Configuration

This is the central configuration file that compiles modular sub-directories, applies hardcoded engine mutators, maps spatial data, and structures map parameters. Under WARDOGS rules, we support **3 playable human factions** (Teams 1, 2, and 3 with 33 players each) alongside **1 unlisted, dedicated AI threat faction** (Team 4 with 12 permanent bots, organized into 4 squads of 3):

```json
{
  "id": "c2450750-61d8-11f1-94dd-1f9cca3d9d76",
  "name": "WARDOGS Feature Slice Edition",
  "description": "Tactical 3-faction King of the Hill with shifting HotZone and HQ weapon shops.",
  "published": false,
  "bundle": {
    "entry": "src/index.ts",
    "outFile": "dist/portal-bundle.ts",
    "tsconfig": "tsconfig.json"
  },
  "maps": [
    {
      "map": "MP_Granite_MilitaryStorage",
      "teams": [33, 33, 33, 12],
      "rounds": 1,
      "balancing": "none",
      "spatial": "levels/mp_granite_military_storage_portal_wardogs.spatial.json",
      "rules": [
        { "name": "FriendlyFireDamageReflectionEnabled", "value": true },
        { "name": "FriendlyFireDamageReflectionMaxTeamKills", "value": 2 },
        { "name": "SquadReviveAllowed_PerTeam", "value": false }
      ]
    }
  ],
  "rotation": "loop",
  "strings": {
    "file": "dist/strings.json"
  }
}
```

---

## 3. High-Stakes Gameplay Systems

### 3.1 Control Zone Rogue AI Team (The Disruptor Faction)

To prevent snowball camping inside the Control Zone and maintain active combat tension, WARDOGS deploys a permanent 12-bot Rogue AI faction (Team 4). Organized into 4 fireteams of 3 bots (1 Leader, 2 Members), they spawn near the Control Zone, continuously target and swarm the dynamic HotZone, forcing human teams to constantly expend resources and ammunition. This team does not participate in the scoring or match cash economy.

### 3.2 Scavenger Backpack Loot Drops (Interact-Driven GC)

Upon death, contractors forfeit their primary weapons, but their leftover supplies persist in the world as a physical backpack object. Using an event-driven `Events.OnPlayerInteract` pattern, looting is fully offloaded to the game engine natively, eliminating performance proximity tick loops. Unlooted backpacks are collected after a configurable 60-second default sweep to secure server memory.

---

## 4. Post-Deployment Validation Checklist

* **Compile Veracity**: Check that `dist/portal-bundle.ts` compiled successfully and contains the flat export declarations without syntax anomalies.
* **Strings Mapping**: Ensure that all custom strings mapped inside `dist/strings.json` have loaded successfully using the CLI logs to prevent empty text displays on player HUDs.
* **Map Attachment Check**: Confirm in the EA Web UI that the `level.spatial.json` file is attached cleanly to your experience map rotation slot.
