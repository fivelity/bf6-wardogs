// ============================================
// Modlib: Helper Functions and UI Utilities
// ============================================

import mod from "mod";

// ============================================================
// ParseUI: JSON-like UI Widget Builder
// ============================================================

/**
 * Parse a JSON-like structure and create the corresponding UI widget hierarchy.
 * 
 * @param {object} config - UI configuration object
 * @param {number} [playerId] - Player ID for player-specific UI (optional)
 * @returns {mod.UIWidget | undefined} - Created widget, or null if invalid config
 */
export function ParseUI(config: any, playerId?: number) {
    const widgetType = config.type;

    switch (widgetType) {
        case "Container":
        case "Group":
            return CreateContainer(config);
        case "Text":
        case "TextButton":
        case "TextButton2":
            return CreateTextWidget(config);
        case "Checkbox":
        case "CheckButton":
            return CreateCheckButton(config);
        case "Slider":
            return CreateSlider(config);
        case "ComboBox":
        case "Dropdown":
            return CreateComboBox(config);
        case "Image":
            return CreateImageWidget(config);
        case "Line":
            return CreateLineWidget(config);
        default:
            console.log(`ParseUI: Unknown widget type "${widgetType}"`);
            return null;
    }
}

// --- Container ---
function CreateContainer(config: any) {
    const type = config.type === "Group" ? mod.UIGroup : mod.UIContainer;
    let widget = type === mod.UIGroup ? mod.CreateGroup() : mod.CreateContainer();

    // Position and size
    const position = config.position || [0, 0];
    const size = config.size || [100, 100];
    if (widget instanceof mod.UIGroup) {
        mod.SetWidgetPosition(widget, position[0], position[1]);
        mod.SetWidgetSize(widget, size[0], size[1]);
    } else {
        mod.SetWidgetPosition(widget, position[0], position[1]);
        mod.SetWidgetSize(widget, size[0], size[1]);
    }

    // Anchor point
    const anchor = config.anchor || mod.UIAnchor.TopCenter;
    mod.SetWidgetAnchor(widget, anchor);

    // Background
    const bgColor = config.bgColor || [0, 0, 0];
    const bgAlpha = config.bgAlpha ?? 0;
    const bgFill = config.bgFill || mod.UIBgFill.Solid;
    mod.SetWidgetBG(widget, bgFill, bgColor, bgAlpha);

    // Player-specific UI
    if (playerId !== undefined) {
        mod.SetWidgetPlayerId(widget, playerId);
    }

    // Children
    if (config.children && Array.isArray(config.children)) {
        config.children.forEach(childConfig => {
            const childWidget = ParseUI(childConfig, playerId);
            if (childWidget) {
                if (widget instanceof mod.UIGroup) {
                    mod.AddGroupChild(widget, childWidget);
                } else {
                    mod.AddContainerChild(widget, childWidget);
                }
            }
        });
    }

    // Visibility
    mod.SetWidgetVisible(widget, true);

    return widget;
}

// --- Text Widget ---
function CreateTextWidget(config: any) {
    const type = config.type === "TextButton2" ? mod.UIButton : mod.UIText;
    const widget = type === mod.UIButton ? mod.CreateButton() : mod.CreateText();

    // Text and color
    const textLabel = config.textLabel || "";
    const text = config.text || textLabel;
    const textColor = config.textColor || [1, 1, 1];
    const textSize = config.textSize || 18;
    const textPadding = config.textPadding || 1;

    if (widget instanceof mod.UIText) {
        mod.SetWidgetText(widget, text);
        mod.SetWidgetTextColor(widget, textColor);
        mod.SetWidgetTextSize(widget, textSize);
        mod.SetWidgetTextPadding(widget, textPadding);
    } else {
        mod.SetWidgetText(widget, text);
        mod.SetWidgetTextColor(widget, textColor);
        mod.SetWidgetTextSize(widget, textSize);
        mod.SetWidgetTextPadding(widget, textPadding);
    }

    // Position and size
    const position = config.position || [0, 0];
    const size = config.size || [100, 30];
    mod.SetWidgetPosition(widget, position[0], position[1]);
    mod.SetWidgetSize(widget, size[0], size[1]);

    // Anchor
    const anchor = config.anchor || mod.UIAnchor.Center;
    mod.SetWidgetAnchor(widget, anchor);

    // Background
    if (widget instanceof mod.UIButton) {
        const bgColor = config.bgColor || [0.2, 0.2, 0.2];
        const bgAlpha = config.bgAlpha ?? 0.8;
        const bgFill = config.bgFill || mod.UIBgFill.Solid;
        mod.SetWidgetBG(widget, bgFill, bgColor, bgAlpha);
    }

    // Button callbacks
    if (config.onPress && typeof config.onPress === 'function') {
        widget.onPress = config.onPress;
    }

    if (config.onEnter && typeof config.onEnter === 'function') {
        widget.onEnter = config.onEnter;
    }

    if (config.onLeave && typeof config.onLeave === 'function') {
        widget.onLeave = config.onLeave;
    }

    return widget;
}

