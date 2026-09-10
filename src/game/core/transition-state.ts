/**
 * TransitionState — fires only on the false→true edge of a condition, never while it merely
 * remains true. This is a generic primitive `game/core` provides for anything mode-specific that
 * must not re-fire every tick (capture completion, FOB placement confirmation, HotZone
 * entry/exit).
 *
 * NOTE: this is hand-rolled, not a `bf6-portal-utils` export. Checked directly against the
 * extracted `bf6-portal-utils@9.4.0` package (`events`, `ui`, `solid-ui`, `timers`, `clocks`,
 * `mod-extensions`, `logging`/`logger`, `callback-handler`, `multi-click-detector`,
 * `performance-stats`, `map-detector`, `player-undeploy-fixer`, `raycast`, `sounds`,
 * `scavenger-drop`, `ffa-spawn-points`, `ffa-drop-ins`, `benchmarker`, `vectors`,
 * `portal-gadget`) — none of those modules expose a one-shot condition-transition primitive, so
 * this is WARDOGS's own utility, not a substitute for a real SDK export.
 */
export class TransitionState {
	private previous = false;

	/**
	 * Feed the current boolean value of the condition. Returns true only on the tick where the
	 * condition becomes true after previously being false.
	 */
	update(current: boolean): boolean {
		const rising = current && !this.previous;
		this.previous = current;
		return rising;
	}

	/** Explicit reset, e.g. when a round or FOB lifecycle restarts. */
	reset(): void {
		this.previous = false;
	}
}
