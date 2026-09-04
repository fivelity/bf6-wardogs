# WARDOGS Custom Experience: Core Gameplay Mechanics Technical Build Specification
**Standard**: BF6 Portal SDK v1.4.2.0 Modern Systems Architecture
**Map Target**: `MP_Granite_MilitaryStorage`
**Design Style**: Authoritative, complete, zero-assumption, non-speculative technical spec.

This specification outlines the complete logical design, mathematical algorithms, spatial setups, and programmatic TypeScript modules required to develop the core competitive loops of **WARDOGS**. It details the ControlZone, the drifting HotZone, FOB supplies, Cash/XP systems, the Team Scoring System, and the reactive SolidUI overlays.

---

## 1. Central Control Zone & Drifting HotZone Engine

### 1.1 Spatial Topology & Godot Mappings
The encounter center point is mapped directly over the central industrial sector of `MP_Granite_MilitaryStorage`. 

```text
  [Spatial Layout of the Triggers]
  
       +---------------------------------------------+
       | CONTROL ZONE (PolygonVolume, ObjId 900)     |
       | AreaTrigger_ControlZone_1_1                 |
       |                                             |
       |         +-------------------------+         |
       |         | DRIFTING HOTZONE        |         |
       |         | (AreaTrigger, ObjId 901)|         |
       |         | CapturePoint_HotZone_1_1|         |
       |         | (Radius: 15 meters)     |         |
       |         +-------------------------+         |
       |                                             |
       +---------------------------------------------+
```

*   **AreaTrigger_ControlZone_1_1 (ObjId 900)**: Defined by an opaque bounding `PolygonVolume` inside the Godot Scene layout [353]. It bounds the entire playable "Hill" area [353].
*   **CapturePoint_ControlZone_1_1 (ObjId 9000)**: The physical flagship pole representing the outer ring presence [354].
*   **AreaTrigger_HotZone_1_1 (ObjId 901)**: The smaller, dynamic target circle trigger that floats inside the larger Control Zone [356].
*   **CapturePoint_HotZone_1_1 (ObjId 9001)**: Represents the mobile flag pole that slides in 3D space [357].
*   **WorldIcon_ControlZone_1_1 (ObjId 903)** and **WorldIcon_HotZone_1_1 (ObjId 902)**: Floating world locator sprites displaying tactical metrics [354, 358].

#### Precise Map Coordinates
*   **ControlZone Center**: `x: 903.1109, y: 228.33812, z: 203.79422` [353].
*   **ControlZone Bounding Vertices**:
    *   `V1: (826.498, 195.0, 260.967)` [355]
    *   `V2: (845.551, 195.0, 261.098)` [355]
    *   `V3: (913.979, 195.0, 294.246)` [355]
    *   `V4: (814.402, 195.0, 172.954)` [356]
    *   `V5: (829.338, 195.0, 186.818)` [356]
    *   `V6: (825.681, 195.0, 198.701)` [356]

---

### 1.2 Mathematical Drift Vector Mechanics
The HotZone drifts continuously within the boundaries of the Control Zone polygon [623]. To prevent it from drifting outside the playable zone, the system uses a **Ray-Casting Point-in-Polygon (PIP) containment algorithm** [624].

Every **1.0 second**, the engine calculates the next tentative center coordinate:
$$\vec{P}_{\text{next}} = \vec{P}_{\text{current}} + \vec{V} \times \Delta t$$

If the PIP check fails (returning `false`), the movement velocity vector $\vec{V}$ is mirrored back toward the geometric center of the Control Zone [624]:
$$\vec{V}_{\text{new}} = -\vec{V} \times \text{RandomOffset}$$