// --- Check Button ---
function CreateCheckButton(config: any) {
    const widget = mod.CreateButton();

    mod.SetWidgetText(widget, config.textLabel || "checkbox");
    mod.SetWidgetTextColor(widget, config.textColor || [1, 1, 1]);
    mod.SetWidgetTextSize(widget, config.textSize || 18);

    const position = config.position || [0, 0];
    const size = config.size || [100, 30];
    mod.SetWidgetPosition(widget, position[0], position[1]);
    mod.SetWidgetSize(widget, size[0], size[1]);

    const checked = config.checked ?? false;
    mod.SetWidgetChecked(widget, checked);

    if (config.onPress && typeof config.onPress === 'function') {
        widget.onPress = config.onPress;
    }

    return widget;
}

// --- Slider ---
function CreateSlider(config: any) {
    const widget = mod.CreateSlider();

    mod.SetWidgetSliderMin(widget, config.sliderMin ?? 0);
    mod.SetWidgetSliderMax(widget, config.sliderMax ?? 1);
    mod.SetWidgetSliderValue(widget, config.sliderValue ?? 0.5);

    const position = config.position || [0, 0];
    const size = config.size || [200, 20];
    mod.SetWidgetPosition(widget, position[0], position[1]);
    mod.SetWidgetSize(widget, size[0], size[1]);

    if (config.onSliderMove && typeof config.onSliderMove === 'function') {
        widget.onSliderMove = config.onSliderMove;
    }

    return widget;
}

// --- Combo Box ---
function CreateComboBox(config: any) {
    const widget = mod.CreateComboBox();

    if (config.items && Array.isArray(config.items)) {
        config.items.forEach(item => {
            mod.AddComboItem(widget, item);
        });
    }

    mod.SetWidgetText(widget, config.textLabel || "dropdown");
    mod.SetWidgetTextColor(widget, config.textColor || [1, 1, 1]);

    const position = config.position || [0, 0];
    const size = config.size || [200, 30];
    mod.SetWidgetPosition(widget, position[0], position[1]);
    mod.SetWidgetSize(widget, size[0], size[1]);

    if (config.onSelect && typeof config.onSelect === 'function') {
        widget.onSelect = config.onSelect;
    }

    return widget;
}

// --- Image Widget ---
function CreateImageWidget(config: any) {
    const widget = mod.CreateImage();

    const textureName = config.texture || null;
    if (textureName) {
        mod.SetWidgetTexture(widget, textureName);
    }

    const position = config.position || [0, 0];
    const size = config.size || [100, 100];
    mod.SetWidgetPosition(widget, position[0], position[1]);
    mod.SetWidgetSize(widget, size[0], size[1]);

    return widget;
}

