import type { Container, Text } from "@pmndrs/uikit";
import { Container as UiContainer } from "@pmndrs/uikit";
import type { Object3D } from "three";

import { createKeyboard } from "../ui/keyboard.ts";
import type { OnScreenKeyboard } from "../ui/keyboard.ts";
import { RADIUS, colour } from "../ui/theme.ts";
import { MM, uiIconButton, uiLabel, uikitPanel } from "../ui/uikit.ts";
import type { UiIconButton } from "../ui/uikit.ts";
import { sanitizeFontText } from "../font.ts";
import * as Helpers from "../Helpers.ts";
import type { createSystemKeyboard } from "../input/systemKeyboard.ts";

import ClearIcon from "../../assets/icons/close.png";

// The library's search box, drawn with uikit: a bar showing the phrase, or a muted "Search..."
// when there is none, with an X inside it to clear the phrase once there is
// one. Selecting the bar opens the headset's own keyboard where the browser
// offers it (`systemKeyboard`, input/systemKeyboard.js), which searches when
// closed. Elsewhere, or if it doesn't show, it opens this app's on-screen
// keyboard (ui/keyboard.ts), where Enter, or selecting the bar again,
// searches.
//
// `onSearch(phrase)` is called with the phrase to search for, "" for none.
// `onTargetsChange()` is called when the clickable parts change (the X shows
// or hides, the keyboard opens or closes), so the owner registers them.
const WIDTH = 2.4;
const HEIGHT = 0.22;
const FONT_SIZE = 0.11;
// Past this many characters, only the end of the phrase shows.
const MAX_SHOWN = 34;

type SystemKeyboard = ReturnType<typeof createSystemKeyboard>;

export class SearchBar {
    phrase = "";
    searchedPhrase = "";

    onSearch: (phrase: string) => void;
    onTargetsChange: () => void;
    systemKeyboard: SystemKeyboard;
    text: Text;
    clearButton: UiIconButton;
    bar: Container;
    onScreen: OnScreenKeyboard;
    // The on-screen keyboard's panel.
    keyboard: Container;
    isTyping = false;
    // Ends the experiment's focus on a text field, if one runs.
    endProbe: () => void = () => {};

    constructor({
        onSearch,
        onTargetsChange,
        systemKeyboard,
    }: {
        onSearch: (phrase: string) => void;
        onTargetsChange: () => void;
        systemKeyboard: SystemKeyboard;
    }) {
        this.onSearch = onSearch;
        this.onTargetsChange = onTargetsChange;
        this.systemKeyboard = systemKeyboard;

        this.text = uiLabel("", { grow: true, fontSize: FONT_SIZE });
        this.clearButton = uiIconButton({
            icon: ClearIcon,
            tooltip: "Clear the search",
            size: 0.15,
            onSelect: () => this.clear(),
        });

        // The whole bar is one panel; the X keeps its clicks to itself.
        this.bar = uikitPanel(WIDTH, HEIGHT, {
            flexDirection: "row",
            alignItems: "center",
            paddingX: 0.06 * MM,
            paddingY: 0.02 * MM,
            borderRadius: RADIUS.button * MM,
            backgroundColor: colour("raised"),
            hover: { backgroundColor: colour("hovered") },
            onClick: () => {
                if (this.isTyping) {
                    this.submit();
                } else if (this.systemKeyboard.isAvailable()) {
                    this.typeOnSystemKeyboard();
                } else {
                    this.startTyping();
                    // The experiment in input/systemKeyboard.ts: whether the
                    // browser shows a keyboard of its own anyway.
                    this.endProbe = this.systemKeyboard.probe({ onInput: (text) => this.setPhrase(text) });
                }
            },
        });
        this.bar.add(this.text, new UiContainer({ width: 0.15 * MM, flexShrink: 0 }), this.clearButton);

        this.onScreen = createKeyboard({
            onType: (character) => this.setPhrase(this.phrase + character),
            onBackspace: () => this.setPhrase(this.phrase.slice(0, -1)),
            onEnter: () => this.submit(),
        });
        this.keyboard = this.onScreen.root;
        this.keyboard.visible = false;
        this.render();
    }

    // The bar, with its X inside, and the keyboard while typing.
    targets(): Object3D[] {
        return this.isTyping ? [this.keyboard, this.bar] : [this.bar];
    }

    // Opens this app's on-screen keyboard, on its letters.
    startTyping() {
        this.onScreen.reset();
        this.setTyping(true);
    }

    setTyping(typing: boolean): void {
        if (!typing) {
            this.endProbe();
            this.endProbe = () => {};
        }
        this.isTyping = typing;
        this.keyboard.visible = typing;
        this.onTargetsChange();
    }

    // The headset's keyboard starts each time from an empty text, shown in
    // the bar as it's typed and searched for when the keyboard closes.
    typeOnSystemKeyboard() {
        this.systemKeyboard.open({
            onInput: (text: string) => this.setPhrase(text),
            onClose: (text: string) => {
                this.setPhrase(text);
                this.search(text);
            },
            onFail: () => this.startTyping(),
        });
    }

    // Closes the keyboard without searching, back to the last search.
    stopTyping() {
        this.setTyping(false);
        this.setPhrase(this.searchedPhrase);
    }

    submit() {
        this.setTyping(false);
        this.search(this.phrase);
    }

    // Empties the phrase and closes the keyboard, if open.
    clear() {
        if (this.isTyping) this.setTyping(false);
        this.setPhrase("");
        this.search("");
    }

    search(phrase: string): void {
        this.searchedPhrase = phrase;
        this.onSearch(phrase);
        this.onTargetsChange();
    }

    setPhrase(phrase: string): void {
        const clearShowedBefore = this.phrase !== "";
        this.phrase = phrase;
        this.render();
        if (clearShowedBefore !== (phrase !== "")) {
            this.onTargetsChange();
        }
    }

    render() {
        const empty = this.phrase === "";
        const shown = this.phrase.length > MAX_SHOWN ? "..." + this.phrase.slice(-(MAX_SHOWN - 3)) : this.phrase;
        this.text.setProperties({
            text: empty ? Helpers.getWordFromLang("search") : sanitizeFontText(shown),
            color: colour(empty ? "mutedText" : "text"),
        });
        this.clearButton.setProperties({ visibility: empty ? "hidden" : "visible" });
    }
}
