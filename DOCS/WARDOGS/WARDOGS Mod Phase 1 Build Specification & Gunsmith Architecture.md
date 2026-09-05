# WARDOGS PHASE 1: TECHNICAL BUILD SPECIFICATION & SYSTEM DESIGN (SDK V1.4.2.0)

### 1. Executive Summary & Phase 1 Scope

The WARDOGS project establishes a high-fidelity PMC-themed conflict on the `mp_granite_military_storage` map, emphasizing systemic stability and economic consequence. The strategic intent of Phase 1 is the construction of a robust "base foundation"—a modular architectural framework designed to handle persistent state, role-based transactions, and programmatic asset assembly. Establishing this foundation is a technical prerequisite for Phase 2, which will introduce complex spatial math for drifting HotZones. By decoupling the economy and progression from spatial logic now, we ensure a performant execution environment capable of handling high-frequency state updates in contested sectors.

**Lobby Structure and Faction Allocation** To achieve a three-way conflict within the Battlefield 6 engine, we utilize a 4-team architectural workaround. Three human-joinable factions—**Lonestar**, **Manticore**, and **Valkyra**—are capped at 12 players each. Team 4 is programmatically reserved as a non-joinable containment zone for Rogue AI "Zone Sweeper" squads. This isolation prevents human players from accidentally balancing into the AI faction via native lobby logic, maintaining the tactical asymmetry of the three-way mercenary war.

**Core Phase 1 Pillars**

- **Persistent Economy:** A transactional ledger managing a $10,000 starting balance and role-specific XP tracks.
- **Role-Based Spawning:** Logic governing baseline gear deployment and classless role identification.
- **Validation Engine:** An economic gating system that applies pro-rated surcharges and handles pooled F.O.B. material contributions.
- **Programmatic Gunsmith:** A runtime assembly system that synthesizes custom weapon packages based on Tier proficiency.

This architectural roadmap transitions the WARDOGS concept into a functional local development environment configured for rapid iteration.

### 2. Local SDK Architecture & Workspace Configuration

To manage the inherent complexity of a multi-faction PMC simulation, we employ a "Feature-Slice Architecture" (Option 1). This modular approach isolates disconnected systems—such as the economy, AI behavior, and UI—into independent slices. This prevents the codebase from devolving into a monolithic script, ensuring that the project remains maintainable and that event-driven logic does not introduce microtask lag during intense combat.

**Configuring** `**ts-bf6-portal.config.json**` The experience configuration defines the Environment UUID and the specific team composition required for the three-faction conflict.

```json
{
  "id": "wardogs-experience-uuid-001",
  "name": "WARDOGS: PMC CONFLICT",
  "description": "3-Faction Mercenary Combat on Granite Military Storage.",
  "published": false,
  "script": {
    "file": "src/index.ts"
  },
  "maps": [
    {
      "map": "mp_granite_military_storage",
      "teams": [12, 12, 12],
      "balancing": "none",
      "rules": [
        { "name": "FriendlyFireDamageReflectionEnabled", "value": false }
      ]
    }
  ],
  "rotation": "loop",
  "strings": {
    "file": "src/wardogs.strings.json"
  }
}
```

**Environment & Dependencies** The project utilizes the `bf6-portal-mod-types` (v4.2.x) for type-safe access to the `mod` namespace.

`**package.json**`

```json
{
  "name": "bf6-wardogs",
  "version": "1.0.0",
  "devDependencies": {
    "bf6-portal-mod-types": "^4.2.0",
    "ts-bf6-portal": "latest"
  },
  "scripts": {
    "build": "ts-portal-bundle --entry src/index.ts --out dist/bundle.ts",
    "deploy": "ts-bf6-deploy --config ts-bf6-portal.config.json"
  }
}
```

