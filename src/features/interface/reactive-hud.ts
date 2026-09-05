// src/features/interface/reactive-hud.ts
import { SolidUI } from "bf6-portal-utils/solid-ui";
import { Events } from "bf6-portal-utils/events";
import { Timers } from "bf6-portal-utils/timers";
import { mercenaryRegistry, ProgressionTrackKey } from "../progression/profile";

/**
 * SolidUI-powered in-game main HUD overlay.
 * Renders the persistent screen overlays that PMC operators see during active gameplay.
 * Highly optimized via fine-grained reactive signals to eliminate per-tick layout redraws.
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

  // Ordered list of dynamic progression tracks for rendering the Left-Center stack
  private readonly tracksOrder: ProgressionTrackKey[] = [
    "Assault",
    "Medic",
    "Recon",
    "Support",
    "Driver",
    "Pilot",
  ];

  constructor(player: mod.Player) {
    this.player = player;
    this.playerId = mod.GetObjId(player);
    this.rootWidget = this.render();
  }

  /**
   * Constructs the unified on-screen gameplay HUD.
   */
  private render(): mod.UIWidget {
    return SolidUI.render(() => {
      const profile = mercenaryRegistry.get(this.playerId);
      if (!profile)
        return {
          type: "Container",
          name: `EmptyHUD_${this.playerId}`,
          visible: false,
        };

      return {
        type: "Container",
        name: `WardogsHUD_Root_${this.playerId}`,
        position: [0, 0, 0],
        size: [1920, 1080, 0],
        anchor: mod.UIAnchor.Center,
        bgAlpha: 0,
        visible: true,
        children: [
          // ==========================================
          // 1. TOP-CENTER: FACTION PROGRESS HEADERS
          // ==========================================
          {
            type: "Container",
            name: "FactionHUD_Header",
            position: [0, 45, 0],
            size: [700, 80, 0],
            anchor: mod.UIAnchor.TopCenter,
            bgAlpha: 0.4,
            bgColor: [0.02, 0.02, 0.02],
            bgFill: mod.UIBgFill.None,
            children: [
              // Team 1: Lonestar Progress (Cyan)
              {
                type: "Container",
                name: "LSTR_Progress_Container",
                position: [-220, 0, 0],
                size: [180, 50, 0],
                anchor: mod.UIAnchor.Center,
                bgAlpha: 0.2,
                children: [
                  {
                    type: "Text",
                    name: "LSTR_Progress_Text",
                    textLabel: {
                      text: "LSTR: {}/100",
                      arg: [() => this.getFactionTickets(1)], // Reactive signal
                    },
                    textSize: 18,
                    textColor: [0.38, 0.878, 1.0], // Cyan Faction color
                    anchor: mod.UIAnchor.Center,
                  },
                ],
              },
              // Team 2: Manticore Progress (Orange)
              {
                type: "Container",
                name: "MNTR_Progress_Container",
                position: [0, 0, 0],
                size: [180, 50, 0],
                anchor: mod.UIAnchor.Center,
                bgAlpha: 0.2,
                children: [
                  {
                    type: "Text",
                    name: "MNTR_Progress_Text",
                    textLabel: {
                      text: "MNTR: {}/100",
                      arg: [() => this.getFactionTickets(2)], // Reactive signal
                    },
                    textSize: 18,
                    textColor: [1.0, 0.561, 0.384], // Orange Faction color
                    anchor: mod.UIAnchor.Center,
                  },
                ],
              },
              // Team 3: Valkyra Progress (Silver/White)
              {
                type: "Container",
                name: "VLYR_Progress_Container",
                position: [220, 0, 0],
                size: [180, 50, 0],
                anchor: mod.UIAnchor.Center,
                bgAlpha: 0.2,
                children: [
                  {
                    type: "Text",
                    name: "VLYR_Progress_Text",
                    textLabel: {
                      text: "VLYR: {}/100",
                      arg: [() => this.getFactionTickets(3)], // Reactive signal
                    },
                    textSize: 18,
                    textColor: [0.816, 0.859, 0.847], // Valkyra Silver color
                    anchor: mod.UIAnchor.Center,
                  },
                ],
              },
            ],
          },

          // ==========================================
          // 2. TOP-LEFT: ACTIVE WALLET DISPLAY
          // ==========================================
          {
            type: "Container",
            name: "WalletHUD_Card",
            position: [60, 45, 0], // Restructured to top-left area
            size: [320, 90, 0],
            anchor: mod.UIAnchor.TopLeft,
            bgAlpha: 0.6,
            bgColor: [0.02, 0.03, 0.02], // Sleek, slightly greenish translucent tint
            bgFill: mod.UIBgFill.Solid,
            children: [
              // Wallet Balance Icon and Label
              {
                type: "Text",
                name: "WalletHUD_Label",
                textLabel: {
                  text: "WALLET: ${}",
                  arg: [() => profile.getCash()], // Reactive cash signal
                },
                position: [20, 0, 0],
                size: [280, 40, 0],
                textSize: 24,
                textColor: [0.4, 1.0, 0.4], // Vibrant cash green
                anchor: mod.UIAnchor.CenterLeft,
              },
              // Dynamic Transaction Feed
              {
                type: "Text",
                name: "WalletHUD_Feedback",
                textLabel: {
                  text: "{}",
                  arg: [() => this.getLastTransactionText(profile)],
                },
                position: [20, 30, 0],
                size: [280, 30, 0],
                textSize: 14,
                textColor: [0.75, 0.75, 0.75],
                anchor: mod.UIAnchor.CenterLeft,
              },
            ],
          },

          // ==========================================
          // 3. LEFT-CENTER: ACTIVE MASTERY TRACKS STACK
          // ==========================================
          {
            type: "Container",
            name: "TrackHUD_Stack_Card",
            position: [60, 0, 0], // Positioned perfectly on Left-Center
            size: [350, 450, 0],
            anchor: mod.UIAnchor.CenterLeft,
            bgAlpha: 0.55,
            bgColor: [0.03, 0.03, 0.04], // Subdued dark blueprint background tint
            bgFill: mod.UIBgFill.Solid,
            children: [
              // Section Title Overlay
              {
                type: "Text",
                name: "TrackHUD_Stack_Title",
                textLabel: { text: "ROLE PROFICIENCY MASTERY" },
                position: [20, -195, 0],
                size: [310, 30, 0],
                textSize: 15,
                textColor: [0.8, 0.8, 0.8],
                anchor: mod.UIAnchor.CenterLeft,
              },
              // Dynamic Stack Loop for all 6 specialized dynamic PMC roles
              ...this.tracksOrder.map((trackKey, index) => {
                const yOffset = -140 + index * 60; // Clean 60px vertical list step layout
                const isProgressing = () =>
                  this.isCurrentlyProgressing(profile, trackKey);

                return {
                  type: "Container",
                  name: `TrackHUD_Row_${trackKey}`,
                  position: [0, yOffset, 0],
                  size: [350, 55, 0],
                  anchor: mod.UIAnchor.Center,
                  bgAlpha: 0,
                  children: [
                    // Track Name + Active Level Indicator Label
                    {
                      type: "Text",
                      name: `TrackHUD_Name_${trackKey}`,
                      textLabel: {
                        text: "{} [Tier {}]",
                        arg: [
                          () => trackKey.toUpperCase(),
                          () => profile.tracks[trackKey].level,
                        ],
                      },
                      position: [20, -14, 0],
                      size: [200, 20, 0],
                      textSize: 13,
                      // Reactive Highlight: Cyan for progressing track, dimmed grey for others
                      textColor: () =>
                        isProgressing()
                          ? [0.38, 0.878, 1.0]
                          : [0.55, 0.55, 0.55],
                      anchor: mod.UIAnchor.CenterLeft,
                    },
                    // Track XP Progress text overlay
                    {
                      type: "Text",
                      name: `TrackHUD_XP_${trackKey}`,
                      textLabel: {
                        text: "{} / {} XP",
                        arg: [
                          () => profile.tracks[trackKey].xp,
                          () =>
                            this.getDisplayNextThresholdForTrack(
                              profile,
                              trackKey,
                            ),
                        ],
                      },
                      position: [180, -14, 0],
                      size: [150, 20, 0],
                      textSize: 11,
                      textColor: () =>
                        isProgressing() ? [0.9, 0.9, 0.9] : [0.45, 0.45, 0.45],
                      anchor: mod.UIAnchor.CenterRight,
                    },
                    // Horizontal dynamic progress bar background
                    {
                      type: "Container",
                      name: `TrackHUD_BarBg_${trackKey}`,
                      position: [20, 10, 0],
                      size: [310, 5, 0],
                      anchor: mod.UIAnchor.CenterLeft,
                      bgAlpha: () => (isProgressing() ? 0.3 : 0.15),
                      bgColor: [0.5, 0.5, 0.5],
                      children: [
                        // Dynamic horizontal fill-scale mapping progress percentage
                        {
                          type: "Container",
                          name: `TrackHUD_BarFill_${trackKey}`,
                          position: [0, 0, 0],
                          size: [
                            () =>
                              this.getProgressBarFillWidthForTrack(
                                profile,
                                trackKey,
                                310,
                              ),
                            5,
                            0,
                          ],
                          anchor: mod.UIAnchor.CenterLeft,
                          bgAlpha: () => (isProgressing() ? 0.9 : 0.35),
                          // Filled as bright Cyan if active, or dimmed steel blue if secondary
                          bgColor: () =>
                            isProgressing()
                              ? [0.38, 0.878, 1.0]
                              : [0.4, 0.45, 0.5],
                        },
                      ],
                    },
                  ],
                };
              }),
            ],
          },
        ],
      };
    }, this.player);
  }

  /**
   * Resolves the active faction's current victory tickets from memory.
   */
  private getFactionTickets(factionId: number): number {
    const scoreState = (globalThis as any).scoreboardState;
    if (scoreState && scoreState.factionScores) {
      return scoreState.factionScores[factionId] ?? 0;
    }
    return 0;
  }

  /**
   * Formulates localized text helper lines indicating the latest transaction.
   */
  private getLastTransactionText(profile: any): string {
    const lastDelta = profile.lastTransactionDelta ?? 0;
    const lastReason = profile.lastTransactionReason ?? "";
    if (lastDelta === 0) return "Ready for Deployment";

    const sign = lastDelta > 0 ? "+" : "-";
    return `${sign}$${Math.abs(lastDelta)} (${lastReason})`;
  }

  /**
   * Reactively checks if a given track is the player's active/primary dynamic progression path.
   * It highlights the track that is currently the progressing track (the track with highest cumulative XP).
   */
  private isCurrentlyProgressing(
    profile: any,
    trackKey: ProgressionTrackKey,
  ): boolean {
    let activeName = "Assault";
    let maxXP = -1;

    for (const track of this.tracksOrder) {
      const trackData = profile.tracks[track];
      if (trackData && trackData.xp > maxXP) {
        maxXP = trackData.xp;
        activeName = track;
      }
    }
    return activeName === trackKey;
  }

  private getDisplayNextThresholdForTrack(
    profile: any,
    trackKey: ProgressionTrackKey,
  ): number {
    const trackData = profile.tracks[trackKey];
    const xpThresholds = [0, 1000, 2500, 5000, 10000];
    if (!trackData) return 1000;
    if (trackData.level >= 5) return 10000;
    return xpThresholds[trackData.level];
  }

  private getProgressBarFillWidthForTrack(
    profile: any,
    trackKey: ProgressionTrackKey,
    maxPixelWidth: number,
  ): number {
    const trackData = profile.tracks[trackKey];
    if (!trackData) return 0;

    const nextThreshold = this.getDisplayNextThresholdForTrack(
      profile,
      trackKey,
    );
    const prevThreshold =
      trackData.level <= 1
        ? 0
        : [0, 1000, 2500, 5000, 10000][trackData.level - 1];

    const range = nextThreshold - prevThreshold;
    if (range <= 0) return maxPixelWidth;

    const progressInTier = trackData.xp - prevThreshold;
    const pct = Math.max(0, Math.min(1.0, progressInTier / range));
    return Math.floor(pct * maxPixelWidth);
  }

  /**
   * Forces the UI text labels to redraft.
   */
  public refresh(): void {
    // Redraw hooks in SolidUI handle children refresh ticks programmatically
  }

  /**
   * Clears UI container widgets from server memories during player exits.
   */
  public destroy(): void {
    if (this.rootWidget) {
      mod.DeleteUIWidget(this.rootWidget);
      this.rootWidget = null;
    }
  }
}
