import * as MAIN from "./index.ts";
import * as ScreenManager from "./ScreenManager/ScreenManager.ts";
import * as UI from "./UI.ts";
import * as Helpers from "./Helpers.ts";

import PlayIcon from "../assets/icons/play.png";
import PauseIcon from "../assets/icons/pause.png";
import ForwardIcon from "../assets/icons/forward-10.png";
import BackIcon from "../assets/icons/back-10.png";
import MuteIcon from "../assets/icons/mute.png";
import VolumeIcon from "../assets/icons/volume.png";
import LibraryIcon from "../assets/icons/library.png";
import SettingsIcon from "../assets/icons/settings.png";
import ZoomOutIcon from "../assets/icons/zoom-out.png";
import ZoomInIcon from "../assets/icons/zoom-in.png";
import UpIcon from "../assets/icons/up.png";
import DownIcon from "../assets/icons/down.png";
import VRIcon from "../assets/icons/vr.png";
import ScreenIcon from "../assets/icons/screen.png";
import ResetIcon from "../assets/icons/reset.png";
import MoveIcon from "../assets/icons/move.png";
import PreviousIcon from "../assets/icons/previous.png";
import NextIcon from "../assets/icons/next.png";

import type { Object3D } from "three";
import type { ScreenType } from "./types/catalogue.ts";
import { PagedWindow } from "./ui/PagedWindow.ts";
import type { Page } from "./ui/PagedWindow.ts";
import { BUTTON_SIZE } from "./ui/kit.ts";
import { RADIUS, materialColour, space } from "./ui/theme.ts";
import { browserDecoding } from "./decoding.ts";
import type { Decoding } from "./decoding.ts";
import { mediaInfoLines } from "./mediaInfo.ts";
import { shortenText } from "./font.ts";
import { createEndStallTracker } from "./bufferingState.ts";
import { clockTime } from "./seekBar.ts";
import { createSeekPreview } from "./ui/seekPreview.ts";
import { Container as UiContainer, Text as UiText } from "@pmndrs/uikit";
import {
    MM,
    UI_SURFACE,
    uiDivider,
    uiIconButton,
    uiLabel,
    uiMarkActive,
    uiRow,
    uiTextButton,
    uikitPanel,
} from "./ui/uikit.ts";
import type { UiButton, UiIconButton } from "./ui/uikit.ts";
import type { Component } from "@pmndrs/uikit";

// What the layout button shows for each video layout, in the order it steps
// through them.
const LAYOUTS: [ScreenType, () => string][] = [
    ["sbs", () => Helpers.getWordFromLang("side_by_side")],
    ["tb", () => Helpers.getWordFromLang("top_bottom")],
    ["360", () => Helpers.getWordFromLang("top_bottom_360")],
    ["sphere180", () => "2D 180"],
    ["sphere360", () => "2D 360"],
];

// The player's controls: a seek bar, the time, and a row of buttons (back to
// the library, mute, previous / back 10 s / play / forward 10 s / next,
// settings, reset and move), with a bar under them to move the screen and
// controls together, and the settings window above them.
export class PlayerPanel {
    WIDTH = 3;
    PADDING = space(3);
    INNER_WIDTH = this.WIDTH - 2 * this.PADDING;
    // The seek bar and time span from the first button's left edge to the
    // last one's right edge: the buttons keep a margin inside the row.
    BAR_WIDTH = this.INNER_WIDTH - 2 * space(1);
    PROGRESS_HEIGHT = 0.06;
    PROGRESS_MIN_WIDTH = 0.01;
    SETTINGS_WIDTH = this.WIDTH / 1.5;
    // The height of the settings window's pages, under their title.
    SETTINGS_HEIGHT = 0.85;

    // What can be clicked while the controls show.
    playMenuObjsToTest: Object3D[] = [];