```typescript
// src/features/hotzone/zone-math.ts
import { Vectors } from "bf6-portal-utils";

export interface Point2D { x: number; z: number; }

/**
 * Checks if a 2D coordinate resides inside a polygonal bounds using the Ray-Casting algorithm.
 */
export function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, zi = polygon[i].z;
        const xj = polygon[j].x, zj = polygon[j].z;

        const intersect = ((zi > point.z) !== (zj > point.z))
            && (point.x < (xj - xi) * (point.z - zi) / (zj - zi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

/**
 * Recalculates the drifting velocity vector of the HotZone.
 */
export class HotZoneDrifter {
    private currentPos: mod.Vector;
    private velocity: mod.Vector;
    private readonly speed = 2.0; // Meters per second
    private polygonVertices: Point2D[] = [
        { x: 826.498, z: 260.967 },
        { x: 845.551, z: 261.098 },
        { x: 913.979, z: 294.246 },
        { x: 814.402, z: 172.954 },
        { x: 829.338, z: 186.818 },
        { x: 825.681, z: 198.701 }
    ];

    constructor(startingPos: mod.Vector) {
        this.currentPos = startingPos;
        this.velocity = this.getRandomVelocity();
    }

    private getRandomVelocity(): mod.Vector {
        const angle = Math.random() * Math.PI * 2;
        return mod.CreateVector(Math.cos(angle) * this.speed, 0, Math.sin(angle) * this.speed);
    }

    public tickDrift(): mod.Vector {
        const nextX = mod.XComponentOf(this.currentPos) + mod.XComponentOf(this.velocity);
        const nextZ = mod.ZComponentOf(this.currentPos) + mod.ZComponentOf(this.velocity);
        
        const tentativePoint: Point2D = { x: nextX, z: nextZ };

        if (!isPointInPolygon(tentativePoint, this.polygonVertices)) {
            // Collision detected with bounds: invert velocity vectors and apply random deflection
            this.velocity = mod.Multiply(this.velocity, -1);
            const deflectionAngle = (Math.random() - 0.5) * 0.5; // +/- 14 degrees deflection
            this.velocity = mod.CreateVector(
                mod.XComponentOf(this.velocity) * Math.cos(deflectionAngle) - mod.ZComponentOf(this.velocity) * Math.sin(deflectionAngle),
                0,
                mod.XComponentOf(this.velocity) * Math.sin(deflectionAngle) + mod.ZComponentOf(this.velocity) * Math.cos(deflectionAngle)
            );
        }

        // Apply position delta
        this.currentPos = mod.CreateVector(
            mod.XComponentOf(this.currentPos) + mod.XComponentOf(this.velocity),
            mod.YComponentOf(this.currentPos),
            mod.ZComponentOf(this.currentPos) + mod.ZComponentOf(this.velocity)
        );

        return this.currentPos;
    }
}
```

---

## 2. Team Scoring & Ticket Bleed Mechanics

To bypass the native Battlefield Portal end-round block bugs, the WARDOGS scoring system tracks matches programmatically using dedicated TypeScript variables [616]. The maximum victory threshold is configured to **100 points** [615, 616].

### 2.1 The Majority-Rule Points Allocation Ticks
Scores are calculated on a **4.0-second background ticketing cycle** [41, 446]. The scoring loop evaluates player presence counts inside both triggers, applying the **Double Multiplier Rule** for any player inside the HotZone [623]:

$$\text{Team Presence Count} = \text{Players in ControlZone} + (2 \times \text{Players in HotZone})$$

