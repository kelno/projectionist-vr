import {
    Color,
    TextureLoader,
} from "three";
import {
    Block,
    Text,
    InlineBlock,
} from "./ui/meshUi.js";

import FontJSON from "../assets/fonts/Roboto-Regular-msdf.json";
import FontImage from "../assets/fonts/Roboto-Regular.png";

import * as MAIN from "./index.js";

import * as ScreenManager from "./ScreenManager/ScreenManager.js";

import * as UI from "./UI.js";

import * as Helpers from "./Helpers.js";

// Import Icons
import PlayIcon from "../assets/icons/play.png";
import PauseIcon from "../assets/icons/pause.png";
import StopIcon from "../assets/icons/stop.png";
import FFIcon from "../assets/icons/fast-forward.png";
import RewIcon from "../assets/icons/rewind.png";
import MuteIcon from "../assets/icons/mute.png";
import VolumeIcon from "../assets/icons/volume.png";
import ExitIcon from "../assets/icons/logout.png";
import SettingsIcon from "../assets/icons/setting.png";
import ZoomOutIcon from "../assets/icons/zoom-out.png";
import ZoomInIcon from "../assets/icons/zoom-in.png";
import UpIcon from "../assets/icons/up-arrow.png";
import DownIcon from "../assets/icons/down-arrow.png";
import VRIcon from "../assets/icons/vr-glasses.png";
import WideScreenIcon from "../assets/icons/wide.png";
import ResetIcon from "../assets/icons/reset.png";
import FullScreenIcon from "../assets/icons/fullscreen.png";

import RightIcon from "../assets/icons/right-arrow.png";

import { PagedWindow } from "./ui/PagedWindow.js";
import { BUTTON_SIZE, column, iconButton, label, row, textButton } from "./ui/kit.js";
import { mediaInfoLines } from "./mediaInfo.mjs";
import { sanitizeFontText } from "./font.js";

function shorten(text, length) {
    return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}
import PreviousVideoIcon from "../assets/icons/left-arrow.png";
import NextVideoIcon from "../assets/icons/right-arrow.png";

export class PlayerPanel {
    playMenuContainer;
    playMenuObjsToTest = [];
    progressBar;
    progressBarContainer;
    settingsMenuContainer;
    buttonPlay;
    playIconElement;
    pauseIconElement;
    VR2DModeButtonText;
    VRSBSTBModeButtonText;
    draggingBox;

    loader = new TextureLoader();

    PLAYERPANELMAXWIDTH = 3;
    PROGRESSPANELMAXWIDTH = this.PLAYERPANELMAXWIDTH - 0.1;
    PROGRESSPANELHEIGHT = 0.08;
    PROGRESSPANELMINWIDTH = 0.01;

    SETTINGSPANELMAXWIDTH = this.PLAYERPANELMAXWIDTH / 1.5;
    BUTTONSPANELMAXWIDTH = this.PLAYERPANELMAXWIDTH - 0.2;

    videoElement;

    commonBlockAttributes = {
        justifyContent: "center",
        contentDirection: "row",
        fontFamily: FontJSON,
        fontTexture: FontImage,
        fontSize: 0.07,
        padding: 0.02,
        borderRadius: 0.11,
        backgroundOpacity: 0,
    };

    playbackContainerAttributes = {
        justifyContent: "center",
        contentDirection: "row",
        fontFamily: FontJSON,
        fontTexture: FontImage,
        fontSize: 0.07,
        padding: 0.02,
        borderRadius: 0.11,
        backgroundOpacity: 0,
        height: 0.1,
        width: this.PLAYERPANELMAXWIDTH,
    };

    // Holds Previous;REW;Play/Pause;FF;Next;Settings buttons
    centerContainerAttributes = {
        width: this.BUTTONSPANELMAXWIDTH / 2,
        height: 0.15,
        justifyContent: "center",
        contentDirection: "row",
        offset: 0,
        margin: 0,
        backgroundOpacity: 0,
    };

    exitButtonContainerAttributes = {
        width: this.BUTTONSPANELMAXWIDTH / 6,
        height: 0.15,
        justifyContent: "start",
        contentDirection: "row",
        offset: 0,
        margin: 0,
        backgroundOpacity: 0,
    };

    muteButtonContainerAttributes = {
        width: this.BUTTONSPANELMAXWIDTH / 6,
        height: 0.15,
        justifyContent: "end",
        contentDirection: "row",
        offset: 0,
        margin: 0,
        backgroundOpacity: 0,
    };

