// src/features/interface/reactive-hud.ts
import { mercenaryRegistry, PlayerProfile, TrackData, ProgressionTrackKey } from "../progression/profile";
import { MakeMessage } from "../../modlib";

// XP thresholds for tiers 1-5 (cumulative XP required)
const XP_THRESHOLDS: number[] = [0, 1000, 2500, 5000, 10000];

// Ordered list of dynamic progression tracks for rendering the Left-Center stack
const TRACKS_ORDER: ProgressionTrackKey[] = [
  "Assault",
  "Medic",
  "Recon",
  "Support",
  "Driver",
  "Pilot",
];

/**
 * ParseUI-powered in-game main HUD overlay.
 * Renders the persistent screen overlays that PMC operators see during active gameplay.
 * Optimized via fine-grained reactive signals to eliminate per-tick layout redraws.
 *
 * Layout Restructured per Spec:
 *  1. Top-Center: Faction Ticket Progress Trackers (Cyan vs. Orange vs. Silver)
 *  2. Top-Left: Active Wallet Display (Persistent Match Cash with +/- transaction flashes)
 *  3. Left-Center: Active Mastery Tracks Overlay (Stack of all 6 Tiers, Cumulative XP, and Progress Bars,
 *     reactively highlighting the currently progressing track in high-visibility Cyan, while keeping others dimmed).
 */
export class WARDOGSActiveHUD {
  private rootWidget: mod.UIWidget | null = null;
  private player: mod.Player;
  private playerId: number;

  // Cached references to child widgets for reactive updates
  private factionTextWidgets: Record<number, mod.UIWidget | null> = { 1: null, 2: null, 3: null };
  private walletLabelWidget: mod.UIWidget | null = null;
  private walletFeedWidget: mod.UIWidget | null = null;
  private trackNameWidgets: Record<ProgressionTrackKey, mod.UIWidget | null> = {
    Assault: null,
    Medic: null,
    Recon: null,
    Support: null,
    Driver: null,
    Pilot: null,
  };
  private trackXPWidgets: Record<ProgressionTrackKey, mod.UIWidget | null> = {
    Assault: null,
    Medic: null,
    Recon: null,
    Support: null,
    Driver: null,
    Pilot: null,
  };
  private trackBarFillWidgets: Record<ProgressionTrackKey, mod.UIWidget | null> = {
    Assault: null,
    Medic: null,
    Recon: null,
    Support: null,
    Driver: null,
    Pilot: null,
  };

  constructor(player: mod.Player) {
    this.player = player;
    this.playerId = mod.GetObjId(player);
    this.rootWidget = this.render();
  }