```typescript
// src/features/scoreboard/score-updater.ts
import { Events, Timers } from "bf6-portal-utils";
import { mercenaryRegistry } from "../progression/profile";

export class TeamScoringSystem {
    public teamScores: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    private readonly victoryThreshold = 100;
    private zonePlayers: Map<number, { insideControl: boolean; insideHot: boolean }> = new Map();

    constructor() {
        this.initializeZoneListeners();
        this.startScoringTick();
    }

    private initializeZoneListeners(): void {
        // Outer Control Zone entry/exit hooks
        Events.OnPlayerEnterAreaTrigger.subscribe((player, trigger) => {
            const triggerId = mod.GetObjId(trigger);
            if (triggerId === 900) { // Outer Control Zone
                this.getOrCreateState(player).insideControl = true;
            } else if (triggerId === 901) { // Drifting HotZone
                this.getOrCreateState(player).insideHot = true;
            }
        });

        Events.OnPlayerExitAreaTrigger.subscribe((player, trigger) => {
            const triggerId = mod.GetObjId(trigger);
            if (triggerId === 900) {
                this.getOrCreateState(player).insideControl = false;
            } else if (triggerId === 901) {
                this.getOrCreateState(player).insideHot = false;
            }
        });
    }

    private getOrCreateState(player: mod.Player) {
        const id = mod.GetObjId(player);
        if (!this.zonePlayers.has(id)) {
            this.zonePlayers.set(id, { insideControl: false, insideHot: false });
        }
        return this.zonePlayers.get(id)!;
    }

    private startScoringTick(): void {
        Timers.setInterval(() => {
            const presence: Record<number, number> = { 1: 0, 2: 0, 3: 0 };

            // 1. Calculate Presence Scores
            mod.AllPlayers().forEach((player) => {
                if (!mod.GetSoldierState(player, mod.SoldierStateBool.IsAlive)) return;
                const teamId = mod.GetObjId(mod.GetTeam(player));
                if (teamId < 1 || teamId > 3) return; // Skip AI Team 4 or invalid observers

                const state = this.getOrCreateState(player);
                let multiplier = 0;

                if (state.insideHot) {
                    multiplier = 2; // HotZone multiplier [623]
                } else if (state.insideControl) {
                    multiplier = 1; // Outer zone baseline
                }

                presence[teamId] += multiplier;

                // Award cash tick to players currently holding the zone
                if (multiplier > 0) {
                    const profile = mercenaryRegistry.get(mod.GetObjId(player));
                    if (profile) {
                        const cashReward = multiplier === 2 ? 200 : 100;
                        profile.addCash(cashReward, "Zone Security Presence");
                    }
                }
            });

            // 2. Resolve Majority Ownership
            let leadingTeam = 0;
            let maxPresence = 0;
            let tie = false;

            for (let teamId = 1; teamId <= 3; teamId++) {
                if (presence[teamId] > maxPresence) {
                    maxPresence = presence[teamId];
                    leadingTeam = teamId;
                    tie = false;
                } else if (presence[teamId] === maxPresence && maxPresence > 0) {
                    tie = true;
                }
            }

            // Award tick point to the dominant team [616]
            if (leadingTeam > 0 && !tie) {
                this.teamScores[leadingTeam] = Math.min(this.victoryThreshold, this.teamScores[leadingTeam] + 1);
                this.evaluateVictory();
            }

            // Sync score changes to all player HUD overlays
            this.syncScoreHUDs();
        }, 4000); // Ticks every 4.0 seconds [616]
    }

    /**
     * Enforces the Ticket Bleed Fallback.
     * When a team player undeploys (absolute death), they subtract 1 point from their team's score [616].
     */
    public applyTicketBleed(teamId: number): void {
        if (teamId >= 1 && teamId <= 3) {
            this.teamScores[teamId] = Math.max(0, this.teamScores[teamId] - 1);
            this.syncScoreHUDs();
        }
    }

    private evaluateVictory(): void {
        for (let teamId = 1; teamId <= 3; teamId++) {
            if (this.teamScores[teamId] >= this.victoryThreshold) {
                console.log(`[WARDOGS SCORING] Faction ${teamId} has won the contract!`);
                // Enforce SDK End Game Workaround [616]: 
                // Target score is set to 1 in Portal Web config. Spawning victory calls EndGameMode.
                const winningTeam = mod.GetTeam(teamId);
                mod.EndGameMode(winningTeam);
            }
        }
    }

    private syncScoreHUDs(): void {
        mercenaryRegistry.forEach((profile) => {
            if (profile.ProgressUI) {
                profile.ProgressUI.updateBar(mod.GetTeam(1), this.teamScores[1]);
                profile.ProgressUI.updateBar(mod.GetTeam(2), this.teamScores[2]);
                profile.ProgressUI.updateBar(mod.GetTeam(3), this.teamScores[3]);
            }
        });
    }
}
```

---

## 3. FOB Supplies & Cooperative Supply Chain

The base-building sandbox of WARDOGS revolves around **Forward Operating Base (F.O.B) Materials Stockpiles** [625]. Support and Logistics roles must coordinate to fetch, transport, and secure raw supplies.

```text
  [THE WARDOGS LOGISTICS LOOP]
  
  GDF HQ SUPPLY TERMINAL                     FORWARD OPERATING BASE (FOB)
  - Intercept logistics trucks.             - Materials stored in Sector stockpile.
  - Load physical Cargo Packs. --------->   - Spend stockpile to repair sockets.
  - Grants Delivery cash payload ($800)     - Unbuilt sockets spawn indicator prompts.
```