    moveButtonContainerAttributes = {
        width: this.BUTTONSPANELMAXWIDTH / 6,
        height: 0.15,
        justifyContent: "end",
        contentDirection: "row",
        offset: 0,
        margin: 0,
        backgroundOpacity: 0,
    };

    progressBarAttributes = {
        height: this.PROGRESSPANELHEIGHT,
        width: 0.001,
        margin: 0,
        borderRadius: 0,
        backgroundColor: new Color(0x0099ff),
        justifyContent: "center",
        alignItems: "center",
        offset: 0.005,
    };

    progressBarPointAttributes = {
        height: this.PROGRESSPANELHEIGHT,
        width: this.PROGRESSPANELMINWIDTH * 2,
        margin: 0,
        borderRadius: 0,
        backgroundColor: new Color(0xffffff),
        justifyContent: "center",
        alignItems: "center",
        offset: 0.005,
    };

    progressBarContainerAttributes = {
        height: this.PROGRESSPANELHEIGHT,
        width: this.PROGRESSPANELMAXWIDTH,
        margin: 0.04,
        offset: 0.045,
        borderRadius: 0,
        justifyContent: "start",
        contentDirection: "row",
        backgroundOpacity: 1,
        backgroundColor: new Color(0x5b5b5b),
    };

    iconElementAttributes = {
        width: 0.15,
        height: 0.15,
        justifyContent: "center",
        backgroundOpacity: 0,
        offset: 0,
        margin: 0.02,
        borderRadius: 0.08,
    };

    playbackLabelContainer;
    ////////////////////////////////////////////////////////////////////////////////////////
    // BUTTONS OPTIONS
    // We start by creating objects containing options that we will use with the two buttons,
    // in order to write less code.

    buttonOptions = {
        width: 0.15,
        height: 0.15,
        justifyContent: "center",
        offset: 0.05,
        margin: 0.02,
        backgroundOpacity: 1,
        borderRadius: 0.08,
    };

    // Options for component.setupState().
    // It must contain a 'state' parameter, which you will refer to with component.setState( 'name-of-the-state' ).

    hoveredStateAttributes = {
        offset: 0.035,
        backgroundColor: new Color(0xffff00),
        backgroundOpacity: 1,
        fontColor: new Color(0x000000),
    };

    hoveredState = {
        state: "hovered",
        attributes: this.hoveredStateAttributes,
    };

    idleStateAttributes = {
        offset: 0.035,
        backgroundColor: new Color(0x999999),
        backgroundOpacity: 1,
        fontColor: new Color(0xffffff),
    };

    idleState = {
        state: "idle",
        attributes: this.idleStateAttributes,
    };

    selectedAttributes = {
        offset: 0.02,
        backgroundColor: new Color(0x777777),
        backgroundOpacity: 1,
        fontColor: new Color(0x222222),
    };

    textureAttributes(texture) {
        return {
            height: 0.1,
            width: 0.1,
            backgroundTexture: texture,
            borderRadius: 0,
        };
    }

    //////////////////////////////////////////////////////////////////////////////
    // CONSTRUCT
    //////////////////////////////////////////////////////////////////////////////