  /**
   * Constructs the unified on-screen gameplay HUD.
   * Returns an empty hidden container if profile is missing.
   */
  private render(): mod.UIWidget {
    const profile = mercenaryRegistry.get(this.playerId);
    if (!profile) {
      const widget = mod.ParseUI({
        type: "Container",
        name: `EmptyHUD_${this.playerId}`,
        position: [0, 0],
        size: [1, 1],
        anchor: mod.UIAnchor.Center,
        bgAlpha: 0,
        visible: false,
      });
      return widget;
    }

    const widget = mod.ParseUI({
      type: "Container",
      name: `WardogsHUD_Root_${this.playerId}`,
      position: mod.CreateVector(0, 0, 0),
      size: mod.CreateVector(1920, 1080, 0),
      anchor: mod.UIAnchor.Center,
      bgAlpha: 0,
      visible: true,
      children: [
        // 1. TOP-CENTER: FACTION PROGRESS HEADERS
        { type: "Container", name: "FactionHUD_Header", position: mod.CreateVector(0, 45, 0), size: mod.CreateVector(700, 80, 0), anchor: mod.UIAnchor.TopCenter, bgAlpha: 0.4, bgColor: mod.CreateVector(0.02, 0.02, 0.02), bgFill: mod.UIBgFill.None, children: [
          { type: "Text", name: "LSTR_Progress_Text", textLabel: "LSTR: {}/100", textSize: 18, textColor: [0.38, 0.878, 1.0], anchor: mod.UIAnchor.Center },
          { type: "Text", name: "MNTR_Progress_Text", textLabel: "MNTR: {}/100", textSize: 18, textColor: [1.0, 0.561, 0.384], anchor: mod.UIAnchor.Center },
          { type: "Text", name: "VLYR_Progress_Text", textLabel: "VLYR: {}/100", textSize: 18, textColor: [0.816, 0.859, 0.847], anchor: mod.UIAnchor.Center },
        ]},
        // 2. TOP-LEFT: ACTIVE WALLET DISPLAY
        { type: "Container", name: "WalletHUD_Card", position: mod.CreateVector(60, 45, 0), size: mod.CreateVector(320, 90, 0), anchor: mod.UIAnchor.TopLeft, bgAlpha: 0.6, bgColor: mod.CreateVector(0.02, 0.03, 0.02), bgFill: mod.UIBgFill.Solid, children: [
          { type: "Text", name: "WalletHUD_Label", textLabel: "WALLET: {}", position: mod.CreateVector(20, 0, 0), size: mod.CreateVector(280, 40, 0), textSize: 24, textColor: [0.4, 1.0, 0.4], anchor: mod.UIAnchor.CenterLeft },
          { type: "Text", name: "WalletHUD_Feedback", textLabel: "{}", position: mod.CreateVector(20, 30, 0), size: mod.CreateVector(280, 30, 0), textSize: 14, textColor: [0.75, 0.75, 0.75], anchor: mod.UIAnchor.CenterLeft },
        ]},
        // 3. LEFT-CENTER: ACTIVE MASTERY TRACKS STACK
        { type: "Container", name: "TrackHUD_Stack_Card", position: mod.CreateVector(60, 0, 0), size: mod.CreateVector(350, 450, 0), anchor: mod.UIAnchor.CenterLeft, bgAlpha: 0.55, bgColor: mod.CreateVector(0.03, 0.03, 0.04), bgFill: mod.UIBgFill.Solid, children: [
          { type: "Text", name: "TrackHUD_Stack_Title", textLabel: "ROLE PROFICIENCY MASTERY", position: mod.CreateVector(20, -195, 0), size: mod.CreateVector(310, 30, 0), textSize: 15, textColor: [0.8, 0.8, 0.8], anchor: mod.UIAnchor.CenterLeft },
          ...TRACKS_ORDER.map((trackKey, index) => {
            const yOffset = -140 + index * 60;
            return {
              type: "Container", name: `TrackHUD_Row_${trackKey}`, position: mod.CreateVector(0, yOffset, 0), size: mod.CreateVector(350, 55, 0), anchor: mod.UIAnchor.Center, bgAlpha: 0, children: [
                { type: "Text", name: `TrackHUD_Name_${trackKey}`, textLabel: "{} [Tier {}]", position: mod.CreateVector(20, -14, 0), size: mod.CreateVector(200, 20, 0), textSize: 13, textColor: [0.55, 0.55, 0.55], anchor: mod.UIAnchor.CenterLeft },
                { type: "Text", name: `TrackHUD_XP_${trackKey}`, textLabel: "{} / {} XP", position: mod.CreateVector(180, -14, 0), size: mod.CreateVector(150, 20, 0), textSize: 11, textColor: [0.45, 0.45, 0.45], anchor: mod.UIAnchor.CenterRight },
                { type: "Container", name: `TrackHUD_BarBg_${trackKey}`, position: mod.CreateVector(20, 10, 0), size: mod.CreateVector(310, 5, 0), anchor: mod.UIAnchor.CenterLeft, bgAlpha: 0.15, bgColor: mod.CreateVector(0.5, 0.5, 0.5), children: [
                  { type: "Container", name: `TrackHUD_BarFill_${trackKey}`, position: mod.CreateVector(0, 0, 0), size: mod.CreateVector(310, 5, 0), anchor: mod.UIAnchor.CenterLeft, bgAlpha: 0.9, bgColor: mod.CreateVector(0.38, 0.878, 1.0) },
                ]},
              ],
            };
          }),
        ]},
      ],
    });
    this.cacheWidgetReferences(widget);
    return widget;
  }

  /**
   * Walks the parsed widget tree to cache references for reactive updates.
   */
  private cacheWidgetReferences(_rootWidget: mod.UIWidget): void {
    const lstrText = mod.FindUIWidgetWithName("LSTR_Progress_Text");
    const mntrText = mod.FindUIWidgetWithName("MNTR_Progress_Text");
    const vlyrText = mod.FindUIWidgetWithName("VLYR_Progress_Text");
    if (lstrText) this.factionTextWidgets[1] = lstrText;
    if (mntrText) this.factionTextWidgets[2] = mntrText;
    if (vlyrText) this.factionTextWidgets[3] = vlyrText;

    this.walletLabelWidget = mod.FindUIWidgetWithName("WalletHUD_Label");
    this.walletFeedWidget = mod.FindUIWidgetWithName("WalletHUD_Feedback");

    for (const trackKey of TRACKS_ORDER) {
      this.trackNameWidgets[trackKey] = mod.FindUIWidgetWithName(`TrackHUD_Name_${trackKey}`);
      this.trackXPWidgets[trackKey] = mod.FindUIWidgetWithName(`TrackHUD_XP_${trackKey}`);
      this.trackBarFillWidgets[trackKey] = mod.FindUIWidgetWithName(`TrackHUD_BarFill_${trackKey}`);
    }
  }

  /**
   * Updates all HUD widgets with current profile data.
   * Called from ThrottledUpdate loop (~1Hz) for smooth reactive UI sync.
   */
  public refresh(): void {
    const profile = mercenaryRegistry.get(this.playerId);
    if (!profile) return;
    this.updateFactionTickets(profile);
    this.updateWalletDisplay(profile);
    this.updateTrackStack(profile);
  }

