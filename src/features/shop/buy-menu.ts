// src/features/shop/buy-menu.ts
import { SolidUI } from "bf6-portal-utils/solid-ui";
import { Events } from "bf6-portal-utils/events";
import { Timers } from "bf6-portal-utils/timers";
import { mercenaryRegistry, TrackData, ProgressionTrackKey } from "../progression/profile";

// Module-level map to track active buy menus by player ID (replaces profile.ShopUI)
const activeBuyMenus = new Map<number, WardogsBuyMenu>();

// Export accessor for external references
export function getBuyMenu(playerId: number): WardogsBuyMenu | undefined {
    return activeBuyMenus.get(playerId);
}
import { 
    carbinePackage_Tier1, 
    carbinePackage_Tier3, 
    carbinePackage_Tier5 
} from "./weapon-packages";

/**
 * Interface representing a purchasable asset in the WARDOGS Shop.
 */
export interface ShopItem {
    id: string;
    name: string;                   // Custom name or localizable string key
    baseCost: number;               // Unlocked standard price
    requiredTrack: ProgressionTrackKey;
    requiredTier: number;           // Tier 1 to 5
    gearType: "weapon" | "gadget" | "emplacement" | "vehicle_key";
    assetId: any;                   // SDK enum mapped asset reference
    weaponPackage?: any;            // Pre-compiled WeaponPackage containing attachments
    isPooled: boolean;              // If true, multiple players can contribute cash
    pooledCash: number;             // Track current team/squad contribution
    imageType: mod.UIImageType;     // Background visual or weapon card type
}

/**
 * Tab definitions matching class-free role contexts.
 */
export enum ShopTab {
    Assault = "Assault",
    Medic = "Medic",
    Recon = "Recon",
    Support = "Support",
    Logistics = "Logistics",
    FobUpgrades = "FobUpgrades"
}

/**
 * Core Buy Menu class managing ParseUI widgets, reactive layouts, and transactions.
 * Designed using inspiration from BombSquadExample (modular UI layout) and 
 * WarFactoryExample (pooled base upgrades and coordinate orientation).
 */
export class WardogsBuyMenu {
    private player: mod.Player;
    private playerId: number;
    private rootWidget: mod.UIWidget | null = null;
    private activeTab: ShopTab = ShopTab.Assault;
    private selectedItem: ShopItem | null = null;
    private isStoreVisible: boolean = false;

    // Track created dynamic button and text widgets to perform fast updates on tick
    private buttonWidgets: Map<string, mod.UIWidget> = new Map();
    private labelWidgets: Map<string, mod.UIWidget> = new Map();

    private readonly maxPenaltyMultiplier = 2.0; // 200% maximum pro-rated surcharge for tier deficits

    constructor(player: mod.Player) {
        this.player = player;
        this.playerId = mod.GetObjId(player);
        activeBuyMenus.set(this.playerId, this);
        this.initializeUI();
    }