`**tsconfig.json**`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "CommonJS",
    "types": ["bf6-portal-mod-types"],
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*.ts"]
}
```

By establishing these workspace configurations, the system can reliably drive the internal state management required for mercenary progression.

### 3. Persistent Player State & Economy (`profile.ts`)

WARDOGS utilizes an in-memory TypeScript `mercenaryRegistry` Map to manage player state. By mapping unique Player IDs to complex `MercenaryProfile` objects, we bypass the "index loss" and data corruption risks associated with native object variables. This state container remains persistent for the duration of the server session, providing transactional safety for wallet updates and XP progression across six discrete tracks.

**Wallet Lifecycle & Persistence Logic** Mercenaries initialize with a $10,000 match balance. To prevent "farming," cash is consumable and does not reset upon redeployment. Proficiency is tracked via XP; performing role-specific actions (reviving for Medics, building for Support) awards XP to that specific track, unlocking Tier-based discounts at Buy Stations.

**Implementation Specification:** `**profile.ts**`

```typescript
import { Events } from "bf6-portal-utils";

export type ProgressionTrackKey = "Assault" | "Medic" | "Recon" | "Support" | "Driver" | "Pilot";
export interface TrackData { xp: number; level: number; }

const XP_THRESHOLDS = [0, 1000, 2500, 5000, 10000]; // Tiers 1-5

export class MercenaryProfile {
    public cash: number = 10000;
    public tracks: Record<ProgressionTrackKey, TrackData> = {
        Assault: { xp: 0, level: 1 }, Medic: { xp: 0, level: 1 },
        Recon: { xp: 0, level: 1 }, Support: { xp: 0, level: 1 },
        Driver: { xp: 0, level: 1 }, Pilot: { xp: 0, level: 1 }
    };

    constructor(public readonly playerId: number) {}

    public addTrackXp(track: ProgressionTrackKey, amount: number) {
        const data = this.tracks[track];
        data.xp += amount;
        
        // Calculate Tier Thresholds (1-5)
        for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
            if (data.xp >= XP_THRESHOLDS[i]) {
                data.level = i + 1;
                break;
            }
        }
    }
}

export const mercenaryRegistry = new Map<number, MercenaryProfile>();

Events.OnPlayerJoinGame((player) => {
    const id = mod.GetObjId(player);
    if (!mercenaryRegistry.has(id)) {
        mercenaryRegistry.set(id, new MercenaryProfile(id));
    }
});

// Failsafe Lifecycle Hook to prevent memory bloat
Events.OnPlayerLeaveGame((player) => {
    const id = mod.GetObjId(player);
    mercenaryRegistry.delete(id);
});
```

The integrity of this state container ensures that combat regulations regarding equipment and death are enforced accurately.

### 4. Spawning Logic, Death Penalties, & Role Preservation

The WARDOGS environment incentivizes tactical caution through "Death Penalties." A failure to be revived results in a tangible loss of assets and a reduction in team tickets, creating a high-stakes PMC atmosphere.

**Loadout Regulations & Role Preservation** When a player triggers an unrevived death, they suffer the "Death Kit Penalty," which wipes their Slot 1 primary weapon. However, to maintain class continuity, the "Classless Role Preservation" system ensures that specialty assets remain equipped.

**Preserved Specialty Assets** | Specialty Asset | Role Continuity | Preservation Status | | :--- | :--- | :--- | | Medic Crate | Combat Life Support | Preserved | | Spawn Beacon | Tactical Intelligence | Preserved | | TUGS | Reconnaissance | Preserved | | Sledgehammer | F.O.B. Construction | Preserved | | Portal Gadget PDA | Tactical Blueprinting | Preserved |

**Baseline Deployment Gear** Upon redeployment following a kit wipe, mercenaries are issued survival gear:

- **Primary:** AK-205 (Baseline Assembly)
- **Secondary:** P18
- **Grenade:** Mini Frag Grenade

These loadouts are validated and updated in real-time by the transaction engine as players interact with Buy Stations.

### 5. The Transaction & Validation Engine (`buy-validator.ts`)

The WARDOGS economy employs an "Economic Barrier" system. By applying a pro-rated surcharge to equipment that exceeds a player's current proficiency Tier, the engine prevents "lone-wolf" hoarding and forces players to commit to specialized roles for "Standard Base Cost" pricing.

**Pro-Rated Surcharge Formula** The engine applies a maximum 200% penalty for zero proficiency, scaling down linearly as the player ranks up: `Cost = BaseCost * (1 + P_max * (T_req - T_curr) / T_req)`

- **BaseCost (****C_{base}****):** Standard unlocked price.
- **P_max:** Maximum penalty multiplier (2.0).
- **T_req:** Required Tier (1-5).
- **T_curr:** Player's current Tier in the associated track.

**Cooperative Funding & Materials** For F.O.B. static defenses, the engine tracks a "Materials Pool" distinct from individual cash. Heavy assets require teammates to contribute cash at a deposit node, which the engine converts into shared materials:

- **Light Cover (Sandbags):** 50 Materials.
- **Medium Walls (HESCOs):** 150 Materials.
- **Watchtowers / AA:** 500 Materials.

**Implementation Specification:** `**buy-validator.ts**`

```typescript
import { mercenaryRegistry } from "../progression/profile";

