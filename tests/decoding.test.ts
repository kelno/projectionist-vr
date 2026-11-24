import assert from "node:assert/strict";
import test from "node:test";

import { browserDecoding, decodingQuery } from "../src/decoding.ts";

test("asks about the codec at a level that fits the picture", () => {
    const query = decodingQuery({ video_codec: "av1", width: 5760, height: 2880, fps: 60, bit_rate: 40_000_000 });
    assert.deepEqual(query, {
        type: "file",
        video: {
            contentType: 'video/mp4; codecs="av01.0.17M.08"',
            width: 5760,
            height: 2880,
            bitrate: 40_000_000,
            framerate: 60,
        },
    });
    assert.equal(
        decodingQuery({ video_codec: "hevc", width: 3840, height: 1920 })?.video?.contentType,
        'video/mp4; codecs="hvc1.1.6.L156.B0"',
    );
    assert.equal(
        decodingQuery({ video_codec: "h264", width: 1920, height: 1080 })?.video?.contentType,
        'video/mp4; codecs="avc1.64002A"',
    );
});

test("asks nothing without a known codec and a size", () => {
    assert.equal(decodingQuery({ video_codec: "mpeg4", width: 1920, height: 1080 }), null);
    assert.equal(decodingQuery({ video_codec: "hevc" }), null);
});

test("reads the browser's answer", async () => {
    const media = { video_codec: "av1", width: 3840, height: 1920 };
    const answering = (supported: boolean, powerEfficient: boolean) => ({
        decodingInfo: () => Promise.resolve({ supported, smooth: supported, powerEfficient, keySystemAccess: null }),
    });
    assert.equal(await browserDecoding(media, answering(true, true)), "hardware");
    assert.equal(await browserDecoding(media, answering(true, false)), "software");
    assert.equal(await browserDecoding(media, answering(false, false)), "unsupported");
    assert.equal(await browserDecoding(media, undefined), "unknown");
    assert.equal(await browserDecoding(undefined, answering(true, true)), "unknown");
    const failing = { decodingInfo: () => Promise.reject(new TypeError("bad query")) };
    assert.equal(await browserDecoding(media, failing), "unknown");
});