    videoElement: HTMLVideoElement;
    // Set by the build methods, which the constructor calls.
    buttonPlay!: UiIconButton;
    settingsButton!: UiIconButton;
    muteButton!: UiIconButton;
    timeLabel!: UiText;
    playMenuContainer!: UiContainer;
    progressBar!: UiContainer;
    seekBar!: UiContainer;
    draggingBox!: UiContainer;
    settingsWindow!: PagedWindow;
    settingsMenuContainer!: UiContainer;
    stereoLabel!: UiText;
    layoutLabel!: UiText;
    // Call once per frame with the component the pointer is on: shows the
    // time and frame under the pointer while it is on the seek bar.
    updateSeekPreview!: (target: Object3D | null) => void;

    constructor(video: HTMLVideoElement) {
        this.videoElement = video;

        this.buildControls();
        this.buildSettingsWindow();
        this.buildDraggingBox();

        // The controls and the bar under them move with the screen, and
        // alone with the move button; the settings window follows both.
        for (const view of ["player", "playerControls"] as const) {
            for (const panel of [this.draggingBox, this.playMenuContainer, this.settingsMenuContainer]) {
                ScreenManager.registerObjectToDrag(panel, view, "playMenuPanel");
            }
        }

        for (const event of ["play", "pause", "ended", "emptied"]) {
            video.addEventListener(event, () => this.refreshPlayButton());
        }
        video.addEventListener("volumechange", () => this.refreshMuteButton());
    }

    buildControls() {
        this.buttonPlay = uiIconButton({
            icon: PlayIcon,
            size: BUTTON_SIZE * 1.25,
            tooltip: "Play / pause",
            onSelect: () => this.playPause(),
        });
        const previous = uiIconButton({
            icon: PreviousIcon,
            tooltip: "Previous video",
            onSelect: () => this.playAdjacentVideo(-1),
        });
        const rewind = uiIconButton({
            icon: BackIcon,
            tooltip: "Back 10 s",
            onSelect: () => this.videoPlaybackFFRew("Rew"),
        });
        const forward = uiIconButton({
            icon: ForwardIcon,
            tooltip: "Forward 10 s",
            onSelect: () => this.videoPlaybackFFRew("FF"),
        });
        const next = uiIconButton({
            icon: NextIcon,
            tooltip: "Next video",
            onSelect: () => this.playAdjacentVideo(1),
        });
        this.settingsButton = uiIconButton({
            icon: SettingsIcon,
            tooltip: "Settings",
            onSelect: () =>
                this.settingsWindow.isOpen ? this.hideSettingsMenuContainer() : this.showSettingsMenuContainer(),
        });
        this.muteButton = uiIconButton({
            icon: VolumeIcon,
            tooltip: "Mute / unmute",
            onSelect: () => this.toggleMute(),
        });
        const exit = uiIconButton({
            icon: LibraryIcon,
            tooltip: "Back to library",
            onSelect: () => this.ExitToMain(),
        });
        const reset = uiIconButton({
            icon: ResetIcon,
            tooltip: "Reset position and zoom",
            onSelect: () => ScreenManager.resetDrag("player"),
        });
        const move = uiIconButton({
            icon: MoveIcon,
            tooltip: "Move the controls",
            onSelect: () => ScreenManager.startDrag("playerControls"),
            onRelease: () => ScreenManager.stopDrag("playerControls"),
        });

        // Three groups: the library and sound on the left, playback in the
        // middle, the screen's settings and placement on the right.
        const group = (children: Component[], justifyContent: "flex-start" | "center" | "flex-end", width: number) => {
            const holder = new UiContainer({
                flexDirection: "row",
                alignItems: "center",
                justifyContent,
                width: width * MM,
            });
            holder.add(...children);
            return holder;
        };
        const side = this.INNER_WIDTH / 4;
        const buttons = uiRow([
            group([exit, this.muteButton], "flex-start", side),
            group([previous, rewind, this.buttonPlay, forward, next], "center", this.INNER_WIDTH - 2 * side),
            group([this.settingsButton, reset, move], "flex-end", side),
        ]);
        // The play button stands out: a size larger, in the accent colour.
        uiMarkActive(this.buttonPlay, true);

        this.timeLabel = uiLabel("0:00", { width: this.BAR_WIDTH, align: "right", color: "mutedText" });
        const time = new UiContainer({ height: 0.09 * MM, alignItems: "center", flexShrink: 0 });
        time.add(this.timeLabel);

        // A click on the controls' background closes the settings, if open;
        // buttons and the seek bar keep their clicks to themselves.
        this.playMenuContainer = uikitPanel(this.WIDTH, undefined, {
            flexDirection: "column",
            alignItems: "center",
            padding: this.PADDING * MM,
            ...UI_SURFACE,
            onClick: () => {
                if (this.settingsWindow.isOpen) {
                    this.hideSettingsMenuContainer();
                }
            },
        });
        this.playMenuContainer.add(this.buildSeekBar(), time, buttons);
        this.playMenuContainer.visible = false;
        this.playMenuContainer.position.set(0, 0.6, -3);
        MAIN.scene.add(this.playMenuContainer);
        ScreenManager.registerPanel(this.playMenuContainer, "playMenuPanel");

        this.playMenuObjsToTest.push(this.playMenuContainer, MAIN.hiddenSphere);
    }