    /**
     * Initializes the centering 1200x700 ParseUI store canvas container.
     */
    private initializeUI(): void {
        const uniqueSuffix = `_${this.playerId}`;

        // Construct the modular Buy Menu canvas using declarative object trees
        this.rootWidget = mod.ParseUI({
            type: "Container",
            name: `WardogsShop_Root${uniqueSuffix}`,
            position: mod.CreateVector(0, 0, 0),
            size: mod.CreateVector(1200, 700, 0),
            anchor: mod.UIAnchor.Center,
            bgColor: mod.CreateVector(0.05, 0.07, 0.09), // Highly polished deep navy/grey
            bgAlpha: 0.95,
            bgFill: mod.UIBgFill.Blur,
            visible: false,
            children: [
                // 1. HEADER TITLE BAR
                {
                    type: "Text",
                    name: `Shop_Header_Title${uniqueSuffix}`,
                    textLabel: mod.Message("WARDOGS HQ ACQUISITIONS"),
                    position: mod.CreateVector(40, -310, 1),
                    size: mod.CreateVector(400, 50, 0),
                    textSize: 36,
                    textColor: mod.CreateVector(0.380, 0.878, 1.000), // WARDOGS signature cyan
                    textAnchor: mod.UIAnchor.CenterLeft,
                    anchor: mod.UIAnchor.Center
                },
                {
                    type: "Text",
                    name: `Shop_Header_Subtitle${uniqueSuffix}`,
                    textLabel: mod.Message("CLASS-FREE PROCUREMENT SUITE"),
                    position: mod.CreateVector(40, -280, 1),
                    size: mod.CreateVector(400, 20, 0),
                    textSize: 16,
                    textColor: mod.CreateVector(0.5, 0.6, 0.7),
                    textAnchor: mod.UIAnchor.CenterLeft,
                    anchor: mod.UIAnchor.Center
                },

                // 2. WALLET DISPLAY
                {
                    type: "Text",
                    name: `Shop_Wallet${uniqueSuffix}`,
                    textLabel: mod.Message("WALLET: ${}", 10000), // Updated reactively in open()
                    position: mod.CreateVector(-40, -310, 1),
                    size: mod.CreateVector(300, 40, 0),
                    textSize: 28,
                    textColor: mod.CreateVector(0.4, 0.9, 0.4), // Financial Green
                    textAnchor: mod.UIAnchor.CenterRight,
                    anchor: mod.UIAnchor.Center
                },

                // 3. TABS SIDE PANEL
                this.buildTabsSidebar(),

                // 4. ITEM GRID WINDOW
                this.buildItemGridPanel(),

                // 5. DETAIL PREVIEW PANEL
                this.buildDetailPreviewPanel(),

                // 6. BOTTOM CLOSE BAR
                {
                    type: "Button",
                    name: `Shop_CloseBtn${uniqueSuffix}`,
                    position: mod.CreateVector(0, 310, 1),
                    size: mod.CreateVector(250, 45, 0),
                    anchor: mod.UIAnchor.Center,
                    buttonColorBase: mod.CreateVector(0.78, 0.28, 0.28), // Soft Red
                    buttonAlphaBase: 0.8,
                    buttonColorHover: mod.CreateVector(1.0, 0.35, 0.35),
                    bgFill: mod.UIBgFill.Solid
                },
                {
                    type: "Text",
                    name: `Shop_CloseLabel${uniqueSuffix}`,
                    textLabel: mod.Message("CLOSE PROTOCOL [ESC]"),
                    position: mod.CreateVector(0, 310, 2),
                    size: mod.CreateVector(250, 45, 0),
                    textSize: 18,
                    textColor: mod.CreateVector(1, 1, 1),
                    textAnchor: mod.UIAnchor.Center,
                    anchor: mod.UIAnchor.Center
                }
            ],
            playerId: this.player
        }) as mod.UIWidget;

        // Register interaction callbacks
        const closeBtn = mod.FindUIWidgetWithName(`Shop_CloseBtn${uniqueSuffix}`) as mod.UIWidget;
        mod.EnableUIButtonEvent(closeBtn, mod.UIButtonEvent.ButtonDown, true);
    }

    /**
     * Builds the left sidebar panel harboring the shop division tabs.
     */
    private buildTabsSidebar(): any {
        const uniqueSuffix = `_${this.playerId}`;
        const tabs: any[] = [];
        const tabKeys = Object.keys(ShopTab) as ShopTab[];

        tabKeys.forEach((tab, index) => {
            const yOffset = -180 + (index * 65);
            tabs.push(
                {
                    type: "Button",
                    name: `ShopTabBtn_${tab}${uniqueSuffix}`,
                    position: mod.CreateVector(-480, yOffset, 1),
                    size: mod.CreateVector(180, 50, 0),
                    buttonColorBase: mod.CreateVector(0.12, 0.16, 0.22),
                    buttonAlphaBase: 0.9,
                    bgFill: mod.UIBgFill.Solid,
                    anchor: mod.UIAnchor.Center
                },
                {
                    type: "Text",
                    name: `ShopTabLabel_${tab}${uniqueSuffix}`,
                    textLabel: mod.Message(tab.toUpperCase()),
                    position: mod.CreateVector(-480, yOffset, 2),
                    size: mod.CreateVector(180, 50, 0),
                    textSize: 16,
                    textColor: mod.CreateVector(0.8, 0.9, 1.0),
                    textAnchor: mod.UIAnchor.Center,
                    anchor: mod.UIAnchor.Center
                }
            );
        });

        return {
            type: "Container",
            name: `Shop_Sidebar${uniqueSuffix}`,
            position: mod.CreateVector(-480, 40, 1),
            size: mod.CreateVector(200, 520, 0),
            bgColor: mod.CreateVector(0.08, 0.11, 0.16),
            bgAlpha: 0.7,
            anchor: mod.UIAnchor.Center,
            children: tabs
        };
    }

