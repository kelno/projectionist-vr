// The lines of the player's Media info page, from the catalogue entry of the
// video playing (its `media`, written by the catalogue generator) and, for
// what the catalogue lacks, from the video element itself.

const CODEC_NAMES = {
    h264: "H.264",
    hevc: "HEVC (H.265)",
    av1: "AV1",
    vp9: "VP9",
    vp8: "VP8",
    mpeg4: "MPEG-4",
    aac: "AAC",
    opus: "Opus",
    mp3: "MP3",
    ac3: "AC-3",
    eac3: "E-AC-3",
    flac: "FLAC",
    vorbis: "Vorbis",
};

const CHANNEL_NAMES = { 1: "mono", 2: "stereo", 6: "5.1", 8: "7.1" };

const UNKNOWN = "Unknown";

export function codecName(codec) {
    return CODEC_NAMES[codec] ?? String(codec).toUpperCase();
}

export function formatSize(bytes) {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let unit = 0;
    while (value >= 1000 && unit < units.length - 1) {
        value /= 1000;
        unit++;
    }
    return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function formatDuration(seconds) {
    const total = Math.round(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = String(total % 60).padStart(2, "0");
    return hours > 0
        ? `${hours}:${String(minutes).padStart(2, "0")}:${secs}`
        : `${minutes}:${secs}`;
}

// `entry` is the catalogue entry (or null), `video` the playing element.
export function mediaInfoLines(entry, video) {
    const media = entry?.media ?? {};
    const width = media.width ?? video?.videoWidth;
    const height = media.height ?? video?.videoHeight;
    const duration = media.duration ?? video?.duration;

    const videoParts = [];
    if (media.video_codec) videoParts.push(codecName(media.video_codec));
    if (media.fps) videoParts.push(`${media.fps} fps`);

    let audio = UNKNOWN;
    if (media.audio_codec) {
        const channels = media.audio_channels;
        audio = codecName(media.audio_codec);
        if (channels) audio += `, ${CHANNEL_NAMES[channels] ?? `${channels} channels`}`;
    } else if (entry?.media) {
        audio = "None";
    }

    return [
        ["File", entry?.name ?? UNKNOWN],
        ["Resolution", width && height ? `${width} x ${height}` : UNKNOWN],
        ["Video", videoParts.length > 0 ? videoParts.join(", ") : UNKNOWN],
        ["Audio", audio],
        ["Duration", Number.isFinite(duration) && duration > 0 ? formatDuration(duration) : UNKNOWN],
        ["Size", media.size ? formatSize(media.size) : UNKNOWN],
        ["Bitrate", media.bit_rate ? `${(media.bit_rate / 1e6).toFixed(1)} Mb/s` : UNKNOWN],
    ];
}
