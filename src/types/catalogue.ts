// The catalogue the player loads (files.json), as scripts/generate_json.py
// writes it; docs/catalogue.md describes each field.

// What FFprobe and the fast-start check found about a video; each field is
// left out when they couldn't tell.
export interface MediaInfo {
    size?: number;
    width?: number;
    height?: number;
    video_codec?: string;
    fps?: number;
    audio_codec?: string;
    audio_channels?: number;
    duration?: number;
    bit_rate?: number;
    faststart?: boolean;
}

// How a video is laid out: side-by-side or top-bottom 180°, top-bottom 360°,
// single-lens fisheye, or flat on a screen ("tb_screen": top-bottom flat).
export type ScreenType = "sbs" | "tb" | "360" | "sphere180" | "sphere360" | "screen" | "tb_screen";

export interface CatalogueEntry {
    name: string;
    src: string;
    // The thumbnail's URL, or "" for none.
    thumbnail: string;
    screen_type: ScreenType;
    date: string;
    epoch: string;
    // A flat video's proportions.
    frame_width?: number;
    frame_height?: number;
    media?: MediaInfo;
}

export interface CatalogueFolder {
    name: string;
    list: CatalogueEntry[];
}

export interface Catalogue {
    videos: CatalogueFolder[];
}