    /**
     * Builds the center grid panel that lists purchasable items for the active tab.
     */
    private buildItemGridPanel(): any {
        const uniqueSuffix = `_${this.playerId}`;
        const gridItems: any[] = [];

        // Pre-allocate 6 grid button containers (3 columns x 2 rows)
        for (let row = 0; row < 2; row++) {
            for (let col = 0; col < 3; col++) {
                const index = row * 3 + col;
                const xPos = -190 + (col * 190);
                const yPos = -120 + (row * 240);

                gridItems.push(
                    // Base Card Background
                    {
                        type: "Container",
                        name: `ShopItemCard_${index}${uniqueSuffix}`,
                        position: mod.CreateVector(xPos, yPos, 2),
                        size: mod.CreateVector(175, 215, 0),
                        bgColor: mod.CreateVector(0.08, 0.11, 0.16),
                        bgAlpha: 0.8,
                        bgFill: mod.UIBgFill.OutlineThin,
                        anchor: mod.UIAnchor.Center
                    },
                    // Weapon/Item Silhouetted Render Image
                    {
                        type: "Image",
                        name: `ShopItemImg_${index}${uniqueSuffix}`,
                        position: mod.CreateVector(xPos, yPos - 30, 3),
                        size: mod.CreateVector(150, 80, 0),
                        imageType: mod.UIImageType.None, // Populated reactively on refresh()
                        imageColor: mod.CreateVector(0.8, 0.9, 1.0),
                        anchor: mod.UIAnchor.Center
                    },
                    // Item Name Label
                    {
                        type: "Text",
                        name: `ShopItemName_${index}${uniqueSuffix}`,
                        textLabel: mod.Message("UNASSIGNED"),
                        position: mod.CreateVector(xPos, yPos + 35, 3),
                        size: mod.CreateVector(160, 20, 0),
                        textSize: 15,
                        textColor: mod.CreateVector(1, 1, 1),
                        textAnchor: mod.UIAnchor.Center,
                        anchor: mod.UIAnchor.Center
                    },
                    // Dynamic Cost Display
                    {
                        type: "Text",
                        name: `ShopItemCost_${index}${uniqueSuffix}`,
                        textLabel: mod.Message(""),
                        position: mod.CreateVector(xPos, yPos + 60, 3),
                        size: mod.CreateVector(160, 20, 0),
                        textSize: 14,
                        textColor: mod.CreateVector(0.4, 0.9, 0.4),
                        textAnchor: mod.UIAnchor.Center,
                        anchor: mod.UIAnchor.Center
                    },
                    // Transaction Click Interceptor Button
                    {
                        type: "Button",
                        name: `ShopItemBtn_${index}${uniqueSuffix}`,
                        position: mod.CreateVector(xPos, yPos, 4),
                        size: mod.CreateVector(175, 215, 0),
                        buttonColorBase: mod.CreateVector(1, 1, 1),
                        buttonAlphaBase: 0.01, // Near-invisible overlay button
                        buttonColorHover: mod.CreateVector(0.380, 0.878, 1.000),
                        buttonAlphaHover: 0.15,
                        anchor: mod.UIAnchor.Center
                    }
                );
            }
        }

        return {
            type: "Container",
            name: `Shop_GridPanel${uniqueSuffix}`,
            position: mod.CreateVector(-10, 40, 1),
            size: mod.CreateVector(600, 520, 0),
            bgColor: mod.CreateVector(0.04, 0.05, 0.08),
            bgAlpha: 0.5,
            anchor: mod.UIAnchor.Center,
            children: gridItems
        };
    }

