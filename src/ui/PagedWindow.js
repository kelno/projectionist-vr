import { Block } from "./meshUi.js";

import { column, iconButton, label, panel, row } from "./kit.js";

import BackIcon from "../../assets/icons/left-arrow.png";

// A window with pages, like a game's pause menu: a header with a back button
// (on sub-pages) and the page's title, above the page shown. A page is
// { title, block, targets, onShow }: `targets` are its buttons, for the
// raycaster, and `onShow` refreshes it each time it opens.
//
// There is no close button: a click outside closes the window, which its
// owner handles. `onTargetsChange(targets)` is called whenever the clickable
// parts change, so the owner can register them.
const HEADER_BUTTON_SIZE = 0.11;

export class PagedWindow {
    constructor({ width, bodyHeight, onTargetsChange }) {
        this.onTargetsChange = onTargetsChange;
        this.pages = new Map();
        this.history = [];
        this.isOpen = false;

        const innerWidth = width - 0.08;
        this.backButton = iconButton({
            icon: BackIcon,
            tooltip: "Back",
            size: HEADER_BUTTON_SIZE,
            onSelect: () => this.back(),
        });
        // As wide as the back button, so the title stays centred.
        const spacer = new Block({
            width: HEADER_BUTTON_SIZE,
            height: HEADER_BUTTON_SIZE,
            margin: 0.02,
            backgroundOpacity: 0,
        });
        this.title = label("-", { width: innerWidth - 0.4, fontSize: 0.075, align: "center" });
        this.header = row([this.backButton, this.title, spacer], {
            width: innerWidth,
            height: 0.16,
            justify: "space-between",
        });
        this.body = column([], { width: innerWidth, height: bodyHeight });

        this.container = panel([this.header, this.body], {
            width,
            height: bodyHeight + 0.28,
        });
        this.container.visible = false;
    }

    addPage(id, page) {
        this.pages.set(id, page);
    }

    get currentPage() {
        return this.pages.get(this.history[this.history.length - 1]);
    }

    // The clickable parts: the back button, the current page's, and the
    // window itself.
    targets() {
        const buttons = this.history.length > 1 ? [this.backButton] : [];
        return [...buttons, ...(this.currentPage?.targets ?? []), this.container];
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
