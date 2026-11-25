import type { Container, Text } from "@pmndrs/uikit";
import { Container as UiContainer } from "@pmndrs/uikit";
import type { Object3D } from "three";
import { Keyboard } from "../ui/meshUi.ts";

import { FONT, SURFACE } from "../ui/kit.ts";
import { RADIUS, colour, materialColour, space, textOn } from "../ui/theme.ts";
import type { ColourName } from "../ui/theme.ts";
import { MM, uiIconButton, uiLabel, uikitPanel } from "../ui/uikit.ts";
import type { UiIconButton } from "../ui/uikit.ts";
import { sanitizeFontText } from "../font.ts";
import * as Helpers from "../Helpers.ts";
import type { createSystemKeyboard } from "../input/systemKeyboard.ts";

import Backspace from "../../assets/icons/backspace.png";
import Enter from "../../assets/icons/enter.png";
import Shift from "../../assets/icons/shift.png";
import ClearIcon from "../../assets/icons/close.png";

// The library's search box, drawn with uikit: a bar showing the phrase, or a muted "Search..."
// when there is none, with an X inside it to clear the phrase once there is
// one. Selecting the bar opens the headset's own keyboard where the browser
// offers it (`systemKeyboard`, input/systemKeyboard.js), which searches when
// closed. Elsewhere, or if it doesn't show, it opens this app's on-screen
// keyboard, where Enter, or selecting the bar again, searches. That keyboard
// is still three-mesh-ui's.
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

// What three-mesh-ui's keyboard gives each key: the command of a special
// key, or the character a key types.
interface KeyInfo {
    command?: string;
    input?: string;
}

export class SearchBar {
    phrase = "";
    searchedPhrase = "";

    onSearch: (phrase: string) => void;
    onTargetsChange: () => void;
    systemKeyboard: SystemKeyboard;
    text: Text;
    clearButton: UiIconButton;
    bar: Container;
    keyboard: Keyboard;
    // Set by makeKeyboard().
    keys!: Object3D[];

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
            backgroundColor: materialColour("raised"),
            hover: { backgroundColor: materialColour("hovered") },
            onClick: () => {
                if (this.isTyping) {
                    this.submit();
                } else if (this.systemKeyboard.isAvailable()) {
                    this.typeOnSystemKeyboard();
                } else {
                    this.startTyping();
                }
            },
        });
        this.bar.add(this.text, new UiContainer({ width: 0.15 * MM, flexShrink: 0 }), this.clearButton);

        this.keyboard = this.makeKeyboard();
        this.keyboard.visible = false;
        this.render();
    }

    get isTyping(): boolean {
        return this.keyboard.visible;
    }

    // The bar, with its X inside, and the keys of the keyboard's current
    // page while typing. The other pages' keys must stay out: three.js still
    // raycasts objects detached from the scene, so a hidden letter key would
    // take a click meant for the symbol key in its place.
    targets(): Object3D[] {
        const keys = this.isTyping ? this.keys.filter((key) => this.keyboard.getObjectById(key.id)) : [];
        return [...keys, this.bar];
    }

    // Opens this app's on-screen keyboard.
    startTyping() {
        this.keyboard.visible = true;
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
        this.keyboard.visible = false;
        this.setPhrase(this.searchedPhrase);
    }

    submit() {
        this.keyboard.visible = false;
        this.search(this.phrase);
    }

    clear() {
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
            color: materialColour(empty ? "mutedText" : "text"),
        });
        this.clearButton.setProperties({ visibility: empty ? "hidden" : "visible" });
    }

    makeKeyboard(): Keyboard {
        const keyLook = (background: ColourName) => ({
            backgroundColor: colour(background),
            backgroundOpacity: 1,
            fontColor: textOn(background),
        });
        const keyboard = new Keyboard({
            language: "eng",
            ...FONT,
            fontSize: 0.12,
            width: 4,
            height: 1.6,
            padding: space(2),
            // No border: the keyboard's keys would each take it (meshUi.js).
            ...SURFACE,
            borderWidth: 0,
            backspaceTexture: Backspace,
            shiftTexture: Shift,
            enterTexture: Enter,
        });

        this.keys = keyboard.keys;
        for (const key of keyboard.keys) {
            key.setupState({
                state: "idle",
                attributes: { offset: 0, ...keyLook("raised") },
            });
            key.setupState({
                state: "hovered",
                attributes: { offset: 0, ...keyLook("hovered") },
            });
            key.setupState({
                state: "selected",
                attributes: { offset: -0.009, ...keyLook("accent") },
                onSet: () => this.pressKey(keyboard, key.info),
            });
        }
        return keyboard;
    }

    pressKey(keyboard: Keyboard, info: KeyInfo): void {
        switch (info.command) {
            case "switch":
                keyboard.setNextPanel();
                this.onTargetsChange();
                break;
            case "switch-set":
                keyboard.setNextCharset();
                break;
            case "shift":
                keyboard.toggleCase();
                break;
            case "enter":
                this.submit();
                break;
            case "space":
                this.setPhrase(this.phrase + " ");
                break;
            case "backspace":
                this.setPhrase(this.phrase.slice(0, -1));
                break;
            default:
                if (info.input) {
                    this.setPhrase(this.phrase + info.input);
                }
        }
    }
}
