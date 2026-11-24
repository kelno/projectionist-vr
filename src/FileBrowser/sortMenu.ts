import type { Block } from "../ui/meshUi.ts";
import { label, markActive, panel, textButton } from "../ui/kit.ts";

import { SORT_OPTIONS } from "./libraryList.ts";
import type { SortId } from "./libraryList.ts";

export interface SortMenu {
    block: Block;
    targets: Block[];
    setCurrent(sortId: SortId): void;
}

// The small window listing the sort orders, the current one highlighted.
// Choosing one calls `onChoose(sortId)`; its owner shows and hides it.
export function buildSortMenu({ onChoose }: { onChoose: (sortId: SortId) => void }): SortMenu {
    const width = 1.0;
    const buttons = new Map(
        SORT_OPTIONS.map((option) => [
            option.id,
            textButton({
                label: option.label,
                width: width - 0.08,
                fontSize: 0.065,
                onSelect: () => onChoose(option.id),
            }),
        ])
    );
    const block = panel(
        [
            label("Sort by", { width: width - 0.08, height: 0.12, fontSize: 0.065, align: "center", color: "mutedText" }),
            ...buttons.values(),
        ],
        { width, height: 0.2 + SORT_OPTIONS.length * 0.19 }
    );
    block.visible = false;

    return {
        block,
        targets: [...buttons.values()],
        setCurrent(sortId) {
            for (const [id, button] of buttons) {
                markActive(button, id === sortId);
            }
        },
    };
}