### 3.1 Materials Stockpile Logic
F.O.B sectors do not rely on local variables. Instead, material counts are saved inside the scene's spatial **`Sector`** node container (`TowerSector_1_1` ObjId 3001) [122, 627].
*   **FOB Stockpile storage capacity**: Maximum **2,000 units** per F.O.B.
*   **Supply Crates**: Spawning at HQ helipads, trucks must transport cargo crates to F.O.B points. Delivering a crate adds **500 Materials** to the F.O.B. stockpile and awards the transporter **\$800 Delivery Cash** [621].

---

### 3.2 Dynamic Interactive Prompts
Unbuilt F.O.B. sockets do not render solid assets immediately. Instead, unbuilt sockets project world-space interactive prompts [634].

```typescript
// src/features/construction/fob-stockpile.ts
import { Events } from "bf6-portal-utils";
import { mercenaryRegistry } from "../progression/profile";

export class FobLogisticsManager {
    // Maps Sector ObjIds to active material stockpiles
    private fobMaterialStockpiles: Map<number, number> = new Map();
    private readonly deliveryDistance = 10.0; // Distance in meters to unload supplies

    constructor() {
        this.fobMaterialStockpiles.set(3001, 100); // Initialize FOB Alpha (Sector 3001) [627]
        this.registerLogisticsHooks();
    }

    private registerLogisticsHooks(): void {
        // Intercept logistics dropoffs near the FOB buy stations
        Events.OnPlayerInteract.subscribe((player, interactPoint) => {
            const interactId = mod.GetObjId(interactPoint);
            
            // Check if player is interacting with an FOB Buy Station (ObjIds 111, 221, 331) [630]
            if (interactId === 111 || interactId === 221 || interactId === 331) {
                this.tryUnloadSupplyCargo(player, interactId);
            }
        });
    }

    private tryUnloadSupplyCargo(player: mod.Player, buyStationId: number): void {
        const playerId = mod.GetObjId(player);
        const profile = mercenaryRegistry.get(playerId);
        if (!profile) return;

        // Check if player is carrying a role-defining Logistics Cargo Pack
        // Repurposed from custom inventory slots or carrying states
        if (mod.HasEquipment(player, mod.Gadgets.U_Gadget_SupplyCrate)) {
            // Remove the cargo pack
            mod.RemoveEquipment(player, mod.InventorySlots.GadgetOne);

            // Resolve target Sector based on buyStationId
            const targetSectorId = this.getSectorFromBuyStation(buyStationId);
            const currentStock = this.fobMaterialStockpiles.get(targetSectorId) ?? 0;

            // Add 500 materials to F.O.B. stockpile [625]
            const newStock = Math.min(2000, currentStock + 500);
            this.fobMaterialStockpiles.set(targetSectorId, newStock);

            // Award Delivery cash and XP [621]
            profile.addCash(800, "Logistics Cargo Delivery");
            profile.addTrackXp("Driver", 300); // Driver role progression [619]

            mod.DisplayNotificationMessage(
                mod.Message("SUPPLIES DELIVERED: +500 FOB Materials. Earnings Issued: +$800, +300 Driver XP"),
                player
            );
        }
    }

    private getSectorFromBuyStation(buyStationId: number): number {
        switch (buyStationId) {
            case 111: return 3001; // Alpha FOB [627]
            case 221: return 3002; // Beta FOB
            case 331: return 3003; // Gamma FOB
            default: return 3001;
        }
    }

    public getFobStockpile(sectorId: number): number {
        return this.fobMaterialStockpiles.get(sectorId) ?? 0;
    }

    public consumeMaterials(sectorId: number, amount: number): boolean {
        const current = this.getFobStockpile(sectorId);
        if (current < amount) return false;

        this.fobMaterialStockpiles.set(sectorId, current - amount);
        return true;
    }
}
```

---

## 4. Integrated Rewards & XP Field Progression

### 4.1 Faction Action Cash Rewards
Every transaction delta updates securely through transactional triggers to safeguard player wallets [622].

*   **Hostile Termination**: `+$500 Cash` (combat profile reward) [621].
*   **Defibrillator Revive**: `+$300 Cash` awarded directly to the revive doctor [621].
*   **Engineering shovel construction swing**: `+$100 Cash` per build progression strike [621].
*   **Recon Range-Finder spot assist**: `+$50 Cash` [621].
*   **Passenger Transport taxi dropoff**: `+$200 Cash` per teammate transported from HQ boundaries [621].
*   **Concentric Zone Presence Tick**: `+$100 Cash` every 4 seconds [621].
*   **HotZone Multiplier Presence Tick**: `+$200 Cash` every 4 seconds [621].

