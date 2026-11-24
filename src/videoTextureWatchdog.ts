// three.js's VideoTexture refreshes the picture from the video element's
// requestVideoFrameCallback chain. That chain can be lost when the XR session
// ends (the headset sleeping, for instance): the video keeps playing but the
// picture stays frozen. This watchdog notices a playing video whose picture
// hasn't changed for a while, and starts a fresh chain.
import type { Texture } from "three";

const STALE_MS = 300;
const HAVE_CURRENT_DATA = 2;

export function watchVideoTexture(
    video: Pick<
        HTMLVideoElement,
        "paused" | "ended" | "readyState" | "currentTime" | "requestVideoFrameCallback" | "cancelVideoFrameCallback"
    >,
    texture: Pick<Texture, "version" | "needsUpdate">,
    staleMs = STALE_MS
): (now: number) => void {
    if (!("requestVideoFrameCallback" in video)) {
        // Without it, three.js refreshes the texture on every render instead.
        return () => {};
    }

    let callbackId = 0;
    let lastVersion = texture.version;
    let lastChange: number | null = null;
    let timeAtLastChange = video.currentTime;

    function onVideoFrame(): void {
        texture.needsUpdate = true;
        callbackId = video.requestVideoFrameCallback(onVideoFrame);
    }

    function restartFrameCallbacks(): void {
        if (callbackId !== 0) {
            video.cancelVideoFrameCallback(callbackId);
        }
        onVideoFrame();
    }

    // Call once per rendered frame.
    return function check(now: number): void {
        if (texture.version !== lastVersion || lastChange === null) {
            lastVersion = texture.version;
            lastChange = now;
            timeAtLastChange = video.currentTime;
            return;
        }
        const playing =
            !video.paused && !video.ended && video.readyState >= HAVE_CURRENT_DATA;
        if (!playing) {
            // A still picture is expected: count from when playback resumes.
            lastChange = now;
            timeAtLastChange = video.currentTime;
            return;
        }
        if (
            now - lastChange > staleMs &&
            video.currentTime !== timeAtLastChange
        ) {
            restartFrameCallbacks();
            lastVersion = texture.version;
            lastChange = now;
            timeAtLastChange = video.currentTime;
        }
    };
}
