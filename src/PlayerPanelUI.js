import { Block, Text } from "./ui/meshUi.js";

import * as MAIN from "./index.js";
import * as ScreenManager from "./ScreenManager/ScreenManager.js";
import * as UI from "./UI.js";
import * as Helpers from "./Helpers.js";

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

import { PagedWindow } from "./ui/PagedWindow.js";
import {
    BUTTON_SIZE,
    FONT,
    SURFACE,
    column,
    divider,
    dragHandle,
    iconButton,
    label,
    markActive,
    row,
    textButton,
} from "./ui/kit.js";
import { colour, space } from "./ui/theme.js";
import { mediaInfoLines } from "./mediaInfo.mjs";
import { shortenText } from "./font.js";

// "01:02:03" for 3723 seconds.
function clockTime(seconds) {
    return new Date(seconds * 1000).toISOString().substring(11, 19);
}

// What the layout button shows for each video layout, in the order it steps
// through them.
const LAYOUTS = [
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
    PROGRESS_HEIGHT = 0.06;
    PROGRESS_MIN_WIDTH = 0.01;
    SETTINGS_WIDTH = this.WIDTH / 1.5;
    // The height of the settings window's pages, under their title.
    SETTINGS_HEIGHT = 0.85;

    // What can be clicked while the controls show.
    playMenuObjsToTest = [];

    constructor(video) {
        this.videoElement = video;

        this.buildControls();
        this.buildSettingsWindow();
        this.buildDraggingBox();

        // The controls and the bar under them move with the screen, and
        // alone with the move button; the settings window follows both.
        for (const view of ["player", "playerControls"]) {
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
        this.buttonPlay = iconButton({
            icon: PlayIcon,
            size: BUTTON_SIZE * 1.25,
            tooltip: "Play / pause",
            onSelect: () => this.playPause(),
        });
        const previous = iconButton({
            icon: PreviousIcon,
            tooltip: "Previous video",
            onSelect: () => this.playAdjacentVideo(-1),
        });
        const rewind = iconButton({
            icon: BackIcon,
            tooltip: "Back 10 s",
            onSelect: () => this.videoPlaybackFFRew("Rew"),
        });
        const forward = iconButton({
            icon: ForwardIcon,
            tooltip: "Forward 10 s",
            onSelect: () => this.videoPlaybackFFRew("FF"),
        });
        const next = iconButton({
            icon: NextIcon,
            tooltip: "Next video",
            onSelect: () => this.playAdjacentVideo(1),
        });
        this.settingsButton = iconButton({
            icon: SettingsIcon,
            tooltip: "Settings",
            onSelect: () =>
                this.settingsWindow.isOpen
                    ? this.hideSettingsMenuContainer()
                    : this.showSettingsMenuContainer(),
        });
        this.muteButton = iconButton({
            icon: VolumeIcon,
            tooltip: "Mute / unmute",
            onSelect: () => this.toggleMute(),
        });
        const exit = iconButton({
            icon: LibraryIcon,
            tooltip: "Back to library",
            onSelect: () => this.ExitToMain(),
        });
        const reset = iconButton({
            icon: ResetIcon,
            tooltip: "Reset position and zoom",
            onSelect: () => ScreenManager.resetDrag("player"),
        });
        const move = iconButton({
            icon: MoveIcon,
            tooltip: "Move the controls",
            onSelect: () => ScreenManager.startDrag("playerControls"),
            onRelease: () => ScreenManager.stopDrag("playerControls"),
        });

        // Three groups: the library and sound on the left, playback in the
        // middle, the screen's settings and placement on the right.
        const side = this.INNER_WIDTH / 4;
        const buttons = row(
            [
                row([exit, this.muteButton], { width: side, justify: "start" }),
                row([previous, rewind, this.buttonPlay, forward, next], {
                    width: this.INNER_WIDTH - 2 * side,
                    justify: "center",
                }),
                row([this.settingsButton, reset, move], { width: side, justify: "end" }),
            ],
            { width: this.INNER_WIDTH, justify: "center" }
        );
        // The play button stands out: a size larger, in the accent colour.
        markActive(this.buttonPlay, true);

        this.timeLabel = new Text({ content: "0:00", fontSize: 0.06 });
        const time = new Block({
            width: this.INNER_WIDTH,
            height: 0.09,
            justifyContent: "center",
            textAlign: "right",
            backgroundOpacity: 0,
            fontColor: colour("mutedText"),
        }).add(this.timeLabel);

        this.playMenuContainer = new Block({
            width: this.WIDTH,
            contentDirection: "column",
            justifyContent: "center",
            padding: this.PADDING,
            ...SURFACE,
            ...FONT,
        }).add(this.buildSeekBar(), time, buttons);
        this.playMenuContainer.visible = false;
        this.playMenuContainer.position.set(0, 0.6, -3);
        MAIN.scene.add(this.playMenuContainer);
        ScreenManager.registerPanel(this.playMenuContainer, "playMenuPanel");

        // A click on the controls' background closes the settings, if open.
        this.playMenuContainer.setupState({
            state: "selected",
            onSet: () => {
                if (this.settingsWindow.isOpen) {
                    this.hideSettingsMenuContainer();
                }
            },
        });
        this.playMenuContainer.setupState({ state: "hovered" });
        this.playMenuContainer.setupState({ state: "idle" });

        this.playMenuObjsToTest.push(
            reset,
            move,
            exit,
            previous,
            rewind,
            this.buttonPlay,
            forward,
            next,
            this.muteButton,
            this.settingsButton,
            this.seekBar,
            this.playMenuContainer,
            MAIN.hiddenSphere
        );
    }

    // The seek bar: the part played in the accent colour, a light mark at the
    // current time; a click seeks to where it lands.
    buildSeekBar() {
        const part = (width, color) =>
            new Block({
                width,
                height: this.PROGRESS_HEIGHT,
                margin: 0,
                borderRadius: 0,
                backgroundColor: colour(color),
                offset: 0.005,
            });
        this.progressBar = part(this.PROGRESS_MIN_WIDTH, "accent");
        const mark = part(this.PROGRESS_MIN_WIDTH * 2, "text");
        // Drawn on the layers the screen's eyes see, above the video.
        for (const block of [this.progressBar, mark]) {
            block.onAfterUpdate = () => {
                block.frame.layers.set(1);
                block.frame.layers.enable(2);
            };
        }

        this.seekBar = new Block({
            width: this.INNER_WIDTH,
            height: this.PROGRESS_HEIGHT,
            margin: 0,
            offset: 0.045,
            borderRadius: 0,
            justifyContent: "start",
            contentDirection: "row",
            backgroundColor: colour("track"),
            backgroundOpacity: 1,
        }).add(this.progressBar, mark);
        this.seekBar.setupState({
            state: "selected",
            onSet: () => {
                const video = this.videoElement;
                video.currentTime = video.duration * this.seekBar.uv.x;
            },
        });
        // Hovering lightens the bar. Changing its height instead would
        // reflow the whole controls panel around it.
        this.seekBar.setupState({
            state: "hovered",
            attributes: { backgroundColor: colour("hovered") },
        });
        this.seekBar.setupState({
            state: "idle",
            attributes: { backgroundColor: colour("track") },
        });
        return this.seekBar;
    }

    // The bar under the controls, to move the screen and controls together.
    buildDraggingBox() {
        this.draggingBox = dragHandle({
            width: this.WIDTH / 2,
            height: 0.1,
            tooltip: "Move the screen and controls",
            onStart: () => ScreenManager.startDrag("player"),
            onStop: () => ScreenManager.stopDrag("player"),
        });
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
        const innerWidth = width - 0.08;
        this.settingsWindow = new PagedWindow({
            width,
            bodyHeight: this.SETTINGS_HEIGHT,
            onTargetsChange: (targets) => {
                // While open, only the window, the gear and outside clicks count.
                UI.registerNewObjectsToTest([
                    ...targets,
                    this.settingsButton,
                    this.playMenuContainer,
                    MAIN.hiddenSphere,
                ]);
            },
        });
        // ScreenManager finds panels by this property name to reset them.
        this.settingsMenuContainer = this.settingsWindow.container;
        // Just above the controls, which sit at y 0.6.
        this.settingsMenuContainer.position.set(0, 1.46, -2.95);
        MAIN.scene.add(this.settingsMenuContainer);
        ScreenManager.registerPanel(this.settingsMenuContainer, "playMenuPanel");

        this.settingsWindow.addPage("settings", this.buildSettingsPage(innerWidth));
        this.settingsWindow.addPage("media", this.buildMediaInfoPage(innerWidth));
    }

    buildSettingsPage(width) {
        const rowLabel = (key) =>
            label(Helpers.getWordFromLang(key), { width: 0.45, fontSize: 0.05 });

        const screenMode = iconButton({
            icon: ScreenIcon,
            tooltip: "Flat screen",
            onSelect: () => ScreenManager.switchModeVRScreen("screen"),
        });
        const vrMode = iconButton({
            icon: VRIcon,
            tooltip: "VR view",
            onSelect: () => ScreenManager.switchModeVRScreen(ScreenManager.VRMode),
        });
        const stereo = textButton({
            label: "3D",
            tooltip: "3D / 2D",
            width: BUTTON_SIZE,
            onSelect: () => {
                ScreenManager.force2DMode(!ScreenManager.force_2d_mode);
                this.refreshModeLabels();
            },
        });
        this.stereoLabel = stereo.text;
        const layout = textButton({
            label: Helpers.getWordFromLang("side_by_side"),
            tooltip: "Video layout",
            onSelect: () => this.nextVideoLayout(),
        });
        this.layoutLabel = layout.text;

        const zoomOut = iconButton({ icon: ZoomOutIcon, tooltip: "Zoom out", onSelect: () => ScreenManager.zoom("out") });
        const zoomIn = iconButton({ icon: ZoomInIcon, tooltip: "Zoom in", onSelect: () => ScreenManager.zoom("in") });
        const zoomReset = iconButton({
            icon: ResetIcon,
            tooltip: "Default zoom",
            onSelect: () => ScreenManager.resetZoomToConfiguredDefault(),
        });
        const tiltDown = iconButton({ icon: DownIcon, tooltip: "Tilt down", onSelect: () => ScreenManager.tilt("down") });
        const tiltUp = iconButton({ icon: UpIcon, tooltip: "Tilt up", onSelect: () => ScreenManager.tilt("up") });
        const tiltReset = iconButton({ icon: ResetIcon, tooltip: "Reset tilt", onSelect: () => ScreenManager.tilt("reset") });
        // Media info isn't a setting: it sits apart, under a line.
        const mediaInfo = textButton({
            label: "Media info",
            tooltip: "Resolution, codecs, bitrate...",
            width: 0.6,
            onSelect: () => this.settingsWindow.show("media"),
        });

        const targets = [screenMode, vrMode, stereo, layout, zoomOut, zoomIn, zoomReset, tiltDown, tiltUp, tiltReset, mediaInfo];
        return {
            title: "Settings",
            targets,
            block: column(
                [
                    row([rowLabel("switch_mode"), screenMode, vrMode, stereo, layout], { width }),
                    row([rowLabel("zoom_video"), zoomOut, zoomIn, zoomReset], { width }),
                    row([rowLabel("tilt_video"), tiltDown, tiltUp, tiltReset], { width }),
                    divider(width),
                    row([rowLabel("this_video"), mediaInfo], { width }),
                ],
                { width, height: this.SETTINGS_HEIGHT }
            ),
        };
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
        this.stereoLabel.set({ content: ScreenManager.force_2d_mode ? "2D" : "3D" });
        const layout = LAYOUTS.find(([mode]) => mode === ScreenManager.VRMode) ?? LAYOUTS[0];
        this.layoutLabel.set({ content: layout[1]() });
    }

    buildMediaInfoPage(width) {
        const values = [];
        const rows = mediaInfoLines(null, null).map(([name]) => {
            const value = label("-", { width: width - 0.5, height: 0.09, fontSize: 0.055 });
            values.push(value);
            return row(
                [label(name, { width: 0.45, height: 0.09, fontSize: 0.055, color: "mutedText" }), value],
                { width, height: 0.095 }
            );
        });
        return {
            title: "Media info",
            targets: [],
            block: column(rows, { width, height: this.SETTINGS_HEIGHT }),
            onShow: () => {
                const entry = MAIN.fileBrowserPanel.fileForSource(this.videoElement.getAttribute("src"));
                mediaInfoLines(entry, this.videoElement).forEach(([, text, problem], index) => {
                    values[index].text.set({
                        content: shortenText(text, 40),
                        fontColor: colour(problem ? "danger" : "text"),
                    });
                });
            },
        };
    }

    ////////////////////////////////////////////////////////////////////////////
    // Playback

    // Play the next (offset 1) or previous (offset -1) video of the list the
    // library shows. The screen stays where the user put it.
    playAdjacentVideo(offset) {
        const file = MAIN.fileBrowserPanel.adjacentFile(offset);
        if (file === null) {
            MAIN.showPopupMessage(
                Helpers.getWordFromLang(offset > 0 ? "no_next_video" : "no_previous_video")
            );
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

    videoPlaybackFFRew(direction, seconds = 10) {
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
        markActive(this.muteButton, muted, { color: "danger" });
    }

    ////////////////////////////////////////////////////////////////////////////
    // Called every frame: the seek bar and time while the controls show, and
    // a fix for videos that never end.

    videoCantEndBug = false;

    progressBarAndDuration() {
        if (!Helpers.videoSrcExists()) {
            return;
        }
        const video = this.videoElement;
        const duration = video.duration;
        const durationKnown = Number.isFinite(duration) && duration > 0;

        if (MAIN.hiddenSphere.buttonsVisible) {
            // A source can be selected before the browser has loaded its
            // metadata: ThreeMeshUI mustn't get a NaN width in that gap.
            if (!durationKnown) {
                this.progressBar.set({ width: this.PROGRESS_MIN_WIDTH });
                this.timeLabel.set({ content: Helpers.getWordFromLang("not_available") });
            } else {
                const played = (this.INNER_WIDTH - this.PROGRESS_MIN_WIDTH * 2) * (video.currentTime / duration);
                this.progressBar.set({ width: Math.max(played, this.PROGRESS_MIN_WIDTH) });
                this.timeLabel.set({ content: `${clockTime(video.currentTime)} / ${clockTime(duration)}` });
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
    }
}
