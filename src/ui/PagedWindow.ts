import type { Container } from "@pmndrs/uikit";
import { Container as UiContainer } from "@pmndrs/uikit";

import { space } from "./theme.ts";
import { MM, UI_SURFACE, uiIconButton, uiLabel, uikitPanel } from "./uikit.ts";
import type { UiIconButton } from "./uikit.ts";
import type { Text } from "@pmndrs/uikit";

import BackIcon from "../../assets/icons/left.png";

// A window with pages, like a game's pause menu, drawn with uikit: a header
// with a back button (on sub-pages) and the page's title, above the page
// shown. A page is { title, block, onShow }: `onShow` refreshes it each time
// it opens.
//
// There is no close button: a click outside closes the window, which its
// owner handles. The whole window is one raycast target, `container`: the
// pointer finds its buttons inside it (input/uikitEvents.ts), and a click on
// its background is inside the window, so it doesn't close it.
const HEADER_BUTTON_SIZE = 0.11;
const HEADER_HEIGHT = 0.16;
const PADDING = space(2);

export interface Page {
    title: string;
    block: Container;
    onShow?: () => void;
}

export class PagedWindow {
    pages: Map<string, Page>;
    // The ids of the pages opened since the window opened, the shown one last.
    history: string[];
    isOpen: boolean;
    backButton: UiIconButton;
    title: Text;
    body: Container;
    container: Container;

    constructor({ width, bodyHeight }: { width: number; bodyHeight: number }) {
        this.pages = new Map();
        this.history = [];
        this.isOpen = false;

        this.container = uikitPanel(width, bodyHeight + HEADER_HEIGHT + 2 * PADDING, {
            flexDirection: "column",
            padding: PADDING * MM,
            ...UI_SURFACE,
        });
        this.backButton = uiIconButton({
            icon: BackIcon,
            tooltip: "Back",
            size: HEADER_BUTTON_SIZE,
            onSelect: () => this.back(),
        });
        // As wide as the back button, so the title stays centred.
        const spacer = new UiContainer({
            width: HEADER_BUTTON_SIZE * MM,
            height: HEADER_BUTTON_SIZE * MM,
            margin: space(1) * MM,
            flexShrink: 0,
        });
        this.title = uiLabel("-", { grow: true, fontSize: 0.075, align: "center" });
        const header = new UiContainer({
            flexDirection: "row",
            alignItems: "center",
            height: HEADER_HEIGHT * MM,
            flexShrink: 0,
        });
        header.add(this.backButton, this.title, spacer);
        this.body = new UiContainer({ flexDirection: "column", height: bodyHeight * MM, flexShrink: 0 });
        this.container.add(header, this.body);
        this.container.visible = false;
    }

    addPage(id: string, page: Page): void {
        this.pages.set(id, page);
    }

    get currentPage(): Page | undefined {
        return this.pages.get(this.history[this.history.length - 1]);
    }

    open(pageId: string): void {
        // The page shown when the window was last closed is still in it.
        const shown = this.currentPage;
        if (shown) {
            this.body.remove(shown.block);
        }
        this.history = [];
        this.isOpen = true;
        this.container.visible = true;
        this.show(pageId);
    }

    close() {
        this.isOpen = false;
        this.container.visible = false;
    }

    show(pageId: string): void {
        const previous = this.currentPage;
        if (previous) {
            this.body.remove(previous.block);
        }
        this.history.push(pageId);
        this.render();
    }

    back() {
        if (this.history.length < 2) {
            return;
        }
        // With two pages or more in the history, the last one was added.
        this.body.remove(this.currentPage!.block);
        this.history.pop();
        this.render();
    }

    render() {
        const page = this.currentPage;
        if (!page) {
            throw new Error(`No page "${this.history[this.history.length - 1]}" in this window.`);
        }
        page.onShow?.();
        this.body.add(page.block);
        this.title.setProperties({ text: page.title });
        this.backButton.setProperties({ visibility: this.history.length > 1 ? "visible" : "hidden" });
    }
}