export class BuyValidator {
    static calculatePrice(player: mod.Player, baseCost: number, reqTier: number, track: string): number {
        const profile = mercenaryRegistry.get(mod.GetObjId(player));
        if (!profile) return baseCost * 3.0; // Max penalty for missing profile

        const currentTier = profile.tracks[track as any].level;
        if (currentTier >= reqTier) return baseCost;

        const penalty = 2.0 * ((reqTier - currentTier) / reqTier);
        return mod.Floor(baseCost * (1 + penalty));
    }

    static processPurchase(player: mod.Player, cost: number): boolean {
        const profile = mercenaryRegistry.get(mod.GetObjId(player));
        if (profile && profile.cash >= cost) {
            profile.cash -= cost;
            return true;
        }
        return false;
    }
}
```

Validated transactions are passed to the Gunsmith subdomain for immediate programmatic assembly of the purchased hardware.

### 6. Gunsmith Subdomain: Programmatic Weapon Assembly

Under the "No Hardcoded Classes" philosophy, a player's role is defined by their gear. The Gunsmith subdomain uses the SDK assembly API to synthesize weapon packages at the moment of purchase, allowing for infinite variation without relying on static presets.

**SDK Assembly API** The system uses `mod.CreateNewWeaponPackage()` to initialize a receiver and `mod.AddAttachmentToWeaponPackage()` to snap components to the rails.

**Tiered Configuration Matrix (Assault Track)**

- **Tier 1 (Baseline):** AK-205 (Iron Sights, 20rnd Mag).
- **Tier 3 (Tactical):** M4A1 (Scope_1p87_150x, 30rnd Fast Mag, Compensated Brake).
- **Tier 5 (Elite):** M4A1 (Scope_R4T_200x, 40rnd Fast Mag, Vertical Grip, Tungsten Core AP Ammo, Suppressor).

**Implementation Specification:** `**weapon-packages.ts**`

```typescript
export function createTier1AK205() {
    return mod.CreateNewWeaponPackage(mod.Weapons.Carbine_AK_205);
}

export function createTier3M4A1() {
    const pkg = mod.CreateNewWeaponPackage(mod.Weapons.Carbine_M4A1);
    mod.AddAttachmentToWeaponPackage(pkg, mod.Attachments.Scope_1p87_150x);
    mod.AddAttachmentToWeaponPackage(pkg, mod.Attachments.Magazine_30rnd_FastMag);
    mod.AddAttachmentToWeaponPackage(pkg, mod.Attachments.Muzzle_Compensator);
    return pkg;
}

