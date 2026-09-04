// src/features/scavenger/scavenger-drop.ts
import { Events, Timers } from "bf6-portal-utils";
import { mercenaryRegistry, PlayerProfile } from "../progression/profile";

/**
 * Interface representing an active scavenger backpack drop on the battlefield.
 */
export interface ActiveScavengerDrop {
    id: string;                      // Unique drop UUID
    position: mod.Vector;            // Coordinate center of the drop
    lootObject3D: mod.SpatialObject; // Spawned physical backpack / supplies prop
    interactPoint: any;              // Dynamically spawned InteractPoint for native E use keys
    worldIcon: mod.WorldIcon;        // Floating 3D visual indicator above the drop
    spawnTime: number;               // Timestamp when spawned (in milliseconds)
    ownerTeamId: number;             // Faction team of the dead soldier
}

/**
 * Advanced Scavenger Kit Loot Drop System for WARDOGS (v2).
 * 
 * DESIGN PHILOSOPHY:
 * In WARDOGS, every death has high stakes. When a contractor dies, they drop their 
 * expensive primary gear, but their leftover supplies persist in the world as a "Scavenger Backpack".
 * Other players can retrieve these kits using the native use/interact key [E] to restock 
 * ammunition and claim a portion of their bank earnings.
 * 
 * CORE REVISIONS (v2):
 * 1. Native Interaction: Spawns an InteractPoint alongside the backpack prop so players use 
 *    the native [E] button to pick it up, eliminating the CPU-intensive 10Hz proximity polling loop.
 * 2. Visual Prompting: Employs a WorldIcon showing a localized "Press [E] to Scavenge" text above the kit.
 * 3. Garbage Collection: Rigid, configurable 60-second expiration timers automatically delete unlooted 
 *    containers to preserve server performance and entities limit.
 */
export class ScavengerDropSystem {
    private activeDrops: Map<string, ActiveScavengerDrop> = new Map();
    private garbageCollectionTimer: any = null;
    
    // Configurable balancing thresholds
    private readonly dropDuration = 60000;       // Configurable GC window [60s default]
    private readonly minCashReward = 150;        // Minimum salvaged cash
    private readonly maxCashReward = 350;        // Maximum salvaged cash
    private readonly trackXpReward = 100;        // XP awarded to the scavenger
    
    constructor() {
        this.initializeScavengerHooks();
        this.startGarbageCollector();
    }

    /**
     * Binds lifecycle event listeners via the central Events broker.
     */
    private initializeScavengerHooks(): void {
        // Drop the kit when a player undeploys (absolute death, not revivable anymore)
        Events.OnPlayerUndeploy.subscribe((player) => {
            if (mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier)) return;
            this.handlePlayerDrop(player);
        });

