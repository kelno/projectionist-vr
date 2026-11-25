import type { Container } from "@pmndrs/uikit";

import { space } from "../ui/theme.ts";
import { MM, UI_SURFACE, uiLabel, uiMarkActive, uiTextButton, uikitPanel } from "../ui/uikit.ts";

import { SORT_OPTIONS } from "./libraryList.ts";
import type { SortId } from "./libraryList.ts";

export interface SortMenu {
    block: Container;
    setCurrent(sortId: SortId): void;
}

// The small window listing the sort orders, the current one highlighted.
// Choosing one calls `onChoose(sortId)`; its owner shows and hides it.
export function buildSortMenu({ onChoose }: { onChoose: (sortId: SortId) => void }): SortMenu {
    const width = 1.0;
    const buttons = new Map(
        SORT_OPTIONS.map((option) => [
            option.id,
            uiTextButton({
                label: option.label,
                width: width - 0.08,
                fontSize: 0.065,
                onSelect: () => onChoose(option.id),
            }),
        ]),
    );
    const block = uikitPanel(width, undefined, {
        flexDirection: "column",
        alignItems: "center",
        padding: space(2) * MM,
        ...UI_SURFACE,
    });
    block.add(uiLabel("Sort by", { fontSize: 0.065, align: "center", color: "mutedText" }), ...buttons.values());
    block.visible = false;

    return {
        block,
        setCurrent(sortId) {
            for (const [id, button] of buttons) {
                uiMarkActive(button, id === sortId);
            }
        },
    };
}
