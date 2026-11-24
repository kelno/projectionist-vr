// The headset's own keyboard, in the user's layout and language, which Quest
// Browser 26.1 and later can show over an immersive session: focusing a text
// field brings it up, the field's value holds what is typed, and closing the
// keyboard blurs the field. While it shows, the session's visibility is
// "visible-blurred". See
// https://developers.meta.com/horizon/documentation/web/webxr-keyboard/
//
// `getSession()` gives the current XR session, if any.
// open({ onInput, onClose, onFail }): `onInput(text)` as the user types,
// `onClose(text)` when they close the keyboard, `onFail()` instead of both if
// the keyboard didn't show within FAIL_MS, so the caller can use its own.
const FAIL_MS = 1500;

export interface SystemKeyboard {
    isAvailable(): boolean;
    open(handlers: { onInput: (text: string) => void; onClose: (text: string) => void; onFail: () => void }): void;
}

export function createSystemKeyboard(getSession: () => XRSession | null): SystemKeyboard {
    let field: HTMLInputElement | undefined;

    const isAvailable = () => Boolean(getSession()?.isSystemKeyboardSupported);

    // The field must be in the page for the keyboard to show. Fixed at the
    // top left, and transparent, it never shows and the page doesn't scroll
    // to it.
    function makeField(): HTMLInputElement {
        const input = document.createElement("input");
        input.type = "text";
        input.setAttribute("aria-hidden", "true");
        Object.assign(input.style, {
            position: "fixed",
            top: "0",
            left: "0",
            width: "1px",
            height: "1px",
            opacity: "0",
            pointerEvents: "none",
        });
        document.body.appendChild(input);
        return input;
    }

    function open({ onInput, onClose, onFail }: Parameters<SystemKeyboard["open"]>[0]): void {
        // Called only once isAvailable() said there is a session.
        const session = getSession()!;
        const input = (field ??= makeField());
        // Each time the keyboard shows, typing starts a new text.
        input.value = "";

        let shown = false;
        const onVisibilityChange = () => {
            if (session.visibilityState === "visible-blurred") {
                shown = true;
            }
        };
        const failTimer = setTimeout(() => {
            if (!shown) {
                stop();
                input.blur();
                onFail();
            }
        }, FAIL_MS);
        function stop() {
            clearTimeout(failTimer);
            session.removeEventListener("visibilitychange", onVisibilityChange);
            input.oninput = null;
            input.onblur = null;
        }

        session.addEventListener("visibilitychange", onVisibilityChange);
        input.oninput = () => onInput(input.value);
        input.onblur = () => {
            stop();
            onClose(input.value);
        };
        input.focus();
    }

    return { isAvailable, open };
}
