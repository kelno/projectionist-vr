import { Color } from "three";
import { Block, Text, Keyboard } from "../ui/meshUi.js";

import { FONT, iconButton } from "../ui/kit.js";
import { sanitizeFontText } from "../font.js";
import * as Helpers from "../Helpers.js";

import Backspace from "../../assets/ui/keyboard/backspace.png";
import Enter from "../../assets/ui/keyboard/enter.png";
import Shift from "../../assets/ui/keyboard/shift.png";
import ClearIcon from "../../assets/icons/close.png";

// The library's search box: a bar showing the phrase, or a muted "Search..."
// when there is none, with an X inside it to clear the phrase once there is
// one. Selecting the bar opens the headset's own keyboard where the browser
// offers it (`systemKeyboard`, input/systemKeyboard.js), which searches when
// closed. Elsewhere, or if it doesn't show, it opens this app's on-screen
// keyboard, where Enter, or selecting the bar again, searches.
//
// `onSearch(phrase)` is called with the phrase to search for, "" for none.
// `onTargetsChange()` is called when the clickable parts change (the X shows
// or hides, the keyboard opens or closes), so the owner registers them.
const WIDTH = 2.4;
const HEIGHT = 0.2;
const FONT_SIZE = 0.11;
// Past this many characters, only the end of the phrase shows.
const MAX_SHOWN = 34;

const COLORS = {
    idle: { background: 0x5c5c5c, text: 0xffffff, placeholder: 0x9a9a9a },
    hovered: { background: 0xffff00, text: 0x000000, placeholder: 0x6b6b00 },
};

export class SearchBar {
    phrase = "";
    searchedPhrase = "";
    hovered = false;

    constructor({ onSearch, onTargetsChange, systemKeyboard }) {
        this.onSearch = onSearch;
        this.onTargetsChange = onTargetsChange;
        this.systemKeyboard = systemKeyboard;

        this.text = new Text({ content: "", fontSize: FONT_SIZE });
        const textBox = new Block({
            width: WIDTH - 0.26,
            height: HEIGHT - 0.04,
            justifyContent: "center",
            textAlign: "left",
            padding: 0.04,
            backgroundOpacity: 0,
            ...FONT,
        }).add(this.text);

        this.clearButton = iconButton({
            icon: ClearIcon,
            tooltip: "Clear the search",
            size: 0.15,
            onSelect: () => this.clear(),
        });

        this.bar = new Block({
            width: WIDTH,
            height: HEIGHT,
            contentDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 0.02,
            borderRadius: 0.08,
            backgroundColor: new Color(COLORS.idle.background),
            backgroundOpacity: 1,
            hiddenOverflow: true,
            ...FONT,
        }).add(textBox, this.clearButton);
        this.bar.setupState({
            state: "selected",
            onSet: () => {
                if (this.isTyping) {
                    this.submit();
                } else if (this.systemKeyboard.isAvailable()) {
                    this.typeOnSystemKeyboard();
                } else {
                    this.startTyping();
                }
            },
        });
        for (const state of ["hovered", "idle"]) {
            this.bar.setupState({
                state,
                attributes: { backgroundColor: new Color(COLORS[state].background) },
                onSet: () => {
                    this.hovered = state === "hovered";
                    this.render();
                },
            });
        }

        this.keyboard = this.makeKeyboard();
        this.keyboard.visible = false;
        this.render();
    }

    get isTyping() {
        return this.keyboard.visible;
    }

    // The bar, the X when it shows, and the keys of the keyboard's current
    // page while typing. The other pages' keys must stay out: three.js still
    // raycasts objects detached from the scene, so a hidden letter key would
    // take a click meant for the symbol key in its place. The X comes before
    // the bar: the bar's hit includes its children, so both are hit at the
    // same distance, and the first one listed wins.
    targets() {
        const keys = this.isTyping
            ? this.keys.filter((key) => this.keyboard.getObjectById(key.id))
            : [];
        return [
            ...keys,
            ...(this.phrase !== "" ? [this.clearButton] : []),
            this.bar,
        ];
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
            onInput: (text) => this.setPhrase(text),
            onClose: (text) => {
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

    search(phrase) {
        this.searchedPhrase = phrase;
        this.onSearch(phrase);
        this.onTargetsChange();
    }

    setPhrase(phrase) {
        const clearShowedBefore = this.phrase !== "";
        this.phrase = phrase;
        this.render();
        if (clearShowedBefore !== (phrase !== "")) {
            this.onTargetsChange();
        }
    }

    render() {
        const colors = COLORS[this.hovered ? "hovered" : "idle"];
        const empty = this.phrase === "";
        const shown =
            this.phrase.length > MAX_SHOWN
                ? "..." + this.phrase.slice(-(MAX_SHOWN - 3))
                : this.phrase;
        this.text.set({
            content: empty ? Helpers.getWordFromLang("search") : sanitizeFontText(shown),
            fontColor: new Color(empty ? colors.placeholder : colors.text),
        });
        this.clearButton.visible = !empty;
    }

    makeKeyboard() {
        const colors = {
            keyboardBack: 0x858585,
            button: 0x363636,
            hovered: 0x1c1c1c,
            selected: 0x109c5d,
        };
        const keyboard = new Keyboard({
            language: "eng",
            ...FONT,
            fontSize: 0.12,
            width: 4,
            height: 1.6,
            backgroundColor: new Color(colors.keyboardBack),
            backgroundOpacity: 1,
            backspaceTexture: Backspace,
            shiftTexture: Shift,
            enterTexture: Enter,
        });

        this.keys = keyboard.keys;
        for (const key of keyboard.keys) {
            key.setupState({
                state: "idle",
                attributes: {
                    offset: 0,
                    backgroundColor: new Color(colors.button),
                    backgroundOpacity: 1,
                },
            });
            key.setupState({
                state: "hovered",
                attributes: {
                    offset: 0,
                    backgroundColor: new Color(colors.hovered),
                    backgroundOpacity: 1,
                },
            });
            key.setupState({
                state: "selected",
                attributes: {
                    offset: -0.009,
                    backgroundColor: new Color(colors.selected),
                    backgroundOpacity: 1,
                },
                onSet: () => this.pressKey(keyboard, key.info),
            });
        }
        return keyboard;
    }

    pressKey(keyboard, info) {
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