    /**
     * Builds the right preview sidebar showing specs, dynamic surcharges, and the buy button.
     */
    private buildDetailPreviewPanel(): any {
        const uniqueSuffix = `_${this.playerId}`;

        return {
            type: "Container",
            name: `Shop_DetailPanel${uniqueSuffix}`,
            position: mod.CreateVector(390, 40, 1),
            size: mod.CreateVector(260, 520, 0),
            bgColor: mod.CreateVector(0.08, 0.11, 0.16),
            bgAlpha: 0.9,
            anchor: mod.UIAnchor.Center,
            children: [
                // Title
                {
                    type: "Text",
                    name: `Shop_DetailTitle${uniqueSuffix}`,
                    textLabel: mod.Message("ACQUISITION DETAILS"),
                    position: mod.CreateVector(390, -180, 2),
                    size: mod.CreateVector(240, 30, 0),
                    textSize: 18,
                    textColor: mod.CreateVector(0.380, 0.878, 1.000),
                    textAnchor: mod.UIAnchor.Center,
                    anchor: mod.UIAnchor.Center
                },
                // Spec stats or structural summary
                {
                    type: "Text",
                    name: `Shop_DetailDesc${uniqueSuffix}`,
                    textLabel: mod.Message("Select an item on the grid to inspect tactical specifications and checkout cost modifications."),
                    position: mod.CreateVector(390, -50, 2),
                    size: mod.CreateVector(220, 160, 0),
                    textSize: 14,
                    textColor: mod.CreateVector(0.7, 0.8, 0.9),
                    textAnchor: mod.UIAnchor.TopCenter,
                    anchor: mod.UIAnchor.Center
                },
                // Surcharge Indicator Box
                {
                    type: "Container",
                    name: `Shop_SurchargeBox${uniqueSuffix}`,
                    position: mod.CreateVector(390, 100, 2),
                    size: mod.CreateVector(220, 90, 0),
                    bgColor: mod.CreateVector(0.12, 0.15, 0.22),
                    bgAlpha: 0.8,
                    bgFill: mod.UIBgFill.Solid,
                    anchor: mod.UIAnchor.Center,
                    children: [
                        {
                            type: "Text",
                            name: `Shop_SurchargeTrack${uniqueSuffix}`,
                            textLabel: mod.Message("Required Mastery Track"),
                            position: mod.CreateVector(390, 75, 3),
                            size: mod.CreateVector(200, 20, 0),
                            textSize: 12,
                            textColor: mod.CreateVector(0.5, 0.6, 0.7),
                            textAnchor: mod.UIAnchor.Center,
                            anchor: mod.UIAnchor.Center
                        },
                        {
                            type: "Text",
                            name: `Shop_SurchargePrice${uniqueSuffix}`,
                            textLabel: mod.Message("STANDARD PRICE"),
                            position: mod.CreateVector(390, 115, 3),
                            size: mod.CreateVector(200, 30, 0),
                            textSize: 18,
                            textColor: mod.CreateVector(1, 1, 1),
                            textAnchor: mod.UIAnchor.Center,
                            anchor: mod.UIAnchor.Center
                        }
                    ]
                },
                // Buy button trigger
                {
                    type: "Button",
                    name: `Shop_BuyActionBtn${uniqueSuffix}`,
                    position: mod.CreateVector(390, 200, 2),
                    size: mod.CreateVector(220, 45, 0),
                    buttonColorBase: mod.CreateVector(0.380, 0.878, 1.000),
                    buttonAlphaBase: 0.9,
                    buttonColorHover: mod.CreateVector(0.5, 0.9, 1.0),
                    bgFill: mod.UIBgFill.Solid,
                    anchor: mod.UIAnchor.Center
                },
                {
                    type: "Text",
                    name: `Shop_BuyActionLabel${uniqueSuffix}`,
                    textLabel: mod.Message("PURCHASE GEAR"),
                    position: mod.CreateVector(390, 200, 3),
                    size: mod.CreateVector(220, 45, 0),
                    textSize: 16,
                    textColor: mod.CreateVector(0.05, 0.07, 0.09), // Inverse color contrast
                    textAnchor: mod.UIAnchor.Center,
                    anchor: mod.UIAnchor.Center
                }
            ]
        };
    }