  /**
   * Updates faction ticket displays from scoreboard state.
   */
  private updateFactionTickets(profile: PlayerProfile): void {
    const scoreState = (globalThis as any).scoreboardState;
    const factionScores = scoreState?.factionScores ?? { 1: 0, 2: 0, 3: 0 };
    for (const factionId of [1, 2, 3] as const) {
      const widget = this.factionTextWidgets[factionId];
      if (!widget) continue;
      const tickets = factionScores[factionId] ?? 0;
      const factionNames: Record<number, string> = { 1: "LSTR", 2: "MNTR", 3: "VLYR" };
      const message = MakeMessage(`${factionNames[factionId]}: {}/100`, tickets);
      mod.SetUITextLabel(widget, message);
    }
  }

  /**
   * Updates wallet balance and last transaction feedback display.
   */
  private updateWalletDisplay(profile: PlayerProfile): void {
    if (this.walletLabelWidget) {
      const message = MakeMessage("WALLET: ${}", profile.getCash());
      mod.SetUITextLabel(this.walletLabelWidget, message);
    }
    if (this.walletFeedWidget) {
      const lastDelta = profile.lastTransactionDelta ?? 0;
      const lastReason = profile.lastTransactionReason ?? "";
      let displayText = "Ready for Deployment";
      if (lastDelta !== 0) {
        const sign = lastDelta > 0 ? "+" : "-";
        displayText = `${sign}$${Math.abs(lastDelta)} (${lastReason})`;
      }
      const message = MakeMessage(displayText);
      mod.SetUITextLabel(this.walletFeedWidget, message);
    }
  }

  /**
   * Updates the mastery track stack with current XP data.
   * Highlights the track with the highest cumulative XP in high-visibility Cyan.
   */
  private updateTrackStack(profile: PlayerProfile): void {
    let activeTrack: ProgressionTrackKey = "Assault";
    let maxXP = -1;
    for (const track of TRACKS_ORDER) {
      const trackData = profile.tracks[track];
      if (trackData && trackData.xp > maxXP) {
        maxXP = trackData.xp;
        activeTrack = track;
      }
    }
    for (const trackKey of TRACKS_ORDER) {
      const trackData = profile.tracks[trackKey];
      if (!trackData) continue;
      const isHighlight = trackKey === activeTrack;
      const textColor: [number, number, number] = isHighlight ? [0.38, 0.878, 1.0] : [0.55, 0.55, 0.55];
      const barColor: [number, number, number] = isHighlight ? [0.38, 0.878, 1.0] : [0.5, 0.5, 0.5];
      const nameWidget = this.trackNameWidgets[trackKey];
      if (nameWidget) {
        const message = MakeMessage("{} [Tier {}]", trackKey, trackData.level);
        mod.SetUITextLabel(nameWidget, message);
        mod.SetUITextColor(nameWidget, mod.CreateVector(...textColor));
      }
      const xpWidget = this.trackXPWidgets[trackKey];
      if (xpWidget) {
        const nextThreshold = this.getNextThresholdForTrack(trackData);
        const message = MakeMessage("{}/{} XP", trackData.xp, nextThreshold);
        mod.SetUITextLabel(xpWidget, message);
      }
      const fillWidget = this.trackBarFillWidgets[trackKey];
      if (fillWidget) {
        const fillWidth = this.getProgressBarFillWidth(trackData, 310);
        mod.SetUIWidgetSize(fillWidget, mod.CreateVector(fillWidth, 5, 0));
        mod.SetUIWidgetBgColor(fillWidget, mod.CreateVector(...barColor));
      }
    }
  }

  /**
   * Gets the XP threshold needed to reach the next tier.
   */
  private getNextThresholdForTrack(trackData: TrackData): number {
    if (trackData.level >= 5) return XP_THRESHOLDS[4];
    return XP_THRESHOLDS[trackData.level];
  }

  /**
   * Calculates the progress bar fill width based on XP progress within current tier.
   */
  private getProgressBarFillWidth(trackData: TrackData, maxPixelWidth: number): number {
    const nextThreshold = this.getNextThresholdForTrack(trackData);
    const prevThreshold = trackData.level <= 1 ? 0 : XP_THRESHOLDS[trackData.level - 1];
    const range = nextThreshold - prevThreshold;
    if (range <= 0) return maxPixelWidth;
    const progressInTier = trackData.xp - prevThreshold;
    const pct = Math.max(0, Math.min(1.0, progressInTier / range));
    return Math.floor(pct * maxPixelWidth);
  }

  /**
   * Clears UI container widgets from server memories during player exits.
   */
  public destroy(): void {
    if (this.rootWidget) {
      mod.DeleteUIWidget(this.rootWidget);
      this.rootWidget = null;
    }
    this.factionTextWidgets = { 1: null, 2: null, 3: null };
    this.walletLabelWidget = null;
    this.walletFeedWidget = null;
    for (const trackKey of TRACKS_ORDER) {
      this.trackNameWidgets[trackKey] = null;
      this.trackXPWidgets[trackKey] = null;
      this.trackBarFillWidgets[trackKey] = null;
    }
  }
}
