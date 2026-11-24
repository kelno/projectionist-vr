import { Color } from "three";
import { Block } from "./meshUi.js";

import { FONT, column, iconButton, label, row } from "./kit.js";

import BackIcon from "../../assets/icons/left-arrow.png";
import CloseIcon from "../../assets/icons/close.png";

// A window with pages, like a game's pause menu: a header with a back button
// (on sub-pages), the page's title and a close button, above the page shown.
// A page is { title, block, targets, onShow }: `targets` are its buttons, for
// the raycaster, and `onShow` refreshes it each time it opens.
//
// The window doesn't decide what an outside click does; its owner closes it.
// `onTargetsChange(targets)` is called whenever the clickable parts change,
// so the owner can register them.
export class PagedWindow {
    constructor({ width, bodyHeight, onClose, onTargetsChange }) {
        this.width = width;
        this.onClose = onClose;
        this.onTargetsChange = onTargetsChange;
        this.pages = new Map();
        this.history = [];
        this.isOpen = false;

        const innerWidth = width - 0.08;
        this.backButton = iconButton({
            icon: BackIcon,
            tooltip: "Back",
            size: 0.11,
            onSelect: () => this.back(),
        });
        this.closeButton = iconButton({
            icon: CloseIcon,
            tooltip: "Close",
            size: 0.11,
            onSelect: () => this.onClose(),
        });
        this.title = label("-", { width: innerWidth - 0.4, fontSize: 0.075, align: "center" });
        this.header = row([this.backButton, this.title, this.closeButton], {
            width: innerWidth,
            height: 0.16,
            justify: "space-between",
        });
        this.body = column([], { width: innerWidth, height: bodyHeight });

        this.container = new Block({
            width,
            height: bodyHeight + 0.28,
            contentDirection: "column",
            justifyContent: "start",
            padding: 0.04,
            borderRadius: 0.06,
            backgroundColor: new Color(0x1e1e1e),
            backgroundOpacity: 1,
            ...FONT,
        }).add(this.header, this.body);
        // A click on the window's background is inside the window: nothing.
        this.container.setupState({ state: "selected" });
        this.container.setupState({ state: "hovered" });
        this.container.setupState({ state: "idle" });
        this.container.visible = false;
    }

    addPage(id, page) {
        this.pages.set(id, page);
    }

    get currentPage() {
        return this.pages.get(this.history[this.history.length - 1]);
    }

    // The clickable parts: the header's buttons, the current page's, and the
    // window itself.
    targets() {
        const buttons = this.history.length > 1 ? [this.backButton] : [];
        return [...buttons, this.closeButton, ...(this.currentPage?.targets ?? []), this.container];
    }

    open(pageId) {
        this.history = [];
        this.isOpen = true;
        this.container.visible = true;
        this.show(pageId);
    }

    close() {
        this.isOpen = false;
        this.container.visible = false;
    }

    show(pageId) {
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
        this.body.remove(this.currentPage.block);
        this.history.pop();
        this.render();
    }

    render() {
        const page = this.currentPage;
        page.onShow?.();
        this.body.add(page.block);
        this.title.text.set({ content: page.title });
        this.backButton.visible = this.history.length > 1;
        this.onTargetsChange(this.targets());
    }
}