    // The seek bar: the part played in the accent colour, a light mark at the
    // current time; a click seeks to where it lands, and hovering shows the
    // time and frame there (ui/seekPreview.ts).
    buildSeekBar(): UiContainer {
        const height = this.PROGRESS_HEIGHT * MM;
        // The parts take no events, so the pointer lands on the bar itself
        // and its position along the bar is the time.
        this.progressBar = new UiContainer({
            width: this.PROGRESS_MIN_WIDTH * MM,
            height,
            flexShrink: 0,
            backgroundColor: materialColour("accent"),
            pointerEvents: "none",
        });
        const mark = new UiContainer({
            width: this.PROGRESS_MIN_WIDTH * 2 * MM,
            height,
            flexShrink: 0,
            backgroundColor: materialColour("text"),
            pointerEvents: "none",
        });
        this.seekBar = new UiContainer({
            width: this.BAR_WIDTH * MM,
            height,
            flexShrink: 0,
            flexDirection: "row",
            backgroundColor: materialColour("track"),
            // Hovering lightens the bar. Changing its height instead would
            // reflow the whole controls panel around it.
            hover: { backgroundColor: materialColour("hovered") },
            onClick: (event) => {
                event.stopPropagation?.();
                const video = this.videoElement;
                if (event.uv && Number.isFinite(video.duration)) {
                    video.currentTime = video.duration * event.uv.x;
                }
            },
        });
        this.seekBar.add(this.progressBar, mark);
        this.updateSeekPreview = createSeekPreview({
            scene: MAIN.scene,
            seekBar: this.seekBar,
            panel: () => this.playMenuContainer,
            barWidth: this.BAR_WIDTH,
            // Clear of the panel's top edge.
            lift: this.PROGRESS_HEIGHT / 2 + this.PADDING + space(1),
            video: this.videoElement,
            thumbnails: () =>
                MAIN.fileBrowserPanel.fileForSource(this.videoElement.getAttribute("src"))?.seek_thumbnails,
        });
        return this.seekBar;
    }

    // The bar under the controls, to move the screen and controls together.
    buildDraggingBox() {
        const height = 0.1;
        this.draggingBox = uikitPanel(this.WIDTH / 2, height, {
            borderRadius: Math.min(RADIUS.button, height / 2) * MM,
            backgroundColor: materialColour("raised"),
            hover: { backgroundColor: materialColour("hovered") },
            active: { backgroundColor: materialColour("accent") },
            onPointerDown: () => ScreenManager.startDrag("player"),
            onPointerUp: () => ScreenManager.stopDrag("player"),
        });
        (this.draggingBox as UiButton).tooltip = "Move the screen and controls";
        this.draggingBox.visible = false;
        this.draggingBox.position.set(0, 0.25, -3);
        MAIN.scene.add(this.draggingBox);
        ScreenManager.registerPanel(this.draggingBox, "playMenuPanel");
        this.playMenuObjsToTest.push(this.draggingBox);
    }

