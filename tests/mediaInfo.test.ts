import assert from "node:assert/strict";
import test from "node:test";

import { formatDuration, formatSize, mediaInfoLines } from "../src/mediaInfo.ts";
import type { MediaInfoLine } from "../src/mediaInfo.ts";
import type { MediaInfo } from "../src/types/catalogue.ts";

// The page's lines by name, as their text.
function linesByName(lines: MediaInfoLine[]): Record<string, string> {
    return Object.fromEntries(lines.map(([name, text]) => [name, text]));
}

test("formats sizes and durations", () => {
    assert.equal(formatSize(512), "512 B");
    assert.equal(formatSize(4_200_000_000), "4.2 GB");
    assert.equal(formatDuration(65), "1:05");
    assert.equal(formatDuration(3723), "1:02:03");
});

test("shows the catalogue's media info", () => {
    const entry = {
        name: "Concert",
        media: {
            size: 4_200_000_000,
            width: 5760,
            height: 2880,
            video_codec: "hevc",
            fps: 59.94,
            audio_codec: "aac",
            audio_channels: 2,
            duration: 3723,
            bit_rate: 38_000_000,
        },
    };
    assert.deepEqual(mediaInfoLines(entry, null), [
        ["File", "Concert"],
        ["Resolution", "5760 x 2880"],
        ["Video", "HEVC (H.265), 59.94 fps"],
        ["Audio", "AAC, stereo"],
        ["Duration", "1:02:03"],
        ["Size", "4.2 GB"],
        ["Bitrate", "38.0 Mb/s"],
        ["Fast start", "Unknown"],
    ]);
});

test("flags a video that starts slowly", () => {
    const line = (media: MediaInfo) => mediaInfoLines({ name: "Clip", media }, null).find(([name]) => name === "Fast start");
    assert.deepEqual(line({ faststart: true }), ["Fast start", "Yes"]);
    assert.deepEqual(line({ faststart: false }), ["Fast start", "No, slow to start: remux it", true]);
});

test("falls back on the video element without catalogue info", () => {
    const lines = linesByName(
        mediaInfoLines({ name: "Old entry" }, { videoWidth: 1920, videoHeight: 1080, duration: 65 })
    );
    assert.equal(lines.Resolution, "1920 x 1080");
    assert.equal(lines.Duration, "1:05");
    assert.equal(lines.Video, "Unknown");
    assert.equal(lines.Audio, "Unknown");
});

test("says None for a video the catalogue knows has no audio", () => {
    const lines = linesByName(mediaInfoLines({ name: "Silent", media: { video_codec: "h264" } }, null));
    assert.equal(lines.Audio, "None");
});
