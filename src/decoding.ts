// Whether the browser decodes a video in hardware, asked through the Media
// Capabilities API with what the catalogue knows of the video. A codec decoded
// in software, such as AV1 on the Quest 2, plays slowly and stutters.

import type { MediaInfo } from "./types/catalogue.ts";

// "software" when the browser can play the video but not power-efficiently,
// which in practice means without a hardware decoder; "unknown" when the
// catalogue lacks what the question needs or the browser can't answer.
export type Decoding = "hardware" | "software" | "unsupported" | "unknown";

// The codec strings to ask about, by the codec name FFprobe gives, for a level
// that fits the picture size: up to 1080p, up to 4K, or above. The catalogue
// doesn't record profiles or bit depths, so these name the common 8-bit ones.
const CODEC_STRINGS: Record<string, [string, string, string]> = {
    h264: ["avc1.64002A", "avc1.640034", "avc1.64003E"],
    hevc: ["hvc1.1.6.L123.B0", "hvc1.1.6.L156.B0", "hvc1.1.6.L186.B0"],
    av1: ["av01.0.09M.08", "av01.0.13M.08", "av01.0.17M.08"],
    vp9: ["vp09.00.41.08", "vp09.00.51.08", "vp09.00.61.08"],
};

const PIXELS_1080P = 2_228_224;
const PIXELS_4K = 8_912_896;

// The question for the Media Capabilities API, or null when the catalogue
// lacks the codec or the size.
export function decodingQuery(media: MediaInfo): MediaDecodingConfiguration | null {
    const strings = media.video_codec ? CODEC_STRINGS[media.video_codec] : undefined;
    const { width, height } = media;
    if (!strings || !width || !height) return null;
    const pixels = width * height;
    const codec = strings[pixels <= PIXELS_1080P ? 0 : pixels <= PIXELS_4K ? 1 : 2];
    return {
        type: "file",
        video: {
            contentType: `video/mp4; codecs="${codec}"`,
            width,
            height,
            // Both are required: the whole file's bitrate stands in for the video's.
            bitrate: media.bit_rate ?? 10_000_000,
            framerate: media.fps ?? 30,
        },
    };
}

export async function browserDecoding(
    media: MediaInfo | undefined,
    capabilities: Pick<MediaCapabilities, "decodingInfo"> | undefined,
): Promise<Decoding> {
    const query = media ? decodingQuery(media) : null;
    if (!query || !capabilities) return "unknown";
    try {
        const answer = await capabilities.decodingInfo(query);
        if (!answer.supported) return "unsupported";
        return answer.powerEfficient ? "hardware" : "software";
    } catch {
        return "unknown";
    }
}
