import {
    clearMediaSource,
    hasMediaSource,
    isCurrentMediaSource,
    setMediaSource,
} from "./mediaSource.ts";
import {
    rememberPlaybackPosition,
    restorePlaybackPosition,
} from "./playbackPositions.ts";

import LANG from "./lang.json";

// The words the player shows, by key, in each language of lang.json.
export type LangKey = keyof (typeof LANG)["en"];

const selected_lang: keyof typeof LANG = "en";

// The page's one video element (index.html); the player can't run without it.
function videoElement(): HTMLVideoElement {
    return document.getElementById("video") as HTMLVideoElement;
}

export function videoSrcExists(): boolean {
    return hasMediaSource(videoElement());
}

export function setVideoSrc(src: string): ReturnType<typeof setMediaSource> {
    const video = videoElement();
    if (video.getAttribute("src") !== src) {
        rememberPlaybackPosition(video);
    }
    return setMediaSource(video, src);
}

// Resume where this video was left earlier in the page's life, if anywhere.
export function restoreVideoPosition(src: string): void {
    restorePlaybackPosition(videoElement(), src);
}

export function isCurrentVideoSrc(src: string | null | undefined): boolean {
    return isCurrentMediaSource(videoElement(), src);
}

export function removeVideoSrc(): void {
    const video = videoElement();
    rememberPlaybackPosition(video);
    clearMediaSource(video);
}

export function getWordFromLang(key: LangKey): string {
    return LANG[selected_lang][key];
}