    /**
     * Calculates the dynamic, pro-rated cost based on the player's cumulative track XP.
     */
    public calculateDynamicCost(item: ShopItem): number {
        const profile = mercenaryRegistry.get(this.playerId);
        if (!profile) return item.baseCost;

        const currentTier = profile.tracks[item.requiredTrack].level;

        // Meets or exceeds required progression -> Pay baseline cost
        if (currentTier >= item.requiredTier) {
            return item.baseCost;
        }

        // Apply pro-rated surcharge formula:
        // Cost = Base * (1 + P_max * (T_req - T_curr) / T_req)
        const tierDeficit = item.requiredTier - currentTier;
        const penaltyScale = tierDeficit / item.requiredTier;
        const surcharge = Math.round(item.baseCost * (1 + (this.maxPenaltyMultiplier * penaltyScale)));
        
        return surcharge;
    }

    /**
     * Toggles store canvas visibility on the player's screen.
     */
    public open(): void {
        const uniqueSuffix = `_${this.playerId}`;
        const profile = mercenaryRegistry.get(this.playerId);
        if (!profile) return;

        // Enable global HUD mouse intercept input mode
        mod.EnableUIInputMode(true, this.player);

        // Update Wallet UI Text directly
        const walletText = mod.FindUIWidgetWithName(`Shop_Wallet${uniqueSuffix}`) as mod.UIWidget;
        mod.SetUITextLabel(walletText, mod.Message("WALLET: ${}", profile.cash));

        // Enforce focus to default first tab
        this.selectTab(ShopTab.Assault);

        if (this.rootWidget) {
            mod.SetUIWidgetVisible(this.rootWidget, true);
            this.isStoreVisible = true;
        }
    }

    public close(): void {
        mod.EnableUIInputMode(false, this.player);
        if (this.rootWidget) {
            mod.SetUIWidgetVisible(this.rootWidget, false);
            this.isStoreVisible = false;
        }
        // Unregister from active menus
        activeBuyMenus.delete(this.playerId);
    }

    /**
     * Selects and focuses a specific shop tab, refreshing the card grid.
     */
    public selectTab(tab: ShopTab): void {
        this.activeTab = tab;
        const uniqueSuffix = `_${this.playerId}`;

        // Toggle visual style highlight on tab buttons
        Object.values(ShopTab).forEach((t) => {
            const tabBtn = mod.FindUIWidgetWithName(`ShopTabBtn_${t}${uniqueSuffix}`) as mod.UIWidget;
            if (t === tab) {
                mod.SetUIWidgetBgColor(tabBtn, mod.CreateVector(0.380, 0.878, 1.000)); // Highlight tab
            } else {
                mod.SetUIWidgetBgColor(tabBtn, mod.CreateVector(0.12, 0.16, 0.22));
            }
        });

        this.refreshItemGrid();
    }

    /**
     * Redraws the item grid based on active tab filters.
     */
    private refreshItemGrid(): void {
        const uniqueSuffix = `_${this.playerId}`;
        const filteredItems = storeDatabase.filter(item => item.requiredTrack === this.getTrackByTab(this.activeTab));

        // Populate card slots (Maximum 6 per tab)
        for (let index = 0; index < 6; index++) {
            const cardContainer = mod.FindUIWidgetWithName(`ShopItemCard_${index}${uniqueSuffix}`) as mod.UIWidget;
            const imgWidget = mod.FindUIWidgetWithName(`ShopItemImg_${index}${uniqueSuffix}`) as mod.UIWidget;
            const nameWidget = mod.FindUIWidgetWithName(`ShopItemName_${index}${uniqueSuffix}`) as mod.UIWidget;
            const costWidget = mod.FindUIWidgetWithName(`ShopItemCost_${index}${uniqueSuffix}`) as mod.UIWidget;
            const buttonOverlay = mod.FindUIWidgetWithName(`ShopItemBtn_${index}${uniqueSuffix}`) as mod.UIWidget;

            const item = filteredItems[index];

            if (item) {
                const dynamicCost = this.calculateDynamicCost(item);

                mod.SetUIWidgetVisible(cardContainer, true);
                mod.SetUIWidgetVisible(imgWidget, true);
                mod.SetUIWidgetVisible(nameWidget, true);
                mod.SetUIWidgetVisible(costWidget, true);
                mod.SetUIWidgetVisible(buttonOverlay, true);

                // Set card image type (maps to visual silhouetted weapon/item shapes)
                mod.SetUIImageType(imgWidget, item.imageType);
                mod.SetUITextLabel(nameWidget, mod.Message(item.name));

                // Color code pro-rated vs standard price (Yellow represents penalty surcharge)
                const isSurcharged = dynamicCost > item.baseCost;
                mod.SetUITextLabel(costWidget, mod.Message(isSurcharged ? "PENALTY: ${}" : "${}", dynamicCost));
                mod.SetUITextColor(costWidget, isSurcharged ? mod.CreateVector(1, 0.8, 0) : mod.CreateVector(0.4, 0.9, 0.4));

                // Bind focus and click event listeners
                mod.EnableUIButtonEvent(buttonOverlay, mod.UIButtonEvent.FocusIn, true);
                mod.EnableUIButtonEvent(buttonOverlay, mod.UIButtonEvent.ButtonDown, true);
            } else {
                // Collapse empty card slots
                mod.SetUIWidgetVisible(cardContainer, false);
                mod.SetUIWidgetVisible(imgWidget, false);
                mod.SetUIWidgetVisible(nameWidget, false);
                mod.SetUIWidgetVisible(costWidget, false);
                mod.SetUIWidgetVisible(buttonOverlay, false);
            }
        }
    }