    ////////////////////////////////////////////////////////////////////////////
    // Showing and hiding

    // The video stays in 3D while the controls show (upstream switched it to
    // 2D, the same picture for both eyes, which looked wrong to the owner).
    showPlayMenuPanel() {
        UI.showMenu([this.playMenuContainer, this.draggingBox], this.playMenuObjsToTest);
        MAIN.hiddenSphere.buttonsVisible = true;
    }

    hidePlayMenuPanel() {
        if (this.settingsWindow.isOpen) {
            this.hideSettingsMenuContainer();
        }
        UI.hideMenu([this.playMenuContainer, this.draggingBox], []);
        MAIN.hiddenSphere.buttonsVisible = false;
    }

    showSettingsMenuContainer() {
        this.settingsWindow.open("settings");
        UI.setOutsideClick(() => this.hideSettingsMenuContainer());
        // While open: the window, the controls (a click on their background
        // closes it) and clicks outside, which close it too.
        UI.registerNewObjectsToTest([this.settingsMenuContainer, this.playMenuContainer, MAIN.hiddenSphere]);
    }

    hideSettingsMenuContainer() {
        this.settingsWindow.close();
        UI.setOutsideClick(null);
        UI.registerNewObjectsToTest(this.playMenuObjsToTest);
    }

    ////////////////////////////////////////////////////////////////////////////
    // The settings window: a main page (mode, zoom, tilt) and sub-pages.

    buildSettingsWindow() {
        const width = this.SETTINGS_WIDTH;
        this.settingsWindow = new PagedWindow({ width, bodyHeight: this.SETTINGS_HEIGHT });
        // ScreenManager finds panels by this property name to reset them.
        this.settingsMenuContainer = this.settingsWindow.container;
        // Just above the controls, which sit at y 0.6.
        this.settingsMenuContainer.position.set(0, 1.46, -2.95);
        MAIN.scene.add(this.settingsMenuContainer);
        ScreenManager.registerPanel(this.settingsMenuContainer, "playMenuPanel");

        this.settingsWindow.addPage("settings", this.buildSettingsPage());
        this.settingsWindow.addPage("media", this.buildMediaInfoPage());
    }

    buildSettingsPage(): Page {
        const rowLabel = (key: Helpers.LangKey) =>
            uiLabel(Helpers.getWordFromLang(key), { width: 0.45, fontSize: 0.05 });

        const screenMode = uiIconButton({
            icon: ScreenIcon,
            tooltip: "Flat screen",
            onSelect: () => ScreenManager.switchModeVRScreen("screen"),
        });
        const vrMode = uiIconButton({
            icon: VRIcon,
            tooltip: "VR view",
            onSelect: () => ScreenManager.switchModeVRScreen(ScreenManager.VRMode),
        });
        const stereo = uiTextButton({
            label: "3D",
            tooltip: "3D / 2D",
            width: BUTTON_SIZE,
            onSelect: () => {
                ScreenManager.force2DMode(!ScreenManager.force_2d_mode);
                this.refreshModeLabels();
            },
        });
        this.stereoLabel = stereo.text;
        const layout = uiTextButton({
            label: Helpers.getWordFromLang("side_by_side"),
            tooltip: "Video layout",
            onSelect: () => this.nextVideoLayout(),
        });
        this.layoutLabel = layout.text;

        const zoomOut = uiIconButton({
            icon: ZoomOutIcon,
            tooltip: "Zoom out",
            onSelect: () => ScreenManager.zoom("out"),
        });
        const zoomIn = uiIconButton({ icon: ZoomInIcon, tooltip: "Zoom in", onSelect: () => ScreenManager.zoom("in") });
        const zoomReset = uiIconButton({
            icon: ResetIcon,
            tooltip: "Default zoom",
            onSelect: () => ScreenManager.resetZoomToConfiguredDefault(),
        });
        const tiltDown = uiIconButton({
            icon: DownIcon,
            tooltip: "Tilt down",
            onSelect: () => ScreenManager.tilt("down"),
        });
        const tiltUp = uiIconButton({ icon: UpIcon, tooltip: "Tilt up", onSelect: () => ScreenManager.tilt("up") });
        const tiltReset = uiIconButton({
            icon: ResetIcon,
            tooltip: "Reset tilt",
            onSelect: () => ScreenManager.tilt("reset"),
        });
        // Media info isn't a setting: it sits apart, under a line, as wide as
        // three buttons above it.
        const mediaInfo = uiTextButton({
            label: "Media info",
            tooltip: "Resolution, codecs, bitrate...",
            width: BUTTON_SIZE * 3 + space(1) * 4,
            onSelect: () => this.settingsWindow.show("media"),
        });

        const block = new UiContainer({ flexDirection: "column", flexGrow: 1 });
        block.add(
            uiRow([rowLabel("switch_mode"), screenMode, vrMode, stereo, layout]),
            uiRow([rowLabel("zoom_video"), zoomOut, zoomIn, zoomReset]),
            uiRow([rowLabel("tilt_video"), tiltDown, tiltUp, tiltReset]),
            uiDivider(),
            uiRow([rowLabel("this_video"), mediaInfo]),
        );
        return { title: "Settings", block };
    }

