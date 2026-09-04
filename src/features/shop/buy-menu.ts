// ============================================
// Shop Module: Buy Station Interaction & Wallet System
// ============================================

import mod from "mod";
import * as config from "../core/config";
import * as events from "../core/events";

// ============================================================
// Player Wallet State
// ============================================================

interface PlayerWallet {
    cash: number;
    purchasedEquipment: string[];
    lastWalletUpdate: number;
}

const wallets: Map<number, PlayerWallet> = new Map();

/**
 * Initialize or get a player's wallet.
 */
export function GetWallet(playerId: number): PlayerWallet {
    if (!wallets.has(playerId)) {
        wallets.set(playerId, {
            cash: config.STARTING_CASH,
            purchasedEquipment: [],
            lastWalletUpdate: Date.now(),
        });
    }
    return wallets.get(playerId) || {
        cash: config.STARTING_CASH,
        purchasedEquipment: [],
        lastWalletUpdate: Date.now(),
    };
}

/**
 * Add cash to a player's wallet.
 */
export function AddCash(playerId: number, amount: number) {
    const wallet = wallets.get(playerId);
    if (!wallet) {
        wallets.set(playerId, {
            cash: amount,
            purchasedEquipment: [],
            lastWalletUpdate: Date.now(),
        });
        return;
    }
    wallet.cash += amount;
}

/**
 * Subtract cash from a player's wallet.
 * Returns false if insufficient funds.
 */
export function SpendCash(playerId: number, amount: number): boolean {
    const wallet = wallets.get(playerId);
    if (!wallet || wallet.cash < amount) {
        return false;
    }
    wallet.cash -= amount;
    return true;
}

/**
 * Record purchased equipment for a player.
 */
export function RecordPurchase(playerId: number, equipmentName: string) {
    const wallet = wallets.get(playerId);
    if (wallet && !wallet.purchasedEquipment.includes(equipmentName)) {
        wallet.purchasedEquipment.push(equipmentName);
    }
}

/**
 * Check if a player has purchased a piece of equipment.
 */
export function HasEquipment(playerId: number, equipmentName: string): boolean {
    const wallet = wallets.get(playerId);
    return !!wallet && wallet.purchasedEquipment.includes(equipmentName);
}

/**
 * Reset a player's wallet (for test purposes).
 */
export function ResetWallet(playerId: number) {
    const wallet = wallets.get(playerId);
    if (wallet) {
        wallet.cash = config.STARTING_CASH;
        wallet.purchasedEquipment = [];
        wallet.lastWalletUpdate = Date.now();
    }
}

// ============================================================
// Buy Station UI Helpers
// ============================================================

/**
 * Create the Buy Station UI overlay.
 * Returns a container widget with the purchase menu.
 */
export function CreateBuyStationUI(player: mod.Player) {
    const playerId = mod.GetObjId(player);
    const teamId = events.GetPlayerTeamId(player);

    return ParseUI({
        type: "Container",
        size: [800, 500],
        position: [200, 100],
        anchor: mod.UIAnchor.TopLeft,
        bgFill: mod.UIBgFill.Blur,
        bgColor: [0.2, 0.2, 0.2],
        bgAlpha: 0.8,
        playerId,
        children: [
            {
                type: "Text",
                textSize: 28,
                textLabel: "Buy Station",
                position: [30, 10],
                anchor: mod.UIAnchor.TopCenter,
                textColor: [1, 1, 0],
            },
            {
                type: "Text",
                textSize: 16,
                textLabel: `Cash: $${wallets.get(playerId)?.cash || 10000}`,
                position: [30, 45],
                anchor: mod.UIAnchor.TopLeft,
                textColor: [1, 0.9, 0],
            },
            {
                type: "TextButton",
                text: "Assault Weapons",
                position: [30, 80],
                anchor: mod.UIAnchor.Left,
                onPress: () => {
                    // Navigate to assault weapons menu
                },
            },
            {
                type: "TextButton",
                text: "Sidearms",
                position: [30, 110],
                anchor: mod.UIAnchor.Left,
                onPress: () => {
                    // Navigate to sidearms menu
                },
            },
            {
                type: "TextButton",
                text: "Specialty Gear",
                position: [30, 140],
                anchor: mod.UIAnchor.Left,
                onPress: () => {
                    // Navigate to specialty gear menu
                },
            },
            {
                type: "TextButton",
                text: "Back",
                position: [700, 10],
                anchor: mod.UIAnchor.TopRight,
                onPress: () => {
                    mod.SetUIWidgetVisible(widget, false);
                },
            },
        ],
    });
}

// ============================================================
// Buy Station Event Handlers
// ============================================================

export async function OnBuyStationInteract(player: mod.Player, interactId: number) {
    if (interactId !== config.TEAM1_BUY_STATION_ID &&
        interactId !== config.TEAM2_BUY_STATION_ID &&
        interactId !== config.TEAM3_BUY_STATION_ID) {
        return;
    }

    // Check if player is in pre-game countdown phase
    // Show buy station UI
    const buyUI = CreateBuyStationUI(player);
    mod.SetUIWidgetVisible(buyUI, true);
}

export function OnBuyStationPurchase(player: mod.Player, equipmentName: string, cost: number) {
    const playerId = mod.GetObjId(player);
    const wallet = GetWallet(playerId);

    if (!SpendCash(playerId, cost)) {
        events.ShowNotificationMessage(
            MakeMessage("Not enough cash", config),
            player
        );
        return;
    }

    RecordPurchase(playerId, equipmentName);

    // Equip the equipment
    try {
        mod.AddEquipment(player, equipmentName);
    } catch (e) {
        console.log(`Failed to add equipment ${equipmentName}: ${e}`);
        // Refund cash on failure
        AddCash(playerId, cost);
    }

    events.ShowNotificationMessage(
        MakeMessage("Equipped", equipmentName),
        player
    );
}