    /**
     * Updates preview sidebar panel with focused item attributes.
     */
    public previewItem(index: number): void {
        const uniqueSuffix = `_${this.playerId}`;
        const filteredItems = storeDatabase.filter(item => item.requiredTrack === this.getTrackByTab(this.activeTab));
        const item = filteredItems[index];

        if (!item) return;
        this.selectedItem = item;

        const detailTitle = mod.FindUIWidgetWithName(`Shop_DetailTitle${uniqueSuffix}`) as mod.UIWidget;
        const detailDesc = mod.FindUIWidgetWithName(`Shop_DetailDesc${uniqueSuffix}`) as mod.UIWidget;
        const surchargeTrack = mod.FindUIWidgetWithName(`Shop_SurchargeTrack${uniqueSuffix}`) as mod.UIWidget;
        const surchargePrice = mod.FindUIWidgetWithName(`Shop_SurchargePrice${uniqueSuffix}`) as mod.UIWidget;
        const actionLabel = mod.FindUIWidgetWithName(`Shop_BuyActionLabel${uniqueSuffix}`) as mod.UIWidget;

        const dynamicCost = this.calculateDynamicCost(item);
        const profile = mercenaryRegistry.get(this.playerId)!;
        const currentTier = profile.tracks[item.requiredTrack].level;

        mod.SetUITextLabel(detailTitle, mod.Message(item.name.toUpperCase()));

        // Assemble structural metadata summary description
        const specSummary = item.isPooled 
            ? "COOPERATIVE UPGRADE:\nTeammates can pool resources to build stationary defenses. Upgrades persist on capture sectors."
            : `TACTICAL EQUIPMENT:\nType: ${item.gearType.toUpperCase()}\nUnlocks configuration loadout instantly.`;
        mod.SetUITextLabel(detailDesc, mod.Message(specSummary));

        // Surcharge detail breakdown
        const trackProgressString = `Required: ${item.requiredTrack} (Tier ${item.requiredTier})\nYour Level: Tier ${currentTier}`;
        mod.SetUITextLabel(surchargeTrack, mod.Message(trackProgressString));

        if (dynamicCost > item.baseCost) {
            mod.SetUITextLabel(surchargePrice, mod.Message("SURCHARGED: ${}", dynamicCost));
            mod.SetUITextColor(surchargePrice, mod.CreateVector(1.0, 0.4, 0.4)); // Surcharged Alert Red
        } else {
            mod.SetUITextLabel(surchargePrice, mod.Message("BASE PRICE: ${}", dynamicCost));
            mod.SetUITextColor(surchargePrice, mod.CreateVector(0.4, 0.9, 0.4));
        }

        // Action button labeling based on individual vs pooled checkout types
        if (item.isPooled) {
            const need = dynamicCost - item.pooledCash;
            mod.SetUITextLabel(actionLabel, mod.Message(`POOL ${Math.min(profile.cash, need)} / ${dynamicCost}`));
        } else {
            mod.SetUITextLabel(actionLabel, mod.Message("PURCHASE LOADOUT"));
        }
    }