    // Steps through the video layouts: SBS, TB, 360, then the 2D spheres.
    nextVideoLayout() {
        const index = LAYOUTS.findIndex(([mode]) => mode === ScreenManager.VRMode);
        if (index === -1) {
            return;
        }
        const [mode] = LAYOUTS[(index + 1) % LAYOUTS.length];
        ScreenManager.switchModeVRScreen(mode);
        this.refreshModeLabels();
    }

    // The 3D / 2D and layout buttons show the current mode.
    refreshModeLabels() {
        this.stereoLabel.setProperties({ text: ScreenManager.force_2d_mode ? "2D" : "3D" });
        const layout = LAYOUTS.find(([mode]) => mode === ScreenManager.VRMode) ?? LAYOUTS[0];
        this.layoutLabel.setProperties({ text: layout[1]() });
    }

    buildMediaInfoPage(): Page {
        const values: UiText[] = [];
        const block = new UiContainer({ flexDirection: "column", justifyContent: "center", flexGrow: 1, fontSize: 55 });
        for (const [name] of mediaInfoLines(null, null)) {
            const value = new UiText({ text: "-", flexGrow: 1 });
            values.push(value);
            const line = new UiContainer({ flexDirection: "row", alignItems: "center", height: 90, flexShrink: 0 });
            line.add(new UiText({ text: name, width: 450, flexShrink: 0, color: materialColour("mutedText") }), value);
            block.add(line);
        }
        // Counts the page's showings, so a late answer from the browser about
        // a video shown before is dropped.
        let showings = 0;
        return {
            title: "Media info",
            block,
            onShow: () => {
                const entry = MAIN.fileBrowserPanel.fileForSource(this.videoElement.getAttribute("src"));
                const show = (decoding: Decoding | "checking") => {
                    mediaInfoLines(entry, this.videoElement, decoding).forEach(([, text, problem], index) => {
                        values[index].setProperties({
                            text: shortenText(text, 40),
                            color: materialColour(problem ? "danger" : "text"),
                        });
                    });
                };
                show("checking");
                const showing = ++showings;
                void browserDecoding(entry?.media, navigator.mediaCapabilities).then((decoding) => {
                    if (showing === showings) show(decoding);
                });
            },
        };
    }

    ////////////////////////////////////////////////////////////////////////////
    // Playback

