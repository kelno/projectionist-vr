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

export function createSystemKeyboard(getSession) {
    let field;

    const isAvailable = () => Boolean(getSession()?.isSystemKeyboardSupported);

    // The field must be in the page for the keyboard to show. Fixed at the
    // top left, and transparent, it never shows and the page doesn't scroll
    // to it.
    function makeField() {
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

    function open({ onInput, onClose, onFail }) {
        const session = getSession();
        field ??= makeField();
        // Each time the keyboard shows, typing starts a new text.
        field.value = "";

        let shown = false;
        const onVisibilityChange = () => {
            if (session.visibilityState === "visible-blurred") {
                shown = true;
            }
        };
        const failTimer = setTimeout(() => {
            if (!shown) {
                stop();
                field.blur();
                onFail();
            }
        }, FAIL_MS);
        function stop() {
            clearTimeout(failTimer);
            session.removeEventListener("visibilitychange", onVisibilityChange);
            field.oninput = null;
            field.onblur = null;
        }

        session.addEventListener("visibilitychange", onVisibilityChange);
        field.oninput = () => onInput(field.value);
        field.onblur = () => {
            stop();
            onClose(field.value);
        };
        field.focus();
    }

    return { isAvailable, open };
}