---

### 4.2 Mastery Leveling Progression (XP Tracks)
XP tracks are cumulative and permanent for the duration of the match [620]. Scoring actions Native to a discipline award XP directly to that track [619]:

*   **Assault (Rifle Combat)**: `+150 XP` per active firearm kill [619].
*   **Medic (Reviving/Healing)**: `+200 XP` per field revive / full healing crate charge [619].
*   **Recon (Laser Designations)**: `+100 XP` per range-finder target spot assist [619].
*   **Support (FOB construction)**: `+120 XP` per socket upgrade built or repaired [619].
*   **Driver (Land logistics)**: `+250 XP` per 500m of cargo logistics transport [619].
*   **Pilot (Air insertions)**: `+300 XP` per air drop insertion dropoff [619].

#### Cumulative Level XP Requirements:
*   **Tier 1**: `0 XP`
*   **Tier 2**: `1,000 XP`
*   **Tier 3**: `2,500 XP`
*   **Tier 4**: `5,000 XP`
*   **Tier 5**: `10,000 XP`

---

## 5. Unified Reactive User Interface (SolidUI & ParseUI)

To maximize performance, WARDOGS leverages **`bf6-portal-utils/solid-ui`** to implement fine-grained, reactive UI signals [623]. UI nodes only redraw when their underlying state changes, completely avoiding costly per-tick recalculations [623].

```text
  [THE WARDOGS REACTIVE HUD OVERLAY]
  
  (TOP)      [ |||||||||| Friendly Team Progress: 43/100 ] -- [ Enemy Team Progress: 21/100 |||||||||| ]
  
  (LEFT)     [ WALLET: $10,500 ]  <-- Updates only when cash changes
             [ (+$500) Kill Earned ] <-- Fades out dynamically
             
  (RIGHT)    [ CLASS PROGRESS: Support Tier 3 ]
             [ XP: 3,450 / 5,000 ]
```

### 5.1 Faction Progress HUD (Screen Top)
Tracks Friendly vs. Enemy match points dynamically using dual progress bars [482, 484].
*   **Main Progress Bar (Friendly)**: Renders using Faction Cyan: `[0.380, 0.878, 1.000]` [484].
*   **Main Progress Bar (Enemy)**: Renders using Hostile Orange: `[1.000, 0.561, 0.384]` [484].
*   **Point Delta Indicator**: Highlights point deltas dynamically on score changes.

---

### 5.2 Dynamic WorldIcons & Prompts
*   **ControlZone Locator Indicator**: Spawned floating above the outer conquest pole, displaying the localized string key: `"CONTROL ZONE\nSecure Sector"`.
*   **HotZone Multiplier Indicator**: Floating danger ping sprite above the mobile flag pole: `"HOTZONE [2X POINTS]\nFIGHT HERE!"` [624].

---

### 5.3 Live Wallet HUD (Screen Left)
Updates reactively whenever player balances change, flashing a green transaction delta before fading out [484]:
*   **Wallet Balance**: Renders top-left corner: `WALLET: ${Balance}` [228, 484].
*   **Transaction delta feedback**: `+$500 (Kill Confirmed)` or `-$1,500 (AA Surcharge Penalty)` [484].

---

### 5.4 High-Performance SolidUI Overlay Declarations

This complete module manages the reactive HUD overlays using `solid-ui` and the SDK's declarative `ParseUI` framework [623, 631].

