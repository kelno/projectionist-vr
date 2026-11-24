/**
 * Keep source changes on the one HTMLMediaElement used by the renderer. Using
 * the video element's `src` property avoids an empty nested <source> candidate
 * being selected before the user has chosen a video.
 */
export function hasMediaSource(video: Pick<HTMLVideoElement, "getAttribute">): boolean {
    return Boolean(video.getAttribute("src"));
}

/**
 * Check that a media event belongs to the source currently selected by the
 * browser. `src` is often relative while `currentSrc` is absolute, so compare
 * their resolved URLs rather than the original strings.
 */
export function isCurrentMediaSource(
    video: Pick<HTMLVideoElement, "currentSrc"> & { ownerDocument?: { baseURI: string } | null },
    source: string | null | undefined,
): boolean {
    if (typeof source !== "string" || source.length === 0 || !video.currentSrc) {
        return false;
    }

    const baseUrl = video.ownerDocument?.baseURI ?? globalThis.location?.href;

    try {
        return new URL(video.currentSrc, baseUrl).href === new URL(source, baseUrl).href;
    } catch {
        // Keep this usable with lightweight test doubles and malformed input.
        return video.currentSrc === source;
    }
}

export function setMediaSource(
    video: Pick<HTMLVideoElement, "getAttribute" | "src" | "load" | "pause" | "play">,
    source: string,
): { sourceChanged: boolean; playback: Promise<void> } {
    if (typeof source !== "string" || source.length === 0) {
        throw new TypeError("A media source must be a non-empty string.");
    }

    const sourceChanged = video.getAttribute("src") !== source;

    if (sourceChanged) {
        if (hasMediaSource(video)) {
            video.pause();
        }

        video.src = source;
        video.load();
    }

    return {
        sourceChanged,
        playback: video.play(),
    };
}

export function clearMediaSource(
    video: Pick<HTMLVideoElement, "getAttribute" | "removeAttribute" | "load" | "pause">,
): void {
    if (!hasMediaSource(video)) {
        return;
    }

    video.pause();
    video.removeAttribute("src");
    video.load();
}