export function createTier5M4A1() {
    const pkg = mod.CreateNewWeaponPackage(mod.Weapons.Carbine_M4A1);
    mod.AddAttachmentToWeaponPackage(pkg, mod.Attachments.Scope_R4T_200x);
    mod.AddAttachmentToWeaponPackage(pkg, mod.Attachments.Magazine_40rnd_FastMag);
    mod.AddAttachmentToWeaponPackage(pkg, mod.Attachments.Grip_Vertical);
    mod.AddAttachmentToWeaponPackage(pkg, mod.Attachments.Ammo_Tungsten_Core);
    mod.AddAttachmentToWeaponPackage(pkg, mod.Attachments.Muzzle_Suppressor);
    return pkg;
}
```

These weapon definitions are unified within the master execution loop to bind economy to combat capability.

### 7. Master Life-Cycle Bootstrapper (`index.ts`)

The `index.ts` file is the central nervous system of the mod. It binds the feature slices—profile management, transaction validation, and weapon assembly—to the native SDK events, while simultaneously managing the custom win conditions and ticket mechanics.

**Event Binding & Scoring Logic**

- **Win Condition:** First team to 100 points.
- **Majority Control:** Points are awarded per interval to the faction holding the most players in the Control Zone.
- **Ticket Bleed:** Every unrevived death subtracts 1 point from the team's total.

**Implementation Specification:** `**index.ts**`

```typescript
import { Events } from "bf6-portal-utils/events";
import { mercenaryRegistry } from "./features/progression/profile";

let teamScores = { 1: 0, 2: 0, 3: 0 };

Events.OnGameModeStarted(() => {
    mod.SetScoreboardType(mod.ScoreboardType.Off); // Custom UI used instead
});

Events.OnPlayerDied((player) => {
    const teamId = mod.GetObjId(mod.GetTeam(player));
    // Ticket Bleed Fallback: -1 point on death
    teamScores[teamId] = Math.max(0, teamScores[teamId] - 1);
    
    // Death Penalty: Kit Wipe
    mod.RemoveEquipment(player, mod.EquipmentSlot.Primary);
    mod.DisplayNotificationMessage(mod.Message("KIT LOST | SALVAGE PACK DROPPED"), player);
});

mod.OnTick(() => {
    // Scoring Logic: Placeholder for Majority Control check (Phase 1)
    // if (majorityInZone === team1) teamScores[1]++;
    
    // Win Condition Check
    for (let i = 1; i <= 3; i++) {
        if (teamScores[i] >= 100) {
            // SDK Workaround: Force win via native variable to close lobby
            mod.SetTeamScore(mod.GetTeam(i), 1); 
        }
    }
});
```

### 8. Compilation, Deployment, & Phase 2 Roadmap

Finalizing the Phase 1 build requires a strict local deployment pipeline:

1. **Bundle:** Execute `npx ts-portal-bundle` to unify feature slices into `bundle.ts`.
2. **Deploy:** Execute `npx ts-bf6-deploy` to upload scripts and `wardogs.strings.json`.
3. **Sync:** Utilize `gdconverter` to map Godot spatial data (Sockets/HQ nodes) into the Portal environment.

**Debugging & Diagnostics** Monitor `PortalLog.txt` in the Local AppData directory for real-time console output. This is the primary diagnostic tool for verifying transaction clearing and XP award events.

**Phase 2 Visionary Roadmap** With the economic foundation established, the project will transition to advanced spatial mechanics:

- **Drifting HotZone Math:** Implementation of moving capture volumes based on "Golmud Train" coordinates.
- **4th Faction AI:** Activation of Team 4 "Zone Sweeper" squads using `mod.SpawnAIFromAISpawner` to hunt the HotZone center.
- **Salvage Packs:** A dynamic interactable loot system for recovering ammo and cash from fallen mercenaries.
- **Excavation Construction:** Integration of `mod.MoveObjectOverTime` to physically lift buried F.O.B. assets out of the terrain when struck with a Sledgehammer.