    constructor(video) {
        this.videoElement = video;

        this.playMenuContainer = new Block({
            justifyContent: "center",
            contentDirection: "column-reverse",
            fontFamily: FontJSON,
            fontTexture: FontImage,
            fontSize: 0.07,
            padding: 0.02,
            borderRadius: 0,
            backgroundOpacity: 1,
            width: this.PLAYERPANELMAXWIDTH,
        });
        this.playMenuContainer.visible = false;
        MAIN.scene.add(this.playMenuContainer);
        const playMenuContainerButtons = new Block(this.commonBlockAttributes);

        this.playMenuContainer.position.set(0, 0.6, -3);
        this.playMenuContainer.add(playMenuContainerButtons);

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

        ScreenManager.registerPanel(
            this.playMenuContainer,
            "playMenuPanel",
            "playMenuContainer",
            "playMenuContainer"
        );

        ////////////////////////////////////////

        // Time elapsed and duration info label
        const playbackContainer = new Block(this.playbackContainerAttributes);
        this.playbackLabelContainer = new Text({
            content: "0:00",
        });
        playbackContainer.add(this.playbackLabelContainer);
        this.playMenuContainer.add(playbackContainer);

        ////////////////////////////////////////

        // BUTTONS

        // Buttons creation, with the options objects passed in parameters.

        this.buttonPlay = new Block(this.buttonOptions);
        const buttonPause = new Block(this.buttonOptions);
        buttonPause.visible = false;
        const buttonStop = new Block(this.buttonOptions);
        const buttonFF = new Block(this.buttonOptions);
        const buttonRew = new Block(this.buttonOptions);
        const buttonPreviousVideo = new Block(this.buttonOptions);
        const buttonNextVideo = new Block(this.buttonOptions);
        const buttonMute = new Block(this.buttonOptions);
        const dummyButtonMute = new Block(this.buttonOptions);
        dummyButtonMute.visible = false;
        const buttonMuteContainer = new Block(
            this.muteButtonContainerAttributes
        ).add(buttonMute, dummyButtonMute);
        const buttonExitToMain = new Block(this.buttonOptions);
        const buttonExitToMainContainer = new Block(
            this.exitButtonContainerAttributes
        ).add(buttonExitToMain);

        const settingsButton = new Block(this.buttonOptions);
        const buttonsPlaybackContainer = new Block(
            this.centerContainerAttributes
        ).add(
            buttonPause,
            buttonPreviousVideo,
            buttonRew,
            this.buttonPlay,
            buttonFF,
            buttonNextVideo,
            settingsButton
        );

        const moveButton = new Block(this.buttonOptions);
        const moveResetButton = new Block(this.buttonOptions);

        // Shown on hover.
        this.buttonPlay.tooltip = "Play / pause";
        buttonRew.tooltip = "Back 10 s";
        buttonFF.tooltip = "Forward 10 s";
        buttonPreviousVideo.tooltip = "Previous video";
        buttonNextVideo.tooltip = "Next video";
        buttonMute.tooltip = "Mute / unmute";
        buttonExitToMain.tooltip = "Back to library";
        settingsButton.tooltip = "Settings";
        moveButton.tooltip = "Move the controls";
        moveResetButton.tooltip = "Reset position and zoom";
        const moveButtonContainer = new Block(
            this.moveButtonContainerAttributes
        ).add(moveResetButton, moveButton);

        /////////////////////////////////////////////////////////////////////////////////

        this.playIconElement = new Block(this.iconElementAttributes);

        this.pauseIconElement = new Block(this.iconElementAttributes);

        this.loader.load(PlayIcon, (texture) => {
            this.playIconElement.add(
                new InlineBlock(this.textureAttributes(texture))
            );
        });

        this.loader.load(PauseIcon, (texture) => {
            this.pauseIconElement.add(
                new InlineBlock(this.textureAttributes(texture))
            );
        });
        this.buttonPlay.add(this.pauseIconElement);
        buttonPause.add(this.playIconElement);

        this.loader.load(StopIcon, (texture) => {
            buttonStop.add(new InlineBlock(this.textureAttributes(texture)));
        });

        this.loader.load(FFIcon, (texture) => {
            buttonFF.add(new InlineBlock(this.textureAttributes(texture)));
        });

        this.loader.load(RewIcon, (texture) => {
            buttonRew.add(new InlineBlock(this.textureAttributes(texture)));
        });

        this.loader.load(PreviousVideoIcon, (texture) => {
            buttonPreviousVideo.add(
                new InlineBlock(this.textureAttributes(texture))
            );
        });

        this.loader.load(NextVideoIcon, (texture) => {
            buttonNextVideo.add(
                new InlineBlock(this.textureAttributes(texture))
            );
        });

        this.loader.load(ExitIcon, (texture) => {
            buttonExitToMain.add(
                new InlineBlock(this.textureAttributes(texture))
            );
        });
        //////////////////////////////////////

        const muteIconElement = new Block(this.iconElementAttributes);

        const unmuteIconElement = new Block(this.iconElementAttributes);

        this.loader.load(VolumeIcon, (texture) => {
            muteIconElement.add(
                new InlineBlock(this.textureAttributes(texture))
            );
        });
        this.loader.load(MuteIcon, (texture) => {
            unmuteIconElement.add(
                new InlineBlock(this.textureAttributes(texture))
            );
        });
        buttonMute.add(muteIconElement);
        dummyButtonMute.add(unmuteIconElement);
        buttonMute.muted = false;

        ///////////////////////////////////////////////

        this.loader.load(SettingsIcon, (texture) => {
            settingsButton.add(
                new InlineBlock(this.textureAttributes(texture))
            );
        });

        this.loader.load(FullScreenIcon, (texture) => {
            moveButton.add(new InlineBlock(this.textureAttributes(texture)));
        });

        // Create states for the buttons.
        // In the loop, we will call component.setState( 'state-name' ) when mouse hover or click

        this.buttonPlay.setupState({
            state: "selected",
            attributes: this.selectedAttributes,
            onSet: () => {
                this.playPause();
            },
        });
        this.buttonPlay.setupState(this.hoveredState);
        this.buttonPlay.setupState(this.idleState);

        this.buttonPlay.playbackStarted = () => {
            this.buttonPlay.remove(this.playIconElement);
            this.buttonPlay.add(this.pauseIconElement);
        };

        buttonFF.setupState({
            state: "selected",
            attributes: this.selectedAttributes,
            onSet: () => {
                this.videoPlaybackFFRew("FF");
            },
        });
        buttonFF.setupState(this.hoveredState);
        buttonFF.setupState(this.idleState);

        //

        buttonRew.setupState({
            state: "selected",
            attributes: this.selectedAttributes,
            onSet: () => {
                this.videoPlaybackFFRew("Rew");
            },
        });
        buttonRew.setupState(this.hoveredState);
        buttonRew.setupState(this.idleState);

        //

        buttonPreviousVideo.setupState({
            state: "selected",
            attributes: this.selectedAttributes,
            onSet: () => {
                this.playAdjacentVideo(-1);
            },
        });
        buttonPreviousVideo.setupState(this.hoveredState);
        buttonPreviousVideo.setupState(this.idleState);

        buttonNextVideo.setupState({
            state: "selected",
            attributes: this.selectedAttributes,
            onSet: () => {
                this.playAdjacentVideo(1);
            },
        });
        buttonNextVideo.setupState(this.hoveredState);
        buttonNextVideo.setupState(this.idleState);

        //

        buttonExitToMain.setupState({
            state: "selected",
            attributes: this.selectedAttributes,
            onSet: () => {
                this.ExitToMain();
            },
        });
        buttonExitToMain.setupState(this.hoveredState);
        buttonExitToMain.setupState(this.idleState);

        //

        buttonMute.setupState({
            state: "selected",
            attributes: this.selectedAttributes,
            onSet: () => {
                if (Helpers.videoSrcExists()) {
                    switch (video.muted) {
                        case true:
                            buttonMute.muted = video.muted = false;
                            buttonMute.remove(unmuteIconElement);
                            buttonMute.add(muteIconElement);
                            break;
                        case false:
                            buttonMute.muted = video.muted = true;
                            buttonMute.remove(muteIconElement);
                            buttonMute.add(unmuteIconElement);
                            break;
                    }
                }
            },
        });
        buttonMute.setupState(this.hoveredState);
        buttonMute.setupState(this.idleState);
        buttonMute.setupState({
            state: "idlemuted",
            attributes: {
                offset: 0.035,
                backgroundColor: new Color(0xff0000),
                backgroundOpacity: 1,
                fontColor: new Color(0xffffff),
            },
        });

        //

        settingsButton.setupState({
            state: "selected",
            attributes: this.selectedAttributes,
            onSet: () => {
                switch (this.settingsWindow.isOpen) {
                    case true:
                        this.hideSettingsMenuContainer();
                        break;
                    case false:
                        this.showSettingsMenuContainer();
                        break;
                }
            },
        });
        settingsButton.setupState(this.hoveredState);
        settingsButton.setupState(this.idleState);

        //

        moveButton.setupState({
            state: "selected",
            attributes: this.selectedAttributes,
            onSet: () => {
                ScreenManager.startDrag("playerControls");
            },
        });

        moveButton.setupState({
            state: "hovered",
            attributes: this.hoveredStateAttributes,
            onSet: () => {
                ScreenManager.stopDrag("playerControls");
            },
        });
        moveButton.setupState({
            state: "idle",
            attributes: this.idleStateAttributes,
            onSet: () => {
                ScreenManager.stopDrag("playerControls");
            },
        });

        moveResetButton.setupState({
            state: "selected",
            attributes: this.selectedAttributes,
            onSet: () => {
                ScreenManager.resetDrag("player");
            },
        });

        moveResetButton.setupState({
            state: "hovered",
            attributes: this.hoveredStateAttributes,
        });

        moveResetButton.setupState({
            state: "idle",
            attributes: this.idleStateAttributes,
        });

        // Progress Bar

        this.progressBar = new Block(this.progressBarAttributes);
        let parent = this;
        this.progressBar.onAfterUpdate = function () {
            parent.progressBar.frame.layers.set(1);
            parent.progressBar.frame.layers.enable(2);
        };

        const progressBarPoint = new Block(this.progressBarPointAttributes);
        progressBarPoint.onAfterUpdate = function () {
            progressBarPoint.frame.layers.set(1);
            progressBarPoint.frame.layers.enable(2);
        };

        this.progressBarContainer = new Block(
            this.progressBarContainerAttributes
        ).add(this.progressBar, progressBarPoint);
        this.progressBarContainer.name = "progressBarContainer";

        this.progressBarContainer.setupState({
            state: "selected",
            onSet: () => {
                video.currentTime =
                    video.duration * this.progressBarContainer.uv.x;
            },
        });
        // Hovering lightens the bar. Changing its height instead would
        // reflow the whole controls panel around it.
        this.progressBarContainer.setupState({
            state: "hovered",
            attributes: { backgroundColor: new Color(0x8a8a8a) },
        });
        this.progressBarContainer.setupState({
            state: "idle",
            attributes: {
                backgroundColor:
                    this.progressBarContainerAttributes.backgroundColor,
            },
        });

        this.playMenuContainer.add(this.progressBarContainer);

        playMenuContainerButtons.add(
            buttonExitToMainContainer,
            buttonMuteContainer,
            buttonsPlaybackContainer,
            moveButtonContainer
        );
        this.playMenuObjsToTest.push(
            moveResetButton,
            moveButton,
            buttonExitToMain,
            buttonPreviousVideo,
            buttonRew,
            this.buttonPlay,
            buttonFF,
            buttonNextVideo,
            buttonMute,
            settingsButton,
            this.progressBarContainer,
            this.playMenuContainer,
            MAIN.hiddenSphere
        );

        this.loader.load(ResetIcon, (texture) => {
            moveResetButton.add(
                new InlineBlock(this.textureAttributes(texture))
            );
        });

        this.buildSettingsWindow(settingsButton);

        this.draggingBox = new Block({
            justifyContent: "center",
            contentDirection: "row",
            padding: 0.02,
            borderRadius: 0.06,
            backgroundOpacity: 1,
            backgroundColor: new Color(0x5c5c5c),
            width: this.PLAYERPANELMAXWIDTH / 2,
            height: 0.1,
        });
        this.draggingBox.visible = false;
        MAIN.scene.add(this.draggingBox);
        this.draggingBox.position.set(0, 0.25, -3);
        this.draggingBox.tooltip = "Move the screen and controls";
        this.draggingBox.setupState({
            state: "selected",
            onSet: () => {
                ScreenManager.startDrag("player");
            },
        });

        this.draggingBox.setupState({
            state: "hovered",
            attributes: {
                backgroundColor: new Color(0xffff00),
                backgroundOpacity: 1,
            },
            onSet: () => {
                ScreenManager.stopDrag("player");
            },
        });
        this.draggingBox.setupState({
            state: "idle",
            attributes: {
                backgroundColor: new Color(0x5c5c5c),
                backgroundOpacity: 1,
            },
            onSet: () => {
                ScreenManager.stopDrag("player");
            },
        });
        ScreenManager.registerPanel(
            this.draggingBox,
            "playMenuPanel",
            "draggingBox",
            "draggingBox"
        );
        this.playMenuObjsToTest.push(this.draggingBox);

        ScreenManager.registerObjectToDrag(
            this.draggingBox,
            "player",
            "playMenuPanel"
        );
        ScreenManager.registerObjectToDrag(
            this.playMenuContainer,
            "player",
            "playMenuPanel"
        );
        ScreenManager.registerObjectToDrag(
            this.settingsMenuContainer,
            "player",
            "playMenuPanel"
        );

        ScreenManager.registerObjectToDrag(
            this.draggingBox,
            "playerControls",
            "playMenuPanel"
        );
        ScreenManager.registerObjectToDrag(
            this.playMenuContainer,
            "playerControls",
            "playMenuPanel"
        );
        ScreenManager.registerObjectToDrag(
            this.settingsMenuContainer,
            "playerControls",
            "playMenuPanel"
        );
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Hide / Show Menu

    showPlayMenuPanel() {
        UI.showMenu(
            [this.playMenuContainer, this.draggingBox],
            this.playMenuObjsToTest,
            true
        );
        MAIN.hiddenSphere.buttonsVisible = true;
    }

    hidePlayMenuPanel() {
        if (this.settingsWindow.isOpen) {
            this.hideSettingsMenuContainer();
        }
        UI.hideMenu([this.playMenuContainer, this.draggingBox], [], true);
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

    // The settings window: a main page (mode, zoom, tilt) and sub-pages.
    buildSettingsWindow(settingsButton) {
        const width = this.SETTINGSPANELMAXWIDTH;
        const innerWidth = width - 0.08;
        this.settingsWindow = new PagedWindow({
            width,
            bodyHeight: 0.8,
            onTargetsChange: (targets) => {
                // While open, only the window, the gear and outside clicks count.
                UI.registerNewObjectsToTest([
                    ...targets,
                    settingsButton,
                    this.playMenuContainer,
                    MAIN.hiddenSphere,
                ]);
            },
        });
        // ScreenManager finds panels by this property name to reset them.
        this.settingsMenuContainer = this.settingsWindow.container;
        // Just above the controls, which sit at y 0.6.
        this.settingsMenuContainer.position.set(0, 1.4, -2.95);
        MAIN.scene.add(this.settingsMenuContainer);
        ScreenManager.registerPanel(
            this.settingsMenuContainer,
            "playMenuPanel",
            "settingsMenuContainer",
            "settingsMenuContainer"
        );

        this.settingsWindow.addPage("settings", this.buildSettingsPage(innerWidth));
        this.settingsWindow.addPage("media", this.buildMediaInfoPage(innerWidth));
    }

    buildSettingsPage(width) {
        const rowLabel = (key) =>
            label(Helpers.getWordFromLang(key), { width: 0.45, fontSize: 0.05 });

        const screenMode = iconButton({
            icon: WideScreenIcon,
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
                this.VR2DModeButtonText.set({
                    content: ScreenManager.force_2d_mode ? "2D" : "3D",
                });
            },
        });
        this.VR2DModeButtonText = stereo.text;
        const layout = textButton({
            label: Helpers.getWordFromLang("side_by_side"),
            tooltip: "Video layout",
            onSelect: () => this.nextVideoLayout(),
        });
        this.VRSBSTBModeButtonText = layout.text;

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
        const mediaInfo = textButton({
            label: "Media info",
            icon: RightIcon,
            width: width - 0.04,
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
                    row([mediaInfo], { width }),
                ],
                { width, height: 0.8 }
            ),
        };
    }

