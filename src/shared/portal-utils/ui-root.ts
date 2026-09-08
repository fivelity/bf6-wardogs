import { UIContainer } from "./ui-container";

export function createPlayerUIRoot(
    player: mod.Player,
    width: number,
    height: number,
    visible: boolean = true,
): mod.UIWidget {
    const container = new UIContainer({
        position: { x: 0, y: 0 },
        size: { width, height },
        anchor: mod.UIAnchor.Center,
        receiver: player,
        visible,
    });

    return container.uiWidget;
}
