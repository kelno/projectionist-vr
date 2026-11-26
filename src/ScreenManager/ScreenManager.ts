import { Matrix4, Quaternion, Vector3 } from "three";
import type { Object3D } from "three";

import * as MAIN from "../index.ts";
import PanelsList from "./Panels.ts";
import type { Eye, PanelGroup, ScreenMode } from "./Panels.ts";
import type { ScreenType } from "../types/catalogue.ts";
import { playerConfig } from "../playerConfig.ts";
import { loadPreference, savePreference } from "../browserPreferences.ts";

const ZOOM_PREFERENCE = "zoom";
const MAX_ZOOM = 180;

// What can be dragged together: the video's screens and the player's panel
// ("player"), the player's controls alone, or the library.
export type DragView = "player" | "playerControls" | "files";

interface DragObject {
    panelName: PanelGroup;
    ref: Object3D;
}

function clampZoom(value: unknown): number | null {
    const zoom = Number(value);
    return Number.isFinite(zoom) ? Math.min(Math.max(zoom, 0), MAX_ZOOM) : null;
}

function loadSavedZoom(): number | null {
    const savedZoom = loadPreference(ZOOM_PREFERENCE);
    return savedZoom === null ? null : clampZoom(savedZoom);
}

function saveZoom(zoom: number): void {
    savePreference(ZOOM_PREFERENCE, zoom);
}

let isVRModeUsed = true;
// The layout of the video playing; a flat video ("screen") keeps the last one.
export let VRMode: Exclude<ScreenType, "screen"> = "sbs";
let currently_3d = true;
export let force_2d_mode = false;
export let currentZoom = 0;
const panels = new PanelsList();
export const objectsToDrag: { [view: string]: DragObject[] } = {};

// `group` is what the panel resets with: "playMenuPanel", "fileBrowserPanel"...
export function registerPanel(ref: Object3D, group: Exclude<PanelGroup, "meshes">): void {
    panels.addPanel(ref, group);
}

export function registerMeshPanel(ref: Object3D, mode: ScreenMode, screen_type: ScreenType, eye: Eye): void {
    panels.addMesh(ref, mode, screen_type, eye);
}

export function registerObjectToDrag(obj: Object3D, view: DragView, panelName: PanelGroup): void {
    if (!(view in objectsToDrag)) {
        objectsToDrag[view] = [];
    }
    objectsToDrag[view].push({
        panelName: panelName,
        ref: obj,
    });
}

// Leaving VR (the headset sleeping, for instance) puts every panel back in
// place, but keeps the zoom the user was watching with.
export function vrsessionend(): void {
    const zoomInUse = currentZoom;
    resetZoomPosition();
    resetPosition("cameras");
    resetPosition("playMenuPanel");
    resetPosition("fileBrowserPanel");
    resetPosition("meshes");
    setZoom(zoomInUse, false);
}

export function resetPosition(group: PanelGroup): void {
    panels[group]?.panels.forEach((panel) => panel.reset());
    if (group === "meshes") {
        // The screens are back where they started: not zoomed or tilted.
        currentZoom = 0;
        currentTilt = 0;
    }
}

// Tilt brings another part of the video in front of the viewer, and zoom
// enlarges what is in front of them. Tilt turns the screens around the
// viewer: around a point level with each screen's centre, straight above or
// below them. Zoom moves the screens towards the viewer along the line
// straight ahead, which their centre was on before any tilt, so what is
// straight ahead stays there. Zooming along the tilted screen's own axis
// instead enlarged around the video's centre, and the part the tilt had
// brought in front slid away as if tilting back.
const X_AXIS = new Vector3(1, 0, 0);

function pivotOf(screen: { position: Vector3 }): Vector3 {
    return new Vector3(0, screen.position.y, 0);
}

// The way from the viewer straight ahead, to the screen's untilted centre.
function aheadOf(screen: { position: Vector3 }): Vector3 {
    return screen.position.clone().sub(pivotOf(screen)).normalize();
}

export function zoom(in_or_out: "in" | "out" | "reset", step = 10): void {
    let targetZoom: number;
    switch (in_or_out) {
        case "in":
            targetZoom = currentZoom + step;
            break;
        case "out":
            targetZoom = currentZoom - step;
            break;
        case "reset":
            targetZoom = 0;
            break;
        default:
            return;
    }
    setZoom(targetZoom, true);
}

function setZoom(targetZoom: number, persistPreference: boolean): void {
    const oldZoom = currentZoom;
    currentZoom = clampZoom(targetZoom) ?? 0;
    if (oldZoom !== currentZoom) {
        for (const screen of panels.meshes.panels) {
            screen.reference.position.addScaledVector(aheadOf(screen), oldZoom - currentZoom);
        }
    }
    if (persistPreference) {
        saveZoom(currentZoom);
    }
}

// Restore the user's choice for every video. Before a choice has been saved,
// retain the configured SBS-only behaviour and leave other modes at base size.
export function applyPlaybackZoom(): void {
    const savedZoom = loadSavedZoom();
    const initialZoom = savedZoom ?? (VRMode === "sbs" ? playerConfig.defaultSbsZoom : 0);
    setZoom(initialZoom, false);
}