// --- Line Widget ---
function CreateLineWidget(config: any) {
    const widget = mod.CreateLine();

    const lineWidth = config.lineWidth || 2;
    const lineColor = config.lineColor || [1, 1, 1];
    const lineStart = config.lineStart || [0, 0];
    const lineEnd = config.lineEnd || [100, 0];

    mod.SetWidgetLineWidth(widget, lineWidth);
    mod.SetWidgetLineColor(widget, lineColor);
    mod.SetWidgetLineStart(widget, lineStart[0], lineStart[1]);
    mod.SetWidgetLineEnd(widget, lineEnd[0], lineEnd[1]);

    const position = config.position || [0, 0];
    const size = config.size || [100, 100];
    mod.SetWidgetPosition(widget, position[0], position[1]);
    mod.SetWidgetSize(widget, size[0], size[1]);

    return widget;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Create a notification message displayed to all or specific players.
 */
export function ShowNotificationMessage(message: mod.Message, targetPlayer?: mod.Player, targetTeam?: mod.Team) {
    const msg = typeof message === 'string' ? mod.Message(message) : message;

    if (targetPlayer) {
        mod.DisplayNotificationMessage(msg, targetPlayer);
    } else if (targetTeam) {
        mod.DisplayNotificationMessage(msg, targetTeam);
    } else {
        mod.DisplayNotificationMessage(msg);
    }
}

/**
 * Get a player's team ID.
 */
export function GetPlayerTeamId(player: mod.Player): number {
    const team = mod.GetTeam(player);
    return mod.GetObjId(team);
}

/**
 * Check if two players are on the same team.
 */
export function IsSameTeam(player1: mod.Player, player2: mod.Player): boolean {
    return GetPlayerTeamId(player1) === GetPlayerTeamId(player2);
}

/**
 * Check if two players are on enemy teams.
 */
export function IsEnemyTeam(player1: mod.Player, player2: mod.Player): boolean {
    return GetPlayerTeamId(player1) !== GetPlayerTeamId(player2);
}

/**
 * Get player's team color for UI.
 */
export function GetTeamColor(player: mod.Player): number[] {
    const teamId = GetPlayerTeamId(player);
    const colors = [
        [0, 0.3, 1],    // Team 1: Lonestar - Blue
        [0, 1, 0.2],    // Team 2: Manticore - Green
        [1, 0.1, 0.1],  // Team 3: Valkyra - Red
        [0.15, 0.15, 0.15] // Team 4: AI - Black
    ];
    return colors[Math.min(teamId - 1, colors.length - 1)] || colors[0];
}

/**
 * Make a message from a string key with optional arguments.
 */
export function MakeMessage(key: string, ...args: any[]) {
    switch (args.length) {
        case 0: return mod.Message(key);
        case 1: return mod.Message(key, args[0]);
        case 2: return mod.Message(key, args[0], args[1]);
        default: return mod.Message(key, args[0], args[1], args[2]);
    }
}

/**
 * Get player's position from soldier state.
 */
export function GetPlayerPosition(player: mod.Player): mod.Vector {
    return mod.GetSoldierState(player, mod.SoldierStateVector.GetPosition);
}

/**
 * Check if player is alive.
 */
export function IsPlayerAlive(player: mod.Player): boolean {
    return mod.GetSoldierState(player, mod.SoldierStateBool.IsAlive);
}

/**
 * Check if player is AI.
 */
export function IsPlayerAI(player: mod.Player): boolean {
    return mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier);
}

/**
 * Check if player is in a vehicle.
 */
export function IsPlayerInVehicle(player: mod.Player): boolean {
    return mod.GetSoldierState(player, mod.SoldierStateBool.IsInVehicle);
}

/**
 * Check if player is man down.
 */
export function IsPlayerManDown(player: mod.Player): boolean {
    return mod.GetSoldierState(player, mod.SoldierStateBool.IsManDown);
}

/**
 * Get the current time since match start (in seconds).
 */
export function GetMatchTime(): number {
    return Math.floor((Date.now() - 0) / 1000); // Placeholder - would need actual match clock
}

// ============================================================
// UI Widget Builders (Quick Helpers)
// ============================================================

/**
 * Create a simple button with text and optional callback.
 */
export function CreateButton(text: string, onPress?: (button: mod.UIButton) => void, position: [number, number] = [0, 0]): mod.UIButton {
    const widget = mod.CreateButton();
    mod.SetWidgetText(widget, text);
    mod.SetWidgetPosition(widget, position[0], position[1]);
    mod.SetWidgetAnchor(widget, mod.UIAnchor.Center);
    if (onPress) {
        widget.onPress = onPress;
    }
    return widget;
}

/**
 * Create a simple text label.
 */
export function CreateText(text: string, textSize: number = 18, position: [number, number] = [0, 0]): mod.UIText {
    const widget = mod.CreateText();
    mod.SetWidgetText(widget, text);
    mod.SetWidgetTextSize(widget, textSize);
    mod.SetWidgetPosition(widget, position[0], position[1]);
    return widget;
}

/**
 * Create a progress bar container (text-based).
 */
export function CreateProgressBar(
    current: number,
    max: number,
    position: [number, number] = [0, 0]
): mod.UIText {
    const pct = Math.floor((current / max) * 100);
    const bar = '█'.repeat(pct >= 50 ? 25 : pct);
    const empty = '░'.repeat(25 - (pct >= 50 ? 25 : pct));
    const text = `|${bar}${empty}| ${pct}%`;
    return CreateText(text, 14, position);
}
