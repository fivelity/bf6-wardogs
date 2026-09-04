# BF6 Portal SDK — TypeScript Code Template

> **Copy this to `YOUR_MOD.ts`** and fill in your game-specific logic.

```typescript
// ============================================================================
// YOUR_MOD.ts — Battlefield 6 Portal Game Mode
// ============================================================================

const VERSION = [1, 0, 0]; // [major, minor, patch]
const debugMode = true; // DISABLE BEFORE SHARING

// ============================================================================
// CONSTANTS
// ============================================================================

// Player requirements
const minPlayerCount: number = 2;
const combatStartDelay: number = 30;

// Object IDs — assigned in Godot
const HQID: number = 1;
const CAPTURE_POINT_ID: number = 1;
const INTERACT_POINT_ID: number = 1;

// Timing
const TICK_RATE: number = 0.016; // 60fps
const SLOW_TICK_RATE: number = 1;
const MESSAGE_DURATION: number = 5;

// Colors (RGB 0-1)
const BLACKCOLOR: number[] = [1, 1, 1];
const REDCOLOR: number[] = [1, 0, 0];

// Vectors
const ZEROVEC: mod.Vector = mod.CreateVector(0, 0, 0);
const ONEVEC: mod.Vector = mod.CreateVector(1, 1, 1);

// ============================================================================
// GLOBAL STATE
// ============================================================================

let gameState: number = 0; // Use enum: Lobby=0, Countdown=1, Active=2, Ended=3
let gameOver: boolean = false;
let playerCount: number = 0;
let countdownRemaining: number = combatStartDelay;
let combatStarted: boolean = false;
let messageTimer: number = 0;

// Scores (customize per mod)
let team1Score: number = 0;
let team2Score: number = 0;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Create a message with variable arguments
function MakeMessage(msg: string, ...args: any[]): mod.Message {
    switch (args.length) {
        case 0: return mod.Message(msg);
        case 1: return mod.Message(msg, args[0]);
        case 2: return mod.Message(msg, args[0], args[1]);
        default: return mod.Message(msg, args[0], args[1], args[2]);
    }
}

// Linear interpolation
function Lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

// Random integer [0, max)
function GetRandomInt(max: number): number {
    return Math.floor(Math.random() * max);
}

// Random float [min, max)
function GetRandomFloatInRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
}

// Players within distance of a point
function GetPlayersInRange(point: mod.Vector, distance: number): mod.Player[] {
    const closePlayers: mod.Player[] = [];
    JsPlayer.playerInstances.forEach(player => {
        if (mod.GetSoldierState(player, mod.SoldierStateBool.IsAlive)) {
            const pos = mod.GetSoldierState(player, mod.SoldierStateVector.GetPosition);
            if (mod.DistanceBetween(pos, point) <= distance) {
                closePlayers.push(player);
            }
        }
    });
    return closePlayers;
}

// Players on a team
function GetPlayersOnTeam(team: mod.Team): mod.Player[] {
    const teamPlayers: mod.Player[] = [];
    const teamID = mod.GetObjId(team);
    JsPlayer.playerInstances.forEach(player => {
        if (mod.GetObjId(mod.GetTeam(player)) === teamID) {
            teamPlayers.push(player);
        }
    });
    return teamPlayers;
}

// Living players on a team
function GetLivingPlayersOnTeam(team: mod.Team): mod.Player[] {
    const players: mod.Player[] = [];
    const teamID = mod.GetObjId(team);
    JsPlayer.playerInstances.forEach(player => {
        const js = JsPlayer.get(player);
        if (!js) return;
        if (mod.GetObjId(mod.GetTeam(player)) === teamID &&
            mod.GetSoldierState(player, mod.SoldierStateBool.IsAlive)) {
            players.push(player);
        }
    });
    return players;
}

// ============================================================================
// PLAYER TRACKING (JsPlayer Pattern)
// ============================================================================

class JsPlayer {
    player: mod.Player;
    playerId: number;

    // Game-specific state (customize per mod)
    score: number = 0;
    deaths: number = 0;
    deployed: boolean = false;
    customVar1: number = 0;

    // UI references
    lobbyUI?: LobbyUI;
    messageUI?: MessageUI;

    static playerInstances: mod.Player[] = [];
    static #all: { [key: number]: JsPlayer } = {};

    constructor(player: mod.Player) {
        this.player = player;
        this.playerId = mod.GetObjId(player);
        JsPlayer.playerInstances.push(this.player);

        if (debugMode) {
            console.log(`[JsPlayer] Added player ${this.playerId} (total: ${JsPlayer.playerInstances.length})`);
        }

        // Only create UI for human players
        if (!mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier)) {
            this.lobbyUI = new LobbyUI(this);
            this.messageUI = new MessageUI(this);
        }
    }

    // Get or create instance
    static get(player: mod.Player): JsPlayer | undefined {
        if (!gameOver && mod.GetObjId(player) > -1) {
            const id = mod.GetObjId(player);
            if (!this.#all[id]) {
                this.#all[id] = new JsPlayer(player);
            }
            return this.#all[id];
        }
        return undefined;
    }

    // Remove invalid player and clean up
    static removeInvalid(id: number): void {
        if (gameOver) return;

        if (debugMode) {
            console.log(`[JsPlayer] Removing player ${id}`);
        }

        this.#all[id]?.destroyUI();
        delete this.#all[id];

        const idx = JsPlayer.playerInstances.findIndex(p => mod.GetObjId(p) === id);
        if (idx > -1) {
            JsPlayer.playerInstances.splice(idx, 1);
        }
    }

    // Clean up all UI
    destroyUI(): void {
        this.lobbyUI?.close();
        this.messageUI?.close();
    }
}

// ============================================================================
// UI CLASSES
// ============================================================================

class LobbyUI {
    private jsPlayer: JsPlayer;
    private root?: mod.UIWidget;
    private statusText?: mod.UIWidget;
    private visible: boolean = false;

    constructor(jsPlayer: JsPlayer) {
        this.jsPlayer = jsPlayer;
    }

    open(): void {
        if (!this.root) this.create();
        if (!this.root) return;
        mod.SetUIWidgetVisible(this.root, true);
        this.visible = true;
    }

    close(): void {
        if (this.root) {
            mod.SetUIWidgetVisible(this.root, false);
            this.visible = false;
        }
    }

    isOpen(): boolean { return this.visible; }

    refresh(): void {
        if (!this.statusText) return;
        if (combatStarted) {
            mod.SetUITextLabel(this.statusText,
                MakeMessage(mod.stringkeys.combatStartDelay || "Starting in {0}...", countdownRemaining)
            );
        } else {
            mod.SetUITextLabel(this.statusText,
                MakeMessage(mod.stringkeys.waitingForPlayers || "Waiting for players: {0}/{1}", playerCount, minPlayerCount)
            );
        }
    }

    private create(): void {
        mod.AddUIContainer(
            "Lobby", mod.CreateVector(0, 100, 0),
            mod.CreateVector(700, 300, 0), mod.UIAnchor.TopCenter,
            mod.GetUIRoot(), true, 0, ZEROVEC, 1,
            mod.UIBgFill.Blur, this.jsPlayer.player
        );

        this.root = mod.FindUIWidgetWithName("Lobby") as mod.UIWidget;
        if (!this.root) return;

        mod.AddUIText(
            "LobbyStatus", mod.CreateVector(0, -30, 0),
            mod.CreateVector(700, 50, 0), mod.UIAnchor.BottomCenter,
            this.root, true, 8, ZEROVEC, 0, mod.UIBgFill.None,
            MakeMessage(mod.stringkeys.waitingForPlayers || "Waiting...", 0, minPlayerCount),
            36, mod.CreateVector(1, 1, 1), 1, mod.UIAnchor.Center,
            this.jsPlayer.player
        );

        this.statusText = mod.FindUIWidgetWithName("LobbyStatus") as mod.UIWidget;
    }
}

class MessageUI {
    private jsPlayer: JsPlayer;
    private root?: mod.UIWidget;
    private text?: mod.UIWidget;
    private visible: boolean = false;

    constructor(jsPlayer: JsPlayer) {
        this.jsPlayer = jsPlayer;
    }

    open(msg: mod.Message, color: number[]): void {
        if (!this.root) this.create();
        else this.refresh(msg);

        if (this.root) {
            mod.SetUIWidgetVisible(this.root, true);
            this.visible = true;
        }
    }

    close(): void {
        if (this.root) {
            mod.SetUIWidgetVisible(this.root, false);
            this.visible = false;
        }
    }

    isOpen(): boolean { return this.visible; }

    refresh(msg: mod.Message): void {
        if (!this.text) return;
        mod.SetUITextLabel(this.text, msg);
    }

    private create(msg: mod.Message, color: number[]): void {
        mod.AddUIContainer(
            "MsgUI", mod.CreateVector(0, 25, 0),
            mod.CreateVector(700, 100, 0), mod.UIAnchor.TopCenter,
            mod.GetUIRoot(), true, 0, ZEROVEC, 0.8,
            mod.UIBgFill.Blur, this.jsPlayer.player
        );

        this.root = mod.FindUIWidgetWithName("MsgUI") as mod.UIWidget;
        if (!this.root) return;

        mod.AddUIText(
            "MsgText", mod.CreateVector(0, 0, 0),
            mod.CreateVector(700, 100, 0), mod.UIAnchor.Center,
            this.root, true, 8, ZEROVEC, 0, mod.UIBgFill.None,
            msg, 36, mod.CreateVector(color[0], color[1], color[2]), 1,
            mod.UIAnchor.Center, this.jsPlayer.player
        );

        this.text = mod.FindUIWidgetWithName("MsgText") as mod.UIWidget;
    }
}

// ============================================================================
// MESSAGES
// ============================================================================

function MessageAll(msg: mod.Message, color: number[]): void {
    JsPlayer.playerInstances.forEach(player => {
        const js = JsPlayer.get(player);
        if (!js) return;
        if (js.messageUI.isOpen()) js.messageUI.refresh(msg);
        else js.messageUI.open(msg, color);
    });
    messageTimer = MESSAGE_DURATION;
}

function HideAllMessages(): void {
    JsPlayer.playerInstances.forEach(p => JsPlayer.get(p)?.messageUI?.close());
}

function UpdateAllLobbies(): void {
    JsPlayer.playerInstances.forEach(p => JsPlayer.get(p)?.lobbyUI?.refresh());
}

function HideAllLobbies(): void {
    JsPlayer.playerInstances.forEach(p => JsPlayer.get(p)?.lobbyUI?.close());
}

async function UpdateMessages(): Promise<void> {
    if (messageTimer > 0) {
        messageTimer--;
        if (messageTimer <= 0) {
            HideAllMessages();
            messageTimer = 0;
        }
    }
}

// ============================================================================
// GAME FLOW
// ============================================================================

async function Countdown(): Promise<void> {
    while (countdownRemaining > 0) {
        UpdateAllLobbies();
        await mod.Wait(1);
        countdownRemaining--;
    }

    combatStarted = true;
    mod.DisablePlayerJoin();
    console.log("[Game] Combat started");
    HideAllLobbies();
}

function CheckVictory(): boolean {
    // CUSTOM VICTORY LOGIC HERE
    // Example:
    if (team1Score >= 100) { mod.EndGameMode(mod.GetTeam(1)); return true; }
    if (team2Score >= 100) { mod.EndGameMode(mod.GetTeam(2)); return true; }
    return false;
}

// ============================================================================
// UPDATE LOOPS
// ============================================================================

async function TickUpdate(): void {
    while (true) {
        await mod.Wait(TICK_RATE);
        if (gameOver) continue;
        // Fast updates: proximity, progress, input
    }
}

async function ThrottledUpdate(): void {
    while (true) {
        await mod.Wait(SLOW_TICK_RATE);
        if (gameOver) continue;

        UpdateMessages();

        // Check victory
        if (combatStarted) CheckVictory();
    }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

export async function OnGameModeStarted(): Promise<void> {
    console.log(`[Game] Starting v${VERSION[0]}.${VERSION[1]}.${VERSION[2]}`);

    mod.SetFriendlyFire(false);
    mod.SetSpawnMode(mod.SpawnModes.AutoSpawn);

    const mainHQ = mod.GetHQ(HQID);
    mod.EnableHQ(mainHQ, true);

    // Wait for minimum players
    while (playerCount < minPlayerCount) await mod.Wait(1);

    console.log(`[Game] Players ready (${playerCount}). Starting countdown...`);
    await Countdown();

    // Start loops
    TickUpdate();
    ThrottledUpdate();
}

export function OnGameModeEnding(): void {
    gameOver = true;
    HideAllMessages();
    HideAllLobbies();
    console.log("[Game] Ending");
}

export function OngoingGlobal(): void {
    // Avoid — use update loops instead
}

export async function OnPlayerJoinGame(player: mod.Player): Promise<void> {
    await mod.Wait(0.1);

    const js = JsPlayer.get(player);
    if (!js) return;

    if (!mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier) && !combatStarted) {
        js.lobbyUI?.open();
        playerCount++;
        console.log(`[Player] Joined (total: ${playerCount})`);
        UpdateAllLobbies();
    }
}

export async function OnPlayerLeaveGame(playerId: number): Promise<void> {
    JsPlayer.removeInvalid(playerId);

    if (!combatStarted && !gameOver) {
        playerCount--;
        console.log(`[Player] Left (total: ${playerCount})`);
        UpdateAllLobbies();
    }
}

export function OnPlayerDeployed(player: mod.Player): void {
    const js = JsPlayer.get(player);
    if (!js) return;

    js.deployed = true;
    // Teleport to spawn, setup loadout, etc.
}

export function OnPlayerUndeploy(player: mod.Player): void {
    JsPlayer.get(player)?.(p => { p.deployed = false; });
}

export function OnPlayerDied(
    player: mod.Player,
    killer: mod.Player,
    deathType: mod.DeathType,
    weapon: mod.WeaponUnlock
): void {
    const js = JsPlayer.get(player);
    if (!js) return;

    js.deaths++;
    // Update scores, trigger events, etc.
}

export function OnPlayerEarnedKill(
    player: mod.Player,
    victim: mod.Player,
    deathType: mod.DeathType,
    weapon: mod.WeaponUnlock
): void {
    // Skip redeploy
    if (mod.EventDeathTypeCompare(deathType, mod.PlayerDeathTypes.Redeploy)) return;

    const js = JsPlayer.get(player);
    if (!js) return;

    js.score++;
    // Award points
}

export function OnPlayerDamaged(
    player: mod.Player,
    damager: mod.Player,
    damageType: mod.DamageType,
    weapon: mod.WeaponUnlock
): void {
    // Custom damage logic
}

export async function OnPlayerInteract(
    player: mod.Player,
    interactPoint: mod.InteractPoint
): Promise<void> {
    const js = JsPlayer.get(player);
    if (!js) return;

    const id = mod.GetObjId(interactPoint);
    switch (id) {
        case INTERACT_POINT_ID:
            // Handle interaction
            console.log(`[Interact] Player ${js.playerId} hit ${id}`);
            break;
    }
}

export function OnPlayerSwitchTeam(player: mod.Player, team: mod.Team): void {
    console.log(`[Team] Player ${mod.GetObjId(player)} → ${mod.GetObjId(team)}`);
}

export function OnPlayerEnterAreaTrigger(
    player: mod.Player,
    area: mod.AreaTrigger
): void {
    const id = mod.GetObjId(area);
    console.log(`[Area] Player entered ${id}`);
}

export function OnPlayerExitAreaTrigger(
    player: mod.Player,
    area: mod.AreaTrigger
): void {
    const id = mod.GetObjId(area);
    console.log(`[Area] Player exited ${id}`);
}

export function OnPlayerEnterCapturePoint(
    player: mod.Player,
    cp: mod.CapturePoint
): void {
    // Track captures
}

export function OnPlayerExitCapturePoint(
    player: mod.Player,
    cp: mod.CapturePoint
): void {
    // Track captures
}

export function OnCapturePointCapturing(cp: mod.CapturePoint): void {
    MessageAll(MakeMessage(mod.stringkeys.teamCapture || "Capturing..."), REDCOLOR);
}

export function OnCapturePointCaptured(cp: mod.CapturePoint): void {
    const owner = mod.GetCurrentOwnerTeam(cp);
    MessageAll(
        MakeMessage(mod.stringkeys.pointCaptured || "Point captured by team {0}", mod.GetObjId(owner)),
        REDCOLOR
    );
}

export async function OnVehicleSpawned(vehicle: mod.Vehicle): Promise<void> {
    // Custom vehicle logic
}

export function OnVehicleDestroyed(vehicle: mod.Vehicle, destroyer: mod.Player): void {
    // Custom destruction logic
}

export function OnPlayerUIButtonEvent(
    player: mod.Player,
    widget: mod.UIWidget,
    event: mod.UIButtonEvent
): void {
    // UI button handling
}

// ============================================================================
// END OF TEMPLATE
// ============================================================================
```

---