    /**
     * Executes transaction and implements loadout/equipment overrides.
     */
    public executeAcquisition(): void {
        if (!this.selectedItem) return;

        const uniqueSuffix = `_${this.playerId}`;
        const item = this.selectedItem;
        const profile = mercenaryRegistry.get(this.playerId);

        if (!profile) return;

        const dynamicCost = this.calculateDynamicCost(item);

        // --- HANDLE COOPERATIVE POOLED DEFENSES ---
        if (item.isPooled) {
            if (profile.cash <= 0) {
                mod.DisplayNotificationMessage(mod.Message("You have no cash to contribute!"), this.player);
                return;
            }

            const needed = dynamicCost - item.pooledCash;
            const contribution = Math.min(profile.cash, needed);

            profile.cash -= contribution;
            item.pooledCash += contribution;

            mod.DisplayNotificationMessage(
                mod.Message("CO-OP UPGRADE: Contributed ${}! Total: ${}/${}", contribution, item.pooledCash, dynamicCost),
                null,
                mod.GetTeam(this.player)
            );

            if (item.pooledCash >= dynamicCost) {
                this.completePooledConstruction(item);
            }

            this.previewItem(storeDatabase.indexOf(item)); // Force sidebar refresh
            this.open(); // Update cash labels
            return;
        }

        // --- HANDLE DIRECT EQUIPMENT PURCHASES ---
        if (profile.cash < dynamicCost) {
            mod.DisplayNotificationMessage(mod.Message("Insolvent! Insufficient funds to buy loadout."), this.player);
            return;
        }

        profile.cash -= dynamicCost;

        // Clean redundant gear slots and compile new weapon pack definitions
        if (item.gearType === "weapon") {
            mod.RemoveEquipment(this.player, mod.InventorySlots.PrimaryWeapon);
            mod.AddEquipment(this.player, item.assetId, item.weaponPackage);
        } else if (item.gearType === "gadget") {
            mod.RemoveEquipment(this.player, mod.InventorySlots.GadgetOne);
            mod.AddEquipment(this.player, item.assetId);
        }

        mod.DisplayNotificationMessage(mod.Message("Acquisition Success: Loadout Issued! -${}", dynamicCost), this.player);
        this.open(); // Update currency and close sidebar loops
    }

    /**
     * Physical spawning helper pulling from WarFactoryExample visibility constructs.
     */
    private completePooledConstruction(item: ShopItem): void {
        mod.DisplayNotificationMessage(
            mod.Message("COOPERATIVE UNLOCK: {} has been fully funded!", item.name),
            null,
            mod.GetTeam(this.player)
        );

        // Turn on the pre-placed Godot scene entities natively
        if (item.gearType === "emplacement") {
            const spawner = mod.GetEmplacementSpawner(item.assetId);
            mod.SetEmplacementSpawnerAutoSpawn(spawner, true);
            mod.ForceEmplacementSpawnerSpawn(spawner);
        }

        // Reset pooled contribution totals for repeatable purchases
        item.pooledCash = 0;
    }

    /**
     * Resolves track keys from active shop tabs.
     */
    private getTrackByTab(tab: ShopTab): ProgressionTrackKey {
        switch (tab) {
            case ShopTab.Medic: return "Medic";
            case ShopTab.Recon: return "Recon";
            case ShopTab.Support: return "Support";
            case ShopTab.Logistics: return "Driver"; // Maps ground logistics to Driver XP
            case ShopTab.FobUpgrades: return "Pilot";  // Maps FOB building logistics to Pilot XP/Air spawns
            case ShopTab.Assault:
            default:
                return "Assault";
        }
    }
}

/**
 * Centrally registered store catalog listing available items, pro-rated unlock thresholds,
 * and cooperative pooled parameters.
 */
