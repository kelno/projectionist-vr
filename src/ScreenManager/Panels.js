// What ScreenManager keeps of each panel and screen it manages: the object,
// and where it started, to put it back there on a reset. Panels are grouped
// by what resets together ("playMenuPanel", "meshes"...).
export default class PanelsList {
    constructor() {
        this.cameras = new Panels();
        this.playMenuPanel = new Panels();
        this.meshes = new Panels();
        this.fileBrowserPanel = new Panels();
    }

    addPanel(ref, group) {
        this[group].panels.push(new Panel(ref));
    }

    addMesh(ref, mode, screen_type, eye) {
        this.meshes.panels.push(new MeshPanel(ref, mode, screen_type, eye));
    }
}

class Panels {
    constructor() {
        this.panels = [];
    }
}

class Panel {
    constructor(ref) {
        this.reference = ref;
        this.position = ref.position.clone();
        this.rotation = ref.rotation.clone();
    }

    reset() {
        this.reference.position.copy(this.position);
        this.reference.rotation.copy(this.rotation);
    }
}

// A screen the video is shown on: its mode ("3d", "2d" or "screen"), the
// layout it serves ("sbs", "tb"...) and the eye that sees it.
class MeshPanel extends Panel {
    constructor(ref, mode, screen_type, eye) {
        super(ref);
        this.mode = mode;
        this.screen_type = screen_type;
        this.eye = eye;
    }

    switchModeVRScreen(vr_or_screen) {
        this.reference.visible = this.screen_type === vr_or_screen;
    }

    switch2d3d(switch_2d_or_3d, VRMode) {
        this.reference.visible =
            (this.mode === switch_2d_or_3d && this.screen_type === VRMode) ||
            (this.screen_type === VRMode && this.eye === "left");
    }
}