    // Steps through the video layouts: SBS, TB, 360, then the 2D spheres.
    nextVideoLayout() {
        const layouts = [
            ["sbs", Helpers.getWordFromLang("side_by_side")],
            ["tb", Helpers.getWordFromLang("top_bottom")],
            ["360", Helpers.getWordFromLang("top_bottom_360")],
            ["sphere180", "2D 180"],
            ["sphere360", "2D 360"],
        ];
        const index = layouts.findIndex(([mode]) => mode === ScreenManager.VRMode);
        if (index === -1) {
            return;
        }
        const [mode, name] = layouts[(index + 1) % layouts.length];
        ScreenManager.switchModeVRScreen(mode);
        this.VRSBSTBModeButtonText.set({ content: name });
    }

    buildMediaInfoPage(width) {
        const values = [];
        const rows = mediaInfoLines(null, null).map(([name]) => {
            const value = label("-", { width: width - 0.5, height: 0.1, fontSize: 0.055 });
            values.push(value);
            return row(
                [label(name, { width: 0.45, height: 0.1, fontSize: 0.055, color: 0xaaaaaa }), value],
                { width, height: 0.105 }
            );
        });
        return {
            title: "Media info",
            targets: [],
            block: column(rows, { width, height: 0.8 }),
            onShow: () => {
                const entry = MAIN.fileBrowserPanel.fileForSource(
                    MAIN.video.getAttribute("src")
                );
                mediaInfoLines(entry, MAIN.video).forEach(([, text], index) => {
                    values[index].text.set({
                        content: sanitizeFontText(shorten(text, 40)),
                    });
                });
            },
        };
    }