        // Intercept native interact keypresses on our dynamically spawned interact points
        Events.OnPlayerInteract.subscribe(async (player, interactPoint) => {
            if (mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier)) return;
            
            const interactPointId = mod.GetObjId(interactPoint);
            let matchedDropId: string | null = null;

            this.activeDrops.forEach((drop, dropId) => {
                if (drop.interactPoint && mod.GetObjId(drop.interactPoint) === interactPointId) {
                    matchedDropId = dropId;
                }
            });

            if (matchedDropId) {
                this.executeScavenge(player, matchedDropId);
            }
        });

        // Clean up active loop on game over to prevent microtask leaks
        Events.OnGameModeEnding.subscribe(() => {
            this.shutdown();
        });
    }

    /**
     * Starts a slow 5-second background clock to sweep and delete expired loot bags.
     * Since interactions are event-driven, we do not need high-frequency tick polling.
     */
    private startGarbageCollector(): void {
        this.garbageCollectionTimer = Timers.setInterval(() => {
            const now = Date.now();
            this.activeDrops.forEach((drop, dropId) => {
                if (now - drop.spawnTime >= this.dropDuration) {
                    console.log(`[SCAVENGER GC] Sweeping expired Scavenger Backpack: ${dropId}`);
                    this.despawnDrop(dropId);
                }
            });
        }, 5000); // 5-second lazy sweeper
    }

    /**
     * Spawns a physical backpack prop, a WorldIcon hint text, and an InteractPoint.
     */
    private handlePlayerDrop(player: mod.Player): void {
        const playerId = mod.GetObjId(player);
        const playerTeam = mod.GetTeam(player);
        const teamId = mod.GetObjId(playerTeam);
        
        // Retrieve the exact position of the soldier's ragdoll
        const deathPosition = mod.GetSoldierState(player, mod.SoldierStateVector.GetPosition);
        
        // Zero-component safety check (prevents spawning at map origin on glitch deaths)
        if (mod.XComponentOf(deathPosition) === 0 && mod.ZComponentOf(deathPosition) === 0) {
            return;
        }

        const dropId = `drop_${playerId}_${Date.now()}`;

        // 1. Spawn the Physical Backpack Object
        const spawnPos = mod.CreateVector(
            mod.XComponentOf(deathPosition),
            mod.YComponentOf(deathPosition) + 0.1,
            mod.ZComponentOf(deathPosition)
        );
        const propObject = mod.SpawnObject(
            mod.RuntimeSpawn_Common.SuppliesPack_01, // Backpack / supplies prop
            spawnPos,
            mod.CreateVector(0, mod.GetPlayerYaw(player), 0)
        );

        // 2. Spawn the native InteractPoint at the exact same location
        const interactPointObj = mod.SpawnObject(
            mod.RuntimeSpawn_Common.InteractPoint,
            spawnPos,
            mod.CreateVector(0, 0, 0)
        );
        // Enable interaction with the newly spawned point
        mod.EnableInteractPoint(interactPointObj, true);

        // 3. Spawn a WorldIcon above the container to draw player attention and show E hint
        const iconPos = mod.CreateVector(
            mod.XComponentOf(deathPosition),
            mod.YComponentOf(deathPosition) + 0.8,
            mod.ZComponentOf(deathPosition)
        );
        const worldIconObj = mod.SpawnObject(
            mod.RuntimeSpawn_Common.WorldIcon,
            iconPos,
            mod.CreateVector(0, 0, 0)
        );

        // Configure indicator properties and E hint natively
        mod.SetWorldIconImage(worldIconObj, mod.WorldIconImages.Cross);
        mod.EnableWorldIconImage(worldIconObj, true);
        mod.SetWorldIconColor(worldIconObj, mod.CreateVector(0.4, 0.9, 0.4)); // Medical/Scavenger Green
        mod.EnableWorldIconText(worldIconObj, true);
        mod.SetWorldIconText(worldIconObj, mod.Message("SCAVENGER BACKPACK\\nPress [E] to Scavenge"));

        // Save drop structure into active memory map
        const newDrop: ActiveScavengerDrop = {
            id: dropId,
            position: spawnPos,
            lootObject3D: propObject,
            interactPoint: interactPointObj,
            worldIcon: worldIconObj,
            spawnTime: Date.now(),
            ownerTeamId: teamId
        };

        this.activeDrops.set(dropId, newDrop);
        console.log(`[SCAVENGER] Backpack drop spawned: ${dropId} at ${mod.XComponentOf(spawnPos)}, ${mod.ZComponentOf(spawnPos)}`);
    }

    /**
     * Executes the scavenging transaction when a player interacts with a backpack.
     */
    private executeScavenge(scavenger: mod.Player, dropId: string): void {
        const drop = this.activeDrops.get(dropId);
        if (!drop) return;

        const scavengerId = mod.GetObjId(scavenger);
        const profile = mercenaryRegistry.get(scavengerId);

        if (!profile) return;

        // --- 1. RESOLVE ECONOMIC AND XP REWARDS ---
        const salvagedCash = Math.floor(Math.random() * (this.maxCashReward - this.minCashReward + 1)) + this.minCashReward;
        profile.addCash(salvagedCash, "Scavenged Backpack");

        // Award progression track XP to the scavenger
        profile.addTrackXp("Assault", this.trackXpReward);

        // --- 2. RESTOCK WEAPON AMMUNITION ---
        const activeWeapon = mod.GetInventoryEquipment(scavenger, mod.InventorySlots.PrimaryWeapon);
        if (activeWeapon) {
            // Restore full ammo to active weapon
            mod.SetInventoryAmmo(scavenger, mod.InventorySlots.PrimaryWeapon, 500);
            mod.SetInventoryMagazineAmmo(scavenger, mod.InventorySlots.PrimaryWeapon, 500);
        }

        // --- 3. AUDITORY AND VISUAL FEEDBACK ---
        const scavengerEyePos = mod.GetSoldierState(scavenger, mod.SoldierStateVector.EyePosition);
        const pickupSfx = mod.SpawnObject(
            mod.RuntimeSpawn_Common.SFX_Gadgets_Defibrillator_Equipped_Fire_OneShot2D,
            scavengerEyePos,
            mod.CreateVector(0,0,0)
        );
        mod.PlaySound(pickupSfx, 60);

        // Flash HUD notification message
        mod.DisplayNotificationMessage(
            mod.Message("BACKPACK LOOTED: Ammo Restocked, Salvaged ${} Cash, +{} Assault XP", salvagedCash, this.trackXpReward),
            scavenger
        );

        // Despawn assets and release engine entities
        this.despawnDrop(dropId);
        console.log(`[SCAVENGER LOOTED] Contractor ${profile.name} looted backpack ${dropId}. Salvaged $${salvagedCash}`);
    }

    /**
     * Physical despawner that releases game engine entities back to the memory pool.
     */
    private despawnDrop(dropId: string): void {
        const drop = this.activeDrops.get(dropId);
        if (!drop) return;

        // Destroy physical prop, interact point, and icon entities natively
        mod.UnspawnObject(drop.lootObject3D);
        mod.UnspawnObject(drop.interactPoint);
        mod.UnspawnObject(drop.worldIcon);

        this.activeDrops.delete(dropId);
    }

    /**
     * Shutdown interface to safely terminate the background timers during match transitions.
     */
    public shutdown(): void {
        if (this.garbageCollectionTimer !== null) {
            Timers.clearInterval(this.garbageCollectionTimer);
            this.garbageCollectionTimer = null;
        }

        // Clear all remaining visual assets
        this.activeDrops.forEach((_, dropId) => {
            this.despawnDrop(dropId);
        });
        this.activeDrops.clear();
    }
}
