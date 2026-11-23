import {
    clearMediaSource,
    hasMediaSource,
    isCurrentMediaSource,
    setMediaSource,
} from "./mediaSource.mjs";
import {
    rememberPlaybackPosition,
    restorePlaybackPosition,
} from "./playbackPositions.mjs";

const LANG = require("./lang.json");

let selected_lang = "en";

export function videoSrcExists() {
    return hasMediaSource(document.getElementById("video"));
}

export function setVideoSrc(src) {
    const video = document.getElementById("video");
    if (video.getAttribute("src") !== src) {
        rememberPlaybackPosition(video);
    }
    return setMediaSource(video, src);
}

// Resume where this video was left earlier in the page's life, if anywhere.
export function restoreVideoPosition(src) {
    restorePlaybackPosition(document.getElementById("video"), src);
}

export function isCurrentVideoSrc(src) {
    return isCurrentMediaSource(document.getElementById("video"), src);
}

export function removeVideoSrc() {
    const video = document.getElementById("video");
    rememberPlaybackPosition(video);
    clearMediaSource(video);
}

export function getWordFromLang(key) {
    return LANG[selected_lang][key];
}
