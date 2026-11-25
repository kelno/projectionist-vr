// Whether the video is waiting for data: seeking, or meant to play but
// without enough data to go on (HTMLMediaElement.HAVE_FUTURE_DATA is 3).
export function isBuffering(
    video: Pick<HTMLVideoElement, "getAttribute" | "seeking" | "paused" | "ended" | "readyState"> | null | undefined,
): boolean {
    if (!video?.getAttribute("src")) {
        return false;
    }
    if (video.seeking) {
        return true;
    }
    return !video.paused && !video.ended && video.readyState < 3;
}

// How close to its end a stalled video counts as over, and for how long it
// must have stalled there (createEndStallTracker).
const END_MARGIN_SECONDS = 1;
const END_STALL_MS = 1000;

// Tells, frame by frame, whether the video has stalled at its end: playing,
// within a second of its duration, with its time stuck for a second. Some
// files declare a slightly longer duration than their video track has (120.04
// s for 120 s of video), and the browser then waits at the end for data that
// never comes: no "ended" event, and the buffering spinner turns forever. The
// player then ends the video itself.
export function createEndStallTracker(): (
    video: Pick<HTMLVideoElement, "paused" | "ended" | "currentTime" | "duration">,
    now: number,
) => boolean {
    let stuckAt: number | null = null;
    let since = 0;
    return function stalledAtEnd(video, now) {
        const { duration, currentTime } = video;
        const nearEnd = Number.isFinite(duration) && duration > 0 && duration - currentTime < END_MARGIN_SECONDS;
        if (video.paused || video.ended || !nearEnd) {
            stuckAt = null;
            return false;
        }
        if (stuckAt !== currentTime) {
            stuckAt = currentTime;
            since = now;
            return false;
        }
        return now - since >= END_STALL_MS;
    };
}

// Tells, frame by frame, whether to show a waiting indicator: only once the
// video has been buffering for `delayMs`, so a quick seek doesn't flash it.
export function createBufferingTracker(delayMs = 250): (buffering: boolean, now: number) => boolean {
    let since: number | null = null;
    return function shouldShow(buffering: boolean, now: number): boolean {
        if (!buffering) {
            since = null;
            return false;
        }
        since ??= now;
        return now - since >= delayMs;
    };
}