    // Play the next (offset 1) or previous (offset -1) video of the list the
    // library shows. The screen stays where the user put it.
    playAdjacentVideo(offset) {
        const file = MAIN.fileBrowserPanel.adjacentFile(offset);
        if (file === null) {
            MAIN.showPopupMessage(
                Helpers.getWordFromLang(
                    offset > 0 ? "no_next_video" : "no_previous_video"
                )
            );
            return;
        }
        this.hidePlayMenuPanel();
        ScreenManager.force2DMode(false);
        this.VR2DModeButtonText.set({ content: "3D" });
        MAIN.playCatalogueVideo(file);
    }

    ExitToMain() {
        this.hidePlayMenuPanel();
        ScreenManager.force2DMode(false);
        this.VR2DModeButtonText.set({ content: "3D" });
        this.VRSBSTBModeButtonText.set({
            content: Helpers.getWordFromLang("side_by_side"),
        });
        ScreenManager.resetPosition("playMenuPanel");
        ScreenManager.resetPosition("meshes");
        MAIN.fileBrowserPanel.showFileMenuPanel();
    }

    /////////////////////////////////////////////////////////////////
    // progressbar and duration time
    videoCantEndBug = false;

    progressBarAndDuration() {
        if (Helpers.videoSrcExists()) {
            if (MAIN.hiddenSphere.buttonsVisible) {
                const duration = MAIN.video.duration;

                // A source can be selected before the browser has loaded its
                // metadata. Do not pass a NaN width to ThreeMeshUI in that gap.
                if (!Number.isFinite(duration) || duration <= 0) {
                    this.progressBar.set({
                        width: this.PROGRESSPANELMINWIDTH,
                    });
                    this.playbackLabelContainer.set({
                        content: Helpers.getWordFromLang("not_available"),
                    });
                    this.videoCantEndBug = false;
                    return;
                }

                let progressBarLength =
                    ((this.PROGRESSPANELMAXWIDTH -
                        (this.PROGRESSPANELMINWIDTH * 2 - 0.001)) *
                        ((MAIN.video.currentTime * 100) /
                            duration)) /
                    100;
                this.progressBar.set({
                    width:
                        progressBarLength < this.PROGRESSPANELMINWIDTH
                            ? this.PROGRESSPANELMINWIDTH
                            : progressBarLength,
                });
                let playbackHelper = new Date(null);
                playbackHelper.setSeconds(MAIN.video.currentTime);
                let result = playbackHelper.toISOString().substring(11, 19);
                result += " / ";
                playbackHelper = new Date(null);
                playbackHelper.setSeconds(duration);
                result += playbackHelper.toISOString().substring(11, 19);
                this.playbackLabelContainer.set({ content: result });
            }

            if (MAIN.video.ended == false) {
                // Some videos can't stop playing, meaning they almost reach the end eg. video.duration: 51.985691 but when video reaches end video.currentTime is 51.98569
                // almost the end but playback can't end by itself which causes screen to flip between few last frames
                if (
                    (MAIN.video.currentTime * 100) / MAIN.video.duration >
                    99.9999
                ) {
                    if (this.videoCantEndBug) {
                        MAIN.video.pause();
                        MAIN.video.currentTime += 10;
                        this.buttonPlay.remove(this.pauseIconElement);
                        this.buttonPlay.add(this.playIconElement);
                        this.videoCantEndBug = false;
                    } else {
                        this.videoCantEndBug = true;
                    }
                }
            } else {
                this.videoCantEndBug = false;
                this.buttonPlay.remove(this.pauseIconElement);
                this.buttonPlay.add(this.playIconElement);
            }
        }
    }

    videoPlaybackFFRew(direction, seconds = 10) {
        if (Helpers.videoSrcExists()) {
            switch (direction) {
                case "FF":
                    this.videoElement.currentTime += seconds;
                    break;
                case "Rew":
                    this.videoElement.currentTime -= seconds;
                    break;
                default:
                    break;
            }
        }
    }

    playPause() {
        if (Helpers.videoSrcExists()) {
            switch (this.videoElement.paused) {
                case false:
                    this.videoElement.pause();
                    this.buttonPlay.remove(this.pauseIconElement);
                    this.buttonPlay.add(this.playIconElement);
                    break;
                default:
                case true:
                    this.buttonPlay.remove(this.playIconElement);
                    this.buttonPlay.add(this.pauseIconElement);
                    this.videoElement.play().catch((e) => {
                        console.warn(e);
                    });
                    break;
            }
        }
    }
}
