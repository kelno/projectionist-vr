// The headset's own keyboard, in the user's layout and language, which Quest
// Browser 26.1 and later can show over an immersive session: focusing a text
// field brings it up, the field's value holds what is typed, and closing the
// keyboard blurs the field. While it shows, the session's visibility is
// "visible-blurred". See
// https://developers.meta.com/horizon/documentation/web/webxr-keyboard/
//
// `getSession()` gives the current XR session, if any. `report(message)`
// sends the server's log what happened, each message once: whether the
// browser offers the keyboard and whether it showed, which can't be watched
// from outside the headset.
// open({ onInput, onClose, onFail }): `onInput(text)` as the user types,
// `onClose(text)` when they close the keyboard, `onFail()` instead of both if
// the keyboard didn't show within FAIL_MS, so the caller can use its own.
const FAIL_MS = 1500;

export interface SystemKeyboard {
    isAvailable(): boolean;
    open(handlers: { onInput: (text: string) => void; onClose: (text: string) => void; onFail: () => void }): void;
}

export function createSystemKeyboard(
    getSession: () => XRSession | null,
    report: (message: string) => void = () => {},
): SystemKeyboard {
    let field: HTMLInputElement | undefined;

    const isAvailable = () => {
        const session = getSession();
        if (session && !session.isSystemKeyboardSupported) {
            report(`not offered: isSystemKeyboardSupported=${String(session.isSystemKeyboardSupported)}; ${browser()}`);
        }
        return Boolean(session?.isSystemKeyboardSupported);
    };

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
                report(`shown; ${browser()}`);
            }
        };
        const failTimer = setTimeout(() => {
            if (!shown) {
                report(
                    `offered but not shown within ${FAIL_MS} ms: visibility=${session.visibilityState}, ` +
                        `field focused=${document.activeElement === input}; ${browser()}`,
                );
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

// The browser and its version, from its user agent, and the languages it
// says the user reads, which choose the app keyboard's first layout.
function browser(): string {
    const name = navigator.userAgent.match(/OculusBrowser\/\S+|Chrome\/\S+/)?.[0] ?? navigator.userAgent.slice(0, 120);
    return `${name}; languages=${(navigator.languages ?? [navigator.language]).join(",")}`;
}