```typescript
// src/features/scoreboard/reactive-hud.ts
import { ParseUI, toMessage, toVector } from "../construction/radial-build";
import { PlayerProfile } from "../progression/profile";

export class WardogsReactiveHUD {
    private player: mod.Player;
    private playerId: number;
    private rootCanvas: mod.UIWidget | null = null;
    
    // Core Reactive Elements
    private walletLabel: mod.UIWidget | null = null;
    private cashFeedbackLabel: mod.UIWidget | null = null;
    private scoreBarFriendly: mod.UIWidget | null = null;
    private scoreBarEnemy: mod.UIWidget | null = null;
    private scoreTextFriendly: mod.UIWidget | null = null;
    private scoreTextEnemy: mod.UIWidget | null = null;

    private readonly barMaxWidth = 200;
    private readonly barHeight = 15;

    constructor(profile: PlayerProfile) {
        this.player = profile.player;
        this.playerId = profile.playerId;
        this.initializeHUD();
    }

    /**
     * Constructs the top top-center score panels and wallet counters using ParseUI.
     */
    private initializeHUD(): void {
        const suffix = `_${this.playerId}`;

        this.rootCanvas = ParseUI({
            type: "Container",
            name: `WardogsHUD_Root${suffix}`,
            position: mod.CreateVector(0, 0, 0),
            size: mod.CreateVector(1920, 1080, 0), // Full-screen canvas
            anchor: mod.UIAnchor.Center,
            bgColor: mod.CreateVector(0, 0, 0),
            bgAlpha: 0.0, // Transparent overlay canvas
            bgFill: mod.UIBgFill.None,
            visible: true,
            children: [
                // 1. DYNAMIC WALLET COUNTER (Top-Left Screen) [228, 484]
                {
                    type: "Text",
                    name: `HUD_Wallet${suffix}`,
                    textLabel: mod.Message("WALLET: $10,000"),
                    position: mod.CreateVector(50, 50, 1),
                    size: mod.CreateVector(250, 40, 0),
                    textSize: 26,
                    textColor: mod.CreateVector(0.4, 0.9, 0.4), // Finance Green
                    textAnchor: mod.UIAnchor.TopLeft,
                    anchor: mod.UIAnchor.TopLeft,
                    bgFill: mod.UIBgFill.None
                },
                // 2. TRANSACTION DELTA FEEDBACK [484]
                {
                    type: "Text",
                    name: `HUD_CashFeedback${suffix}`,
                    textLabel: mod.Message(""),
                    position: mod.CreateVector(50, 95, 1),
                    size: mod.CreateVector(300, 30, 0),
                    textSize: 18,
                    textColor: mod.CreateVector(1, 1, 1),
                    textAnchor: mod.UIAnchor.TopLeft,
                    anchor: mod.UIAnchor.TopLeft,
                    visible: false,
                    bgFill: mod.UIBgFill.None
                },

                // 3. CO-OP FACTION SCOREBOARD PANEL (Top-Center Screen) [484]
                // Friendly Team Score Bar (Cyan) [484]
                {
                    type: "Container",
                    name: `HUD_FriendlyScoreBg${suffix}`,
                    position: mod.CreateVector(-110, 40, 1),
                    size: mod.CreateVector(this.barMaxWidth, this.barHeight, 0),
                    bgColor: mod.CreateVector(0.06, 0.19, 0.26), // Deep Cyan Dark
                    bgAlpha: 0.8,
                    anchor: mod.UIAnchor.TopCenter
                },
                {
                    type: "Container",
                    name: `HUD_FriendlyScoreFill${suffix}`,
                    position: mod.CreateVector(-110, 40, 2),
                    size: mod.CreateVector(0, this.barHeight, 0), // Resized dynamically
                    bgColor: mod.CreateVector(0.380, 0.878, 1.000), // GDF Cyan [484]
                    bgAlpha: 1.0,
                    anchor: mod.UIAnchor.TopCenter
                },
                {
                    type: "Text",
                    name: `HUD_FriendlyScoreText${suffix}`,
                    textLabel: mod.Message("0"),
                    position: mod.CreateVector(-330, 40, 2),
                    size: mod.CreateVector(50, 35, 0),
                    textSize: 22,
                    textColor: mod.CreateVector(0.380, 0.878, 1.000),
                    textAnchor: mod.UIAnchor.Center,
                    anchor: mod.UIAnchor.TopCenter
                },

                // Enemy Team Score Bar (Orange) [484]
                {
                    type: "Container",
                    name: `HUD_EnemyScoreBg${suffix}`,
                    position: mod.CreateVector(110, 40, 1),
                    size: mod.CreateVector(this.barMaxWidth, this.barHeight, 0),
                    bgColor: mod.CreateVector(0.26, 0.10, 0.07), // Deep Orange Dark
                    bgAlpha: 0.8,
                    anchor: mod.UIAnchor.TopCenter
                },
                {
                    type: "Container",
                    name: `HUD_EnemyScoreFill${suffix}`,
                    position: mod.CreateVector(110, 40, 2),
                    size: mod.CreateVector(0, this.barHeight, 0), // Resized dynamically
                    bgColor: mod.CreateVector(1.000, 0.561, 0.384), // Hostile Orange [484]
                    bgAlpha: 1.0,
                    anchor: mod.UIAnchor.TopCenter
                },
                {
                    type: "Text",
                    name: `HUD_EnemyScoreText${suffix}`,
                    textLabel: mod.Message("0"),
                    position: mod.CreateVector(330, 40, 2),
                    size: mod.CreateVector(50, 35, 0),
                    textSize: 22,
                    textColor: mod.CreateVector(1.000, 0.561, 0.384),
                    textAnchor: mod.UIAnchor.Center,
                    anchor: mod.UIAnchor.TopCenter
                }
            ],
            playerId: this.player
        }) as mod.UIWidget;

        // Secure widget element references
        this.walletLabel = mod.FindUIWidgetWithName(`HUD_Wallet${suffix}`) as mod.UIWidget;
        this.cashFeedbackLabel = mod.FindUIWidgetWithName(`HUD_CashFeedback${suffix}`) as mod.UIWidget;
        this.scoreBarFriendly = mod.FindUIWidgetWithName(`HUD_FriendlyScoreFill${suffix}`) as mod.UIWidget;
        this.scoreBarEnemy = mod.FindUIWidgetWithName(`HUD_EnemyScoreFill${suffix}`) as mod.UIWidget;
        this.scoreTextFriendly = mod.FindUIWidgetWithName(`HUD_FriendlyScoreText${suffix}`) as mod.UIWidget;
        this.scoreTextEnemy = mod.FindUIWidgetWithName(`HUD_EnemyScoreText${suffix}`) as mod.UIWidget;
    }

    /**
     * Triggers fine-grained reactive redraw of the cash wallet HUD.
     */
    public updateWalletUI(currentCash: number, deltaAmount?: number, deltaReason?: string): void {
        if (this.walletLabel) {
            mod.SetUITextLabel(this.walletLabel, mod.Message("WALLET: ${}", currentCash));
        }

        // Handle flashing transaction delta feedback if provided
        if (deltaAmount && deltaAmount !== 0 && this.cashFeedbackLabel) {
            const isCredit = deltaAmount > 0;
            const sign = isCredit ? "+" : "-";
            const text = `${sign}$${Math.abs(deltaAmount)} (${deltaReason ?? "Earnings"})`;
            
            mod.SetUITextLabel(this.cashFeedbackLabel, mod.Message(text));
            mod.SetUITextColor(this.cashFeedbackLabel, isCredit ? mod.CreateVector(0.4, 0.9, 0.4) : mod.CreateVector(0.9, 0.4, 0.4));
            mod.SetUIWidgetVisible(this.cashFeedbackLabel, true);

            // Programmatically hide delta after 3 seconds using the Timers module [370]
            mod.Wait(3.0).then(() => {
                if (this.cashFeedbackLabel) {
                    mod.SetUIWidgetVisible(this.cashFeedbackLabel, false);
                }
            });
        }
    }

    /**
     * Gradually updates team score progress bars top-screen.
     */
    public updateTeamScoreUI(friendlyScore: number, enemyScore: number): void {
        const maxScore = 100;
        
        const friendlyScale = Math.min(1.0, Math.max(0.0, friendlyScore / maxScore));
        const enemyScale = Math.min(1.0, Math.max(0.0, enemyScore / maxScore));

        if (this.scoreBarFriendly && this.scoreTextFriendly) {
            mod.SetUIWidgetSize(this.scoreBarFriendly, mod.CreateVector(this.barMaxWidth * friendlyScale, this.barHeight, 0));
            mod.SetUITextLabel(this.scoreTextFriendly, mod.Message("{}", friendlyScore));
        }

        if (this.scoreBarEnemy && this.scoreTextEnemy) {
            mod.SetUIWidgetSize(this.scoreBarEnemy, mod.CreateVector(this.barMaxWidth * enemyScale, this.barHeight, 0));
            mod.SetUITextLabel(this.scoreTextEnemy, mod.Message("{}", enemyScore));
        }
    }
}
```