// The player reset control restores the deployment's configured starting zoom
// and makes it the new browser preference for later videos.
export function resetZoomToConfiguredDefault(): void {
    setZoom(playerConfig.defaultSbsZoom, true);
}

// Playback transitions need a base mesh position, but must not erase the
// browser preference that will be restored for the next selected video.
export function resetZoomPosition(): void {
    setZoom(0, false);
}

// The screens' tilt, in radians, since they were last put back in place.
let currentTilt = 0;

// `value` is in radians; the picture turns by as much.
export function tilt(up_or_down: "up" | "down" | "reset", value = 0.0075): void {
    const angle = { up: -value, down: value, reset: -currentTilt }[up_or_down];
    const turn = new Quaternion().setFromAxisAngle(X_AXIS, angle);
    for (const screen of panels.meshes.panels) {
        // The zoom is taken out while turning, and put back after, so it
        // stays along the line straight ahead.
        const pivot = pivotOf(screen);
        const zoomed = aheadOf(screen).multiplyScalar(-currentZoom);
        screen.reference.position.sub(zoomed).sub(pivot).applyQuaternion(turn).add(pivot).add(zoomed);
        screen.reference.quaternion.premultiply(turn);
    }
    currentTilt += angle;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Switch between VR and Screen mode

export function switchModeVRScreen(vr_or_screen: ScreenType | "vr"): void {
    if (!currently_3d) {
        switch2d3d("3d", true);
    }
    panels.meshes.panels.forEach((mesh) => {
        mesh.switchModeVRScreen(vr_or_screen);
    });
    switch (vr_or_screen) {
        case "vr":
        case "sbs":
            isVRModeUsed = true;
            VRMode = "sbs";
            break;
        case "tb":
            isVRModeUsed = true;
            VRMode = "tb";
            break;
        case "360":
            isVRModeUsed = true;
            VRMode = "360";
            break;
        case "sphere180":
            VRMode = "sphere180";
            isVRModeUsed = false;
            break;
        case "sphere360":
            VRMode = "sphere360";
            isVRModeUsed = false;
            break;
        case "screen":
            isVRModeUsed = false;
            break;
        case "tb_screen":
            VRMode = "tb_screen";
            isVRModeUsed = true;
            break;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Switch between 2D and 3D mode

export function switch2d3d(switch_2d_or_3d: "2d" | "3d", forced = false): void {
    if (isVRModeUsed && (!force_2d_mode || forced)) {
        panels.meshes.panels.forEach((mesh) => {
            mesh.switch2d3d(switch_2d_or_3d, VRMode);
        });
        switch (switch_2d_or_3d) {
            case "2d":
                currently_3d = false;
                break;
            case "3d":
                currently_3d = true;
                break;
        }
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Force 2D mode

export function force2DMode(bool: boolean): void {
    force_2d_mode = bool;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export let dragging = false;

// While dragging: the controller holding the objects, and each object's pose
// relative to it when the drag started. followDrag() keeps them there each
// frame. The objects stay where they are in the scene: a uikit panel taken
// out of it and put back loses its backgrounds.
let holder: Object3D | null = null;
let held: { ref: Object3D; offset: Matrix4 }[] = [];
const pose = new Matrix4();

export function startDrag(view: DragView): void {
    if (MAIN.renderer.xr.isPresenting && !dragging && view in objectsToDrag) {
        holder = MAIN.vrControl.controllers[MAIN.vrControlCurrentlyUsedController];
        holder.updateWorldMatrix(true, false);
        const toHolder = holder.matrixWorld.clone().invert();
        held = objectsToDrag[view].map(({ ref }) => {
            // The object's own pose in the world, from its position,
            // rotation and scale: a uikit panel's world matrix also scales
            // a unit square to its size.
            ref.parent?.updateWorldMatrix(true, false);
            const world = new Matrix4().compose(ref.position, ref.quaternion, ref.scale);
            if (ref.parent) world.premultiply(ref.parent.matrixWorld);
            return { ref, offset: toHolder.clone().multiply(world) };
        });
        dragging = true;
    }
}

// Called every frame: the dragged objects follow the controller.
export function followDrag(): void {
    if (!dragging || !holder) {
        return;
    }
    holder.updateWorldMatrix(true, false);
    for (const { ref, offset } of held) {
        pose.multiplyMatrices(holder.matrixWorld, offset);
        if (ref.parent) pose.premultiply(ref.parent.matrixWorld.clone().invert());
        pose.decompose(ref.position, ref.quaternion, ref.scale);
    }
}

export function stopDrag(view: DragView): void {
    if (MAIN.renderer.xr.isPresenting && dragging && view in objectsToDrag) {
        followDrag();
        holder = null;
        held = [];
        dragging = false;
    }
}

export function resetDrag(view: DragView): void {
    if (MAIN.renderer.xr.isPresenting && view in objectsToDrag) {
        resetZoomPosition();
        const readyList: PanelGroup[] = [];
        objectsToDrag[view].forEach((obj) => {
            if (!readyList.includes(obj.panelName)) {
                resetPosition(obj.panelName);
                readyList.push(obj.panelName);
            }
        });
        if (view === "player") {
            // Same as the zoom reset in the settings: the configured default.
            resetZoomToConfiguredDefault();
        }
    }
}