    // Play the next (offset 1) or previous (offset -1) video of the list the
    // library shows. The screen stays where the user put it.
    playAdjacentVideo(offset: number) {
        const file = MAIN.fileBrowserPanel.adjacentFile(offset);
        if (file === null) {
            MAIN.showPopupMessage(Helpers.getWordFromLang(offset > 0 ? "no_next_video" : "no_previous_video"));
            return;
        }
        this.hidePlayMenuPanel();
        ScreenManager.force2DMode(false);
        this.refreshModeLabels();
        MAIN.playCatalogueVideo(file);
    }

    ExitToMain() {
        this.hidePlayMenuPanel();
        ScreenManager.force2DMode(false);
        this.refreshModeLabels();
        ScreenManager.resetPosition("playMenuPanel");
        ScreenManager.resetPosition("meshes");
        MAIN.fileBrowserPanel.showFileMenuPanel();
    }

    videoPlaybackFFRew(direction: "FF" | "Rew", seconds = 10) {
        if (Helpers.videoSrcExists()) {
            this.videoElement.currentTime += direction === "FF" ? seconds : -seconds;
        }
    }

    playPause() {
        if (!Helpers.videoSrcExists()) {
            return;
        }
        if (this.videoElement.paused) {
            this.videoElement.play().catch((error) => console.warn(error));
        } else {
            this.videoElement.pause();
        }
    }

    toggleMute() {
        if (Helpers.videoSrcExists()) {
            this.videoElement.muted = !this.videoElement.muted;
        }
    }

    // The play button shows what a press does: play while paused or ended,
    // pause while playing.
    refreshPlayButton() {
        const video = this.videoElement;
        this.buttonPlay.setIcon(video.paused || video.ended ? PlayIcon : PauseIcon);
    }

    refreshMuteButton() {
        const muted = this.videoElement.muted;
        this.muteButton.setIcon(muted ? MuteIcon : VolumeIcon);
        uiMarkActive(this.muteButton, muted, { color: "danger" });
    }

    ////////////////////////////////////////////////////////////////////////////
    // Called every frame: the seek bar and time while the controls show, and
    // a fix for videos that never end.

    videoCantEndBug = false;
    // What the seek bar and time last showed.
    shownProgress = 0;
    shownTime = "";
    // Whether the video has stalled at its end (bufferingState.ts).
    stalledAtEnd = createEndStallTracker();

    progressBarAndDuration() {
        if (!Helpers.videoSrcExists()) {
            return;
        }
        const video = this.videoElement;
        const duration = video.duration;
        const durationKnown = Number.isFinite(duration) && duration > 0;

        if (MAIN.hiddenSphere.buttonsVisible) {
            // A source can be selected before the browser has loaded its
            // metadata: the bar mustn't get a NaN width in that gap.
            let played = this.PROGRESS_MIN_WIDTH;
            let time = Helpers.getWordFromLang("not_available");
            if (durationKnown) {
                const share = video.currentTime / duration;
                played = Math.max((this.BAR_WIDTH - this.PROGRESS_MIN_WIDTH * 2) * share, this.PROGRESS_MIN_WIDTH);
                time = `${clockTime(video.currentTime)} / ${clockTime(duration)}`;
            }
            // Whole millimetres, so the panel is laid out again only when
            // the bar has visibly moved.
            const width = Math.round(played * MM);
            if (width !== this.shownProgress) {
                this.shownProgress = width;
                this.progressBar.setProperties({ width });
            }
            if (time !== this.shownTime) {
                this.shownTime = time;
                this.timeLabel.setProperties({ text: time });
            }
        }

        // Some videos stop a hair before their duration (51.98569 of
        // 51.985691) and never end, flipping between their last frames. Two
        // frames in a row there: pause and jump past the end.
        if (!video.ended && durationKnown && video.currentTime / duration > 0.999999) {
            if (this.videoCantEndBug) {
                video.pause();
                video.currentTime += 10;
                this.videoCantEndBug = false;
            } else {
                this.videoCantEndBug = true;
            }
        } else {
            this.videoCantEndBug = false;
        }
        if (this.stalledAtEnd(video, performance.now())) {
            video.pause();
            video.currentTime = video.duration;
        }
    }
}
