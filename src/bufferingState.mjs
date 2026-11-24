// Whether the video is waiting for data: seeking, or meant to play but
// without enough data to go on (HTMLMediaElement.HAVE_FUTURE_DATA is 3).
export function isBuffering(video) {
    if (!video?.getAttribute("src")) {
        return false;
    }
    if (video.seeking) {
        return true;
    }
    return !video.paused && !video.ended && video.readyState < 3;
}

// Tells, frame by frame, whether to show a waiting indicator: only once the
// video has been buffering for `delayMs`, so a quick seek doesn't flash it.
export function createBufferingTracker(delayMs = 250) {
    let since = null;
    return function shouldShow(buffering, now) {
        if (!buffering) {
            since = null;
            return false;
        }
        since ??= now;
        return now - since >= delayMs;
    };
}
