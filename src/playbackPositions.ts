// Playback positions are kept in memory only, keyed by the catalogue source,
// so a reload of the page forgets them.

// A position this close to the start or the end is not worth resuming.
const MIN_RESUME_SECONDS = 1;
const END_MARGIN_SECONDS = 2;

export interface PlaybackPositions {
    remember(source: string | null | undefined, time: number, duration: number): void;
    positionFor(source: string): number | null;
}

export function createPlaybackPositions(): PlaybackPositions {
    const positions = new Map<string, number>();

    return {
        remember(source, time, duration) {
            if (typeof source !== "string" || source.length === 0) {
                return;
            }
            const nearEnd =
                Number.isFinite(duration) && time >= duration - END_MARGIN_SECONDS;
            if (!Number.isFinite(time) || time < MIN_RESUME_SECONDS || nearEnd) {
                positions.delete(source);
            } else {
                positions.set(source, time);
            }
        },

        positionFor(source) {
            return positions.get(source) ?? null;
        },
    };
}

const playbackPositions = createPlaybackPositions();

// Call before the video element's source is changed or removed.
export function rememberPlaybackPosition(
    video: Pick<HTMLVideoElement, "getAttribute" | "readyState" | "ended" | "duration" | "currentTime">
): void {
    const source = video.getAttribute("src");
    if (!source || video.readyState === 0) {
        // Nothing has loaded, so there is no position to keep.
        return;
    }
    playbackPositions.remember(
        source,
        video.ended ? video.duration : video.currentTime,
        video.duration
    );
}

// Call once the new source's metadata has loaded.
export function restorePlaybackPosition(
    video: Pick<HTMLVideoElement, "duration" | "currentTime">,
    source: string
): void {
    const position = playbackPositions.positionFor(source);
    if (position !== null && position < video.duration) {
        video.currentTime = position;
    }
}
