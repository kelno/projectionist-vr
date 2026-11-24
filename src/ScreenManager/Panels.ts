// What ScreenManager keeps of each panel and screen it manages: the object,
// and where it started, to put it back there on a reset. Panels are grouped
// by what resets together ("playMenuPanel", "meshes"...).
import type { Euler, Object3D, Vector3 } from "three";

import type { ScreenType } from "../types/catalogue.ts";

export type PanelGroup = "cameras" | "playMenuPanel" | "meshes" | "fileBrowserPanel";
// How a screen shows the video: one eye of a stereo pair ("3d"), the left
// eye's picture for both eyes ("2d"), or a flat picture ("screen").
export type ScreenMode = "3d" | "2d" | "screen";
export type Eye = "left" | "right" | "both";

export default class PanelsList {
    cameras: Panels;
    playMenuPanel: Panels;
    meshes: Panels<MeshPanel>;
    fileBrowserPanel: Panels;

    constructor() {
        this.cameras = new Panels();
        this.playMenuPanel = new Panels();
        this.meshes = new Panels();
        this.fileBrowserPanel = new Panels();
    }

    // The screens go in with addMesh.
    addPanel(ref: Object3D, group: Exclude<PanelGroup, "meshes">): void {
        this[group].panels.push(new Panel(ref));
    }

    addMesh(ref: Object3D, mode: ScreenMode, screen_type: ScreenType, eye: Eye): void {
        this.meshes.panels.push(new MeshPanel(ref, mode, screen_type, eye));
    }
}

class Panels<T extends Panel = Panel> {
    panels: T[];

    constructor() {
        this.panels = [];
    }
}

class Panel {
    reference: Object3D;
    position: Vector3;
    rotation: Euler;

    constructor(ref: Object3D) {
        this.reference = ref;
        this.position = ref.position.clone();
        this.rotation = ref.rotation.clone();
    }

    reset(): void {
        this.reference.position.copy(this.position);
        this.reference.rotation.copy(this.rotation);
    }
}

// A screen the video is shown on: its mode ("3d", "2d" or "screen"), the
// layout it serves ("sbs", "tb"...) and the eye that sees it.
class MeshPanel extends Panel {
    mode: ScreenMode;
    screen_type: ScreenType;
    eye: Eye;

    constructor(ref: Object3D, mode: ScreenMode, screen_type: ScreenType, eye: Eye) {
        super(ref);
        this.mode = mode;
        this.screen_type = screen_type;
        this.eye = eye;
    }

    switchModeVRScreen(vr_or_screen: ScreenType | "vr"): void {
        this.reference.visible = this.screen_type === vr_or_screen;
    }

    switch2d3d(switch_2d_or_3d: "2d" | "3d", VRMode: ScreenType): void {
        this.reference.visible =
            (this.mode === switch_2d_or_3d && this.screen_type === VRMode) ||
            (this.screen_type === VRMode && this.eye === "left");
    }
}