export const storeDatabase: ShopItem[] = [
    // --- ASSAULT PRODUCTS ---
    {
        id: "carbine_tier1",
        name: "AK205 Combat Carbine",
        baseCost: 1200,
        requiredTrack: "Assault",
        requiredTier: 1,
        gearType: "weapon",
        assetId: mod.Weapons.Carbine_AK_205,
        weaponPackage: carbinePackage_Tier1,
        isPooled: false,
        pooledCash: 0,
        imageType: mod.UIImageType.TEMP_PortalIcon
    },
    {
        id: "m4a1_tier3",
        name: "M4A1 Standard Tactical",
        baseCost: 2000,
        requiredTrack: "Assault",
        requiredTier: 3,
        gearType: "weapon",
        assetId: mod.Weapons.Carbine_M4A1,
        weaponPackage: carbinePackage_Tier3,
        isPooled: false,
        pooledCash: 0,
        imageType: mod.UIImageType.TEMP_PortalIcon
    },
    {
        id: "m4a1_tier5",
        name: "M4A1 Tungsten Special",
        baseCost: 3500,
        requiredTrack: "Assault",
        requiredTier: 5,
        gearType: "weapon",
        assetId: mod.Weapons.Carbine_M4A1,
        weaponPackage: carbinePackage_Tier5,
        isPooled: false,
        pooledCash: 0,
        imageType: mod.UIImageType.TEMP_PortalIcon
    },

    // --- MEDIC PRODUCTS ---
    {
        id: "medic_box",
        name: "Medical Supply Crate",
        baseCost: 500,
        requiredTrack: "Medic",
        requiredTier: 2,
        gearType: "gadget",
        assetId: mod.Gadgets.Deployable_Medic_Crate,
        isPooled: false,
        pooledCash: 0,
        imageType: mod.UIImageType.TEMP_PortalIcon
    },

    // --- RECON PRODUCTS ---
    {
        id: "beacon_beacon",
        name: "Squad Insertion Beacon",
        baseCost: 800,
        requiredTrack: "Recon",
        requiredTier: 3,
        gearType: "gadget",
        assetId: mod.Gadgets.Deployable_Deploy_Beacon,
        isPooled: false,
        pooledCash: 0,
        imageType: mod.UIImageType.TEMP_PortalIcon
    },

    // --- COOPERATIVE FOB DEFENSES (Pooled) ---
    {
        id: "fort_aa_spawner",
        name: "GDF009 Stationary AA",
        baseCost: 1500,
        requiredTrack: "Support",
        requiredTier: 4,
        gearType: "emplacement",
        assetId: 83, // Godot ObjId representing the stationary AA emplacement spawner node
        isPooled: true,
        pooledCash: 0,
        imageType: mod.UIImageType.TEMP_PortalIcon
    }
];

/**
 * Central event hook handling UI mouse/keyboard interactions.
 */
export function OnPlayerUIButtonEvent(player: mod.Player, widget: mod.UIWidget, event: mod.UIButtonEvent): void {
    const widgetName = mod.GetUIWidgetName(widget);
    const playerId = mod.GetObjId(player);
    const profile = mercenaryRegistry.get(playerId);

    if (!profile) return;

    const buyMenu = getBuyMenu(playerId);

    if (!buyMenu) return;

    // --- HANDLE TAB CLICK EVENTS ---
    if (widgetName.startsWith("ShopTabBtn_")) {
        const tabKeyStr = widgetName.substring("ShopTabBtn_".length, widgetName.indexOf(`_${playerId}`));
        buyMenu.selectTab(tabKeyStr as ShopTab);
    }

    // --- HANDLE GRID ITEM FOCUS PREVIEW ---
    if (widgetName.startsWith("ShopItemBtn_")) {
        const gridIndexStr = widgetName.substring("ShopItemBtn_".length, widgetName.indexOf(`_${playerId}`));
        const index = parseInt(gridIndexStr, 10);
        
        if (event === mod.UIButtonEvent.FocusIn) {
            buyMenu.previewItem(index);
        }
    }

    // --- HANDLE COOPERATIVE/PURCHASE ACTION BUTTONS ---
    if (widgetName.startsWith("Shop_BuyActionBtn_")) {
        if (event === mod.UIButtonEvent.ButtonDown) {
            buyMenu.executeAcquisition();
        }
    }

    // --- CLOSE MENU PROTOCOLS ---
    if (widgetName.startsWith("Shop_CloseBtn_")) {
        if (event === mod.UIButtonEvent.ButtonDown) {
            buyMenu.close();
        }
    }
}
